import { teachersRepository } from './teachers.repository.js';
import { hashPassword } from '../../shared/crypto/password.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { emailService } from '../../shared/email/email.service.js';

export const teachersService = {
  async getAllTeachers() {
    return await teachersRepository.getAllTeachers();
  },

  async createTeacher({
    name,
    staffIdentifier,
    email,
    phone,
    designation,
    joiningDate,
    employmentStatus,
    qualification,
    salaryConfig,
    creatorUserId
  }) {
    // Generate username from staff identifier or email
    const username = staffIdentifier.toLowerCase().replace(/[^a-z0-9]/g, '') || `tch_${Date.now()}`;
    const temporaryPassword = 'TeacherPassword123!';
    const passwordHash = await hashPassword(temporaryPassword);

    // Map salary model to SRS enum
    let dbModel = 'FIXED';
    if (salaryConfig?.model === 'Per-lesson model' || salaryConfig?.model === 'PER_LESSON') {
      dbModel = 'PER_LESSON';
    } else if (salaryConfig?.model === 'Hourly verified rate' || salaryConfig?.model === 'PER_HOUR') {
      dbModel = 'PER_HOUR';
    } else if (salaryConfig?.model === 'Hybrid fixed + lesson bonus' || salaryConfig?.model === 'HYBRID') {
      dbModel = 'HYBRID';
    }

    const { userId, teacherId } = await teachersRepository.createTeacherWithUser({
      user: {
        role_id: 3, // TEACHER
        username,
        email,
        phone,
        full_name: name,
        password_hash: passwordHash,
        status: 'ACTIVE',
        // New faculty accounts must replace the temporary password on first login
        must_change_password: 1
      },
      teacher: {
        employee_no: staffIdentifier,
        designation: designation || 'Faculty Member',
        joining_date: joiningDate || new Date().toISOString().split('T')[0],
        employment_status: employmentStatus === 'Part-Time' ? 'ACTIVE' : 'ACTIVE',
        qualification: qualification || null
      },
      salaryProfile: {
        model: dbModel,
        base_amount: salaryConfig?.baseMonthlySalary || 0,
        per_lesson_rate: salaryConfig?.perLessonRate || 0,
        per_hour_rate: salaryConfig?.perHourRate || 0,
        rules: {
          allowances: salaryConfig?.allowances || 0,
          standardDeductions: salaryConfig?.standardDeductions || 0
        },
        effective_from: joiningDate || new Date().toISOString().split('T')[0],
        approved_by: creatorUserId || null
      }
    });

    // Send Welcome Email with credentials to teacher
    if (email) {
      emailService.sendTeacherCredentials({
        email,
        name,
        staffIdentifier,
        username,
        temporaryPassword,
        designation: designation || 'Faculty Member'
      }).catch((err) => {
        console.warn(`[TeachersService] Background email dispatch failed: ${err.message}`);
      });
    }

    return {
      id: `TCH-${String(teacherId).padStart(2, '0')}`,
      rawId: teacherId,
      userId,
      name,
      staffIdentifier,
      email,
      phone: phone || '',
      designation: designation || 'Faculty Member',
      joiningDate: joiningDate || new Date().toISOString().split('T')[0],
      employmentStatus: employmentStatus || 'Full-Time',
      accountStatus: 'Active',
      temporaryPassword,
      salaryConfig: {
        model: salaryConfig?.model || 'Fixed monthly',
        baseMonthlySalary: salaryConfig?.baseMonthlySalary || 0,
        perLessonRate: salaryConfig?.perLessonRate || 0,
        perHourRate: salaryConfig?.perHourRate || 0,
        allowances: salaryConfig?.allowances || 0,
        standardDeductions: salaryConfig?.standardDeductions || 0
      },
      classesAssigned: []
    };
  },

  async changeTeacherStatus(rawId, action, reason, changedBy) {
    const teacher = await teachersRepository.findTeacherById(rawId);
    if (!teacher) {
      throw new AppError('Teacher not found', 404, ErrorCodes.NOT_FOUND);
    }

    let newStatus = 'ACTIVE';
    if (action === 'Temporarily Suspend') {
      newStatus = 'SUSPENDED';
    } else if (action === 'Deactivate') {
      newStatus = 'DEACTIVATED';
    } else {
      newStatus = 'ACTIVE';
    }

    await teachersRepository.updateTeacherStatus(teacher.id, teacher.user_id, newStatus, reason, changedBy);

    return {
      teacherId: rawId,
      status: newStatus
    };
  }
};
