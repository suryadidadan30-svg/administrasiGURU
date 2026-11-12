export const SUPABASE_DDL_SQL = `-- ============================================================
-- SKRIP SQL DDL SUPABASE: APLIKASI ADMINISTRASI KELAS TERPADU
-- Jalankan skrip ini langsung di Supabase Dashboard -> SQL Editor -> Run
-- ============================================================

-- 1. Ekstensi UUID (biasanya sudah aktif di Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Hapus tabel jika ingin reset bersih (opsional / berurutan)
-- DROP TABLE IF EXISTS report_cards CASCADE;
-- DROP TABLE IF EXISTS grades CASCADE;
-- DROP TABLE IF EXISTS teaching_journals CASCADE;
-- DROP TABLE IF EXISTS attendances CASCADE;
-- DROP TABLE IF EXISTS schedules CASCADE;
-- DROP TABLE IF EXISTS subjects CASCADE;
-- DROP TABLE IF EXISTS students CASCADE;
-- DROP TABLE IF EXISTS school_settings CASCADE;

-- 0. Tabel Akun Pengguna / Guru (Tersimpan di Supabase)
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'Guru / Wali Kelas',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1. Tabel Pengaturan Sekolah & Wali Kelas
CREATE TABLE IF NOT EXISTS school_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_name TEXT NOT NULL,
    npsn TEXT,
    school_level TEXT NOT NULL, -- SD/MI, SMP/MTs, SMA/SMK/MA
    class_name TEXT NOT NULL,
    phase TEXT, -- Fase A - F
    academic_year TEXT NOT NULL, -- Contoh: 2026/2027
    semester TEXT NOT NULL, -- Ganjil / Genap
    teacher_name TEXT NOT NULL,
    teacher_nip TEXT,
    principal_name TEXT NOT NULL,
    principal_nip TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabel Master Siswa
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nis TEXT UNIQUE NOT NULL,
    nisn TEXT UNIQUE,
    full_name TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('L', 'P')),
    parent_name TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabel Mata Pelajaran & KKM/KKTP
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_code TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    kktp_score NUMERIC(5,2) DEFAULT 75.00,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabel Jadwal Pelajaran
CREATE TABLE IF NOT EXISTS schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week TEXT NOT NULL, -- Senin, Selasa, Rabu, Kamis, Jumat, Sabtu
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    period_number TEXT NOT NULL, -- Jam ke-1, Jam ke-2 & 3, dst
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    room_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabel Absensi Siswa Harian
CREATE TABLE IF NOT EXISTS attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT CHECK (status IN ('Hadir', 'Sakit', 'Izin', 'Alpa')) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, attendance_date)
);

-- 6. Tabel Jurnal Mengajar Harian Guru
CREATE TABLE IF NOT EXISTS teaching_journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_date DATE NOT NULL DEFAULT CURRENT_DATE,
    schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    period_info TEXT NOT NULL,
    topic_material TEXT NOT NULL,
    learning_activities TEXT NOT NULL,
    student_evaluator_notes TEXT,
    total_present INT DEFAULT 0,
    total_absent INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Tabel Penilaian (Nilai Harian s.d. Kenaikan Kelas)
CREATE TABLE IF NOT EXISTS grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL,
    semester TEXT NOT NULL,
    nh1 NUMERIC(5,2) DEFAULT 0,
    nh2 NUMERIC(5,2) DEFAULT 0,
    nh3 NUMERIC(5,2) DEFAULT 0,
    nh4 NUMERIC(5,2) DEFAULT 0,
    sts_score NUMERIC(5,2) DEFAULT 0,
    sas_pat_score NUMERIC(5,2) DEFAULT 0,
    final_score NUMERIC(5,2) GENERATED ALWAYS AS (
        ROUND((((nh1 + nh2 + nh3 + nh4) / 4.0) * 0.40) + (sts_score * 0.30) + (sas_pat_score * 0.30), 2)
    ) STORED,
    competency_description TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, subject_id, academic_year, semester)
);

-- 8. Tabel Catatan Rapor & Keputusan Kenaikan Kelas
CREATE TABLE IF NOT EXISTS report_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL,
    semester TEXT NOT NULL,
    extracurricular_notes JSONB DEFAULT '[]',
    attitude_notes TEXT,
    teacher_homeroom_notes TEXT,
    promotion_status TEXT CHECK (promotion_status IN ('Naik Kelas', 'Tinggal Kelas', 'Lulus', 'Belum Ditentukan')) DEFAULT 'Belum Ditentukan',
    promoted_to_class TEXT,
    report_date DATE DEFAULT CURRENT_DATE,
    UNIQUE(student_id, academic_year, semester)
);

-- ============================================================
-- INDEKS PERFORMA QUERY
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_attendances_date ON attendances(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendances_student ON attendances(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_lookup ON grades(academic_year, semester, subject_id);
CREATE INDEX IF NOT EXISTS idx_journals_date ON teaching_journals(journal_date);
CREATE INDEX IF NOT EXISTS idx_schedules_day ON schedules(day_of_week);

-- ============================================================
-- KEBIJAKAN ROW LEVEL SECURITY (RLS)
-- Mengizinkan pembacaan dan pembaruan untuk anon & authenticated
-- ============================================================
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE teaching_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_cards ENABLE ROW LEVEL SECURITY;

-- Buat policy akses penuh (CRUD) untuk semua tabel
DROP POLICY IF EXISTS "Public access for app_users" ON app_users;
CREATE POLICY "Public access for app_users" ON app_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for school_settings" ON school_settings;
CREATE POLICY "Public access for school_settings" ON school_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for students" ON students;
CREATE POLICY "Public access for students" ON students FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for subjects" ON subjects;
CREATE POLICY "Public access for subjects" ON subjects FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for schedules" ON schedules;
CREATE POLICY "Public access for schedules" ON schedules FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for attendances" ON attendances;
CREATE POLICY "Public access for attendances" ON attendances FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for teaching_journals" ON teaching_journals;
CREATE POLICY "Public access for teaching_journals" ON teaching_journals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for grades" ON grades;
CREATE POLICY "Public access for grades" ON grades FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for report_cards" ON report_cards;
CREATE POLICY "Public access for report_cards" ON report_cards FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SEED DATA AWAL (JIKA TABEL MASIH KOSONG)
-- ============================================================
-- Akun Pengguna Default: username 'guru' / password 'guru123'
INSERT INTO app_users (username, password, full_name, role)
SELECT 'guru', 'guru123', 'Dadan Suryadi, S.Pd., M.Kom.', 'Guru / Wali Kelas'
WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE username = 'guru');

INSERT INTO school_settings (school_name, npsn, school_level, class_name, phase, academic_year, semester, teacher_name, teacher_nip, principal_name, principal_nip)
SELECT 'SMKS 3 PASUNDAN PERKASA', '20219876', 'SMA/SMK/MA', 'Kelas XI TKJ-1', 'Fase F', '2026/2027', 'Genap', 'Dadan Suryadi, S.Pd., M.Kom.', '198507152010011012', 'Drs. H. Mamat Rohimat, M.M.', '197603181999032004'
WHERE NOT EXISTS (SELECT 1 FROM school_settings LIMIT 1);
`;
