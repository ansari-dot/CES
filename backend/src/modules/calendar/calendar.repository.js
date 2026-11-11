import { db } from '../../shared/db/knex.js';

export const calendarRepository = {
  async getHolidays({ sessionId = null, year = null, month = null, startDate = null, endDate = null } = {}) {
    let query = db('academic_holidays')
      .leftJoin('users', 'academic_holidays.created_by', 'users.id')
      .select(
        'academic_holidays.*',
        'users.full_name as createdByName',
        'users.email as createdByEmail'
      )
      .orderBy('academic_holidays.start_date', 'asc');

    if (sessionId) {
      query = query.where('academic_holidays.session_id', sessionId);
    }

    if (startDate && endDate) {
      query = query.where((q) => {
        q.whereBetween('academic_holidays.start_date', [startDate, endDate])
          .orWhereBetween('academic_holidays.end_date', [startDate, endDate])
          .orWhere((inner) => {
            inner.where('academic_holidays.start_date', '<=', startDate)
              .andWhere('academic_holidays.end_date', '>=', endDate);
          });
      });
    } else if (year && month) {
      const monthPadded = String(month).padStart(2, '0');
      const startOfMonth = `${year}-${monthPadded}-01`;
      // calculate last day of month
      const lastDay = new Date(year, month, 0).getDate();
      const endOfMonth = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;

      query = query.where((q) => {
        q.whereBetween('academic_holidays.start_date', [startOfMonth, endOfMonth])
          .orWhereBetween('academic_holidays.end_date', [startOfMonth, endOfMonth])
          .orWhere((inner) => {
            inner.where('academic_holidays.start_date', '<=', startOfMonth)
              .andWhere('academic_holidays.end_date', '>=', endOfMonth);
          });
      });
    }

    return await query;
  },

  async getHolidayById(id) {
    return await db('academic_holidays').where({ id }).first();
  },

  async isDateHoliday(sessionId, dateString) {
    let query = db('academic_holidays')
      .whereRaw('DATE(?) BETWEEN DATE(start_date) AND DATE(end_date)', [dateString]);

    if (sessionId) {
      query = query.where('session_id', sessionId);
    }

    return await query.first();
  },

  async createHoliday(data) {
    const [id] = await db('academic_holidays').insert(data);
    return id;
  },

  async updateHoliday(id, data) {
    await db('academic_holidays').where({ id }).update({
      ...data,
      updated_at: db.fn.now()
    });
    return await this.getHolidayById(id);
  },

  async deleteHoliday(id) {
    return await db('academic_holidays').where({ id }).delete();
  },

  /**
   * Cancel all scheduled timetable lessons falling in the holiday date window
   */
  async cancelScheduledLessonsForHoliday({ startDate, endDate, title }) {
    const updatedCount = await db('timetable_lessons')
      .where('status', 'SCHEDULED')
      .whereRaw('DATE(lesson_date) BETWEEN DATE(?) AND DATE(?)', [startDate, endDate])
      .update({
        status: 'CANCELLED',
        cancel_reason: `Holiday Break: ${title}`,
        updated_at: db.fn.now()
      });

    return updatedCount;
  },

  /**
   * Get terms inside an academic session
   */
  async getTermsBySession(sessionId) {
    const hasTable = await db.schema.hasTable('academic_terms');
    if (!hasTable) return [];
    return await db('academic_terms').where({ session_id: sessionId }).orderBy('start_date', 'asc');
  },

  /**
   * Get lesson counts by date for a given month
   */
  async getLessonCountsByMonth(year, month) {
    const monthPadded = String(month).padStart(2, '0');
    const startOfMonth = `${year}-${monthPadded}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endOfMonth = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;

    const rows = await db('timetable_lessons')
      .whereRaw('DATE(lesson_date) BETWEEN DATE(?) AND DATE(?)', [startOfMonth, endOfMonth])
      .groupByRaw('DATE(lesson_date)')
      .select(
        db.raw('DATE(lesson_date) as date'),
        db.raw("SUM(CASE WHEN status = 'SCHEDULED' THEN 1 ELSE 0 END) as scheduledCount"),
        db.raw("SUM(CASE WHEN status = 'LIVE' THEN 1 ELSE 0 END) as liveCount"),
        db.raw("SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completedCount"),
        db.raw("SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelledCount"),
        db.raw('COUNT(*) as totalLessons')
      );

    return rows;
  }
};

