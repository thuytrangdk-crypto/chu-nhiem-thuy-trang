import React, { useRef } from 'react';
import {
  LayoutDashboard,
  Megaphone,
  GraduationCap,
  CalendarCheck2,
  Settings,
  LogOut,
  X,
  Cloud,
  KeyRound,
  UserCheck,
  Grid3X3,
  BookOpen,
  ChevronDown,
  Camera,
} from 'lucide-react';
import { SyncStatus } from '../services/supabaseService';
import { resizeImageBase64 } from '../utils/helpers';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  className: string;
  classAvatar?: string;
  isTeacher?: boolean;
  studentName?: string;
  teacherName?: string;
  onUpdateClassAvatar?: (base64: string) => void;
  onOpenClassSwitch?: () => void;
  onLogout: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenSupabaseModal?: () => void;
  onOpenChangePassword?: () => void;
  onOpenMyProfile?: () => void;
  syncStatus?: SyncStatus;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  className,
  classAvatar,
  isTeacher = true,
  studentName,
  teacherName,
  onUpdateClassAvatar,
  onOpenClassSwitch,
  onLogout,
  isMobileOpen,
  onCloseMobile,
  onOpenSupabaseModal,
  onOpenChangePassword,
  onOpenMyProfile,
  syncStatus,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpdateClassAvatar) {
      resizeImageBase64(file, 300, 300, (base64) => {
        onUpdateClassAvatar(base64);
      });
    }
    e.target.value = '';
  };

  const teacherNavItems = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'board', label: 'Bảng tin & Sơ đồ lớp', icon: Megaphone },
    { id: 'students', label: 'Học sinh', icon: GraduationCap },
    { id: 'academics', label: 'Học tập', icon: BookOpen },
    { id: 'attendance', label: 'Điểm danh', icon: CalendarCheck2 },
  ];

  const studentNavItems = [
    { id: 'board_notices', label: 'Bảng tin thông báo', icon: Megaphone },
    { id: 'board_seating', label: 'Sơ đồ lớp học', icon: Grid3X3 },
    { id: 'profile', label: 'Hồ sơ của tôi', icon: UserCheck },
  ];

  const navItems = isTeacher ? teacherNavItems : studentNavItems;

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 md:hidden transition-opacity"
        />
      )}

      <aside
        className={`bg-[#233146] w-64 h-full border-r border-[#1B2737] flex flex-col fixed md:static z-50 transition-transform duration-300 shadow-2xl md:shadow-none shrink-0 text-white ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* APP INFO BLOCK AT TOP OF SIDEBAR */}
        <div className="p-4 border-b border-[#1B2737] shrink-0 bg-[#233146]">
          {/* Row 1: Logo + App Name + Close button on mobile */}
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                onClick={() => isTeacher && onUpdateClassAvatar && fileInputRef.current?.click()}
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden shadow-xs relative group ${
                  isTeacher && onUpdateClassAvatar ? 'cursor-pointer hover:ring-2 hover:ring-[#922235]' : ''
                }`}
                title={isTeacher && onUpdateClassAvatar ? 'Bấm để đổi ảnh đại diện lớp' : `Lớp ${className}`}
              >
                {classAvatar ? (
                  <img src={classAvatar} alt="Lớp" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#922235] via-[#A3283D] to-[#781C2B] flex items-center justify-center text-white shadow-inner">
                    <GraduationCap className="w-5 h-5 text-white stroke-[2.2]" />
                  </div>
                )}
                {isTeacher && onUpdateClassAvatar && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </div>
              {isTeacher && onUpdateClassAvatar && (
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/jpeg, image/png, image/webp"
                  onChange={handleAvatarFile}
                />
              )}

              <div className="min-w-0">
                <h1 className="text-xs font-black text-white tracking-tight uppercase leading-none truncate">
                  TRỢ LÝ CHỦ NHIỆM
                </h1>
                {/* Class selector */}
                {isTeacher && onOpenClassSwitch ? (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenClassSwitch();
                      onCloseMobile();
                    }}
                    className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white/10 hover:bg-white/15 active:bg-white/20 text-white font-bold text-[11px] border border-white/10 shadow-2xs transition-colors cursor-pointer"
                    title="Bấm để đổi lớp hoặc năm học"
                  >
                    <span>Lớp {className}</span>
                    <ChevronDown className="w-3 h-3 text-slate-300" />
                  </button>
                ) : (
                  <span className="mt-1.5 inline-flex items-center px-2.5 py-0.5 rounded-lg bg-white/10 text-white font-bold text-[11px] border border-white/10">
                    Lớp {className}
                  </span>
                )}
              </div>
            </div>

            {/* Close button on mobile */}
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              aria-label="Đóng menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Row 2: GVCN name */}
          <div className="text-[11px] font-semibold text-[#94A3B8] truncate flex items-center gap-1.5 mb-2.5 px-0.5">
            <span className="w-2 h-2 rounded-full bg-[#922235] shrink-0" />
            <span className="text-[#7A899E] font-medium">GVCN:</span>
            <span className="text-white font-bold truncate">
              {teacherName || 'Chưa thiết lập'}
            </span>
          </div>

          {/* Row 3: Supabase connection status pill */}
          <button
            type="button"
            onClick={() => {
              if (onOpenSupabaseModal) {
                onOpenSupabaseModal();
                onCloseMobile();
              }
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
              syncStatus?.isTableReady
                ? 'bg-[#1C2737] border-white/10 text-slate-200 hover:bg-[#202E42]'
                : syncStatus?.isConnected
                ? 'bg-amber-950/40 border-amber-600/40 text-amber-200 hover:bg-amber-900/50'
                : 'bg-rose-950/40 border-rose-600/40 text-rose-200 hover:bg-rose-900/50'
            }`}
            title="Bấm để kiểm tra đồng bộ Supabase Cloud"
          >
            <div className="flex items-center gap-1.5 truncate">
              <Cloud className="w-3.5 h-3.5 shrink-0 text-slate-300" />
              <span className="truncate">
                {syncStatus?.isTableReady
                  ? 'Supabase: Đã kết nối'
                  : syncStatus?.isConnected
                  ? 'Supabase: Cần tạo bảng'
                  : 'Supabase: Chưa kết nối'}
              </span>
            </div>
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                syncStatus?.isTableReady
                  ? 'bg-emerald-400 animate-pulse'
                  : syncStatus?.isConnected
                  ? 'bg-amber-400'
                  : 'bg-rose-400'
              }`}
            />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto pt-3 pb-4 px-3 space-y-1.5 custom-scrollbar">
          <div className="px-2 pt-1 pb-1 text-[11px] font-black text-[#7A899E] uppercase tracking-wider">
            {isTeacher ? 'Quản lý lớp học' : 'Lớp học'}
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentView === item.id ||
              (item.id === 'board_notices' && currentView === 'board') ||
              (item.id === 'board' &&
                (currentView === 'board' ||
                  currentView === 'board_notices' ||
                  currentView === 'board_seating'));
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  if (item.id === 'profile' && onOpenMyProfile) {
                    onOpenMyProfile();
                  }
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all text-left cursor-pointer group ${
                  isActive
                    ? 'bg-[#922235] text-white font-black shadow-md shadow-black/20'
                    : 'text-[#94A3B8] hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 ${
                    isActive ? 'text-white' : 'text-[#7A899E] group-hover:text-white'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}

          {/* Teacher Only System Section */}
          {isTeacher && (
            <>
              <div className="pt-4 pb-1 px-2 text-[11px] font-black text-[#7A899E] uppercase tracking-wider">
                Hệ thống
              </div>

              {onOpenChangePassword && (
                <button
                  onClick={() => {
                    onOpenChangePassword();
                    onCloseMobile();
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-[#94A3B8] hover:bg-white/10 hover:text-white transition-all text-left cursor-pointer group"
                  title="Đổi mật khẩu tài khoản giáo viên"
                >
                  <KeyRound className="w-4 h-4 text-[#7A899E] group-hover:text-white shrink-0" />
                  <span className="truncate">Đổi mật khẩu GV</span>
                </button>
              )}

              {onOpenSupabaseModal && (
                <button
                  onClick={() => {
                    onOpenSupabaseModal();
                    onCloseMobile();
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-[#94A3B8] hover:bg-white/10 hover:text-white transition-all text-left cursor-pointer group"
                  title="Cấu hình & Đồng bộ hóa Supabase Cloud"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Cloud className="w-4 h-4 text-[#7A899E] group-hover:text-white shrink-0" />
                    <span className="truncate">Supabase Cloud</span>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      syncStatus?.isTableReady
                        ? 'bg-emerald-400 animate-pulse'
                        : 'bg-amber-400'
                    }`}
                    title={
                      syncStatus?.isTableReady
                        ? 'Đã kết nối'
                        : 'Cần khởi tạo bảng'
                    }
                  />
                </button>
              )}

              <button
                onClick={() => {
                  onNavigate('settings');
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all text-left cursor-pointer group ${
                  currentView === 'settings'
                    ? 'bg-[#922235] text-white font-black shadow-md shadow-black/20'
                    : 'text-[#94A3B8] hover:bg-white/10 hover:text-white'
                }`}
              >
                <Settings
                  className={`w-4 h-4 shrink-0 ${
                    currentView === 'settings' ? 'text-white' : 'text-[#7A899E] group-hover:text-white'
                  }`}
                />
                <span className="truncate">Cài đặt</span>
              </button>
            </>
          )}
        </nav>

        {/* Footer with User info & Logout */}
        <div className="p-3.5 border-t border-[#1B2737] flex items-center justify-between shrink-0 bg-[#1C2737]/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#922235] text-white font-black flex items-center justify-center text-xs shrink-0 shadow-xs ring-1 ring-white/10">
              {isTeacher ? 'GV' : (studentName ? studentName.trim().charAt(0).toUpperCase() : 'HS')}
            </div>
            <div className="truncate min-w-0">
              <span className="text-xs font-black text-white block truncate leading-tight">
                {isTeacher ? 'Giáo viên' : studentName || 'Học sinh'}
              </span>
              <span className="text-[10px] text-[#94A3B8] block truncate">
                {isTeacher ? 'Quyền quản lý' : 'Xem tin & Lớp học'}
              </span>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-xs font-bold text-[#94A3B8] hover:text-rose-300 hover:bg-white/10 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shrink-0"
            title="Đăng xuất khỏi hệ thống"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Thoát</span>
          </button>
        </div>
      </aside>
    </>
  );
};
