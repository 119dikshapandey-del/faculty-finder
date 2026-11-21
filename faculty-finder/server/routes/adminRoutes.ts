import { Router } from 'express';
import {
  computeEffectiveFacultyStatus,
  emitCollegeEvent,
  hashPassword,
  logActivity,
  requireAuth,
  requireRole,
} from '../auth/security.ts';
import { getDb } from '../db/database.ts';

export const adminRoutes = Router();
adminRoutes.use(requireAuth, requireRole('admin'));

adminRoutes.get('/overview', (req, res) => {
  const db = getDb();
  const collegeId = req.user!.college_id;

  const departments = db
    .prepare('SELECT id, name, code FROM departments WHERE college_id = ? ORDER BY name ASC')
    .all(collegeId);

  const buildings = db
    .prepare('SELECT * FROM buildings WHERE college_id = ? ORDER BY name ASC')
    .all(collegeId);

  const facultyRows = db
    .prepare(
      `SELECT u.id, u.full_name, u.identifier, u.email, u.department_id, u.is_active, u.avatar_url,
              d.name AS department_name, fp.designation, fp.subjects, fp.cabin_number, fp.building_id,
              b.name AS building_name, fp.working_hours, fp.availability_status,
              fp.status_expires_at, fp.queue_open, fp.last_updated_at
       FROM users u
       JOIN faculty_profiles fp ON fp.user_id = u.id
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN buildings b ON b.id = fp.building_id
       WHERE u.college_id = ? AND u.role = 'faculty'
       ORDER BY u.full_name ASC`
    )
    .all(collegeId) as any[];

  const faculty = facultyRows.map((row) => {
    const statusInfo = computeEffectiveFacultyStatus(row.id, row.availability_status, row.status_expires_at);
    return {
      ...row,
      effective_status: statusInfo.effectiveStatus,
      is_status_expired: statusInfo.isExpired,
    };
  });

  const students = db
    .prepare(
      `SELECT u.id, u.full_name, u.identifier, u.email, u.department_id, u.student_semester, u.is_active,
              d.name AS department_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.college_id = ? AND u.role = 'student'
       ORDER BY u.full_name ASC`
    )
    .all(collegeId);

  const activeQueues = (
    db
      .prepare("SELECT COUNT(*) AS cnt FROM virtual_queues WHERE college_id = ? AND status IN ('waiting', 'called')")
      .get(collegeId) as { cnt: number }
  ).cnt;

  const pendingAppointments = (
    db
      .prepare("SELECT COUNT(*) AS cnt FROM appointments WHERE college_id = ? AND status = 'pending'")
      .get(collegeId) as { cnt: number }
  ).cnt;

  const logs = db
    .prepare(
      `SELECT al.id, al.action, al.details, al.created_at, u.full_name AS actor_name
       FROM activity_logs al
       LEFT JOIN users u ON u.id = al.actor_user_id
       WHERE al.college_id = ?
       ORDER BY al.id DESC LIMIT 25`
    )
    .all(collegeId);

  res.json({
    metrics: {
      totalFaculty: faculty.length,
      availableNow: faculty.filter((f) => f.effective_status === 'Available').length,
      totalStudents: students.length,
      activeQueues,
      pendingAppointments,
      totalBuildings: buildings.length,
    },
    departments,
    buildings,
    faculty,
    students,
    logs,
  });
});

adminRoutes.post('/faculty', (req, res) => {
  const db = getDb();
  const collegeId = req.user!.college_id;
  const {
    fullName,
    identifier,
    email,
    password,
    departmentId,
    designation,
    subjects,
    cabinNumber,
    buildingId,
    workingHours,
  } = req.body || {};

  if (!fullName || !identifier || !email || !password) {
    res.status(400).json({ error: 'Name, faculty ID, email, and initial password are required.' });
    return;
  }

  try {
    const createTx = db.transaction(() => {
      const uRes = db
        .prepare(
          `INSERT INTO users (college_id, role, full_name, identifier, email, password_hash, department_id, avatar_url)
           VALUES (?, 'faculty', ?, ?, ?, ?, ?, ?)`
        )
        .run(
          collegeId,
          String(fullName).trim(),
          String(identifier).trim().toUpperCase(),
          String(email).trim().toLowerCase(),
          hashPassword(String(password)),
          departmentId ? Number(departmentId) : null,
          '/src/assets/images/faculty_portrait_1_1795250771794.jpg'
        );

      const userId = Number(uRes.lastInsertRowid);
      db.prepare(
        `INSERT INTO faculty_profiles (
           user_id, college_id, designation, subjects, cabin_number, building_id, working_hours, availability_status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Available')`
      ).run(
        userId,
        collegeId,
        String(designation || 'Assistant Professor').trim(),
        String(subjects || '').trim(),
        String(cabinNumber || 'Room 101').trim(),
        buildingId ? Number(buildingId) : null,
        String(workingHours || 'Mon-Fri · 09:30 AM - 05:00 PM').trim()
      );
      return userId;
    });

    const userId = createTx();
    logActivity(collegeId, req.user!.id, 'CREATE_FACULTY', `Added faculty ${fullName}`);
    emitCollegeEvent(collegeId, 'faculty:updated', { facultyUserId: userId });
    res.status(201).json({ id: userId });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Could not create faculty account (duplicate email or ID).' });
  }
});

adminRoutes.post('/students', (req, res) => {
  const db = getDb();
  const collegeId = req.user!.college_id;
  const { fullName, identifier, email, password, departmentId, semester } = req.body || {};

  if (!fullName || !identifier || !email || !password) {
    res.status(400).json({ error: 'Name, student ID, email, and initial password are required.' });
    return;
  }

  try {
    const inserted = db
      .prepare(
        `INSERT INTO users (college_id, role, full_name, identifier, email, password_hash, department_id, student_semester)
         VALUES (?, 'student', ?, ?, ?, ?, ?, ?)`
      )
      .run(
        collegeId,
        String(fullName).trim(),
        String(identifier).trim().toUpperCase(),
        String(email).trim().toLowerCase(),
        hashPassword(String(password)),
        departmentId ? Number(departmentId) : null,
        semester ? Number(semester) : 1
      );
    logActivity(collegeId, req.user!.id, 'CREATE_STUDENT', `Added student ${fullName}`);
    res.status(201).json({ id: Number(inserted.lastInsertRowid) });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Could not create student account.' });
  }
});

adminRoutes.patch('/users/:id/toggle-active', (req, res) => {
  const db = getDb();
  const target = db
    .prepare('SELECT id, is_active, full_name FROM users WHERE id = ? AND college_id = ?')
    .get(Number(req.params.id), req.user!.college_id) as { id: number; is_active: number; full_name: string } | undefined;

  if (!target) {
    res.status(404).json({ error: 'User not found in your college.' });
    return;
  }

  const nextState = target.is_active ? 0 : 1;
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(nextState, target.id);
  logActivity(
    req.user!.college_id,
    req.user!.id,
    'TOGGLE_USER_ACTIVE',
    `${target.full_name} set active=${nextState}`
  );
  res.json({ isActive: Boolean(nextState) });
});

adminRoutes.post('/buildings', (req, res) => {
  const db = getDb();
  const collegeId = req.user!.college_id;
  const { name, code, floors, latitude, longitude, description } = req.body || {};

  if (!name || !code || latitude === undefined || longitude === undefined) {
    res.status(400).json({ error: 'Building name, code, latitude, and longitude are required.' });
    return;
  }

  try {
    const inserted = db
      .prepare(
        `INSERT INTO buildings (college_id, name, code, floors, latitude, longitude, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        collegeId,
        String(name).trim(),
        String(code).trim().toUpperCase(),
        Number(floors || 3),
        Number(latitude),
        Number(longitude),
        String(description || '').trim()
      );
    logActivity(collegeId, req.user!.id, 'CREATE_BUILDING', `Added building ${name}`);
    res.status(201).json({ id: Number(inserted.lastInsertRowid) });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Could not add campus building.' });
  }
});
