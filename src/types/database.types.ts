export type SchoolLevel = 'SD/MI' | 'SMP/MTs' | 'SMA/SMK/MA';
export type SemesterType = 'Ganjil' | 'Genap';
export type AttendanceStatus = 'Hadir' | 'Sakit' | 'Izin' | 'Alpa';
export type DayOfWeek = 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';
export type PromotionStatus = 'Naik Kelas' | 'Tinggal Kelas' | 'Lulus' | 'Belum Ditentukan';

export interface AppUser {
  id: string;
  username: string;
  password?: string;
  full_name: string;
  role: string;
  created_at?: string;
  updated_at?: string;
}


export interface SchoolSettings {
  id: string;
  school_name: string;
  npsn?: string | null;
  school_level: SchoolLevel;
  class_name: string;
  phase?: string | null;
  academic_year: string;
  semester: SemesterType;
  teacher_name: string;
  teacher_nip?: string | null;
  principal_name: string;
  principal_nip?: string | null;
  updated_at?: string;
}

export interface Student {
  id: string;
  nis: string;
  nisn?: string | null;
  full_name: string;
  gender: 'L' | 'P';
  parent_name?: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface Subject {
  id: string;
  subject_code: string;
  subject_name: string;
  kktp_score: number;
  created_at?: string;
}

export interface Schedule {
  id: string;
  day_of_week: DayOfWeek;
  start_time: string; // e.g. "07:30"
  end_time: string; // e.g. "09:00"
  period_number: string; // e.g. "Jam ke-1 & 2"
  subject_id: string;
  room_notes?: string | null;
  created_at?: string;
  // Join
  subjects?: Subject;
}

export interface Attendance {
  id: string;
  student_id: string;
  attendance_date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  notes?: string | null;
  created_at?: string;
  // Join
  students?: Student;
}

export interface TeachingJournal {
  id: string;
  journal_date: string; // YYYY-MM-DD
  schedule_id?: string | null;
  subject_id: string;
  period_info: string;
  topic_material: string;
  learning_activities: string;
  student_evaluator_notes?: string | null;
  total_present: number;
  total_absent: number;
  created_at?: string;
  // Joins
  subjects?: Subject;
  schedules?: Schedule;
}

export interface Grade {
  id: string;
  student_id: string;
  subject_id: string;
  academic_year: string;
  semester: SemesterType;
  nh1: number;
  nh2: number;
  nh3: number;
  nh4: number;
  sts_score: number;
  sas_pat_score: number;
  final_score?: number;
  competency_description?: string | null;
  updated_at?: string;
  // Joins
  students?: Student;
  subjects?: Subject;
}

export interface ExtracurricularItem {
  activity: string;
  predicate: 'Sangat Baik' | 'Baik' | 'Cukup' | 'Kurang';
  description: string;
}

export interface ReportCard {
  id: string;
  student_id: string;
  academic_year: string;
  semester: SemesterType;
  extracurricular_notes: ExtracurricularItem[];
  attitude_notes?: string | null;
  teacher_homeroom_notes?: string | null;
  promotion_status: PromotionStatus;
  promoted_to_class?: string | null;
  report_date: string;
  // Joins
  students?: Student;
}

// Attendance Summary type for reports & journals
export interface AttendanceSummary {
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
  total_effective_days: number;
  percentage: number;
}
