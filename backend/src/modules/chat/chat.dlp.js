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
 *   - Any other phone-like span of 7-15 digits, with or without words around it
 *     (7-9 digits: at most 3 groups; 10-15 digits: at most 5 groups; digit-by-digit
 *     spacing and spelled-out digits always count) .............................. masked
 * Allowed (academic content): decimals (3.14159…), dates (2026-11-16, 16/11/2026), years
 * (1947 2026), lists of marks ("85 90 78 92 88"), arithmetic ("12345 + 67890 = 80235",
 * "multiply 123456789 by 9"), money ("Rs. 1500000", "1,500,000"), and numbers right after
 * a roll / admission / challan / page label. Mobile and international numbers are masked
 * regardless of any label.
 *
 * Masking: every digit of a detected number becomes "*" (e.g. 0300-1234567 -> ****-*******).
 *
 * Configuration (environment, all optional):
 *   CHAT_DLP_ENABLED        true|false   (default true)
 *   CHAT_DLP_ACTION         MASK|BLOCK   (default MASK: number hidden, message delivered)
 *   CHAT_DLP_MIN_DIGITS     smallest digit count treated as a phone number (default 7)
 */

export const DLP_POLICY_MESSAGE = 'Contact number sharing is not allowed in school chat.';

const settings = () => ({
  enabled: String(process.env.CHAT_DLP_ENABLED ?? 'true').toLowerCase() !== 'false',
  action: String(process.env.CHAT_DLP_ACTION || 'MASK').toUpperCase() === 'BLOCK' ? 'BLOCK' : 'MASK',
  minDigits: Math.min(10, Math.max(6, Number(process.env.CHAT_DLP_MIN_DIGITS) || 7))
});

/** Hide every digit (and spelled-out digit) of a detected number with "*". */
function maskSpan(span) {
  return span
    .replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/gi, '*')
    .replace(/\d/g, '*');
}

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
const MONEY_BEFORE = /\b(rs\.?|pkr|rupees?|usd|\$|£|amount|fee|fees|salary|price|cost|budget|total)\s*:?\s*$/i;
const MONEY_AFTER = /^\s*(rs\b|pkr|rupees?|dollars?|usd|\/-|%|percent|kg|km|meters?|grams?|litres?|liters?|marks|points)/i;
const MATH_WORDS = /\b(multiply|multiplied|divide|divided|add|subtract|sum|product|calculate|solve|answer|equals?|result|square|cube|root|factor(ial)?|prime)\b[^\n]{0,20}$/i;
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
  const phoneLikeGrouping =
    allSingle || hasWords || (digits.length <= 9 ? groups.length <= 3 : groups.length <= 5);

  const textBefore = context.before ?? '';
  const textAfter = context.after ?? '';
  const fullContext = `${textBefore} ${textAfter}`;
  const strongContact = STRONG_CONTACT_KEYWORDS.test(fullContext);

  if (!hasWords && !strongContact) {
    // A roll / admission / challan / page number right after its label
    if (ACADEMIC_IDENTIFIERS.test(textBefore)) return null;
    // Money: "Rs. 1500000", "1500000 rupees", "1,500,000"
    if (/^\d{1,3}(,\d{3})+$/.test(trimmed) || MONEY_BEFORE.test(textBefore) || MONEY_AFTER.test(textAfter)) return null;
    // Years written together: "1947 2026"
    if (groups.length >= 2 && groups.every((g) => /^(19|20)\d{2}$/.test(g))) return null;
    // Maths in words: "multiply 123456789 by 9", "sum of ...", "answer is ..."
    if (MATH_WORDS.test(textBefore) || /^\s*(by|times|plus|minus|into)\b/i.test(textAfter)) return null;
  }

  if (digits.length >= cfg.minDigits && digits.length <= 15 && phoneLikeGrouping) {
    return CONTACT_KEYWORDS.test(fullContext) ? 'PHONE_NUMBER_WITH_CONTEXT' : 'PHONE_NUMBER';
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

  // Replace digits with "*" (taken from `scan`, so o/l substitutions are hidden too)
  let clean = rawContent;
  for (const [start, end] of spans.reverse()) {
    clean = `${clean.slice(0, start)}${maskSpan(scan.slice(start, end))}${clean.slice(end)}`;
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
