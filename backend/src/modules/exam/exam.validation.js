import { z } from 'zod';

export const createExamSchema = {
  body: z.object({
    sessionId: z.coerce.number().int().positive('Academic Session ID must be positive'),
    termId: z.coerce.number().int().positive('Term ID must be positive'),
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(150),
    examType: z.enum(['TERMINAL', 'ANNUAL', 'MID_TERM', 'MOCK']).default('TERMINAL'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD')
  })
};

export const createPaperSchema = {
  body: z.object({
    classId: z.coerce.number().int().positive('Class ID is required'),
    subjectId: z.coerce.number().int().positive('Subject ID is required'),
    dateSheetEntryId: z.coerce.number().int().positive().optional().nullable(),
    paperDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Paper date must be YYYY-MM-DD'),
    startTime: z.string().trim().min(1, 'Start time is required').max(15),
    endTime: z.string().trim().min(1, 'End time is required').max(15),
    maxTheoryMarks: z.coerce.number().min(0).default(100),
    maxPracticalMarks: z.coerce.number().min(0).default(0),
    passingMarks: z.coerce.number().min(0).default(40),
    invigilatorTeacherId: z.coerce.number().int().positive().optional().nullable(),
    markingTeacherId: z.coerce.number().int().positive().optional().nullable()
  })
};

export const submitMarksSchema = {
  body: z.object({
    action: z.enum(['DRAFT', 'SUBMIT']).default('DRAFT'),
    marks: z
      .array(
        z.object({
          studentId: z.coerce.number().int().positive('Student ID is required'),
          theoryObtained: z.coerce.number().min(0).optional().nullable(),
          practicalObtained: z.coerce.number().min(0).optional().nullable(),
          isAbsent: z.boolean().optional().default(false),
          isExempt: z.boolean().optional().default(false),
          teacherRemarks: z.string().max(255).optional().nullable()
        })
      )
      .min(1, 'At least one student mark entry is required')
  })
};

export const calculateResultsSchema = {
  body: z.object({
    classId: z.union([z.coerce.number().int().positive(), z.literal('ALL')]).optional()
  })
};

export const publishExamSchema = {
  body: z.object({
    classId: z.union([z.coerce.number().int().positive(), z.literal('ALL')]).optional()
  })
};

