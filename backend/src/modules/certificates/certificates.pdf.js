/**
 * Certificate PDF renderer (pdfkit).
 *
 * Draws real vector PDFs from a template definition + trusted certificate data.
 * Templates never contain executable markup: the design is chosen from fixed presets
 * (CLASSIC / MODERN / ELEGANT) with configurable colours, optional background/logo/
 * signature images, and a body text that may only use the supported placeholders.
 *
 * Text uses the PDF standard fonts (Times / Helvetica), which cover the Windows-1252
 * character set. Long names and descriptions are shrunk and wrapped to fit their box.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_LOGO_PATH = path.resolve(__dirname, '../../../assets/certificates/school-logo.png');

/** Placeholders the renderer can always populate. */
export const SUPPORTED_PLACEHOLDERS = [
  'school_name',
  'student_name',
  'class_name',
  'achievement_title',
  'achievement_description',
  'issue_date',
  'teacher_name',
  'subject_name',
  'academic_year',
  'certificate_id'
];

const PLACEHOLDER_HINTS = {
  school_logo: 'The school logo is drawn automatically at the top of every certificate.',
  section_name: 'CES classes do not have separate sections; use {{class_name}}.'
};

/** Returns a list of problems with the placeholders used in a body text (empty = valid). */
export function validatePlaceholders(text) {
  const problems = [];
  const tokens = String(text || '').match(/\{\{\s*([^}]*?)\s*\}\}/g) || [];
  for (const token of tokens) {
    const name = token.replace(/[{}\s]/g, '');
    if (!SUPPORTED_PLACEHOLDERS.includes(name)) {
      problems.push(`Unsupported placeholder ${token}.${PLACEHOLDER_HINTS[name] ? ` ${PLACEHOLDER_HINTS[name]}` : ''}`);
    }
  }
  const stray = String(text || '').replace(/\{\{\s*[^}]*?\s*\}\}/g, '');
  if (/\{\{|\}\}/.test(stray)) problems.push('Body text has an unclosed "{{" or "}}".');
  return problems;
}

// Characters the PDF standard fonts can render (Windows-1252).
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
export function unsupportedCharacters(text) {
  const bad = new Set();
  for (const ch of String(text || '')) {
    const c = ch.codePointAt(0);
    const ok = c === 10 || (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI_EXTRA.has(ch);
    if (!ok) bad.add(ch);
  }
  return [...bad];
}

/** Replace characters the standard fonts cannot draw (used only for names stored in the DB). */
function pdfSafe(text) {
  return String(text ?? '')
    .split('')
    .map((ch) => (unsupportedCharacters(ch).length ? '?' : ch))
    .join('');
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function formatIssueDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(iso || '');
}

/** Substitute placeholders; missing optional values collapse cleanly. */
export function fillPlaceholders(text, values) {
  const filled = String(text || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, key) => String(values[key] ?? '').trim());
  return filled
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\.\s*\./g, '.')
    .trim();
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const n = m ? parseInt(m[1], 16) : 0x1b1a47;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function tint(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Largest font size (<= max) at which `text` fits in width × maxHeight. */
function fitFontSize(doc, text, font, { width, maxHeight, max, min, lineGap = 2 }) {
  doc.font(font);
  for (let size = max; size >= min; size -= 0.5) {
    doc.fontSize(size);
    if (doc.heightOfString(text, { width, align: 'center', lineGap }) <= maxHeight) return size;
  }
  return min;
}

/** Draw centred text fitted into a box; returns the y after the block. */
function drawFitted(doc, text, { font, color, x, y, width, maxHeight, max, min, lineGap = 2, characterSpacing = 0 }) {
  if (!text) return y;
  const size = fitFontSize(doc, text, font, { width, maxHeight, max, min, lineGap });
  doc.font(font).fontSize(size).fillColor(color);
  const h = Math.min(doc.heightOfString(text, { width, align: 'center', lineGap, characterSpacing }), maxHeight);
  doc.text(text, x, y, { width, align: 'center', lineGap, characterSpacing, height: maxHeight, ellipsis: true });
  return y + h;
}

function tryImage(doc, file, x, y, opts) {
  try {
    if (file && (Buffer.isBuffer(file) || fs.existsSync(file))) {
      doc.image(file, x, y, opts);
      return true;
    }
  } catch {
    // Unreadable image: certificate still renders without it
  }
  return false;
}

function drawPreset(doc, t, W, H) {
  const primary = t.primary_color;
  const accent = t.accent_color;
  if (t.design_preset === 'MODERN') {
    // Corner triangles sized from the short side so they never reach the text area
    const k = Math.min(W, H) * 0.27;
    const a = k * 0.16;
    doc.rect(0, 0, W, H).fill('#ffffff');
    doc.save().polygon([0, 0], [k, 0], [0, k]).fill(primary).restore();
    doc.save().polygon([k, 0], [k + a, 0], [0, k + a], [0, k]).fill(accent).restore();
    doc.save().polygon([W, H], [W - k, H], [W, H - k]).fill(primary).restore();
    doc.save().polygon([W - k, H], [W - k - a, H], [W, H - k - a], [W, H - k]).fill(accent).restore();
    doc.lineWidth(1).strokeColor(tint(primary, 0.7)).rect(18, 18, W - 36, H - 36).stroke();
  } else if (t.design_preset === 'ELEGANT') {
    doc.rect(0, 0, W, H).fill(tint(accent, 0.92));
    doc.lineWidth(10).strokeColor(primary).rect(14, 14, W - 28, H - 28).stroke();
    doc.lineWidth(2).strokeColor(accent).rect(30, 30, W - 60, H - 60).stroke();
    doc.lineWidth(0.75).strokeColor(accent).rect(36, 36, W - 72, H - 72).stroke();
    for (const [cx, cy] of [[36, 36], [W - 36, 36], [36, H - 36], [W - 36, H - 36]]) {
      doc.save().circle(cx, cy, 9).fill(accent).restore();
      doc.save().circle(cx, cy, 4).fill(primary).restore();
    }
  } else {
    // CLASSIC
    doc.rect(0, 0, W, H).fill('#fffdf7');
    doc.lineWidth(6).strokeColor(primary).rect(20, 20, W - 40, H - 40).stroke();
    doc.lineWidth(1.5).strokeColor(accent).rect(32, 32, W - 64, H - 64).stroke();
    for (const [cx, cy] of [[32, 32], [W - 32, 32], [32, H - 32], [W - 32, H - 32]]) {
      doc.save().rotate(45, { origin: [cx, cy] }).rect(cx - 7, cy - 7, 14, 14).fill(accent).restore();
    }
  }
}

function drawSeal(doc, cx, cy, r, primary, accent) {
  doc.save().circle(cx, cy, r).fill(accent).restore();
  doc.save().circle(cx, cy, r - 5).fill(primary).restore();
  doc.lineWidth(1).strokeColor(accent).circle(cx, cy, r - 9).stroke();
  doc.font('Times-Bold').fontSize(r * 0.34).fillColor('#ffffff').text('AWARD', cx - r, cy - r * 0.2, { width: r * 2, align: 'center' });
}

function drawSignature(doc, { x, y, width, name, role, image, color }) {
  if (image) tryImage(doc, image, x + width / 2 - 55, y - 44, { fit: [110, 40], align: 'center', valign: 'bottom' });
  doc.lineWidth(0.8).strokeColor('#475569').moveTo(x, y).lineTo(x + width, y).stroke();
  drawFitted(doc, name || ' ', { font: 'Times-Bold', color, x, y: y + 4, width, maxHeight: 16, max: 12, min: 8 });
  doc.font('Helvetica').fontSize(8.5).fillColor('#64748b').text(role, x, y + 20, { width, align: 'center' });
}

/**
 * Render a certificate PDF.
 * @param {object} template  certificate_templates row (or snapshot)
 * @param {object} data      trusted values: school_name, student_name, class_name, achievement_title,
 *                           achievement_description, issue_date (YYYY-MM-DD), teacher_name, subject_name,
 *                           academic_year, certificate_id, remarks, isSample
 * @param {object} assets    { background, logo, principalSignature } file paths or Buffers
 * @returns {Promise<Buffer>}
 */
export function renderCertificatePdf(template, data, assets = {}) {
  return new Promise((resolve, reject) => {
    try {
      const landscape = template.orientation !== 'PORTRAIT';
      const doc = new PDFDocument({
        size: template.page_size === 'LETTER' ? 'LETTER' : 'A4',
        layout: landscape ? 'landscape' : 'portrait',
        margin: 0,
        info: {
          Title: `${pdfSafe(template.certificate_title)} - ${pdfSafe(data.student_name)}`,
          Author: pdfSafe(data.school_name),
          Subject: `Certificate ${pdfSafe(data.certificate_id)}`,
          Creator: 'CES Certificate Management'
        }
      });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = doc.page.width;
      const H = doc.page.height;
      const primary = /^#[0-9a-f]{6}$/i.test(template.primary_color || '') ? template.primary_color : '#1b1a47';
      const accent = /^#[0-9a-f]{6}$/i.test(template.accent_color || '') ? template.accent_color : '#c9a227';
      const t = { ...template, primary_color: primary, accent_color: accent };

      // Background: uploaded artwork, otherwise the preset design
      if (!(assets.background && tryImage(doc, assets.background, 0, 0, { width: W, height: H }))) {
        drawPreset(doc, t, W, H);
      }

      const values = {
        school_name: pdfSafe(data.school_name),
        student_name: pdfSafe(data.student_name),
        class_name: pdfSafe(data.class_name),
        achievement_title: pdfSafe(data.achievement_title),
        achievement_description: pdfSafe(data.achievement_description || ''),
        issue_date: formatIssueDate(data.issue_date),
        teacher_name: pdfSafe(data.teacher_name),
        subject_name: pdfSafe(data.subject_name || ''),
        academic_year: pdfSafe(data.academic_year || ''),
        certificate_id: pdfSafe(data.certificate_id)
      };

      const contentW = W * (landscape ? 0.72 : 0.78);
      const left = (W - contentW) / 2;
      const s = landscape ? 1 : 1.12; // portrait has more height to use
      const gap = landscape ? 1 : 1.9; // spread portrait content over the taller page
      let y = landscape ? 46 : 92;

      // Logo + school name
      const logoSize = 58 * s;
      tryImage(doc, assets.logo || DEFAULT_LOGO_PATH, W / 2 - logoSize / 2, y, { fit: [logoSize, logoSize], align: 'center' });
      y += logoSize + 6;
      y = drawFitted(doc, values.school_name.toUpperCase(), { font: 'Times-Bold', color: primary, x: left, y, width: contentW, maxHeight: 20, max: 15, min: 9, characterSpacing: 2 }) + 10 * gap;

      // Title
      y = drawFitted(doc, pdfSafe(t.certificate_title).toUpperCase(), { font: 'Times-Bold', color: primary, x: left, y, width: contentW, maxHeight: 76 * s, max: 34 * s, min: 16, lineGap: 0 }) + 6;
      doc.lineWidth(1.5).strokeColor(accent).moveTo(W / 2 - 70, y).lineTo(W / 2 + 70, y).stroke();
      y += 14 * gap;

      // Recipient
      doc.font('Helvetica').fontSize(10).fillColor('#64748b').text('PROUDLY PRESENTED TO', left, y, { width: contentW, align: 'center', characterSpacing: 2 });
      y += 18;
      y = drawFitted(doc, values.student_name, { font: 'Times-BoldItalic', color: '#0f172a', x: left, y, width: contentW, maxHeight: 64 * s, max: 34 * s, min: 14, lineGap: 0 }) + 4;
      doc.lineWidth(0.8).strokeColor(tint(primary, 0.55)).moveTo(W / 2 - contentW * 0.32, y).lineTo(W / 2 + contentW * 0.32, y).stroke();
      y += 10;
      doc.font('Helvetica').fontSize(10).fillColor('#475569').text(values.class_name, left, y, { width: contentW, align: 'center' });
      y += 20 * gap;

      // Body text (placeholders filled with trusted values)
      const signatureTop = H - (landscape ? 118 : 150);
      const bodyMax = Math.max(40, signatureTop - y - 52);
      const body = fillPlaceholders(t.body_text, values);
      y = drawFitted(doc, body, { font: 'Times-Roman', color: '#1e293b', x: left, y, width: contentW, maxHeight: bodyMax * 0.78, max: 14.5, min: 8.5, lineGap: 3 }) + 6;

      const meta = [values.subject_name && `Subject: ${values.subject_name}`, values.academic_year && `Academic Year: ${values.academic_year}`]
        .filter(Boolean)
        .join('     ');
      if (meta) {
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(primary).text(meta, left, y, { width: contentW, align: 'center' });
        y += 15;
      }
      if (data.remarks) {
        drawFitted(doc, pdfSafe(data.remarks), { font: 'Times-Italic', color: '#475569', x: left, y, width: contentW, maxHeight: Math.max(12, signatureTop - y - 14), max: 10.5, min: 7.5 });
      }

      // Signatures, date and seal
      const sigW = Math.min(170, W * 0.22);
      const sigY = signatureTop + 34;
      if (t.show_teacher_signature !== false && t.show_teacher_signature !== 0) {
        drawSignature(doc, { x: W * 0.16, y: sigY, width: sigW, name: values.teacher_name, role: 'Issued by', color: primary });
      }
      if (t.show_principal_signature !== false && t.show_principal_signature !== 0) {
        drawSignature(doc, { x: W * 0.84 - sigW, y: sigY, width: sigW, name: pdfSafe(t.principal_name || ''), role: 'Principal', image: assets.principalSignature, color: primary });
      }
      drawSeal(doc, W / 2, signatureTop + 4, landscape ? 30 : 34, primary, accent);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#334155').text(`Date: ${values.issue_date}`, W / 2 - 90, signatureTop + 44, { width: 180, align: 'center' });

      // Certificate ID footer
      doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text(`Certificate ID: ${values.certificate_id}`, 0, H - (landscape ? 44 : 50), { width: W, align: 'center' });

      if (data.isSample) {
        doc.save().rotate(-24, { origin: [W / 2, H / 2] });
        doc.font('Helvetica-Bold').fontSize(landscape ? 92 : 80).fillColor('#94a3b8').fillOpacity(0.18).text('PREVIEW', 0, H / 2 - 50, { width: W, align: 'center' });
        doc.restore();
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
