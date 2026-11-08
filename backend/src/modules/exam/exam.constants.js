export const EXAM_TYPES = ['TERMINAL', 'ANNUAL', 'MID_TERM', 'MOCK'];

export const SCHEDULING_MODES = {
  DEDICATED_EXAM: 'DEDICATED_EXAM',
  TIMETABLE_ASSESSMENT: 'TIMETABLE_ASSESSMENT'
};

export const EXAM_STATUS = {
  DRAFT: 'DRAFT',
  SCHEDULED: 'SCHEDULED',
  ONGOING: 'ONGOING',
  MARKING: 'MARKING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

export const PAPER_STATUS = {
  SCHEDULED: 'SCHEDULED',
  CONDUCTED: 'CONDUCTED',
  MARKS_SUBMITTED: 'MARKS_SUBMITTED',
  VERIFIED: 'VERIFIED',
  LOCKED: 'LOCKED'
};

export const MARK_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  VERIFIED: 'VERIFIED',
  LOCKED: 'LOCKED'
};

export const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  SUBMIT: 'SUBMIT',
  VERIFY: 'VERIFY',
  LOCK: 'LOCK',
  OVERRIDE: 'OVERRIDE'
};

export const DEFAULT_PASSING_PERCENTAGE = 40;
export const DEFAULT_PASSING_MARKS = 40;

export const CAMBRIDGE_GRADE_SCALE = [
  { grade: 'A*', minPct: 90 },
  { grade: 'A', minPct: 80 },
  { grade: 'B', minPct: 70 },
  { grade: 'C', minPct: 60 },
  { grade: 'D', minPct: 50 },
  { grade: 'E', minPct: 40 },
  { grade: 'U', minPct: 0 }
];

