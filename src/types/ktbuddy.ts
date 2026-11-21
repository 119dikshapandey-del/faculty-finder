export type UserRole = 'student' | 'admin';

export type ClearanceStatus =
  | 'KT'
  | 'Cleared'
  | 'Result Awaited'
  | 'Under Verification'
  | 'Revaluation Pending';

export interface CollegePublic {
  id: number;
  name: string;
  code: string;
  city: string;
}

export interface DepartmentItem {
  id: number;
  college_id: number;
  name: string;
  code: string;
  head_name?: string | null;
  course_count?: number;
  student_count?: number;
}

export interface CourseItem {
  id: number;
  college_id: number;
  department_id: number;
  department_name?: string;
  name: string;
  code: string;
  total_semesters: number;
}

export interface SubjectItem {
  id: number;
  college_id: number;
  department_id: number;
  department_name?: string;
  course_id: number;
  course_name?: string;
  semester: number;
  subject_code: string;
  subject_name: string;
  credits: number;
}

export interface User {
  id: number;
  college_id: number;
  college_name: string;
  college_code: string;
  email: string;
  identifier: string;
  full_name: string;
  role: UserRole;
  is_active: number;
  student_id?: number;
  roll_number?: string;
  department_id?: number;
  department_name?: string;
  course_id?: number;
  course_name?: string;
  year_of_study?: number;
  semester?: number;
}

export interface StudentKtItem {
  id: number;
  student_id: number;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  credits?: number;
  department_name?: string;
  course_name?: string;
  semester: number;
  academic_year: string;
  attempt_number: number;
  previous_status: string | null;
  latest_status: string;
  clearance_status: ClearanceStatus;
  result_declaration_date: string | null;
  is_verified: number;
  verified_by_name?: string | null;
  verified_at?: string | null;
  notes?: string | null;
  syllabus_count?: number;
  material_count?: number;
  next_exam_date?: string | null;
  // Admin ledger fields
  student_name?: string;
  roll_number?: string;
}

export interface ResultRecordItem {
  id: number;
  import_id: number | null;
  student_id: number | null;
  student_kt_id: number | null;
  student_name?: string | null;
  roll_number: string;
  subject_code: string;
  subject_name: string | null;
  semester: number | null;
  academic_year: string;
  attempt_number: number;
  raw_result_status: string;
  mapped_status: ClearanceStatus;
  previous_status: string | null;
  result_declaration_date: string | null;
  verification_status: 'Pending Verification' | 'Verified' | 'Rejected';
  supporting_file_path: string | null;
  imported_by_name?: string | null;
  verified_by_name?: string | null;
  verified_at?: string | null;
  remarks?: string | null;
  created_at: string;
}

export interface ResultRuleItem {
  id: number;
  raw_code: string;
  mapped_clearance_status: ClearanceStatus;
  auto_confirm: number;
  description: string | null;
}

export interface SyllabusItem {
  id: number;
  department_id: number;
  department_name: string;
  course_id: number;
  course_name: string;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  semester: number;
  academic_year: string;
  version_label: string;
  title: string;
  unit_topics: string[];
  file_name: string;
  file_size_bytes: number;
  is_latest: number;
  uploaded_by_name?: string | null;
  created_at: string;
}

export interface StudyMaterialItem {
  id: number;
  department_id: number;
  department_name: string;
  course_id: number;
  course_name: string;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  semester: number;
  academic_year: string;
  resource_type:
    | 'PYQ'
    | 'Notes'
    | 'Important Questions'
    | 'Unit Material'
    | 'Reference Book'
    | 'Practical Material';
  title: string;
  description: string | null;
  external_url: string | null;
  file_name: string | null;
  file_size_bytes: number;
  uploaded_by_name?: string | null;
  created_at: string;
}

export interface ExamScheduleItem {
  id: number;
  course_id: number;
  course_name?: string;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  semester: number;
  exam_session: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  venue: string | null;
  instructions: string | null;
  is_changed: number;
  change_note: string | null;
  is_personal_kt?: number;
}

export interface AnnouncementItem {
  id: number;
  title: string;
  content: string;
  category: string;
  department_name?: string | null;
  course_name?: string | null;
  target_semester?: number | null;
  publish_date: string;
  expiry_date?: string | null;
  created_by_name?: string | null;
}

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: number;
  related_entity?: string | null;
  created_at: string;
}
