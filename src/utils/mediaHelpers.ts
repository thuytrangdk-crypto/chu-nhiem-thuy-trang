/**
 * Media helpers for Board Notices (Images, Videos, Links)
 */

export const sanitizeUrl = (rawUrl: string): string => {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

export const getYouTubeEmbedUrl = (url: string): string | null => {
  if (!url) return null;
  const clean = sanitizeUrl(url);

  // youtu.be/<id>
  const shortMatch = clean.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
  if (shortMatch && shortMatch[1]) {
    return `https://www.youtube-nocookie.com/embed/${shortMatch[1]}`;
  }

  // youtube.com/watch?v=<id>
  const watchMatch = clean.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
  if (watchMatch && watchMatch[1]) {
    return `https://www.youtube-nocookie.com/embed/${watchMatch[1]}`;
  }

  // youtube.com/shorts/<id>
  const shortsMatch = clean.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i);
  if (shortsMatch && shortsMatch[1]) {
    return `https://www.youtube-nocookie.com/embed/${shortsMatch[1]}`;
  }

  // youtube.com/embed/<id>
  const embedMatch = clean.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i);
  if (embedMatch && embedMatch[1]) {
    return `https://www.youtube-nocookie.com/embed/${embedMatch[1]}`;
  }

  return null;
};

export const getGoogleDriveVideoEmbed = (url: string): string | null => {
  if (!url) return null;
  const clean = sanitizeUrl(url);
  // drive.google.com/file/d/<id>/view...
  const match = clean.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) {
    return `https://drive.google.com/file/d/${match[1]}/preview`;
  }
  return null;
};

export const isDirectVideoFile = (url: string): boolean => {
  if (!url) return false;
  const clean = sanitizeUrl(url);
  const lower = clean.toLowerCase().split('?')[0].split('#')[0];
  return (
    lower.endsWith('.mp4') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.ogg') ||
    lower.endsWith('.mov') ||
    lower.endsWith('.m4v') ||
    lower.endsWith('.mkv') ||
    lower.endsWith('.avi') ||
    lower.includes('/storage/v1/object/public/board_videos/') ||
    clean.startsWith('data:video/') ||
    clean.startsWith('blob:')
  );
};

export interface VideoFormatCheck {
  isCompatible: boolean;
  formatName: string;
  warning?: string;
  isRecommended: boolean;
}

export const checkVideoFormatCompatibility = (fileNameOrMime: string): VideoFormatCheck => {
  const lower = (fileNameOrMime || '').toLowerCase();

  if (lower.endsWith('.mp4') || lower === 'video/mp4') {
    return {
      isCompatible: true,
      isRecommended: true,
      formatName: 'MP4 (Chuẩn Web)',
    };
  }

  if (lower.endsWith('.webm') || lower === 'video/webm') {
    return {
      isCompatible: true,
      isRecommended: true,
      formatName: 'WebM',
    };
  }

  if (lower.endsWith('.mov') || lower === 'video/quicktime') {
    return {
      isCompatible: true,
      isRecommended: false,
      formatName: 'Apple QuickTime (.MOV)',
      warning:
        'Tệp quay từ iPhone/iPad (.mov). Có thể không phát mượt trên một số máy tính Windows hoặc Android cũ. Khuyên dùng tệp .mp4 để phụ huynh xem được trên mọi thiết bị.',
    };
  }

  if (lower.endsWith('.ogg') || lower === 'video/ogg') {
    return {
      isCompatible: true,
      isRecommended: true,
      formatName: 'OGG Video',
    };
  }

  if (lower.endsWith('.m4v')) {
    return {
      isCompatible: true,
      isRecommended: true,
      formatName: 'M4V',
    };
  }

  const ext = fileNameOrMime.split('.').pop()?.toUpperCase() || 'Khác';
  return {
    isCompatible: false,
    isRecommended: false,
    formatName: ext,
    warning: `Định dạng ${ext} thường không được trình duyệt web hỗ trợ phát trực tiếp. Video có thể không xem được trên điện thoại hoặc máy tính. Bạn nên chuyển đổi sang MP4 (H.264) trước khi tải lên.`,
  };
};

export const extractDomain = (url: string): string => {
  try {
    const parsed = new URL(sanitizeUrl(url));
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

