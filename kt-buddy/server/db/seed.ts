import { db } from './database.ts';
import { hashPassword } from '../auth/security.ts';
import { buildSimplePdfBuffer, saveBufferToUploads } from '../utils/fileStorage.ts';

// Development-only demo password clearly documented in README.md and login screen
export const DEMO_PASSWORD = 'KTBuddy@2026';

function futureDateISO(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function pastDateISO(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export function seedDatabaseIfEmpty(): void {
  const existingCollege = db.prepare('SELECT COUNT(*) AS count FROM colleges').get() as { count: number };
  if (existingCollege.count > 0) {
    return;
  }

  // Generate real PDF documents for syllabi & study resources before transaction
  const javaSylPdf = saveBufferToUploads(
    buildSimplePdfBuffer('KT Buddy Official Syllabus - Java Programming (BCA201)', [
      'Department: Computer Science | Course: BCA | Semester: 2',
      'Academic Year: 2025-26 | Version: v2.1 (Latest Official KT Syllabus)',
      '------------------------------------------------------------------------',
      'Unit 1: Object-Oriented Foundations, JVM Architecture, Data Types & Control Flow',
      'Unit 2: Classes, Constructors, Inheritance, Polymorphism, Packages & Interfaces',
      'Unit 3: Exception Handling, Multithreading, Synchronization & Java I/O Streams',
      'Unit 4: Collections Framework (List, Set, Map), Generics & Lambda Expressions',
      'Unit 5: JDBC Database Connectivity & Event-Driven Desktop Components',
      '------------------------------------------------------------------------',
      'Recommended Examination Focus: Write modular code snippets for Units 2, 3, and 4.',
    ]),
    'BCA201_Java_Syllabus_v2_1.pdf'
  );

  const javaSylOldPdf = saveBufferToUploads(
    buildSimplePdfBuffer('KT Buddy Archive Syllabus - Java Programming (BCA201)', [
      'Department: Computer Science | Course: BCA | Semester: 2',
      'Academic Year: 2023-24 | Version: v1.0 (Previous Academic Cycle)',
      '------------------------------------------------------------------------',
      'Unit 1: Procedural vs Object-Oriented Concepts & Core Syntax',
      'Unit 2: Inheritance, Abstract Classes, Packages',
      'Unit 3: Applets, AWT Events & File Streams',
      'Unit 4: Exception Handling & Threads',
    ]),
    'BCA201_Java_Syllabus_v1_0.pdf'
  );

  const dbmsSylPdf = saveBufferToUploads(
    buildSimplePdfBuffer('KT Buddy Official Syllabus - Database Management Systems (BCA202)', [
      'Department: Computer Science | Course: BCA | Semester: 2',
      'Academic Year: 2025-26 | Version: v2.0 (Latest Official KT Syllabus)',
      '------------------------------------------------------------------------',
      'Unit 1: Database Architecture, Data Models, ER & Enhanced ER Diagrams',
      'Unit 2: Relational Algebra, Calculus & SQL DDL/DML/DCL Queries',
      'Unit 3: Functional Dependencies & Normalization (1NF, 2NF, 3NF, BCNF)',
      'Unit 4: Transaction Management, ACID Properties, Concurrency Control & Locking',
      'Unit 5: Indexing (B+ Trees), Query Optimization & Recovery Mechanisms',
    ]),
    'BCA202_DBMS_Syllabus_v2_0.pdf'
  );

  const pythonSylPdf = saveBufferToUploads(
    buildSimplePdfBuffer('KT Buddy Official Syllabus - Python Programming (BCA301)', [
      'Department: Computer Science | Course: BCA | Semester: 3',
      'Academic Year: 2025-26 | Version: v1.2 (Latest Official KT Syllabus)',
      '------------------------------------------------------------------------',
      'Unit 1: Python Syntax, Functions, Modules & File Handling',
      'Unit 2: Lists, Tuples, Dictionaries, Sets & Comprehensions',
      'Unit 3: Object-Oriented Python, Iterators & Generators',
      'Unit 4: Regular Expressions, JSON/CSV Processing & Error Handling',
      'Unit 5: Data Analysis Basics with NumPy & Tabular Data Manipulation',
    ]),
    'BCA301_Python_Syllabus_v1_2.pdf'
  );

  const javaPyqPdf = saveBufferToUploads(
    buildSimplePdfBuffer('Previous Year Question Paper - Java Programming (BCA201)', [
      'Examination: BCA Semester 2 Supplementary / Winter 2025 | Max Marks: 75 | Time: 3 Hours',
      '------------------------------------------------------------------------',
      'Q1. (a) Explain JVM, JRE, and JDK with architecture diagram. (7 Marks)',
      '    (b) Differentiate method overloading and method overriding with code. (8 Marks)',
      'Q2. (a) Demonstrate custom checked exception handling in Java. (8 Marks)',
      '    (b) Explain Thread lifecycle and synchronized blocks. (7 Marks)',
      'Q3. (a) Compare ArrayList, LinkedList, and HashMap time complexities. (8 Marks)',
      '    (b) Write a JDBC program to insert and fetch student records safely. (7 Marks)',
      'Q4. Attempt any two short notes: Interfaces, Packages, FileInputStream. (15 Marks)',
    ]),
    'BCA201_Java_PYQ_Winter_2025.pdf'
  );

  const dbmsPyqPdf = saveBufferToUploads(
    buildSimplePdfBuffer('Previous Year Question Paper - DBMS (BCA202)', [
      'Examination: BCA Semester 2 Supplementary / Summer 2025 | Max Marks: 75 | Time: 3 Hours',
      '------------------------------------------------------------------------',
      'Q1. Draw an ER diagram for a University Examination System showing cardinality. (15 Marks)',
      'Q2. (a) Explain 1NF, 2NF, 3NF, and BCNF with step-by-step decomposition. (10 Marks)',
      '    (b) Write SQL queries using GROUP BY, HAVING, and INNER JOIN. (5 Marks)',
      'Q3. Explain ACID properties and Two-Phase Locking (2PL) protocol. (15 Marks)',
      'Q4. Describe B+ Tree indexing and write-ahead log recovery techniques. (15 Marks)',
    ]),
    'BCA202_DBMS_PYQ_Summer_2025.pdf'
  );

  const javaNotesPdf = saveBufferToUploads(
    buildSimplePdfBuffer('Revision Notes - Java Programming Units 1 to 5 (BCA201)', [
      'Prepared by Department of Computer Science | AY 2025-26',
      '------------------------------------------------------------------------',
      'Key Concepts Summary:',
      '1. Encapsulation binds data and methods inside classes with private fields.',
      '2. Runtime polymorphism uses dynamic method dispatch on overridden methods.',
      '3. Always close JDBC PreparedStatement and Connection using try-with-resources.',
      '4. HashMap allows one null key; ConcurrentHashMap ensures thread-safe reads.',
      '5. Checked exceptions must be declared with throws or caught in try/catch.',
    ]),
    'BCA201_Java_Complete_Revision_Notes.pdf'
  );

  const dbmsImpPdf = saveBufferToUploads(
    buildSimplePdfBuffer('Important Questions Bank - DBMS (BCA202)', [
      'High-Priority KT Revision Topics | Semester 2',
      '------------------------------------------------------------------------',
      '1. Convert unnormalized invoice table into BCNF (Frequently asked 10-mark Q).',
      '2. Explain conflict serializability using precedence graphs.',
      '3. Compare Clustered vs Non-Clustered Indexes.',
      '4. Difference between DELETE, TRUNCATE, and DROP commands in SQL.',
      '5. Deadlock prevention schemes: Wait-Die and Wound-Wait.',
    ]),
    'BCA202_DBMS_Important_Questions.pdf'
  );

  const pythonPracticalPdf = saveBufferToUploads(
    buildSimplePdfBuffer('Practical Lab Manual - Python Programming (BCA301)', [
      'Semester 3 Practical Exam Guide | Department of Computer Science',
      '------------------------------------------------------------------------',
      'Exp 1: CSV parsing and summary aggregation using dictionaries.',
      'Exp 2: Implementing a Stack and Queue using OOP classes.',
      'Exp 3: File handling with exception-safe context managers.',
      'Exp 4: Regular expression validation for roll numbers and emails.',
    ]),
    'BCA301_Python_Practical_Manual.pdf'
  );

  const seedTx = db.transaction(() => {
    // 1. Colleges (2 colleges for strict tenant isolation)
    const col1 = db
      .prepare('INSERT INTO colleges (name, code, city, website) VALUES (?, ?, ?, ?)')
      .run('National Institute of Technology & Management', 'NITM-2026', 'Pune', 'https://nitm.edu')
      .lastInsertRowid as number;

    const col2 = db
      .prepare('INSERT INTO colleges (name, code, city, website) VALUES (?, ?, ?, ?)')
      .run('Horizon School of Computing', 'HSC-2026', 'Bengaluru', 'https://horizon.edu')
      .lastInsertRowid as number;

    // 2. Departments
    const deptCS = db
      .prepare('INSERT INTO departments (college_id, name, code, head_name) VALUES (?, ?, ?, ?)')
      .run(col1, 'Computer Science', 'CS', 'Dr. Arvind Kulkarni')
      .lastInsertRowid as number;

    const deptIT = db
      .prepare('INSERT INTO departments (college_id, name, code, head_name) VALUES (?, ?, ?, ?)')
      .run(col1, 'Information Technology', 'IT', 'Prof. Sneha Nair')
      .lastInsertRowid as number;

    const deptHSC = db
      .prepare('INSERT INTO departments (college_id, name, code, head_name) VALUES (?, ?, ?, ?)')
      .run(col2, 'Computer Applications', 'CA', 'Dr. K. Subramanian')
      .lastInsertRowid as number;

    // 3. Courses & Semesters
    const courseBCA = db
      .prepare('INSERT INTO courses (college_id, department_id, name, code, total_semesters) VALUES (?, ?, ?, ?, ?)')
      .run(col1, deptCS, 'BCA', 'BCA', 6)
      .lastInsertRowid as number;

    const courseBScIT = db
      .prepare('INSERT INTO courses (college_id, department_id, name, code, total_semesters) VALUES (?, ?, ?, ?, ?)')
      .run(col1, deptIT, 'B.Sc. IT', 'BSCIT', 6)
      .lastInsertRowid as number;

    const courseMCA = db
      .prepare('INSERT INTO courses (college_id, department_id, name, code, total_semesters) VALUES (?, ?, ?, ?, ?)')
      .run(col2, deptHSC, 'MCA', 'MCA', 4)
      .lastInsertRowid as number;

    for (let sem = 1; sem <= 6; sem++) {
      db.prepare('INSERT INTO semesters (college_id, course_id, semester_number, label) VALUES (?, ?, ?, ?)').run(
        col1,
        courseBCA,
        sem,
        `Semester ${sem}`
      );
      db.prepare('INSERT INTO semesters (college_id, course_id, semester_number, label) VALUES (?, ?, ?, ?)').run(
        col1,
        courseBScIT,
        sem,
        `Semester ${sem}`
      );
    }
    for (let sem = 1; sem <= 4; sem++) {
      db.prepare('INSERT INTO semesters (college_id, course_id, semester_number, label) VALUES (?, ?, ?, ?)').run(
        col2,
        courseMCA,
        sem,
        `Semester ${sem}`
      );
    }

    // 4. Users: Admin + Students
    const createUser = (
      collegeId: number,
      email: string,
      identifier: string,
      fullName: string,
      role: 'student' | 'admin'
    ) => {
      const { hash, salt } = hashPassword(DEMO_PASSWORD);
      return db
        .prepare(
          `INSERT INTO users (college_id, email, identifier, full_name, role, password_hash, password_salt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(collegeId, email, identifier, fullName, role, hash, salt).lastInsertRowid as number;
    };

    const adminUserId = createUser(col1, 'admin@nitm.edu', 'ADM-NITM-01', 'Rajeshwari Kulkarni (Exam Cell)', 'admin');
    const hscAdminUserId = createUser(col2, 'admin@horizon.edu', 'ADM-HSC-01', 'Suresh Menon (Admin)', 'admin');

    const rahulUserId = createUser(col1, 'rahul.sharma@nitm.edu', 'BCA2024001', 'Rahul Sharma', 'student');
    const ananyaUserId = createUser(col1, 'ananya.verma@nitm.edu', 'BCA2024002', 'Ananya Verma', 'student');
    const meeraUserId = createUser(col1, 'meera.deshmukh@nitm.edu', 'BSCIT2024005', 'Meera Deshmukh', 'student');
    const rohanUserId = createUser(col2, 'rohan.iyer@horizon.edu', 'MCA2025011', 'Rohan Iyer', 'student');

    const rahulStudentId = db
      .prepare(
        `INSERT INTO students (user_id, college_id, department_id, course_id, roll_number, year_of_study, semester, phone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(rahulUserId, col1, deptCS, courseBCA, 'BCA2024001', 2, 4, '+91 98201 11223').lastInsertRowid as number;

    const ananyaStudentId = db
      .prepare(
        `INSERT INTO students (user_id, college_id, department_id, course_id, roll_number, year_of_study, semester, phone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(ananyaUserId, col1, deptCS, courseBCA, 'BCA2024002', 2, 4, '+91 98201 44556').lastInsertRowid as number;

    const meeraStudentId = db
      .prepare(
        `INSERT INTO students (user_id, college_id, department_id, course_id, roll_number, year_of_study, semester, phone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(meeraUserId, col1, deptIT, courseBScIT, 'BSCIT2024005', 2, 4, '+91 98201 77889').lastInsertRowid as number;

    const rohanStudentId = db
      .prepare(
        `INSERT INTO students (user_id, college_id, department_id, course_id, roll_number, year_of_study, semester, phone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(rohanUserId, col2, deptHSC, courseMCA, 'MCA2025011', 1, 2, '+91 99001 22334').lastInsertRowid as number;

    // 5. Subjects
    const subjDSA = db
      .prepare(
        `INSERT INTO subjects (college_id, department_id, course_id, semester, subject_code, subject_name, credits)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(col1, deptCS, courseBCA, 1, 'BCA103', 'Data Structures & Algorithms', 4).lastInsertRowid as number;

    const subjJava = db
      .prepare(
        `INSERT INTO subjects (college_id, department_id, course_id, semester, subject_code, subject_name, credits)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(col1, deptCS, courseBCA, 2, 'BCA201', 'Java Programming', 4).lastInsertRowid as number;

    const subjDBMS = db
      .prepare(
        `INSERT INTO subjects (college_id, department_id, course_id, semester, subject_code, subject_name, credits)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(col1, deptCS, courseBCA, 2, 'BCA202', 'Database Management Systems', 4).lastInsertRowid as number;

    const subjPython = db
      .prepare(
        `INSERT INTO subjects (college_id, department_id, course_id, semester, subject_code, subject_name, credits)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(col1, deptCS, courseBCA, 3, 'BCA301', 'Python Programming', 4).lastInsertRowid as number;

    const subjCN = db
      .prepare(
        `INSERT INTO subjects (college_id, department_id, course_id, semester, subject_code, subject_name, credits)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(col1, deptCS, courseBCA, 3, 'BCA302', 'Computer Networks', 4).lastInsertRowid as number;

    const subjOS = db
      .prepare(
        `INSERT INTO subjects (college_id, department_id, course_id, semester, subject_code, subject_name, credits)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(col1, deptIT, courseBScIT, 2, 'BIT204', 'Operating Systems Architecture', 4).lastInsertRowid as number;

    const subjHSC = db
      .prepare(
        `INSERT INTO subjects (college_id, department_id, course_id, semester, subject_code, subject_name, credits)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(col2, deptHSC, courseMCA, 1, 'MCA102', 'Discrete Mathematics & Logic', 4).lastInsertRowid as number;

    // 6. Configurable University Result Rules
    const rules = [
      ['PASS', 'Cleared', 1, 'Official passing grade — marks KT as Cleared'],
      ['CLEARED', 'Cleared', 1, 'Supplementary pass — marks KT as Cleared'],
      ['KT', 'KT', 1, 'Official Keep Term backlog'],
      ['ATKT', 'KT', 1, 'Allowed To Keep Term backlog'],
      ['FAIL', 'KT', 0, 'Fail status — staged for admin verification before marking KT'],
      ['WH', 'Under Verification', 0, 'Withheld result — requires admin review, never auto-confirmed as KT'],
      ['AB', 'Under Verification', 0, 'Absent — requires admin review before confirming KT'],
      ['RP', 'Result Awaited', 0, 'Result pending from examination board'],
      ['REV', 'Revaluation Pending', 0, 'Revaluation in progress — hold final KT status'],
    ] as const;

    for (const [code, mapped, autoConfirm, desc] of rules) {
      db.prepare(
        `INSERT INTO result_rules (college_id, raw_code, mapped_clearance_status, auto_confirm, description, updated_by)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(col1, code, mapped, autoConfirm, desc, adminUserId);
      db.prepare(
        `INSERT INTO result_rules (college_id, raw_code, mapped_clearance_status, auto_confirm, description, updated_by)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(col2, code, mapped, autoConfirm, desc, hscAdminUserId);
    }

    // 7. Verified Student KT Records
    // Rahul Sharma: 4 tracked subjects -> 1 Cleared, 2 KT (Java, DBMS), 1 Result Awaited (Python)
    const ktRahulDSA = db
      .prepare(
        `INSERT INTO student_kt (college_id, student_id, subject_id, semester, academic_year, attempt_number, previous_status, latest_status, clearance_status, result_declaration_date, is_verified, verified_by, verified_at, source_type, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now', '-25 days'), 'admin_import', ?)`
      )
      .run(col1, rahulStudentId, subjDSA, 1, '2024-25', 2, 'KT', 'Cleared', 'Cleared', pastDateISO(25), adminUserId, 'Cleared in Semester 1 Supplementary Exam')
      .lastInsertRowid as number;

    const ktRahulJava = db
      .prepare(
        `INSERT INTO student_kt (college_id, student_id, subject_id, semester, academic_year, attempt_number, previous_status, latest_status, clearance_status, result_declaration_date, is_verified, verified_by, verified_at, source_type, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now', '-18 days'), 'admin_import', ?)`
      )
      .run(col1, rahulStudentId, subjJava, 2, '2025-26', 2, 'KT', 'KT', 'KT', pastDateISO(18), adminUserId, 'Theory backlog in Semester 2 — focus on Units 2 & 3')
      .lastInsertRowid as number;

    const ktRahulDBMS = db
      .prepare(
        `INSERT INTO student_kt (college_id, student_id, subject_id, semester, academic_year, attempt_number, previous_status, latest_status, clearance_status, result_declaration_date, is_verified, verified_by, verified_at, source_type, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now', '-18 days'), 'admin_import', ?)`
      )
      .run(col1, rahulStudentId, subjDBMS, 2, '2025-26', 2, 'KT', 'KT', 'KT', pastDateISO(18), adminUserId, 'Normalization & Transaction Concurrency section needs re-attempt')
      .lastInsertRowid as number;

    db.prepare(
      `INSERT INTO student_kt (college_id, student_id, subject_id, semester, academic_year, attempt_number, previous_status, latest_status, clearance_status, result_declaration_date, is_verified, verified_by, verified_at, source_type, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now', '-5 days'), 'admin_import', ?)`
    ).run(col1, rahulStudentId, subjPython, 3, '2025-26', 1, 'KT', 'Result Awaited', 'Result Awaited', pastDateISO(5), adminUserId, 'Supplementary answer sheet evaluation under final compilation');

    // Ananya Verma KTs
    db.prepare(
      `INSERT INTO student_kt (college_id, student_id, subject_id, semester, academic_year, attempt_number, previous_status, latest_status, clearance_status, result_declaration_date, is_verified, verified_by, verified_at, source_type, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now', '-14 days'), 'admin_import', ?)`
    ).run(col1, ananyaStudentId, subjCN, 3, '2025-26', 1, 'KT', 'Revaluation Pending', 'Revaluation Pending', pastDateISO(14), adminUserId, 'Revaluation application under university review');

    db.prepare(
      `INSERT INTO student_kt (college_id, student_id, subject_id, semester, academic_year, attempt_number, previous_status, latest_status, clearance_status, result_declaration_date, is_verified, verified_by, verified_at, source_type, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now', '-20 days'), 'admin_import', ?)`
    ).run(col1, ananyaStudentId, subjJava, 2, '2025-26', 2, 'KT', 'Cleared', 'Cleared', pastDateISO(20), adminUserId, 'Cleared in Supplementary Cycle');

    // Meera Deshmukh KT (IT Dept)
    db.prepare(
      `INSERT INTO student_kt (college_id, student_id, subject_id, semester, academic_year, attempt_number, previous_status, latest_status, clearance_status, result_declaration_date, is_verified, verified_by, verified_at, source_type, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now', '-10 days'), 'admin_import', ?)`
    ).run(col1, meeraStudentId, subjOS, 2, '2025-26', 1, 'KT', 'KT', 'KT', pastDateISO(10), adminUserId, 'Memory management module backlog');

    // HSC College student KT (isolated tenant)
    db.prepare(
      `INSERT INTO student_kt (college_id, student_id, subject_id, semester, academic_year, attempt_number, previous_status, latest_status, clearance_status, result_declaration_date, is_verified, verified_by, verified_at, source_type, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now', '-8 days'), 'admin_import', ?)`
    ).run(col2, rohanStudentId, subjHSC, 1, '2025-26', 1, 'KT', 'KT', 'KT', pastDateISO(8), hscAdminUserId, 'Semester 1 theory backlog');

    // 8. Seed initial Result Import + Result Records (including 1 Pending Verification record for Admin KT Verification queue!)
    const seedImportId = db
      .prepare(
        `INSERT INTO result_imports (college_id, file_name, file_type, total_rows, matched_rows, unmatched_rows, duplicate_rows, invalid_rows, confirmed_count, status, imported_by, error_report_json, summary_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Committed', ?, ?, ?)`
      )
      .run(
        col1,
        'NITM_BCA_Sem1_2_3_Official_Results.xlsx',
        'xlsx',
        5,
        5,
        0,
        0,
        0,
        4,
        adminUserId,
        JSON.stringify([]),
        JSON.stringify({ cleared: 2, kt: 2, needsVerification: 1 })
      ).lastInsertRowid as number;

    db.prepare(
      `INSERT INTO result_records (college_id, import_id, student_id, student_kt_id, roll_number, subject_code, subject_name, semester, academic_year, attempt_number, raw_result_status, mapped_status, previous_status, result_declaration_date, verification_status, imported_by, verified_by, verified_at, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Verified', ?, ?, datetime('now', '-25 days'), ?)`
    ).run(col1, seedImportId, rahulStudentId, ktRahulDSA, 'BCA2024001', 'BCA103', 'Data Structures & Algorithms', 1, '2024-25', 2, 'CLEARED', 'Cleared', 'KT', pastDateISO(25), adminUserId, adminUserId, 'Verified from official supplementary ledger');

    db.prepare(
      `INSERT INTO result_records (college_id, import_id, student_id, student_kt_id, roll_number, subject_code, subject_name, semester, academic_year, attempt_number, raw_result_status, mapped_status, previous_status, result_declaration_date, verification_status, imported_by, verified_by, verified_at, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Verified', ?, ?, datetime('now', '-18 days'), ?)`
    ).run(col1, seedImportId, rahulStudentId, ktRahulJava, 'BCA2024001', 'BCA201', 'Java Programming', 2, '2025-26', 2, 'KT', 'KT', 'KT', pastDateISO(18), adminUserId, adminUserId, 'Verified from official ledger');

    db.prepare(
      `INSERT INTO result_records (college_id, import_id, student_id, student_kt_id, roll_number, subject_code, subject_name, semester, academic_year, attempt_number, raw_result_status, mapped_status, previous_status, result_declaration_date, verification_status, imported_by, verified_by, verified_at, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Verified', ?, ?, datetime('now', '-18 days'), ?)`
    ).run(col1, seedImportId, rahulStudentId, ktRahulDBMS, 'BCA2024001', 'BCA202', 'Database Management Systems', 2, '2025-26', 2, 'KT', 'KT', 'KT', pastDateISO(18), adminUserId, adminUserId, 'Verified from official ledger');

    // Pending verification record in queue (Withheld status for Ananya / Computer Networks) so Admin KT Verification page shows an actionable item immediately
    db.prepare(
      `INSERT INTO result_records (college_id, import_id, student_id, student_kt_id, roll_number, subject_code, subject_name, semester, academic_year, attempt_number, raw_result_status, mapped_status, previous_status, result_declaration_date, verification_status, imported_by, remarks)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Verification', ?, ?)`
    ).run(col1, seedImportId, ananyaStudentId, 'BCA2024002', 'BCA302', 'Computer Networks', 3, '2025-26', 1, 'WH', 'Under Verification', 'KT', pastDateISO(3), adminUserId, 'Withheld status flagged during import — requires Exam Cell verification');

    // 9. Syllabi (with version labels and real downloadable PDF paths)
    db.prepare(
      `INSERT INTO syllabus (college_id, department_id, course_id, subject_id, semester, academic_year, version_label, title, unit_topics_json, file_name, file_path, file_size_bytes, is_latest, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
    ).run(
      col1,
      deptCS,
      courseBCA,
      subjJava,
      2,
      '2025-26',
      'v2.1 (Latest KT Syllabus)',
      'Java Programming — Official KT Syllabus',
      JSON.stringify([
        'Unit 1: OOP Foundations, JVM Architecture & Control Flow',
        'Unit 2: Classes, Inheritance, Polymorphism, Packages & Interfaces',
        'Unit 3: Exception Handling, Multithreading & I/O Streams',
        'Unit 4: Collections Framework, Generics & Lambda Expressions',
        'Unit 5: JDBC Connectivity & Desktop Event Handling',
      ]),
      javaSylPdf.fileName,
      javaSylPdf.storedPath,
      javaSylPdf.sizeBytes,
      adminUserId
    );

    db.prepare(
      `INSERT INTO syllabus (college_id, department_id, course_id, subject_id, semester, academic_year, version_label, title, unit_topics_json, file_name, file_path, file_size_bytes, is_latest, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
    ).run(
      col1,
      deptCS,
      courseBCA,
      subjJava,
      2,
      '2023-24',
      'v1.0 (Prior Cycle Archive)',
      'Java Programming — 2023-24 Archive Syllabus',
      JSON.stringify([
        'Unit 1: Procedural vs OOP & Java Basics',
        'Unit 2: Inheritance, Abstract Classes & Packages',
        'Unit 3: Applets, AWT Events & File Streams',
        'Unit 4: Exception Handling & Multithreading',
      ]),
      javaSylOldPdf.fileName,
      javaSylOldPdf.storedPath,
      javaSylOldPdf.sizeBytes,
      adminUserId
    );

    db.prepare(
      `INSERT INTO syllabus (college_id, department_id, course_id, subject_id, semester, academic_year, version_label, title, unit_topics_json, file_name, file_path, file_size_bytes, is_latest, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
    ).run(
      col1,
      deptCS,
      courseBCA,
      subjDBMS,
      2,
      '2025-26',
      'v2.0 (Latest KT Syllabus)',
      'Database Management Systems — Official KT Syllabus',
      JSON.stringify([
        'Unit 1: Database Architecture, ER & Enhanced ER Modeling',
        'Unit 2: Relational Algebra & SQL DDL/DML/DCL Queries',
        'Unit 3: Functional Dependencies & Normalization (1NF–BCNF)',
        'Unit 4: ACID Transactions, Concurrency Control & Locking',
        'Unit 5: B+ Tree Indexing, Query Optimization & Recovery',
      ]),
      dbmsSylPdf.fileName,
      dbmsSylPdf.storedPath,
      dbmsSylPdf.sizeBytes,
      adminUserId
    );

    db.prepare(
      `INSERT INTO syllabus (college_id, department_id, course_id, subject_id, semester, academic_year, version_label, title, unit_topics_json, file_name, file_path, file_size_bytes, is_latest, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
    ).run(
      col1,
      deptCS,
      courseBCA,
      subjPython,
      3,
      '2025-26',
      'v1.2 (Latest KT Syllabus)',
      'Python Programming — Official KT Syllabus',
      JSON.stringify([
        'Unit 1: Python Syntax, Functions, Modules & File Handling',
        'Unit 2: Lists, Tuples, Dictionaries, Sets & Comprehensions',
        'Unit 3: Object-Oriented Python, Iterators & Generators',
        'Unit 4: Regular Expressions, JSON/CSV & Exception Safety',
        'Unit 5: Data Analysis Basics with NumPy & Tabular Data',
      ]),
      pythonSylPdf.fileName,
      pythonSylPdf.storedPath,
      pythonSylPdf.sizeBytes,
      adminUserId
    );

    // 10. Study Materials & PYQs
    const materials = [
      {
        dept: deptCS,
        course: courseBCA,
        subj: subjJava,
        sem: 2,
        year: '2025-26',
        type: 'PYQ',
        title: 'Java Programming — Winter 2025 Question Paper',
        desc: 'Official 75-mark BCA Semester 2 supplementary question paper covering OOP, threads, and JDBC.',
        url: null,
        file: javaPyqPdf,
      },
      {
        dept: deptCS,
        course: courseBCA,
        subj: subjDBMS,
        sem: 2,
        year: '2025-26',
        type: 'PYQ',
        title: 'DBMS — Summer 2025 Question Paper',
        desc: 'Official Semester 2 question paper with normalization, SQL joins, and transaction locking problems.',
        url: null,
        file: dbmsPyqPdf,
      },
      {
        dept: deptCS,
        course: courseBCA,
        subj: subjJava,
        sem: 2,
        year: '2025-26',
        type: 'Notes',
        title: 'Java Unit-wise Complete Revision Notes',
        desc: 'Concise unit-by-unit summary covering JVM, polymorphism, Collections, and JDBC best practices.',
        url: null,
        file: javaNotesPdf,
      },
      {
        dept: deptCS,
        course: courseBCA,
        subj: subjDBMS,
        sem: 2,
        year: '2025-26',
        type: 'Important Questions',
        title: 'DBMS Normalization & Concurrency Important Questions',
        desc: 'Curated high-frequency theory and BCNF decomposition problems for KT preparation.',
        url: null,
        file: dbmsImpPdf,
      },
      {
        dept: deptCS,
        course: courseBCA,
        subj: subjPython,
        sem: 3,
        year: '2025-26',
        type: 'Practical Material',
        title: 'Python Programming Practical Lab Manual',
        desc: 'Lab programs for CSV parsing, OOP stacks/queues, file managers, and regex validation.',
        url: null,
        file: pythonPracticalPdf,
      },
      {
        dept: deptCS,
        course: courseBCA,
        subj: subjDBMS,
        sem: 2,
        year: '2025-26',
        type: 'Reference Book',
        title: 'PostgreSQL & Relational Design Official Documentation',
        desc: 'External open-access educational reference covering relational constraints, SQL joins, and indexing.',
        url: 'https://www.postgresql.org/docs/current/tutorial.html',
        file: null,
      },
    ];

    for (const m of materials) {
      db.prepare(
        `INSERT INTO study_materials (college_id, department_id, course_id, subject_id, semester, academic_year, resource_type, title, description, external_url, file_name, file_path, file_size_bytes, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        col1,
        m.dept,
        m.course,
        m.subj,
        m.sem,
        m.year,
        m.type,
        m.title,
        m.desc,
        m.url,
        m.file ? m.file.fileName : null,
        m.file ? m.file.storedPath : null,
        m.file ? m.file.sizeBytes : 0,
        adminUserId
      );
    }

    // 11. KT Examination Timetable Schedules
    db.prepare(
      `INSERT INTO exam_schedules (college_id, course_id, subject_id, semester, exam_session, exam_date, start_time, end_time, venue, instructions, is_changed, change_note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)`
    ).run(
      col1,
      courseBCA,
      subjJava,
      2,
      'KT Supplementary Cycle — Morning',
      futureDateISO(9),
      '10:00',
      '13:00',
      'Block A, Examination Hall 204',
      'Carry college ID card and supplementary hall ticket. Report 20 minutes early.',
      adminUserId
    );

    db.prepare(
      `INSERT INTO exam_schedules (college_id, course_id, subject_id, semester, exam_session, exam_date, start_time, end_time, venue, instructions, is_changed, change_note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    ).run(
      col1,
      courseBCA,
      subjDBMS,
      2,
      'KT Supplementary Cycle — Afternoon',
      futureDateISO(12),
      '14:00',
      '17:00',
      'Block B, Examination Hall 102',
      'Non-programmable scientific calculators not required. ER diagram stencils allowed.',
      'Venue updated from Hall 105 to Hall 102 by Examination Cell.',
      adminUserId
    );

    db.prepare(
      `INSERT INTO exam_schedules (college_id, course_id, subject_id, semester, exam_session, exam_date, start_time, end_time, venue, instructions, is_changed, change_note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)`
    ).run(
      col1,
      courseBCA,
      subjPython,
      3,
      'ATKT Theory Cycle — Morning',
      futureDateISO(16),
      '10:00',
      '13:00',
      'Block A, Examination Hall 301',
      'Standard 75-mark theory examination.',
      adminUserId
    );

    // 12. Announcements & Notifications
    db.prepare(
      `INSERT INTO announcements (college_id, title, content, category, target_department_id, target_course_id, target_semester, publish_date, expiry_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      col1,
      'BCA Semester 2 & 3 KT Supplementary Examination Timetable Published',
      'The official supplementary examination timetable for Java Programming (BCA201), DBMS (BCA202), and Python Programming (BCA301) is now live. Note that the DBMS exam venue has been updated to Block B, Hall 102.',
      'Examination',
      deptCS,
      courseBCA,
      null,
      pastDateISO(2),
      futureDateISO(30),
      adminUserId
    );

    db.prepare(
      `INSERT INTO announcements (college_id, title, content, category, target_department_id, target_course_id, target_semester, publish_date, expiry_date, created_by)
       VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?)`
    ).run(
      col1,
      'Updated AY 2025-26 KT Syllabi & PYQ Archives Uploaded',
      'Latest verified syllabi (including previous cycle version labels) and Winter/Summer 2025 Previous Year Question Papers are now available for download under Syllabus and Study Resources.',
      'Academic',
      pastDateISO(4),
      futureDateISO(45),
      adminUserId
    );

    const sampleNotifs = [
      [
        rahulUserId,
        'exam_change',
        'Exam Venue Updated: DBMS (BCA202)',
        'Your Semester 2 KT exam venue for Database Management Systems has changed to Block B, Examination Hall 102.',
        'exam_schedule',
      ],
      [
        rahulUserId,
        'result_cleared',
        'KT Subject Cleared: Data Structures & Algorithms',
        'Your Semester 1 backlog in BCA103 (Data Structures & Algorithms) has been verified as Cleared by the Exam Cell.',
        'student_kt',
      ],
      [
        rahulUserId,
        'resource_uploaded',
        'New PYQ Uploaded: Java Programming (Winter 2025)',
        'Winter 2025 Previous Year Question Paper and revision notes for BCA201 are now ready for download.',
        'study_material',
      ],
    ] as const;

    for (const [uid, type, title, msg, rel] of sampleNotifs) {
      db.prepare(
        `INSERT INTO notifications (college_id, user_id, type, title, message, is_read, related_entity)
         VALUES (?, ?, ?, ?, ?, 0, ?)`
      ).run(col1, uid, type, title, msg, rel);
    }

    db.prepare(
      `INSERT INTO activity_logs (college_id, actor_user_id, action, target_type, target_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(col1, adminUserId, 'SEED_ACADEMIC_DATA', 'result_imports', seedImportId, 'Initialized KT Buddy official sample college data');
  });

  seedTx();
}
