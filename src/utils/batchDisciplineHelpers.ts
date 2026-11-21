import { AppConfig, AttendanceStatus, DisciplineRecord, Rule, SeatingLayout, Student } from '../types';
import { resolveDisciplinePeriod } from './semesterHelpers';

export interface StudentGroupInfo {
  groupNumber: number;
  label: string;
  studentIds: string[];
}

/**
 * Extracts student group (Tổ 1, Tổ 2, ...) membership directly from the class seatingChart.
 * Seat keys follow the pattern `g{groupNum}-r{rowNum}-s{seatNum}`.
 */
export const buildStudentGroupData = (
  students: Student[],
  seatingChart?: Record<string, string>,
  seatingLayout?: SeatingLayout
): {
  studentGroupMap: Record<string, number>;
  groups: StudentGroupInfo[];
} => {
  const validStudentIds = new Set(students.map((s) => s.id));
  const groupCount = Math.max(1, seatingLayout?.groups || 4);
  const studentGroupMap: Record<string, number> = {};
  const groupBuckets: Record<number, Set<string>> = {};

  for (let g = 1; g <= groupCount; g++) {
    groupBuckets[g] = new Set<string>();
  }

  Object.entries(seatingChart || {}).forEach(([seatKey, studentId]) => {
    if (!studentId || !validStudentIds.has(studentId)) return;
    const match = /^g(\d+)-r\d+-s\d+$/.exec(seatKey);
    if (!match) return;
    const gNum = Number(match[1]);
    if (!Number.isFinite(gNum) || gNum < 1) return;
    if (!groupBuckets[gNum]) {
      groupBuckets[gNum] = new Set<string>();
    }
    groupBuckets[gNum].add(studentId);
    studentGroupMap[studentId] = gNum;
  });

  const groups: StudentGroupInfo[] = Object.keys(groupBuckets)
    .map(Number)
    .sort((a, b) => a - b)
    .map((groupNumber) => ({
      groupNumber,
      label: `Tổ ${groupNumber}`,
      studentIds: Array.from(groupBuckets[groupNumber]),
    }));

  return { studentGroupMap, groups };
};

/**
 * Returns only violation rules (type === 'minus') from existing configured AppConfig rules.
 */
export const getViolationRules = (rules: Rule[] = []): Rule[] => {
  return rules.filter((r) => r.type === 'minus');
};

/**
 * Mirrors single-student attendance auto-sync rule resolution from App.tsx.
 */
export const getSyncedAttendanceStatusFromRule = (ruleName: string): AttendanceStatus | null => {
  const ruleLower = (ruleName || '').toLowerCase();
  if (ruleLower.includes('muộn') || ruleLower.includes('trễ')) {
    return 'm';
  }
  if (
    ruleLower.includes('không phép') ||
    ruleLower.includes('cúp tiết') ||
    ruleLower.includes('trốn học')
  ) {
    return 'kp';
  }
  if (
    ruleLower.includes('nghỉ học') ||
    ruleLower.includes('vắng') ||
    ruleLower.includes('bỏ tiết')
  ) {
    return 'v';
  }
  return null;
};

/**
 * Checks which selected students already have a discipline record with the exact same date & ruleId.
 * Helps teachers avoid accidental duplicate deductions.
 */
export const findExistingSameDayViolationStudentIds = (
  existingDiscipline: DisciplineRecord[],
  studentIds: string[],
  date: string,
  ruleId: string
): Set<string> => {
  const targetIds = new Set(studentIds);
  const duplicates = new Set<string>();
  if (!date || !ruleId || targetIds.size === 0) return duplicates;

  existingDiscipline.forEach((rec) => {
    if (
      rec.type === 'minus' &&
      targetIds.has(rec.studentId) &&
      rec.date === date &&
      rec.ruleId === ruleId
    ) {
      duplicates.add(rec.studentId);
    }
  });

  return duplicates;
};

/**
 * Builds individual DisciplineRecord payloads (without id) using the exact same structure
 * and period resolution as single-student violation logging.
 */
export const buildBatchDisciplinePayloads = (params: {
  studentIds: string[];
  date: string;
  rule: Rule;
  note?: string;
  config: AppConfig;
}): Omit<DisciplineRecord, 'id'>[] => {
  const { studentIds, date, rule, note, config } = params;
  const uniqueIds = Array.from(new Set(studentIds));
  const resolved = resolveDisciplinePeriod(date, config);
  const trimmedNote = (note || '').trim();

  return uniqueIds.map((studentId) => ({
    studentId,
    date,
    ruleId: rule.id,
    ruleName: rule.name,
    points: rule.points,
    type: 'minus',
    note: trimmedNote,
    schoolYear: resolved.schoolYear,
    semester: resolved.semester,
  }));
};
