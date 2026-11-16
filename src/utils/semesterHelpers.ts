import {
  AppConfig,
  ConductThresholds,
  DisciplineRecord,
  SemesterFilter,
  SemesterId,
  SemesterYearConfig,
} from '../types';
import { calculateConduct, calculateStudentPoints, formatDisplayDate } from './helpers';

export const DEFAULT_SEMESTER_BASE_POINTS = 200;

/**
 * Normalizes any YYYY-MM-DD / ISO string to YYYY-MM-DD in Asia/Ho_Chi_Minh timezone.
 */
export const normalizeDateYMD = (dateVal?: string): string => {
  if (!dateVal) return '';
  const trimmed = dateVal.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    return trimmed.substring(0, 10);
  }
  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    }
  } catch {
    // ignore
  }
  return trimmed.substring(0, 10);
};

export const getTodayVietnamYMD = (): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
};

/**
 * Returns the base points per semester (default: 200).
 * Ignores legacy 100-point `initialPoints` unless `semesterBasePoints` is explicitly configured.
 */
export const getSemesterBasePoints = (config?: Partial<AppConfig>): number => {
  if (
    typeof config?.semesterBasePoints === 'number' &&
    !isNaN(config.semesterBasePoints) &&
    config.semesterBasePoints >= 10
  ) {
    return config.semesterBasePoints;
  }
  return DEFAULT_SEMESTER_BASE_POINTS;
};

/**
 * Parses start and end calendar years from a schoolYear string (e.g., '2026-2027').
 */
export const parseSchoolYearBounds = (schoolYear?: string): { startYear: number; endYear: number } => {
  const currentYear = new Date().getFullYear();
  if (schoolYear) {
    const matches = schoolYear.match(/\d{4}/g);
    if (matches && matches.length >= 2) {
      return { startYear: Number(matches[0]), endYear: Number(matches[1]) };
    }
    if (matches && matches.length === 1) {
      const y = Number(matches[0]);
      return { startYear: y, endYear: y + 1 };
    }
  }
  return { startYear: currentYear, endYear: currentYear + 1 };
};

/**
 * Builds an editable initial template for a school year when not yet customized by the teacher.
 */
export const getDefaultSemesterYearConfig = (schoolYear: string): SemesterYearConfig => {
  const { startYear, endYear } = parseSchoolYearBounds(schoolYear);
  const normalizedYear = `${startYear}-${endYear}`;
  return {
    schoolYear: normalizedYear,
    hk1Start: `${startYear}-09-01`,
    hk1End: `${endYear}-01-15`,
    hk2Start: `${endYear}-01-16`,
    hk2End: `${endYear}-05-31`,
  };
};

/**
 * Returns the configured SemesterYearConfig for a schoolYear (falling back to template defaults).
 */
export const getSemesterYearConfig = (
  config: Partial<AppConfig> | undefined,
  schoolYear?: string
): SemesterYearConfig => {
  const targetYear = (schoolYear || config?.schoolYear || '2026-2027').trim();
  const existing = config?.semesterConfigs?.[targetYear];
  if (existing && existing.hk1Start && existing.hk1End && existing.hk2Start && existing.hk2End) {
    return {
      schoolYear: targetYear,
      hk1Start: normalizeDateYMD(existing.hk1Start),
      hk1End: normalizeDateYMD(existing.hk1End),
      hk2Start: normalizeDateYMD(existing.hk2Start),
      hk2End: normalizeDateYMD(existing.hk2End),
    };
  }
  return getDefaultSemesterYearConfig(targetYear);
};

/**
 * Validates semester calendar ordering for a school year.
 */
export const validateSemesterYearConfig = (
  cal: SemesterYearConfig
): { valid: boolean; error?: string } => {
  if (!cal.hk1Start || !cal.hk1End || !cal.hk2Start || !cal.hk2End) {
    return { valid: false, error: 'Vui lòng nhập đầy đủ ngày bắt đầu và kết thúc của cả 2 học kỳ.' };
  }
  if (cal.hk1Start > cal.hk1End) {
    return { valid: false, error: 'Ngày kết thúc Học kỳ I phải sau hoặc bằng ngày bắt đầu Học kỳ I.' };
  }
  if (cal.hk2Start > cal.hk2End) {
    return { valid: false, error: 'Ngày kết thúc Học kỳ II phải sau hoặc bằng ngày bắt đầu Học kỳ II.' };
  }
  if (cal.hk1End >= cal.hk2Start) {
    return {
      valid: false,
      error: 'Ngày bắt đầu Học kỳ II phải sau ngày kết thúc Học kỳ I để không bị chồng lấn.',
    };
  }
  return { valid: true };
};

/**
 * Infers fallback schoolYear from a YYYY-MM-DD date when outside configured ranges.
 */
export const inferSchoolYearFromDate = (dateStr: string): string => {
  const ymd = normalizeDateYMD(dateStr);
  const parts = ymd.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1])) {
    return '2026-2027';
  }
  const [y, m] = parts;
  if (m >= 8) {
    return `${y}-${y + 1}`;
  }
  return `${y - 1}-${y}`;
};

/**
 * Returns all relevant school years from config, semesterConfigs, and discipline records.
 */
export const getAvailableSchoolYears = (
  config?: Partial<AppConfig>,
  records: DisciplineRecord[] = []
): string[] => {
  const set = new Set<string>();
  const activeYear = (config?.schoolYear || '2026-2027').trim();
  set.add(activeYear);

  if (config?.semesterConfigs) {
    Object.keys(config.semesterConfigs).forEach((yr) => {
      if (yr && yr.trim()) set.add(yr.trim());
    });
  }

  records.forEach((r) => {
    if (r.schoolYear && r.schoolYear.trim()) {
      set.add(r.schoolYear.trim());
    } else if (r.date) {
      const resolved = resolveDisciplinePeriod(r.date, config, activeYear);
      set.add(resolved.schoolYear);
    }
  });

  return Array.from(set).sort((a, b) => b.localeCompare(a));
};

export interface ResolvedPeriodResult {
  schoolYear: string;
  semester: SemesterId;
  isWithinConfiguredRange: boolean;
  warningMessage: string | null;
}

/**
 * Resolves the schoolYear & semester for an event date using configured semester calendars.
 * Also reports a clear warning if the date falls outside configured semester boundaries.
 */
export const resolveDisciplinePeriod = (
  dateStr: string,
  config?: Partial<AppConfig>,
  preferredSchoolYear?: string
): ResolvedPeriodResult => {
  const ymd = normalizeDateYMD(dateStr) || getTodayVietnamYMD();
  const activeYear = (preferredSchoolYear || config?.schoolYear || '2026-2027').trim();

  // Build ordered list of calendars to check: preferred/active year first, then configured years
  const yearsToCheck = new Set<string>([activeYear]);
  if (config?.semesterConfigs) {
    Object.keys(config.semesterConfigs).forEach((y) => yearsToCheck.add(y));
  }
  const inferredYear = inferSchoolYearFromDate(ymd);
  yearsToCheck.add(inferredYear);

  for (const yr of yearsToCheck) {
    const cal = getSemesterYearConfig(config, yr);
    if (ymd >= cal.hk1Start && ymd <= cal.hk1End) {
      return {
        schoolYear: cal.schoolYear,
        semester: 'HK1',
        isWithinConfiguredRange: true,
        warningMessage: null,
      };
    }
    if (ymd >= cal.hk2Start && ymd <= cal.hk2End) {
      return {
        schoolYear: cal.schoolYear,
        semester: 'HK2',
        isWithinConfiguredRange: true,
        warningMessage: null,
      };
    }
  }

  // Date is outside all configured semester ranges!
  // Determine best fallback year & semester
  const activeCal = getSemesterYearConfig(config, activeYear);
  let fallbackYear = activeYear;
  let fallbackSemester: SemesterId = 'HK1';

  // If date clearly belongs to another calendar year far from activeYear, use inferredYear
  const inferredCal = getSemesterYearConfig(config, inferredYear);
  if (ymd < activeCal.hk1Start && inferredYear !== activeYear) {
    fallbackYear = inferredYear;
    fallbackSemester = ymd >= inferredCal.hk2Start ? 'HK2' : 'HK1';
  } else if (ymd > activeCal.hk2End && inferredYear !== activeYear) {
    fallbackYear = inferredYear;
    fallbackSemester = ymd >= inferredCal.hk2Start ? 'HK2' : 'HK1';
  } else {
    fallbackYear = activeYear;
    fallbackSemester = ymd > activeCal.hk1End ? 'HK2' : 'HK1';
  }

  const targetCal = getSemesterYearConfig(config, fallbackYear);
  const warningMessage = `Cảnh báo: Ngày ghi nhận ${formatDisplayDate(ymd)} nằm ngoài thời gian học kỳ đã cấu hình của năm học ${targetCal.schoolYear} (HK I: ${formatDisplayDate(targetCal.hk1Start)} - ${formatDisplayDate(targetCal.hk1End)}, HK II: ${formatDisplayDate(targetCal.hk2Start)} - ${formatDisplayDate(targetCal.hk2End)}). Sự việc vẫn sẽ được xếp tạm vào ${fallbackSemester === 'HK1' ? 'Học kỳ I' : 'Học kỳ II'} (${targetCal.schoolYear}).`;

  return {
    schoolYear: targetCal.schoolYear,
    semester: fallbackSemester,
    isWithinConfiguredRange: false,
    warningMessage,
  };
};

/**
 * Determines the currently active semester based on Vietnam current date and configured semester calendar.
 */
export const detectActiveSemester = (
  config?: Partial<AppConfig>,
  refDateStr?: string
): { schoolYear: string; semester: SemesterId; isWithinConfiguredRange: boolean } => {
  const today = normalizeDateYMD(refDateStr) || getTodayVietnamYMD();
  const activeYear = (config?.schoolYear || '2026-2027').trim();
  const cal = getSemesterYearConfig(config, activeYear);

  if (today >= cal.hk2Start && today <= cal.hk2End) {
    return { schoolYear: cal.schoolYear, semester: 'HK2', isWithinConfiguredRange: true };
  }
  if (today >= cal.hk1Start && today <= cal.hk1End) {
    return { schoolYear: cal.schoolYear, semester: 'HK1', isWithinConfiguredRange: true };
  }
  // If after HK1 end (transition or after HK2 end in active school year) -> HK2
  if (today > cal.hk1End) {
    return { schoolYear: cal.schoolYear, semester: 'HK2', isWithinConfiguredRange: false };
  }
  return { schoolYear: cal.schoolYear, semester: 'HK1', isWithinConfiguredRange: false };
};

/**
 * Returns the (schoolYear, semester) of an existing DisciplineRecord,
 * preserving stored metadata if present, or resolving from its date for legacy records.
 */
export const getRecordPeriod = (
  record: DisciplineRecord,
  config?: Partial<AppConfig>
): { schoolYear: string; semester: SemesterId } => {
  if (record.schoolYear && (record.semester === 'HK1' || record.semester === 'HK2')) {
    return {
      schoolYear: record.schoolYear.trim(),
      semester: record.semester,
    };
  }
  const resolved = resolveDisciplinePeriod(record.date, config, record.schoolYear || config?.schoolYear);
  return {
    schoolYear: record.schoolYear?.trim() || resolved.schoolYear,
    semester: record.semester || resolved.semester,
  };
};

/**
 * Deduplicates discipline records by ID so every event is counted strictly once.
 */
export const deduplicateDisciplineRecords = (
  records: DisciplineRecord[] = []
): DisciplineRecord[] => {
  const seen = new Set<string>();
  const result: DisciplineRecord[] = [];
  records.forEach((r) => {
    const key = r.id || `${r.studentId}_${r.date}_${r.ruleId}_${r.points}_${r.type}_${r.note || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(r);
    }
  });
  return result;
};

/**
 * Filters discipline records for a specific schoolYear and semester ('HK1' | 'HK2' | 'ALL'),
 * optionally restricted to a specific studentId.
 */
export const filterDisciplineBySemester = (
  records: DisciplineRecord[] = [],
  config: Partial<AppConfig> | undefined,
  schoolYear: string,
  semester: SemesterFilter,
  studentId?: string
): DisciplineRecord[] => {
  const deduped = deduplicateDisciplineRecords(records);
  const targetYear = schoolYear.trim();

  return deduped.filter((r) => {
    if (studentId && r.studentId !== studentId) return false;
    const period = getRecordPeriod(r, config);
    if (period.schoolYear !== targetYear) return false;
    if (semester !== 'ALL' && period.semester !== semester) return false;
    return true;
  });
};

export interface SemesterEmulationSummary {
  schoolYear: string;
  semester: SemesterId;
  basePoints: number;
  totalPlus: number;
  totalMinus: number;
  netDiff: number;
  remainingPoints: number;
  conduct: ReturnType<typeof calculateConduct>;
  records: DisciplineRecord[];
  plusCount: number;
  minusCount: number;
}

/**
 * Calculates independent emulation score and conduct for a single semester.
 * Formula: semesterBasePoints (200) + totalPlus - totalMinus
 */
export const calculateSemesterEmulation = (
  records: DisciplineRecord[] = [],
  config: Partial<AppConfig> | undefined,
  schoolYear: string,
  semester: SemesterId,
  studentId?: string
): SemesterEmulationSummary => {
  const basePoints = getSemesterBasePoints(config);
  const thresholds: ConductThresholds = config?.conductThresholds || {
    good: 90,
    fair: 80,
    average: 65,
  };

  const semesterRecords = filterDisciplineBySemester(
    records,
    config,
    schoolYear,
    semester,
    studentId
  );

  const summary = calculateStudentPoints(semesterRecords, basePoints);
  const conduct = calculateConduct(summary.remainingPoints, thresholds);
  const plusCount = semesterRecords.filter((r) => r.type === 'plus').length;
  const minusCount = semesterRecords.filter((r) => r.type === 'minus').length;

  return {
    schoolYear,
    semester,
    basePoints,
    totalPlus: summary.totalPlus,
    totalMinus: summary.totalMinus,
    netDiff: summary.netDiff,
    remainingPoints: summary.remainingPoints,
    conduct,
    records: semesterRecords,
    plusCount,
    minusCount,
  };
};

export interface FullYearEmulationSummary {
  schoolYear: string;
  hk1: SemesterEmulationSummary;
  hk2: SemesterEmulationSummary;
}

/**
 * Calculates independent HK I and HK II summaries for a school year.
 * Strictly keeps semesters separate (never sums base points to 400).
 */
export const calculateFullYearEmulation = (
  records: DisciplineRecord[] = [],
  config: Partial<AppConfig> | undefined,
  schoolYear: string,
  studentId?: string
): FullYearEmulationSummary => {
  return {
    schoolYear,
    hk1: calculateSemesterEmulation(records, config, schoolYear, 'HK1', studentId),
    hk2: calculateSemesterEmulation(records, config, schoolYear, 'HK2', studentId),
  };
};

export const formatSemesterLabel = (semester: SemesterFilter): string => {
  if (semester === 'HK1') return 'Học kỳ I';
  if (semester === 'HK2') return 'Học kỳ II';
  return 'Cả năm';
};
