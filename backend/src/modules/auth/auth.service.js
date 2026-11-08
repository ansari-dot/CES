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
    assignedClasses
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

  async getMe({ userId }) {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
    }

    const permissions = await authRepository.getRolePermissions(user.role_id);

    return await enrichUserData(user, permissions);
  }
};
