import React, { useState, useEffect } from 'react';
import {
  X,
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  Lock,
} from 'lucide-react';
import { Student } from '../types';
import {
  formatStudentCode,
  formatDisplayDate,
  generate10DigitInitialPassword,
} from '../utils/helpers';

interface ResetStudentPasswordModalProps {
  isOpen: boolean;
  student: Student | null;
  fallbackIndex?: number;
  onConfirmReset: (studentId: string, newPassword: string) => void;
  onClose: () => void;
}

export const ResetStudentPasswordModal: React.FC<ResetStudentPasswordModalProps> = ({
  isOpen,
  student,
  fallbackIndex,
  onConfirmReset,
  onClose,
}) => {
  const [resetType, setResetType] = useState<'initial_10' | 'random_temp'>('initial_10');
  const [customTempPassword, setCustomTempPassword] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (student) {
      // Generate a clean random 6-character alphanumeric temp password
      const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
      setCustomTempPassword(`SCN${rand}`);
      setResetType('initial_10');
      setCopied(false);
    }
  }, [student, isOpen]);

  if (!isOpen || !student) return null;

  const code = formatStudentCode(student.studentCode, fallbackIndex);
  const initial10Pass = generate10DigitInitialPassword(code, student.dob, fallbackIndex);

  const finalPasswordToSet =
    resetType === 'initial_10'
      ? initial10Pass || `${code}12092012`
      : customTempPassword;

  const handleCopy = () => {
    navigator.clipboard.writeText(finalPasswordToSet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirm = () => {
    onConfirmReset(student.id, finalPasswordToSet);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-[#E9E2DF]">
        {/* Header */}
        <div className="p-5 border-b border-[#E9E2DF] bg-gradient-to-r from-[#FAF0EE] to-[#FFF8F3] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#8E2433] text-white flex items-center justify-center shadow-md shadow-[#8E2433]/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-[#233044] text-base uppercase">
                Đặt lại mật khẩu học sinh
              </h3>
              <p className="text-xs text-[#6B7280]">
                {student.name} (Mã HS: <span className="font-mono font-bold text-[#8E2433]">{code}</span>)
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

        {/* Body */}
        <div className="p-6 space-y-4 bg-[#FFF8F3]/30">
          <div className="bg-white p-3.5 rounded-2xl border border-[#E9E2DF] text-xs text-[#233044] space-y-1">
            <div className="flex justify-between">
              <span className="text-[#6B7280]">Họ và tên:</span>
              <strong className="font-bold">{student.name}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B7280]">Ngày sinh:</span>
              <span className="font-semibold">{formatDisplayDate(student.dob)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B7280]">Trạng thái hiện tại:</span>
              <span className="font-semibold text-blue-700">
                {student.isPasswordChanged ? 'Đã có mật khẩu cá nhân' : 'Đang dùng mật khẩu khởi tạo'}
              </span>
            </div>
          </div>

          {/* Reset Options */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#233044]">
              Chọn phương thức đặt lại:
            </label>

            <label
              className={`p-3 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                resetType === 'initial_10'
                  ? 'bg-[#FAF0EE] border-[#8E2433] text-[#233044]'
                  : 'bg-white border-[#E9E2DF] hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="reset_type"
                checked={resetType === 'initial_10'}
                onChange={() => setResetType('initial_10')}
                className="mt-0.5 text-[#8E2433] focus:ring-[#8E2433]"
              />
              <div className="text-xs space-y-0.5">
                <span className="font-bold text-[#233044] block">
                  Đặt lại về Mật khẩu khởi tạo 10 số
                </span>
                <span className="text-[#6B7280] text-[11px] block">
                  Quy tắc: Mã học sinh (2 số) + Ngày sinh DDMMYYYY
                </span>
              </div>
            </label>

            <label
              className={`p-3 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                resetType === 'random_temp'
                  ? 'bg-[#FAF0EE] border-[#8E2433] text-[#233044]'
                  : 'bg-white border-[#E9E2DF] hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="reset_type"
                checked={resetType === 'random_temp'}
                onChange={() => setResetType('random_temp')}
                className="mt-0.5 text-[#8E2433] focus:ring-[#8E2433]"
              />
              <div className="text-xs space-y-0.5">
                <span className="font-bold text-[#233044] block">
                  Tạo Mật khẩu tạm thời ngẫu nhiên
                </span>
                <span className="text-[#6B7280] text-[11px] block">
                  Cấp mã tạm thời để học sinh đăng nhập và đổi mật khẩu mới
                </span>
              </div>
            </label>
          </div>

          {/* New password preview box */}
          <div className="p-3.5 bg-white rounded-2xl border border-[#EBC9B9] space-y-1.5">
            <span className="text-[11px] font-bold text-[#6B7280] block">
              Mật khẩu mới sẽ được thiết lập:
            </span>
            <div className="flex items-center justify-between bg-[#FAF0EE] px-3.5 py-2.5 rounded-xl border border-[#E9E2DF]">
              <code className="font-mono text-base font-black text-[#8E2433] tracking-wider">
                {finalPasswordToSet}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-gray-50 text-[#8E2433] font-bold text-xs border border-[#E9E2DF] flex items-center gap-1 cursor-pointer transition-colors"
                title="Sao chép mật khẩu"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Đã chép!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-[#6B7280]">
              * Giáo viên có thể gửi mật khẩu này cho học sinh. Sau khi đăng nhập, học sinh sẽ được nhắc đổi sang mật khẩu riêng.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E9E2DF] bg-[#FAF0EE]/60 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-gray-100 text-[#233044] font-bold rounded-xl text-xs sm:text-sm border border-[#E9E2DF] transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 bg-[#8E2433] hover:bg-[#751c28] text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-[#8E2433]/20 transition-all cursor-pointer"
          >
            Xác nhận đặt lại
          </button>
        </div>
      </div>
    </div>
  );
};
