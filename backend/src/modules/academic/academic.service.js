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
    const id = await academicRepository.createSession(data);
    return { id, ...data };
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
  }
};
