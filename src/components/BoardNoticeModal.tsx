import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Megaphone,
  Info,
  AlertTriangle,
  Sparkles,
  Edit3,
  Trash2,
  Calendar,
  Save,
  Image as ImageIcon,
  Upload,
  Link2,
  Video as VideoIcon,
  Plus,
  ExternalLink,
  Play,
  FileText,
  UploadCloud,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Film,
} from 'lucide-react';
import { BoardNotice, NoticeType } from '../types';
import { getTodayStr, resizeImageBase64, formatFileSize } from '../utils/helpers';
import {
  getYouTubeEmbedUrl,
  getGoogleDriveVideoEmbed,
  isDirectVideoFile,
  sanitizeUrl,
  extractDomain,
  checkVideoFormatCompatibility,
  VideoFormatCheck,
} from '../utils/mediaHelpers';
import { supabaseService } from '../services/supabaseService';

interface BoardNoticeModalProps {
  isOpen: boolean;
  initialNotice?: BoardNotice | null;
  onSave: (
    title: string,
    content: string,
    type: NoticeType,
    noticeId?: string,
    date?: string,
    image?: string,
    images?: string[],
    videoUrl?: string,
    linkUrl?: string,
    linkTitle?: string,
    videoName?: string,
    videoSize?: number,
    videoStoragePath?: string
  ) => void;
  onDelete?: (noticeId: string) => void;
  onClose: () => void;
  isTeacher?: boolean;
  onOpenSupabaseModal?: () => void;
}

export const BoardNoticeModal: React.FC<BoardNoticeModalProps> = ({
  isOpen,
  initialNotice,
  onSave,
  onDelete,
  onClose,
  isTeacher = true,
  onOpenSupabaseModal,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<NoticeType>('info');
  const [date, setDate] = useState(getTodayStr());

  // Media state
  const [images, setImages] = useState<string[]>([]);
  const [activeMediaTab, setActiveMediaTab] = useState<'images' | 'video' | 'link'>('images');

  // Video Sub-Options: 'upload' (Tải video từ thiết bị) or 'url' (Dán đường dẫn video)
  const [videoSourceType, setVideoSourceType] = useState<'upload' | 'url'>('upload');

  // Video data states
  const [videoUrl, setVideoUrl] = useState('');
  const [videoName, setVideoName] = useState('');
  const [videoSize, setVideoSize] = useState<number | undefined>(undefined);
  const [videoStoragePath, setVideoStoragePath] = useState<string | undefined>(undefined);

  // Device file pending upload
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [videoFormatCheck, setVideoFormatCheck] = useState<VideoFormatCheck | null>(null);

  // Upload Progress & Errors
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Link state
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');

  // Input states for adding Image URL
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [showImageUrlInput, setShowImageUrlInput] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const previousBlobUrlRef = useRef<string | null>(null);

  // Keep track of object URLs to clean up
  useEffect(() => {
    previousBlobUrlRef.current = pendingPreviewUrl;
  }, [pendingPreviewUrl]);

  useEffect(() => {
    return () => {
      if (previousBlobUrlRef.current) {
        URL.revokeObjectURL(previousBlobUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (initialNotice) {
      setTitle(initialNotice.title || '');
      setContent(initialNotice.content || '');
      setType(initialNotice.type || 'info');
      setDate(initialNotice.date || getTodayStr());

      // Normalize images from either images array or legacy single image
      if (
        initialNotice.images &&
        Array.isArray(initialNotice.images) &&
        initialNotice.images.length > 0
      ) {
        setImages(initialNotice.images);
      } else if (initialNotice.image) {
        setImages([initialNotice.image]);
      } else {
        setImages([]);
      }

      const initialVidUrl = initialNotice.videoUrl || '';
      setVideoUrl(initialVidUrl);
      setVideoName(initialNotice.videoName || '');
      setVideoSize(initialNotice.videoSize);
      setVideoStoragePath(initialNotice.videoStoragePath);

      // Determine source type from existing videoUrl
      const isExternalEmbed =
        getYouTubeEmbedUrl(initialVidUrl) || getGoogleDriveVideoEmbed(initialVidUrl);
      if (isExternalEmbed) {
        setVideoSourceType('url');
      } else if (initialVidUrl) {
        setVideoSourceType('upload');
      } else {
        setVideoSourceType('upload');
      }

      if (initialVidUrl && !initialNotice.videoName) {
        // Format check from URL
        const check = checkVideoFormatCompatibility(initialVidUrl);
        setVideoFormatCheck(check);
      } else if (initialNotice.videoName) {
        const check = checkVideoFormatCompatibility(initialNotice.videoName);
        setVideoFormatCheck(check);
      } else {
        setVideoFormatCheck(null);
      }

      setLinkUrl(initialNotice.linkUrl || '');
      setLinkTitle(initialNotice.linkTitle || '');

      if (initialNotice.videoUrl) {
        setActiveMediaTab('video');
      } else if (
        initialNotice.linkUrl &&
        (!initialNotice.images || initialNotice.images.length === 0)
      ) {
        setActiveMediaTab('link');
      } else {
        setActiveMediaTab('images');
      }
    } else {
      setTitle('');
      setContent('');
      setType('info');
      setDate(getTodayStr());
      setImages([]);
      setVideoUrl('');
      setVideoName('');
      setVideoSize(undefined);
      setVideoStoragePath(undefined);
      setVideoSourceType('upload');
      setVideoFormatCheck(null);
      setLinkUrl('');
      setLinkTitle('');
      setActiveMediaTab('images');
    }

    if (previousBlobUrlRef.current) {
      URL.revokeObjectURL(previousBlobUrlRef.current);
    }
    setPendingVideoFile(null);
    setPendingPreviewUrl(null);
    setIsUploading(false);
    setUploadProgress(0);
    setUploadError(null);
    setImageUrlInput('');
    setShowImageUrlInput(false);
  }, [initialNotice, isOpen]);

  if (!isOpen) return null;

  const handleMultipleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      resizeImageBase64(file, 640, 640, (base64) => {
        setImages((prev) => [...prev, base64]);
      });
    });
    e.target.value = '';
  };

  const handleAddImageUrl = () => {
    if (imageUrlInput.trim()) {
      const sanitized = sanitizeUrl(imageUrlInput.trim());
      setImages((prev) => [...prev, sanitized]);
      setImageUrlInput('');
      setShowImageUrlInput(false);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Limit check: 100MB max
    if (file.size > 100 * 1024 * 1024) {
      setUploadError(
        `Tệp "${file.name}" có dung lượng ${formatFileSize(file.size)}, vượt quá giới hạn tối đa 100MB. Vui lòng nén video hoặc chọn đường dẫn video từ YouTube / Google Drive.`
      );
      e.target.value = '';
      return;
    }

    // Format validation
    const formatCheck = checkVideoFormatCompatibility(file.name);
    setVideoFormatCheck(formatCheck);

    // Revoke previous blob if any
    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
    }

    const blobUrl = URL.createObjectURL(file);
    setPendingPreviewUrl(blobUrl);
    setPendingVideoFile(file);
    setVideoName(file.name);
    setVideoSize(file.size);
    // Clear any previous URL when new file is selected
    setVideoUrl('');
    setVideoStoragePath(undefined);
    setVideoSourceType('upload');

    e.target.value = '';
  };

  const handleRemoveVideo = () => {
    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
    }
    setPendingVideoFile(null);
    setPendingPreviewUrl(null);
    setVideoUrl('');
    setVideoName('');
    setVideoSize(undefined);
    setVideoStoragePath(undefined);
    setVideoFormatCheck(null);
    setUploadError(null);
    setUploadProgress(0);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    if (!isTeacher) {
      alert('Chỉ giáo viên mới có quyền đăng hoặc sửa bài viết!');
      return;
    }

    // 1. If there is a pending video file selected from device, upload it to Supabase Storage now
    if (pendingVideoFile) {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadError(null);

      const uploadResult = await supabaseService.uploadBoardVideo(
        pendingVideoFile,
        (percent) => setUploadProgress(percent)
      );

      if (!uploadResult.success || !uploadResult.url) {
        setIsUploading(false);
        setUploadError(
          uploadResult.error ||
            'Tải video lên máy chủ Supabase thất bại. Vui lòng kiểm tra lại kết nối mạng và thử lại.'
        );
        return; // Do NOT proceed with saving, keep modal open
      }

      setIsUploading(false);

      if (pendingPreviewUrl) {
        URL.revokeObjectURL(pendingPreviewUrl);
      }

      const primaryImage = images.length > 0 ? images[0] : undefined;
      const finalImages = images.length > 0 ? images : undefined;
      const finalLink = linkUrl.trim() ? sanitizeUrl(linkUrl.trim()) : undefined;
      const finalLinkTitle = linkTitle.trim() || undefined;

      onSave(
        title.trim(),
        content.trim(),
        type,
        initialNotice?.id,
        date,
        primaryImage,
        finalImages,
        uploadResult.url,
        finalLink,
        finalLinkTitle,
        uploadResult.name,
        uploadResult.size,
        uploadResult.path
      );
      onClose();
      return;
    }

    // 2. Normal save without pending file upload (either existing videoUrl or pasted external URL)
    const primaryImage = images.length > 0 ? images[0] : undefined;
    const finalImages = images.length > 0 ? images : undefined;
    const finalVideo = videoUrl.trim() ? sanitizeUrl(videoUrl.trim()) : undefined;
    const finalLink = linkUrl.trim() ? sanitizeUrl(linkUrl.trim()) : undefined;
    const finalLinkTitle = linkTitle.trim() || undefined;

    onSave(
      title.trim(),
      content.trim(),
      type,
      initialNotice?.id,
      date,
      primaryImage,
      finalImages,
      finalVideo,
      finalLink,
      finalLinkTitle,
      videoName.trim() || undefined,
      videoSize,
      videoStoragePath
    );
    onClose();
  };

  const isEditing = !!initialNotice;

  // Video embeds & preview calculation
  const currentPreviewSource = pendingPreviewUrl || videoUrl;
  const ytEmbed = videoUrl ? getYouTubeEmbedUrl(videoUrl) : null;
  const driveEmbed = videoUrl ? getGoogleDriveVideoEmbed(videoUrl) : null;
  const isDirectVideo = currentPreviewSource
    ? isDirectVideoFile(currentPreviewSource) || !!pendingPreviewUrl
    : false;

  const hasAnyVideo = !!pendingVideoFile || !!videoUrl.trim();

  if (!isOpen || !isTeacher) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] border border-[#E8DEDA]">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-[#E8DEDA] bg-gradient-to-r from-[#F5EDEB] to-[#FFF8F4] shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-2xs ${
                isEditing
                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                  : 'bg-[#F5EDEB] text-[#922235] border border-[#E8DEDA]'
              }`}
            >
              {isEditing ? (
                <Edit3 className="w-4 h-4" />
              ) : (
                <Megaphone className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="text-base font-black text-[#233146] leading-tight uppercase">
                {isEditing
                  ? 'Thay đổi thông tin đã đăng'
                  : 'Đăng thông tin mới lên Bảng tin'}
              </h3>
              <p className="text-[11px] text-[#697589] font-medium">
                {isEditing
                  ? 'Cập nhật nội dung, nhiều ảnh, video trực tiếp hoặc liên kết'
                  : 'Hỗ trợ tải video từ thiết bị, chèn nhiều ảnh và liên kết'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => handleSubmit()}
              className={`px-3.5 py-1.5 font-bold rounded-xl text-xs sm:text-sm shadow-xs flex items-center gap-1.5 transition-all ${
                isUploading
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-[#922235] hover:bg-[#781C2B] text-white cursor-pointer shadow-md shadow-[#922235]/20'
              }`}
              title="Lưu thông báo này"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang tải {uploadProgress}%</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Lưu</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={isUploading}
              className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center justify-center border border-[#E8DEDA] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Form with Scrollable Content */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col overflow-hidden"
        >
          {/* Scrollable Fields */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Tiêu đề thông tin <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Kế hoạch ngoại khóa, Lịch thi, Nhắc nhở nề nếp..."
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#922235] focus:border-[#922235] outline-none text-sm font-bold text-[#233146]"
              />
            </div>

            {/* Date & Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#922235]" />
                  <span>Ngày đăng</span>
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#922235] focus:border-[#922235] outline-none text-xs sm:text-sm font-semibold text-[#233146]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Phân loại thông tin
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as NoticeType)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#922235] focus:border-[#922235] outline-none text-xs sm:text-sm font-semibold bg-white cursor-pointer text-[#233146]"
                >
                  <option value="info">Thông tin chung</option>
                  <option value="warning">Nhắc nhở nề nếp / Y tế</option>
                  <option value="success">Khen thưởng &amp; Vinh danh</option>
                </select>
              </div>
            </div>

            {/* Content text */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Nội dung chi tiết <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Nhập nội dung đầy đủ của thông báo gửi đến học sinh và phụ huynh..."
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#922235] focus:border-[#922235] outline-none text-xs sm:text-sm leading-relaxed text-[#233146]"
              />
            </div>

            {/* MULTIMEDIA ATTACHMENTS SECTION */}
            <div className="bg-[#F5EDEB]/40 rounded-2xl border border-[#E8DEDA] p-3.5 space-y-3">
              {/* Media Subtab Selector */}
              <div className="flex items-center justify-between border-b border-[#E8DEDA] pb-2.5 flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveMediaTab('images')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeMediaTab === 'images'
                        ? 'bg-[#922235] text-white shadow-xs font-bold'
                        : 'bg-white text-[#233146] hover:bg-[#F5EDEB] border border-[#E8DEDA]'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Nhiều ảnh ({images.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveMediaTab('video')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeMediaTab === 'video'
                        ? 'bg-[#922235] text-white shadow-xs font-bold'
                        : 'bg-white text-[#233146] hover:bg-[#F5EDEB] border border-[#E8DEDA]'
                    }`}
                  >
                    <VideoIcon className="w-3.5 h-3.5" />
                    <span>Video {hasAnyVideo ? '✓' : ''}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveMediaTab('link')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeMediaTab === 'link'
                        ? 'bg-[#922235] text-white shadow-xs font-bold'
                        : 'bg-white text-[#233146] hover:bg-[#F5EDEB] border border-[#E8DEDA]'
                    }`}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Liên kết {linkUrl ? '✓' : ''}</span>
                  </button>
                </div>

                {/* Overall status count */}
                <div className="text-[11px] text-[#697589] font-semibold flex items-center gap-1">
                  {images.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-[#F5EDEB] text-[#233146] font-bold border border-[#E8DEDA]">
                      {images.length} ảnh
                    </span>
                  )}
                  {hasAnyVideo && (
                    <span className="px-1.5 py-0.5 rounded bg-[#F5EDEB] text-[#781C2B] font-bold border border-[#E8DEDA]">
                      1 video
                    </span>
                  )}
                  {linkUrl && (
                    <span className="px-1.5 py-0.5 rounded bg-[#F5EDEB] text-[#922235] font-bold border border-[#E8DEDA]">
                      1 liên kết
                    </span>
                  )}
                </div>
              </div>

              {/* TAB 1: NHIỀU ẢNH (IMAGES) */}
              {activeMediaTab === 'images' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 bg-white hover:bg-[#F5EDEB] text-[#233146] font-bold text-xs rounded-xl border border-[#E8DEDA] shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#922235]" />
                      <span>Chọn nhiều ảnh từ máy / điện thoại</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleMultipleFilesChange}
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => setShowImageUrlInput(!showImageUrlInput)}
                      className="px-3 py-2 bg-white hover:bg-gray-100 text-[#233146] font-semibold text-xs rounded-xl border border-gray-200 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#922235]" />
                      <span>{showImageUrlInput ? 'Ẩn ô dán link' : 'Dán link ảnh'}</span>
                    </button>

                    {images.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setImages([])}
                        className="text-xs text-red-600 hover:text-red-700 font-bold ml-auto cursor-pointer"
                      >
                        Xóa tất cả ảnh ({images.length})
                      </button>
                    )}
                  </div>

                  {showImageUrlInput && (
                    <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-[#E8DEDA] animate-fadeIn">
                      <input
                        type="url"
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        placeholder="Dán đường dẫn ảnh (https://...)"
                        className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-[#922235]"
                      />
                      <button
                        type="button"
                        onClick={handleAddImageUrl}
                        className="px-3 py-1.5 bg-[#922235] hover:bg-[#781C2B] text-white text-xs font-bold rounded-lg cursor-pointer shrink-0"
                      >
                        Thêm ảnh
                      </button>
                    </div>
                  )}

                  {/* Thumbnail gallery */}
                  {images.length === 0 ? (
                    <div className="py-6 px-4 border border-dashed border-[#E8DEDA] rounded-2xl text-center bg-white/70">
                      <ImageIcon className="w-8 h-8 text-[#922235] mx-auto mb-1.5 opacity-60" />
                      <p className="text-xs font-bold text-[#233146]">Chưa có ảnh nào được chọn</p>
                      <p className="text-[11px] text-[#697589] mt-0.5">
                        Bạn có thể chọn cùng lúc nhiều ảnh từ máy tính hoặc điện thoại
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-60 overflow-y-auto p-1 custom-scrollbar">
                      {images.map((imgSrc, idx) => (
                        <div
                          key={idx}
                          className="relative group rounded-xl overflow-hidden border border-gray-200 bg-white shadow-2xs aspect-video"
                        >
                          <img
                            src={imgSrc}
                            alt={`Ảnh ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-1 left-1 px-1.5 py-0.2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold rounded">
                            #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-lg opacity-80 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs"
                            title="Xóa ảnh này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: VIDEO (TẢI TỪ THIẾT BỊ HOẶC DÁN ĐƯỜNG DẪN) */}
              {activeMediaTab === 'video' && (
                <div className="space-y-3">
                  {/* TWO CLEAR OPTIONS SELECTOR */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-white rounded-xl border border-[#E8DEDA]">
                    <button
                      type="button"
                      onClick={() => setVideoSourceType('upload')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        videoSourceType === 'upload'
                          ? 'bg-[#922235] text-white shadow-xs font-bold'
                          : 'text-[#233146] hover:bg-[#F5EDEB]'
                      }`}
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>Tải video từ thiết bị</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVideoSourceType('url')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        videoSourceType === 'url'
                          ? 'bg-[#922235] text-white shadow-xs font-bold'
                          : 'text-[#233146] hover:bg-[#F5EDEB]'
                      }`}
                    >
                      <Link2 className="w-4 h-4" />
                      <span>Dán đường dẫn video</span>
                    </button>
                  </div>

                  {/* OPTION A: TẢI VIDEO TỪ THIẾT BỊ */}
                  {videoSourceType === 'upload' && (
                    <div className="space-y-3">
                      <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm,video/*"
                        onChange={handleVideoFileChange}
                        className="hidden"
                      />

                      {!hasAnyVideo ? (
                        <div className="p-6 border-2 border-dashed border-[#E8DEDA] hover:border-[#922235] rounded-2xl bg-white/80 text-center transition-colors">
                          <div className="w-12 h-12 rounded-2xl bg-[#F5EDEB] text-[#922235] flex items-center justify-center mx-auto mb-3 shadow-inner">
                            <Film className="w-6 h-6" />
                          </div>
                          <p className="text-xs font-bold text-[#233146] mb-1">
                            Chọn video MP4 từ máy tính hoặc điện thoại
                          </p>
                          <p className="text-[11px] text-[#697589] mb-3 max-w-sm mx-auto">
                            Tệp video sẽ được lưu trữ an toàn trên Supabase Storage và hiển thị trực tiếp trong bài đăng trên mọi thiết bị.
                          </p>

                          <button
                            type="button"
                            onClick={() => videoInputRef.current?.click()}
                            className="px-4 py-2 bg-[#922235] hover:bg-[#781C2B] text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-2 cursor-pointer transition-all"
                          >
                            <Upload className="w-4 h-4" />
                            <span>Chọn tệp video (Tối đa 100MB)</span>
                          </button>

                          <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-gray-500 font-semibold flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Ưu tiên: MP4 (H.264)
                            </span>
                            <span className="px-2 py-0.5 rounded bg-[#F5EDEB] text-[#233146] border border-[#E8DEDA]">
                              Hỗ trợ: WebM, iPhone (.mov)
                            </span>
                            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                              Giới hạn: 100MB
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3.5 bg-white rounded-2xl border border-[#E8DEDA] space-y-3 shadow-2xs">
                          {/* File info bar */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                                <Film className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-900 truncate max-w-xs sm:max-w-md">
                                  {videoName || 'Tệp video đã đính kèm'}
                                </p>
                                <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                  {videoSize && (
                                    <span className="font-semibold text-gray-700">
                                      {formatFileSize(videoSize)}
                                    </span>
                                  )}
                                  {videoFormatCheck && (
                                    <span
                                      className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                                        videoFormatCheck.isRecommended
                                          ? 'bg-emerald-50 text-emerald-700'
                                          : 'bg-amber-50 text-amber-700'
                                      }`}
                                    >
                                      {videoFormatCheck.formatName}
                                    </span>
                                  )}
                                  {pendingVideoFile ? (
                                    <span className="px-1.5 py-0.2 rounded bg-sky-50 text-sky-700 font-semibold text-[10px] border border-sky-200">
                                      Sẵn sàng tải lên khi Lưu
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-semibold text-[10px] border border-emerald-200 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" /> Đã lưu trên Cloud
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Actions: Replace / Remove */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={isUploading}
                                onClick={() => videoInputRef.current?.click()}
                                className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                title="Chọn tệp video khác để thay thế"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Thay video</span>
                              </button>
                              <button
                                type="button"
                                disabled={isUploading}
                                onClick={handleRemoveVideo}
                                className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                title="Gỡ video khỏi bài đăng"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Gỡ</span>
                              </button>
                            </div>
                          </div>

                          {/* Warning callout if format is not MP4/WebM */}
                          {videoFormatCheck?.warning && (
                            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <p className="leading-snug">{videoFormatCheck.warning}</p>
                            </div>
                          )}

                          {/* Real-time Video Preview Player */}
                          <div className="rounded-xl overflow-hidden bg-black shadow-inner">
                            <video
                              src={currentPreviewSource}
                              controls
                              playsInline
                              preload="metadata"
                              className="w-full max-h-60 bg-black"
                            />
                          </div>

                          {/* Live Upload Progress */}
                          {isUploading && (
                            <div className="p-3 bg-[#F5EDEB] rounded-xl border border-[#E8DEDA] space-y-1.5 animate-fadeIn">
                              <div className="flex items-center justify-between text-xs font-bold text-[#233146]">
                                <span className="flex items-center gap-1.5">
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#922235]" />
                                  Đang tải video lên Supabase Storage...
                                </span>
                                <span>{uploadProgress}%</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                <div
                                  className="bg-[#922235] h-full transition-all duration-200 rounded-full"
                                  style={{ width: `${uploadProgress}%` }}
                                />
                              </div>
                              <p className="text-[11px] text-[#697589]">
                                Vui lòng giữ nguyên cửa sổ và không đóng trình duyệt trong khi tải tệp.
                              </p>
                            </div>
                          )}

                          {/* Upload Error with Retry */}
                          {uploadError && (
                            <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-800 space-y-2 animate-fadeIn">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                  <p className="font-bold">Lỗi khi tải video lên:</p>
                                  <p className="leading-relaxed">{uploadError}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleSubmit()}
                                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs cursor-pointer"
                                >
                                  Thử lại tải lên
                                </button>
                                {onOpenSupabaseModal && (
                                  <button
                                    type="button"
                                    onClick={onOpenSupabaseModal}
                                    className="px-3 py-1 bg-white border border-red-300 text-red-700 hover:bg-red-50 font-bold rounded-lg text-xs cursor-pointer flex items-center gap-1"
                                  >
                                    <span>Cài đặt Supabase Storage (SQL)</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* OPTION B: DÁN ĐƯỜNG DẪN VIDEO (YOUTUBE / DRIVE / MP4 LINK) */}
                  {videoSourceType === 'url' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Đường dẫn Video (YouTube, Google Drive, hoặc link file MP4)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="url"
                            value={videoUrl}
                            onChange={(e) => {
                              setVideoUrl(e.target.value);
                              setPendingVideoFile(null);
                              if (pendingPreviewUrl) {
                                URL.revokeObjectURL(pendingPreviewUrl);
                                setPendingPreviewUrl(null);
                              }
                            }}
                            placeholder="Ví dụ: https://www.youtube.com/watch?v=... hoặc https://youtu.be/..."
                            className="flex-1 px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#922235] focus:border-[#922235] outline-none font-medium"
                          />
                          {videoUrl && (
                            <button
                              type="button"
                              onClick={handleRemoveVideo}
                              className="px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl border border-red-200 cursor-pointer shrink-0"
                            >
                              Xóa video
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1">
                          Hỗ trợ: YouTube video, YouTube Shorts, Google Drive video hoặc link direct .mp4
                        </p>
                      </div>

                      {/* Video Live Preview for URL */}
                      {videoUrl.trim() && (
                        <div className="p-3 bg-white rounded-2xl border border-gray-200 space-y-2">
                          <span className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
                            <Play className="w-3.5 h-3.5 text-[#922235]" /> Xem trước video sẽ hiển thị:
                          </span>

                          {ytEmbed ? (
                            <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-inner">
                              <iframe
                                src={ytEmbed}
                                title="YouTube Preview"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="w-full h-full border-0"
                              />
                            </div>
                          ) : driveEmbed ? (
                            <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-inner">
                              <iframe
                                src={driveEmbed}
                                title="Google Drive Video Preview"
                                allow="autoplay"
                                allowFullScreen
                                className="w-full h-full border-0"
                              />
                            </div>
                          ) : isDirectVideo ? (
                            <video
                              src={sanitizeUrl(videoUrl)}
                              controls
                              playsInline
                              preload="metadata"
                              className="w-full max-h-56 rounded-xl bg-black"
                            />
                          ) : (
                            <div className="p-4 bg-gray-50 rounded-xl flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs text-gray-700">
                                <VideoIcon className="w-4 h-4 text-[#922235]" />
                                <span className="font-semibold truncate max-w-xs">{videoUrl}</span>
                              </div>
                              <a
                                href={sanitizeUrl(videoUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 bg-[#F5EDEB] border border-[#E8DEDA] text-xs font-bold text-[#922235] rounded-lg flex items-center gap-1 hover:bg-[#E8DEDA]"
                              >
                                <span>Mở liên kết</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: LIÊN KẾT (LINK WEB / TÀI LIỆU / BIỂU MẪU) */}
              {activeMediaTab === 'link' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Đường dẫn liên kết (URL)
                    </label>
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://docs.google.com/forms/... hoặc trang web liên kết"
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#922235] focus:border-[#922235] outline-none font-medium text-[#233146]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Tiêu đề hoặc nhãn liên kết (tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={linkTitle}
                      onChange={(e) => setLinkTitle(e.target.value)}
                      placeholder="Ví dụ: Bấm để điền đơn khảo sát, Tải tài liệu hướng dẫn..."
                      className="w-full px-3.5 py-2 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#922235] focus:border-[#922235] outline-none text-[#233146]"
                    />
                  </div>

                  {linkUrl.trim() && (
                    <div className="p-3 bg-white rounded-2xl border border-[#E8DEDA] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#F5EDEB] text-[#922235] border border-[#E8DEDA] flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#233146] truncate">
                            {linkTitle.trim() || extractDomain(linkUrl)}
                          </p>
                          <p className="text-[11px] text-[#697589] truncate">{linkUrl}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setLinkUrl('');
                          setLinkTitle('');
                        }}
                        className="px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg font-bold shrink-0 cursor-pointer"
                      >
                        Xóa link
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sticky Modal Footer */}
          <div className="p-4 bg-gray-50/90 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0">
            {isEditing && onDelete ? (
              <button
                type="button"
                disabled={isUploading}
                onClick={() => {
                  if (initialNotice) {
                    onDelete(initialNotice.id);
                  }
                }}
                className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer flex items-center gap-1.5 border border-red-200 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa tin này</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={isUploading}
                onClick={onClose}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isUploading}
                className={`px-6 py-2.5 font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 ${
                  isUploading
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-[#922235] hover:bg-[#781C2B] text-white hover:shadow-[#922235]/25 cursor-pointer'
                }`}
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang tải video {uploadProgress}%...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Lưu thông tin</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
