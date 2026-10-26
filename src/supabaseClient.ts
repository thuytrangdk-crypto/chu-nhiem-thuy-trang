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

// SQL script toàn diện thiết lập cả bảng dữ liệu và Storage
export const SUPABASE_SCHEMA_SQL = `-- Chạy đoạn mã này trong Supabase > SQL Editor > New query > Run
-- 1. Tạo bảng lưu trữ dữ liệu Trợ lý chủ nhiệm
CREATE TABLE IF NOT EXISTS public.tro_ly_chu_nhiem_data (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Kích hoạt RLS (Row Level Security) và cho phép truy cập
ALTER TABLE public.tro_ly_chu_nhiem_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access" ON public.tro_ly_chu_nhiem_data;
CREATE POLICY "Public full access"
ON public.tro_ly_chu_nhiem_data
FOR ALL
USING (true)
WITH CHECK (true);

-- 3. Bật Realtime để đồng bộ trực tiếp giữa các thiết bị/trình duyệt
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'tro_ly_chu_nhiem_data'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tro_ly_chu_nhiem_data;
  END IF;
END $$;

-- 4. Tạo Bucket Supabase Storage lưu trữ Video cho Bảng tin
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

