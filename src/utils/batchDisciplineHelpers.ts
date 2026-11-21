import {
  AppConfig,
  AppState,
  AttendanceRecord,
  AttendanceStatus,
  DisciplineRecord,
  Rule,
  SeatingLayout,
  Student,
} from '../types';
import { resolveDisciplinePeriod } from './semesterHelpers';

export interface StudentGroupInfo {
  groupNumber: number;
  label: string;
  studentIds: string[];
}

export interface BatchSaveResult {
  success: boolean;
  savedCount: number;
  failedCount: number;
  skippedDuplicateCount?: number;
  syncedAttendanceCount?: number;
  error?: string;
  createdRecords?: DisciplineRecord[];
}

export type BatchGenderFilter = 'all' | 'Nam' | 'Nữ';

/**
 * Filters students purely for display by seating group (Tổ 1..4) and exact `student.gender`
 * value from student data (never guessing gender by name). Never alters selected student IDs.
 */
export const filterBatchStudents = (
  students: Student[],
  studentGroupMap: Record<string, number>,
  groupFilter: number | 'all',
  genderFilter: BatchGenderFilter
): Student[] => {
  return students.filter((student) => {
    if (groupFilter !== 'all' && studentGroupMap[student.id] !== groupFilter) {
      return false;
    }
    if (genderFilter !== 'all' && student.gender !== genderFilter) {
      return false;
    }
    return true;
  });
};

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
  const groupCount = Math.max(4, seatingLayout?.groups || 4);
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

/**
 * Generates a unique idempotency batch ID for a single batch violation confirmation.
 */
export const createBatchRequestId = (): string => {
  return `batch_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
};

/**
 * Pure, immutable state builder that appends individual DisciplineRecord entries for every
 * selected student and mirrors single-student attendance synchronization.
 *
 * Deterministic record IDs (`${batchId}_${studentId}`) guarantee that retrying the same batch
 * can never create duplicate records in `prev.discipline`.
 */
export const applyBatchDisciplineToState = (
  prev: AppState,
  payloads: Omit<DisciplineRecord, 'id'>[],
  batchId: string
): {
  nextState: AppState;
  createdRecords: DisciplineRecord[];
  skippedDuplicateCount: number;
  invalidStudentCount: number;
  syncedAttendanceCount: number;
} => {
  const validStudentIds = new Set(prev.students.map((s) => s.id));
  const existingDisciplineIds = new Set(prev.discipline.map((d) => d.id));
  const seenStudentIds = new Set<string>();
  const nowIso = new Date().toISOString();

  const createdRecords: DisciplineRecord[] = [];
  let skippedDuplicateCount = 0;
  let invalidStudentCount = 0;
  let syncedAttendanceCount = 0;

  let nextAttendance: AttendanceRecord[] = [...prev.attendance];

  payloads.forEach((record) => {
    if (!record.studentId || seenStudentIds.has(record.studentId)) {
      return;
    }
    seenStudentIds.add(record.studentId);

    if (!validStudentIds.has(record.studentId)) {
      invalidStudentCount += 1;
      return;
    }

    const recordId = `${batchId}_${record.studentId}`;
    if (existingDisciplineIds.has(recordId)) {
      skippedDuplicateCount += 1;
      return;
    }

    const resolved = resolveDisciplinePeriod(record.date, prev.config);
    const newRecord: DisciplineRecord = {
      ...record,
      id: recordId,
      schoolYear: record.schoolYear || resolved.schoolYear,
      semester: record.semester || resolved.semester,
      updatedAt: nowIso,
    };

    createdRecords.push(newRecord);
    existingDisciplineIds.add(recordId);

    // Mirror exact attendance auto-sync behavior from single-student handleAddDiscipline
    const syncedStatus = getSyncedAttendanceStatusFromRule(newRecord.ruleName);
    if (syncedStatus) {
      syncedAttendanceCount += 1;
      const existingAttIdx = nextAttendance.findIndex(
        (a) => a.studentId === newRecord.studentId && a.date === newRecord.date
      );
      if (existingAttIdx > -1) {
        nextAttendance[existingAttIdx] = {
          ...nextAttendance[existingAttIdx],
          status: syncedStatus,
        };
      } else {
        nextAttendance.push({
          id: `att_${batchId}_${newRecord.studentId}`,
          studentId: newRecord.studentId,
          date: newRecord.date,
          status: syncedStatus,
        });
      }
    }
  });

  const nextState: AppState = {
    ...prev,
    discipline: [...prev.discipline, ...createdRecords],
    attendance: nextAttendance,
  };

  return {
    nextState,
    createdRecords,
    skippedDuplicateCount,
    invalidStudentCount,
    syncedAttendanceCount,
  };
};

/**
 * Executes an atomic batch violation save:
 * 1. Verifies GVCN teacher authorization before touching state or Supabase.
 * 2. Validates non-empty payloads, date, rule, and student existence.
 * 3. Builds the next AppState immutably (never altering or deleting existing discipline records).
 * 4. Persists atomically to Supabase FIRST.
 * 5. Commits local state ONLY after Supabase confirms `res.success === true`.
 *    If Supabase fails, neither Supabase nor local state is mutated (zero partial writes).
 */
export const executeAtomicBatchDisciplineSave = async (params: {
  payloads: Omit<DisciplineRecord, 'id'>[];
  batchId: string;
  isTeacherAuthorized: () => boolean;
  getCurrentState: () => AppState;
  saveToSupabase: (nextState: AppState) => Promise<{ success: boolean; error?: string }>;
  commitState: (nextState: AppState) => void;
  clientSessionId?: string;
}): Promise<BatchSaveResult> => {
  const {
    payloads,
    batchId,
    isTeacherAuthorized,
    getCurrentState,
    saveToSupabase,
    commitState,
    clientSessionId,
  } = params;

  if (!isTeacherAuthorized()) {
    return {
      success: false,
      savedCount: 0,
      failedCount: payloads.length,
      error:
        'Không có quyền ghi dữ liệu: Chỉ giáo viên chủ nhiệm (GVCN) mới được phép ghi nhận vi phạm hàng loạt.',
    };
  }

  if (!Array.isArray(payloads) || payloads.length === 0) {
    return {
      success: false,
      savedCount: 0,
      failedCount: 0,
      error: 'Vui lòng chọn ít nhất 1 học sinh trước khi xác nhận ghi nhận.',
    };
  }

  const invalidPayload = payloads.find(
    (p) => !p.date || !p.ruleId || !p.ruleName || typeof p.points !== 'number' || p.points < 0
  );
  if (invalidPayload) {
    return {
      success: false,
      savedCount: 0,
      failedCount: payloads.length,
      error: 'Thông tin ngày vi phạm hoặc lỗi vi phạm không hợp lệ. Vui lòng kiểm tra lại.',
    };
  }

  const safeBatchId = (batchId || '').trim() || createBatchRequestId();
  const prevState = getCurrentState();
  const {
    nextState: rawNextState,
    createdRecords,
    skippedDuplicateCount,
    invalidStudentCount,
    syncedAttendanceCount,
  } = applyBatchDisciplineToState(prevState, payloads, safeBatchId);

  if (createdRecords.length === 0) {
    if (skippedDuplicateCount > 0) {
      return {
        success: true,
        savedCount: 0,
        failedCount: 0,
        skippedDuplicateCount,
        createdRecords: [],
      };
    }
    return {
      success: false,
      savedCount: 0,
      failedCount: payloads.length,
      error:
        invalidStudentCount > 0
          ? 'Không tìm thấy học sinh hợp lệ trong danh sách lớp hiện tại.'
          : 'Không có bản ghi vi phạm mới nào để lưu.',
    };
  }

  const nextState: AppState = clientSessionId
    ? {
        ...rawNextState,
        _syncMeta: {
          clientId: clientSessionId,
          timestamp: Date.now(),
        },
      }
    : rawNextState;

  try {
    const saveRes = await saveToSupabase(nextState);
    if (!saveRes.success) {
      return {
        success: false,
        savedCount: 0,
        failedCount: createdRecords.length,
        error:
          saveRes.error ||
          'Không thể lưu dữ liệu lên Supabase. Toàn bộ danh sách chưa bị thay đổi.',
      };
    }

    commitState(nextState);
    return {
      success: true,
      savedCount: createdRecords.length,
      failedCount: 0,
      skippedDuplicateCount,
      syncedAttendanceCount,
      createdRecords,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      savedCount: 0,
      failedCount: createdRecords.length,
      error: `Lỗi kết nối khi lưu vào Supabase: ${message}. Toàn bộ dữ liệu chưa bị thay đổi.`,
    };
  }
};

