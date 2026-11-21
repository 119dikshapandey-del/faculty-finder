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
    const fallbackDir = path.join('/tmp', 'faculty-finder-data');
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
    return fallbackDir;
  }
}

export const FF_DATA_DIR = resolveWritableDataDir();
const dbPath = path.join(FF_DATA_DIR, 'faculty_finder.db');

export const ffDb = new Database(dbPath);

ffDb.pragma('journal_mode = WAL');
ffDb.pragma('foreign_keys = ON');
ffDb.pragma('busy_timeout = 5000');

export function initializeFacultyDatabase(): void {
  ffDb.exec(`
    CREATE TABLE IF NOT EXISTS ff_colleges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      city TEXT NOT NULL,
      center_lat REAL NOT NULL DEFAULT 19.1234,
      center_lng REAL NOT NULL DEFAULT 72.8361,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ff_departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      FOREIGN KEY (college_id) REFERENCES ff_colleges(id) ON DELETE CASCADE,
      UNIQUE (college_id, code)
    );

    CREATE TABLE IF NOT EXISTS ff_buildings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      floors TEXT NOT NULL DEFAULT 'G + 3 Floors',
      description TEXT,
      FOREIGN KEY (college_id) REFERENCES ff_colleges(id) ON DELETE CASCADE,
      UNIQUE (college_id, code)
    );

    CREATE TABLE IF NOT EXISTS ff_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      email TEXT NOT NULL UNIQUE,
      identifier TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('student', 'faculty', 'admin')),
      department_id INTEGER,
      designation TEXT,
      subjects_json TEXT NOT NULL DEFAULT '[]',
      cabin_number TEXT,
      building_id INTEGER,
      working_hours TEXT DEFAULT '09:00 AM - 05:00 PM',
      semester INTEGER,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (college_id) REFERENCES ff_colleges(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES ff_departments(id) ON DELETE SET NULL,
      FOREIGN KEY (building_id) REFERENCES ff_buildings(id) ON DELETE SET NULL,
      UNIQUE (college_id, identifier)
    );

    CREATE TABLE IF NOT EXISTS ff_faculty_status (
      faculty_id INTEGER PRIMARY KEY,
      college_id INTEGER NOT NULL,
      manual_status TEXT NOT NULL DEFAULT 'Available' CHECK (
        manual_status IN ('Available', 'In Lecture', 'In Meeting', 'Temporarily Away', 'Busy', 'On Leave')
      ),
      status_message TEXT DEFAULT '',
      expected_return_time TEXT DEFAULT '',
      location_label TEXT DEFAULT '',
      expires_at TEXT,
      queue_open INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (faculty_id) REFERENCES ff_users(id) ON DELETE CASCADE,
      FOREIGN KEY (college_id) REFERENCES ff_colleges(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ff_faculty_timetable (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      faculty_id INTEGER NOT NULL,
      day_of_week TEXT NOT NULL CHECK (
        day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')
      ),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      subject TEXT NOT NULL,
      room TEXT NOT NULL,
      activity_type TEXT NOT NULL DEFAULT 'Lecture' CHECK (
        activity_type IN ('Lecture', 'Lab', 'Office Hours', 'Meeting')
      ),
      FOREIGN KEY (college_id) REFERENCES ff_colleges(id) ON DELETE CASCADE,
      FOREIGN KEY (faculty_id) REFERENCES ff_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ff_virtual_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      faculty_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      token_number INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Waiting' CHECK (
        status IN ('Waiting', 'Called', 'Completed', 'Skipped', 'Cancelled')
      ),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (college_id) REFERENCES ff_colleges(id) ON DELETE CASCADE,
      FOREIGN KEY (faculty_id) REFERENCES ff_users(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES ff_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ff_appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      faculty_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      requested_date TEXT NOT NULL,
      requested_time TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending' CHECK (
        status IN ('Pending', 'Accepted', 'Rejected', 'Suggested', 'Completed', 'Cancelled')
      ),
      faculty_note TEXT DEFAULT '',
      suggested_time TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (college_id) REFERENCES ff_colleges(id) ON DELETE CASCADE,
      FOREIGN KEY (faculty_id) REFERENCES ff_users(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES ff_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ff_recently_viewed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      faculty_id INTEGER NOT NULL,
      viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (college_id) REFERENCES ff_colleges(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES ff_users(id) ON DELETE CASCADE,
      FOREIGN KEY (faculty_id) REFERENCES ff_users(id) ON DELETE CASCADE,
      UNIQUE (student_id, faculty_id)
    );

    CREATE TABLE IF NOT EXISTS ff_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (college_id) REFERENCES ff_colleges(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES ff_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ff_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES ff_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ff_password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES ff_users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_ff_users_college_role ON ff_users(college_id, role);
    CREATE INDEX IF NOT EXISTS idx_ff_queue_faculty_status ON ff_virtual_queue(faculty_id, status);
    CREATE INDEX IF NOT EXISTS idx_ff_appt_faculty_status ON ff_appointments(faculty_id, status);
    CREATE INDEX IF NOT EXISTS idx_ff_notif_user ON ff_notifications(user_id, is_read);
  `);
}
