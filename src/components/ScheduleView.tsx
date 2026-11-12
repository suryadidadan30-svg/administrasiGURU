import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays,
  Plus,
  Clock,
  MapPin,
  BookOpen,
  Edit2,
  Trash2,
  ArrowRight,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Schedule, Subject, DayOfWeek } from '../types/database.types';
import {
  fetchSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  fetchSubjects,
} from '../services/academicService';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { useToast } from './Toast';

interface ScheduleViewProps {
  onOpenJournalWithSchedule: (schedule: Schedule) => void;
  onOpenConfig: () => void;
}

const DAYS: DayOfWeek[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  onOpenJournalWithSchedule,
  onOpenConfig,
}) => {
  const toast = useToast();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Senin');
  const [loading, setLoading] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [formData, setFormData] = useState({
    day_of_week: 'Senin' as DayOfWeek,
    start_time: '07:30',
    end_time: '09:00',
    period_number: 'Jam ke-1 & 2',
    subject_id: '',
    room_notes: 'Ruang Kelas',
  });

  // Calculate current Indonesian day
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const todayName = dayNames[new Date().getDay()] as DayOfWeek;

  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    try {
      const [scList, sbList] = await Promise.all([fetchSchedules(), fetchSubjects()]);
      setSchedules(scList);
      setSubjects(sbList);
      if (sbList.length > 0 && !formData.subject_id) {
        setFormData((prev) => ({ ...prev, subject_id: sbList[0].id }));
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error('Gagal Memuat Jadwal', 'Pastikan tabel schedules sudah dibuat di Supabase.');
    } finally {
      setLoading(false);
    }
  }, [formData.subject_id, toast]);

  useEffect(() => {
    loadData();
    // Default to today if today is between Senin and Sabtu
    if (DAYS.includes(todayName)) {
      setSelectedDay(todayName);
    }
  }, [loadData, todayName]);

  const handleOpenModal = (schedule?: Schedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setFormData({
        day_of_week: schedule.day_of_week,
        start_time: schedule.start_time.slice(0, 5),
        end_time: schedule.end_time.slice(0, 5),
        period_number: schedule.period_number,
        subject_id: schedule.subject_id,
        room_notes: schedule.room_notes || '',
      });
    } else {
      setEditingSchedule(null);
      setFormData({
        day_of_week: selectedDay,
        start_time: '07:30',
        end_time: '09:00',
        period_number: 'Jam ke-1 & 2',
        subject_id: subjects[0]?.id || '',
        room_notes: 'Ruang Kelas',
      });
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject_id) {
      toast.warning('Pilih Mapel', 'Silakan pilih mata pelajaran untuk jadwal ini.');
      return;
    }

    try {
      if (editingSchedule) {
        const res = await updateSchedule(editingSchedule.id, formData);
        setSchedules((prev) => prev.map((s) => (s.id === editingSchedule.id ? res : s)));
        toast.success('Jadwal Diperbarui', 'Perubahan jadwal berhasil disimpan ke Supabase.');
      } else {
        const res = await createSchedule(formData);
        setSchedules((prev) => [...prev, res]);
        toast.success('Jadwal Ditambahkan', 'Jadwal pelajaran baru telah tersimpan di Supabase.');
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan';
      toast.error('Gagal Menyimpan Jadwal', msg);
    }
  };

  // In-app Delete Confirmation
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!scheduleToDelete) return;
    setIsDeleting(true);
    try {
      await deleteSchedule(scheduleToDelete);
      setSchedules((prev) => prev.filter((s) => s.id !== scheduleToDelete));
      toast.success('Jadwal Dihapus', 'Slot jadwal pelajaran berhasil dihapus dari Supabase.');
      setScheduleToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal';
      toast.error('Gagal Menghapus', msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredSchedules = schedules
    .filter((s) => s.day_of_week === selectedDay)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  return (
    <div className="space-y-6">
      {/* Top Banner and Quick Add */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            Jadwal Pelajaran &amp; Agenda KBM Mingguan
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola distribusi jam pelajaran hari Senin hingga Sabtu dan akses cepat pengisian jurnal harian.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            title="Segarkan Jadwal"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            Tambah Jadwal
          </button>
        </div>
      </div>

      {/* Day Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {DAYS.map((day) => {
          const isSelected = selectedDay === day;
          const isToday = todayName === day;
          const countForDay = schedules.filter((s) => s.day_of_week === day).length;

          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-2 shrink-0 border ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
              }`}
            >
              <span>{day}</span>
              {isToday && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-extrabold uppercase ${
                    isSelected ? 'bg-white text-blue-800' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  Hari Ini
                </span>
              )}
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isSelected ? 'bg-blue-800 text-blue-100' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {countForDay}
              </span>
            </button>
          );
        })}
      </div>

      {/* Schedule Timetable List for Selected Day */}
      <div className="space-y-3">
        {filteredSchedules.length === 0 ? (
          <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-800">Tidak Ada Jadwal pada Hari {selectedDay}</p>
              <p className="text-xs text-slate-500 mt-1">
                Silakan tambahkan jadwal pelajaran untuk hari ini dengan menekan tombol &quot;Tambah Jadwal&quot;.
              </p>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Tambah Jadwal Hari {selectedDay}
            </button>
          </div>
        ) : (
          filteredSchedules.map((item) => {
            const isTodayCard = todayName === item.day_of_week;
            return (
              <div
                key={item.id}
                className={`p-5 rounded-2xl border transition bg-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs hover:shadow-xs ${
                  isTodayCard ? 'border-blue-300 ring-2 ring-blue-500/10' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Time Badge */}
                  <div className="p-3 rounded-xl bg-slate-100 text-slate-800 border border-slate-200 flex flex-col items-center justify-center min-w-[90px] shrink-0 font-mono">
                    <Clock className="w-4 h-4 text-blue-600 mb-1" />
                    <span className="text-xs font-bold">
                      {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5 font-sans font-medium">
                      {item.period_number}
                    </span>
                  </div>

                  {/* Subject Details */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-sm bg-blue-100 text-blue-800 text-[10px] font-bold font-mono">
                        {item.subjects?.subject_code || 'MAPEL'}
                      </span>
                      {item.subjects?.kktp_score && (
                        <span className="text-[11px] text-slate-500">
                          KKTP: <b className="text-emerald-700 font-bold">{item.subjects.kktp_score}</b>
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-extrabold text-slate-900 leading-snug">
                      {item.subjects?.subject_name || 'Mata Pelajaran'}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {item.room_notes || 'Ruang Kelas'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2.5 self-end md:self-center">
                  {/* Quick Action: "Isi Jurnal Sekarang" */}
                  <button
                    onClick={() => onOpenJournalWithSchedule(item)}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs shadow-emerald-600/20 transition group"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Isi Jurnal Sekarang</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                  </button>

                  <button
                    onClick={() => handleOpenModal(item)}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Ubah Jadwal"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setScheduleToDelete(item.id)}
                    className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                    title="Hapus Jadwal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Add / Edit Schedule */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingSchedule ? 'Ubah Slot Jadwal Pelajaran' : 'Tambah Jadwal Pelajaran'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Hari *</label>
                <select
                  value={formData.day_of_week}
                  onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value as DayOfWeek })}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-hidden bg-slate-50"
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mata Pelajaran *</label>
                {subjects.length === 0 ? (
                  <p className="text-xs text-rose-600">
                    Belum ada mata pelajaran di database. Tambahkan dulu di menu Master Data.
                  </p>
                ) : (
                  <select
                    value={formData.subject_id}
                    onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-hidden bg-slate-50"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.subject_code} - {s.subject_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Jam Mulai *</label>
                  <input
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Jam Selesai *</label>
                  <input
                    type="time"
                    required
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Keterangan Jam *</label>
                  <input
                    type="text"
                    required
                    value={formData.period_number}
                    onChange={(e) => setFormData({ ...formData, period_number: e.target.value })}
                    placeholder="Jam ke-1 & 2"
                    className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ruang / Catatan</label>
                  <input
                    type="text"
                    value={formData.room_notes}
                    onChange={(e) => setFormData({ ...formData, room_notes: e.target.value })}
                    placeholder="Ruang Teori 8A"
                    className="w-full px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={subjects.length === 0}
                  className="px-4 py-1.5 text-xs font-bold bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50"
                >
                  Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Jadwal (In-App) */}
      {scheduleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="font-extrabold text-base text-slate-900">Hapus Slot Jadwal?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus slot jadwal pelajaran ini dari Supabase?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setScheduleToDelete(null)}
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
                {isDeleting ? 'Menghapus...' : 'Hapus Jadwal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
