import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Users,
  Search,
  CheckSquare,
  Square,
  AlertTriangle,
  Calendar,
  FileWarning,
  Eye,
  CheckCircle2,
  ShieldAlert,
  RotateCcw,
} from 'lucide-react';
import { AppState, DisciplineRecord } from '../types';
import { formatDisplayDate, formatStudentCode } from '../utils/helpers';
import {
  calculateSemesterEmulation,
  getSemesterBasePoints,
  getTodayVietnamYMD,
  resolveDisciplinePeriod,
} from '../utils/semesterHelpers';
import {
  buildBatchDisciplinePayloads,
  buildStudentGroupData,
  findExistingSameDayViolationStudentIds,
  getViolationRules,
} from '../utils/batchDisciplineHelpers';

interface BatchViolationModalProps {
  isOpen: boolean;
  state: AppState;
  onClose: () => void;
  onShowToast?: (msg: string, type?: 'success' | 'error') => void;
  /**
   * Currently defaults to false (preview-only check mode per teacher instructions).
   * When activated later, pass true along with onConfirmBatchSave.
   */
  isPersistenceEnabled?: boolean;
  onConfirmBatchSave?: (
    records: Omit<DisciplineRecord, 'id'>[]
  ) => Promise<{ success: boolean; error?: string }> | { success: boolean; error?: string };
  highlightStudentId?: string | null;
}

export const BatchViolationModal: React.FC<BatchViolationModalProps> = ({
  isOpen,
  state,
  onClose,
  onShowToast,
  isPersistenceEnabled = false,
  onConfirmBatchSave,
  highlightStudentId,
}) => {
  const violationRules = useMemo(() => getViolationRules(state.config.rules), [state.config.rules]);
  const semesterBasePoints = getSemesterBasePoints(state.config);

  const [violationDate, setViolationDate] = useState<string>(() => getTodayVietnamYMD());
  const [selectedRuleId, setSelectedRuleId] = useState<string>(() => violationRules[0]?.id || '');
  const [commonNote, setCommonNote] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [previewSimulationResult, setPreviewSimulationResult] = useState<{
    count: number;
    date: string;
    ruleName: string;
    points: number;
    semesterLabel: string;
    schoolYear: string;
  } | null>(null);

  // Reset form cleanly each time modal opens
  useEffect(() => {
    if (!isOpen) return;
    setViolationDate(getTodayVietnamYMD());
    setSelectedRuleId((prev) =>
      violationRules.some((r) => r.id === prev) ? prev : violationRules[0]?.id || ''
    );
    setCommonNote('');
    setSearchQuery('');
    setSelectedStudentIds([]);
    setIsSubmitting(false);
    setPreviewSimulationResult(null);
  }, [isOpen, violationRules]);

  // Clear preview confirmation banner whenever selection/date/rule changes
  useEffect(() => {
    if (previewSimulationResult) {
      setPreviewSimulationResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [violationDate, selectedRuleId, selectedStudentIds.length, commonNote]);

  // Sort class students by Vietnamese first name (matching StudentsView)
  const sortedStudents = useMemo(() => {
    return [...state.students].sort((a, b) => {
      const nameA = a.name.trim().split(' ').pop() || '';
      const nameB = b.name.trim().split(' ').pop() || '';
      return nameA.localeCompare(nameB, 'vi');
    });
  }, [state.students]);

  // Student code index map for display
  const studentIndexMap = useMemo(() => {
    const map: Record<string, number> = {};
    sortedStudents.forEach((s, idx) => {
      map[s.id] = idx + 1;
    });
    return map;
  }, [sortedStudents]);

  // Group ("Tổ") data derived from existing seatingChart
  const { studentGroupMap, groups } = useMemo(
    () => buildStudentGroupData(sortedStudents, state.seatingChart, state.seatingLayout),
    [sortedStudents, state.seatingChart, state.seatingLayout]
  );

  // Filtered students for search box
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedStudents;
    return sortedStudents.filter((s) => {
      const code = formatStudentCode(s.studentCode, studentIndexMap[s.id] || 1).toLowerCase();
      const groupNum = studentGroupMap[s.id];
      const groupLabel = groupNum ? `tổ ${groupNum}` : '';
      return (
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        code.includes(q) ||
        groupLabel.includes(q)
      );
    });
  }, [sortedStudents, searchQuery, studentIndexMap, studentGroupMap]);

  const selectedRule = useMemo(
    () => violationRules.find((r) => r.id === selectedRuleId) || null,
    [violationRules, selectedRuleId]
  );

  const dateResolution = useMemo(
    () => resolveDisciplinePeriod(violationDate, state.config),
    [violationDate, state.config]
  );

  const selectedIdSet = useMemo(() => new Set(selectedStudentIds), [selectedStudentIds]);

  const selectedStudentsList = useMemo(() => {
    return sortedStudents.filter((s) => selectedIdSet.has(s.id));
  }, [sortedStudents, selectedIdSet]);

  const duplicateSameDayIds = useMemo(
    () =>
      selectedRule
        ? findExistingSameDayViolationStudentIds(
            state.discipline,
            selectedStudentIds,
            violationDate,
            selectedRule.id
          )
        : new Set<string>(),
    [state.discipline, selectedStudentIds, violationDate, selectedRule]
  );

  // Compute current & projected semester points for each selected student (read-only preview)
  const previewRows = useMemo(() => {
    if (!selectedRule) return [];
    return selectedStudentsList.map((student) => {
      const semSummary = calculateSemesterEmulation(
        state.discipline,
        state.config,
        dateResolution.schoolYear,
        dateResolution.semester,
        student.id
      );
      return {
        student,
        code: formatStudentCode(student.studentCode, studentIndexMap[student.id] || 1),
        groupNum: studentGroupMap[student.id],
        currentPoints: semSummary.remainingPoints,
        projectedPoints: semSummary.remainingPoints - selectedRule.points,
        hasSameViolationSameDay: duplicateSameDayIds.has(student.id),
      };
    });
  }, [
    selectedRule,
    selectedStudentsList,
    state.discipline,
    state.config,
    dateResolution.schoolYear,
    dateResolution.semester,
    studentIndexMap,
    studentGroupMap,
    duplicateSameDayIds,
  ]);

  if (!isOpen) return null;

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredStudents.map((s) => s.id);
    setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
  };

  const handleClearSelection = () => {
    setSelectedStudentIds([]);
  };

  const handleToggleGroup = (groupStudentIds: string[]) => {
    if (groupStudentIds.length === 0) return;
    const allInGroupSelected = groupStudentIds.every((id) => selectedIdSet.has(id));
    if (allInGroupSelected) {
      const toRemove = new Set(groupStudentIds);
      setSelectedStudentIds((prev) => prev.filter((id) => !toRemove.has(id)));
    } else {
      setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...groupStudentIds])));
    }
  };

  const handleConfirmSubmit = async () => {
    if (isSubmitting) return;
    if (!selectedRule) {
      onShowToast?.('Vui lòng chọn lỗi vi phạm từ danh mục đã cài đặt.', 'error');
      return;
    }
    if (!violationDate) {
      onShowToast?.('Vui lòng chọn ngày vi phạm.', 'error');
      return;
    }
    if (selectedStudentIds.length === 0) {
      onShowToast?.('Vui lòng chọn ít nhất 1 học sinh để ghi nhận.', 'error');
      return;
    }

    const payloads = buildBatchDisciplinePayloads({
      studentIds: selectedStudentIds,
      date: violationDate,
      rule: selectedRule,
      note: commonNote,
      config: state.config,
    });

    // PREVIEW / CHECK MODE (Do NOT write to Supabase until teacher explicitly activates persistence)
    if (!isPersistenceEnabled || !onConfirmBatchSave) {
      const semLabel = dateResolution.semester === 'HK1' ? 'Học kỳ I' : 'Học kỳ II';
      setPreviewSimulationResult({
        count: payloads.length,
        date: violationDate,
        ruleName: selectedRule.name,
        points: selectedRule.points,
        semesterLabel: semLabel,
        schoolYear: dateResolution.schoolYear,
      });
      onShowToast?.(
        `Chế độ xem trước: Đã kiểm tra xong ${payloads.length} học sinh (-${selectedRule.points}đ/HS). Chưa ghi dữ liệu thật vào Supabase.`,
        'success'
      );
      return;
    }

    // LIVE PERSISTENCE MODE (activated only when teacher confirms)
    setIsSubmitting(true);
    try {
      const result = await onConfirmBatchSave(payloads);
      if (result.success) {
        onShowToast?.(
          `Đã ghi nhận vi phạm thành công cho ${payloads.length} học sinh.`,
          'success'
        );
        onClose();
      } else {
        onShowToast?.(
          result.error || 'Không thể lưu ghi nhận vi phạm hàng loạt. Dữ liệu chưa bị thay đổi.',
          'error'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onShowToast?.(`Lỗi khi lưu vi phạm hàng loạt: ${msg}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canConfirm = Boolean(selectedRule && violationDate && selectedStudentIds.length > 0 && !isSubmitting);
  const semesterDisplayLabel = dateResolution.semester === 'HK1' ? 'Học kỳ I' : 'Học kỳ II';

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center p-2.5 sm:p-4 bg-black/55 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[93vh] overflow-hidden flex flex-col border border-[#E8DEDA]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-[#E8DEDA] bg-[#FFF8F4] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#922235] text-white flex items-center justify-center shadow-sm shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-[#233146] uppercase tracking-tight">
                  Ghi nhận vi phạm hàng loạt
                </h3>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#F5EDEB] text-[#922235] border border-[#E8DEDA]">
                  Lớp {state.config.className}
                </span>
              </div>
              <p className="text-xs text-[#697589] mt-0.5 truncate">
                Một lỗi – một ngày – nhiều học sinh • Tái sử dụng đúng danh mục lỗi và điểm trừ hiện có
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white hover:bg-[#F5EDEB] text-[#697589] hover:text-[#233146] flex items-center justify-center border border-[#E8DEDA] transition-colors cursor-pointer shrink-0"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview-Only Mode Banner (shown until real Supabase save is activated) */}
        {!isPersistenceEnabled && (
          <div className="px-5 sm:px-6 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center gap-2.5 text-amber-900 text-xs shrink-0">
            <Eye className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold">
              Chế độ kiểm tra giao diện &amp; xem trước: Chưa kích hoạt ghi dữ liệu thật vào Supabase. Bạn có thể chọn ngày, lỗi và học sinh để kiểm tra trước toàn bộ luồng.
            </span>
          </div>
        )}

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#FFF8F4]/40 custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* LEFT COLUMN (7 cols): Violation Config + Student Selector */}
            <div className="lg:col-span-7 space-y-4">
              {/* Step 1: Date, Violation Rule & Auto-Deduction */}
              <div className="bg-white rounded-2xl border border-[#E8DEDA] p-4 sm:p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-[#E8DEDA] pb-2.5">
                  <h4 className="text-xs font-black text-[#233146] uppercase tracking-wider flex items-center gap-1.5">
                    <FileWarning className="w-4 h-4 text-[#922235]" />
                    <span>1. Thông tin lỗi vi phạm</span>
                  </h4>
                  <span className="text-[11px] font-bold text-[#922235] bg-[#F5EDEB] px-2.5 py-0.5 rounded-lg border border-[#E8DEDA]">
                    {semesterDisplayLabel} • {dateResolution.schoolYear}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                  {/* Date */}
                  <div className="sm:col-span-5">
                    <label className="block text-xs font-bold text-[#233146] mb-1.5">
                      Ngày vi phạm <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-[#922235] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="date"
                        value={violationDate}
                        onChange={(e) => setViolationDate(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-[#FFF8F4]/50 border border-[#E8DEDA] rounded-xl text-xs sm:text-sm font-bold text-[#233146] focus:bg-white focus:ring-2 focus:ring-[#922235] focus:border-[#922235] outline-none"
                      />
                    </div>
                  </div>

                  {/* Violation Rule Selector */}
                  <div className="sm:col-span-7">
                    <label className="block text-xs font-bold text-[#233146] mb-1.5">
                      Lỗi vi phạm (Danh mục hiện có) <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedRuleId}
                      onChange={(e) => setSelectedRuleId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-[#E8DEDA] rounded-xl text-xs sm:text-sm font-semibold text-[#233146] focus:ring-2 focus:ring-[#922235] focus:border-[#922235] outline-none cursor-pointer"
                    >
                      {violationRules.length === 0 ? (
                        <option value="">
                          Chưa có lỗi vi phạm nào (vào Cài đặt → Quy tắc thi đua để thêm)
                        </option>
                      ) : (
                        violationRules.map((rule) => (
                          <option key={rule.id} value={rule.id}>
                            {rule.name} (-{rule.points}đ)
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                {/* Out of configured semester range warning */}
                {!dateResolution.isWithinConfiguredRange && dateResolution.warningMessage && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>{dateResolution.warningMessage}</span>
                  </div>
                )}

                {/* Read-only Auto Deduction Display */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-[#F5EDEB]/70 border border-[#E8DEDA]">
                  <div>
                    <span className="text-[11px] font-bold text-[#697589] uppercase block">
                      Điểm trừ tự động theo lỗi đã chọn
                    </span>
                    <span className="text-xs text-[#233146] font-medium">
                      {selectedRule
                        ? `Áp dụng thống nhất mức điểm đã cài đặt cho lỗi “${selectedRule.name}”`
                        : 'Chưa chọn lỗi vi phạm'}
                    </span>
                  </div>
                  <div className="px-3.5 py-1.5 rounded-xl bg-white border border-rose-200 text-rose-700 font-black text-sm shrink-0 self-start sm:self-center shadow-2xs">
                    {selectedRule ? `-${selectedRule.points} điểm / HS` : '--'}
                  </div>
                </div>

                {/* Optional shared note */}
                <div>
                  <label className="block text-xs font-bold text-[#233146] mb-1">
                    Ghi chú chung (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={commonNote}
                    onChange={(e) => setCommonNote(e.target.value)}
                    placeholder="Ví dụ: Tiết 2 môn Toán, kiểm tra đầu giờ..."
                    className="w-full px-3 py-2 bg-[#FFF8F4]/50 border border-[#E8DEDA] rounded-xl text-xs text-[#233146] focus:bg-white focus:ring-2 focus:ring-[#922235] outline-none"
                  />
                </div>
              </div>

              {/* Step 2: Multi-Student Selector */}
              <div className="bg-white rounded-2xl border border-[#E8DEDA] p-4 sm:p-5 space-y-3.5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8DEDA] pb-2.5">
                  <h4 className="text-xs font-black text-[#233146] uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-[#922235]" />
                    <span>2. Chọn học sinh lớp {state.config.className}</span>
                  </h4>
                  <span className="text-xs font-black px-2.5 py-1 rounded-full bg-[#922235] text-white shadow-2xs">
                    Đã chọn: {selectedStudentIds.length} / {sortedStudents.length} HS
                  </span>
                </div>

                {/* Search Input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-[#697589] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm nhanh theo tên học sinh, mã HS hoặc tổ (VD: Tổ 1)..."
                    className="w-full pl-10 pr-8 py-2 bg-[#FFF8F4]/60 border border-[#E8DEDA] rounded-xl text-xs sm:text-sm font-medium text-[#233146] focus:bg-white focus:ring-2 focus:ring-[#922235] outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#697589] hover:text-[#233146] text-xs font-bold p-1 cursor-pointer"
                      title="Xóa từ khóa"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Quick Selection Toolbar: Groups (Tổ) + Select All + Clear */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-[#697589] mr-1">Chọn nhanh tổ:</span>
                    {groups.map((grp) => {
                      const count = grp.studentIds.length;
                      const isGroupFullySelected =
                        count > 0 && grp.studentIds.every((id) => selectedIdSet.has(id));
                      const selectedInGroup = grp.studentIds.filter((id) =>
                        selectedIdSet.has(id)
                      ).length;

                      return (
                        <button
                          key={grp.groupNumber}
                          type="button"
                          disabled={count === 0}
                          onClick={() => handleToggleGroup(grp.studentIds)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                            isGroupFullySelected
                              ? 'bg-[#922235] text-white border-[#922235] shadow-2xs'
                              : selectedInGroup > 0
                              ? 'bg-[#F5EDEB] text-[#922235] border-[#922235]/50'
                              : 'bg-white text-[#233146] border-[#E8DEDA] hover:bg-[#F5EDEB]'
                          }`}
                          title={
                            count === 0
                              ? `${grp.label} chưa có học sinh trong Sơ đồ lớp`
                              : isGroupFullySelected
                              ? `Bấm để bỏ chọn cả ${grp.label}`
                              : `Bấm để chọn cả ${grp.label} (${count} học sinh)`
                          }
                        >
                          {grp.label} ({count})
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      disabled={filteredStudents.length === 0}
                      className="px-3 py-1.5 rounded-xl bg-[#F5EDEB] hover:bg-[#E8DEDA] text-[#233146] text-xs font-bold border border-[#E8DEDA] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Chọn tất cả{searchQuery.trim() ? ` (${filteredStudents.length})` : ` (${sortedStudents.length})`}
                    </button>
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      disabled={selectedStudentIds.length === 0}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-[#922235] text-xs font-bold border border-[#E8DEDA] flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Bỏ chọn</span>
                    </button>
                  </div>
                </div>

                {/* Scrollable Checkbox List of Students */}
                <div className="border border-[#E8DEDA] rounded-2xl overflow-hidden bg-white">
                  <div className="max-h-[300px] sm:max-h-[340px] overflow-y-auto divide-y divide-[#E8DEDA]/70 custom-scrollbar">
                    {filteredStudents.length === 0 ? (
                      <div className="py-10 px-4 text-center text-xs text-[#697589] italic">
                        Không tìm thấy học sinh phù hợp với từ khóa “{searchQuery}”.
                      </div>
                    ) : (
                      filteredStudents.map((student) => {
                        const isChecked = selectedIdSet.has(student.id);
                        const codeDisplay = formatStudentCode(
                          student.studentCode,
                          studentIndexMap[student.id] || 1
                        );
                        const groupNum = studentGroupMap[student.id];
                        const isHighlighted = highlightStudentId === student.id;

                        return (
                          <label
                            key={student.id}
                            className={`flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer transition-colors select-none ${
                              isChecked
                                ? 'bg-[#F5EDEB]/80'
                                : 'hover:bg-[#FFF8F4]'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleStudent(student.id)}
                                className="sr-only"
                              />
                              <span
                                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                                  isChecked
                                    ? 'text-[#922235]'
                                    : 'text-[#697589]/60'
                                }`}
                              >
                                {isChecked ? (
                                  <CheckSquare className="w-5 h-5" />
                                ) : (
                                  <Square className="w-5 h-5" />
                                )}
                              </span>

                              <span className="text-[11px] font-mono font-black px-1.5 py-0.5 rounded bg-[#F5EDEB] text-[#922235] border border-[#E8DEDA] shrink-0">
                                #{codeDisplay}
                              </span>

                              <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-bold text-[#233146] uppercase truncate flex items-center gap-1.5">
                                  <span className="truncate">{student.name}</span>
                                  {isHighlighted && (
                                    <span className="text-[10px] normal-case font-bold px-1.5 py-0.2 rounded bg-white text-[#922235] border border-[#E8DEDA] shrink-0">
                                      Đang xem
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {groupNum ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white text-[#697589] border border-[#E8DEDA]">
                                  Tổ {groupNum}
                                </span>
                              ) : (
                                <span className="text-[10px] text-[#697589]/70 italic hidden sm:inline">
                                  Chưa xếp tổ
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN (5 cols): Live Preview Panel */}
            <div className="lg:col-span-5 lg:sticky lg:top-0">
              <div className="bg-white rounded-2xl border border-[#E8DEDA] p-4 sm:p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#E8DEDA] pb-2.5">
                  <h4 className="text-xs font-black text-[#233146] uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-[#922235]" />
                    <span>3. Xem trước trước khi xác nhận</span>
                  </h4>
                  <span className="text-[11px] font-bold text-[#697589]">
                    {selectedStudentIds.length} bản ghi
                  </span>
                </div>

                {/* Summary metadata block */}
                <div className="rounded-2xl bg-[#FFF8F4] border border-[#E8DEDA] p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#697589] font-medium">Ngày vi phạm:</span>
                    <span className="font-bold text-[#233146]">
                      {violationDate ? formatDisplayDate(violationDate) : '--'} ({semesterDisplayLabel})
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[#697589] font-medium shrink-0">Lỗi vi phạm:</span>
                    <span className="font-bold text-[#233146] text-right">
                      {selectedRule ? selectedRule.name : 'Chưa chọn lỗi'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#697589] font-medium">Điểm trừ mỗi HS:</span>
                    <span className="font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      {selectedRule ? `-${selectedRule.points} điểm` : '--'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#697589] font-medium">Số học sinh áp dụng:</span>
                    <span className="font-black text-[#922235]">
                      {selectedStudentIds.length} học sinh
                    </span>
                  </div>
                  {commonNote.trim() && (
                    <div className="pt-1.5 border-t border-[#E8DEDA] flex items-start justify-between gap-2">
                      <span className="text-[#697589] font-medium shrink-0">Ghi chú:</span>
                      <span className="text-[#233146] text-right italic">{commonNote.trim()}</span>
                    </div>
                  )}
                </div>

                {/* Duplicate same-day warning if any selected student already has this violation on this date */}
                {duplicateSameDayIds.size > 0 && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Lưu ý: Có <strong>{duplicateSameDayIds.size} học sinh</strong> đã được ghi nhận cùng lỗi này trong ngày{' '}
                      <strong>{formatDisplayDate(violationDate)}</strong> (được đánh dấu bên dưới). Vui lòng kiểm tra để tránh trừ điểm trùng.
                    </span>
                  </div>
                )}

                {/* Selected Students Preview List */}
                {selectedStudentIds.length === 0 ? (
                  <div className="py-10 px-4 text-center rounded-2xl border border-dashed border-[#E8DEDA] bg-[#FFF8F4]/50">
                    <Users className="w-8 h-8 text-[#E8DEDA] mx-auto mb-2" />
                    <p className="text-xs font-bold text-[#233146]">Chưa chọn học sinh nào</p>
                    <p className="text-[11px] text-[#697589] mt-1">
                      Tích chọn học sinh hoặc bấm nút chọn tổ bên trái để xem trước danh sách sẽ ghi nhận.
                    </p>
                  </div>
                ) : (
                  <div className="border border-[#E8DEDA] rounded-2xl overflow-hidden">
                    <div className="bg-[#F5EDEB]/70 px-3 py-2 border-b border-[#E8DEDA] flex items-center justify-between text-[11px] font-bold text-[#233146]">
                      <span>Danh sách học sinh ({previewRows.length})</span>
                      <span>Điểm trừ / Dự kiến</span>
                    </div>
                    <div className="max-h-[270px] overflow-y-auto divide-y divide-[#E8DEDA]/70 custom-scrollbar bg-white">
                      {previewRows.map((row, idx) => (
                        <div
                          key={row.student.id}
                          className="px-3 py-2 flex items-center justify-between gap-2 text-xs hover:bg-[#FFF8F4]/70"
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[#697589] w-5 shrink-0">
                              {idx + 1}.
                            </span>
                            <div className="min-w-0">
                              <p className="font-bold text-[#233146] uppercase truncate">
                                {row.student.name}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] text-[#697589] flex-wrap">
                                <span className="font-mono">#{row.code}</span>
                                {row.groupNum && <span>• Tổ {row.groupNum}</span>}
                                {row.hasSameViolationSameDay && (
                                  <span className="text-amber-700 font-bold bg-amber-50 border border-amber-200 px-1 rounded">
                                    Đã có lỗi này hôm nay
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <span className="font-black text-rose-700 block leading-tight">
                                -{selectedRule?.points ?? 0}đ
                              </span>
                              <span className="text-[10px] text-[#697589] block">
                                {row.currentPoints} → <strong>{row.projectedPoints}</strong>/{semesterBasePoints}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleStudent(row.student.id)}
                              className="p-1 rounded-lg text-[#697589] hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="Bỏ học sinh này khỏi danh sách"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview Simulation Result Banner */}
                {previewSimulationResult && !isPersistenceEnabled && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1 animate-fadeIn">
                    <div className="flex items-center gap-1.5 font-black text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Đã kiểm tra luồng xem trước thành công!</span>
                    </div>
                    <p className="leading-relaxed">
                      Sẵn sàng tạo <strong>{previewSimulationResult.count} bản ghi vi phạm riêng biệt</strong> cho{' '}
                      <strong>{previewSimulationResult.count} học sinh</strong> — Ngày{' '}
                      <strong>{formatDisplayDate(previewSimulationResult.date)}</strong> ({previewSimulationResult.semesterLabel}{' '}
                      {previewSimulationResult.schoolYear}) — Lỗi{' '}
                      <strong>{previewSimulationResult.ruleName}</strong> (<strong>-{previewSimulationResult.points}đ/HS</strong>).
                    </p>
                    <p className="text-[11px] text-emerald-700 font-semibold pt-0.5">
                      * Chưa ghi dữ liệu thật vào Supabase. Hãy xác nhận để kích hoạt lưu hàng loạt.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-[#E8DEDA] bg-[#FFF8F4] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-[#697589] text-center sm:text-left">
            {isPersistenceEnabled ? (
              <span>
                Mỗi học sinh sẽ được tạo 1 bản ghi riêng biệt và cập nhật đồng bộ vào Supabase.
              </span>
            ) : (
              <span>
                Đang ở chế độ <strong className="text-[#922235]">Kiểm tra giao diện &amp; Xem trước</strong> (không ghi vào Supabase).
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-white hover:bg-[#F5EDEB] text-[#233146] font-bold rounded-xl text-xs sm:text-sm border border-[#E8DEDA] transition-colors cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleConfirmSubmit}
              disabled={!canConfirm}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-[#922235] hover:bg-[#781C2B] text-white font-black rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isSubmitting
                ? 'Đang lưu...'
                : 'XÁC NHẬN GHI NHẬN HÀNG LOẠT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
