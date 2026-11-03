import React, { useState } from 'react';
import {
  Calendar,
  CheckCheck,
  Save,
  Check,
  Mail,
  X as XIcon,
  Clock,
  UserX,
  Trash2,
} from 'lucide-react';
import { AppState, AttendanceStatus } from '../types';
import { getTodayStr } from '../utils/helpers';

interface AttendanceViewProps {
  state: AppState;
  onUpdateAttendanceStatus: (studentId: string, date: string, status: AttendanceStatus) => void;
  onMarkAllPresent: (date: string) => void;
  onDeleteAttendanceByDate?: (studentId: string, date: string) => void;
  onSaveNotice: () => void;
  onSelectStudent: (studentId: string) => void;
  isTeacher?: boolean;
  currentStudentId?: string | null;
  onShowToast?: (msg: string, type?: 'success' | 'error') => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  state,
  onUpdateAttendanceStatus,
  onMarkAllPresent,
  onDeleteAttendanceByDate,
  onSaveNotice,
  onSelectStudent,
  isTeacher = true,
  currentStudentId,
  onShowToast,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());

  const recordsForDate = state.attendance.filter((a) => a.date === selectedDate);
  const presentCount = recordsForDate.filter((a) => a.status === 'c').length;
  const permissionCount = recordsForDate.filter((a) => a.status === 'v').length;
  const unexcusedCount = recordsForDate.filter((a) => a.status === 'kp').length;
  const lateCount = recordsForDate.filter((a) => a.status === 'm').length;

  return (
    <div className="space-y-4 max-w-7xl mx-auto h-full flex flex-col pb-10 animate-fadeIn">
      {/* Top Bar: Date picker & Actions (Wrapped & Responsive) */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl shadow-xs border border-[#E9E2DF] shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Date picker */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center">
              <Calendar className="w-4 h-4 absolute left-3.5 text-[#8E2433] pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-10 pr-3 py-2 bg-[#FFF8F3]/60 border border-[#E9E2DF] rounded-xl font-bold text-xs sm:text-sm text-[#233044] focus:outline-none focus:ring-2 focus:ring-[#8E2433] focus:border-[#8E2433] cursor-pointer"
              />
            </div>
            <span className="text-xs text-[#6B7280] hidden sm:inline">
              Chọn ngày điểm danh
            </span>
          </div>

          {/* Center: Stats badges */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            <span className="px-2.5 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200">
              Có mặt: <strong>{presentCount}</strong>
            </span>
            <span className="px-2.5 py-1.5 bg-[#FAF0EE] text-[#8E2433] rounded-xl border border-[#EBC9B9]">
              Có phép: <strong>{permissionCount}</strong>
            </span>
            <span className="px-2.5 py-1.5 bg-rose-50 text-rose-700 rounded-xl border border-rose-200">
              Kh.phép: <strong>{unexcusedCount}</strong>
            </span>
            <span className="px-2.5 py-1.5 bg-amber-50 text-amber-800 rounded-xl border border-amber-200">
              Muộn: <strong>{lateCount}</strong>
            </span>
          </div>

          {/* Quick action buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:ml-auto">
            {isTeacher ? (
              <>
                <button
                  type="button"
                  onClick={() => onMarkAllPresent(selectedDate)}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs sm:text-sm border border-emerald-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <CheckCheck className="w-4 h-4 text-emerald-600" />
                  <span>Tất cả có mặt</span>
                </button>
                <button
                  type="button"
                  onClick={onSaveNotice}
                  className="px-4 py-2 bg-[#8E2433] hover:bg-[#721C28] text-white font-bold rounded-xl text-xs sm:text-sm shadow-md hover:shadow-[#8E2433]/25 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Lưu điểm danh</span>
                </button>
              </>
            ) : (
              <div className="px-3.5 py-2 bg-[#FAF0EE] text-[#8E2433] border border-[#E9E2DF] rounded-xl font-bold text-xs">
                Chế độ theo dõi chuyên cần lớp
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Student attendance grid */}
      <div className="flex-1 overflow-y-auto bg-white rounded-3xl shadow-xs border border-[#E9E2DF] p-4 sm:p-6 relative">
        {state.students.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
            <UserX className="w-16 h-16 text-gray-200 mb-3" />
            <p className="text-base font-semibold text-[#233044]">
              Chưa có học sinh trong danh sách
            </p>
            <p className="text-xs text-[#6B7280] mt-1">
              Vào mục "Học sinh" để thêm hoặc nhập dữ liệu từ Excel.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {state.students.map((student) => {
              const currentRecord = state.attendance.find(
                (a) => a.studentId === student.id && a.date === selectedDate
              );
              const currentStatus = currentRecord ? currentRecord.status : 'c';

              const isSelf = student.id === currentStudentId;
              const handleCardStudentClick = () => {
                if (isTeacher || isSelf) {
                  onSelectStudent(student.id);
                } else {
                  onShowToast?.('Bảo mật: Bạn chỉ có quyền xem chi tiết hồ sơ của chính mình!', 'error');
                }
              };

              return (
                <div
                  key={student.id}
                  className={`border rounded-2xl p-3.5 flex flex-col justify-between transition-colors ${
                    isSelf
                      ? 'bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-200/60'
                      : 'bg-[#FFF8F3]/40 border-[#E9E2DF] hover:border-[#8E2433]/40'
                  }`}
                >
                  <div
                    onClick={handleCardStudentClick}
                    className="flex items-center gap-3 mb-3 cursor-pointer group"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 overflow-hidden ${
                      isSelf ? 'bg-emerald-100 text-emerald-800' : 'bg-[#FAF0EE] text-[#8E2433] border border-[#EBC9B9]'
                    }`}>
                      {student.avatar ? (
                        <img
                          src={student.avatar}
                          alt={student.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        student.name.charAt(0)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[#233044] group-hover:text-[#8E2433] transition-colors text-xs sm:text-sm uppercase flex items-center gap-1.5 flex-wrap break-words leading-snug">
                        <span>{student.name}</span>
                        {!isTeacher && isSelf && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-bold">
                            Bạn
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-[#6B7280] font-mono">
                        ID: {student.id}
                      </p>
                    </div>
                  </div>

                  {/* 4 buttons */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {/* Có mặt */}
                    <button
                      type="button"
                      disabled={!isTeacher}
                      onClick={() =>
                        isTeacher && onUpdateAttendanceStatus(student.id, selectedDate, 'c')
                      }
                      className={`py-2 px-1 flex flex-col items-center justify-center rounded-xl text-[11px] font-bold transition-all ${
                        isTeacher ? 'cursor-pointer' : 'cursor-default'
                      } ${
                        currentStatus === 'c'
                          ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300'
                          : 'bg-white text-gray-500 border border-[#E9E2DF] opacity-60'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 mb-0.5" />
                      <span>Có mặt</span>
                    </button>

                    {/* Có phép */}
                    <button
                      type="button"
                      disabled={!isTeacher}
                      onClick={() =>
                        isTeacher && onUpdateAttendanceStatus(student.id, selectedDate, 'v')
                      }
                      className={`py-2 px-1 flex flex-col items-center justify-center rounded-xl text-[11px] font-bold transition-all ${
                        isTeacher ? 'cursor-pointer' : 'cursor-default'
                      } ${
                        currentStatus === 'v'
                          ? 'bg-[#8E2433] text-white shadow-sm ring-2 ring-[#EBC9B9]'
                          : 'bg-white text-gray-500 border border-[#E9E2DF] opacity-60'
                      }`}
                    >
                      <Mail className="w-3.5 h-3.5 mb-0.5" />
                      <span>Có phép</span>
                    </button>

                    {/* Không phép */}
                    <button
                      type="button"
                      disabled={!isTeacher}
                      onClick={() =>
                        isTeacher && onUpdateAttendanceStatus(student.id, selectedDate, 'kp')
                      }
                      className={`py-2 px-1 flex flex-col items-center justify-center rounded-xl text-[11px] font-bold transition-all ${
                        isTeacher ? 'cursor-pointer' : 'cursor-default'
                      } ${
                        currentStatus === 'kp'
                          ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-300'
                          : 'bg-white text-gray-500 border border-[#E9E2DF] opacity-60'
                      }`}
                    >
                      <XIcon className="w-3.5 h-3.5 mb-0.5" />
                      <span>Kh.phép</span>
                    </button>

                    {/* Đi muộn */}
                    <button
                      type="button"
                      disabled={!isTeacher}
                      onClick={() =>
                        isTeacher && onUpdateAttendanceStatus(student.id, selectedDate, 'm')
                      }
                      className={`py-2 px-1 flex flex-col items-center justify-center rounded-xl text-[11px] font-bold transition-all ${
                        isTeacher ? 'cursor-pointer' : 'cursor-default'
                      } ${
                        currentStatus === 'm'
                          ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300'
                          : 'bg-white text-gray-500 border border-[#E9E2DF] opacity-60'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 mb-0.5" />
                      <span>Muộn</span>
                    </button>
                  </div>

                  {/* Reset / Xóa điểm danh ngày này nếu đã ghi nhận */}
                  {isTeacher && currentRecord && (
                    <div className="mt-2 pt-1.5 border-t border-gray-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => onDeleteAttendanceByDate?.(student.id, selectedDate)}
                        className="text-[10px] text-gray-400 hover:text-red-600 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Xóa bản ghi điểm danh này (chuyển về Chưa điểm danh)"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Xóa điểm danh</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
