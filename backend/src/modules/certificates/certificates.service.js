/**
 * Certificate Management service.
 *
 * - Teachers issue certificates only to ACTIVE students of classes in their teaching
 *   scope (getTeacherScope: the same rule used for badges), validated per recipient.
 * - One issuance request = one certificate_batches row keyed by the client's idempotency
 *   key. Retries replay the stored result (no duplicate certificates or notifications).
 *   A new request may award the same template again (legitimate repeat awards).
 * - Bulk issuance is all-or-nothing: every PDF is rendered and written first, then all
 *   rows are inserted in one transaction; on any failure the written files are removed.
 * - Each certificate's PDF is rendered once at issue time and stored privately, so later
 *   template edits never change an issued certificate.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { db } from '../../shared/db/knex.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import {
  getTeacherScope,
  isStaff,
  forbidden,
  getStudentByUserId,
  getParentByUserId,
  getCurrentSessionId
} from '../../shared/services/accessScope.js';
import { notificationService } from '../../shared/services/notificationService.js';
import { UPLOAD_ROOT } from '../../shared/storage/upload.js';
import { sniffImage } from '../fees/fees.paymentDetails.js';
import { renderCertificatePdf, validatePlaceholders, unsupportedCharacters, SUPPORTED_PLACEHOLDERS } from './certificates.pdf.js';

const PDF_DIR_NAME = 'certificates';
const ASSET_DIR_NAME = 'certificate-assets';
const MAX_RECIPIENTS = 200;
const PENDING_STALE_MS = 5 * 60 * 1000;
export const ASSET_LIMITS = { background: 5 * 1024 * 1024, logo: 2 * 1024 * 1024, principalSignature: 1024 * 1024 };

const validation = (message, details = null) => new AppError(message, 422, ErrorCodes.VALIDATION_ERROR, details);
const notFound = (message = 'Certificate not found.') => new AppError(message, 404, ErrorCodes.NOT_FOUND);

const schoolName = () => (process.env.SCHOOL_NAME || 'Cambridge Education System').trim();

// ---------------------------------------------------------------------------
// Storage helpers (keys are relative to UPLOAD_ROOT and never sent to clients)
// ---------------------------------------------------------------------------
function storageDir(name) {
  const dir = path.join(UPLOAD_ROOT, name);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writePrivateFile(dirName, buffer, ext) {
  const file = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(storageDir(dirName), file), buffer, { flag: 'wx' });
  return `${dirName}/${file}`;
}

export function resolveStorageKey(key, dirName) {
  if (!key) return null;
  const full = path.resolve(UPLOAD_ROOT, key);
  if (!full.startsWith(path.resolve(UPLOAD_ROOT, dirName) + path.sep)) return null;
  return fs.existsSync(full) ? full : null;
}

function removeKeys(keys, dirName) {
  for (const key of keys) {
    const p = key && path.resolve(UPLOAD_ROOT, key);
    if (p && p.startsWith(path.resolve(UPLOAD_ROOT, dirName) + path.sep)) fs.promises.unlink(p).catch(() => {});
  }
}

function templateAssets(t) {
  return {
    background: resolveStorageKey(t.background_storage_key, ASSET_DIR_NAME),
    logo: resolveStorageKey(t.logo_storage_key, ASSET_DIR_NAME),
    principalSignature: resolveStorageKey(t.principal_signature_storage_key, ASSET_DIR_NAME)
  };
}

function newCertificateNumber(year) {
  // 10 chars of Crockford-style base32 from 50 random bits: non-guessable, readable
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const bytes = crypto.randomBytes(10);
  let out = '';
  for (let i = 0; i < 10; i++) out += alphabet[bytes[i] % 32];
  return `CES-${year}-${out}`;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function parseOrThrow(schema, body) {
  const r = schema.safeParse(body || {});
  if (!r.success) {
    const first = r.error.issues[0];
    throw validation(first?.message || 'Invalid request.', {
      issues: r.error.issues.map((i) => ({ field: i.path.join('.'), issue: i.message }))
    });
  }
  return r.data;
}

function assertPrintable(label, text) {
  const bad = unsupportedCharacters(text);
  if (bad.length) {
    throw validation(`${label} contains characters that cannot be printed on the certificate: ${bad.slice(0, 5).join(' ')}`);
  }
}

async function actorName(conn, userId) {
  const u = userId ? await conn('users').where({ id: userId }).first('full_name') : null;
  return u?.full_name || 'System';
}

async function logEvent(conn, { action, user, certificateId = null, batchId = null, templateId = null, categoryId = null, reason = null, details = null }) {
  await conn('certificate_events').insert({
    action,
    certificate_id: certificateId,
    batch_id: batchId,
    template_id: templateId,
    category_id: categoryId,
    actor_user_id: user?.id || null,
    actor_name: (await actorName(conn, user?.id)).slice(0, 150),
    actor_role: user?.role ? String(user.role).slice(0, 30) : null,
    reason: reason ? String(reason).slice(0, 500) : null,
    details: details ? JSON.stringify(details) : null
  });
}

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------
const bool = (v) => v === true || v === 1 || v === '1';

export function toTemplate(t) {
  return {
    id: t.id,
    categoryId: t.category_id,
    categoryName: t.category_name,
    name: t.name,
    certificateTitle: t.certificate_title,
    description: t.description,
    designPreset: t.design_preset,
    orientation: t.orientation,
    pageSize: t.page_size,
    primaryColor: t.primary_color,
    accentColor: t.accent_color,
    bodyText: t.body_text,
    showTeacherSignature: bool(t.show_teacher_signature),
    showPrincipalSignature: bool(t.show_principal_signature),
    principalName: t.principal_name,
    hasBackground: Boolean(t.background_storage_key),
    hasLogo: Boolean(t.logo_storage_key),
    hasPrincipalSignature: Boolean(t.principal_signature_storage_key),
    status: t.status,
    version: t.version,
    previewUrl: `/api/v1/certificates/templates/${t.id}/preview`,
    updatedAt: t.updated_at
  };
}

function toCertificate(c, { includeRevokeReason = false } = {}) {
  return {
    id: c.id,
    certificateNumber: c.certificate_number,
    certificateTitle: c.certificate_title,
    categoryId: c.category_id,
    categoryName: c.category_name,
    templateId: c.template_id,
    templateName: c.template_name,
    achievementTitle: c.achievement_title,
    achievementDescription: c.achievement_description,
    remarks: c.remarks,
    studentId: c.student_id,
    studentName: c.student_name,
    classId: c.class_id,
    className: c.class_name,
    subjectName: c.subject_name,
    academicYear: c.academic_year,
    issueDate: c.issue_date,
    issuedBy: c.issuer_name,
    teacherId: c.teacher_id,
    status: c.status,
    revokedAt: c.revoked_at,
    revokeReason: includeRevokeReason ? c.revoke_reason : undefined,
    pdfUrl: `/api/v1/certificates/${c.id}/pdf`,
    createdAt: c.created_at
  };
}

function certificateQuery() {
  return db('student_certificates as sc')
    .join('certificate_categories as cc', 'sc.category_id', 'cc.id')
    .join('certificate_templates as ct', 'sc.template_id', 'ct.id')
    .select('sc.*', 'cc.name as category_name', 'ct.name as template_name');
}

function templateQuery() {
  return db('certificate_templates as t')
    .join('certificate_categories as c', 't.category_id', 'c.id')
    .select('t.*', 'c.name as category_name', 'c.is_active as category_active');
}

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Issue date must be YYYY-MM-DD.')
  .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()), 'Issue date is not a valid date.');

const fieldsSchema = {
  achievementTitle: z.string().trim().min(3, 'Achievement title must be at least 3 characters.').max(150),
  achievementDescription: z.string().trim().max(600).optional().default(''),
  remarks: z.string().trim().max(300).optional().default(''),
  subjectId: z.coerce.number().int().positive().optional().nullable(),
  academicSessionId: z.coerce.number().int().positive().optional().nullable(),
  issueDate: isoDate
};

const previewSchema = z.object({
  templateId: z.coerce.number().int().positive(),
  classId: z.coerce.number().int().positive(),
  studentId: z.coerce.number().int().positive().optional().nullable(),
  ...fieldsSchema
});

const issueSchema = z
  .object({
    templateId: z.coerce.number().int().positive(),
    classId: z.coerce.number().int().positive(),
    mode: z.enum(['SELECTED', 'CLASS']),
    studentIds: z.array(z.coerce.number().int().positive()).max(MAX_RECIPIENTS).optional().default([]),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, 'idempotencyKey must be 8-64 letters, digits, "-" or "_".'),
    ...fieldsSchema
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'SELECTED' && v.studentIds.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['studentIds'], message: 'Select at least one student.' });
    }
  });

// ---------------------------------------------------------------------------
// Shared validation for preview / issue
// ---------------------------------------------------------------------------
async function requireTeacherScope(user) {
  if (user.role !== 'TEACHER') throw forbidden('Only teachers can issue certificates.');
  const scope = await getTeacherScope(user.id);
  if (!scope.teacher) throw forbidden('Teacher profile not found for this account.');
  return scope;
}

function checkIssueDate(iso) {
  const d = new Date(`${iso}T00:00:00Z`).getTime();
  const now = Date.now();
  if (d > now + 30 * 86400000) throw validation('Issue date cannot be more than 30 days in the future.');
  if (d < now - 2 * 365 * 86400000) throw validation('Issue date cannot be more than 2 years in the past.');
}

async function loadActiveTemplate(templateId) {
  const t = await templateQuery().where('t.id', templateId).first();
  if (!t) throw validation('Selected certificate template does not exist.');
  if (t.status !== 'ACTIVE' || !bool(t.category_active)) {
    throw validation('This certificate template is no longer available for new certificates.');
  }
  return t;
}

/** Resolve everything trusted that goes on the certificate (never taken from the client). */
async function resolveContext(user, scope, params) {
  if (!scope.classIds.has(Number(params.classId))) throw forbidden('You are not assigned to teach the selected class.');
  checkIssueDate(params.issueDate);
  assertPrintable('Achievement title', params.achievementTitle);
  assertPrintable('Achievement description', params.achievementDescription);
  assertPrintable('Remarks', params.remarks);

  const template = await loadActiveTemplate(params.templateId);
  const cls = await db('classes').where({ id: params.classId }).first();
  if (!cls) throw validation('Selected class does not exist.');

  let subject = null;
  if (params.subjectId) {
    if (!scope.subjectIdsByClass.get(Number(params.classId))?.has(Number(params.subjectId))) {
      throw forbidden('You do not teach the selected subject in this class.');
    }
    subject = await db('subjects').where({ id: params.subjectId }).first();
  }

  let session = null;
  if (params.academicSessionId) {
    session = await db('academic_sessions').where({ id: params.academicSessionId }).first();
    if (!session) throw validation('Selected academic year does not exist.');
  }
  const teacherUser = await db('users').where({ id: user.id }).first('full_name');
  return {
    template,
    cls,
    subject,
    session,
    sessionId: session?.id || (await getCurrentSessionId()),
    teacherName: teacherUser?.full_name || 'Class Teacher'
  };
}

function certificateData(ctx, student, params, certificateId, isSample = false) {
  return {
    school_name: schoolName(),
    student_name: student.full_name,
    class_name: ctx.cls.name,
    achievement_title: params.achievementTitle,
    achievement_description: params.achievementDescription,
    issue_date: params.issueDate,
    teacher_name: ctx.teacherName,
    subject_name: ctx.subject?.name || '',
    academic_year: ctx.session?.name || '',
    certificate_id: certificateId,
    remarks: params.remarks,
    isSample
  };
}

async function eligibleStudents(classId, studentIds = null) {
  let q = db('students')
    .join('users', 'students.user_id', 'users.id')
    .where('students.current_class_id', classId)
    .where('students.status', 'ACTIVE')
    .select('students.id', 'students.roll_no', 'students.admission_no', 'users.id as user_id', 'users.full_name')
    .orderByRaw('CAST(students.roll_no AS UNSIGNED), students.roll_no, users.full_name');
  if (studentIds) q = q.whereIn('students.id', studentIds);
  return q;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
export const certificatesService = {
  SUPPORTED_PLACEHOLDERS,

  /** Active categories with their active templates (teachers); staff may include inactive. */
  async catalog(user, { includeInactive = false } = {}) {
    if (user.role !== 'TEACHER' && !isStaff(user)) throw forbidden();
    const all = includeInactive && isStaff(user);
    let cq = db('certificate_categories').orderBy([{ column: 'sort_order' }, { column: 'name' }]);
    if (!all) cq = cq.where('is_active', 1);
    const categories = await cq;
    let tq = templateQuery().orderBy('t.name');
    if (!all) tq = tq.where('t.status', 'ACTIVE').where('c.is_active', 1);
    const templates = await tq;
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      sortOrder: c.sort_order,
      isActive: bool(c.is_active),
      templates: templates.filter((t) => Number(t.category_id) === Number(c.id)).map(toTemplate)
    }));
  },

  /** Teacher's classes, and the eligible students / subjects of one class. */
  async recipients(user, classId = null) {
    const scope = await requireTeacherScope(user);
    const classRows = scope.classIds.size ? await db('classes').whereIn('id', [...scope.classIds]).orderBy('grade_level') : [];
    const sessions = await db('academic_sessions').orderBy('start_date', 'desc').select('id', 'name', 'is_current');
    const out = {
      classes: classRows.map((c) => ({ id: c.id, name: c.name })),
      academicSessions: sessions.map((s) => ({ id: s.id, name: s.name, isCurrent: bool(s.is_current) })),
      students: [],
      subjects: []
    };
    if (classId) {
      if (!scope.classIds.has(Number(classId))) throw forbidden('You are not assigned to teach the selected class.');
      out.students = (await eligibleStudents(classId)).map((s) => ({ id: s.id, name: s.full_name, rollNo: s.roll_no, admissionNo: s.admission_no }));
      const subjectIds = [...(scope.subjectIdsByClass.get(Number(classId)) || [])];
      out.subjects = subjectIds.length ? await db('subjects').whereIn('id', subjectIds).select('id', 'name').orderBy('name') : [];
    }
    return out;
  },

  /** Sample PDF of a template (teachers: active templates only). */
  async templatePreview(user, templateId) {
    const t = await templateQuery().where('t.id', Number(templateId)).first();
    if (!t) throw notFound('Template not found.');
    if (!isStaff(user)) {
      if (user.role !== 'TEACHER') throw forbidden();
      if (t.status !== 'ACTIVE' || !bool(t.category_active)) throw notFound('Template not found.');
    }
    return renderCertificatePdf(t, {
      school_name: schoolName(),
      student_name: 'Student Name',
      class_name: 'Class',
      achievement_title: 'the achievement described here',
      achievement_description: 'A short description of the achievement appears here.',
      issue_date: new Date().toISOString().slice(0, 10),
      teacher_name: 'Teacher Name',
      subject_name: '',
      academic_year: '',
      certificate_id: 'PREVIEW',
      isSample: true
    }, templateAssets(t));
  },

  /** Personalised preview for one selected student before issuing (nothing is saved). */
  async personalizedPreview(user, body) {
    const scope = await requireTeacherScope(user);
    const params = parseOrThrow(previewSchema, body);
    const ctx = await resolveContext(user, scope, params);
    let student = { full_name: 'Student Name' };
    if (params.studentId) {
      [student] = await eligibleStudents(params.classId, [params.studentId]);
      if (!student) throw forbidden('The selected student is not an active student of this class.');
    }
    return renderCertificatePdf(ctx.template, certificateData(ctx, student, params, 'PREVIEW', true), templateAssets(ctx.template));
  },

  async issue(user, body) {
    const scope = await requireTeacherScope(user);
    const params = parseOrThrow(issueSchema, body);
    const studentIds = [...new Set(params.studentIds.map(Number))].sort((a, b) => a - b);
    const ctx = await resolveContext(user, scope, params);

    // ---- Recipients: validated individually on the server
    let recipients;
    if (params.mode === 'CLASS') {
      recipients = await eligibleStudents(params.classId);
      if (recipients.length === 0) throw validation('This class has no active students to receive certificates.');
    } else {
      recipients = await eligibleStudents(params.classId, studentIds);
      const ok = new Set(recipients.map((r) => Number(r.id)));
      const invalid = studentIds.filter((id) => !ok.has(id));
      if (invalid.length) {
        const rows = await db('students').join('users', 'students.user_id', 'users.id').whereIn('students.id', invalid).select('students.id', 'students.status', 'students.current_class_id', 'users.full_name');
        const byId = new Map(rows.map((r) => [Number(r.id), r]));
        throw new AppError(
          `${invalid.length} selected student(s) cannot receive a certificate for this class. No certificates were issued.`,
          422,
          ErrorCodes.VALIDATION_ERROR,
          {
            invalidRecipients: invalid.map((id) => {
              const r = byId.get(id);
              return {
                studentId: id,
                studentName: r?.full_name || null,
                reason: !r ? 'Student not found' : r.status !== 'ACTIVE' ? `Student status is ${r.status}` : 'Student is not in the selected class'
              };
            })
          }
        );
      }
    }
    if (recipients.length > MAX_RECIPIENTS) throw validation(`At most ${MAX_RECIPIENTS} certificates can be issued at once.`);

    // ---- Idempotency: one batch per (user, key); retries replay the stored result
    const fingerprint = crypto
      .createHash('sha256')
      .update(canonicalJson({ ...params, studentIds, idempotencyKey: undefined }))
      .digest('hex');
    const reserved = await this._reserveBatch(user, params, fingerprint);
    if (reserved.replay) return this._batchResult(reserved.batch.id, true);
    const batchId = reserved.batch.id;

    const year = params.issueDate.slice(0, 4);
    const written = [];
    try {
      const assets = templateAssets(ctx.template);
      const snapshot = JSON.stringify(toTemplate(ctx.template));
      const numbers = new Set();
      const rows = [];
      // Each student's PDF is rendered with that student's own details
      for (const s of recipients) {
        let number;
        do number = newCertificateNumber(year);
        while (numbers.has(number));
        numbers.add(number);
        const pdf = await renderCertificatePdf(ctx.template, certificateData(ctx, s, params, number), assets);
        const key = writePrivateFile(PDF_DIR_NAME, pdf, '.pdf');
        written.push(key);
        rows.push({
          certificate_number: number,
          batch_id: batchId,
          template_id: ctx.template.id,
          category_id: ctx.template.category_id,
          student_id: s.id,
          class_id: ctx.cls.id,
          subject_id: ctx.subject?.id || null,
          session_id: ctx.sessionId || null,
          teacher_id: scope.teacher.id,
          issued_by_user_id: user.id,
          student_name: String(s.full_name).slice(0, 150),
          class_name: String(ctx.cls.name).slice(0, 60),
          issuer_name: String(ctx.teacherName).slice(0, 150),
          subject_name: ctx.subject?.name || null,
          academic_year: ctx.session?.name || null,
          certificate_title: ctx.template.certificate_title,
          achievement_title: params.achievementTitle,
          achievement_description: params.achievementDescription || null,
          remarks: params.remarks || null,
          issue_date: params.issueDate,
          template_version: ctx.template.version,
          template_snapshot: snapshot,
          pdf_storage_key: key,
          pdf_size_bytes: pdf.length,
          pdf_sha256: crypto.createHash('sha256').update(pdf).digest('hex'),
          status: 'ACTIVE'
        });
      }

      await db.transaction(async (trx) => {
        // Re-check availability inside the transaction (template could be disabled meanwhile)
        const live = await trx('certificate_templates').where({ id: ctx.template.id }).forUpdate().first('status');
        if (live?.status !== 'ACTIVE') throw validation('This certificate template was disabled while issuing. No certificates were issued.');
        for (const row of rows) {
          const [id] = await trx('student_certificates').insert(row);
          await logEvent(trx, {
            action: 'ISSUED',
            user,
            certificateId: id,
            batchId,
            templateId: row.template_id,
            categoryId: row.category_id,
            details: { certificateNumber: row.certificate_number, studentId: row.student_id, classId: row.class_id, mode: params.mode }
          });
        }
        await trx('certificate_batches').where({ id: batchId }).update({
          status: 'COMPLETED',
          recipient_count: rows.length,
          completed_at: trx.raw('CURRENT_TIMESTAMP(3)')
        });
      });
    } catch (err) {
      removeKeys(written, PDF_DIR_NAME);
      await db('certificate_batches')
        .where({ id: batchId })
        .update({ status: 'FAILED', error_message: String(err?.message || 'Issuance failed').slice(0, 500), completed_at: db.raw('CURRENT_TIMESTAMP(3)') })
        .catch(() => {});
      throw err;
    }

    // Notify only after the certificates are saved; replays never reach this point.
    await this._notifyIssued(batchId);
    return this._batchResult(batchId, false);
  },

  async _reserveBatch(user, params, fingerprint) {
    const existing = await db('certificate_batches').where({ issued_by_user_id: user.id, idempotency_key: params.idempotencyKey }).first();
    if (existing) {
      if (existing.request_fingerprint !== fingerprint) {
        throw new AppError('This request id was already used for a different certificate request. Start a new issuance.', 409, ErrorCodes.CONFLICT);
      }
      if (existing.status === 'COMPLETED') return { batch: existing, replay: true };
      if (existing.status === 'PROCESSING' && Date.now() - new Date(existing.created_at).getTime() < PENDING_STALE_MS) {
        throw new AppError('These certificates are already being issued. Please wait a moment.', 409, ErrorCodes.CONFLICT);
      }
      await db('certificate_batches').where({ id: existing.id }).update({ status: 'PROCESSING', error_message: null, completed_at: null });
      return { batch: existing, replay: false };
    }
    try {
      const [id] = await db('certificate_batches').insert({
        issued_by_user_id: user.id,
        idempotency_key: params.idempotencyKey,
        request_fingerprint: fingerprint,
        template_id: params.templateId,
        class_id: params.classId,
        status: 'PROCESSING'
      });
      return { batch: { id }, replay: false };
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') return this._reserveBatch(user, params, fingerprint);
      throw err;
    }
  },

  async _batchResult(batchId, replayed) {
    const certs = await certificateQuery().where('sc.batch_id', batchId).orderBy('sc.id');
    return { batchId, replayed, issuedCount: certs.length, certificates: certs.map((c) => toCertificate(c)) };
  },

  async _notifyIssued(batchId) {
    try {
      const certs = await db('student_certificates as sc')
        .join('students as s', 'sc.student_id', 's.id')
        .where('sc.batch_id', batchId)
        .select('sc.id', 'sc.student_id', 'sc.student_name', 'sc.certificate_title', 'sc.achievement_title', 'sc.issuer_name', 's.user_id');
      if (!certs.length) return;
      const parents = await db('parent_student as ps')
        .join('parents as p', 'ps.parent_id', 'p.id')
        .whereIn('ps.student_id', certs.map((c) => c.student_id))
        .select('ps.student_id', 'p.user_id');
      for (const c of certs) {
        const base = { type: 'Achievement', relatedRecordId: c.id, relatedRecordType: 'Certificate', priority: 'Low' };
        await notificationService.notifyUsers([c.user_id], {
          ...base,
          title: `New Certificate: ${c.certificate_title}`,
          message: `${c.issuer_name} awarded you a certificate for "${c.achievement_title}". View and download it in Achievements.`
        });
        const parentIds = parents.filter((p) => Number(p.student_id) === Number(c.student_id)).map((p) => p.user_id);
        if (parentIds.length) {
          await notificationService.notifyUsers(parentIds, {
            ...base,
            title: `Certificate Awarded: ${c.student_name}`,
            message: `${c.student_name} received the "${c.certificate_title}" for "${c.achievement_title}" from ${c.issuer_name}.`
          });
        }
      }
    } catch (err) {
      console.warn('[Certificates] Notification warning:', err.message);
    }
  },

  // ---- Lists -------------------------------------------------------------
  async listIssued(user, query = {}) {
    let q = certificateQuery();
    if (user.role === 'TEACHER') {
      const scope = await requireTeacherScope(user);
      q = q.where('sc.teacher_id', scope.teacher.id);
    } else if (!isStaff(user)) {
      throw forbidden();
    } else if (query.teacherId) {
      q = q.where('sc.teacher_id', Number(query.teacherId));
    }
    if (query.search) {
      const term = `%${String(query.search).trim().slice(0, 100)}%`;
      q = q.where((w) => w.where('sc.student_name', 'like', term).orWhere('sc.certificate_number', 'like', term));
    }
    if (query.classId) q = q.where('sc.class_id', Number(query.classId));
    if (query.categoryId) q = q.where('sc.category_id', Number(query.categoryId));
    if (query.studentId) q = q.where('sc.student_id', Number(query.studentId));
    if (query.status && ['ACTIVE', 'REVOKED'].includes(String(query.status))) q = q.where('sc.status', String(query.status));
    if (query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from)) q = q.where('sc.issue_date', '>=', query.from);
    if (query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to)) q = q.where('sc.issue_date', '<=', query.to);

    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const page = Math.max(Number(query.page) || 1, 1);
    const totalRow = await q.clone().clearSelect().clearOrder().count('sc.id as n').first();
    const rows = await q.orderBy('sc.issue_date', 'desc').orderBy('sc.id', 'desc').limit(limit).offset((page - 1) * limit);
    const total = Number(totalRow?.n || 0);
    return { items: rows.map((c) => toCertificate(c, { includeRevokeReason: true })), total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async listMine(user) {
    if (user.role !== 'STUDENT') throw forbidden();
    const student = await getStudentByUserId(user.id);
    if (!student) return [];
    const rows = await certificateQuery().where('sc.student_id', student.id).orderBy('sc.issue_date', 'desc').orderBy('sc.id', 'desc');
    return rows.map((c) => toCertificate(c));
  },

  async listForParent(user, studentId) {
    if (user.role !== 'PARENT') throw forbidden();
    const parent = await getParentByUserId(user.id);
    const link = parent ? await db('parent_student').where({ parent_id: parent.id, student_id: Number(studentId) }).first() : null;
    if (!link) throw forbidden('Access denied. Student is not linked to your parent account.');
    const rows = await certificateQuery().where('sc.student_id', Number(studentId)).orderBy('sc.issue_date', 'desc').orderBy('sc.id', 'desc');
    return rows.map((c) => toCertificate(c));
  },

  // ---- Single certificate ---------------------------------------------------
  /** Loads a certificate the user may view; throws 404 (never reveals other students' records). */
  async _loadAuthorized(user, id) {
    const cert = await certificateQuery().where('sc.id', Number(id)).first();
    if (!cert) throw notFound();
    if (isStaff(user)) return { cert, level: 'STAFF' };
    if (user.role === 'TEACHER') {
      const teacher = await db('teachers').where({ user_id: user.id }).first();
      if (teacher && Number(teacher.id) === Number(cert.teacher_id)) return { cert, level: 'ISSUER' };
    } else if (user.role === 'STUDENT') {
      const student = await getStudentByUserId(user.id);
      if (student && Number(student.id) === Number(cert.student_id)) return { cert, level: 'OWNER' };
    } else if (user.role === 'PARENT') {
      const parent = await getParentByUserId(user.id);
      const link = parent ? await db('parent_student').where({ parent_id: parent.id, student_id: cert.student_id }).first() : null;
      if (link) return { cert, level: 'OWNER' };
    }
    throw notFound();
  },

  async details(user, id) {
    const { cert, level } = await this._loadAuthorized(user, id);
    const out = toCertificate(cert, { includeRevokeReason: level !== 'OWNER' });
    if (level !== 'OWNER') {
      out.history = (await db('certificate_events').where({ certificate_id: cert.id }).orderBy('id')).map((e) => ({
        action: e.action,
        actorName: e.actor_name,
        actorRole: e.actor_role,
        reason: e.reason,
        at: e.created_at
      }));
      out.templateVersion = cert.template_version;
    }
    return out;
  },

  /** Stored PDF for a certificate the user may view. Students/parents only get active certificates. */
  async pdfFile(user, id) {
    const { cert, level } = await this._loadAuthorized(user, id);
    if (level === 'OWNER' && cert.status !== 'ACTIVE') {
      throw new AppError('This certificate has been revoked by the school.', 410, ErrorCodes.INVALID_STATE);
    }
    const file = resolveStorageKey(cert.pdf_storage_key, PDF_DIR_NAME);
    if (!file) throw notFound('The certificate file is unavailable. Please contact the school office.');
    return { file, fileName: `${cert.certificate_number}.pdf` };
  },

  async revoke(user, id, reason) {
    if (!isStaff(user)) throw forbidden('Only the Principal or an Administrator can revoke certificates.');
    const text = String(reason || '').trim();
    if (text.length < 5) throw validation('Enter a reason for revoking this certificate (at least 5 characters).');
    if (text.length > 500) throw validation('Reason must be at most 500 characters.');
    await db.transaction(async (trx) => {
      const cert = await trx('student_certificates').where({ id: Number(id) }).forUpdate().first();
      if (!cert) throw notFound();
      if (cert.status === 'REVOKED') throw new AppError('This certificate is already revoked.', 409, ErrorCodes.INVALID_STATE);
      await trx('student_certificates').where({ id: cert.id }).update({
        status: 'REVOKED',
        revoked_at: trx.raw('CURRENT_TIMESTAMP(3)'),
        revoked_by: user.id,
        revoke_reason: text
      });
      await logEvent(trx, { action: 'REVOKED', user, certificateId: cert.id, templateId: cert.template_id, categoryId: cert.category_id, reason: text });
    });
    return this.details(user, id);
  },

  // ---- Administration (Principal / Admin) ----------------------------------
  async listCategoriesAdmin() {
    const rows = await db('certificate_categories as c')
      .leftJoin(db('certificate_templates').select('category_id').count('id as n').groupBy('category_id').as('t'), 't.category_id', 'c.id')
      .leftJoin(db('student_certificates').select('category_id').count('id as n').groupBy('category_id').as('s'), 's.category_id', 'c.id')
      .select('c.*', 't.n as template_count', 's.n as certificate_count')
      .orderBy([{ column: 'c.sort_order' }, { column: 'c.name' }]);
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      sortOrder: c.sort_order,
      isActive: bool(c.is_active),
      templateCount: Number(c.template_count || 0),
      certificateCount: Number(c.certificate_count || 0)
    }));
  },

  async saveCategory(user, id, body = {}) {
    const schema = z.object({
      name: z.string().trim().min(2, 'Category name is required.').max(100),
      description: z.string().trim().max(500).optional().nullable(),
      sortOrder: z.coerce.number().int().min(0).max(100000).optional(),
      isActive: z.boolean().optional()
    });
    const v = parseOrThrow(id ? schema.partial() : schema, body);
    if (v.name) assertPrintable('Category name', v.name);
    const row = {};
    if (v.name !== undefined) row.name = v.name;
    if (v.description !== undefined) row.description = v.description || null;
    if (v.sortOrder !== undefined) row.sort_order = v.sortOrder;
    if (v.isActive !== undefined) row.is_active = v.isActive;
    try {
      return await db.transaction(async (trx) => {
        let categoryId = id ? Number(id) : null;
        if (categoryId) {
          const before = await trx('certificate_categories').where({ id: categoryId }).first();
          if (!before) throw notFound('Category not found.');
          await trx('certificate_categories').where({ id: categoryId }).update(row);
          await logEvent(trx, { action: 'CATEGORY_UPDATED', user, categoryId, details: { before: { name: before.name, isActive: bool(before.is_active) }, changes: v } });
        } else {
          [categoryId] = await trx('certificate_categories').insert({ ...row, created_by: user.id });
          await logEvent(trx, { action: 'CATEGORY_CREATED', user, categoryId, details: v });
        }
        return categoryId;
      });
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') throw new AppError('A category with this name already exists.', 409, ErrorCodes.CONFLICT);
      throw err;
    }
  },

  async listTemplatesAdmin(query = {}) {
    let q = templateQuery().orderBy('c.sort_order').orderBy('t.name');
    if (query.categoryId) q = q.where('t.category_id', Number(query.categoryId));
    if (query.status) q = q.where('t.status', String(query.status));
    const rows = await q;
    const counts = new Map(
      (await db('student_certificates').select('template_id').count('id as n').groupBy('template_id')).map((r) => [Number(r.template_id), Number(r.n)])
    );
    return rows.map((t) => ({ ...toTemplate(t), categoryActive: bool(t.category_active), certificateCount: counts.get(Number(t.id)) || 0 }));
  },

  /**
   * Create or update a template. `files` = { background, logo, principalSignature } multer memory files.
   * Rendering-relevant changes bump the template version; issued PDFs are never touched.
   */
  async saveTemplate(user, id, body = {}, files = {}) {
    const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colours must be hex values like #1b1a47.');
    const flag = z.union([z.boolean(), z.enum(['true', 'false', '1', '0'])]).transform((v) => v === true || v === 'true' || v === '1');
    const schema = z.object({
      categoryId: z.coerce.number().int().positive(),
      name: z.string().trim().min(3, 'Template name is required.').max(150),
      certificateTitle: z.string().trim().min(3, 'Certificate title is required.').max(150),
      description: z.string().trim().max(500).optional().nullable(),
      designPreset: z.enum(['CLASSIC', 'MODERN', 'ELEGANT']),
      orientation: z.enum(['LANDSCAPE', 'PORTRAIT']),
      pageSize: z.enum(['A4', 'LETTER']),
      primaryColor: hex,
      accentColor: hex,
      bodyText: z.string().trim().min(10, 'Body text is required.').max(1000),
      showTeacherSignature: flag,
      showPrincipalSignature: flag,
      principalName: z.string().trim().max(150).optional().nullable(),
      removeBackground: flag.optional(),
      removeLogo: flag.optional(),
      removePrincipalSignature: flag.optional()
    });
    const v = parseOrThrow(id ? schema.partial() : schema, body);

    if (v.bodyText !== undefined) {
      const problems = validatePlaceholders(v.bodyText);
      if (problems.length) throw validation(problems[0], { issues: problems, supportedPlaceholders: SUPPORTED_PLACEHOLDERS });
      assertPrintable('Body text', v.bodyText);
    }
    for (const [label, val] of [['Template name', v.name], ['Certificate title', v.certificateTitle], ['Principal name', v.principalName]]) {
      if (val) assertPrintable(label, val);
    }
    if (v.categoryId !== undefined) {
      const cat = await db('certificate_categories').where({ id: v.categoryId }).first();
      if (!cat) throw validation('Selected category does not exist.');
    }

    // Validate and store uploaded images (PNG/JPEG only: the PDF renderer embeds these formats)
    const written = [];
    const assetKeys = {};
    try {
      for (const [field, column] of [['background', 'background_storage_key'], ['logo', 'logo_storage_key'], ['principalSignature', 'principal_signature_storage_key']]) {
        const f = files[field];
        if (!f) continue;
        if (f.size > ASSET_LIMITS[field]) throw validation(`${field} image must be ${ASSET_LIMITS[field] / (1024 * 1024)} MB or smaller.`);
        const kind = sniffImage(f.buffer);
        if (!kind || !['image/png', 'image/jpeg'].includes(kind.mime)) throw validation(`${field} must be a PNG or JPEG image.`);
        const key = writePrivateFile(ASSET_DIR_NAME, f.buffer, kind.ext);
        written.push(key);
        assetKeys[column] = key;
      }

      const row = {};
      const map = {
        categoryId: 'category_id',
        name: 'name',
        certificateTitle: 'certificate_title',
        description: 'description',
        designPreset: 'design_preset',
        orientation: 'orientation',
        pageSize: 'page_size',
        primaryColor: 'primary_color',
        accentColor: 'accent_color',
        bodyText: 'body_text',
        showTeacherSignature: 'show_teacher_signature',
        showPrincipalSignature: 'show_principal_signature',
        principalName: 'principal_name'
      };
      for (const [k, col] of Object.entries(map)) if (v[k] !== undefined) row[col] = v[k] === '' ? null : v[k];
      if (v.removeBackground) row.background_storage_key = null;
      if (v.removeLogo) row.logo_storage_key = null;
      if (v.removePrincipalSignature) row.principal_signature_storage_key = null;
      Object.assign(row, assetKeys);

      return await db.transaction(async (trx) => {
        let templateId = id ? Number(id) : null;
        if (templateId) {
          const before = await trx('certificate_templates').where({ id: templateId }).forUpdate().first();
          if (!before) throw notFound('Template not found.');
          // Booleans arrive as true/false but are stored as 1/0: normalise before comparing
          const norm = (val) => (typeof val === 'boolean' ? (val ? '1' : '0') : String(val ?? ''));
          const designChanged = Object.keys(row).some(
            (col) => !['name', 'description', 'category_id'].includes(col) && norm(before[col]) !== norm(row[col])
          );
          await trx('certificate_templates').where({ id: templateId }).update({
            ...row,
            updated_by: user.id,
            ...(designChanged ? { version: before.version + 1 } : {})
          });
          await logEvent(trx, { action: 'TEMPLATE_UPDATED', user, templateId, categoryId: row.category_id || before.category_id, details: { changedFields: Object.keys(row), newVersion: designChanged ? before.version + 1 : before.version } });
        } else {
          [templateId] = await trx('certificate_templates').insert({ ...row, status: 'ACTIVE', version: 1, created_by: user.id, updated_by: user.id });
          await logEvent(trx, { action: 'TEMPLATE_CREATED', user, templateId, categoryId: row.category_id });
        }
        return templateId;
      });
    } catch (err) {
      removeKeys(written, ASSET_DIR_NAME);
      throw err;
    }
  },

  /** ACTIVE / INACTIVE / ARCHIVED: affects only future issuance. */
  async setTemplateStatus(user, id, status) {
    if (!['ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(String(status))) throw validation('Status must be ACTIVE, INACTIVE or ARCHIVED.');
    await db.transaction(async (trx) => {
      const before = await trx('certificate_templates').where({ id: Number(id) }).forUpdate().first();
      if (!before) throw notFound('Template not found.');
      if (before.status === status) return;
      await trx('certificate_templates').where({ id: before.id }).update({ status, updated_by: user.id });
      await logEvent(trx, { action: 'TEMPLATE_STATUS', user, templateId: before.id, categoryId: before.category_id, details: { from: before.status, to: status } });
    });
    return toTemplate(await templateQuery().where('t.id', Number(id)).first());
  },

  async events(query = {}) {
    let q = db('certificate_events as e')
      .leftJoin('student_certificates as sc', 'e.certificate_id', 'sc.id')
      .leftJoin('certificate_templates as t', 'e.template_id', 't.id')
      .select('e.*', 'sc.certificate_number', 'sc.student_name', 't.name as template_name')
      .orderBy('e.id', 'desc')
      .limit(Math.min(Number(query.limit) || 100, 500));
    if (query.certificateId) q = q.where('e.certificate_id', Number(query.certificateId));
    if (query.templateId) q = q.where('e.template_id', Number(query.templateId));
    if (query.action) q = q.where('e.action', String(query.action));
    const rows = await q;
    return rows.map((e) => ({
      id: e.id,
      action: e.action,
      certificateId: e.certificate_id,
      certificateNumber: e.certificate_number,
      studentName: e.student_name,
      templateId: e.template_id,
      templateName: e.template_name,
      actorName: e.actor_name,
      actorRole: e.actor_role,
      reason: e.reason,
      details: typeof e.details === 'string' ? JSON.parse(e.details) : e.details,
      at: e.created_at
    }));
  }
};
