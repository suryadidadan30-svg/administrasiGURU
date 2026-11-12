import React, { useState, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Save,
  Sparkles,
  Users,
  Award,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Student,
  SchoolSettings,
  Grade,
  ReportCard,
  ExtracurricularItem,
  PromotionStatus,
  AttendanceSummary,
} from '../types/database.types';
import {
  fetchStudents,
  fetchAllGradesForStudent,
  fetchReportCard,
  upsertReportCard,
  getStudentAttendanceSummary,
} from '../services/academicService';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { useToast } from './Toast';

interface ReportCardViewProps {
  settings: SchoolSettings | null;
}

export const ReportCardView: React.FC<ReportCardViewProps> = ({ settings }) => {
  const toast = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  const academicYear = settings?.academic_year || '2026/2027';
  const semester = settings?.semester || 'Genap';

  // Loaded academic data for selected student
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary>({
    hadir: 0,
    sakit: 0,
    izin: 0,
    alpa: 0,
    total_effective_days: 0,
    percentage: 100,
  });

  // Report card form fields
  const [extracurriculars, setExtracurriculars] = useState<ExtracurricularItem[]>([
    {
      activity: 'Pramuka (Wajib)',
      predicate: 'Sangat Baik',
      description: 'Aktif mengikuti seluruh latihan kepramukaan dan menunjukkan jiwa kepemimpinan regu.',
    },
    {
      activity: 'Palang Merah Remaja (PMR)',
      predicate: 'Baik',
      description: 'Mampu mempraktikkan pertolongan pertama dan tanggap dalam tugas piket UKS.',
    },
  ]);
  const [attitudeNotes, setAttitudeNotes] = useState<string>(
    'Menunjukkan sikap religius, bergotong-royong, santun terhadap guru dan teman, serta bertanggung jawab terhadap tugas belajar.'
  );
  const [teacherHomeroomNotes, setTeacherHomeroomNotes] = useState<string>(
    'Pertahankan prestasi belajar dan tingkatkan rasa percaya diri saat berbicara di depan forum kelas.'
  );
  const [promotionStatus, setPromotionStatus] = useState<PromotionStatus>('Naik Kelas');
  const [promotedToClass, setPromotedToClass] = useState<string>('Kelas IX (Sembilan)');
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Selected student object
  const currentStudent = students.find((s) => s.id === selectedStudentId);

  // Initial load students
  useEffect(() => {
    async function loadStudentList() {
      if (!isSupabaseConfigured()) return;
      try {
        const list = await fetchStudents();
        const active = list.filter((s) => s.is_active);
        setStudents(active);
        if (active.length > 0 && !selectedStudentId) {
          setSelectedStudentId(active[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadStudentList();
  }, [selectedStudentId]);

  // Load student report data (Grades, Attendance Summary, ReportCard record)
  const loadStudentReport = useCallback(async () => {
    if (!isSupabaseConfigured() || !selectedStudentId) return;
    setLoading(true);
    try {
      const [gradeList, attSummary, reportRecord] = await Promise.all([
        fetchAllGradesForStudent(selectedStudentId, academicYear, semester),
        getStudentAttendanceSummary(selectedStudentId),
        fetchReportCard(selectedStudentId, academicYear, semester),
      ]);

      setGrades(gradeList);
      setAttendanceSummary(attSummary);

      if (reportRecord) {
        if (reportRecord.extracurricular_notes && Array.isArray(reportRecord.extracurricular_notes)) {
          setExtracurriculars(reportRecord.extracurricular_notes);
        }
        setAttitudeNotes(reportRecord.attitude_notes || '');
        setTeacherHomeroomNotes(reportRecord.teacher_homeroom_notes || '');
        setPromotionStatus(reportRecord.promotion_status || 'Naik Kelas');
        setPromotedToClass(reportRecord.promoted_to_class || 'Kelas IX (Sembilan)');
        if (reportRecord.report_date) setReportDate(reportRecord.report_date);
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error('Gagal Memuat Rapor', 'Periksa koneksi basis data Supabase.');
    } finally {
      setLoading(false);
    }
  }, [selectedStudentId, academicYear, semester, toast]);

  useEffect(() => {
    loadStudentReport();
  }, [loadStudentReport]);

  // Save Report Card to Supabase
  const handleSaveReport = async () => {
    if (!isSupabaseConfigured()) {
      toast.warning('Belum Terhubung', 'Harap hubungkan Supabase terlebih dahulu.');
      return;
    }
    if (!selectedStudentId) return;

    setSaving(true);
    try {
      await upsertReportCard({
        student_id: selectedStudentId,
        academic_year: academicYear,
        semester: semester as 'Ganjil' | 'Genap',
        extracurricular_notes: extracurriculars,
        attitude_notes: attitudeNotes,
        teacher_homeroom_notes: teacherHomeroomNotes,
        promotion_status: promotionStatus,
        promoted_to_class: promotedToClass,
        report_date: reportDate,
      });

      toast.success(
        'Rapor Berhasil Disimpan',
        `Catatan rapor dan keputusan kenaikan kelas untuk ${currentStudent?.full_name} berhasil disimpan ke Supabase.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal';
      toast.error('Gagal Menyimpan Rapor', msg);
    } finally {
      setSaving(false);
    }
  };

  // Add / Remove extracurricular item
  const handleAddExtra = () => {
    setExtracurriculars((prev) => [
      ...prev,
      { activity: '', predicate: 'Baik', description: '' },
    ]);
  };

  const handleRemoveExtra = (idx: number) => {
    setExtracurriculars((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateExtra = (idx: number, field: keyof ExtracurricularItem, val: string) => {
    setExtracurriculars((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    );
  };

  // Print Rapor
  const handlePrint = () => {
    window.print();
  };

  // Export Rapor to Excel
  const handleExportExcel = () => {
    if (!currentStudent) return;

    const academicData = grades.map((g, idx) => ({
      No: idx + 1,
      'Mata Pelajaran': g.subjects?.subject_name || '-',
      KKTP: g.subjects?.kktp_score || 75,
      'Nilai Akhir': g.final_score ?? 0,
      'Capaian Kompetensi': g.competency_description || '-',
    }));

    const wsGrades = XLSX.utils.json_to_sheet(academicData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsGrades, 'Nilai_Akademik');

    XLSX.writeFile(
      wb,
      `Rapor_${currentStudent.nis}_${currentStudent.full_name.replace(/\s+/g, '_')}.xlsx`
    );
    toast.success('Excel Berhasil Diunduh', 'File laporan nilai siswa telah diunduh.');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Student Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Generator Rapor &amp; Kenaikan Kelas (Standar A4)
            </h2>
            <p className="text-xs text-slate-500">
              Format baku Kurikulum Merdeka siap cetak lengkap dengan Kop Sekolah, Ekstrakurikuler, Absensi Semester, dan 3 Tanda Tangan.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={loadStudentReport}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            title="Segarkan Rapor"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Ekspor Excel
          </button>
          <button
            onClick={handleSaveReport}
            disabled={saving || loading || !selectedStudentId}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Menyimpan...' : 'Simpan Rapor'}
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak Rapor A4 / PDF
          </button>
        </div>
      </div>

      {/* Student Selection & Settings Editor (Screen Mode) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs no-print space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Pilih Peserta Didik *
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-hidden min-w-[280px]"
            >
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.nis} - {st.full_name} ({st.gender})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900">
              <span className="text-slate-500">Kelas:</span> <b>{settings?.class_name || 'VIII-A'}</b>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-800">
              <span className="text-slate-500">Tahun Ajaran:</span> <b>{academicYear}</b> ({semester})
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
              <span className="text-slate-500">Kehadiran Semester:</span>{' '}
              <b>{attendanceSummary.percentage}%</b> (S:{attendanceSummary.sakit}, I:{attendanceSummary.izin}, A:{attendanceSummary.alpa})
            </div>
          </div>
        </div>

        {/* Supplementary Fields for Rapor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Homeroom Notes & Attitude */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan Wali Kelas (Saran &amp; Motivasi Belajar)
              </label>
              <textarea
                rows={3}
                value={teacherHomeroomNotes}
                onChange={(e) => setTeacherHomeroomNotes(e.target.value)}
                placeholder="Tuliskan catatan wali kelas untuk siswa ini..."
                className="w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan Perkembangan Karakter &amp; Sikap
              </label>
              <textarea
                rows={2}
                value={attitudeNotes}
                onChange={(e) => setAttitudeNotes(e.target.value)}
                placeholder="Catatan sikap dan profil pelajar Pancasila..."
                className="w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 outline-hidden leading-relaxed"
              />
            </div>
          </div>

          {/* Promotion Decision & Report Date */}
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-600" />
                Keputusan Kenaikan Kelas / Kelulusan
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Keputusan *</label>
                  <select
                    value={promotionStatus}
                    onChange={(e) => setPromotionStatus(e.target.value as PromotionStatus)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                  >
                    <option value="Naik Kelas">Naik Kelas</option>
                    <option value="Tinggal Kelas">Tinggal Kelas</option>
                    <option value="Lulus">Lulus</option>
                    <option value="Belum Ditentukan">Belum Ditentukan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Ke Kelas / Satuan</label>
                  <input
                    type="text"
                    value={promotedToClass}
                    onChange={(e) => setPromotedToClass(e.target.value)}
                    placeholder="Kelas IX (Sembilan)"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Tanggal Titimangsa Rapor</label>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-blue-700"
                />
              </div>
            </div>

            {/* Extracurriculars mini-editor */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">Ekstrakurikuler Siswa</label>
                <button
                  type="button"
                  onClick={handleAddExtra}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Tambah Ekstra
                </button>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {extracurriculars.map((ex, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs bg-slate-50 p-1.5 rounded-lg border">
                    <input
                      type="text"
                      value={ex.activity}
                      onChange={(e) => handleUpdateExtra(i, 'activity', e.target.value)}
                      placeholder="Nama Ekstrakurikuler"
                      className="flex-1 px-2 py-1 bg-white border rounded text-[11px]"
                    />
                    <select
                      value={ex.predicate}
                      onChange={(e) => handleUpdateExtra(i, 'predicate', e.target.value)}
                      className="w-24 px-1 py-1 bg-white border rounded text-[11px] font-bold"
                    >
                      <option value="Sangat Baik">Sangat Baik</option>
                      <option value="Baik">Baik</option>
                      <option value="Cukup">Cukup</option>
                      <option value="Kurang">Kurang</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRemoveExtra(i)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          PRATINJAU DOKUMEN RAPOR RESMI A4 (SESUAI STANDAR KEMENDIKBUDRISTEK)
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-lg p-8 sm:p-12 print-page max-w-4xl mx-auto text-black">
        {/* KOP RESMI SEKOLAH / MADRASAH */}
        <div className="border-b-4 border-double border-black pb-3 mb-5 text-center relative">
          <h3 className="text-xs uppercase tracking-widest font-bold">
            PEMERINTAH PROVINSI / KABUPATEN
          </h3>
          <h2 className="text-base uppercase tracking-wider font-extrabold mt-0.5">
            DINAS PENDIDIKAN &amp; KEBUDAYAAN
          </h2>
          <h1 className="text-xl uppercase font-black tracking-wide text-slate-900 mt-0.5">
            {settings?.school_name || 'SMKS 3 PASUNDAN PERKASA'}
          </h1>
          <p className="text-[10pt] text-slate-700 mt-1">
            NPSN: {settings?.npsn || '20219876'} • Jenjang: {settings?.school_level || 'SMA/SMK/MA'} • Akreditasi: A (Unggul)
          </p>
        </div>

        {/* JUDUL RAPOR */}
        <div className="text-center my-4">
          <h2 className="text-base font-extrabold uppercase tracking-wide underline underline-offset-4">
            LAPORAN HASIL BELAJAR PESERTA DIDIK (RAPOR)
          </h2>
          <p className="text-xs text-slate-700 font-semibold mt-1">
            IMPLEMENTASI KURIKULUM MERDEKA
          </p>
        </div>

        {/* IDENTITAS PESERTA DIDIK (TABEL 2 KOLOM) */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mb-5 border border-black p-3 bg-slate-50/50">
          <div className="space-y-1">
            <div className="flex">
              <span className="w-36 font-semibold">Nama Peserta Didik</span>
              <span className="font-bold">: {currentStudent?.full_name || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-semibold">NIS / NISN</span>
              <span>: {currentStudent?.nis || '-'} / {currentStudent?.nisn || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-36 font-semibold">Satuan Pendidikan</span>
              <span>: {settings?.school_name || '-'}</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex">
              <span className="w-32 font-semibold">Kelas / Rombel</span>
              <span className="font-bold">: {settings?.class_name || 'Kelas XI TKJ-1'}</span>
            </div>
            <div className="flex">
              <span className="w-32 font-semibold">Fase Kurikulum</span>
              <span>: {settings?.phase || 'Fase F'}</span>
            </div>
            <div className="flex">
              <span className="w-32 font-semibold">Semester / T.A.</span>
              <span>: {semester} / {academicYear}</span>
            </div>
          </div>
        </div>

        {/* A. TABEL CAPAIAN HASIL BELAJAR AKADEMIK */}
        <div className="mb-5 space-y-1.5">
          <h3 className="text-xs font-bold uppercase tracking-wider">
            A. Nilai Akademik &amp; Capaian Kompetensi
          </h3>
          <table className="w-full text-[10pt] border border-black border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-black text-center font-bold">
                <th className="border border-black p-2 w-8">No</th>
                <th className="border border-black p-2 text-left w-56">Mata Pelajaran</th>
                <th className="border border-black p-2 w-16">KKTP</th>
                <th className="border border-black p-2 w-20">Nilai Akhir</th>
                <th className="border border-black p-2 text-left">Capaian Kompetensi Pembelajaran</th>
              </tr>
            </thead>
            <tbody>
              {grades.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border border-black p-4 text-center text-slate-500 italic">
                    Belum ada nilai yang diinput untuk siswa ini pada semester ini.
                  </td>
                </tr>
              ) : (
                grades.map((g, idx) => (
                  <tr key={g.id || idx} className="border-b border-black">
                    <td className="border border-black p-2 text-center font-mono">{idx + 1}</td>
                    <td className="border border-black p-2 font-bold text-slate-900">
                      {g.subjects?.subject_name}
                    </td>
                    <td className="border border-black p-2 text-center font-mono text-slate-600">
                      {g.subjects?.kktp_score || 75}
                    </td>
                    <td className="border border-black p-2 text-center font-mono font-bold text-slate-900 bg-slate-50">
                      {g.final_score ?? '-'}
                    </td>
                    <td className="border border-black p-2 text-justify text-[9.5pt] leading-snug">
                      {g.competency_description ||
                        `Telah mencapai seluruh tujuan pembelajaran mata pelajaran ${g.subjects?.subject_name} dengan predikat baik.`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* B. TABEL KEGIATAN EKSTRAKURIKULER */}
        <div className="mb-5 space-y-1.5 page-break-inside-avoid">
          <h3 className="text-xs font-bold uppercase tracking-wider">
            B. Kegiatan Ekstrakurikuler
          </h3>
          <table className="w-full text-[10pt] border border-black border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-black text-center font-bold">
                <th className="border border-black p-1.5 w-8">No</th>
                <th className="border border-black p-1.5 text-left w-64">Kegiatan Ekstrakurikuler</th>
                <th className="border border-black p-1.5 w-28">Predikat</th>
                <th className="border border-black p-1.5 text-left">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {extracurriculars.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border border-black p-2 text-center text-slate-500 italic">
                    Tidak ada kegiatan ekstrakurikuler yang diikuti.
                  </td>
                </tr>
              ) : (
                extracurriculars.map((ex, idx) => (
                  <tr key={idx} className="border-b border-black">
                    <td className="border border-black p-1.5 text-center font-mono">{idx + 1}</td>
                    <td className="border border-black p-1.5 font-semibold">{ex.activity || '-'}</td>
                    <td className="border border-black p-1.5 text-center font-bold">{ex.predicate}</td>
                    <td className="border border-black p-1.5 text-[9.5pt]">{ex.description || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* C. KETIDAKHADIRAN & D. CATATAN WALI KELAS (Dampingan 2 Kolom) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5 page-break-inside-avoid">
          {/* Ketidakhadiran */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-1.5">
              C. Rekapitulasi Ketidakhadiran
            </h3>
            <table className="w-full text-[10pt] border border-black border-collapse">
              <tbody>
                <tr className="border-b border-black">
                  <td className="border border-black p-1.5 font-semibold w-40">Sakit (S)</td>
                  <td className="border border-black p-1.5 font-mono font-bold text-center">
                    {attendanceSummary.sakit} hari
                  </td>
                </tr>
                <tr className="border-b border-black">
                  <td className="border border-black p-1.5 font-semibold">Izin (I)</td>
                  <td className="border border-black p-1.5 font-mono font-bold text-center">
                    {attendanceSummary.izin} hari
                  </td>
                </tr>
                <tr className="border-b border-black">
                  <td className="border border-black p-1.5 font-semibold">Tanpa Keterangan (A)</td>
                  <td className="border border-black p-1.5 font-mono font-bold text-center">
                    {attendanceSummary.alpa} hari
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Catatan Wali Kelas */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider mb-1.5">
              D. Catatan Wali Kelas
            </h3>
            <div className="border border-black p-2.5 min-h-[92px] text-[9.5pt] leading-relaxed flex items-center bg-slate-50/30">
              <p>{teacherHomeroomNotes || '-'}</p>
            </div>
          </div>
        </div>

        {/* E. KOTAK KEPUTUSAN KENAIKAN KELAS / KELULUSAN (GENAP) */}
        {semester === 'Genap' && (
          <div className="mb-6 p-3 border-2 border-black page-break-inside-avoid bg-slate-50 text-center">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-1">
              Keputusan Kenaikan Kelas
            </h3>
            <p className="text-sm font-black text-slate-900 tracking-wide">
              Berdasarkan hasil pencapaian seluruh tujuan pembelajaran, peserta didik dinyatakan:
            </p>
            <div className="mt-1 text-base font-extrabold underline uppercase">
              {promotionStatus} ke {promotedToClass}
            </div>
          </div>
        )}

        {/* F. KOLOM 3 TANDA TANGAN RESMI */}
        <div className="page-break-inside-avoid pt-4 text-[10pt]">
          <div className="text-right text-xs mb-3">
            Diberikan di: Nusantara, {reportDate}
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            {/* Tanda Tangan Orang Tua */}
            <div>
              <p className="font-semibold">Mengetahui,</p>
              <p>Orang Tua / Wali Murid,</p>
              <div className="h-20" />
              <p className="font-bold underline uppercase">
                ( {currentStudent?.parent_name || '...........................................'} )
              </p>
            </div>

            {/* Tanda Tangan Wali Kelas */}
            <div>
              <p className="font-semibold">Wali Kelas,</p>
              <p>{settings?.class_name || 'Kelas XI TKJ-1'}</p>
              <div className="h-20" />
              <p className="font-bold underline uppercase">
                {settings?.teacher_name || 'Dadan Suryadi, S.Pd., M.Kom.'}
              </p>
              <p className="text-[9pt]">NIP. {settings?.teacher_nip || '198507152010011012'}</p>
            </div>

            {/* Tanda Tangan Kepala Sekolah */}
            <div>
              <p className="font-semibold">Kepala Sekolah / Madrasah,</p>
              <p>{settings?.school_name || 'SMKS 3 PASUNDAN PERKASA'}</p>
              <div className="h-20" />
              <p className="font-bold underline uppercase">
                {settings?.principal_name || 'Drs. H. Mamat Rohimat, M.M.'}
              </p>
              <p className="text-[9pt]">NIP. {settings?.principal_nip || '197603181999032004'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
