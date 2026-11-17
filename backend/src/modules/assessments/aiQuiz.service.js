/**
 * AI-assisted quiz generation for teachers.
 *
 * The AI only drafts questions. Nothing is saved as a quiz here: the teacher reviews
 * and edits the questions in the existing quiz builder, then saves/publishes through
 * the normal assessments workflow (POST /assessments), which records the generation
 * id and requires an explicit review confirmation before publishing.
 *
 * Question types are mapped onto what the existing attempt/grading engine supports:
 *   MCQ               -> MCQ (4 options, auto-graded)
 *   TRUE_FALSE        -> MCQ with options A=True, B=False (auto-graded)
 *   FILL_IN_THE_BLANK -> SHORT_ANSWER (teacher-graded; expected answer kept in the rubric)
 *   SHORT_ANSWER      -> SHORT_ANSWER (teacher-graded; model answer kept in the rubric)
 */
import { z } from 'zod';
import { db } from '../../shared/db/knex.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { getTeacherScope, isStaff, forbidden } from '../../shared/services/accessScope.js';
import { generateJson, getAiConfig } from '../../shared/ai/aiClient.js';

export const AI_QUESTION_TYPES = ['MCQ', 'TRUE_FALSE', 'FILL_IN_THE_BLANK', 'SHORT_ANSWER'];
export const AI_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'MIXED'];

const TYPE_LABELS = {
  MCQ: 'Multiple Choice',
  TRUE_FALSE: 'True / False',
  FILL_IN_THE_BLANK: 'Fill in the Blanks',
  SHORT_ANSWER: 'Short Questions'
};
const SECTION_ORDER = ['MCQ', 'TRUE_FALSE', 'FILL_IN_THE_BLANK', 'SHORT_ANSWER'];
const MARK_WEIGHTS = { MCQ: 1, TRUE_FALSE: 1, FILL_IN_THE_BLANK: 1, SHORT_ANSWER: 2 };
const MAX_VALIDATION_ATTEMPTS = 2;
const PENDING_STALE_MS = 3 * 60 * 1000;

function validation(message, details = null) {
  return new AppError(message, 422, ErrorCodes.VALIDATION_ERROR, details);
}

function invalidOutput(message, issues = []) {
  return new AppError(message, 502, ErrorCodes.AI_INVALID_OUTPUT, issues.length ? { issues: issues.slice(0, 10) } : null);
}

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------
const topicsSchema = z
  .union([z.array(z.string()), z.string()])
  .transform((v) => (Array.isArray(v) ? v : v.split(/[,\n;]/)))
  .transform((arr) => Array.from(new Set(arr.map((t) => t.trim()).filter(Boolean))))
  .refine((arr) => arr.length >= 1, 'Enter at least one topic.')
  .refine((arr) => arr.length <= 20, 'Enter at most 20 topics.')
  .refine((arr) => arr.every((t) => t.length <= 120), 'Each topic must be at most 120 characters.');

const idempotencyKeySchema = z
  .string({ required_error: 'idempotencyKey is required.' })
  .regex(/^[A-Za-z0-9_-]{8,64}$/, 'idempotencyKey must be 8-64 letters, digits, "-" or "_".');

const baseContext = {
  classId: z.coerce.number().int().positive(),
  subjectId: z.coerce.number().int().positive(),
  topics: topicsSchema,
  syllabus: z.string().trim().max(12000, 'Syllabus content must be at most 12,000 characters.').optional().default(''),
  instructions: z.string().trim().max(2000, 'Additional instructions must be at most 2,000 characters.').optional().default(''),
  allowOutsideSyllabus: z.coerce.boolean().optional().default(false),
  idempotencyKey: idempotencyKeySchema
};

export const generateQuizSchema = z
  .object({
    ...baseContext,
    title: z.string().trim().min(3, 'Quiz title is required.').max(255),
    difficulty: z.enum(AI_DIFFICULTIES, { errorMap: () => ({ message: 'Difficulty must be Easy, Medium, Hard or Mixed.' }) }),
    questionCount: z.coerce.number().int().min(1, 'Generate at least 1 question.').max(50, 'Generate at most 50 questions at a time.'),
    questionTypes: z
      .array(z.enum(AI_QUESTION_TYPES))
      .min(1, 'Select at least one question type.')
      .transform((arr) => Array.from(new Set(arr))),
    totalMarks: z.coerce.number().int().min(1).max(500),
    durationMinutes: z.coerce.number().int().min(5).max(300)
  })
  .superRefine((v, ctx) => {
    if (v.totalMarks < v.questionCount) {
      ctx.addIssue({ code: 'custom', path: ['totalMarks'], message: 'Total marks must be at least the number of questions (1 mark each).' });
    }
    if (v.questionTypes.length > v.questionCount) {
      ctx.addIssue({ code: 'custom', path: ['questionTypes'], message: 'Select no more question types than the number of questions.' });
    }
  });

export const regenerateQuestionSchema = z.object({
  ...baseContext,
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  questionType: z.enum(AI_QUESTION_TYPES),
  marks: z.coerce.number().positive().max(100),
  existingQuestions: z.array(z.string().max(1500)).max(60).optional().default([])
});

function parseOrThrow(schema, body) {
  const result = schema.safeParse(body || {});
  if (!result.success) {
    const first = result.error.issues[0];
    throw validation(first?.message || 'Invalid AI quiz request.', {
      issues: result.error.issues.map((i) => ({ field: i.path.join('.'), issue: i.message }))
    });
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Output validation
// ---------------------------------------------------------------------------
const normalizeText = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const AMBIGUOUS_OPTION = /^(all|none|both|neither) of (the )?(above|these|them)$|^both [a-d] and [a-d]$/i;

function topicMatches(topic, allowedTopics) {
  const t = normalizeText(topic);
  if (!t) return false;
  return allowedTopics.some((a) => {
    const n = normalizeText(a);
    return n === t || n.includes(t) || t.includes(n);
  });
}

/**
 * Validate the raw model output. Returns { questions, issues }. Any issue makes the
 * whole batch invalid: partially valid output is never returned or saved.
 */
export function validateGeneratedQuestions(data, { expectedCount, allowedTypes, difficulty, topics, allowOutsideSyllabus, existingQuestions = [] }) {
  const issues = [];
  const list = Array.isArray(data?.questions) ? data.questions : null;
  if (!list) return { questions: [], issues: ['Response did not contain a "questions" array.'] };
  if (list.length !== expectedCount) issues.push(`Expected exactly ${expectedCount} question(s) but received ${list.length}.`);

  const seen = new Set(existingQuestions.map(normalizeText).filter(Boolean));
  const clean = [];

  list.forEach((q, i) => {
    const n = i + 1;
    const type = String(q?.type || '').toUpperCase();
    const text = String(q?.question || '').trim();
    const qDifficulty = String(q?.difficulty || '').toUpperCase();
    const topic = String(q?.topic || '').trim();

    if (!allowedTypes.includes(type)) {
      issues.push(`Q${n}: type "${q?.type}" was not requested.`);
      return;
    }
    if (text.length < 8 || text.length > 1000) issues.push(`Q${n}: question text must be 8-1000 characters.`);
    if (!['EASY', 'MEDIUM', 'HARD'].includes(qDifficulty)) issues.push(`Q${n}: difficulty must be EASY, MEDIUM or HARD.`);
    else if (difficulty !== 'MIXED' && qDifficulty !== difficulty) issues.push(`Q${n}: difficulty ${qDifficulty} does not match requested ${difficulty}.`);
    if (!allowOutsideSyllabus && !topicMatches(topic, topics)) issues.push(`Q${n}: topic "${topic}" is not one of the supplied topics.`);

    const key = normalizeText(text);
    if (key && seen.has(key)) issues.push(`Q${n}: duplicate question.`);
    seen.add(key);

    const out = { type, text, difficulty: qDifficulty, topic, explanation: String(q?.explanation || '').trim().slice(0, 1000) };

    if (type === 'MCQ') {
      const options = Array.isArray(q?.options) ? q.options.map((o) => String(o ?? '').trim()) : [];
      if (options.length !== 4) issues.push(`Q${n}: MCQ must have exactly 4 options.`);
      if (options.some((o) => !o || o.length > 300)) issues.push(`Q${n}: MCQ options must be 1-300 characters.`);
      if (new Set(options.map(normalizeText)).size !== options.length) issues.push(`Q${n}: MCQ options must be distinct.`);
      if (options.some((o) => AMBIGUOUS_OPTION.test(o.replace(/[.\s]+$/, '')))) issues.push(`Q${n}: "all/none of the above" style options are not allowed (one clearly correct answer is required).`);
      const idx = Number(q?.correctOptionIndex);
      if (!Number.isInteger(idx) || idx < 0 || idx > 3) issues.push(`Q${n}: correctOptionIndex must be 0-3.`);
      out.options = options;
      out.correctIndex = idx;
    } else if (type === 'TRUE_FALSE') {
      if (typeof q?.answer !== 'boolean') issues.push(`Q${n}: True/False answer must be true or false.`);
      out.answer = q?.answer === true;
    } else {
      const expected = String(q?.expectedAnswer || '').trim();
      if (!expected || expected.length > 1000) issues.push(`Q${n}: expectedAnswer is required (max 1000 characters).`);
      if (type === 'FILL_IN_THE_BLANK' && !/_{3,}/.test(text)) issues.push(`Q${n}: fill-in-the-blank text must contain a blank written as "_____".`);
      out.expectedAnswer = expected;
    }
    clean.push(out);
  });

  if (issues.length === 0 && expectedCount >= allowedTypes.length) {
    const present = new Set(clean.map((q) => q.type));
    const missing = allowedTypes.filter((t) => !present.has(t));
    if (missing.length) issues.push(`Missing requested question type(s): ${missing.join(', ')}.`);
  }
  if (issues.length === 0 && difficulty === 'MIXED' && expectedCount >= 3) {
    if (new Set(clean.map((q) => q.difficulty)).size < 2) issues.push('A Mixed quiz must include at least two difficulty levels.');
  }
  return { questions: clean, issues };
}

/** Integer marks per question, weighted by type, summing exactly to totalMarks (each >= 1). */
export function allocateMarks(types, totalMarks) {
  const weights = types.map((t) => MARK_WEIGHTS[t] || 1);
  const sumW = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (totalMarks * w) / sumW);
  const marks = raw.map((r) => Math.max(1, Math.floor(r)));
  let diff = totalMarks - marks.reduce((a, b) => a + b, 0);
  const byFraction = raw.map((r, i) => ({ i, f: r - Math.floor(r) })).sort((a, b) => b.f - a.f);
  for (let k = 0; diff > 0; k = (k + 1) % byFraction.length, diff--) marks[byFraction[k].i] += 1;
  while (diff < 0) {
    // Only possible when many raw values were < 1; take marks back from the largest.
    const j = marks.indexOf(Math.max(...marks));
    if (marks[j] <= 1) break;
    marks[j] -= 1;
    diff++;
  }
  return marks;
}

/** Convert validated questions into the payload the quiz builder / POST /assessments accept. */
export function toEngineQuestions(validated, marks) {
  return validated.map((q, i) => {
    const base = {
      sectionName: `Part ${SECTION_ORDER.indexOf(q.type) + 1}: ${TYPE_LABELS[q.type]}`,
      marks: marks[i],
      aiMeta: { sourceType: q.type, difficulty: q.difficulty, topic: q.topic }
    };
    if (q.type === 'MCQ') {
      return {
        ...base,
        questionType: 'MCQ',
        prompt: q.text,
        options: q.options.map((text, k) => ({ key: 'ABCD'[k], text })),
        correctOption: 'ABCD'[q.correctIndex],
        rubricGuide: q.explanation || ''
      };
    }
    if (q.type === 'TRUE_FALSE') {
      return {
        ...base,
        questionType: 'MCQ',
        prompt: q.text,
        options: [
          { key: 'A', text: 'True' },
          { key: 'B', text: 'False' }
        ],
        correctOption: q.answer ? 'A' : 'B',
        rubricGuide: q.explanation || ''
      };
    }
    const label = q.type === 'FILL_IN_THE_BLANK' ? 'Expected answer' : 'Model answer';
    return {
      ...base,
      questionType: 'SHORT_ANSWER',
      prompt: q.text,
      options: [],
      correctOption: '',
      rubricGuide: `${label}: ${q.expectedAnswer}${q.explanation ? ` | Note: ${q.explanation}` : ''}`.slice(0, 2000)
    };
  });
}

// ---------------------------------------------------------------------------
// Prompting
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = [
  'You write school quiz questions for teachers. Output ONLY a single JSON object, no prose.',
  'Rules:',
  '- Every question must be answerable from the supplied topics and syllabus content. Do not introduce facts that are not in the syllabus or that you are unsure of.',
  '- Wording must be clear and age-appropriate for the stated class level.',
  '- MCQ: exactly 4 distinct options, exactly ONE correct option, no "all/none of the above" options, plausible distractors.',
  '- TRUE_FALSE: a statement that is unambiguously true or false according to the syllabus.',
  '- FILL_IN_THE_BLANK: a sentence containing one blank written as "_____" with a single short expected answer.',
  '- SHORT_ANSWER: a question answerable in 1-3 sentences, with a concise model answer.',
  '- Never repeat or paraphrase another question.',
  '- "topic" must be copied exactly from the supplied topic list.',
  'JSON shape: {"questions":[{"type":"MCQ|TRUE_FALSE|FILL_IN_THE_BLANK|SHORT_ANSWER","difficulty":"EASY|MEDIUM|HARD","topic":"...","question":"...","options":["..","..","..",".."],"correctOptionIndex":0,"answer":true,"expectedAnswer":"...","explanation":"one sentence justifying the answer"}]}',
  'Include "options" and "correctOptionIndex" only for MCQ, "answer" only for TRUE_FALSE, "expectedAnswer" only for FILL_IN_THE_BLANK and SHORT_ANSWER.'
].join('\n');

function buildPrompt(ctx, { count, types, difficulty, existingQuestions = [], feedback = [] }) {
  const lines = [
    `Class: ${ctx.className}${ctx.gradeLevel ? ` (grade level ${ctx.gradeLevel})` : ''}`,
    `Subject: ${ctx.subjectName}`,
    ctx.title ? `Quiz title: ${ctx.title}` : null,
    `Topics (use these exact strings for "topic"): ${JSON.stringify(ctx.topics)}`,
    `Number of questions: exactly ${count}`,
    `Allowed question types: ${types.join(', ')}${count >= types.length ? ' (include each type at least once)' : ''}`,
    difficulty === 'MIXED'
      ? 'Difficulty: MIXED - use a balanced spread of EASY, MEDIUM and HARD questions.'
      : `Difficulty: every question must be ${difficulty}.`,
    ctx.allowOutsideSyllabus
      ? 'The teacher allows closely related questions beyond the syllabus text, but they must still fit the listed topics.'
      : 'Stay strictly within the syllabus content and topics below.',
    ctx.instructions ? `Teacher instructions (follow unless they conflict with the rules): ${ctx.instructions}` : null,
    '',
    'Syllabus / chapter content:',
    '"""',
    ctx.syllabus || '(No syllabus text supplied: use only standard, uncontroversial facts for the listed topics at this class level.)',
    '"""'
  ];
  if (existingQuestions.length) {
    lines.push('', 'Do not duplicate or paraphrase any of these existing questions:', ...existingQuestions.slice(0, 60).map((q) => `- ${q}`));
  }
  if (feedback.length) {
    lines.push('', 'Your previous answer was rejected for these reasons. Fix all of them:', ...feedback.slice(0, 10).map((f) => `- ${f}`));
  }
  return lines.filter((l) => l !== null).join('\n');
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
async function resolveContext(user, classId, subjectId) {
  if (user.role === 'TEACHER') {
    const scope = await getTeacherScope(user.id);
    if (!scope.teacher) throw forbidden('Teacher profile not found for this account.');
    if (!scope.pairs.has(`${classId}-${subjectId}`)) throw forbidden('You are not assigned to teach this subject in the selected class.');
  } else if (!isStaff(user)) {
    throw forbidden();
  }
  const [cls, subject] = await Promise.all([
    db('classes').where({ id: classId }).first(),
    db('subjects').where({ id: subjectId }).first()
  ]);
  if (!cls || !subject) throw validation('Selected class or subject does not exist.');
  return { className: cls.name, gradeLevel: cls.grade_level, subjectName: subject.name };
}

async function enforceQuota(userId) {
  const limit = Math.max(1, Number(process.env.AI_QUIZ_HOURLY_LIMIT) || 20);
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const row = await db('ai_quiz_generations').where('requested_by', userId).where('created_at', '>=', since).count('id as n').first();
  if (Number(row?.n || 0) >= limit) {
    throw new AppError(`AI generation limit reached (${limit} per hour). Please try again later or continue manually.`, 429, ErrorCodes.RATE_LIMITED);
  }
}

/** JSON with sorted keys, so stored (MySQL-normalised) and incoming params compare equal. */
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function parseJsonColumn(v) {
  if (v == null) return null;
  return typeof v === 'string' ? JSON.parse(v) : v;
}

/**
 * Reserve (or replay) an idempotent generation row.
 * Returns { row, replay } where replay=true means a stored success can be returned.
 */
async function reserveGeneration(user, kind, params, summary) {
  const fingerprint = canonicalJson(params);
  const existing = await db('ai_quiz_generations').where({ requested_by: user.id, idempotency_key: params.idempotencyKey }).first();
  if (existing) {
    const storedParams = canonicalJson(parseJsonColumn(existing.request_params));
    if (storedParams !== fingerprint || existing.kind !== kind) {
      throw new AppError('This request id was already used for a different AI request. Start a new generation.', 409, ErrorCodes.CONFLICT);
    }
    if (existing.status === 'SUCCEEDED') return { row: existing, replay: true };
    const age = Date.now() - new Date(existing.created_at).getTime();
    if (existing.status === 'PENDING' && age < PENDING_STALE_MS) {
      throw new AppError('This AI generation is already in progress. Please wait for it to finish.', 409, ErrorCodes.CONFLICT);
    }
    // FAILED or stale PENDING: retry on the same row
    await db('ai_quiz_generations').where({ id: existing.id }).update({ status: 'PENDING', error_code: null, error_message: null, completed_at: null });
    return { row: { ...existing, status: 'PENDING' }, replay: false };
  }

  await enforceQuota(user.id);
  try {
    const [id] = await db('ai_quiz_generations').insert({
      requested_by: user.id,
      idempotency_key: params.idempotencyKey,
      kind,
      class_id: params.classId,
      subject_id: params.subjectId,
      difficulty: summary.difficulty,
      question_count: summary.count,
      total_marks: summary.totalMarks ?? null,
      request_params: fingerprint,
      status: 'PENDING'
    });
    return { row: await db('ai_quiz_generations').where({ id }).first(), replay: false };
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') return reserveGeneration(user, kind, params, summary);
    throw err;
  }
}

async function runWithValidation(ctx, req, validateOpts, deps) {
  let feedback = [];
  let lastIssues = [];
  let attempts = 0;
  for (let attempt = 1; attempt <= MAX_VALIDATION_ATTEMPTS; attempt++) {
    attempts = attempt;
    let reply;
    try {
      reply = await generateJson(
        { system: SYSTEM_PROMPT, prompt: buildPrompt(ctx, { ...req, feedback }), maxTokens: Math.min(16000, 1500 + req.count * 450), temperature: 0.4 },
        deps
      );
    } catch (err) {
      // Unparseable output is retried once; network/config/rate-limit errors are not.
      if (err instanceof AppError && err.code === ErrorCodes.AI_INVALID_OUTPUT && attempt < MAX_VALIDATION_ATTEMPTS) {
        feedback = ['Return one valid JSON object exactly in the required shape.'];
        continue;
      }
      err.attempts = attempts;
      throw err;
    }
    const { questions, issues } = validateGeneratedQuestions(reply.data, validateOpts);
    if (issues.length === 0) return { questions, provider: reply.provider, model: reply.model, attempts };
    lastIssues = issues;
    feedback = issues;
    console.warn(`[AI Quiz] Attempt ${attempt} rejected: ${issues.slice(0, 3).join(' | ')}`);
  }
  const err = invalidOutput('The AI produced questions that failed quality checks (wrong count, duplicates, ambiguous answers or off-syllabus). Please try again or adjust the inputs.', lastIssues);
  err.attempts = attempts;
  throw err;
}

export const aiQuizService = {
  status() {
    const cfg = getAiConfig();
    return {
      configured: cfg.configured,
      provider: cfg.configured ? cfg.provider : null,
      questionTypes: AI_QUESTION_TYPES,
      difficulties: AI_DIFFICULTIES,
      maxQuestions: 50
    };
  },

  async generateQuiz(user, body, deps = {}) {
    const params = parseOrThrow(generateQuizSchema, body);
    const ctx = { ...(await resolveContext(user, params.classId, params.subjectId)), ...params };

    const { row, replay } = await reserveGeneration(user, 'FULL_QUIZ', params, {
      difficulty: params.difficulty,
      count: params.questionCount,
      totalMarks: params.totalMarks
    });
    if (replay) return this._serializeGeneration(row, true);

    try {
      const result = await runWithValidation(
        ctx,
        { count: params.questionCount, types: params.questionTypes, difficulty: params.difficulty },
        {
          expectedCount: params.questionCount,
          allowedTypes: params.questionTypes,
          difficulty: params.difficulty,
          topics: params.topics,
          allowOutsideSyllabus: params.allowOutsideSyllabus
        },
        deps
      );
      // Group by section (MCQ, T/F, blanks, short) so the paper reads naturally
      const ordered = [...result.questions].sort((a, b) => SECTION_ORDER.indexOf(a.type) - SECTION_ORDER.indexOf(b.type));
      const marks = allocateMarks(ordered.map((q) => q.type), params.totalMarks);
      const questions = toEngineQuestions(ordered, marks);

      await db('ai_quiz_generations').where({ id: row.id }).update({
        status: 'SUCCEEDED',
        provider: result.provider,
        model: result.model,
        result_questions: JSON.stringify(questions),
        attempts: db.raw('attempts + ?', [result.attempts]),
        completed_at: db.raw('CURRENT_TIMESTAMP(3)')
      });
      return this._serializeGeneration(await db('ai_quiz_generations').where({ id: row.id }).first(), false);
    } catch (err) {
      await this._markFailed(row.id, err);
      throw err;
    }
  },

  async regenerateQuestion(user, body, deps = {}) {
    const params = parseOrThrow(regenerateQuestionSchema, body);
    const ctx = { ...(await resolveContext(user, params.classId, params.subjectId)), ...params, title: null };

    const { row, replay } = await reserveGeneration(user, 'SINGLE_QUESTION', params, {
      difficulty: params.difficulty,
      count: 1,
      totalMarks: params.marks
    });
    if (replay) {
      const stored = parseJsonColumn(row.result_questions) || [];
      return { generationId: row.id, cached: true, question: stored[0] };
    }

    try {
      const result = await runWithValidation(
        ctx,
        { count: 1, types: [params.questionType], difficulty: params.difficulty, existingQuestions: params.existingQuestions },
        {
          expectedCount: 1,
          allowedTypes: [params.questionType],
          difficulty: params.difficulty,
          topics: params.topics,
          allowOutsideSyllabus: params.allowOutsideSyllabus,
          existingQuestions: params.existingQuestions
        },
        deps
      );
      const [question] = toEngineQuestions(result.questions, [params.marks]);
      await db('ai_quiz_generations').where({ id: row.id }).update({
        status: 'SUCCEEDED',
        provider: result.provider,
        model: result.model,
        result_questions: JSON.stringify([question]),
        attempts: db.raw('attempts + ?', [result.attempts]),
        completed_at: db.raw('CURRENT_TIMESTAMP(3)')
      });
      return { generationId: row.id, cached: false, question };
    } catch (err) {
      await this._markFailed(row.id, err);
      throw err;
    }
  },

  /**
   * Validate that a generation may be attached to a quiz being created by this user.
   * Returns the generation row or throws.
   */
  async assertUsableForQuiz(user, generationId, { classId, subjectId }) {
    const gen = await db('ai_quiz_generations').where({ id: Number(generationId) }).first();
    if (!gen || gen.kind !== 'FULL_QUIZ' || gen.status !== 'SUCCEEDED') {
      throw validation('The AI generation referenced by this quiz was not found or did not succeed.');
    }
    if (Number(gen.requested_by) !== Number(user.id)) throw forbidden('This AI generation belongs to another user.');
    if (Number(gen.class_id) !== Number(classId) || Number(gen.subject_id) !== Number(subjectId)) {
      throw validation('The quiz class/subject does not match the AI generation. Regenerate for the selected class and subject.');
    }
    return gen;
  },

  async _markFailed(id, err) {
    await db('ai_quiz_generations')
      .where({ id })
      .update({
        status: 'FAILED',
        error_code: String(err?.code || 'ERROR').slice(0, 50),
        error_message: String(err?.message || 'Unknown error').slice(0, 500),
        attempts: db.raw('attempts + ?', [Number(err?.attempts) || 1]),
        completed_at: db.raw('CURRENT_TIMESTAMP(3)')
      })
      .catch(() => {});
  },

  _serializeGeneration(row, cached) {
    const params = parseJsonColumn(row.request_params) || {};
    return {
      generationId: row.id,
      cached,
      provider: row.provider,
      model: row.model,
      difficulty: row.difficulty,
      totalMarks: Number(row.total_marks),
      durationMinutes: params.durationMinutes,
      title: params.title,
      questions: parseJsonColumn(row.result_questions) || []
    };
  }
};
