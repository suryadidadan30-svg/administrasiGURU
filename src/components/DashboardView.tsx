import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Calendar,
  BookOpen,
  Award,
  Plus,
  Save,
  Trash2,
  Edit2,
  FileUp,
  School,
  CheckCircle,
  RefreshCw,
  Sparkles,
  KeyRound,
  ShieldCheck,
  Lock,
  User,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  AppUser,
  SchoolSettings,
  Student,
  Subject,
  Schedule,
  TeachingJournal,
  Grade,
  Attendance,
} from '../types/database.types';
import {
  fetchSchoolSettings,
  saveSchoolSettings,
  fetchStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  batchImportStudents,
  fetchSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  fetchSchedules,
  fetchTeachingJournals,
  fetchDailyAttendances,
  fetchAllGrades,
  updateUserCredentials,
} from '../services/academicService';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { useToast } from './Toast';

interface DashboardViewProps {
  settings: SchoolSettings | null;
  currentUser: AppUser | null;
  onUserUpdated: (user: AppUser) => void;
  onSettingsUpdated: (newSettings: SchoolSettings) => void;
  onOpenConfig: () => void;
  onNavigateToSchedule: () => void;
  onNavigateToAttendance: () => void;
  onNavigateToJournal: () => void;
  onNavigateToGrades: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  settings,
  currentUser,
  onUserUpdated,
  onSettingsUpdated,
  onOpenConfig,
  onNavigateToSchedule,
  onNavigateToAttendance,
  onNavigateToJournal,
  onNavigateToGrades,
}) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'subjects' | 'account'>('overview');
  const [loading, setLoading] = useState(false);

  // Account form state for changing username & password in Supabase
  const [accountForm, setAccountForm] = useState({
    username: currentUser?.username || '',
    full_name: currentUser?.full_name || '',
    new_password: '',
    confirm_password: '',
  });
  const [savingAccount, setSavingAccount] = useState(false);

  // Data states
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [journals, setJournals] = useState<TeachingJournal[]>([]);
  const [todayAttendances, setTodayAttendances] = useState<Attendance[]>([]);
  const [allGrades, setAllGrades] = useState<Grade[]>([]);

  // School Settings Form state
  const [settingsForm, setSettingsForm] = useState<Partial<SchoolSettings>>({
    school_name: settings?.school_name || 'SMKS 3 PASUNDAN PERKASA',
    npsn: settings?.npsn || '20219876',
    school_level: settings?.school_level || 'SMA/SMK/MA',
    class_name: settings?.class_name || 'Kelas XI TKJ-1',
    phase: settings?.phase || 'Fase F',
    academic_year: settings?.academic_year || '2026/2027',
    semester: settings?.semester || 'Genap',
    teacher_name: settings?.teacher_name || 'Dadan Suryadi, S.Pd., M.Kom.',
    teacher_nip: settings?.teacher_nip || '198507152010011012',
    principal_name: settings?.principal_name || 'Drs. H. Mamat Rohimat, M.M.',
    principal_nip: settings?.principal_nip || '197603181999032004',
  });

  // Student CRUD modal / state
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentForm, setStudentForm] = useState({
    nis: '',
    nisn: '',
    full_name: '',
    gender: 'L' as 'L' | 'P',
    parent_name: '',
    is_active: true,
  });

  // Subject CRUD modal / state
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectForm, setSubjectForm] = useState({
    subject_code: '',
    subject_name: '',
    kktp_score: 75,
  });

  // Settings saving state & Edit Profile Modal state
  const [savingSettings, setSavingSettings] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);

  // In-app Delete Confirmation Modals (menggantikan window.confirm yang terblokir di iframe)
  const [studentToDelete, setStudentToDelete] = useState<{ id: string; name: string } | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Initial load
  const loadDashboardData = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const [
        stData,
        sbData,
        scData,
        jData,
        attData,
        cfgData,
      ] = await Promise.all([
        fetchStudents().catch(() => []),
        fetchSubjects().catch(() => []),
        fetchSchedules().catch(() => []),
        fetchTeachingJournals().catch(() => []),
        fetchDailyAttendances(todayStr).catch(() => []),
        fetchSchoolSettings().catch(() => null),
      ]);

      setStudents(stData);
      setSubjects(sbData);
      setSchedules(scData);
      setJournals(jData);
      setTodayAttendances(attData);

      if (cfgData) {
        onSettingsUpdated(cfgData);
        setSettingsForm(cfgData);
        // Load grades for academic year & semester
        const gData = await fetchAllGrades(cfgData.academic_year, cfgData.semester).catch(() => []);
        setAllGrades(gData);
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error('Gagal Memuat Data', 'Pastikan skrip SQL sudah dijalankan di Supabase.');
    } finally {
      setLoading(false);
    }
  }, [onSettingsUpdated, toast]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (settings) {
      setSettingsForm(settings);
    }
  }, [settings]);

  useEffect(() => {
    if (currentUser) {
      setAccountForm((prev) => ({
        ...prev,
        username: currentUser.username,
        full_name: currentUser.full_name,
      }));
    }
  }, [currentUser]);

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!accountForm.username.trim()) {
      toast.warning('Input Kurang', 'Username tidak boleh kosong');
      return;
    }
    if (accountForm.new_password) {
      if (accountForm.new_password.length < 4) {
        toast.warning('Password Terlalu Pendek', 'Password minimal 4 karakter');
        return;
      }
      if (accountForm.new_password !== accountForm.confirm_password) {
        toast.error('Password Tidak Cocok', 'Konfirmasi password baru tidak sesuai.');
        return;
      }
    }

    setSavingAccount(true);
    try {
      const res = await updateUserCredentials(
        currentUser.id,
        accountForm.username,
        accountForm.new_password || undefined,
        accountForm.full_name || undefined
      );

      if (res.success && res.user) {
        onUserUpdated(res.user);
        setAccountForm((prev) => ({
          ...prev,
          new_password: '',
          confirm_password: '',
        }));
        toast.success(
          'Akun Berhasil Diperbarui',
          'Username dan password baru berhasil disimpan langsung di database Supabase Cloud!'
        );
      } else {
        toast.error('Gagal Memperbarui Akun', res.message || 'Terjadi kesalahan.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal';
      toast.error('Gagal Menyimpan Akun', msg);
    } finally {
      setSavingAccount(false);
    }
  };

  // Metric calculations
  const totalStudents = students.filter((s) => s.is_active).length;
  const boysCount = students.filter((s) => s.is_active && s.gender === 'L').length;
  const girlsCount = students.filter((s) => s.is_active && s.gender === 'P').length;

  const todayPresentCount = todayAttendances.filter((a) => a.status === 'Hadir').length;
  const todayTotalLogged = todayAttendances.length;
  const todayAttendanceRate =
    todayTotalLogged > 0
      ? Math.round((todayPresentCount / todayTotalLogged) * 100)
      : totalStudents > 0
      ? 100
      : 0;

  // Today's schedule day name
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const todayDayName = dayNames[new Date().getDay()];
  const todaySchedules = schedules.filter((s) => s.day_of_week === todayDayName);

  // Grades average
  const validGrades = allGrades.filter((g) => (g.final_score ?? 0) > 0);
  const classAverage =
    validGrades.length > 0
      ? Math.round((validGrades.reduce((sum, g) => sum + (g.final_score ?? 0), 0) / validGrades.length) * 10) / 10
      : 0;

  // Handle Save School Settings (Profil Sekolah & Penanggung Jawab)
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!settingsForm.school_name?.trim()) {
      toast.warning('Input Kurang', 'Nama sekolah / madrasah wajib diisi.');
      return;
    }
    if (!settingsForm.class_name?.trim()) {
      toast.warning('Input Kurang', 'Nama kelas / rombel wajib diisi.');
      return;
    }
    if (!settingsForm.teacher_name?.trim()) {
      toast.warning('Input Kurang', 'Nama guru / wali kelas wajib diisi.');
      return;
    }
    if (!settingsForm.principal_name?.trim()) {
      toast.warning('Input Kurang', 'Nama kepala sekolah wajib diisi.');
      return;
    }

    setSavingSettings(true);
    try {
      if (isSupabaseConfigured()) {
        const updated = await saveSchoolSettings(settingsForm);
        setSettingsForm(updated);
        onSettingsUpdated(updated);
        toast.success(
          'Profil Sekolah & Penanggung Jawab Disimpan',
          'Identitas SMKS 3 PASUNDAN PERKASA dan data pejabat penandatangan berhasil disimpan ke database Supabase Cloud!'
        );
        setIsEditProfileModalOpen(false);
      } else {
        const previewSettings: SchoolSettings = {
          id: settingsForm.id || 'preview-settings',
          school_name: settingsForm.school_name.trim(),
          npsn: settingsForm.npsn?.trim() || null,
          school_level: settingsForm.school_level || 'SMA/SMK/MA',
          class_name: settingsForm.class_name.trim(),
          phase: settingsForm.phase?.trim() || 'Fase F',
          academic_year: settingsForm.academic_year?.trim() || '2026/2027',
          semester: settingsForm.semester || 'Genap',
          teacher_name: settingsForm.teacher_name.trim(),
          teacher_nip: settingsForm.teacher_nip?.trim() || null,
          principal_name: settingsForm.principal_name.trim(),
          principal_nip: settingsForm.principal_nip?.trim() || null,
          updated_at: new Date().toISOString(),
        };
        setSettingsForm(previewSettings);
        onSettingsUpdated(previewSettings);
        toast.success(
          'Profil & Penanggung Jawab Diperbarui',
          'Perubahan identitas sekolah dan penandatangan dokumen berhasil disimpan di aplikasi.'
        );
        setIsEditProfileModalOpen(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan identitas';
      toast.error('Gagal Menyimpan Identitas', msg);
    } finally {
      setSavingSettings(false);
    }
  };

  // Student CRUD
  const handleOpenStudentModal = (student?: Student) => {
    if (student) {
      setEditingStudent(student);
      setStudentForm({
        nis: student.nis,
        nisn: student.nisn || '',
        full_name: student.full_name,
        gender: student.gender,
        parent_name: student.parent_name || '',
        is_active: student.is_active,
      });
    } else {
      setEditingStudent(null);
      setStudentForm({
        nis: `2408${String(students.length + 1).padStart(2, '0')}`,
        nisn: '',
        full_name: '',
        gender: 'L',
        parent_name: '',
        is_active: true,
      });
    }
    setStudentModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingStudent) {
        const res = await updateStudent(editingStudent.id, studentForm);
        setStudents((prev) => prev.map((s) => (s.id === editingStudent.id ? res : s)));
        toast.success('Data Siswa Diperbarui', `${res.full_name} berhasil disimpan ke Supabase.`);
      } else {
        const res = await createStudent(studentForm);
        setStudents((prev) => [...prev, res].sort((a, b) => a.full_name.localeCompare(b.full_name)));
        toast.success('Siswa Baru Ditambahkan', `${res.full_name} berhasil disimpan ke database.`);
      }
      setStudentModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal';
      toast.error('Gagal Menyimpan Siswa', msg);
    }
  };

  // Buka modal konfirmasi hapus siswa (tanpa window.confirm yang terblokir di iframe)
  const handleDeleteStudent = (id: string, name: string) => {
    setStudentToDelete({ id, name });
  };

  const handleConfirmDeleteStudent = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);
    try {
      await deleteStudent(studentToDelete.id);
      setStudents((prev) => prev.filter((s) => s.id !== studentToDelete.id));
      toast.success('Siswa Berhasil Dihapus', `Data ${studentToDelete.name} telah dihapus dari database Supabase.`);
      setStudentToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal';
      toast.error('Gagal Menghapus Siswa', msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Import CSV / Excel students
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

        if (data.length === 0) {
          toast.warning('File Kosong', 'Tidak ada data siswa dalam file yang diunggah.');
          return;
        }

        const parsedStudents = data.map((row, index) => {
          const nis = String(row['NIS'] || row['nis'] || `2408${String(students.length + index + 1).padStart(2, '0')}`);
          const nisn = String(row['NISN'] || row['nisn'] || '');
          const fullName = String(row['Nama Lengkap'] || row['Nama'] || row['full_name'] || `Siswa ${index + 1}`);
          const genderRaw = String(row['JK'] || row['Jenis Kelamin'] || row['gender'] || 'L').toUpperCase();
          const gender = genderRaw.startsWith('P') ? ('P' as const) : ('L' as const);
          const parentName = String(row['Nama Orang Tua'] || row['Orang Tua'] || row['parent_name'] || '');

          return {
            nis,
            nisn: nisn || null,
            full_name: fullName,
            gender,
            parent_name: parentName || null,
            is_active: true,
          };
        });

        setLoading(true);
        const imported = await batchImportStudents(parsedStudents);
        setStudents(imported.sort((a, b) => a.full_name.localeCompare(b.full_name)));
        toast.success('Impor Berhasil', `Berhasil mengimpor ${imported.length} data siswa langsung ke Supabase Cloud.`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Format file tidak didukung';
        toast.error('Gagal Mengimpor File', msg);
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // Subject CRUD
  const handleOpenSubjectModal = (subject?: Subject) => {
    if (subject) {
      setEditingSubject(subject);
      setSubjectForm({
        subject_code: subject.subject_code,
        subject_name: subject.subject_name,
        kktp_score: subject.kktp_score,
      });
    } else {
      setEditingSubject(null);
      setSubjectForm({
        subject_code: '',
        subject_name: '',
        kktp_score: 75,
      });
    }
    setSubjectModalOpen(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSubject) {
        const res = await updateSubject(editingSubject.id, subjectForm);
        setSubjects((prev) => prev.map((s) => (s.id === editingSubject.id ? res : s)));
        toast.success('Mata Pelajaran Diperbarui', `${res.subject_name} berhasil disimpan.`);
      } else {
        const res = await createSubject(subjectForm);
        setSubjects((prev) => [...prev, res].sort((a, b) => a.subject_name.localeCompare(b.subject_name)));
        toast.success('Mata Pelajaran Ditambahkan', `${res.subject_name} berhasil disimpan ke Supabase.`);
      }
      setSubjectModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal';
      toast.error('Gagal Menyimpan Mata Pelajaran', msg);
    }
  };

  const handleDeleteSubject = (id: string, name: string) => {
    setSubjectToDelete({ id, name });
  };

  const handleConfirmDeleteSubject = async () => {
    if (!subjectToDelete) return;
    setIsDeleting(true);
    try {
      await deleteSubject(subjectToDelete.id);
      setSubjects((prev) => prev.filter((s) => s.id !== subjectToDelete.id));
      toast.success('Mata Pelajaran Dihapus', `${subjectToDelete.name} telah dihapus dari Supabase.`);
      setSubjectToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal';
      toast.error('Gagal Menghapus Mapel', msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner if Supabase not configured */}
      {!isSupabaseConfigured() && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm">Basis Data Supabase Cloud Belum Terhubung</p>
              <p className="text-xs text-amber-700">
                Silakan hubungkan Supabase Project URL dan Anon Key untuk mengaktifkan sinkronisasi database 100% cloud.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenConfig}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shrink-0 shadow-xs"
          >
            Hubungkan Sekarang
          </button>
        </div>
      )}

      {/* Ucapan Selamat Datang untuk Guru SMKS 3 Pasundan Perkasa */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 sm:p-7 text-white shadow-md border border-blue-800/60">
        <div className="absolute -right-10 -top-10 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-24 -bottom-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Portal Guru &amp; Wali Kelas • SMKS 3 Pasundan Perkasa</span>
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Selamat Datang, Bapak/Ibu Guru SMKS 3 Pasundan Perkasa!
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                Aplikasi Administrasi Kelas &amp; Manajemen Pembelajaran Terpadu{' '}
                <strong className="text-white font-bold">SMKS 3 PASUNDAN PERKASA</strong>.
                Seluruh data profil sekolah, master siswa, jadwal mingguan, absensi harian, jurnal mengajar guru, hingga buku nilai dan cetak rapor A4 dikelola secara terintegrasi dan tersimpan langsung ke basis data cloud Supabase.
              </p>
            </div>

            {/* Quick Information Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 text-slate-200">
                <School className="w-3.5 h-3.5 text-blue-300" />
                <span className="font-semibold text-white">{settings?.school_name || 'SMKS 3 PASUNDAN PERKASA'}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 text-slate-200">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{settings?.class_name || 'Kelas XI TKJ-1'} ({settings?.phase || 'Fase F'})</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 text-slate-200">
                <Calendar className="w-3.5 h-3.5 text-amber-300" />
                <span>TP {settings?.academic_year || '2026/2027'} - Sem. {settings?.semester || 'Genap'}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 text-slate-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                <span>Wali: {settings?.teacher_name || 'Dadan Suryadi, S.Pd., M.Kom.'}</span>
              </div>
            </div>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('overview');
                setIsEditProfileModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
            >
              <Edit2 className="w-4 h-4" />
              Edit Profil Sekolah
            </button>
            <button
              onClick={onNavigateToJournal}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/20 transition cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-emerald-400" />
              Isi Jurnal Mengajar
            </button>
            <button
              onClick={onNavigateToAttendance}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/20 transition cursor-pointer"
            >
              <CheckCircle className="w-4 h-4 text-amber-400" />
              Absensi Siswa Hari Ini
            </button>
          </div>
        </div>
      </div>

      {/* 5 Real-Time Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Siswa */}
        <div
          onClick={() => setActiveTab('students')}
          role="button"
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Siswa Aktif</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{totalStudents}</span>
            <span className="text-xs text-slate-500">Siswa</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-2">
            <span className="text-blue-700 font-semibold">{boysCount} L</span> •{' '}
            <span className="text-rose-600 font-semibold">{girlsCount} P</span>
          </div>
        </div>

        {/* Card 2: Kehadiran Hari Ini */}
        <div
          onClick={onNavigateToAttendance}
          role="button"
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kehadiran Hari Ini</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-600">{todayAttendanceRate}%</span>
            <span className="text-xs text-slate-500">Hadir</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {todayTotalLogged > 0 ? `${todayPresentCount} dari ${todayTotalLogged} siswa tercatat` : 'Belum diabsen hari ini'}
          </div>
        </div>

        {/* Card 3: Jadwal Hari Ini */}
        <div
          onClick={onNavigateToSchedule}
          role="button"
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jadwal Hari Ini</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{todaySchedules.length}</span>
            <span className="text-xs text-slate-500">Mata Pelajaran</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 truncate">
            {todayDayName}: {todaySchedules.length > 0 ? todaySchedules.map((s) => s.subjects?.subject_name).join(', ') : 'Tidak ada jam mengajar'}
          </div>
        </div>

        {/* Card 4: Jurnal Terisi */}
        <div
          onClick={onNavigateToJournal}
          role="button"
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jurnal Terisi</span>
            <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center group-hover:scale-110 transition">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{journals.length}</span>
            <span className="text-xs text-slate-500">Catatan</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Jurnal KBM harian guru tersimpan
          </div>
        </div>

        {/* Card 5: Rata-rata Nilai Kelas */}
        <div
          onClick={onNavigateToGrades}
          role="button"
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rata-rata Nilai</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-blue-700">{classAverage > 0 ? classAverage : '-'}</span>
            <span className="text-xs text-slate-500">Poin Rapor</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {validGrades.length} capaian nilai terinput
          </div>
        </div>
      </div>

      {/* Main Tabbed Management Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Tab Header */}
        <div className="border-b border-slate-200 px-6 pt-3 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-2 overflow-x-auto pb-px">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition border-b-2 flex items-center gap-2 ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-700 bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <School className="w-4 h-4" />
              Identitas Sekolah &amp; Wali Kelas
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition border-b-2 flex items-center gap-2 ${
                activeTab === 'students'
                  ? 'border-blue-600 text-blue-700 bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              Master Siswa ({students.length})
            </button>
            <button
              onClick={() => setActiveTab('subjects')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition border-b-2 flex items-center gap-2 ${
                activeTab === 'subjects'
                  ? 'border-blue-600 text-blue-700 bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Mata Pelajaran &amp; KKTP ({subjects.length})
            </button>
            <button
              onClick={() => setActiveTab('account')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition border-b-2 flex items-center gap-2 ${
                activeTab === 'account'
                  ? 'border-blue-600 text-blue-700 bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-4 h-4 text-emerald-600" />
              Akun &amp; Ganti Password
            </button>
          </div>

          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition mb-2"
            title="Muat Ulang Data dari Supabase"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tab 1: Identitas Sekolah & Penanggung Jawab Dokumen Form */}
        {activeTab === 'overview' && (
          <form onSubmit={handleSaveSettings} className="p-6 space-y-8">
            {/* Bagian 1: Profil Satuan Pendidikan & Struktur Kelas */}
            <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">1</span>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Profil Satuan Pendidikan &amp; Struktur Kelas
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Identitas resmi sekolah yang dicetak pada Kop Rapor A4, Buku Jurnal Harian, dan Dokumen Administrasi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditProfileModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0 transition cursor-pointer shadow-xs"
                  title="Klik untuk membuka jendela modal edit profil sekolah"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Profil Sekolah (Modal)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Sekolah / Madrasah *</label>
                  <input
                    type="text"
                    required
                    value={settingsForm.school_name ?? ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, school_name: e.target.value })}
                    placeholder="Contoh: SMKS 3 PASUNDAN PERKASA"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-white font-semibold text-slate-900 shadow-2xs"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Nama resmi satuan pendidikan</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">NPSN</label>
                  <input
                    type="text"
                    value={settingsForm.npsn ?? ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, npsn: e.target.value })}
                    placeholder="Nomor Pokok Sekolah Nasional (misal: 20219876)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-white shadow-2xs"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">8 digit kode resmi Kemendikbud</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Jenjang Satuan Pendidikan *</label>
                  <select
                    value={settingsForm.school_level || 'SMA/SMK/MA'}
                    onChange={(e) => setSettingsForm({ ...settingsForm, school_level: e.target.value as SchoolSettings['school_level'] })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-white font-medium shadow-2xs"
                  >
                    <option value="SMA/SMK/MA">SMA / SMK / MA (Fase E, F)</option>
                    <option value="SMP/MTs">SMP / MTs (Fase D)</option>
                    <option value="SD/MI">SD / MI (Fase A, B, C)</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">Menentukan fase kurikulum</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Kelas / Rombel *</label>
                  <input
                    type="text"
                    required
                    value={settingsForm.class_name ?? ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, class_name: e.target.value })}
                    placeholder="Contoh: Kelas XI TKJ-1"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-white font-semibold text-slate-900 shadow-2xs"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Rombongan belajar siswa</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Fase Kurikulum</label>
                  <input
                    type="text"
                    value={settingsForm.phase ?? ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, phase: e.target.value })}
                    placeholder="Contoh: Fase F (SMK Kelas 11-12)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-white shadow-2xs"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Fase Kurikulum Merdeka</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Tahun Ajaran *</label>
                    <input
                      type="text"
                      required
                      value={settingsForm.academic_year ?? ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, academic_year: e.target.value })}
                      placeholder="2026/2027"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-white font-medium shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Semester *</label>
                    <select
                      value={settingsForm.semester || 'Genap'}
                      onChange={(e) => setSettingsForm({ ...settingsForm, semester: e.target.value as SchoolSettings['semester'] })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-white font-medium shadow-2xs"
                    >
                      <option value="Ganjil">Ganjil</option>
                      <option value="Genap">Genap</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Bagian 2: Penanggung Jawab & Penandatangan Dokumen */}
            <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">2</span>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Penanggung Jawab &amp; Penandatangan Dokumen Resmi
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Pejabat yang bertanda tangan pada Rapor Hasil Belajar Siswa, Jurnal Harian, dan Keputusan Kenaikan Kelas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditProfileModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 transition cursor-pointer shadow-xs"
                  title="Klik untuk membuka jendela modal edit penanggung jawab"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Penanggung Jawab (Modal)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Guru / Wali Kelas *</label>
                  <input
                    type="text"
                    required
                    value={settingsForm.teacher_name ?? ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, teacher_name: e.target.value })}
                    placeholder="Nama Lengkap & Gelar Wali Kelas"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-white font-semibold text-slate-900 shadow-2xs"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Contoh: Dadan Suryadi, S.Pd., M.Kom.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">NIP Guru / Wali Kelas</label>
                  <input
                    type="text"
                    value={settingsForm.teacher_nip ?? ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, teacher_nip: e.target.value })}
                    placeholder="198507152010011012"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-white shadow-2xs font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Kosongkan jika bukan ASN / Non-NIP</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Kepala Sekolah *</label>
                  <input
                    type="text"
                    required
                    value={settingsForm.principal_name ?? ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, principal_name: e.target.value })}
                    placeholder="Nama Kepala Sekolah & Gelar"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-white font-semibold text-slate-900 shadow-2xs"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Contoh: Drs. H. Mamat Rohimat, M.M.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">NIP Kepala Sekolah</label>
                  <input
                    type="text"
                    value={settingsForm.principal_nip ?? ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, principal_nip: e.target.value })}
                    placeholder="197603181999032004"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-white shadow-2xs font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Kosongkan jika bukan ASN / Non-NIP</p>
                </div>
              </div>
            </div>

            {/* Action Bar Simpan & Reset */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>
                  Perubahan profil dan penanggung jawab otomatis disinkronkan ke dokumen cetak Rapor A4.
                </span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (settings) {
                      setSettingsForm(settings);
                      toast.info('Form Direset', 'Form dikembalikan ke data tersimpan terakhir.');
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Batal / Reset Form
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition cursor-pointer"
                >
                  {savingSettings ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Menyimpan ke Supabase...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Simpan Profil &amp; Penanggung Jawab
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Tab 2: Master Siswa */}
        {activeTab === 'students' && (
          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Buku Induk &amp; Master Siswa</h3>
                <p className="text-xs text-slate-500">
                  Total {students.length} siswa terdaftar di database Supabase ({boysCount} Laki-laki, {girlsCount} Perempuan)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition border border-slate-300">
                  <FileUp className="w-3.5 h-3.5 text-blue-600" />
                  Impor Excel / CSV
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => handleOpenStudentModal()}
                  className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Siswa
                </button>
              </div>
            </div>

            {/* Students Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto max-h-[480px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">No</th>
                      <th className="px-4 py-3">NIS</th>
                      <th className="px-4 py-3">NISN</th>
                      <th className="px-4 py-3">Nama Lengkap Siswa</th>
                      <th className="px-4 py-3 text-center">L/P</th>
                      <th className="px-4 py-3">Nama Orang Tua/Wali</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center w-24">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                          Belum ada data siswa. Silakan klik &quot;Tambah Siswa&quot; atau &quot;Impor Excel/CSV&quot;.
                        </td>
                      </tr>
                    ) : (
                      students.map((st, idx) => (
                        <tr key={st.id} className="hover:bg-slate-50/80 transition">
                          <td className="px-4 py-2.5 text-center font-mono text-slate-400">{idx + 1}</td>
                          <td className="px-4 py-2.5 font-mono font-semibold text-slate-700">{st.nis}</td>
                          <td className="px-4 py-2.5 font-mono text-slate-500">{st.nisn || '-'}</td>
                          <td className="px-4 py-2.5 font-bold text-slate-900">{st.full_name}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-sm font-bold text-[10px] ${
                                st.gender === 'L' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {st.gender}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">{st.parent_name || '-'}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                st.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {st.is_active ? 'Aktif' : 'Non-Aktif'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenStudentModal(st)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded-md"
                                title="Edit Siswa"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(st.id, st.full_name)}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded-md"
                                title="Hapus Siswa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Master Mata Pelajaran */}
        {activeTab === 'subjects' && (
          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Mata Pelajaran &amp; KKTP/KKM</h3>
                <p className="text-xs text-slate-500">
                  Kriteria Ketercapaian Tujuan Pembelajaran (KKTP) digunakan sebagai acuan ketuntasan penilaian rapor.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleOpenSubjectModal()}
                className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Mata Pelajaran
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjects.length === 0 ? (
                <div className="col-span-full p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-400 text-xs">
                  Belum ada data mata pelajaran. Klik tombol &quot;Tambah Mata Pelajaran&quot; atau isi data demo di pengaturan koneksi.
                </div>
              ) : (
                subjects.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 shadow-2xs hover:shadow-xs transition flex items-start justify-between gap-3"
                  >
                    <div>
                      <span className="px-2 py-0.5 rounded-sm bg-blue-50 text-blue-700 font-mono text-[10px] font-bold">
                        {sub.subject_code}
                      </span>
                      <h4 className="font-bold text-slate-900 text-xs mt-1.5 leading-snug">
                        {sub.subject_name}
                      </h4>
                      <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
                        <span>KKTP:</span>
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-sm">
                          {sub.kktp_score}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenSubjectModal(sub)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSubject(sub.id, sub.subject_name)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Akun & Ganti Password (Tersimpan di Database Supabase) */}
        {activeTab === 'account' && (
          <div className="p-6 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Pengaturan Akun &amp; Kata Sandi Guru
                  </h3>
                  <p className="text-xs text-slate-500">
                    Perbarui username dan password login Anda. Seluruh data disimpan langsung ke tabel <code className="font-mono text-blue-700 bg-blue-50 px-1 py-0.5 rounded-sm">app_users</code> di database Supabase Cloud.
                  </p>
                </div>
              </div>
            </div>

            {/* Current Account Summary Banner */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                  {currentUser?.full_name ? currentUser.full_name.charAt(0).toUpperCase() : 'G'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {currentUser?.full_name || 'Guru / Wali Kelas'}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span>Username Aktif: <b className="font-mono text-blue-700">{currentUser?.username || 'guru'}</b></span>
                    <span>•</span>
                    <span className="text-emerald-700 font-semibold">{currentUser?.role || 'Wali Kelas'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Status: Tersimpan di Supabase Cloud</span>
              </div>
            </div>

            {/* Edit Account Form */}
            <form onSubmit={handleSaveAccount} className="space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  Username Baru *
                </label>
                <input
                  type="text"
                  required
                  value={accountForm.username}
                  onChange={(e) => setAccountForm({ ...accountForm, username: e.target.value })}
                  placeholder="Contoh: guru_dadan"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs font-mono font-semibold focus:ring-2 focus:ring-blue-500 outline-hidden bg-slate-50 focus:bg-white"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Digunakan untuk login ke aplikasi. Karakter alfanumerik tanpa spasi.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <School className="w-3.5 h-3.5 text-blue-600" />
                  Nama Lengkap &amp; Gelar Guru
                </label>
                <input
                  type="text"
                  value={accountForm.full_name}
                  onChange={(e) => setAccountForm({ ...accountForm, full_name: e.target.value })}
                  placeholder="Contoh: Dadan Suryadi, S.Pd., M.Kom."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-hidden bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2">
                  Ubah Kata Sandi (Opsional)
                </h4>
                <p className="text-[11px] text-slate-500 mb-3">
                  Kosongkan kolom di bawah jika Anda hanya ingin memperbarui username atau nama tanpa mengganti kata sandi.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                      Password Baru
                    </label>
                    <input
                      type="password"
                      value={accountForm.new_password}
                      onChange={(e) => setAccountForm({ ...accountForm, new_password: e.target.value })}
                      placeholder="Minimal 4 karakter"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-slate-50 focus:bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                      Konfirmasi Password Baru
                    </label>
                    <input
                      type="password"
                      value={accountForm.confirm_password}
                      onChange={(e) => setAccountForm({ ...accountForm, confirm_password: e.target.value })}
                      placeholder="Ulangi password baru"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-slate-50 focus:bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={savingAccount}
                  className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition"
                >
                  <Save className="w-4 h-4" />
                  {savingAccount ? 'Menyimpan ke Supabase...' : 'Simpan Perubahan Akun ke Supabase'}
                </button>
              </div>
            </form>

            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Jaminan Kepatuhan Penyimpanan Data:
              </p>
              <p className="leading-relaxed opacity-90">
                Data akun dan kata sandi Anda disimpan secara relasional pada tabel <strong>app_users</strong> di cloud Supabase Anda, bukan di <code>localStorage</code> atau <code>sessionStorage</code>. Anda dapat mengakses akun yang sama dari browser atau perangkat lain yang terhubung ke Supabase ini.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Student Modal */}
      {studentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
              </h3>
              <button
                onClick={() => setStudentModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveStudent} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap Siswa *</label>
                <input
                  type="text"
                  required
                  value={studentForm.full_name}
                  onChange={(e) => setStudentForm({ ...studentForm, full_name: e.target.value })}
                  placeholder="Nama Lengkap Sesuai Akta"
                  className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">NIS *</label>
                  <input
                    type="text"
                    required
                    value={studentForm.nis}
                    onChange={(e) => setStudentForm({ ...studentForm, nis: e.target.value })}
                    placeholder="240801"
                    className="w-full px-3 py-2 border rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">NISN</label>
                  <input
                    type="text"
                    value={studentForm.nisn}
                    onChange={(e) => setStudentForm({ ...studentForm, nisn: e.target.value })}
                    placeholder="0089123401"
                    className="w-full px-3 py-2 border rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Jenis Kelamin *</label>
                  <select
                    value={studentForm.gender}
                    onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value as 'L' | 'P' })}
                    className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status Keaktifan</label>
                  <select
                    value={studentForm.is_active ? '1' : '0'}
                    onChange={(e) => setStudentForm({ ...studentForm, is_active: e.target.value === '1' })}
                    className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                  >
                    <option value="1">Aktif</option>
                    <option value="0">Non-Aktif / Pindah</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Orang Tua / Wali</label>
                <input
                  type="text"
                  value={studentForm.parent_name}
                  onChange={(e) => setStudentForm({ ...studentForm, parent_name: e.target.value })}
                  placeholder="Nama Ayah/Ibu/Wali"
                  className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setStudentModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-blue-700 text-white rounded-lg hover:bg-blue-800"
                >
                  Simpan Siswa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subject Modal */}
      {subjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingSubject ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}
              </h3>
              <button
                onClick={() => setSubjectModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveSubject} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Mata Pelajaran *</label>
                <input
                  type="text"
                  required
                  value={subjectForm.subject_name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, subject_name: e.target.value })}
                  placeholder="Contoh: Matematika"
                  className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kode Mapel *</label>
                  <input
                    type="text"
                    required
                    value={subjectForm.subject_code}
                    onChange={(e) => setSubjectForm({ ...subjectForm, subject_code: e.target.value.toUpperCase() })}
                    placeholder="MAT"
                    className="w-full px-3 py-2 border rounded-lg text-xs font-mono uppercase focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">KKTP / KKM *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    value={subjectForm.kktp_score}
                    onChange={(e) => setSubjectForm({ ...subjectForm, kktp_score: parseFloat(e.target.value) || 75 })}
                    className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-hidden font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setSubjectModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-blue-700 text-white rounded-lg hover:bg-blue-800"
                >
                  Simpan Mapel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dialog: Edit Profil Sekolah & Penanggung Jawab Dokumen */}
      {isEditProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/50 flex items-center justify-center border border-white/20">
                  <School className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold">Edit Profil Satuan Pendidikan &amp; Penanggung Jawab</h2>
                  <p className="text-xs text-blue-200">
                    SMKS 3 PASUNDAN PERKASA • Terhubung ke Supabase Cloud
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditProfileModalOpen(false)}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body Scrollable */}
            <form onSubmit={handleSaveSettings} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Bagian 1: Identitas Sekolah */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="w-5 h-5 rounded-md bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">1</span>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Profil Satuan Pendidikan &amp; Kelas
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nama Sekolah / Madrasah *</label>
                    <input
                      type="text"
                      required
                      value={settingsForm.school_name ?? ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, school_name: e.target.value })}
                      placeholder="SMKS 3 PASUNDAN PERKASA"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-white font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">NPSN</label>
                    <input
                      type="text"
                      value={settingsForm.npsn ?? ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, npsn: e.target.value })}
                      placeholder="20219876"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Jenjang Pendidikan *</label>
                    <select
                      value={settingsForm.school_level || 'SMA/SMK/MA'}
                      onChange={(e) => setSettingsForm({ ...settingsForm, school_level: e.target.value as SchoolSettings['school_level'] })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-white font-medium"
                    >
                      <option value="SMA/SMK/MA">SMA / SMK / MA (Fase E, F)</option>
                      <option value="SMP/MTs">SMP / MTs (Fase D)</option>
                      <option value="SD/MI">SD / MI (Fase A, B, C)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nama Kelas / Rombel *</label>
                    <input
                      type="text"
                      required
                      value={settingsForm.class_name ?? ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, class_name: e.target.value })}
                      placeholder="Kelas XI TKJ-1"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-white font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Fase Kurikulum</label>
                    <input
                      type="text"
                      value={settingsForm.phase ?? ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, phase: e.target.value })}
                      placeholder="Fase F"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tahun Ajaran *</label>
                      <input
                        type="text"
                        required
                        value={settingsForm.academic_year ?? ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, academic_year: e.target.value })}
                        placeholder="2026/2027"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Semester *</label>
                      <select
                        value={settingsForm.semester || 'Genap'}
                        onChange={(e) => setSettingsForm({ ...settingsForm, semester: e.target.value as SchoolSettings['semester'] })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
                      >
                        <option value="Ganjil">Ganjil</option>
                        <option value="Genap">Genap</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bagian 2: Penanggung Jawab & Penandatangan Dokumen */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span className="w-5 h-5 rounded-md bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center">2</span>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Pejabat Penandatangan Dokumen Resmi (Wali Kelas &amp; Kepala Sekolah)
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nama Guru / Wali Kelas *</label>
                    <input
                      type="text"
                      required
                      value={settingsForm.teacher_name ?? ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, teacher_name: e.target.value })}
                      placeholder="Dadan Suryadi, S.Pd., M.Kom."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-white font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">NIP Guru / Wali Kelas</label>
                    <input
                      type="text"
                      value={settingsForm.teacher_nip ?? ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, teacher_nip: e.target.value })}
                      placeholder="198507152010011012"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nama Kepala Sekolah *</label>
                    <input
                      type="text"
                      required
                      value={settingsForm.principal_name ?? ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, principal_name: e.target.value })}
                      placeholder="Drs. H. Mamat Rohimat, M.M."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-white font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">NIP Kepala Sekolah</label>
                    <input
                      type="text"
                      value={settingsForm.principal_nip ?? ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, principal_nip: e.target.value })}
                      placeholder="197603181999032004"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons Modal */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditProfileModalOpen(false)}
                  disabled={savingSettings}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-6 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
                >
                  {savingSettings ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      Simpan Profil Sekolah &amp; Penanggung Jawab
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Siswa (In-App Modal) */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="font-extrabold text-base text-slate-900">Hapus Data Siswa?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus data siswa <span className="font-bold text-slate-900">&quot;{studentToDelete.name}&quot;</span>? Seluruh data nilai dan absensi terkait siswa ini juga akan dihapus dari Supabase.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStudent}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Siswa
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Mapel (In-App Modal) */}
      {subjectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="font-extrabold text-base text-slate-900">Hapus Mata Pelajaran?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus mapel <span className="font-bold text-slate-900">&quot;{subjectToDelete.name}&quot;</span>? Seluruh jadwal dan nilai mata pelajaran ini juga akan dihapus dari Supabase.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSubjectToDelete(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSubject}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Mapel
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
