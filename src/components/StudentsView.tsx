import React, { useState, useMemo } from 'react';
import {
  Search,
  List,
  LayoutGrid,
  FileSpreadsheet,
  UserPlus,
  Edit2,
  Trash2,
  Download,
  AlertTriangle,
  Award,
  Phone,
  FolderOpen,
  Lock,
  UserCheck,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { AppState, Gender, Student } from '../types';
import {
  exportStudentsToExcel,
  formatDisplayDate,
  formatStudentCode,
  getTodayStr,
} from '../utils/helpers';
import { StudentFormModal } from './StudentFormModal';
import { ExcelImportModal } from './ExcelImportModal';
import { ConfirmModal } from './ConfirmModal';
import { EmulationExportModal } from './EmulationExportModal';
import { StudentPasswordBatchModal } from './StudentPasswordBatchModal';
import { ResetStudentPasswordModal } from './ResetStudentPasswordModal';

interface StudentsViewProps {
  state: AppState;
  onSelectStudent: (studentId: string) => void;
  onAddStudent: (newStudent: Partial<Student>) => void;
  onUpdateStudent: (student: Partial<Student>) => void;
  onDeleteStudent: (studentId: string) => void;
  onBatchImportStudents: (newStudents: Student[], mode?: 'append' | 'replace') => void;
  onBatchUpdateStudentPasswords?: (updatedStudents: Student[]) => void;
  onResetStudentPassword?: (studentId: string, newPassword: string) => void;
  onRemoveSampleStudents?: () => void;
  onClearAllStudents?: () => void;
  isTeacher: boolean;
  currentStudentId?: string | null;
  onShowToast?: (msg: string, type?: 'success' | 'error') => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  state,
  onSelectStudent,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onBatchImportStudents,
  onBatchUpdateStudentPasswords,
  onResetStudentPassword,
  onRemoveSampleStudents,
  onClearAllStudents,
  isTeacher,
  currentStudentId,
  onShowToast,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | Gender>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [isExcelOpen, setIsExcelOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isConfirmClearAllOpen, setIsConfirmClearAllOpen] = useState(false);
  const [isEmulationExportOpen, setIsEmulationExportOpen] = useState(false);
  const [isBatchPasswordModalOpen, setIsBatchPasswordModalOpen] = useState(false);
  const [studentToResetPassword, setStudentToResetPassword] = useState<{
    student: Student;
    index: number;
  } | null>(null);

  // Detect initial 8 sample students
  const sampleStudentIds = useMemo(
    () =>
      new Set([
        '15052012',
        '20082012',
        '10112012',
        '03022012',
        '18092012',
        '25122012',
        '09042012',
        '14072012',
      ]),
    []
  );

  const sampleStudentsCount = useMemo(() => {
    return state.students.filter((s) => sampleStudentIds.has(s.id)).length;
  }, [state.students, sampleStudentIds]);

  const realStudentsCount = state.students.length - sampleStudentsCount;

  const today = getTodayStr();

  const handleStudentClick = (studentId: string) => {
    if (isTeacher || studentId === currentStudentId) {
      onSelectStudent(studentId);
    } else {
      onShowToast?.('Bảo mật: Bạn chỉ có quyền xem chi tiết hồ sơ của chính mình!', 'error');
    }
  };

  // Filtered & sorted students
  const filteredStudents = useMemo(() => {
    let result = [...state.students];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          (s.phone && s.phone.includes(q)) ||
          (s.parentName && s.parentName.toLowerCase().includes(q)) ||
          (s.address && s.address.toLowerCase().includes(q))
      );
    }

    if (genderFilter !== 'all') {
      result = result.filter((s) => s.gender === genderFilter);
    }

    // Sort by Vietnamese first name (last word)
    return result.sort((a, b) => {
      const nameA = a.name.trim().split(' ').pop() || '';
      const nameB = b.name.trim().split(' ').pop() || '';
      return nameA.localeCompare(nameB, 'vi');
    });
  }, [state.students, searchTerm, genderFilter]);

  const handleOpenAdd = () => {
    setStudentToEdit(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (student: Student, e: React.MouseEvent) => {
    e.stopPropagation();
    setStudentToEdit(student);
    setIsFormOpen(true);
  };

  const handleOpenDelete = (student: Student, e: React.MouseEvent) => {
    e.stopPropagation();
    setStudentToDelete(student);
  };

  const handleConfirmDelete = () => {
    if (studentToDelete) {
      onDeleteStudent(studentToDelete.id);
      setStudentToDelete(null);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto h-full flex flex-col pb-10 animate-fadeIn">
      {/* Top Toolbar: Two responsive tiers to prevent overflow */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl shadow-xs border border-[#E8DEDA] shrink-0 space-y-3">
        {/* Tier 1: Search, Gender Filter, View Mode, Count Badge */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#697589]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên học sinh, mã HS, số điện thoại, mã ID..."
              className="w-full pl-10 pr-8 py-2 bg-[#FFF8F4]/60 border border-[#E8DEDA] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#922235] focus:border-[#922235] focus:bg-white transition-all text-xs sm:text-sm font-medium text-[#233146]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold p-1 cursor-pointer"
                title="Xóa tìm kiếm"
              >
                ✕
              </button>
            )}
          </div>

          {/* Gender Filter */}
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value as 'all' | Gender)}
            className="px-3 py-2 bg-white border border-[#E8DEDA] rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#922235] focus:border-[#922235] font-medium text-[#233146] cursor-pointer"
          >
            <option value="all">Tất cả giới tính</option>
            <option value="Nam">Nam</option>
            <option value="Nữ">Nữ</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex bg-[#F5EDEB] rounded-xl p-0.5 border border-[#E8DEDA] shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white shadow-xs text-[#922235] font-black'
                  : 'text-[#697589] hover:text-[#233146]'
              }`}
              title="Dạng thẻ (Grid)"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white shadow-xs text-[#922235] font-black'
                  : 'text-[#697589] hover:text-[#233146]'
              }`}
              title="Dạng bảng (List)"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Total Students Badge */}
          <div className="px-3 py-1.5 bg-[#F5EDEB] text-[#922235] rounded-xl text-xs font-black border border-[#E8DEDA] whitespace-nowrap sm:ml-auto">
            Tổng: {state.students.length} HS
          </div>
        </div>

        {/* Tier 2: Action Buttons Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E8DEDA]/60">
          <div className="flex flex-wrap items-center gap-2">
            {/* Export Excel */}
            <button
              type="button"
              onClick={() => exportStudentsToExcel(state.students, state.config.className)}
              className="px-3 py-2 bg-[#FFF8F4] hover:bg-[#F5EDEB] text-[#233146] font-bold rounded-xl text-xs border border-[#E8DEDA] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Xuất danh sách học sinh ra file Excel"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất Excel</span>
            </button>

            {isTeacher && (
              <>
                {/* Mật khẩu khởi tạo 8A3 */}
                <button
                  type="button"
                  onClick={() => setIsBatchPasswordModalOpen(true)}
                  className="px-3 py-2 bg-[#F5EDEB] hover:bg-[#E8DEDA] text-[#922235] font-bold rounded-xl text-xs border border-[#E8DEDA] flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  title="Cập nhật mật khẩu khởi tạo chuẩn 10 số (Mã HS 2 số + Ngày sinh ddmmyyyy) cho lớp 8A3"
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#922235]" />
                  <span>Mật khẩu khởi tạo 8A3</span>
                </button>

                {/* Xuất Excel thi đua */}
                <button
                  type="button"
                  onClick={() => setIsEmulationExportOpen(true)}
                  className="px-3 py-2 bg-[#F5EDEB] hover:bg-[#E8DEDA] text-[#922235] font-bold rounded-xl text-xs border border-[#E8DEDA] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title="Xuất Excel thi đua cho toàn bộ học sinh của lớp đang chọn"
                >
                  <Award className="w-3.5 h-3.5 text-[#922235]" />
                  <span>Xuất Excel thi đua</span>
                </button>

                {/* Import Excel */}
                <button
                  type="button"
                  onClick={() => setIsExcelOpen(true)}
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs border border-emerald-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title="Nhập danh sách học sinh từ file Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Nhập Excel</span>
                </button>
              </>
            )}
          </div>

          {/* Right Group: Clear All & Add Student */}
          <div className="flex items-center gap-2 ml-auto">
            {isTeacher && state.students.length > 0 && onClearAllStudents && (
              <button
                type="button"
                onClick={() => setIsConfirmClearAllOpen(true)}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs border border-rose-200 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Xóa toàn bộ danh sách lớp"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Làm sạch lớp</span>
              </button>
            )}

            {isTeacher && (
              <button
                type="button"
                onClick={handleOpenAdd}
                className="px-4 py-2 bg-[#922235] hover:bg-[#781C2B] text-white font-bold rounded-xl text-xs sm:text-sm shadow-md hover:shadow-[#922235]/25 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Thêm HS</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* BANNER THÔNG BÁO VÀ NÚT LỌC SẠCH 8 HỌC SINH MẪU (NẾU ĐANG LẪN VÀO LỚP) */}
      {sampleStudentsCount > 0 && realStudentsCount > 0 && isTeacher && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-fadeIn">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-200">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-amber-950 uppercase tracking-wide flex items-center gap-2 flex-wrap">
                <span>Phát hiện {sampleStudentsCount} học sinh mẫu ban đầu đang lẫn trong danh sách</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-200 text-amber-900 border border-amber-300">
                  Lớp hiện có {state.students.length} HS
                </span>
              </h4>
              <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                Danh sách hiện gồm <strong>{realStudentsCount} học sinh thực tế của lớp</strong> và <strong>{sampleStudentsCount} học sinh mẫu</strong> mặc định (Nguyễn Văn An, Trần Thị Bình...). Bấm nút bên cạnh để xóa bỏ ngay 8 học sinh mẫu và chỉ giữ đúng {realStudentsCount} học sinh của lớp.
              </p>
            </div>
          </div>
          {onRemoveSampleStudents && (
            <button
              type="button"
              onClick={onRemoveSampleStudents}
              className="px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-2xl text-xs sm:text-sm shadow-md transition-all shrink-0 cursor-pointer flex items-center gap-2 whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4" />
              <span>Xóa sạch 8 học sinh mẫu (Chỉ giữ {realStudentsCount} HS của lớp)</span>
            </button>
          )}
        </div>
      )}

      {/* Main Content: List or Grid */}
      <div className="flex-1 overflow-y-auto bg-white rounded-3xl shadow-xs border border-[#E8DEDA] p-4 relative min-h-[400px]">
        {filteredStudents.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
            <FolderOpen className="w-16 h-16 text-[#E8DEDA] mb-3" />
            <p className="text-base font-semibold text-[#233146]">
              Không tìm thấy học sinh nào
            </p>
            <p className="text-xs text-[#697589] mt-1">
              Thử tìm kiếm với từ khóa khác hoặc bấm "Thêm HS" để tạo mới.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {filteredStudents.map((s, index) => {
              const vios = state.discipline.filter(
                (d) => d.studentId === s.id && d.type === 'minus'
              ).length;
              const rews = state.discipline.filter(
                (d) => d.studentId === s.id && d.type === 'plus'
              ).length;

              const attToday = state.attendance.find(
                (a) => a.studentId === s.id && a.date === today
              );

              const isSelf = s.id === currentStudentId;
              const studentCodeDisplay = formatStudentCode(s.studentCode, index + 1);

              return (
                <div
                  key={s.id}
                  onClick={() => handleStudentClick(s.id)}
                  className={`bg-white border rounded-2xl p-4 flex flex-col items-center text-center transition-all cursor-pointer relative group overflow-hidden ${
                    isSelf
                      ? 'border-emerald-400 ring-2 ring-emerald-200/70 shadow-sm'
                      : !isTeacher
                      ? 'border-[#E8DEDA] hover:border-[#922235]/40'
                      : 'border-[#E8DEDA] hover:border-[#922235] hover:shadow-md'
                  }`}
                >
                  {/* Student Code Badge (Top-Right) */}
                  <div className="absolute top-2 right-2">
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[#F5EDEB] text-[#922235] text-[10px] font-black border border-[#E8DEDA] font-mono shadow-2xs"
                      title={`Mã học sinh lớp 8A3: ${studentCodeDisplay}`}
                    >
                      #{studentCodeDisplay}
                    </span>
                  </div>

                  {/* Student Mode Badge: Self vs Classmate (Top-Left) */}
                  {!isTeacher && (
                    <div className="absolute top-2 left-2">
                      {isSelf ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-extrabold shadow-2xs">
                          <UserCheck className="w-3 h-3 text-emerald-600" /> Bạn
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-semibold" title="Chỉ xem thông tin cơ bản">
                          <Lock className="w-2.5 h-2.5 text-gray-400" />
                        </span>
                      )}
                    </div>
                  )}

                  {/* Warning banner if high violations (Teacher only) */}
                  {isTeacher && vios >= 2 && (
                    <div
                      className="absolute top-0 right-10 bg-rose-600 text-white p-1 rounded-bl-xl text-[10px]"
                      title="Nhiều vi phạm"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                  )}

                  {/* Avatar */}
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl mb-3 shadow-xs overflow-hidden group-hover:scale-105 transition-transform ${
                    isSelf ? 'bg-emerald-50 border-2 border-emerald-200 text-emerald-700' : 'bg-[#F5EDEB] border-2 border-[#E8DEDA] text-[#922235]'
                  }`}>
                    {s.avatar ? (
                      <img
                        src={s.avatar}
                        alt={s.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      s.name.charAt(0)
                    )}
                  </div>

                  {/* Name */}
                  <h4
                    className="font-bold text-[#233146] text-xs sm:text-sm mb-1 group-hover:text-[#922235] transition-colors uppercase w-full min-h-[2.5rem] flex items-center justify-center text-center break-words leading-snug px-1"
                    title={s.name}
                  >
                    {s.name}
                  </h4>

                  <div className="text-[11px] text-[#697589] mb-2 flex items-center justify-center gap-1.5 flex-wrap">
                    <span
                      className={`font-semibold ${
                        s.gender === 'Nam' ? 'text-blue-600' : 'text-pink-600'
                      }`}
                    >
                      {s.gender}
                    </span>
                    <span className="text-[#E8DEDA]">•</span>
                    <span>{formatDisplayDate(s.dob)}</span>
                  </div>

                  {/* Quick Teacher Actions on Card */}
                  {isTeacher && (
                    <div className="w-full flex items-center justify-center gap-1.5 mb-2 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStudentToResetPassword({ student: s, index: index + 1 });
                        }}
                        className="p-1 px-2 rounded-lg bg-[#F5EDEB] hover:bg-[#E8DEDA] text-[#922235] text-[10px] font-bold border border-[#E8DEDA] flex items-center gap-1 transition-colors cursor-pointer"
                        title="Đặt lại mật khẩu cho học sinh này"
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>Đặt lại MK</span>
                      </button>
                    </div>
                  )}

                  {/* Attendance status today */}
                  <div className="mt-auto w-full pt-2.5 border-t border-[#E8DEDA] flex items-center justify-between text-[11px]">
                    <div className="font-semibold">
                      {attToday?.status === 'c' && (
                        <span className="text-emerald-600">Có mặt</span>
                      )}
                      {attToday?.status === 'v' && (
                        <span className="text-blue-600">Có phép</span>
                      )}
                      {attToday?.status === 'kp' && (
                        <span className="text-rose-600 font-bold">Không phép</span>
                      )}
                      {attToday?.status === 'm' && (
                        <span className="text-amber-600 font-bold">Muộn</span>
                      )}
                      {!attToday && <span className="text-gray-400">Chưa ĐD</span>}
                    </div>

                    <div className="flex items-center gap-1.5 font-bold">
                      {rews > 0 && (
                        <span className="text-emerald-600 flex items-center gap-0.5" title="Khen thưởng">
                          <Award className="w-3 h-3" /> {rews}
                        </span>
                      )}
                      {vios > 0 && (
                        <span className="text-rose-600 flex items-center gap-0.5" title="Vi phạm">
                          <AlertTriangle className="w-3 h-3" /> {vios}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead className="bg-[#F5EDEB]/60 border-b border-[#E8DEDA]">
                <tr>
                  <th className="px-3 py-3 font-bold text-[#697589] uppercase tracking-wider w-12 text-center">
                    STT
                  </th>
                  <th className="px-3 py-3 font-bold text-[#922235] uppercase tracking-wider w-20 text-center">
                    Mã HS
                  </th>
                  <th className="px-4 py-3 font-bold text-[#697589] uppercase tracking-wider">
                    Học sinh
                  </th>
                  <th className="px-4 py-3 font-bold text-[#697589] uppercase tracking-wider w-24">
                    Giới tính
                  </th>
                  <th className="px-4 py-3 font-bold text-[#697589] uppercase tracking-wider w-32">
                    Ngày sinh
                  </th>
                  <th className="px-4 py-3 font-bold text-[#697589] uppercase tracking-wider hidden md:table-cell">
                    Phụ huynh &amp; Liên hệ
                  </th>
                  {isTeacher && (
                    <th className="px-4 py-3 font-bold text-[#697589] uppercase tracking-wider w-36 text-center">
                      Thao tác
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DEDA] bg-white">
                {filteredStudents.map((s, index) => {
                  const isSelf = s.id === currentStudentId;
                  const studentCodeDisplay = formatStudentCode(s.studentCode, index + 1);
                  return (
                    <tr
                      key={s.id}
                      onClick={() => handleStudentClick(s.id)}
                      className={`transition-colors cursor-pointer group ${
                        isSelf
                          ? 'bg-emerald-50/60 hover:bg-emerald-100/50'
                          : 'hover:bg-[#F5EDEB]/40'
                      }`}
                    >
                      <td className="px-3 py-3 text-center text-[#697589] font-semibold group-hover:text-[#922235]">
                        {index + 1}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-[#F5EDEB] text-[#922235] font-mono font-black text-xs border border-[#E8DEDA] shadow-2xs">
                          {studentCodeDisplay}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 overflow-hidden ${
                            isSelf ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-300' : 'bg-[#F5EDEB] text-[#922235]'
                          }`}>
                            {s.avatar ? (
                              <img
                                src={s.avatar}
                                alt={s.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              s.name.charAt(0)
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-[#233146] group-hover:text-[#922235] uppercase flex items-center gap-1.5">
                              <span>{s.name}</span>
                              {!isTeacher && isSelf && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                  <UserCheck className="w-3 h-3" /> Bạn
                                </span>
                              )}
                              {!isTeacher && !isSelf && (
                                <span title="Hồ sơ riêng tư">
                                  <Lock className="w-3 h-3 text-gray-300" />
                                </span>
                              )}
                            </p>
                            <span className="text-[10px] text-[#697589] font-mono">
                              ID: {s.id}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-semibold ${
                            s.gender === 'Nam' ? 'text-blue-600' : 'text-pink-600'
                          }`}
                        >
                          {s.gender}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#233146]">
                        {formatDisplayDate(s.dob)}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {isTeacher || isSelf ? (
                          <>
                            <p className="text-[#233146] font-medium">
                              {s.parentName || '-'}
                            </p>
                            {s.phone && (
                              <p className="text-[#697589] text-xs flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3 text-[#697589]" /> {s.phone}
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400 italic text-xs">Riêng tư (Chỉ GV &amp; Bạn)</span>
                        )}
                      </td>
                    {isTeacher && (
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStudentToResetPassword({ student: s, index: index + 1 });
                            }}
                            className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-[#F5EDEB] text-gray-400 hover:text-[#922235] flex items-center justify-center transition-colors cursor-pointer"
                            title="Đặt lại mật khẩu cho học sinh"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleOpenEdit(s, e)}
                            className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-blue-50 text-gray-400 hover:text-blue-600 flex items-center justify-center transition-colors cursor-pointer"
                            title="Chỉnh sửa thông tin"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleOpenDelete(s, e)}
                            className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-rose-50 text-gray-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                            title="Xóa học sinh"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <StudentFormModal
        isOpen={isFormOpen}
        studentToEdit={studentToEdit}
        existingStudents={state.students}
        onSave={(data) => {
          if (studentToEdit) {
            onUpdateStudent(data);
          } else {
            onAddStudent(data);
          }
        }}
        onClose={() => setIsFormOpen(false)}
      />

      <ExcelImportModal
        isOpen={isExcelOpen}
        existingStudents={state.students}
        onImport={(newStudents, mode) => {
          onBatchImportStudents(newStudents, mode);
        }}
        onClose={() => setIsExcelOpen(false)}
      />

      <ConfirmModal
        isOpen={!!studentToDelete}
        title="Xác nhận xóa học sinh"
        message={`Bạn có chắc muốn xóa học sinh "${studentToDelete?.name}"? Mọi thông tin điểm số, điểm danh và vi phạm của học sinh này sẽ bị xóa vĩnh viễn.`}
        confirmText="Xóa học sinh"
        onConfirm={handleConfirmDelete}
        onCancel={() => setStudentToDelete(null)}
      />

      <ConfirmModal
        isOpen={isConfirmClearAllOpen}
        title="Xác nhận làm sạch toàn bộ danh sách lớp"
        message={`Bạn có chắc chắn muốn xóa toàn bộ ${state.students.length} học sinh hiện tại khỏi lớp không? Hành động này sẽ làm trống danh sách để bạn có thể tải lên file Excel mới tinh từ đầu.`}
        confirmText="Xác nhận xóa tất cả"
        onConfirm={() => {
          onClearAllStudents?.();
          setIsConfirmClearAllOpen(false);
        }}
        onCancel={() => setIsConfirmClearAllOpen(false)}
      />

      {/* Emulation Excel Export Modal */}
      <EmulationExportModal
        isOpen={isEmulationExportOpen}
        state={state}
        onClose={() => setIsEmulationExportOpen(false)}
        onShowToast={onShowToast}
      />

      {/* Batch 10-Digit Password Update Modal for 8A3 */}
      <StudentPasswordBatchModal
        isOpen={isBatchPasswordModalOpen}
        className={state.config.className || '8A3'}
        students={state.students}
        onConfirmBatchUpdate={(updatedStudents) => {
          onBatchUpdateStudentPasswords?.(updatedStudents);
        }}
        onClose={() => setIsBatchPasswordModalOpen(false)}
      />

      {/* Individual Student Password Reset Modal */}
      <ResetStudentPasswordModal
        isOpen={!!studentToResetPassword}
        student={studentToResetPassword?.student || null}
        fallbackIndex={studentToResetPassword?.index}
        onConfirmReset={(studentId, newPassword) => {
          onResetStudentPassword?.(studentId, newPassword);
          setStudentToResetPassword(null);
        }}
        onClose={() => setStudentToResetPassword(null)}
      />
    </div>
  );
};
