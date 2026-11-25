// 纸张折叠引擎（运动学重建，非物理模拟）
// 坐标：x = 纸宽，y = 纸长（+y 为机头），z = 纸面法线。
// 每次 buildSheet(progress) 都从平整矩形重建，所有折痕按进度纯函数计算。

import * as THREE from 'three';

export const PAPER = {
  W: 0.148,
  H: 0.210,
  THICK: 0.00025,   // 相纸厚度（0.25mm），供边缘芯条
  GAP: 0.00006,     // 叠层沿 +z 的间距
  // 折痕圆角半径 = 真实折痕的弯曲半径，约一张纸的厚度（0.25mm）。
  // 原来取 1.8mm（纸厚的 7 倍）：180° 折完，折痕附近会鼓起一条 6mm 宽的圆滚边，
  // 纸被横向拉开近 5 倍——折好的那片纸压不平，整张纸在折叠中面积多出 8%，
  // 物理上不可能（纸折了还是同一张纸）。圆角只该细到看不清，不该成为可见的形状。
  CREASE_R: 0.00026, // 折痕圆角过渡带（略大于纸厚）
  AUTO_SECONDS: 8.8,
};

// 五种折法。折的刀数、窗口、翼根线位置、上反角都不同：
// 飞镖 = 五折尖头 + 大上反角；滑翔机 = 少一折、宽平翼；宽体 = 龙骨更宽的飞镖；
// 燕子 = 飞镖加一道翼尖下折；平头飞镖 = 飞镖加一刀切掉鼻尖。
export const RECIPES = {
  dart: {
    id: 'dart',
    label: '经典飞镖',
    desc: '尖头长身，上反角大，飞得最直',
    stages: [
      { key: 'corner', label: '对角', start: 0.00, end: 0.22 },
      { key: 'nose', label: '锁鼻', start: 0.22, end: 0.40 },
      { key: 'corner2', label: '再收角', start: 0.40, end: 0.62 },
      { key: 'half', label: '合身', start: 0.62, end: 0.80 },
      { key: 'wing', label: '展翼', start: 0.80, end: 1.00 },
    ],
    wingX: 0.017,
    dihedral: 0.46,
    flight: 1.0,
    // 成品机位微调（相机只叠在用户轨道上，不动 target*）：
    // 三种机型的机身高低、翼展宽窄差很多，同一个机位拍一遍总有一种读不出来。
    // dist = 推近比例（0 = 基础机位 0.61m，越大越近），pitch = 俯角偏移，
    // yaw = 绕机身偏转角，lookX/lookY = 视点横向/纵向让位。
    // 成品镜头要同时装下飞机和窗：相机退到 0.5m 上下、视点略抬，
    // 画面上沿就是窗和墙，飞机落在中下部
    ready: { dist: 0.17, pitch: -0.03, yaw: 0.3, lookX: -0.035, lookY: 0.015 },
  },
  glider: {
    id: 'glider',
    label: '宽翼滑翔机',
    desc: '少折一道，翼面宽而平，飞得慢',
    stages: [
      { key: 'corner', label: '对角', start: 0.00, end: 0.28 },
      { key: 'nose', label: '锁鼻', start: 0.28, end: 0.50 },
      { key: 'half', label: '合身', start: 0.50, end: 0.72 },
      { key: 'wing', label: '展翼', start: 0.72, end: 1.00 },
    ],
    wingX: 0.012,
    dihedral: 0.34,
    flight: 1.18,
    // 翼展最宽：退远一点，双翼的平展开才不贴画面边缘；视点再往左让，整机才会落到画面中部
    ready: { dist: 0.10, pitch: -0.02, yaw: 0.3, lookX: -0.06, lookY: 0.015 },
  },
  wide: {
    id: 'wide',
    label: '宽体飞镖',
    desc: '龙骨宽、翼展窄，重心稳',
    stages: [
      { key: 'corner', label: '对角', start: 0.00, end: 0.22 },
      { key: 'nose', label: '锁鼻', start: 0.22, end: 0.40 },
      { key: 'corner2', label: '再收角', start: 0.40, end: 0.62 },
      { key: 'half', label: '合身', start: 0.62, end: 0.80 },
      { key: 'wing', label: '展翼', start: 0.80, end: 1.00 },
    ],
    wingX: 0.024,
    dihedral: 0.44,
    flight: 0.95,
    // 机身比飞镖宽、翼展短：龙骨侧面是一整块 2.4cm 高的板，俯角一高就读成摊开的书，
    // 视角压低一点、退远看整个机身
    ready: { dist: 0.14, pitch: -0.04, yaw: 0.3, lookX: -0.07, lookY: 0.015 },
  },
  swift: {
    id: 'swift',
    label: '燕子',
    desc: '翼尖下折，像鸟一样滑',
    stages: [
      { key: 'corner', label: '对角', start: 0.00, end: 0.20 },
      { key: 'nose', label: '锁鼻', start: 0.20, end: 0.36 },
      { key: 'corner2', label: '再收角', start: 0.36, end: 0.54 },
      { key: 'half', label: '合身', start: 0.54, end: 0.70 },
      { key: 'wing', label: '展翼', start: 0.70, end: 0.88 },
      { key: 'tiptuck', label: '折翼尖', start: 0.88, end: 1.00 },
    ],
    wingX: 0.020,
    dihedral: 0.50,
    // 翼尖折痕离中线的距离与下折角（弧度，约 52°）。
    // 折痕在展翼前压出，52° 是相对翼面的额外弯折；翼面本身还有 dihedral 的抬升，
    // 所以成品翼尖落在大约水平线下方，读成鸟翼。
    tipX: 0.040,
    tipFold: 0.9,
    tipDir: -1,
    flight: 1.1,
    ready: { dist: 0.13, pitch: -0.03, yaw: 0.32, lookX: -0.05, lookY: 0.015 },
  },
  hammer: {
    id: 'hammer',
    label: '平头飞镖',
    desc: '机头切平，钝头最稳',
    // 飞镖的四步照旧，收角之后多折一刀「切头」：在鼻尖后方 10mm 处横着
    // 把整个尖头翻回身上，前沿从尖点变成一段 10mm 的直线。
    // 试过「跳过对角折、直接把整条顶边压下来」，那样机头是钝的但整张纸只剩
    // 74mm 长、前宽后尖，读出来是一只鸟而不是飞机（实测包围盒 y 从 [0,136]
    // 缩成 [62,136]）；切头是在完整飞镖机身上做的局部改动，读起来最像平头飞镖。
    stages: [
      { key: 'corner', label: '对角', start: 0.00, end: 0.18 },
      { key: 'nose', label: '锁鼻', start: 0.18, end: 0.34 },
      { key: 'corner2', label: '收角', start: 0.34, end: 0.52 },
      { key: 'cutnose', label: '切头', start: 0.52, end: 0.70 },
      { key: 'half', label: '合身', start: 0.70, end: 0.86 },
      { key: 'wing', label: '展翼', start: 0.86, end: 1.00 },
    ],
    noseCut: 0.010,
    wingX: 0.017,
    dihedral: 0.46,
    flight: 0.98,
    // 平头飞镖比飞镖更宽更扁，机身后 3/4 的低机位只能看到一片板；
    // 抬高俯角（pitch 正值）把整个平面图带进来，翼面和切平的机头同时读得出来。
    ready: { dist: 0.22, pitch: 0.05, yaw: 0.34, lookX: -0.04, lookY: -0.020 },
  },
};

export const DEFAULT_RECIPE = 'dart';

const EPS = 1e-9;

export const clamp01 = (n) => Math.min(1, Math.max(0, n));

export function smooth01(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

const ease = (x) => smooth01(0, 1, x);

function v(x, y, z = 0) {
  return new THREE.Vector3(x, y, z);
}

function initialFaces() {
  const { W, H } = PAPER;
  const hw = W / 2;
  const verts = [
    { p: v(-hw, 0), uv: new THREE.Vector2(0, 0), cut: true, level: 0 },
    { p: v(hw, 0), uv: new THREE.Vector2(1, 0), cut: true, level: 0 },
    { p: v(hw, H), uv: new THREE.Vector2(1, 1), cut: true, level: 0 },
    { p: v(-hw, H), uv: new THREE.Vector2(0, 1), cut: true, level: 0 },
  ];
  return [{ verts }];
}

export function foldDefs(recipe = RECIPES[DEFAULT_RECIPE]) {
  const { W, H } = PAPER;
  const hw = W / 2;
  const noseY = H - hw;
  const wingX = recipe.wingX;
  return {
    cornerL: { a: v(0, H), b: v(-hw, noseY), side: -1 },
    cornerR: { a: v(0, H), b: v(hw, noseY), side: +1 },
    nose: { a: v(-W, noseY), b: v(W, noseY), side: +1 },
    corner2L: { a: v(0, noseY), b: v(-hw, H - W), side: -1 },
    corner2R: { a: v(0, noseY), b: v(hw, H - W), side: +1 },
    // 切头（平头飞镖）：在鼻尖后方 cut 毫米处横折一刀，把尖头翻回去，前沿变成一段直线
    cutnose: { a: v(-W, noseY - (recipe.noseCut || 0)), b: v(W, noseY - (recipe.noseCut || 0)), side: +1 },
    half: { a: v(0, -0.1), b: v(0, H + 0.1), side: -1 },
    wing: { a: v(-wingX, -0.1), b: v(-wingX, H + 0.1), side: +1 },
    // 翼尖折痕（燕子）：左右各一条竖线，画在**摊平**的纸上
    tipL: { a: v(-(recipe.tipX || 0.048), -0.1), b: v(-(recipe.tipX || 0.048), H + 0.1), side: +1 },
    tipR: { a: v(recipe.tipX || 0.048, -0.1), b: v(recipe.tipX || 0.048, H + 0.1), side: -1 },
  };
}

// 必须除以折痕长度：否则返回值是「叉积面积」，折痕越长过渡带越宽
// （不归一化时 1.8mm 的圆角会铺成 17mm，整片纸卷成帐篷）
function signedDist(p, a, b, side) {
  const ax = b.x - a.x;
  const ay = b.y - a.y;
  const len = Math.hypot(ax, ay) || 1;
  return ((ax * (p.y - a.y) - ay * (p.x - a.x)) / len) * side;
}

function lerpVert(a, b, t) {
  return {
    p: a.p.clone().lerp(b.p, t),
    uv: a.uv.clone().lerp(b.uv, t),
    cut: a.cut && b.cut,
    level: a.level + (b.level - a.level) * t,
  };
}

function pushUnique(out, vert) {
  if (out.length) {
    const last = out[out.length - 1];
    if (last.p.distanceToSquared(vert.p) < 1e-18 &&
        Math.abs(last.level - vert.level) < 1e-9) return;
  }
  out.push(vert);
}

function clipHalf(verts, dists, keepPositive) {
  const out = [];
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const da = dists[i];
    const db = dists[j];
    const ina = keepPositive ? da >= -EPS : da <= EPS;
    const inb = keepPositive ? db >= -EPS : db <= EPS;
    if (ina) pushUnique(out, verts[i]);
    if (ina !== inb) {
      const denom = da - db;
      const t = Math.abs(denom) < 1e-15 ? 0.5 : clamp01(da / denom);
      pushUnique(out, lerpVert(verts[i], verts[j], t));
    }
  }
  return out.length >= 3 ? out : null;
}

// 把折痕附近的移动面切成几条带，让旋转按 smoothstep 过渡，形成圆角折痕。
// 最后一条切线必须落在 radius 上（该处 w=1、转角已满、抬高归零）：
// 少了它，跨到平坦区的三角面会带上折痕弧的倾斜，180° 折完时整片
// 「贴着下面那层」的纸被抬到上面，压住该露出来的印花面。
function bandSplit(verts, a, b, side, radius) {
  const thresholds = [radius * 0.35, radius * 0.75, radius * 0.9995];
  let bands = [verts];
  for (const t of thresholds) {
    const next = [];
    for (const poly of bands) {
      const dists = poly.map((vt) => signedDist(vt.p, a, b, side) - t);
      const lo = clipHalf(poly, dists, false);
      const hi = clipHalf(poly, dists, true);
      if (lo) next.push(lo);
      if (hi) next.push(hi);
    }
    bands = next;
  }
  return bands;
}

function foldMovingPoly(verts, a, b, side, axis, angle, radius, levelShift, levelFlip, tag, flags, out) {
  const bands = bandSplit(verts, a, b, side, radius);
  for (const band of bands) {
    // 顶点对象在相邻面之间是共享的（initialFaces / clipHalf 复用同一批对象），
    // 折动时若不克隆，折痕线上的共享顶点会被两侧的面各折一次，静止侧的面跟着
    // 抬起并拿到小数的层号（实测 p≈0.78 出现 level 14.7623 的 top 面）。
    for (let i = 0; i < band.length; i++) {
      const src = band[i];
      band[i] = { p: src.p.clone(), uv: src.uv.clone(), cut: src.cut, level: src.level };
    }
    for (const vt of band) {
      const d = Math.max(0, signedDist(vt.p, a, b, side));
      const w = smooth01(0, radius, d);
      if (Math.abs(angle) > 1e-7 && w > 1e-7) {
        vt.p.sub(a).applyAxisAngle(axis, angle * w).add(a);
      }
      if (levelFlip != null) {
        // 合页式翻面：翻过去的那半落在静止半「上面」，但它自己那叠层的上下
        // 顺序整体倒过来（翻前在最上面的折角层，翻完在那一叠的最底下）。
        // levelFlip = 移动侧最大层 + 静止侧最大层 + 1，保证整叠正好压在对面之上。
        //
        // 反转只在转过垂直（|angle| > π/2）之后生效：层号是沿世界 z 的偏移，
        // 整叠的世界高度顺序正是在 90° 处翻转的。提前反转，折到一半时底纸
        // 会被顶到整叠最上面、印花朝上，盖住本该朝镜头的纸背（实测 p≈0.30
        // 锁鼻翼整片变蓝天）。90° 时整叠侧立、正对镜头的面积为零，跳变不可见。
        const rev = Math.abs(angle) > Math.PI / 2 ? 1 : 0;
        if (rev) vt.level = levelFlip - vt.level;
      } else {
        // 层号必须按整数一步到位，不能按折痕圆角 w 渐进：相机 near=0.02 /
        // 24 位深度在 35cm 处的分辨率约 0.4µm，w 渐进会让两层落在同一位置附近
        // 只差零点几微米——两张面各自的印花/纸背就会在接触面上逐像素互搏，
        // 出现方块状马赛克（实测锁鼻段白三角上冒蓝天）。整层抬升一格 = 60µm，
        // 是深度分辨率的 150 倍，稳定。
        vt.level += levelShift;
      }
    }
    out.push({ verts: band, tag, flap: flags.flap });
  }
}

// 折角 / 锁鼻 / 再收角：都是「把这一片折到纸堆上面」的折。
// 层号要抬到**整叠纸的最高层之上**，不能按静止侧取 max：左右两个折角是先后折的，
// 按静止侧取 max 时右折角会看见左折角已经抬到 1，于是右折角比左折角高一层，
// 对称的一对折角在层号上错开（实测 p=0.45 镜像面对 7 层 vs 4 层、10 层 vs 6 层），
// 折到中线附近谁压谁就由先后顺序决定——用户看到的「左边照片、右边白纸」。
// 所以对称的一对折必须在折之前算好同一个 lift 传进来（见 buildSheet）。
//
// 正反面只由几何绕序决定：印花面朝谁谁显示照片，反面朝谁谁显示纸背。
// 不再按折角大小改材质——同一片纸面一会儿照片一会儿白纸，用户实锤不接受。
function foldFlap(faces, def, angle, opts = {}) {
  const lift = opts.lift != null ? opts.lift : maxLevel(faces) + 1;
  return foldSheet(faces, def, angle, {
    levelShift: lift,
    flap: true,
    tag: opts.tag || 'flap',
  });
}

// 折痕两侧各自的最高层号。合页式翻面要用它算「整叠压到对面之上」的目标层。
function sideLevelMax(faces, def) {
  const { a, b, side } = def;
  let mv = 0, fx = 0;
  for (const f of faces) {
    for (const vt of f.verts) {
      const d = signedDist(vt.p, a, b, side);
      if (d > EPS) mv = Math.max(mv, vt.level);
      else if (d < -EPS) fx = Math.max(fx, vt.level);
    }
  }
  return { mv, fx };
}

/**
 * 折一刀。
 * def: {a,b,side}
 * angle: 绝对折叠角（弧度，0..π）
 * opts.levelShift: 折完后移动侧相对静止侧的层偏移增量
 * opts.select: 只折满足条件的面（用于只折上层的机翼）
 */
export function foldSheet(faces, def, angle, opts = {}) {
  const { radius = PAPER.CREASE_R, levelShift = 0, levelFlip = null, select = null, tag = undefined, flap = undefined } = opts;
  const { a, b, side } = def;
  if (Math.abs(angle) < 1e-7) return faces;

  const axis = new THREE.Vector3(b.x - a.x, b.y - a.y, 0);
  if (axis.lengthSq() < 1e-14) return faces;
  axis.normalize();

  // 让移动侧在小角度时朝 +z 抬起；整 π 时方向无关，但部分折叠需要这个符号。
  let sample = null;
  for (const f of faces) {
    if (select && !select(f)) continue;
    for (const vt of f.verts) {
      const d = signedDist(vt.p, a, b, side);
      if (d > radius * 1.2 && (!sample || d > sample.d)) sample = { p: vt.p, d };
    }
  }
  if (sample) {
    const cz = axis.x * (sample.p.y - a.y) - axis.y * (sample.p.x - a.x);
    if (cz < 0) axis.negate();
  }

  const out = [];
  for (const f of faces) {
    if (select && !select(f)) {
      out.push(f);
      continue;
    }
    const dists = f.verts.map((vt) => signedDist(vt.p, a, b, side));
    let anyMoving = false;
    let anyFixed = false;
    for (const d of dists) {
      if (d > EPS) anyMoving = true;
      if (d < -EPS) anyFixed = true;
    }
    if (!anyMoving) {
      out.push(f);
      continue;
    }
    // 只带 flap 标记。颜色不跟着折走：印花在哪一面由绕序决定，折只改几何。
    const flags = { flap: flap !== undefined ? flap : f.flap };
    const faceTag = tag !== undefined ? tag : f.tag;
    if (!anyFixed) {
      foldMovingPoly(f.verts, a, b, side, axis, angle, radius, levelShift, levelFlip, faceTag, flags, out);
      continue;
    }
    const fixed = clipHalf(f.verts, dists, false);
    const moving = clipHalf(f.verts, dists, true);
    // 固定侧不改标记：它没被折，印花还是它自己的
    if (fixed) out.push({ verts: fixed, tag: f.tag, flap: f.flap });
    if (moving) foldMovingPoly(moving, a, b, side, axis, angle, radius, levelShift, levelFlip, faceTag, flags, out);
  }
  return out;
}

export function maxLevel(faces) {
  let m = 0;
  for (const f of faces) for (const vt of f.verts) if (vt.level > m) m = vt.level;
  return m;
}

function faceLevelMax(face) {
  let m = -Infinity;
  for (const vt of face.verts) if (vt.level > m) m = vt.level;
  return m;
}

function stageProgress(R, key, p) {
  const s = R.stages.find((st) => st.key === key);
  if (!s) return 0;
  return ease((p - s.start) / (s.end - s.start));
}

// 展翼阶段：前 55% 把上层翼翻盖到龙骨上，后 45% 双翼一起张开并把整机立起来。
// 立起来的滚转量由 main.js 用同一个值驱动，保证两处同步。
export function wingOpen(R, p) {
  const ws = R.stages.find((s) => s.key === 'wing');
  if (!ws) return 0;
  const span = ws.end - ws.start;
  return ease((p - (ws.start + span * 0.55)) / (span * 0.45));
}

export function buildSheet(progress, recipeId = DEFAULT_RECIPE) {
  const p = clamp01(progress);
  const R = RECIPES[recipeId] || RECIPES[DEFAULT_RECIPE];
  const d = foldDefs(R);
  let faces = initialFaces();

  // 每折一次的层偏移固定 +1。不能写 maxLevel+1：折痕带里的层号是小数，
  // 逐折取最大值会指数放大（实测跑到 28），层间缝隙被撑成毫米级。
  // 1. 两顶角折向中线
  const tCorner = stageProgress(R, 'corner', p);
  if (tCorner > 0) {
    // 一对镜像折共用同一个 lift：分两次各自取 max 会让右折角比左折角高一层，
    // 折到中线附近谁压谁由先后顺序决定（左右不对称的根因）。
    const lift = maxLevel(faces) + 1;
    faces = foldFlap(faces, d.cornerL, Math.PI * tCorner, { lift });
    faces = foldFlap(faces, d.cornerR, Math.PI * tCorner, { lift });
  }

  // 2. 顶部三角向下折（锁鼻）
  // 两片折角此刻平铺在鼻条**上面**（角折是往印花面上折的，露出来的是纸背）。
  // 这一折把整条鼻带连同压在它上面的折角一起翻过去。
  //
  // 两刀抬同一层数（+2），关键是「一起抬」：鼻带和折角的相对次序必须原封不动。
  // 折角始终贴在鼻带的印花面外侧，折到 90° 侧立时它离镜头更近——层差换算成
  // 深度约 1.1mm，比纸厚还大，只要鼻带被抬到折角上面，整片立起的面就会凭空
  // 变印花（实测 p=0.32 整块三角形翻蓝 16568 像素）。只抬鼻带不抬折角就是这台
  // 机器；两刀同抬则外观与改动前逐像素一致。
  //
  // 抬层是为了躲 180° 的平局：鼻带折满后正好平贴在下半张纸上，不留层差就是
  // 两片深度完全相同（实测 p=1 处 gap=0.000mm、层号都是 0），整片区域逐像素
  // 抢着画——这就是「一直闪，过程中和成品都是」（p=0.44→1.00 每 0.02 都能抓到
  // 3–8 对这种同层重叠）。抬起来以后鼻带稳定压在底层纸之上，符合物理。
  const tNose = stageProgress(R, 'nose', p);
  if (tNose > 0) {
    const angle = Math.PI * tNose;
    const isFlap = (f) => f.tag === 'flap';
    faces = foldSheet(faces, d.nose, angle, {
      levelShift: 2, select: isFlap, flap: true, tag: 'flap',
    });
    faces = foldSheet(faces, d.nose, angle, {
      levelShift: 2, select: (f) => !isFlap(f),
    });
  }

  // 3. 新顶角第二次折向中线（滑翔机没有这一折）
  const tCorner2 = stageProgress(R, 'corner2', p);
  if (tCorner2 > 0) {
    const lift = maxLevel(faces) + 1;
    faces = foldFlap(faces, d.corner2L, Math.PI * tCorner2, { lift });
    faces = foldFlap(faces, d.corner2R, Math.PI * tCorner2, { lift });
  }

  // 3.4 切头（平头飞镖）：鼻尖后方横折一刀，把尖头翻回去。
  // 动的是「鼻尖那一叠」的全部层（折角 + 锁鼻带），不是只折最上面一层，
  // 所以用整叠抬升（maxLevel+1）而不是 foldFlap —— 真实折的时候也是把
  // 整个尖头一起翻回去，层间次序原封不动。
  const tCut = stageProgress(R, 'cutnose', p);
  if (tCut > 0) {
    faces = foldSheet(faces, d.cutnose, Math.PI * tCut, { levelShift: maxLevel(faces) + 1 });
  }

  // 3.5 折翼尖（燕子）：必须在**展翼之前**、纸还摊平的时候压这道折痕。
  // 展翼之后翼面已经侧立，翼尖折痕落在 x-z 平面里，而折刀只认纸面内的折线
  // （signedDist 只看 x/y、旋转轴 b−a 的 z 恒为 0）；而且那时两翼分居中线两侧，
  // 一条竖直折线只可能碰到其中一翼。实测改之前这一步对几何**毫无作用**
  // （p=0.88 与 p=1 的顶点数、包围盒逐字节相同）。
  // 放在合身之前还有额外好处：左右两片原纸都在，两条折痕各自只折自己那侧，
  // 合身与展翼随后把整条带子（含折角）一起转过去，翼尖就带着相对翼面的弯折。
  // 两片必须用**同号**角度：foldSheet 内部会按「移动侧朝 +z 抬」自动定轴符号
  // （见 sample 那段），tipR 的轴因此被翻成 −y，所以同号 = 同一个 z 方向。
  // 真正要对称的条件是「摊平状态下左右两片往同一侧抬」，这样中线翻折（z 取反）
  // 之后两片才互为镜像；用异号会让一片抬、一片落（实测最终
  // z ∈ [−0.0277, +0.0480]，只有一翼被折到）。
  const tTip = stageProgress(R, 'tiptuck', p);
  if (tTip > 0) {
    const tipAngle = (R.tipFold || 0.95) * tTip * (R.tipDir || 1);
    faces = foldSheet(faces, d.tipL, tipAngle);
    faces = foldSheet(faces, d.tipR, tipAngle);
  }

  // 4. 沿中线合拢机身。被翻过来的那一半打上 top 标签（层号不可靠，见上）
  // 合页式翻面：翻过去的那半落在静止半**上面**，但它自己那叠层的上下顺序
  // 整体倒过来。levelFlip = 移动侧最高层 + 静止侧最高层 + 1，把整叠正好压在
  // 对面之上；少了这层反转，被翻那半自带的折角层会停在印花面上，合身段照片
  // 面上冒白块；反过来把它压到下面（旧做法），折到一半就会露出本该盖住的印花。
  const tHalf = stageProgress(R, 'half', p);
  if (tHalf > 0) {
    const { mv, fx } = sideLevelMax(faces, d.half);
    // 穿过 90° 时是印花面朝上（照片看得见，正确），过了 90° 印花面朝下、
    // 白背朝上——正反面材质按绕序自己就画对了，不用在这里打任何标记。
    faces = foldSheet(faces, d.half, Math.PI * tHalf, {
      levelFlip: mv + fx + 1,
      tag: 'top',
    });
  }

  // 5. 展翼：翼根线与上反角随折法不同。
  // 真飞镖的龙骨是竖直的：先把上层翼翻盖到龙骨上（π），再双翼一起往外张到
  // 接近垂直于龙骨（π/2 ± 上反角），同时整机绕长轴滚 90° 立起来（见 main.js）。
  // 两翼对称条件是同一 x 落点：cos(π/2−δ) = cos(3π/2+δ)。
  const ws = R.stages.find((s) => s.key === 'wing');
  if (ws) {
    const span = ws.end - ws.start;
    const fFold = ease((p - ws.start) / (span * 0.55));
    const open = wingOpen(R, p);
    if (fFold > 0) {
      const isFlipped = (face) => face.tag === 'top';
      // 不能只排除 top：上一步刚给翻盖翼打了 wingTop，否则它会被再转一次
      const isStatic = (face) => face.tag !== 'top' && face.tag !== 'wingTop';
      // 相纸只印一面。合身时翻过来的那半是白背朝上，翻盖只能选这一层：
      // 折起过程里镜头看到的是白纸背，照片不会提前露出来。
      //
      // 展翼要两片印花都朝镜头：合身时两层的印花朝向相反，而对称的 V 形要求两翼
      // 绕翼根线异号折（+θ 与 −θ）。同号折会让两片落在同一侧：法线同向、位置一上
      // 一下，读过去是顶棚/摊开的书，不是飞机（三种组合都实测过）。
      // 成品角度：上反角是从龙骨平面量起的 dihedral，龙骨被 main.js 绕长轴立起来
      // 之后两翼落在水平面上方 dihedral 的位置。折角 = π−β（β = π/2−dihedral），
      // 即两翼各自越过纸面折到翼根线的**另一侧**、再抬起来——只有这一组能让两片
      // 印花法线同时朝上、水平分量左右相反（实测世界法线 (±0.34, 0.9, ∓0.29)）。
      // 两翼既然分在两侧，层号就不需要再做「翻过来那半整体下沉」——那套 drop 是
      // 为同一侧重叠消 z-fighting 而加的，留着反而把右翼压到龙骨下面。
      const beta = Math.PI / 2 - R.dihedral;
      const topAngle = Math.PI * fFold - (Math.PI - beta) * open;
      const bottomAngle = -beta * open;

      // 两片翼是同一个折线的一对镜像折，同样必须共用 lift（先后各取一次 max
      // 会让第二片翼高一层，两翼贴合时左右深浅不一致）。
      const wingLift = maxLevel(faces) + 1;
      faces = foldSheet(faces, d.wing, topAngle, { levelShift: wingLift, select: isFlipped, tag: 'wingTop' });
      faces = foldSheet(faces, d.wing, bottomAngle, { levelShift: wingLift, select: isStatic, tag: 'wingBottom' });

      // 单面印刷的最后一道账：一片翼上叠着两层，只有「印花朝翼外侧」的那层该露出来，
      // 另一层永远只贡献纸背。合身段把右半整叠镜面翻过来，两翼的层序清单是反的；
      // 展翼又共用同一个 lift，于是其中一翼的折角叠会浮到印花面之上——俯视看就是
      // 左翼一片纸背楔形（用户实锤「这个不对称」）。
      //
      // 判据只用几何，因此天然左右对称：翼的外侧 = 远离机身中线（质心 z 的符号），
      // 面法线朝那边就是印花朝外。把「印花朝外」这一档整体留在上面，露纸背的一档
      // 沉到它下面，档内次序不动（同一档里还可能叠着折角，次序不能乱）。
      // 沉下去的位移乘 open：翼没张开时（open=0）这半叠是侧立的、朝向还没定型，
      // 那时改层序会让照片在合拢状态下提前露出来，把颜色跳变放进动画中间。
      {
        const isWing = (f) => f.tag === 'wingTop' || f.tag === 'wingBottom';
        const rows = [];
        let maxPrint = -Infinity, minBack = Infinity;
        for (const f of faces) {
          if (!isWing(f)) continue;
          let cz = 0, lv = 0;
          for (const vt of f.verts) { cz += vt.p.z; lv += vt.level; }
          cz /= f.verts.length; lv /= f.verts.length;
          const n = faceNormal(f.verts);
          const outward = n ? Math.sign(cz) * n.z : 0;
          rows.push({ f, lv, outward });
          if (outward > 0) { if (lv > maxPrint) maxPrint = lv; } else if (lv < minBack) minBack = lv;
        }
        if (isFinite(maxPrint) && isFinite(minBack) && open > 0) {
          const floor = maxPrint + 1;
          for (const r of rows) {
            if (r.outward > 0) continue;
            const delta = (floor - minBack) * open;   // 整档平移，档内次序不动
            for (const vt of r.f.verts) vt.level += delta;
          }
        }
      }

      // 龙骨（两翼之间的窄条）不单独处理：它就是一张真纸，朝外那面是印花就显印花，
      // 是纸背就显白。曾经按位置把静止侧整片刷白，展翼一开始就有一大片瞬间变白，
      // 同一块地方的颜色在进度上跳变——已删除。
    }
  }

  return faces;
}

function faceNormal(verts) {
  const n = new THREE.Vector3();
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i].p;
    const b = verts[(i + 1) % verts.length].p;
    n.x += (a.y - b.y) * (a.z + b.z);
    n.y += (a.z - b.z) * (a.x + b.x);
    n.z += (a.x - b.x) * (a.y + b.y);
  }
  const len = n.length();
  return len > 1e-10 ? n.multiplyScalar(1 / len) : null;
}

function edgeKey(a, b) {
  const q = (p) => `${Math.round(p.x * 1e5)},${Math.round(p.y * 1e5)},${Math.round(p.z * 1e5)}`;
  const ka = q(a);
  const kb = q(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

/**
 * 把面数据压成渲染缓冲。creaseAt(u,v) 返回 0..1 的折痕强度（用于顶点级别的折痕压暗）。
 * 相纸只印一面：每片三角形都压两遍——原绕序进 photo 通道（印花），反绕序 +
 * 反法线进 white 通道（纸背）。两面都由 FrontSide 材质画，谁朝镜头就显示谁。
 * 没有覆盖项：颜色只由几何绕序决定，同一片纸面在任何进度、任何机位都稳定。
 * white 通道——单面印刷的纸折起来，朝外那面本来就该是白的。
 * 返回 {position, uv, normal, color, whitePosition, whiteUv, whiteNormal, whiteColor,
 *       count, whiteCount, edgePosition, edgeNormal, edgeCount}
 */
export function buildPaperData(faces, creaseAt) {
  const position = [];
  const uv = [];
  const normal = [];
  const color = [];
  const whitePosition = [];
  const whiteUv = [];
  const whiteNormal = [];
  const whiteColor = [];
  const level = [];
  const whiteLevel = [];
  const edgePosition = [];
  const edgeNormal = [];
  const { GAP } = PAPER;

  const pushVert = (buf, vt, n) => {
    buf.position.push(vt.p.x, vt.p.y - PAPER.H / 2, vt.p.z + vt.level * GAP);
    buf.level.push(vt.level);
    buf.uv.push(vt.uv.x, vt.uv.y);
    buf.normal.push(n.x, n.y, n.z);
    const crease = creaseAt ? creaseAt(vt.uv.x, vt.uv.y) : 0;
    const ao = Math.min(1, Math.max(0.55, 1 - 0.032 * Math.min(vt.level, 12)));
    // 折痕压暗：成品的两条长折痕是这个尺寸下唯一能读出「折过」的线索，
    // 0.14 太淡，照片印花的明暗会把折痕完全吃掉
    const c = ao * (1 - 0.3 * crease);
    buf.color.push(c, c, c);
  };
  const photoBuf = { position, uv, normal, color, level };
  const whiteBuf = { position: whitePosition, uv: whiteUv, normal: whiteNormal, color: whiteColor, level: whiteLevel };

  const nInv = new THREE.Vector3();
  for (const face of faces) {
    if (face.verts.length < 3) continue;
    const n = faceNormal(face.verts);
    if (!n) continue;

    // 印花面：原绕序。单面印刷——只有这一面印照片，另一面永远是纸背。
    const buf = photoBuf;
    for (let i = 1; i < face.verts.length - 1; i++) {
      pushVert(buf, face.verts[0], n);
      pushVert(buf, face.verts[i], n);
      pushVert(buf, face.verts[i + 1], n);
    }
    // 纸背：同一片三角形反绕序 + 反法线，走独立的白纸网格。不用 BackSide /
    // DoubleSide 材质——那两种都会让背面片元的着色法线翻向，而阴影
    // normalBias 按顶点法线推，采样扎进自己这层纸，纸背铺满 1mm 网格状
    // 阴影麻点（实测 receiveShadow=false 就干净）。两个 FrontSide 网格各自
    // 只画朝向自己的那一面，合起来就是一张单面印刷的双面纸。
    nInv.copy(n).negate();
    for (let i = 1; i < face.verts.length - 1; i++) {
      pushVert(whiteBuf, face.verts[0], nInv);
      pushVert(whiteBuf, face.verts[i + 1], nInv);
      pushVert(whiteBuf, face.verts[i], nInv);
    }

    // 不做纸边芯条：0.25mm 的侧带在这个视距下不足 1px，只会沿边沿抖出一串
    // 白点（像缝线），还可能在龙骨底边投出一条亮针。纸边留硬轮廓更像照片。
  }

  return {
    position,
    uv,
    normal,
    color,
    whitePosition,
    whiteUv,
    whiteNormal,
    whiteColor,
    level,
    whiteLevel,
    count: position.length / 3,
    whiteCount: whitePosition.length / 3,
    edgePosition,
    edgeNormal,
    edgeCount: edgePosition.length / 3,
  };
}
