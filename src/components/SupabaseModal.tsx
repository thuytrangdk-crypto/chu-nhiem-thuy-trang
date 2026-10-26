import React, { useState } from 'react';
import {
  X,
  Database,
  Cloud,
  Check,
  Copy,
  RefreshCw,
  AlertTriangle,
  UploadCloud,
  DownloadCloud,
  ExternalLink,
  Code2,
} from 'lucide-react';
import { SUPABASE_CONFIG, SUPABASE_SCHEMA_SQL, SUPABASE_STORAGE_SQL } from '../supabaseClient';
import { SyncStatus } from '../services/supabaseService';

interface SupabaseModalProps {
  isOpen: boolean;
  syncStatus: SyncStatus;
  onCheckConnection: () => void;
  onSyncNow: () => void;
  onPullRemote: () => void;
  onClose: () => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({
  isOpen,
  syncStatus,
  onCheckConnection,
  onSyncNow,
  onPullRemote,
  onClose,
}) => {
  const [copiedType, setCopiedType] = useState<'all' | 'storage' | null>(null);
  const [selectedSqlTab, setSelectedSqlTab] = useState<'all' | 'storage'>('all');

  if (!isOpen) return null;

  const handleCopySql = (type: 'all' | 'storage') => {
    const textToCopy = type === 'all' ? SUPABASE_SCHEMA_SQL : SUPABASE_STORAGE_SQL;
    navigator.clipboard.writeText(textToCopy);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 bg-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                Kết nối Cơ sở dữ liệu Supabase
              </h3>
              <p className="text-xs text-gray-400">
                Đồng bộ hóa dữ liệu thời gian thực lên máy chủ đám mây
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 text-gray-400 flex items-center justify-center cursor-pointer border border-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Connection Status Box */}
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              syncStatus.isTableReady
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-amber-50/70 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  syncStatus.isTableReady
                    ? 'bg-emerald-200/80 text-emerald-800'
                    : 'bg-amber-200/80 text-amber-800'
                }`}
              >
                {syncStatus.isTableReady ? (
                  <Cloud className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <p className="font-bold text-xs sm:text-sm">
                  {syncStatus.isTableReady
                    ? 'Đang kết nối & Đồng bộ trực tiếp với Supabase'
                    : 'Cần khởi tạo bảng dữ liệu trên Supabase'}
                </p>
                <p className="text-[11px] opacity-80 mt-0.5">
                  {syncStatus.isTableReady
                    ? `Lần đồng bộ gần nhất: ${syncStatus.lastSyncedAt || 'Vừa xong'}`
                    : 'Vui lòng chạy đoạn mã SQL bên dưới trong SQL Editor của Supabase để hoàn tất thiết lập.'}
                </p>
              </div>
            </div>

            <button
              onClick={onCheckConnection}
              className="px-3 py-1.5 bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 font-bold rounded-xl text-xs flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Kiểm tra lại</span>
            </button>
          </div>

          {/* Project Credentials */}
          <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-200 text-xs space-y-2">
            <div>
              <span className="text-gray-400 font-bold block mb-0.5">Project URL:</span>
              <code className="font-mono text-gray-800 bg-white px-2.5 py-1 rounded-lg border border-gray-200 block truncate font-semibold">
                {SUPABASE_CONFIG.url}
              </code>
            </div>
            <div>
              <span className="text-gray-400 font-bold block mb-0.5">Publishable Key:</span>
              <code className="font-mono text-gray-600 bg-white px-2.5 py-1 rounded-lg border border-gray-200 block truncate text-[11px]">
                {SUPABASE_CONFIG.key}
              </code>
            </div>
          </div>

          {/* SQL Setup Instructions (If table not created or for reference) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              {/* Tab Selector */}
              <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSelectedSqlTab('all')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    selectedSqlTab === 'all'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Toàn bộ (Bảng + Storage Video)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSqlTab('storage')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    selectedSqlTab === 'storage'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Chỉ riêng Supabase Storage Video
                </button>
              </div>

              <button
                onClick={() => handleCopySql(selectedSqlTab)}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedType === selectedSqlTab ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Đã sao chép!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép mã SQL đang chọn</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative">
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-44 border border-slate-800">
                {selectedSqlTab === 'all' ? SUPABASE_SCHEMA_SQL : SUPABASE_STORAGE_SQL}
              </pre>
            </div>

            <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-3.5 text-xs text-blue-900 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5">
                <span>Cách chạy trên Supabase (Khoảng 30 giây):</span>
              </p>
              <ol className="list-decimal list-inside space-y-1 text-blue-800 text-[11px]">
                <li>
                  Vào trang quản trị dự án trên{' '}
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-bold text-blue-900"
                  >
                    Supabase Dashboard <ExternalLink className="w-3 h-3 inline" />
                  </a>
                </li>
                <li>
                  Bấm vào mục <strong>SQL Editor</strong> ở thanh menu bên trái.
                </li>
                <li>
                  Bấm <strong>New query</strong>, dán đoạn mã vừa sao chép ở trên vào và bấm nút <strong>Run</strong>.
                </li>
                <li>
                  Sau khi chạy, bucket <code>board_videos</code> sẽ tự động sẵn sàng lưu trữ video tệp lớn (lên tới 100MB/tệp) và phát trực tiếp trên mọi thiết bị.
                </li>
              </ol>
            </div>
          </div>

          {/* Manual Sync Controls */}
          {syncStatus.isTableReady && (
            <div className="flex flex-wrap gap-2.5 pt-2">
              <button
                onClick={onSyncNow}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Đẩy dữ liệu hiện tại lên Cloud</span>
              </button>
              <button
                onClick={onPullRemote}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <DownloadCloud className="w-4 h-4" />
                <span>Tải dữ liệu từ Cloud về máy</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl text-xs cursor-pointer transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
