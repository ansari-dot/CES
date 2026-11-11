/**
 * Academic Chat DLP (Data Loss Prevention) Engine
 *
 * Strict policy enforcement against sharing personal telephone / mobile numbers
 * between students and teachers.
 *
 * Normalizes obfuscated patterns (spaces, dots, brackets, dashes) while protecting
 * legitimate academic text (roll numbers, exercise references, fractions, simple math).
 */

// Matches Pakistani mobile numbers (03XXXXXXXXX, +923XXXXXXXXX, 00923XXXXXXXXX)
// with arbitrary whitespace, hyphens, brackets, dots between digits.
const PAK_PHONE_REGEX = /(?:\+92|0092|92|0)[\s.-]*3[\s.-]*[0-9][\s.-]*[0-9][\s.-]*[0-9][\s.-]*[0-9][\s.-]*[0-9][\s.-]*[0-9][\s.-]*[0-9][\s.-]*[0-9][\s.-]*[0-9]/gi;

// Matches international phone numbers (+1..., +44..., +971...) with 9-15 digits
const INTL_PHONE_REGEX = /\b(?:\+|00)[1-9][0-9]{0,2}[\s.-]*(?:\([0-9]{1,4}\)[\s.-]*)?[0-9]{3,4}[\s.-]*[0-9]{3,4}(?:[\s.-]*[0-9]{1,4})?\b/gi;

// Matches continuous 10-14 digit sequences (often sent as a raw number string or with single spaces)
const RAW_DIGITS_SEQUENCE_REGEX = /\b(?:\d[\s.-]*){10,14}\b/g;

/**
 * Checks if a candidate digit sequence looks like an academic expression rather than a phone number
 * e.g., "Page 120", "2026-11-11", "100 / 50 = 2"
 */
function isAcademicNumberContext(matchedStr, surroundingText) {
  // If it's a date like 2026-11-11 or 11/11/2026
  if (/^\d{4}[-/.]\d{2}[-/.]\d{2}$/.test(matchedStr.trim()) || /^\d{2}[-/.]\d{2}[-/.]\d{4}$/.test(matchedStr.trim())) {
    return true;
  }
  // If it contains math operators
  if (/[+*/=><%]/.test(matchedStr)) {
    return true;
  }
  return false;
}

/**
 * Inspects message content and masks any personal telephone numbers with ***.
 *
 * @param {string} rawContent - The message input
 * @returns {{ cleanContent: string, hasViolation: boolean, violationType: string | null }}
 */
export function sanitizeChatMessage(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') {
    return { cleanContent: '', hasViolation: false, violationType: null };
  }

  let text = rawContent;
  let violationDetected = false;

  // 1. Check Pakistani mobile numbers (most critical institutional policy)
  text = text.replace(PAK_PHONE_REGEX, (match) => {
    if (isAcademicNumberContext(match, rawContent)) return match;
    violationDetected = true;
    return '***-*******';
  });

  // 2. Check international phone numbers
  text = text.replace(INTL_PHONE_REGEX, (match) => {
    if (isAcademicNumberContext(match, rawContent)) return match;
    violationDetected = true;
    return '***-*******';
  });

  // 3. Check raw 10-14 digit sequence
  text = text.replace(RAW_DIGITS_SEQUENCE_REGEX, (match) => {
    const digitsOnly = match.replace(/\D/g, '');
    if (digitsOnly.length >= 10 && digitsOnly.length <= 14) {
      if (isAcademicNumberContext(match, rawContent)) return match;
      violationDetected = true;
      return '***-*******';
    }
    return match;
  });

  return {
    cleanContent: text,
    hasViolation: violationDetected,
    violationType: violationDetected ? 'PHONE_NUMBER_SHARING' : null
  };
}

