import { Router } from 'express';
import { calendarController } from './calendar.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';

const router = Router();

// Everyone authenticated can view calendar overview, holidays, and active popup announcements
router.get('/active-announcement', authenticate, calendarController.getActiveAnnouncement);
router.get('/overview', authenticate, calendarController.getCalendarOverview);
router.get('/holidays', authenticate, calendarController.getHolidays);
// Full year calendar events (all types)
router.get('/events', authenticate, calendarController.getEvents);
router.get('/events/upcoming', authenticate, calendarController.getUpcomingEvents);

// Principal and Admin can declare, update and remove holiday breaks
router.post('/holidays', authenticate, authorize('academic.setup.manage'), calendarController.createHoliday);
router.put('/holidays/:id', authenticate, authorize('academic.setup.manage'), calendarController.updateHoliday);
router.delete('/holidays/:id', authenticate, authorize('academic.setup.manage'), calendarController.deleteHoliday);

// Full calendar event CRUD (extended types: examinations, school events, parent meetings, etc.)
router.post('/events/check-conflicts', authenticate, authorize('academic.setup.manage'), calendarController.checkConflicts);
router.post('/events', authenticate, authorize('academic.setup.manage'), calendarController.createEvent);
router.put('/events/:id', authenticate, authorize('academic.setup.manage'), calendarController.updateEvent);
router.delete('/events/:id', authenticate, authorize('academic.setup.manage'), calendarController.deleteEvent);

export default router;

