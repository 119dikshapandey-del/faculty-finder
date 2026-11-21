import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';

let dbInstance: Database.Database | null = null;

function resolveDatabasePath(): string {
  const configured = process.env.DATABASE_PATH
    ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
    : path.resolve(process.cwd(), 'data', 'campusmitra.db');

  try {
    fs.mkdirSync(path.dirname(configured), { recursive: true });
    fs.accessSync(path.dirname(configured), fs.constants.W_OK);
    return configured;
  } catch {
    const fallbackDir = path.join(os.tmpdir(), 'campusmitra-data');
    fs.mkdirSync(fallbackDir, { recursive: true });
    return path.join(fallbackDir, 'campusmitra.db');
  }
}

export function getDb(): Database.Database {
  if (!dbInstance) {
    const dbPath = resolveDatabasePath();
    dbInstance = new Database(dbPath);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
  }
  return dbInstance;
}

export function initializeDatabase(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS colleges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      city TEXT NOT NULL,
      center_lat REAL NOT NULL DEFAULT 19.0760,
      center_lng REAL NOT NULL DEFAULT 72.8777,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      UNIQUE(college_id, code)
    );

    CREATE TABLE IF NOT EXISTS buildings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      floors INTEGER NOT NULL DEFAULT 3,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      description TEXT DEFAULT '',
      UNIQUE(college_id, code)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('student', 'faculty', 'admin')),
      full_name TEXT NOT NULL,
      identifier TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      student_semester INTEGER,
      avatar_url TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(college_id, identifier)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS faculty_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      college_id INTEGER NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
      designation TEXT NOT NULL DEFAULT 'Assistant Professor',
      subjects TEXT NOT NULL DEFAULT '',
      cabin_number TEXT NOT NULL DEFAULT 'Room 101',
      building_id INTEGER REFERENCES buildings(id) ON DELETE SET NULL,
      working_hours TEXT NOT NULL DEFAULT 'Mon-Fri · 09:30 AM - 05:00 PM',
      availability_status TEXT NOT NULL DEFAULT 'Available' CHECK(
        availability_status IN (
          'Available',
          'In Lecture',
          'In Meeting',
          'Temporarily Away',
          'Busy',
          'On Leave'
        )
      ),
      status_message TEXT DEFAULT '',
      approved_location TEXT DEFAULT '',
      expected_return_time TEXT DEFAULT '',
      status_expires_at TEXT,
      queue_open INTEGER NOT NULL DEFAULT 1,
      last_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS faculty_timetable (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      faculty_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      college_id INTEGER NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      subject_name TEXT NOT NULL,
      room_label TEXT NOT NULL,
      suggested_status TEXT NOT NULL DEFAULT 'In Lecture'
    );

    CREATE TABLE IF NOT EXISTS virtual_queues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
      faculty_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      student_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_number INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting', 'called', 'completed', 'skipped', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
      faculty_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      student_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      requested_date TEXT NOT NULL,
      requested_slot TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(
        status IN ('pending', 'approved', 'rejected', 'rescheduled', 'completed', 'cancelled')
      ),
      faculty_note TEXT DEFAULT '',
      suggested_slot TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      college_id INTEGER NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      details TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
