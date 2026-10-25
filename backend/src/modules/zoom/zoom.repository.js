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
        'zoom_meetings.host_mode as hostMode',
        'zoom_meetings.status',
        'zoom_meetings.last_health_status as lastHealthStatus',
        'zoom_meetings.last_health_check_at as lastHealthCheckAt',
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

      const hostKey = row.configNotes ? (row.configNotes.match(/(?:host\s*key|host\s*pin|key|pin)[:\s=]*([0-9]{6})/i)?.[1] || '884422') : '884422';
      const accountEmail = row.configNotes ? (row.configNotes.match(/(?:account|email)[:\s=]*([^\s,;]+@[^\s,;]+|[^\s,;]+)/i)?.[1] || `Class ${row.classNumber} Zoom Pro`) : `Class ${row.classNumber} Zoom Pro`;

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
        accountEmail,
        hostMode: row.hostMode,
        status: row.status,
        lastHealthStatus: row.lastHealthStatus,
        lastHealthCheckAt: row.lastHealthCheckAt,
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

    const hostKey = row.config_notes ? (row.config_notes.match(/(?:host\s*key|host\s*pin|key|pin)[:\s=]*([0-9]{6})/i)?.[1] || '884422') : '884422';
    const accountEmail = row.config_notes ? (row.config_notes.match(/(?:account|email)[:\s=]*([^\s,;]+@[^\s,;]+|[^\s,;]+)/i)?.[1] || `Class ${row.class_id} Zoom Pro`) : `Class ${row.class_id} Zoom Pro`;

    return {
      ...row,
      joinUrl,
      passcode,
      startUrl,
      hostKey,
      accountEmail
    };
  },

  async deleteMeetingByClassId(classId) {
    await db('timetable_lessons').where({ class_id: classId }).update({ zoom_meeting_id: null });
    return await db('zoom_meetings').where({ class_id: classId }).delete();
  },

  async getMeetingById(id) {
    const row = await db('zoom_meetings').where({ id }).first();
    if (!row) return null;

    const hostKey = row.config_notes ? (row.config_notes.match(/(?:host\s*key|host\s*pin|key|pin)[:\s=]*([0-9]{6})/i)?.[1] || '884422') : '884422';

    return {
      ...row,
      joinUrl: decryptAesGcm(row.join_url_enc),
      passcode: row.passcode_enc ? decryptAesGcm(row.passcode_enc) : '',
      startUrl: row.start_url_enc ? decryptAesGcm(row.start_url_enc) : null,
      hostKey
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
    hostZoomUserId = 'zoom_admin_principal',
    hostMode = 'ALT_HOST',
    configNotes,
    reason = 'Initial permanent configuration',
    createdBy
  }) {
    return await db.transaction(async (trx) => {
      // 1. Check existing active meeting for this class
      const existing = await trx('zoom_meetings')
        .where({ class_id: classId, status: 'ACTIVE' })
        .first();

      // If existing meeting has the same meeting ID, update it in-place
      if (existing && String(existing.zoom_meeting_id).trim() === String(zoomMeetingId).trim()) {
        await trx('zoom_meetings')
          .where({ id: existing.id })
          .update({
            topic: topic || existing.topic,
            join_url_enc: encryptAesGcm(joinUrl),
            passcode_enc: passcode ? encryptAesGcm(passcode) : null,
            start_url_enc: startUrl ? encryptAesGcm(startUrl) : null,
            host_zoom_user_id: hostZoomUserId,
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
        host_zoom_user_id: hostZoomUserId,
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
