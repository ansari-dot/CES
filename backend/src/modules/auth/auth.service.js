import { v4 as uuidv4 } from 'uuid';
import { authRepository } from './auth.repository.js';
import { hashPassword, verifyPassword, verifyDummyPassword } from '../../shared/crypto/password.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  generateCsrfToken
} from '../../shared/crypto/tokens.js';
import { sessionStore } from '../../shared/session/sessionStore.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { config } from '../../config/index.js';
import { db } from '../../shared/db/knex.js';
import { decryptAesGcm } from '../../shared/crypto/aes.js';
import { randomInt } from 'crypto';
import { notificationService } from '../../shared/services/notificationService.js';
import { emailService } from '../../shared/email/email.service.js';
import { auditRepository } from '../audit/audit.repository.js';
import { parseDbDate } from '../../shared/utils/date.js';

async function enrichUserData(user, permissions) {
  let teacherProfile = null;
  let studentProfile = null;
  let gender = null;
  let assignedClasses = [];

  if (user.role_code === 'STUDENT') {
    const student = await db('students').where({ user_id: user.id }).first();
    if (student) {
      gender = student.gender || null;
      studentProfile = {
        id: student.id,
        admissionNo: student.admission_no,
        rollNo: student.roll_no,
        gender: student.gender || null
      };
    }
  }

  if (user.role_code === 'TEACHER') {
    const teacher = await db('teachers').where({ user_id: user.id }).first();
    if (teacher) {
      teacherProfile = {
        id: `TCH-${String(teacher.id).padStart(3, '0')}`,
        rawId: teacher.id,
        employeeId: teacher.employee_no,
        designation: teacher.designation,
        joiningDate: teacher.joining_date
      };

      // 1. Direct assignments from teacher_assignments
      const directAssignments = await db('teacher_assignments')
        .join('classes', 'teacher_assignments.class_id', 'classes.id')
        .join('subjects', 'teacher_assignments.subject_id', 'subjects.id')
        .leftJoin('zoom_meetings', 'classes.id', 'zoom_meetings.class_id')
        .where('teacher_assignments.teacher_id', teacher.id)
        .select(
          'classes.id as classId',
          'classes.grade_level as grade',
          'classes.name as className',
          'subjects.id as subjectId',
          'subjects.name as subject',
          'subjects.code as subjectCode',
          'zoom_meetings.zoom_meeting_id as zoomRoomId'
        );

      // 2. Timetable slots where teacher is scheduled
      const slotAssignments = await db('timetable_slots')
        .join('classes', 'timetable_slots.class_id', 'classes.id')
        .join('subjects', 'timetable_slots.subject_id', 'subjects.id')
        .leftJoin('zoom_meetings', 'classes.id', 'zoom_meetings.class_id')
        .where('timetable_slots.teacher_id', teacher.id)
        .select(
          'classes.id as classId',
          'classes.grade_level as grade',
          'classes.name as className',
          'subjects.id as subjectId',
          'subjects.name as subject',
          'subjects.code as subjectCode',
          'zoom_meetings.zoom_meeting_id as zoomRoomId'
        );

      // Merge and deduplicate by classId + subjectId
      const mergedMap = new Map();
      for (const item of [...directAssignments, ...slotAssignments]) {
        const key = `${item.classId}-${item.subjectId}`;
        if (!mergedMap.has(key)) {
          mergedMap.set(key, item);
        }
      }
      const uniqueAssignments = Array.from(mergedMap.values());

      // Sync any missing assignments into teacher_assignments table for consistency
      for (const item of uniqueAssignments) {
        try {
          const exists = await db('teacher_assignments').where({
            teacher_id: teacher.id,
            class_id: item.classId,
            subject_id: item.subjectId
          }).first();
          if (!exists) {
            await db('teacher_assignments').insert({
              teacher_id: teacher.id,
              class_id: item.classId,
              subject_id: item.subjectId,
              session_id: 1,
              effective_from: '2026-10-20',
              assigned_by: user.id
            });
          }
        } catch (_) {}
      }

      // Query active student counts per class
      const classIds = uniqueAssignments.map((a) => a.classId);
      const countsByClass = {};
      const zoomByClass = {};
      if (classIds.length > 0) {
        const studentCounts = await db('students')
          .whereIn('current_class_id', classIds)
          .where('status', 'ACTIVE')
          .groupBy('current_class_id')
          .select('current_class_id', db.raw('count(*) as count'));
        for (const row of studentCounts) {
          countsByClass[row.current_class_id] = Number(row.count);
        }

        const zoomMeetings = await db('zoom_meetings')
          .whereIn('class_id', classIds)
          .where('status', 'ACTIVE');
        for (const zm of zoomMeetings) {
          let joinUrl = '';
          let passcode = '';
          try {
            joinUrl = zm.join_url_enc ? decryptAesGcm(zm.join_url_enc) : `https://zoom.us/j/${zm.zoom_meeting_id}`;
          } catch {
            joinUrl = `https://zoom.us/j/${zm.zoom_meeting_id}`;
          }
          try {
            passcode = zm.passcode_enc ? decryptAesGcm(zm.passcode_enc) : '';
          } catch {
            passcode = '';
          }
          let hostKey = '884422';
          if (zm.config_notes) {
            const match = zm.config_notes.match(/(?:host\s*key|host\s*pin|key|pin)[:\s=]*([0-9]{6})/i);
            if (match) hostKey = match[1];
          }
          zoomByClass[zm.class_id] = {
            zoomRoomId: zm.zoom_meeting_id,
            zoomPasscode: passcode,
            joinUrl,
            hostKey
          };
        }
      }

      assignedClasses = uniqueAssignments.map((a) => {
        const zm = zoomByClass[a.classId];
        return {
          id: String(a.classId),
          classId: a.classId,
          name: `${a.className} - ${a.subject}`,
          className: a.className,
          grade: a.grade,
          section: 'A',
          subjectId: a.subjectId,
          subject: a.subject,
          subjectCode: a.subjectCode,
          enrolledCount: countsByClass[a.classId] || 0,
          zoomRoomId: zm?.zoomRoomId || a.zoomRoomId || `900${a.grade}000${a.grade}`,
          zoomPasscode: zm?.zoomPasscode || `CLASS${a.grade}#`,
          hostKey: zm?.hostKey || '884422',
          joinUrl: zm?.joinUrl || `https://zoom.us/j/${zm?.zoomRoomId || `900${a.grade}000${a.grade}`}`,
          roomName: `Online Room ${a.grade}`
        };
      });
    }
  }

  // User-specific display timezone (saved preference); null => portal uses the browser zone
  let timezonePreference = null;
  try {
    const pref = await db('user_timezone_preferences').where({ user_id: user.id }).first();
    if (pref) timezonePreference = { timezone: pref.timezone, source: pref.source };
  } catch {
    // table not migrated yet
  }

  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role_code,
    status: user.status,
    mustChangePassword: Boolean(user.must_change_password),
    permissions,
    teacherProfile,
    studentProfile,
    gender,
    assignedClasses,
    timezone: timezonePreference?.timezone || null,
    timezoneSource: timezonePreference?.source || null,
    schoolTimezone: config.SCHOOL_TIMEZONE || 'Asia/Karachi'
  };
}

export const authService = {
  async login({ identifier, password, rememberMe = false, userAgent = null, ipAddress = null, currentSessionId = null }) {
    const user = await authRepository.findUserByIdentifier(identifier);

    if (!user) {
      await verifyDummyPassword(password);
      throw new AppError('Invalid credentials', 401, ErrorCodes.INVALID_CREDENTIALS);
    }

    // Check account lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const waitMinutes = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      throw new AppError(
        `Account is temporarily locked due to multiple failed attempts. Try again in ${waitMinutes} minutes.`,
        401,
        ErrorCodes.INVALID_CREDENTIALS
      );
    }

    // Verify password
    const isPasswordValid = await verifyPassword(user.password_hash, password);
    if (!isPasswordValid) {
      const newFailedCount = (user.failed_login_count || 0) + 1;
      let lockedUntil = null;
      if (newFailedCount >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lock
      }
      await authRepository.updateFailedLogin(user.id, newFailedCount, lockedUntil);
      throw new AppError('Invalid credentials', 401, ErrorCodes.INVALID_CREDENTIALS);
    }

    // Check status
    if (user.status === 'DEACTIVATED') {
      throw new AppError('Account is deactivated. Contact administration.', 403, ErrorCodes.ACCOUNT_RESTRICTED);
    }

    // A student suspended for an unpaid fee (past the challan grace period) is
    // blocked at login itself; the fee is paid and the payment slip uploaded
    // from the Parent Portal.
    if (user.status === 'SUSPENDED' && user.role_code === 'STUDENT') {
      const studentRow = await db('students').where({ user_id: user.id }).first();
      const openFeeRestriction = studentRow
        ? await db('fee_restriction_events')
            .where({ student_id: studentRow.id })
            .whereNull('resolved_at')
            .first()
        : null;
      if (openFeeRestriction) {
        throw new AppError(
          'Your student portal is locked because the fee was not paid within the grace period. Please pay your fee and upload the payment slip from the Parent Portal; access is restored automatically once the payment is verified.',
          403,
          ErrorCodes.ACCOUNT_RESTRICTED
        );
      }
    }

    // Reset failed counter and update last login
    await authRepository.resetFailedLoginAndSetLastLogin(user.id);

    // Rotate old session if one existed on this connection (prevents session fixation)
    if (currentSessionId) {
      await sessionStore.revokeSession(currentSessionId, 'ROTATED').catch(() => {});
    }

    // Create cryptographically secure server-side session
    const serverSession = await sessionStore.createSession({
      userId: user.id,
      roleCode: user.role_code,
      userAgent,
      ipAddress,
      rememberMe: Boolean(rememberMe)
    });

    // Create Refresh Token Family (sid)
    const familyId = uuidv4();
    const { rawToken, tokenHash } = generateRefreshToken();

    const now = new Date();
    const idleExpiresAt = new Date(now.getTime() + config.REFRESH_IDLE_DAYS * 24 * 60 * 60 * 1000);
    const absoluteExpiresAt = new Date(now.getTime() + config.REFRESH_ABS_DAYS * 24 * 60 * 60 * 1000);

    await authRepository.createRefreshToken({
      user_id: user.id,
      family_id: familyId,
      parent_id: null,
      token_hash: tokenHash,
      user_agent: userAgent ? userAgent.substring(0, 255) : null,
      ip_address: ipAddress ? ipAddress.substring(0, 45) : null,
      issued_at: now,
      idle_expires_at: idleExpiresAt,
      absolute_expires_at: absoluteExpiresAt
    });

    // Create Access Token & CSRF Token
    const accessToken = signAccessToken({
      userId: user.id,
      role: user.role_code,
      familyId,
      tokenVersion: user.token_version
    });

    const csrfToken = generateCsrfToken(familyId);
    const permissions = await authRepository.getRolePermissions(user.role_id);

    const safeUser = await enrichUserData(user, permissions);

    return {
      user: safeUser,
      sessionId: serverSession.sessionId,
      isRemember: serverSession.isRemember,
      tokens: {
        accessToken,
        refreshToken: rawToken,
        csrfToken
      }
    };
  },

  async refresh({ rawRefreshToken, userAgent = null, ipAddress = null }) {
    if (!rawRefreshToken) {
      throw new AppError('Refresh token required', 401, ErrorCodes.REFRESH_INVALID);
    }

    const tokenHash = hashToken(rawRefreshToken);
    const existingToken = await authRepository.findRefreshTokenByHash(tokenHash);

    if (!existingToken) {
      throw new AppError('Invalid refresh token', 401, ErrorCodes.REFRESH_INVALID);
    }

    // Check token family reuse (stolen token replay detection)
    if (existingToken.revoked_at || existingToken.used_at) {
      // Race condition check: token was rotated less than 10 seconds ago
      if (existingToken.used_at) {
        const timeSinceUse = Date.now() - new Date(existingToken.used_at).getTime();
        if (timeSinceUse < 10000) {
          throw new AppError('Refresh token race condition', 409, ErrorCodes.REFRESH_RACE);
        }
      }

      // Reused / stolen token: revoke entire family!
      await authRepository.revokeFamilyTokens(existingToken.family_id, 'REUSE_DETECTED');
      throw new AppError('Invalid refresh token family', 401, ErrorCodes.AUTH_REFRESH_REUSE);
    }

    // Check expiry
    const now = new Date();
    if (new Date(existingToken.idle_expires_at) < now || new Date(existingToken.absolute_expires_at) < now) {
      await authRepository.revokeFamilyTokens(existingToken.family_id, 'EXPIRED');
      throw new AppError('Refresh token has expired', 401, ErrorCodes.REFRESH_INVALID);
    }

    // Verify user status
    const user = await authRepository.findUserById(existingToken.user_id);
    if (!user || user.status === 'DEACTIVATED') {
      throw new AppError('User account not active', 403, ErrorCodes.ACCOUNT_RESTRICTED);
    }

    // Generate new refresh token in same family
    const { rawToken: newRawToken, tokenHash: newTokenHash } = generateRefreshToken();
    const idleExpiresAt = new Date(now.getTime() + config.REFRESH_IDLE_DAYS * 24 * 60 * 60 * 1000);

    await authRepository.rotateRefreshToken(existingToken.id, {
      user_id: user.id,
      family_id: existingToken.family_id,
      parent_id: existingToken.id,
      token_hash: newTokenHash,
      user_agent: userAgent ? userAgent.substring(0, 255) : null,
      ip_address: ipAddress ? ipAddress.substring(0, 45) : null,
      issued_at: now,
      idle_expires_at: idleExpiresAt,
      absolute_expires_at: existingToken.absolute_expires_at // preserve absolute expiry
    });

    // Issue new access token
    const newAccessToken = signAccessToken({
      userId: user.id,
      role: user.role_code,
      familyId: existingToken.family_id,
      tokenVersion: user.token_version
    });

    const newCsrfToken = generateCsrfToken(existingToken.family_id);

    return {
      tokens: {
        accessToken: newAccessToken,
        refreshToken: newRawToken,
        csrfToken: newCsrfToken
      }
    };
  },

  async logout({ sessionId, familyId, rawRefreshToken, userId }) {
    let resolvedUserId = userId;

    if (sessionId) {
      try {
        const session = await sessionStore.getSession(sessionId);
        if (session?.userId && !resolvedUserId) {
          resolvedUserId = session.userId;
        }
      } catch (_) {}
      await sessionStore.revokeSession(sessionId, 'LOGOUT').catch(() => {});
    }

    if (familyId) {
      await authRepository.revokeFamilyTokens(familyId, 'LOGOUT').catch(() => {});
    }

    if (rawRefreshToken) {
      try {
        const tokenHash = hashToken(rawRefreshToken);
        const existingToken = await authRepository.findRefreshTokenByHash(tokenHash);
        if (existingToken?.family_id) {
          await authRepository.revokeFamilyTokens(existingToken.family_id, 'LOGOUT').catch(() => {});
        }
        if (existingToken?.user_id && !resolvedUserId) {
          resolvedUserId = existingToken.user_id;
        }
      } catch {
        // quiet fallback
      }
    }

    // Invalidate active JWTs immediately by incrementing token_version in MySQL
    if (resolvedUserId) {
      await db('users').where({ id: resolvedUserId }).increment('token_version', 1).catch(() => {});
    }
  },

  async logoutAll({ userId }) {
    if (userId) {
      await sessionStore.revokeAllUserSessions(userId, 'LOGOUT_ALL').catch(() => {});
      await authRepository.revokeAllUserTokens(userId, 'LOGOUT_ALL').catch(() => {});
      // Increment token version to immediately invalidate any active JWTs
      await db('users').where({ id: userId }).increment('token_version', 1).catch(() => {});
    }
  },

  async changePassword({ userId, currentPassword, newPassword }) {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    // First login: this session was just opened with the temporary password, so the
    // current password is not asked again. Otherwise it must be confirmed.
    const isFirstLogin = Boolean(user.must_change_password);
    if (!isFirstLogin) {
      if (!currentPassword) {
        throw new AppError('Current password is required', 400, ErrorCodes.VALIDATION_ERROR);
      }
      const isValid = await verifyPassword(user.password_hash, currentPassword);
      if (!isValid) {
        throw new AppError('Current password is incorrect', 400, ErrorCodes.VALIDATION_ERROR);
      }
    }

    // The new password may not reuse the current (or temporary) one
    if (await verifyPassword(user.password_hash, newPassword)) {
      throw new AppError('New password must be different from current password', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const newHash = await hashPassword(newPassword);
    await authRepository.updateUserPassword(userId, newHash);

    // Clear the first-login flag if it was set
    if (user.must_change_password) {
      await db('users').where({ id: userId }).update({ must_change_password: 0 });
    }
  },

  // ── Principal-approved OTP password reset ──────────────────────────

  /**
   * Public: a teacher/student/parent asks for a password reset. Creates a
   * PENDING request the Principal must approve. Always answers neutrally so
   * account existence is never revealed.
   */
  async requestPasswordReset({ identifier }) {
    const neutral = {
      message:
        'If the account exists, your request has been submitted to the school for approval. You will receive an email with a one-time code once the Principal approves it.'
    };
    const user = await authRepository.findUserByIdentifier(identifier);
    if (!user || (user.status !== 'ACTIVE' && user.status !== 'SUSPENDED')) return neutral;
    if (!['TEACHER', 'STUDENT', 'PARENT'].includes(user.role_code)) return neutral;
    if (!user.email || !user.email.includes('@')) return neutral;

    const open = await db('password_reset_requests')
      .where({ user_id: user.id })
      .whereIn('status', ['PENDING', 'APPROVED'])
      .first();
    if (!open) {
      const [id] = await db('password_reset_requests').insert({
        user_id: user.id,
        role_code: user.role_code,
        email: user.email
      });
      notificationService.notify({
        title: 'Password Reset Request',
        message: `${user.full_name} (${user.role_code.toLowerCase()}) has requested a password reset. Review it under Access & Controls → Password Resets.`,
        type: 'Password Reset',
        targetRole: 'PRINCIPAL',
        relatedRecordId: String(id),
        relatedRecordType: 'PasswordResetRequest',
        priority: 'High'
      });
      await auditRepository.recordAuditLog({
        actorId: user.id,
        actorName: user.username,
        actorRole: user.role_code,
        action: 'REQUEST_PASSWORD_RESET',
        recordType: 'Password Reset',
        recordIdentifier: `${user.username} (#${id})`
      });
    }
    return neutral;
  },

  async listPasswordResetRequests(status = null) {
    let query = db('password_reset_requests')
      .join('users', 'password_reset_requests.user_id', 'users.id')
      .select(
        'password_reset_requests.id',
        'password_reset_requests.user_id as userId',
        'password_reset_requests.role_code as roleCode',
        'password_reset_requests.email',
        'password_reset_requests.status',
        'password_reset_requests.created_at as requestedAt',
        'password_reset_requests.reviewed_at as reviewedAt',
        'password_reset_requests.completed_at as completedAt',
        'users.full_name as fullName',
        'users.username'
      )
      .orderBy('password_reset_requests.id', 'desc')
      .limit(100);
    if (status) query = query.where('password_reset_requests.status', status);
    return await query;
  },

  /** Principal approves (emails a hashed, 15-minute, single-use OTP) or rejects. */
  async reviewPasswordResetRequest(requestId, decision, actor) {
    const upper = String(decision || '').toUpperCase();
    if (upper !== 'APPROVED' && upper !== 'REJECTED') {
      throw new AppError('Decision must be APPROVED or REJECTED', 422, ErrorCodes.VALIDATION_ERROR);
    }
    const request = await db('password_reset_requests').where({ id: Number(requestId) }).first();
    if (!request) throw new AppError('Password reset request not found', 404, ErrorCodes.NOT_FOUND);
    if (request.status !== 'PENDING') {
      throw new AppError(`This request has already been ${request.status.toLowerCase()}`, 409, ErrorCodes.INVALID_STATE);
    }
    const user = await authRepository.findUserById(request.user_id);
    if (!user) throw new AppError('The requesting account no longer exists', 404, ErrorCodes.NOT_FOUND);

    if (upper === 'REJECTED') {
      await db('password_reset_requests')
        .where({ id: request.id })
        .update({ status: 'REJECTED', reviewed_by: actor.id, reviewed_at: db.fn.now(3) });
    } else {
      const otp = String(randomInt(100000, 1000000)); // 6 digits, crypto-secure
      const otpHash = await hashPassword(otp);
      await db('password_reset_requests')
        .where({ id: request.id })
        .update({
          status: 'APPROVED',
          otp_hash: otpHash,
          otp_expires_at: new Date(Date.now() + 15 * 60 * 1000),
          attempt_count: 0,
          reviewed_by: actor.id,
          reviewed_at: db.fn.now(3)
        });
      // Fire-and-forget email; approval stands even if SMTP hiccups (the
      // Principal can re-approve a new request if the mail never arrives).
      emailService
        .sendPasswordResetOtp({ to: request.email, name: user.full_name, otp })
        .catch((err) => console.warn('[PasswordReset] OTP email failed:', err.message));
    }

    await auditRepository.recordAuditLog({
      actorId: actor.id,
      actorName: actor.username,
      actorRole: actor.role,
      action: upper === 'APPROVED' ? 'APPROVE_PASSWORD_RESET' : 'REJECT_PASSWORD_RESET',
      recordType: 'Password Reset',
      recordIdentifier: `${user.username} (#${request.id})`
    });

    const updated = await db('password_reset_requests').where({ id: request.id }).first();
    // Never expose the OTP hash through the API
    if (updated) {
      delete updated.otp_hash;
    }
    return updated;
  },

  /** Public: email/identifier + OTP + new password → password updated. */
  async completePasswordReset({ identifier, otp, newPassword }) {
    const fail = () =>
      new AppError(
        'Invalid or expired code. Check the one-time code from your email, or ask the school to approve a new request.',
        400,
        ErrorCodes.VALIDATION_ERROR
      );

    const user = await authRepository.findUserByIdentifier(identifier);
    if (!user) throw fail();

    const request = await db('password_reset_requests')
      .where({ user_id: user.id, status: 'APPROVED' })
      .orderBy('id', 'desc')
      .first();
    if (!request || !request.otp_hash) throw fail();

    // otp_expires_at is stored in UTC; parseDbDate avoids the local-timezone shift
    if (!request.otp_expires_at || parseDbDate(request.otp_expires_at) < new Date()) {
      await db('password_reset_requests').where({ id: request.id }).update({ status: 'EXPIRED' });
      throw fail();
    }
    if (Number(request.attempt_count) >= 5) {
      await db('password_reset_requests').where({ id: request.id }).update({ status: 'EXPIRED' });
      throw fail();
    }

    const otpValid = await verifyPassword(request.otp_hash, String(otp || ''));
    if (!otpValid) {
      const attempts = Number(request.attempt_count) + 1;
      await db('password_reset_requests')
        .where({ id: request.id })
        .update({ attempt_count: attempts, ...(attempts >= 5 ? { status: 'EXPIRED' } : {}) });
      throw fail();
    }

    const newHash = await hashPassword(newPassword);
    // Updates the hash, bumps token_version and revokes refresh tokens
    await authRepository.updateUserPassword(user.id, newHash);
    await db('password_reset_requests')
      .where({ id: request.id })
      .update({ status: 'COMPLETED', completed_at: db.fn.now(3) });

    await auditRepository.recordAuditLog({
      actorId: user.id,
      actorName: user.username,
      actorRole: user.role_code,
      action: 'COMPLETE_PASSWORD_RESET',
      recordType: 'Password Reset',
      recordIdentifier: `${user.username} (#${request.id})`
    });

    return { message: 'Password updated successfully. Please log in with your new password.' };
  },

  async getMe({ userId }) {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    const permissions = await authRepository.getRolePermissions(user.role_id);

    return await enrichUserData(user, permissions);
  }
};
