import React, { useState } from 'react';
import { X, KeyRound, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  currentPassword?: string;
  onSave: (newPassword: string) => void;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  title = 'Đổi mật khẩu',
  description,
  currentPassword,
  onSave,
  onClose,
}) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (currentPassword && oldPassword !== currentPassword) {
      setError('Mật khẩu hiện tại chưa chính xác!');
      return;
    }

    if (newPassword.length < 4) {
      setError('Mật khẩu mới phải có ít nhất 4 ký tự!');
      return;
    }

    if (newPassword === oldPassword) {
      setError('Mật khẩu mới không được trùng với mật khẩu cũ/khởi tạo!');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không trùng khớp!');
      return;
    }

    onSave(newPassword);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-[#E8DEDA]">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-[#E8DEDA] bg-gradient-to-r from-[#F5EDEB] to-[#FFF8F4]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#922235] text-white flex items-center justify-center shadow-md shadow-[#922235]/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-[#233146] uppercase tracking-tight">
                {title}
              </h3>
              {description && (
                <p className="text-xs text-[#697589] font-medium">{description}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 text-[#697589] hover:text-[#233146] flex items-center justify-center border border-[#E8DEDA] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-[#FFF8F4]/25">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-start gap-2 leading-relaxed">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {currentPassword !== undefined && (
            <div>
              <label className="block text-xs font-bold text-[#233146] mb-1.5">
                Mật khẩu hiện tại
              </label>
              <div className="relative">
                <input
                  type={showOld ? 'text' : 'password'}
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Nhập mật khẩu đang dùng..."
                  className="w-full h-11 pl-3.5 pr-10 border border-[#E8DEDA] rounded-xl focus:ring-2 focus:ring-[#922235] focus:border-[#922235] outline-none text-xs sm:text-sm bg-white font-medium text-[#233146]"
                />
                <button
                  type="button"
                  onClick={() => setShowOld(!showOld)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
                >
                  {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#233146] mb-1.5">
              Mật khẩu mới
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                required
                minLength={4}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới (tối thiểu 4 ký tự)..."
                className="w-full h-11 pl-3.5 pr-10 border border-[#E8DEDA] rounded-xl focus:ring-2 focus:ring-[#922235] focus:border-[#922235] outline-none text-xs sm:text-sm bg-white font-medium text-[#233146]"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-[#697589] mt-1">
              * Không yêu cầu phải là 10 chữ số hay ngày sinh; có thể là bất kỳ mật khẩu nào em thấy an toàn.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#233146] mb-1.5">
              Xác nhận mật khẩu mới
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                minLength={4}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới..."
                className="w-full h-11 pl-3.5 pr-10 border border-[#E8DEDA] rounded-xl focus:ring-2 focus:ring-[#922235] focus:border-[#922235] outline-none text-xs sm:text-sm bg-white font-medium text-[#233146]"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white hover:bg-gray-100 text-[#233146] font-bold rounded-xl text-xs sm:text-sm border border-[#E8DEDA] cursor-pointer transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#922235] hover:bg-[#781C2B] text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-[#922235]/20 cursor-pointer transition-all flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Cập nhật mật khẩu</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
