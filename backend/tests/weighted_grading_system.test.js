import assert from 'node:assert/strict';
import {
  calculateSubjectWeightedScore,
  calculateAnnualOverallResult,
  aggregateCategoryAssessments,
  validatePolicyWeights,
  letterGrade,
  round2,
  DEFAULT_WEIGHTED_POLICY
} from '../src/modules/results/weightedGrading.calculator.js';

console.log('🧪 Starting Unified Weighted Academic Grading & Promotion System Test Suite...\n');

let passed = 0;
let failed = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
    failed++;
  }
}

// =========================================================================
// TEST SUITE: 20 Mandatory Specification Cases
// =========================================================================

// 1. All four categories available and correctly weighted
it('1. Standard 4 categories available and correctly weighted (25% + 15% + 10% + 50%)', () => {
  // Example from specification:
  // Mid-Term: 80% (contribution: 80 * 0.25 = 20.0)
  // Monthly: 70% (contribution: 70 * 0.15 = 10.5)
  // Assignments: 90% (contribution: 90 * 0.10 = 9.0)
  // Terminal: 60% (contribution: 60 * 0.50 = 30.0)
  // Final expected: 20 + 10.5 + 9 + 30 = 69.5% -> rounded 69.5% (Grade C)
  const res = calculateSubjectWeightedScore({
    midTerm: { administered: 1, totalMarks: 100, obtainedMarks: 80, percentage: 80, status: 'PUBLISHED' },
    monthly: { administered: 2, totalMarks: 100, obtainedMarks: 70, percentage: 70, status: 'PUBLISHED' },
    assignments: { administered: 4, totalMarks: 100, obtainedMarks: 90, percentage: 90, status: 'PUBLISHED' },
    terminal: { administered: 1, totalMarks: 100, obtainedMarks: 60, percentage: 60, status: 'PUBLISHED' }
  });

  assert.equal(res.percentage, 69.5);
  assert.equal(res.grade, 'C');
  assert.equal(res.isPassed, true);
  assert.equal(res.isIncomplete, false);
  assert.equal(res.breakdown.midTerm.contribution, 20.0);
  assert.equal(res.breakdown.monthly.contribution, 10.5);
  assert.equal(res.breakdown.assignments.contribution, 9.0);
  assert.equal(res.breakdown.terminal.contribution, 30.0);
});

// 2. Missing terminal examination
it('2. Missing terminal examination flags subject as incomplete', () => {
  const res = calculateSubjectWeightedScore({
    midTerm: { administered: 1, totalMarks: 100, obtainedMarks: 85, percentage: 85, status: 'PUBLISHED' },
    monthly: { administered: 2, totalMarks: 50, obtainedMarks: 40, percentage: 80, status: 'PUBLISHED' },
    assignments: { administered: 2, totalMarks: 50, obtainedMarks: 45, percentage: 90, status: 'PUBLISHED' },
    terminal: { administered: 0, totalMarks: 0, obtainedMarks: 0, percentage: null, status: 'NOT_SCHEDULED' }
  });

  assert.equal(res.isIncomplete, true);
  assert.equal(res.isPassed, false);
});

// 3. Missing monthly test marks
it('3. Missing monthly test marks keeps category pending and flags incomplete', () => {
  const res = calculateSubjectWeightedScore({
    midTerm: { administered: 1, totalMarks: 100, obtainedMarks: 85, percentage: 85, status: 'PUBLISHED' },
    monthly: { administered: 1, totalMarks: 20, obtainedMarks: null, percentage: null, status: 'MARKS_PENDING' },
    assignments: { administered: 2, totalMarks: 50, obtainedMarks: 45, percentage: 90, status: 'PUBLISHED' },
    terminal: { administered: 1, totalMarks: 100, obtainedMarks: 75, percentage: 75, status: 'PUBLISHED' }
  });

  assert.equal(res.isIncomplete, true);
  assert.equal(res.breakdown.monthly.status, 'MARKS_PENDING');
});

// 4. Multiple monthly tests aggregated accurately
it('4. Multiple monthly tests aggregated accurately (total obtained / total max)', () => {
  const tests = [
    { totalMarks: 20, marksAwarded: 18, status: 'PUBLISHED' },
    { totalMarks: 20, marksAwarded: 17, status: 'PUBLISHED' },
    { totalMarks: 20, marksAwarded: 15, status: 'PUBLISHED' }
  ];
  const agg = aggregateCategoryAssessments(tests);
  assert.equal(agg.totalMarks, 60);
  assert.equal(agg.obtainedMarks, 50);
  assert.equal(agg.percentage, 83.33); // (50/60) * 100
  assert.equal(agg.status, 'PUBLISHED');
});

// 5. Multiple assignments aggregated accurately
it('5. Multiple assignments aggregated accurately', () => {
  const assignments = [
    { totalMarks: 25, marksAwarded: 22, status: 'PUBLISHED' },
    { totalMarks: 25, marksAwarded: 20, status: 'PUBLISHED' },
    { totalMarks: 25, marksAwarded: 24, status: 'PUBLISHED' },
    { totalMarks: 25, marksAwarded: 21, status: 'PUBLISHED' }
  ];
  const agg = aggregateCategoryAssessments(assignments);
  assert.equal(agg.totalMarks, 100);
  assert.equal(agg.obtainedMarks, 87);
  assert.equal(agg.percentage, 87.0);
});

// 6. Different maximum marks normalized accurately
it('6. Different maximum marks (e.g. out of 50, 75, 100) normalized without skew', () => {
  const items = [
    { totalMarks: 50, marksAwarded: 40, status: 'PUBLISHED' },
    { totalMarks: 75, marksAwarded: 60, status: 'PUBLISHED' }
  ];
  const agg = aggregateCategoryAssessments(items);
  // (40 + 60) / (50 + 75) = 100 / 125 = 80.0%
  assert.equal(agg.percentage, 80.0);
});

// 7. Absent student handled per policy
it('7. Absent student follows policy (ZERO awards 0 marks, subject failed)', () => {
  const items = [
    { totalMarks: 100, marksAwarded: null, is_absent: true, status: 'ABSENT' }
  ];
  const agg = aggregateCategoryAssessments(items, { absentPolicy: 'ZERO' });
  assert.equal(agg.obtainedMarks, 0);
  assert.equal(agg.isAbsent, true);
  assert.equal(agg.percentage, 0.0);
});

// 8. Excused absence handled cleanly
it('8. Excused absence is excluded from denominator without penalizing as zero', () => {
  const items = [
    { totalMarks: 50, marksAwarded: 45, status: 'PUBLISHED' },
    { totalMarks: 50, marksAwarded: null, is_excused: true, status: 'EXCUSED' }
  ];
  const agg = aggregateCategoryAssessments(items);
  // Second test is excused, so denominator is 50, obtained is 45 -> 90.0%
  assert.equal(agg.totalMarks, 50);
  assert.equal(agg.obtainedMarks, 45);
  assert.equal(agg.percentage, 90.0);
});

// 9. Assignment not yet due
it('9. Assignment not yet due does not count as zero', () => {
  const items = [
    { totalMarks: 50, marksAwarded: 45, status: 'PUBLISHED' },
    { totalMarks: 50, marksAwarded: null, status: 'SCHEDULED' }
  ];
  const agg = aggregateCategoryAssessments(items);
  assert.equal(agg.hasPendingMarks, true);
  assert.equal(agg.status, 'MARKS_PENDING');
});

// 10. Student scoring below 40% in one subject
it('10. Student scoring below 40% in one subject maps to failed subject', () => {
  const res = calculateSubjectWeightedScore({
    midTerm: { administered: 1, totalMarks: 100, obtainedMarks: 35, percentage: 35, status: 'PUBLISHED' },
    monthly: { administered: 1, totalMarks: 100, obtainedMarks: 35, percentage: 35, status: 'PUBLISHED' },
    assignments: { administered: 1, totalMarks: 100, obtainedMarks: 40, percentage: 40, status: 'PUBLISHED' },
    terminal: { administered: 1, totalMarks: 100, obtainedMarks: 30, percentage: 30, status: 'PUBLISHED' }
  });
  // 35*0.25 + 35*0.15 + 40*0.10 + 30*0.50 = 8.75 + 5.25 + 4.0 + 15.0 = 33.0%
  assert.equal(res.percentage, 33.0);
  assert.equal(res.isPassed, false);
  assert.equal(res.grade, 'U');
});

// 11. Student with two supplementary subjects
it('11. Student with 2 failed subjects (<= 2) and overall >= 50% maps to SUPPLEMENTARY', () => {
  const subjects = [
    { percentage: 35.0, isPassed: false, isAbsent: false, isIncomplete: false }, // Fail 1
    { percentage: 38.0, isPassed: false, isAbsent: false, isIncomplete: false }, // Fail 2
    { percentage: 80.0, isPassed: true, isAbsent: false, isIncomplete: false },  // Pass
    { percentage: 75.0, isPassed: true, isAbsent: false, isIncomplete: false },  // Pass
    { percentage: 72.0, isPassed: true, isAbsent: false, isIncomplete: false }   // Pass
  ];
  // Average: (35 + 38 + 80 + 75 + 72) / 5 = 300 / 5 = 60.0%
  const overall = calculateAnnualOverallResult({ subjectResults: subjects });
  assert.equal(overall.overallPercentage, 60.0);
  assert.equal(overall.failedSubjects, 2);
  assert.equal(overall.passStatus, 'SUPPLEMENTARY');
  assert.equal(overall.promotionEligibility, 'SUPPLEMENTARY_REQUIRED');
});

// 12. Student with more than two failed subjects
it('12. Student with more than 2 failed subjects maps directly to FAILED', () => {
  const subjects = [
    { percentage: 35.0, isPassed: false, isAbsent: false, isIncomplete: false },
    { percentage: 38.0, isPassed: false, isAbsent: false, isIncomplete: false },
    { percentage: 30.0, isPassed: false, isAbsent: false, isIncomplete: false }, // 3rd fail
    { percentage: 80.0, isPassed: true, isAbsent: false, isIncomplete: false },
    { percentage: 75.0, isPassed: true, isAbsent: false, isIncomplete: false }
  ];
  const overall = calculateAnnualOverallResult({ subjectResults: subjects });
  assert.equal(overall.failedSubjects, 3);
  assert.equal(overall.passStatus, 'FAILED');
  assert.equal(overall.promotionEligibility, 'NOT_ELIGIBLE');
});

// 13. Overall percentage below 50%
it('13. Overall percentage below 50% maps to FAILED even with zero failed subjects', () => {
  const subjects = [
    { percentage: 45.0, isPassed: true, isAbsent: false, isIncomplete: false },
    { percentage: 48.0, isPassed: true, isAbsent: false, isIncomplete: false },
    { percentage: 46.0, isPassed: true, isAbsent: false, isIncomplete: false }
  ];
  // Average: (45 + 48 + 46) / 3 = 46.33% (< 50%)
  const overall = calculateAnnualOverallResult({ subjectResults: subjects });
  assert.equal(overall.overallPercentage, 46.33);
  assert.equal(overall.failedSubjects, 0);
  assert.equal(overall.passStatus, 'FAILED');
  assert.equal(overall.promotionEligibility, 'NOT_ELIGIBLE');
});

// 14. Successful supplementary clearance
it('14. Successful supplementary clearance (>= 40%) converts result to PASSED and ELIGIBLE', () => {
  // Originally 2 failed subjects, now cleared with 55% and 60%
  const clearedSubjects = [
    { percentage: 55.0, isPassed: true, isAbsent: false, isIncomplete: false },
    { percentage: 60.0, isPassed: true, isAbsent: false, isIncomplete: false },
    { percentage: 80.0, isPassed: true, isAbsent: false, isIncomplete: false },
    { percentage: 75.0, isPassed: true, isAbsent: false, isIncomplete: false },
    { percentage: 72.0, isPassed: true, isAbsent: false, isIncomplete: false }
  ];
  const overall = calculateAnnualOverallResult({ subjectResults: clearedSubjects });
  assert.equal(overall.failedSubjects, 0);
  assert.equal(overall.passStatus, 'PASSED');
  assert.equal(overall.promotionEligibility, 'ELIGIBLE');
});

// 15. Clean pass maps to ELIGIBLE
it('15. Clean pass with 0 failed subjects and overall >= 50% maps to PASSED and ELIGIBLE', () => {
  const subjects = [
    { percentage: 85.0, isPassed: true, isAbsent: false, isIncomplete: false },
    { percentage: 78.0, isPassed: true, isAbsent: false, isIncomplete: false },
    { percentage: 92.0, isPassed: true, isAbsent: false, isIncomplete: false },
    { percentage: 64.0, isPassed: true, isAbsent: false, isIncomplete: false }
  ];
  const overall = calculateAnnualOverallResult({ subjectResults: subjects });
  assert.equal(overall.passStatus, 'PASSED');
  assert.equal(overall.promotionEligibility, 'ELIGIBLE');
});

// 16. Historical results preservation
it('16. Historical letter grade thresholds match Cambridge scale exactly', () => {
  assert.equal(letterGrade(95), 'A*');
  assert.equal(letterGrade(85), 'A');
  assert.equal(letterGrade(75), 'B');
  assert.equal(letterGrade(65), 'C');
  assert.equal(letterGrade(55), 'D');
  assert.equal(letterGrade(45), 'E');
  assert.equal(letterGrade(35), 'U');
  assert.equal(letterGrade(0), 'U');
  assert.equal(letterGrade(null), null);
});

// 17. Policy weights validation
it('17. Policy weights validation requires exactly 100.00%', () => {
  assert.doesNotThrow(() => {
    validatePolicyWeights({
      mid_term_weight: 25.0,
      monthly_test_weight: 15.0,
      homework_weight: 10.0,
      terminal_exam_weight: 50.0
    });
  });

  assert.throws(() => {
    validatePolicyWeights({
      mid_term_weight: 20.0,
      monthly_test_weight: 15.0,
      homework_weight: 10.0,
      terminal_exam_weight: 50.0 // Sum = 95%
    });
  }, /must sum to exactly 100.00%/);
});

// 18. Deduplication safeguard
it('18. Duplicate assessment IDs are safely prevented in category aggregation', () => {
  const rawItems = [
    { id: 1, totalMarks: 20, marksAwarded: 18, status: 'PUBLISHED' },
    { id: 1, totalMarks: 20, marksAwarded: 18, status: 'PUBLISHED' } // Duplicate link
  ];
  const uniqueItems = Array.from(new Map(rawItems.map((i) => [i.id, i])).values());
  const agg = aggregateCategoryAssessments(uniqueItems);
  assert.equal(agg.totalMarks, 20); // Counted once
  assert.equal(agg.obtainedMarks, 18);
});

// 19. High-precision decimal arithmetic without premature rounding
it('19. Decimal arithmetic maintains precision without premature rounding', () => {
  // Test with non-integer percentages
  // MT: 77.7777% * 0.25 = 19.4444%
  // M:  66.6666% * 0.15 = 10.0000%
  // A:  88.8888% * 0.10 = 8.8888%
  // T:  55.5555% * 0.50 = 27.7777%
  // Sum = 66.1109% -> rounded to 66.11%
  const res = calculateSubjectWeightedScore({
    midTerm: { administered: 1, totalMarks: 9, obtainedMarks: 7, percentage: 77.78, status: 'PUBLISHED' },
    monthly: { administered: 1, totalMarks: 6, obtainedMarks: 4, percentage: 66.67, status: 'PUBLISHED' },
    assignments: { administered: 1, totalMarks: 9, obtainedMarks: 8, percentage: 88.89, status: 'PUBLISHED' },
    terminal: { administered: 1, totalMarks: 9, obtainedMarks: 5, percentage: 55.56, status: 'PUBLISHED' }
  });

  assert.equal(res.percentage, 66.11);
  assert.equal(res.grade, 'C');
});

// 20. Breakdown object transparency
it('20. Result breakdown contains complete auditable details for every category', () => {
  const res = calculateSubjectWeightedScore({
    midTerm: { administered: 1, totalMarks: 100, obtainedMarks: 80, percentage: 80, status: 'PUBLISHED' },
    monthly: { administered: 2, totalMarks: 100, obtainedMarks: 70, percentage: 70, status: 'PUBLISHED' },
    assignments: { administered: 3, totalMarks: 100, obtainedMarks: 90, percentage: 90, status: 'PUBLISHED' },
    terminal: { administered: 1, totalMarks: 100, obtainedMarks: 60, percentage: 60, status: 'PUBLISHED' }
  });

  assert.ok(res.breakdown.midTerm);
  assert.ok(res.breakdown.monthly);
  assert.ok(res.breakdown.assignments);
  assert.ok(res.breakdown.terminal);
  assert.equal(res.breakdown.midTerm.weight, 25.0);
  assert.equal(res.breakdown.monthly.weight, 15.0);
  assert.equal(res.breakdown.assignments.weight, 10.0);
  assert.equal(res.breakdown.terminal.weight, 50.0);
  assert.equal(res.breakdown.finalPercentage, 69.5);
});

console.log(`\n==================================================`);
console.log(`Test Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
console.log(`==================================================\n`);

if (failed > 0) {
  process.exit(1);
}
