import { getSupabase } from '../lib/supabaseClient';
import {
  AppUser,
  SchoolSettings,
  Student,
  Subject,
  Schedule,
  Attendance,
  TeachingJournal,
  Grade,
  ReportCard,
  AttendanceSummary,
  AttendanceStatus,
} from '../types/database.types';

// ============================================================
// 1. PENGATURAN SEKOLAH (school_settings)
// ============================================================
export async function fetchSchoolSettings(): Promise<SchoolSettings | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('school_settings')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Gagal memuat pengaturan sekolah: ${error.message}`);

  // Jika tabel sekolah di Supabase masih menyimpan data nama lama (TELADAN / SMP), otomatis perbarui ke SMKS 3 PASUNDAN PERKASA
  if (data) {
    const schoolUpper = (data.school_name || '').toUpperCase();
    const isOldName =
      schoolUpper.includes('TELADAN') ||
      schoolUpper.includes('SMP NEGERI') ||
      schoolUpper.includes('SMPN') ||
      schoolUpper.includes('SMP/MTS');

    if (isOldName) {
      try {
        const updateObj = {
          school_name: 'SMKS 3 PASUNDAN PERKASA',
          npsn: (data.npsn === '20108899' || !data.npsn) ? '20219876' : data.npsn,
          school_level: 'SMA/SMK/MA' as const,
          class_name: (data.class_name === 'Kelas VIII-A' || !data.class_name) ? 'Kelas XI TKJ-1' : data.class_name,
          phase: (data.phase === 'Fase D' || !data.phase) ? 'Fase F' : data.phase,
          principal_name: (data.principal_name?.includes('Ratna') || !data.principal_name) ? 'Drs. H. Mamat Rohimat, M.M.' : data.principal_name,
          updated_at: new Date().toISOString(),
        };
        const { data: updatedRow } = await supabase
          .from('school_settings')
          .update(updateObj)
          .eq('id', data.id)
          .select()
          .single();

        if (updatedRow) return updatedRow;
      } catch (e) {
        console.warn('Otomatis sinkronisasi ke SMKS 3 PASUNDAN PERKASA:', e);
      }
    }
  }

  return data;
}

export async function saveSchoolSettings(settings: Partial<SchoolSettings>): Promise<SchoolSettings> {
  const supabase = getSupabase();

  const payload: Record<string, unknown> = {
    school_name: settings.school_name?.trim() || 'SMKS 3 PASUNDAN PERKASA',
    npsn: settings.npsn?.trim() || null,
    school_level: settings.school_level || 'SMA/SMK/MA',
    class_name: settings.class_name?.trim() || 'Kelas XI TKJ-1',
    phase: settings.phase?.trim() || 'Fase F',
    academic_year: settings.academic_year?.trim() || '2026/2027',
    semester: settings.semester || 'Genap',
    teacher_name: settings.teacher_name?.trim() || 'Dadan Suryadi, S.Pd., M.Kom.',
    teacher_nip: settings.teacher_nip?.trim() || null,
    principal_name: settings.principal_name?.trim() || 'Drs. H. Mamat Rohimat, M.M.',
    principal_nip: settings.principal_nip?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  // Validasi format UUID untuk targetId (mencegah error invalid input syntax for type uuid)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let targetId: string | null = null;

  if (settings.id && uuidRegex.test(settings.id)) {
    targetId = settings.id;
  } else {
    // Cari row yang sudah ada di tabel school_settings
    const { data: existingRows } = await supabase
      .from('school_settings')
      .select('id')
      .limit(1);

    if (existingRows && existingRows.length > 0 && existingRows[0].id) {
      targetId = existingRows[0].id;
    }
  }

  if (targetId) {
    const { data, error } = await supabase
      .from('school_settings')
      .update(payload)
      .eq('id', targetId)
      .select()
      .single();

    if (error) throw new Error(`Gagal memperbarui pengaturan sekolah: ${error.message}`);
    return data;
  }

  // Jika belum ada row sama sekali di database, lakukan insert baru
  const { data, error } = await supabase
    .from('school_settings')
    .insert([payload])
    .select()
    .single();

  if (error) throw new Error(`Gagal menyimpan pengaturan sekolah: ${error.message}`);
  return data;
}

// ============================================================
// 2. MASTER SISWA (students)
// ============================================================
export async function fetchStudents(): Promise<Student[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('full_name', { ascending: true });

  if (error) throw new Error(`Gagal memuat data siswa: ${error.message}`);
  return data || [];
}

export async function createStudent(student: Omit<Student, 'id' | 'created_at'>): Promise<Student> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('students')
    .insert([student])
    .select()
    .single();

  if (error) throw new Error(`Gagal menambah siswa: ${error.message}`);
  return data;
}

export async function updateStudent(id: string, student: Partial<Student>): Promise<Student> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('students')
    .update(student)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Gagal memperbarui data siswa: ${error.message}`);
  return data;
}

export async function deleteStudent(id: string): Promise<void> {
  const supabase = getSupabase();
  try {
    // Hapus data relasi terkait terlebih dahulu jika tabel tidak memiliki ON DELETE CASCADE
    await supabase.from('attendances').delete().eq('student_id', id);
    await supabase.from('grades').delete().eq('student_id', id);
    await supabase.from('report_cards').delete().eq('student_id', id);
  } catch (err) {
    console.warn('Pembersihan data relasi siswa:', err);
  }

  const { error } = await supabase.from('students').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus siswa: ${error.message}`);
}

export async function batchImportStudents(students: Omit<Student, 'id' | 'created_at'>[]): Promise<Student[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('students')
    .upsert(students, { onConflict: 'nis' })
    .select();

  if (error) throw new Error(`Gagal mengimpor siswa: ${error.message}`);
  return data || [];
}

// ============================================================
// 3. MATA PELAJARAN (subjects)
// ============================================================
export async function fetchSubjects(): Promise<Subject[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .order('subject_name', { ascending: true });

  if (error) throw new Error(`Gagal memuat mata pelajaran: ${error.message}`);
  return data || [];
}

export async function createSubject(subject: Omit<Subject, 'id' | 'created_at'>): Promise<Subject> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('subjects')
    .insert([subject])
    .select()
    .single();

  if (error) throw new Error(`Gagal menambah mata pelajaran: ${error.message}`);
  return data;
}

export async function updateSubject(id: string, subject: Partial<Subject>): Promise<Subject> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('subjects')
    .update(subject)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Gagal mengubah mata pelajaran: ${error.message}`);
  return data;
}

export async function deleteSubject(id: string): Promise<void> {
  const supabase = getSupabase();
  try {
    // Hapus data berelasi dengan mapel terlebih dahulu
    await supabase.from('schedules').delete().eq('subject_id', id);
    await supabase.from('teaching_journals').delete().eq('subject_id', id);
    await supabase.from('grades').delete().eq('subject_id', id);
  } catch (err) {
    console.warn('Pembersihan data relasi mapel:', err);
  }

  const { error } = await supabase.from('subjects').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus mata pelajaran: ${error.message}`);
}

// ============================================================
// 4. JADWAL PELAJARAN (schedules)
// ============================================================
export async function fetchSchedules(): Promise<Schedule[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('schedules')
    .select('*, subjects(*)')
    .order('start_time', { ascending: true });

  if (error) throw new Error(`Gagal memuat jadwal pelajaran: ${error.message}`);
  return data || [];
}

export async function createSchedule(schedule: Omit<Schedule, 'id' | 'created_at' | 'subjects'>): Promise<Schedule> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('schedules')
    .insert([schedule])
    .select('*, subjects(*)')
    .single();

  if (error) throw new Error(`Gagal menambah jadwal: ${error.message}`);
  return data;
}

export async function updateSchedule(id: string, schedule: Partial<Schedule>): Promise<Schedule> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('schedules')
    .update(schedule)
    .eq('id', id)
    .select('*, subjects(*)')
    .single();

  if (error) throw new Error(`Gagal memperbarui jadwal: ${error.message}`);
  return data;
}

export async function deleteSchedule(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('schedules').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus jadwal: ${error.message}`);
}

// ============================================================
// 5. ABSENSI SISWA (attendances)
// ============================================================
export async function fetchDailyAttendances(dateStr: string): Promise<Attendance[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('attendances')
    .select('*, students(*)')
    .eq('attendance_date', dateStr);

  if (error) throw new Error(`Gagal memuat absensi tanggal ${dateStr}: ${error.message}`);
  return data || [];
}

export async function batchUpsertAttendances(
  records: { student_id: string; attendance_date: string; status: AttendanceStatus; notes?: string | null }[]
): Promise<void> {
  if (records.length === 0) return;
  const supabase = getSupabase();
  const { error } = await supabase
    .from('attendances')
    .upsert(records, { onConflict: 'student_id,attendance_date' });

  if (error) throw new Error(`Gagal menyimpan absensi: ${error.message}`);
}

export async function fetchMonthlyAttendances(year: number, month: number): Promise<Attendance[]> {
  const supabase = getSupabase();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('attendances')
    .select('*, students(*)')
    .gte('attendance_date', startDate)
    .lt('attendance_date', endDate);

  if (error) throw new Error(`Gagal memuat rekapitulasi absensi bulanan: ${error.message}`);
  return data || [];
}

export async function getStudentAttendanceSummary(studentId: string): Promise<AttendanceSummary> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('attendances')
    .select('status')
    .eq('student_id', studentId);

  if (error) throw new Error(`Gagal memuat ringkasan absensi: ${error.message}`);

  const counts = { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
  (data || []).forEach((row) => {
    if (row.status === 'Hadir') counts.hadir += 1;
    else if (row.status === 'Sakit') counts.sakit += 1;
    else if (row.status === 'Izin') counts.izin += 1;
    else if (row.status === 'Alpa') counts.alpa += 1;
  });

  const total = counts.hadir + counts.sakit + counts.izin + counts.alpa;
  const percentage = total > 0 ? Math.round((counts.hadir / total) * 100) : 100;

  return {
    ...counts,
    total_effective_days: total,
    percentage,
  };
}

// Auto-Sync helper for teaching journals
export async function getDailyAttendanceCount(dateStr: string): Promise<{
  total_present: number;
  total_absent: number;
  absentStudents: { name: string; status: AttendanceStatus }[];
}> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('attendances')
    .select('status, students(full_name)')
    .eq('attendance_date', dateStr);

  if (error) return { total_present: 0, total_absent: 0, absentStudents: [] };

  let present = 0;
  let absent = 0;
  const absentStudents: { name: string; status: AttendanceStatus }[] = [];

  (data || []).forEach((item) => {
    if (item.status === 'Hadir') {
      present++;
    } else {
      absent++;
      const studentName = (item.students as unknown as { full_name: string })?.full_name || 'Siswa';
      absentStudents.push({ name: studentName, status: item.status });
    }
  });

  return { total_present: present, total_absent: absent, absentStudents };
}

// ============================================================
// 6. JURNAL MENGAJAR HARIAN (teaching_journals)
// ============================================================
export async function fetchTeachingJournals(): Promise<TeachingJournal[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('teaching_journals')
    .select('*, subjects(*), schedules(*)')
    .order('journal_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Gagal memuat jurnal mengajar: ${error.message}`);
  return data || [];
}

export async function createTeachingJournal(journal: Omit<TeachingJournal, 'id' | 'created_at' | 'subjects' | 'schedules'>): Promise<TeachingJournal> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('teaching_journals')
    .insert([journal])
    .select('*, subjects(*), schedules(*)')
    .single();

  if (error) throw new Error(`Gagal menyimpan jurnal mengajar: ${error.message}`);
  return data;
}

export async function updateTeachingJournal(id: string, journal: Partial<TeachingJournal>): Promise<TeachingJournal> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('teaching_journals')
    .update(journal)
    .eq('id', id)
    .select('*, subjects(*), schedules(*)')
    .single();

  if (error) throw new Error(`Gagal memperbarui jurnal: ${error.message}`);
  return data;
}

export async function deleteTeachingJournal(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('teaching_journals').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus jurnal: ${error.message}`);
}

// ============================================================
// 7. BUKU NILAI (grades)
// ============================================================
export async function fetchGradesBySubject(subjectId: string, academicYear: string, semester: string): Promise<Grade[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('grades')
    .select('*, students(*), subjects(*)')
    .eq('subject_id', subjectId)
    .eq('academic_year', academicYear)
    .eq('semester', semester);

  if (error) throw new Error(`Gagal memuat nilai: ${error.message}`);
  return data || [];
}

export async function fetchAllGradesForStudent(studentId: string, academicYear: string, semester: string): Promise<Grade[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('grades')
    .select('*, subjects(*)')
    .eq('student_id', studentId)
    .eq('academic_year', academicYear)
    .eq('semester', semester);

  if (error) throw new Error(`Gagal memuat nilai siswa: ${error.message}`);
  return data || [];
}

export async function fetchAllGrades(academicYear: string, semester: string): Promise<Grade[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('grades')
    .select('*, students(*), subjects(*)')
    .eq('academic_year', academicYear)
    .eq('semester', semester);

  if (error) throw new Error(`Gagal memuat seluruh nilai kelas: ${error.message}`);
  return data || [];
}

export async function batchUpsertGrades(
  grades: {
    student_id: string;
    subject_id: string;
    academic_year: string;
    semester: string;
    nh1: number;
    nh2: number;
    nh3: number;
    nh4: number;
    sts_score: number;
    sas_pat_score: number;
    competency_description?: string | null;
  }[]
): Promise<void> {
  if (grades.length === 0) return;
  const supabase = getSupabase();
  
  const payload = grades.map(g => ({
    ...g,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('grades')
    .upsert(payload, { onConflict: 'student_id,subject_id,academic_year,semester' });

  if (error) throw new Error(`Gagal menyimpan nilai ke Supabase: ${error.message}`);
}

// ============================================================
// 8. CATATAN RAPOR & KENAIKAN KELAS (report_cards)
// ============================================================
export async function fetchReportCard(studentId: string, academicYear: string, semester: string): Promise<ReportCard | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('report_cards')
    .select('*, students(*)')
    .eq('student_id', studentId)
    .eq('academic_year', academicYear)
    .eq('semester', semester)
    .maybeSingle();

  if (error) throw new Error(`Gagal memuat catatan rapor: ${error.message}`);
  return data;
}

export async function upsertReportCard(report: Partial<ReportCard> & { student_id: string; academic_year: string; semester: string }): Promise<ReportCard> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('report_cards')
    .upsert([report], { onConflict: 'student_id,academic_year,semester' })
    .select('*, students(*)')
    .single();

  if (error) throw new Error(`Gagal menyimpan data rapor: ${error.message}`);
  return data;
}

// ============================================================
// 9. AKUN PENGGUNA & AUTENTIKASI (app_users di Supabase)
// ============================================================
export async function ensureDefaultUserExists(): Promise<AppUser | null> {
  const supabase = getSupabase();
  try {
    const { data: existingUser } = await supabase
      .from('app_users')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!existingUser) {
      const defaultUser = {
        username: 'guru',
        password: 'guru123',
        full_name: 'Dadan Suryadi, S.Pd., M.Kom.',
        role: 'Guru / Wali Kelas',
      };
      const { data: newUser, error } = await supabase
        .from('app_users')
        .insert([defaultUser])
        .select()
        .single();

      if (!error && newUser) return newUser;
    }
    return existingUser;
  } catch (err) {
    console.warn('Tabel app_users mungkin belum dibuat di Supabase:', err);
    return null;
  }
}

export async function authenticateUser(
  usernameInput: string,
  passwordInput: string
): Promise<{ success: boolean; message?: string; user?: AppUser }> {
  const supabase = getSupabase();

  try {
    // Pastikan user default ada jika tabel kosong
    await ensureDefaultUserExists();

    const usernameTrimmed = usernameInput.trim();
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .ilike('username', usernameTrimmed)
      .maybeSingle();

    if (error) {
      if (error.code === '42P01') {
        return {
          success: false,
          message:
            'Tabel app_users belum dibuat di database Supabase. Silakan jalankan Skrip SQL DDL pada Supabase SQL Editor.',
        };
      }
      return { success: false, message: `Gagal mengakses database: ${error.message}` };
    }

    if (!data) {
      return { success: false, message: 'Username tidak ditemukan di database Supabase.' };
    }

    if (data.password !== passwordInput) {
      return { success: false, message: 'Password salah. Periksa kembali huruf besar/kecil.' };
    }

    return { success: true, user: data };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Koneksi database gagal';
    return { success: false, message: errorMsg };
  }
}

export async function updateUserCredentials(
  userId: string,
  newUsername: string,
  newPassword?: string,
  fullName?: string
): Promise<{ success: boolean; user?: AppUser; message?: string }> {
  const supabase = getSupabase();

  try {
    const updatePayload: Record<string, unknown> = {
      username: newUsername.trim(),
      updated_at: new Date().toISOString(),
    };

    if (newPassword && newPassword.trim()) {
      updatePayload.password = newPassword.trim();
    }

    if (fullName && fullName.trim()) {
      updatePayload.full_name = fullName.trim();
    }

    const { data, error } = await supabase
      .from('app_users')
      .update(updatePayload)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, message: 'Username tersebut sudah digunakan oleh akun lain.' };
      }
      return { success: false, message: error.message };
    }

    return { success: true, user: data };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Gagal memperbarui akun';
    return { success: false, message: errorMsg };
  }
}

// ============================================================
// SEED DATA DIRECT TO SUPABASE (Untuk Proyek Baru)
// ============================================================
export async function seedSampleDataToSupabase(): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabase();

  try {
    // 0. Akun User Default (Tersimpan di Supabase)
    const defaultUser = {
      username: 'guru',
      password: 'guru123',
      full_name: 'Dadan Suryadi, S.Pd., M.Kom.',
      role: 'Guru / Wali Kelas',
    };
    await supabase.from('app_users').upsert([defaultUser], { onConflict: 'username' });

    // 1. Settings
    const settings = {
      school_name: 'SMKS 3 PASUNDAN PERKASA',
      npsn: '20219876',
      school_level: 'SMA/SMK/MA' as const,
      class_name: 'Kelas XI TKJ-1',
      phase: 'Fase F',
      academic_year: '2026/2027',
      semester: 'Genap' as const,
      teacher_name: 'Dadan Suryadi, S.Pd., M.Kom.',
      teacher_nip: '198507152010011012',
      principal_name: 'Drs. H. Mamat Rohimat, M.M.',
      principal_nip: '197603181999032004',
    };
    await supabase.from('school_settings').upsert([settings]);

    // 2. Subjects
    const sampleSubjects = [
      { subject_code: 'PAI', subject_name: 'Pendidikan Agama & Budi Pekerti', kktp_score: 75.0 },
      { subject_code: 'PPKN', subject_name: 'Pendidikan Pancasila & Kewarganegaraan', kktp_score: 75.0 },
      { subject_code: 'BIN', subject_name: 'Bahasa Indonesia', kktp_score: 75.0 },
      { subject_code: 'MAT', subject_name: 'Matematika', kktp_score: 72.0 },
      { subject_code: 'IPA', subject_name: 'Ilmu Pengetahuan Alam', kktp_score: 75.0 },
      { subject_code: 'IPS', subject_name: 'Ilmu Pengetahuan Sosial', kktp_score: 75.0 },
      { subject_code: 'BIG', subject_name: 'Bahasa Inggris', kktp_score: 72.0 },
      { subject_code: 'PJOK', subject_name: 'Pendidikan Jasmani, Olahraga & Kesehatan', kktp_score: 78.0 },
      { subject_code: 'INF', subject_name: 'Informatika', kktp_score: 75.0 },
      { subject_code: 'SNB', subject_name: 'Seni & Budaya', kktp_score: 75.0 },
    ];
    const { data: insertedSubjects } = await supabase.from('subjects').upsert(sampleSubjects, { onConflict: 'subject_code' }).select();

    // 3. Students
    const sampleStudents = [
      { nis: '240801', nisn: '0089123401', full_name: 'Ahmad Faiz Al-Ghifari', gender: 'L' as const, parent_name: 'Bambang Supeno' },
      { nis: '240802', nisn: '0089123402', full_name: 'Anindya Putri Kirana', gender: 'P' as const, parent_name: 'Joko Prabowo' },
      { nis: '240803', nisn: '0089123403', full_name: 'Bima Satria Wicaksono', gender: 'L' as const, parent_name: 'Agus Setiawan' },
      { nis: '240804', nisn: '0089123404', full_name: 'Cantika Dewi Larasati', gender: 'P' as const, parent_name: 'Heri Susanto' },
      { nis: '240805', nisn: '0089123405', full_name: 'Daffa Rizky Maulana', gender: 'L' as const, parent_name: 'Tri Wahyudi' },
      { nis: '240806', nisn: '0089123406', full_name: 'Eka Nur Halizah', gender: 'P' as const, parent_name: 'Mansur Hidayat' },
      { nis: '240807', nisn: '0089123407', full_name: 'Fadhil Rahman Hakim', gender: 'L' as const, parent_name: 'Rudi Hartono' },
      { nis: '240808', nisn: '0089123408', full_name: 'Gita Maharani', gender: 'P' as const, parent_name: 'Surya Saputra' },
      { nis: '240809', nisn: '0089123409', full_name: 'Hafiz Pratama Nugraha', gender: 'L' as const, parent_name: 'Arief Budiman' },
      { nis: '240810', nisn: '0089123410', full_name: 'Intan Safira Zahra', gender: 'P' as const, parent_name: 'Edi Purnomo' },
    ];
    const { data: insertedStudents } = await supabase.from('students').upsert(sampleStudents, { onConflict: 'nis' }).select();

    // 4. Schedules (jika ada subjects)
    if (insertedSubjects && insertedSubjects.length >= 6) {
      const mat = insertedSubjects.find(s => s.subject_code === 'MAT') || insertedSubjects[0];
      const bin = insertedSubjects.find(s => s.subject_code === 'BIN') || insertedSubjects[1];
      const ipa = insertedSubjects.find(s => s.subject_code === 'IPA') || insertedSubjects[2];
      const big = insertedSubjects.find(s => s.subject_code === 'BIG') || insertedSubjects[3];
      const inf = insertedSubjects.find(s => s.subject_code === 'INF') || insertedSubjects[4];

      const sampleSchedules = [
        { day_of_week: 'Senin' as const, start_time: '07:30', end_time: '09:00', period_number: 'Jam ke-1 & 2', subject_id: bin.id, room_notes: 'Ruang Teori 8A' },
        { day_of_week: 'Senin' as const, start_time: '09:15', end_time: '11:15', period_number: 'Jam ke-3 & 4', subject_id: mat.id, room_notes: 'Ruang Teori 8A' },
        { day_of_week: 'Selasa' as const, start_time: '07:30', end_time: '09:45', period_number: 'Jam ke-1 s.d. 3', subject_id: ipa.id, room_notes: 'Laboratorium IPA' },
        { day_of_week: 'Rabu' as const, start_time: '07:30', end_time: '09:00', period_number: 'Jam ke-1 & 2', subject_id: big.id, room_notes: 'Ruang Teori 8A' },
        { day_of_week: 'Kamis' as const, start_time: '08:00', end_time: '10:15', period_number: 'Jam ke-2 s.d. 4', subject_id: inf.id, room_notes: 'Laboratorium Komputer' },
      ];
      await supabase.from('schedules').insert(sampleSchedules);
    }

    // 5. Today's attendance seed
    if (insertedStudents && insertedStudents.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const attendanceSeed = insertedStudents.map((st, idx) => ({
        student_id: st.id,
        attendance_date: today,
        status: (idx === 3 ? 'Izin' : idx === 6 ? 'Sakit' : 'Hadir') as AttendanceStatus,
        notes: idx === 3 ? 'Keperluan keluarga' : idx === 6 ? 'Demam flu' : null,
      }));
      await supabase.from('attendances').upsert(attendanceSeed, { onConflict: 'student_id,attendance_date' });
    }

    // 6. Sample Grades for first subject
    if (insertedStudents && insertedSubjects && insertedSubjects.length > 0) {
      const targetSub = insertedSubjects[0];
      const sampleGrades = insertedStudents.map((st, idx) => ({
        student_id: st.id,
        subject_id: targetSub.id,
        academic_year: '2026/2027',
        semester: 'Genap' as const,
        nh1: 82 + (idx % 6),
        nh2: 85 + (idx % 8),
        nh3: 80 + (idx % 5),
        nh4: 86 + (idx % 4),
        sts_score: 84 + (idx % 7),
        sas_pat_score: 88 + (idx % 5),
        competency_description: 'Menunjukkan penguasaan materi yang sangat baik dalam memahami konsep pokok dan penerapannya secara kritis.',
      }));
      await batchUpsertGrades(sampleGrades);
    }

    return {
      success: true,
      message: 'Berhasil menginisialisasi data master sekolah, mata pelajaran, siswa, dan jadwal ke Supabase Cloud!',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Gagal melakukan seeding';
    return { success: false, message: errorMsg };
  }
}
