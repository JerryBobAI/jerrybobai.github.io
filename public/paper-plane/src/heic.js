// HEIC/HEIF 上传：Safari 原生能解，Chrome/Edge/Firefox 不能。
// 兜底用 heic2any（MIT，BSD 风格的 wasm 封装）先转 JPEG。整个解码器 1.3MB，
// 只在原生读失败、且确认文件真是 HEIF 时才按需加载——普通 JPEG 上传零成本。

const HEIF_BRANDS = new Set([
  'heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs',
  'mif1', 'msf1', 'miaf',
]);

let decoderPromise = null;

function loadDecoder() {
  if (decoderPromise) return decoderPromise;
  decoderPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/heic2any.min.js';
    s.onload = () => (window.heic2any ? resolve(window.heic2any) : reject(new Error('heic2any missing')));
    s.onerror = () => reject(new Error('heic2any load failed'));
    document.head.appendChild(s);
  });
  // 加载失败别把失败的 Promise 缓存住，换一张照片还能重试
  decoderPromise.catch(() => { decoderPromise = null; });
  return decoderPromise;
}

/** 按扩展名/MIME 先粗判，避免为一张坏 JPEG 白拉 1.3MB */
export function looksLikeHeif(file) {
  const name = (file.name || '').toLowerCase();
  if (/\.(heic|heif)$/.test(name)) return true;
  const type = (file.type || '').toLowerCase();
  return type === 'image/heic' || type === 'image/heif' || type === 'image/heic-sequence';
}

/** 拖进来/改扩展名的文件按魔数认：ISO BMFF 的 ftyp box，brand 在偏移 8 */
export async function isHeifByMagic(file) {
  try {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (head.length < 12) return false;
    const tag = String.fromCharCode(head[4], head[5], head[6], head[7]);
    if (tag !== 'ftyp') return false;
    const brand = String.fromCharCode(head[8], head[9], head[10], head[11]);
    return HEIF_BRANDS.has(brand);
  } catch {
    return false;
  }
}

/** HEIC → JPEG Blob。多图（连拍/景深）时 heic2any 返回数组，取第一张主图 */
export async function decodeHeif(file) {
  const heic2any = await loadDecoder();
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  return Array.isArray(out) ? out[0] : out;
}

export function loadImageBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const el = new Image();
    el.onload = () => {
      URL.revokeObjectURL(url);
      resolve(el);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image decode failed'));
    };
    el.src = url;
  });
}
