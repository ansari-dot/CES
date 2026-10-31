import { academicRepository } from './academic.repository.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';

export const academicService = {
  async getAllSessions() {
    return await academicRepository.getAllSessions();
  },

  async getCurrentSession() {
    const session = await academicRepository.getCurrentSession();
    if (!session) {
      throw new AppError('No active academic session found', 404, ErrorCodes.NOT_FOUND);
    }
    return session;
  },

  async createSession(data) {
    const name = String(data.name || '').trim();
    if (!name) throw new AppError('Academic year name is required', 422, ErrorCodes.VALIDATION_ERROR);
    if (!data.start_date || !data.end_date) {
      throw new AppError('Start and end dates are required', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (new Date(data.start_date) >= new Date(data.end_date)) {
      throw new AppError('The end date must be after the start date', 422, ErrorCodes.VALIDATION_ERROR);
    }
    const overlap = await academicRepository.findOverlappingSession({
      startDate: data.start_date,
      endDate: data.end_date
    });
    if (overlap) {
      throw new AppError(
        `The dates overlap the existing academic year "${overlap.name}"`,
        409,
        ErrorCodes.CONFLICT
      );
    }
    const id = await academicRepository.createSession({
      name,
      start_date: data.start_date,
      end_date: data.end_date,
      is_current: data.is_current ? 1 : 0,
      status: data.is_current ? 'ACTIVE' : data.status && ['DRAFT', 'UPCOMING'].includes(data.status) ? data.status : 'DRAFT'
    });
    return await academicRepository.getSessionById(id);
  },

  async updateSession(id, data) {
    const session = await academicRepository.getSessionById(id);
    if (!session) throw new AppError('Academic year not found', 404, ErrorCodes.NOT_FOUND);
    if (session.status === 'CLOSED') {
      throw new AppError('A closed academic year cannot be edited', 409, ErrorCodes.INVALID_STATE);
    }
    const updates = {};
    if (data.name !== undefined) {
      const name = String(data.name).trim();
      if (!name) throw new AppError('Academic year name is required', 422, ErrorCodes.VALIDATION_ERROR);
      updates.name = name;
    }
    const startDate = data.start_date || session.start_date;
    const endDate = data.end_date || session.end_date;
    if (new Date(startDate) >= new Date(endDate)) {
      throw new AppError('The end date must be after the start date', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (data.start_date !== undefined || data.end_date !== undefined) {
      const overlap = await academicRepository.findOverlappingSession({
        startDate,
        endDate,
        excludeId: id
      });
      if (overlap) {
        throw new AppError(
          `The dates overlap the existing academic year "${overlap.name}"`,
          409,
          ErrorCodes.CONFLICT
        );
      }
      if (data.start_date !== undefined) updates.start_date = data.start_date;
      if (data.end_date !== undefined) updates.end_date = data.end_date;
    }
    if (data.status !== undefined) {
      if (!['DRAFT', 'UPCOMING'].includes(data.status) || session.is_current) {
        throw new AppError(
          'Status can only be set to Draft or Upcoming here; use activate/close for lifecycle changes',
          422,
          ErrorCodes.VALIDATION_ERROR
        );
      }
      updates.status = data.status;
    }
    if (Object.keys(updates).length === 0) return session;
    return await academicRepository.updateSession(id, updates);
  },

  async activateSession(id, actor) {
    const session = await academicRepository.getSessionById(id);
    if (!session) throw new AppError('Academic year not found', 404, ErrorCodes.NOT_FOUND);
    if (session.status === 'CLOSED') {
      throw new AppError('A closed academic year cannot be reactivated from here', 409, ErrorCodes.INVALID_STATE);
    }
    if (session.is_current) return session;
    return await academicRepository.activateSession(id, actor);
  },

  async closeSession(id, actor) {
    const session = await academicRepository.getSessionById(id);
    if (!session) throw new AppError('Academic year not found', 404, ErrorCodes.NOT_FOUND);
    if (session.status === 'CLOSED') return session;
    return await academicRepository.closeSession(id, actor);
  },

  async getSessionStats(id) {
    const session = await academicRepository.getSessionById(id);
    if (!session) throw new AppError('Academic year not found', 404, ErrorCodes.NOT_FOUND);
    const stats = await academicRepository.getSessionStats(id);
    return { session, ...stats };
  },

  // ── Terms ──────────────────────────────────────────────────────────

  async getTerms(sessionId) {
    return await academicRepository.getTermsBySession(sessionId);
  },

  validateTermDates(session, data) {
    if (!data.name || !String(data.name).trim()) {
      throw new AppError('Term name is required', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (!data.start_date || !data.end_date) {
      throw new AppError('Term start and end dates are required', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (new Date(data.start_date) >= new Date(data.end_date)) {
      throw new AppError('The term end date must be after its start date', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (
      new Date(data.start_date) < new Date(session.start_date) ||
      new Date(data.end_date) > new Date(session.end_date)
    ) {
      throw new AppError('Term dates must fall within the academic year', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (data.exam_start_date && data.exam_end_date) {
      if (new Date(data.exam_start_date) > new Date(data.exam_end_date)) {
        throw new AppError('The examination end date must not be before its start date', 422, ErrorCodes.VALIDATION_ERROR);
      }
    }
  },

  async createTerm(sessionId, data) {
    const session = await academicRepository.getSessionById(sessionId);
    if (!session) throw new AppError('Academic year not found', 404, ErrorCodes.NOT_FOUND);
    if (session.status === 'CLOSED') {
      throw new AppError('Terms cannot be added to a closed academic year', 409, ErrorCodes.INVALID_STATE);
    }
    this.validateTermDates(session, data);
    const id = await academicRepository.createTerm({
      session_id: sessionId,
      name: String(data.name).trim(),
      start_date: data.start_date,
      end_date: data.end_date,
      exam_start_date: data.exam_start_date || null,
      exam_end_date: data.exam_end_date || null,
      is_final: data.is_final ? 1 : 0,
      sort_order: Number(data.sort_order) || 1,
      status: ['UPCOMING', 'ACTIVE', 'COMPLETED'].includes(data.status) ? data.status : 'UPCOMING'
    });
    return await academicRepository.getTermById(id);
  },

  async updateTerm(id, data) {
    const term = await academicRepository.getTermById(id);
    if (!term) throw new AppError('Term not found', 404, ErrorCodes.NOT_FOUND);
    const session = await academicRepository.getSessionById(term.session_id);
    if (session.status === 'CLOSED') {
      throw new AppError('Terms of a closed academic year cannot be edited', 409, ErrorCodes.INVALID_STATE);
    }
    const merged = {
      name: data.name !== undefined ? data.name : term.name,
      start_date: data.start_date !== undefined ? data.start_date : term.start_date,
      end_date: data.end_date !== undefined ? data.end_date : term.end_date,
      exam_start_date: data.exam_start_date !== undefined ? data.exam_start_date : term.exam_start_date,
      exam_end_date: data.exam_end_date !== undefined ? data.exam_end_date : term.exam_end_date
    };
    this.validateTermDates(session, merged);
    const updates = {
      name: String(merged.name).trim(),
      start_date: merged.start_date,
      end_date: merged.end_date,
      exam_start_date: merged.exam_start_date || null,
      exam_end_date: merged.exam_end_date || null
    };
    if (data.is_final !== undefined) updates.is_final = data.is_final ? 1 : 0;
    if (data.sort_order !== undefined) updates.sort_order = Number(data.sort_order) || term.sort_order;
    if (data.status !== undefined && ['UPCOMING', 'ACTIVE', 'COMPLETED'].includes(data.status)) {
      updates.status = data.status;
    }
    return await academicRepository.updateTerm(id, updates);
  },

  // ── Promotion policy ───────────────────────────────────────────────

  async getPromotionPolicy(sessionId) {
    return await academicRepository.getEffectivePolicy(sessionId ? Number(sessionId) : null);
  },

  async savePromotionPolicy(sessionId, data, actor) {
    const numeric = (v, label, min, max) => {
      const n = Number(v);
      if (Number.isNaN(n) || n < min || n > max) {
        throw new AppError(`${label} must be between ${min} and ${max}`, 422, ErrorCodes.VALIDATION_ERROR);
      }
      return n;
    };
    const payload = {
      min_overall_percentage: numeric(data.min_overall_percentage, 'Minimum overall percentage', 0, 100),
      min_subject_percentage: numeric(data.min_subject_percentage, 'Minimum subject percentage', 0, 100),
      max_failed_subjects: numeric(data.max_failed_subjects ?? 0, 'Allowed failed subjects', 0, 20),
      supplementary_allowed: data.supplementary_allowed ? 1 : 0,
      max_supplementary_subjects: numeric(data.max_supplementary_subjects ?? 2, 'Supplementary subjects', 0, 20),
      absent_policy: ['FAIL', 'ZERO', 'EXCLUDE'].includes(data.absent_policy) ? data.absent_policy : 'ZERO',
      auto_graduate_final_grade: data.auto_graduate_final_grade === false || data.auto_graduate_final_grade === 0 ? 0 : 1,
      notes: data.notes ? String(data.notes).slice(0, 500) : null
    };
    if (sessionId) {
      const session = await academicRepository.getSessionById(Number(sessionId));
      if (!session) throw new AppError('Academic year not found', 404, ErrorCodes.NOT_FOUND);
    }
    return await academicRepository.upsertPolicy(sessionId ? Number(sessionId) : null, payload, actor?.id);
  },

  async getAllClasses() {
    return await academicRepository.getAllClasses();
  },

  async getClassSubjects(classId) {
    const cls = await academicRepository.getClassById(classId);
    if (!cls) {
      throw new AppError('Class not found', 404, ErrorCodes.NOT_FOUND);
    }
    return await academicRepository.getClassSubjects(classId);
  },

  async setClassSubjects(classId, subjectIds) {
    const cls = await academicRepository.getClassById(classId);
    if (!cls) {
      throw new AppError('Class not found', 404, ErrorCodes.NOT_FOUND);
    }
    await academicRepository.setClassSubjects(classId, subjectIds);
    return await academicRepository.getClassSubjects(classId);
  },

  async getAllSubjects() {
    return await academicRepository.getAllSubjects();
  },

  async createSubject(data) {
    const id = await academicRepository.createSubject(data);
    return { id, ...data };
  },

  async getTeacherAssignments(teacherId, sessionId) {
    return await academicRepository.getTeacherAssignments(teacherId, sessionId);
  },

  async assignTeacher(data) {
    const id = await academicRepository.assignTeacher(data);
    return { id, ...data };
  },

  async getClassAssignments(classId) {
    return await academicRepository.getClassAssignments(classId);
  },

  async addSubjectToClass(classId, { subjectId, name, code }) {
    const cls = await academicRepository.getClassById(classId);
    if (!cls) {
      throw new AppError('Class not found', 404, ErrorCodes.NOT_FOUND);
    }

    let finalSubjectId = subjectId ? Number(subjectId) : null;

    if (!finalSubjectId && name && code) {
      let existingSub = await academicRepository.getSubjectByCode(code.toUpperCase());
      if (!existingSub) {
        const newId = await academicRepository.createSubject({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          is_active: 1
        });
        finalSubjectId = newId;
      } else {
        finalSubjectId = existingSub.id;
      }
    }

    if (!finalSubjectId) {
      throw new AppError('Subject ID or valid name and code required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await academicRepository.addSubjectToClass(classId, finalSubjectId);
    return await academicRepository.getClassSubjects(classId);
  },

  async removeTeacherAssignment(data) {
    await academicRepository.removeTeacherAssignment(data);
    return { success: true };
  }
};
