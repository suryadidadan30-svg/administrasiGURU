import React, { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap,
  Save,
  Sparkles,
  FileSpreadsheet,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Student, Subject, Grade, SchoolSettings } from '../types/database.types';
import {
  fetchStudents,
  fetchSubjects,
  fetchGradesBySubject,
  batchUpsertGrades,
} from '../services/academicService';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { useToast } from './Toast';

interface GradeRow {
  student_id: string;
  student: Student;
  nh1: number;
  nh2: number;
  nh3: number;
  nh4: number;
  sts_score: number;
  sas_pat_score: number;
  final_score: number;
  competency_description: string;
}

interface GradeBookViewProps {
  settings: SchoolSettings | null;
}

export const GradeBookView: React.FC<GradeBookViewProps> = ({ settings }) => {
  const toast = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [academicYear, setAcademicYear] = useState<string>(settings?.academic_year || '2026/2027');
  const [semester, setSemester] = useState<'Ganjil' | 'Genap'>(settings?.semester || 'Genap');

  const [students, setStudents] = useState<Student[]>([]);
  const [gradeRows, setGradeRows] = useState<GradeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected subject object
  const currentSubject = subjects.find((s) => s.id === selectedSubjectId);
  const kktp = currentSubject?.kktp_score ?? 75;

  // Formula calculation helper
  const calculateFinalScore = (nh1: number, nh2: number, nh3: number, nh4: number, sts: number, sas: number) => {
    const avgNH = (nh1 + nh2 + nh3 + nh4) / 4.0;
    const finalScore = avgNH * 0.4 + sts * 0.3 + sas * 0.3;
    return Math.round(finalScore * 100) / 100;
  };

  // Generate Kurikulum Merdeka competency sentence
  const generateCompetencyText = (score: number, subjectName: string, kktpTarget: number) => {
    if (score >= 88) {
      return `Menunjukkan penguasaan yang sangat istimewa dalam menguasai seluruh capaian pembelajaran ${subjectName}, mampu menerapkan konsep secara mandiri dan bernalar kritis.`;
    } else if (score >= kktpTarget) {
      return `Menunjukkan penguasaan yang baik dalam memahami materi esensial ${subjectName}, telah mencapai kriteria ketuntasan tujuan pembelajaran secara memadai.`;
    } else if (score > 0) {
      return `Perlu bimbingan dan pendampingan intensif dalam memahami materi dasar ${subjectName}, khususnya dalam penguatan konsep dan penyelesaian tugas mandiri.`;
    }
    return '';
  };

  // Load Initial subjects
  useEffect(() => {
    async function loadSubs() {
      if (!isSupabaseConfigured()) return;
      try {
        const subs = await fetchSubjects();
        setSubjects(subs);
        if (subs.length > 0 && !selectedSubjectId) {
          setSelectedSubjectId(subs[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadSubs();
  }, [selectedSubjectId]);

  // Load students & grades for selected subject
  const loadGradeData = useCallback(async () => {
    if (!isSupabaseConfigured() || !selectedSubjectId) return;
    setLoading(true);
    try {
      const [stList, existingGrades] = await Promise.all([
        fetchStudents(),
        fetchGradesBySubject(selectedSubjectId, academicYear, semester),
      ]);

      const activeStudents = stList.filter((s) => s.is_active);
      setStudents(activeStudents);

      const rows: GradeRow[] = activeStudents.map((st) => {
        const match = existingGrades.find((g) => g.student_id === st.id);
        const nh1 = Number(match?.nh1 ?? 0);
        const nh2 = Number(match?.nh2 ?? 0);
        const nh3 = Number(match?.nh3 ?? 0);
        const nh4 = Number(match?.nh4 ?? 0);
        const sts = Number(match?.sts_score ?? 0);
        const sas = Number(match?.sas_pat_score ?? 0);
        const calcFinal = calculateFinalScore(nh1, nh2, nh3, nh4, sts, sas);

        return {
          student_id: st.id,
          student: st,
          nh1,
          nh2,
          nh3,
          nh4,
          sts_score: sts,
          sas_pat_score: sas,
          final_score: calcFinal,
          competency_description: match?.competency_description || '',
        };
      });

      setGradeRows(rows);
    } catch (err: unknown) {
      console.error(err);
      toast.error('Gagal Memuat Nilai', 'Periksa koneksi ke Supabase.');
    } finally {
      setLoading(false);
    }
  }, [selectedSubjectId, academicYear, semester, toast]);

  useEffect(() => {
    loadGradeData();
  }, [loadGradeData]);

  // Handle Score Input Change
  const handleScoreChange = (
    studentId: string,
    field: 'nh1' | 'nh2' | 'nh3' | 'nh4' | 'sts_score' | 'sas_pat_score',
    valueStr: string
  ) => {
    const val = Math.min(100, Math.max(0, parseFloat(valueStr) || 0));

    setGradeRows((prev) =>
      prev.map((row) => {
        if (row.student_id !== studentId) return row;
        const updated = { ...row, [field]: val };
        updated.final_score = calculateFinalScore(
          updated.nh1,
          updated.nh2,
          updated.nh3,
          updated.nh4,
          updated.sts_score,
          updated.sas_pat_score
        );
        return updated;
      })
    );
  };

  const handleDescriptionChange = (studentId: string, text: string) => {
    setGradeRows((prev) =>
      prev.map((r) => (r.student_id === studentId ? { ...r, competency_description: text } : r))
    );
  };

  // Generate Competency Descriptions for All Students (1-Klik)
  const handleGenerateAllCompetencies = () => {
    const subName = currentSubject?.subject_name || 'Mata Pelajaran';
    setGradeRows((prev) =>
      prev.map((row) => ({
        ...row,
        competency_description: generateCompetencyText(row.final_score, subName, kktp),
      }))
    );
    toast.success(
      'Deskripsi Otomatis Dihasilkan',
      `Deskripsi capaian kompetensi untuk seluruh siswa pada mata pelajaran ${subName} berhasil dibuat berdasarkan capaian KKTP.`
    );
  };

  // Batch Save to Supabase
  const handleSaveGrades = async () => {
    if (!isSupabaseConfigured()) {
      toast.warning('Belum Terhubung', 'Harap hubungkan Supabase terlebih dahulu.');
      return;
    }
    if (!selectedSubjectId) {
      toast.warning('Pilih Mapel', 'Mata pelajaran belum dipilih.');
      return;
    }

    setSaving(true);
    try {
      const payload = gradeRows.map((r) => ({
        student_id: r.student_id,
        subject_id: selectedSubjectId,
        academic_year: academicYear,
        semester,
        nh1: r.nh1,
        nh2: r.nh2,
        nh3: r.nh3,
        nh4: r.nh4,
        sts_score: r.sts_score,
        sas_pat_score: r.sas_pat_score,
        competency_description: r.competency_description.trim() || null,
      }));

      await batchUpsertGrades(payload);
      toast.success(
        'Nilai Berhasil Disimpan',
        `Data nilai ${payload.length} siswa untuk ${currentSubject?.subject_name} berhasil disimpan langsung ke database Supabase Cloud.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal';
      toast.error('Gagal Menyimpan Nilai', msg);
    } finally {
      setSaving(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (gradeRows.length === 0) return;

    const data = gradeRows.map((r, idx) => ({
      No: idx + 1,
      NIS: r.student.nis,
      'Nama Siswa': r.student.full_name,
      'Formatif 1 (NH1)': r.nh1,
      'Formatif 2 (NH2)': r.nh2,
      'Formatif 3 (NH3)': r.nh3,
      'Formatif 4 (NH4)': r.nh4,
      'Rata-rata NH': Math.round(((r.nh1 + r.nh2 + r.nh3 + r.nh4) / 4) * 100) / 100,
      'STS / PTS (30%)': r.sts_score,
      'SAS / PAT (30%)': r.sas_pat_score,
      'Nilai Akhir Rapor': r.final_score,
      'Status KKTP': r.final_score >= kktp ? 'TUNTAS' : 'BELUM TUNTAS',
      'Deskripsi Capaian Kompetensi': r.competency_description,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    const sheetName = (currentSubject?.subject_code || 'Nilai').slice(0, 30);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `Nilai_${currentSubject?.subject_code || 'Mapel'}_${academicYear.replace('/', '-')}_${semester}.xlsx`);
    toast.success('Excel Berhasil Diunduh', 'File nilai telah diunduh.');
  };

  const filteredRows = gradeRows.filter(
    (r) =>
      r.student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.student.nis.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-blue-600" />
            Buku Nilai Siswa (Formatif &amp; Sumatif)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Spreadsheet inline grading: NH1–NH4 (40%) + STS/PTS (30%) + SAS/PAT (30%) terhitung otomatis secara real-time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadGradeData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            title="Segarkan Nilai"
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
            onClick={handleSaveGrades}
            disabled={saving || loading || gradeRows.length === 0}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Simpan Semua Nilai ke Supabase
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filter and Configuration Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Subject Selector */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Mata Pelajaran
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-hidden min-w-[200px]"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.subject_code} - {s.subject_name} (KKTP: {s.kktp_score})
                </option>
              ))}
            </select>
          </div>

          {/* Academic Year */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Tahun Ajaran
            </label>
            <input
              type="text"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="2026/2027"
              className="w-28 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          {/* Semester */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Semester
            </label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value as 'Ganjil' | 'Genap')}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-hidden"
            >
              <option value="Ganjil">Ganjil</option>
              <option value="Genap">Genap</option>
            </select>
          </div>
        </div>

        {/* KKTP Indicator & Generate Descriptions Button */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
            <span className="text-slate-600">Ambang Batas KKTP: </span>
            <span className="font-extrabold text-emerald-800 font-mono text-sm">{kktp}</span>
          </div>

          <button
            type="button"
            onClick={handleGenerateAllCompetencies}
            className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generate Deskripsi Capaian Otomatis (1-Klik)
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari siswa berdasarkan nama atau NIS..."
          className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
        />
      </div>

      {/* Spreadsheet-like Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto max-h-[580px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-20">
              <tr>
                <th className="px-3 py-3 w-10 text-center sticky left-0 bg-slate-100 z-30 border-r border-slate-200">
                  No
                </th>
                <th className="px-3 py-3 w-24 sticky left-10 bg-slate-100 z-30 border-r border-slate-200">
                  NIS
                </th>
                <th className="px-3 py-3 min-w-[200px] sticky left-34 bg-slate-100 z-30 border-r border-slate-200">
                  Nama Lengkap Siswa
                </th>
                <th className="px-2 py-3 w-16 text-center border-r border-slate-200 bg-blue-50/60">NH 1</th>
                <th className="px-2 py-3 w-16 text-center border-r border-slate-200 bg-blue-50/60">NH 2</th>
                <th className="px-2 py-3 w-16 text-center border-r border-slate-200 bg-blue-50/60">NH 3</th>
                <th className="px-2 py-3 w-16 text-center border-r border-slate-200 bg-blue-50/60">NH 4</th>
                <th className="px-2 py-3 w-20 text-center border-r border-slate-200 bg-indigo-50/80">STS/PTS (30%)</th>
                <th className="px-2 py-3 w-20 text-center border-r border-slate-200 bg-indigo-50/80">SAS/PAT (30%)</th>
                <th className="px-3 py-3 w-24 text-center border-r border-slate-200 bg-slate-200 font-extrabold text-slate-900">
                  Nilai Akhir
                </th>
                <th className="px-4 py-3 min-w-[320px]">Deskripsi Capaian Kompetensi (Kurikulum Merdeka)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400">
                    {loading ? 'Memuat nilai dari Supabase...' : 'Belum ada data siswa untuk mata pelajaran ini.'}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const isPass = row.final_score >= kktp;
                  return (
                    <tr key={row.student_id} className="hover:bg-slate-50/80 transition">
                      <td className="px-3 py-2 text-center font-mono text-slate-400 sticky left-0 bg-white z-10 border-r border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-600 font-semibold sticky left-10 bg-white z-10 border-r border-slate-200">
                        {row.student.nis}
                      </td>
                      <td className="px-3 py-2 font-bold text-slate-900 sticky left-34 bg-white z-10 border-r border-slate-200 truncate max-w-[220px]">
                        {row.student.full_name}
                      </td>

                      {/* NH 1 */}
                      <td className="p-1 border-r border-slate-200 text-center">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={row.nh1 || ''}
                          onChange={(e) => handleScoreChange(row.student_id, 'nh1', e.target.value)}
                          className="w-14 text-center font-mono font-semibold py-1 rounded-md border border-slate-200 focus:border-blue-500 focus:bg-blue-50/30 outline-hidden"
                        />
                      </td>

                      {/* NH 2 */}
                      <td className="p-1 border-r border-slate-200 text-center">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={row.nh2 || ''}
                          onChange={(e) => handleScoreChange(row.student_id, 'nh2', e.target.value)}
                          className="w-14 text-center font-mono font-semibold py-1 rounded-md border border-slate-200 focus:border-blue-500 focus:bg-blue-50/30 outline-hidden"
                        />
                      </td>

                      {/* NH 3 */}
                      <td className="p-1 border-r border-slate-200 text-center">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={row.nh3 || ''}
                          onChange={(e) => handleScoreChange(row.student_id, 'nh3', e.target.value)}
                          className="w-14 text-center font-mono font-semibold py-1 rounded-md border border-slate-200 focus:border-blue-500 focus:bg-blue-50/30 outline-hidden"
                        />
                      </td>

                      {/* NH 4 */}
                      <td className="p-1 border-r border-slate-200 text-center">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={row.nh4 || ''}
                          onChange={(e) => handleScoreChange(row.student_id, 'nh4', e.target.value)}
                          className="w-14 text-center font-mono font-semibold py-1 rounded-md border border-slate-200 focus:border-blue-500 focus:bg-blue-50/30 outline-hidden"
                        />
                      </td>

                      {/* STS / PTS */}
                      <td className="p-1 border-r border-slate-200 text-center bg-indigo-50/20">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={row.sts_score || ''}
                          onChange={(e) => handleScoreChange(row.student_id, 'sts_score', e.target.value)}
                          className="w-16 text-center font-mono font-bold py-1 rounded-md border border-indigo-200 focus:border-indigo-500 focus:bg-indigo-50 outline-hidden"
                        />
                      </td>

                      {/* SAS / PAT */}
                      <td className="p-1 border-r border-slate-200 text-center bg-indigo-50/20">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={row.sas_pat_score || ''}
                          onChange={(e) => handleScoreChange(row.student_id, 'sas_pat_score', e.target.value)}
                          className="w-16 text-center font-mono font-bold py-1 rounded-md border border-indigo-200 focus:border-indigo-500 focus:bg-indigo-50 outline-hidden"
                        />
                      </td>

                      {/* Final Score Pill (Green >= KKTP, Red < KKTP) */}
                      <td className="px-2 py-2 text-center border-r border-slate-200 bg-slate-50/80 font-mono">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                            row.final_score === 0
                              ? 'text-slate-400 bg-slate-100'
                              : isPass
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {row.final_score > 0 ? row.final_score : '-'}
                        </span>
                      </td>

                      {/* Competency Description */}
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={row.competency_description}
                          onChange={(e) => handleDescriptionChange(row.student_id, e.target.value)}
                          placeholder="Deskripsi capaian kompetensi siswa..."
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-hidden"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
