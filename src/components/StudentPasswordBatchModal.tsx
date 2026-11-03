import React, { useState, useMemo } from 'react';
import {
  X,
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ArrowRight,
  RefreshCw,
  Users,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { Student } from '../types';
import {
  formatStudentCode,
  formatDisplayDate,
  getStudentDob8Digits,
  generate10DigitInitialPassword,
} from '../utils/helpers';

interface StudentPasswordBatchModalProps {
  isOpen: boolean;
  className: string;
  students: Student[];
  onConfirmBatchUpdate: (updatedStudents: Student[]) => void;
  onClose: () => void;
}

interface StudentValidationItem {
  student: Student;
  stt: number;
  assignedCode: string;
  dobFormatted: string;
  dob8Digits: string | null;
  status: 'ready' | 'custom_password' | 'missing_dob' | 'duplicate_code';
  statusText: string;
  isEligible: boolean;
}

export const StudentPasswordBatchModal: React.FC<StudentPasswordBatchModalProps> = ({
  isOpen,
  className,
  students,
  onConfirmBatchUpdate,
  onClose,
}) => {
  const [step, setStep] = useState<'preview' | 'result'>('preview');
  const [confirmed, setConfirmed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [executionResults, setExecutionResults] = useState<{
    successCount: number;
    keptCount: number;
    errorCount: number;
    logs: { id: string; name: string; code: string; result: 'success' | 'kept' | 'error'; msg: string }[];
  } | null>(null);

  // 1. Phân tích & kiểm tra danh sách học sinh lớp 8A3
  const validationItems = useMemo<StudentValidationItem[]>(() => {
    // Sắp xếp danh sách học sinh theo tên tiếng Việt
    const sorted = [...students].sort((a, b) => {
      const nameA = a.name.trim().split(' ').pop() || '';
      const nameB = b.name.trim().split(' ').pop() || '';
      return nameA.localeCompare(nameB, 'vi');
    });

    const codeCounts = new Map<string, number>();

    // Tính mã 2 chữ số (nếu học sinh đã có mã hợp lệ thì giữ nguyên, nếu chưa có thì gán 01, 02...)
    const prepared = sorted.map((s, idx) => {
      const code = s.studentCode
        ? formatStudentCode(s.studentCode)
        : formatStudentCode(undefined, idx);
      codeCounts.set(code, (codeCounts.get(code) || 0) + 1);
      return { s, code, idx };
    });

    return prepared.map(({ s, code, idx }) => {
      const dob8 = getStudentDob8Digits(s.dob);
      const isDuplicate = (codeCounts.get(code) || 0) > 1;

      let status: 'ready' | 'custom_password' | 'missing_dob' | 'duplicate_code' = 'ready';
      let statusText = 'Hợp lệ – Sẵn sàng cập nhật 10 chữ số';
      let isEligible = true;

      if (!dob8) {
        status = 'missing_dob';
        statusText = 'Thiếu ngày sinh hợp lệ (cần bổ sung)';
        isEligible = false;
      } else if (isDuplicate) {
        status = 'duplicate_code';
        statusText = 'Mã học sinh bị trùng lặp trong lớp';
        isEligible = false;
      } else if (s.isPasswordChanged) {
        status = 'custom_password';
        statusText = 'Đã có mật khẩu cá nhân (Được bảo vệ, giữ nguyên)';
        isEligible = false; // Bảo toàn mật khẩu riêng của học sinh
      }

      return {
        student: s,
        stt: idx + 1,
        assignedCode: code,
        dobFormatted: formatDisplayDate(s.dob),
        dob8Digits: dob8,
        status,
        statusText,
        isEligible,
      };
    });
  }, [students]);

  const summary = useMemo(() => {
    const total = validationItems.length;
    const eligible = validationItems.filter((i) => i.isEligible).length;
    const customPass = validationItems.filter((i) => i.status === 'custom_password').length;
    const warnings = validationItems.filter((i) => !i.isEligible && i.status !== 'custom_password').length;
    return { total, eligible, customPass, warnings };
  }, [validationItems]);

  if (!isOpen) return null;

  const handleExecuteUpdate = () => {
    if (!confirmed) return;
    setIsProcessing(true);

    setTimeout(() => {
      const updatedStudentsList: Student[] = [];
      const logs: { id: string; name: string; code: string; result: 'success' | 'kept' | 'error'; msg: string }[] = [];
      let successCount = 0;
      let keptCount = 0;
      let errorCount = 0;

      validationItems.forEach((item) => {
        const s = item.student;
        if (item.isEligible) {
          // Tạo mật khẩu 10 chữ số mới: Mã 2 số + Ngày sinh DDMMYYYY
          const new10Pass = generate10DigitInitialPassword(item.assignedCode, s.dob);
          if (new10Pass && new10Pass.length === 10) {
            updatedStudentsList.push({
              ...s,
              studentCode: item.assignedCode,
              password: new10Pass,
              isPasswordChanged: false, // Đây là mật khẩu khởi tạo, chưa phải mật khẩu cá nhân
            });
            successCount++;
            logs.push({
              id: s.id,
              name: s.name,
              code: item.assignedCode,
              result: 'success',
              msg: `Đã cập nhật mã ${item.assignedCode} & mật khẩu khởi tạo 10 số thành công`,
            });
          } else {
            errorCount++;
            updatedStudentsList.push(s);
            logs.push({
              id: s.id,
              name: s.name,
              code: item.assignedCode,
              result: 'error',
              msg: 'Lỗi định dạng ngày sinh, không thể tạo mật khẩu 10 số',
            });
          }
        } else if (item.status === 'custom_password') {
          // Bảo toàn mật khẩu cá nhân của học sinh
          keptCount++;
          updatedStudentsList.push({
            ...s,
            studentCode: item.assignedCode, // cập nhật mã chuẩn hóa nếu cần
          });
          logs.push({
            id: s.id,
            name: s.name,
            code: item.assignedCode,
            result: 'kept',
            msg: 'Giữ nguyên mật khẩu cá nhân học sinh đã tự đổi',
          });
        } else {
          // Bị cảnh báo (thiếu ngày sinh hoặc trùng)
          errorCount++;
          updatedStudentsList.push(s);
          logs.push({
            id: s.id,
            name: s.name,
            code: item.assignedCode,
            result: 'error',
            msg: item.statusText,
          });
        }
      });

      setExecutionResults({
        successCount,
        keptCount,
        errorCount,
        logs,
      });

      onConfirmBatchUpdate(updatedStudentsList);
      setIsProcessing(false);
      setStep('result');
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] border border-[#E9E2DF]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#E9E2DF] bg-gradient-to-r from-[#FAF0EE] to-[#FFF8F3] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#8E2433] text-white flex items-center justify-center shadow-md shadow-[#8E2433]/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-[#233044] text-base sm:text-lg uppercase tracking-tight">
                  Cập nhật mật khẩu khởi tạo – Lớp {className}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-[#FAF0EE] text-[#8E2433] border border-[#EBC9B9] text-[10px] font-black">
                  Quy tắc 10 chữ số
                </span>
              </div>
              <p className="text-xs text-[#6B7280] font-medium">
                Mật khẩu khởi tạo = Mã học sinh (2 số) + Ngày sinh (DDMMYYYY)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 text-[#6B7280] hover:text-[#233044] flex items-center justify-center border border-[#E9E2DF] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar bg-[#FFF8F3]/40">
          {step === 'preview' ? (
            <>
              {/* Rule Explanation Banner */}
              <div className="bg-white p-4 rounded-2xl border border-[#E9E2DF] shadow-xs space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#8E2433]">
                  <ShieldCheck className="w-4 h-4 text-[#8E2433]" />
                  <span>Quy tắc mật khẩu khởi tạo chuẩn 10 chữ số:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-[#233044]">
                  <div className="bg-[#FAF0EE] p-2.5 rounded-xl border border-[#EBC9B9]">
                    <span className="text-[10px] text-[#6B7280] block font-semibold">Mã học sinh (2 số)</span>
                    <strong className="text-sm font-mono text-[#8E2433]">01, 02, ..., 15</strong>
                    <p className="text-[10px] text-[#6B7280] mt-0.5">Giữ nguyên số 0 ở đầu</p>
                  </div>
                  <div className="bg-[#FAF0EE] p-2.5 rounded-xl border border-[#EBC9B9]">
                    <span className="text-[10px] text-[#6B7280] block font-semibold">Ngày sinh (DDMMYYYY)</span>
                    <strong className="text-sm font-mono text-[#8E2433]">12092012</strong>
                    <p className="text-[10px] text-[#6B7280] mt-0.5">8 chữ số ngày/tháng/năm</p>
                  </div>
                  <div className="bg-[#8E2433] text-white p-2.5 rounded-xl shadow-xs">
                    <span className="text-[10px] text-white/80 block font-semibold">Mật khẩu mới (10 số)</span>
                    <strong className="text-sm font-mono text-white">0112092012</strong>
                    <p className="text-[10px] text-white/80 mt-0.5">Tránh trùng nhau khi cùng ngày sinh</p>
                  </div>
                </div>
              </div>

              {/* 4 Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-white p-3 rounded-2xl border border-[#E9E2DF] text-center shadow-xs">
                  <span className="text-[11px] font-bold text-[#6B7280]">Tổng học sinh 8A3</span>
                  <p className="text-xl font-black text-[#233044] mt-0.5">{summary.total}</p>
                </div>
                <div className="bg-emerald-50/60 p-3 rounded-2xl border border-emerald-200 text-center shadow-xs">
                  <span className="text-[11px] font-bold text-emerald-800">Đủ điều kiện chuyển</span>
                  <p className="text-xl font-black text-emerald-700 mt-0.5">{summary.eligible}</p>
                </div>
                <div className="bg-blue-50/60 p-3 rounded-2xl border border-blue-200 text-center shadow-xs">
                  <span className="text-[11px] font-bold text-blue-800">MK cá nhân (Bảo vệ)</span>
                  <p className="text-xl font-black text-blue-700 mt-0.5">{summary.customPass}</p>
                </div>
                <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200 text-center shadow-xs">
                  <span className="text-[11px] font-bold text-amber-800">Cần bổ sung/Lỗi</span>
                  <p className="text-xl font-black text-amber-700 mt-0.5">{summary.warnings}</p>
                </div>
              </div>

              {/* Warnings callout if any */}
              {summary.warnings > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Lưu ý trước khi chuyển đổi:</p>
                    <p className="text-[11px] mt-0.5 leading-relaxed">
                      Có {summary.warnings} học sinh thiếu ngày sinh hoặc trùng mã. Hệ thống sẽ bỏ qua các tài khoản này để bạn bổ sung hồ sơ trước, không làm gián đoạn tài khoản của lớp.
                    </p>
                  </div>
                </div>
              )}

              {/* Preview Table (Không hiển thị mật khẩu công khai) */}
              <div className="bg-white rounded-2xl border border-[#E9E2DF] overflow-hidden shadow-xs">
                <div className="px-4 py-3 bg-[#FAF0EE] border-b border-[#E9E2DF] flex justify-between items-center">
                  <span className="text-xs font-black text-[#233044] uppercase tracking-wide">
                    Xem trước danh sách tài khoản ({validationItems.length} học sinh)
                  </span>
                  <span className="text-[11px] text-[#6B7280]">
                    * Mật khẩu được bảo mật nội bộ
                  </span>
                </div>

                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FFF8F3] text-[#6B7280] font-bold sticky top-0 border-b border-[#E9E2DF]">
                      <tr>
                        <th className="px-3 py-2.5 text-center w-12">Mã</th>
                        <th className="px-3 py-2.5">Họ và tên</th>
                        <th className="px-3 py-2.5 text-center">Ngày sinh</th>
                        <th className="px-3 py-2.5">Trạng thái chuyển đổi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E9E2DF]">
                      {validationItems.map((item) => {
                        let badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                        if (item.status === 'custom_password') {
                          badgeClass = 'bg-blue-50 text-blue-800 border-blue-200';
                        } else if (item.status === 'missing_dob' || item.status === 'duplicate_code') {
                          badgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
                        }

                        return (
                          <tr key={item.student.id} className="hover:bg-[#FAF0EE]/40 transition-colors">
                            <td className="px-3 py-2.5 text-center font-mono font-black text-[#8E2433]">
                              {item.assignedCode}
                            </td>
                            <td className="px-3 py-2.5 font-bold text-[#233044]">
                              {item.student.name}
                            </td>
                            <td className="px-3 py-2.5 text-center text-[#6B7280] font-medium">
                              {item.dobFormatted || '—'}
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}
                              >
                                {item.statusText}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Confirmation Checkbox */}
              <div className="p-3.5 bg-white rounded-2xl border border-[#E9E2DF] flex items-start gap-3">
                <input
                  type="checkbox"
                  id="confirm_password_batch"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-1 w-4 h-4 text-[#8E2433] rounded focus:ring-[#8E2433] cursor-pointer"
                />
                <label
                  htmlFor="confirm_password_batch"
                  className="text-xs text-[#233044] font-medium leading-relaxed cursor-pointer"
                >
                  Tôi là giáo viên chủ nhiệm lớp {className}. Tôi xác nhận áp dụng quy tắc mật khẩu khởi tạo 10 số (Mã số + Ngày sinh DDMMYYYY) cho <strong>{summary.eligible} học sinh hợp lệ</strong>. Mật khẩu cá nhân học sinh đã tự đổi sẽ được giữ nguyên an toàn.
                </label>
              </div>
            </>
          ) : (
            /* Result Step */
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-emerald-950 uppercase">
                    Cập nhật mật khẩu khởi tạo thành công!
                  </h4>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Đã chuyển đổi thành công <strong>{executionResults?.successCount} tài khoản</strong> sang mật khẩu 10 số. Đã giữ nguyên <strong>{executionResults?.keptCount} tài khoản</strong> có mật khẩu riêng.
                  </p>
                </div>
              </div>

              {/* Execution details */}
              <div className="bg-white rounded-2xl border border-[#E9E2DF] overflow-hidden shadow-xs">
                <div className="px-4 py-3 bg-[#FAF0EE] border-b border-[#E9E2DF] font-bold text-xs text-[#233044]">
                  Nhật ký cập nhật từng tài khoản
                </div>
                <div className="max-h-64 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
                  {executionResults?.logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2 rounded-xl text-xs flex items-center justify-between border border-[#E9E2DF]/60 bg-[#FFF8F3]/30"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-[#8E2433] px-1.5 py-0.5 rounded bg-[#FAF0EE] text-[11px]">
                          {log.code}
                        </span>
                        <span className="font-bold text-[#233044]">{log.name}</span>
                      </div>
                      <span
                        className={`text-[11px] font-semibold ${
                          log.result === 'success'
                            ? 'text-emerald-700'
                            : log.result === 'kept'
                            ? 'text-blue-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {log.msg}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-[#FAF0EE] rounded-xl text-xs text-[#6B7280] leading-relaxed">
                * Học sinh khi đăng nhập lần đầu bằng mật khẩu 10 chữ số sẽ được hệ thống yêu cầu đổi mật khẩu cá nhân mới để đảm bảo tính an toàn và bảo mật riêng tư.
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#E9E2DF] bg-[#FAF0EE]/60 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-white hover:bg-gray-100 text-[#233044] font-bold rounded-xl text-xs sm:text-sm border border-[#E9E2DF] transition-colors cursor-pointer"
          >
            {step === 'result' ? 'Đóng cửa sổ' : 'Hủy bỏ'}
          </button>

          {step === 'preview' && (
            <button
              type="button"
              disabled={!confirmed || summary.eligible === 0 || isProcessing}
              onClick={handleExecuteUpdate}
              className={`px-6 py-2.5 font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                !confirmed || summary.eligible === 0 || isProcessing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                  : 'bg-[#8E2433] hover:bg-[#751c28] text-white shadow-[#8E2433]/25'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang cập nhật...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Xác nhận cập nhật {summary.eligible} tài khoản</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
