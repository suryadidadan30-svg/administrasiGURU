import React, { useState } from 'react';
import {
  School,
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  Database,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  KeyRound,
} from 'lucide-react';
import { AppUser } from '../types/database.types';
import { authenticateUser } from '../services/academicService';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { useToast } from './Toast';

interface LoginViewProps {
  onLoginSuccess: (user: AppUser) => void;
  onOpenConfig: () => void;
  schoolName?: string;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  onOpenConfig,
  schoolName = 'SMKS 3 PASUNDAN PERKASA',
}) => {
  const toast = useToast();
  const [username, setUsername] = useState('guru');
  const [password, setPassword] = useState('guru123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isConfigured = isSupabaseConfigured();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!username.trim() || !password.trim()) {
      setErrorMessage('Harap masukkan username dan password.');
      return;
    }

    if (!isConfigured) {
      toast.warning('Database Belum Terhubung', 'Harap periksa pengaturan koneksi Supabase Anda.');
      onOpenConfig();
      return;
    }

    setLoading(true);
    try {
      const res = await authenticateUser(username, password);

      if (res.success && res.user) {
        toast.success(
          'Login Berhasil',
          `Selamat datang, ${res.user.full_name}! Akun terverifikasi langsung dari database Supabase.`
        );
        onLoginSuccess(res.user);
      } else {
        setErrorMessage(res.message || 'Username atau password salah.');
        toast.error('Gagal Masuk', res.message || 'Kredensial tidak sesuai.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kendala jaringan';
      setErrorMessage(msg);
      toast.error('Kendala Koneksi', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleFillDefault = () => {
    setUsername('guru');
    setPassword('guru123');
    setErrorMessage(null);
    toast.info('Kredensial Default Terisi', 'Username: guru | Password: guru123');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Decorative ambient background */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header Header */}
        <div className="bg-gradient-to-b from-blue-900 to-indigo-950 p-7 text-white text-center relative border-b border-white/10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-500 to-emerald-400 p-0.5 mx-auto mb-3.5 shadow-xl shadow-blue-500/30 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950/40 backdrop-blur-xs rounded-[14px] flex items-center justify-center">
              <School className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-base font-extrabold tracking-tight uppercase">
            SIM Administrasi Kelas &amp; Rapor
          </h1>
          <p className="text-xs text-blue-200 mt-1 font-medium">
            {schoolName}
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] text-emerald-300 font-semibold">
            <Database className="w-3 h-3 text-emerald-400" />
            Supabase Cloud Database Auth
          </div>
        </div>

        {/* Form Body */}
        <div className="p-7 space-y-5">
          {/* Default Account Info Callout */}
          <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200/80 text-xs text-blue-950 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold flex items-center gap-1.5 text-blue-900">
                <KeyRound className="w-4 h-4 text-blue-600" />
                Akun Awal Sistem (Database Supabase):
              </span>
              <button
                type="button"
                onClick={handleFillDefault}
                className="text-[11px] font-bold text-blue-700 hover:text-blue-900 underline underline-offset-2 transition"
              >
                Gunakan Ini
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px] bg-white p-2 rounded-xl border border-blue-200">
              <div>
                <span className="text-slate-500 block text-[10px] font-sans">Username:</span>
                <b className="text-blue-900">guru</b>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] font-sans">Password:</span>
                <b className="text-blue-900">guru123</b>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed italic">
              *Setelah masuk, Anda dapat mengganti username dan password di menu profil pada Dashboard.
            </p>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold">Gagal Masuk</p>
                <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Username Guru / Akun
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-slate-50 focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Kata Sandi (Password)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden bg-slate-50 focus:bg-white transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 disabled:opacity-60 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition group"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memverifikasi Akun ke Supabase...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                  <span>Masuk ke Administrasi Kelas</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Tools */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <button
              type="button"
              onClick={onOpenConfig}
              className="font-bold text-slate-700 hover:text-blue-700 flex items-center gap-1.5 transition"
            >
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span>Status Koneksi Supabase</span>
            </button>

            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              100% Cloud Postgres
            </span>
          </div>
        </div>
      </div>

      {/* Brand Subtitle */}
      <div className="mt-6 text-center text-xs text-slate-400 relative z-10">
        Kurikulum Merdeka • Manajemen Guru &amp; Buku Nilai Otomatis
      </div>
    </div>
  );
};
