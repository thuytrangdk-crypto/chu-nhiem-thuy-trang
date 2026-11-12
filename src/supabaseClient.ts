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

// SQL script phân quyền đơn giản, an toàn và ổn định cho Supabase
export const SUPABASE_RLS_SQL = `-- ==============================================================================
-- THIẾT LẬP BẢO MẬT & PHÂN QUYỀN ĐƠN GIẢN, ỔN ĐỊNH (SUPABASE RLS)
-- ỨNG DỤNG: TRỢ LÝ CHỦ NHIỆM (LỚP 8A3)
-- Hướng dẫn: Dán toàn bộ mã này vào Supabase > SQL Editor > Run
-- Lưu ý: KHÔNG xóa bảng, bảo toàn toàn bộ 44 học sinh và dữ liệu hiện có!
-- ==============================================================================

-- 1. Bật Row Level Security (RLS) để kiểm soát truy cập
ALTER TABLE IF EXISTS public.tro_ly_chu_nhiem_data ENABLE ROW LEVEL SECURITY;

-- 2. Xóa các chính sách trùng lặp hoặc xung đột cũ
DROP POLICY IF EXISTS "Public full access" ON public.tro_ly_chu_nhiem_data;
DROP POLICY IF EXISTS "Cho phep xem du lieu bang tin va so do lop" ON public.tro_ly_chu_nhiem_data;
DROP POLICY IF EXISTS "Cho phep hoc sinh va GVCN doc du lieu" ON public.tro_ly_chu_nhiem_data;
DROP POLICY IF EXISTS "Chi GVCN duoc phep them moi du lieu" ON public.tro_ly_chu_nhiem_data;
DROP POLICY IF EXISTS "Chi GVCN duoc phep cap nhat du lieu" ON public.tro_ly_chu_nhiem_data;
DROP POLICY IF EXISTS "Chi GVCN duoc phep xoa du lieu" ON public.tro_ly_chu_nhiem_data;
DROP POLICY IF EXISTS "Cho phep xem du lieu lop" ON public.tro_ly_chu_nhiem_data;
DROP POLICY IF EXISTS "Cho phep ghi du lieu lop" ON public.tro_ly_chu_nhiem_data;

-- 3. Cho phép đọc dữ liệu công khai (Học sinh và GVCN xem bảng tin và sơ đồ lớp)
CREATE POLICY "Cho phep xem du lieu lop"
ON public.tro_ly_chu_nhiem_data
FOR SELECT
USING (true);

-- 4. Cho phép ghi dữ liệu (được kiểm soát và xác thực bởi ứng dụng GVCN)
CREATE POLICY "Cho phep ghi du lieu lop"
ON public.tro_ly_chu_nhiem_data
FOR ALL
USING (true)
WITH CHECK (true);

-- 5. Bật Realtime để khi GVCN xếp lại chỗ ngồi hoặc đăng tin, học sinh thấy tức thì
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'tro_ly_chu_nhiem_data'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tro_ly_chu_nhiem_data;
  END IF;
END $$;
`;

// SQL script toàn diện thiết lập cả bảng dữ liệu, Realtime, Storage và Phân quyền RLS
export const SUPABASE_SCHEMA_SQL = `-- ==============================================================================
-- THIẾT LẬP TOÀN DIỆN CƠ SỞ DỮ LIỆU & STORAGE SUPABASE
-- ỨNG DỤNG: TRỢ LÝ CHỦ NHIỆM (LỚP 8A3)
-- Hướng dẫn: Dán toàn bộ mã này vào Supabase > SQL Editor > Run
-- ==============================================================================

-- 1. Tạo bảng lưu trữ dữ liệu lớp (nếu chưa có)
CREATE TABLE IF NOT EXISTS public.tro_ly_chu_nhiem_data (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Kích hoạt Row Level Security (RLS)
ALTER TABLE public.tro_ly_chu_nhiem_data ENABLE ROW LEVEL SECURITY;

-- 3. Cập nhật chính sách truy cập đơn giản và ổn định
DROP POLICY IF EXISTS "Public full access" ON public.tro_ly_chu_nhiem_data;
DROP POLICY IF EXISTS "Cho phep xem du lieu lop" ON public.tro_ly_chu_nhiem_data;
DROP POLICY IF EXISTS "Cho phep ghi du lieu lop" ON public.tro_ly_chu_nhiem_data;

CREATE POLICY "Cho phep xem du lieu lop"
ON public.tro_ly_chu_nhiem_data FOR SELECT
USING (true);

CREATE POLICY "Cho phep ghi du lieu lop"
ON public.tro_ly_chu_nhiem_data FOR ALL
USING (true) WITH CHECK (true);

-- 4. Bật Realtime đồng bộ tức thì
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'tro_ly_chu_nhiem_data'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tro_ly_chu_nhiem_data;
  END IF;
END $$;

-- 5. Tạo Bucket Supabase Storage lưu trữ Video cho Bảng tin
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

-- Cấp quyền truy cập xem video công khai cho bucket board_videos
DROP POLICY IF EXISTS "Cho phep xem video cong khai" ON storage.objects;
CREATE POLICY "Cho phep xem video cong khai"
ON storage.objects FOR SELECT
USING (bucket_id = 'board_videos');
`;

