import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, AlertCircle, Info } from 'lucide-react';
import { assessmentsApi } from '../../services/assessmentsApi';
import {
  AiDifficulty,
  AiGenerateQuizPayload,
  AiGeneratedQuiz,
  AiQuestionType,
  AiStatus
} from '../../types/assessments';

export const AI_TYPE_LABELS: Record<AiQuestionType, string> = {
  MCQ: 'Multiple Choice',
  TRUE_FALSE: 'True / False',
  FILL_IN_THE_BLANK: 'Fill in the Blanks',
  SHORT_ANSWER: 'Short Questions'
};

const DIFFICULTIES: { id: AiDifficulty; label: string }[] = [
  { id: 'EASY', label: 'Easy' },
  { id: 'MEDIUM', label: 'Medium' },
  { id: 'HARD', label: 'Hard' },
  { id: 'MIXED', label: 'Mixed' }
];

export function newIdempotencyKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
}

/** Generation inputs kept by the parent so single questions can be regenerated with the same context. */
export interface AiGenerationContext {
  topics: string[];
  syllabus: string;
  instructions: string;
  allowOutsideSyllabus: boolean;
}

interface Props {
  classId: number;
  subjectId: number;
  subjectName: string;
  title: string;
  durationMinutes: number;
  hasExistingQuestions: boolean;
  onGenerated: (result: AiGeneratedQuiz, context: AiGenerationContext) => void;
}

export const AiQuizGeneratorPanel: React.FC<Props> = ({
  classId,
  subjectId,
  subjectName,
  title,
  durationMinutes,
  hasExistingQuestions,
  onGenerated
}) => {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [topics, setTopics] = useState('');
  const [syllabus, setSyllabus] = useState('');
  const [difficulty, setDifficulty] = useState<AiDifficulty>('MEDIUM');
  const [questionCount, setQuestionCount] = useState(10);
  const [questionTypes, setQuestionTypes] = useState<AiQuestionType[]>(['MCQ', 'TRUE_FALSE']);
  const [totalMarks, setTotalMarks] = useState(10);
  const [instructions, setInstructions] = useState('');
  const [allowOutsideSyllabus, setAllowOutsideSyllabus] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reuse the request key when retrying the same inputs after a failure, so the
  // server can deduplicate a retried request; any successful run or change of
  // inputs gets a fresh key.
  const retryKey = useRef<{ key: string; fingerprint: string } | null>(null);

  useEffect(() => {
    assessmentsApi
      .getAiStatus()
      .then(setStatus)
      .catch(() => setStatus({ configured: false, provider: null, questionTypes: [], difficulties: [], maxQuestions: 50 }));
  }, []);

  const toggleType = (t: AiQuestionType) =>
    setQuestionTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const topicList = topics
    .split(/[,\n;]/)
    .map((t) => t.trim())
    .filter(Boolean);

  const validate = (): string | null => {
    if (!classId || !subjectId) return 'Select a class and subject first.';
    if (!title.trim()) return 'Enter the quiz title above before generating.';
    if (topicList.length === 0) return 'Enter at least one topic.';
    if (questionTypes.length === 0) return 'Select at least one question type.';
    if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 50) return 'Number of questions must be between 1 and 50.';
    if (questionTypes.length > questionCount) return 'Select no more question types than questions.';
    if (!Number.isInteger(totalMarks) || totalMarks < questionCount) return 'Total marks must be a whole number of at least the number of questions.';
    if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 300) return 'Time limit must be between 5 and 300 minutes.';
    return null;
  };

  const handleGenerate = async () => {
    const problem = validate();
    setError(problem);
    if (problem) return;
    if (hasExistingQuestions && !window.confirm('Replace the questions currently in this quiz with a new AI draft?')) return;

    const payloadBase = {
      classId,
      subjectId,
      title: title.trim(),
      topics: topicList,
      syllabus: syllabus.trim(),
      instructions: instructions.trim(),
      allowOutsideSyllabus,
      difficulty,
      questionCount,
      questionTypes,
      totalMarks,
      durationMinutes
    };
    const fingerprint = JSON.stringify(payloadBase);
    const key = retryKey.current && retryKey.current.fingerprint === fingerprint ? retryKey.current.key : newIdempotencyKey();
    retryKey.current = { key, fingerprint };
    const payload: AiGenerateQuizPayload = { ...payloadBase, idempotencyKey: key };

    try {
      setGenerating(true);
      const result = await assessmentsApi.generateAiQuiz(payload);
      retryKey.current = null;
      onGenerated(result, {
        topics: topicList,
        syllabus: syllabus.trim(),
        instructions: instructions.trim(),
        allowOutsideSyllabus
      });
    } catch (err: any) {
      setError(err?.message || 'AI generation failed. You can continue creating the quiz manually.');
    } finally {
      setGenerating(false);
    }
  };

  const field = 'w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white';

  if (status && !status.configured) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <span>
          AI quiz generation is not configured on this server. Continue creating the quiz manually below — every existing
          feature works as usual.
        </span>
      </div>
    );
  }

  return (
    <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-[#1b1a47]">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span>Generate Quiz with AI {subjectName ? `· ${subjectName}` : ''}</span>
        </div>
        <span className="text-[10px] text-indigo-700">Draft only — you review every question before publishing</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Topics * (comma or new line separated)</label>
          <textarea
            rows={2}
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
            placeholder="e.g. Photosynthesis, Parts of a plant cell"
            className={field}
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Additional instructions (optional)</label>
          <textarea
            rows={2}
            maxLength={2000}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. Use simple English; include one diagram-based question idea"
            className={field}
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
          Syllabus / chapter content <span className="font-normal text-slate-500">(questions stay within this text)</span>
        </label>
        <textarea
          rows={4}
          maxLength={12000}
          value={syllabus}
          onChange={(e) => setSyllabus(e.target.value)}
          placeholder="Paste the chapter notes or syllabus points the quiz should cover…"
          className={field}
        />
        <div className="flex items-center justify-between mt-1">
          <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <input type="checkbox" checked={allowOutsideSyllabus} onChange={(e) => setAllowOutsideSyllabus(e.target.checked)} className="accent-indigo-600" />
            Allow closely related questions beyond the pasted text
          </label>
          <span className="text-[10px] text-slate-400">{syllabus.length.toLocaleString()} / 12,000</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Difficulty *</label>
          <div className="grid grid-cols-4 gap-1.5">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDifficulty(d.id)}
                className={`py-1.5 rounded-lg border text-[11px] font-bold transition ${
                  difficulty === d.id ? 'border-[#1b1a47] bg-[#1b1a47] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">No. of questions *</label>
          <input type="number" min={1} max={50} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} className={field} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Total marks *</label>
          <input type="number" min={1} max={500} value={totalMarks} onChange={(e) => setTotalMarks(Number(e.target.value))} className={field} />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Question types *</label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(AI_TYPE_LABELS) as AiQuestionType[]).map((t) => (
            <label
              key={t}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition flex items-center gap-1.5 ${
                questionTypes.includes(t) ? 'border-indigo-400 bg-white text-indigo-800' : 'border-slate-200 bg-white/60 text-slate-500'
              }`}
            >
              <input type="checkbox" checked={questionTypes.includes(t)} onChange={() => toggleType(t)} className="accent-indigo-600" />
              {AI_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mt-1">
          MCQ and True/False are auto-graded. Fill in the Blanks and Short Questions are checked by you in the grading workstation.
          Time limit uses the Duration field above ({durationMinutes} min).
        </p>
      </div>

      {error && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={generating}
          onClick={handleGenerate}
          className="px-4 py-2 bg-[#1b1a47] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition disabled:opacity-60"
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {generating ? 'Generating draft…' : hasExistingQuestions ? 'Regenerate Entire Quiz' : 'Generate Draft Questions'}
        </button>
      </div>
    </div>
  );
};
