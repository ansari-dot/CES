import { supplementaryService } from './supplementary.service.js';

export const supplementaryController = {
  async getFailedSubjects(req, res, next) {
    try {
      const { sessionId, classId, studentId } = req.query;
      const subjects = await supplementaryService.getFailedTerminalSubjects({
        sessionId: sessionId ? Number(sessionId) : undefined,
        classId: classId ? Number(classId) : undefined,
        studentId: studentId ? Number(studentId) : undefined
      });
      res.json({ success: true, data: subjects });
    } catch (err) {
      next(err);
    }
  },

  async listSupplementary(req, res, next) {
    try {
      const { sessionId, classId, studentId, subjectId, status, limit, offset } = req.query;
      const result = await supplementaryService.listSupplementary({
        sessionId: sessionId ? Number(sessionId) : undefined,
        classId: classId ? Number(classId) : undefined,
        studentId: studentId ? Number(studentId) : undefined,
        subjectId: subjectId ? Number(subjectId) : undefined,
        status,
        limit: limit ? Number(limit) : 50,
        offset: offset ? Number(offset) : 0
      });
      res.json({ success: true, data: result.data, total: result.total });
    } catch (err) {
      next(err);
    }
  },

  async getSupplementaryById(req, res, next) {
    try {
      const record = await supplementaryService.getSupplementaryById(Number(req.params.id));
      res.json({ success: true, data: record });
    } catch (err) {
      next(err);
    }
  },

  async initialize(req, res, next) {
    try {
      const { finalResultSubjectId } = req.body;
      const record = await supplementaryService.initializeSupplementary(
        { finalResultSubjectId: Number(finalResultSubjectId) },
        req.user
      );
      res.status(201).json({
        success: true,
        data: record,
        message: 'Supplementary examination record initialized'
      });
    } catch (err) {
      next(err);
    }
  },

  async schedule(req, res, next) {
    try {
      const { mode, dateSheetEntryId, monthlyTestId, examDate } = req.body;
      const record = await supplementaryService.scheduleExam(
        {
          id: Number(req.params.id),
          mode,
          dateSheetEntryId: dateSheetEntryId ? Number(dateSheetEntryId) : null,
          monthlyTestId: monthlyTestId ? Number(monthlyTestId) : null,
          examDate
        },
        req.user
      );
      res.json({ success: true, data: record, message: 'Supplementary examination scheduled successfully' });
    } catch (err) {
      next(err);
    }
  },

  async recordMarks(req, res, next) {
    try {
      const { obtainedMarks, isAbsent, remarks } = req.body;
      const record = await supplementaryService.recordMarks(
        {
          id: Number(req.params.id),
          obtainedMarks,
          isAbsent: Boolean(isAbsent),
          remarks
        },
        req.user
      );
      res.json({ success: true, data: record, message: 'Marks recorded in draft' });
    } catch (err) {
      next(err);
    }
  },

  async submitMarks(req, res, next) {
    try {
      const record = await supplementaryService.submitMarks(Number(req.params.id), req.user);
      res.json({ success: true, data: record, message: 'Marks submitted for approval' });
    } catch (err) {
      next(err);
    }
  },

  async approveResult(req, res, next) {
    try {
      const record = await supplementaryService.approveResult(Number(req.params.id), req.user);
      res.json({ success: true, data: record, message: 'Supplementary result approved' });
    } catch (err) {
      next(err);
    }
  },

  async publishResult(req, res, next) {
    try {
      const record = await supplementaryService.publishResult(Number(req.params.id), req.user);
      res.json({
        success: true,
        data: record,
        message: 'Supplementary result published and made authoritative'
      });
    } catch (err) {
      next(err);
    }
  },

  async cancelExam(req, res, next) {
    try {
      const { reason } = req.body;
      const record = await supplementaryService.cancelExam(
        Number(req.params.id),
        { reason },
        req.user
      );
      res.json({ success: true, data: record, message: 'Supplementary examination cancelled' });
    } catch (err) {
      next(err);
    }
  },

  async issueCorrection(req, res, next) {
    try {
      const { correctionReason, obtainedMarks, isAbsent, remarks } = req.body;
      const record = await supplementaryService.issueCorrection(
        Number(req.params.id),
        {
          correctionReason,
          obtainedMarks,
          isAbsent: Boolean(isAbsent),
          remarks
        },
        req.user
      );
      res.json({
        success: true,
        data: record,
        message: 'Auditable correction published; prior version superseded'
      });
    } catch (err) {
      next(err);
    }
  }
};

