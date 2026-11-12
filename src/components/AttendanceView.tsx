import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  UserCheck,
  Calendar,
  Save,
  CheckCircle2,
  FileSpreadsheet,
  Printer,
  Sparkles,
  RefreshCw,
  Search,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Student, Attendance, AttendanceStatus } from '../types/database.types';
import {
  fetchStudents,
  fetchDailyAttendances,
  batchUpsertAttendances,
  fetchMonthlyAttendances,
} from '../services/academicService';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { useToast } from './Toast';

interface AttendanceRow {
  student_id: string;
  student: Student;
  status: AttendanceStatus;
  notes: string;
}

export const AttendanceView: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Daily Attendance State
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Monthly Matrix State
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [monthlyAttendances, setMonthlyAttendances] = useState<Attendance[]>([]);

  // Load Daily
  const loadDailyData = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    try {
      const [stList, attList] = await Promise.all([
        fetchStudents(),
        fetchDailyAttendances(selectedDate),
      ]);

      const activeStudents = stList.filter((s) => s.is_active);
      setStudents(activeStudents);

      // Map students to rows, matching existing attendance records if present
      const rows: AttendanceRow[] = activeStudents.map((st) => {
        const existing = attList.find((a) => a.student_id === st.id);
        return {
          student_id: st.id,
          student: st,
          status: existing ? existing.status : 'Hadir', // Default to Hadir for convenience
          notes: existing?.notes || '',
        };
      });

      setAttendanceRows(rows);
    } catch (err: unknown) {
      console.error(err);
      toast.error('Gagal Memuat Absensi', 'Periksa koneksi Supabase dan tabel attendances.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, toast]);

  // Load Monthly Matrix
  const loadMonthlyData = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    try {
      const [stList, attList] = await Promise.all([
        fetchStudents(),
        fetchMonthlyAttendances(selectedYear, selectedMonth),
      ]);
      setStudents(stList.filter((s) => s.is_active));
      setMonthlyAttendances(attList);
    } catch (err: unknown) {
      console.error(err);
      toast.error('Gagal Memuat Rekap', 'Periksa koneksi database.');
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, toast]);

  useEffect(() => {
    if (activeTab === 'daily') {
      loadDailyData();
    } else {
      loadMonthlyData();
    }
  }, [activeTab, loadDailyData, loadMonthlyData]);

  // Quick Action: "Set Semua Hadir (1-Klik)"
  const handleSetAllPresent = () => {
    setAttendanceRows((prev) =>
      prev.map((row) => ({
        ...row,
        status: 'Hadir',
      }))
    );
    toast.info('Semua Diset Hadir', 'Status seluruh siswa telah diatur ke Hadir. Anda cukup mengubah yang Sakit/Izin/Alpa.');
  };

  // Change individual student status
  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceRows((prev) =>
      prev.map((row) => (row.student_id === studentId ? { ...row, status } : row))
    );
  };

  const handleNotesChange = (studentId: string, notes: string) => {
    setAttendanceRows((prev) =>
      prev.map((row) => (row.student_id === studentId ? { ...row, notes } : row))
    );
  };

  // Batch Save to Supabase
  const handleSaveDaily = async () => {
    if (!isSupabaseConfigured()) {
      toast.warning('Belum Terhubung', 'Harap hubungkan Supabase terlebih dahulu.');
      return;
    }

    setSaving(true);
    try {
      const payload = attendanceRows.map((r) => ({
        student_id: r.student_id,
        attendance_date: selectedDate,
        status: r.status,
        notes: r.notes.trim() || null,
      }));

      await batchUpsertAttendances(payload);
      toast.success(
        'Absensi Berhasil Disimpan',
        `Berhasil menyimpan absensi ${payload.length} siswa untuk tanggal ${selectedDate} ke database Supabase Cloud.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan';
      toast.error('Gagal Menyimpan Absensi', msg);
    } finally {
      setSaving(false);
    }
  };

  // Daily statistics
  const countH = attendanceRows.filter((r) => r.status === 'Hadir').length;
  const countS = attendanceRows.filter((r) => r.status === 'Sakit').length;
  const countI = attendanceRows.filter((r) => r.status === 'Izin').length;
  const countA = attendanceRows.filter((r) => r.status === 'Alpa').length;
  const total = attendanceRows.length;
  const attendanceRate = total > 0 ? Math.round((countH / total) * 100) : 100;

  // Monthly Matrix Calculations
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 0).getDate();
  }, [selectedYear, selectedMonth]);

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  // Export Monthly to Excel
  const handleExportExcel = () => {
    if (students.length === 0) {
      toast.warning('Data Kosong', 'Tidak ada data untuk diekspor.');
      return;
    }

    const exportRows = students.map((st, idx) => {
      const studentAtt = monthlyAttendances.filter((a) => a.student_id === st.id);
      let h = 0, s = 0, i = 0, a = 0;

      const dayObj: Record<string, string> = {};
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const match = studentAtt.find((att) => att.attendance_date === dateStr);
        if (match) {
          dayObj[`Tgl_${day}`] = match.status[0]; // 'H', 'S', 'I', 'A'
          if (match.status === 'Hadir') h++;
          else if (match.status === 'Sakit') s++;
          else if (match.status === 'Izin') i++;
          else if (match.status === 'Alpa') a++;
        } else {
          dayObj[`Tgl_${day}`] = '-';
        }
      }

      const totalRecorded = h + s + i + a;
      const rate = totalRecorded > 0 ? `${Math.round((h / totalRecorded) * 100)}%` : '100%';

      return {
        No: idx + 1,
        NIS: st.nis,
        NISN: st.nisn || '',
        'Nama Siswa': st.full_name,
        JK: st.gender,
        ...dayObj,
        'Hadir (H)': h,
        'Sakit (S)': s,
        'Izin (I)': i,
        'Alpa (A)': a,
        '% Kehadiran': rate,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Rekap_${monthNames[selectedMonth - 1]}`);
    XLSX.writeFile(workbook, `Rekap_Absensi_${monthNames[selectedMonth - 1]}_${selectedYear}.xlsx`);

    toast.success('Excel Berhasil Diunduh', `File Rekap_Absensi_${monthNames[selectedMonth - 1]}_${selectedYear}.xlsx telah diunduh.`);
  };

  const filteredAttendanceRows = attendanceRows.filter((r) =>
    r.student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.student.nis.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            Pencatatan Absensi Siswa &amp; Rekapitulasi
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pencatatan kehadiran harian dengan aksi 1-klik hadir serta rekapitulasi matriks bulanan otomatis.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'daily'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Absensi Harian
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'monthly'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Rekap Bulanan (Matriks)
          </button>
        </div>
      </div>

      {/* DAILY ATTENDANCE TAB */}
      {activeTab === 'daily' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* Date Picker */}
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-300">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-700">Tanggal:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-blue-700 outline-hidden cursor-pointer"
                />
              </div>

              {/* Set All Present Quick Button */}
              <button
                type="button"
                onClick={handleSetAllPresent}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Set Semua Hadir (1-Klik)
              </button>
            </div>

            {/* Quick Stat Badges & Save Button */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span>H: {countH}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                <span>S: {countS}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                <span>I: {countI}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200">
                <span>A: {countA}</span>
              </div>
              <div className="text-xs text-slate-500 font-semibold px-2">
                Persentase: <b className="text-emerald-700">{attendanceRate}%</b>
              </div>

              <button
                type="button"
                onClick={handleSaveDaily}
                disabled={saving || loading || attendanceRows.length === 0}
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
                    Simpan Absensi ke Supabase
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari siswa berdasarkan nama atau NIS..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          {/* Daily Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">No</th>
                    <th className="px-4 py-3 w-28">NIS</th>
                    <th className="px-4 py-3">Nama Lengkap Siswa</th>
                    <th className="px-4 py-3 text-center w-16">JK</th>
                    <th className="px-4 py-3 text-center w-72">Status Kehadiran</th>
                    <th className="px-4 py-3">Catatan Khusus (Alasan)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredAttendanceRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        {loading ? 'Memuat data absensi dari Supabase...' : 'Belum ada data siswa aktif.'}
                      </td>
                    </tr>
                  ) : (
                    filteredAttendanceRows.map((row, idx) => (
                      <tr key={row.student_id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-2.5 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-600 font-semibold">{row.student.nis}</td>
                        <td className="px-4 py-2.5 font-bold text-slate-900">{row.student.full_name}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded-sm text-[10px] font-bold ${
                              row.student.gender === 'L' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {row.student.gender}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 gap-1">
                            {(['Hadir', 'Sakit', 'Izin', 'Alpa'] as AttendanceStatus[]).map((st) => {
                              const active = row.status === st;
                              const activeClass =
                                st === 'Hadir'
                                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                                  : st === 'Sakit'
                                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                                  : st === 'Izin'
                                  ? 'bg-amber-500 text-white font-bold shadow-xs'
                                  : 'bg-rose-600 text-white font-bold shadow-xs';

                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handleStatusChange(row.student_id, st)}
                                  className={`px-3 py-1 rounded-lg text-xs transition ${
                                    active ? activeClass : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                                  }`}
                                >
                                  {st}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="text"
                            value={row.notes}
                            onChange={(e) => handleNotesChange(row.student_id, e.target.value)}
                            placeholder={row.status !== 'Hadir' ? 'Alasan tidak hadir...' : 'Catatan opsional...'}
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-hidden"
                          />
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

      {/* MONTHLY RECAPITULATION MATRIX TAB */}
      {activeTab === 'monthly' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Bulan:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                >
                  {monthNames.map((m, idx) => (
                    <option key={m} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Tahun:</span>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <button
                onClick={loadMonthlyData}
                disabled={loading}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition border border-slate-200"
                title="Segarkan Rekap"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Ekspor ke Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Rekap
              </button>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto max-h-[550px]">
              <table className="w-full text-center text-[11px] border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-3 w-10 text-center sticky left-0 bg-slate-100 z-20 border-r border-slate-200">
                      No
                    </th>
                    <th className="px-3 py-3 w-24 text-left sticky left-10 bg-slate-100 z-20 border-r border-slate-200">
                      NIS
                    </th>
                    <th className="px-3 py-3 min-w-[200px] text-left sticky left-34 bg-slate-100 z-20 border-r border-slate-200">
                      Nama Siswa
                    </th>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                      <th key={d} className="px-1.5 py-3 w-7 border-r border-slate-200 font-mono text-[10px]">
                        {d}
                      </th>
                    ))}
                    <th className="px-2 py-3 w-10 bg-emerald-50 text-emerald-900 border-r border-slate-200 font-bold">H</th>
                    <th className="px-2 py-3 w-10 bg-blue-50 text-blue-900 border-r border-slate-200 font-bold">S</th>
                    <th className="px-2 py-3 w-10 bg-amber-50 text-amber-900 border-r border-slate-200 font-bold">I</th>
                    <th className="px-2 py-3 w-10 bg-rose-50 text-rose-900 border-r border-slate-200 font-bold">A</th>
                    <th className="px-2 py-3 w-16 bg-slate-200 text-slate-800 font-bold">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={daysInMonth + 8} className="py-8 text-center text-slate-400">
                        Belum ada data siswa aktif.
                      </td>
                    </tr>
                  ) : (
                    students.map((st, idx) => {
                      const studentAtt = monthlyAttendances.filter((a) => a.student_id === st.id);
                      let h = 0, s = 0, i = 0, a = 0;

                      return (
                        <tr key={st.id} className="hover:bg-slate-50/80 transition">
                          <td className="px-3 py-2 text-center font-mono text-slate-400 sticky left-0 bg-white z-10 border-r border-slate-200">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 text-left font-mono text-slate-600 font-semibold sticky left-10 bg-white z-10 border-r border-slate-200">
                            {st.nis}
                          </td>
                          <td className="px-3 py-2 text-left font-bold text-slate-900 sticky left-34 bg-white z-10 border-r border-slate-200 truncate max-w-[220px]">
                            {st.full_name}
                          </td>
                          {Array.from({ length: daysInMonth }, (_, dayIdx) => {
                            const d = dayIdx + 1;
                            const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                            const att = studentAtt.find((row) => row.attendance_date === dateStr);

                            let badge = '-';
                            let color = 'text-slate-300';
                            if (att) {
                              if (att.status === 'Hadir') {
                                badge = 'H';
                                color = 'text-emerald-700 font-bold bg-emerald-50';
                                h++;
                              } else if (att.status === 'Sakit') {
                                badge = 'S';
                                color = 'text-blue-700 font-bold bg-blue-50';
                                s++;
                              } else if (att.status === 'Izin') {
                                badge = 'I';
                                color = 'text-amber-700 font-bold bg-amber-50';
                                i++;
                              } else if (att.status === 'Alpa') {
                                badge = 'A';
                                color = 'text-rose-700 font-bold bg-rose-50';
                                a++;
                              }
                            }

                            return (
                              <td key={d} className={`p-1 border-r border-slate-200 text-center font-mono ${color}`}>
                                {badge}
                              </td>
                            );
                          })}
                          <td className="px-2 py-2 font-bold text-emerald-700 bg-emerald-50/50 border-r border-slate-200">{h}</td>
                          <td className="px-2 py-2 font-bold text-blue-700 bg-blue-50/50 border-r border-slate-200">{s}</td>
                          <td className="px-2 py-2 font-bold text-amber-700 bg-amber-50/50 border-r border-slate-200">{i}</td>
                          <td className="px-2 py-2 font-bold text-rose-700 bg-rose-50/50 border-r border-slate-200">{a}</td>
                          <td className="px-2 py-2 font-extrabold text-slate-900 bg-slate-50">
                            {h + s + i + a > 0 ? `${Math.round((h / (h + s + i + a)) * 100)}%` : '100%'}
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
      )}
    </div>
  );
};
