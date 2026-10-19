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
        'zoom_meetings.host_zoom_user_id as hostZoomUserId',
        'zoom_meetings.host_mode as hostMode',
        'zoom_meetings.status',
        'zoom_meetings.last_health_status as lastHealthStatus',
        'zoom_meetings.last_health_check_at as lastHealthCheckAt',
        'zoom_meetings.last_used_at as lastUsedAt'
      )
      .orderBy('classes.grade_level', 'asc');

    return rows;
  },

  async getMeetingByClassId(classId) {
    const row = await db('zoom_meetings')
      .where({ class_id: classId, status: 'ACTIVE' })
      .first();

    if (!row) return null;

    return {
      ...row,
      joinUrl: decryptAesGcm(row.join_url_enc),
      passcode: decryptAesGcm(row.passcode_enc),
      startUrl: row.start_url_enc ? decryptAesGcm(row.start_url_enc) : null
    };
  },

  async getMeetingById(id) {
    const row = await db('zoom_meetings').where({ id }).first();
    if (!row) return null;

    return {
      ...row,
      joinUrl: decryptAesGcm(row.join_url_enc),
      passcode: decryptAesGcm(row.passcode_enc),
      startUrl: row.start_url_enc ? decryptAesGcm(row.start_url_enc) : null
    };
  },

  async createOrReplaceMeeting({
    classId,
    zoomMeetingId,
    zoomMeetingUuid,
    topic,
    joinUrl,
    passcode,
    startUrl,
    hostZoomUserId,
    hostMode = 'ALT_HOST',
    createdBy
  }) {
    return await db.transaction(async (trx) => {
      // 1. Mark existing active meeting for this class as REPLACED
      const existing = await trx('zoom_meetings')
        .where({ class_id: classId, status: 'ACTIVE' })
        .first();

      let replacedById = null;

      // 2. Insert new active meeting
      const [newId] = await trx('zoom_meetings').insert({
        class_id: classId,
        zoom_meeting_id: zoomMeetingId,
        zoom_meeting_uuid: zoomMeetingUuid || null,
        topic,
        join_url_enc: encryptAesGcm(joinUrl),
        passcode_enc: passcode ? encryptAesGcm(passcode) : null,
        start_url_enc: startUrl ? encryptAesGcm(startUrl) : null,
        host_zoom_user_id: hostZoomUserId,
        host_mode: hostMode,
        status: 'ACTIVE',
        last_health_status: 'HEALTHY',
        last_health_check_at: trx.fn.now(3),
        created_by: createdBy
      });

      if (existing) {
        await trx('zoom_meetings')
          .where({ id: existing.id })
          .update({
            status: 'REPLACED',
            replaced_by_id: newId,
            retire_reason: 'Renewed / replaced with new class link',
            retired_at: trx.fn.now(3)
          });
      }

      return newId;
    });
  },

  async logParticipant({ lessonId, zoomMeetingId, source = 'PORTAL', userId, participantName, participantEmail, joinedAt }) {
    const [id] = await db('zoom_participant_log').insert({
      lesson_id: lessonId || null,
      zoom_meeting_id: zoomMeetingId,
      source,
      user_id: userId || null,
      participant_name: participantName || null,
      participant_email: participantEmail || null,
      joined_at: joinedAt || db.fn.now(3)
    });
    return id;
  },

  async logWebhookEvent({ eventHash, eventType, zoomMeetingId, lessonId, payload }) {
    const [id] = await db('zoom_events').insert({
      event_hash: eventHash,
      event_type: eventType,
      zoom_meeting_id: zoomMeetingId,
      lesson_id: lessonId || null,
      payload: JSON.stringify(payload),
      received_at: db.fn.now(3),
      process_status: 'PROCESSED'
    });
    return id;
  }
};
