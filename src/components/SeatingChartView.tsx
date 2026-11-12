import React, { useState } from 'react';
import {
  Users,
  Printer,
  RotateCcw,
  UserPlus,
  ArrowLeftRight,
  X,
  Plus,
  Minus,
  Search,
  Move,
  GripVertical,
} from 'lucide-react';
import { AppState, SeatingLayout, Student } from '../types';

interface SeatingChartViewProps {
  state: AppState;
  onUpdateSeatingChart: (newChart: Record<string, string>) => void;
  onUpdateSeatingLayout?: (layout: SeatingLayout) => void;
  onSelectStudent: (studentId: string) => void;
  isTeacher: boolean;
  currentStudentId?: string | null;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

export const SeatingChartView: React.FC<SeatingChartViewProps> = ({
  state,
  onUpdateSeatingChart,
  onUpdateSeatingLayout,
  onSelectStudent,
  isTeacher,
  currentStudentId,
  onShowToast,
}) => {
  const layout: SeatingLayout = {
    groups: state.seatingLayout?.groups || 4,
    rows:
      state.seatingLayout?.rows && state.seatingLayout.rows >= 3
        ? state.seatingLayout.rows
        : 8,
    seatsPerTable: state.seatingLayout?.seatsPerTable || 2,
  };
  const seatingMap = state.seatingChart || {};

  // Handlers to add/remove tables per row/dãy (GVCN only)
  const handleAddRow = () => {
    if (!isTeacher) return;
    if (layout.rows >= 12) {
      onShowToast('Số bàn mỗi dãy tối đa là 12 bàn', 'error');
      return;
    }
    const newRows = layout.rows + 1;
    if (onUpdateSeatingLayout) {
      onUpdateSeatingLayout({ ...layout, rows: newRows });
    }
  };

  const handleRemoveRow = () => {
    if (!isTeacher) return;
    if (layout.rows <= 3) {
      onShowToast('Số bàn mỗi dãy tối thiểu là 3 bàn', 'error');
      return;
    }
    const newRows = layout.rows - 1;
    if (onUpdateSeatingLayout) {
      onUpdateSeatingLayout({ ...layout, rows: newRows });
    }
  };

  // Selecting a seat for assignment or swap
  const [selectedSeatKey, setSelectedSeatKey] = useState<string | null>(null);
  const [swapSourceSeatKey, setSwapSourceSeatKey] = useState<string | null>(null);
  const [searchStudentQuery, setSearchStudentQuery] = useState('');

  // Drag and drop states for moving / swapping seats
  const [draggingSeatKey, setDraggingSeatKey] = useState<string | null>(null);
  const [dragOverSeatKey, setDragOverSeatKey] = useState<string | null>(null);

  // List of students who are assigned vs unassigned
  const assignedStudentIds = new Set(Object.values(seatingMap).filter(Boolean));
  const unassignedStudents = state.students.filter(
    (s) => !assignedStudentIds.has(s.id)
  );

  const totalSeats = layout.groups * layout.rows * layout.seatsPerTable;
  const occupiedCount = Object.values(seatingMap).filter((id) =>
    state.students.some((s) => s.id === id)
  ).length;

  // Clear seating with explicit confirmation
  const handleClearSeating = () => {
    if (!isTeacher) return;
    const confirmed = window.confirm(
      'Thầy/Cô có chắc chắn muốn xóa toàn bộ sơ đồ chỗ ngồi của lớp không?\n\nThao tác này sẽ gỡ toàn bộ học sinh khỏi các vị trí ghế.'
    );
    if (!confirmed) return;

    onUpdateSeatingChart({});
    setSelectedSeatKey(null);
    setSwapSourceSeatKey(null);
    onShowToast('Đã xóa toàn bộ sơ đồ chỗ ngồi');
  };

  // Handle clicking on a seat
  const handleSeatClick = (seatKey: string) => {
    if (!isTeacher) {
      const studentId = seatingMap[seatKey];
      if (studentId) {
        if (studentId === currentStudentId) {
          onSelectStudent(studentId);
        } else {
          const seatedStudent = state.students.find((s) => s.id === studentId);
          onShowToast(
            `Chỗ ngồi của bạn ${seatedStudent ? seatedStudent.name : ''}. (Tài khoản Học sinh: Chế độ chỉ xem)`
          );
        }
      }
      return;
    }

    // If currently in click-to-swap mode
    if (swapSourceSeatKey) {
      if (swapSourceSeatKey === seatKey) {
        setSwapSourceSeatKey(null);
        return;
      }
      // Perform swap / move
      const sourceStudent = seatingMap[swapSourceSeatKey];
      const targetStudent = seatingMap[seatKey];
      const updated = { ...seatingMap };

      if (sourceStudent) updated[seatKey] = sourceStudent;
      else delete updated[seatKey];

      if (targetStudent) updated[swapSourceSeatKey] = targetStudent;
      else delete updated[swapSourceSeatKey];

      onUpdateSeatingChart(updated);
      setSwapSourceSeatKey(null);
      setSelectedSeatKey(null);
      onShowToast(
        targetStudent
          ? 'Đã hoán đổi vị trí giữa 2 học sinh'
          : 'Đã chuyển học sinh sang vị trí mới'
      );
      return;
    }

    // Open assignment/reassignment modal
    setSelectedSeatKey(seatKey);
    setSearchStudentQuery('');
  };

  // Assign student to selected seat
  const handleAssignStudent = (studentId: string) => {
    if (!isTeacher || !selectedSeatKey) return;
    const updated = { ...seatingMap };

    // If this student was already seated somewhere else, clear that seat
    Object.keys(updated).forEach((key) => {
      if (updated[key] === studentId && key !== selectedSeatKey) {
        delete updated[key];
      }
    });

    updated[selectedSeatKey] = studentId;
    onUpdateSeatingChart(updated);
    setSelectedSeatKey(null);
    onShowToast('Đã xếp học sinh vào chỗ ngồi');
  };

  // Remove student from a seat
  const handleRemoveStudentFromSeat = (seatKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isTeacher) return;
    const updated = { ...seatingMap };
    delete updated[seatKey];
    onUpdateSeatingChart(updated);
    if (selectedSeatKey === seatKey) setSelectedSeatKey(null);
    if (swapSourceSeatKey === seatKey) setSwapSourceSeatKey(null);
    onShowToast('Đã gỡ học sinh khỏi chỗ ngồi');
  };

  // Start click-to-swap mode
  const handleStartSwap = (seatKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isTeacher) return;
    setSwapSourceSeatKey(seatKey);
    setSelectedSeatKey(null);
    onShowToast('Chọn chỗ ngồi thứ hai để hoán đổi vị trí');
  };

  // HTML5 Drag and Drop handlers
  const handleDragStart = (seatKey: string, e: React.DragEvent) => {
    if (!isTeacher) return;
    setDraggingSeatKey(seatKey);
    e.dataTransfer.setData('text/plain', seatKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (seatKey: string, e: React.DragEvent) => {
    if (!isTeacher || !draggingSeatKey) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSeatKey !== seatKey) {
      setDragOverSeatKey(seatKey);
    }
  };

  const handleDragLeave = (seatKey: string) => {
    if (dragOverSeatKey === seatKey) {
      setDragOverSeatKey(null);
    }
  };

  const handleDrop = (targetSeatKey: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSeatKey(null);
    const sourceSeatKey = draggingSeatKey || e.dataTransfer.getData('text/plain');
    setDraggingSeatKey(null);

    if (!isTeacher || !sourceSeatKey || sourceSeatKey === targetSeatKey) return;

    const sourceStudent = seatingMap[sourceSeatKey];
    if (!sourceStudent) return;
    const targetStudent = seatingMap[targetSeatKey];

    const updated = { ...seatingMap };
    updated[targetSeatKey] = sourceStudent;

    if (targetStudent) {
      updated[sourceSeatKey] = targetStudent;
      onShowToast('Đã hoán đổi vị trí giữa 2 học sinh');
    } else {
      delete updated[sourceSeatKey];
      onShowToast('Đã chuyển học sinh sang vị trí mới');
    }

    onUpdateSeatingChart(updated);
    setSelectedSeatKey(null);
    setSwapSourceSeatKey(null);
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter students in assignment modal
  const filteredUnassigned = unassignedStudents.filter((s) =>
    s.name.toLowerCase().includes(searchStudentQuery.toLowerCase().trim())
  );
  const filteredAllStudents = state.students.filter((s) =>
    s.name.toLowerCase().includes(searchStudentQuery.toLowerCase().trim())
  );

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Seating Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl shadow-xs border border-[#E8DEDA] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-[#233146]">
              Sơ đồ Chỗ ngồi Lớp {state.config.className}
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#F5EDEB] text-[#922235] border border-[#E8DEDA]">
              {occupiedCount}/{totalSeats} chỗ đã xếp
            </span>
          </div>
          <p className="text-xs text-[#697589] mt-0.5">
            Mô hình: {layout.groups} tổ (dãy) • {layout.rows} hàng bàn • Bàn đôi (2 học sinh/bàn)
            {isTeacher && (
              <span className="ml-2 text-[#922235] font-semibold">
                • Hỗ trợ kéo thả học sinh hoặc bấm nút đổi chỗ
              </span>
            )}
          </p>
        </div>

        {isTeacher ? (
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Table Rows Control */}
            <div className="flex items-center gap-1 bg-[#FFF8F4] border border-[#E8DEDA] rounded-xl px-2.5 py-1.5 text-xs">
              <span className="font-bold text-[#697589] mr-1">Quy mô:</span>
              <button
                type="button"
                onClick={handleRemoveRow}
                disabled={layout.rows <= 3}
                className="w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-[#E8DEDA] text-[#233146] hover:bg-[#F5EDEB] disabled:opacity-40 disabled:cursor-not-allowed font-bold cursor-pointer transition-colors shadow-2xs"
                title="Bớt 1 bàn mỗi dãy"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-black text-[#922235] px-1.5 min-w-[50px] text-center">
                {layout.rows} bàn/dãy
              </span>
              <button
                type="button"
                onClick={handleAddRow}
                disabled={layout.rows >= 12}
                className="w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-[#E8DEDA] text-[#233146] hover:bg-[#F5EDEB] disabled:opacity-40 disabled:cursor-not-allowed font-bold cursor-pointer transition-colors shadow-2xs"
                title="Thêm 1 bàn mỗi dãy"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {/* Clear All with confirmation */}
            <button
              onClick={handleClearSeating}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
              title="Xóa sơ đồ sau khi xác nhận"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Xóa sơ đồ</span>
            </button>

            {/* Print Seating Chart */}
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-[#922235] hover:bg-[#781C2B] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="In sơ đồ lớp để dán tại lớp"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In sơ đồ</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F5EDEB] text-[#233146] border border-[#E8DEDA]">
              Chế độ xem sơ đồ (Chỉ xem)
            </span>
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-[#922235] hover:bg-[#781C2B] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="In sơ đồ lớp"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In sơ đồ</span>
            </button>
          </div>
        )}
      </div>

      {/* Swap Mode Callout Banner */}
      {swapSourceSeatKey && isTeacher && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs text-amber-800 font-bold animate-fadeIn">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-amber-600 animate-pulse" />
            <span>
              Đang chọn chế độ hoán đổi. Vui lòng bấm vào chỗ ngồi thứ hai (hoặc ghế trống) để chuyển/đổi chỗ!
            </span>
          </div>
          <button
            onClick={() => setSwapSourceSeatKey(null)}
            className="text-amber-900 underline cursor-pointer text-xs font-bold"
          >
            Hủy hoán đổi
          </button>
        </div>
      )}

      {/* Main Classroom Seating Layout */}
      <div className="bg-white rounded-3xl shadow-xs border border-[#E8DEDA] p-6 overflow-x-auto print:border-none print:shadow-none">
        {/* PODIUM / TEACHER DESK (BỤC GIẢNG & BÀN GIÁO VIÊN) */}
        <div className="max-w-md mx-auto mb-8 text-center">
          <div className="bg-gradient-to-r from-[#781C2B] via-[#922235] to-[#233146] text-white font-black py-2.5 px-6 rounded-2xl text-xs sm:text-sm tracking-wider uppercase shadow-md flex items-center justify-center gap-2 border border-[#922235]/30">
            <span>BẢNG ĐEN • BỤC GIẢNG &amp; BÀN GIÁO VIÊN</span>
          </div>
          <div className="h-4 border-l-2 border-r-2 border-dashed border-[#E8DEDA] mx-auto w-3/4" />
        </div>

        {/* COLUMNS / GROUPS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 min-w-[700px]">
          {Array.from({ length: layout.groups }).map((_, groupIdx) => {
            const groupNum = groupIdx + 1;
            return (
              <div
                key={`group-${groupNum}`}
                className="bg-[#FFF8F4]/60 border border-[#E8DEDA] rounded-2xl p-3 flex flex-col space-y-3"
              >
                {/* Group Title Header */}
                <div className="text-center pb-2 border-b border-[#E8DEDA]">
                  <span className="text-xs font-black text-[#233146] uppercase tracking-wider">
                    TỔ {groupNum} (DÃY {groupNum})
                  </span>
                </div>

                {/* Rows of Tables */}
                <div className="space-y-3">
                  {Array.from({ length: layout.rows }).map((_, rowIdx) => {
                    const rowNum = rowIdx + 1;
                    return (
                      <div
                        key={`g${groupNum}-r${rowNum}`}
                        className="bg-white border border-[#E8DEDA] rounded-xl p-2 shadow-2xs hover:border-[#922235]/40 transition-colors"
                      >
                        <div className="text-[10px] text-[#697589] font-bold uppercase mb-1.5 flex justify-between items-center px-1">
                          <span>Bàn {rowNum}</span>
                        </div>

                        {/* 2 Seats per table */}
                        <div className="grid grid-cols-2 gap-1.5">
                          {Array.from({ length: layout.seatsPerTable }).map(
                            (_, seatIdx) => {
                              const seatNum = seatIdx + 1;
                              const seatKey = `g${groupNum}-r${rowNum}-s${seatNum}`;
                              const studentId = seatingMap[seatKey];
                              const student = state.students.find(
                                (s) => s.id === studentId
                              );
                              const isSelected = selectedSeatKey === seatKey;
                              const isSwapSource = swapSourceSeatKey === seatKey;
                              const isDragging = draggingSeatKey === seatKey;
                              const isDragOver = dragOverSeatKey === seatKey;
                              const isMySeat =
                                !isTeacher && student && student.id === currentStudentId;

                              return (
                                <div
                                  key={seatKey}
                                  draggable={isTeacher && !!student}
                                  onDragStart={(e) => handleDragStart(seatKey, e)}
                                  onDragOver={(e) => handleDragOver(seatKey, e)}
                                  onDragLeave={() => handleDragLeave(seatKey)}
                                  onDrop={(e) => handleDrop(seatKey, e)}
                                  onClick={() => handleSeatClick(seatKey)}
                                  className={`rounded-xl p-2 border transition-all relative min-h-[76px] flex flex-col justify-between select-none ${
                                    isTeacher || isMySeat
                                      ? 'cursor-pointer'
                                      : 'cursor-default'
                                  } ${
                                    isDragOver
                                      ? 'border-[#922235] bg-[#F5EDEB] ring-2 ring-[#922235] scale-[1.03] shadow-md z-10'
                                      : isDragging
                                      ? 'opacity-40 border-dashed border-[#922235]'
                                      : isMySeat
                                      ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-400 shadow-xs'
                                      : isSwapSource
                                      ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-300 animate-pulse'
                                      : isSelected
                                      ? 'border-[#922235] bg-[#F5EDEB] ring-2 ring-[#922235]/30'
                                      : student
                                      ? student.gender === 'Nam'
                                        ? 'border-blue-100 bg-blue-50/20 hover:border-[#922235]/40 hover:shadow-2xs'
                                        : 'border-rose-100 bg-rose-50/20 hover:border-[#922235]/40 hover:shadow-2xs'
                                      : isTeacher
                                      ? 'border-dashed border-[#E8DEDA] hover:border-[#922235]/60 bg-gray-50/40 hover:bg-[#F5EDEB]/40'
                                      : 'border-dashed border-[#E8DEDA]/60 bg-gray-50/20'
                                  }`}
                                  title={
                                    isTeacher && student
                                      ? `${student.name} (Kéo thả để chuyển chỗ hoặc bấm để thay đổi)`
                                      : isTeacher
                                      ? 'Bấm để xếp học sinh vào ghế này'
                                      : student
                                      ? student.name
                                      : 'Ghế trống'
                                  }
                                >
                                  {student ? (
                                    <>
                                      <div className="flex items-start gap-1.5 min-w-0">
                                        <div
                                          className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black text-white shrink-0 mt-0.5 ${
                                            isMySeat
                                              ? 'bg-emerald-600'
                                              : student.gender === 'Nam'
                                              ? 'bg-blue-600'
                                              : 'bg-pink-600'
                                          }`}
                                        >
                                          {student.name.charAt(0)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-1">
                                            <p
                                              className="text-[11px] font-bold text-gray-900 uppercase leading-snug break-words flex-1"
                                              title={student.name}
                                            >
                                              {student.name}
                                            </p>
                                            {isMySeat && (
                                              <span className="text-[9px] font-black bg-emerald-600 text-white px-1 py-0.2 rounded shrink-0">
                                                BẠN
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Teacher seat action controls */}
                                      {isTeacher && (
                                        <div className="flex items-center justify-between gap-1 mt-1 pt-1 border-t border-gray-100">
                                          <span
                                            className="text-[9px] text-gray-400 font-medium flex items-center gap-0.5 cursor-grab active:cursor-grabbing"
                                            title="Kéo thả học sinh này"
                                          >
                                            <GripVertical className="w-2.5 h-2.5" />
                                          </span>

                                          <div className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={(e) =>
                                                handleStartSwap(seatKey, e)
                                              }
                                              className="text-[9px] text-[#922235] hover:text-[#781C2B] font-bold px-1 py-0.5 rounded hover:bg-[#F5EDEB] transition-colors cursor-pointer"
                                              title="Hoán đổi chỗ này với chỗ khác"
                                            >
                                              <ArrowLeftRight className="w-2.5 h-2.5" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(e) =>
                                                handleRemoveStudentFromSeat(seatKey, e)
                                              }
                                              className="text-[9px] text-gray-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50 transition-colors cursor-pointer"
                                              title="Gỡ học sinh khỏi chỗ này"
                                            >
                                              <X className="w-2.5 h-2.5" />
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  ) : isTeacher ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 hover:text-[#922235] transition-colors py-2">
                                      <UserPlus className="w-3.5 h-3.5 mb-0.5" />
                                      <span className="text-[10px] font-semibold">
                                        Ghế trống
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-[#697589]/40 py-2 select-none">
                                      <span className="text-[10px] font-medium">
                                        Ghế trống
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Entrance / Exit indicator at bottom */}
        <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span>🚪 CỬA RA VÀO (CUỐI LỚP)</span>
          <span className="font-semibold">
            Trợ Lý Chủ Nhiệm • Sơ đồ chỗ ngồi Lớp {state.config.className}
          </span>
        </div>
      </div>

      {/* Drawer / Popover: Assign Student to Selected Seat (GVCN only) */}
      {selectedSeatKey && isTeacher && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] border border-[#E8DEDA]">
            <div className="p-4 border-b border-[#E8DEDA] bg-gradient-to-r from-[#F5EDEB] to-[#FFF8F4] flex justify-between items-center">
              <div>
                <h4 className="font-black text-[#233146] text-sm uppercase">
                  Chọn học sinh vào chỗ ngồi
                </h4>
                <p className="text-[11px] text-[#697589] font-medium">
                  Vị trí bàn:{' '}
                  <strong className="text-[#922235] uppercase font-bold">
                    {selectedSeatKey}
                  </strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedSeatKey(null)}
                className="w-7 h-7 rounded-full bg-white hover:bg-gray-100 text-gray-400 flex items-center justify-center cursor-pointer border border-[#E8DEDA]"
              >
                ✕
              </button>
            </div>

            {/* Quick Search Box */}
            <div className="p-3 border-b border-gray-100 bg-white">
              <div className="flex items-center gap-2 px-3 py-2 bg-[#FFF8F4] border border-[#E8DEDA] rounded-xl text-xs">
                <Search className="w-3.5 h-3.5 text-[#922235]" />
                <input
                  type="text"
                  value={searchStudentQuery}
                  onChange={(e) => setSearchStudentQuery(e.target.value)}
                  placeholder="Tìm học sinh theo tên..."
                  className="bg-transparent flex-1 outline-none text-[#233146] font-medium"
                />
                {searchStudentQuery && (
                  <button
                    onClick={() => setSearchStudentQuery('')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
              {/* Unassigned Students section */}
              <div>
                <p className="text-xs font-bold text-[#697589] uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Học sinh chưa xếp chỗ ({unassignedStudents.length})</span>
                  {unassignedStudents.length > 0 && (
                    <span className="text-[10px] text-[#922235] font-semibold lowercase">
                      (ưu tiên chọn)
                    </span>
                  )}
                </p>

                {unassignedStudents.length === 0 ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-emerald-800 text-xs font-semibold">
                    ✓ Tất cả 44 học sinh trong lớp đều đã được xếp chỗ ngồi!
                  </div>
                ) : filteredUnassigned.length === 0 ? (
                  <div className="p-3 text-center text-gray-400 text-xs">
                    Không tìm thấy học sinh chưa xếp chỗ phù hợp với từ khóa.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredUnassigned.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => handleAssignStudent(s.id)}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-[#E8DEDA] hover:border-[#922235] hover:bg-[#F5EDEB]/60 transition-colors cursor-pointer group shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg text-white font-bold text-xs flex items-center justify-center shrink-0 ${
                              s.gender === 'Nam' ? 'bg-blue-600' : 'bg-pink-600'
                            }`}
                          >
                            {s.name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[#233146] uppercase break-words leading-snug group-hover:text-[#922235]">
                              {s.name}
                            </p>
                            <span className="text-[10px] text-[#697589] font-mono">
                              Mã: {s.studentCode || s.id} • {s.gender}
                            </span>
                          </div>
                        </div>
                        <button className="px-2.5 py-1 bg-[#922235] hover:bg-[#781C2B] text-white font-bold rounded-lg text-[11px] cursor-pointer shadow-2xs">
                          Xếp vào ghế
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reassign from all students */}
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs font-bold text-[#697589] uppercase tracking-wider mb-2">
                  Hoặc chuyển học sinh từ vị trí khác ({state.students.length} em):
                </p>
                <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                  {filteredAllStudents.map((s) => {
                    const currentSeat = Object.keys(seatingMap).find(
                      (k) => seatingMap[k] === s.id
                    );
                    const isAlreadyInSelectedSeat = currentSeat === selectedSeatKey;

                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          if (!isAlreadyInSelectedSeat) {
                            handleAssignStudent(s.id);
                          }
                        }}
                        className={`flex items-center justify-between p-2 rounded-xl border text-xs transition-colors ${
                          isAlreadyInSelectedSeat
                            ? 'bg-[#F5EDEB] border-[#922235]/40 text-[#922235] cursor-default'
                            : 'border-transparent hover:border-[#E8DEDA] hover:bg-[#FFF8F4] cursor-pointer text-[#233146]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#922235]" />
                          <span className="font-bold uppercase text-[11px]">
                            {s.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-[#697589]">
                          {isAlreadyInSelectedSeat
                            ? '(Đang ngồi ghế này)'
                            : currentSeat
                            ? `Đang ngồi: ${currentSeat}`
                            : 'Chưa có chỗ'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
