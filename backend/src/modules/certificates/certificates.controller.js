import fs from 'fs';
import { certificatesService } from './certificates.service.js';
import { sendSuccess } from '../../shared/http/response.js';

const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (err) {
    next(err);
  }
};

/** Inline PDF rendered in memory (previews only; nothing is stored). */
function sendPdfBuffer(res, buffer, name) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${name}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(buffer);
}

function filesOf(req) {
  const f = req.files || {};
  return { background: f.background?.[0], logo: f.logo?.[0], principalSignature: f.principalSignature?.[0] };
}

export const certificatesController = {
  catalog: wrap(async (req, res) =>
    sendSuccess(res, await certificatesService.catalog(req.user, { includeInactive: req.query.includeInactive === 'true' }))
  ),
  recipients: wrap(async (req, res) =>
    sendSuccess(res, await certificatesService.recipients(req.user, req.query.classId ? Number(req.query.classId) : null))
  ),
  templatePreview: wrap(async (req, res) =>
    sendPdfBuffer(res, await certificatesService.templatePreview(req.user, req.params.id), 'template-preview.pdf')
  ),
  personalizedPreview: wrap(async (req, res) =>
    sendPdfBuffer(res, await certificatesService.personalizedPreview(req.user, req.body), 'certificate-preview.pdf')
  ),
  issue: wrap(async (req, res) => {
    const result = await certificatesService.issue(req.user, req.body);
    return sendSuccess(res, result, null, result.replayed ? 200 : 201);
  }),
  listIssued: wrap(async (req, res) => sendSuccess(res, await certificatesService.listIssued(req.user, req.query))),
  listMine: wrap(async (req, res) => sendSuccess(res, await certificatesService.listMine(req.user))),
  listForParent: wrap(async (req, res) => sendSuccess(res, await certificatesService.listForParent(req.user, req.params.studentId))),
  details: wrap(async (req, res) => sendSuccess(res, await certificatesService.details(req.user, req.params.id))),
  pdf: wrap(async (req, res) => {
    const { file, fileName } = await certificatesService.pdfFile(req.user, req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  }),
  revoke: wrap(async (req, res) => sendSuccess(res, await certificatesService.revoke(req.user, req.params.id, req.body?.reason))),

  // ---- Administration
  listCategories: wrap(async (req, res) => sendSuccess(res, await certificatesService.listCategoriesAdmin())),
  createCategory: wrap(async (req, res) =>
    sendSuccess(res, { id: await certificatesService.saveCategory(req.user, null, req.body) }, null, 201)
  ),
  updateCategory: wrap(async (req, res) =>
    sendSuccess(res, { id: await certificatesService.saveCategory(req.user, req.params.id, req.body) })
  ),
  listTemplates: wrap(async (req, res) => sendSuccess(res, await certificatesService.listTemplatesAdmin(req.query))),
  createTemplate: wrap(async (req, res) =>
    sendSuccess(res, { id: await certificatesService.saveTemplate(req.user, null, req.body, filesOf(req)) }, null, 201)
  ),
  updateTemplate: wrap(async (req, res) =>
    sendSuccess(res, { id: await certificatesService.saveTemplate(req.user, req.params.id, req.body, filesOf(req)) })
  ),
  setTemplateStatus: wrap(async (req, res) =>
    sendSuccess(res, await certificatesService.setTemplateStatus(req.user, req.params.id, req.body?.status))
  ),
  events: wrap(async (req, res) => sendSuccess(res, await certificatesService.events(req.query)))
};
