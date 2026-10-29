import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';
import { UPLOAD_ROOT } from '../src/shared/storage/upload.js';

describe('Multer File Uploads & Range Buffer Streaming Tests', () => {
  let app;
  let teacherCookies;
  let teacherCsrf;
  let uploadedFilename;

  beforeAll(async () => {
    app = createApp();

    // Teacher Login
    const teacherRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'ayesha.math@school.pk', password: 'TeacherPassword123!' });

    expect(teacherRes.status).toBe(200);
    teacherCookies = teacherRes.headers['set-cookie'];
    const tCsrfCookie = teacherCookies.find((c) => c.startsWith('sms_csrf='));
    teacherCsrf = tCsrfCookie.split(';')[0].split('=')[1];
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('Multipart File Upload with Multer', () => {
    it('should upload a PDF file using multipart/form-data', async () => {
      const samplePdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');

      const res = await request(app)
        .post('/api/v1/uploads')
        .set('Cookie', teacherCookies)
        .set('X-CSRF-Token', teacherCsrf)
        .attach('file', samplePdfBuffer, 'algebra_lecture.pdf');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.fileName).toBeDefined();
      expect(res.body.data.fileUrl).toContain('/api/v1/uploads/');
      expect(res.body.data.mimeType).toBe('application/pdf');

      uploadedFilename = res.body.data.fileName;

      // Verify file exists on disk in uploads directory
      const filePath = path.join(UPLOAD_ROOT, uploadedFilename);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should reject unsupported file types (e.g. .exe)', async () => {
      const dangerousBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00');

      const res = await request(app)
        .post('/api/v1/uploads')
        .set('Cookie', teacherCookies)
        .set('X-CSRF-Token', teacherCsrf)
        .attach('file', dangerousBuffer, 'malware.exe');

      expect([422, 500]).toContain(res.status); // Multer fileFilter validation error
    });
  });

  describe('File Serving & Buffer Streaming', () => {
    it('should serve complete file for standard request', async () => {
      const res = await request(app)
        .get(`/api/v1/uploads/${uploadedFilename}`)
        .set('Cookie', teacherCookies);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['accept-ranges']).toBe('bytes');
    });

    it('should stream partial content (HTTP 206) with Range headers for video/large file seeking', async () => {
      // Create a test file of 1000 bytes
      const testBuffer = Buffer.alloc(1000, 'A');
      const testVideoFilename = `stream_test_${Date.now()}.mp4`;
      const testVideoPath = path.join(UPLOAD_ROOT, testVideoFilename);
      fs.writeFileSync(testVideoPath, testBuffer);

      // Request bytes 0 to 199 (first 200 bytes)
      const res = await request(app)
        .get(`/api/v1/uploads/${testVideoFilename}`)
        .set('Cookie', teacherCookies)
        .set('Range', 'bytes=0-199');

      expect(res.status).toBe(206);
      expect(res.headers['content-range']).toBe('bytes 0-199/1000');
      expect(res.headers['content-length']).toBe('200');
      expect(res.headers['content-type']).toBe('video/mp4');
      expect(res.headers['accept-ranges']).toBe('bytes');
      expect(res.body.length).toBe(200);

      // Clean up test file
      fs.unlinkSync(testVideoPath);
    });

    it('should return 416 Range Not Satisfiable for invalid range request', async () => {
      const res = await request(app)
        .get(`/api/v1/uploads/${uploadedFilename}`)
        .set('Cookie', teacherCookies)
        .set('Range', 'bytes=99999-999999');

      expect(res.status).toBe(416);
      expect(res.headers['content-range']).toContain('bytes */');
    });
  });

  describe('Multipart Resource Creation with Multer', () => {
    it('should create a resource directly with attached file via multipart/form-data', async () => {
      const sampleDeckBuffer = Buffer.from('PowerPoint Deck Content');

      const res = await request(app)
        .post('/api/v1/tasks/resources')
        .set('Cookie', teacherCookies)
        .set('X-CSRF-Token', teacherCsrf)
        .field('classId', 1)
        .field('subjectId', 1)
        .field('title', 'Fractions Visual Lecture Deck')
        .field('description', 'Comprehensive slide presentation for fractions.')
        .attach('file', sampleDeckBuffer, 'fractions_deck.pptx');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.fileUrl).toContain('/api/v1/uploads/');
    });
  });
});
