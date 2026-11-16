import * as XLSX from 'xlsx';
import { AppConfig, DisciplineRecord, SemesterFilter, Student } from '../types';
import { formatDisplayDate } from './helpers';
import {
  filterDisciplineBySemester,
  formatSemesterLabel,
  getRecordPeriod,
} from './semesterHelpers';

/**
 * Sanitizes text to prevent CSV/Excel formula injection.
 * If user text begins with =, +, -, @, \t, or \r, we prepend a single quote
 * so Excel displays it strictly as literal text.
 */
export const sanitizeExcelText = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (/^[=\+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
};

export interface ExportStudentViolationsOptions {
  student: Student;
  className: string;
  schoolYear: string;
  teacherName: string;
  appName?: string;
  selectedMonth?: string; // 'all' or 'YYYY-MM'
  selectedSemester?: SemesterFilter; // 'HK1' | 'HK2' | 'ALL'
  config?: AppConfig;
  violations: DisciplineRecord[];
}

export interface ExportViolationsResult {
  success: boolean;
  message?: string;
  fileName?: string;
  count?: number;
  totalPoints?: number;
}

/**
 * Generates and downloads an Excel .xlsx workbook with 2 sheets:
 * 1. "Chi tiết vi phạm"
 * 2. "Tổng hợp theo lỗi"
 */
export const exportStudentViolationsToExcel = ({
  student,
  className,
  schoolYear,
  teacherName,
  appName = 'TRỢ LÝ CHỦ NHIỆM',
  selectedMonth = 'all',
  selectedSemester = 'ALL',
  config,
  violations,
}: ExportStudentViolationsOptions): ExportViolationsResult => {
  // 1. Filter by schoolYear & semester using shared semester helpers (deduplicated)
  const semesterFiltered = filterDisciplineBySemester(
    violations,
    config,
    schoolYear,
    selectedSemester,
    student.id
  ).filter((d) => d.type === 'minus');

  // 2. Optionally filter by month if specified
  const targetRecords =
    !selectedMonth || selectedMonth === 'all'
      ? semesterFiltered
      : semesterFiltered.filter((d) => d.date.startsWith(selectedMonth));

  const sortedViolations = [...targetRecords].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
  );

  if (sortedViolations.length === 0) {
    return {
      success: false,
      message: 'Học sinh không có vi phạm trong thời gian đã chọn',
      count: 0,
      totalPoints: 0,
    };
  }

  // Determine period display string
  const semesterText = formatSemesterLabel(selectedSemester);
  let periodText = `${semesterText} (Năm học ${schoolYear})`;
  let periodFileSuffix =
    selectedSemester === 'HK1' ? 'HK1' : selectedSemester === 'HK2' ? 'HK2' : 'Ca_nam';
  if (selectedMonth && selectedMonth !== 'all') {
    const [y, m] = selectedMonth.split('-');
    const mNum = Number(m);
    periodText = `${semesterText} - Tháng ${mNum}/${y}`;
    periodFileSuffix = `${periodFileSuffix}_${m}-${y}`;
  }

  const exportDate = new Date();
  const exportDateStr = `${String(exportDate.getDate()).padStart(2, '0')}/${String(
    exportDate.getMonth() + 1
  ).padStart(2, '0')}/${exportDate.getFullYear()}`;

  const totalMinusPoints = sortedViolations.reduce(
    (acc, d) => acc + Math.abs(d.points || 0),
    0
  );

  // ==========================================
  // SHEET 1: Chi tiết vi phạm
  // ==========================================
  const s1Rows: unknown[][] = [];

  // Metadata headers
  s1Rows.push([{ t: 's', v: 'BÁO CÁO VI PHẠM HỌC SINH' }]);
  s1Rows.push([
    { t: 's', v: `Trường / Ứng dụng: ${appName}` },
    null,
    { t: 's', v: `Lớp: ${className}` },
    null,
    { t: 's', v: `Năm học: ${schoolYear}` },
    null,
    { t: 's', v: `GVCN: ${teacherName || 'Chưa thiết lập'}` },
  ]);
  s1Rows.push([
    { t: 's', v: `Họ và tên học sinh: ${student.name}` },
    null,
    { t: 's', v: `Mã hồ sơ: ${student.id}`, z: '@' },
    null,
    { t: 's', v: `Giới tính: ${student.gender || '-'}` },
    null,
    { t: 's', v: `Ngày sinh: ${formatDisplayDate(student.dob)}` },
  ]);
  s1Rows.push([
    { t: 's', v: `Kỳ báo cáo: ${periodText}` },
    null,
    { t: 's', v: `Ngày xuất báo cáo: ${exportDateStr}` },
  ]);
  s1Rows.push([]); // blank line separator

  // Table header row (row index 5 -> 1-based Row 6)
  const s1Headers = [
    'STT',
    'Ngày xảy ra',
    'Học kỳ',
    'Tên lỗi / Quy tắc',
    'Nội dung sự việc',
    'Điểm trừ',
    'Ghi chú',
    'Người ghi nhận',
  ];
  s1Rows.push(s1Headers.map((h) => ({ t: 's', v: h })));

  // Data rows
  sortedViolations.forEach((d, idx) => {
    const rawPoints = Math.abs(d.points || 0);
    const content = d.note ? sanitizeExcelText(d.note) : sanitizeExcelText(d.ruleName);
    const noteText = d.note ? sanitizeExcelText(d.note) : '';
    const period = getRecordPeriod(d, config);

    s1Rows.push([
      { t: 'n', v: idx + 1 },
      { t: 's', v: formatDisplayDate(d.date) },
      { t: 's', v: period.semester === 'HK1' ? 'Học kỳ I' : 'Học kỳ II' },
      { t: 's', v: sanitizeExcelText(d.ruleName) },
      { t: 's', v: content },
      { t: 'n', v: rawPoints },
      { t: 's', v: noteText },
      { t: 's', v: teacherName || 'GVCN' },
    ]);
  });

  // Summary row at bottom
  s1Rows.push([
    { t: 's', v: '' },
    { t: 's', v: '' },
    { t: 's', v: '' },
    { t: 's', v: 'TỔNG CỘNG' },
    { t: 's', v: `${sortedViolations.length} lượt vi phạm` },
    { t: 'n', v: totalMinusPoints },
    { t: 's', v: '' },
    { t: 's', v: '' },
  ]);

  const ws1 = XLSX.utils.aoa_to_sheet(s1Rows);

  // Column widths for sheet 1
  ws1['!cols'] = [
    { wch: 6 },  // STT
    { wch: 14 }, // Ngày xảy ra
    { wch: 13 }, // Học kỳ
    { wch: 28 }, // Tên lỗi / Quy tắc
    { wch: 38 }, // Nội dung sự việc
    { wch: 12 }, // Điểm trừ
    { wch: 30 }, // Ghi chú
    { wch: 22 }, // Người ghi nhận
  ];

  // Freeze header at row 6
  ws1['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 6 }];

  // Auto-filter on row 6 (A6:H{totalRows})
  const s1TotalRows = s1Rows.length;
  ws1['!autofilter'] = { ref: `A6:H${s1TotalRows - 1}` };

  // ==========================================
  // SHEET 2: Tổng hợp theo lỗi
  // ==========================================
  const s2Rows: unknown[][] = [];

  // Metadata headers
  s2Rows.push([{ t: 's', v: 'BẢNG TỔNG HỢP VI PHẠM THEO LỖI' }]);
  s2Rows.push([
    { t: 's', v: `Học sinh: ${student.name} (Mã: ${student.id})` },
    null,
    { t: 's', v: `Lớp: ${className}` },
    null,
    { t: 's', v: `Năm học: ${schoolYear}` },
    null,
    { t: 's', v: `Kỳ báo cáo: ${periodText}` },
  ]);
  s2Rows.push([]); // blank line separator

  // Table header row (row index 3 -> 1-based Row 4)
  const s2Headers = [
    'STT',
    'Tên lỗi / Quy tắc vi phạm',
    'Số lượt vi phạm',
    'Tổng điểm trừ',
  ];
  s2Rows.push(s2Headers.map((h) => ({ t: 's', v: h })));

  // Group violations by rule name
  const ruleGroups = new Map<string, { count: number; totalPoints: number }>();
  sortedViolations.forEach((d) => {
    const rName = d.ruleName || 'Vi phạm khác';
    const cur = ruleGroups.get(rName) || { count: 0, totalPoints: 0 };
    cur.count += 1;
    cur.totalPoints += Math.abs(d.points || 0);
    ruleGroups.set(rName, cur);
  });

  // Sort groups by count descending, then totalPoints descending
  const sortedGroups = Array.from(ruleGroups.entries()).sort(
    (a, b) => b[1].count - a[1].count || b[1].totalPoints - a[1].totalPoints
  );

  sortedGroups.forEach(([rName, groupData], idx) => {
    s2Rows.push([
      { t: 'n', v: idx + 1 },
      { t: 's', v: sanitizeExcelText(rName) },
      { t: 'n', v: groupData.count },
      { t: 'n', v: groupData.totalPoints },
    ]);
  });

  // Summary row at bottom
  s2Rows.push([
    { t: 's', v: '' },
    { t: 's', v: 'TỔNG CỘNG' },
    { t: 'n', v: sortedViolations.length },
    { t: 'n', v: totalMinusPoints },
  ]);

  const ws2 = XLSX.utils.aoa_to_sheet(s2Rows);

  // Column widths for sheet 2
  ws2['!cols'] = [
    { wch: 6 },  // STT
    { wch: 35 }, // Tên lỗi / Quy tắc
    { wch: 18 }, // Số lượt vi phạm
    { wch: 16 }, // Tổng điểm trừ
  ];

  // Freeze header at row 4
  ws2['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];

  // Auto-filter on row 4
  const s2TotalRows = s2Rows.length;
  ws2['!autofilter'] = { ref: `A4:D${s2TotalRows - 1}` };

  // ==========================================
  // CREATE WORKBOOK & WRITE FILE
  // ==========================================
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Chi tiết vi phạm');
  XLSX.utils.book_append_sheet(wb, ws2, 'Tổng hợp theo lỗi');

  // Filename format: Vi_pham_[MaHoSo]_[Thang-Nam hoặc Tat_ca]_[NamHoc].xlsx
  const cleanId = String(student.id).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanSchoolYear = String(schoolYear).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Vi_pham_${cleanId}_${periodFileSuffix}_${cleanSchoolYear}.xlsx`;

  XLSX.writeFile(wb, fileName);

  return {
    success: true,
    fileName,
    count: sortedViolations.length,
    totalPoints: totalMinusPoints,
  };
};
