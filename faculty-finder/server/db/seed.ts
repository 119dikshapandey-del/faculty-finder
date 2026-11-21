import { hashPassword } from '../auth/security.ts';
import { getDb } from './database.ts';

export function seedDatabaseIfEmpty(): void {
  const db = getDb();
  const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM colleges').get() as { cnt: number };
  if (countRow.cnt > 0) return;

  const seedTx = db.transaction(() => {
    const passHash = hashPassword('Campus@2026');

    // College 1: NITM
    const c1 = db
      .prepare('INSERT INTO colleges (name, code, city, center_lat, center_lng) VALUES (?, ?, ?, ?, ?)')
      .run('National Institute of Technology & Management', 'NITM', 'Mumbai', 19.0760, 72.8777);
    const nitmId = Number(c1.lastInsertRowid);

    // College 2: MEC (to enforce & prove college-level data isolation)
    const c2 = db
      .prepare('INSERT INTO colleges (name, code, city, center_lat, center_lng) VALUES (?, ?, ?, ?, ?)')
      .run('Metropolitan Engineering College', 'MEC', 'Pune', 18.5204, 73.8567);
    const mecId = Number(c2.lastInsertRowid);

    // Departments for NITM
    const dCs = Number(
      db.prepare('INSERT INTO departments (college_id, name, code) VALUES (?, ?, ?)').run(nitmId, 'Computer Science', 'CS')
        .lastInsertRowid
    );
    const dIt = Number(
      db.prepare('INSERT INTO departments (college_id, name, code) VALUES (?, ?, ?)').run(nitmId, 'Information Technology', 'IT')
        .lastInsertRowid
    );
    const dEce = Number(
      db.prepare('INSERT INTO departments (college_id, name, code) VALUES (?, ?, ?)').run(nitmId, 'Electronics & Telecom', 'EXTC')
        .lastInsertRowid
    );
    const dMath = Number(
      db.prepare('INSERT INTO departments (college_id, name, code) VALUES (?, ?, ?)').run(nitmId, 'Applied Sciences', 'SCI')
        .lastInsertRowid
    );

    // Departments for MEC
    const dMecCs = Number(
      db.prepare('INSERT INTO departments (college_id, name, code) VALUES (?, ?, ?)').run(mecId, 'Computer Engineering', 'COMP')
        .lastInsertRowid
    );

    // Buildings for NITM (with OpenStreetMap coordinates)
    const bMain = Number(
      db
        .prepare(
          'INSERT INTO buildings (college_id, name, code, floors, latitude, longitude, description) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run(nitmId, 'Main Academic Hall', 'BLK-A', 4, 19.0764, 72.8772, 'Administration & Mathematics Wing')
        .lastInsertRowid
    );
    const bIt = Number(
      db
        .prepare(
          'INSERT INTO buildings (college_id, name, code, floors, latitude, longitude, description) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run(nitmId, 'Science & IT Block', 'BLK-B', 5, 19.0771, 72.8788, 'Information Technology & Computing Labs')
        .lastInsertRowid
    );
    const bCs = Number(
      db
        .prepare(
          'INSERT INTO buildings (college_id, name, code, floors, latitude, longitude, description) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run(nitmId, 'Academic Block C', 'BLK-C', 4, 19.0752, 72.8791, 'Computer Science Faculty Cabins & Seminar Hall')
        .lastInsertRowid
    );
    const bEng = Number(
      db
        .prepare(
          'INSERT INTO buildings (college_id, name, code, floors, latitude, longitude, description) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run(nitmId, 'Engineering Annex', 'BLK-E', 3, 19.0750, 72.8764, 'Electronics Labs & Faculty Rooms')
        .lastInsertRowid
    );

    // Buildings for MEC
    const bMec = Number(
      db
        .prepare(
          'INSERT INTO buildings (college_id, name, code, floors, latitude, longitude, description) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run(mecId, 'MEC Central Tower', 'MEC-1', 4, 18.5208, 73.8565, 'Main Engineering Block')
        .lastInsertRowid
    );

    // NITM Admin
    const adminNitm = Number(
      db
        .prepare(
          `INSERT INTO users (college_id, role, full_name, identifier, email, password_hash, department_id)
           VALUES (?, 'admin', ?, ?, ?, ?, ?)`
        )
        .run(nitmId, 'Rajesh Kulkarni', 'ADM001', 'admin@nitm.edu', passHash, dCs)
        .lastInsertRowid
    );

    // NITM Students
    const stu1 = Number(
      db
        .prepare(
          `INSERT INTO users (college_id, role, full_name, identifier, email, password_hash, department_id, student_semester)
           VALUES (?, 'student', ?, ?, ?, ?, ?, ?)`
        )
        .run(nitmId, 'Aryan Mehta', 'STU202401', 'aryan.mehta@nitm.edu', passHash, dCs, 4)
        .lastInsertRowid
    );
    const stu2 = Number(
      db
        .prepare(
          `INSERT INTO users (college_id, role, full_name, identifier, email, password_hash, department_id, student_semester)
           VALUES (?, 'student', ?, ?, ?, ?, ?, ?)`
        )
        .run(nitmId, 'Sneha Patel', 'STU202402', 'sneha.patel@nitm.edu', passHash, dIt, 4)
        .lastInsertRowid
    );

    // NITM Faculty
    const f1 = Number(
      db
        .prepare(
          `INSERT INTO users (college_id, role, full_name, identifier, email, password_hash, department_id, avatar_url)
           VALUES (?, 'faculty', ?, ?, ?, ?, ?, ?)`
        )
        .run(
          nitmId,
          'Dr. Anand Deshmukh',
          'FAC101',
          'dr.anand@nitm.edu',
          passHash,
          dCs,
          '/src/assets/images/faculty_portrait_1_1795250771794.jpg'
        )
        .lastInsertRowid
    );
    const f2 = Number(
      db
        .prepare(
          `INSERT INTO users (college_id, role, full_name, identifier, email, password_hash, department_id, avatar_url)
           VALUES (?, 'faculty', ?, ?, ?, ?, ?, ?)`
        )
        .run(
          nitmId,
          'Prof. Kavita Nair',
          'FAC102',
          'prof.kavita@nitm.edu',
          passHash,
          dIt,
          '/src/assets/images/faculty_portrait_2_1795250772042.jpg'
        )
        .lastInsertRowid
    );
    const f3 = Number(
      db
        .prepare(
          `INSERT INTO users (college_id, role, full_name, identifier, email, password_hash, department_id, avatar_url)
           VALUES (?, 'faculty', ?, ?, ?, ?, ?, ?)`
        )
        .run(
          nitmId,
          'Dr. Rohit Verma',
          'FAC103',
          'dr.rohit@nitm.edu',
          passHash,
          dEce,
          '/src/assets/images/faculty_portrait_3_1795250770763.jpg'
        )
        .lastInsertRowid
    );
    const f4 = Number(
      db
        .prepare(
          `INSERT INTO users (college_id, role, full_name, identifier, email, password_hash, department_id, avatar_url)
           VALUES (?, 'faculty', ?, ?, ?, ?, ?, ?)`
        )
        .run(
          nitmId,
          'Prof. Sunita Joshi',
          'FAC104',
          'prof.sunita@nitm.edu',
          passHash,
          dMath,
          '/src/assets/images/faculty_portrait_4_1795250771845.jpg'
        )
        .lastInsertRowid
    );

    const futureIso = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

    db.prepare(
      `INSERT INTO faculty_profiles (
         user_id, college_id, designation, subjects, cabin_number, building_id,
         working_hours, availability_status, status_message, approved_location,
         expected_return_time, status_expires_at, queue_open
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      f1,
      nitmId,
      'Professor & HOD',
      'Data Structures, Algorithms, Compiler Design',
      'Cabin C-204',
      bCs,
      'Mon-Fri · 09:30 AM - 05:00 PM',
      'Available',
      'Available for project review and academic advising.',
      'Academic Block C · Cabin C-204',
      '',
      futureIso,
      1
    );

    db.prepare(
      `INSERT INTO faculty_profiles (
         user_id, college_id, designation, subjects, cabin_number, building_id,
         working_hours, availability_status, status_message, approved_location,
         expected_return_time, status_expires_at, queue_open
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      f2,
      nitmId,
      'Associate Professor',
      'Database Management Systems, Web Engineering',
      'Cabin B-108',
      bIt,
      'Mon-Fri · 10:00 AM - 05:30 PM',
      'In Lecture',
      'Delivering DBMS lecture in Hall B-201.',
      'Science & IT Block · Hall B-201',
      '12:30 PM',
      futureIso,
      1
    );

    db.prepare(
      `INSERT INTO faculty_profiles (
         user_id, college_id, designation, subjects, cabin_number, building_id,
         working_hours, availability_status, status_message, approved_location,
         expected_return_time, status_expires_at, queue_open
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      f3,
      nitmId,
      'Assistant Professor',
      'Digital Signal Processing, Embedded Systems',
      'Cabin E-302',
      bEng,
      'Mon-Fri · 09:30 AM - 04:30 PM',
      'In Meeting',
      'Department accreditation review meeting.',
      'Engineering Annex · Conference Room 1',
      '03:15 PM',
      futureIso,
      0
    );

    db.prepare(
      `INSERT INTO faculty_profiles (
         user_id, college_id, designation, subjects, cabin_number, building_id,
         working_hours, availability_status, status_message, approved_location,
         expected_return_time, status_expires_at, queue_open
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      f4,
      nitmId,
      'Professor',
      'Linear Algebra, Discrete Mathematics',
      'Cabin A-112',
      bMain,
      'Mon-Fri · 09:00 AM - 04:00 PM',
      'Temporarily Away',
      'At Central Library reference desk.',
      'Main Academic Hall · Library Wing',
      '02:00 PM',
      futureIso,
      1
    );

    // Faculty Timetable samples
    const insertSlot = db.prepare(
      `INSERT INTO faculty_timetable (faculty_user_id, college_id, day_of_week, start_time, end_time, subject_name, room_label, suggested_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertSlot.run(f1, nitmId, 1, '10:00', '11:00', 'Data Structures', 'Room C-102', 'In Lecture');
    insertSlot.run(f1, nitmId, 3, '14:00', '15:00', 'Algorithms Lab', 'Lab C-201', 'In Lecture');
    insertSlot.run(f2, nitmId, 2, '11:00', '12:30', 'Database Management Systems', 'Hall B-201', 'In Lecture');
    insertSlot.run(f3, nitmId, 4, '10:30', '12:00', 'Embedded Systems', 'Room E-104', 'In Lecture');

    // Seed active queue entry for Dr. Anand (waiting for Aryan / Sneha)
    db.prepare(
      `INSERT INTO virtual_queues (college_id, faculty_user_id, student_user_id, token_number, reason, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(nitmId, f1, stu2, 1, 'DBMS / Project Schema Doubt Clarification', 'waiting');

    // Seed Appointments
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    db.prepare(
      `INSERT INTO appointments (college_id, faculty_user_id, student_user_id, requested_date, requested_slot, reason, status, faculty_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      nitmId,
      f1,
      stu1,
      tomorrow,
      '11:30 AM - 11:45 AM',
      'Final Year Project Synopsis Sign-off',
      'approved',
      'Bring printed synopsis copy to Cabin C-204.'
    );

    db.prepare(
      `INSERT INTO appointments (college_id, faculty_user_id, student_user_id, requested_date, requested_slot, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      nitmId,
      f2,
      stu1,
      tomorrow,
      '02:30 PM - 02:45 PM',
      'Internal Assignment Extension Discussion',
      'pending'
    );

    // Notifications
    db.prepare(
      `INSERT INTO notifications (college_id, user_id, title, message, category)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      nitmId,
      stu1,
      'Appointment Approved',
      'Dr. Anand Deshmukh approved your appointment for tomorrow at 11:30 AM.',
      'appointment'
    );

    db.prepare(
      `INSERT INTO notifications (college_id, user_id, title, message, category)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      nitmId,
      f1,
      'New Student in Virtual Queue',
      'Sneha Patel joined your virtual queue (Token #1).',
      'queue'
    );

    // College 2 (MEC) users (strictly isolated)
    db.prepare(
      `INSERT INTO users (college_id, role, full_name, identifier, email, password_hash, department_id)
       VALUES (?, 'admin', ?, ?, ?, ?, ?)`
    ).run(mecId, 'Vikram Patil', 'MECADM01', 'admin@mec.edu', passHash, dMecCs);

    const mecFac = Number(
      db
        .prepare(
          `INSERT INTO users (college_id, role, full_name, identifier, email, password_hash, department_id, avatar_url)
           VALUES (?, 'faculty', ?, ?, ?, ?, ?, ?)`
        )
        .run(
          mecId,
          'Dr. Neha Kulkarni',
          'MECFAC01',
          'dr.neha@mec.edu',
          passHash,
          dMecCs,
          '/src/assets/images/faculty_portrait_2_1795250772042.jpg'
        )
        .lastInsertRowid
    );
    db.prepare(
      `INSERT INTO faculty_profiles (
         user_id, college_id, designation, subjects, cabin_number, building_id,
         working_hours, availability_status, status_message, approved_location, status_expires_at, queue_open
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      mecFac,
      mecId,
      'Professor',
      'Operating Systems',
      'MEC-201',
      bMec,
      'Mon-Fri · 09:30 AM - 05:00 PM',
      'Available',
      'In MEC Central Tower cabin.',
      'MEC Central Tower · MEC-201',
      futureIso,
      1
    );
    db.prepare(
      `INSERT INTO users (college_id, role, full_name, identifier, email, password_hash, department_id, student_semester)
       VALUES (?, 'student', ?, ?, ?, ?, ?, ?)`
    ).run(mecId, 'Priya Nair', 'MEC202401', 'priya.nair@mec.edu', passHash, dMecCs, 6);

    db.prepare(
      `INSERT INTO activity_logs (college_id, actor_user_id, action, details)
       VALUES (?, ?, ?, ?)`
    ).run(nitmId, adminNitm, 'SYSTEM_SEED', 'Initialized NITM faculty directory, buildings, queues, and appointments.');
  });

  seedTx();
}
