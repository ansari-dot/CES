import nodemailer from 'nodemailer';

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
  }

  getTransporter() {
    const host = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';

    if (!user || !pass) {
      return null;
    }

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
        tls: {
          rejectUnauthorized: false
        }
      });
    }

    return this.transporter;
  }

  async sendMail({ to, subject, html, text }) {
    if (!to) {
      console.warn('[EmailService] Dispatch skipped: No recipient email address provided.');
      return { sent: false, reason: 'NO_RECIPIENT' };
    }

    const transporter = this.getTransporter();
    if (!transporter) {
      console.warn(`[EmailService] SMTP credentials (SMTP_USER / SMTP_PASS) not configured in .env. Email to "${to}" was not dispatched.`);
      return { sent: false, reason: 'SMTP_NOT_CONFIGURED' };
    }

    const fromAddress = process.env.SMTP_FROM || `"Cambridge Education System" <${process.env.SMTP_USER}>`;

    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        text,
        html
      });
      console.log(`[EmailService] Email successfully sent to ${to}. MessageId: ${info.messageId}`);
      return { sent: true, messageId: info.messageId };
    } catch (err) {
      console.error(`[EmailService] Error dispatching email to ${to}:`, err.message);
      return { sent: false, error: err.message };
    }
  }

  /**
   * Enqueue email for asynchronous delivery via BullMQ with automatic retries
   */
  async queueMail({ to, subject, html, text }) {
    try {
      const { enqueueEmail } = await import('../queue/queueManager.js');
      return await enqueueEmail({ to, subject, html, text });
    } catch {
      return await this.sendMail({ to, subject, html, text });
    }
  }

  /**
   * Send Welcome & Account Credentials to a newly onboarded Teacher
   */
  async sendTeacherCredentials({
    email,
    name,
    staffIdentifier,
    username,
    temporaryPassword,
    designation = 'Faculty Member',
    portalUrl = process.env.TEACHER_PORTAL_URL || 'http://localhost:3001'
  }) {
    const subject = `Welcome to Faculty Team - Your Cambridge Education System Teacher Portal Credentials`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #3525cd 0%, #1e1b4b 100%); padding: 36px 32px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0 0 8px; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 0; font-size: 14px; opacity: 0.9; }
    .body { padding: 32px; }
    .greeting { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #0f172a; }
    .intro { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
    .credential-box { background: #f1f5f9; border-radius: 12px; padding: 20px; border-left: 4px solid #3525cd; margin-bottom: 24px; }
    .credential-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed #cbd5e1; font-size: 13px; }
    .credential-row:last-child { border-bottom: none; }
    .label { color: #64748b; font-weight: 500; }
    .value { font-weight: 700; color: #0f172a; font-family: monospace, monospace; font-size: 14px; }
    .btn-container { text-align: center; margin: 28px 0; }
    .btn { background: #3525cd; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; display: inline-block; box-shadow: 0 2px 8px rgba(53, 37, 205, 0.35); }
    .steps { background: #eff6ff; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px; border: 1px solid #bfdbfe; font-size: 13px; color: #1e3a8a; }
    .steps h4 { margin: 0 0 8px; font-size: 13px; font-weight: 700; }
    .steps ol { margin: 0; padding-left: 20px; }
    .steps li { margin-bottom: 6px; line-height: 1.4; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Cambridge Education System</h1>
      <p>Faculty &amp; Academic Staff Onboarding</p>
    </div>
    <div class="body">
      <div class="greeting">Dear ${name},</div>
      <div class="intro">
        Welcome to our academic institution! Your teacher account has been officially created by the administration. You can now access your class timetable, take student attendance, publish assignments, and conduct live lessons.
      </div>

      <div class="credential-box">
        <div class="credential-row">
          <span class="label">Staff Identifier / Employee No:</span>
          <span class="value">${staffIdentifier}</span>
        </div>
        <div class="credential-row">
          <span class="label">Designation:</span>
          <span class="value" style="font-family: inherit;">${designation}</span>
        </div>
        <div class="credential-row">
          <span class="label">Login Email / Username:</span>
          <span class="value">${email || username}</span>
        </div>
        <div class="credential-row">
          <span class="label">Temporary Password:</span>
          <span class="value" style="color: #3525cd; background: #e0e7ff; padding: 2px 8px; border-radius: 4px;">${temporaryPassword}</span>
        </div>
      </div>

      <div class="btn-container">
        <a href="${portalUrl}" class="btn">Log In to Teacher Portal &rarr;</a>
      </div>

      <div class="steps">
        <h4>Getting Started:</h4>
        <ol>
          <li>Click the button above or visit <a href="${portalUrl}" style="color: #1e3a8a; font-weight: bold;">${portalUrl}</a>.</li>
          <li>Sign in using your Email or Staff ID and the temporary password provided.</li>
          <li>For institutional security, please change your temporary password upon first login under <strong>Profile &amp; Settings</strong>.</li>
        </ol>
      </div>
    </div>
    <div class="footer">
      This is an automated notification from Cambridge Education System.<br>
      Please do not share your login credentials with anyone. If you need assistance, contact school administration.
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Dear ${name},

Welcome to Cambridge Education System! Your teacher account has been created.

Here are your account credentials:
- Staff Identifier: ${staffIdentifier}
- Designation: ${designation}
- Login Email: ${email || username}
- Temporary Password: ${temporaryPassword}
- Teacher Portal URL: ${portalUrl}

Please log in and update your password immediately upon your first sign-in.
    `.trim();

    return await this.queueMail({
      to: email,
      subject,
      html,
      text
    });
  }

  /**
   * Send Welcome & Account Credentials to a newly enrolled Student (or parent)
   */
  async sendStudentCredentials({
    email,
    name,
    admissionNo,
    rollNo,
    className = 'Assigned Class',
    username,
    temporaryPassword,
    portalUrl = process.env.STUDENT_PORTAL_URL || 'http://localhost:3000'
  }) {
    const subject = `Welcome to Cambridge Education System - Student Portal Credentials for ${name}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 36px 32px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0 0 8px; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 0; font-size: 14px; opacity: 0.9; }
    .body { padding: 32px; }
    .greeting { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #0f172a; }
    .intro { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
    .credential-box { background: #f0f9ff; border-radius: 12px; padding: 20px; border-left: 4px solid #0284c7; margin-bottom: 24px; }
    .credential-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed #bae6fd; font-size: 13px; }
    .credential-row:last-child { border-bottom: none; }
    .label { color: #0369a1; font-weight: 500; }
    .value { font-weight: 700; color: #0f172a; font-family: monospace, monospace; font-size: 14px; }
    .btn-container { text-align: center; margin: 28px 0; }
    .btn { background: #0284c7; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; display: inline-block; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35); }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Cambridge Education System</h1>
      <p>Student Admission &amp; Portal Access</p>
    </div>
    <div class="body">
      <div class="greeting">Dear ${name} &amp; Family,</div>
      <div class="intro">
        Congratulations on your official enrollment! Your student account is active. You can now access your daily class timetable, view learning resources, submit assignments, and join live lessons.
      </div>

      <div class="credential-box">
        <div class="credential-row">
          <span class="label">Student Name:</span>
          <span class="value" style="font-family: inherit;">${name}</span>
        </div>
        <div class="credential-row">
          <span class="label">Admission Number:</span>
          <span class="value">${admissionNo}</span>
        </div>
        ${rollNo ? `
        <div class="credential-row">
          <span class="label">Roll Number:</span>
          <span class="value">${rollNo}</span>
        </div>` : ''}
        <div class="credential-row">
          <span class="label">Enrolled Class:</span>
          <span class="value" style="font-family: inherit;">${className}</span>
        </div>
        <div class="credential-row">
          <span class="label">Login Username / Admission ID:</span>
          <span class="value">${admissionNo || username}</span>
        </div>
        <div class="credential-row">
          <span class="label">Temporary Password:</span>
          <span class="value" style="color: #0369a1; background: #e0f2fe; padding: 2px 8px; border-radius: 4px;">${temporaryPassword}</span>
        </div>
      </div>

      <div class="btn-container">
        <a href="${portalUrl}" class="btn">Log In to Student Portal &rarr;</a>
      </div>
    </div>
    <div class="footer">
      This is an automated notification from Cambridge Education System.<br>
      Please keep your credentials safe. If you require assistance, contact your school administration.
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Dear ${name},

Welcome to Cambridge Education System! Your student account has been created.

Here are your account credentials:
- Admission No: ${admissionNo}
- Class: ${className}
- Username: ${admissionNo || username}
- Temporary Password: ${temporaryPassword}
- Student Portal URL: ${portalUrl}

Please keep your login credentials safe.
    `.trim();

    return await this.queueMail({
      to: email,
      subject,
      html,
      text
    });
  }

  /**
   * Send Welcome & Account Credentials to a newly registered Parent / Guardian
   */
  async sendParentCredentials({
    email,
    name,
    temporaryPassword,
    portalUrl = process.env.PARENT_PORTAL_URL || 'http://localhost:3003'
  }) {
    const subject = `Your Parent Portal Access Credentials - Cambridge Education System`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #d97706 0%, #92400e 100%); padding: 36px 32px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0 0 8px; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 0; font-size: 14px; opacity: 0.9; }
    .body { padding: 32px; }
    .greeting { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #0f172a; }
    .intro { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
    .credential-box { background: #fffbeb; border-radius: 12px; padding: 20px; border-left: 4px solid #d97706; margin-bottom: 24px; }
    .credential-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed #fde68a; font-size: 13px; }
    .credential-row:last-child { border-bottom: none; }
    .label { color: #92400e; font-weight: 500; }
    .value { font-weight: 700; color: #0f172a; font-family: monospace, monospace; font-size: 14px; }
    .btn-container { text-align: center; margin: 28px 0; }
    .btn { background: #d97706; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; display: inline-block; box-shadow: 0 2px 8px rgba(217,119,6,0.35); }
    .notice { background: #fef3c7; border-radius: 12px; padding: 14px 18px; margin-bottom: 24px; border: 1px solid #fde68a; font-size: 13px; color: #78350f; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Cambridge Education System</h1>
      <p>Parent &amp; Guardian Portal Access</p>
    </div>
    <div class="body">
      <div class="greeting">Dear ${escapeHtml(name)},</div>
      <div class="intro">
        Your parent account has been created by the school administration. You can now log in to the Parent Portal to monitor your child's attendance, results, assignments, fee challans, and school notices.
      </div>

      <div class="credential-box">
        <div class="credential-row">
          <span class="label">Login Email:</span>
          <span class="value">${escapeHtml(email)}</span>
        </div>
        <div class="credential-row">
          <span class="label">Temporary Password:</span>
          <span class="value" style="color: #d97706; background: #fef3c7; padding: 2px 8px; border-radius: 4px;">${escapeHtml(temporaryPassword)}</span>
        </div>
      </div>

      <div class="btn-container">
        <a href="${portalUrl}" class="btn">Log In to Parent Portal &rarr;</a>
      </div>

      <div class="notice">
        <strong>Important:</strong> You will be asked to set a new password on your first login. Please keep your credentials safe and do not share them with anyone.
      </div>
    </div>
    <div class="footer">
      This is an automated notification from Cambridge Education System.<br>
      If you did not expect this email, please contact the school office.
    </div>
  </div>
</body>
</html>`;

    const text = `Dear ${name},\n\nYour parent portal account has been created.\n\nLogin Email: ${email}\nTemporary Password: ${temporaryPassword}\nPortal URL: ${portalUrl}\n\nYou will be asked to set a new password on first login.`.trim();

    return await this.queueMail({ to: email, subject, html, text });
  }

  /**
   * Send Monthly Test Academic Performance Alert to Parent / Guardian
   * Informs them that their child received a low or failing score on a monthly test,
   * provides full score details and teacher remarks, and instructs them to review the
   * full question breakdown on the Parent Portal.
   */
  async sendMonthlyTestPerformanceAlert({
    to,
    parentName,
    studentName,
    rollNo,
    admissionNo,
    className,
    testTitle,
    subjectName,
    monthName,
    totalMarks,
    passingMarks,
    obtainedMarks,
    percentage,
    isPassed,
    teacherRemarks,
    portalUrl = process.env.PARENT_PORTAL_URL || 'http://localhost:3003'
  }) {
    if (!to) {
      console.warn('[EmailService] Monthly test alert skipped: No recipient parent email.');
      return { sent: false, reason: 'NO_RECIPIENT' };
    }

    const safeTotal = Number(totalMarks) || 1;
    const safeObtained = Number(obtainedMarks) || 0;
    const safePassing = Number(passingMarks) || 0;
    const safePct = percentage != null ? Number(percentage) : Math.round((safeObtained / safeTotal) * 100);
    const passingPct = Math.round((safePassing / safeTotal) * 100);

    const subject = `Academic Performance Alert: ${studentName} - ${testTitle} (${subjectName})`;
    const resultsPageUrl = `${portalUrl.replace(/\/+$/, '')}/results`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.07); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #991b1b 0%, #1e1b4b 100%); padding: 32px 28px; text-align: center; color: #ffffff; }
    .badge { display: inline-block; background: #fef2f2; color: #991b1b; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
    .header h1 { margin: 0 0 6px; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .header p { margin: 0; font-size: 13px; opacity: 0.9; }
    .body { padding: 28px; }
    .greeting { font-size: 16px; font-weight: 600; margin-bottom: 14px; color: #0f172a; }
    .intro { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
    .score-banner { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin-bottom: 22px; text-align: center; }
    .score-title { font-size: 12px; font-weight: 700; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .score-number { font-size: 28px; font-weight: 800; color: #7f1d1d; }
    .score-sub { font-size: 12px; color: #b91c1c; margin-top: 2px; }
    .result-box { background: #f8fafc; border-radius: 12px; padding: 18px; border: 1px solid #e2e8f0; margin-bottom: 22px; }
    .result-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; font-size: 13px; }
    .result-row:last-child { border-bottom: none; }
    .label { color: #64748b; font-weight: 500; }
    .value { font-weight: 700; color: #0f172a; }
    .value.danger { color: #b91c1c; }
    .remarks-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 8px; margin-bottom: 22px; font-size: 13px; color: #78350f; font-style: italic; }
    .btn-container { text-align: center; margin: 26px 0; }
    .btn { background: #1e1b4b; color: #ffffff !important; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 700; display: inline-block; box-shadow: 0 4px 12px rgba(30, 27, 75, 0.3); }
    .btn:hover { background: #2e287a; }
    .action-steps { background: #eff6ff; border-radius: 12px; padding: 16px 20px; border: 1px solid #bfdbfe; font-size: 13px; color: #1e3a8a; margin-bottom: 22px; }
    .action-steps h4 { margin: 0 0 8px; font-size: 13px; font-weight: 700; }
    .action-steps ol { margin: 0; padding-left: 18px; }
    .action-steps li { margin-bottom: 6px; line-height: 1.4; }
    .footer { padding: 18px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="badge">Academic Intervention Alert</div>
      <h1>Cambridge Education System</h1>
      <p>Monthly Test Performance Notification</p>
    </div>
    <div class="body">
      <div class="greeting">Dear ${escapeHtml(parentName || 'Parent / Guardian')},</div>
      <div class="intro">
        This is an official performance alert regarding your child, <strong>${escapeHtml(studentName)}</strong>. 
        In the recently evaluated <strong>${escapeHtml(testTitle)}</strong> for <strong>${escapeHtml(subjectName)}</strong>${monthName ? ` (${escapeHtml(monthName)})` : ''}, your child's score did not meet the required passing standard.
      </div>

      <div class="score-banner">
        <div class="score-title">Monthly Test Result</div>
        <div class="score-number">${safeObtained} / ${safeTotal}</div>
        <div class="score-sub">${safePct}% &bull; Passing Requirement: ${safePassing} Marks (${passingPct}%) &bull; ${isPassed ? 'Satisfactory' : 'Needs Immediate Improvement'}</div>
      </div>

      <div class="result-box">
        <div class="result-row">
          <span class="label">Student Name:</span>
          <span class="value">${escapeHtml(studentName)}</span>
        </div>
        ${rollNo ? `
        <div class="result-row">
          <span class="label">Roll Number:</span>
          <span class="value">${escapeHtml(rollNo)}</span>
        </div>` : ''}
        ${admissionNo ? `
        <div class="result-row">
          <span class="label">Admission No:</span>
          <span class="value">${escapeHtml(admissionNo)}</span>
        </div>` : ''}
        ${className ? `
        <div class="result-row">
          <span class="label">Class:</span>
          <span class="value">${escapeHtml(className)}</span>
        </div>` : ''}
        <div class="result-row">
          <span class="label">Subject:</span>
          <span class="value">${escapeHtml(subjectName)}</span>
        </div>
        <div class="result-row">
          <span class="label">Evaluation / Test:</span>
          <span class="value">${escapeHtml(testTitle)}</span>
        </div>
        <div class="result-row">
          <span class="label">Obtained Marks:</span>
          <span class="value danger">${safeObtained} / ${safeTotal} (${safePct}%)</span>
        </div>
        <div class="result-row">
          <span class="label">Minimum Passing Standard:</span>
          <span class="value">${safePassing} Marks (${passingPct}%)</span>
        </div>
        <div class="result-row">
          <span class="label">Status:</span>
          <span class="value danger">${isPassed ? 'Passed' : 'Needs Work (Below Passing Standard)'}</span>
        </div>
      </div>

      ${teacherRemarks ? `
      <div class="remarks-box">
        <strong>Teacher Feedback:</strong><br>
        &ldquo;${escapeHtml(teacherRemarks)}&rdquo;
      </div>` : ''}

      <div class="action-steps">
        <h4>Review Instructions on the Parent Portal:</h4>
        <ol>
          <li>Click the button below to log into the <strong>Parent Portal</strong>.</li>
          <li>Navigate to the <strong>Results &amp; Assessments</strong> section to review individual questions, marks per question, and correct answer explanations.</li>
          <li>Review key subject concepts with your child to prepare for upcoming formative assessments.</li>
        </ol>
      </div>

      <div class="btn-container">
        <a href="${resultsPageUrl}" class="btn">View Full Results on Parent Portal &rarr;</a>
      </div>

      <p class="intro" style="font-size: 13px; color: #64748b; margin-bottom: 0;">
        If you have questions or would like to request academic support or consultation with the subject teacher, please reach out via the portal or school administration.
      </p>
    </div>
    <div class="footer">
      Cambridge Education System &bull; Continuous Academic Monitoring &bull; Automated System Notice<br>
      Direct portal link: <a href="${resultsPageUrl}" style="color: #64748b;">${resultsPageUrl}</a>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Cambridge Education System - Monthly Test Academic Performance Alert

Dear ${parentName || 'Parent / Guardian'},

This is an official performance notice regarding your child, ${studentName}.
In the recently evaluated ${testTitle} for ${subjectName}${monthName ? ` (${monthName})` : ''}, your child's score was below the required passing standard.

Evaluation Details:
- Student: ${studentName} (Roll: ${rollNo || 'N/A'}${admissionNo ? `, Admission: ${admissionNo}` : ''})
- Class: ${className || 'Enrolled Class'}
- Subject: ${subjectName}
- Test: ${testTitle}
- Marks Obtained: ${safeObtained} / ${safeTotal} (${safePct}%)
- Passing Requirement: ${safePassing} Marks (${passingPct}%)
- Performance Status: ${isPassed ? 'Passed' : 'Needs Immediate Improvement (Below Passing)'}
${teacherRemarks ? `- Teacher Feedback: "${teacherRemarks}"\n` : ''}

Please log in to your Parent Portal account to inspect the full question-by-question breakdown, view incorrect answers, and read teacher feedback:
${resultsPageUrl}

For questions or tutoring support, contact the school administration or subject teacher.
    `.trim();

    return await this.queueMail({
      to,
      subject,
      html,
      text
    });
  }

  /** One-time password reset code, sent only after the Principal approves. */
  async sendPasswordResetOtp({ to, name, otp }) {
    const subject = 'Your Password Reset Code - Cambridge Education System';
    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background: #36348e; color: #ffffff; padding: 18px 24px;">
          <h1 style="margin: 0; font-size: 18px;">Cambridge Education System</h1>
        </div>
        <div style="padding: 24px; color: #252525; font-size: 14px; line-height: 1.6;">
          <p>Dear ${name || 'User'},</p>
          <p>The school has approved your password reset request. Use the one-time code below on the portal's
          <strong>Forgot Password</strong> screen together with your email and your new password:</p>
          <div style="text-align: center; margin: 20px 0;">
            <span style="display: inline-block; background: #f4f4f4; border: 1px dashed #36348e; border-radius: 8px; padding: 12px 28px; font-size: 28px; letter-spacing: 8px; font-weight: bold; color: #36348e;">${otp}</span>
          </div>
          <p style="font-size: 12px; color: #545454;">
            This code expires in <strong>15 minutes</strong> and can be used only once.
            If you did not request a password reset, please inform the school office immediately.
          </p>
        </div>
        <div style="background: #fafafa; padding: 12px 24px; font-size: 11px; color: #545454; border-top: 1px solid #e2e8f0;">
          This is an automated notification from Cambridge Education System.
        </div>
      </div>
    `;
    const text = `Cambridge Education System\n\nDear ${name || 'User'},\n\nYour password reset request was approved. Your one-time code is: ${otp}\nIt expires in 15 minutes and can be used only once.\n\nIf you did not request this, inform the school office immediately.`;
    return await this.sendMail({ to, subject, html, text });
  }
}

export const emailService = new EmailService();
