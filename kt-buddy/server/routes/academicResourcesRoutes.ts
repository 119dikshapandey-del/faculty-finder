import fs from 'fs';
import { Router } from 'express';
import { db } from '../db/database.ts';
import { type AuthedRequest, requireAuth, sanitizeText } from '../auth/security.ts';
import { resolveSafeUploadPath } from '../utils/fileStorage.ts';

export const academicResourcesRoutes = Router();

academicResourcesRoutes.use(requireAuth);

academicResourcesRoutes.get('/catalog', (req: AuthedRequest, res) => {
  const collegeId = req.user!.college_id;
  const departments = db.prepare('SELECT * FROM departments WHERE college_id = ? ORDER BY name ASC').all(collegeId);
  const courses = db.prepare('SELECT * FROM courses WHERE college_id = ? ORDER BY name ASC').all(collegeId);
  const subjects = db
    .prepare(
      `SELECT s.*, d.name AS department_name, cr.name AS course_name
       FROM subjects s
       JOIN departments d ON d.id = s.department_id
       JOIN courses cr ON cr.id = s.course_id
       WHERE s.college_id = ?
       ORDER BY s.semester ASC, s.subject_code ASC`
    )
    .all(collegeId);
  res.json({ departments, courses, subjects });
});

academicResourcesRoutes.get('/syllabi', (req: AuthedRequest, res) => {
  const collegeId = req.user!.college_id;
  const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;
  const courseId = req.query.courseId ? Number(req.query.courseId) : null;
  const semester = req.query.semester ? Number(req.query.semester) : null;
  const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;
  const q = sanitizeText(req.query.q, 80).toLowerCase();

  let sql = `
    SELECT
      syl.*,
      d.name AS department_name, d.code AS department_code,
      cr.name AS course_name, cr.code AS course_code,
      sub.subject_code, sub.subject_name,
      u.full_name AS uploaded_by_name
    FROM syllabus syl
    JOIN departments d ON d.id = syl.department_id
    JOIN courses cr ON cr.id = syl.course_id
    JOIN subjects sub ON sub.id = syl.subject_id
    LEFT JOIN users u ON u.id = syl.uploaded_by
    WHERE syl.college_id = ?
  `;
  const params: Array<string | number> = [collegeId];

  if (departmentId) {
    sql += ' AND syl.department_id = ?';
    params.push(departmentId);
  }
  if (courseId) {
    sql += ' AND syl.course_id = ?';
    params.push(courseId);
  }
  if (semester) {
    sql += ' AND syl.semester = ?';
    params.push(semester);
  }
  if (subjectId) {
    sql += ' AND syl.subject_id = ?';
    params.push(subjectId);
  }
  if (q) {
    sql += ' AND (LOWER(syl.title) LIKE ? OR LOWER(sub.subject_name) LIKE ? OR LOWER(sub.subject_code) LIKE ? OR LOWER(syl.version_label) LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  sql += ' ORDER BY syl.is_latest DESC, syl.semester ASC, syl.academic_year DESC, syl.id DESC';
  const rows = db.prepare(sql).all(...params) as Array<Record<string, any>>;

  const syllabi = rows.map((row) => ({
    ...row,
    unit_topics: (() => {
      try {
        return JSON.parse(row.unit_topics_json || '[]');
      } catch {
        return [];
      }
    })(),
  }));

  res.json({ syllabi });
});

academicResourcesRoutes.get('/syllabi/:id/download', (req: AuthedRequest, res) => {
  const collegeId = req.user!.college_id;
  const id = Number(req.params.id);
  const row = db
    .prepare('SELECT file_name, file_path FROM syllabus WHERE id = ? AND college_id = ?')
    .get(id, collegeId) as { file_name: string; file_path: string } | undefined;

  if (!row) {
    res.status(404).json({ error: 'Syllabus document not found.' });
    return;
  }

  const safePath = resolveSafeUploadPath(row.file_path);
  if (!safePath || !fs.existsSync(safePath)) {
    res.status(404).json({ error: 'Syllabus file is unavailable on disk.' });
    return;
  }

  res.download(safePath, row.file_name);
});

academicResourcesRoutes.get('/materials', (req: AuthedRequest, res) => {
  const collegeId = req.user!.college_id;
  const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;
  const courseId = req.query.courseId ? Number(req.query.courseId) : null;
  const semester = req.query.semester ? Number(req.query.semester) : null;
  const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;
  const resourceType = sanitizeText(req.query.resourceType, 40);
  const academicYear = sanitizeText(req.query.academicYear, 20);
  const q = sanitizeText(req.query.q, 80).toLowerCase();

  let sql = `
    SELECT
      sm.*,
      d.name AS department_name,
      cr.name AS course_name,
      sub.subject_code, sub.subject_name,
      u.full_name AS uploaded_by_name
    FROM study_materials sm
    JOIN departments d ON d.id = sm.department_id
    JOIN courses cr ON cr.id = sm.course_id
    JOIN subjects sub ON sub.id = sm.subject_id
    LEFT JOIN users u ON u.id = sm.uploaded_by
    WHERE sm.college_id = ?
  `;
  const params: Array<string | number> = [collegeId];

  if (departmentId) {
    sql += ' AND sm.department_id = ?';
    params.push(departmentId);
  }
  if (courseId) {
    sql += ' AND sm.course_id = ?';
    params.push(courseId);
  }
  if (semester) {
    sql += ' AND sm.semester = ?';
    params.push(semester);
  }
  if (subjectId) {
    sql += ' AND sm.subject_id = ?';
    params.push(subjectId);
  }
  if (resourceType && resourceType !== 'All') {
    sql += ' AND sm.resource_type = ?';
    params.push(resourceType);
  }
  if (academicYear && academicYear !== 'All') {
    sql += ' AND sm.academic_year = ?';
    params.push(academicYear);
  }
  if (q) {
    sql += ' AND (LOWER(sm.title) LIKE ? OR LOWER(COALESCE(sm.description, \'\')) LIKE ? OR LOWER(sub.subject_name) LIKE ? OR LOWER(sub.subject_code) LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  sql += ' ORDER BY sm.created_at DESC, sm.id DESC';
  const materials = db.prepare(sql).all(...params);
  res.json({ materials });
});

academicResourcesRoutes.get('/materials/:id/download', (req: AuthedRequest, res) => {
  const collegeId = req.user!.college_id;
  const id = Number(req.params.id);
  const row = db
    .prepare('SELECT file_name, file_path FROM study_materials WHERE id = ? AND college_id = ?')
    .get(id, collegeId) as { file_name: string | null; file_path: string | null } | undefined;

  if (!row || !row.file_path || !row.file_name) {
    res.status(404).json({ error: 'Downloadable file not found for this resource.' });
    return;
  }

  const safePath = resolveSafeUploadPath(row.file_path);
  if (!safePath || !fs.existsSync(safePath)) {
    res.status(404).json({ error: 'Study material file is unavailable on disk.' });
    return;
  }

  res.download(safePath, row.file_name);
});

academicResourcesRoutes.get('/announcements', (req: AuthedRequest, res) => {
  const user = req.user!;
  const q = sanitizeText(req.query.q, 80).toLowerCase();

  let sql = `
    SELECT a.*, d.name AS department_name, cr.name AS course_name, u.full_name AS created_by_name
    FROM announcements a
    LEFT JOIN departments d ON d.id = a.target_department_id
    LEFT JOIN courses cr ON cr.id = a.target_course_id
    LEFT JOIN users u ON u.id = a.created_by
    WHERE a.college_id = ?
  `;
  const params: Array<string | number> = [user.college_id];

  if (user.role === 'student') {
    sql += `
      AND a.publish_date <= date('now')
      AND (a.expiry_date IS NULL OR a.expiry_date >= date('now'))
      AND (a.target_department_id IS NULL OR a.target_department_id = ?)
      AND (a.target_course_id IS NULL OR a.target_course_id = ?)
      AND (a.target_semester IS NULL OR a.target_semester = ?)
    `;
    params.push(user.department_id || 0, user.course_id || 0, user.semester || 0);
  }

  if (q) {
    sql += ' AND (LOWER(a.title) LIKE ? OR LOWER(a.content) LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  sql += ' ORDER BY a.publish_date DESC, a.id DESC';
  const announcements = db.prepare(sql).all(...params);
  res.json({ announcements });
});
