import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  UserCheck,
  BookOpenCheck,
  GraduationCap,
  FileSpreadsheet,
  Database,
  School,
  Sparkles,
  Menu,
  LogOut,
  User,
  KeyRound,
} from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { SchoolSettings, AppUser } from '../types/database.types';

export type ActiveModule =
  | 'dashboard'
  | 'schedule'
  | 'attendance'
  | 'journal'
  | 'grades'
  | 'report_card';

interface SidebarProps {
  activeModule: ActiveModule;
  onChangeModule: (module: ActiveModule) => void;
  settings: SchoolSettings | null;
  currentUser: AppUser | null;
  onLogout: () => void;
  onOpenConfig: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onChangeModule,
  settings,
  currentUser,
  onLogout,
  onOpenConfig,
  isOpenMobile,
  onCloseMobile,
}) => {
  const isConnected = isSupabaseConfigured();

  const menuItems = [
    {
      id: 'dashboard' as ActiveModule,
      label: 'Dashboard & Master Data',
      sub: 'Profil, Siswa & Mapel',
      icon: LayoutDashboard,
    },
    {
      id: 'schedule' as ActiveModule,
      label: 'Jadwal Pelajaran',
      sub: 'Kalender Mingguan',
      icon: CalendarDays,
    },
    {
      id: 'attendance' as ActiveModule,
      label: 'Absensi Siswa Harian',
      sub: 'Harian & Rekap Bulanan',
      icon: UserCheck,
    },
    {
      id: 'journal' as ActiveModule,
      label: 'Jurnal Mengajar Guru',
      sub: 'Sinkron Absen & Cetak',
      icon: BookOpenCheck,
    },
    {
      id: 'grades' as ActiveModule,
      label: 'Buku Nilai (Formatif/Sumatif)',
      sub: 'Input Nilai & Deskripsi AI',
      icon: GraduationCap,
    },
    {
      id: 'report_card' as ActiveModule,
      label: 'Cetak Rapor Siswa (A4)',
      sub: 'Kenaikan Kelas & Tandatangan',
      icon: FileSpreadsheet,
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden no-print"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-72 bg-gradient-to-b from-slate-900 via-slate-900 to-blue-950 text-white flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        } no-print border-r border-slate-800 shadow-xl`}
      >
        {/* Brand / School Header */}
        <div
          onClick={() => {
            onChangeModule('dashboard');
            onCloseMobile();
          }}
          className="p-5 border-b border-white/10 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition"
          title="Klik untuk ke Dashboard & Profil Sekolah"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
            <School className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-extrabold tracking-tight truncate text-white">
              {settings?.school_name || 'SMKS 3 PASUNDAN PERKASA'}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded-sm">
                {settings?.class_name || 'Kelas XI TKJ-1'}
              </span>
              <span className="text-[10px] text-slate-400 truncate">
                {settings?.academic_year ? `TP ${settings.academic_year}` : 'TA 2026/2027'}
              </span>
            </div>
          </div>
        </div>

        {/* Logged in User Profile Card */}
        {currentUser && (
          <div className="px-5 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 ring-2 ring-white/20">
                {currentUser.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate leading-tight">
                  {currentUser.full_name}
                </p>
                <p className="text-[10px] text-emerald-400 font-mono truncate">
                  @{currentUser.username} • {currentUser.role}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                onChangeModule('dashboard');
                onCloseMobile();
              }}
              title="Ganti Username / Password"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition shrink-0"
            >
              <KeyRound className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Navigation list */}
        <div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Modul Administrasi
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onChangeModule(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition group ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400 group-hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold leading-tight truncate">{item.label}</div>
                  <div className={`text-[10px] truncate ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                    {item.sub}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom Actions: Supabase Status & Logout */}
        <div className="p-4 border-t border-white/10 bg-black/20 space-y-2">
          <div
            onClick={onOpenConfig}
            role="button"
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-white/10 transition cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative">
                <Database className="w-4 h-4 text-emerald-400" />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-slate-900 ${
                    isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                  }`}
                />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-white flex items-center gap-1">
                  Supabase Cloud
                  {isConnected && <Sparkles className="w-3 h-3 text-emerald-400 inline" />}
                </div>
                <div className="text-[9px] text-slate-400 truncate">
                  {isConnected ? 'PostgreSQL Live Connected' : 'Konfigurasi DB'}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-md text-slate-200">
              Kelola
            </span>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 p-2 rounded-xl text-rose-300 hover:text-white hover:bg-rose-500/20 border border-rose-500/20 text-xs font-bold transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar dari Sistem (Logout)
          </button>
        </div>
      </aside>
    </>
  );
};

interface NavbarProps {
  onOpenMobileSidebar: () => void;
  onOpenConfig: () => void;
  settings: SchoolSettings | null;
  currentUser: AppUser | null;
  onLogout: () => void;
  activeModuleTitle: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenMobileSidebar,
  onOpenConfig,
  settings,
  currentUser,
  onLogout,
  activeModuleTitle,
}) => {
  const isConnected = isSupabaseConfigured();

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 lg:px-8 py-3 flex items-center justify-between no-print shadow-xs">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            {activeModuleTitle}
          </h2>
          <p className="text-xs text-slate-500 hidden sm:block">
            {settings?.school_name || 'SMKS 3 PASUNDAN PERKASA'} • {settings?.teacher_name ? `Wali: ${settings.teacher_name}` : 'Kelas XI TKJ-1'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenConfig}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
            isConnected
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
              : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span className="hidden md:inline">
            {isConnected ? 'Supabase Terhubung' : 'Atur Supabase'}
          </span>
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
        </button>

        {currentUser && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-slate-900 leading-tight">{currentUser.full_name}</p>
              <p className="text-[10px] text-slate-500 font-mono">@{currentUser.username}</p>
            </div>
            <button
              onClick={onLogout}
              title="Keluar (Logout)"
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
