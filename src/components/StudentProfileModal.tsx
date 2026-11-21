import React, { useState, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Camera,
  Trash2,
  Copy,
  CalendarCheck,
  GraduationCap,
  Scale,
  Star,
  Plus,
  Printer,
  KeyRound,
  Edit2,
  LogOut,
  Calendar,
  Save,
  Check,
  User,
  Phone,
  MapPin,
  Clock,
  BookOpen,
  History,
  TrendingUp,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FileSpreadsheet,
  AlertTriangle,
  X,
  Users,
} from 'lucide-react';
import {
  AppState,
  AttendanceStatus,
  DisciplineRecord,
  NoteRecord,
  SemesterFilter,
  SemesterId,
  Student,
} from '../types';
import {
  formatDisplayDate,
  getCurrentMonthStr,
  getTodayStr,
  resizeImageBase64,
} from '../utils/helpers';
import {
  calculateFullYearEmulation,
  calculateSemesterEmulation,
  detectActiveSemester,
  filterDisciplineBySemester,
  formatSemesterLabel,
  getAvailableSchoolYears,
  getRecordPeriod,
  getSemesterBasePoints,
  resolveDisciplinePeriod,
} from '../utils/semesterHelpers';
import {
  calculateClassAcademicSummary,
  getStudentAcademicHistory,
  parseGradeValue,
} from '../utils/academicHelpers';
import { exportStudentViolationsToExcel } from '../utils/violationExcelHelper';
import { BatchSaveResult } from '../utils/batchDisciplineHelpers';
import { PrintReportModal } from './PrintReportModal';
import { ChangePasswordModal } from './ChangePasswordModal';
import { ConfirmModal } from './ConfirmModal';
import { BatchViolationModal } from './BatchViolationModal';

interface StudentProfileModalProps {
  studentId: string | null;
  state: AppState;
  isTeacher: boolean;
  initialMonth?: string;
  initialYear?: string;
  onClose: () => void;
  onEditStudent: (student: Student) => void;
  onUpdateAvatar: (studentId: string, base64: string) => void;
  onSaveGrades: (studentId: string, grades: Record<string, number>) => void;
  onSaveAcademicGrades?: (
    studentId: string,
    month: string,
    grades: Record<string, number | undefined>
  ) => void;
  onAddDiscipline: (record: Omit<DisciplineRecord, 'id'>) => void;
  onAddBatchDiscipline?: (
    records: Omit<DisciplineRecord, 'id'>[],
    batchId: string
  ) => Promise<BatchSaveResult>;
  onUpdateDiscipline?: (record: DisciplineRecord) => void;
  onDeleteDiscipline: (recordId: string) => void;
  onDeleteAttendance?: (attendanceId: string) => void;
  onAddNote: (record: Omit<NoteRecord, 'id'>) => void;
  onDeleteNote: (noteId: string) => void;
  onChangePassword: (studentId: string, newPass: string) => void;
  onLogout: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  studentId,
  state,
  isTeacher,
  initialMonth,
  initialYear,
  onClose,
  onEditStudent,
  onUpdateAvatar,
  onSaveGrades,
  onSaveAcademicGrades,
  onAddDiscipline,
  onAddBatchDiscipline,
  onUpdateDiscipline,
  onDeleteDiscipline,
  onDeleteAttendance,
  onAddNote,
  onDeleteNote,
  onChangePassword,
  onLogout,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<
    'info' | 'attendance' | 'grades' | 'discipline' | 'notes'
  >('info');
  const activeSemesterPeriod = useMemo(
    () => detectActiveSemester(state.config),
    [state.config]
  );
  const [selectedDisciplineYear, setSelectedDisciplineYear] = useState<string>(
    () => activeSemesterPeriod.schoolYear
  );
  const [selectedDisciplineSemester, setSelectedDisciplineSemester] = useState<SemesterFilter>(
    () => activeSemesterPeriod.semester
  );
  const [selectedDisciplineMonth, setSelectedDisciplineMonth] = useState<string>('all');
  const [editingDisciplineId, setEditingDisciplineId] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);
  const [isBatchViolationOpen, setIsBatchViolationOpen] = useState(false);
  const [confirmDeleteDisciplineId, setConfirmDeleteDisciplineId] = useState<string | null>(null);
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);
  const [confirmDeleteAttendanceId, setConfirmDeleteAttendanceId] = useState<string | null>(null);
  const [locallyDeletedDisciplineIds, setLocallyDeletedDisciplineIds] = useState<string[]>([]);
  const [locallyDeletedNoteIds, setLocallyDeletedNoteIds] = useState<string[]>([]);

  const student = useMemo(() => {
    return state.students.find((s) => s.id === studentId);
  }, [state.students, studentId]);

  // Find all distinct months recorded for this student
  const studentRecordedMonths = useMemo(() => {
    if (!student) return [];
    const sId = (student.id || '').trim();
    const months = new Set<string>();
    (state.academicGrades || []).forEach((g) => {
      if ((g.studentId || '').trim() === sId && g.month) {
        months.add(g.month.trim());
      }
    });
    // Also include class-level months if student records empty
    if (months.size === 0) {
      (state.academicGrades || []).forEach((g) => {
        if (g.month) months.add(g.month.trim());
      });
    }
    return Array.from(months).sort().reverse();
  }, [student, state.academicGrades]);

  // Academic month & year state
  const [academicMonth, setAcademicMonth] = useState<string>(() => {
    if (initialMonth) return initialMonth;
    const sId = (studentId || '').trim();
    const hasStudentRecord = (state.academicGrades || []).filter(
      (g) => (g.studentId || '').trim() === sId && g.month
    );
    if (hasStudentRecord.length > 0) {
      const sorted = Array.from(new Set(hasStudentRecord.map((g) => g.month))).sort().reverse();
      if (sorted[0]) return sorted[0];
    }
    const classMonths = Array.from(new Set((state.academicGrades || []).map((g) => g.month))).sort().reverse();
    if (classMonths[0]) return classMonths[0];
    return getCurrentMonthStr();
  });
  const [academicYear, setAcademicYear] = useState<string>(
    initialYear || state.config.schoolYear || '2026-2027'
  );

  React.useEffect(() => {
    if (initialMonth) {
      setAcademicMonth(initialMonth);
    } else if (studentRecordedMonths.length > 0 && (!academicMonth || !studentRecordedMonths.includes(academicMonth))) {
      setAcademicMonth(studentRecordedMonths[0]);
    }
  }, [initialMonth, studentId]);

  React.useEffect(() => {
    if (initialYear) {
      setAcademicYear(initialYear);
    }
  }, [initialYear]);

  // Direct discipline form state
  const [disDate, setDisDate] = useState(getTodayStr());
  const [disRuleId, setDisRuleId] = useState(state.config.rules[0]?.id || '');
  const [disNote, setDisNote] = useState('');

  // Grades local state
  const [tempGrades, setTempGrades] = useState<Record<string, number>>({});

  // Note form state
  const [noteDate, setNoteDate] = useState(getTodayStr());
  const [noteType, setNoteType] = useState<'Liên hệ PH' | 'Học tập' | 'Khác'>('Liên hệ PH');
  const [noteContent, setNoteContent] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const detailSectionRef = useRef<HTMLDivElement>(null);

  // Sync tempGrades from state.academicGrades for the selected academicMonth & academicYear
  React.useEffect(() => {
    if (student) {
      const sId = (student.id || '').trim();
      const mGrades: Record<string, number> = {};

      (state.academicGrades || []).forEach((g) => {
        const classMatch =
          !g.className ||
          !state.config.className ||
          g.className.trim().toLowerCase() === state.config.className.trim().toLowerCase();
        const yearMatch = !g.schoolYear || !academicYear || g.schoolYear.trim() === academicYear.trim();
        const monthMatch = (g.month || '').trim() === academicMonth.trim();
        const idMatch = (g.studentId || '').trim() === sId;

        if (classMatch && yearMatch && monthMatch && idMatch) {
          mGrades[g.subject.trim()] = g.score;
        }
      });

      // If no monthly records yet in academicGrades, check legacy student.grades only if academicGrades is completely uninitialized
      if (
        Object.keys(mGrades).length === 0 &&
        student.grades &&
        Object.keys(student.grades).length > 0 &&
        (state.academicGrades || []).length === 0
      ) {
        setTempGrades(student.grades);
      } else {
        setTempGrades(mGrades);
      }

      setLocallyDeletedDisciplineIds([]);
      setLocallyDeletedNoteIds([]);
    }
  }, [student?.id, academicMonth, academicYear, state.academicGrades, state.config.className]);

  // Sync disRuleId when rules load or change
  React.useEffect(() => {
    if ((!disRuleId || !state.config.rules.some((r) => r.id === disRuleId)) && state.config.rules.length > 0) {
      setDisRuleId(state.config.rules[0].id);
    }
  }, [state.config.rules, disRuleId]);

  // Keep selectedDisciplineYear/Semester synced with config changes when switching students
  React.useEffect(() => {
    setSelectedDisciplineYear(activeSemesterPeriod.schoolYear);
    setSelectedDisciplineSemester(activeSemesterPeriod.semester);
    setSelectedDisciplineMonth('all');
    setEditingDisciplineId(null);
  }, [studentId, activeSemesterPeriod.schoolYear, activeSemesterPeriod.semester]);

  const disDateResolution = useMemo(
    () => resolveDisciplinePeriod(disDate, state.config, selectedDisciplineYear),
    [disDate, state.config, selectedDisciplineYear]
  );

  if (!student) return null;

  // Attendance stats
  const studentAtt = state.attendance.filter((a) => a.studentId === student.id);
  const totalAbsences = studentAtt.filter(
    (a) => a.status === 'v' || a.status === 'kp' || a.status === 'm'
  ).length;

  // Discipline stats: Independent 200-point calculation per semester (never cumulative 400)
  const activeStudentDiscipline = state.discipline.filter(
    (d) => d.studentId === student.id && !locallyDeletedDisciplineIds.includes(d.id)
  );
  const semesterBasePoints = getSemesterBasePoints(state.config);
  const availableDisciplineYears = getAvailableSchoolYears(state.config, activeStudentDiscipline);

  // Overview card always displays the currently selected single semester (or active semester if 'ALL')
  const overviewSemester: SemesterId =
    selectedDisciplineSemester === 'ALL'
      ? activeSemesterPeriod.semester
      : selectedDisciplineSemester;
  const overviewYear =
    selectedDisciplineSemester === 'ALL'
      ? activeSemesterPeriod.schoolYear
      : selectedDisciplineYear;
  const overviewSummary = calculateSemesterEmulation(
    activeStudentDiscipline,
    state.config,
    overviewYear,
    overviewSemester,
    student.id
  );
  const overallPoints = overviewSummary.remainingPoints;
  const overallConduct = overviewSummary.conduct;

  // Academic summary for this student in the selected academicMonth
  const academicSummary = useMemo(() => {
    if (!student) return null;
    const summaries = calculateClassAcademicSummary(
      state.students,
      state.config.className,
      academicYear,
      academicMonth,
      state.academicGrades || [],
      state.config.subjects || [],
      state.config.evaluationSubjects || []
    );
    return summaries.find((s) => s.studentId.trim() === student.id.trim()) || null;
  }, [
    student,
    state.students,
    state.config.className,
    academicYear,
    academicMonth,
    state.academicGrades,
    state.config.subjects,
    state.config.evaluationSubjects,
  ]);

  // Full monthly academic history for charts and trend tracking
  const studentAcademicHistory = useMemo(() => {
    if (!student) return [];
    return getStudentAcademicHistory(
      student.id,
      state.students,
      state.config.className,
      academicYear,
      state.academicGrades || [],
      state.config.subjects || [],
      state.config.evaluationSubjects || []
    );
  }, [
    student,
    state.students,
    state.config.className,
    academicYear,
    state.academicGrades,
    state.config.subjects,
    state.config.evaluationSubjects,
  ]);

  // GPA calculation for display
  const gpaStr = academicSummary?.formattedAverage || 'Chưa có điểm';

  // Discipline period calculations for Tab 4
  const semesterFilteredDiscipline = filterDisciplineBySemester(
    activeStudentDiscipline,
    state.config,
    selectedDisciplineYear,
    selectedDisciplineSemester,
    student.id
  );

  // Available months inside the selected school year + semester filter
  const disciplineMonths = Array.from(
    new Set(semesterFilteredDiscipline.map((d) => d.date.substring(0, 7)))
  )
    .sort()
    .reverse();

  const filteredDiscipline = (
    selectedDisciplineMonth === 'all'
      ? semesterFilteredDiscipline
      : semesterFilteredDiscipline.filter((d) => d.date.startsWith(selectedDisciplineMonth))
  )
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  // Summaries: single semester vs full year (strictly independent HK1 and HK2, never summed to 400)
  const fullYearSummary = calculateFullYearEmulation(
    activeStudentDiscipline,
    state.config,
    selectedDisciplineYear,
    student.id
  );
  const activeSingleSemesterSummary =
    selectedDisciplineSemester === 'HK2' ? fullYearSummary.hk2 : fullYearSummary.hk1;

  // If teacher narrows further to a specific month inside a single semester, compute month delta alongside semester summary
  const monthScopedPointsSummary =
    selectedDisciplineMonth !== 'all' && selectedDisciplineSemester !== 'ALL'
      ? (() => {
          let plus = 0;
          let minus = 0;
          filteredDiscipline.forEach((r) => {
            if (r.type === 'plus') plus += Number(r.points) || 0;
            else minus += Number(r.points) || 0;
          });
          return {
            totalPlus: plus,
            totalMinus: minus,
            remainingPoints: semesterBasePoints + plus - minus,
          };
        })()
      : null;

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      resizeImageBase64(file, 250, 250, (base64) => {
        onUpdateAvatar(student.id, base64);
        onShowToast('Đã cập nhật ảnh đại diện học sinh');
      });
    }
    e.target.value = '';
  };

  const handleRemoveAvatar = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateAvatar(student.id, '');
    onShowToast('Đã xóa ảnh đại diện');
  };

  const handleCopyPhone = () => {
    if (student.phone) {
      navigator.clipboard.writeText(student.phone);
      onShowToast(`Đã sao chép số điện thoại: ${student.phone}`);
    }
  };

  const handleJumpToTab = (tab: typeof activeTab) => {
    setActiveTab(tab);
    detailSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSaveAllGrades = () => {
    if (onSaveAcademicGrades) {
      onSaveAcademicGrades(student.id, academicMonth, tempGrades);
    } else {
      onSaveGrades(student.id, tempGrades as Record<string, number>);
      onShowToast('Đã lưu bảng điểm học tập');
    }
  };

  const handleStartEditDiscipline = (rec: DisciplineRecord) => {
    setEditingDisciplineId(rec.id);
    setDisDate(rec.date);
    setDisRuleId(rec.ruleId || state.config.rules[0]?.id || '');
    setDisNote(rec.note || '');
  };

  const handleCancelEditDiscipline = () => {
    setEditingDisciplineId(null);
    setDisDate(getTodayStr());
    setDisRuleId(state.config.rules[0]?.id || '');
    setDisNote('');
  };

  const handleSubmitDiscipline = (e: React.FormEvent) => {
    e.preventDefault();
    const existingEditing = editingDisciplineId
      ? activeStudentDiscipline.find((d) => d.id === editingDisciplineId)
      : undefined;

    const rule =
      state.config.rules.find((r) => r.id === disRuleId) ||
      (existingEditing
        ? {
            id: existingEditing.ruleId,
            name: existingEditing.ruleName,
            points: existingEditing.points,
            type: existingEditing.type,
          }
        : state.config.rules[0]);

    if (!rule) {
      onShowToast('Chưa có quy tắc thi đua nào được cấu hình trong hệ thống', 'error');
      return;
    }

    const resolved = resolveDisciplinePeriod(disDate, state.config, selectedDisciplineYear);

    if (editingDisciplineId && existingEditing && onUpdateDiscipline) {
      onUpdateDiscipline({
        ...existingEditing,
        date: disDate,
        ruleId: rule.id,
        ruleName: rule.name,
        points: rule.points,
        type: rule.type,
        note: disNote.trim(),
        schoolYear: resolved.schoolYear,
        semester: resolved.semester,
      });
      setEditingDisciplineId(null);
    } else {
      onAddDiscipline({
        studentId: student.id,
        date: disDate,
        ruleId: rule.id,
        ruleName: rule.name,
        points: rule.points,
        type: rule.type,
        note: disNote.trim(),
        schoolYear: resolved.schoolYear,
        semester: resolved.semester,
      });
      onShowToast(
        `Đã lưu vào ${resolved.semester === 'HK1' ? 'Học kỳ I' : 'Học kỳ II'} (${resolved.schoolYear}): ${rule.name} (${rule.type === 'plus' ? `+${rule.points}` : `-${rule.points}`}đ)`
      );
    }

    setDisNote('');
    setSelectedDisciplineMonth('all');
    setSelectedDisciplineYear(resolved.schoolYear);
    if (selectedDisciplineSemester !== 'ALL') {
      setSelectedDisciplineSemester(resolved.semester);
    }
  };

  const handleExportViolationsExcel = () => {
    if (!isTeacher) {
      onShowToast('Chỉ giáo viên mới có quyền xuất báo cáo vi phạm học sinh.', 'error');
      return;
    }

    if (!student) {
      onShowToast('Không tìm thấy thông tin học sinh để xuất.', 'error');
      return;
    }

    const res = exportStudentViolationsToExcel({
      student,
      className: state.config.className || 'Lớp',
      schoolYear: selectedDisciplineYear || state.config.schoolYear || '2026-2027',
      teacherName: state.config.teacherName || 'Giáo viên chủ nhiệm',
      appName: state.config.appName || 'TRỢ LÝ CHỦ NHIỆM',
      selectedMonth: selectedDisciplineMonth,
      selectedSemester: selectedDisciplineSemester,
      config: state.config,
      violations: activeStudentDiscipline,
    });

    if (!res.success) {
      onShowToast(res.message || 'Học sinh không có vi phạm trong thời gian đã chọn', 'error');
    } else {
      onShowToast(
        `Đã xuất Excel thành công: ${res.count} lỗi vi phạm (Tổng điểm trừ: ${res.totalPoints}đ)`,
        'success'
      );
    }
  };

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    onAddNote({
      studentId: student.id,
      date: noteDate,
      type: noteType,
      content: noteContent.trim(),
    });

    setNoteContent('');
    setIsAddNoteModalOpen(false);
    onShowToast('Đã thêm ghi chú liên lạc');
  };

  return (
    <div className="fixed inset-0 bg-[#FFF8F4] z-50 flex flex-col overflow-hidden animate-fadeIn">
      {/* Top Navbar */}
      <div className="bg-white border-b border-[#E8DEDA] h-16 shrink-0 flex items-center px-4 lg:px-8 shadow-xs relative z-20">
        <button
          onClick={onClose}
          className="text-[#697589] hover:text-[#233146] mr-3 p-2 rounded-xl hover:bg-[#F5EDEB] transition-colors flex items-center gap-1.5 font-bold text-xs sm:text-sm cursor-pointer"
          title="Quay lại giao diện lớp học"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Quay lại</span>
        </button>

        <div className="flex-1 min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-[#233146] leading-snug">
            Hồ sơ học sinh: <span className="uppercase text-[#922235]">{student.name}</span>
          </h2>
          <p className="text-[11px] text-[#697589] font-mono">
            Mã định danh: {student.id} {student.studentCode ? `• Mã HS: ${student.studentCode}` : ''}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Print Report */}
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="px-3 py-2 bg-[#F5EDEB] hover:bg-[#E8DEDA] text-[#922235] font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-[#E8DEDA]"
            title="In phiếu liên lạc"
          >
            <Printer className="w-3.5 h-3.5 text-[#922235]" />
            <span className="hidden sm:inline">Phiếu liên lạc</span>
          </button>

          {!isTeacher && (
            <>
              {/* Change Password */}
              <button
                onClick={() => setIsPasswordModalOpen(true)}
                className="px-3 py-2 bg-[#F5EDEB] hover:bg-[#E8DEDA] text-[#922235] font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-[#E8DEDA]"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#922235]" />
                <span className="hidden sm:inline">Đổi mật khẩu</span>
              </button>
              {/* Logout */}
              <button
                onClick={onLogout}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Thoát</span>
              </button>
            </>
          )}

          {isTeacher && (
            <button
              onClick={() => onEditStudent(student)}
              className="px-3.5 py-2 bg-[#922235] hover:bg-[#781C2B] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sửa thông tin</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-[#FFF8F4]">
        <div className="max-w-5xl mx-auto space-y-6 pb-20">
          {/* OVERVIEW CARD */}
          <div className="bg-white rounded-3xl shadow-xs border border-[#E8DEDA] p-6 flex flex-col items-center">
            {/* Avatar */}
            <div
              onClick={() => isTeacher && fileInputRef.current?.click()}
              className={`relative group mb-4 ${isTeacher ? 'cursor-pointer' : ''}`}
              title={isTeacher ? 'Bấm để đổi ảnh học sinh' : ''}
            >
              <div className="w-24 h-24 rounded-full bg-[#F5EDEB] border-4 border-white text-[#922235] flex items-center justify-center text-4xl font-black shadow-md overflow-hidden ring-4 ring-[#E8DEDA]">
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
              {isTeacher && (
                <>
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  {student.avatar && (
                    <button
                      onClick={handleRemoveAvatar}
                      className="absolute bottom-0 right-0 bg-rose-600 hover:bg-rose-700 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-md border-2 border-white transition-colors cursor-pointer"
                      title="Xóa ảnh"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/jpeg, image/png, image/webp"
                    onChange={handleAvatarFile}
                  />
                </>
              )}
            </div>

            {/* Name & Basic info */}
            <h1 className="text-2xl sm:text-3xl font-black text-[#233146] uppercase tracking-tight text-center">
              {student.name}
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm font-semibold text-[#697589] mt-2 mb-6">
              <span className={student.gender === 'Nam' ? 'text-blue-600 font-bold' : 'text-pink-600 font-bold'}>
                {student.gender}
              </span>
              <span className="text-[#E8DEDA]">•</span>
              <span>Ngày sinh: {formatDisplayDate(student.dob)}</span>
              <span className="text-[#E8DEDA]">•</span>
              <span className="bg-[#F5EDEB] text-[#922235] px-2.5 py-0.5 rounded-lg font-mono font-black border border-[#E8DEDA]">
                Mã ID: {student.id}
              </span>
              {student.studentCode && (
                <span className="bg-[#F5EDEB] text-[#922235] px-2.5 py-0.5 rounded-lg font-mono font-black border border-[#E8DEDA]">
                  Mã HS: #{student.studentCode}
                </span>
              )}
            </div>

            {/* 4 Clickable Quick Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-3xl">
              {/* Card 1: Điểm danh */}
              <div
                onClick={() => handleJumpToTab('attendance')}
                className="bg-[#F5EDEB]/50 hover:bg-[#F5EDEB] border border-[#E8DEDA] rounded-2xl p-3.5 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:-translate-y-0.5 shadow-2xs"
              >
                <span className="text-[11px] font-black text-[#922235] uppercase flex items-center gap-1 mb-1">
                  <CalendarCheck className="w-3.5 h-3.5 text-[#922235]" /> Điểm danh
                </span>
                <p className="text-xl font-black text-[#922235]">
                  {totalAbsences}{' '}
                  <span className="text-xs font-semibold text-[#697589]">vắng/muộn</span>
                </p>
              </div>

              {/* Card 2: Học tập */}
              <div
                onClick={() => handleJumpToTab('grades')}
                className="bg-emerald-50/50 hover:bg-emerald-100/60 border border-emerald-100 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:-translate-y-0.5 shadow-2xs"
              >
                <span className="text-[11px] font-bold text-emerald-700 uppercase flex items-center gap-1 mb-1">
                  <GraduationCap className="w-3.5 h-3.5" /> Học tập
                </span>
                <p className="text-xl font-black text-emerald-800">
                  {gpaStr}{' '}
                  <span className="text-xs font-normal text-emerald-600">ĐTB môn</span>
                </p>
              </div>

              {/* Card 3: Thi đua */}
              <div
                onClick={() => handleJumpToTab('discipline')}
                className="bg-[#F5EDEB]/60 hover:bg-[#F5EDEB] border border-[#E8DEDA] rounded-2xl p-3.5 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:-translate-y-0.5 shadow-2xs"
              >
                <span className="text-[11px] font-black text-[#922235] uppercase flex items-center gap-1 mb-1">
                  <Scale className="w-3.5 h-3.5" /> Điểm thi đua còn lại
                </span>
                <p className={`text-xl font-black ${overallConduct.color}`}>
                  {overallPoints}{' '}
                  <span className="text-xs font-bold text-[#697589]">/ {semesterBasePoints}đ</span>
                </p>
                <span className="text-[10px] text-[#697589] mt-0.5 font-semibold">
                  {overviewSemester === 'HK1' ? 'Học kỳ I' : 'Học kỳ II'} •{' '}
                  {overviewSummary.totalMinus > 0 ? `-${overviewSummary.totalMinus}đ` : '0 trừ'}
                  {overviewSummary.totalPlus > 0 ? ` / +${overviewSummary.totalPlus}đ` : ''}
                </span>
              </div>

              {/* Card 4: Hạnh kiểm */}
              <div
                onClick={() => handleJumpToTab('discipline')}
                className="bg-amber-50/50 hover:bg-amber-100/60 border border-amber-100 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:-translate-y-0.5 shadow-2xs"
              >
                <span className="text-[11px] font-bold text-amber-700 uppercase flex items-center gap-1 mb-1">
                  <Star className="w-3.5 h-3.5" /> Hạnh kiểm ({overviewSemester === 'HK1' ? 'HK I' : 'HK II'})
                </span>
                <p className={`text-xl font-black ${overallConduct.color}`}>
                  {overallConduct.text}
                </p>
              </div>
            </div>
          </div>

          {/* TABS SECTION */}
          <div
            ref={detailSectionRef}
            className="bg-white rounded-3xl shadow-xs border border-gray-100 overflow-hidden"
          >
            {/* Tab navigation */}
            <div className="flex border-b border-[#E8DEDA] bg-[#F5EDEB]/50 overflow-x-auto">
              <button
                onClick={() => setActiveTab('info')}
                className={`px-6 py-4 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'info'
                    ? 'border-[#922235] text-[#922235] bg-white font-black'
                    : 'border-transparent text-[#697589] hover:text-[#233146] hover:bg-white/60'
                }`}
              >
                Thông tin cá nhân
              </button>
              <button
                onClick={() => setActiveTab('attendance')}
                className={`px-6 py-4 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'attendance'
                    ? 'border-[#922235] text-[#922235] bg-white font-black'
                    : 'border-transparent text-[#697589] hover:text-[#233146] hover:bg-white/60'
                }`}
              >
                Điểm danh ({studentAtt.length})
              </button>
              <button
                onClick={() => setActiveTab('grades')}
                className={`px-6 py-4 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'grades'
                    ? 'border-[#922235] text-[#922235] bg-white font-black'
                    : 'border-transparent text-[#697589] hover:text-[#233146] hover:bg-white/60'
                }`}
              >
                Học tập &amp; Điểm số
              </button>
              <button
                onClick={() => setActiveTab('discipline')}
                className={`px-6 py-4 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'discipline'
                    ? 'border-[#922235] text-[#922235] bg-white font-black'
                    : 'border-transparent text-[#697589] hover:text-[#233146] hover:bg-white/60'
                }`}
              >
                Thi đua &amp; Kỷ luật
              </button>
              {isTeacher && (
                <button
                  onClick={() => setActiveTab('notes')}
                  className={`px-6 py-4 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === 'notes'
                      ? 'border-[#922235] text-[#922235] bg-white font-black'
                      : 'border-transparent text-[#697589] hover:text-[#233146] hover:bg-white/60'
                  }`}
                >
                  Sổ tay &amp; Liên hệ
                </button>
              )}
            </div>

            {/* TAB CONTENT */}
            <div className="p-6">
              {/* TAB 1: THÔNG TIN */}
              {activeTab === 'info' && (
                <div className="space-y-6">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
                    Thông tin liên hệ &amp; Gia đình
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-100">
                      <span className="text-xs text-gray-400 font-semibold block mb-1">
                        Họ tên Phụ huynh
                      </span>
                      <p className="font-bold text-gray-900 text-sm">
                        {student.parentName || 'Chưa cập nhật'}
                      </p>
                    </div>

                    <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-gray-400 font-semibold block mb-1">
                          Số điện thoại liên hệ
                        </span>
                        <p className="font-bold text-gray-900 text-sm">
                          {student.phone || 'Chưa cập nhật'}
                        </p>
                      </div>
                      {student.phone && (
                        <button
                          onClick={handleCopyPhone}
                          className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors cursor-pointer"
                          title="Sao chép số điện thoại"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-100 md:col-span-2">
                      <span className="text-xs text-gray-400 font-semibold block mb-1">
                        Địa chỉ thường trú
                      </span>
                      <p className="font-bold text-gray-900 text-sm">
                        {student.address || 'Chưa cập nhật'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ĐIỂM DANH */}
              {activeTab === 'attendance' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-bold text-gray-800">
                      Lịch sử điểm danh chi tiết
                    </h3>
                    <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded-full">
                      Tổng vắng/muộn: {totalAbsences} buổi
                    </span>
                  </div>

                    <div className="border border-gray-200 rounded-2xl overflow-hidden max-h-[400px] overflow-y-auto custom-scrollbar scroll-smooth overscroll-contain shadow-2xs">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 font-bold text-gray-600">Ngày</th>
                          <th className="px-4 py-3 font-bold text-gray-600 text-center">
                            Trạng thái
                          </th>
                          {isTeacher && (
                            <th className="px-4 py-3 font-bold text-gray-600 text-center w-20">
                              Thao tác
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {studentAtt.length === 0 ? (
                          <tr>
                            <td colSpan={isTeacher ? 3 : 2} className="px-4 py-8 text-center text-gray-400">
                              Chưa có dữ liệu điểm danh cho học sinh này.
                            </td>
                          </tr>
                        ) : (
                          [...studentAtt]
                            .sort(
                              (a, b) =>
                                new Date(b.date).getTime() - new Date(a.date).getTime()
                            )
                            .map((att) => {
                              let statusTag = (
                                <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">
                                  Có mặt
                                </span>
                              );
                              if (att.status === 'v') {
                                statusTag = (
                                  <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                                    Có phép
                                  </span>
                                );
                              } else if (att.status === 'kp') {
                                statusTag = (
                                  <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-bold">
                                    Không phép
                                  </span>
                                );
                              } else if (att.status === 'm') {
                                statusTag = (
                                  <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-bold">
                                    Đi học muộn
                                  </span>
                                );
                              }

                              return (
                                <tr key={att.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 font-semibold text-gray-800">
                                    {formatDisplayDate(att.date)}
                                  </td>
                                  <td className="px-4 py-3 text-center">{statusTag}</td>
                                  {isTeacher && (
                                    <td className="px-4 py-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteAttendanceId(att.id)}
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                        title="Xóa bản ghi điểm danh này"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: HỌC TẬP & ĐIỂM SỐ */}
              {activeTab === 'grades' && (
                <div className="space-y-6">
                  {/* Month & Year Selection Bar */}
                  <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-cyan-50/90 p-4 rounded-2xl border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-200 shrink-0">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-gray-900 text-sm">
                            Điểm Học Tập Theo Tháng
                          </h4>
                          <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                            Lớp {state.config.className}
                          </span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                            Năm học {academicYear}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Dữ liệu điểm chi tiết đồng bộ trực tiếp với Bảng điểm cả lớp và Top 5 vinh danh
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap self-stretch sm:self-auto justify-between sm:justify-start">
                      {/* Quick recorded month buttons */}
                      {studentRecordedMonths.map((mStr) => {
                        const [mY, mM] = mStr.split('-');
                        const isSel = mStr === academicMonth;
                        return (
                          <button
                            key={mStr}
                            type="button"
                            onClick={() => setAcademicMonth(mStr)}
                            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              isSel
                                ? 'bg-blue-600 text-white shadow-2xs'
                                : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200'
                            }`}
                          >
                            T{Number(mM)}/{mY}
                          </button>
                        );
                      })}

                      {/* Month selector */}
                      <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-blue-300 shadow-2xs">
                        <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                        <input
                          type="month"
                          value={academicMonth}
                          onChange={(e) => {
                            if (e.target.value) setAcademicMonth(e.target.value);
                          }}
                          className="bg-transparent text-xs font-black text-gray-800 outline-none cursor-pointer"
                        />
                      </div>

                      {isTeacher && (
                        <button
                          type="button"
                          onClick={handleSaveAllGrades}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Lưu điểm</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Month Summary Stats Card */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block mb-0.5">
                          Trung bình cộng (ĐTB)
                        </span>
                        <div className="text-xl font-black text-blue-900">
                          {academicSummary?.formattedAverage || 'Chưa có điểm'}
                        </div>
                        <span className="text-[10px] text-gray-400">
                          Tháng {academicMonth.split('-')[1]}/{academicMonth.split('-')[0]}
                        </span>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block mb-0.5">
                          Số môn đã có điểm
                        </span>
                        <div className="text-xl font-black text-emerald-900">
                          {academicSummary?.validSubjectsCount || 0} / {state.config.subjects.length} môn
                        </div>
                        <span className="text-[10px] text-gray-400">
                          {state.config.subjects.length - (academicSummary?.validSubjectsCount || 0) === 0
                            ? 'Đủ tất cả các môn'
                            : `Còn thiếu ${state.config.subjects.length - (academicSummary?.validSubjectsCount || 0)} môn`}
                        </span>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        <Check className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block mb-0.5">
                          Xếp hạng trong lớp
                        </span>
                        <div className="text-xl font-black text-amber-900">
                          {academicSummary?.rank !== null && academicSummary?.rank !== undefined
                            ? `Hạng ${academicSummary.rank} / ${state.students.length}`
                            : 'Chưa có hạng'}
                        </div>
                        <span className="text-[10px] text-gray-400">
                          Bằng điểm cùng thứ hạng
                        </span>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                        <Star className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  {/* Subject Grades Table */}
                  <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 font-bold text-gray-600 w-12 text-center">STT</th>
                          <th className="px-4 py-3 font-bold text-gray-600">Môn học</th>
                          <th className="px-4 py-3 font-bold text-gray-600 text-center w-36">
                            Điểm số (Tháng {academicMonth.split('-')[1]}/{academicMonth.split('-')[0]})
                          </th>
                          <th className="px-4 py-3 font-bold text-gray-600 text-center w-44">
                            Loại đánh giá
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {state.config.subjects.map((sub, idx) => {
                          const isEval = (state.config.evaluationSubjects || []).includes(sub);
                          const val = tempGrades[sub];
                          return (
                            <tr key={sub} className="hover:bg-gray-50/70 transition-colors">
                              <td className="px-4 py-3 text-center text-gray-400 font-bold text-xs">
                                {idx + 1}
                              </td>
                              <td className="px-4 py-3 font-bold text-gray-800">
                                {sub}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {isTeacher ? (
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={val !== undefined ? String(val) : ''}
                                    onChange={(e) => {
                                      const text = e.target.value;
                                      const parsed = parseGradeValue(text);
                                      setTempGrades((prev) => {
                                        const next = { ...prev };
                                        if (parsed.isValid && parsed.score !== undefined) {
                                          next[sub] = parsed.score;
                                        } else if (text.trim() === '') {
                                          delete next[sub];
                                        }
                                        return next;
                                      });
                                    }}
                                    className="w-24 px-2 py-1.5 border border-gray-300 focus:border-blue-500 rounded-lg text-center font-black text-blue-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-xs sm:text-sm"
                                    placeholder="-"
                                  />
                                ) : (
                                  <span className="font-black text-blue-700 text-sm">
                                    {val !== undefined ? val : '-'}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {isEval ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    Nhận xét (không tính ĐTB)
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    Tính điểm (0 - 10)
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* LỊCH SỬ ĐIỂM CÁC THÁNG & BIỂU ĐỒ THEO DÕI TIẾN ĐỘ */}
                  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs sm:text-sm font-bold text-gray-900 uppercase tracking-wide">
                          Lịch Sử &amp; Biểu Đồ Điểm Trung Bình Các Tháng
                        </h4>
                      </div>
                      <span className="text-[11px] text-gray-400">
                        {studentAcademicHistory.filter((h) => h.rawAverage !== null).length} tháng có dữ liệu
                      </span>
                    </div>

                    {/* Biểu đồ tiến độ ĐTB */}
                    <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100">
                      <div className="text-[11px] font-bold text-gray-500 mb-3 flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Biểu đồ so sánh điểm trung bình cộng (Thang điểm 0 - 10):</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {studentAcademicHistory.map((hist) => {
                          const hasScore = hist.rawAverage !== null;
                          const pct = hasScore ? Math.min(100, Math.max(0, (hist.rawAverage! / 10) * 100)) : 0;
                          const isSelected = hist.month === academicMonth;

                          return (
                            <div
                              key={hist.month}
                              onClick={() => setAcademicMonth(hist.month)}
                              className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-blue-50 border-blue-500 shadow-xs ring-2 ring-blue-400/20'
                                  : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
                              }`}
                            >
                              <div className="text-[11px] font-extrabold text-gray-700">
                                {hist.monthDisplay}
                              </div>

                              {/* Bar indicator */}
                              <div className="my-2.5 h-16 flex items-end justify-center bg-gray-100 rounded-lg p-1 overflow-hidden">
                                {hasScore ? (
                                  <div
                                    style={{ height: `${pct}%` }}
                                    className={`w-full rounded-md transition-all ${
                                      hist.rawAverage! >= 8.0
                                        ? 'bg-emerald-500'
                                        : hist.rawAverage! >= 6.5
                                        ? 'bg-blue-500'
                                        : hist.rawAverage! >= 5.0
                                        ? 'bg-amber-500'
                                        : 'bg-red-500'
                                    }`}
                                    title={`ĐTB: ${hist.formattedAverage}`}
                                  />
                                ) : (
                                  <span className="text-[9px] text-gray-400 italic">Trống</span>
                                )}
                              </div>

                              <div>
                                <div className={`text-xs font-black ${hasScore ? 'text-blue-700' : 'text-gray-400'}`}>
                                  {hasScore ? `ĐTB: ${hist.formattedAverage}` : 'Chưa có'}
                                </div>
                                <div className="text-[10px] text-gray-400 mt-0.5">
                                  {hist.validCount} môn
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: THI ĐUA & KỶ LUẬT (2 CỘT) */}
              {activeTab === 'discipline' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  {/* Left Column: Direct Logging / Editing Form (Teacher only) */}
                  {isTeacher && (
                    <div className="lg:col-span-1 bg-[#FFF8F4]/70 p-5 rounded-2xl border border-[#E8DEDA] shadow-xs space-y-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-[#233146] flex items-center gap-2">
                          {editingDisciplineId ? (
                            <Edit2 className="w-4 h-4 text-[#922235]" />
                          ) : (
                            <Plus className="w-4 h-4 text-[#922235]" />
                          )}
                          <span>
                            {editingDisciplineId ? 'Chỉnh sửa sự việc' : 'Ghi nhận sự việc'}
                          </span>
                        </h4>
                        <div className="flex items-center gap-1.5">
                          {editingDisciplineId ? (
                            <button
                              type="button"
                              onClick={handleCancelEditDiscipline}
                              className="text-[11px] font-bold text-[#697589] hover:text-[#922235] flex items-center gap-1 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Hủy sửa</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setIsBatchViolationOpen(true)}
                              className="px-2.5 py-1.5 bg-white hover:bg-[#F5EDEB] text-[#922235] font-bold rounded-xl text-[11px] border border-[#922235]/35 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                              title="Ghi nhận cùng một lỗi vi phạm cho nhiều học sinh cùng ngày"
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span>+ Ghi nhận hàng loạt</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <form onSubmit={handleSubmitDiscipline} className="space-y-3.5">
                        <div>
                          <label className="block text-xs font-bold text-[#233146] mb-1">
                            Ngày xảy ra <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            required
                            value={disDate}
                            onChange={(e) => setDisDate(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-[#E8DEDA] rounded-xl text-xs font-semibold text-[#233146] focus:ring-2 focus:ring-[#922235] outline-none"
                          />
                          <div className="mt-1.5 flex items-center justify-between text-[11px]">
                            <span className="text-[#697589]">Tự động xếp kỳ:</span>
                            <span className="font-bold text-[#922235] bg-[#F5EDEB] px-2 py-0.5 rounded-md border border-[#E8DEDA]">
                              {disDateResolution.semester === 'HK1' ? 'Học kỳ I' : 'Học kỳ II'} •{' '}
                              {disDateResolution.schoolYear}
                            </span>
                          </div>
                          {!disDateResolution.isWithinConfiguredRange &&
                            disDateResolution.warningMessage && (
                              <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span>{disDateResolution.warningMessage}</span>
                              </div>
                            )}
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-[#233146] mb-1">
                            Quy tắc thi đua <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={disRuleId || state.config.rules[0]?.id || ''}
                            onChange={(e) => setDisRuleId(e.target.value)}
                            className="w-full px-3 py-2 border border-[#E8DEDA] rounded-xl text-xs font-semibold text-[#233146] focus:ring-2 focus:ring-[#922235] outline-none bg-white cursor-pointer"
                          >
                            {state.config.rules.length === 0 ? (
                              <option value="">Chưa có quy tắc thi đua nào (vào Cài đặt để thêm)</option>
                            ) : (
                              state.config.rules.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name} ({r.type === 'plus' ? `+${r.points}` : `-${r.points}`}đ)
                                </option>
                              ))
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-[#233146] mb-1">
                            Chi tiết sự việc (Tùy chọn)
                          </label>
                          <textarea
                            rows={3}
                            value={disNote}
                            onChange={(e) => setDisNote(e.target.value)}
                            placeholder="Ghi chú thêm hoàn cảnh, tiết học..."
                            className="w-full px-3 py-2 bg-white border border-[#E8DEDA] rounded-xl text-xs focus:ring-2 focus:ring-[#922235] outline-none"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-[#922235] hover:bg-[#781C2B] text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
                        >
                          {editingDisciplineId
                            ? 'Cập nhật sự việc & Tính lại điểm học kỳ'
                            : 'Lưu ghi nhận sự việc'}
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Right Column: School Year / Semester Filters, Independent Scores & History */}
                  <div
                    className={`${
                      isTeacher ? 'lg:col-span-2' : 'lg:col-span-3'
                    } space-y-4`}
                  >
                    {/* Filter Bar: School Year + Semester + Month + Export */}
                    <div className="bg-[#FFF8F4]/70 p-4 rounded-2xl border border-[#E8DEDA] space-y-3">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div className="flex flex-wrap items-end gap-2.5">
                          {/* School Year Filter */}
                          <div>
                            <label className="text-[10px] font-bold text-[#697589] uppercase block mb-1">
                              Năm học
                            </label>
                            <select
                              value={selectedDisciplineYear}
                              onChange={(e) => {
                                setSelectedDisciplineYear(e.target.value);
                                setSelectedDisciplineMonth('all');
                              }}
                              className="border border-[#E8DEDA] rounded-xl px-3 py-1.5 text-xs font-bold text-[#233146] bg-white outline-none cursor-pointer focus:ring-2 focus:ring-[#922235]"
                            >
                              {availableDisciplineYears.map((yr) => (
                                <option key={yr} value={yr}>
                                  {yr}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Semester Filter */}
                          <div>
                            <label className="text-[10px] font-bold text-[#697589] uppercase block mb-1">
                              Học kỳ
                            </label>
                            <div className="inline-flex bg-white p-0.5 rounded-xl border border-[#E8DEDA]">
                              {(
                                [
                                  { id: 'HK1', label: 'Học kỳ I' },
                                  { id: 'HK2', label: 'Học kỳ II' },
                                  { id: 'ALL', label: 'Cả năm' },
                                ] as { id: SemesterFilter; label: string }[]
                              ).map((semOpt) => {
                                const isActive = selectedDisciplineSemester === semOpt.id;
                                return (
                                  <button
                                    key={semOpt.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedDisciplineSemester(semOpt.id);
                                      setSelectedDisciplineMonth('all');
                                    }}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                      isActive
                                        ? 'bg-[#922235] text-white shadow-2xs'
                                        : 'text-[#697589] hover:text-[#233146] hover:bg-[#F5EDEB]/60'
                                    }`}
                                  >
                                    {semOpt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Optional Month Filter */}
                          {disciplineMonths.length > 0 && (
                            <div>
                              <label className="text-[10px] font-bold text-[#697589] uppercase block mb-1">
                                Tháng (tùy chọn)
                              </label>
                              <select
                                value={selectedDisciplineMonth}
                                onChange={(e) => setSelectedDisciplineMonth(e.target.value)}
                                className="border border-[#E8DEDA] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#233146] bg-white outline-none cursor-pointer focus:ring-2 focus:ring-[#922235]"
                              >
                                <option value="all">Toàn bộ {formatSemesterLabel(selectedDisciplineSemester)}</option>
                                {disciplineMonths.map((m) => {
                                  const [y, mo] = m.split('-');
                                  return (
                                    <option key={m} value={m}>
                                      Tháng {mo}/{y}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          )}
                        </div>

                        {/* Export Student Violations Excel */}
                        {isTeacher && (
                          <button
                            type="button"
                            onClick={handleExportViolationsExcel}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 font-bold rounded-xl text-xs border border-emerald-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                            title={`Xuất báo cáo Excel vi phạm (${formatSemesterLabel(selectedDisciplineSemester)} - ${selectedDisciplineYear})`}
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Xuất Excel vi phạm</span>
                          </button>
                        )}
                      </div>

                      {/* Independent Semester Score Display */}
                      {selectedDisciplineSemester === 'ALL' ? (
                        <div className="pt-2 border-t border-[#E8DEDA] space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* HK I Card */}
                            <div className="bg-white rounded-xl p-3.5 border border-[#E8DEDA] flex items-center justify-between shadow-2xs">
                              <div>
                                <span className="text-[10px] font-black uppercase text-[#922235] block">
                                  Học kỳ I ({selectedDisciplineYear})
                                </span>
                                <div className="flex items-baseline gap-1 mt-0.5">
                                  <span className={`text-xl font-black ${fullYearSummary.hk1.conduct.color}`}>
                                    {fullYearSummary.hk1.remainingPoints}
                                  </span>
                                  <span className="text-xs font-bold text-[#697589]">
                                    / {fullYearSummary.hk1.basePoints}đ
                                  </span>
                                </div>
                                <div className="text-[10px] text-[#697589] mt-0.5 font-medium">
                                  Thưởng: <strong className="text-emerald-600">+{fullYearSummary.hk1.totalPlus}đ</strong> • Trừ:{' '}
                                  <strong className="text-rose-600">-{fullYearSummary.hk1.totalMinus}đ</strong>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] font-bold text-[#697589] uppercase block">
                                  Hạnh kiểm HK I
                                </span>
                                <span className={`text-sm font-black ${fullYearSummary.hk1.conduct.color}`}>
                                  {fullYearSummary.hk1.conduct.text}
                                </span>
                              </div>
                            </div>

                            {/* HK II Card */}
                            <div className="bg-white rounded-xl p-3.5 border border-[#E8DEDA] flex items-center justify-between shadow-2xs">
                              <div>
                                <span className="text-[10px] font-black uppercase text-[#233146] block">
                                  Học kỳ II ({selectedDisciplineYear})
                                </span>
                                <div className="flex items-baseline gap-1 mt-0.5">
                                  <span className={`text-xl font-black ${fullYearSummary.hk2.conduct.color}`}>
                                    {fullYearSummary.hk2.remainingPoints}
                                  </span>
                                  <span className="text-xs font-bold text-[#697589]">
                                    / {fullYearSummary.hk2.basePoints}đ
                                  </span>
                                </div>
                                <div className="text-[10px] text-[#697589] mt-0.5 font-medium">
                                  Thưởng: <strong className="text-emerald-600">+{fullYearSummary.hk2.totalPlus}đ</strong> • Trừ:{' '}
                                  <strong className="text-rose-600">-{fullYearSummary.hk2.totalMinus}đ</strong>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] font-bold text-[#697589] uppercase block">
                                  Hạnh kiểm HK II
                                </span>
                                <span className={`text-sm font-black ${fullYearSummary.hk2.conduct.color}`}>
                                  {fullYearSummary.hk2.conduct.text}
                                </span>
                              </div>
                            </div>
                          </div>
                          <p className="text-[10px] text-[#697589] italic">
                            * Điểm thi đua được tính độc lập cho từng học kỳ (200đ/học kỳ), không cộng dồn sang 400đ.
                          </p>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-[#E8DEDA] flex flex-wrap items-center justify-between gap-4">
                          <div className="text-xs text-[#697589] space-y-0.5">
                            <p className="font-bold text-[#233146]">
                              Kết quả {formatSemesterLabel(selectedDisciplineSemester)} • Năm học {selectedDisciplineYear}
                            </p>
                            <p className="text-[11px]">
                              Điểm gốc: <strong>{activeSingleSemesterSummary.basePoints}đ</strong> + Thưởng{' '}
                              <strong className="text-emerald-600">+{activeSingleSemesterSummary.totalPlus}đ</strong> - Trừ{' '}
                              <strong className="text-rose-600">-{activeSingleSemesterSummary.totalMinus}đ</strong>
                            </p>
                            {monthScopedPointsSummary && (
                              <p className="text-[10px] text-[#922235] font-semibold">
                                Riêng tháng đang lọc: +{monthScopedPointsSummary.totalPlus}đ / -{monthScopedPointsSummary.totalMinus}đ
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-5">
                            <div className="text-right">
                              <span className="text-[10px] font-bold text-[#697589] uppercase block">
                                Điểm thi đua {selectedDisciplineSemester === 'HK1' ? 'HK I' : 'HK II'}
                              </span>
                              <div className="flex items-baseline justify-end gap-1">
                                <span className={`text-2xl font-black ${activeSingleSemesterSummary.conduct.color}`}>
                                  {activeSingleSemesterSummary.remainingPoints}
                                </span>
                                <span className="text-xs font-bold text-[#697589]">
                                  / {activeSingleSemesterSummary.basePoints}đ
                                </span>
                              </div>
                            </div>
                            <div className="text-right border-l pl-4 border-[#E8DEDA]">
                              <span className="text-[10px] font-bold text-[#697589] uppercase block">
                                Hạnh kiểm
                              </span>
                              <span className={`text-base font-black ${activeSingleSemesterSummary.conduct.color}`}>
                                {activeSingleSemesterSummary.conduct.text}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* History table */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-bold text-[#233146] flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5 text-[#922235]" />
                          Lịch sử sự việc thi đua &amp; kỷ luật ({filteredDiscipline.length})
                        </span>
                        {filteredDiscipline.length > 4 && (
                          <span className="text-[11px] text-[#697589] font-medium">
                            Cuộn xuống để xem thêm
                          </span>
                        )}
                      </div>

                      <div className="border border-[#E8DEDA] rounded-2xl overflow-hidden max-h-[420px] overflow-y-auto custom-scrollbar scroll-smooth overscroll-contain shadow-2xs">
                        <table className="w-full text-left text-xs sm:text-sm">
                          <thead className="bg-[#F5EDEB]/70 border-b border-[#E8DEDA] sticky top-0">
                            <tr>
                              <th className="px-3.5 py-3 font-bold text-[#233146] w-24">Ngày</th>
                              <th className="px-2.5 py-3 font-bold text-[#233146] text-center w-20">Học kỳ</th>
                              <th className="px-3.5 py-3 font-bold text-[#233146]">Sự việc</th>
                              <th className="px-3 py-3 font-bold text-[#233146] text-center w-16">
                                Điểm
                              </th>
                              {isTeacher && (
                                <th className="px-3 py-3 font-bold text-[#233146] text-center w-20">
                                  Thao tác
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E8DEDA]/70 bg-white">
                            {filteredDiscipline.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={isTeacher ? 5 : 4}
                                  className="px-4 py-8 text-center text-[#697589]"
                                >
                                  Không có ghi nhận nào trong kỳ đã chọn. Điểm thi đua giữ nguyên {semesterBasePoints}/{semesterBasePoints}đ.
                                </td>
                              </tr>
                            ) : (
                              filteredDiscipline.map((d) => {
                                const recPeriod = getRecordPeriod(d, state.config);
                                const isEditingThis = editingDisciplineId === d.id;
                                return (
                                  <tr
                                    key={d.id}
                                    className={`transition-colors ${
                                      isEditingThis ? 'bg-[#F5EDEB]/60' : 'hover:bg-[#FFF8F4]/70'
                                    }`}
                                  >
                                    <td className="px-3.5 py-3 text-[#697589] font-medium whitespace-nowrap">
                                      {formatDisplayDate(d.date)}
                                    </td>
                                    <td className="px-2.5 py-3 text-center whitespace-nowrap">
                                      <span
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                                          recPeriod.semester === 'HK1'
                                            ? 'bg-[#F5EDEB] text-[#922235] border-[#E8DEDA]'
                                            : 'bg-slate-100 text-[#233146] border-slate-200'
                                        }`}
                                      >
                                        {recPeriod.semester === 'HK1' ? 'HK I' : 'HK II'}
                                      </span>
                                    </td>
                                    <td className="px-3.5 py-3">
                                      <p className="font-bold text-[#233146]">{d.ruleName}</p>
                                      {d.note && (
                                        <p className="text-[11px] text-[#697589] mt-0.5 whitespace-pre-wrap">
                                          {d.note}
                                        </p>
                                      )}
                                    </td>
                                    <td className="px-3 py-3 text-center">
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-xs font-black ${
                                          d.type === 'plus'
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'bg-rose-50 text-rose-700'
                                        }`}
                                      >
                                        {d.type === 'plus' ? `+${d.points}` : `-${d.points}`}
                                      </span>
                                    </td>
                                    {isTeacher && (
                                      <td className="px-3 py-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                          {onUpdateDiscipline && (
                                            <button
                                              type="button"
                                              onClick={() => handleStartEditDiscipline(d)}
                                              className="p-1.5 rounded-lg text-gray-400 hover:text-[#922235] hover:bg-[#F5EDEB] transition-colors cursor-pointer"
                                              title="Chỉnh sửa sự việc"
                                            >
                                              <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => setConfirmDeleteDisciplineId(d.id)}
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                            title="Xóa sự việc"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: SỔ TAY & LIÊN HỆ */}
              {activeTab === 'notes' && isTeacher && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-bold text-gray-800">
                      Sổ tay nhật ký &amp; Liên lạc phụ huynh
                    </h3>
                    <button
                      onClick={() => setIsAddNoteModalOpen(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Thêm ghi chú</span>
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[450px] overflow-y-auto custom-scrollbar scroll-smooth">
                    {state.notes.filter(
                      (n) => n.studentId === student.id && !locallyDeletedNoteIds.includes(n.id)
                    ).length === 0 ? (
                      <div className="p-8 text-center text-gray-400 text-sm">
                        Chưa có nhật ký trao đổi hay liên hệ phụ huynh nào.
                      </div>
                    ) : (
                      state.notes
                        .filter(
                          (n) =>
                            n.studentId === student.id && !locallyDeletedNoteIds.includes(n.id)
                        )
                        .sort(
                          (a, b) =>
                            new Date(b.date).getTime() - new Date(a.date).getTime()
                        )
                        .map((note) => (
                          <div
                            key={note.id}
                            className="bg-gray-50/80 border border-gray-200 rounded-2xl p-4 relative group"
                          >
                            <button
                              onClick={() => setConfirmDeleteNoteId(note.id)}
                              className="absolute top-3 right-3 p-1 rounded-lg text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="font-bold text-xs text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                                {note.type}
                              </span>
                              <span className="text-[11px] text-gray-400">
                                {formatDisplayDate(note.date)}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                              {note.content}
                            </p>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sub Modals */}
      <PrintReportModal
        isOpen={isPrintModalOpen}
        student={student}
        state={state}
        onClose={() => setIsPrintModalOpen(false)}
      />

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onSave={(newPass) => {
          onChangePassword(student.id, newPass);
          onShowToast('Đổi mật khẩu thành công');
        }}
        onClose={() => setIsPasswordModalOpen(false)}
      />

      {/* Add Note Modal */}
      {isAddNoteModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 bg-gray-50/70 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 text-sm">
                Thêm Ghi chú / Liên hệ phụ huynh
              </h3>
              <button
                onClick={() => setIsAddNoteModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 text-gray-400 flex items-center justify-center cursor-pointer"
              >
                <Trash2 className="w-4 h-4 hidden" />
                <span>✕</span>
              </button>
            </div>
            <form onSubmit={handleCreateNote} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Ngày ghi nhận
                </label>
                <input
                  type="date"
                  required
                  value={noteDate}
                  onChange={(e) => setNoteDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Phân loại
                </label>
                <select
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none bg-white cursor-pointer"
                >
                  <option value="Liên hệ PH">Liên hệ Phụ huynh</option>
                  <option value="Học tập">Học tập</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nội dung ghi nhận
                </label>
                <textarea
                  rows={4}
                  required
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Ghi chú chi tiết nội dung cuộc gọi hoặc sự việc..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddNoteModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer"
                >
                  Lưu ghi chú
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Discipline Confirm */}
      <ConfirmModal
        isOpen={!!confirmDeleteDisciplineId}
        title="Xóa ghi nhận sự việc"
        message="Bạn có chắc chắn muốn xóa ghi nhận thi đua này?"
        confirmText="Xóa sự việc"
        onConfirm={() => {
          if (confirmDeleteDisciplineId) {
            const idToDelete = confirmDeleteDisciplineId;
            setLocallyDeletedDisciplineIds((prev) => [...prev, idToDelete]);
            onDeleteDiscipline(idToDelete);
            setConfirmDeleteDisciplineId(null);
          }
        }}
        onCancel={() => setConfirmDeleteDisciplineId(null)}
      />

      {/* Delete Note Confirm */}
      <ConfirmModal
        isOpen={!!confirmDeleteNoteId}
        title="Xóa ghi chú"
        message="Bạn có chắc chắn muốn xóa ghi chú này?"
        confirmText="Xóa ghi chú"
        onConfirm={() => {
          if (confirmDeleteNoteId) {
            const idToDelete = confirmDeleteNoteId;
            setLocallyDeletedNoteIds((prev) => [...prev, idToDelete]);
            onDeleteNote(idToDelete);
            setConfirmDeleteNoteId(null);
          }
        }}
        onCancel={() => setConfirmDeleteNoteId(null)}
      />

      {/* Delete Attendance Confirm */}
      <ConfirmModal
        isOpen={!!confirmDeleteAttendanceId}
        title="Xóa bản ghi điểm danh"
        message="Bạn có chắc chắn muốn xóa bản ghi điểm danh ngày này? Sau khi xóa, ngày này sẽ được chuyển về trạng thái Chưa điểm danh."
        confirmText="Xóa bản ghi"
        isDanger={true}
        onConfirm={() => {
          if (confirmDeleteAttendanceId) {
            const idToDelete = confirmDeleteAttendanceId;
            onDeleteAttendance?.(idToDelete);
            setConfirmDeleteAttendanceId(null);
          }
        }}
        onCancel={() => setConfirmDeleteAttendanceId(null)}
      />

      {/* Batch Violation Modal (Official Live Supabase Persistence) */}
      {isTeacher && (
        <BatchViolationModal
          isOpen={isBatchViolationOpen}
          state={state}
          onClose={() => setIsBatchViolationOpen(false)}
          onShowToast={onShowToast}
          isPersistenceEnabled={true}
          onConfirmBatchSave={onAddBatchDiscipline}
          highlightStudentId={student.id}
        />
      )}
    </div>
  );
};
