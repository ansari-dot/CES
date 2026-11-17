/**
 * Per-challan payment / recipient details with controlled revisions and an
 * optional QR code.
 *
 * Why this exists: challans reference a shared `school_bank_accounts` row. Editing
 * that row used to silently change the details printed on every issued (and paid)
 * challan. Each challan now carries frozen revisions in `fee_challan_payment_details`;
 * exactly one is current. Printing, the parent portal and payment proofs all read the
 * current revision. Older revisions are never modified or deleted.
 *
 * Changing payment details never touches any amount, concession, balance or payment
 * record on the challan.
 */
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { db } from '../../shared/db/knex.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { UPLOAD_ROOT } from '../../shared/storage/upload.js';
import { auditRepository } from '../audit/audit.repository.js';
import { assertCanViewStudent, isStaff } from '../../shared/services/accessScope.js';

export const QR_DIR_NAME = 'challan-qr';
const QR_DIR = path.join(UPLOAD_ROOT, QR_DIR_NAME);
export const QR_MAX_BYTES = 1024 * 1024; // 1 MB

const DEFAULT_PAYMENT_METHOD = 'Bank Deposit / Online Transfer';

// Challans whose payment details may no longer change.
const LOCKED_STATUSES = {
  PAID: 'This challan is fully paid. Its payment details are part of the financial record and cannot be changed.',
  PENDING_VERIFICATION:
    'A payment proof for this challan is awaiting verification against the current account. Review the proof before changing the payment details.'
};

function validation(message) {
  return new AppError(message, 422, ErrorCodes.VALIDATION_ERROR);
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------
function cleanText(value, { max, field, required = false }) {
  const v = value === undefined || value === null ? '' : String(value).trim();
  if (required && !v) throw validation(`${field} is required.`);
  if (v.length > max) throw validation(`${field} must be at most ${max} characters.`);
  return v || null;
}

/** ISO 13616 IBAN check (length per country for PK, mod-97 checksum for all). */
export function normalizeIban(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const iban = String(raw).replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) {
    throw validation('IBAN format is invalid. Example: PK36SCBL0000001123456702.');
  }
  if (iban.startsWith('PK') && iban.length !== 24) {
    throw validation('Pakistani IBANs must be exactly 24 characters.');
  }
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97;
  if (remainder !== 1) throw validation('IBAN checksum is invalid. Please re-check the IBAN digits.');
  return iban;
}

function normalizeAccountNumber(raw) {
  const v = cleanText(raw, { max: 50, field: 'Account number' });
  if (v && !/^[A-Za-z0-9][A-Za-z0-9 \-/]*$/.test(v)) {
    throw validation('Account number may only contain letters, digits, spaces, "-" and "/".');
  }
  return v;
}

function toBool(v) {
  return v === true || v === 1 || v === '1' || v === 'true' || v === 'on';
}

/** Identify the image from its leading bytes; the client-declared MIME type is not trusted. */
export function sniffImage(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { mime: 'image/png', ext: '.png' };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: '.jpg' };
  }
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { mime: 'image/webp', ext: '.webp' };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Snapshot / read helpers
// ---------------------------------------------------------------------------

/**
 * Freeze revision 1 for every challan that has no payment-detail revision yet,
 * using the bank account it currently references (or the current default).
 * Called before any change to a shared bank account and after challan generation,
 * so issued challans keep the details they were issued with.
 */
export async function snapshotMissingChallans(conn = db) {
  if (!(await conn.schema.hasTable('fee_challan_payment_details'))) return 0;
  if (!(await conn.schema.hasColumn('fee_challans', 'bank_account_id'))) return 0;
  const def =
    (await conn('school_bank_accounts').where({ is_default: true, status: 'ACTIVE' }).first()) ||
    (await conn('school_bank_accounts').where({ status: 'ACTIVE' }).orderBy('id', 'asc').first());
  const [result] = await conn.raw(
    `
    INSERT IGNORE INTO fee_challan_payment_details
      (challan_id, revision_no, is_current, source, bank_account_id, account_title, bank_name,
       branch_name, account_number, iban, payment_method, payment_instructions, qr_enabled, change_reason)
    SELECT fc.id, 1, 1, 'ISSUED_SNAPSHOT', sba.id, sba.account_title, sba.bank_name, sba.branch_name,
           sba.account_number, sba.iban, ?, sba.instructions, 0, 'Snapshot of payment details as issued'
    FROM fee_challans fc
    JOIN school_bank_accounts sba ON sba.id = COALESCE(fc.bank_account_id, ?)
    WHERE NOT EXISTS (SELECT 1 FROM fee_challan_payment_details d WHERE d.challan_id = fc.id)
    `,
    [DEFAULT_PAYMENT_METHOD, def ? def.id : null]
  );
  return result?.affectedRows || 0;
}

/** Map<challanId, currentRevisionRow> for the given challans. */
export async function loadCurrentDetails(challanIds, conn = db) {
  const ids = Array.from(new Set((challanIds || []).map(Number).filter(Boolean)));
  const map = new Map();
  if (ids.length === 0) return map;
  try {
    const rows = await conn('fee_challan_payment_details as d')
      .leftJoin('users as u', 'd.created_by', 'u.id')
      .whereIn('d.challan_id', ids)
      .where('d.is_current', 1)
      .select('d.*', 'u.full_name as created_by_name');
    for (const r of rows) map.set(Number(r.challan_id), r);
  } catch (err) {
    // Table not migrated yet: callers fall back to the live bank account join.
    if (!/doesn't exist|no such table/i.test(err?.message || '')) throw err;
  }
  return map;
}

function qrUrl(challanId, row) {
  return `/api/v1/fees/challans/${challanId}/payment-qr?rev=${row.revision_no}`;
}

/** Public shape of a revision. Storage keys are never exposed. */
export function toPublicDetails(row, challanId) {
  if (!row) return null;
  const hasQr = Boolean(row.qr_storage_key);
  return {
    revision: Number(row.revision_no),
    source: row.source,
    accountTitle: row.account_title,
    bankName: row.bank_name,
    branchName: row.branch_name,
    accountNumber: row.account_number,
    iban: row.iban,
    paymentMethod: row.payment_method || DEFAULT_PAYMENT_METHOD,
    instructions: row.payment_instructions,
    qr: {
      enabled: Boolean(row.qr_enabled) && hasQr,
      uploaded: hasQr,
      label: row.qr_label || null,
      url: hasQr ? qrUrl(challanId, row) : null,
      sizeBytes: row.qr_size_bytes || null,
      attestedAt: row.qr_attested_at || null
    },
    changeReason: row.change_reason || null,
    updatedAt: row.created_at,
    updatedBy: row.created_by_name || (row.created_by ? `User #${row.created_by}` : 'System')
  };
}

/**
 * Replace the live bank fields on a serialized challan with its frozen current
 * revision and attach `paymentDetails`. When the QR is disabled, its URL is
 * withheld from non-staff callers by the stream endpoint as well.
 */
export function overlayChallanDetails(challan, row) {
  if (!row) return { ...challan, paymentDetails: null };
  const details = toPublicDetails(row, challan.id);
  return {
    ...challan,
    bankAccount: {
      ...(challan.bankAccount || {}),
      bankName: details.bankName,
      branchName: details.branchName,
      accountTitle: details.accountTitle,
      accountNumber: details.accountNumber,
      iban: details.iban,
      instructions: details.instructions
    },
    paymentDetails: details
  };
}

// ---------------------------------------------------------------------------
// Principal edit workflow
// ---------------------------------------------------------------------------
async function loadChallanForUpdate(trx, challanId) {
  const challan = await trx('fee_challans').where({ id: challanId }).forUpdate().first();
  if (!challan) throw new AppError('Challan not found.', 404, ErrorCodes.NOT_FOUND);
  return challan;
}

async function ensureCurrentRevision(trx, challanId) {
  let current = await trx('fee_challan_payment_details').where({ challan_id: challanId, is_current: 1 }).first();
  if (!current) {
    await snapshotMissingChallans(trx);
    current = await trx('fee_challan_payment_details').where({ challan_id: challanId, is_current: 1 }).first();
  }
  if (!current) {
    throw new AppError(
      'This challan has no bank account to snapshot. Assign a bank account first.',
      409,
      ErrorCodes.INVALID_STATE
    );
  }
  return current;
}

function writeQrFile(buffer, ext) {
  if (!fs.existsSync(QR_DIR)) fs.mkdirSync(QR_DIR, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(QR_DIR, name), buffer, { flag: 'wx' });
  return `${QR_DIR_NAME}/${name}`;
}

function resolveQrPath(storageKey) {
  if (!storageKey) return null;
  const full = path.resolve(UPLOAD_ROOT, storageKey);
  // Defence in depth: never serve anything outside the QR directory.
  if (!full.startsWith(path.resolve(QR_DIR) + path.sep)) return null;
  return full;
}

const COMPARED_FIELDS = [
  'account_title',
  'bank_name',
  'branch_name',
  'account_number',
  'iban',
  'payment_method',
  'payment_instructions',
  'qr_enabled',
  'qr_storage_key',
  'qr_label'
];

function auditView(row) {
  return {
    revision: row.revision_no,
    accountTitle: row.account_title,
    bankName: row.bank_name,
    branchName: row.branch_name,
    accountNumber: row.account_number,
    iban: row.iban,
    paymentMethod: row.payment_method,
    instructions: row.payment_instructions,
    qrEnabled: Boolean(row.qr_enabled),
    qrSha256: row.qr_sha256 || null,
    qrLabel: row.qr_label || null
  };
}

export const challanPaymentDetailsService = {
  async getDetails(challanId) {
    const id = Number(challanId);
    if (!Number.isInteger(id) || id <= 0) throw validation('Valid challan ID is required.');
    const challan = await db('fee_challans').where({ id }).first();
    if (!challan) throw new AppError('Challan not found.', 404, ErrorCodes.NOT_FOUND);

    await snapshotMissingChallans(db);
    const history = await db('fee_challan_payment_details as d')
      .leftJoin('users as u', 'd.created_by', 'u.id')
      .where('d.challan_id', id)
      .orderBy('d.revision_no', 'desc')
      .select('d.*', 'u.full_name as created_by_name');

    const current = history.find((r) => Number(r.is_current) === 1) || null;
    return {
      challanId: id,
      challanNumber: challan.challan_number,
      status: challan.status,
      editable: !LOCKED_STATUSES[challan.status],
      lockedReason: LOCKED_STATUSES[challan.status] || null,
      current: toPublicDetails(current, id),
      history: history.map((r) => toPublicDetails(r, id))
    };
  },

  /**
   * Create a new revision of a challan's payment details.
   * @param {object} p
   * @param {number} p.challanId
   * @param {object} p.actor        req.user
   * @param {object} p.input        form fields
   * @param {object|null} p.file    multer memory file for the QR (optional)
   * @param {string|null} p.ipAddress
   */
  async revise({ challanId, actor, input = {}, file = null, ipAddress = null }) {
    const id = Number(challanId);
    if (!Number.isInteger(id) || id <= 0) throw validation('Valid challan ID is required.');
    if (!isStaff(actor)) {
      throw new AppError('Only the Principal or an Administrator can change challan payment details.', 403, ErrorCodes.FORBIDDEN);
    }

    // ---- Validate input before opening a transaction ----------------------
    const accountTitle = cleanText(input.accountTitle, { max: 150, field: 'Recipient / account title', required: true });
    const bankName = cleanText(input.bankName, { max: 100, field: 'Bank name' });
    const branchName = cleanText(input.branchName, { max: 150, field: 'Branch' });
    const accountNumber = normalizeAccountNumber(input.accountNumber);
    const iban = normalizeIban(input.iban);
    const paymentMethod = cleanText(input.paymentMethod, { max: 60, field: 'Payment method', required: true });
    const instructions = cleanText(input.instructions, { max: 1000, field: 'Payment instructions' });
    const reason = cleanText(input.reason, { max: 500, field: 'Reason for change', required: true });
    if (reason.length < 5) throw validation('Please describe the reason for this change (at least 5 characters).');
    if (!accountNumber && !iban && !/cash/i.test(paymentMethod)) {
      throw validation('Provide an account number or IBAN for non-cash payment methods.');
    }
    if (!toBool(input.confirmRevision)) {
      throw new AppError(
        'This challan has already been issued. Confirm that you want to issue a revised copy with new payment details.',
        422,
        ErrorCodes.VALIDATION_ERROR,
        { requiresConfirmation: true }
      );
    }
    const expectedRevision = Number(input.expectedRevision);
    if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
      throw validation('expectedRevision is required. Reload the challan and try again.');
    }

    const qrAction = String(input.qrAction || 'keep').toLowerCase();
    if (!['keep', 'replace', 'remove'].includes(qrAction)) throw validation('qrAction must be keep, replace or remove.');
    let newQr = null;
    if (qrAction === 'replace') {
      if (!file || !file.buffer) throw validation('Upload a QR code image to replace the current one.');
      if (file.size > QR_MAX_BYTES || file.buffer.length > QR_MAX_BYTES) throw validation('QR code image must be 1 MB or smaller.');
      const kind = sniffImage(file.buffer);
      if (!kind) throw validation('QR code must be a PNG, JPEG or WebP image.');
      if (!toBool(input.qrAttested)) {
        throw validation(
          'Confirm that you have verified this QR code pays the recipient shown on the challan. The system cannot read QR contents.'
        );
      }
      newQr = {
        buffer: file.buffer,
        mime: kind.mime,
        ext: kind.ext,
        size: file.buffer.length,
        sha256: crypto.createHash('sha256').update(file.buffer).digest('hex')
      };
    } else if (file) {
      throw validation('A QR image was uploaded but qrAction is not "replace".');
    }
    const qrLabelInput = cleanText(input.qrLabel, { max: 150, field: 'QR recipient label' });

    let writtenKey = null;
    try {
      const result = await db.transaction(async (trx) => {
        const challan = await loadChallanForUpdate(trx, id);
        if (LOCKED_STATUSES[challan.status]) {
          throw new AppError(LOCKED_STATUSES[challan.status], 409, ErrorCodes.INVALID_STATE);
        }

        const current = await ensureCurrentRevision(trx, id);
        if (Number(current.revision_no) !== expectedRevision) {
          throw new AppError(
            `These payment details were changed by someone else (now revision ${current.revision_no}). Reload and review before saving.`,
            409,
            ErrorCodes.CONFLICT
          );
        }

        // Resolve QR fields for the new revision
        let qr = {
          qr_storage_key: current.qr_storage_key,
          qr_mime_type: current.qr_mime_type,
          qr_size_bytes: current.qr_size_bytes,
          qr_sha256: current.qr_sha256,
          qr_label: current.qr_label,
          qr_attested_by: current.qr_attested_by,
          qr_attested_at: current.qr_attested_at
        };
        if (qrAction === 'remove') {
          qr = {
            qr_storage_key: null,
            qr_mime_type: null,
            qr_size_bytes: null,
            qr_sha256: null,
            qr_label: null,
            qr_attested_by: null,
            qr_attested_at: null
          };
        } else if (newQr) {
          writtenKey = writeQrFile(newQr.buffer, newQr.ext);
          qr = {
            qr_storage_key: writtenKey,
            qr_mime_type: newQr.mime,
            qr_size_bytes: newQr.size,
            qr_sha256: newQr.sha256,
            qr_label: qrLabelInput || accountTitle,
            qr_attested_by: actor.id,
            qr_attested_at: new Date()
          };
        } else if (qr.qr_storage_key && qrLabelInput !== null) {
          qr.qr_label = qrLabelInput;
        }

        // A QR kept from a previous revision was attested for that recipient. If the
        // recipient changes, it must be re-uploaded/re-attested rather than carried over.
        const recipientChanged =
          (current.account_title || '') !== accountTitle ||
          (current.account_number || '') !== (accountNumber || '') ||
          (current.iban || '') !== (iban || '');
        if (qrAction === 'keep' && qr.qr_storage_key && recipientChanged) {
          throw validation(
            'The recipient account changed, so the existing QR code may no longer pay the right account. Upload a verified QR for the new recipient or remove it.'
          );
        }

        const qrEnabled = toBool(input.qrEnabled) && Boolean(qr.qr_storage_key);
        if (toBool(input.qrEnabled) && !qr.qr_storage_key) {
          throw validation('Upload a QR code before enabling it on the challan.');
        }

        const next = {
          challan_id: id,
          revision_no: Number(current.revision_no) + 1,
          is_current: 1,
          source: 'PRINCIPAL_EDIT',
          bank_account_id: current.bank_account_id,
          account_title: accountTitle,
          bank_name: bankName,
          branch_name: branchName,
          account_number: accountNumber,
          iban,
          payment_method: paymentMethod,
          payment_instructions: instructions,
          qr_enabled: qrEnabled ? 1 : 0,
          ...qr,
          change_reason: reason,
          created_by: actor.id
        };

        const unchanged = COMPARED_FIELDS.every((f) => {
          const a = f === 'qr_enabled' ? Number(current[f]) : current[f] ?? null;
          const b = f === 'qr_enabled' ? Number(next[f]) : next[f] ?? null;
          return a === b;
        });
        if (unchanged) throw validation('No changes to save. The payment details are identical to the current revision.');

        await trx('fee_challan_payment_details').where({ challan_id: id, is_current: 1 }).update({ is_current: 0 });
        await trx('fee_challan_payment_details').insert(next);

        await auditRepository.logAction(trx, {
          actorId: actor.id,
          action: 'CHALLAN_PAYMENT_DETAILS_REVISED',
          recordType: 'fee_challans',
          recordIdentifier: `Challan #${challan.challan_number} (ID: ${id}) rev ${next.revision_no}`,
          reason,
          previousValue: auditView(current),
          newValue: auditView(next),
          ipAddress
        });

        return next.revision_no;
      });

      return { revision: result, ...(await this.getDetails(id)) };
    } catch (err) {
      // Do not leave an orphaned upload behind when the revision was not saved.
      if (writtenKey) {
        const p = resolveQrPath(writtenKey);
        if (p) fs.promises.unlink(p).catch(() => {});
      }
      throw err;
    }
  },

  /**
   * Resolve the QR image file for a challan the caller may view.
   * Non-staff callers only get the current revision, and only when enabled.
   */
  async resolveQrFile(user, challanId, revision = null) {
    const id = Number(challanId);
    const challan = await db('fee_challans').where({ id }).first();
    if (!challan) throw new AppError('Challan not found.', 404, ErrorCodes.NOT_FOUND);
    await assertCanViewStudent(user, challan.student_id);

    const staff = isStaff(user);
    let row;
    if (staff && revision) {
      row = await db('fee_challan_payment_details').where({ challan_id: id, revision_no: Number(revision) }).first();
    } else {
      row = await db('fee_challan_payment_details').where({ challan_id: id, is_current: 1 }).first();
    }
    if (!row || !row.qr_storage_key || (!staff && !row.qr_enabled)) {
      throw new AppError('No QR code is available for this challan.', 404, ErrorCodes.NOT_FOUND);
    }
    const filePath = resolveQrPath(row.qr_storage_key);
    if (!filePath || !fs.existsSync(filePath)) {
      throw new AppError('No QR code is available for this challan.', 404, ErrorCodes.NOT_FOUND);
    }
    return { filePath, mimeType: row.qr_mime_type || 'application/octet-stream' };
  },

  /**
   * New revision when the principal reassigns the challan to a different school
   * bank account. A QR attested for the previous recipient is not carried over.
   */
  async recordBankReassignment(trx, { challanId, account, actorId }) {
    const current = await ensureCurrentRevision(trx, challanId);
    await trx('fee_challan_payment_details').where({ challan_id: challanId, is_current: 1 }).update({ is_current: 0 });
    await trx('fee_challan_payment_details').insert({
      challan_id: challanId,
      revision_no: Number(current.revision_no) + 1,
      is_current: 1,
      source: 'BANK_REASSIGNMENT',
      bank_account_id: account.id,
      account_title: account.account_title,
      bank_name: account.bank_name,
      branch_name: account.branch_name,
      account_number: account.account_number,
      iban: account.iban,
      payment_method: current.payment_method || DEFAULT_PAYMENT_METHOD,
      payment_instructions: account.instructions,
      qr_enabled: 0,
      change_reason: `Reassigned to school bank account #${account.id} (${account.bank_name})`,
      created_by: actorId || null
    });
  },

  LOCKED_STATUSES
};
