import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Lock,
  Calendar,
  Sparkles,
  User,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Student } from '../types';
import { matchesStudentDob, getStudentDobDisplay } from '../utils/helpers';

interface LoginModalProps {
  appName?: string;
  teacherPassword: string;
  students: Student[];
  className?: string;
  schoolYear?: string;
  onLoginTeacher: () => void;
  onLoginStudent: (studentId: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  appName = 'TRỢ LÝ CHỦ NHIỆM',
  teacherPassword,
  students,
  className,
  schoolYear,
  onLoginTeacher,
  onLoginStudent,
}) => {
  // Requirement 3: Default tab is 'teacher', with Teacher on the LEFT and Student on the RIGHT
  const [activeTab, setActiveTab] = useState<'teacher' | 'student'>('teacher');
  const [teacherPassInput, setTeacherPassInput] = useState('');
  const [showTeacherPass, setShowTeacherPass] = useState(false);
  const [studentPasswordInput, setStudentPasswordInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [matchedStudents, setMatchedStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Prevent browser autofilling teacher credentials into student fields
  useEffect(() => {
    if (activeTab === 'student') {
      if (
        studentPasswordInput &&
        teacherPassword &&
        (studentPasswordInput === teacherPassword ||
          studentPasswordInput.includes(teacherPassword))
      ) {
        setStudentPasswordInput('');
      }
    }
  }, [activeTab, teacherPassword, studentPasswordInput]);

  const handleTeacherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    setTimeout(() => {
      if (teacherPassInput === teacherPassword) {
        onLoginTeacher();
      } else {
        setErrorMessage('Mật khẩu quản lý giáo viên chưa chính xác. Vui lòng kiểm tra lại!');
        setIsSubmitting(false);
      }
    }, 200);
  };

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    setTimeout(() => {
      // If student already selected from multi-match list
      if (selectedStudent) {
        onLoginStudent(selectedStudent.id);
        return;
      }

      const cleanInput = studentPasswordInput.trim();
      if (!cleanInput) {
        setErrorMessage('Vui lòng nhập ngày sinh dạng ddmmyyyy (ví dụ: 05082012)!');
        setIsSubmitting(false);
        return;
      }

      if (cleanInput === teacherPassword) {
        setErrorMessage(
          'Đây là mật khẩu của giáo viên. Học sinh vui lòng nhập ngày tháng năm sinh (ví dụ: 05082012).'
        );
        setStudentPasswordInput('');
        setIsSubmitting(false);
        return;
      }

      // Match student by DOB (ddmmyyyy, preserving leading 0s), password, ID or Name
      const found = students.filter(
        (s) =>
          matchesStudentDob(s, cleanInput) ||
          (s.password && s.password.toLowerCase() === cleanInput.toLowerCase()) ||
          s.id === cleanInput ||
          s.name.toLowerCase().trim() === cleanInput.toLowerCase()
      );

      if (found.length === 0) {
        setErrorMessage(
          `Không tìm thấy học sinh với mật khẩu "${cleanInput}". Vui lòng kiểm tra lại ngày sinh theo định dạng ddmmyyyy (ví dụ: 05082012)!`
        );
        setMatchedStudents([]);
        setIsSubmitting(false);
        return;
      }

      if (found.length === 1) {
        onLoginStudent(found[0].id);
      } else {
        // Multiple students share same DOB
        setMatchedStudents(found);
        setErrorMessage('');
        setIsSubmitting(false);
      }
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-gradient-to-br from-[#ebf8ff] via-[#f0f9ff] to-[#e0f2fe] select-none">
      {/* Decorative School Doodles along the edges (subtle, non-intrusive) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Top-Right: Paper Plane & Dotted Flight Trail */}
        <svg
          className="absolute -top-4 -right-4 w-56 h-56 text-[#0284c7]/20"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M20 180 C 80 160, 120 100, 160 30"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="4 6"
          />
          <path
            d="M175 20 L130 50 L145 65 L175 20 Z"
            fill="currentColor"
            opacity="0.6"
          />
          <path
            d="M175 20 L155 80 L145 65 L175 20 Z"
            fill="currentColor"
            opacity="0.8"
          />
        </svg>

        {/* Top-Right: Lightbulb idea */}
        <svg
          className="absolute top-10 right-16 w-14 h-14 text-[#0ea5e9]/25 hidden sm:block"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <line x1="12" y1="2" x2="12" y2="4" />
          <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
          <line x1="19.07" y1="4.93" x2="17.66" y2="6.34" />
        </svg>

        {/* Top-Left: Open Notebook */}
        <svg
          className="absolute top-8 left-8 w-16 h-16 text-[#0284c7]/20 hidden sm:block"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          <line x1="6" y1="7" x2="8" y2="7" />
          <line x1="6" y1="11" x2="9" y2="11" />
        </svg>

        {/* Bottom-Left: Stack of Books */}
        <svg
          className="absolute bottom-6 left-6 w-24 h-24 text-[#0369a1]/25"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
          <path d="M6 6h10" />
          <path d="M6 10h10" />
          <path d="M2 17h18" />
        </svg>

        {/* Bottom-Right: School Backpack */}
        <svg
          className="absolute bottom-6 right-6 w-20 h-20 text-[#0ea5e9]/25 hidden sm:block"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-9Z" />
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
          <path d="M8 14h8" />
          <path d="M9 18h6" />
        </svg>

        {/* Subtle Decorative Flowing Waves */}
        <svg
          className="absolute -bottom-10 left-0 right-0 w-full text-[#38bdf8]/15"
          viewBox="0 0 1440 320"
          fill="currentColor"
        >
          <path d="M0,192L48,197.3C96,203,192,213,288,192C384,171,480,117,576,122.7C672,128,768,192,864,208C960,224,1056,192,1152,165.3C1248,139,1344,117,1392,106.7L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
        </svg>
      </div>

      {/* Main Login Card (460-480px, white, high-contrast, rounded 26px) */}
      <div className="relative w-full max-w-[470px] bg-white rounded-[26px] p-6 sm:p-8 shadow-[0_20px_60px_-15px_rgba(2,132,199,0.18)] border border-sky-100/90 animate-fadeIn z-10">
        {/* BRAND IDENTITY */}
        <div className="text-center mb-6">
          {/* Graduation Cap Badge in Blue-Teal Gradient */}
          <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-[22px] bg-gradient-to-br from-[#0284c7] via-[#0ea5e9] to-[#06b6d4] text-white flex items-center justify-center mx-auto mb-3.5 shadow-lg shadow-sky-500/25">
            <GraduationCap className="w-10 h-10 sm:w-11 sm:h-11" strokeWidth={2.2} />
          </div>

          {/* Title in Deep Navy */}
          <h1 className="text-2xl sm:text-[25px] font-black text-[#0f2942] tracking-tight uppercase leading-tight">
            {appName}
          </h1>

          {/* Subtitle */}
          <p className="text-xs sm:text-[13px] font-semibold text-[#0c4a6e]/75 mt-1">
            Đồng hành cùng giáo viên – Kết nối lớp học
          </p>

          {/* Class metadata badge if available */}
          {(className || schoolYear) && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2.5 rounded-full bg-sky-50 text-[#0c4a6e] border border-sky-200/80 text-[11px] font-bold">
              <Sparkles className="w-3.5 h-3.5 text-[#0284c7]" />
              {className && <span>Lớp {className}</span>}
              {className && schoolYear && <span>•</span>}
              {schoolYear && <span>Năm học {schoolYear}</span>}
            </div>
          )}
        </div>

        {/* TWO TABS: 'Giáo viên' ON THE LEFT, 'Học sinh' ON THE RIGHT */}
        <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-slate-100/90 border border-slate-200/80 mb-5">
          {/* Tab 1: Giáo viên (Left) */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('teacher');
              setTeacherPassInput('');
              setErrorMessage('');
              setMatchedStudents([]);
              setSelectedStudent(null);
            }}
            className={`py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'teacher'
                ? 'bg-[#0c4a6e] text-white shadow-sm font-black'
                : 'text-[#0f2942] hover:bg-white/60 font-bold'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Giáo viên</span>
          </button>

          {/* Tab 2: Học sinh (Right) */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('student');
              setStudentPasswordInput('');
              setErrorMessage('');
              setMatchedStudents([]);
              setSelectedStudent(null);
            }}
            className={`py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'student'
                ? 'bg-[#0c4a6e] text-white shadow-sm font-black'
                : 'text-[#0f2942] hover:bg-white/60 font-bold'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Học sinh</span>
          </button>
        </div>

        {/* Tab Greeting Heading */}
        <div className="text-center mb-5">
          <h2 className="text-lg sm:text-xl font-black text-[#0f2942]">
            {activeTab === 'teacher'
              ? 'Chào mừng thầy cô trở lại!'
              : 'Chào mừng các em học sinh!'}
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {activeTab === 'teacher'
              ? 'Đăng nhập để quản lý lớp học'
              : 'Nhập ngày sinh dạng ddmmyyyy để vào lớp'}
          </p>
        </div>

        {/* Error Alert Box */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-start gap-2 leading-relaxed animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* TAB 1 CONTENT: GIÁO VIÊN */}
        {activeTab === 'teacher' ? (
          <form
            key="form-teacher-login"
            onSubmit={handleTeacherSubmit}
            autoComplete="off"
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="teacher_password_input"
                className="block text-xs font-bold text-[#0f2942] mb-1.5"
              >
                Mật khẩu giáo viên
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0284c7]" />
                <input
                  type={showTeacherPass ? 'text' : 'password'}
                  id="teacher_password_input"
                  name="teacher_pass_input"
                  autoComplete="current-password"
                  value={teacherPassInput}
                  onChange={(e) => setTeacherPassInput(e.target.value)}
                  className="w-full h-[52px] pl-10 pr-11 bg-slate-50/80 focus:bg-white border border-slate-300 rounded-xl focus:ring-4 focus:ring-sky-100 focus:border-[#0284c7] outline-none text-sm font-bold text-[#0f2942] transition-all"
                  placeholder="Nhập mật khẩu giáo viên..."
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowTeacherPass(!showTeacherPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-1 transition-colors"
                  title={showTeacherPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showTeacherPass ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Gradient Login Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-[52px] bg-gradient-to-r from-[#0284c7] via-[#0ea5e9] to-[#06b6d4] hover:from-[#0369a1] hover:to-[#0284c7] text-white font-black text-sm sm:text-base rounded-2xl shadow-lg shadow-sky-400/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang đăng nhập...</span>
                </>
              ) : (
                <>
                  <span>Đăng nhập Giáo viên</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* TAB 2 CONTENT: HỌC SINH */
          <form
            key="form-student-login"
            onSubmit={handleStudentSubmit}
            autoComplete="off"
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="txt_student_code_ddmmyyyy"
                className="block text-xs font-bold text-[#0f2942] mb-1.5"
              >
                Mật khẩu học sinh (Ngày tháng năm sinh)
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#0284c7]" />
                <input
                  type="text"
                  inputMode="numeric"
                  id="txt_student_code_ddmmyyyy"
                  name="txt_student_code_ddmmyyyy"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  value={studentPasswordInput}
                  onChange={(e) => {
                    // Preserve leading 0s as pure text
                    const val = e.target.value;
                    if (val === teacherPassword) {
                      setStudentPasswordInput('');
                      return;
                    }
                    setStudentPasswordInput(val);
                    setMatchedStudents([]);
                    setSelectedStudent(null);
                  }}
                  className="w-full h-[52px] pl-10 pr-4 bg-slate-50/80 focus:bg-white border border-slate-300 rounded-xl focus:ring-4 focus:ring-sky-100 focus:border-[#0284c7] outline-none text-sm font-mono font-bold text-[#0f2942] transition-all"
                  placeholder="Ví dụ: 05082012 hoặc 15052012"
                  required
                />
              </div>

              {/* Requirement 4: Compact, clean instruction card (no redundant ddmmyyyy badges) */}
              <div className="mt-2.5 p-3 rounded-xl bg-sky-50/90 border border-sky-200/90 text-xs text-[#0c4a6e] flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-[#0284c7] shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-[11px] leading-relaxed">
                  <span className="font-bold text-[#0f2942] block">
                    Cách nhập mật khẩu học sinh:
                  </span>
                  <span>
                    Nhập 8 chữ số ngày tháng năm sinh dạng <strong>ddmmyyyy</strong>.
                    Ví dụ sinh ngày <strong>05/08/2012</strong> thì nhập{' '}
                    <code className="font-mono font-black text-[#0c4a6e] bg-white px-1 py-0.5 rounded border border-sky-200">
                      05082012
                    </code>{' '}
                    (giữ nguyên số 0 ở đầu).
                  </span>
                </div>
              </div>
            </div>

            {/* If multiple students have the same DOB, list names cleanly */}
            {matchedStudents.length > 1 && (
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-2xl space-y-2 animate-fadeIn">
                <p className="text-xs font-bold text-[#0f2942]">
                  Lớp có {matchedStudents.length} bạn có ngày sinh này. Vui lòng bấm chọn tên em:
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                  {matchedStudents.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelectedStudent(s);
                        onLoginStudent(s.id);
                      }}
                      className={`w-full p-2.5 rounded-xl text-left text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                        selectedStudent?.id === s.id
                          ? 'bg-[#0284c7] text-white shadow-xs'
                          : 'bg-white text-[#0f2942] hover:bg-sky-100/70 border border-sky-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-[#0284c7]" />
                        <span>
                          {s.name} ({s.gender})
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#0284c7]" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Gradient Login Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-[52px] bg-gradient-to-r from-[#0284c7] via-[#0ea5e9] to-[#06b6d4] hover:from-[#0369a1] hover:to-[#0284c7] text-white font-black text-sm sm:text-base rounded-2xl shadow-lg shadow-sky-400/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang đăng nhập...</span>
                </>
              ) : (
                <>
                  <span>Đăng nhập Học sinh</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* MOTTO DIVIDER */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          <span className="text-[11px] font-semibold text-[#0c4a6e]/70 whitespace-nowrap">
            Tận tâm đồng hành – Vững vàng chủ nhiệm
          </span>
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        </div>

        {/* DEMO / QUICK ACCESS TESTING (Compact & tidy at the bottom) */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-1.5 text-xs">
          <div className="flex items-center justify-between text-slate-500 px-0.5">
            <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
              <Sparkles className="w-3 h-3 text-amber-500" /> Thử nghiệm nhanh:
            </span>
            <button
              type="button"
              onClick={() => {
                setTeacherPassInput(teacherPassword || 'admin');
                onLoginTeacher();
              }}
              className="text-[#0284c7] hover:text-[#0369a1] font-bold cursor-pointer underline text-[11px]"
            >
              Vào quyền Giáo viên (admin)
            </button>
          </div>

          {students.length > 0 && (
            <div className="flex items-center justify-between bg-sky-50/60 px-2.5 py-1.5 rounded-lg text-[11px] text-[#0c4a6e] border border-sky-100">
              <span className="truncate">
                Học sinh mẫu: <strong>{students[0].name}</strong> ({getStudentDobDisplay(students[0].dob)})
              </span>
              <button
                type="button"
                onClick={() => {
                  const s = students[0];
                  const dobStr = getStudentDobDisplay(s.dob);
                  setStudentPasswordInput(dobStr);
                  onLoginStudent(s.id);
                }}
                className="text-[#0284c7] hover:text-[#0369a1] font-black underline cursor-pointer shrink-0 ml-2"
              >
                Vào thử
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
