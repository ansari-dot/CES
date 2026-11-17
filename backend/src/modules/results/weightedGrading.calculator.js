/**
 * Unified Weighted Academic Grading Calculator
 * 
 * Implements the official 4-category annual assessment distribution:
 * - Mid-Term Examination: 25% (0.25)
 * - Monthly Tests:        15% (0.15)
 * - Tasks / Assignments:  10% (0.10)
 * - Terminal Examination: 50% (0.50)
 * Total:                 100% (1.00)
 * 
 * Formula:
 * Final Subject % = (MT% × 0.25) + (M% × 0.15) + (A% × 0.10) + (T% × 0.50)
 */

export const DEFAULT_WEIGHTED_POLICY = {
  mid_term_weight: 25.0,
  monthly_test_weight: 15.0,
  homework_weight: 10.0, // Tasks / Assignments
  terminal_exam_weight: 50.0,
  include_quizzes_in_assignments: true,
  min_overall_percentage: 50.0,
  min_subject_percentage: 40.0,
  max_failed_subjects: 0,
  supplementary_allowed: true,
  max_supplementary_subjects: 2,
  absent_policy: 'ZERO' // 'ZERO' | 'FAIL' | 'EXCLUDE'
};

export const CAMBRIDGE_GRADE_SCALE = [
  { grade: 'A*', minPct: 90.0 },
  { grade: 'A', minPct: 80.0 },
  { grade: 'B', minPct: 70.0 },
  { grade: 'C', minPct: 60.0 },
  { grade: 'D', minPct: 50.0 },
  { grade: 'E', minPct: 40.0 },
  { grade: 'U', minPct: 0.0 }
];

export function letterGrade(pct) {
  if (pct === null || pct === undefined || Number.isNaN(Number(pct))) return null;
  const numeric = Number(pct);
  for (const threshold of CAMBRIDGE_GRADE_SCALE) {
    if (numeric >= threshold.minPct) return threshold.grade;
  }
  return 'U';
}

export function round2(num) {
  if (num === null || num === undefined || Number.isNaN(Number(num))) return null;
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

export function validatePolicyWeights(policy) {
  const mt = Number(policy.mid_term_weight || 0);
  const m = Number(policy.monthly_test_weight || 0);
  const a = Number(policy.homework_weight ?? policy.assignment_weight ?? 0);
  const t = Number(policy.terminal_exam_weight || 0);
  const q = Number(policy.quiz_weight || 0); // Legacy check

  const sum = round2(mt + m + a + t + q);
  if (sum !== 100.0) {
    throw new Error(`Grading policy weights must sum to exactly 100.00% (got ${sum}%)`);
  }
  return true;
}

/**
 * Calculates category aggregate stats from a list of assessments belonging to that category.
 */
export function aggregateCategoryAssessments(items = [], { absentPolicy = 'ZERO' } = {}) {
  if (!items || items.length === 0) {
    return {
      administered: 0,
      totalMarks: 0,
      obtainedMarks: 0,
      percentage: null,
      status: 'NOT_SCHEDULED',
      hasPendingMarks: false,
      isAbsent: false,
      isExcused: false
    };
  }

  let totalMarksSum = 0;
  let obtainedMarksSum = 0;
  let hasPendingMarks = false;
  let allAbsent = true;
  let allExcused = true;
  let hasAnyGrades = false;

  for (const item of items) {
    // Check completion status
    const status = String(item.status || item.attempt_status || item.submission_status || '').toUpperCase();
    const isItemAbsent = Boolean(item.is_absent || item.isAbsent || status === 'ABSENT');
    const isItemExcused = Boolean(item.is_excused || item.isExcused || status === 'EXCUSED');

    if (!isItemAbsent) allAbsent = false;
    if (!isItemExcused) allExcused = false;

    if (isItemExcused) {
      // Excused: excluded from denominator so student is not penalized
      continue;
    }

    const total = Number(item.total_marks || item.totalMarks || item.taskTotal || 0);
    totalMarksSum += total;

    let obtained = item.obtained_marks ?? item.obtained_score ?? item.marks_awarded ?? item.marksAwarded ?? null;

    if (isItemAbsent) {
      if (absentPolicy === 'EXCLUDE') {
        // Excluded: deduct this paper's max marks from totalMarksSum
        totalMarksSum -= total;
        continue;
      }
      obtained = 0; // ZERO and FAIL policies both award 0 marks
    }

    if (obtained === null || obtained === undefined || obtained === '') {
      hasPendingMarks = true;
    } else {
      hasAnyGrades = true;
      obtainedMarksSum += Number(obtained);
    }
  }

  let percentage = null;
  if (totalMarksSum > 0 && (hasAnyGrades || allAbsent)) {
    percentage = round2((obtainedMarksSum / totalMarksSum) * 100);
  }

  let categoryStatus = 'PUBLISHED';
  if (allExcused && items.length > 0) categoryStatus = 'EXCUSED';
  else if (allAbsent && items.length > 0) categoryStatus = 'ABSENT';
  else if (hasPendingMarks) categoryStatus = 'MARKS_PENDING';
  else if (items.length === 0) categoryStatus = 'NOT_SCHEDULED';

  return {
    administered: items.length,
    totalMarks: round2(totalMarksSum),
    obtainedMarks: round2(obtainedMarksSum),
    percentage,
    status: categoryStatus,
    hasPendingMarks,
    isAbsent: allAbsent && items.length > 0,
    isExcused: allExcused && items.length > 0
  };
}

/**
 * Computes unified weighted subject score from the 4 assessment categories.
 * 
 * F = (MT * 0.25) + (M * 0.15) + (A * 0.10) + (T * 0.50)
 */
export function calculateSubjectWeightedScore({
  midTerm = null,
  monthly = null,
  assignments = null,
  terminal = null,
  policy = DEFAULT_WEIGHTED_POLICY,
  passingPolicy = DEFAULT_WEIGHTED_POLICY
}) {
  const mtWeight = Number(policy.mid_term_weight ?? 25.0);
  const mWeight = Number(policy.monthly_test_weight ?? 15.0);
  const aWeight = Number(policy.homework_weight ?? policy.assignment_weight ?? 10.0);
  const tWeight = Number(policy.terminal_exam_weight ?? 50.0);

  const mt = midTerm || { administered: 0, totalMarks: 0, obtainedMarks: 0, percentage: null, status: 'NOT_SCHEDULED' };
  const m = monthly || { administered: 0, totalMarks: 0, obtainedMarks: 0, percentage: null, status: 'NOT_SCHEDULED' };
  const a = assignments || { administered: 0, totalMarks: 0, obtainedMarks: 0, percentage: null, status: 'NOT_SCHEDULED' };
  const t = terminal || { administered: 0, totalMarks: 0, obtainedMarks: 0, percentage: null, status: 'NOT_SCHEDULED' };

  // Calculate contributions
  const mtContrib = mt.percentage !== null ? (mt.percentage * (mtWeight / 100)) : 0;
  const mContrib = m.percentage !== null ? (m.percentage * (mWeight / 100)) : 0;
  const aContrib = a.percentage !== null ? (a.percentage * (aWeight / 100)) : 0;
  const tContrib = t.percentage !== null ? (t.percentage * (tWeight / 100)) : 0;

  // Final subject percentage: direct weighted sum
  const finalSubjectPercentage = round2(mtContrib + mContrib + aContrib + tContrib);

  // Check completion & incomplete state
  const isRequiredCategoryMissing =
    mt.status === 'MARKS_PENDING' ||
    m.status === 'MARKS_PENDING' ||
    a.status === 'MARKS_PENDING' ||
    t.status === 'MARKS_PENDING' ||
    t.status === 'NOT_SCHEDULED'; // Terminal exam must exist

  const minSubjectPct = Number(passingPolicy.min_subject_percentage ?? 40.0);
  const isPassed = !isRequiredCategoryMissing && finalSubjectPercentage !== null && finalSubjectPercentage >= minSubjectPct;

  const isSubjectAbsent = t.isAbsent || (mt.isAbsent && m.isAbsent && a.isAbsent && t.isAbsent);

  return {
    percentage: finalSubjectPercentage,
    grade: letterGrade(finalSubjectPercentage),
    isPassed,
    isIncomplete: isRequiredCategoryMissing,
    isAbsent: isSubjectAbsent,
    breakdown: {
      midTerm: {
        obtained: mt.obtainedMarks,
        total: mt.totalMarks,
        percentage: mt.percentage,
        weight: mtWeight,
        contribution: round2(mtContrib),
        status: mt.status
      },
      monthly: {
        obtained: m.obtainedMarks,
        total: m.totalMarks,
        percentage: m.percentage,
        weight: mWeight,
        contribution: round2(mContrib),
        status: m.status
      },
      assignments: {
        obtained: a.obtainedMarks,
        total: a.totalMarks,
        percentage: a.percentage,
        weight: aWeight,
        contribution: round2(aContrib),
        status: a.status
      },
      terminal: {
        obtained: t.obtainedMarks,
        total: t.totalMarks,
        percentage: t.percentage,
        weight: tWeight,
        contribution: round2(tContrib),
        status: t.status
      },
      finalPercentage: finalSubjectPercentage
    }
  };
}

/**
 * Calculates overall annual percentage and pass/fail/supplementary status for a student.
 */
export function calculateAnnualOverallResult({
  subjectResults = [],
  policy = DEFAULT_WEIGHTED_POLICY
}) {
  if (!subjectResults || subjectResults.length === 0) {
    return {
      totalSubjects: 0,
      gradedSubjects: 0,
      failedSubjects: 0,
      absentSubjects: 0,
      overallPercentage: null,
      overallGrade: null,
      passStatus: 'PENDING',
      resultStatus: 'INCOMPLETE',
      promotionEligibility: 'PENDING_RESULT'
    };
  }

  let totalPercentageSum = 0;
  let gradedSubjects = 0;
  let failedSubjects = 0;
  let absentSubjects = 0;
  let hasIncomplete = false;

  for (const s of subjectResults) {
    if (s.isIncomplete) {
      hasIncomplete = true;
    }
    if (s.isAbsent) {
      absentSubjects += 1;
    }
    if (s.percentage !== null && !s.isIncomplete) {
      gradedSubjects += 1;
      totalPercentageSum += s.percentage;
      if (!s.isPassed) {
        failedSubjects += 1;
      }
    }
  }

  const overallPercentage = gradedSubjects > 0 ? round2(totalPercentageSum / gradedSubjects) : null;
  const overallGrade = letterGrade(overallPercentage);

  const minOverallPct = Number(policy.min_overall_percentage ?? 50.0);
  const maxFailed = Number(policy.max_failed_subjects ?? 0);
  const suppAllowed = Boolean(policy.supplementary_allowed);
  const maxSupp = Number(policy.max_supplementary_subjects ?? 2);
  const absentPolicy = policy.absent_policy || 'ZERO';

  let passStatus = 'PENDING';
  let resultStatus = hasIncomplete ? 'INCOMPLETE' : 'DRAFT';
  let promotionEligibility = 'PENDING_RESULT';

  if (!hasIncomplete && overallPercentage !== null) {
    if (absentSubjects > 0 && absentPolicy === 'FAIL') {
      passStatus = 'FAILED';
      promotionEligibility = 'NOT_ELIGIBLE';
    } else if (overallPercentage >= minOverallPct && failedSubjects <= maxFailed) {
      passStatus = 'PASSED';
      promotionEligibility = 'ELIGIBLE';
    } else if (suppAllowed && failedSubjects > 0 && failedSubjects <= maxSupp) {
      passStatus = 'SUPPLEMENTARY';
      promotionEligibility = 'SUPPLEMENTARY_REQUIRED';
    } else {
      passStatus = 'FAILED';
      promotionEligibility = 'NOT_ELIGIBLE';
    }
  }

  return {
    totalSubjects: subjectResults.length,
    gradedSubjects,
    failedSubjects,
    absentSubjects,
    overallPercentage,
    overallGrade,
    passStatus,
    resultStatus,
    promotionEligibility
  };
}
