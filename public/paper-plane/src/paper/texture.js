// 程序化贴图：相纸印花、纤维法线/粗糙、折痕图、木纹、墙面、窗外、环境球、接触阴影
import * as THREE from 'three';
import { fbm, hash2, makeRng } from '../rng.js';

const FONT_SERIF = 'Georgia, "Iowan Old Style", "Times New Roman", serif';

// read=true 的画布允许 CPU 回读（getImageData），会退回软件绘制；
// 只画不读的画布不要开这个标记，否则上传 GPU 前要先从 CPU 端拷一次，
// 1024 的景片实测多花 200~2000ms
function canvas2d(w, h, read = false) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', read ? { willReadFrequently: true } : undefined);
  return { c, ctx };
}

function noiseTile(size, seed) {
  const { c, ctx } = canvas2d(size, size);
  const img = ctx.createImageData(size, size);
  const rng = makeRng(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + rng.next() * 80;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// 铺满模式的取景：横图按高度铺满之后纵向没有余量，照片顶端（天空）落在纸的
// 机头端。机头是面积最大、最正对镜头的一片，于是成品中间是一块纯蓝天——看着
// 像「没印上」。整张照片铺满时天空占纸面 58%；这里放大一点、底边对齐，裁掉
// 顶部那段空天，天空降到纸面约 50%，森林和湖落到两翼上。
//
// 注意这块天空去不干净：机头折片在纸面 y 119–210mm，天空要整个让开得放大到
// 2.4 倍，那时只剩照片底部 9% 的画面、分辨率也撑不住。所以 1.19 是「多给前景」
// 和「别把照片裁没」之间的折中，机头仍会吃到一小片天空。
const COVER_ZOOM = 1.19;

function drawContained(ctx, img, x, y, w, h, mode) {
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const base = mode === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
  const scale = base * (mode === 'cover' ? COVER_ZOOM : 1);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (mode !== 'cover') {
    // 只留白边的话，折完之后露出的面几乎全是空白纸：先用同一张照片
    // 铺满整块印区（模糊压暗）当底，再把完整照片清晰地叠在中间
    const coverScale = Math.max(w / iw, h / ih);
    if ('filter' in ctx) ctx.filter = 'blur(26px) saturate(0.9) brightness(0.9)';
    ctx.drawImage(
      img,
      x + (w - iw * coverScale) / 2,
      y + (h - ih * coverScale) / 2,
      iw * coverScale,
      ih * coverScale
    );
    if ('filter' in ctx) ctx.filter = 'none';
  }
  // cover 底对齐（配合上面的放大，等于裁掉照片顶部一段）；contain 居中
  ctx.drawImage(
    img,
    x + (w - dw) / 2,
    mode === 'cover' ? y + (h - dh) : y + (h - dh) / 2,
    dw,
    dh
  );
  ctx.restore();
}

function drawFallbackPhoto(ctx, x, y, w, h, seed = 7) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  const sky = ctx.createLinearGradient(x, y, x, y + h * 0.66);
  sky.addColorStop(0, '#8fa9c0');
  sky.addColorStop(0.45, '#c9c0ae');
  sky.addColorStop(1, '#e8cba2');
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);

  // 低太阳
  const sx = x + w * 0.68;
  const sy = y + h * 0.42;
  const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, w * 0.42);
  glow.addColorStop(0, 'rgba(255,244,214,0.95)');
  glow.addColorStop(0.18, 'rgba(255,220,160,0.55)');
  glow.addColorStop(1, 'rgba(255,210,150,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);

  // 远山两层
  const ridge = (base, amp, color, phase) => {
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    for (let i = 0; i <= 90; i++) {
      const t = i / 90;
      const px = x + t * w;
      const n = fbm(t * 3.1 + phase, phase * 1.7, 3, seed);
      const py = y + h * base - (n - 0.5) * h * amp;
      ctx.lineTo(px, py);
    }
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  ridge(0.58, 0.20, 'rgba(120,126,120,0.78)', 1.3);
  ridge(0.66, 0.13, 'rgba(86,96,88,0.9)', 4.1);

  // 水面
  const water = ctx.createLinearGradient(x, y + h * 0.7, x, y + h);
  water.addColorStop(0, '#b9a488');
  water.addColorStop(0.5, '#8e8272');
  water.addColorStop(1, '#5d6159');
  ctx.fillStyle = water;
  ctx.fillRect(x, y + h * 0.7, w, h * 0.3);

  // 水面反光条
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 26; i++) {
    const t = i / 26;
    const wy = y + h * (0.72 + t * 0.26);
    const wx = sx - w * (0.04 + t * 0.12) + (hash2(i, 3, seed) - 0.5) * w * 0.1;
    ctx.fillStyle = `rgba(255,226,180,${0.35 * (1 - t)})`;
    ctx.fillRect(wx, wy, w * (0.05 + hash2(i, 9, seed) * 0.16), Math.max(1, h * 0.004));
  }
  ctx.globalAlpha = 1;

  // 前景芦苇剪影
  ctx.strokeStyle = 'rgba(48,44,36,0.85)';
  for (let i = 0; i < 22; i++) {
    const rx = x + hash2(i, 11, seed) * w;
    const rh = h * (0.12 + hash2(i, 12, seed) * 0.22);
    ctx.lineWidth = 1.6 + hash2(i, 13, seed) * 2.4;
    ctx.beginPath();
    ctx.moveTo(rx, y + h);
    ctx.quadraticCurveTo(rx + (hash2(i, 14, seed) - 0.5) * 30, y + h - rh * 0.6, rx + (hash2(i, 15, seed) - 0.5) * 55, y + h - rh);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * 相纸印花：A5 相纸比例。
 * cover = 满幅印到纸边（无白边、无标题带）；contain = 相纸白边 + 底部标题带。
 */
export function makePrintCanvas(image, mode = 'contain', seed = 17) {
  const W = 1024;
  const H = 1448;
  const { c, ctx } = canvas2d(W, H);

  ctx.fillStyle = '#fbf7ec';
  ctx.fillRect(0, 0, W, H);

  // 铺满模式必须真的印到纸边。留白边时折完翼的外缘会挂一圈奶白细边——
  // 成品看上去像「照片没印到纸边」；底部那条 16mm 标题带更糟，它正好落在
  // 翼的后缘，字被折线切成半截（A MOMENT, FOLDED → A MODEL）。
  // 所以 cover = 满幅无白边、不印标题；contain 才保留相纸白边与标题带。
  const bleed = mode === 'cover';
  const px = bleed ? 0 : 26;
  const py = bleed ? 0 : 26;
  const pw = W - px * 2;
  const ph = bleed ? H : 1310;

  if (image) {
    drawContained(ctx, image, px, py, pw, ph, mode);
  } else {
    drawFallbackPhoto(ctx, px, py, pw, ph, seed);
  }

  if (!bleed) {
    // 相片外沿一条极细的压痕
    ctx.strokeStyle = 'rgba(120,110,96,0.28)';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);

    // 底部文字（压在窄条里，不抢纸面）
    ctx.fillStyle = '#5f574b';
    ctx.textAlign = 'center';
    ctx.font = `22px ${FONT_SERIF}`;
    ctx.fillText('A  M O M E N T ,  F O L D E D', W / 2, 1380);
    ctx.fillStyle = 'rgba(110,100,86,0.72)';
    ctx.font = `16px ${FONT_SERIF}`;
    ctx.fillText('PAPER STUDY  ·  2026', W / 2, 1416);
  }

  // 印刷颗粒（叠加低透明度噪声）
  const tile = noiseTile(256, 91);
  const pat = ctx.createPattern(tile, 'repeat');
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // 纸面轻微暗角（印花本身的光照不均）
  const vg = ctx.createRadialGradient(W / 2, H * 0.46, H * 0.18, W / 2, H * 0.5, H * 0.78);
  vg.addColorStop(0, 'rgba(255,255,255,0)');
  vg.addColorStop(1, 'rgba(120,104,82,0.14)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  return c;
}

export function makePrintTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // 斜视翼面上的印花（尤其是底部那行字和照片边框）会碎成一串白点，
  // 各向异性拉满才能压住
  tex.anisotropy = 16;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 纸纤维法线 + 粗糙度。带一点拉长的纤维走向，避免均匀噪声的塑料感。
 */
export function makePaperFiber() {
  const S = 512;
  const raw = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const broad = fbm(x / 96, y / 96, 4, 11);
      const mid = fbm(x / 22, y / 22, 4, 23);
      const fiber = fbm(x / 6, y / 190, 3, 37);
      const fine = fbm(x / 3.2, y / 3.2, 2, 53);
      raw[y * S + x] =
        0.42 * broad + 0.28 * mid + 0.18 * fiber + 0.12 * fine;
    }
  }
  // 3x3 模糊：value noise 的轴对齐格点会在斜视角下显成布纹网格，先糊掉格线
  const height = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let acc = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          acc += raw[((y + j + S) % S) * S + ((x + i + S) % S)];
        }
      }
      height[y * S + x] = acc / 9;
    }
  }

  const { c: nc, ctx: nctx } = canvas2d(S, S);
  const nimg = nctx.createImageData(S, S);
  const { c: rc, ctx: rctx } = canvas2d(S, S);
  const rimg = rctx.createImageData(S, S);
  const strength = 7;

  const hAt = (x, y) => height[((y + S) % S) * S + ((x + S) % S)];

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const dx = (hAt(x - 1, y) - hAt(x + 1, y)) * strength;
      const dy = (hAt(x, y - 1) - hAt(x, y + 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const nx = dx / len;
      const ny = dy / len;
      const nz = 1 / len;
      nimg.data[i] = (nx * 0.5 + 0.5) * 255;
      nimg.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      nimg.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      nimg.data[i + 3] = 255;

      const h = height[y * S + x];
      const r = Math.min(1, Math.max(0, 0.84 + (h - 0.5) * 0.12));
      const v = r * 255;
      rimg.data[i] = v;
      rimg.data[i + 1] = v;
      rimg.data[i + 2] = v;
      rimg.data[i + 3] = 255;
    }
  }
  nctx.putImageData(nimg, 0, 0);
  rctx.putImageData(rimg, 0, 0);

  const normalMap = new THREE.CanvasTexture(nc);
  const roughnessMap = new THREE.CanvasTexture(rc);
  for (const t of [normalMap, roughnessMap]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(9, 12.6);
    t.anisotropy = 4;
  }
  return { normalMap, roughnessMap };
}

/**
 * 折痕图：UV 空间里的折线，画成柔和白线；返回 CPU 采样器（用于顶点压暗）。
 * 只画不挂：消费方是 buildPaperData 的逐顶点查询，没有材质需要这张图，
 * 所以不建 CanvasTexture（省掉一张常驻 GPU 的 512×1024 贴图）。
 */
export function makeCreaseMap(paper, wingX = 0.013) {
  const W = 512;
  const H = 1024;
  const { ctx } = canvas2d(W, H, true);
  const { W: pw, H: ph } = paper;
  const u = (x) => (x / pw + 0.5) * W;
  const v = (y) => (1 - y / ph) * H;
  const hw = pw / 2;
  const noseY = ph - hw;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const lines = [
    [[0, ph], [-hw, noseY]],
    [[0, ph], [hw, noseY]],
    [[-pw, noseY], [pw, noseY]],
    [[0, noseY], [-hw, ph - pw]],
    [[0, noseY], [hw, ph - pw]],
    [[0, -0.1], [0, ph + 0.1]],
    [[-wingX, -0.1], [-wingX, ph + 0.1]],
    [[wingX, -0.1], [wingX, ph + 0.1]],
  ];

  ctx.save();
  if ('filter' in ctx) ctx.filter = 'blur(4px)';
  for (const [a, b] of lines) {
    ctx.lineWidth = 9;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(u(a[0]), v(a[1]));
    ctx.lineTo(u(b[0]), v(b[1]));
    ctx.stroke();
  }
  ctx.restore();

  for (const [a, b] of lines) {
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(u(a[0]), v(a[1]));
    ctx.lineTo(u(b[0]), v(b[1]));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const data = ctx.getImageData(0, 0, W, H).data;
  const sample = (px, py) => {
    const x = Math.min(W - 1, Math.max(0, px | 0));
    const y = Math.min(H - 1, Math.max(0, py | 0));
    return data[(y * W + x) * 4] / 255;
  };
  const at = (uu, vv) => {
    const px = uu * (W - 1);
    const py = (1 - vv) * (H - 1);
    const x = Math.round(px);
    const y = Math.round(py);
    let m = 0;
    for (let oy = -2; oy <= 2; oy++) {
      for (let ox = -2; ox <= 2; ox++) {
        const s = sample(x + ox, y + oy);
        if (s > m) m = s;
      }
    }
    return m;
  };

  return { at };
}

/**
 * 木桌面：板缝 + 纹理 + 结疤，同时输出颜色与粗糙度。
 */
// 桌面木料三套：书桌是原来那版暖橡木，海边是晒白了的浮木，黄昏是深胡桃。
// 参数按通道拆开，desk 一栏必须与旧实现的常数逐项一致（否则默认主题会悄悄变色）
const WOOD_STYLES = {
  desk: {
    seed: 4409,
    planks: 6,
    base: [190, 151, 110],
    broad: [24, 18, 13],
    grain: [26, 20, 14],
    knot: [74, 50, 32],
    seam: [0.74, 0.7, 0.68],
    hue: 12,
    rough: 0.52,
    roughGrain: 0.2,
    roughBroad: 0.08,
  },
  // 海边的浮木：晒过太阳的灰木，比书桌那张更浅更冷、板更宽（4 块），
  // 木纹的明暗幅度要大：浅色木头在强光下没有高频纹理就是一整片平灰
  coast: {
    seed: 5501,
    planks: 4,
    base: [166, 154, 138],
    broad: [40, 36, 31],
    grain: [52, 46, 40],
    knot: [104, 92, 78],
    seam: [0.52, 0.53, 0.52],
    hue: 5,
    rough: 0.7,
    roughGrain: 0.24,
    roughBroad: 0.09,
  },
  // 黄昏的胡桃木：比书桌深两档、红一档，板窄（5 块），木纹更细更密
  dusk: {
    seed: 6607,
    planks: 5,
    base: [94, 68, 52],
    broad: [22, 15, 10],
    grain: [32, 23, 16],
    knot: [46, 28, 18],
    seam: [0.6, 0.56, 0.52],
    hue: 10,
    rough: 0.42,
    roughGrain: 0.26,
    roughBroad: 0.11,
  },
};

const woodCache = new Map();

export function makeWoodTextures(variant = 'desk') {
  const key = WOOD_STYLES[variant] ? variant : 'desk';
  if (woodCache.has(key)) return woodCache.get(key);
  const S = WOOD_STYLES[key];
  const W = 1024;
  const H = 512;
  const { c: cc, ctx: cctx } = canvas2d(W, H);
  const { c: rc, ctx: rctx } = canvas2d(W, H);
  const cimg = cctx.createImageData(W, H);
  const rimg = rctx.createImageData(W, H);
  const planks = S.planks || 6;
  const plankH = H / planks;
  const rng = makeRng(S.seed);
  const plankHue = Array.from({ length: planks }, () => rng.range(-S.hue, S.hue));
  const knot = { x: W * 0.31, y: H * 0.62, r: 26 };

  for (let y = 0; y < H; y++) {
    const pi = Math.min(planks - 1, Math.floor(y / plankH));
    const local = (y - pi * plankH) / plankH;
    const seam = Math.min(local, 1 - local) < 0.012 ? 1 : 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const warp = fbm(x / 260, y / 14 + pi * 7.2, 3, 5) - 0.5;
      const grain = fbm(x / 42 + warp * 1.7, y / 5.5 + pi * 3.1, 4, 9);
      const broad = fbm(x / 340, y / 150, 3, 15);
      let r = S.base[0] + broad * S.broad[0] + grain * S.grain[0] + plankHue[pi];
      let g = S.base[1] + broad * S.broad[1] + grain * S.grain[1] + plankHue[pi] * 0.8;
      let b = S.base[2] + broad * S.broad[2] + grain * S.grain[2] + plankHue[pi] * 0.6;

      const kd = Math.hypot((x - knot.x) * 1.0, (y - knot.y) * 2.3);
      if (kd < knot.r) {
        const t = 1 - kd / knot.r;
        r = r * (1 - t * 0.5) + S.knot[0] * t * 0.5;
        g = g * (1 - t * 0.5) + S.knot[1] * t * 0.5;
        b = b * (1 - t * 0.5) + S.knot[2] * t * 0.5;
      }

      if (seam) {
        r *= S.seam[0];
        g *= S.seam[1];
        b *= S.seam[2];
      }

      cimg.data[i] = Math.min(255, r);
      cimg.data[i + 1] = Math.min(255, g);
      cimg.data[i + 2] = Math.min(255, b);
      cimg.data[i + 3] = 255;

      const rough = Math.min(1, Math.max(0, S.rough + (1 - grain) * S.roughGrain + seam * 0.28 - broad * S.roughBroad));
      const rv = rough * 255;
      rimg.data[i] = rv;
      rimg.data[i + 1] = rv;
      rimg.data[i + 2] = rv;
      rimg.data[i + 3] = 255;
    }
  }
  cctx.putImageData(cimg, 0, 0);
  rctx.putImageData(rimg, 0, 0);

  const map = new THREE.CanvasTexture(cc);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1.6, 1.6);
  map.anisotropy = 8;

  const roughnessMap = new THREE.CanvasTexture(rc);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(1.6, 1.6);

  const out = { map, roughnessMap };
  woodCache.set(key, out);
  return out;
}

export function makePlasterTexture() {
  const S = 512;
  const { c, ctx } = canvas2d(S, S);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const n = fbm(x / 55, y / 55, 4, 71) * 0.7 + fbm(x / 11, y / 11, 3, 83) * 0.3;
      const v = 226 + (n - 0.5) * 22;
      img.data[i] = v;
      img.data[i + 1] = v - 5;
      img.data[i + 2] = v - 14;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

/**
 * 窗外：逆光的树冠层。窗台压得很低，画面里只露一条窄带，
 * 所以内容按「中下部全是树冠、顶部才是天光」来画，
 * 任何高度截出来都读得出是院子里的树。
 */
export function makeOutsideTexture() {
  const W = 1024;
  const H = 1024;
  const { c, ctx } = canvas2d(W, H);
  const rng = makeRng(991);

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#fdf6e2');
  sky.addColorStop(0.26, '#f3ecd2');
  sky.addColorStop(0.5, '#d9ddbd');
  sky.addColorStop(1, '#8fa173');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // 阳光穿过树隙的过曝团
  ctx.save();
  if ('filter' in ctx) ctx.filter = 'blur(60px)';
  for (let i = 0; i < 6; i++) {
    const x = rng.range(W * 0.15, W * 0.85);
    const y = rng.range(-40, H * 0.34);
    const r = rng.range(150, 380);
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,252,236,0.85)');
    grd.addColorStop(1, 'rgba(255,250,230,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 三层树冠：远层偏灰绿、中层饱和、近层压暗，叠出景深
  // 团块按世界尺度定：窗外平面 3m 宽，40px ≈ 12cm，正好是一丛叶子
  const layers = [
    { n: 220, blur: 6, base: [138, 150, 108], y0: 0.18, y1: 0.9, r: [30, 76], a: [0.2, 0.36] },
    { n: 260, blur: 4, base: [92, 118, 66], y0: 0.3, y1: 1.0, r: [20, 56], a: [0.3, 0.55] },
    { n: 200, blur: 2.5, base: [34, 54, 32], y0: 0.48, y1: 1.12, r: [14, 42], a: [0.35, 0.6] },
  ];
  for (const L of layers) {
    ctx.save();
    if ('filter' in ctx) ctx.filter = `blur(${L.blur}px)`;
    for (let i = 0; i < L.n; i++) {
      const x = rng.range(-60, W + 60);
      const y = rng.range(H * L.y0, H * L.y1);
      const r = rng.range(L.r[0], L.r[1]);
      // 上缘被阳光打到，偏黄绿；下缘压暗
      const warm = Math.max(0, 1 - (y - H * L.y0) / (H * 0.5)) * 0.55;
      const rr = Math.round(L.base[0] + warm * 68);
      const gg = Math.round(L.base[1] + warm * 52);
      const bb = Math.round(L.base[2] + warm * 24);
      ctx.fillStyle = `rgba(${rr},${gg},${bb},${rng.range(L.a[0], L.a[1]).toFixed(2)})`;
      ctx.beginPath();
      ctx.ellipse(x, y, r * rng.range(0.8, 1.35), r * rng.range(0.7, 1.1), rng.range(0, Math.PI), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 树隙漏下的天光：让树冠不是一整片绿
  ctx.save();
  if ('filter' in ctx) ctx.filter = 'blur(10px)';
  for (let i = 0; i < 14; i++) {
    const x = rng.range(W * 0.05, W * 0.95);
    const y = rng.range(H * 0.34, H * 0.78);
    const r = rng.range(22, 62);
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(250,250,228,${rng.range(0.5, 0.8).toFixed(2)})`);
    grd.addColorStop(1, 'rgba(250,250,228,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 树干：近层虚化的竖线
  ctx.save();
  if ('filter' in ctx) ctx.filter = 'blur(2px)';
  for (let i = 0; i < 16; i++) {
    const x = rng.range(W * 0.02, W * 0.98);
    const w = rng.range(3, 9);
    ctx.fillStyle = `rgba(46,42,34,${rng.range(0.2, 0.38).toFixed(2)})`;
    ctx.fillRect(x, H * rng.range(0.46, 0.72), w, H * 0.55);
  }
  ctx.restore();

  // 最后整体虚化一遍：叶片团块的圆形轮廓太规整，糊掉才像散景
  const { c: soft, ctx: sctx } = canvas2d(W, H);
  if ('filter' in sctx) sctx.filter = 'blur(9px)';
  sctx.drawImage(c, -4, -4, W + 8, H + 8);

  const tex = new THREE.CanvasTexture(soft);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeEnvTexture(kind = 'desk') {
  const W = 1024;
  const H = 512;
  const { c, ctx } = canvas2d(W, H);
  const img = ctx.createImageData(W, H);

  // 三套基调共用一条「上天下地」的球：只换色值曲线，结构不动。
  // desk 是原来的暖白房间；coast 偏冷白 + 沙木；dusk 是橙紫晚霞压暗地面。
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      let r;
      let g;
      let b;
      if (kind === 'coast') {
        if (v < 0.5) {
          const t = v / 0.5;
          r = 214 + 26 * t;
          g = 234 + 12 * t;
          b = 245 - 4 * t;
        } else {
          const t = (v - 0.5) / 0.5;
          r = 226 - 88 * t;
          g = 224 - 80 * t;
          b = 214 - 66 * t;
        }
      } else if (kind === 'dusk') {
        if (v < 0.5) {
          const t = v / 0.5;
          r = 150 + 108 * t;
          g = 108 + 66 * t;
          b = 146 - 26 * t;
        } else {
          const t = (v - 0.5) / 0.5;
          r = 104 - 62 * t;
          g = 78 - 44 * t;
          b = 76 - 42 * t;
        }
      } else if (v < 0.5) {
        const t = v / 0.5;
        r = 250 - 26 * t;
        g = 240 - 34 * t;
        b = 222 - 42 * t;
      } else {
        const t = (v - 0.5) / 0.5;
        r = 224 - 128 * t;
        g = 206 - 118 * t;
        b = 180 - 108 * t;
      }
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // 窗口方向（-x 对应 u≈0/1）的强光，以及侧墙的反光
  const look =
    kind === 'coast'
      ? { warm0: 'rgba(236,248,255,0.92)', warm1: 'rgba(214,236,246,0)',
          win0: 'rgba(252,255,255,1)', win1: 'rgba(238,250,255,0)',
          tint0: 'rgba(122,172,190,0.5)', tint1: 'rgba(122,172,190,0)' }
      : kind === 'dusk'
        ? { warm0: 'rgba(255,206,148,0.95)', warm1: 'rgba(232,150,110,0)',
            win0: 'rgba(255,236,206,1)', win1: 'rgba(255,196,140,0)',
            tint0: 'rgba(206,124,104,0.5)', tint1: 'rgba(206,124,104,0)' }
        : { warm0: 'rgba(255,246,224,0.95)', warm1: 'rgba(255,236,198,0)',
            win0: 'rgba(255,252,240,1)', win1: 'rgba(255,246,220,0)',
            tint0: 'rgba(150,176,112,0.5)', tint1: 'rgba(150,176,112,0)' };

  const warm = ctx.createLinearGradient(0, 0, W * 0.3, H);
  warm.addColorStop(0, look.warm0);
  warm.addColorStop(1, look.warm1);
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, W * 0.32, H);

  ctx.save();
  if ('filter' in ctx) ctx.filter = 'blur(38px)';
  const win = ctx.createRadialGradient(W * 0.02, H * 0.42, 10, W * 0.02, H * 0.42, W * 0.26);
  win.addColorStop(0, look.win0);
  win.addColorStop(1, look.win1);
  ctx.fillStyle = win;
  ctx.fillRect(0, 0, W * 0.42, H);

  const green = ctx.createRadialGradient(W * 0.16, H * 0.58, 8, W * 0.16, H * 0.58, W * 0.2);
  green.addColorStop(0, look.tint0);
  green.addColorStop(1, look.tint1);
  ctx.fillStyle = green;
  ctx.fillRect(0, 0, W * 0.4, H);
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function makeContactShadow() {
  const S = 256;
  const { c, ctx } = canvas2d(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.52)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.26)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}
