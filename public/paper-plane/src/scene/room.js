// 窗边书桌：桌面、双墙、窗框、窗外、道具、光照与接触阴影
import * as THREE from 'three';
import {
  makeWoodTextures,
  makePlasterTexture,
  makeContactShadow,
} from '../paper/texture.js';
import { THEMES, makeOutsideTexture } from './themes.js';

const TABLE = { w: 1.2, d: 1.0, t: 0.035 };
// 窗在书桌正后方（-z），相机从 +z 看纸，窗外绿意落在画面背景
const WALL = { z: -0.7, thickness: 0.08 };
// 落地高窗：窗台压到桌面以下，低俯角机位才能在画面上沿看见窗外绿意
const WIN = { y0: -0.08, y1: 1.7, x0: -0.5, x1: 0.5 };

function roundedRectShape(w, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function makePropPrintTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 360;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f7f1e4';
  ctx.fillRect(0, 0, 256, 360);
  ctx.fillStyle = '#dcd4c3';
  ctx.fillRect(18, 18, 220, 286);
  const g = ctx.createLinearGradient(18, 18, 238, 304);
  g.addColorStop(0, '#9a8f7c');
  g.addColorStop(0.5, '#c2b6a0');
  g.addColorStop(1, '#7d7466');
  ctx.fillStyle = g;
  ctx.fillRect(22, 22, 212, 278);
  ctx.fillStyle = 'rgba(60,54,44,0.5)';
  ctx.fillRect(18, 304, 220, 1.5);
  ctx.fillStyle = '#8b8173';
  ctx.font = '13px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('JUNE  ·  2026', 128, 331);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeLightPatchTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  const pad = S * 0.14;
  const g = ctx.createLinearGradient(pad, pad, S - pad, S - pad);
  g.addColorStop(0, 'rgba(255,236,200,0.0)');
  g.addColorStop(0.35, 'rgba(255,240,208,0.55)');
  g.addColorStop(0.7, 'rgba(255,232,190,0.42)');
  g.addColorStop(1, 'rgba(255,226,180,0.0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(pad, pad, S - pad * 2, S - pad * 2, S * 0.06);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---- 主题道具：换背景时连桌面上的东西一起换 ----
// 三组在启动时全部建好（几何很轻），按主题切 visible；只有木料纹理是懒生成
let _blobTex = null;
const blobTex = () => (_blobTex ||= makeContactShadow());

let _glowTex = null;
function glowTex() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,214,158,0.95)');
  g.addColorStop(0.35, 'rgba(255,172,92,0.4)');
  g.addColorStop(1, 'rgba(255,150,70,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  _glowTex = new THREE.CanvasTexture(c);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}

function blobShadow(w, d, opacity = 0.42) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({
      map: blobTex(),
      transparent: true,
      opacity,
      depthWrite: false,
      color: 0x000000,
    })
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  return m;
}

function groundBlob(w, d, x, z, yaw = 0, opacity = 0.42) {
  const g = new THREE.Group();
  g.position.set(x, 0.00115, z);
  g.rotation.y = yaw;
  g.add(blobShadow(w, d, opacity));
  return g;
}

function buildDeskProps() {
  const g = new THREE.Group();
  const printMat = new THREE.MeshStandardMaterial({
    map: makePropPrintTexture(),
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const cardGeo = new THREE.PlaneGeometry(0.096, 0.134);
  const card1 = new THREE.Mesh(cardGeo, printMat);
  card1.rotation.x = -Math.PI / 2;
  card1.rotation.z = 0.14;
  card1.position.set(0.225, 0.0012, -0.14);
  card1.receiveShadow = true;
  g.add(card1);
  const card2 = new THREE.Mesh(cardGeo, printMat);
  card2.rotation.x = -Math.PI / 2;
  card2.rotation.z = -0.07;
  card2.position.set(0.255, 0.0016, -0.02);
  card2.receiveShadow = true;
  g.add(card2);

  const pencil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0038, 0.0038, 0.17, 12),
    new THREE.MeshStandardMaterial({ color: 0xc79a3e, roughness: 0.55, metalness: 0.05 })
  );
  pencil.rotation.z = Math.PI / 2;
  pencil.rotation.y = 0.42;
  pencil.position.set(-0.155, 0.0042, 0.235);
  pencil.castShadow = true;
  pencil.receiveShadow = true;
  g.add(pencil);
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.0038, 0.018, 12),
    new THREE.MeshStandardMaterial({ color: 0x2a2521, roughness: 0.7 })
  );
  tip.rotation.z = -Math.PI / 2;
  tip.rotation.y = 0.42;
  tip.position.set(-0.155 + Math.cos(0.42) * 0.094, 0.0042, 0.235 - Math.sin(0.42) * 0.094);
  g.add(tip);
  return g;
}

function buildCoastProps() {
  const g = new THREE.Group();

  // 漂流瓶：平躺在桌沿，里面卷着一张纸条
  const bottle = new THREE.Group();
  const lying = new THREE.Group();
  lying.rotation.z = -Math.PI / 2;
  const profile = [
    [0.0, 0.0],
    [0.019, 0.001],
    [0.022, 0.006],
    [0.022, 0.094],
    [0.018, 0.106],
    [0.0105, 0.116],
    [0.0095, 0.136],
    [0.0118, 0.139],
    [0.0118, 0.146],
    [0.0, 0.146],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const glass = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 28),
    new THREE.MeshPhysicalMaterial({
      color: 0x557a5e,
      roughness: 0.12,
      metalness: 0,
      transparent: true,
      opacity: 0.5,
      envMapIntensity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  glass.renderOrder = 4;
  lying.add(glass);
  const scroll = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0128, 0.0128, 0.094, 16),
    new THREE.MeshStandardMaterial({ color: 0xe9d9b8, roughness: 0.9, metalness: 0 })
  );
  scroll.position.y = 0.064;
  scroll.rotation.z = 0.05;
  lying.add(scroll);
  const ribbon = new THREE.Mesh(
    new THREE.TorusGeometry(0.0106, 0.0011, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0xa05a44, roughness: 0.82 })
  );
  ribbon.rotation.x = Math.PI / 2;
  ribbon.position.y = 0.058;
  lying.add(ribbon);
  const cork = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0104, 0.0116, 0.02, 18),
    new THREE.MeshStandardMaterial({ color: 0xb08a5c, roughness: 0.88 })
  );
  cork.position.y = 0.152;
  lying.add(cork);
  bottle.add(lying);
  bottle.rotation.y = -0.78;
  bottle.scale.setScalar(0.58);
  bottle.position.set(-0.165, 0.0145, 0.085);
  g.add(bottle);
  g.add(groundBlob(0.122, 0.042, -0.165, 0.085, -0.78, 0.3));

  // 被海水磨圆的卵石
  const pebbleMats = [0x8a857c, 0x6f6b66, 0x968d7c].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, metalness: 0 })
  );
  const pebbles = [
    [-0.13, 0.126, 0.013, 0.62, pebbleMats[0]],
    [-0.106, 0.144, 0.010, -0.4, pebbleMats[1]],
    [-0.152, 0.15, 0.009, 1.4, pebbleMats[2]],
  ];
  for (const [x, z, r, rot, mat] of pebbles) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), mat);
    p.scale.set(1.35, 0.52, 1.0);
    p.rotation.y = rot;
    p.position.set(x, r * 0.27 + 0.001, z);
    p.castShadow = true;
    p.receiveShadow = true;
    g.add(p);
  }
  g.add(groundBlob(0.088, 0.064, -0.13, 0.14, 0, 0.28));

  // 一只海星：五条臂不写死成对称的，免得读成贴纸
  const star = new THREE.Shape();
  const armR = [0.0245, 0.0212, 0.0249, 0.0223, 0.0237];
  const gapR = [0.0094, 0.0103, 0.0097, 0.0101, 0.0096];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2 + (i % 2 ? 0.06 : -0.04);
    const rr = i % 2 === 0 ? armR[i / 2] : gapR[i >> 1];
    if (i === 0) star.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else star.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  star.closePath();
  const starGeo = new THREE.ExtrudeGeometry(star, {
    depth: 0.004,
    bevelEnabled: true,
    bevelThickness: 0.0016,
    bevelSize: 0.0016,
    bevelSegments: 2,
    curveSegments: 1,
  });
  const starMat = new THREE.MeshStandardMaterial({ color: 0xb4785a, roughness: 0.95, metalness: 0 });
  const starMesh = new THREE.Mesh(starGeo, starMat);
  starMesh.rotation.x = -Math.PI / 2;
  starMesh.rotation.z = 0.62;
  starMesh.position.set(0.186, 0.001, 0.018);
  starMesh.castShadow = true;
  starMesh.receiveShadow = true;
  g.add(starMesh);
  // 中心鼓起一点，侧光下有厚度
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.0072, 14, 10), starMat);
  dome.scale.set(1, 0.5, 1);
  dome.position.set(0.186, 0.0042, 0.018);
  dome.castShadow = true;
  g.add(dome);
  g.add(groundBlob(0.062, 0.062, 0.186, 0.018, 0.62, 0.24));

  return g;
}

function buildDuskProps() {
  const g = new THREE.Group();

  // 旧书两本
  const book = (w, h, d, cloth, x, y, z, yaw) => {
    const b = new THREE.Group();
    const pages = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.006, h - 0.007, d - 0.006),
      new THREE.MeshStandardMaterial({ color: 0xe6dcc4, roughness: 0.9 })
    );
    pages.position.y = h / 2;
    b.add(pages);
    const coverMat = new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.72, metalness: 0 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.0035, d), coverMat);
    top.position.y = h - 0.0017;
    b.add(top);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(w, 0.0035, d), coverMat);
    bottom.position.y = 0.0017;
    b.add(bottom);
    b.position.set(x, y, z);
    b.rotation.y = yaw;
    b.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return b;
  };
  g.add(book(0.145, 0.019, 0.102, 0x3e4a41, -0.175, 0.001, -0.145, 0.34));
  g.add(book(0.128, 0.016, 0.09, 0x5b3a32, -0.168, 0.021, -0.15, 0.22));
  g.add(groundBlob(0.19, 0.15, -0.172, -0.147, 0.3, 0.4));

  // 黄铜烛台：桌面上的暖光源
  const brass = new THREE.MeshStandardMaterial({ color: 0xbc8a4a, metalness: 0.8, roughness: 0.34 });
  const candle = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.031, 0.007, 28), brass);
  base.position.y = 0.0035;
  candle.add(base);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.012, 0.011, 24), brass);
  cup.position.y = 0.0125;
  candle.add(cup);
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.0085, 0.032, 20),
    new THREE.MeshStandardMaterial({ color: 0xf0dfbf, roughness: 0.66 })
  );
  stick.position.y = 0.034;
  candle.add(stick);
  const wick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0007, 0.0007, 0.005, 6),
    new THREE.MeshStandardMaterial({ color: 0x2a2320, roughness: 0.9 })
  );
  wick.position.y = 0.051;
  candle.add(wick);
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.0038, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffc26e })
  );
  flame.scale.set(0.9, 2.1, 0.9);
  flame.position.y = 0.057;
  candle.add(flame);
  const hale = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.8,
    })
  );
  hale.scale.set(0.052, 0.052, 1);
  hale.position.y = 0.057;
  candle.add(hale);
  // 烛光的点光源不进道具组：组的 visible 一关，场景里的光源数量就变，
  // 所有材质的着色器要整体重编译（实测第一次切黄昏卡 150ms）。
  // 它挂到组外、由 buildRoom 常驻场景，非黄昏时强度归零
  const glow = new THREE.PointLight(0xff9a52, 0.12, 1.1, 2);
  glow.position.set(0.145, 0.061, -0.075);
  g.add(glow);
  g.userData.candleGlow = glow;
  candle.position.set(0.145, 0.001, -0.075);
  candle.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  g.add(candle);
  g.add(groundBlob(0.075, 0.075, 0.145, -0.075, 0, 0.38));

  // 马克杯
  const mug = new THREE.Group();
  const mugMat = new THREE.MeshStandardMaterial({ color: 0xe7ddca, roughness: 0.5, metalness: 0 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.025, 0.058, 32, 1, false), mugMat);
  body.position.y = 0.029;
  mug.add(body);
  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(0.0262, 28),
    new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.22, metalness: 0 })
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.052;
  mug.add(inner);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.0043, 10, 22, Math.PI * 1.25), mugMat);
  handle.position.set(0.027, 0.03, 0);
  handle.rotation.y = Math.PI / 2;
  handle.rotation.z = -0.35;
  mug.add(handle);
  mug.scale.setScalar(0.82);
  mug.position.set(-0.106, 0.001, 0.151);
  mug.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  g.add(mug);
  g.add(groundBlob(0.062, 0.062, -0.106, 0.151, 0, 0.34));

  return g;
}

export function buildRoom(scene, envMap, themeId = 'desk') {
  const T0 = THEMES[themeId] || THEMES.desk;
  const wood = makeWoodTextures(T0.wood || 'desk');
  const plaster = makePlasterTexture();
  const outside = makeOutsideTexture(T0.id);

  const deskMat = new THREE.MeshStandardMaterial({
    map: wood.map,
    roughnessMap: wood.roughnessMap,
    color: new THREE.Color(T0.deskTint),
    roughness: 0.62,
    metalness: 0,
    envMapIntensity: T0.deskEnv,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    map: plaster,
    color: new THREE.Color(T0.wall),
    roughness: 0.94,
    metalness: 0,
    envMapIntensity: T0.wallEnv,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(T0.frame),
    roughness: 0.52,
    metalness: 0,
    envMapIntensity: 0.5,
  });

  // 桌面
  const shape = roundedRectShape(TABLE.w, TABLE.d, 0.035);
  const tableGeo = new THREE.ExtrudeGeometry(shape, {
    depth: TABLE.t,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 3,
    curveSegments: 8,
  });
  const table = new THREE.Mesh(tableGeo, deskMat);
  table.rotation.x = Math.PI / 2;
  table.position.y = -0.003;
  table.castShadow = true;
  table.receiveShadow = true;
  scene.add(table);

  // 桌腿（画面外，只负责投影逻辑完整）
  const legMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4c, roughness: 0.8 });
  for (const [lx, lz] of [[-0.52, -0.42], [0.52, -0.42], [-0.52, 0.42], [0.52, 0.42]]) {
    const leg = box(0.05, 0.72, 0.05, legMat, lx, -0.39, lz);
    scene.add(leg);
  }

  // 墙：窗墙（-z，纸的正后方）+ 两侧 + 顶，环绕时不露空
  const wz = WALL.z - WALL.thickness / 2;
  const winMidY = (WIN.y0 + WIN.y1) / 2;
  scene.add(box(2.6, WIN.y0 + 0.75, WALL.thickness, wallMat, 0, (WIN.y0 - 0.75) / 2, wz));
  scene.add(box(2.6, 2.05 - WIN.y1, WALL.thickness, wallMat, 0, (WIN.y1 + 2.05) / 2, wz));
  scene.add(box(1.3 - Math.abs(WIN.x0), WIN.y1 - WIN.y0, WALL.thickness, wallMat, (WIN.x0 - 1.3) / 2, winMidY, wz));
  scene.add(box(1.3 - WIN.x1, WIN.y1 - WIN.y0, WALL.thickness, wallMat, (WIN.x1 + 1.3) / 2, winMidY, wz));
  scene.add(box(0.08, 2.8, 2.0, wallMat, -1.34, 0.65, 0.1));
  scene.add(box(0.08, 2.8, 2.0, wallMat, 1.34, 0.65, 0.1));
  scene.add(box(2.8, 0.08, 2.4, wallMat, 0, 2.02, -0.2));

  const floorMat = new THREE.MeshStandardMaterial({ color: T0.floor, roughness: 0.86, metalness: 0 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.75;
  floor.receiveShadow = true;
  scene.add(floor);

  // 窗框（贴在墙内侧）
  const frameZ = WALL.z + 0.012;
  const fw = 0.04;
  const fd = 0.05;
  const winW = WIN.x1 - WIN.x0;
  const winH = WIN.y1 - WIN.y0;
  scene.add(box(fw, winH + 0.04, fd, frameMat, WIN.x0, winMidY, frameZ));
  scene.add(box(fw, winH + 0.04, fd, frameMat, WIN.x1, winMidY, frameZ));
  scene.add(box(winW + 0.04, fw, fd, frameMat, 0, WIN.y0, frameZ));
  scene.add(box(winW + 0.04, fw, fd, frameMat, 0, WIN.y1, frameZ));
  scene.add(box(fw * 0.8, winH, fd, frameMat, 0, winMidY, frameZ));
  scene.add(box(winW, fw * 0.8, fd, frameMat, 0, WIN.y0 + winH * 0.56, frameZ));
  // 窗台
  scene.add(box(winW + 0.12, 0.03, 0.11, frameMat, 0, WIN.y0 - 0.015, frameZ + 0.03));

  // 玻璃：只做一点点反射
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.06,
    metalness: 0,
    transparent: true,
    opacity: 0.05,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 0.8,
  });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), glassMat);
  glass.position.set(0, winMidY, frameZ - 0.004);
  scene.add(glass);

  // 窗外：绿意与天光。景片要放到 12m 外、尺寸按透视等比放大：
  // 飞机得飞远到消失，近处的景片（原来 z=-1.5）会把它挡在半空当摆设。
  // 放远后穿过窗洞看出去画幅基本不变，还多了一点视差纵深。
  // 中心沿基础机位的视线平移到景片所在深度（居中会把窗景整体挪位）。
  const outMat = new THREE.MeshBasicMaterial({ map: outside });
  const out = new THREE.Mesh(new THREE.PlaneGeometry(20, 16), outMat);
  out.position.set(-1.6, 0.96, -12);
  scene.add(out);

  // 道具组：三套全部建好，按主题切 visible
  const propGroups = {
    desk: buildDeskProps(),
    coast: buildCoastProps(),
    dusk: buildDuskProps(),
  };
  for (const [id, grp] of Object.entries(propGroups)) {
    grp.visible = id === T0.props;
    scene.add(grp);
  }
  // 烛光常驻场景（理由见 buildDuskProps），只在黄昏点亮
  const candleGlow = propGroups.dusk.userData.candleGlow;
  propGroups.dusk.remove(candleGlow);
  candleGlow.intensity = T0.props === 'dusk' ? 0.12 : 0;
  scene.add(candleGlow);

  // 接触阴影
  const shadowTex = makeContactShadow();
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    color: 0x000000,
  });
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.56), shadowMat);
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(-0.01, 0.0011, -0.02);
  contact.renderOrder = 2;
  scene.add(contact);

  // 窗光落在地上的一点暖色
  const patchMat = new THREE.MeshBasicMaterial({
    map: makeLightPatchTexture(),
    color: new THREE.Color(T0.patch),
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), patchMat);
  patch.rotation.x = -Math.PI / 2;
  patch.position.set(0.0, 0.0013, 0.1);
  patch.material.opacity = 0.12;
  scene.add(patch);

  // 光照：主题决定色温与角度（窗在纸后方，逆光）
  const sun = new THREE.DirectionalLight(new THREE.Color(T0.sun.color), T0.sun.intensity);
  sun.position.set(...T0.sun.pos);
  sun.target.position.set(0, 0, 0.05);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -1.1;
  sun.shadow.camera.right = 1.1;
  sun.shadow.camera.top = 1.1;
  sun.shadow.camera.bottom = -1.1;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 6.0;
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.00015;
  sun.shadow.normalBias = 0.0015;
  sun.shadow.radius = 3;
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(T0.hemi.sky, T0.hemi.ground, T0.hemi.intensity);
  scene.add(hemi);

  const fill = new THREE.DirectionalLight(new THREE.Color(T0.fill.color), T0.fill.intensity);
  fill.position.set(-0.6, 0.9, 1.4);
  scene.add(fill);

  scene.environment = envMap;

  // 换背景：只改参数不重建几何。envMap 由 main.js 按主题重建后写回 scene.environment
  function setTheme(id) {
    const T = THEMES[id] || THEMES.desk;
    if (scene.background && scene.background.isColor) scene.background.setHex(T.background);
    wallMat.color.setHex(T.wall);
    deskMat.color.setHex(T.deskTint);
    deskMat.envMapIntensity = T.deskEnv;
    wallMat.envMapIntensity = T.wallEnv;
    frameMat.color.setHex(T.frame);
    floorMat.color.setHex(T.floor);
    // 木料是懒生成 + 缓存的，切过来只换贴图引用。
    // 这里不设 needsUpdate：贴图换引用不需要重编译着色器，设了反而会在
    // 点击那一刻强制走一遍材质更新，切换更顿
    const w = makeWoodTextures(T.wood || 'desk');
    if (deskMat.map !== w.map) {
      deskMat.map = w.map;
      deskMat.roughnessMap = w.roughnessMap;
    }
    for (const [pid, grp] of Object.entries(propGroups)) grp.visible = pid === T.props;
    candleGlow.intensity = T.props === 'dusk' ? 0.12 : 0;
    sun.color.setHex(T.sun.color);
    sun.intensity = T.sun.intensity;
    sun.position.set(...T.sun.pos);
    hemi.color.setHex(T.hemi.sky);
    hemi.groundColor.setHex(T.hemi.ground);
    hemi.intensity = T.hemi.intensity;
    fill.color.setHex(T.fill.color);
    fill.intensity = T.fill.intensity;
    patchMat.color.setHex(T.patch);
    const tex = makeOutsideTexture(T.id);
    if (outMat.map !== tex) {
      outMat.map = tex;
      outMat.needsUpdate = true;
    }
    return T;
  }

  return {
    sun,
    hemi,
    fill,
    table,
    contactShadow: contact,
    lightPatch: patch,
    windowRect: WIN,
    tableRect: TABLE,
    setTheme,
    // 三套道具组的材质要等第一次显示时才编译着色器（烛光的 Sprite 最明显），
    // 提前把组临时打开编译一遍，切过去就不会顿一下。
    // 着色器变体按渲染目标区分：直接渲到屏幕是 srgb，渲进后处理的 HDR target
    // 是 srgb-linear。compile() 在默认状态下只烘出屏幕版，场景里第一次用到
    // linear 版还得现编（实测 150ms）。临时挂一个线性 RT 再编译，两种都齐
    warmProps(renderer, camera) {
      const prev = {};
      for (const [pid, grp] of Object.entries(propGroups)) {
        prev[pid] = grp.visible;
        grp.visible = true;
      }
      const rt = new THREE.WebGLRenderTarget(4, 4);
      try {
        renderer.setRenderTarget(rt);
        renderer.compile(scene, camera);
      } finally {
        renderer.setRenderTarget(null);
        rt.dispose();
        for (const [pid, grp] of Object.entries(propGroups)) grp.visible = prev[pid];
      }
    },
    // 空闲时预生成某套主题的贴图（木料 + 景片），返回给主线程提前上传 GPU
    prewarm(id) {
      const T = THEMES[id];
      if (!T) return null;
      return {
        wood: makeWoodTextures(T.wood || 'desk'),
        outside: makeOutsideTexture(id),
      };
    },
  };
}
