# Cambridge Education System — School Management & Learning Platform (LMS)

A complete, production-ready Online School Management System and Learning Platform supporting daily operations for Classes 1 to 8. Built strictly according to the SRS specifications, providing dedicated role-based portals for School Administration/Principals, Teachers, Students, and Parents.

---

## 🌟 Key Features & Functional Modules

### 1. Principal & Administrative Portal (`/principle` — Port 3000)
- **Academic Setup**: Manage academic sessions, grade levels (Classes 1 to 8), and curriculum subject allocations.
- **Faculty Directory**: Teacher onboarding, designation tracking, employment status, and subject assignment.
- **Student & Parent Management**: Student admissions, class enrollments, guardian profile verification (CNIC & contact), and child-parent linkage.
- **Timetable Scheduling**: Conflict-free weekly lesson scheduling with automated teacher double-booking and room overlap detection.
- **Class Zoom Rooms**: Management and health-checking of persistent recurring virtual classrooms for each grade.
- **Attendance Oversight**: Real-time review of lesson delivery logs and one-click review/approval of attendance correction vouchers.
- **Fee Management & Billing**:
  - Class fee structures (Tuition, Technology, Examination, Admission heads).
  - Student concessions and sibling discount approvals.
  - Automated monthly challan batch generation with arrears tracking and late fee calculation.
  - Verification and approval workflow for submitted payment proofs (bank transfer & mobile wallet slips).
- **Teacher Payroll & Duty**:
  - Monthly duty tracking (scheduled vs completed teaching hours).
  - Automated salary draft generation (fixed monthly, per-lesson, or per-hour).
  - Principal review, financial adjustments (allowances/deductions), and settlement records.
- **Reports & Academic Oversight**: Enrollment statistics, fee collection summaries, teacher duty reports, and mid-year/final result publication controls.
- **System Audit Logs**: Tamper-evident logging of all state-changing administrative operations.

### 2. Teacher & Faculty Portal (`/teacher` — Port 3001)
- **Teacher Dashboard & Schedule**: Quick overview of assigned classes, live teaching sessions, and upcoming periods.
- **Virtual Classrooms**: One-click lesson launch with embedded Zoom room IDs and security passcodes.
- **Attendance Marking**: Interactive classroom roster marking (Present, Absent, Late, Leave) with instant lockout upon submission and voucher creation for retrospective adjustments.
- **Tasks & Homework Management**:
  - Task creation with instructions, deadlines, total marks, and handout attachments.
  - Multimedia uploads supporting PDF handouts and document streaming.
  - Multi-tier rubric criteria configuration (Accuracy, Steps, Simplification).
- **Submissions & Grading Queue**: Review student submissions, grade using custom rubrics, provide feedback, or request resubmission.
- **Learning Resources Repository**: Upload and organize slide decks, PDF worksheets, lab protocols, and recorded lecture archives.
- **Student Performance & Recognition**: Award achievement badges (Stars, Medals, Trophies) to motivate student progress.
- **Duty & Salary View**: Transparent verification of completed teaching hours and payroll draft statuses.

### 3. Backend REST Engine (`/backend` — Port 5000)
- **Security & Hardening**: Cookie-based JWT authentication, CSRF double-submit protection, Helmet headers, HPP parameter pollution protection, and rate limiting.
- **Database Architecture**: Relational schema managed via Knex.js migrations and seeds on MySQL.
- **File Upload & Streaming**: Multer storage for documents and optimized HTTP chunked buffer streaming for multimedia resources.
- **Structured Logging**: Production JSON logging via Pino and request tracing with unique `X-Request-Id`.
- **Automated Test Coverage**: 12 complete Jest integration test suites covering all 122 requirements.

---

## 🏗️ Project Architecture

```
school/
├── backend/                  # Express REST API Engine (Port 5000)
│   ├── src/
│   │   ├── config/           # Environment configuration
│   │   ├── migrations/       # Knex SQL migrations
│   │   ├── modules/          # Domain modules (auth, teachers, people, academic,
│   │   │                     # timetable, zoom, attendance, tasks, fees, payroll,
│   │   │                     # notices, audit, reports, uploads)
│   │   ├── seeds/            # Initial roles, users, and academic seed data
│   │   └── shared/           # Middleware (auth, csrf, errors, storage, knex)
│   ├── tests/                # 12 Jest test suites (122 tests)
│   └── uploads/              # Uploaded handouts, resources, and payment slips
│
├── principle/                # Principal & Administration Portal (Port 3000)
│   ├── src/
│   │   ├── components/       # UI design system & modal dialogs
│   │   ├── pages/            # Dashboard, Faculty, Students, Timetable, Zoom,
│   │   │                     # Attendance, Fees, Payroll, Reports, Audit
│   │   ├── services/api.ts   # REST API client with CSRF token management
│   │   └── types/            # TypeScript domain interfaces
│   └── vite.config.ts        # Vite configuration with /api proxy to port 5000
│
├── teacher/                  # Teacher & Faculty Portal (Port 3001)
│   ├── src/
│   │   ├── components/       # Classroom, roster, grading, and modal components
│   │   ├── pages/            # Dashboard, Timetable, Live Lessons, Attendance,
│   │   │                     # Tasks, Submissions, Resources, Duty & Salary
│   │   ├── services/api.ts   # REST API client with multipart upload support
│   │   ├── store/            # Redux Toolkit store and slices (auth, timetable,
│   │   │                     # attendance, tasks, resources, performance, duty)
│   │   └── types/            # TypeScript domain interfaces
│   └── vite.config.ts        # Vite configuration with /api proxy to port 5000
│
├── .gitignore                # Root gitignore excluding node_modules, .env, builds
└── README.md                 # Complete documentation
```

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.x or v20.x recommended)
- [MySQL Server](https://dev.mysql.com/) (v8.0+)
- npm or yarn

### 1. Database Setup
Create the MySQL database:
```sql
CREATE DATABASE IF NOT EXISTS school_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Backend Setup & Seeding
```bash
cd backend
cp .env.example .env
# Edit .env with your MySQL credentials (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)

npm install
npm run migrate      # Run all Knex database migrations
npm run seed         # Populate initial roles, demo classes, teachers, and students
npm run dev          # Starts backend on http://localhost:5000
```

### 3. Principal Portal Setup
```bash
cd ../principle
npm install
npm run dev          # Starts Principal Portal on http://localhost:3000
```

### 4. Teacher Portal Setup
```bash
cd ../teacher
npm install
npm run dev          # Starts Teacher Portal on http://localhost:3001
```

### 5. Student and Parent Portals
```bash
cd ../student
npm install
npm run dev          # Starts Student Portal on http://localhost:3002

cd ../parent
npm install
npm run dev          # Starts Parent Portal on http://localhost:3003
```

Parents sign in with their own parent account. A parent sees only the children linked to that account by the school (Principal → Parents → verify and link), and every parent API call checks that link on the server.

---

## 🔑 Default Credentials & Demo Accounts

| Role | Portal URL | Username / Email | Password |
| :--- | :--- | :--- | :--- |
| **Principal / Admin** | `http://localhost:3000` | `principal` (or `principal@school.pk`) | `PrincipalPassword123!` |
| **Teacher** | `http://localhost:3001` | `teacher@school.pk` (or `teacher`) | `TeacherPassword123!` |
| **Student** | `http://localhost:3002` | `student@school.pk` (or `student`) | `StudentPassword123!` |
| **Parent** | `http://localhost:3003` | `parent@school.pk` (or `parent`) | `ParentPassword123!` |

---

## 🧪 Testing & Verification

Run the comprehensive Jest integration test suite in the backend:
```bash
cd backend
npm test
```
All **12 test suites and 122 tests** run in-band and validate complete academic, payroll, fee calculation, attendance lockout, and streaming upload workflows.

To run TypeScript verification:
```bash
# Principal Portal
cd principle && npx tsc --noEmit

# Teacher Portal
cd teacher && npx tsc --noEmit
```

---

## 📄 License
This project is proprietary software developed for Cambridge Education System. All rights reserved.
