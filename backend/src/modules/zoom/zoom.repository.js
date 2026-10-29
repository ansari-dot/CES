import { db } from '../../shared/db/knex.js';
import { encryptAesGcm, decryptAesGcm } from '../../shared/crypto/aes.js';

export const zoomRepository = {
  async getAllClassMeetings() {
    const rows = await db('zoom_meetings')
      .join('classes', 'zoom_meetings.class_id', 'classes.id')
      .where('zoom_meetings.status', 'ACTIVE')
      .select(
        'zoom_meetings.id',
        'zoom_meetings.class_id as classId',
        'classes.grade_level as classNumber',
        'classes.name as className',
        'zoom_meetings.zoom_meeting_id as zoomMeetingId',
        'zoom_meetings.topic',
        'zoom_meetings.join_url_enc',
        'zoom_meetings.passcode_enc',
        'zoom_meetings.start_url_enc',
        'zoom_meetings.host_zoom_user_id as hostZoomUserId',
        'zoom_meetings.host_email as hostEmail',
        'zoom_meetings.host_name as hostName',
        'zoom_meetings.account_id as accountId',
        'zoom_meetings.concurrency_slot as concurrencySlot',
        'zoom_meetings.host_mode as hostMode',
        'zoom_meetings.status',
        'zoom_meetings.last_health_status as lastHealthStatus',
        'zoom_meetings.last_health_check_at as lastHealthCheckAt',
        'zoom_meetings.last_webhook_event_at as lastWebhookEventAt',
        'zoom_meetings.webhook_verified_at as webhookVerifiedAt',
        'zoom_meetings.last_used_at as lastUsedAt',
        'zoom_meetings.config_notes as configNotes',
        'zoom_meetings.created_at as createdAt'
      )
      .orderBy('classes.grade_level', 'asc');

    // Get renewal/replacement history for all classes
    const replaced = await db('zoom_meetings')
      .leftJoin('users', 'zoom_meetings.created_by', 'users.id')
      .where('zoom_meetings.status', 'REPLACED')
      .select(
        'zoom_meetings.id',
        'zoom_meetings.class_id as classId',
        'zoom_meetings.zoom_meeting_id as previousMeetingId',
        'zoom_meetings.retired_at as renewedAt',
        'zoom_meetings.retire_reason as reason',
        'zoom_meetings.replaced_by_id as replacedById',
        'users.full_name as renewedBy'
      )
      .orderBy('zoom_meetings.retired_at', 'desc');

    const historyByClass = new Map();
    for (const r of replaced) {
      if (!historyByClass.has(r.classId)) {
        historyByClass.set(r.classId, []);
      }
      historyByClass.get(r.classId).push({
        id: String(r.id),
        previousMeetingId: r.previousMeetingId,
        newMeetingId: r.replacedById ? String(r.replacedById) : 'Replaced',
        renewedAt: r.renewedAt ? new Date(r.renewedAt).toISOString() : new Date().toISOString(),
        renewedBy: r.renewedBy || 'Principal',
        reason: r.reason || 'Rotated link'
      });
    }

    return rows.map((row) => {
      let joinUrl = '';
      let passcode = '';
      try {
        joinUrl = row.join_url_enc ? decryptAesGcm(row.join_url_enc) : `https://zoom.us/j/${row.zoomMeetingId}`;
      } catch {
        joinUrl = `https://zoom.us/j/${row.zoomMeetingId}`;
      }
      try {
        passcode = row.passcode_enc ? decryptAesGcm(row.passcode_enc) : '';
      } catch {
        passcode = '';
      }

      const hostKey = row.configNotes
        ? row.configNotes.match(/(?:host\s*key|host\s*pin|key|pin)[:\s=]*([0-9]{6})/i)?.[1] || '884422'
        : '884422';
      const resolvedEmail =
        row.hostEmail ||
        (row.configNotes
          ? row.configNotes.match(/(?:account|email)[:\s=]*([^\s,;]+@[^\s,;]+|[^\s,;]+)/i)?.[1] ||
            `zoom.class${row.classNumber}@school.pk`
          : `zoom.class${row.classNumber}@school.pk`);
      const resolvedName = row.hostName || `Class ${row.classNumber} Dedicated Licensed Host`;

      return {
        id: String(row.id),
        classId: row.classId,
        classNumber: row.classNumber,
        className: row.className,
        zoomMeetingId: row.zoomMeetingId,
        topic: row.topic,
        joinUrl,
        passcode,
        hostKey,
        hostZoomUserId: row.hostZoomUserId || `zoom_host_class_${row.classNumber}`,
        hostEmail: resolvedEmail,
        hostName: resolvedName,
        accountId: row.accountId || null,
        concurrencySlot: row.concurrencySlot || row.classNumber,
        accountEmail: resolvedEmail,
        hostMode: row.hostMode,
        status: row.status,
        lastHealthStatus: row.lastHealthStatus,
        lastHealthCheckAt: row.lastHealthCheckAt,
        lastWebhookEventAt: row.lastWebhookEventAt,
        webhookVerifiedAt: row.webhookVerifiedAt,
        lastUsedAt: row.lastUsedAt,
        configNotes: row.configNotes,
        createdAt: row.createdAt,
        updatedAt: row.createdAt,
        renewalHistory: historyByClass.get(row.classId) || []
      };
    });
  },

  async getMeetingByClassId(classId) {
    const row = await db('zoom_meetings')
      .where({ class_id: classId, status: 'ACTIVE' })
      .first();

    if (!row) return null;

    let joinUrl = '';
    let passcode = '';
    let startUrl = null;

    try {
      joinUrl = decryptAesGcm(row.join_url_enc);
    } catch {
      joinUrl = `https://zoom.us/j/${row.zoom_meeting_id}`;
    }
    try {
      passcode = row.passcode_enc ? decryptAesGcm(row.passcode_enc) : '';
    } catch {
      passcode = '';
    }
    try {
      startUrl = row.start_url_enc ? decryptAesGcm(row.start_url_enc) : null;
    } catch {
      startUrl = null;
    }

    const hostKey = row.config_notes
      ? row.config_notes.match(/(?:host\s*key|host\s*pin|key|pin)[:\s=]*([0-9]{6})/i)?.[1] || '884422'
      : '884422';
    const resolvedEmail =
      row.host_email ||
      (row.config_notes
        ? row.config_notes.match(/(?:account|email)[:\s=]*([^\s,;]+@[^\s,;]+|[^\s,;]+)/i)?.[1] ||
          `zoom.class${row.class_id}@school.pk`
        : `zoom.class${row.class_id}@school.pk`);
    const resolvedName = row.host_name || `Class ${row.class_id} Dedicated Licensed Host`;

    return {
      ...row,
      joinUrl,
      passcode,
      startUrl,
      hostKey,
      hostEmail: resolvedEmail,
      hostName: resolvedName,
      accountEmail: resolvedEmail,
      hostZoomUserId: row.host_zoom_user_id || `zoom_host_class_${row.class_id}`,
      concurrencySlot: row.concurrency_slot || row.class_id
    };
  },

  async findActiveMeetingByZoomMeetingId(zoomMeetingId) {
    if (!zoomMeetingId) return null;
    const cleanId = String(zoomMeetingId).trim();
    const row = await db('zoom_meetings')
      .where({ zoom_meeting_id: cleanId, status: 'ACTIVE' })
      .first();

    if (!row) return null;
    return this.getMeetingByClassId(row.class_id);
  },

  async deleteMeetingByClassId(classId) {
    const meetingIds = await db('zoom_meetings').where({ class_id: classId }).pluck('id');
    if (meetingIds.length > 0) {
      await db('zoom_alt_hosts').whereIn('meeting_id', meetingIds).del().catch(() => {});
      await db('zoom_registrants').whereIn('zoom_meeting_row_id', meetingIds).del().catch(() => {});
    }
    await db('timetable_lessons').where({ class_id: classId }).update({ zoom_meeting_id: null });
    return await db('zoom_meetings').where({ class_id: classId }).delete();
  },

  async deleteAllMeetings() {
    await db('zoom_alt_hosts').del().catch(() => {});
    await db('zoom_registrants').del().catch(() => {});
    await db('timetable_lessons').update({ zoom_meeting_id: null });
    return await db('zoom_meetings').delete();
  },

  async getMeetingById(id) {
    const row = await db('zoom_meetings').where({ id }).first();
    if (!row) return null;

    const hostKey = row.config_notes
      ? row.config_notes.match(/(?:host\s*key|host\s*pin|key|pin)[:\s=]*([0-9]{6})/i)?.[1] || '884422'
      : '884422';

    return {
      ...row,
      joinUrl: decryptAesGcm(row.join_url_enc),
      passcode: row.passcode_enc ? decryptAesGcm(row.passcode_enc) : '',
      startUrl: row.start_url_enc ? decryptAesGcm(row.start_url_enc) : null,
      hostKey,
      hostEmail: row.host_email,
      hostName: row.host_name
    };
  },

  async configureClassMeeting({
    classId,
    zoomMeetingId,
    zoomMeetingUuid,
    topic,
    joinUrl,
    passcode,
    startUrl,
    hostZoomUserId,
    hostEmail,
    hostName,
    accountId,
    concurrencySlot,
    hostMode = 'ALT_HOST',
    configNotes,
    reason = 'Classroom host configuration',
    createdBy
  }) {
    return await db.transaction(async (trx) => {
      // 1. Check existing active meeting for this class
      const existing = await trx('zoom_meetings')
        .where({ class_id: classId, status: 'ACTIVE' })
        .first();

      const finalHostUserId = hostZoomUserId || existing?.host_zoom_user_id || `zoom_host_class_${classId}`;
      const finalHostEmail = hostEmail || existing?.host_email || `zoom.class${classId}@school.pk`;
      const finalHostName = hostName || existing?.host_name || `Class ${classId} Dedicated Licensed Host`;
      const finalSlot = concurrencySlot || existing?.concurrency_slot || classId;

      // If existing meeting has the same meeting ID, update it in-place
      if (existing && String(existing.zoom_meeting_id).trim() === String(zoomMeetingId).trim()) {
        await trx('zoom_meetings')
          .where({ id: existing.id })
          .update({
            topic: topic || existing.topic,
            join_url_enc: encryptAesGcm(joinUrl),
            passcode_enc: passcode ? encryptAesGcm(passcode) : null,
            start_url_enc: startUrl ? encryptAesGcm(startUrl) : null,
            host_zoom_user_id: finalHostUserId,
            host_email: finalHostEmail,
            host_name: finalHostName,
            account_id: accountId !== undefined ? accountId : existing.account_id,
            concurrency_slot: finalSlot,
            host_mode: hostMode,
            config_notes: configNotes || existing.config_notes,
            last_health_status: 'HEALTHY',
            last_health_check_at: trx.fn.now(3)
          });
        return existing.id;
      }

      // If replacing with a new meeting ID, retire existing active meeting first so active_class_id becomes NULL
      if (existing) {
        await trx('zoom_meetings')
          .where({ id: existing.id })
          .update({
            status: 'REPLACED',
            retire_reason: reason,
            retired_at: trx.fn.now(3)
          });
      }

      // 2. Insert new active meeting
      const [newId] = await trx('zoom_meetings').insert({
        class_id: classId,
        zoom_meeting_id: zoomMeetingId,
        zoom_meeting_uuid: zoomMeetingUuid || null,
        topic: topic || `Class ${classId} Official Live Classroom`,
        join_url_enc: encryptAesGcm(joinUrl),
        passcode_enc: passcode ? encryptAesGcm(passcode) : null,
        start_url_enc: startUrl ? encryptAesGcm(startUrl) : null,
        host_zoom_user_id: finalHostUserId,
        host_email: finalHostEmail,
        host_name: finalHostName,
        account_id: accountId || null,
        concurrency_slot: finalSlot,
        host_mode: hostMode,
        config_notes: configNotes || 'Persistent Zoom room configured with Join-Before-Host (JBH) enabled.',
        status: 'ACTIVE',
        last_health_status: 'HEALTHY',
        last_health_check_at: trx.fn.now(3),
        created_by: createdBy || 1
      });

      if (existing) {
        await trx('zoom_meetings')
          .where({ id: existing.id })
          .update({
            replaced_by_id: newId
          });
      }

      // Re-link any upcoming SCHEDULED lessons for today/future
      await trx('timetable_lessons')
        .where({ class_id: classId })
        .whereIn('status', ['SCHEDULED', 'STARTING_SOON'])
        .update({
          zoom_meeting_id: newId
        });

      return newId;
    });
  },

  async updateMeetingHealth(classId, status, notes = null) {
    return await db('zoom_meetings')
      .where({ class_id: classId, status: 'ACTIVE' })
      .update({
        last_health_status: status,
        last_health_check_at: db.fn.now(3),
        ...(notes ? { config_notes: notes } : {})
      });
  },

  async recordWebhookVerification(classId) {
    return await db('zoom_meetings')
      .where({ class_id: classId, status: 'ACTIVE' })
      .update({
        webhook_verified_at: db.fn.now(3),
        last_webhook_event_at: db.fn.now(3)
      });
  },

  async recordWebhookReceivedForMeeting(zoomMeetingId) {
    if (!zoomMeetingId) return;
    return await db('zoom_meetings')
      .where({ zoom_meeting_id: zoomMeetingId, status: 'ACTIVE' })
      .update({
        last_webhook_event_at: db.fn.now(3)
      });
  },

  async getMeetingRenewalHistory(classId) {
    const rows = await db('zoom_meetings')
      .leftJoin('users', 'zoom_meetings.created_by', 'users.id')
      .where({ 'zoom_meetings.class_id': classId, 'zoom_meetings.status': 'REPLACED' })
      .select(
        'zoom_meetings.id',
        'zoom_meetings.zoom_meeting_id as previousMeetingId',
        'zoom_meetings.retired_at as renewedAt',
        'zoom_meetings.retire_reason as reason',
        'zoom_meetings.replaced_by_id as replacedById',
        'users.full_name as renewedBy'
      )
      .orderBy('zoom_meetings.retired_at', 'desc');

    return rows.map((r) => ({
      id: String(r.id),
      previousMeetingId: r.previousMeetingId,
      newMeetingId: r.replacedById ? String(r.replacedById) : 'Current',
      renewedAt: r.renewedAt ? new Date(r.renewedAt).toISOString() : new Date().toISOString(),
      renewedBy: r.renewedBy || 'Principal',
      reason: r.reason || 'Rotated link'
    }));
  },

  async createOrReplaceMeeting(params) {
    return this.configureClassMeeting(params);
  },

  async logParticipant({
    lessonId,
    zoomMeetingId,
    source = 'PORTAL',
    userId,
    zoomUserId,
    participantName,
    participantEmail,
    role = 'UNKNOWN',
    verificationStatus = 'UNVERIFIED',
    verificationReason,
    meetingUuid = null,
    participantUuid = null,
    registrantId = null,
    identityMethod = null,
    joinedAt,
    leftAt,
    durationSeconds
  }) {
    const [id] = await db('zoom_participant_log').insert({
      lesson_id: lessonId || null,
      zoom_meeting_id: zoomMeetingId,
      source,
      user_id: userId || null,
      zoom_user_id: zoomUserId || null,
      participant_name: participantName || null,
      participant_email: participantEmail || null,
      role,
      verification_status: verificationStatus,
      verification_reason: verificationReason || null,
      meeting_uuid: meetingUuid || null,
      participant_uuid: participantUuid || null,
      registrant_id: registrantId || null,
      identity_method: identityMethod || null,
      joined_at: joinedAt || null,
      left_at: leftAt || null,
      duration_seconds: durationSeconds || null
    });
    return id;
  },

  async closeParticipantOpenInterval({ lessonId, userId, zoomUserId, participantUuid, registrantId, leaveTime, durationSeconds }) {
    let q = db('zoom_participant_log')
      .where({ lesson_id: lessonId })
      .whereNull('left_at');

    if (participantUuid) {
      q = q.andWhere({ participant_uuid: participantUuid });
    } else if (registrantId) {
      q = q.andWhere({ registrant_id: registrantId });
    } else if (userId) {
      q = q.andWhere((qb) => {
        qb.where({ user_id: userId })
          .orWhereIn('user_id', db('teachers').select('user_id').where('id', userId));
      });
    } else if (zoomUserId) {
      q = q.andWhere({ zoom_user_id: zoomUserId });
    }

    const targetLeaveTime = leaveTime || new Date();
    const updated = await q.update({
      left_at: targetLeaveTime,
      duration_seconds: durationSeconds || db.raw('TIMESTAMPDIFF(SECOND, joined_at, ?)', [targetLeaveTime])
    });

    return updated;
  },

  async getParticipantLogsForLesson(lessonId) {
    return await db('zoom_participant_log')
      .where({ lesson_id: lessonId })
      .orderBy('joined_at', 'asc');
  },

  async logWebhookEvent({ eventHash, eventType, zoomMeetingId, lessonId, accountId, meetingUuid = null, signatureVerified = 1, payload, errorMessage = null }) {
    const [id] = await db('zoom_events').insert({
      event_hash: eventHash,
      event_type: eventType,
      zoom_meeting_id: zoomMeetingId,
      lesson_id: lessonId || null,
      account_id: accountId || null,
      meeting_uuid: meetingUuid || null,
      signature_verified: signatureVerified ? 1 : 0,
      payload: JSON.stringify(payload),
      received_at: db.fn.now(3),
      process_status: errorMessage ? 'FAILED' : 'PROCESSED',
      error_message: errorMessage || null
    });
    return id;
  },

  async hasEventBeenProcessed(eventHash) {
    if (!eventHash) return false;
    const existing = await db('zoom_events').where({ event_hash: eventHash }).first();
    return Boolean(existing);
  },

  async getAttendanceReviews({ status = null, limit = 50 } = {}) {
    let q = db('zoom_participant_log')
      .leftJoin('timetable_lessons', 'zoom_participant_log.lesson_id', 'timetable_lessons.id')
      .leftJoin('classes', 'timetable_lessons.class_id', 'classes.id')
      .leftJoin('subjects', 'timetable_lessons.subject_id', 'subjects.id')
      .leftJoin('users as teachers_users', 'zoom_participant_log.user_id', 'teachers_users.id')
      .leftJoin('users as reviewers', 'zoom_participant_log.reviewed_by', 'reviewers.id')
      .select(
        'zoom_participant_log.id',
        'zoom_participant_log.lesson_id as lessonId',
        'zoom_participant_log.zoom_meeting_id as zoomMeetingId',
        'zoom_participant_log.participant_name as participantName',
        'zoom_participant_log.participant_email as participantEmail',
        'zoom_participant_log.role',
        'zoom_participant_log.verification_status as verificationStatus',
        'zoom_participant_log.verification_reason as verificationReason',
        'zoom_participant_log.identity_method as identityMethod',
        'zoom_participant_log.joined_at as joinedAt',
        'zoom_participant_log.left_at as leftAt',
        'zoom_participant_log.duration_seconds as durationSeconds',
        'zoom_participant_log.review_note as reviewNote',
        'zoom_participant_log.reviewed_at as reviewedAt',
        'reviewers.full_name as reviewerName',
        'classes.name as className',
        'classes.grade_level as classNumber',
        'subjects.name as subjectName',
        'timetable_lessons.start_at as scheduledStart',
        'timetable_lessons.end_at as scheduledEnd',
        'timetable_lessons.status as lessonStatus',
        'teachers_users.full_name as matchedTeacherName'
      )
      .orderBy('zoom_participant_log.id', 'desc')
      .limit(limit);

    if (status) {
      q = q.where('zoom_participant_log.verification_status', status);
    } else {
      q = q.whereIn('zoom_participant_log.verification_status', ['REQUIRES_REVIEW', 'FLAGGED']);
    }

    return await q;
  },

  async resolveAttendanceReview({ logId, decision, reviewerUserId, reviewNote }) {
    return await db.transaction(async (trx) => {
      const log = await trx('zoom_participant_log').where({ id: logId }).first();
      if (!log) {
        throw new AppError('Participant log record not found', 404, ErrorCodes.NOT_FOUND);
      }

      const nextStatus = decision === 'APPROVE' ? 'VERIFIED' : 'REJECTED';
      await trx('zoom_participant_log')
        .where({ id: logId })
        .update({
          verification_status: nextStatus,
          reviewed_by: reviewerUserId || null,
          reviewed_at: trx.fn.now(3),
          review_note: reviewNote || `Principal marked as ${nextStatus}`
        });

      if (log.lesson_id) {
        const lesson = await trx('timetable_lessons').where({ id: log.lesson_id }).first();
        if (lesson) {
          const logs = await trx('zoom_participant_log')
            .where({ lesson_id: log.lesson_id })
            .orderBy('joined_at', 'asc');

          const { calculateLessonVerifiedDuty } = await import('../../shared/utils/dutyCalculation.js');
          const duty = calculateLessonVerifiedDuty({ lesson, participantLogs: logs });

          await trx('timetable_lessons')
            .where({ id: log.lesson_id })
            .update({
              verified_duty_minutes: duty.verifiedMinutes,
              attendance_verification_status: duty.verificationStatus,
              verification_notes: reviewNote || `Resolved via Principal review (${nextStatus}).`
            });
        }
      }

      return await trx('zoom_participant_log').where({ id: logId }).first();
    });
  },

  async storeRegistrant({ zoomMeetingRowId, userId, role = 'TEACHER', zoomRegistrantId, joinUrl }) {
    const { encryptAesGcm } = await import('../../shared/crypto/aes.js');
    const existing = await db('zoom_registrants')
      .where({ zoom_meeting_row_id: zoomMeetingRowId, user_id: userId })
      .first();

    if (existing) {
      await db('zoom_registrants')
        .where({ id: existing.id })
        .update({
          zoom_registrant_id: zoomRegistrantId,
          join_url_enc: encryptAesGcm(joinUrl),
          role
        });
      return existing.id;
    }

    const [id] = await db('zoom_registrants').insert({
      zoom_meeting_row_id: zoomMeetingRowId,
      user_id: userId,
      role,
      zoom_registrant_id: zoomRegistrantId,
      join_url_enc: encryptAesGcm(joinUrl)
    });
    return id;
  },

  async getRegistrantJoinUrl(zoomMeetingRowId, userId) {
    const row = await db('zoom_registrants')
      .where({ zoom_meeting_row_id: zoomMeetingRowId, user_id: userId })
      .first();
    if (!row) return null;
    try {
      const { decryptAesGcm } = await import('../../shared/crypto/aes.js');
      return decryptAesGcm(row.join_url_enc);
    } catch {
      return null;
    }
  },

  /**
   * Persists or updates an authoritative teacher duty session in teacher_duty_sessions ledger.
   */
  async upsertTeacherDutySession({
    teacherId,
    classId,
    lessonId,
    periodOccurrenceId,
    zoomMeetingId,
    meetingInstanceUuid = null,
    sessionStart,
    sessionEnd = null,
    totalVerifiedMinutes = 0,
    payableMinutes = 0,
    sessionStatus = 'IN_PROGRESS',
    reconciliationStatus = 'NOT_RECONCILED',
    sourceEventRef = null,
    auditNote = null
  }) {
    return await db.transaction(async (trx) => {
      const existing = await trx('teacher_duty_sessions')
        .where({ teacher_id: teacherId, lesson_id: lessonId })
        .first();

      let sourceRefs = [];
      if (existing?.source_event_refs) {
        try {
          sourceRefs = typeof existing.source_event_refs === 'string'
            ? JSON.parse(existing.source_event_refs)
            : existing.source_event_refs;
        } catch {
          sourceRefs = [];
        }
      }
      if (sourceEventRef && !sourceRefs.includes(sourceEventRef)) {
        sourceRefs.push(sourceEventRef);
      }

      if (existing) {
        await trx('teacher_duty_sessions')
          .where({ id: existing.id })
          .update({
            session_end: sessionEnd || existing.session_end,
            total_verified_minutes: totalVerifiedMinutes,
            payable_minutes: payableMinutes,
            session_status: sessionStatus,
            reconciliation_status: reconciliationStatus,
            meeting_instance_uuid: meetingInstanceUuid || existing.meeting_instance_uuid,
            source_event_refs: JSON.stringify(sourceRefs),
            audit_note: auditNote || existing.audit_note,
            updated_at: trx.fn.now(3)
          });
        return existing.id;
      }

      const [id] = await trx('teacher_duty_sessions').insert({
        teacher_id: teacherId,
        class_id: classId,
        lesson_id: lessonId,
        period_occurrence_id: periodOccurrenceId || `period_${classId}_${lessonId}`,
        zoom_meeting_id: zoomMeetingId,
        meeting_instance_uuid: meetingInstanceUuid,
        session_start: sessionStart,
        session_end: sessionEnd,
        total_verified_minutes: totalVerifiedMinutes,
        payable_minutes: payableMinutes,
        session_status: sessionStatus,
        reconciliation_status: reconciliationStatus,
        source_event_refs: JSON.stringify(sourceRefs),
        audit_note: auditNote,
        created_at: trx.fn.now(3),
        updated_at: trx.fn.now(3)
      });
      return id;
    });
  },

  async getTeacherDutySessionByLesson(teacherId, lessonId) {
    return await db('teacher_duty_sessions')
      .where({ teacher_id: teacherId, lesson_id: lessonId })
      .first();
  },

  async getTeacherDutySessions({ teacherId, startDate = null, endDate = null, status = null } = {}) {
    let q = db('teacher_duty_sessions')
      .join('timetable_lessons', 'teacher_duty_sessions.lesson_id', 'timetable_lessons.id')
      .join('classes', 'teacher_duty_sessions.class_id', 'classes.id')
      .join('subjects', 'timetable_lessons.subject_id', 'subjects.id')
      .join('teachers', 'teacher_duty_sessions.teacher_id', 'teachers.id')
      .join('users', 'teachers.user_id', 'users.id')
      .select(
        'teacher_duty_sessions.*',
        'classes.name as className',
        'classes.grade_level as classNumber',
        'subjects.name as subjectName',
        'users.full_name as teacherName',
        'timetable_lessons.lesson_date as lessonDate',
        'timetable_lessons.start_at as scheduledStart',
        'timetable_lessons.end_at as scheduledEnd'
      )
      .orderBy('teacher_duty_sessions.session_start', 'desc');

    if (teacherId) q = q.where('teacher_duty_sessions.teacher_id', teacherId);
    if (startDate) q = q.where('timetable_lessons.lesson_date', '>=', startDate);
    if (endDate) q = q.where('timetable_lessons.lesson_date', '<=', endDate);
    if (status) q = q.where('teacher_duty_sessions.session_status', status);

    return await q;
  },

  /**
   * Retrieves active participants in a Zoom meeting whose connection interval is currently open (left_at IS NULL).
   */
  async findCurrentlyConnectedParticipantsInMeeting(zoomMeetingId) {
    if (!zoomMeetingId) return [];
    return await db('zoom_participant_log')
      .where({ zoom_meeting_id: zoomMeetingId })
      .whereNull('left_at')
      .andWhere('joined_at', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000)) // within last 24 hours
      .orderBy('joined_at', 'desc');
  },

  /**
   * Records or updates student attendance from verified Zoom presence.
   */
  async recordStudentAttendanceFromZoom({
    lessonId,
    studentId,
    status = 'PRESENT',
    source = 'WEBHOOK',
    firstJoinedAt = null,
    lastLeftAt = null,
    verifiedMinutes = 0,
    markedByUserId,
    remarks = 'Verified Zoom classroom attendance'
  }) {
    return await db.transaction(async (trx) => {
      let resolvedUserId = markedByUserId;
      if (resolvedUserId) {
        const userExists = await trx('users').where({ id: resolvedUserId }).first();
        if (!userExists) {
          const teacher = await trx('teachers').where({ id: resolvedUserId }).first();
          if (teacher?.user_id) {
            resolvedUserId = teacher.user_id;
          } else {
            const fallbackUser = await trx('users').whereIn('role_id', [1, 2, 3]).first();
            resolvedUserId = fallbackUser?.id || 1;
          }
        }
      } else {
        const fallbackUser = await trx('users').whereIn('role_id', [1, 2, 3]).first();
        resolvedUserId = fallbackUser?.id || 1;
      }

      const existing = await trx('lesson_attendance')
        .where({ lesson_id: lessonId, student_id: studentId })
        .first();

      if (existing) {
        await trx('lesson_attendance')
          .where({ id: existing.id })
          .update({
            status: existing.status === 'EXCUSED' ? 'EXCUSED' : status,
            source,
            first_joined_at: existing.first_joined_at || firstJoinedAt,
            last_left_at: lastLeftAt || existing.last_left_at,
            verified_minutes: Math.max(Number(existing.verified_minutes || 0), Number(verifiedMinutes || 0)),
            remarks: remarks || existing.remarks,
            updated_at: trx.fn.now(3)
          });
      } else {
        await trx('lesson_attendance').insert({
          lesson_id: lessonId,
          student_id: studentId,
          status,
          source,
          first_joined_at: firstJoinedAt,
          last_left_at: lastLeftAt,
          verified_minutes: verifiedMinutes,
          marked_by_user_id: resolvedUserId,
          remarks,
          created_at: trx.fn.now(3),
          updated_at: trx.fn.now(3)
        });
      }

      // Recompute and update attendance submission summary counts
      const counts = await trx('lesson_attendance')
        .where({ lesson_id: lessonId })
        .groupBy('status')
        .select('status', trx.raw('COUNT(*) as count'));

      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let excusedCount = 0;
      for (const row of counts) {
        if (row.status === 'PRESENT') presentCount = Number(row.count);
        if (row.status === 'ABSENT') absentCount = Number(row.count);
        if (row.status === 'LATE') lateCount = Number(row.count);
        if (row.status === 'EXCUSED') excusedCount = Number(row.count);
      }

      const lesson = await trx('timetable_lessons').where({ id: lessonId }).first();
      const totalEnrolled = lesson ? (await trx('students').where({ current_class_id: lesson.class_id, status: 'ACTIVE' }).count('id as cnt'))[0].cnt : 0;

      const sub = await trx('lesson_attendance_submissions').where({ lesson_id: lessonId }).first();
      if (sub) {
        await trx('lesson_attendance_submissions').where({ id: sub.id }).update({
          present_count: presentCount,
          absent_count: absentCount,
          late_count: lateCount,
          excused_count: excusedCount,
          total_enrolled: Number(totalEnrolled) || presentCount + absentCount + lateCount + excusedCount
        });
      } else {
        await trx('lesson_attendance_submissions').insert({
          lesson_id: lessonId,
          submitted_by_user_id: resolvedUserId,
          submitted_at: trx.fn.now(3),
          is_locked: false,
          present_count: presentCount,
          absent_count: absentCount,
          late_count: lateCount,
          excused_count: excusedCount,
          total_enrolled: Number(totalEnrolled) || presentCount + absentCount + lateCount + excusedCount
        });
      }
    });
  }
};

