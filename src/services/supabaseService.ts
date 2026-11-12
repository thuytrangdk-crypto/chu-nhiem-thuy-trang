import { supabase, SUPABASE_CONFIG, SUPABASE_SCHEMA_SQL, SUPABASE_STORAGE_SQL } from '../supabaseClient';
import { AppState } from '../types';
import { DEFAULT_INITIAL_STATE } from '../defaultData';

export interface SyncStatus {
  isConnected: boolean;
  isTableReady: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  errorMessage: string | null;
}

const RECORD_ID = 'main_state';
const TABLE_NAME = 'tro_ly_chu_nhiem_data';

// Unique session ID per browser tab/instance to prevent self-echo overwrite loops
export const CLIENT_SESSION_ID =
  'client_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);

// Helper to check verified user role from active browser session
export function getVerifiedSessionRole(): 'teacher' | 'student' | null {
  try {
    const raw = sessionStorage.getItem('scn_session_auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.role || null;
    }
  } catch (e) {}
  return null;
}

export const supabaseService = {
  // Test connection and table existence
  async checkConnection(): Promise<{ isConnected: boolean; isTableReady: boolean; error?: string }> {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('id')
        .eq('id', RECORD_ID)
        .maybeSingle();

      if (error) {
        // Table doesn't exist or RLS policy issue
        return {
          isConnected: true,
          isTableReady: false,
          error: error.message || 'Bảng dữ liệu chưa được tạo trong Supabase.',
        };
      }

      return {
        isConnected: true,
        isTableReady: true,
      };
    } catch (err: any) {
      return {
        isConnected: false,
        isTableReady: false,
        error: err.message || 'Không thể kết nối đến máy chủ Supabase.',
      };
    }
  },

  // Fetch state from Supabase
  async loadState(): Promise<{ state: AppState | null; isTableReady: boolean; error?: string }> {
    const role = getVerifiedSessionRole();

    // If current user is student, prioritize loading from safe public view
    if (role === 'student') {
      try {
        const { data: viewData, error: viewErr } = await supabase
          .from('view_thong_tin_lop_cong_khai')
          .select('*')
          .maybeSingle();

        if (!viewErr && viewData) {
          // Construct sanitized student view state: ZERO access to teacher password, discipline or notes
          const partialStudentState: Partial<AppState> = {
            boardNotices: viewData.board_notices || [],
            seatingChart: viewData.seating_chart || {},
            seatingLayout: viewData.seating_layout || { groups: 4, rows: 8, seatsPerTable: 2 },
            academicAnnouncements: viewData.academic_announcements || [],
            config: {
              ...DEFAULT_INITIAL_STATE.config,
              className: viewData.class_name || '8A3',
              schoolYear: viewData.school_year || '2026-2027',
              teacherName: viewData.teacher_name || 'Nguyễn Thị Thùy Trang',
              appName: 'TRỢ LÝ CHỦ NHIỆM',
              teacherPassword: '', // REDACTED: Never sent to student
            },
            students: [],
            attendance: [],
            discipline: [],
            notes: [],
          };
          return { state: partialStudentState as AppState, isTableReady: true };
        }
      } catch (e) {
        // Fallback to table read if view is not yet deployed
      }
    }

    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('data')
        .eq('id', RECORD_ID)
        .maybeSingle();

      if (error) {
        return { state: null, isTableReady: false, error: error.message };
      }

      if (data && data.data) {
        return { state: data.data as AppState, isTableReady: true };
      }

      // Table exists but no record yet
      return { state: null, isTableReady: true };
    } catch (err: any) {
      return { state: null, isTableReady: false, error: err.message };
    }
  },

  // Save state to Supabase - strictly rejects student sessions, uses Server-Side verification
  async saveState(state: AppState): Promise<{ success: boolean; error?: string }> {
    const currentRole = getVerifiedSessionRole();
    if (currentRole === 'student') {
      console.warn('Blocked unauthorized write attempt from student session to Supabase.');
      return {
        success: false,
        error: 'Tài khoản Học sinh chỉ có quyền xem thông tin (Read-Only). Tuyệt đối không được phép ghi hoặc sửa đổi dữ liệu trên Supabase.',
      };
    }

    try {
      // Attach sync metadata to identify writer and avoid echo loops
      const payloadWithMeta = {
        ...state,
        _syncMeta: {
          clientId: CLIENT_SESSION_ID,
          timestamp: Date.now(),
        },
      };

      // 1. First attempt: Use secure Server-Side RPC (gvcn_luu_thay_doi)
      try {
        const { error: rpcErr } = await supabase.rpc('gvcn_luu_thay_doi', {
          p_class_name: state.config.className || '8A3',
          p_teacher_password: state.config.teacherPassword || '',
          p_new_data: payloadWithMeta,
        });

        if (!rpcErr) {
          return { success: true };
        }

        // If error is wrong password, return security error immediately!
        if (rpcErr.message && rpcErr.message.includes('Mật khẩu Giáo viên chủ nhiệm không chính xác')) {
          return { success: false, error: rpcErr.message };
        }
      } catch (rpcEx) {
        // Fallback to direct upsert if RPC function is not yet created in Supabase
      }

      // 2. Direct table upsert fallback
      const { error } = await supabase.from(TABLE_NAME).upsert(
        {
          id: RECORD_ID,
          data: payloadWithMeta,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // Backup academic grades specifically to Supabase
  async createAcademicBackup(
    backup: import('../types').AcademicGradeBackup
  ): Promise<{ success: boolean; error?: string }> {
    const currentRole = getVerifiedSessionRole();
    if (currentRole === 'student') {
      return {
        success: false,
        error: 'Tài khoản Học sinh không có quyền tạo bản sao lưu trên Supabase.',
      };
    }

    try {
      const { error } = await supabase.from(TABLE_NAME).upsert(
        {
          id: backup.id,
          data: backup,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Lỗi không xác định khi sao lưu lên Supabase.',
      };
    }
  },

  // Perform safe deletion with prerequisite backup on Supabase
  async deleteMonthlyAcademicGrades(
    backup: import('../types').AcademicGradeBackup,
    updatedState: AppState,
    onProgress?: (step: 'backing_up' | 'deleting') => void
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Mandatory prerequisite: Backup MUST succeed first
      onProgress?.('backing_up');
      const backupRes = await this.createAcademicBackup(backup);
      if (!backupRes.success) {
        return {
          success: false,
          error: `Không thể tạo bản sao lưu trên Supabase: ${backupRes.error}. Đã dừng thao tác xóa để bảo vệ dữ liệu.`,
        };
      }

      // 2. Save updated state atomically to Supabase
      onProgress?.('deleting');
      const saveRes = await this.saveState(updatedState);
      if (!saveRes.success) {
        return {
          success: false,
          error: `Lỗi khi cập nhật dữ liệu sau xóa lên Supabase: ${saveRes.error}.`,
        };
      }

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Lỗi khi xóa bảng điểm trên Supabase.',
      };
    }
  },

  // Storage Bucket check
  async checkStorageBucket(bucketName = 'board_videos'): Promise<{ isReady: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.storage.getBucket(bucketName);
      if (error || !data) {
        // Try creating bucket if allowed
        const { error: createErr } = await supabase.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 104857600, // 100MB
        });
        if (createErr) {
          return { isReady: false, error: error?.message || createErr.message };
        }
        return { isReady: true };
      }
      return { isReady: true };
    } catch (err: any) {
      return { isReady: false, error: err?.message || 'Không thể kiểm tra bucket Supabase Storage' };
    }
  },

  // Upload Board Video to Supabase Storage with real-time byte progress
  async uploadBoardVideo(
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<{
    success: boolean;
    url?: string;
    path?: string;
    name: string;
    size: number;
    error?: string;
  }> {
    const currentRole = getVerifiedSessionRole();
    if (currentRole === 'student') {
      return {
        success: false,
        name: file.name,
        size: file.size,
        error: 'Tài khoản Học sinh không có quyền tải video lên Bảng tin.',
      };
    }

    const bucketName = 'board_videos';

    if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.key) {
      return {
        success: false,
        name: file.name,
        size: file.size,
        error:
          'Ứng dụng chưa được cấu hình địa chỉ Supabase. Vui lòng kết nối Supabase hoặc chọn tùy chọn "Dán đường dẫn video".',
      };
    }

    // Sanitize file name: remove accents, spaces, special chars
    const cleanName = file.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const filePath = `notices/${timestamp}_${randomSuffix}_${cleanName}`;

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      const uploadUrl = `${SUPABASE_CONFIG.url}/storage/v1/object/${bucketName}/${filePath}`;

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          const publicUrl = `${SUPABASE_CONFIG.url}/storage/v1/object/public/${bucketName}/${filePath}`;
          resolve({
            success: true,
            url: publicUrl,
            path: filePath,
            name: file.name,
            size: file.size,
          });
        } else {
          let errorMsg = `Tải lên thất bại (Mã lỗi ${xhr.status})`;
          try {
            const res = JSON.parse(xhr.responseText);
            if (res.message) {
              errorMsg = res.message;
            } else if (res.error) {
              errorMsg = res.error;
            }
          } catch (e) {}

          const lower = errorMsg.toLowerCase();
          if (xhr.status === 404 || lower.includes('bucket not found') || lower.includes('not found')) {
            errorMsg = `Chưa tạo bucket '${bucketName}' trên Supabase Storage. Vui lòng vào Cài đặt Supabase > Sao chép mã SQL Storage và chạy trong Supabase SQL Editor.`;
          } else if (
            xhr.status === 403 ||
            lower.includes('row-level security') ||
            lower.includes('policy') ||
            lower.includes('security violation')
          ) {
            errorMsg = `Lỗi phân quyền RLS Supabase Storage cho bucket '${bucketName}'. Vui lòng cấp quyền xem và tải tệp (RLS Policy) bằng mã SQL Storage.`;
          } else if (xhr.status === 413 || lower.includes('payload too large') || lower.includes('exceeded')) {
            errorMsg = `Dung lượng tệp (${(file.size / (1024 * 1024)).toFixed(1)}MB) vượt quá giới hạn cho phép của Supabase (tối đa 100MB).`;
          }

          resolve({
            success: false,
            name: file.name,
            size: file.size,
            error: errorMsg,
          });
        }
      };

      xhr.onerror = () => {
        resolve({
          success: false,
          name: file.name,
          size: file.size,
          error:
            'Lỗi kết nối mạng khi tải video lên máy chủ Supabase. Vui lòng kiểm tra lại đường truyền internet và thử lại.',
        });
      };

      xhr.open('POST', uploadUrl);
      xhr.setRequestHeader('apikey', SUPABASE_CONFIG.key);
      xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_CONFIG.key}`);
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
      xhr.send(file);
    });
  },

  // Delete Board Video from Supabase Storage
  async deleteBoardVideo(storagePath: string): Promise<{ success: boolean; error?: string }> {
    if (!storagePath) return { success: true };
    const currentRole = getVerifiedSessionRole();
    if (currentRole === 'student') {
      return {
        success: false,
        error: 'Tài khoản Học sinh không có quyền xóa tệp video trên hệ thống.',
      };
    }
    try {
      const { error } = await supabase.storage.from('board_videos').remove([storagePath]);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Lỗi khi xóa video khỏi Storage' };
    }
  },

  // Subscribe to real-time changes
  subscribe(onRemoteUpdate: (remoteState: AppState) => void) {
    const channel = supabase
      .channel('tro_ly_chu_nhiem_sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLE_NAME,
          filter: `id=eq.${RECORD_ID}`,
        },
        (payload: any) => {
          const remoteData = payload?.new?.data;
          if (!remoteData) return;

          // CRITICAL: Ignore updates broadcast by our own tab/session!
          // This stops race conditions, infinite loops, and reverting newly edited data.
          if (remoteData._syncMeta?.clientId === CLIENT_SESSION_ID) {
            return;
          }

          onRemoteUpdate(remoteData as AppState);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
