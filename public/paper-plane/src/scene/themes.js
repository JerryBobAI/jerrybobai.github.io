// 背景主题：一套背景 = 窗外景片 + 天光 + 墙面 + 桌面 + 环境反射
// desk 沿用原来的绿意窗外；coast / dusk 是新增的两套景片（懒生成 + 缓存）
import * as THREE from 'three';
import { makeRng } from '../rng.js';
import { makeOutsideTexture as makeDeskOutside } from '../paper/texture.js';

export const THEMES = {
  desk: {
    id: 'desk',
    label: '窗边书桌',
    hint: '午后 · 树影',
    swatch: ['#f6efd8', '#a9b889', '#55663f'],
    background: 0xe8dcc6,
    wall: 0xf2ecdf,
    deskTint: 0xffffff,
    wood: 'desk',
    props: 'desk',
    floor: 0x7a5c44,
    frame: 0xefe8da,
    sun: { color: 0xffedd6, intensity: 2.7, pos: [-0.1, 1.35, -1.6] },
    hemi: { sky: 0xfff2dc, ground: 0x6b4f3a, intensity: 0.5 },
    fill: { color: 0xfff0db, intensity: 0.45 },
    deskEnv: 0.5,
    wallEnv: 0.35,
    patch: 0xffffff,
    dust: 1,
    dustColor: [1.0, 0.93, 0.82],
  },
  coast: {
    id: 'coast',
    label: '海边',
    hint: '海风 · 正午',
    swatch: ['#e4eee9', '#a8b8ad', '#3d6f6c'],
    background: 0xc9dde1,
    // 海边整套偏冷：墙压成冷灰绿、桌面刷一层冷光，晒白的浮木才不会又读成暖橡木
    wall: 0xd5e2dd,
    deskTint: 0xe6eeee,
    wood: 'coast',
    props: 'coast',
    floor: 0x8a8072,
    frame: 0xe9efe9,
    // 正午海边的光很硬：直射强、天空补光低。之前补光给太多，
    // 阴影被填平，整张画面挤在 0.47-0.85 一段灰白里，读起来像起了雾
    sun: { color: 0xfff4e2, intensity: 2.45, pos: [-0.35, 1.5, -1.7] },
    hemi: { sky: 0xdceeff, ground: 0x6b6252, intensity: 0.3 },
    fill: { color: 0xd6e6f2, intensity: 0.18 },
    deskEnv: 0.2,
    wallEnv: 0.14,
    patch: 0xf3f8ff,
    dust: 0.5,
    dustColor: [0.93, 0.97, 1.0],
  },
  dusk: {
    id: 'dusk',
    label: '黄昏',
    hint: '落日 · 长影',
    swatch: ['#f6d3a0', '#d8895f', '#5d4157'],
    background: 0x5c3f3a,
    // 黄昏的墙压暖压深一档，桌面刷一层夕阳色，深胡桃木的暖调才立得住
    wall: 0xdfc9b2,
    deskTint: 0xffe6d0,
    wood: 'dusk',
    props: 'dusk',
    floor: 0x3b2a22,
    frame: 0x9c7a54,
    sun: { color: 0xffcf9a, intensity: 3.4, pos: [-0.3, 1.0, -1.8] },
    hemi: { sky: 0xffd9b0, ground: 0x4f3a33, intensity: 0.58 },
    fill: { color: 0xffd9b4, intensity: 0.38 },
    deskEnv: 0.55,
    wallEnv: 0.32,
    patch: 0xffcf96,
    dust: 1.15,
    dustColor: [1.0, 0.8, 0.58],
  },
};

export const THEME_ORDER = ['desk', 'coast', 'dusk'];

// 景片只画不读：不要开 willReadFrequently。开了之后画布退回 CPU 端，
// 上传到 GPU 要先整张拷一遍，切背景时会在点击那一帧卡 200ms 以上
function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d') };
}

// 海边：远处水平线落在窗洞中部，海面往下压深，地平线上一道太阳反光
function makeCoastOutside() {
  const W = 1024;
  const H = 1024;
  const { c, ctx } = canvas2d(W, H);
  const rng = makeRng(1403);
  // 窗外实际只露出 u≈0.17–0.51、canvasY≈0.60–0.76 的一条横带（低机位斜看窗外）。
  // 之前地平线压在 0.70，露出来的全是天空最亮的那段 + 海面最浅的一段，
  // 整块窗口读成一片白雾。现在把水平线提到 0.60，让窗口里填满有明暗的海面。
  const horizon = H * 0.652;

  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#4f92c4');
  sky.addColorStop(0.55, '#8bbcd8');
  sky.addColorStop(0.85, '#bcdae6');
  sky.addColorStop(1, '#d3e6ec');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon);

  // 云：低饱和的横向云团，越靠近地平线越薄
  ctx.save();
  if ('filter' in ctx) ctx.filter = 'blur(26px)';
  for (let i = 0; i < 16; i++) {
    const x = rng.range(-80, W + 80);
    const y = rng.range(H * 0.2, horizon * 0.9);
    const rx = rng.range(70, 240);
    const ry = rng.range(14, 42);
    ctx.fillStyle = `rgba(255,255,255,${rng.range(0.2, 0.5).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 海面：贴着水平线是一道浅青，往下迅速压到深藏青。
  // 窗外可见的那一段正好落在 0.60–0.76，梯度要在这一段给出够宽的明暗跨度
  const sea = ctx.createLinearGradient(0, horizon, 0, H);
  sea.addColorStop(0, '#a8cbd0');
  sea.addColorStop(0.03, '#4f8b98');
  sea.addColorStop(0.12, '#2d6b7d');
  sea.addColorStop(0.35, '#1e5163');
  sea.addColorStop(0.7, '#153c4c');
  sea.addColorStop(1, '#0e2b38');
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizon, W, H - horizon);

  // 地平线：远岸与水面交界处压一条深线，窗口里才有「线」可读
  ctx.fillStyle = 'rgba(58,86,92,0.5)';
  ctx.fillRect(0, horizon - 1, W, 2.5);

  // 太阳反光：竖直亮带，近处铺开
  ctx.save();
  if ('filter' in ctx) ctx.filter = 'blur(18px)';
  const sunX = W * 0.31;
  const beam = ctx.createLinearGradient(0, horizon, 0, H);
  beam.addColorStop(0, 'rgba(255,252,238,0.5)');
  beam.addColorStop(0.25, 'rgba(255,248,226,0.22)');
  beam.addColorStop(1, 'rgba(255,246,220,0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(sunX - 44, horizon);
  ctx.lineTo(sunX + 44, horizon);
  ctx.lineTo(sunX + 180, H);
  ctx.lineTo(sunX - 180, H);
  ctx.closePath();
  ctx.fill();

  // 高光碎屑：贴在水面上的短亮横线，密度和亮度都要撑起「水面」的质感
  for (let i = 0; i < 190; i++) {
    const t = rng.next();
    const y = horizon + t * t * (H - horizon) * 0.85;
    const spread = 30 + t * 200;
    const x = sunX + rng.range(-spread, spread);
    const len = 4 + t * 40;
    ctx.fillStyle = `rgba(255,251,238,${(0.62 - t * 0.4).toFixed(2)})`;
    ctx.fillRect(x, y, len, 1.4 + t * 2.4);
  }
  ctx.restore();

  // 波纹：越远越密，近处稀疏而长。亮暗两种笔触交替，水面才有起伏感
  ctx.save();
  for (let i = 0; i < 300; i++) {
    const t = rng.next();
    const y = horizon + t * t * (H - horizon);
    const x = rng.range(-60, W + 60);
    const len = 12 + t * 110;
    const light = rng.next() > 0.45;
    ctx.strokeStyle = light
      ? `rgba(${196 + t * 30},${214 - t * 20},${214 - t * 24},${(0.08 + t * 0.2).toFixed(2)})`
      : `rgba(${22 + t * 20},${48 + t * 20},${58 + t * 18},${(0.1 + t * 0.22).toFixed(2)})`;
    ctx.lineWidth = 0.7 + t * 2.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + rng.range(-2, 2));
    ctx.stroke();
  }
  ctx.restore();

  // 右侧远处一小块礁石岛，给水平线一个落点（u≈0.35 在窗口可见范围内）
  ctx.save();
  if ('filter' in ctx) ctx.filter = 'blur(3px)';
  ctx.fillStyle = 'rgba(44,64,68,0.8)';
  ctx.beginPath();
  ctx.moveTo(W * 0.34, horizon + 2);
  ctx.quadraticCurveTo(W * 0.365, horizon - 20, W * 0.395, horizon + 1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 黄昏：低垂的太阳压在远山脊线上，云带被染成橙紫，适合放飞
function makeDuskOutside() {
  const W = 1024;
  const H = 1024;
  const { c, ctx } = canvas2d(W, H);
  const rng = makeRng(2711);
  // 同海边：地平线与太阳落在窗外可见带（u≈0.23–0.38 / v≈0.66–0.80）
  const horizon = H * 0.72;

  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#4a3a5e');
  sky.addColorStop(0.35, '#8d5a6e');
  sky.addColorStop(0.62, '#cf7f66');
  sky.addColorStop(0.85, '#f2a869');
  sky.addColorStop(1, '#f9c98d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon);

  // 太阳：贴在地平线上方一点，光晕铺开
  const sunX = W * 0.30;
  const sunY = horizon - H * 0.055;
  ctx.save();
  if ('filter' in ctx) ctx.filter = 'blur(30px)';
  const glow = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, W * 0.22);
  glow.addColorStop(0, 'rgba(255,244,214,0.98)');
  glow.addColorStop(0.18, 'rgba(255,224,166,0.6)');
  glow.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, horizon + H * 0.1);
  ctx.restore();

  ctx.fillStyle = 'rgba(255,247,224,0.95)';
  ctx.beginPath();
  ctx.arc(sunX, sunY, W * 0.021, 0, Math.PI * 2);
  ctx.fill();

  // 云带：横向拉长的橙紫色块
  ctx.save();
  if ('filter' in ctx) ctx.filter = 'blur(16px)';
  for (let i = 0; i < 22; i++) {
    const x = rng.range(-100, W + 100);
    const y = rng.range(H * 0.42, horizon * 0.9);
    const rx = rng.range(80, 280);
    const ry = rng.range(5, 20);
    const warm = y > horizon * 0.45;
    ctx.fillStyle = warm
      ? `rgba(255,${Math.round(170 + rng.next() * 50)},${Math.round(120 + rng.next() * 50)},${rng.range(0.16, 0.4).toFixed(2)})`
      : `rgba(${Math.round(110 + rng.next() * 50)},${Math.round(80 + rng.next() * 40)},${Math.round(110 + rng.next() * 50)},${rng.range(0.18, 0.36).toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 远山：两层剪影，近层更深
  const ridge = (baseY, amp, color, seed) => {
    const r = makeRng(seed);
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, baseY);
    let x = 0;
    while (x < W) {
      const step = r.range(40, 110);
      const y = baseY - Math.abs(Math.sin((x / W) * Math.PI * r.range(1.5, 3.2) + r.next())) * amp;
      ctx.lineTo(x + step, y);
      x += step;
    }
    ctx.lineTo(W, baseY);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  ctx.save();
  if ('filter' in ctx) ctx.filter = 'blur(3px)';
  ridge(horizon + 4, H * 0.022, 'rgba(96,66,80,0.72)', 881);
  ctx.restore();
  ctx.save();
  if ('filter' in ctx) ctx.filter = 'blur(1.5px)';
  ridge(horizon + 14, H * 0.032, 'rgba(64,44,56,0.88)', 883);
  ctx.restore();

  // 地面：背光的田野，往画面下缘彻底压暗
  const land = ctx.createLinearGradient(0, horizon + 26, 0, H);
  land.addColorStop(0, '#4a3542');
  land.addColorStop(0.5, '#372a33');
  land.addColorStop(1, '#241d24');
  ctx.fillStyle = land;
  ctx.fillRect(0, horizon + 26, W, H - horizon - 26);

  // 天上几只归鸟：纸飞机飞出去的时候有个同伴
  ctx.save();
  if ('filter' in ctx) ctx.filter = 'blur(1.2px)';
  ctx.strokeStyle = 'rgba(52,36,44,0.6)';
  ctx.lineWidth = 2.2;
  const bird = (bx, by, s) => {
    ctx.beginPath();
    ctx.moveTo(bx - s, by);
    ctx.quadraticCurveTo(bx - s * 0.4, by - s * 0.62, bx, by);
    ctx.quadraticCurveTo(bx + s * 0.4, by - s * 0.62, bx + s, by);
    ctx.stroke();
  };
  bird(W * 0.245, H * 0.665, 15);
  bird(W * 0.285, H * 0.645, 11);
  bird(W * 0.32, H * 0.68, 9);
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const outsideCache = new Map();
export function makeOutsideTexture(kind) {
  if (!outsideCache.has(kind)) {
    outsideCache.set(
      kind,
      kind === 'coast' ? makeCoastOutside() : kind === 'dusk' ? makeDuskOutside() : makeDeskOutside()
    );
  }
  return outsideCache.get(kind);
}
