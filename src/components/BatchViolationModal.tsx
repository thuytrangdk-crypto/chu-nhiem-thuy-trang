import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Users,
  CheckSquare,
  Square,
  AlertTriangle,
  Calendar,
  FileWarning,
  Eye,
  CheckCircle2,
  ShieldAlert,
  RotateCcw,
  Loader2,
  Database,
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
  BatchGenderFilter,
  BatchSaveResult,
  buildBatchDisciplinePayloads,
  buildStudentGroupData,
  createBatchRequestId,
  filterBatchStudents,
  findExistingSameDayViolationStudentIds,
  getViolationRules,
} from '../utils/batchDisciplineHelpers';

interface BatchViolationModalProps {
  isOpen: boolean;
  state: AppState;
  onClose: () => void;
  onShowToast?: (msg: string, type?: 'success' | 'error') => void;
  /**
   * Live Supabase persistence is enabled by default for official teacher usage.
   */
  isPersistenceEnabled?: boolean;
  onConfirmBatchSave?: (
    records: Omit<DisciplineRecord, 'id'>[],
    batchId: string
  ) => Promise<BatchSaveResult> | BatchSaveResult;
  highlightStudentId?: string | null;
}

export const BatchViolationModal: React.FC<BatchViolationModalProps> = ({
  isOpen,
  state,
  onClose,
  onShowToast,
  isPersistenceEnabled = true,
  onConfirmBatchSave,
  highlightStudentId,
}) => {
  const violationRules = useMemo(() => getViolationRules(state.config.rules), [state.config.rules]);
  const semesterBasePoints = getSemesterBasePoints(state.config);

  const [violationDate, setViolationDate] = useState<string>(() => getTodayVietnamYMD());
  const [selectedRuleId, setSelectedRuleId] = useState<string>(() => violationRules[0]?.id || '');
  const [commonNote, setCommonNote] = useState<string>('');
  const [activeGroupFilter, setActiveGroupFilter] = useState<number | 'all'>('all');
  const [activeGenderFilter, setActiveGenderFilter] = useState<BatchGenderFilter>('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isFinalConfirmOpen, setIsFinalConfirmOpen] = useState<boolean>(false);
  const [saveErrorSummary, setSaveErrorSummary] = useState<{
    savedCount: number;
    failedCount: number;
    error: string;
  } | null>(null);
  const [previewSimulationResult, setPreviewSimulationResult] = useState<{
    count: number;
    date: string;
    ruleName: string;
    points: number;
    semesterLabel: string;
    schoolYear: string;
  } | null>(null);

  // Track open transition so background config updates never wipe current selection
  const wasOpenRef = useRef<boolean>(false);
  // Auto-expanding shared note textarea ref
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);
  // Prevent rapid double-click duplicate submissions
  const submitInFlightRef = useRef<boolean>(false);
  // Idempotent batchId tied to the exact current selection signature so safe retries never duplicate records
  const pendingBatchRef = useRef<{ signature: string; batchId: string } | null>(null);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setViolationDate(getTodayVietnamYMD());
      setSelectedRuleId((prev) =>
        violationRules.some((r) => r.id === prev) ? prev : violationRules[0]?.id || ''
      );
      setCommonNote('');
      setActiveGroupFilter('all');
      setActiveGenderFilter('all');
      setSelectedStudentIds([]);
      setIsSubmitting(false);
      setIsFinalConfirmOpen(false);
      setSaveErrorSummary(null);
      setPreviewSimulationResult(null);
      submitInFlightRef.current = false;
      pendingBatchRef.current = null;
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, violationRules]);

  // Auto-resize shared note textarea smoothly (42px initial, expands up to 112px for longer notes)
  useEffect(() => {
    const el = noteTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(Math.max(el.scrollHeight, 42), 112);
    el.style.height = `${nextHeight}px`;
  }, [commonNote, isOpen]);

  // Lock background page scroll while modal is open and restore original overflow on close
  useEffect(() => {
    if (!isOpen) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [isOpen]);

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

  // Gender counts within the currently selected group (strictly from student.gender)
  const genderCountsInGroup = useMemo(() => {
    const groupScoped = filterBatchStudents(sortedStudents, studentGroupMap, activeGroupFilter, 'all');
    return {
      Nam: groupScoped.filter((s) => s.gender === 'Nam').length,
      Nữ: groupScoped.filter((s) => s.gender === 'Nữ').length,
    };
  }, [sortedStudents, studentGroupMap, activeGroupFilter]);

  // Filtered students for display ONLY (never modifies selection state)
  const filteredStudents = useMemo(
    () =>
      filterBatchStudents(
        sortedStudents,
        studentGroupMap,
        activeGroupFilter,
        activeGenderFilter
      ),
    [sortedStudents, studentGroupMap, activeGroupFilter, activeGenderFilter]
  );

  const isAnyFilterActive = activeGroupFilter !== 'all' || activeGenderFilter !== 'all';

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

  const toggleStudent = useCallback((studentId: string) => {
    setPreviewSimulationResult(null);
    setSaveErrorSummary(null);
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  }, []);

  const handleSelectAllFiltered = useCallback(() => {
    setPreviewSimulationResult(null);
    setSaveErrorSummary(null);
    const filteredIds = filteredStudents.map((s) => s.id);
    setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
  }, [filteredStudents]);

  const handleClearSelection = useCallback(() => {
    setPreviewSimulationResult(null);
    setSaveErrorSummary(null);
    setSelectedStudentIds([]);
  }, []);

  const handleToggleGroupFilter = useCallback((groupNumber: number | 'all') => {
    setActiveGroupFilter((prev) => (prev === groupNumber ? 'all' : groupNumber));
  }, []);

  const handleToggleGenderFilter = useCallback((gender: 'Nam' | 'Nữ') => {
    setActiveGenderFilter((prev) => (prev === gender ? 'all' : gender));
  }, []);

  if (!isOpen) return null;

  const validateBeforeConfirm = (): boolean => {
    if (!selectedRule) {
      onShowToast?.('Vui lòng chọn lỗi vi phạm từ danh mục đã cài đặt.', 'error');
      return false;
    }
    if (!violationDate) {
      onShowToast?.('Vui lòng chọn ngày vi phạm.', 'error');
      return false;
    }
    if (selectedStudentIds.length === 0) {
      onShowToast?.('Vui lòng chọn ít nhất 1 học sinh để ghi nhận.', 'error');
      return false;
    }
    return true;
  };

  // Step 1: Click primary button -> either run preview check (if disabled) or open final confirmation dialog
  const handlePrimaryConfirmClick = () => {
    if (isSubmitting || submitInFlightRef.current) return;
    if (!validateBeforeConfirm() || !selectedRule) return;

    if (!isPersistenceEnabled || !onConfirmBatchSave) {
      const payloads = buildBatchDisciplinePayloads({
        studentIds: selectedStudentIds,
        date: violationDate,
        rule: selectedRule,
        note: commonNote,
        config: state.config,
      });
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

    setSaveErrorSummary(null);
    setIsFinalConfirmOpen(true);
  };

  // Step 2: Teacher explicitly confirms in the final dialog -> execute atomic Supabase write
  const handleExecuteLiveSave = async () => {
    if (isSubmitting || submitInFlightRef.current) return;
    if (!validateBeforeConfirm() || !selectedRule || !onConfirmBatchSave) return;

    const payloads = buildBatchDisciplinePayloads({
      studentIds: selectedStudentIds,
      date: violationDate,
      rule: selectedRule,
      note: commonNote,
      config: state.config,
    });

    const selectionSignature = `${violationDate}|${selectedRule.id}|${commonNote.trim()}|${[
      ...selectedStudentIds,
    ]
      .sort()
      .join(',')}`;

    if (!pendingBatchRef.current || pendingBatchRef.current.signature !== selectionSignature) {
      pendingBatchRef.current = {
        signature: selectionSignature,
        batchId: createBatchRequestId(),
      };
    }

    const activeBatchId = pendingBatchRef.current.batchId;

    submitInFlightRef.current = true;
    setIsSubmitting(true);
    setSaveErrorSummary(null);

    try {
      const result = await onConfirmBatchSave(payloads, activeBatchId);
      if (result.success) {
        pendingBatchRef.current = null;
        setIsFinalConfirmOpen(false);
        const savedCount = result.savedCount > 0 ? result.savedCount : payloads.length;
        onShowToast?.(
          `Đã ghi nhận vi phạm thành công cho ${savedCount} học sinh.`,
          'success'
        );
        onClose();
      } else {
        const errorMsg =
          result.error ||
          'Không thể lưu ghi nhận vi phạm hàng loạt lên Supabase. Dữ liệu chưa bị thay đổi.';
        setIsFinalConfirmOpen(false);
        setSaveErrorSummary({
          savedCount: result.savedCount ?? 0,
          failedCount: result.failedCount ?? payloads.length,
          error: errorMsg,
        });
        onShowToast?.(errorMsg, 'error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const errorMsg = `Lỗi khi lưu vi phạm hàng loạt: ${msg}`;
      setIsFinalConfirmOpen(false);
      setSaveErrorSummary({
        savedCount: 0,
        failedCount: payloads.length,
        error: errorMsg,
      });
      onShowToast?.(errorMsg, 'error');
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const canConfirm = Boolean(selectedRule && violationDate && selectedStudentIds.length > 0 && !isSubmitting);
  const semesterDisplayLabel = dateResolution.semester === 'HK1' ? 'Học kỳ I' : 'Học kỳ II';

  const modalContent = (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center p-2 sm:p-4 bg-black/55 backdrop-blur-xs"
      onClick={() => {
        if (!isSubmitting && !isFinalConfirmOpen) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Ghi nhận vi phạm hàng loạt"
    >
      <div
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[92vh] lg:max-h-[820px] overflow-hidden flex flex-col border border-[#E8DEDA]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pinned Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-[#E8DEDA] bg-[#FFF8F4] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#922235] text-white flex items-center justify-center shadow-sm shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-[#233146] uppercase tracking-tight">
                  Ghi nhận vi phạm hàng loạt
                </h3>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#F5EDEB] text-[#922235] border border-[#E8DEDA]">
                  Lớp {state.config.className}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-[#697589] mt-0.5 truncate">
                Một lỗi – một ngày – nhiều học sinh • Tái sử dụng đúng danh mục lỗi và điểm trừ hiện có
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white hover:bg-[#F5EDEB] text-[#697589] hover:text-[#233146] flex items-center justify-center border border-[#E8DEDA] transition-colors cursor-pointer shrink-0 disabled:opacity-45 disabled:cursor-not-allowed"
            title="Đóng"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Pinned Preview-Only Mode Banner */}
        {!isPersistenceEnabled && (
          <div className="px-4 sm:px-6 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-amber-900 text-[11px] sm:text-xs shrink-0">
            <Eye className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold">
              Chế độ kiểm tra giao diện &amp; xem trước: Chưa kích hoạt ghi dữ liệu thật vào Supabase.
            </span>
          </div>
        )}

        {/* Main Workspace: Independent Left & Right Scroll Columns on Desktop (no nested scrollbars) */}
        <div className="flex-1 min-h-0 bg-[#FFF8F4]/40 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-4 p-3 sm:p-4 [overflow-anchor:none]">
          {/* LEFT COLUMN (7 cols): Compact Violation Config + Independent Student List */}
          <div className="lg:col-span-7 flex flex-col gap-3 min-h-0">
            {/* Step 1: Compact Violation Info */}
            <div className="bg-white rounded-2xl border border-[#E8DEDA] p-3.5 space-y-2.5 shadow-2xs shrink-0">
              <div className="flex items-center justify-between border-b border-[#E8DEDA] pb-2">
                <h4 className="text-[11px] font-black text-[#233146] uppercase tracking-wider flex items-center gap-1.5">
                  <FileWarning className="w-3.5 h-3.5 text-[#922235]" />
                  <span>1. Thông tin lỗi vi phạm</span>
                </h4>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-[#922235] bg-[#F5EDEB] px-2 py-0.5 rounded-lg border border-[#E8DEDA]">
                    {semesterDisplayLabel} • {dateResolution.schoolYear}
                  </span>
                  <span className="text-[11px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                    {selectedRule ? `-${selectedRule.points}đ / HS` : '--'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                {/* Date */}
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-bold text-[#233146] mb-1">
                    Ngày vi phạm <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 text-[#922235] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date"
                      value={violationDate}
                      onChange={(e) => {
                        setPreviewSimulationResult(null);
                        setSaveErrorSummary(null);
                        setViolationDate(e.target.value);
                      }}
                      className="w-full pl-8 pr-2.5 py-2 bg-[#FFF8F4]/50 border border-[#E8DEDA] rounded-xl text-xs font-bold text-[#233146] focus:bg-white focus:ring-2 focus:ring-[#922235] focus:border-[#922235] outline-none"
                    />
                  </div>
                </div>

                {/* Violation Rule Selector */}
                <div className="sm:col-span-7">
                  <label className="block text-[11px] font-bold text-[#233146] mb-1">
                    Lỗi vi phạm (Danh mục đã cài đặt) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedRuleId}
                    onChange={(e) => {
                      setPreviewSimulationResult(null);
                      setSaveErrorSummary(null);
                      setSelectedRuleId(e.target.value);
                    }}
                    className="w-full px-2.5 py-2 bg-white border border-[#E8DEDA] rounded-xl text-xs font-semibold text-[#233146] focus:ring-2 focus:ring-[#922235] focus:border-[#922235] outline-none cursor-pointer"
                  >
                    {violationRules.length === 0 ? (
                      <option value="">
                        Chưa có lỗi vi phạm nào (vào Cài đặt → Quy tắc thi đua)
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

              {/* Row 2: Full-width auto-expanding Shared Note */}
              <div>
                <label
                  htmlFor="batch-violation-common-note"
                  className="block text-[11px] font-bold text-[#233146] mb-1"
                >
                  Ghi chú chung <span className="font-normal text-[#697589]">(không bắt buộc)</span>
                </label>
                <textarea
                  id="batch-violation-common-note"
                  ref={noteTextareaRef}
                  rows={1}
                  value={commonNote}
                  onChange={(e) => {
                    setPreviewSimulationResult(null);
                    setSaveErrorSummary(null);
                    setCommonNote(e.target.value);
                  }}
                  placeholder="Ghi chú chung (tùy chọn, VD: Tiết 2 môn Toán, không làm bài tập về nhà...)"
                  className="w-full min-h-[42px] max-h-28 px-3 py-2.5 bg-[#FFF8F4]/50 border border-[#E8DEDA] rounded-xl text-xs text-[#233146] leading-relaxed focus:bg-white focus:ring-2 focus:ring-[#922235] focus:border-[#922235] outline-none resize-none overflow-y-auto custom-scrollbar"
                />
              </div>

              {/* Out of configured semester range warning */}
              {!dateResolution.isWithinConfiguredRange && dateResolution.warningMessage && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>{dateResolution.warningMessage}</span>
                </div>
              )}
            </div>

            {/* Step 2: Multi-Student Selector with Maximized Independent Scroll Area */}
            <div className="bg-white rounded-2xl border border-[#E8DEDA] p-3.5 flex flex-col gap-2 shadow-2xs flex-1 min-h-[360px] lg:min-h-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8DEDA] pb-2 shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-[11px] font-black text-[#233146] uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-[#922235]" />
                    <span>2. Chọn học sinh lớp {state.config.className}</span>
                  </h4>
                  {isAnyFilterActive && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#FFF8F4] text-[#697589] border border-[#E8DEDA]">
                      Đang hiện: {filteredStudents.length} HS
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-[#922235] text-white shadow-2xs">
                  Đã chọn: {selectedStudentIds.length} / {sortedStudents.length} HS
                </span>
              </div>

              {/* Pure Display Filters (Tổ 1–4 + Nam/Nữ) + Clear Selection Controls */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 shrink-0">
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setActiveGroupFilter('all')}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                      activeGroupFilter === 'all'
                        ? 'bg-[#233146] text-white border-[#233146] shadow-2xs'
                        : 'bg-white text-[#233146] border-[#E8DEDA] hover:bg-[#F5EDEB]'
                    }`}
                    title="Hiển thị tất cả các tổ"
                  >
                    Tất cả
                  </button>

                  {groups.map((grp) => {
                    const count = grp.studentIds.length;
                    const isActiveGroup = activeGroupFilter === grp.groupNumber;
                    const selectedInGroup = grp.studentIds.filter((id) =>
                      selectedIdSet.has(id)
                    ).length;

                    return (
                      <button
                        key={grp.groupNumber}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleToggleGroupFilter(grp.groupNumber)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                          isActiveGroup
                            ? 'bg-[#922235] text-white border-[#922235] shadow-2xs'
                            : selectedInGroup > 0
                            ? 'bg-[#F5EDEB] text-[#922235] border-[#922235]/50'
                            : 'bg-white text-[#233146] border-[#E8DEDA] hover:bg-[#F5EDEB]'
                        }`}
                        title={
                          isActiveGroup
                            ? `Đang lọc ${grp.label} — bấm lại để hiện tất cả các tổ`
                            : `Lọc hiển thị học sinh ${grp.label} (${count} HS)`
                        }
                      >
                        {grp.label}
                        <span className="opacity-75 ml-0.5">({count})</span>
                      </button>
                    );
                  })}

                  <span className="h-4 w-px bg-[#E8DEDA] mx-0.5" />

                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleToggleGenderFilter('Nam')}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                      activeGenderFilter === 'Nam'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-white text-blue-700 border-[#E8DEDA] hover:bg-blue-50'
                    }`}
                    title={
                      activeGenderFilter === 'Nam'
                        ? 'Đang lọc học sinh Nam — bấm lại để bỏ lọc giới tính'
                        : `Lọc hiển thị học sinh Nam (${genderCountsInGroup.Nam} HS)`
                    }
                  >
                    Nam <span className="opacity-80">({genderCountsInGroup.Nam})</span>
                  </button>

                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleToggleGenderFilter('Nữ')}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                      activeGenderFilter === 'Nữ'
                        ? 'bg-pink-600 text-white border-pink-600 shadow-2xs'
                        : 'bg-white text-pink-700 border-[#E8DEDA] hover:bg-pink-50'
                    }`}
                    title={
                      activeGenderFilter === 'Nữ'
                        ? 'Đang lọc học sinh Nữ — bấm lại để bỏ lọc giới tính'
                        : `Lọc hiển thị học sinh Nữ (${genderCountsInGroup.Nữ} HS)`
                    }
                  >
                    Nữ <span className="opacity-80">({genderCountsInGroup.Nữ})</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleSelectAllFiltered}
                    disabled={filteredStudents.length === 0}
                    className="px-2.5 py-1 rounded-lg bg-[#F5EDEB] hover:bg-[#E8DEDA] text-[#233146] text-[11px] font-bold border border-[#E8DEDA] transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                    title="Chỉ chọn các học sinh đang hiển thị theo bộ lọc hiện tại (giữ nguyên các học sinh đã chọn ở tổ/nhóm khác)"
                  >
                    Chọn tất cả{isAnyFilterActive ? ` (${filteredStudents.length})` : ''}
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleClearSelection}
                    disabled={selectedStudentIds.length === 0}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 text-[#922235] text-[11px] font-bold border border-[#E8DEDA] flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                    title="Bỏ chọn toàn bộ học sinh đã chọn"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Bỏ chọn tất cả</span>
                  </button>
                </div>
              </div>

              {/* Independent Scrollable Student List (NO sr-only hidden inputs, NO focus scroll jumps) */}
              <div
                data-testid="batch-student-list-scroll"
                className="flex-1 min-h-0 border border-[#E8DEDA] rounded-xl overflow-y-auto overscroll-contain bg-white divide-y divide-[#E8DEDA]/70 custom-scrollbar [overflow-anchor:none] [scroll-behavior:auto]"
              >
                {filteredStudents.length === 0 ? (
                  <div className="py-10 px-4 text-center space-y-2">
                    <p className="text-xs text-[#697589] italic">
                      Không có học sinh nào thuộc bộ lọc hiện tại.
                    </p>
                    {isAnyFilterActive && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setActiveGroupFilter('all');
                          setActiveGenderFilter('all');
                        }}
                        className="px-3 py-1 rounded-lg bg-[#F5EDEB] hover:bg-[#E8DEDA] text-[#922235] text-[11px] font-bold border border-[#E8DEDA] cursor-pointer"
                      >
                        Hiển thị toàn bộ lớp
                      </button>
                    )}
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
                      <button
                        key={student.id}
                        type="button"
                        role="checkbox"
                        aria-checked={isChecked}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => toggleStudent(student.id)}
                        className={`w-full text-left flex items-center justify-between gap-2.5 px-3 py-2 cursor-pointer transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#922235] ${
                          isChecked ? 'bg-[#F5EDEB]/90' : 'hover:bg-[#FFF8F4]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                              isChecked ? 'text-[#922235]' : 'text-[#697589]/60'
                            }`}
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                            ) : (
                              <Square className="w-4 h-4 sm:w-5 sm:h-5" />
                            )}
                          </span>

                          <span className="text-[11px] font-mono font-black px-1.5 py-0.5 rounded bg-[#F5EDEB] text-[#922235] border border-[#E8DEDA] shrink-0">
                            #{codeDisplay}
                          </span>

                          <span className="text-xs font-bold text-[#233146] uppercase truncate flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{student.name}</span>
                            {isHighlighted && (
                              <span className="text-[10px] normal-case font-bold px-1.5 py-0.2 rounded bg-white text-[#922235] border border-[#E8DEDA] shrink-0">
                                Đang xem
                              </span>
                            )}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                              student.gender === 'Nam'
                                ? 'bg-blue-50/70 text-blue-700 border-blue-200/70'
                                : 'bg-pink-50/70 text-pink-700 border-pink-200/70'
                            }`}
                          >
                            {student.gender}
                          </span>
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
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (5 cols): Independent Live Preview Panel */}
          <div className="lg:col-span-5 flex flex-col min-h-[280px] lg:min-h-0">
            <div className="bg-white rounded-2xl border border-[#E8DEDA] p-3.5 sm:p-4 flex flex-col gap-3 shadow-xs flex-1 min-h-0 overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#E8DEDA] pb-2 shrink-0">
                <h4 className="text-[11px] font-black text-[#233146] uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-[#922235]" />
                  <span>3. Xem trước trước khi xác nhận</span>
                </h4>
                <span className="text-[11px] font-bold text-[#922235] bg-[#F5EDEB] px-2 py-0.5 rounded-md border border-[#E8DEDA]">
                  {selectedStudentIds.length} bản ghi
                </span>
              </div>

              {/* Summary metadata block */}
              <div className="rounded-xl bg-[#FFF8F4] border border-[#E8DEDA] p-3 space-y-1.5 text-xs shrink-0">
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
                <div className="pt-1.5 border-t border-[#E8DEDA] flex items-start justify-between gap-2">
                  <span className="text-[#697589] font-medium shrink-0">Ghi chú:</span>
                  <span
                    className={`text-right whitespace-pre-wrap break-words max-h-20 overflow-y-auto custom-scrollbar ${
                      commonNote.trim()
                        ? 'text-[#233146] font-semibold'
                        : 'text-[#697589]/70 italic'
                    }`}
                  >
                    {commonNote.trim() || 'Không có ghi chú'}
                  </span>
                </div>
              </div>

              {/* Duplicate same-day warning */}
              {duplicateSameDayIds.size > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed flex items-start gap-2 shrink-0">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Có <strong>{duplicateSameDayIds.size} HS</strong> đã có cùng lỗi này ngày{' '}
                    <strong>{formatDisplayDate(violationDate)}</strong>. Kiểm tra để tránh trừ trùng.
                  </span>
                </div>
              )}

              {/* Independent Scrollable Selected Students Preview List */}
              {selectedStudentIds.length === 0 ? (
                <div className="flex-1 min-h-[140px] flex flex-col items-center justify-center p-5 text-center rounded-xl border border-dashed border-[#E8DEDA] bg-[#FFF8F4]/50">
                  <Users className="w-8 h-8 text-[#E8DEDA] mb-2" />
                  <p className="text-xs font-bold text-[#233146]">Chưa chọn học sinh nào</p>
                  <p className="text-[11px] text-[#697589] mt-1">
                    Tích chọn học sinh bên trái hoặc dùng bộ lọc Tổ / Nam – Nữ để lọc danh sách hiển thị.
                  </p>
                </div>
              ) : (
                <div className="flex-1 min-h-[160px] lg:min-h-0 border border-[#E8DEDA] rounded-xl overflow-hidden flex flex-col">
                  <div className="bg-[#F5EDEB]/70 px-3 py-1.5 border-b border-[#E8DEDA] flex items-center justify-between text-[11px] font-bold text-[#233146] shrink-0">
                    <span>Danh sách đã chọn ({previewRows.length})</span>
                    <span>Điểm trừ / Dự kiến</span>
                  </div>
                  <div
                    data-testid="batch-preview-list-scroll"
                    className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-[#E8DEDA]/70 custom-scrollbar bg-white [overflow-anchor:none] [scroll-behavior:auto]"
                  >
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
                                  Đã có lỗi hôm nay
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
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
                            onMouseDown={(e) => e.preventDefault()}
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

              {/* Live Save Failure Summary Banner */}
              {saveErrorSummary && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 text-[11px] space-y-1.5 shrink-0">
                  <div className="flex items-center gap-1.5 font-black text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Lưu dữ liệu không thành công</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-bold">
                    <span className="text-emerald-700">Thành công: {saveErrorSummary.savedCount}</span>
                    <span className="text-rose-700">Thất bại: {saveErrorSummary.failedCount}</span>
                  </div>
                  <p className="leading-relaxed text-rose-900">
                    <strong>Lý do:</strong> {saveErrorSummary.error}
                  </p>
                  <p className="text-[10px] text-rose-800/90">
                    Hệ thống giữ nguyên dữ liệu cũ (không ghi dở dang). Thầy/Cô có thể bấm xác nhận lại để thử lưu an toàn mà không bị tạo trùng.
                  </p>
                </div>
              )}

              {/* Preview Simulation Result Banner (only when preview-only mode is explicitly forced) */}
              {previewSimulationResult && !isPersistenceEnabled && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] space-y-1 shrink-0">
                  <div className="flex items-center gap-1.5 font-black text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Đã kiểm tra luồng xem trước thành công!</span>
                  </div>
                  <p className="leading-relaxed">
                    Sẵn sàng tạo <strong>{previewSimulationResult.count} bản ghi</strong> — Ngày{' '}
                    <strong>{formatDisplayDate(previewSimulationResult.date)}</strong> ({previewSimulationResult.semesterLabel}) —{' '}
                    <strong>{previewSimulationResult.ruleName}</strong> (<strong>-{previewSimulationResult.points}đ/HS</strong>).
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pinned Footer (Always Visible) */}
        <div className="px-4 sm:px-6 py-3 border-t border-[#E8DEDA] bg-[#FFF8F4] flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <div className="text-[11px] sm:text-xs text-[#697589] text-center sm:text-left flex items-center gap-1.5">
            {isPersistenceEnabled ? (
              <>
                <Database className="w-3.5 h-3.5 text-[#922235] shrink-0 hidden sm:inline" />
                <span>
                  Mỗi học sinh sẽ được lưu thành 1 bản ghi riêng và tự động cập nhật điểm {semesterDisplayLabel} trên Supabase.
                </span>
              </>
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
              className="flex-1 sm:flex-none px-5 py-2 bg-white hover:bg-[#F5EDEB] text-[#233146] font-bold rounded-xl text-xs sm:text-sm border border-[#E8DEDA] transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handlePrimaryConfirmClick}
              disabled={!canConfirm}
              className="flex-1 sm:flex-none px-5 py-2 bg-[#922235] hover:bg-[#781C2B] text-white font-black rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <span>XÁC NHẬN GHI NHẬN HÀNG LOẠT</span>
              )}
            </button>
          </div>
        </div>

        {/* Final Confirmation Dialog Overlay (before real Supabase write) */}
        {isFinalConfirmOpen && selectedRule && (
          <div
            className="absolute inset-0 z-20 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4"
            onClick={() => {
              if (!isSubmitting) setIsFinalConfirmOpen(false);
            }}
            role="alertdialog"
            aria-modal="true"
            aria-label="Xác nhận lưu vi phạm hàng loạt vào Supabase"
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-[#E8DEDA] w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 bg-[#FFF8F4] border-b border-[#E8DEDA] flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#922235] text-white flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-[#233146] uppercase">
                    Xác nhận lưu dữ liệu vi phạm
                  </h4>
                  <p className="text-[11px] text-[#697589] mt-0.5">
                    Kiểm tra lần cuối trước khi ghi chính thức lên Supabase
                  </p>
                </div>
              </div>

              <div className="p-5 space-y-3 text-xs">
                <div className="rounded-xl bg-[#FFF8F4] border border-[#E8DEDA] p-3.5 space-y-2">
                  <div className="flex justify-between gap-2">
                    <span className="text-[#697589]">Lớp / Học kỳ:</span>
                    <span className="font-bold text-[#233146] text-right">
                      Lớp {state.config.className} • {semesterDisplayLabel} ({dateResolution.schoolYear})
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#697589]">Ngày vi phạm:</span>
                    <span className="font-bold text-[#233146]">
                      {formatDisplayDate(violationDate)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#697589] shrink-0">Lỗi vi phạm:</span>
                    <span className="font-bold text-[#233146] text-right">{selectedRule.name}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#697589]">Mức điểm trừ:</span>
                    <span className="font-black text-rose-700">
                      -{selectedRule.points} điểm / học sinh
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#697589]">Số bản ghi sẽ tạo:</span>
                    <span className="font-black text-[#922235]">
                      {selectedStudentsList.length} học sinh
                    </span>
                  </div>
                  {commonNote.trim() && (
                    <div className="flex justify-between gap-2 pt-1.5 border-t border-[#E8DEDA]">
                      <span className="text-[#697589] shrink-0">Ghi chú:</span>
                      <span className="font-semibold text-[#233146] text-right whitespace-pre-wrap break-words max-h-20 overflow-y-auto custom-scrollbar">
                        {commonNote.trim()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Concise list of selected students */}
                <div className="rounded-xl border border-[#E8DEDA] bg-white p-3">
                  <p className="text-[11px] font-bold text-[#697589] mb-1.5">
                    Danh sách học sinh áp dụng:
                  </p>
                  <p className="text-xs font-bold text-[#233146] leading-relaxed">
                    {selectedStudentsList
                      .slice(0, 6)
                      .map((s) => s.name)
                      .join(', ')}
                    {selectedStudentsList.length > 6
                      ? ` và ${selectedStudentsList.length - 6} học sinh khác.`
                      : '.'}
                  </p>
                </div>

                {duplicateSameDayIds.size > 0 && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Lưu ý: Có <strong>{duplicateSameDayIds.size} học sinh</strong> đã có cùng lỗi này trong ngày{' '}
                      <strong>{formatDisplayDate(violationDate)}</strong>. Nếu tiếp tục, hệ thống sẽ ghi nhận thêm bản ghi mới cho các em đó.
                    </span>
                  </div>
                )}
              </div>

              <div className="px-5 py-3.5 bg-[#FFF8F4] border-t border-[#E8DEDA] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsFinalConfirmOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-[#F5EDEB] text-[#233146] font-bold rounded-xl text-xs border border-[#E8DEDA] transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  Quay lại kiểm tra
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleExecuteLiveSave}
                  className="px-4 py-2 bg-[#922235] hover:bg-[#781C2B] text-white font-black rounded-xl text-xs shadow-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu vào Supabase...</span>
                    </>
                  ) : (
                    <span>Đồng ý &amp; Lưu ngay</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
