import { ffDb } from './database.ts';
import { hashFfPassword } from '../facultyAuth/security.ts';

export function seedFacultyDatabaseIfEmpty(): void {
  const existing = ffDb.prepare('SELECT COUNT(*) AS cnt FROM ff_colleges').get() as { cnt: number };
  if (existing.cnt > 0) return;

  const insertCollege = ffDb.prepare(
    'INSERT INTO ff_colleges (name, code, city, center_lat, center_lng) VALUES (?, ?, ?, ?, ?)'
  );
  const nitmId = Number(
    insertCollege.run('National Institute of Technology & Management', 'NITM', 'Pune', 18.5204, 73.8567).lastInsertRowid
  );
  const mecId = Number(
    insertCollege.run('Metro Engineering College', 'MEC', 'Mumbai', 19.076, 72.8777).lastInsertRowid
  );

  const insertDept = ffDb.prepare('INSERT INTO ff_departments (college_id, name, code) VALUES (?, ?, ?)');
  const csDept = Number(insertDept.run(nitmId, 'Computer Science & Engineering', 'CSE').lastInsertRowid);
  const itDept = Number(insertDept.run(nitmId, 'Information Technology', 'IT').lastInsertRowid);
  const eceDept = Number(insertDept.run(nitmId, 'Electronics & Communication', 'ECE').lastInsertRowid);
  const mecCsDept = Number(insertDept.run(mecId, 'Computer Engineering', 'COMP').lastInsertRowid);

  const insertBuilding = ffDb.prepare(
    'INSERT INTO ff_buildings (college_id, name, code, lat, lng, floors, description) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const bBlockA = Number(
    insertBuilding.run(
      nitmId,
      'Academic Block A',
      'BLK-A',
      18.5212,
      73.8559,
      'G + 3 Floors',
      'Main undergraduate lecture halls and CSE faculty cabins'
    ).lastInsertRowid
  );
  const bCsTower = Number(
    insertBuilding.run(
      nitmId,
      'CS & IT Innovation Tower',
      'CSIT',
      18.5205,
      73.8574,
      'G + 4 Floors',
      'Computing labs, seminar halls, and IT faculty wing'
    ).lastInsertRowid
  );
  const bResearch = Number(
    insertBuilding.run(
      nitmId,
      'Central Research Wing',
      'CRW',
      18.5197,
      73.8563,
      'G + 2 Floors',
      'Electronics laboratories and research faculty offices'
    ).lastInsertRowid
  );
  const bAdmin = Number(
    insertBuilding.run(
      nitmId,
      'Administration & Dean Block',
      'ADM',
      18.5208,
      73.8566,
      'G + 1 Floor',
      'Dean offices, HOD rooms, and examination cell'
    ).lastInsertRowid
  );
  const mecBuilding = Number(
    insertBuilding.run(mecId, 'Main Academic Complex', 'MEC-1', 19.0762, 72.8779, 'G + 4 Floors', 'Primary campus block')
      .lastInsertRowid
  );

  const insertUser = ffDb.prepare(`
    INSERT INTO ff_users (
      college_id, email, identifier, full_name, role,
      department_id, designation, subjects_json, cabin_number, building_id,
      working_hours, semester, password_hash, password_salt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const mkCreds = () => hashFfPassword('Campus@2026');

  // College 1 (NITM) Students
  const s1Cred = mkCreds();
  const stu1 = Number(
    insertUser.run(
      nitmId,
      'aarav.mehta@nitm.edu',
      'STU202401',
      'Aarav Mehta',
      'student',
      csDept,
      null,
      '[]',
      null,
      null,
      null,
      4,
      s1Cred.hash,
      s1Cred.salt
    ).lastInsertRowid
  );

  const s2Cred = mkCreds();
  const stu2 = Number(
    insertUser.run(
      nitmId,
      'diya.patel@nitm.edu',
      'STU202402',
      'Diya Patel',
      'student',
      itDept,
      null,
      '[]',
      null,
      null,
      null,
      4,
      s2Cred.hash,
      s2Cred.salt
    ).lastInsertRowid
  );

  // College 1 (NITM) Faculty
  const f1Cred = mkCreds();
  const fac1 = Number(
    insertUser.run(
      nitmId,
      'arvind.deshmukh@nitm.edu',
      'FAC101',
      'Dr. Arvind Deshmukh',
      'faculty',
      csDept,
      'Professor & Head of CSE',
      JSON.stringify(['Data Structures', 'Algorithms', 'Compiler Design']),
      'A-204',
      bBlockA,
      '09:30 AM - 05:00 PM',
      null,
      f1Cred.hash,
      f1Cred.salt
    ).lastInsertRowid
  );

  const f2Cred = mkCreds();
  const fac2 = Number(
    insertUser.run(
      nitmId,
      'sneha.joshi@nitm.edu',
      'FAC102',
      'Prof. Sneha Joshi',
      'faculty',
      csDept,
      'Assistant Professor',
      JSON.stringify(['Database Management Systems', 'SQL & NoSQL Systems']),
      'C-312',
      bCsTower,
      '09:00 AM - 04:30 PM',
      null,
      f2Cred.hash,
      f2Cred.salt
    ).lastInsertRowid
  );

  const f3Cred = mkCreds();
  const fac3 = Number(
    insertUser.run(
      nitmId,
      'vikram.rao@nitm.edu',
      'FAC103',
      'Dr. Vikram Rao',
      'faculty',
      itDept,
      'Associate Professor',
      JSON.stringify(['Computer Networks', 'Cloud Architecture', 'Distributed Systems']),
      'C-405',
      bCsTower,
      '10:00 AM - 05:30 PM',
      null,
      f3Cred.hash,
      f3Cred.salt
    ).lastInsertRowid
  );

  const f4Cred = mkCreds();
  const fac4 = Number(
    insertUser.run(
      nitmId,
      'kavita.nair@nitm.edu',
      'FAC104',
      'Prof. Kavita Nair',
      'faculty',
      eceDept,
      'Assistant Professor',
      JSON.stringify(['Digital Signal Processing', 'Embedded Systems']),
      'R-108',
      bResearch,
      '09:00 AM - 04:00 PM',
      null,
      f4Cred.hash,
      f4Cred.salt
    ).lastInsertRowid
  );

  const f5Cred = mkCreds();
  const fac5 = Number(
    insertUser.run(
      nitmId,
      'rohan.kulkarni@nitm.edu',
      'FAC105',
      'Dr. Rohan Kulkarni',
      'faculty',
      itDept,
      'Professor',
      JSON.stringify(['Operating Systems', 'Information Security']),
      'D-102',
      bAdmin,
      '09:30 AM - 05:00 PM',
      null,
      f5Cred.hash,
      f5Cred.salt
    ).lastInsertRowid
  );

  // College 1 (NITM) Admin
  const a1Cred = mkCreds();
  insertUser.run(
    nitmId,
    'ffadmin@nitm.edu',
    'ADM001',
    'Rajesh Sharma (Campus Admin)',
    'admin',
    null,
    'Campus Operations Administrator',
    '[]',
    'ADM-101',
    bAdmin,
    '09:00 AM - 05:30 PM',
    null,
    a1Cred.hash,
    a1Cred.salt
  );

  // College 2 (MEC) isolated users
  const mecF = mkCreds();
  const mecFacId = Number(
    insertUser.run(
      mecId,
      'siddharth.verma@mec.edu',
      'MEC_FAC01',
      'Prof. Siddharth Verma',
      'faculty',
      mecCsDept,
      'Associate Professor',
      JSON.stringify(['Machine Learning', 'Python Programming']),
      'M-201',
      mecBuilding,
      '09:00 AM - 04:30 PM',
      null,
      mecF.hash,
      mecF.salt
    ).lastInsertRowid
  );
  const mecS = mkCreds();
  insertUser.run(
    mecId,
    'kabir.shah@mec.edu',
    'MEC_STU01',
    'Kabir Shah',
    'student',
    mecCsDept,
    null,
    '[]',
    null,
    null,
    null,
    6,
    mecS.hash,
    mecS.salt
  );
  const mecA = mkCreds();
  insertUser.run(
    mecId,
    'ffadmin@mec.edu',
    'MEC_ADM01',
    'Meera Iyer (MEC Admin)',
    'admin',
    null,
    'College Admin',
    '[]',
    'MEC-100',
    mecBuilding,
    '09:00 AM - 05:00 PM',
    null,
    mecA.hash,
    mecA.salt
  );

  // Seed Faculty Statuses (including one active Available, one In Lecture, one In Meeting, one Temporarily Away, one On Leave)
  const insertStatus = ffDb.prepare(`
    INSERT INTO ff_faculty_status (
      faculty_id, college_id, manual_status, status_message,
      expected_return_time, location_label, expires_at, queue_open
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const inTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const inFourHours = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

  insertStatus.run(
    fac1,
    nitmId,
    'Available',
    'Available in cabin A-204 for project & subject doubts.',
    '',
    'Academic Block A — Cabin A-204',
    inFourHours,
    1
  );
  insertStatus.run(
    fac2,
    nitmId,
    'In Lecture',
    'Teaching DBMS Unit 3 in Lab C-201.',
    '01:15 PM',
    'CS & IT Innovation Tower — Room C-201',
    inTwoHours,
    1
  );
  insertStatus.run(
    fac3,
    nitmId,
    'In Meeting',
    'Department accreditation review meeting.',
    '03:30 PM',
    'Administration & Dean Block — Conference Room',
    inTwoHours,
    0
  );
  insertStatus.run(
    fac4,
    nitmId,
    'Temporarily Away',
    'Visiting Central Library for reference verification.',
    '02:00 PM',
    'Central Research Wing',
    inTwoHours,
    1
  );
  insertStatus.run(
    fac5,
    nitmId,
    'On Leave',
    'Attending IEEE workshop outside campus today.',
    'Tomorrow 09:30 AM',
    'Away from Campus',
    null,
    0
  );
  insertStatus.run(
    mecFacId,
    mecId,
    'Available',
    'Available for student consultations.',
    '',
    'Main Academic Complex — M-201',
    null,
    1
  );

  // Seed Timetables
  const insertTt = ffDb.prepare(
    'INSERT INTO ff_faculty_timetable (college_id, faculty_id, day_of_week, start_time, end_time, subject, room, activity_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insertTt.run(nitmId, fac1, 'Monday', '10:00', '11:00', 'Data Structures', 'A-101', 'Lecture');
  insertTt.run(nitmId, fac1, 'Wednesday', '14:00', '15:30', 'Office Hours', 'Cabin A-204', 'Office Hours');
  insertTt.run(nitmId, fac2, 'Tuesday', '11:00', '12:30', 'Database Management Systems', 'C-201', 'Lab');
  insertTt.run(nitmId, fac2, 'Friday', '15:00', '16:30', 'DBMS Doubt Clearing', 'Cabin C-312', 'Office Hours');
  insertTt.run(nitmId, fac3, 'Thursday', '10:30', '12:00', 'Computer Networks', 'C-301', 'Lecture');

  // Seed Virtual Queue & Appointments
  const insertQ = ffDb.prepare(
    'INSERT INTO ff_virtual_queue (college_id, faculty_id, student_id, token_number, reason, status) VALUES (?, ?, ?, ?, ?, ?)'
  );
  insertQ.run(nitmId, fac1, stu2, 1, 'Review mini-project architecture diagram', 'Waiting');
  insertQ.run(nitmId, fac1, stu1, 2, 'Clarify assignment 4 dynamic programming rubric', 'Waiting');

  const today = new Date().toISOString().slice(0, 10);
  const insertAppt = ffDb.prepare(
    'INSERT INTO ff_appointments (college_id, faculty_id, student_id, requested_date, requested_time, reason, status, faculty_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insertAppt.run(
    nitmId,
    fac2,
    stu1,
    today,
    '03:30 PM',
    'Discuss ER normalization feedback on lab submission',
    'Accepted',
    'Meet at Cabin C-312 right after the afternoon lab.'
  );
  insertAppt.run(
    nitmId,
    fac1,
    stu1,
    today,
    '04:15 PM',
    'Request LOR discussion for summer internship',
    'Pending',
    ''
  );

  // Seed Recently Viewed & Notifications
  ffDb
    .prepare('INSERT INTO ff_recently_viewed (college_id, student_id, faculty_id) VALUES (?, ?, ?)')
    .run(nitmId, stu1, fac1);
  ffDb
    .prepare('INSERT INTO ff_recently_viewed (college_id, student_id, faculty_id) VALUES (?, ?, ?)')
    .run(nitmId, stu1, fac2);

  const insertNotif = ffDb.prepare(
    'INSERT INTO ff_notifications (college_id, user_id, title, message) VALUES (?, ?, ?, ?)'
  );
  insertNotif.run(
    nitmId,
    stu1,
    'Appointment Accepted',
    'Prof. Sneha Joshi accepted your appointment for today at 03:30 PM.'
  );
  insertNotif.run(
    nitmId,
    fac1,
    'New Queue & Appointment Activity',
    '2 students are waiting in your cabin virtual queue and 1 appointment request is pending.'
  );
}
