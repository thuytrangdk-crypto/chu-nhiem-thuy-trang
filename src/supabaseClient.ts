import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://sohuavueougdlsqerwuk.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_2BcotajR597WKnTP9G0wrg_N8oBj1PM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const SUPABASE_CONFIG = {
  url: SUPABASE_URL,
  key: SUPABASE_ANON_KEY,
};

// SQL script riêng để thiết lập Supabase Storage cho Video Bảng tin
export const SUPABASE_STORAGE_SQL = `-- Chạy đoạn mã này trong Supabase > SQL Editor > New query > Run
-- Thiết lập Bucket lưu trữ Video cho Bảng tin Trợ lý chủ nhiệm (Supabase Storage)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'board_videos',
  'board_videos',
  true,
  104857600, -- Giới hạn 100MB mỗi video
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/mpeg', 'video/ogg', 'video/3gpp', 'video/x-matroska']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/mpeg', 'video/ogg', 'video/3gpp', 'video/x-matroska'];

-- Cấp quyền truy cập (RLS Policy) cho bucket board_videos
DROP POLICY IF EXISTS "Cho phep xem video cong khai" ON storage.objects;
CREATE POLICY "Cho phep xem video cong khai"
ON storage.objects FOR SELECT
USING (bucket_id = 'board_videos');

DROP POLICY IF EXISTS "Cho phep tai video len" ON storage.objects;
CREATE POLICY "Cho phep tai video len"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'board_videos');

DROP POLICY IF EXISTS "Cho phep cap nhat video" ON storage.objects;
CREATE POLICY "Cho phep cap nhat video"
ON storage.objects FOR UPDATE
USING (bucket_id = 'board_videos');

DROP POLICY IF EXISTS "Cho phep xoa video" ON storage.objects;
CREATE POLICY "Cho phep xoa video"
ON storage.objects FOR DELETE
USING (bucket_id = 'board_videos');
`;

// SQL script chuyên biệt thiết lập Phân quyền Bảo mật Chuẩn xác (Row Level Security - RLS)
// 1. Khóa bảng chính tro_ly_chu_nhiem_data để ngăn chặn rò rỉ JSON mật khẩu và dữ liệu riêng tư.
// 2. Tạo VIEW an toàn 'view_thong_tin_lop_cong_khai' để Học sinh CHỈ đọc Bảng tin và Sơ đồ lớp.
// 3. Tạo hàm RPC 'gvcn_luu_thay_doi' (SECURITY DEFINER) để Database Server xác thực mật khẩu GVCN trước khi cho phép ghi.
export const SUPABASE_RLS_SQL = `-- ==============================================================================
-- BẢO MẬT & PHÂN QUYỀN CHUẨN XÁC TRÊN SUPABASE (ROW LEVEL SECURITY)
-- ỨNG DỤNG: TRỢ LÝ CHỦ NHIỆM (LỚP 8A3 VÀ CÁC LỚP)
-- HƯỚNG DẪN: Chạy trong Supabase Dashboard > SQL Editor > New Query > Run
-- BẢO TOÀN DỮ LIỆU: Tuyệt đối KHÔNG xóa bảng, không xóa 44 học sinh hay bản sao lưu!
-- ==============================================================================

-- 1. Kích hoạt Row Level Security trên bảng dữ liệu chính
ALTER TABLE IF EXISTS public.tro_ly_chu_nhiem_data ENABLE ROW LEVEL SECURITY;

-- 2. Xóa toàn bộ các policy cũ (loại bỏ hoàn toàn lỗ hổng != 'student' và Public full access)
DROP POLICY IF EXISTS "Public full access" ON public.tro_ly_chu_nhiem_data;
DROP POLICY IF EXISTS "Cho phep xem du lieu bang tin va so do lop" ON public.tro_ly_chu_nhiem_data;
DROP POLICY IF EXISTS "Cho phep hoc sinh va GVCN doc du lieu" ON public.tro_ly_chu_nhiem_data;
DROP POLICY IF EXISTS "Chi GVCN duoc phep them moi du lieu" ON public.tro_ly_chu_nhiem_data;
DROP POLICY IF EXISTS "Chi GVCN duoc phep cap nhat du lieu" ON public.tro_ly_chu_nhiem_data;
DROP POLICY IF EXISTS "Chi GVCN duoc phep xoa du lieu" ON public.tro_ly_chu_nhiem_data;
DROP POLICY IF EXISTS "GVCN duoc xac thuc qua Supabase Auth toan quyen ghi" ON public.tro_ly_chu_nhiem_data;

-- 3. MẶC ĐỊNH TỪ CHỐI (DENY BY DEFAULT) ĐỐI VỚI ANON TRÊN BẢNG CHÍNH
-- Thu hồi quyền ghi và đọc trực tiếp đối với anon trên bảng chứa JSON nhạy cảm
REVOKE INSERT, UPDATE, DELETE ON public.tro_ly_chu_nhiem_data FROM anon;

-- Cho phép tài khoản Giáo viên được xác thực qua Supabase Auth (nếu có đăng nhập Auth)
CREATE POLICY "GVCN duoc xac thuc qua Supabase Auth toan quyen ghi"
ON public.tro_ly_chu_nhiem_data
FOR ALL
TO authenticated
USING (
  coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'teacher' OR
  coalesce(auth.jwt() ->> 'email', '') = 'thuytrangdk@gmail.com'
)
WITH CHECK (
  coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'teacher' OR
  coalesce(auth.jwt() ->> 'email', '') = 'thuytrangdk@gmail.com'
);

-- 4. GIẢI QUYẾT TRIỆT ĐỂ NGUY CƠ RÒ RỈ DỮ LIỆU CỦA SINGLE JSON:
-- Tạo VIEW công khai an toàn: Học sinh và khách CHỈ được đọc đúng Bảng tin & Sơ đồ lớp.
-- KHÔNG BAO GIỜ để lộ trường mật khẩu GVCN, mật khẩu học sinh, sổ kỷ luật hay ghi chú phụ huynh!
CREATE OR REPLACE VIEW public.view_thong_tin_lop_cong_khai AS
SELECT
  id,
  (data->'config'->>'className') AS class_name,
  (data->'config'->>'schoolYear') AS school_year,
  (data->'config'->>'teacherName') AS teacher_name,
  (data->'boardNotices') AS board_notices,
  (data->'seatingChart') AS seating_chart,
  (data->'seatingLayout') AS seating_layout,
  (data->'academicAnnouncements') AS academic_announcements,
  updated_at
FROM public.tro_ly_chu_nhiem_data
WHERE id = 'main_state';

GRANT SELECT ON public.view_thong_tin_lop_cong_khai TO anon, authenticated;

-- 5. HÀM SERVER-SIDE XÁC THỰC MẬT KHẨU GVCN TRƯỚC KHI GHI (SECURITY DEFINER)
-- Database Server trực tiếp kiểm tra mật khẩu, không phụ thuộc trình duyệt tự khai báo vai trò.
CREATE OR REPLACE FUNCTION public.gvcn_luu_thay_doi(
  p_class_name TEXT,
  p_teacher_password TEXT,
  p_new_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_pw TEXT;
BEGIN
  -- Lấy mật khẩu GVCN hiện tại từ database
  SELECT data->'config'->>'teacherPassword' INTO v_stored_pw
  FROM public.tro_ly_chu_nhiem_data
  WHERE id = 'main_state';

  -- Xác minh mật khẩu phía Server
  IF v_stored_pw IS NULL OR p_teacher_password != v_stored_pw THEN
    RAISE EXCEPTION 'Xác thực thất bại: Mật khẩu Giáo viên chủ nhiệm không chính xác. Yêu cầu ghi bị từ chối!';
  END IF;

  -- Cập nhật an toàn
  UPDATE public.tro_ly_chu_nhiem_data
  SET data = p_new_data, updated_at = now()
  WHERE id = 'main_state';

  RETURN jsonb_build_object('success', true, 'updated_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.gvcn_luu_thay_doi(TEXT, TEXT, JSONB) TO anon, authenticated;

-- 6. HÀM TẢI DỮ LIỆU ĐẦY ĐỦ CÓ XÁC THỰC MẬT KHẨU CHO GVCN
CREATE OR REPLACE FUNCTION public.gvcn_tai_du_lieu_day_du(
  p_teacher_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_pw TEXT;
  v_full_state JSONB;
BEGIN
  SELECT data->'config'->>'teacherPassword', data INTO v_stored_pw, v_full_state
  FROM public.tro_ly_chu_nhiem_data
  WHERE id = 'main_state';

  IF v_stored_pw IS NULL OR p_teacher_password != v_stored_pw THEN
    RAISE EXCEPTION 'Xác thực thất bại: Mật khẩu Giáo viên chủ nhiệm không chính xác!';
  END IF;

  RETURN v_full_state;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gvcn_tai_du_lieu_day_du(TEXT) TO anon, authenticated;
`;

// SQL script toàn diện thiết lập cả bảng dữ liệu, Realtime, Storage và Phân quyền RLS
export const SUPABASE_SCHEMA_SQL = `-- ==============================================================================
-- THIẾT LẬP TOÀN DIỆN CƠ SỞ DỮ LIỆU & BẢO MẬT PHÂN QUYỀN SUPABASE
-- ỨNG DỤNG: TRỢ LÝ CHỦ NHIỆM (LỚP 8A3 & CÁC LỚP)
-- HƯỚNG DẪN: Dán toàn bộ mã này vào Supabase > SQL Editor > New query > Run
-- ==============================================================================

-- 1. Tạo bảng lưu trữ dữ liệu lớp (nếu chưa có)
CREATE TABLE IF NOT EXISTS public.tro_ly_chu_nhiem_data (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Kích hoạt Row Level Security (RLS) bảo vệ dữ liệu
ALTER TABLE public.tro_ly_chu_nhiem_data ENABLE ROW LEVEL SECURITY;

-- 3. Xóa các policy cũ không an toàn
DROP POLICY IF EXISTS "Public full access" ON public.tro_ly_chu_nhiem_data;
DROP POLICY IF EXISTS "Cho phep xem du lieu bang tin va so do lop" ON public.tro_ly_chu_nhiem_data;
DROP POLICY IF EXISTS "Chi GVCN duoc phep them moi du lieu" ON public.tro_ly_chu_nhiem_data;
DROP POLICY IF EXISTS "Chi GVCN duoc phep cap nhat du lieu" ON public.tro_ly_chu_nhiem_data;
DROP POLICY IF EXISTS "Chi GVCN duoc phep xoa du lieu" ON public.tro_ly_chu_nhiem_data;
DROP POLICY IF EXISTS "GVCN duoc xac thuc qua Supabase Auth toan quyen ghi" ON public.tro_ly_chu_nhiem_data;

-- 4. Bật Realtime để khi GVCN đăng bài hoặc xếp chỗ ngồi, học sinh thấy ngay lập tức
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'tro_ly_chu_nhiem_data'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tro_ly_chu_nhiem_data;
  END IF;
END $$;

-- 5. Tạo VIEW an toàn cho Học sinh đọc Bảng tin và Sơ đồ lớp (không lộ mật khẩu hay kỷ luật)
CREATE OR REPLACE VIEW public.view_thong_tin_lop_cong_khai AS
SELECT
  id,
  (data->'config'->>'className') AS class_name,
  (data->'config'->>'schoolYear') AS school_year,
  (data->'config'->>'teacherName') AS teacher_name,
  (data->'boardNotices') AS board_notices,
  (data->'seatingChart') AS seating_chart,
  (data->'seatingLayout') AS seating_layout,
  (data->'academicAnnouncements') AS academic_announcements,
  updated_at
FROM public.tro_ly_chu_nhiem_data
WHERE id = 'main_state';

GRANT SELECT ON public.view_thong_tin_lop_cong_khai TO anon, authenticated;

-- 6. Tạo Hàm Server-Side xác thực mật khẩu GVCN trước khi Ghi dữ liệu
CREATE OR REPLACE FUNCTION public.gvcn_luu_thay_doi(
  p_class_name TEXT,
  p_teacher_password TEXT,
  p_new_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_pw TEXT;
BEGIN
  SELECT data->'config'->>'teacherPassword' INTO v_stored_pw
  FROM public.tro_ly_chu_nhiem_data
  WHERE id = 'main_state';

  IF v_stored_pw IS NULL OR p_teacher_password != v_stored_pw THEN
    RAISE EXCEPTION 'Xác thực thất bại: Mật khẩu Giáo viên chủ nhiệm không chính xác. Yêu cầu ghi bị từ chối!';
  END IF;

  UPDATE public.tro_ly_chu_nhiem_data
  SET data = p_new_data, updated_at = now()
  WHERE id = 'main_state';

  RETURN jsonb_build_object('success', true, 'updated_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.gvcn_luu_thay_doi(TEXT, TEXT, JSONB) TO anon, authenticated;

-- 7. Tạo Bucket Supabase Storage lưu trữ Video cho Bảng tin
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'board_videos',
  'board_videos',
  true,
  104857600, -- 100MB
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/mpeg', 'video/ogg', 'video/3gpp', 'video/x-matroska']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/mpeg', 'video/ogg', 'video/3gpp', 'video/x-matroska'];

-- Cấp quyền truy cập (RLS Policy) cho bucket board_videos: Học sinh chỉ xem
DROP POLICY IF EXISTS "Cho phep xem video cong khai" ON storage.objects;
CREATE POLICY "Cho phep xem video cong khai"
ON storage.objects FOR SELECT
USING (bucket_id = 'board_videos');
`;

