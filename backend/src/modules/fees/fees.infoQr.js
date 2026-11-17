/**
 * Automatic "information" QR code for fee challans.
 *
 * Every challan gets a QR generated from its own saved data: challan & consumer
 * number, student, class, month, amounts, due date and the frozen recipient/bank
 * details of its current payment-detail revision. Scanning it with any phone camera
 * shows those details as text, plus a verification link.
 *
 * This is NOT a payment QR: banking apps will not open a payment screen from it.
 * (A payment QR needs a Raast merchant ID / bank onboarding; the Principal can upload
 * a bank-issued payment QR separately.)
 *
 * The verification link carries an HMAC-signed token, so challan links cannot be
 * guessed or enumerated. The public verification page shows a masked student name
 * and the challan's live status, so anyone holding a printed challan can confirm it
 * is genuine and unaltered.
 */
import crypto from 'crypto';
import QRCode from 'qrcode';
import { db } from '../../shared/db/knex.js';
import { config } from '../../config/index.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { assertCanViewStudent } from '../../shared/services/accessScope.js';
import { loadCurrentDetails } from './fees.paymentDetails.js';

const TOKEN_VERSION = 'v1';

function secretKey() {
  // A dedicated secret keeps printed QR links valid even if the JWT secret is rotated.
  const dedicated = process.env.CHALLAN_VERIFY_SECRET;
  if (dedicated && dedicated.length >= 32) return dedicated;
  return crypto.createHmac('sha256', config.JWT_ACCESS_SECRET).update('challan-verify-secret').digest('hex');
}

function signature(challanId, consumerNumber) {
  return crypto
    .createHmac('sha256', secretKey())
    .update(`${TOKEN_VERSION}|${challanId}|${consumerNumber}`)
    .digest('base64url')
    .slice(0, 22);
}

export function createVerifyToken(challan) {
  return `${Number(challan.id).toString(36)}.${signature(challan.id, challan.consumer_number)}`;
}

/** Returns the challan id for a valid token, otherwise null (constant-time compare). */
export async function resolveVerifyToken(token) {
  const m = /^([0-9a-z]{1,12})\.([A-Za-z0-9_-]{22})$/.exec(String(token || ''));
  if (!m) return null;
  const id = parseInt(m[1], 36);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const challan = await db('fee_challans').where({ id }).first('id', 'consumer_number');
  if (!challan) return null;
  const expected = Buffer.from(signature(challan.id, challan.consumer_number));
  const given = Buffer.from(m[2]);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  return id;
}

export function verifyUrl(challan) {
  const base = String(process.env.CHALLAN_VERIFY_BASE_URL || config.APP_BASE_URL || '').replace(/\/+$/, '');
  return `${base}/api/v1/public/challans/verify/${createVerifyToken(challan)}`;
}

const rupees = (n) => `Rs ${Math.round(Number(n || 0)).toLocaleString('en-US')}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(value || '');
}

/** Masks a name for the public page: "Ali Khan" -> "A** K***". */
export function maskName(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0] + '*'.repeat(Math.max(1, Math.min(w.length - 1, 6))))
    .join(' ');
}

/** Load the challan with student/class info and its current frozen payment details. */
async function loadChallanView(challanId) {
  const row = await db('fee_challans as fc')
    .join('students as s', 'fc.student_id', 's.id')
    .join('users as u', 's.user_id', 'u.id')
    .join('classes as c', 'fc.class_id', 'c.id')
    .leftJoin('school_bank_accounts as sba', 'fc.bank_account_id', 'sba.id')
    .where('fc.id', Number(challanId))
    .first(
      'fc.*',
      'u.full_name as student_name',
      's.roll_no',
      'c.name as class_name',
      'sba.account_title as live_account_title',
      'sba.bank_name as live_bank_name',
      'sba.account_number as live_account_number',
      'sba.iban as live_iban'
    );
  if (!row) return null;
  const frozen = (await loadCurrentDetails([row.id])).get(Number(row.id));
  return {
    ...row,
    pay: {
      accountTitle: frozen?.account_title ?? row.live_account_title ?? null,
      bankName: frozen?.bank_name ?? row.live_bank_name ?? null,
      accountNumber: frozen?.account_number ?? row.live_account_number ?? null,
      iban: frozen?.iban ?? row.live_iban ?? null,
      revision: frozen ? Number(frozen.revision_no) : null
    }
  };
}

/**
 * Plain-text payload encoded in the QR. Kept compact so it stays scannable at
 * printed voucher size. Contains only what is already printed on the challan.
 */
export function buildInfoText(ch) {
  const total = Number(ch.total_payable || 0);
  const lateFee = Number(ch.late_fee_amount || 0);
  const lines = [
    'FEE CHALLAN',
    `Challan: ${ch.challan_number}`,
    `Consumer No: ${ch.consumer_number}`,
    `Student: ${ch.student_name}${ch.roll_no ? ` (Roll ${ch.roll_no})` : ''}`,
    `Class: ${ch.class_name}`,
    `Month: ${ch.billing_month}`,
    `Payable by ${formatDate(ch.due_date)}: ${rupees(total)}`,
    lateFee > 0 ? `After due date: ${rupees(total + lateFee)}` : null,
    ch.pay.accountTitle ? `Pay to: ${ch.pay.accountTitle}` : null,
    ch.pay.bankName ? `Bank: ${ch.pay.bankName}` : null,
    ch.pay.accountNumber ? `A/C: ${ch.pay.accountNumber}` : null,
    ch.pay.iban ? `IBAN: ${ch.pay.iban}` : null,
    `Verify: ${verifyUrl(ch)}`
  ];
  return lines.filter(Boolean).join('\n');
}

export const challanInfoQrService = {
  /** PNG of the information QR for a challan the caller may view. */
  async renderForUser(user, challanId) {
    const ch = await loadChallanView(challanId);
    if (!ch) throw new AppError('Challan not found.', 404, ErrorCodes.NOT_FOUND);
    await assertCanViewStudent(user, ch.student_id);
    const text = buildInfoText(ch);
    const png = await QRCode.toBuffer(text, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 360,
      color: { dark: '#000000', light: '#FFFFFF' }
    });
    return { png, text };
  },

  /** Data for the public verification page (masked; no account-holder secrets). */
  async verify(token) {
    const id = await resolveVerifyToken(token);
    if (!id) return null;
    const ch = await loadChallanView(id);
    if (!ch) return null;
    const total = Number(ch.total_payable || 0);
    const paid = Number(ch.paid_amount || 0);
    return {
      challanNumber: ch.challan_number,
      consumerNumber: ch.consumer_number,
      student: maskName(ch.student_name),
      className: ch.class_name,
      billingMonth: ch.billing_month,
      dueDate: formatDate(ch.due_date),
      totalPayable: rupees(total),
      afterDueDate: Number(ch.late_fee_amount || 0) > 0 ? rupees(total + Number(ch.late_fee_amount)) : null,
      paidAmount: rupees(paid),
      outstanding: rupees(Math.max(0, total - paid)),
      status: ch.status,
      payTo: ch.pay.accountTitle,
      bankName: ch.pay.bankName,
      accountNumber: ch.pay.accountNumber,
      iban: ch.pay.iban,
      checkedAt: new Date().toISOString()
    };
  }
};

// ---------------------------------------------------------------------------
// Public verification page (self-contained HTML, no scripts)
// ---------------------------------------------------------------------------
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const STATUS_LABELS = {
  PAID: ['Paid', '#047857', '#ecfdf5'],
  PARTIALLY_PAID: ['Partially paid', '#b45309', '#fffbeb'],
  PENDING_VERIFICATION: ['Payment under verification', '#1d4ed8', '#eff6ff'],
  OVERDUE: ['Overdue', '#b91c1c', '#fef2f2'],
  UNPAID: ['Unpaid', '#334155', '#f1f5f9']
};

function page(title, body) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title>
<style>
body{margin:0;background:#f8fafc;font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a}
.wrap{max-width:460px;margin:0 auto;padding:16px}
.head{background:#1b1a47;color:#fff;border-radius:14px;padding:14px 16px;font-weight:700;letter-spacing:.04em}
.head small{display:block;font-weight:400;opacity:.8;letter-spacing:0;margin-top:2px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;margin-top:12px}
.row{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
.row:last-child{border-bottom:0}.row span:first-child{color:#64748b}.row span:last-child{text-align:right;font-weight:600;word-break:break-word}
.badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:13px;font-weight:700}
.note{font-size:12px;color:#64748b;margin-top:12px;line-height:1.5}
</style></head><body><div class="wrap">${body}</div></body></html>`;
}

export function renderVerifyPage(data) {
  if (!data) {
    return page(
      'Challan not verified',
      `<div class="head">Challan verification<small>Fee challan check</small></div>
       <div class="card"><span class="badge" style="color:#b91c1c;background:#fef2f2">Not verified</span>
       <p class="note">This QR code does not match any challan issued by the school. The challan may have been altered.
       Please contact the school office before making a payment.</p></div>`
    );
  }
  const [label, fg, bg] = STATUS_LABELS[data.status] || [data.status, '#334155', '#f1f5f9'];
  const row = (k, v) => (v ? `<div class="row"><span>${esc(k)}</span><span>${esc(v)}</span></div>` : '');
  return page(
    `Challan ${data.challanNumber}`,
    `<div class="head">Genuine fee challan<small>Issued by the school · verified ${esc(new Date(data.checkedAt).toUTCString())}</small></div>
     <div class="card"><span class="badge" style="color:${fg};background:${bg}">${esc(label)}</span>
       ${row('Challan No', data.challanNumber)}${row('Consumer No', data.consumerNumber)}${row('Student', data.student)}
       ${row('Class', data.className)}${row('Billing month', data.billingMonth)}${row('Due date', data.dueDate)}</div>
     <div class="card">${row('Payable by due date', data.totalPayable)}${row('After due date', data.afterDueDate)}
       ${row('Paid (verified)', data.paidAmount)}${row('Outstanding', data.outstanding)}</div>
     <div class="card">${row('Pay to', data.payTo)}${row('Bank', data.bankName)}${row('Account No', data.accountNumber)}${row('IBAN', data.iban)}</div>
     <p class="note">Compare these details with your printed challan. If the amount or account number differs, do not pay and contact the school office.
     This page is for verification only and cannot be used to make a payment.</p>`
  );
}
