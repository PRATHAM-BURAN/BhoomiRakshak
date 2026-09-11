// BhoomiRakshak Image Processing & Resolution Utility

/**
 * Compresses and converts an image file into an optimized Base64 Data URL
 * to guarantee permanent, self-contained persistence in Supabase/PostgreSQL.
 * 
 * @param {File|Blob} file - The raw input file from camera or file picker
 * @param {number} maxWidth - Maximum width in pixels (default 1024)
 * @param {number} maxHeight - Maximum height in pixels (default 1024)
 * @param {number} quality - JPEG compression quality 0.0 to 1.0 (default 0.82)
 * @returns {Promise<string>} Base64 Data URL
 */
export async function compressImageToDataUrl(file, maxWidth = 1024, maxHeight = 1024, quality = 0.82) {
  if (!file) return null;

  return new Promise((resolve) => {
    // Failsafe timeout: under NO circumstance wait more than 2.5 seconds
    const timer = setTimeout(() => {
      console.warn('[IMAGE COMPRESS] Timeout fallback triggered');
      try {
        const fallbackReader = new FileReader();
        fallbackReader.onload = () => resolve(fallbackReader.result);
        fallbackReader.onerror = () => resolve(null);
        fallbackReader.readAsDataURL(file);
      } catch {
        resolve(null);
      }
    }, 2500);

    try {
      // If not an image, just read as data URL
      if (!file.type || !file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          clearTimeout(timer);
          resolve(reader.result);
        };
        reader.onerror = () => {
          clearTimeout(timer);
          resolve(null);
        };
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const img = new Image();
          img.onload = () => {
            clearTimeout(timer);
            try {
              let width = img.width || 800;
              let height = img.height || 600;

              // Calculate scaled dimensions keeping aspect ratio
              if (width > height) {
                if (width > maxWidth) {
                  height = Math.round((height * maxWidth) / width);
                  width = maxWidth;
                }
              } else {
                if (height > maxHeight) {
                  width = Math.round((width * maxHeight) / height);
                  height = maxHeight;
                }
              }

              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;

              const ctx = canvas.getContext('2d');
              if (!ctx) {
                resolve(e.target.result);
                return;
              }

              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0, width, height);

              const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
              const dataUrl = canvas.toDataURL(mimeType, quality);
              resolve(dataUrl);
            } catch {
              resolve(e.target.result);
            }
          };

          img.onerror = () => {
            clearTimeout(timer);
            resolve(e.target.result);
          };

          img.src = e.target.result;
        } catch {
          clearTimeout(timer);
          resolve(e.target.result);
        }
      };

      reader.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };

      reader.readAsDataURL(file);
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/**
 * Resolves a stored media_url into a reliable displayable browser URL.
 * Handles:
 * 1. Base64 Data URLs (data:image/...) -> Instant direct display
 * 2. Remote Cloud URLs (https://...) -> Direct display
 * 3. Relative server uploads (/uploads/...) -> Resolves to backend origin
 * 
 * @param {string} url - The stored media_url
 * @returns {string} Fully-qualified browser image URL
 */
export function resolveMediaUrl(url) {
  if (!url || typeof url !== 'string') return '';

  const clean = url.trim();
  if (clean.startsWith('data:') || clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('blob:')) {
    return clean;
  }

  // Handle /uploads/ paths
  if (clean.startsWith('/uploads/')) {
    const customApi = import.meta.env.VITE_API_URL;
    if (customApi && customApi.startsWith('http')) {
      const origin = customApi.replace(/\/api\/?$/, '');
      return `${origin}${clean}`;
    }

    // In local dev with Vite proxy or Express on 5000:
    if (typeof window !== 'undefined') {
      const port = window.location.port;
      // If dev server on 3000, Vite proxies /uploads to :5000
      if (port === '3000' || port === '5173') {
        return clean;
      }
      return `${window.location.origin}${clean}`;
    }
  }

  return clean;
}
