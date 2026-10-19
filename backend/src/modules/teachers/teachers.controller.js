import { teachersService } from './teachers.service.js';
import { sendSuccess } from '../../shared/http/response.js';

export const teachersController = {
  async getAllTeachers(req, res, next) {
    try {
      const teachers = await teachersService.getAllTeachers();
      return sendSuccess(res, teachers);
    } catch (error) {
      next(error);
    }
  },

  async createTeacher(req, res, next) {
    try {
      const {
        name,
        staffIdentifier,
        email,
        phone,
        designation,
        joiningDate,
        employmentStatus,
        qualification,
        salaryConfig
      } = req.body;

      const teacher = await teachersService.createTeacher({
        name,
        staffIdentifier,
        email,
        phone,
        designation,
        joiningDate,
        employmentStatus,
        qualification,
        salaryConfig,
        creatorUserId: req.user?.id
      });

      return sendSuccess(res, teacher, null, 201);
    } catch (error) {
      console.error('Error in createTeacher:', error);
      next(error);
    }
  },

  async changeStatus(req, res, next) {
    try {
      const idParam = req.params.id;
      // Extract numeric id if passed as TCH-01 or raw number
      const rawId = Number(String(idParam).replace(/[^0-9]/g, ''));
      const { action, reason } = req.body;

      const result = await teachersService.changeTeacherStatus(
        rawId,
        action,
        reason || 'Status updated by Principal',
        req.user?.id
      );

      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
};
