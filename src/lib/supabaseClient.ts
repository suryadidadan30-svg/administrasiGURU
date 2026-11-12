import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Baca dari env jika ada
const ENV_URL = import.meta.env.VITE_SUPABASE_URL || '';
const ENV_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Penyimpanan runtime sementara untuk kredensial koneksi UI jika env kosong
let currentUrl = ENV_URL;
let currentKey = ENV_KEY;

// Cek apakah ada kredensial yang tersimpan di memori sesi browser
if (!currentUrl && typeof window !== 'undefined') {
  const sessionUrl = sessionStorage.getItem('__SUPABASE_URL__');
  const sessionKey = sessionStorage.getItem('__SUPABASE_KEY__');
  if (sessionUrl && sessionKey) {
    currentUrl = sessionUrl;
    currentKey = sessionKey;
  }
}

// Inisialisasi client Supabase
let supabaseInstance: SupabaseClient | null = null;

if (currentUrl && currentKey && currentUrl.startsWith('http')) {
  try {
    supabaseInstance = createClient(currentUrl, currentKey, {
      auth: {
        persistSession: false, // Sesuai batasan: autentikasi murni direct
      },
    });
  } catch (err) {
    console.error('Gagal menginisialisasi Supabase Client:', err);
  }
}

// Event listener untuk observer perubahan koneksi
type ConnectionListener = (isReady: boolean) => void;
const listeners: ConnectionListener[] = [];

export function subscribeToConnectionChange(listener: ConnectionListener) {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

function notifyListeners() {
  const ready = isSupabaseConfigured();
  listeners.forEach((l) => l(ready));
}

export function isSupabaseConfigured(): boolean {
  return !!(currentUrl && currentKey && supabaseInstance);
}

export function getStoredCredentials(): { url: string; key: string } {
  return {
    url: currentUrl,
    key: currentKey,
  };
}

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    if (currentUrl && currentKey) {
      supabaseInstance = createClient(currentUrl, currentKey, {
        auth: { persistSession: false },
      });
      return supabaseInstance;
    }
    throw new Error('Supabase Client belum dikonfigurasi. Silakan masukkan Supabase Project URL dan Anon Key di Pengaturan Koneksi.');
  }
  return supabaseInstance;
}

export function configureSupabase(url: string, key: string): { success: boolean; error?: string } {
  try {
    if (!url.trim() || !key.trim()) {
      return { success: false, error: 'URL dan Anon Key tidak boleh kosong' };
    }
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      return { success: false, error: 'URL harus diawali dengan https:// atau http://' };
    }

    currentUrl = url.trim();
    currentKey = key.trim();

    if (typeof window !== 'undefined') {
      sessionStorage.setItem('__SUPABASE_URL__', currentUrl);
      sessionStorage.setItem('__SUPABASE_KEY__', currentKey);
    }

    supabaseInstance = createClient(currentUrl, currentKey, {
      auth: { persistSession: false },
    });

    notifyListeners();
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Gagal menghubungkan';
    return { success: false, error: errorMsg };
  }
}

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string; tablesFound?: string[] }> {
  if (!isSupabaseConfigured() || !supabaseInstance) {
    return {
      success: false,
      message: 'Supabase belum dikonfigurasi. Masukkan Project URL dan Anon Key.',
    };
  }

  try {
    // Cek koneksi dasar dengan query salah satu tabel
    const { error: settingsError } = await supabaseInstance
      .from('school_settings')
      .select('id')
      .limit(1);

    if (settingsError) {
      if (settingsError.code === '42P01') {
        return {
          success: false,
          message: 'Terhubung ke Supabase, namun tabel belum dibuat! Silakan jalankan Skrip SQL DDL di Supabase SQL Editor.',
        };
      }
      return {
        success: false,
        message: `Koneksi gagal: ${settingsError.message || settingsError.code}`,
      };
    }

    return {
      success: true,
      message: 'Koneksi ke Supabase Cloud Berhasil! Basis data siap digunakan.',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Koneksi jaringan terputus atau URL salah';
    return {
      success: false,
      message: errorMsg,
    };
  }
}
