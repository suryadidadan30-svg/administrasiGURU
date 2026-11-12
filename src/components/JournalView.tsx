import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpenCheck,
  Calendar,
  Save,
  Plus,
  Trash2,
  Edit2,
  Printer,
  Sparkles,
  RefreshCw,
  Search,
  Users,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import {
  TeachingJournal,
  Subject,
  Schedule,
  SchoolSettings,
  AttendanceStatus,
} from '../types/database.types';
import {
  fetchTeachingJournals,
  createTeachingJournal,
  updateTeachingJournal,
  deleteTeachingJournal,
  fetchSubjects,
  fetchSchedules,
  getDailyAttendanceCount,
} from '../services/academicService';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { useToast } from './Toast';

interface JournalViewProps {
  settings: SchoolSettings | null;
  initialSchedule?: Schedule | null;
  onClearInitialSchedule?: () => void;
}

export const JournalView: React.FC<JournalViewProps> = ({
  settings,
  initialSchedule,
  onClearInitialSchedule,
}) => {
  const toast = useToast();
  const [journals, setJournals] = useState<TeachingJournal[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    journal_date: new Date().toISOString().split('T')[0],
    schedule_id: '' as string | null,
    subject_id: '',
    period_info: 'Jam ke-1 & 2 (07:30 - 09:00)',
    topic_material: '',
    learning_activities: '',
    student_evaluator_notes: '',
    total_present: 0,
    total_absent: 0,
  });

  // Attendance Sync preview
  const [syncInfo, setSyncInfo] = useState<{
    present: number;
    absent: number;
    absentStudents: { name: string; status: AttendanceStatus }[];
    loading: boolean;
  }>({
    present: 0,
    absent: 0,
    absentStudents: [],
    loading: false,
  });

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [printMode, setPrintMode] = useState(false);

  // Load Journals, Subjects, Schedules
  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    try {
      const [jList, sbList, scList] = await Promise.all([
        fetchTeachingJournals(),
        fetchSubjects(),
        fetchSchedules(),
      ]);
      setJournals(jList);
      setSubjects(sbList);
      setSchedules(scList);

      if (sbList.length > 0 && !formData.subject_id) {
        setFormData((prev) => ({ ...prev, subject_id: sbList[0].id }));
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error('Gagal Memuat Jurnal', 'Pastikan tabel teaching_journals sudah siap.');
    } finally {
      setLoading(false);
    }
  }, [formData.subject_id, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle prefilled schedule when navigated from ScheduleView
  useEffect(() => {
    if (initialSchedule) {
      setIsFormOpen(true);
      setEditingId(null);
      setFormData((prev) => ({
        ...prev,
        schedule_id: initialSchedule.id,
        subject_id: initialSchedule.subject_id,
        period_info: `${initialSchedule.period_number} (${initialSchedule.start_time.slice(0, 5)} - ${initialSchedule.end_time.slice(0, 5)})`,
        room_notes: initialSchedule.room_notes || '',
      }));
      if (onClearInitialSchedule) onClearInitialSchedule();
    }
  }, [initialSchedule, onClearInitialSchedule]);

  // Auto-Sync attendance count whenever journal_date changes
  const syncAttendanceFromDate = useCallback(
    async (dateStr: string) => {
      if (!isSupabaseConfigured()) return;
      setSyncInfo((prev) => ({ ...prev, loading: true }));
      try {
        const res = await getDailyAttendanceCount(dateStr);
        setSyncInfo({
          present: res.total_present,
          absent: res.total_absent,
          absentStudents: res.absentStudents,
          loading: false,
        });
        setFormData((prev) => ({
          ...prev,
          total_present: res.total_present,
          total_absent: res.total_absent,
        }));
      } catch (err) {
        console.error(err);
        setSyncInfo((prev) => ({ ...prev, loading: false }));
      }
    },
    []
  );

  useEffect(() => {
    if (isFormOpen && formData.journal_date) {
      syncAttendanceFromDate(formData.journal_date);
    }
  }, [isFormOpen, formData.journal_date, syncAttendanceFromDate]);

  const handleOpenNew = () => {
    setEditingId(null);
    setFormData({
      journal_date: new Date().toISOString().split('T')[0],
      schedule_id: null,
      subject_id: subjects[0]?.id || '',
      period_info: 'Jam ke-1 & 2 (07:30 - 09:00)',
      topic_material: '',
      learning_activities: '',
      student_evaluator_notes: '',
      total_present: 0,
      total_absent: 0,
    });
    setIsFormOpen(true);
  };

  const handleEdit = (journal: TeachingJournal) => {
    setEditingId(journal.id);
    setFormData({
      journal_date: journal.journal_date,
      schedule_id: journal.schedule_id || null,
      subject_id: journal.subject_id,
      period_info: journal.period_info,
      topic_material: journal.topic_material,
      learning_activities: journal.learning_activities,
      student_evaluator_notes: journal.student_evaluator_notes || '',
      total_present: journal.total_present,
      total_absent: journal.total_absent,
    });
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject_id) {
      toast.warning('Pilih Mata Pelajaran', 'Harap tentukan mata pelajaran yang diajarkan.');
      return;
    }
    if (!formData.topic_material.trim()) {
      toast.warning('Isi Materi Pokok', 'Topik/materi pokok tidak boleh kosong.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const res = await updateTeachingJournal(editingId, formData);
        setJournals((prev) => prev.map((j) => (j.id === editingId ? res : j)));
        toast.success('Jurnal Diperbarui', 'Perubahan jurnal mengajar berhasil disimpan ke Supabase.');
      } else {
        const res = await createTeachingJournal(formData);
        setJournals((prev) => [res, ...prev]);
        toast.success('Jurnal Disimpan', 'Catatan KBM harian baru berhasil dicatat ke Supabase.');
      }
      setIsFormOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal';
      toast.error('Gagal Menyimpan Jurnal', msg);
    } finally {
      setSaving(false);
    }
  };

  // In-app Delete Confirmation
  const [journalToDelete, setJournalToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = (id: string) => {
    setJournalToDelete(id);
  };

  const handleConfirmDelete = async () => {
    if (!journalToDelete) return;
    setIsDeleting(true);
    try {
      await deleteTeachingJournal(journalToDelete);
      setJournals((prev) => prev.filter((j) => j.id !== journalToDelete));
      toast.success('Jurnal Dihapus', 'Catatan jurnal mengajar telah dihapus dari database.');
      setJournalToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal';
      toast.error('Gagal Menghapus Jurnal', msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered journals
  const filteredJournals = journals.filter((j) => {
    const matchSearch =
      j.topic_material.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.learning_activities.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (j.subjects?.subject_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchSubject =
      selectedSubjectFilter === 'all' || j.subject_id === selectedSubjectFilter;
    return matchSearch && matchSubject;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs no-print">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <BookOpenCheck className="w-5 h-5 text-blue-600" />
            Jurnal Mengajar Harian Guru
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Mencatat progres KBM, materi pokok, dan auto-sinkron data ketidakhadiran siswa dari tabel absensi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            title="Segarkan Jurnal"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak Jurnal KBM
          </button>
          <button
            onClick={handleOpenNew}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            Isi Jurnal Hari Ini
          </button>
        </div>
      </div>

      {/* Input / Edit Form Panel (if open) */}
      {isFormOpen && (
        <div className="bg-white rounded-2xl border border-blue-200 p-6 shadow-md shadow-blue-500/5 animate-in fade-in duration-150 no-print">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              {editingId ? 'Edit Jurnal Mengajar' : 'Catat Jurnal Mengajar Baru'}
            </h3>
            <button
              onClick={() => setIsFormOpen(false)}
              className="text-xs font-bold text-slate-400 hover:text-slate-700"
            >
              Tutup ✕
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal KBM *</label>
                <input
                  type="date"
                  required
                  value={formData.journal_date}
                  onChange={(e) => setFormData({ ...formData, journal_date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mata Pelajaran *</label>
                <select
                  value={formData.subject_id}
                  onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-hidden"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.subject_code} - {sub.subject_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Period info */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Jam Pelajaran *</label>
                <input
                  type="text"
                  required
                  value={formData.period_info}
                  onChange={(e) => setFormData({ ...formData, period_info: e.target.value })}
                  placeholder="Jam ke-1 & 2 (07:30 - 09:00)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>
            </div>

            {/* Auto-Sync Attendance Banner */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span>Sinkronisasi Kehadiran Siswa Otomatis</span>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 inline" />
                  </div>
                  <div className="text-slate-600 mt-0.5">
                    Data tgl <b className="font-mono">{formData.journal_date}</b>:{' '}
                    <span className="text-emerald-700 font-bold">{formData.total_present} Hadir</span>,{' '}
                    <span className="text-rose-700 font-bold">{formData.total_absent} Tidak Hadir</span>
                    {syncInfo.absentStudents.length > 0 && (
                      <span className="text-slate-500 ml-1">
                        (
                        {syncInfo.absentStudents
                          .map((s) => `${s.name} [${s.status}]`)
                          .join(', ')}
                        )
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => syncAttendanceFromDate(formData.journal_date)}
                disabled={syncInfo.loading}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold text-[11px] flex items-center gap-1 shrink-0 self-start sm:self-center"
              >
                <RefreshCw className={`w-3 h-3 ${syncInfo.loading ? 'animate-spin' : ''}`} />
                Sinkronkan Ulang
              </button>
            </div>

            {/* Topic / Material */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Topik / Materi Pokok Pembelajaran *</label>
              <input
                type="text"
                required
                value={formData.topic_material}
                onChange={(e) => setFormData({ ...formData, topic_material: e.target.value })}
                placeholder="Contoh: Bab 3 - Persamaan Linier Dua Variabel (SPLDV) dan Model Matematika Realistik"
                className="w-full px-3 py-2 border rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>

            {/* Learning Activities */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kegiatan Pembelajaran (Skenario KBM) *</label>
              <textarea
                rows={3}
                required
                value={formData.learning_activities}
                onChange={(e) => setFormData({ ...formData, learning_activities: e.target.value })}
                placeholder="Deskripsi langkah KBM: Pendahuluan apersepsi, eksplorasi konsep kelompok dengan LKPD, presentasi perwakilan siswa, dan kuis refleksi di akhir pembelajaran."
                className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-hidden leading-relaxed"
              />
            </div>

            {/* Evaluator notes / occurrences */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan Kejadian, Hambatan &amp; Tindak Lanjut Siswa
              </label>
              <textarea
                rows={2}
                value={formData.student_evaluator_notes}
                onChange={(e) => setFormData({ ...formData, student_evaluator_notes: e.target.value })}
                placeholder="Contoh: Pembelajaran berjalan kondusif. 2 siswa yang sakit diberikan materi ringkas melalui grup kelas. Rencana remedial akan dilakukan hari Kamis."
                className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-hidden leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-xs font-bold bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl flex items-center gap-2 shadow-xs transition"
              >
                <Save className="w-4 h-4" />
                Simpan Jurnal ke Supabase
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs no-print">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari materi pokok atau kegiatan..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-600 shrink-0">Filter Mapel:</span>
          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
          >
            <option value="all">Semua Mata Pelajaran</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.subject_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Journals List (Screen View) */}
      <div className="space-y-3 no-print">
        {filteredJournals.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
            {journals.length === 0
              ? 'Belum ada catatan jurnal mengajar di Supabase. Klik "Isi Jurnal Hari Ini" untuk membuat catatan pertama.'
              : 'Tidak ada jurnal yang sesuai dengan filter pencarian.'}
          </div>
        ) : (
          filteredJournals.map((j) => (
            <div
              key={j.id}
              className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 transition shadow-2xs space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                    {j.journal_date}
                  </span>
                  <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                    {j.subjects?.subject_name || 'Mapel'}
                  </span>
                  <span className="text-xs text-slate-500">{j.period_info}</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-2 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                    <span className="text-emerald-700 font-bold">{j.total_present} Hadir</span>
                    <span>•</span>
                    <span className="text-rose-700 font-bold">{j.total_absent} Absen</span>
                  </div>

                  <button
                    onClick={() => handleEdit(j)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Edit Jurnal"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(j.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Hapus Jurnal"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-extrabold text-slate-900">
                  Materi Pokok: <span className="font-semibold text-slate-800">{j.topic_material}</span>
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  <span className="font-bold text-slate-700">Kegiatan KBM:</span> {j.learning_activities}
                </p>
                {j.student_evaluator_notes && (
                  <p className="text-[11px] text-amber-800 bg-amber-50/70 p-2 rounded-lg mt-2 border border-amber-200/60 leading-relaxed">
                    <span className="font-bold">Catatan Khusus:</span> {j.student_evaluator_notes}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* OFFICIAL PRINTABLE MONTHLY TEACHING JOURNAL (Print Only / Clean A4) */}
      <div className="hidden print:block bg-white text-black p-4 space-y-4 print-page">
        {/* Kop Resmi Sekolah */}
        <div className="text-center border-b-2 border-black pb-3 mb-4">
          <h2 className="text-base font-bold uppercase tracking-wider">
            {settings?.school_name || 'PEMERINTAH PROVINSI / KABUPATEN'}
          </h2>
          <h1 className="text-lg font-extrabold uppercase tracking-wide">
            JURNAL MENGAJAR &amp; AGENDA KBM HARIAN GURU
          </h1>
          <p className="text-xs mt-0.5">
            Tahun Ajaran: {settings?.academic_year || '2026/2027'} • Semester: {settings?.semester || 'Genap'} • Kelas: {settings?.class_name || 'VIII-A'}
          </p>
        </div>

        {/* Identity block */}
        <div className="text-xs grid grid-cols-2 gap-2 mb-3">
          <div>
            <p><strong>Nama Guru:</strong> {settings?.teacher_name || '-'}</p>
            <p><strong>NIP:</strong> {settings?.teacher_nip || '-'}</p>
          </div>
          <div className="text-right">
            <p><strong>Satuan Pendidikan:</strong> {settings?.school_name || '-'}</p>
            <p><strong>NPSN:</strong> {settings?.npsn || '-'}</p>
          </div>
        </div>

        {/* Chronological Table */}
        <table className="w-full text-[10pt] border border-black border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b border-black">
              <th className="border border-black p-1.5 text-center w-8">No</th>
              <th className="border border-black p-1.5 text-center w-24">Hari / Tgl</th>
              <th className="border border-black p-1.5 text-center w-20">Jam Ke</th>
              <th className="border border-black p-1.5 text-left w-36">Mata Pelajaran</th>
              <th className="border border-black p-1.5 text-left">Materi Pokok &amp; Kegiatan KBM</th>
              <th className="border border-black p-1.5 text-center w-20">Kehadiran (H/A)</th>
              <th className="border border-black p-1.5 text-left w-36">Catatan / Hambatan</th>
            </tr>
          </thead>
          <tbody>
            {filteredJournals.length === 0 ? (
              <tr>
                <td colSpan={7} className="border border-black p-4 text-center">
                  Tidak ada data jurnal mengajar.
                </td>
              </tr>
            ) : (
              filteredJournals.map((j, idx) => (
                <tr key={j.id} className="border-b border-black">
                  <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                  <td className="border border-black p-1.5 text-center font-mono">{j.journal_date}</td>
                  <td className="border border-black p-1.5 text-center">{j.period_info}</td>
                  <td className="border border-black p-1.5 font-bold">{j.subjects?.subject_name}</td>
                  <td className="border border-black p-1.5">
                    <strong>{j.topic_material}</strong>
                    <div className="text-[9pt] mt-0.5">{j.learning_activities}</div>
                  </td>
                  <td className="border border-black p-1.5 text-center font-mono">
                    H: {j.total_present} / A: {j.total_absent}
                  </td>
                  <td className="border border-black p-1.5 text-[9pt]">
                    {j.student_evaluator_notes || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Official Signature Section */}
        <div className="grid grid-cols-2 gap-8 pt-8 page-break-inside-avoid text-xs">
          <div className="text-center">
            <p>Mengetahui,</p>
            <p>Kepala Sekolah / Madrasah</p>
            <div className="h-16" />
            <p className="font-bold underline uppercase">{settings?.principal_name || 'Dr. Hj. Ratna Juwita, M.Pd.'}</p>
            <p>NIP. {settings?.principal_nip || '197603181999032004'}</p>
          </div>

          <div className="text-center">
            <p>Dibuat di: Nusantara</p>
            <p>Guru Mata Pelajaran / Wali Kelas</p>
            <div className="h-16" />
            <p className="font-bold underline uppercase">{settings?.teacher_name || 'Dadan Suryadi, S.Pd., M.Kom.'}</p>
            <p>NIP. {settings?.teacher_nip || '198507152010011012'}</p>
          </div>
        </div>
      </div>

      {/* Modal Konfirmasi Hapus Jurnal (In-App Modal) */}
      {journalToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="font-extrabold text-base text-slate-900">Hapus Catatan Jurnal?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus catatan jurnal KBM ini dari Supabase?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setJournalToDelete(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? 'Menghapus...' : 'Hapus Jurnal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
