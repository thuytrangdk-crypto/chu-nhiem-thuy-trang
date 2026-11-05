import React, { useState, useMemo } from 'react';
import {
  Megaphone,
  Plus,
  Trash2,
  Edit2,
  Trophy,
  Calendar,
  Sparkles,
  ArrowDown,
  Info,
  AlertTriangle,
  Award,
  Grid3X3,
  Flame,
  UserCheck,
  Image as ImageIcon,
  X,
  GraduationCap,
  BookOpen,
  ExternalLink,
  Play,
  FileText,
  ChevronLeft,
  ChevronRight,
  Video as VideoIcon,
  Film,
  Search,
  Pin,
} from 'lucide-react';
import { AppState, BoardNotice, NoticeType, SeatingLayout } from '../types';
import {
  calculateStudentPoints,
  formatDisplayDate,
  getCurrentMonthStr,
  triggerConfetti,
  formatFileSize,
} from '../utils/helpers';
import { getTop5AcademicHonors } from '../utils/academicHelpers';
import {
  getYouTubeEmbedUrl,
  getGoogleDriveVideoEmbed,
  isDirectVideoFile,
  sanitizeUrl,
  extractDomain,
} from '../utils/mediaHelpers';
import { supabaseService } from '../services/supabaseService';
import { BoardNoticeModal } from './BoardNoticeModal';
import { ConfirmModal } from './ConfirmModal';
import { SeatingChartView } from './SeatingChartView';

interface BoardViewProps {
  state: AppState;
  onAddNotice: (notice: Omit<BoardNotice, 'id'>) => void;
  onDeleteNotice: (noticeId: string) => void;
  onUpdateNotice?: (notice: BoardNotice) => void;
  onUpdateSeatingChart: (newChart: Record<string, string>) => void;
  onUpdateSeatingLayout?: (layout: SeatingLayout) => void;
  onSelectStudent: (studentId: string, month?: string) => void;
  isTeacher: boolean;
  currentStudentId?: string | null;
  initialTab?: 'notices' | 'seating' | 'rankings';
  onPublishHonors?: (month: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
  onOpenSupabaseModal?: () => void;
}

export const BoardView: React.FC<BoardViewProps> = ({
  state,
  onAddNotice,
  onDeleteNotice,
  onUpdateNotice,
  onUpdateSeatingChart,
  onUpdateSeatingLayout,
  onSelectStudent,
  isTeacher,
  currentStudentId,
  initialTab,
  onPublishHonors,
  onShowToast,
  onOpenSupabaseModal,
}) => {
  const [boardSubTab, setBoardSubTab] = useState<'notices' | 'seating' | 'rankings'>(
    initialTab || 'notices'
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [noticeToEdit, setNoticeToEdit] = useState<BoardNotice | null>(null);
  const [noticeToDelete, setNoticeToDelete] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{
    images: string[];
    index: number;
    title: string;
  } | null>(null);

  const [noticeSearch, setNoticeSearch] = useState('');
  const [noticeCategoryFilter, setNoticeCategoryFilter] = useState<string>('all');

  const NOTICE_CATEGORIES = [
    { id: 'all', label: 'Tất cả' },
    { id: 'general', label: 'Thông tin chung' },
    { id: 'study', label: 'Kế hoạch học tập' },
    { id: 'activity', label: 'Hoạt động ngoại khóa' },
    { id: 'warning', label: 'Nhắc nhở' },
    { id: 'reward', label: 'Khen thưởng' },
  ];

  React.useEffect(() => {
    if (initialTab) {
      setBoardSubTab(initialTab);
    }
  }, [initialTab]);

  const loggedStudent = useMemo(() => {
    if (!currentStudentId) return null;
    return state.students.find((s) => s.id === currentStudentId) || null;
  }, [state.students, currentStudentId]);

  const [selY, selM] = selectedMonth.split('-');
  const monthDisplay = `Tháng ${Number(selM)}/${selY}`;

  // Kiểm tra trạng thái công bố vinh danh Top 5 tháng này
  const currentAnnouncement = useMemo(() => {
    return (state.academicAnnouncements || []).find(
      (a) =>
        a.className === state.config.className &&
        a.schoolYear === state.config.schoolYear &&
        a.month === selectedMonth
    );
  }, [state.academicAnnouncements, state.config.className, state.config.schoolYear, selectedMonth]);

  const isHonorsPublished = currentAnnouncement?.isPublished ?? false;

  // TOP 5 HỌC TẬP: Dùng duy nhất điểm trung bình cộng học tập của tháng đang chọn
  // Tối đa 5 học sinh, bằng điểm cùng thứ hạng, sắp ổn định theo mã hồ sơ
  const topAcademicStudents = useMemo(() => {
    return getTop5AcademicHonors(
      state.students,
      state.config.className,
      state.config.schoolYear,
      selectedMonth,
      state.academicGrades || [],
      state.config.subjects || [],
      state.config.evaluationSubjects || []
    );
  }, [
    state.students,
    state.config.className,
    state.config.schoolYear,
    selectedMonth,
    state.academicGrades,
    state.config.subjects,
    state.config.evaluationSubjects,
  ]);

  // Danh sách học sinh cần cố gắng về thi đua/nề nếp trong tháng
  const bottomStudents = useMemo(() => {
    const baseScore = state.config.initialPoints ?? 100;
    const scores = state.students.map((student) => {
      const monthDiscipline = state.discipline.filter(
        (d) => d.studentId === student.id && d.date.startsWith(selectedMonth)
      );

      const summary = calculateStudentPoints(monthDiscipline, baseScore);

      return {
        id: student.id,
        name: student.name,
        avatar: student.avatar,
        points: summary.remainingPoints,
        totalMinus: summary.totalMinus,
      };
    });

    return [...scores]
      .filter((s) => s.totalMinus > 0 || s.points < baseScore)
      .sort((a, b) => a.points - b.points)
      .slice(0, 5);
  }, [state.students, state.discipline, selectedMonth, state.config.initialPoints]);

  const filteredNotices = useMemo(() => {
    const query = noticeSearch.trim().toLowerCase();
    return [...state.boardNotices]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .filter((notice) => {
        if (query) {
          const matchTitle = notice.title?.toLowerCase().includes(query);
          const matchContent = notice.content?.toLowerCase().includes(query);
          const matchLink = notice.linkTitle?.toLowerCase().includes(query);
          if (!matchTitle && !matchContent && !matchLink) return false;
        }

        if (noticeCategoryFilter === 'all') return true;
        const t = (notice.title || '').toLowerCase();
        const c = (notice.content || '').toLowerCase();

        if (noticeCategoryFilter === 'reward') {
          return notice.type === 'success' || t.includes('khen') || t.includes('giải') || t.includes('thành tích') || c.includes('khen thưởng');
        }
        if (noticeCategoryFilter === 'warning') {
          return notice.type === 'warning' || t.includes('nhắc nhở') || t.includes('chú ý') || t.includes('lưu ý') || c.includes('nhắc nhở');
        }
        if (noticeCategoryFilter === 'study') {
          return t.includes('học tập') || t.includes('kế hoạch') || t.includes('lịch thi') || t.includes('ôn tập') || t.includes('kiểm tra') || c.includes('học tập') || c.includes('lịch thi');
        }
        if (noticeCategoryFilter === 'activity') {
          return t.includes('hoạt động') || t.includes('ngoại khóa') || t.includes('phong trào') || t.includes('văn hóa') || t.includes('hồ chí minh') || c.includes('hoạt động') || c.includes('ngoại khóa');
        }
        if (noticeCategoryFilter === 'general') {
          return notice.type === 'info' || (!t.includes('học tập') && !t.includes('khen'));
        }

        return true;
      });
  }, [state.boardNotices, noticeSearch, noticeCategoryFilter]);

  const handleSaveNotice = (
    title: string,
    content: string,
    type: NoticeType,
    noticeId?: string,
    date?: string,
    image?: string,
    images?: string[],
    videoUrl?: string,
    linkUrl?: string,
    linkTitle?: string,
    videoName?: string,
    videoSize?: number,
    videoStoragePath?: string
  ) => {
    const noticeDate = date || new Date().toISOString().split('T')[0];
    if (noticeId && noticeToEdit && onUpdateNotice) {
      onUpdateNotice({
        ...noticeToEdit,
        title,
        content,
        type,
        date: noticeDate,
        image,
        images,
        videoUrl,
        linkUrl,
        linkTitle,
        videoName,
        videoSize,
        videoStoragePath,
      });
      onShowToast?.('Đã thay đổi thông tin đã đăng thành công');
    } else {
      onAddNotice({
        date: noticeDate,
        title,
        content,
        type,
        image,
        images,
        videoUrl,
        linkUrl,
        linkTitle,
        videoName,
        videoSize,
        videoStoragePath,
      });
      onShowToast?.('Đã đăng thông tin mới lên bảng tin');
    }
    setNoticeToEdit(null);
    setIsNoticeModalOpen(false);
  };

  const handleCelebrate = () => {
    triggerConfetti();
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto h-full flex flex-col pb-10 animate-fadeIn">
      {/* Student Welcome & Quick Actions Banner */}
      {!isTeacher && loggedStudent && (
        <div className="bg-gradient-to-r from-[#781C2B] via-[#922235] to-[#233146] rounded-3xl p-4 sm:p-5 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-[#781C2B]/40">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-lg shadow-inner overflow-hidden border border-white/30 text-white">
              {loggedStudent.avatar ? (
                <img
                  src={loggedStudent.avatar}
                  alt={loggedStudent.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                loggedStudent.name.charAt(0)
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#F5EDEB] text-[#922235] border border-[#E8DEDA]">
                  Học sinh Lớp {state.config.className}
                </span>
                <span className="text-xs text-[#F5EDEB] font-medium">Năm học {state.config.schoolYear}</span>
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight mt-0.5 uppercase drop-shadow-2xs">
                {loggedStudent.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectStudent(loggedStudent.id)}
              className="px-4 py-2 bg-[#F5EDEB] text-[#233146] hover:bg-white font-bold rounded-xl text-xs sm:text-sm shadow-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border border-[#E8DEDA]"
            >
              <UserCheck className="w-4 h-4 text-[#922235]" />
              <span>Xem Hồ sơ của tôi</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab Switcher at the top of Board */}
      <div className="bg-white p-2 rounded-2xl shadow-xs border border-[#E8DEDA] flex items-center justify-between gap-2 overflow-x-auto shrink-0">
        <div className="flex gap-1.5">
          <button
            onClick={() => setBoardSubTab('notices')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              boardSubTab === 'notices'
                ? 'bg-[#922235] text-white shadow-xs font-black'
                : 'text-[#233146] hover:bg-[#F5EDEB] hover:text-[#922235]'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            <span>Bảng tin Thông báo</span>
          </button>

          <button
            onClick={() => setBoardSubTab('seating')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              boardSubTab === 'seating'
                ? 'bg-[#922235] text-white shadow-xs font-black'
                : 'text-[#233146] hover:bg-[#F5EDEB] hover:text-[#922235]'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
            <span>Sơ đồ lớp</span>
          </button>

          <button
            onClick={() => setBoardSubTab('rankings')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              boardSubTab === 'rankings'
                ? 'bg-[#922235] text-white shadow-xs font-black'
                : 'text-[#233146] hover:bg-[#F5EDEB] hover:text-[#922235]'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Vinh danh &amp; Thi đua</span>
          </button>
        </div>

        {boardSubTab === 'notices' && isTeacher && (
          <button
            onClick={() => {
              setNoticeToEdit(null);
              setIsNoticeModalOpen(true);
            }}
            className="px-4 py-2 bg-[#922235] hover:bg-[#781C2B] text-white font-bold rounded-xl text-xs sm:text-sm shadow-md flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Đăng thông tin mới</span>
          </button>
        )}
      </div>

      {/* VIEW 1: SEATING CHART */}
      {boardSubTab === 'seating' && (
        <SeatingChartView
          state={state}
          onUpdateSeatingChart={onUpdateSeatingChart}
          onUpdateSeatingLayout={onUpdateSeatingLayout}
          onSelectStudent={onSelectStudent}
          isTeacher={isTeacher}
          currentStudentId={currentStudentId}
          onShowToast={onShowToast}
        />
      )}

      {/* VIEW 2: NOTICES */}
      {boardSubTab === 'notices' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
          {/* Announcements (2 Cols) */}
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-xs border border-[#E8DEDA] flex flex-col overflow-hidden h-full">
            <div className="p-4 sm:p-5 border-b border-[#E8DEDA] bg-[#F5EDEB]/60 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#F5EDEB] text-[#922235] border border-[#E8DEDA] flex items-center justify-center shadow-2xs">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#233146] text-base">
                    Trang thông tin &amp; Bảng tin Lớp {state.config.className}
                  </h3>
                  <p className="text-xs text-[#697589]">
                    Các thông báo, kế hoạch và nhắc nhở từ GVCN đến lớp
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gray-50/30">
              {state.boardNotices.length === 0 ? (
                <div className="text-center text-gray-400 py-16 flex flex-col items-center">
                  <Megaphone className="w-12 h-12 text-gray-200 mb-3" />
                  <p className="text-base font-semibold text-gray-600">
                    Chưa có thông tin hoặc thông báo nào
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {isTeacher
                      ? 'Bấm "Đăng thông tin mới" để gửi thông báo đầu tiên cho lớp.'
                      : 'Hiện chưa có thông báo mới từ GVCN.'}
                  </p>
                </div>
              ) : (
                [...state.boardNotices]
                  .sort(
                    (a, b) =>
                      new Date(b.date).getTime() - new Date(a.date).getTime()
                  )
                  .map((notice) => {
                    const titleLower = (notice.title || '').toLowerCase();
                    const contentLower = (notice.content || '').toLowerCase();
                    const isCompetition =
                      titleLower.includes('thi đua') || contentLower.includes('thi đua');
                    const isReward =
                      notice.type === 'success' ||
                      titleLower.includes('khen') ||
                      titleLower.includes('giải') ||
                      titleLower.includes('thành tích') ||
                      contentLower.includes('khen thưởng');
                    const isWarning =
                      notice.type === 'warning' ||
                      titleLower.includes('nhắc nhở') ||
                      titleLower.includes('chú ý') ||
                      titleLower.includes('lưu ý');

                    let borderStyle = 'border-l-4 border-l-[#922235] bg-white border-[#E8DEDA]';
                    let icon = <Info className="w-4 h-4 text-[#922235]" />;
                    let tagBg = 'bg-[#F5EDEB] text-[#233146] border border-[#E8DEDA]';
                    let tagText = 'Thông tin';

                    if (isCompetition) {
                      borderStyle = 'border-l-4 border-l-[#781C2B] bg-white border-[#E8DEDA]';
                      icon = <Trophy className="w-4 h-4 text-[#781C2B]" />;
                      tagBg = 'bg-[#F5EDEB] text-[#781C2B] border border-[#E8DEDA]';
                      tagText = 'Thi đua';
                    } else if (isReward) {
                      borderStyle = 'border-l-4 border-l-[#922235] bg-white border-[#E8DEDA]';
                      icon = <Sparkles className="w-4 h-4 text-[#922235]" />;
                      tagBg = 'bg-[#F5EDEB] text-[#922235] border border-[#E8DEDA]';
                      tagText = 'Khen thưởng';
                    } else if (isWarning) {
                      borderStyle = 'border-l-4 border-l-[#C0603A] bg-white border-[#E8DEDA]';
                      icon = <AlertTriangle className="w-4 h-4 text-[#C0603A]" />;
                      tagBg = 'bg-orange-50 text-[#C0603A] border border-orange-200';
                      tagText = 'Nhắc nhở';
                    }

                    return (
                      <div
                        key={notice.id}
                        className={`p-5 rounded-2xl shadow-xs border relative transition-all ${borderStyle}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            {icon}
                            <h4 className="font-bold text-[#233146] text-sm sm:text-base break-words">
                              {notice.title}
                            </h4>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${tagBg}`}
                            >
                              {tagText}
                            </span>

                            {isTeacher && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNoticeToEdit(notice);
                                    setIsNoticeModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-[#F5EDEB] hover:bg-[#E8DEDA] text-[#233146] text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer border border-[#E8DEDA] shadow-2xs"
                                  title="Chỉnh sửa hoặc thay đổi thông tin đã đăng"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-[#233146]" />
                                  <span>Thay đổi</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setNoticeToDelete(notice.id)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-[#922235] text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer border border-rose-200/80 shadow-2xs"
                                  title="Xóa thông tin đã đăng"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Xóa</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <p className="text-xs sm:text-sm text-[#233146]/90 whitespace-pre-wrap leading-relaxed">
                          {notice.content}
                        </p>

                        {/* Attached Multimedia (Multiple images, Video, or Link) */}
                        {(() => {
                          const noticeImages =
                            notice.images && notice.images.length > 0
                              ? notice.images
                              : notice.image
                              ? [notice.image]
                              : [];
                          const ytEmbed = notice.videoUrl
                            ? getYouTubeEmbedUrl(notice.videoUrl)
                            : null;
                          const driveEmbed = notice.videoUrl
                            ? getGoogleDriveVideoEmbed(notice.videoUrl)
                            : null;
                          const isDirectVideo = notice.videoUrl
                            ? isDirectVideoFile(notice.videoUrl)
                            : false;

                          return (
                            <div className="space-y-3">
                              {/* 1. Multiple Images Gallery */}
                              {noticeImages.length === 1 && (
                                <div className="mt-3.5 overflow-hidden rounded-2xl border border-gray-200/80 bg-slate-900/5 group/img relative max-h-72">
                                  <img
                                    src={noticeImages[0]}
                                    alt={notice.title}
                                    className="w-full max-h-72 object-cover sm:object-contain cursor-pointer transition-transform duration-200 group-hover/img:scale-[1.01]"
                                    onClick={() =>
                                      setLightbox({
                                        images: noticeImages,
                                        index: 0,
                                        title: notice.title,
                                      })
                                    }
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setLightbox({
                                        images: noticeImages,
                                        index: 0,
                                        title: notice.title,
                                      })
                                    }
                                    className="absolute bottom-2.5 right-2.5 px-2.5 py-1 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white text-[11px] font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer opacity-90 hover:opacity-100 transition-opacity"
                                  >
                                    <ImageIcon className="w-3.5 h-3.5" />
                                    <span>Phóng to ảnh</span>
                                  </button>
                                </div>
                              )}

                              {noticeImages.length === 2 && (
                                <div className="mt-3.5 grid grid-cols-2 gap-2">
                                  {noticeImages.map((imgSrc, idx) => (
                                    <div
                                      key={idx}
                                      onClick={() =>
                                        setLightbox({
                                          images: noticeImages,
                                          index: idx,
                                          title: notice.title,
                                        })
                                      }
                                      className="rounded-2xl overflow-hidden border border-gray-200/80 bg-slate-900/5 aspect-4/3 relative group/img cursor-pointer"
                                    >
                                      <img
                                        src={imgSrc}
                                        alt={`${notice.title} ${idx + 1}`}
                                        className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-200"
                                      />
                                      <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold rounded-lg opacity-90">
                                        Ảnh {idx + 1}/2
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {noticeImages.length === 3 && (
                                <div className="mt-3.5 grid grid-cols-3 gap-2">
                                  {noticeImages.map((imgSrc, idx) => (
                                    <div
                                      key={idx}
                                      onClick={() =>
                                        setLightbox({
                                          images: noticeImages,
                                          index: idx,
                                          title: notice.title,
                                        })
                                      }
                                      className="rounded-2xl overflow-hidden border border-gray-200/80 bg-slate-900/5 aspect-square relative group/img cursor-pointer"
                                    >
                                      <img
                                        src={imgSrc}
                                        alt={`${notice.title} ${idx + 1}`}
                                        className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-200"
                                      />
                                      <span className="absolute bottom-2 right-2 px-1.5 py-0.2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold rounded">
                                        {idx + 1}/3
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {noticeImages.length >= 4 && (
                                <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  {noticeImages.slice(0, 4).map((imgSrc, idx) => {
                                    const isFourth = idx === 3;
                                    const extraCount = noticeImages.length - 4;
                                    return (
                                      <div
                                        key={idx}
                                        onClick={() =>
                                          setLightbox({
                                            images: noticeImages,
                                            index: idx,
                                            title: notice.title,
                                          })
                                        }
                                        className="rounded-2xl overflow-hidden border border-gray-200/80 bg-slate-900/5 aspect-square relative group/img cursor-pointer"
                                      >
                                        <img
                                          src={imgSrc}
                                          alt={`${notice.title} ${idx + 1}`}
                                          className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-200"
                                        />
                                        {isFourth && extraCount > 0 ? (
                                          <div className="absolute inset-0 bg-black/60 backdrop-blur-2xs flex flex-col items-center justify-center text-white font-black text-sm hover:bg-black/70 transition-colors">
                                            <span>+{extraCount} ảnh</span>
                                            <span className="text-[10px] font-normal text-slate-200">
                                              Xem tất cả ({noticeImages.length})
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold rounded">
                                            #{idx + 1}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* 2. Embedded Video */}
                              {notice.videoUrl && (
                                <div className="mt-3.5 rounded-2xl overflow-hidden border border-gray-200/80 bg-black shadow-xs">
                                  {ytEmbed ? (
                                    <div className="aspect-video w-full">
                                      <iframe
                                        src={ytEmbed}
                                        title={notice.title}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        className="w-full h-full border-0"
                                      />
                                    </div>
                                  ) : driveEmbed ? (
                                    <div className="aspect-video w-full">
                                      <iframe
                                        src={driveEmbed}
                                        title={notice.title}
                                        allow="autoplay"
                                        allowFullScreen
                                        className="w-full h-full border-0"
                                      />
                                    </div>
                                  ) : isDirectVideo ? (
                                    <div className="bg-black">
                                      {notice.videoName && (
                                        <div className="px-3.5 py-1.5 bg-slate-900 text-white text-[11px] font-semibold flex items-center justify-between border-b border-white/10">
                                          <span className="truncate max-w-xs sm:max-w-md flex items-center gap-1.5">
                                            <Film className="w-3.5 h-3.5 text-[#EBC9B9]" />
                                            <span>{notice.videoName}</span>
                                          </span>
                                          {notice.videoSize && (
                                            <span className="text-[10px] text-slate-300 font-mono">
                                              {formatFileSize(notice.videoSize)}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      <video
                                        src={sanitizeUrl(notice.videoUrl)}
                                        controls
                                        playsInline
                                        preload="metadata"
                                        className="w-full max-h-96 bg-black object-contain"
                                      />
                                    </div>
                                  ) : (
                                    <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                                          <Play className="w-4 h-4 text-white" />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-white truncate">
                                            Video đính kèm thông báo
                                          </p>
                                          <p className="text-[11px] text-slate-300 truncate">
                                            {notice.videoName || notice.videoUrl}
                                          </p>
                                        </div>
                                      </div>
                                      <a
                                        href={sanitizeUrl(notice.videoUrl)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-1.5 bg-[#922235] hover:bg-[#781C2B] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer shadow-2xs"
                                      >
                                        <span>Xem video</span>
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* 3. Attached Web Link */}
                              {notice.linkUrl && (
                                <div className="mt-3.5 p-3 rounded-2xl bg-[#F5EDEB]/60 border border-[#E8DEDA] flex items-center justify-between gap-3 hover:bg-[#F5EDEB] transition-colors">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-[#F5EDEB] text-[#922235] border border-[#E8DEDA] flex items-center justify-center shrink-0 shadow-2xs">
                                      <ExternalLink className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-black text-[#233044] truncate">
                                        {notice.linkTitle || extractDomain(notice.linkUrl)}
                                      </p>
                                      <p className="text-[11px] text-[#922235] font-medium truncate">
                                        {notice.linkUrl}
                                      </p>
                                    </div>
                                  </div>
                                  <a
                                    href={sanitizeUrl(notice.linkUrl)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 bg-[#922235] hover:bg-[#781C2B] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                                  >
                                    <span>Mở liên kết</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        <div className="mt-3 pt-2.5 border-t border-[#E8DEDA] flex items-center justify-between text-[11px] text-[#697589]">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Ngày đăng: {formatDisplayDate(notice.date)}
                          </span>
                          <span className="font-bold text-[#922235]">GVCN Lớp {state.config.className}</span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* Quick Honors Widget on right */}
          <div className="bg-white rounded-3xl shadow-xs border border-[#E8DEDA] p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#E8DEDA]">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-[#922235]" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-[#233146] text-sm">
                        TOP 5 HỌC TẬP
                      </h4>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                          isHonorsPublished
                            ? 'bg-[#F5EDEB] text-[#781C2B] border-[#E8DEDA]'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {isHonorsPublished ? 'Đã công bố' : 'Bản nháp'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#697589]">
                      {monthDisplay} • ĐTB cao nhất
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setBoardSubTab('rankings')}
                  className="text-xs text-[#922235] font-bold hover:text-[#781C2B] hover:underline cursor-pointer"
                >
                  Xem bảng vàng
                </button>
              </div>

              {!isTeacher && !isHonorsPublished ? (
                <div className="py-6 px-3 text-center bg-amber-50/50 rounded-2xl border border-amber-100">
                  <p className="text-xs font-semibold text-amber-800">
                    Bản nháp (Đang cập nhật)
                  </p>
                  <p className="text-[11px] text-amber-600 mt-1">
                    Bảng xếp hạng Top 5 sẽ hiển thị sau khi GVCN công bố vinh danh.
                  </p>
                </div>
              ) : topAcademicStudents.length === 0 ? (
                <p className="text-xs text-[#697589] italic text-center py-6">
                  Chưa có dữ liệu học tập để xếp hạng
                </p>
              ) : (
                <ul className="space-y-2">
                  {topAcademicStudents.map((s) => (
                    <li
                      key={s.studentId}
                      onClick={() => onSelectStudent(s.studentId, selectedMonth)}
                      className="flex items-center gap-2.5 p-2 rounded-xl bg-[#FFF8F4] hover:bg-[#F5EDEB] border border-[#E8DEDA] transition-colors cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#922235] text-white font-black flex items-center justify-center text-xs shrink-0 shadow-2xs">
                        {s.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-[#233146] uppercase block leading-tight truncate">
                          {s.name}
                        </span>
                        <span className="text-[10px] text-[#697589] block truncate">
                          {s.validSubjectsCount} môn có điểm
                        </span>
                      </div>
                      <span className="text-xs font-black text-[#922235] bg-[#F5EDEB] px-2 py-0.5 rounded-md border border-[#E8DEDA] shrink-0">
                        ĐTB: {s.formattedAverage}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-6 p-4 rounded-2xl bg-gradient-to-br from-[#781C2B] via-[#922235] to-[#233146] text-white shadow-md border border-[#781C2B]/40">
              <p className="font-bold text-xs uppercase mb-1">
                Sơ đồ chỗ ngồi lớp
              </p>
              <p className="text-[11px] text-white/80 leading-relaxed">
                Đã xếp vị trí bàn học cho {state.students.length} học sinh trong lớp.
              </p>
              <button
                onClick={() => setBoardSubTab('seating')}
                className="mt-3 px-3 py-2 bg-white text-[#922235] hover:bg-[#FFF8F4] font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors w-full"
              >
                Mở sơ đồ chỗ ngồi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: RANKINGS (FULL) */}
      {boardSubTab === 'rankings' && (
        <div className="bg-white rounded-3xl shadow-xs border border-[#E8DEDA] p-6 flex flex-col space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#E8DEDA] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#F5EDEB] text-[#922235] border border-[#E8DEDA] flex items-center justify-center">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[#233146] text-base">
                  Bảng Vàng Vinh Danh &amp; Thi Đua Rèn Luyện
                </h3>
                <p className="text-xs text-[#697589]">
                  Thống kê kết quả thi đua theo tháng
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="border border-[#E8DEDA] rounded-xl px-3 py-2 text-xs font-bold text-[#233146] bg-white cursor-pointer outline-none focus:ring-2 focus:ring-[#922235] shadow-2xs"
              />
              <button
                onClick={handleCelebrate}
                className="px-3.5 py-2 rounded-xl bg-[#F5EDEB] hover:bg-[#E8DEDA] text-[#922235] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-[#E8DEDA]"
                title="Bắn pháo hoa chúc mừng"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#922235]" />
                <span>Chúc mừng</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* TOP 5 HỌC TẬP */}
            <div className="bg-[#F5EDEB]/50 rounded-2xl p-5 border border-[#E8DEDA]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-[#E8DEDA]/70">
                <div>
                  <h4 className="text-xs font-black text-[#922235] uppercase tracking-wider flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-[#922235]" /> TOP 5 HỌC TẬP
                  </h4>
                  <p className="text-[11px] text-[#697589] mt-0.5">
                    {monthDisplay} • Năm học {state.config.schoolYear}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                      isHonorsPublished
                        ? 'bg-[#F5EDEB] text-[#781C2B] border-[#E8DEDA]'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}
                  >
                    {isHonorsPublished ? 'Đã công bố vinh danh' : 'Bản nháp'}
                  </span>

                  {isTeacher && onPublishHonors && (
                    <button
                      type="button"
                      onClick={() => onPublishHonors(selectedMonth)}
                      className="px-2.5 py-1 bg-[#922235] hover:bg-[#781C2B] text-white font-bold rounded-lg text-xs shadow-xs cursor-pointer flex items-center gap-1 transition-all"
                    >
                      <Trophy className="w-3 h-3" />
                      <span>{isHonorsPublished ? 'Cập nhật công bố' : 'Công bố vinh danh'}</span>
                    </button>
                  )}
                </div>
              </div>

              {!isTeacher && !isHonorsPublished ? (
                <div className="py-10 px-4 text-center bg-amber-50/80 rounded-xl border border-amber-200">
                  <p className="text-sm font-bold text-amber-900">
                    Bản nháp: Bảng xếp hạng đang được GVCN tổng hợp
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Kết quả vinh danh Top 5 của {monthDisplay} sẽ được hiển thị ngay sau khi giáo viên chủ nhiệm phê duyệt và bấm công bố.
                  </p>
                </div>
              ) : topAcademicStudents.length === 0 ? (
                <p className="text-xs text-[#697589] italic text-center py-8">
                  Chưa có dữ liệu học tập để xếp hạng
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {topAcademicStudents.map((s) => (
                    <li
                      key={s.studentId}
                      onClick={() => onSelectStudent(s.studentId, selectedMonth)}
                      className="flex items-center gap-3 bg-white p-3 rounded-xl border border-[#E8DEDA] shadow-2xs hover:shadow-xs transition-shadow cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-full bg-[#922235] text-white font-black flex items-center justify-center text-xs shrink-0 shadow-2xs">
                        {s.rank}
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-[#F5EDEB] text-[#922235] border border-[#E8DEDA] flex items-center justify-center text-xs font-bold shrink-0">
                        {s.avatar ? (
                          <img src={s.avatar} alt="" className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          s.name.charAt(0)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs sm:text-sm font-bold text-[#233044] uppercase block truncate leading-tight">
                          {s.name}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-[#697589]">
                          <span className="font-mono">Mã HS: {s.studentId}</span>
                          <span>•</span>
                          <span className="text-[#922235] font-medium">
                            {s.validSubjectsCount} môn có điểm
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#922235] bg-[#F5EDEB] px-2.5 py-1 rounded-lg border border-[#E8DEDA] shadow-2xs">
                          ĐTB: {s.formattedAverage}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Cần cố gắng hơn */}
            <div className="bg-rose-50/40 rounded-2xl p-5 border border-rose-100">
              <h4 className="text-xs font-black text-rose-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                <ArrowDown className="w-4 h-4 text-rose-600" /> Cần Cố Gắng Hơn (Điểm thi đua còn lại thấp)
              </h4>

              {bottomStudents.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-8">
                  Tuyệt vời! Không có học sinh bị trừ điểm trong tháng này.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {bottomStudents.map((s) => (
                    <li
                      key={s.id}
                      onClick={() => onSelectStudent(s.id)}
                      className="flex items-center gap-3 bg-white p-3 rounded-xl border border-rose-100 shadow-2xs hover:shadow-xs transition-shadow cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-700 font-black flex items-center justify-center text-xs">
                        !
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-[#F5EDEB] text-[#233146] border border-[#E8DEDA] flex items-center justify-center text-xs font-bold shrink-0">
                        {s.name.charAt(0)}
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-[#233044] uppercase flex-1 break-words leading-tight">
                        {s.name}
                      </span>
                      <div className="flex items-center gap-2">
                        {s.totalMinus > 0 && (
                          <span className="text-[11px] font-bold text-rose-500 hidden sm:inline">
                            -{s.totalMinus}đ vi phạm
                          </span>
                        )}
                        <span className="text-xs font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                          Còn {s.points}đ
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <BoardNoticeModal
        isOpen={isNoticeModalOpen}
        initialNotice={noticeToEdit}
        onSave={handleSaveNotice}
        onDelete={(id) => {
          setIsNoticeModalOpen(false);
          setNoticeToDelete(id);
        }}
        onClose={() => {
          setIsNoticeModalOpen(false);
          setNoticeToEdit(null);
        }}
        isTeacher={isTeacher}
        onOpenSupabaseModal={onOpenSupabaseModal}
      />

      <ConfirmModal
        isOpen={!!noticeToDelete}
        title="Xóa thông tin đã đăng"
        message="Bạn có chắc chắn muốn xóa bài đăng thông báo này khỏi bảng tin lớp không? Nếu bài đăng có video lưu trên Cloud, tệp video cũng sẽ được giải phóng."
        confirmText="Xóa thông tin"
        onConfirm={() => {
          if (noticeToDelete) {
            const targetNotice = state.boardNotices.find((n) => n.id === noticeToDelete);
            if (targetNotice?.videoStoragePath) {
              supabaseService.deleteBoardVideo(targetNotice.videoStoragePath);
            }
            onDeleteNotice(noticeToDelete);
            setNoticeToDelete(null);
          }
        }}
        onCancel={() => setNoticeToDelete(null)}
      />

      {/* Multi-Image Interactive Lightbox Modal */}
      {lightbox && lightbox.images.length > 0 && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-5xl max-h-[92vh] w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar inside modal */}
            <div className="w-full flex items-center justify-between text-white pb-3 px-2">
              <div className="min-w-0">
                <p className="text-sm font-black truncate">{lightbox.title}</p>
                <p className="text-xs text-slate-300 font-medium">
                  Ảnh {lightbox.index + 1} trên {lightbox.images.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2 transition-colors cursor-pointer"
                title="Đóng xem ảnh"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main Image Container */}
            <div className="relative w-full flex items-center justify-center max-h-[76vh] overflow-hidden rounded-2xl bg-black/40">
              <img
                src={lightbox.images[lightbox.index]}
                alt={`${lightbox.title} #${lightbox.index + 1}`}
                className="max-w-full max-h-[76vh] object-contain rounded-xl shadow-2xl"
              />

              {/* Prev Button */}
              {lightbox.images.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setLightbox((prev) =>
                      prev
                        ? {
                            ...prev,
                            index:
                              (prev.index - 1 + prev.images.length) %
                              prev.images.length,
                          }
                        : null
                    )
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 text-white p-2.5 rounded-full backdrop-blur-xs transition-all cursor-pointer shadow-lg hover:scale-105"
                  title="Ảnh trước"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              {/* Next Button */}
              {lightbox.images.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setLightbox((prev) =>
                      prev
                        ? {
                            ...prev,
                            index: (prev.index + 1) % prev.images.length,
                          }
                        : null
                    )
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 text-white p-2.5 rounded-full backdrop-blur-xs transition-all cursor-pointer shadow-lg hover:scale-105"
                  title="Ảnh tiếp theo"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* Thumbnail Navigation Bar for multi-images */}
            {lightbox.images.length > 1 && (
              <div className="flex items-center gap-2 mt-3 overflow-x-auto max-w-full py-1 px-2 custom-scrollbar">
                {lightbox.images.map((thumbSrc, thumbIdx) => (
                  <button
                    key={thumbIdx}
                    type="button"
                    onClick={() =>
                      setLightbox((prev) =>
                        prev ? { ...prev, index: thumbIdx } : null
                      )
                    }
                    className={`w-13 h-13 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                      lightbox.index === thumbIdx
                        ? 'border-[#38bdf8] scale-105 shadow-md'
                        : 'border-white/30 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={thumbSrc}
                      alt={`Thumbnail ${thumbIdx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
