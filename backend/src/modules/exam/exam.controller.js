import { examService } from './exam.service.js';

export const examController = {
  async create(req, res, next) {
    try {
      const exam = await examService.createExam(req.body, req.user);
      res.status(201).json({ success: true, data: exam });
    } catch (err) {
      next(err);
    }
  },

  async list(req, res, next) {
    try {
      const data = await examService.listExams(req.query, req.user);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async detail(req, res, next) {
    try {
      const data = await examService.getExamDetail(req.params.id, req.user);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async createPaper(req, res, next) {
    try {
      const paper = await examService.createPaper(req.params.id, req.body, req.user);
      res.status(201).json({ success: true, data: paper });
    } catch (err) {
      next(err);
    }
  },

  async listPapers(req, res, next) {
    try {
      const data = await examService.listPapers(req.params.id, req.query, req.user);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getMarksSheet(req, res, next) {
    try {
      const data = await examService.getPaperMarksSheet(req.params.paperId, req.user);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async submitMarks(req, res, next) {
    try {
      const data = await examService.submitPaperMarks(req.params.paperId, req.body, req.user);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async verifyClassMarks(req, res, next) {
    try {
      const data = await examService.verifyClassMarks(req.params.id, req.body.classId, req.user);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async calculateResults(req, res, next) {
    try {
      const data = await examService.calculateResults(req.params.id, req.body.classId, req.user);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async publish(req, res, next) {
    try {
      const data = await examService.publishExam(req.params.id, req.body.classId, req.user);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getReportCard(req, res, next) {
    try {
      const data = await examService.getStudentReportCard(req.params.id, req.params.studentId, req.user);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
};

