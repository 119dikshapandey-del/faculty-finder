import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

function resolveWritableDataDir(): string {
  const primaryDir = path.resolve(process.cwd(), 'data');
  try {
    if (!fs.existsSync(primaryDir)) {
      fs.mkdirSync(primaryDir, { recursive: true });
    }
    fs.accessSync(primaryDir, fs.constants.W_OK);
    return primaryDir;
  } catch {
    const fallbackDir = path.join('/tmp', 'kt-buddy-data');
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
    return fallbackDir;
  }
}

export const DATA_DIR = resolveWritableDataDir();
const dbPath = path.join(DATA_DIR, 'kt_buddy.db');

export const db = new Database(dbPath);

// Enable WAL mode for reliable concurrent reads/writes and enforce relational foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS colleges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      city TEXT NOT NULL,
      website TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      head_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
      UNIQUE (college_id, code)
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      department_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      total_semesters INTEGER NOT NULL DEFAULT 6,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
      UNIQUE (college_id, code)
    );

    CREATE TABLE IF NOT EXISTS semesters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      semester_number INTEGER NOT NULL CHECK (semester_number BETWEEN 1 AND 12),
      label TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      UNIQUE (course_id, semester_number)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      email TEXT NOT NULL UNIQUE,
      identifier TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('student', 'admin')),
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
      UNIQUE (college_id, identifier)
    );

    CREATE INDEX IF NOT EXISTS idx_users_college_role ON users(college_id, role);

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      college_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      college_id INTEGER NOT NULL,
      department_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      roll_number TEXT NOT NULL,
      year_of_study INTEGER NOT NULL DEFAULT 1,
      semester INTEGER NOT NULL DEFAULT 1,
      phone TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT,
      UNIQUE (college_id, roll_number)
    );

    CREATE INDEX IF NOT EXISTS idx_students_college ON students(college_id, department_id, course_id, semester);

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      department_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      semester INTEGER NOT NULL,
      subject_code TEXT NOT NULL,
      subject_name TEXT NOT NULL,
      credits INTEGER NOT NULL DEFAULT 4,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      UNIQUE (college_id, subject_code)
    );

    CREATE INDEX IF NOT EXISTS idx_subjects_lookup ON subjects(college_id, course_id, semester);

    CREATE TABLE IF NOT EXISTS result_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      raw_code TEXT NOT NULL,
      mapped_clearance_status TEXT NOT NULL CHECK (mapped_clearance_status IN ('KT', 'Cleared', 'Result Awaited', 'Under Verification', 'Revaluation Pending')),
      auto_confirm INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      updated_by INTEGER,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE (college_id, raw_code)
    );

    CREATE TABLE IF NOT EXISTS student_kt (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      semester INTEGER NOT NULL,
      academic_year TEXT NOT NULL,
      attempt_number INTEGER NOT NULL DEFAULT 1,
      previous_status TEXT,
      latest_status TEXT NOT NULL,
      clearance_status TEXT NOT NULL CHECK (clearance_status IN ('KT', 'Cleared', 'Result Awaited', 'Under Verification', 'Revaluation Pending')),
      result_declaration_date TEXT,
      is_verified INTEGER NOT NULL DEFAULT 1,
      verified_by INTEGER,
      verified_at TEXT,
      source_type TEXT NOT NULL DEFAULT 'admin_manual',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE (student_id, subject_id, academic_year)
    );

    CREATE INDEX IF NOT EXISTS idx_student_kt_student ON student_kt(student_id, clearance_status);
    CREATE INDEX IF NOT EXISTS idx_student_kt_college ON student_kt(college_id, clearance_status);

    CREATE TABLE IF NOT EXISTS result_imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      total_rows INTEGER NOT NULL DEFAULT 0,
      matched_rows INTEGER NOT NULL DEFAULT 0,
      unmatched_rows INTEGER NOT NULL DEFAULT 0,
      duplicate_rows INTEGER NOT NULL DEFAULT 0,
      invalid_rows INTEGER NOT NULL DEFAULT 0,
      confirmed_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Previewed' CHECK (status IN ('Previewed', 'Committed')),
      imported_by INTEGER,
      error_report_json TEXT,
      summary_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
      FOREIGN KEY (imported_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS result_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      import_id INTEGER,
      student_id INTEGER,
      student_kt_id INTEGER,
      roll_number TEXT NOT NULL,
      subject_code TEXT NOT NULL,
      subject_name TEXT,
      semester INTEGER,
      academic_year TEXT NOT NULL,
      attempt_number INTEGER NOT NULL DEFAULT 1,
      raw_result_status TEXT NOT NULL,
      mapped_status TEXT NOT NULL CHECK (mapped_status IN ('KT', 'Cleared', 'Result Awaited', 'Under Verification', 'Revaluation Pending')),
      previous_status TEXT,
      result_declaration_date TEXT,
      verification_status TEXT NOT NULL DEFAULT 'Pending Verification' CHECK (verification_status IN ('Pending Verification', 'Verified', 'Rejected')),
      supporting_file_path TEXT,
      imported_by INTEGER,
      verified_by INTEGER,
      verified_at TEXT,
      remarks TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
      FOREIGN KEY (import_id) REFERENCES result_imports(id) ON DELETE SET NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
      FOREIGN KEY (student_kt_id) REFERENCES student_kt(id) ON DELETE SET NULL,
      FOREIGN KEY (imported_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_result_records_college_status ON result_records(college_id, verification_status);
    CREATE INDEX IF NOT EXISTS idx_result_records_student ON result_records(student_id, verification_status);

    CREATE TABLE IF NOT EXISTS syllabus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      department_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      semester INTEGER NOT NULL,
      academic_year TEXT NOT NULL,
      version_label TEXT NOT NULL,
      title TEXT NOT NULL,
      unit_topics_json TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL DEFAULT 0,
      is_latest INTEGER NOT NULL DEFAULT 1,
      uploaded_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_syllabus_filters ON syllabus(college_id, department_id, course_id, semester, subject_id);

    CREATE TABLE IF NOT EXISTS study_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      department_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      semester INTEGER NOT NULL,
      academic_year TEXT NOT NULL,
      resource_type TEXT NOT NULL CHECK (resource_type IN ('PYQ', 'Notes', 'Important Questions', 'Unit Material', 'Reference Book', 'Practical Material')),
      title TEXT NOT NULL,
      description TEXT,
      external_url TEXT,
      file_name TEXT,
      file_path TEXT,
      file_size_bytes INTEGER NOT NULL DEFAULT 0,
      uploaded_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_materials_filters ON study_materials(college_id, department_id, course_id, semester, subject_id, resource_type);

    CREATE TABLE IF NOT EXISTS exam_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      semester INTEGER NOT NULL,
      exam_session TEXT NOT NULL,
      exam_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      venue TEXT,
      instructions TEXT,
      timetable_pdf_path TEXT,
      is_changed INTEGER NOT NULL DEFAULT 0,
      change_note TEXT,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE (college_id, subject_id, exam_date, start_time)
    );

    CREATE INDEX IF NOT EXISTS idx_exam_schedules_college_date ON exam_schedules(college_id, exam_date, semester);

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Academic',
      target_department_id INTEGER,
      target_course_id INTEGER,
      target_semester INTEGER,
      publish_date TEXT NOT NULL,
      expiry_date TEXT,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
      FOREIGN KEY (target_department_id) REFERENCES departments(id) ON DELETE SET NULL,
      FOREIGN KEY (target_course_id) REFERENCES courses(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_announcements_college_dates ON announcements(college_id, publish_date, expiry_date);

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      related_entity TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at);

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      actor_user_id INTEGER,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
      FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_activity_college ON activity_logs(college_id, created_at);
  `);
}
