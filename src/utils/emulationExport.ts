import * as XLSX from 'xlsx';
import { AppConfig, AppState, DisciplineRecord, SemesterFilter, SemesterId, Student } from '../types';
import { calculateConduct, calculateStudentPoints, formatDisplayDate } from './helpers';
import {
  calculateFullYearEmulation,
  filterDisciplineBySemester,
  formatSemesterLabel,
  getRecordPeriod,
  getSemesterBasePoints,
  getSemesterYearConfig,
} from './semesterHelpers';

export type ReportPeriodType = 'week' | 'month' | 'semester' | 'year' | 'custom';

export interface ReportPeriodConfig {
  type: ReportPeriodType;
  label: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  subOption?: string; // e.g., 'this_week' | 'last_week' | 'sem1' | 'sem2'
  schoolYear?: string;
  semesterFilter?: SemesterFilter;
}

/**
 * Returns the current date and time formatted in Vietnam timezone (UTC+7).
 */
export const getVietnamNow = (): { dateStr: string; timeStr: string; fullStr: string } => {
  const now = new Date();

  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const timeParts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);

  const [y, m, d] = dateParts.split('-');
  const displayDate = `${d}/${m}/${y}`;
  const fullStr = `${timeParts} ngày ${displayDate}`;

  return {
    dateStr: dateParts,
    timeStr: timeParts,
    fullStr,
  };
};

/**
 * Normalizes any date value (string or Date) to YYYY-MM-DD in Vietnam timezone (UTC+7).
 */
export const normalizeToVNDateStr = (dateVal?: string | Date): string => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
  }
  try {
    const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    }
  } catch {
    // fallback
  }
  return String(dateVal).substring(0, 10);
};

/**
 * Calculates start and end dates for a given week (Monday to Sunday) based on a reference date.
 */
export const getWeekRange = (refDateStr?: string, offsetWeeks: number = 0): { start: string; end: string } => {
  const base = refDateStr ? new Date(`${refDateStr}T12:00:00+07:00`) : new Date();
  base.setDate(base.getDate() + offsetWeeks * 7);

  const vnStr = normalizeToVNDateStr(base);
  const [y, m, d] = vnStr.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  const dayOfWeek = target.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(target);
  monday.setUTCDate(target.getUTCDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const formatUTC = (dt: Date) => {
    const yr = dt.getUTCFullYear();
    const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const da = String(dt.getUTCDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  };

  return {
    start: formatUTC(monday),
    end: formatUTC(sunday),
  };
};

/**
 * Calculates start and end dates for a month in YYYY-MM format.
 */
export const getMonthRange = (yearMonthStr: string): { start: string; end: string } => {
  const parts = yearMonthStr.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mStr = String(m).padStart(2, '0');
  return {
    start: `${y}-${mStr}-01`,
    end: `${y}-${mStr}-${String(lastDay).padStart(2, '0')}`,
  };
};

/**
 * Calculates semester or school year dates based on configurable semesterConfigs per school year.
 */
export const getAcademicYearRange = (
  schoolYearStr?: string,
  type: 'sem1' | 'sem2' | 'full' = 'full',
  config?: Partial<AppConfig>
): { start: string; end: string } => {
  const cal = getSemesterYearConfig(config, schoolYearStr);
  if (type === 'sem1') {
    return { start: cal.hk1Start, end: cal.hk1End };
  }
  if (type === 'sem2') {
    return { start: cal.hk2Start, end: cal.hk2End };
  }
  return { start: cal.hk1Start, end: cal.hk2End };
};

/**
 * Sanitizes user text to prevent Excel CSV/Formula injection attacks.
 */
export const sanitizeExcelText = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return str;
};

export interface StudentEmulationExportItem {
  stt: number;
  studentId: string;
  name: string;
  className: string;
  basePoints: number;
  totalPlus: number;
  totalMinus: number;
  remainingPoints: number;
  conductText: string;
  rank: number;
  plusCount: number;
  minusCount: number;
  note: string;
}

export interface FullYearStudentEmulationExportItem {
  stt: number;
  studentId: string;
  name: string;
  className: string;
  basePointsPerSemester: number;
  hk1Plus: number;
  hk1Minus: number;
  hk1Remaining: number;
  hk1ConductText: string;
  hk2Plus: number;
  hk2Minus: number;
  hk2Remaining: number;
  hk2ConductText: string;
  totalPlusCount: number;
  totalMinusCount: number;
  note: string;
}

export interface EmulationDetailExportItem {
  stt: number;
  dateDisplay: string;
  schoolYear: string;
  semesterLabel: string;
  studentId: string;
  studentName: string;
  ruleName: string;
  typeLabel: string;
  pointsSigned: string;
  recordedBy: string;
  note: string;
}

/**
 * Aggregates class emulation data for a single period (Week, Month, Single Semester, or Custom range).
 */
export const prepareClassEmulationExportData = (
  state: AppState,
  startDate: string,
  endDate: string,
  locallyDeletedDisciplineIds: string[] = [],
  semesterScope?: { schoolYear: string; semester: SemesterId }
): {
  summaryList: StudentEmulationExportItem[];
  detailList: EmulationDetailExportItem[];
  totalClassStudents: number;
  totalPeriodRecords: number;
  totalPeriodPlus: number;
  totalPeriodMinus: number;
} => {
  const basePoints = getSemesterBasePoints(state.config);
  const className = state.config.className || '';
  const teacherName = state.config.teacherName || 'Giáo viên chủ nhiệm';
  const thresholds = state.config.conductThresholds;

  const deletedIdsSet = new Set(locallyDeletedDisciplineIds);
  const studentMap = new Map<string, Student>();
  state.students.forEach((s) => {
    studentMap.set(s.id, s);
  });

  const activeRecords = (state.discipline || []).filter(
    (d) => !deletedIdsSet.has(d.id) && studentMap.has(d.studentId)
  );

  let periodDisciplineRecords: DisciplineRecord[] = [];

  if (semesterScope) {
    periodDisciplineRecords = filterDisciplineBySemester(
      activeRecords,
      state.config,
      semesterScope.schoolYear,
      semesterScope.semester
    ).map((d) => ({
      ...d,
      date: normalizeToVNDateStr(d.date) || d.date,
    }));
  } else {
    const seenRecordIds = new Set<string>();
    activeRecords.forEach((d) => {
      const recordKey = d.id || `${d.studentId}_${d.date}_${d.ruleId}_${d.points}_${d.type}_${d.note || ''}`;
      if (seenRecordIds.has(recordKey)) return;
      seenRecordIds.add(recordKey);

      const vnDate = normalizeToVNDateStr(d.date);
      if (!vnDate) return;

      if (vnDate >= startDate && vnDate <= endDate) {
        periodDisciplineRecords.push({
          ...d,
          date: vnDate,
        });
      }
    });
  }

  const recordsByStudent = new Map<string, DisciplineRecord[]>();
  periodDisciplineRecords.forEach((r) => {
    const list = recordsByStudent.get(r.studentId) || [];
    list.push(r);
    recordsByStudent.set(r.studentId, list);
  });

  const studentSummaries = state.students.map((student) => {
    const studentRecords = recordsByStudent.get(student.id) || [];
    const pointsSummary = calculateStudentPoints(studentRecords, basePoints);
    const conduct = calculateConduct(pointsSummary.remainingPoints, thresholds);

    const plusCount = studentRecords.filter((r) => r.type === 'plus').length;
    const minusCount = studentRecords.filter((r) => r.type === 'minus').length;

    let note = '';
    if (studentRecords.length === 0) {
      note = 'Không có vi phạm hay khen thưởng trong kỳ';
    } else if (minusCount === 0 && plusCount > 0) {
      note = 'Tích cực, không có vi phạm';
    } else if (minusCount > 0 && plusCount === 0) {
      note = `Có ${minusCount} lượt nhắc nhở/vi phạm`;
    } else {
      note = `Khen thưởng: ${plusCount} lượt, Vi phạm: ${minusCount} lượt`;
    }

    return {
      studentId: student.id,
      name: student.name,
      className,
      basePoints,
      totalPlus: pointsSummary.totalPlus,
      totalMinus: pointsSummary.totalMinus,
      remainingPoints: pointsSummary.remainingPoints,
      conductText: conduct.text,
      plusCount,
      minusCount,
      note,
    };
  });

  studentSummaries.sort((a, b) => {
    if (b.remainingPoints !== a.remainingPoints) {
      return b.remainingPoints - a.remainingPoints;
    }
    const nameA = a.name.trim().split(' ').pop() || '';
    const nameB = b.name.trim().split(' ').pop() || '';
    return nameA.localeCompare(nameB, 'vi');
  });

  let currentRank = 1;
  const summaryList: StudentEmulationExportItem[] = studentSummaries.map((item, index) => {
    if (index > 0 && item.remainingPoints < studentSummaries[index - 1].remainingPoints) {
      currentRank = index + 1;
    }
    return {
      ...item,
      stt: index + 1,
      rank: currentRank,
    };
  });

  const sortedDiscipline = [...periodDisciplineRecords].sort((a, b) => {
    if (b.date !== a.date) {
      return b.date.localeCompare(a.date);
    }
    const nameA = studentMap.get(a.studentId)?.name || '';
    const nameB = studentMap.get(b.studentId)?.name || '';
    return nameA.localeCompare(nameB, 'vi');
  });

  const detailList: EmulationDetailExportItem[] = sortedDiscipline.map((r, index) => {
    const student = studentMap.get(r.studentId);
    const studentName = student?.name || r.studentId;
    const isPlus = r.type === 'plus';
    const pointsSigned = isPlus ? `+${r.points}` : `-${r.points}`;
    const recordedBy =
      (r as unknown as Record<string, unknown>).recordedBy ||
      (r as unknown as Record<string, unknown>).teacher ||
      teacherName;
    const period = getRecordPeriod(r, state.config);

    let fullRuleDesc = r.ruleName || '';
    if (r.note && r.note.trim() && r.note.trim() !== r.ruleName.trim()) {
      fullRuleDesc = `${r.ruleName} (${r.note.trim()})`;
    }

    return {
      stt: index + 1,
      dateDisplay: formatDisplayDate(r.date),
      schoolYear: period.schoolYear,
      semesterLabel: formatSemesterLabel(period.semester),
      studentId: r.studentId,
      studentName,
      ruleName: fullRuleDesc,
      typeLabel: isPlus ? 'Tích cực' : 'Vi phạm',
      pointsSigned,
      recordedBy: String(recordedBy),
      note: r.note || '',
    };
  });

  const totalPeriodPlus = periodDisciplineRecords.filter((r) => r.type === 'plus').length;
  const totalPeriodMinus = periodDisciplineRecords.filter((r) => r.type === 'minus').length;

  return {
    summaryList,
    detailList,
    totalClassStudents: state.students.length,
    totalPeriodRecords: periodDisciplineRecords.length,
    totalPeriodPlus,
    totalPeriodMinus,
  };
};

/**
 * Aggregates full-year class emulation data keeping Học kỳ I and Học kỳ II strictly separate (200 points each, never summed to 400).
 */
export const prepareFullYearEmulationExportData = (
  state: AppState,
  schoolYear: string,
  locallyDeletedDisciplineIds: string[] = []
): {
  summaryList: FullYearStudentEmulationExportItem[];
  detailList: EmulationDetailExportItem[];
  totalClassStudents: number;
  totalPeriodRecords: number;
  totalPeriodPlus: number;
  totalPeriodMinus: number;
} => {
  const basePoints = getSemesterBasePoints(state.config);
  const className = state.config.className || '';
  const teacherName = state.config.teacherName || 'Giáo viên chủ nhiệm';
  const deletedIdsSet = new Set(locallyDeletedDisciplineIds);

  const studentMap = new Map<string, Student>();
  state.students.forEach((s) => studentMap.set(s.id, s));

  const activeRecords = (state.discipline || []).filter(
    (d) => !deletedIdsSet.has(d.id) && studentMap.has(d.studentId)
  );

  const yearRecords = filterDisciplineBySemester(
    activeRecords,
    state.config,
    schoolYear,
    'ALL'
  ).map((d) => ({
    ...d,
    date: normalizeToVNDateStr(d.date) || d.date,
  }));

  const sortedStudents = [...state.students].sort((a, b) => {
    const nameA = a.name.trim().split(' ').pop() || '';
    const nameB = b.name.trim().split(' ').pop() || '';
    return nameA.localeCompare(nameB, 'vi');
  });

  const summaryList: FullYearStudentEmulationExportItem[] = sortedStudents.map((student, index) => {
    const fullYear = calculateFullYearEmulation(activeRecords, state.config, schoolYear, student.id);
    const totalPlusCount = fullYear.hk1.plusCount + fullYear.hk2.plusCount;
    const totalMinusCount = fullYear.hk1.minusCount + fullYear.hk2.minusCount;

    let note = '';
    if (totalPlusCount === 0 && totalMinusCount === 0) {
      note = 'Chưa có ghi nhận trong năm học (mỗi HK 200đ)';
    } else {
      note = `HK I: ${fullYear.hk1.remainingPoints}/${basePoints}đ | HK II: ${fullYear.hk2.remainingPoints}/${basePoints}đ`;
    }

    return {
      stt: index + 1,
      studentId: student.id,
      name: student.name,
      className,
      basePointsPerSemester: basePoints,
      hk1Plus: fullYear.hk1.totalPlus,
      hk1Minus: fullYear.hk1.totalMinus,
      hk1Remaining: fullYear.hk1.remainingPoints,
      hk1ConductText: fullYear.hk1.conduct.text,
      hk2Plus: fullYear.hk2.totalPlus,
      hk2Minus: fullYear.hk2.totalMinus,
      hk2Remaining: fullYear.hk2.remainingPoints,
      hk2ConductText: fullYear.hk2.conduct.text,
      totalPlusCount,
      totalMinusCount,
      note,
    };
  });

  const sortedDiscipline = [...yearRecords].sort((a, b) => {
    if (b.date !== a.date) {
      return b.date.localeCompare(a.date);
    }
    const nameA = studentMap.get(a.studentId)?.name || '';
    const nameB = studentMap.get(b.studentId)?.name || '';
    return nameA.localeCompare(nameB, 'vi');
  });

  const detailList: EmulationDetailExportItem[] = sortedDiscipline.map((r, index) => {
    const student = studentMap.get(r.studentId);
    const studentName = student?.name || r.studentId;
    const isPlus = r.type === 'plus';
    const pointsSigned = isPlus ? `+${r.points}` : `-${r.points}`;
    const recordedBy =
      (r as unknown as Record<string, unknown>).recordedBy ||
      (r as unknown as Record<string, unknown>).teacher ||
      teacherName;
    const period = getRecordPeriod(r, state.config);

    let fullRuleDesc = r.ruleName || '';
    if (r.note && r.note.trim() && r.note.trim() !== r.ruleName.trim()) {
      fullRuleDesc = `${r.ruleName} (${r.note.trim()})`;
    }

    return {
      stt: index + 1,
      dateDisplay: formatDisplayDate(r.date),
      schoolYear: period.schoolYear,
      semesterLabel: formatSemesterLabel(period.semester),
      studentId: r.studentId,
      studentName,
      ruleName: fullRuleDesc,
      typeLabel: isPlus ? 'Tích cực' : 'Vi phạm',
      pointsSigned,
      recordedBy: String(recordedBy),
      note: r.note || '',
    };
  });

  return {
    summaryList,
    detailList,
    totalClassStudents: state.students.length,
    totalPeriodRecords: yearRecords.length,
    totalPeriodPlus: yearRecords.filter((r) => r.type === 'plus').length,
    totalPeriodMinus: yearRecords.filter((r) => r.type === 'minus').length,
  };
};

/**
 * Builds the .xlsx workbook with 2 sheets and initiates the file download.
 */
export const exportClassEmulationToExcel = (
  state: AppState,
  periodConfig: ReportPeriodConfig,
  locallyDeletedDisciplineIds: string[] = []
): { success: boolean; fileName: string; error?: string } => {
  try {
    if (!state.students || state.students.length === 0) {
      return {
        success: false,
        fileName: '',
        error: 'Lớp hiện tại chưa có dữ liệu học sinh để xuất báo cáo thi đua.',
      };
    }

    const { startDate, endDate, label: periodLabel } = periodConfig;
    const exportTime = getVietnamNow().fullStr;
    const appName = state.config.appName || 'Trường THCS';
    const className = state.config.className || 'Chưa đặt tên lớp';
    const teacherName = state.config.teacherName || 'Chưa cập nhật';
    const schoolYear = periodConfig.schoolYear || state.config.schoolYear || '2026-2027';
    const baseScore = getSemesterBasePoints(state.config);

    let wsSummary: XLSX.WorkSheet;
    let detailList: EmulationDetailExportItem[] = [];
    let totalPeriodRecords = 0;

    if (periodConfig.type === 'year') {
      const fullYearData = prepareFullYearEmulationExportData(
        state,
        schoolYear,
        locallyDeletedDisciplineIds
      );
      detailList = fullYearData.detailList;
      totalPeriodRecords = fullYearData.totalPeriodRecords;

      const ws1Rows: unknown[][] = [];
      ws1Rows.push([{ t: 's', v: 'BÁO CÁO TỔNG HỢP THI ĐUA CẢ NĂM HỌC (ĐỘC LẬP HK I & HK II)' }]);
      ws1Rows.push([
        { t: 's', v: `Trường / Hệ thống: ${sanitizeExcelText(appName)}` },
        null,
        null,
        { t: 's', v: `Năm học: ${sanitizeExcelText(schoolYear)}` },
      ]);
      ws1Rows.push([
        { t: 's', v: `Lớp: ${sanitizeExcelText(className)}` },
        null,
        null,
        { t: 's', v: `Giáo viên chủ nhiệm: ${sanitizeExcelText(teacherName)}` },
      ]);
      ws1Rows.push([
        {
          t: 's',
          v: `Kỳ báo cáo: ${sanitizeExcelText(periodLabel)} (Từ ${formatDisplayDate(startDate)} đến ${formatDisplayDate(endDate)})`,
        },
      ]);
      ws1Rows.push([
        {
          t: 's',
          v: `Thời gian xuất: ${exportTime} | Điểm gốc mỗi học kỳ: ${baseScore} điểm (HK I và HK II tính độc lập, không cộng dồn)`,
        },
      ]);
      ws1Rows.push([]);

      const yearHeaders = [
        'STT',
        'Mã hồ sơ học sinh',
        'Họ và tên',
        'Lớp',
        `Điểm nền/HK (${baseScore})`,
        'HK I: Điểm thưởng (+)',
        'HK I: Điểm trừ (-)',
        `HK I: Điểm thi đua (/${baseScore})`,
        'HK I: Hạnh kiểm',
        'HK II: Điểm thưởng (+)',
        'HK II: Điểm trừ (-)',
        `HK II: Điểm thi đua (/${baseScore})`,
        'HK II: Hạnh kiểm',
        'Số lượt tích cực (Cả năm)',
        'Số lượt vi phạm (Cả năm)',
        'Ghi chú',
      ];
      ws1Rows.push(yearHeaders.map((h) => ({ t: 's', v: h })));

      fullYearData.summaryList.forEach((item) => {
        ws1Rows.push([
          { t: 'n', v: item.stt },
          { t: 's', v: String(item.studentId), z: '@' },
          { t: 's', v: sanitizeExcelText(item.name) },
          { t: 's', v: sanitizeExcelText(item.className) },
          { t: 'n', v: item.basePointsPerSemester },
          { t: 'n', v: item.hk1Plus },
          { t: 'n', v: item.hk1Minus },
          { t: 'n', v: item.hk1Remaining },
          { t: 's', v: sanitizeExcelText(item.hk1ConductText) },
          { t: 'n', v: item.hk2Plus },
          { t: 'n', v: item.hk2Minus },
          { t: 'n', v: item.hk2Remaining },
          { t: 's', v: sanitizeExcelText(item.hk2ConductText) },
          { t: 'n', v: item.totalPlusCount },
          { t: 'n', v: item.totalMinusCount },
          { t: 's', v: sanitizeExcelText(item.note) },
        ]);
      });

      wsSummary = XLSX.utils.aoa_to_sheet(ws1Rows);
      wsSummary['!cols'] = [
        { wch: 6 },  // STT
        { wch: 18 }, // Mã HS
        { wch: 26 }, // Họ tên
        { wch: 10 }, // Lớp
        { wch: 16 }, // Điểm nền
        { wch: 18 }, // HK I thưởng
        { wch: 16 }, // HK I trừ
        { wch: 20 }, // HK I còn lại
        { wch: 16 }, // HK I hạnh kiểm
        { wch: 18 }, // HK II thưởng
        { wch: 16 }, // HK II trừ
        { wch: 20 }, // HK II còn lại
        { wch: 16 }, // HK II hạnh kiểm
        { wch: 20 }, // Số lượt tích cực
        { wch: 20 }, // Số lượt vi phạm
        { wch: 34 }, // Ghi chú
      ];
      wsSummary['!autofilter'] = { ref: `A7:P${ws1Rows.length}` };
      wsSummary['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 7 }];
    } else {
      const semesterScope =
        periodConfig.type === 'semester'
          ? {
              schoolYear,
              semester: (periodConfig.subOption === 'sem2' ? 'HK2' : 'HK1') as SemesterId,
            }
          : undefined;

      const singleData = prepareClassEmulationExportData(
        state,
        startDate,
        endDate,
        locallyDeletedDisciplineIds,
        semesterScope
      );
      detailList = singleData.detailList;
      totalPeriodRecords = singleData.totalPeriodRecords;

      const ws1Rows: unknown[][] = [];
      ws1Rows.push([{ t: 's', v: 'BÁO CÁO TỔNG HỢP THI ĐUA HỌC SINH' }]);
      ws1Rows.push([
        { t: 's', v: `Trường / Hệ thống: ${sanitizeExcelText(appName)}` },
        null,
        null,
        { t: 's', v: `Năm học: ${sanitizeExcelText(schoolYear)}` },
      ]);
      ws1Rows.push([
        { t: 's', v: `Lớp: ${sanitizeExcelText(className)}` },
        null,
        null,
        { t: 's', v: `Giáo viên chủ nhiệm: ${sanitizeExcelText(teacherName)}` },
      ]);
      ws1Rows.push([
        {
          t: 's',
          v: `Kỳ báo cáo: ${sanitizeExcelText(periodLabel)} (Từ ngày ${formatDisplayDate(startDate)} đến ngày ${formatDisplayDate(endDate)})`,
        },
      ]);
      ws1Rows.push([
        {
          t: 's',
          v: `Thời gian xuất file: ${exportTime} | Điểm gốc mỗi học kỳ: ${baseScore} điểm`,
        },
      ]);
      ws1Rows.push([]);

      const summaryHeaders = [
        'STT',
        'Mã hồ sơ học sinh',
        'Họ và tên',
        'Lớp',
        `Điểm gốc (${baseScore})`,
        'Tổng điểm cộng (+)',
        'Tổng điểm trừ (-)',
        `Điểm thi đua (/${baseScore})`,
        'Xếp loại hạnh kiểm',
        'Xếp hạng',
        'Số lượt tích cực',
        'Số lượt vi phạm',
        'Ghi chú',
      ];
      ws1Rows.push(summaryHeaders.map((h) => ({ t: 's', v: h })));

      singleData.summaryList.forEach((item) => {
        ws1Rows.push([
          { t: 'n', v: item.stt },
          { t: 's', v: String(item.studentId), z: '@' },
          { t: 's', v: sanitizeExcelText(item.name) },
          { t: 's', v: sanitizeExcelText(item.className) },
          { t: 'n', v: item.basePoints },
          { t: 'n', v: item.totalPlus },
          { t: 'n', v: item.totalMinus },
          { t: 'n', v: item.remainingPoints },
          { t: 's', v: sanitizeExcelText(item.conductText) },
          { t: 'n', v: item.rank },
          { t: 'n', v: item.plusCount },
          { t: 'n', v: item.minusCount },
          { t: 's', v: sanitizeExcelText(item.note) },
        ]);
      });

      wsSummary = XLSX.utils.aoa_to_sheet(ws1Rows);
      wsSummary['!cols'] = [
        { wch: 6 },
        { wch: 20 },
        { wch: 28 },
        { wch: 10 },
        { wch: 15 },
        { wch: 18 },
        { wch: 18 },
        { wch: 20 },
        { wch: 18 },
        { wch: 12 },
        { wch: 18 },
        { wch: 18 },
        { wch: 35 },
      ];
      wsSummary['!autofilter'] = { ref: `A7:M${ws1Rows.length}` };
      wsSummary['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 7 }];
    }

    // ==========================================
    // 2. SHEET 2: "Chi tiết ghi nhận"
    // ==========================================
    const ws2Rows: unknown[][] = [];
    ws2Rows.push([{ t: 's', v: `BẢNG CHI TIẾT GHI NHẬN THI ĐUA - LỚP ${sanitizeExcelText(className)}` }]);
    ws2Rows.push([
      { t: 's', v: `Trường / Hệ thống: ${sanitizeExcelText(appName)}` },
      null,
      null,
      { t: 's', v: `Năm học: ${sanitizeExcelText(schoolYear)} | GVCN: ${sanitizeExcelText(teacherName)}` },
    ]);
    ws2Rows.push([
      {
        t: 's',
        v: `Kỳ báo cáo: ${sanitizeExcelText(periodLabel)} (Từ ${formatDisplayDate(startDate)} đến ${formatDisplayDate(endDate)})`,
      },
    ]);
    ws2Rows.push([
      {
        t: 's',
        v: `Tổng số lượt ghi nhận trong kỳ: ${totalPeriodRecords} lượt | Thời gian xuất file: ${exportTime}`,
      },
    ]);
    ws2Rows.push([]);

    const detailHeaders = [
      'STT',
      'Thời gian',
      'Năm học',
      'Học kỳ',
      'Mã hồ sơ học sinh',
      'Họ và tên',
      'Nội dung sự việc',
      'Loại ghi nhận',
      'Điểm cộng/trừ',
      'Người ghi nhận',
      'Ghi chú',
    ];
    ws2Rows.push(detailHeaders.map((h) => ({ t: 's', v: h })));

    if (detailList.length === 0) {
      ws2Rows.push([
        { t: 's', v: '-' },
        { t: 's', v: '-' },
        { t: 's', v: schoolYear },
        { t: 's', v: '-' },
        { t: 's', v: '-' },
        { t: 's', v: '-' },
        { t: 's', v: 'Không có ghi nhận vi phạm hay khen thưởng nào trong kỳ này' },
        { t: 's', v: '-' },
        { t: 's', v: '-' },
        { t: 's', v: '-' },
        { t: 's', v: '-' },
      ]);
    } else {
      detailList.forEach((item) => {
        ws2Rows.push([
          { t: 'n', v: item.stt },
          { t: 's', v: item.dateDisplay },
          { t: 's', v: sanitizeExcelText(item.schoolYear) },
          { t: 's', v: sanitizeExcelText(item.semesterLabel) },
          { t: 's', v: String(item.studentId), z: '@' },
          { t: 's', v: sanitizeExcelText(item.studentName) },
          { t: 's', v: sanitizeExcelText(item.ruleName) },
          { t: 's', v: sanitizeExcelText(item.typeLabel) },
          { t: 's', v: item.pointsSigned },
          { t: 's', v: sanitizeExcelText(item.recordedBy) },
          { t: 's', v: sanitizeExcelText(item.note) },
        ]);
      });
    }

    const wsDetails = XLSX.utils.aoa_to_sheet(ws2Rows);
    wsDetails['!cols'] = [
      { wch: 6 },  // STT
      { wch: 14 }, // Thời gian
      { wch: 13 }, // Năm học
      { wch: 12 }, // Học kỳ
      { wch: 20 }, // Mã HS
      { wch: 28 }, // Họ tên
      { wch: 38 }, // Nội dung sự việc
      { wch: 16 }, // Loại ghi nhận
      { wch: 16 }, // Điểm cộng/trừ
      { wch: 24 }, // Người ghi nhận
      { wch: 35 }, // Ghi chú
    ];
    wsDetails['!autofilter'] = { ref: `A6:K${ws2Rows.length}` };
    wsDetails['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 6 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, wsSummary, 'Tổng hợp thi đua');
    XLSX.utils.book_append_sheet(workbook, wsDetails, 'Chi tiết ghi nhận');

    const cleanClassName = className.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
    const fileName = `Thi_dua_${cleanClassName}_${startDate}_${endDate}.xlsx`;

    XLSX.writeFile(workbook, fileName);

    return {
      success: true,
      fileName,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Error generating emulation Excel file:', err);
    return {
      success: false,
      fileName: '',
      error: `Lỗi khi tạo file Excel thi đua: ${errorMsg}`,
    };
  }
};
