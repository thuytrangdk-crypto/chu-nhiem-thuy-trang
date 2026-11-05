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
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-[#E8DEDA]">
        {/* Header */}
        <div className="p-5 border-b border-[#E8DEDA] bg-gradient-to-r from-[#F5EDEB] to-[#FFF8F4] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#922235] text-white flex items-center justify-center shadow-md shadow-[#922235]/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-[#233146] text-base uppercase">
                Đặt lại mật khẩu học sinh
              </h3>
              <p className="text-xs text-[#697589]">
                {student.name} (Mã HS: <span className="font-mono font-bold text-[#922235]">{code}</span>)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 text-[#697589] hover:text-[#233146] flex items-center justify-center border border-[#E8DEDA] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 bg-[#FFF8F4]/30">
          <div className="bg-white p-3.5 rounded-2xl border border-[#E8DEDA] text-xs text-[#233146] space-y-1">
            <div className="flex justify-between">
              <span className="text-[#697589]">Họ và tên:</span>
              <strong className="font-bold">{student.name}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[#697589]">Ngày sinh:</span>
              <span className="font-semibold">{formatDisplayDate(student.dob)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#697589]">Trạng thái hiện tại:</span>
              <span className="font-semibold text-blue-700">
                {student.isPasswordChanged ? 'Đã có mật khẩu cá nhân' : 'Đang dùng mật khẩu khởi tạo'}
              </span>
            </div>
          </div>

          {/* Reset Options */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#233146]">
              Chọn phương thức đặt lại:
            </label>

            <label
              className={`p-3 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                resetType === 'initial_10'
                  ? 'bg-[#F5EDEB] border-[#922235] text-[#233146]'
                  : 'bg-white border-[#E8DEDA] hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="reset_type"
                checked={resetType === 'initial_10'}
                onChange={() => setResetType('initial_10')}
                className="mt-0.5 text-[#922235] focus:ring-[#922235]"
              />
              <div className="text-xs space-y-0.5">
                <span className="font-bold text-[#233146] block">
                  Đặt lại về Mật khẩu khởi tạo 10 số
                </span>
                <span className="text-[#697589] text-[11px] block">
                  Quy tắc: Mã học sinh (2 số) + Ngày sinh DDMMYYYY
                </span>
              </div>
            </label>

            <label
              className={`p-3 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all ${
                resetType === 'random_temp'
                  ? 'bg-[#F5EDEB] border-[#922235] text-[#233146]'
                  : 'bg-white border-[#E8DEDA] hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="reset_type"
                checked={resetType === 'random_temp'}
                onChange={() => setResetType('random_temp')}
                className="mt-0.5 text-[#922235] focus:ring-[#922235]"
              />
              <div className="text-xs space-y-0.5">
                <span className="font-bold text-[#233146] block">
                  Tạo Mật khẩu tạm thời ngẫu nhiên
                </span>
                <span className="text-[#697589] text-[11px] block">
                  Cấp mã tạm thời để học sinh đăng nhập và đổi mật khẩu mới
                </span>
              </div>
            </label>
          </div>

          {/* New password preview box */}
          <div className="p-3.5 bg-white rounded-2xl border border-[#E8DEDA] space-y-1.5">
            <span className="text-[11px] font-bold text-[#697589] block">
              Mật khẩu mới sẽ được thiết lập:
            </span>
            <div className="flex items-center justify-between bg-[#F5EDEB] px-3.5 py-2.5 rounded-xl border border-[#E8DEDA]">
              <code className="font-mono text-base font-black text-[#922235] tracking-wider">
                {finalPasswordToSet}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-gray-50 text-[#922235] font-bold text-xs border border-[#E8DEDA] flex items-center gap-1 cursor-pointer transition-colors"
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
            <p className="text-[11px] text-[#697589]">
              * Giáo viên có thể gửi mật khẩu này cho học sinh. Sau khi đăng nhập, học sinh sẽ được nhắc đổi sang mật khẩu riêng.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E8DEDA] bg-[#F5EDEB]/60 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-gray-100 text-[#233146] font-bold rounded-xl text-xs sm:text-sm border border-[#E8DEDA] transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 bg-[#922235] hover:bg-[#781C2B] text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-[#922235]/20 transition-all cursor-pointer"
          >
            Xác nhận đặt lại
          </button>
        </div>
      </div>
    </div>
  );
};
