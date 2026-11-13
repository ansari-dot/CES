/**
 * Academic Chat DLP (Data Loss Prevention): contact-number privacy filter.
 *
 * Runs on the server BEFORE a message is stored or broadcast, so the original number never
 * reaches the database, WebSocket payloads, previews or notifications.
 *
 * Detection works on candidate spans made of digits and spelled-out digits ("zero three oh …")
 * joined by common separators (spaces, - . ( ) [ ] / _ ,), and then classifies each span:
 *   - Pakistani mobile (03xx…, 923xx…, 00923xx…, +92 3xx…) ..................... blocked
 *   - International number with + or 00 prefix (10-15 digits) ................... blocked
 *   - Pakistani landline (0 + area code, 10-11 digits) .......................... blocked
 *   - Any other 10-15 digit span grouped like a phone number (≤ 5 groups,
 *     digit-by-digit spacing, or spelled-out digits) ........................... blocked
 *   - 7-9 digit span only when a contact keyword is nearby ("WhatsApp", "call",
 *     "number", "contact", …) ................................................... blocked
 * Allowed (academic content): decimals (3.14159…), dates (2026-11-16, 16/11/2026), lists of
 * marks ("85 90 78 92 88"), arithmetic ("12345 + 67890 = 80235"), short codes and roll numbers.
 *
 * Configuration (environment, all optional):
 *   CHAT_DLP_ENABLED        true|false   (default true)
 *   CHAT_DLP_ACTION         MASK|BLOCK   (default MASK: number replaced, message delivered)
 *   CHAT_DLP_MIN_DIGITS     generic threshold for unprefixed numbers (default 10)
 *   CHAT_DLP_KEYWORD_DIGITS threshold when a contact keyword is present (default 7)
 */

export const DLP_POLICY_MESSAGE = 'Contact number sharing is not allowed in school chat.';
export const DLP_MASK = '[contact number removed]';

const settings = () => ({
  enabled: String(process.env.CHAT_DLP_ENABLED ?? 'true').toLowerCase() !== 'false',
  action: String(process.env.CHAT_DLP_ACTION || 'MASK').toUpperCase() === 'BLOCK' ? 'BLOCK' : 'MASK',
  minDigits: Math.max(8, Number(process.env.CHAT_DLP_MIN_DIGITS) || 10),
  keywordDigits: Math.max(6, Number(process.env.CHAT_DLP_KEYWORD_DIGITS) || 7)
});

const WORD_DIGITS = {
  zero: '0', oh: '0', o: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9'
};

// A unit is a single digit or a whole spelled-out digit word
const UNIT = '(?:\\d|\\b(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)\\b)';
const SEP = '[\\s\\-.()\\[\\]_/,]*';
const CANDIDATE_REGEX = new RegExp(`(?:(?:\\+|\\b00)\\s*)?\\(?${UNIT}(?:${SEP}${UNIT}){5,}\\)?`, 'gi');

const CONTACT_KEYWORDS = /\b(whats\s?app|wa|call|phone|ph|mobile|mob|cell|contact|number|num|no\.?|dial|text\s+me|msg|message\s+me|reach\s+me|ring|sms|telegram|signal|imo|viber)\b/i;
// Strong signals that a number is a phone number even if an academic word is nearby
const STRONG_CONTACT_KEYWORDS = /\b(whats\s?app|call|phone|mobile|cell|dial|text\s+me|reach\s+me|sms|telegram|signal|imo|viber)\b/i;
// Academic identifiers: a short number right after these is a roll no., code, page, etc.
const ACADEMIC_IDENTIFIERS = /\b(roll|admission|adm|reg(istration)?|id|code|page|question|q|chapter|exercise|ex|marks?|score|class|section|ref(erence)?|challan|invoice|consumer|receipt|serial|isbn|year)\b[^\n]{0,15}$/i;

const DATE_PATTERNS = [/\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/g, /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g];

function toDigits(span) {
  return span
    .toLowerCase()
    .replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g, (w) => WORD_DIGITS[w])
    .replace(/\D/g, '');
}

function groupsOf(span) {
  return span
    .toLowerCase()
    .replace(/^\s*(\+|00)/, '')
    .split(/[\s\-.()\[\]_/,]+/)
    .filter(Boolean);
}

/**
 * Decide whether a candidate span is personal contact information.
 * @returns {string|null} violation kind or null when it is ordinary content
 */
export function classifyCandidate(span, context = {}) {
  const cfg = settings();
  const trimmed = span.trim();
  const digits = toDigits(trimmed);
  const hasWords = /[a-z]/i.test(trimmed);
  const hasPrefix = /^\(?\s*(\+|00)/.test(trimmed);
  const groups = groupsOf(trimmed);

  if (digits.length < 6) return null;

  // Decimal numbers such as 3.14159265358979
  if (!hasWords && /^\d+\.\d+$/.test(trimmed)) return null;

  // Spans that are only dates (2026-11-16, 16/11/2026 ...)
  let withoutDates = trimmed;
  for (const re of DATE_PATTERNS) withoutDates = withoutDates.replace(re, ' ');
  if (toDigits(withoutDates).length < 6) return null;

  // Pakistani mobile numbers
  if (/^(0092|92|0)?3\d{9}$/.test(digits) && (digits.length >= 11 || /^3\d{9}$/.test(digits))) {
    return 'PK_MOBILE';
  }
  // International numbers with an explicit + / 00 prefix
  if (hasPrefix && digits.length >= 10 && digits.length <= 15) return 'INTERNATIONAL';
  // Pakistani landlines: 0 + area code (e.g. 042-35123456, 051 2345678)
  if (/^0[2-9]\d{8,9}$/.test(digits)) return 'PK_LANDLINE';

  const allSingle = groups.length >= 7 && groups.every((g) => g.length === 1 || WORD_DIGITS[g] !== undefined);
  const phoneLikeGrouping = groups.length <= 5 || allSingle || hasWords;

  // A roll / admission / challan number right after its label is not contact information
  const textBefore = context.before ?? '';
  const fullContext = `${textBefore} ${context.after ?? ''}`;
  const academicIdentifier = !hasWords && ACADEMIC_IDENTIFIERS.test(textBefore) && !STRONG_CONTACT_KEYWORDS.test(fullContext);

  if (digits.length >= cfg.minDigits && digits.length <= 15 && phoneLikeGrouping && !academicIdentifier) return 'PHONE_NUMBER';

  // Shorter numbers only count when the text is clearly about contact details
  if (digits.length >= cfg.keywordDigits && digits.length <= 15 && (groups.length <= 3 || allSingle || hasWords)) {
    if (!academicIdentifier && CONTACT_KEYWORDS.test(fullContext)) return 'PHONE_NUMBER_WITH_CONTEXT';
  }

  return null;
}

/**
 * Inspects message content and replaces personal contact numbers.
 *
 * @param {string} rawContent
 * @returns {{ cleanContent: string, hasViolation: boolean, violationType: string|null, action: 'MASK'|'BLOCK', policyMessage: string|null }}
 */
export function sanitizeChatMessage(rawContent) {
  const cfg = settings();
  if (!rawContent || typeof rawContent !== 'string') {
    return { cleanContent: '', hasViolation: false, violationType: null, action: cfg.action, policyMessage: null };
  }
  if (!cfg.enabled) {
    return { cleanContent: rawContent, hasViolation: false, violationType: null, action: cfg.action, policyMessage: null };
  }

  // Letter-for-digit bypass ("03oo12345l7"): treat o/O and l/I touching digits as digits.
  // One-to-one character swap, so offsets in `scan` map exactly onto `rawContent`.
  let scan = rawContent;
  for (let i = 0; i < 2; i++) {
    scan = scan.replace(/(?<=\d)[oO]|[oO](?=\d)/g, '0').replace(/(?<=\d)[lI]|[lI](?=\d)/g, '1');
  }

  const kinds = new Set();
  const spans = [];
  for (const m of scan.matchAll(CANDIDATE_REGEX)) {
    const match = m[0];
    const offset = m.index;
    // Keep arithmetic intact: a span directly touching an operator is part of a calculation
    const before = scan.slice(Math.max(0, offset - 2), offset);
    const after = scan.slice(offset + match.length, offset + match.length + 2);
    if (/[*×÷=<>%^]\s*$/.test(before) || /^\s*[*×÷=<>%^+x]\s/.test(after) || (/\d\s*[-+]\s*$/.test(before) && !/^\s*\+/.test(match))) {
      continue;
    }
    const kind = classifyCandidate(match, {
      before: scan.slice(Math.max(0, offset - 40), offset),
      after: scan.slice(offset + match.length, offset + match.length + 20)
    });
    if (!kind) continue;
    kinds.add(kind);
    // keep surrounding whitespace so the sentence still reads naturally
    const lead = match.match(/^\s*/)[0].length;
    const trail = match.match(/\s*$/)[0].length;
    spans.push([offset + lead, offset + match.length - trail]);
  }

  let clean = rawContent;
  for (const [start, end] of spans.reverse()) {
    clean = `${clean.slice(0, start)}${DLP_MASK}${clean.slice(end)}`;
  }

  const hasViolation = kinds.size > 0;
  return {
    cleanContent: hasViolation ? clean : rawContent,
    hasViolation,
    violationType: hasViolation ? 'PHONE_NUMBER_SHARING' : null,
    detectedKinds: Array.from(kinds),
    action: cfg.action,
    policyMessage: hasViolation ? DLP_POLICY_MESSAGE : null
  };
}
