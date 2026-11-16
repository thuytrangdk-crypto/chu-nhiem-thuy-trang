import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Calendar,
  Clock,
  Award,
  CheckCircle2,
  AlertCircle,
  Download,
  ChevronRight,
  School,
  User,
} from 'lucide-react';
import { AppState } from '../types';
import {
  ReportPeriodType,
  ReportPeriodConfig,
  getVietnamNow,
  getWeekRange,
  getMonthRange,
  getAcademicYearRange,
  prepareClassEmulationExportData,
  prepareFullYearEmulationExportData,
  exportClassEmulationToExcel,
  normalizeToVNDateStr,
} from '../utils/emulationExport';
import {
  detectActiveSemester,
  getAvailableSchoolYears,
  getSemesterBasePoints,
  getSemesterYearConfig,
} from '../utils/semesterHelpers';
import { formatDisplayDate } from '../utils/helpers';

interface EmulationExportModalProps {
  isOpen: boolean;
  state: AppState;
  onClose: () => void;
  onShowToast?: (msg: string, type?: 'success' | 'error') => void;
}

export const EmulationExportModal: React.FC<EmulationExportModalProps> = ({
  isOpen,
  state,
  onClose,
  onShowToast,
}) => {
  const vnNow = useMemo(() => getVietnamNow(), []);
  const currentMonthStr = vnNow.dateStr.substring(0, 7);
  const semesterBasePoints = getSemesterBasePoints(state.config);
  const activeSemInfo = useMemo(() => detectActiveSemester(state.config), [state.config]);
  const availableSchoolYears = useMemo(
    () => getAvailableSchoolYears(state.config, state.discipline),
    [state.config, state.discipline]
  );

  // Period & year state
  const [periodType, setPeriodType] = useState<ReportPeriodType>('semester');
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>(activeSemInfo.schoolYear);

  // Sub-options
  const [weekSubOption, setWeekSubOption] = useState<'this_week' | 'last_week' | 'custom_week'>('this_week');
  const [customWeekRefDate, setCustomWeekRefDate] = useState<string>(vnNow.dateStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [semesterOption, setSemesterOption] = useState<'sem1' | 'sem2'>(
    activeSemInfo.semester === 'HK2' ? 'sem2' : 'sem1'
  );

  // Custom range
  const [customStartDate, setCustomStartDate] = useState<string>(vnNow.dateStr);
  const [customEndDate, setCustomEndDate] = useState<string>(vnNow.dateStr);

  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState<string>(vnNow.fullStr);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedSchoolYear(activeSemInfo.schoolYear);
    setSemesterOption(activeSemInfo.semester === 'HK2' ? 'sem2' : 'sem1');
    setErrorMessage(null);
  }, [isOpen, activeSemInfo.schoolYear, activeSemInfo.semester]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setCurrentTimeDisplay(getVietnamNow().fullStr);
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  const selectedYearCalendar = useMemo(
    () => getSemesterYearConfig(state.config, selectedSchoolYear),
    [state.config, selectedSchoolYear]
  );

  // Compute active date range and label based on selection
  const activePeriodConfig = useMemo<ReportPeriodConfig>(() => {
    let start = vnNow.dateStr;
    let end = vnNow.dateStr;
    let label = '';

    if (periodType === 'week') {
      if (weekSubOption === 'this_week') {
        const range = getWeekRange(undefined, 0);
        start = range.start;
        end = range.end;
        label = `Tuần này (${formatDisplayDate(start)} - ${formatDisplayDate(end)})`;
      } else if (weekSubOption === 'last_week') {
        const range = getWeekRange(undefined, -1);
        start = range.start;
        end = range.end;
        label = `Tuần trước (${formatDisplayDate(start)} - ${formatDisplayDate(end)})`;
      } else {
        const range = getWeekRange(customWeekRefDate, 0);
        start = range.start;
        end = range.end;
        label = `Tuần (${formatDisplayDate(start)} - ${formatDisplayDate(end)})`;
      }
    } else if (periodType === 'month') {
      const range = getMonthRange(selectedMonth);
      start = range.start;
      end = range.end;
      const [y, m] = selectedMonth.split('-');
      label = `Tháng ${Number(m)}/${y}`;
    } else if (periodType === 'semester') {
      const range = getAcademicYearRange(selectedSchoolYear, semesterOption, state.config);
      start = range.start;
      end = range.end;
      label = semesterOption === 'sem1' ? `Học kỳ I (${selectedSchoolYear})` : `Học kỳ II (${selectedSchoolYear})`;
    } else if (periodType === 'year') {
      const range = getAcademicYearRange(selectedSchoolYear, 'full', state.config);
      start = range.start;
      end = range.end;
      label = `Cả năm học ${selectedSchoolYear}`;
    } else if (periodType === 'custom') {
      start = normalizeToVNDateStr(customStartDate) || vnNow.dateStr;
      end = normalizeToVNDateStr(customEndDate) || vnNow.dateStr;
      if (start > end) {
        const temp = start;
        start = end;
        end = temp;
      }
      label = `Tùy chọn (${formatDisplayDate(start)} - ${formatDisplayDate(end)})`;
    }

    return {
      type: periodType,
      label,
      startDate: start,
      endDate: end,
      subOption: periodType === 'week' ? weekSubOption : semesterOption,
      schoolYear: selectedSchoolYear,
      semesterFilter:
        periodType === 'semester'
          ? semesterOption === 'sem2'
            ? 'HK2'
            : 'HK1'
          : periodType === 'year'
          ? 'ALL'
          : undefined,
    };
  }, [
    periodType,
    weekSubOption,
    customWeekRefDate,
    selectedMonth,
    semesterOption,
    selectedSchoolYear,
    customStartDate,
    customEndDate,
    state.config,
    vnNow.dateStr,
  ]);

  // Preview data calculation
  const previewData = useMemo(() => {
    if (periodType === 'year') {
      return prepareFullYearEmulationExportData(state, selectedSchoolYear);
    }
    if (periodType === 'semester') {
      return prepareClassEmulationExportData(
        state,
        activePeriodConfig.startDate,
        activePeriodConfig.endDate,
        [],
        {
          schoolYear: selectedSchoolYear,
          semester: semesterOption === 'sem2' ? 'HK2' : 'HK1',
        }
      );
    }
    return prepareClassEmulationExportData(
      state,
      activePeriodConfig.startDate,
      activePeriodConfig.endDate
    );
  }, [
    periodType,
    state,
    selectedSchoolYear,
    semesterOption,
    activePeriodConfig.startDate,
    activePeriodConfig.endDate,
  ]);

  if (!isOpen) return null;

  const cleanClassName = (state.config.className || 'Lop').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
  const expectedFileName = `Thi_dua_${cleanClassName}_${activePeriodConfig.startDate}_${activePeriodConfig.endDate}.xlsx`;

  const handleExport = () => {
    setErrorMessage(null);
    setIsExporting(true);

    setTimeout(() => {
      try {
        const result = exportClassEmulationToExcel(state, activePeriodConfig);
        if (result.success) {
          onShowToast?.(`Đã xuất báo cáo thi đua Lớp ${state.config.className} thành công!`, 'success');
          onClose();
        } else {
          setErrorMessage(result.error || 'Có lỗi xảy ra khi tạo tệp Excel.');
          onShowToast?.(result.error || 'Lỗi xuất file Excel', 'error');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(`Lỗi: ${msg}`);
        onShowToast?.(`Lỗi: ${msg}`, 'error');
      } finally {
        setIsExporting(false);
      }
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] border border-[#E8DEDA]">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-[#E8DEDA] bg-[#FFF8F4]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#781C2B] to-[#922235] text-white flex items-center justify-center shadow-md">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#233146] flex items-center gap-2">
                Xuất Excel Thi Đua
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F5EDEB] text-[#922235] border border-[#E8DEDA]">
                  Lớp {state.config.className}
                </span>
              </h3>
              <p className="text-xs text-[#697589] mt-0.5">
                Mỗi học kỳ độc lập {semesterBasePoints} điểm • Xuất .xlsx gồm Tổng hợp &amp; Chi tiết
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white hover:bg-[#F5EDEB] text-[#697589] hover:text-[#233146] flex items-center justify-center border border-[#E8DEDA] transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar">
          {/* Class & Timestamp Metadata Banner */}
          <div className="bg-[#FFF8F4] border border-[#E8DEDA] rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#233146]">
              <School className="w-4 h-4 text-[#922235] shrink-0" />
              <span>
                <strong>Lớp:</strong> {state.config.className} ({state.config.appName || 'Trường THCS'})
              </span>
            </div>
            <div className="flex items-center gap-2 text-[#233146]">
              <User className="w-4 h-4 text-[#781C2B] shrink-0" />
              <span>
                <strong>GVCN:</strong> {state.config.teacherName || 'Chưa cập nhật'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[#233146]">
              <Calendar className="w-4 h-4 text-[#922235] shrink-0" />
              <span>
                <strong>Năm học:</strong> {selectedSchoolYear} (Điểm gốc/HK:{' '}
                {semesterBasePoints}đ)
              </span>
            </div>
            <div className="flex items-center gap-2 text-[#233146]">
              <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Thời gian xuất:</strong> {currentTimeDisplay}
              </span>
            </div>
          </div>

          {/* Period Selector Heading */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
              <label className="block text-xs font-bold text-[#233146] uppercase tracking-wider">
                1. Chọn Kỳ Báo Cáo Thi Đua <span className="text-red-500">*</span>
              </label>

              {(periodType === 'semester' || periodType === 'year') && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-[#697589]">Năm học:</span>
                  <select
                    value={selectedSchoolYear}
                    onChange={(e) => setSelectedSchoolYear(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-[#E8DEDA] rounded-lg text-xs font-bold text-[#233146] focus:ring-2 focus:ring-[#922235] outline-none cursor-pointer"
                  >
                    {availableSchoolYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Main Period Tabs */}
            <div className="grid grid-cols-5 gap-1.5 p-1 bg-[#F5EDEB] rounded-2xl border border-[#E8DEDA]">
              {[
                { id: 'week', label: 'Tuần' },
                { id: 'month', label: 'Tháng' },
                { id: 'semester', label: 'Học kỳ' },
                { id: 'year', label: 'Cả năm' },
                { id: 'custom', label: 'Tùy chọn' },
              ].map((tab) => {
                const isActive = periodType === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setPeriodType(tab.id as ReportPeriodType);
                      setErrorMessage(null);
                    }}
                    className={`py-2 px-1 text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
                      isActive
                        ? 'bg-[#922235] text-white shadow-xs font-extrabold'
                        : 'text-[#233146] hover:bg-white/70'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sub options based on selected Period */}
          <div className="p-4 bg-[#FFF8F4] rounded-2xl border border-[#E8DEDA] space-y-3">
            {/* WEEK OPTIONS */}
            {periodType === 'week' && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[#233146]">Tùy chọn tuần báo cáo:</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setWeekSubOption('this_week')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      weekSubOption === 'this_week'
                        ? 'bg-[#922235] text-white border-[#922235] shadow-xs'
                        : 'bg-white text-[#233146] border-[#E8DEDA] hover:bg-[#F5EDEB]'
                    }`}
                  >
                    Tuần này
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeekSubOption('last_week')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      weekSubOption === 'last_week'
                        ? 'bg-[#922235] text-white border-[#922235] shadow-xs'
                        : 'bg-white text-[#233146] border-[#E8DEDA] hover:bg-[#F5EDEB]'
                    }`}
                  >
                    Tuần trước
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeekSubOption('custom_week')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      weekSubOption === 'custom_week'
                        ? 'bg-[#922235] text-white border-[#922235] shadow-xs'
                        : 'bg-white text-[#233146] border-[#E8DEDA] hover:bg-[#F5EDEB]'
                    }`}
                  >
                    Chọn ngày trong tuần khác
                  </button>
                </div>

                {weekSubOption === 'custom_week' && (
                  <div className="pt-2 flex items-center gap-3">
                    <span className="text-xs text-[#697589] font-medium">Chọn ngày bất kỳ trong tuần:</span>
                    <input
                      type="date"
                      value={customWeekRefDate}
                      onChange={(e) => setCustomWeekRefDate(e.target.value)}
                      className="px-3 py-1.5 bg-white border border-[#E8DEDA] rounded-xl text-xs font-semibold text-[#233146] focus:ring-2 focus:ring-[#922235] outline-none"
                    />
                  </div>
                )}
              </div>
            )}

            {/* MONTH OPTIONS */}
            {periodType === 'month' && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-[#233146]">Chọn tháng báo cáo thi đua:</span>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-3 py-2 bg-white border border-[#E8DEDA] rounded-xl text-xs sm:text-sm font-bold text-[#233146] focus:ring-2 focus:ring-[#922235] outline-none cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* SEMESTER OPTIONS */}
            {periodType === 'semester' && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[#233146]">
                  Chọn học kỳ trong năm học {selectedSchoolYear} (Mỗi kỳ khởi tạo độc lập {semesterBasePoints}đ):
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSemesterOption('sem1')}
                    className={`flex-1 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      semesterOption === 'sem1'
                        ? 'bg-[#922235] text-white border-[#922235] shadow-sm'
                        : 'bg-white text-[#233146] border-[#E8DEDA] hover:bg-[#F5EDEB]'
                    }`}
                  >
                    <div className="font-bold text-xs sm:text-sm">Học kỳ I</div>
                    <div className={`text-[11px] mt-0.5 ${semesterOption === 'sem1' ? 'text-white/85' : 'text-[#697589]'}`}>
                      Từ {formatDisplayDate(selectedYearCalendar.hk1Start)} đến{' '}
                      {formatDisplayDate(selectedYearCalendar.hk1End)}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSemesterOption('sem2')}
                    className={`flex-1 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      semesterOption === 'sem2'
                        ? 'bg-[#922235] text-white border-[#922235] shadow-sm'
                        : 'bg-white text-[#233146] border-[#E8DEDA] hover:bg-[#F5EDEB]'
                    }`}
                  >
                    <div className="font-bold text-xs sm:text-sm">Học kỳ II</div>
                    <div className={`text-[11px] mt-0.5 ${semesterOption === 'sem2' ? 'text-white/85' : 'text-[#697589]'}`}>
                      Từ {formatDisplayDate(selectedYearCalendar.hk2Start)} đến{' '}
                      {formatDisplayDate(selectedYearCalendar.hk2End)}
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* YEAR OPTIONS */}
            {periodType === 'year' && (
              <div className="text-xs text-[#233146] space-y-1.5">
                <p className="font-bold">Báo cáo cả năm học {selectedSchoolYear} (Tách riêng HK I &amp; HK II):</p>
                <p className="text-[#697589] leading-relaxed">
                  Xuất kết quả độc lập của cả Học kỳ I ({formatDisplayDate(selectedYearCalendar.hk1Start)} –{' '}
                  {formatDisplayDate(selectedYearCalendar.hk1End)}) và Học kỳ II (
                  {formatDisplayDate(selectedYearCalendar.hk2Start)} –{' '}
                  {formatDisplayDate(selectedYearCalendar.hk2End)}). Mỗi học kỳ tính theo thang điểm gốc{' '}
                  <strong className="text-[#922235]">{semesterBasePoints} điểm</strong>, không cộng dồn điểm trừ/thưởng giữa 2 kỳ.
                </p>
              </div>
            )}

            {/* CUSTOM DATE RANGE */}
            {periodType === 'custom' && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[#233146]">Khoảng ngày tùy chọn (bao gồm trọn cả 2 ngày):</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#697589] mb-1">Từ ngày:</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E8DEDA] rounded-xl text-xs font-semibold text-[#233146] focus:ring-2 focus:ring-[#922235] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#697589] mb-1">Đến ngày:</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E8DEDA] rounded-xl text-xs font-semibold text-[#233146] focus:ring-2 focus:ring-[#922235] outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Calculated Date Range Notice */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#E8DEDA] text-xs text-[#781C2B] font-semibold">
              <Calendar className="w-3.5 h-3.5 shrink-0 text-[#922235]" />
              <span>
                Khoảng ngày áp dụng: Từ <strong>{formatDisplayDate(activePeriodConfig.startDate)}</strong> đến{' '}
                <strong>{formatDisplayDate(activePeriodConfig.endDate)}</strong>
              </span>
            </div>
          </div>

          {/* Data Preview Summary Card */}
          <div>
            <label className="block text-xs font-bold text-[#233146] uppercase tracking-wider mb-2">
              2. Xem Trước Dữ Liệu Sẽ Xuất
            </label>
            <div className="bg-[#FFF8F4] border border-[#E8DEDA] rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-white p-2.5 rounded-xl border border-[#E8DEDA] shadow-2xs">
                  <div className="text-[10px] text-[#697589] font-bold uppercase">Tổng số học sinh</div>
                  <div className="text-base font-extrabold text-[#233146]">
                    {previewData.totalClassStudents} <span className="text-xs font-normal text-[#697589]">em</span>
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-[#E8DEDA] shadow-2xs">
                  <div className="text-[10px] text-[#697589] font-bold uppercase">Số lượt ghi nhận</div>
                  <div className="text-base font-extrabold text-[#922235]">
                    {previewData.totalPeriodRecords} <span className="text-xs font-normal text-[#697589]">lượt</span>
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-[#E8DEDA] shadow-2xs">
                  <div className="text-[10px] text-[#697589] font-bold uppercase">Lượt khen thưởng</div>
                  <div className="text-base font-extrabold text-emerald-600">
                    +{previewData.totalPeriodPlus}
                  </div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-[#E8DEDA] shadow-2xs">
                  <div className="text-[10px] text-[#697589] font-bold uppercase">Lượt vi phạm</div>
                  <div className="text-base font-extrabold text-rose-600">
                    -{previewData.totalPeriodMinus}
                  </div>
                </div>
              </div>

              {/* Structure Explanation */}
              <div className="bg-white rounded-xl p-3 border border-[#E8DEDA] text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-[#233146]">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Cấu trúc tệp Excel gồm 2 sheet:</span>
                </div>
                <ul className="space-y-1.5 text-[#697589] pl-5 list-disc text-[11px] leading-relaxed">
                  {periodType === 'year' ? (
                    <li>
                      <strong className="text-[#233146]">Sheet “Tổng hợp thi đua”:</strong> Xuất toàn bộ{' '}
                      {previewData.totalClassStudents} học sinh với các cột tách biệt rõ{' '}
                      <strong>HK I (Điểm thưởng, Điểm trừ, Điểm thi đua /{semesterBasePoints}, Hạnh kiểm)</strong> và{' '}
                      <strong>HK II (Điểm thưởng, Điểm trừ, Điểm thi đua /{semesterBasePoints}, Hạnh kiểm)</strong>.
                    </li>
                  ) : (
                    <li>
                      <strong className="text-[#233146]">Sheet “Tổng hợp thi đua”:</strong> Xuất toàn bộ{' '}
                      {previewData.totalClassStudents} học sinh của lớp (kể cả chưa có vi phạm hay khen thưởng). Bao gồm:
                      STT, Mã HS, Họ và tên, Lớp, Điểm gốc ({semesterBasePoints}đ), Tổng điểm cộng, Tổng điểm trừ, Điểm
                      thi đua còn lại (/{semesterBasePoints}), Xếp loại hạnh kiểm, Xếp hạng giảm dần, Số lượt cộng/trừ.
                    </li>
                  )}
                  <li>
                    <strong className="text-[#233146]">Sheet “Chi tiết ghi nhận”:</strong> {previewData.totalPeriodRecords} dòng
                    chi tiết các sự việc trong kỳ: Thời gian, Năm học, Học kỳ (HK I / HK II), Mã HS, Họ tên, Nội dung,
                    Loại ghi nhận, Điểm có dấu (+/-), Người ghi nhận và Ghi chú.
                  </li>
                </ul>
              </div>

              {/* Filename Preview */}
              <div className="text-[11px] text-[#697589] flex items-center gap-1.5 bg-[#F5EDEB] px-3 py-1.5 rounded-lg font-mono border border-[#E8DEDA]">
                <ChevronRight className="w-3.5 h-3.5 text-[#922235] shrink-0" />
                <span className="truncate">
                  Tên file: <strong className="text-[#233146]">{expectedFileName}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 flex items-start gap-2.5 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Guarantee Note */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3 flex items-start gap-2.5 text-emerald-800 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span className="leading-relaxed">
              Mỗi học kỳ sử dụng điểm gốc {semesterBasePoints} điểm và được tính độc lập theo mốc thời gian cấu hình.
              Thao tác xuất file chỉ đọc dữ liệu, không làm thay đổi lịch sử của các kỳ trước.
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-[#E8DEDA] bg-[#FFF8F4] flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-[#697589] font-medium text-center sm:text-left">
            Chỉ tài khoản Giáo viên có quyền xuất báo cáo thi đua toàn lớp
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-white hover:bg-[#F5EDEB] text-[#233146] font-semibold rounded-xl text-xs sm:text-sm border border-[#E8DEDA] transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || previewData.totalClassStudents === 0}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-[#922235] hover:bg-[#781C2B] text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Đang tạo Excel...' : 'Tải File Excel (.xlsx)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
