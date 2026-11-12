import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Server,
  Key,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  X,
  Code2,
} from 'lucide-react';
import {
  isSupabaseConfigured,
  getStoredCredentials,
  configureSupabase,
  testSupabaseConnection,
} from '../lib/supabaseClient';
import { SUPABASE_DDL_SQL } from '../lib/sqlScripts';
import { seedSampleDataToSupabase } from '../services/academicService';
import { useToast } from './Toast';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConnected,
}) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'config' | 'sql'>('config');
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const creds = getStoredCredentials();
      setUrl(creds.url || '');
      setKey(creds.key || '');
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !key.trim()) {
      toast.warning('Input Kurang', 'Harap isi Supabase Project URL dan Anon Key');
      return;
    }

    const res = configureSupabase(url, key);
    if (!res.success) {
      toast.error('Gagal Konfigurasi', res.error);
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const testRes = await testSupabaseConnection();
    setIsTesting(false);
    setTestResult(testRes);

    if (testRes.success) {
      toast.success('Koneksi Supabase Sukses!', testRes.message);
      if (onConnected) onConnected();
    } else {
      toast.error('Koneksi Belum Berhasil', testRes.message);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_DDL_SQL);
    setCopiedSql(true);
    toast.info('SQL Berhasil Disalin', 'Buka Supabase -> SQL Editor -> Tempel (Paste) lalu tekan Run.');
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleRunSeed = async () => {
    if (!isSupabaseConfigured()) {
      toast.warning('Belum Terhubung', 'Harap hubungkan Supabase terlebih dahulu sebelum mengisi data awal.');
      return;
    }

    setIsSeeding(true);
    const res = await seedSampleDataToSupabase();
    setIsSeeding(false);

    if (res.success) {
      toast.success('Data Berhasil Ditambahkan', res.message);
      if (onConnected) onConnected();
      onClose();
    } else {
      toast.error('Gagal Inisialisasi Data', res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs border border-white/20">
              <Database className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Koneksi Supabase Cloud</h2>
              <p className="text-xs text-blue-200">
                Penyimpanan Database Relasional PostgreSQL 100% Cloud Real-time
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2">
          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
              activeTab === 'config'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="w-4 h-4" />
            Kredensial API & Status
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
              activeTab === 'sql'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className="w-4 h-4" />
            Skrip SQL DDL Supabase (8 Tabel)
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'config' ? (
            <>
              {/* Connection Status Banner */}
              <div
                className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                  testResult?.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : testResult && !testResult.success
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : isSupabaseConfigured()
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {testResult?.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : testResult && !testResult.success ? (
                    <AlertCircle className="w-5 h-5 text-rose-600" />
                  ) : isSupabaseConfigured() ? (
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  )}
                </div>
                <div className="flex-1 text-xs">
                  <p className="font-bold text-sm">
                    {testResult?.success
                      ? 'Supabase Terhubung & Siap Digunakan'
                      : testResult && !testResult.success
                      ? 'Kendala Koneksi Supabase'
                      : isSupabaseConfigured()
                      ? 'Kredensial Supabase Terpasang'
                      : 'Kredensial Supabase Belum Diisi'}
                  </p>
                  <p className="mt-1 leading-relaxed opacity-90">
                    {testResult?.message ||
                      (isSupabaseConfigured()
                        ? 'Sistem siap beroperasi langsung membaca dan menulis data ke tabel PostgreSQL Supabase.'
                        : 'Masukkan URL Project dan Anon Public Key dari Dashboard Supabase Anda (Settings > API) untuk mengaktifkan sinkronisasi real-time.')}
                  </p>
                </div>
              </div>

              {/* Form Input */}
              <form onSubmit={handleSaveAndTest} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-blue-600" />
                    Supabase Project URL
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://xyzcompanyproject.supabase.co"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden font-mono bg-slate-50"
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Ditemukan di Supabase Dashboard → Project Settings → API → Project URL
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-emerald-600" />
                    Supabase Anon Public API Key
                  </label>
                  <input
                    type="password"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden font-mono bg-slate-50"
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Gunakan key bertipe <code className="text-emerald-700 font-semibold">anon public</code> (bukan service_role).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isTesting}
                    className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition"
                  >
                    {isTesting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Menguji Koneksi...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Simpan &amp; Uji Koneksi
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleRunSeed}
                    disabled={isSeeding || !isSupabaseConfigured()}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition"
                  >
                    {isSeeding ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Mengisi Data...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Isi Data Contoh ke Supabase (1-Klik)
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Quick instruction guide */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
                <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                  Petunjuk Penggunaan Supabase:
                </p>
                <ol className="list-decimal list-inside space-y-1 pl-1">
                  <li>Buat proyek gratis baru di <span className="font-semibold text-slate-800">supabase.com</span> jika belum memiliki.</li>
                  <li>Buka tab <span className="font-semibold text-slate-800">&quot;Skrip SQL DDL Supabase&quot;</span> di atas, salin kodenya, dan jalankan di SQL Editor Supabase.</li>
                  <li>Salin Project URL dan Anon Key dari Supabase ke formulir ini dan klik Simpan.</li>
                  <li>Klik tombol <span className="font-semibold text-emerald-700">&quot;Isi Data Contoh ke Supabase&quot;</span> untuk memuat profil sekolah, mata pelajaran, dan siswa secara otomatis!</li>
                </ol>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Skrip SQL DDL PostgreSQL Supabase
                  </p>
                  <p className="text-xs text-slate-500">
                    Mencakup 8 tabel berelasi, rumus nilai otomatis GENERATED ALWAYS, indeks, dan aturan Row Level Security (RLS).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      Tersalin ke Clipboard!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Salin Skrip SQL
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto max-h-[350px] leading-relaxed border border-slate-800 selection:bg-blue-600">
                  {SUPABASE_DDL_SQL}
                </pre>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                *Tips: Skrip ini dirancang menggunakan <code className="font-mono text-blue-600">CREATE TABLE IF NOT EXISTS</code> sehingga aman dijalankan kapan saja tanpa menghapus data yang sudah ada.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
