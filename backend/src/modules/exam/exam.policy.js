import { CAMBRIDGE_GRADE_SCALE } from './exam.constants.js';

export function round2(n) {
  if (n === null || n === undefined || isNaN(n)) return null;
  return Math.round(Number(n) * 100) / 100;
}

export function computeGrade(percentage) {
  if (percentage === null || percentage === undefined || isNaN(percentage)) return null;
  const pct = Number(percentage);
  for (const item of CAMBRIDGE_GRADE_SCALE) {
    if (pct >= item.minPct) {
      return item.grade;
    }
  }
  return 'U';
}

export function evaluatePaperMarks({
  theoryObtained,
  practicalObtained,
  maxTheory,
  maxPractical,
  passingMarks,
  isAbsent = false,
  isExempt = false,
  absentPolicy = 'FAIL'
}) {
  const totalMax = Number(maxTheory || 0) + Number(maxPractical || 0);
  if (totalMax === 0) {
    return {
      totalObtained: null,
      percentage: null,
      grade: null,
      isPassed: null
    };
  }

  if (isExempt) {
    return {
      totalObtained: null,
      percentage: null,
      grade: 'EXEMPT',
      isPassed: 1
    };
  }

  if (isAbsent) {
    if (absentPolicy === 'EXCLUDE') {
      return {
        totalObtained: null,
        percentage: null,
        grade: 'ABSENT',
        isPassed: null
      };
    }
    return {
      totalObtained: 0,
      percentage: 0,
      grade: 'U',
      isPassed: 0
    };
  }

  const theory = Math.max(0, Math.min(Number(theoryObtained || 0), Number(maxTheory || 0)));
  const practical = Math.max(0, Math.min(Number(practicalObtained || 0), Number(maxPractical || 0)));
  const totalObtained = round2(theory + practical);
  const percentage = round2((totalObtained / totalMax) * 100);
  const grade = computeGrade(percentage);
  const passThreshold = passingMarks !== undefined ? Number(passingMarks) : (totalMax * 0.4);
  const isPassed = totalObtained >= passThreshold ? 1 : 0;

  return {
    totalObtained,
    percentage,
    grade,
    isPassed
  };
}

export function evaluateOverallExamStatus({
  totalMarks,
  obtainedMarks,
  failedCount,
  absentCount,
  policy
}) {
  if (totalMarks <= 0) {
    return {
      percentage: null,
      overallGrade: null,
      passStatus: 'PENDING'
    };
  }

  const percentage = round2((obtainedMarks / totalMarks) * 100);
  const overallGrade = computeGrade(percentage);

  const minOverallPct = policy?.min_overall_percentage !== undefined ? Number(policy.min_overall_percentage) : 40;
  const maxFailedAllowed = policy?.max_failed_subjects !== undefined ? Number(policy.max_failed_subjects) : 0;
  const suppAllowed = Boolean(policy?.supplementary_allowed);
  const maxSuppAllowed = policy?.max_supplementary_subjects !== undefined ? Number(policy.max_supplementary_subjects) : 1;
  const absentPolicy = policy?.absent_policy || 'FAIL';

  if (absentCount > 0 && absentPolicy === 'FAIL') {
    return { percentage, overallGrade, passStatus: 'FAILED' };
  }

  const failsOverall = percentage < minOverallPct;

  if (!failsOverall && failedCount <= maxFailedAllowed) {
    return { percentage, overallGrade, passStatus: 'PASSED' };
  }

  if (suppAllowed && failedCount > 0 && failedCount <= maxSuppAllowed) {
    return { percentage, overallGrade, passStatus: 'SUPPLEMENTARY' };
  }

  return { percentage, overallGrade, passStatus: 'FAILED' };
}

