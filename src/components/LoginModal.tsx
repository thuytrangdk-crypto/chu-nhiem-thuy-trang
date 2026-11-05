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
import {
  matchesStudentDob,
  getStudentDobDisplay,
  formatStudentCode,
  generate10DigitInitialPassword,
} from '../utils/helpers';

interface LoginModalProps {
  appName?: string;
  teacherPassword: string;
  students: Student[];
  className?: string;
  schoolYear?: string;
  onLoginTeacher: () => void;
  onLoginStudent: (studentId: string, isFirstTimeInitialPassword?: boolean) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  appName = 'TRỢ LÝ CHỦ NHIỆM',
  teacherPassword,
  students,
  className = '8A3',
  schoolYear,
  onLoginTeacher,
  onLoginStudent,
}) => {
  // Mặc định tab Giáo viên ở bên TRÁI, Học sinh ở bên PHẢI
  const [activeTab, setActiveTab] = useState<'teacher' | 'student'>('teacher');
  const [teacherPassInput, setTeacherPassInput] = useState('');
  const [showTeacherPass, setShowTeacherPass] = useState(false);
  const [studentPasswordInput, setStudentPasswordInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [matchedStudents, setMatchedStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Tránh tự động điền mật khẩu giáo viên vào ô học sinh
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
      if (selectedStudent) {
        // Kiểm tra xem học sinh có đang dùng mật khẩu khởi tạo không
        const isInitial = !selectedStudent.isPasswordChanged;
        onLoginStudent(selectedStudent.id, isInitial);
        return;
      }

      const cleanInput = studentPasswordInput.trim();
      if (!cleanInput) {
        setErrorMessage('Vui lòng nhập mật khẩu khởi tạo 10 số (Mã HS + Ngày sinh) hoặc mật khẩu cá nhân!');
        setIsSubmitting(false);
        return;
      }

      if (cleanInput === teacherPassword) {
        setErrorMessage(
          'Đây là mật khẩu của giáo viên. Học sinh vui lòng nhập mật khẩu khởi tạo 10 số (ví dụ: 0112092012) hoặc mật khẩu cá nhân đã đổi.'
        );
        setStudentPasswordInput('');
        setIsSubmitting(false);
        return;
      }

      // Khớp theo quy tắc 10 chữ số (Mã HS + DDMMYYYY), mật khẩu cá nhân, hoặc ngày sinh
      const found = students.filter((s, idx) => {
        // 1. Khớp chính xác với mật khẩu lưu trong s.password
        if (s.password && s.password.toLowerCase() === cleanInput.toLowerCase()) return true;

        // 2. Khớp với mật khẩu khởi tạo 10 chữ số (Mã 2 số + DDMMYYYY)
        const code = s.studentCode ? formatStudentCode(s.studentCode) : formatStudentCode(undefined, idx);
        const pass10 = generate10DigitInitialPassword(code, s.dob, idx);
        if (pass10 && pass10 === cleanInput) return true;

        // 3. Khớp qua helper matchesStudentDob (hỗ trợ ngày sinh hoặc ID)
        if (matchesStudentDob(s, cleanInput)) return true;

        // 4. Khớp tên đầy đủ
        if (s.name.toLowerCase().trim() === cleanInput.toLowerCase()) return true;

        return false;
      });

      if (found.length === 0) {
        setErrorMessage(
          `Không tìm thấy tài khoản với mật khẩu "${cleanInput}". Mật khẩu khởi tạo chuẩn gồm 10 chữ số: Mã HS (2 số) + Ngày sinh ddmmyyyy (ví dụ: 0112092012)!`
        );
        setMatchedStudents([]);
        setIsSubmitting(false);
        return;
      }

      if (found.length === 1) {
        const student = found[0];
        const isInitial = !student.isPasswordChanged;
        onLoginStudent(student.id, isInitial);
      } else {
        // Nếu có trùng lặp (ví dụ dùng ngày sinh cũ), cho học sinh chọn tên
        setMatchedStudents(found);
        setErrorMessage('');
        setIsSubmitting(false);
      }
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-gradient-to-br from-[#FFF8F4] via-[#F5EDEB] to-[#E8DEDA]/50 select-none">
      {/* Họa tiết học đường tinh tế ở các góc (6A5 Theme - Dark Navy & Wine Red) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Top-Right: Máy bay giấy & nét lượn sóng */}
        <svg
          className="absolute -top-6 -right-6 w-64 h-64 text-[#922235]/12"
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
          <path d="M175 20 L130 50 L145 65 L175 20 Z" fill="currentColor" opacity="0.6" />
          <path d="M175 20 L155 80 L145 65 L175 20 Z" fill="currentColor" opacity="0.8" />
        </svg>

        {/* Top-Right: Bóng đèn tri thức */}
        <svg
          className="absolute top-10 right-20 w-12 h-12 text-[#922235]/15 hidden sm:block"
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
        </svg>

        {/* Top-Left: Cuốn vở mở */}
        <svg
          className="absolute top-8 left-8 w-14 h-14 text-[#922235]/15 hidden sm:block"
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

        {/* Bottom-Left: Chồng sách */}
        <svg
          className="absolute bottom-6 left-6 w-20 h-20 text-[#922235]/15"
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

        {/* Bottom-Right: Ba lô học đường */}
        <svg
          className="absolute bottom-6 right-6 w-18 h-18 text-[#922235]/15 hidden sm:block"
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
        </svg>
      </div>

      {/* Khung đăng nhập: Nền trắng #FFFFFF, bo góc 24px, viền mảnh #E8DEDA, đổ bóng mềm */}
      <div className="relative w-full max-w-[470px] bg-white rounded-[24px] p-6 sm:p-8 shadow-[0_15px_45px_-10px_rgba(146,34,53,0.12)] border border-[#E8DEDA] animate-fadeIn z-10">
        {/* PHẦN NHẬN DIỆN */}
        <div className="text-center mb-6">
          {/* Biểu tượng Mũ tốt nghiệp trong khối màu Đỏ Rượu Vang sang trọng */}
          <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-[22px] bg-gradient-to-br from-[#922235] via-[#A3283D] to-[#781C2B] text-white flex items-center justify-center mx-auto mb-3.5 shadow-lg shadow-[#922235]/25 border border-[#E8DEDA]/40">
            <GraduationCap className="w-10 h-10 sm:w-11 sm:h-11" strokeWidth={2.2} />
          </div>

          {/* Tiêu đề chính chữ Xanh Navy đậm, không bóng chữ nhòe */}
          <h1 className="text-2xl sm:text-[25px] font-black text-[#233146] tracking-tight uppercase leading-tight">
            {appName}
          </h1>

          {/* Dòng phụ */}
          <p className="text-xs sm:text-[13px] font-semibold text-[#697589] mt-1">
            Đồng hành cùng giáo viên – Kết nối lớp học
          </p>

          {/* Huy hiệu thông tin lớp học hiện có */}
          {(className || schoolYear) && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2.5 rounded-full bg-[#F5EDEB] text-[#922235] border border-[#E8DEDA] text-[11px] font-black">
              <Sparkles className="w-3.5 h-3.5 text-[#922235]" />
              {className && <span>Lớp {className}</span>}
              {className && schoolYear && <span>•</span>}
              {schoolYear && <span>Năm học {schoolYear}</span>}
            </div>
          )}
        </div>

        {/* HAI TAB: GIÁO VIÊN Ở BÊN TRÁI, HỌC SINH Ở BÊN PHẢI (Mặc định Giáo viên) */}
        <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-[#FFF8F4] border border-[#E8DEDA] mb-5">
          {/* Tab 1: Giáo viên (Bên trái) */}
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
                ? 'bg-[#922235] text-white shadow-md shadow-[#922235]/20 font-black'
                : 'text-[#233146] hover:bg-[#F5EDEB] font-bold'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Giáo viên</span>
          </button>

          {/* Tab 2: Học sinh (Bên phải) */}
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
                ? 'bg-[#922235] text-white shadow-md shadow-[#922235]/20 font-black'
                : 'text-[#233146] hover:bg-[#F5EDEB] font-bold'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Học sinh</span>
          </button>
        </div>

        {/* Lời chào */}
        <div className="text-center mb-5">
          <h2 className="text-lg sm:text-xl font-black text-[#233044]">
            {activeTab === 'teacher'
              ? 'Chào mừng thầy cô trở lại!'
              : 'Chào mừng các em học sinh Lớp ' + className + '!'}
          </h2>
          <p className="text-xs text-[#6B7280] font-medium mt-0.5">
            {activeTab === 'teacher'
              ? 'Đăng nhập để quản lý và theo dõi lớp học'
              : 'Nhập mật khẩu khởi tạo 10 số hoặc mật khẩu cá nhân'}
          </p>
        </div>

        {/* Hộp thông báo lỗi */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-start gap-2 leading-relaxed animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* BIỂU MẪU ĐĂNG NHẬP GIÁO VIÊN */}
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
                className="block text-xs font-bold text-[#233146] mb-1.5"
              >
                Mật khẩu giáo viên
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#922235]" />
                <input
                  type={showTeacherPass ? 'text' : 'password'}
                  id="teacher_password_input"
                  name="teacher_pass_input"
                  autoComplete="current-password"
                  value={teacherPassInput}
                  onChange={(e) => setTeacherPassInput(e.target.value)}
                  className="w-full h-[54px] pl-10 pr-11 bg-white border border-[#E8DEDA] rounded-xl focus:ring-4 focus:ring-[#EBC9B9]/50 focus:border-[#922235] outline-none text-sm font-bold text-[#233146] transition-all"
                  placeholder="Nhập mật khẩu giáo viên..."
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowTeacherPass(!showTeacherPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#697589] hover:text-[#233146] cursor-pointer p-1 transition-colors"
                  title={showTeacherPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showTeacherPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Nút đăng nhập Đỏ Rượu Vang sang trọng */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-[54px] bg-gradient-to-r from-[#922235] via-[#A3283D] to-[#781C2B] hover:from-[#781C2B] hover:to-[#922235] text-white font-black text-sm sm:text-base rounded-2xl shadow-lg shadow-[#922235]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
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
          /* BIỂU MẪU ĐĂNG NHẬP HỌC SINH LỚP 8A3 */
          <form
            key="form-student-login"
            onSubmit={handleStudentSubmit}
            autoComplete="off"
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="txt_student_code_ddmmyyyy"
                className="block text-xs font-bold text-[#233146] mb-1.5"
              >
                Mật khẩu học sinh (10 chữ số khởi tạo hoặc mật khẩu cá nhân)
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#922235]" />
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
                    const val = e.target.value;
                    if (val === teacherPassword) {
                      setStudentPasswordInput('');
                      return;
                    }
                    setStudentPasswordInput(val);
                    setMatchedStudents([]);
                    setSelectedStudent(null);
                  }}
                  className="w-full h-[54px] pl-10 pr-4 bg-white border border-[#E8DEDA] rounded-xl focus:ring-4 focus:ring-[#EBC9B9]/50 focus:border-[#922235] outline-none text-sm font-mono font-bold text-[#233146] transition-all"
                  placeholder="Ví dụ: 0112092012"
                  required
                />
              </div>

              {/* Hộp thông tin hướng dẫn nhỏ gọn, rõ ràng */}
              <div className="mt-2.5 p-3 rounded-xl bg-[#F5EDEB] border border-[#E8DEDA] text-xs text-[#233146] flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-[#922235] shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-[11px] leading-relaxed">
                  <span className="font-bold text-[#922235] block">
                    Quy tắc mật khẩu khởi tạo 10 số:
                  </span>
                  <span>
                    <strong>Mã số HS (2 số) + Ngày sinh ddmmyyyy</strong>. Ví dụ: Mã <strong>01</strong> sinh ngày <strong>12/09/2012</strong> thì nhập{' '}
                    <code className="font-mono font-black text-[#922235] bg-white px-1.5 py-0.5 rounded border border-[#E8DEDA]">
                      0112092012
                    </code>{' '}
                    (luôn giữ số 0 ở đầu). Hoặc nhập mật khẩu cá nhân nếu em đã đổi.
                  </span>
                </div>
              </div>
            </div>

            {/* Danh sách chọn tên nếu trùng */}
            {matchedStudents.length > 1 && (
              <div className="p-3 bg-[#F5EDEB] border border-[#E8DEDA] rounded-2xl space-y-2 animate-fadeIn">
                <p className="text-xs font-bold text-[#233146]">
                  Tìm thấy {matchedStudents.length} bạn có ngày sinh này. Vui lòng bấm chọn tên em:
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                  {matchedStudents.map((s, sIdx) => {
                    const code = s.studentCode || formatStudentCode(undefined, sIdx);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedStudent(s);
                          onLoginStudent(s.id, !s.isPasswordChanged);
                        }}
                        className={`w-full p-2.5 rounded-xl text-left text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                          selectedStudent?.id === s.id
                            ? 'bg-[#922235] text-white shadow-xs'
                            : 'bg-white text-[#233146] hover:bg-[#F5EDEB] border border-[#E8DEDA]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-[#922235] bg-[#F5EDEB] px-1.5 py-0.5 rounded text-[11px]">
                            {code}
                          </span>
                          <span>
                            {s.name} ({s.gender})
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#922235]" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Nút đăng nhập Học sinh */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-[54px] bg-gradient-to-r from-[#922235] via-[#A3283D] to-[#781C2B] hover:from-[#781C2B] hover:to-[#922235] text-white font-black text-sm sm:text-base rounded-2xl shadow-lg shadow-[#922235]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
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

        {/* Khẩu hiệu phân cách */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#E8DEDA] to-transparent" />
          <span className="text-[11px] font-bold text-[#922235]/80 whitespace-nowrap">
            Tận tâm đồng hành – Vững vàng chủ nhiệm
          </span>
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#E8DEDA] to-transparent" />
        </div>

        {/* Trải nghiệm nhanh cho giáo viên / học sinh mẫu */}
        <div className="mt-4 pt-3 border-t border-[#E8DEDA] flex flex-col gap-1.5 text-xs">
          <div className="flex items-center justify-between text-[#697589] px-0.5">
            <span className="flex items-center gap-1 text-[11px] font-medium text-[#697589]">
              <Sparkles className="w-3 h-3 text-[#922235]" /> Thử nghiệm nhanh:
            </span>
            <button
              type="button"
              onClick={() => {
                setTeacherPassInput(teacherPassword || 'admin');
                onLoginTeacher();
              }}
              className="text-[#922235] hover:text-[#781C2B] font-bold cursor-pointer underline text-[11px]"
            >
              Vào quyền Giáo viên (admin)
            </button>
          </div>

          {students.length > 0 && (
            <div className="flex items-center justify-between bg-[#F5EDEB]/70 px-2.5 py-1.5 rounded-lg text-[11px] text-[#233146] border border-[#E8DEDA]">
              <span className="truncate">
                HS mẫu: <strong>{students[0].name}</strong> (Mã:{' '}
                <strong className="text-[#922235] font-mono">
                  {students[0].studentCode || '01'}
                </strong>{' '}
                – MK 10 số:{' '}
                <code className="font-mono font-bold text-[#922235]">
                  {students[0].password || generate10DigitInitialPassword(students[0].studentCode || '01', students[0].dob, 0)}
                </code>
                )
              </span>
              <button
                type="button"
                onClick={() => {
                  const s = students[0];
                  const code = s.studentCode || '01';
                  const pass = s.password || generate10DigitInitialPassword(code, s.dob, 0) || '0115052012';
                  setStudentPasswordInput(pass);
                  onLoginStudent(s.id, !s.isPasswordChanged);
                }}
                className="text-[#922235] hover:text-[#781C2B] font-black underline cursor-pointer shrink-0 ml-2"
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
