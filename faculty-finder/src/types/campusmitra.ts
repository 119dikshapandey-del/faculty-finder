export type UserRole = 'student' | 'faculty' | 'admin';

export interface User {
  id: number;
  college_id: number;
  college_name: string;
  college_code: string;
  role: UserRole;
  full_name: string;
  identifier: string;
  email: string;
  department_id: number | null;
  department_name: string | null;
  student_semester: number | null;
  avatar_url: string;
}

export interface FacultyDirectoryItem {
  user_id: number;
  full_name: string;
  identifier: string;
  email: string;
  avatar_url: string;
  department_name: string | null;
  department_code: string | null;
  designation: string;
  subjects: string;
  cabin_number: string;
  building_id: number | null;
  building_name: string | null;
  building_code: string | null;
  latitude: number | null;
  longitude: number | null;
  working_hours: string;
  availability_status: string;
  effective_status: string;
  is_status_expired: boolean;
  timetable_suggestion: string | null;
  status_message: string;
  approved_location: string;
  expected_return_time: string;
  status_expires_at: string | null;
  queue_open: number;
  last_updated_at: string;
  waiting_count: number;
}

export interface TimetableSlot {
  id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject_name: string;
  room_label: string;
  suggested_status: string;
}

export interface QueueEntry {
  id: number;
  faculty_user_id: number;
  student_user_id: number;
  faculty_name?: string;
  student_name?: string;
  student_identifier?: string;
  student_department?: string;
  cabin_number?: string;
  building_name?: string;
  token_number: number;
  reason: string;
  status: 'waiting' | 'called' | 'completed' | 'skipped' | 'cancelled';
  position?: number;
  created_at: string;
}

export interface AppointmentItem {
  id: number;
  faculty_user_id: number;
  student_user_id: number;
  faculty_name?: string;
  student_name?: string;
  student_identifier?: string;
  student_department?: string;
  cabin_number?: string;
  building_name?: string;
  requested_date: string;
  requested_slot: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'rescheduled' | 'completed' | 'cancelled';
  faculty_note: string;
  suggested_slot: string;
  created_at: string;
}

export interface BuildingItem {
  id: number;
  name: string;
  code: string;
  floors: number;
  latitude: number;
  longitude: number;
  description: string;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  category: string;
  is_read: number;
  created_at: string;
}
