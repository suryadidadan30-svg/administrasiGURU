import React, { useState, useEffect } from 'react';
import { ToastProvider, useToast } from './components/Toast';
import { Sidebar, Navbar, ActiveModule } from './components/Navigation';
import { DashboardView } from './components/DashboardView';
import { ScheduleView } from './components/ScheduleView';
import { AttendanceView } from './components/AttendanceView';
import { JournalView } from './components/JournalView';
import { GradeBookView } from './components/GradeBookView';
import { ReportCardView } from './components/ReportCardView';
import { SupabaseConfigModal } from './components/SupabaseConfigModal';
import { LoginView } from './components/LoginView';
import { SchoolSettings, Schedule, AppUser } from './types/database.types';
import {
  fetchSchoolSettings,
} from './services/academicService';
import {
  isSupabaseConfigured,
  subscribeToConnectionChange,
} from './lib/supabaseClient';

const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  id: '',
  school_name: 'SMKS 3 PASUNDAN PERKASA',
  npsn: '20219876',
  school_level: 'SMA/SMK/MA',
  class_name: 'Kelas XI TKJ-1',
  phase: 'Fase F',
  academic_year: '2026/2027',
  semester: 'Genap',
  teacher_name: 'Dadan Suryadi, S.Pd., M.Kom.',
  teacher_nip: '198507152010011012',
  principal_name: 'Drs. H. Mamat Rohimat, M.M.',
  principal_nip: '197603181999032004',
  updated_at: new Date().toISOString(),
};

function AppContent() {
  const toast = useToast();
  // State user login (disimpan di state aplikasi saat sesi aktif, diverifikasi via database Supabase)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  const [activeModule, setActiveModule] = useState<ActiveModule>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Global School Settings (Default: SMKS 3 PASUNDAN PERKASA)
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);

  // Prefilled schedule state when user clicks "Isi Jurnal Sekarang" in ScheduleView
  const [prefilledSchedule, setPrefilledSchedule] = useState<Schedule | null>(null);

  // Refresh settings when connection is established
  useEffect(() => {
    async function loadSettings() {
      if (isSupabaseConfigured()) {
        try {
          const cfg = await fetchSchoolSettings();
          if (cfg) setSettings(cfg);
        } catch (err) {
          console.log('Supabase belum memiliki tabel school_settings:', err);
        }
      }
    }

    loadSettings();

    const unsubscribe = subscribeToConnectionChange((isReady) => {
      if (isReady) {
        loadSettings();
      }
    });

    return () => unsubscribe();
  }, []);

  // Quick action from ScheduleView: "Isi Jurnal Sekarang"
  const handleOpenJournalWithSchedule = (schedule: Schedule) => {
    setPrefilledSchedule(schedule);
    setActiveModule('journal');
    toast.info(
      'Membuka Jurnal Mengajar',
      `Jadwal ${schedule.subjects?.subject_name || 'Mapel'} otomatis dipilih untuk jurnal hari ini.`
    );
  };

  const handleLogout = () => {
    setCurrentUser(null);
    toast.info('Berhasil Keluar', 'Sesi login telah diakhiri. Silakan login kembali.');
  };

  const moduleTitles: Record<ActiveModule, string> = {
    dashboard: 'Dashboard & Master Data Kelas',
    schedule: 'Jadwal Pelajaran & Kalender Mengajar',
    attendance: 'Pencatatan Absensi Harian & Rekap Bulanan',
    journal: 'Jurnal Mengajar Harian Guru',
    grades: 'Buku Nilai & Capaian Kompetensi Kurikulum Merdeka',
    report_card: 'Cetak Rapor Siswa & Kenaikan Kelas (A4)',
  };

  // Jika belum login, tampilkan Halaman Login User
  if (!currentUser) {
    return (
      <>
        <LoginView
          onLoginSuccess={(user) => setCurrentUser(user)}
          onOpenConfig={() => setIsConfigModalOpen(true)}
          schoolName={settings?.school_name || 'SMKS 3 PASUNDAN PERKASA'}
        />
        <SupabaseConfigModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          onConnected={async () => {
            try {
              const cfg = await fetchSchoolSettings();
              if (cfg) setSettings(cfg);
            } catch (e) {
              console.log(e);
            }
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Sidebar Navigation */}
      <Sidebar
        activeModule={activeModule}
        onChangeModule={setActiveModule}
        settings={settings}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenConfig={() => setIsConfigModalOpen(true)}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0">
        <Navbar
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenConfig={() => setIsConfigModalOpen(true)}
          settings={settings}
          currentUser={currentUser}
          onLogout={handleLogout}
          activeModuleTitle={moduleTitles[activeModule]}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeModule === 'dashboard' && (
            <DashboardView
              settings={settings}
              currentUser={currentUser}
              onUserUpdated={(updatedUser) => setCurrentUser(updatedUser)}
              onSettingsUpdated={(newSettings) => setSettings(newSettings)}
              onOpenConfig={() => setIsConfigModalOpen(true)}
              onNavigateToSchedule={() => setActiveModule('schedule')}
              onNavigateToAttendance={() => setActiveModule('attendance')}
              onNavigateToJournal={() => setActiveModule('journal')}
              onNavigateToGrades={() => setActiveModule('grades')}
            />
          )}

          {activeModule === 'schedule' && (
            <ScheduleView
              onOpenJournalWithSchedule={handleOpenJournalWithSchedule}
              onOpenConfig={() => setIsConfigModalOpen(true)}
            />
          )}

          {activeModule === 'attendance' && <AttendanceView />}

          {activeModule === 'journal' && (
            <JournalView
              settings={settings}
              initialSchedule={prefilledSchedule}
              onClearInitialSchedule={() => setPrefilledSchedule(null)}
            />
          )}

          {activeModule === 'grades' && <GradeBookView settings={settings} />}

          {activeModule === 'report_card' && <ReportCardView settings={settings} />}
        </main>
      </div>

      {/* Supabase Connection Modal */}
      <SupabaseConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onConnected={async () => {
          try {
            const cfg = await fetchSchoolSettings();
            if (cfg) setSettings(cfg);
          } catch (e) {
            console.log(e);
          }
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
