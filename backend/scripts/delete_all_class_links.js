import { db } from '../src/shared/db/knex.js';
import { zoomRepository } from '../src/modules/zoom/zoom.repository.js';
import { emitRealtimeEvent, RealtimeEvents } from '../src/shared/realtime/eventEmitter.js';

async function main() {
  console.log('--- DELETING ALL CLASS ZOOM LINKS FROM DATABASE ---');
  
  // Inspect before count
  const beforeCount = await db('zoom_meetings').count('id as c').first();
  console.log(`Current zoom_meetings in database: ${beforeCount.c}`);

  // Perform clean cascade delete
  const deletedCount = await zoomRepository.deleteAllMeetings();
  console.log(`Deleted rows from zoom_meetings: ${deletedCount}`);

  // Verify timetable_lessons have zoom_meeting_id cleared
  const activeLinkedLessons = await db('timetable_lessons').whereNotNull('zoom_meeting_id').count('id as c').first();
  console.log(`Remaining timetable_lessons referencing zoom_meeting_id: ${activeLinkedLessons.c}`);

  // Insert audit record
  await db('audit_logs').insert({
    actor_id: 1,
    actor_name: 'Principal / Admin',
    actor_role: 'PRINCIPAL',
    action: 'ZOOM_CLASSROOMS_ALL_DELETED',
    record_type: 'Zoom Meeting',
    record_identifier: 'ALL',
    reason: `All classroom Zoom links wiped from database per administrator request. Ready for new links.`,
    created_at: db.fn.now(3)
  });

  // Emit realtime notification so Principal, Teacher, and Student portals update live
  emitRealtimeEvent(RealtimeEvents.CLASS_STATUS_UPDATED, { action: 'ZOOM_CLASSROOMS_ALL_DELETED' });

  // Final check
  const afterCount = await db('zoom_meetings').count('id as c').first();
  console.log(`Final zoom_meetings count in database: ${afterCount.c}`);
  console.log('SUCCESS: All class links have been deleted from the database!');

  process.exit(0);
}

main().catch(err => {
  console.error('Error deleting class links:', err);
  process.exit(1);
});
