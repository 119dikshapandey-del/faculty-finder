# KT Buddy — Smart Backlog Management & Academic Information System

**KT Buddy** is a full-stack web application designed for college students carrying KT (Keep Term / ATKT) backlog subjects and Examination Cell administrators who verify official results, publish versioned syllabi, upload PYQs and study resources, and manage supplementary examination timetables.

> **Runtime Note**: Because this AI Studio Build environment executes Node.js + Express + Vite on port 3000 (`npm run dev` / `npm start`), the application is implemented using **Node.js, Express, SQLite (`better-sqlite3`), ExcelJS, Multer, React, TypeScript, Tailwind CSS, and Recharts** with a PostgreSQL-compatible relational schema (`data/kt_buddy.db`).

---

## Core Modules & Pages

### Public Website
- **Landing Page**: Value proposition, workflow breakdown, and Student/Admin portal entry.
- **About KT Buddy**: Configurable university rules overview and privacy guarantees.
- **Login & Password Recovery**: Sign in using College Email or Student ID (`scrypt` hashed passwords) + 6-digit password reset flow.
- **Student Registration**: Public student signup scoped to College, Department, Course, Year, and Semester (Admin creation is blocked from public registration).

### Student Portal (9 Pages)
1. **Student Dashboard**: Live database counts (`Total KT Subjects`, `Cleared Subjects`, `Remaining Subjects`, `Upcoming Examinations`), Recharts KT clearance progress ring, upcoming exam schedule, announcements, recent study files, and latest result updates.
2. **My Profile**: Read-only student academic metadata with privacy guarantee.
3. **My KT Subjects**: Search by subject name/code, filter by semester and status (`KT`, `Cleared`, `Result Awaited`, `Under Verification`, `Revaluation Pending`), and inspect linked syllabi/PYQs.
4. **My Results**: Subject-wise `Previous Status -> Latest Status` comparison table, attempt history, overall progress bar, and optional supporting document submission (`Pending Verification` until Admin verifies).
5. **Syllabus**: Filter by Department, Course, Semester, Subject; view unit-wise topics, clearly labeled academic year & version (`v2.1 Latest Official` vs `v1.0 Prior Cycle`), and download PDF files.
6. **Study Resources**: Subject notes, important questions, unit materials, practical manuals, and external educational links.
7. **Previous Year Question Papers**: Dedicated PYQ archive filterable by semester, subject, and academic year.
8. **Examination Timetable**: Personal backlog timetable + course schedule with **Download Timetable PDF** and **Add to Calendar (.ics)** exports plus highlighted venue/date change notices.
9. **Notifications**: Read/unread personal notification feed and targeted announcements.

### Admin Portal (11 Pages)
1. **Admin Dashboard**: Live database statistics, Department-wise & Semester-wise Recharts visualizations, recent imports, announcements, and audit logs.
2. **Student Management**: Search by roll number/name, add/edit students, assign department/course/semester, activate/deactivate accounts.
3. **Department Management**: Manage departments, courses, and semester structures.
4. **Subject Management**: Manage subject codes, credits, courses, and semester assignments.
5. **Result Import**:
   - Configurable university **Result-Status Mapping Rules** (`WH`, `AB`, `RP`, `REV`, `FAIL`, `PASS`, `CLEARED`, `KT`, `ATKT`).
   - **Sample `.xlsx` Template** download + Excel (`.xlsx`/`.xls`) & CSV upload.
   - Pre-import validation preview detecting **Invalid**, **Duplicate**, and **Unmatched Student/Subject** rows + error report + import history.
6. **KT Verification**: Review staged `Pending Verification` records (including student supporting submissions), confirm/reject outcomes, and update **Revaluation / Supplementary** results while preserving `previous_status` and attempt history.
7. **Syllabus Management**: Upload syllabus PDFs with version labels, unit topics, and automatic student notifications.
8. **Study Material Management**: Upload PYQs, notes, practical manuals, or external reference links.
9. **Examination Management**: Add/edit schedules with overlapping time-slot conflict checks and automatic student change alerts.
10. **Announcements**: Target announcements by College-wide, Department, Course, or Semester with expiry dates.
11. **Reports & Analytics**: Export **KT Ledger**, **Department Summary**, and **Import History** in `.xlsx` or `.csv` format.

---

## Development-Only Demo Credentials

> **Security Notice**: The credentials below are strictly for local development and demonstration. Replace all seeded credentials and require strong passwords before production deployment.

| Role | Name | Login ID / Email | Password |
| :--- | :--- | :--- | :--- |
| **Student** | Rahul Sharma (BCA Sem 4) | `BCA2024001` or `rahul.sharma@nitm.edu` | `KTBuddy@2026` |
| **Student** | Ananya Verma (BCA Sem 4) | `BCA2024002` or `ananya.verma@nitm.edu` | `KTBuddy@2026` |
| **Admin** | Rajeshwari Kulkarni (Exam Cell) | `admin@nitm.edu` | `KTBuddy@2026` |

---

## Installation & Execution

```bash
# 1. Install dependencies
npm install

# 2. Run development server (Express API + Vite on port 3000)
npm run dev

# 3. Type-check and build for production
npm run lint
npm run build

# 4. Run production server
NODE_ENV=production npm start
```
