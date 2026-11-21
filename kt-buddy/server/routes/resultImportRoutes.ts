import ExcelJS from 'exceljs';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { Router } from 'express';
import { db } from '../db/database.ts';
import {
  type AuthedRequest,
  createNotificationForUser,
  isValidDateYYYYMMDD,
  logActivity,
  requireAuth,
  requireRole,
  sanitizeText,
} from '../auth/security.ts';
import {
  ALLOWED_SPREADSHEET_EXTENSIONS,
  MAX_UPLOAD_SIZE_BYTES,
  resolveSafeUploadPath,
} from '../utils/fileStorage.ts';

export const resultImportRoutes = Router();

resultImportRoutes.use(requireAuth, requireRole('admin'));

const spreadsheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
});

const ALLOWED_CLEARANCE_STATUSES = [
  'KT',
  'Cleared',
  'Result Awaited',
  'Under Verification',
  'Revaluation Pending',
] as const;

type ClearanceStatus = (typeof ALLOWED_CLEARANCE_STATUSES)[number];

interface ParsedPreviewRow {
  rowNumber: number;
  rollNumber: string;
  subjectCode: string;
  academicYear: string;
  attemptNumber: number;
  rawStatus: string;
  declarationDate: string;
  studentId: number | null;
  studentName: string | null;
  studentUserId: number | null;
  subjectId: number | null;
  subjectName: string | null;
  semester: number | null;
  mappedStatus: ClearanceStatus;
  autoConfirm: boolean;
  validationStatus: 'Valid' | 'Needs Review' | 'Duplicate' | 'Unmatched' | 'Invalid';
  issueNote: string | null;
}

// 1. Configurable Result Rules
resultImportRoutes.get('/result-rules', (req: AuthedRequest, res) => {
  const rules = db
    .prepare('SELECT * FROM result_rules WHERE college_id = ? ORDER BY raw_code ASC')
    .all(req.user!.college_id);
  res.json({ rules });
});

resultImportRoutes.post('/result-rules', (req: AuthedRequest, res) => {
  const user = req.user!;
  const rawCode = sanitizeText(req.body?.rawCode, 30).toUpperCase();
  const mappedStatus = sanitizeText(req.body?.mappedClearanceStatus, 40) as ClearanceStatus;
  const autoConfirm = req.body?.autoConfirm ? 1 : 0;
  const description = sanitizeText(req.body?.description, 200);

  if (!rawCode || !ALLOWED_CLEARANCE_STATUSES.includes(mappedStatus)) {
    res.status(400).json({ error: 'Valid result code and target clearance status are required.' });
    return;
  }

  db.prepare(
    `INSERT INTO result_rules (college_id, raw_code, mapped_clearance_status, auto_confirm, description, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(college_id, raw_code) DO UPDATE SET
       mapped_clearance_status = excluded.mapped_clearance_status,
       auto_confirm = excluded.auto_confirm,
       description = excluded.description,
       updated_by = excluded.updated_by,
       updated_at = datetime('now')`
  ).run(user.college_id, rawCode, mappedStatus, autoConfirm, description, user.id);

  logActivity(user.college_id, user.id, 'UPDATE_RESULT_RULE', 'result_rules', null, `${rawCode} -> ${mappedStatus} (auto=${autoConfirm})`);
  res.json({ message: `Result mapping rule saved for "${rawCode}".` });
});

resultImportRoutes.delete('/result-rules/:id', (req: AuthedRequest, res) => {
  const user = req.user!;
  db.prepare('DELETE FROM result_rules WHERE id = ? AND college_id = ?').run(Number(req.params.id), user.college_id);
  res.json({ message: 'Result rule removed.' });
});

// 2. Download Sample Excel (.xlsx) Template matching real seeded students & subjects
resultImportRoutes.get('/results/template', async (_req: AuthedRequest, res) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Official_Results');
  sheet.columns = [
    { header: 'roll_number', key: 'roll_number', width: 16 },
    { header: 'subject_code', key: 'subject_code', width: 15 },
    { header: 'academic_year', key: 'academic_year', width: 15 },
    { header: 'attempt_number', key: 'attempt_number', width: 16 },
    { header: 'result_status', key: 'result_status', width: 16 },
    { header: 'declaration_date', key: 'declaration_date', width: 18 },
  ];

  const today = new Date().toISOString().slice(0, 10);
  sheet.addRow({
    roll_number: 'BCA2024001',
    subject_code: 'BCA201',
    academic_year: '2025-26',
    attempt_number: 3,
    result_status: 'PASS',
    declaration_date: today,
  });
  sheet.addRow({
    roll_number: 'BCA2024001',
    subject_code: 'BCA301',
    academic_year: '2025-26',
    attempt_number: 1,
    result_status: 'KT',
    declaration_date: today,
  });
  sheet.addRow({
    roll_number: 'BCA2024002',
    subject_code: 'BCA302',
    academic_year: '2025-26',
    attempt_number: 2,
    result_status: 'REV',
    declaration_date: today,
  });

  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="KT_Buddy_Official_Result_Template.xlsx"');
  res.send(Buffer.from(buffer));
});

function parseCsvLines(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    rows.push(cells);
  }
  return rows;
}

// 3. Upload & Preview Excel / CSV Results (with validation, duplicate detection, unmatched student detection)
resultImportRoutes.post('/results/preview', spreadsheetUpload.single('file'), async (req: AuthedRequest, res) => {
  const user = req.user!;
  if (!req.file) {
    res.status(400).json({ error: 'Please select an Excel (.xlsx/.xls) or CSV (.csv) file to upload.' });
    return;
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!ALLOWED_SPREADSHEET_EXTENSIONS.has(ext)) {
    res.status(400).json({ error: 'Invalid file format. Upload .xlsx, .xls, or .csv files only.' });
    return;
  }

  let rawMatrix: string[][] = [];
  try {
    if (ext === '.csv') {
      rawMatrix = parseCsvLines(req.file.buffer.toString('utf8'));
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer as any);
      const sheet = workbook.worksheets[0];
      if (!sheet) {
        res.status(400).json({ error: 'The uploaded workbook contains no worksheets.' });
        return;
      }
      sheet.eachRow((row) => {
        const vals: string[] = [];
        for (let c = 1; c <= Math.max(row.cellCount, 6); c++) {
          const cellVal = row.getCell(c).value;
          if (cellVal instanceof Date) {
            vals.push(cellVal.toISOString().slice(0, 10));
          } else if (cellVal && typeof cellVal === 'object' && 'text' in cellVal) {
            vals.push(String((cellVal as any).text).trim());
          } else {
            vals.push(cellVal !== null && cellVal !== undefined ? String(cellVal).trim() : '');
          }
        }
        if (vals.some((v) => v !== '')) {
          rawMatrix.push(vals);
        }
      });
    }
  } catch (err: any) {
    res.status(400).json({ error: `Could not parse uploaded spreadsheet: ${err.message || 'Malformed file'}` });
    return;
  }

  if (rawMatrix.length < 2) {
    res.status(400).json({ error: 'File must contain a header row and at least one result row.' });
    return;
  }

  const headers = rawMatrix[0].map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  const colIdx = {
    roll: headers.findIndex((h) => ['roll_number', 'roll_no', 'student_id', 'roll'].includes(h)),
    subject: headers.findIndex((h) => ['subject_code', 'sub_code', 'course_code', 'subject'].includes(h)),
    year: headers.findIndex((h) => ['academic_year', 'year', 'session'].includes(h)),
    attempt: headers.findIndex((h) => ['attempt_number', 'attempt'].includes(h)),
    status: headers.findIndex((h) => ['result_status', 'status', 'result', 'grade_status'].includes(h)),
    date: headers.findIndex((h) => ['declaration_date', 'result_date', 'date'].includes(h)),
  };

  if (colIdx.roll === -1 || colIdx.subject === -1 || colIdx.status === -1) {
    res.status(400).json({
      error: 'Missing required columns. File header must include roll_number, subject_code, and result_status.',
    });
    return;
  }

  const rules = db
    .prepare('SELECT raw_code, mapped_clearance_status, auto_confirm FROM result_rules WHERE college_id = ?')
    .all(user.college_id) as Array<{ raw_code: string; mapped_clearance_status: ClearanceStatus; auto_confirm: number }>;
  const ruleMap = new Map(rules.map((r) => [r.raw_code.toUpperCase(), r]));

  const seenInFile = new Set<string>();
  const previewRows: ParsedPreviewRow[] = [];
  const errors: Array<{ rowNumber: number; type: string; message: string }> = [];

  for (let i = 1; i < rawMatrix.length; i++) {
    const row = rawMatrix[i];
    const rowNumber = i + 1;
    const rollNumber = sanitizeText(row[colIdx.roll] || '', 40).toUpperCase();
    const subjectCode = sanitizeText(row[colIdx.subject] || '', 30).toUpperCase();
    const academicYear = sanitizeText((colIdx.year >= 0 ? row[colIdx.year] : '') || '2025-26', 20) || '2025-26';
    const attemptRaw = Number(colIdx.attempt >= 0 ? row[colIdx.attempt] : 1);
    const attemptNumber = Number.isInteger(attemptRaw) && attemptRaw > 0 ? attemptRaw : 1;
    const rawStatus = sanitizeText(row[colIdx.status] || '', 30).toUpperCase();
    const declarationDate = sanitizeText(
      (colIdx.date >= 0 ? row[colIdx.date] : '') || new Date().toISOString().slice(0, 10),
      20
    );

    if (!rollNumber || !subjectCode || !rawStatus) {
      errors.push({ rowNumber, type: 'Invalid', message: 'Missing roll_number, subject_code, or result_status.' });
      previewRows.push({
        rowNumber,
        rollNumber,
        subjectCode,
        academicYear,
        attemptNumber,
        rawStatus,
        declarationDate,
        studentId: null,
        studentName: null,
        studentUserId: null,
        subjectId: null,
        subjectName: null,
        semester: null,
        mappedStatus: 'Under Verification',
        autoConfirm: false,
        validationStatus: 'Invalid',
        issueNote: 'Missing required fields',
      });
      continue;
    }

    const dupKey = `${rollNumber}::${subjectCode}::${academicYear}::${attemptNumber}`;
    if (seenInFile.has(dupKey)) {
      errors.push({ rowNumber, type: 'Duplicate', message: `Duplicate entry in file for ${rollNumber} / ${subjectCode}.` });
      previewRows.push({
        rowNumber,
        rollNumber,
        subjectCode,
        academicYear,
        attemptNumber,
        rawStatus,
        declarationDate,
        studentId: null,
        studentName: null,
        studentUserId: null,
        subjectId: null,
        subjectName: null,
        semester: null,
        mappedStatus: 'Under Verification',
        autoConfirm: false,
        validationStatus: 'Duplicate',
        issueNote: 'Duplicate row within uploaded file',
      });
      continue;
    }
    seenInFile.add(dupKey);

    const student = db
      .prepare(
        `SELECT s.id AS student_id, u.id AS user_id, u.full_name
         FROM students s JOIN users u ON u.id = s.user_id
         WHERE s.college_id = ? AND UPPER(s.roll_number) = ?`
      )
      .get(user.college_id, rollNumber) as { student_id: number; user_id: number; full_name: string } | undefined;

    const subject = db
      .prepare('SELECT id, subject_name, semester FROM subjects WHERE college_id = ? AND UPPER(subject_code) = ?')
      .get(user.college_id, subjectCode) as { id: number; subject_name: string; semester: number } | undefined;

    if (!student || !subject) {
      const reason = !student && !subject
        ? `Student ${rollNumber} and subject ${subjectCode} not found`
        : !student
        ? `Student roll number ${rollNumber} is not registered`
        : `Subject code ${subjectCode} is not in catalog`;
      errors.push({ rowNumber, type: 'Unmatched', message: reason });
      previewRows.push({
        rowNumber,
        rollNumber,
        subjectCode,
        academicYear,
        attemptNumber,
        rawStatus,
        declarationDate,
        studentId: student?.student_id || null,
        studentName: student?.full_name || null,
        studentUserId: student?.user_id || null,
        subjectId: subject?.id || null,
        subjectName: subject?.subject_name || null,
        semester: subject?.semester || null,
        mappedStatus: 'Under Verification',
        autoConfirm: false,
        validationStatus: 'Unmatched',
        issueNote: reason,
      });
      continue;
    }

    const existingPendingDup = db
      .prepare(
        `SELECT id FROM result_records
         WHERE college_id = ? AND student_id = ? AND UPPER(subject_code) = ? AND academic_year = ? AND attempt_number = ? AND UPPER(raw_result_status) = ?`
      )
      .get(user.college_id, student.student_id, subjectCode, academicYear, attemptNumber, rawStatus);

    if (existingPendingDup) {
      errors.push({
        rowNumber,
        type: 'Duplicate',
        message: `Already imported record for ${rollNumber} / ${subjectCode} (Attempt ${attemptNumber}, ${rawStatus}).`,
      });
      previewRows.push({
        rowNumber,
        rollNumber,
        subjectCode,
        academicYear,
        attemptNumber,
        rawStatus,
        declarationDate,
        studentId: student.student_id,
        studentName: student.full_name,
        studentUserId: student.user_id,
        subjectId: subject.id,
        subjectName: subject.subject_name,
        semester: subject.semester,
        mappedStatus: 'Under Verification',
        autoConfirm: false,
        validationStatus: 'Duplicate',
        issueNote: 'Matches an existing imported record',
      });
      continue;
    }

    const matchedRule = ruleMap.get(rawStatus);
    const mappedStatus: ClearanceStatus = matchedRule ? matchedRule.mapped_clearance_status : 'Under Verification';
    const autoConfirm = matchedRule ? matchedRule.auto_confirm === 1 : false;

    previewRows.push({
      rowNumber,
      rollNumber,
      subjectCode,
      academicYear,
      attemptNumber,
      rawStatus,
      declarationDate: isValidDateYYYYMMDD(declarationDate) ? declarationDate : new Date().toISOString().slice(0, 10),
      studentId: student.student_id,
      studentName: student.full_name,
      studentUserId: student.user_id,
      subjectId: subject.id,
      subjectName: subject.subject_name,
      semester: subject.semester,
      mappedStatus,
      autoConfirm,
      validationStatus: autoConfirm ? 'Valid' : 'Needs Review',
      issueNote: matchedRule
        ? autoConfirm
          ? null
          : `Rule "${rawStatus}" requires admin verification before confirming final KT status`
        : `Unknown result code "${rawStatus}" — held as Under Verification for admin review`,
    });
  }

  const summary = {
    totalRows: previewRows.length,
    matchedRows: previewRows.filter((r) => r.validationStatus === 'Valid' || r.validationStatus === 'Needs Review').length,
    autoReadyRows: previewRows.filter((r) => r.validationStatus === 'Valid').length,
    needsReviewRows: previewRows.filter((r) => r.validationStatus === 'Needs Review').length,
    unmatchedRows: previewRows.filter((r) => r.validationStatus === 'Unmatched').length,
    duplicateRows: previewRows.filter((r) => r.validationStatus === 'Duplicate').length,
    invalidRows: previewRows.filter((r) => r.validationStatus === 'Invalid').length,
  };

  const importInsert = db
    .prepare(
      `INSERT INTO result_imports
       (college_id, file_name, file_type, total_rows, matched_rows, unmatched_rows, duplicate_rows, invalid_rows, confirmed_count, status, imported_by, error_report_json, summary_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'Previewed', ?, ?, ?)`
    )
    .run(
      user.college_id,
      path.basename(req.file.originalname).slice(0, 140),
      ext.replace('.', ''),
      summary.totalRows,
      summary.matchedRows,
      summary.unmatchedRows,
      summary.duplicateRows,
      summary.invalidRows,
      user.id,
      JSON.stringify(errors),
      JSON.stringify({ summary, previewRows })
    );

  res.json({
    importId: importInsert.lastInsertRowid,
    fileName: path.basename(req.file.originalname),
    summary,
    errors,
    previewRows,
  });
});

// 4. Commit a previewed import into result_records + optionally auto-verify configured rules
resultImportRoutes.post('/results/commit/:importId', (req: AuthedRequest, res) => {
  const user = req.user!;
  const importId = Number(req.params.importId);
  const autoVerifyConfigured = Boolean(req.body?.autoVerifyConfigured);

  const imp = db
    .prepare('SELECT * FROM result_imports WHERE id = ? AND college_id = ?')
    .get(importId, user.college_id) as Record<string, any> | undefined;

  if (!imp) {
    res.status(404).json({ error: 'Import batch not found.' });
    return;
  }
  if (imp.status === 'Committed') {
    res.status(409).json({ error: 'This import batch has already been committed.' });
    return;
  }

  let previewRows: ParsedPreviewRow[] = [];
  try {
    previewRows = JSON.parse(imp.summary_json || '{}').previewRows || [];
  } catch {
    previewRows = [];
  }

  const actionableRows = previewRows.filter((r) => r.validationStatus === 'Valid' || r.validationStatus === 'Needs Review');
  if (actionableRows.length === 0) {
    res.status(400).json({ error: 'No valid or matched records to commit in this file.' });
    return;
  }

  let confirmedCount = 0;
  let stagedCount = 0;

  const tx = db.transaction(() => {
    for (const row of actionableRows) {
      if (!row.studentId || !row.subjectId) continue;

      const existingKt = db
        .prepare('SELECT id, clearance_status, attempt_number FROM student_kt WHERE student_id = ? AND subject_id = ? ORDER BY id DESC LIMIT 1')
        .get(row.studentId, row.subjectId) as { id: number; clearance_status: string; attempt_number: number } | undefined;

      const shouldAutoConfirm = autoVerifyConfigured && row.autoConfirm;
      let studentKtId: number | null = existingKt?.id || null;

      if (shouldAutoConfirm) {
        confirmedCount += 1;
        if (existingKt) {
          db.prepare(
            `UPDATE student_kt
             SET previous_status = clearance_status,
                 latest_status = ?,
                 clearance_status = ?,
                 attempt_number = ?,
                 result_declaration_date = ?,
                 is_verified = 1,
                 verified_by = ?,
                 verified_at = datetime('now'),
                 source_type = 'admin_import',
                 updated_at = datetime('now')
             WHERE id = ?`
          ).run(
            row.mappedStatus,
            row.mappedStatus,
            Math.max(existingKt.attempt_number, row.attemptNumber),
            row.declarationDate,
            user.id,
            existingKt.id
          );
        } else {
          const ktIns = db
            .prepare(
              `INSERT INTO student_kt
               (college_id, student_id, subject_id, semester, academic_year, attempt_number, previous_status, latest_status, clearance_status, result_declaration_date, is_verified, verified_by, verified_at, source_type)
               VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 1, ?, datetime('now'), 'admin_import')`
            )
            .run(
              user.college_id,
              row.studentId,
              row.subjectId,
              row.semester || 1,
              row.academicYear,
              row.attemptNumber,
              row.mappedStatus,
              row.mappedStatus,
              row.declarationDate,
              user.id
            );
          studentKtId = ktIns.lastInsertRowid as number;
        }

        if (row.studentUserId) {
          const notifType = row.mappedStatus === 'Cleared' ? 'result_cleared' : 'kt_verified';
          const notifTitle =
            row.mappedStatus === 'Cleared'
              ? `KT Cleared: ${row.subjectName} (${row.subjectCode})`
              : `Result Verified: ${row.subjectName} (${row.subjectCode})`;
          createNotificationForUser(
            user.college_id,
            row.studentUserId,
            notifType,
            notifTitle,
            `Official result imported and verified as "${row.mappedStatus}" for ${row.academicYear}.`,
            'student_kt'
          );
        }
      } else {
        stagedCount += 1;
      }

      db.prepare(
        `INSERT INTO result_records
         (college_id, import_id, student_id, student_kt_id, roll_number, subject_code, subject_name, semester, academic_year, attempt_number, raw_result_status, mapped_status, previous_status, result_declaration_date, verification_status, imported_by, verified_by, verified_at, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        user.college_id,
        importId,
        row.studentId,
        studentKtId,
        row.rollNumber,
        row.subjectCode,
        row.subjectName,
        row.semester,
        row.academicYear,
        row.attemptNumber,
        row.rawStatus,
        row.mappedStatus,
        existingKt?.clearance_status || null,
        row.declarationDate,
        shouldAutoConfirm ? 'Verified' : 'Pending Verification',
        user.id,
        shouldAutoConfirm ? user.id : null,
        shouldAutoConfirm ? new Date().toISOString() : null,
        row.issueNote || (shouldAutoConfirm ? 'Confirmed on official import' : 'Awaiting admin verification')
      );
    }

    db.prepare(
      `UPDATE result_imports
       SET status = 'Committed', confirmed_count = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(confirmedCount, importId);

    logActivity(
      user.college_id,
      user.id,
      'COMMIT_RESULT_IMPORT',
      'result_imports',
      importId,
      `${imp.file_name}: ${confirmedCount} verified, ${stagedCount} staged for verification`
    );
  });

  tx();
  res.json({
    message: `Import committed: ${confirmedCount} verified immediately, ${stagedCount} staged in KT Verification queue.`,
    confirmedCount,
    stagedCount,
  });
});

resultImportRoutes.get('/results/imports', (req: AuthedRequest, res) => {
  const rows = db
    .prepare(
      `SELECT ri.*, u.full_name AS imported_by_name
       FROM result_imports ri
       LEFT JOIN users u ON u.id = ri.imported_by
       WHERE ri.college_id = ?
       ORDER BY ri.created_at DESC, ri.id DESC`
    )
    .all(req.user!.college_id) as Array<Record<string, any>>;

  const imports = rows.map((r) => ({
    ...r,
    errors: (() => {
      try {
        return JSON.parse(r.error_report_json || '[]');
      } catch {
        return [];
      }
    })(),
  }));
  res.json({ imports });
});

// 5. Admin KT Verification Queue & Student KT Ledger Management
resultImportRoutes.get('/results/verification-queue', (req: AuthedRequest, res) => {
  const collegeId = req.user!.college_id;
  const records = db
    .prepare(
      `SELECT
         rr.*,
         u_stud.full_name AS student_name,
         u_imp.full_name AS imported_by_name,
         u_ver.full_name AS verified_by_name
       FROM result_records rr
       LEFT JOIN students s ON s.id = rr.student_id
       LEFT JOIN users u_stud ON u_stud.id = s.user_id
       LEFT JOIN users u_imp ON u_imp.id = rr.imported_by
       LEFT JOIN users u_ver ON u_ver.id = rr.verified_by
       WHERE rr.college_id = ?
       ORDER BY
         CASE rr.verification_status WHEN 'Pending Verification' THEN 1 WHEN 'Verified' THEN 2 ELSE 3 END,
         rr.created_at DESC, rr.id DESC
       LIMIT 120`
    )
    .all(collegeId);

  const ktLedger = db
    .prepare(
      `SELECT
         sk.*,
         u.full_name AS student_name, s.roll_number, d.name AS department_name, cr.name AS course_name,
         sub.subject_code, sub.subject_name,
         vu.full_name AS verified_by_name
       FROM student_kt sk
       JOIN students s ON s.id = sk.student_id
       JOIN users u ON u.id = s.user_id
       JOIN departments d ON d.id = s.department_id
       JOIN courses cr ON cr.id = s.course_id
       JOIN subjects sub ON sub.id = sk.subject_id
       LEFT JOIN users vu ON vu.id = sk.verified_by
       WHERE sk.college_id = ?
       ORDER BY sk.updated_at DESC, sk.id DESC`
    )
    .all(collegeId);

  res.json({ records, ktLedger });
});

resultImportRoutes.get('/results/supporting-file/:recordId', (req: AuthedRequest, res) => {
  const row = db
    .prepare('SELECT supporting_file_path FROM result_records WHERE id = ? AND college_id = ?')
    .get(Number(req.params.recordId), req.user!.college_id) as { supporting_file_path: string | null } | undefined;

  if (!row || !row.supporting_file_path) {
    res.status(404).json({ error: 'Supporting file not attached.' });
    return;
  }
  const safePath = resolveSafeUploadPath(row.supporting_file_path);
  if (!safePath || !fs.existsSync(safePath)) {
    res.status(404).json({ error: 'Supporting file unavailable.' });
    return;
  }
  res.download(safePath);
});

resultImportRoutes.post('/results/verify/:recordId', (req: AuthedRequest, res) => {
  const user = req.user!;
  const recordId = Number(req.params.recordId);
  const decision = sanitizeText(req.body?.decision, 20); // 'Verify' | 'Reject'
  const confirmedStatus = sanitizeText(req.body?.confirmedStatus, 40) as ClearanceStatus;
  const remarks = sanitizeText(req.body?.remarks, 300);

  const rec = db
    .prepare('SELECT * FROM result_records WHERE id = ? AND college_id = ?')
    .get(recordId, user.college_id) as Record<string, any> | undefined;

  if (!rec) {
    res.status(404).json({ error: 'Result record not found.' });
    return;
  }

  if (decision === 'Reject') {
    db.prepare(
      `UPDATE result_records
       SET verification_status = 'Rejected', verified_by = ?, verified_at = datetime('now'), remarks = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(user.id, remarks || 'Rejected during admin verification', recordId);

    if (rec.student_id) {
      const stud = db.prepare('SELECT user_id FROM students WHERE id = ?').get(rec.student_id) as { user_id: number } | undefined;
      if (stud) {
        createNotificationForUser(
          user.college_id,
          stud.user_id,
          'result_rejected',
          `Submission Not Approved: ${rec.subject_code}`,
          remarks || 'Your supporting result submission was not verified by the Exam Cell.',
          'result_records'
        );
      }
    }
    logActivity(user.college_id, user.id, 'REJECT_RESULT_RECORD', 'result_records', recordId, `${rec.roll_number} ${rec.subject_code}`);
    res.json({ message: 'Record marked as Rejected.' });
    return;
  }

  const finalStatus: ClearanceStatus = ALLOWED_CLEARANCE_STATUSES.includes(confirmedStatus)
    ? confirmedStatus
    : (rec.mapped_status as ClearanceStatus);

  if (!rec.student_id) {
    res.status(400).json({ error: 'Cannot verify record without a matched student.' });
    return;
  }

  const subject = db
    .prepare('SELECT id, semester, subject_name FROM subjects WHERE college_id = ? AND UPPER(subject_code) = ?')
    .get(user.college_id, String(rec.subject_code).toUpperCase()) as { id: number; semester: number; subject_name: string } | undefined;

  if (!subject) {
    res.status(400).json({ error: 'Subject code not found in college catalog.' });
    return;
  }

  const tx = db.transaction(() => {
    const existingKt = db
      .prepare('SELECT id, clearance_status, attempt_number FROM student_kt WHERE student_id = ? AND subject_id = ? ORDER BY id DESC LIMIT 1')
      .get(rec.student_id, subject.id) as { id: number; clearance_status: string; attempt_number: number } | undefined;

    let studentKtId = existingKt?.id || null;
    if (existingKt) {
      db.prepare(
        `UPDATE student_kt
         SET previous_status = clearance_status,
             latest_status = ?,
             clearance_status = ?,
             attempt_number = ?,
             result_declaration_date = COALESCE(?, result_declaration_date),
             is_verified = 1,
             verified_by = ?,
             verified_at = datetime('now'),
             notes = COALESCE(?, notes),
             updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        finalStatus,
        finalStatus,
        Math.max(existingKt.attempt_number, Number(rec.attempt_number || 1)),
        rec.result_declaration_date,
        user.id,
        remarks || null,
        existingKt.id
      );
    } else {
      const ktIns = db
        .prepare(
          `INSERT INTO student_kt
           (college_id, student_id, subject_id, semester, academic_year, attempt_number, previous_status, latest_status, clearance_status, result_declaration_date, is_verified, verified_by, verified_at, source_type, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), 'admin_import', ?)`
        )
        .run(
          user.college_id,
          rec.student_id,
          subject.id,
          subject.semester,
          rec.academic_year,
          Number(rec.attempt_number || 1),
          rec.previous_status || null,
          finalStatus,
          finalStatus,
          rec.result_declaration_date,
          user.id,
          remarks || null
        );
      studentKtId = ktIns.lastInsertRowid as number;
    }

    db.prepare(
      `UPDATE result_records
       SET student_kt_id = ?, mapped_status = ?, verification_status = 'Verified', verified_by = ?, verified_at = datetime('now'), remarks = COALESCE(?, remarks), updated_at = datetime('now')
       WHERE id = ?`
    ).run(studentKtId, finalStatus, user.id, remarks || null, recordId);

    const stud = db.prepare('SELECT user_id FROM students WHERE id = ?').get(rec.student_id) as { user_id: number } | undefined;
    if (stud) {
      createNotificationForUser(
        user.college_id,
        stud.user_id,
        finalStatus === 'Cleared' ? 'result_cleared' : 'kt_verified',
        finalStatus === 'Cleared'
          ? `KT Cleared: ${subject.subject_name} (${rec.subject_code})`
          : `Official KT Record Verified: ${subject.subject_name}`,
        `Admin verified your official result status as "${finalStatus}".`,
        'student_kt'
      );
    }

    logActivity(
      user.college_id,
      user.id,
      'VERIFY_RESULT_RECORD',
      'result_records',
      recordId,
      `${rec.roll_number} ${rec.subject_code} -> ${finalStatus}`
    );
  });

  tx();
  res.json({ message: `Record verified and student KT status updated to "${finalStatus}".` });
});

// Update existing student KT record (Revaluation / Supplementary Exam update preserving history)
resultImportRoutes.patch('/results/kt/:ktId', (req: AuthedRequest, res) => {
  const user = req.user!;
  const ktId = Number(req.params.ktId);
  const newStatus = sanitizeText(req.body?.clearanceStatus, 40) as ClearanceStatus;
  const declarationDate = sanitizeText(req.body?.declarationDate, 20) || new Date().toISOString().slice(0, 10);
  const incrementAttempt = Boolean(req.body?.incrementAttempt);
  const notes = sanitizeText(req.body?.notes, 300);

  if (!ALLOWED_CLEARANCE_STATUSES.includes(newStatus)) {
    res.status(400).json({ error: 'Invalid clearance status.' });
    return;
  }

  const existing = db
    .prepare(
      `SELECT sk.*, s.roll_number, s.user_id, sub.subject_code, sub.subject_name
       FROM student_kt sk
       JOIN students s ON s.id = sk.student_id
       JOIN subjects sub ON sub.id = sk.subject_id
       WHERE sk.id = ? AND sk.college_id = ?`
    )
    .get(ktId, user.college_id) as Record<string, any> | undefined;

  if (!existing) {
    res.status(404).json({ error: 'KT record not found.' });
    return;
  }

  const nextAttempt = incrementAttempt ? Number(existing.attempt_number) + 1 : Number(existing.attempt_number);

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE student_kt
       SET previous_status = clearance_status,
           latest_status = ?,
           clearance_status = ?,
           attempt_number = ?,
           result_declaration_date = ?,
           verified_by = ?,
           verified_at = datetime('now'),
           notes = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(newStatus, newStatus, nextAttempt, declarationDate, user.id, notes || existing.notes, ktId);

    db.prepare(
      `INSERT INTO result_records
       (college_id, student_id, student_kt_id, roll_number, subject_code, subject_name, semester, academic_year, attempt_number, raw_result_status, mapped_status, previous_status, result_declaration_date, verification_status, imported_by, verified_by, verified_at, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Verified', ?, ?, datetime('now'), ?)`
    ).run(
      user.college_id,
      existing.student_id,
      ktId,
      existing.roll_number,
      existing.subject_code,
      existing.subject_name,
      existing.semester,
      existing.academic_year,
      nextAttempt,
      newStatus.toUpperCase(),
      newStatus,
      existing.clearance_status,
      declarationDate,
      user.id,
      user.id,
      notes || 'Updated after revaluation / supplementary result'
    );

    createNotificationForUser(
      user.college_id,
      existing.user_id,
      newStatus === 'Cleared' ? 'result_cleared' : 'revaluation_update',
      newStatus === 'Cleared'
        ? `KT Cleared: ${existing.subject_name} (${existing.subject_code})`
        : `Result Updated: ${existing.subject_name} (${existing.subject_code})`,
      `Your status changed from "${existing.clearance_status}" to "${newStatus}" (Attempt ${nextAttempt}).`,
      'student_kt'
    );

    logActivity(
      user.college_id,
      user.id,
      'UPDATE_KT_STATUS',
      'student_kt',
      ktId,
      `${existing.roll_number} ${existing.subject_code}: ${existing.clearance_status} -> ${newStatus}`
    );
  });

  tx();
  res.json({ message: `Updated ${existing.subject_code} status to "${newStatus}" while preserving history.` });
});

resultImportRoutes.post('/results/manual-kt', (req: AuthedRequest, res) => {
  const user = req.user!;
  const studentId = Number(req.body?.studentId);
  const subjectId = Number(req.body?.subjectId);
  const academicYear = sanitizeText(req.body?.academicYear, 20) || '2025-26';
  const attemptNumber = Math.min(Math.max(Number(req.body?.attemptNumber || 1), 1), 10);
  const clearanceStatus = sanitizeText(req.body?.clearanceStatus, 40) as ClearanceStatus;
  const declarationDate = sanitizeText(req.body?.declarationDate, 20) || new Date().toISOString().slice(0, 10);
  const notes = sanitizeText(req.body?.notes, 300);

  if (!studentId || !subjectId || !ALLOWED_CLEARANCE_STATUSES.includes(clearanceStatus)) {
    res.status(400).json({ error: 'Student, subject, and valid status are required.' });
    return;
  }

  const student = db
    .prepare('SELECT id, user_id, roll_number FROM students WHERE id = ? AND college_id = ?')
    .get(studentId, user.college_id) as { id: number; user_id: number; roll_number: string } | undefined;
  const subject = db
    .prepare('SELECT id, subject_code, subject_name, semester FROM subjects WHERE id = ? AND college_id = ?')
    .get(subjectId, user.college_id) as { id: number; subject_code: string; subject_name: string; semester: number } | undefined;

  if (!student || !subject) {
    res.status(404).json({ error: 'Student or subject not found in your college.' });
    return;
  }

  const tx = db.transaction(() => {
    const existing = db
      .prepare('SELECT id, clearance_status FROM student_kt WHERE student_id = ? AND subject_id = ? AND academic_year = ?')
      .get(studentId, subjectId, academicYear) as { id: number; clearance_status: string } | undefined;

    let ktId: number;
    if (existing) {
      ktId = existing.id;
      db.prepare(
        `UPDATE student_kt
         SET previous_status = clearance_status, latest_status = ?, clearance_status = ?, attempt_number = ?, result_declaration_date = ?, verified_by = ?, verified_at = datetime('now'), notes = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(clearanceStatus, clearanceStatus, attemptNumber, declarationDate, user.id, notes || null, ktId);
    } else {
      const ins = db
        .prepare(
          `INSERT INTO student_kt
           (college_id, student_id, subject_id, semester, academic_year, attempt_number, previous_status, latest_status, clearance_status, result_declaration_date, is_verified, verified_by, verified_at, source_type, notes)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 1, ?, datetime('now'), 'admin_manual', ?)`
        )
        .run(
          user.college_id,
          studentId,
          subjectId,
          subject.semester,
          academicYear,
          attemptNumber,
          clearanceStatus,
          clearanceStatus,
          declarationDate,
          user.id,
          notes || null
        );
      ktId = ins.lastInsertRowid as number;
    }

    db.prepare(
      `INSERT INTO result_records
       (college_id, student_id, student_kt_id, roll_number, subject_code, subject_name, semester, academic_year, attempt_number, raw_result_status, mapped_status, previous_status, result_declaration_date, verification_status, imported_by, verified_by, verified_at, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Verified', ?, ?, datetime('now'), ?)`
    ).run(
      user.college_id,
      studentId,
      ktId,
      student.roll_number,
      subject.subject_code,
      subject.subject_name,
      subject.semester,
      academicYear,
      attemptNumber,
      clearanceStatus.toUpperCase(),
      clearanceStatus,
      existing?.clearance_status || null,
      declarationDate,
      user.id,
      user.id,
      notes || 'Admin manual verification entry'
    );

    createNotificationForUser(
      user.college_id,
      student.user_id,
      clearanceStatus === 'Cleared' ? 'result_cleared' : 'kt_verified',
      `KT Record Published: ${subject.subject_name}`,
      `Official status for ${subject.subject_code} (${academicYear}) is "${clearanceStatus}".`,
      'student_kt'
    );

    logActivity(
      user.college_id,
      user.id,
      'MANUAL_KT_ENTRY',
      'student_kt',
      ktId,
      `${student.roll_number} ${subject.subject_code} -> ${clearanceStatus}`
    );
  });

  tx();
  res.status(201).json({ message: 'Verified KT record saved.' });
});
