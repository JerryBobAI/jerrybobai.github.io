// 入口：探测 → 建场 → 折纸 → 交互 → 后期
import * as THREE from 'three';
import { buildSheet, wingOpen, PAPER, RECIPES, DEFAULT_RECIPE, clamp01 } from './paper/engine.js';
import {
  makePrintCanvas,
  makePrintTexture,
  makePaperFiber,
  makeCreaseMap,
} from './paper/texture.js';
import { PaperMesh } from './paper/mesh.js';
import { buildEnvironment } from './scene/env.js';
import { buildRoom } from './scene/room.js';
import { buildDust } from './scene/dust.js';
import { THEMES } from './scene/themes.js';
import { Pipeline } from './render/pipeline.js';
import { CameraRig } from './camera.js';
import { Interaction } from './interact.js';
import { Flight } from './flight.js';
import { createUI } from './ui.js';
import { PaperAudio } from './audio.js';
import { looksLikeHeif, isHeifByMagic, decodeHeif, loadImageBlob } from './heic.js';

const params = new URLSearchParams(location.search);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function loadImage(src, timeoutMs = 2600) {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      finish(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      finish(null);
    };
    img.src = src;
  });
}

async function init() {
  const spec = await fetch('./spec.json').then((r) => r.json());
  const canvas = document.getElementById('stage');

  const lowQuality = params.get('quality') === 'low';
  const baseDpr = Math.min(window.devicePixelRatio || 1, lowQuality ? 1 : 2);
  let renderScale = lowQuality ? 0.85 : 1;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    stencil: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(baseDpr * renderScale);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();

  // 背景：URL 优先（?bg=coast 给分享/QA 用），其次上次的选择
  const savedTheme = localStorage.getItem('paper-theme');
  let themeId = THEMES[params.get('bg')]
    ? params.get('bg')
    : THEMES[savedTheme]
      ? savedTheme
      : 'desk';
  const T0 = THEMES[themeId];
  scene.background = new THREE.Color(T0.background);

  const envRT = buildEnvironment(renderer, themeId);
  const room = buildRoom(scene, envRT.texture, themeId);
  const dust = buildDust();
  dust.setMood(T0.dust, T0.dustColor);
  scene.add(dust.points);

  const rig = new CameraRig(spec);
  rig.resize(window.innerWidth / window.innerHeight);

  const pipeline = new Pipeline(renderer, spec);

  // ---- 纸张 ----
  const defaultImg = await loadImage('./assets/default-photo.jpg');
  // 「完整显示/铺满」重裁切要用当前这张图（上传过就是上传的那张）
  let currentImg = defaultImg;
  let fitMode = 'cover';
  const printCanvas = makePrintCanvas(defaultImg, fitMode, 17);
  let printTex = makePrintTexture(printCanvas);
  const fiber = makePaperFiber();

  // 折法：五种机型，折痕图按各自的翼根线生成
  let recipeId = RECIPES[params.get('style')] ? params.get('style') : DEFAULT_RECIPE;
  rig.setReadyProfile(RECIPES[recipeId].ready);
  const creaseMaps = new Map();
  const creaseFor = (id) => {
    if (!creaseMaps.has(id)) creaseMaps.set(id, makeCreaseMap(PAPER, RECIPES[id].wingX));
    return creaseMaps.get(id);
  };

  const paper = new PaperMesh(printTex, fiber);

  const flightGroup = new THREE.Group();
  const paperGroup = new THREE.Group();
  paperGroup.rotation.x = -Math.PI / 2;
  paperGroup.position.set(0, 0.0008, 0);
  paperGroup.add(paper.group);
  flightGroup.add(paperGroup);
  scene.add(flightGroup);

  const flight = new Flight(flightGroup);
  // 停放朝向：机头指向窗户（世界 -z），略微偏左，让双翼的 V 形在画面里展开
  const PARK_YAW = 0.72;

  // ---- 状态 ----
  let progress = 0;
  let auto = false;
  let state = 'photo';
  let lastBuilt = -1;
  let readyFrames = 0;
  let readyMarked = false;

  // 成品质心补偿：机头三角折回之后，整机重心落在纸面后方约 6cm，
  // 不管它的话成品会整个偏到画面右后方，和桌面的接触阴影也对不上。
  const _rotX = new THREE.Matrix4();
  const _rotY = new THREE.Matrix4();
  const _mat = new THREE.Matrix4();
  function parkedShift(open) {
    if (open < 1e-4) return [0, 0];
    const pos = paper.geometry.getAttribute('position').array;
    const n = paper.geometry.drawRange.count;
    if (!n) return [0, 0];
    // 纸→飞行组：paperGroup 绕 X 转 -90°，paper.group 绕 Y 转 roll
    _rotX.makeRotationX(-Math.PI / 2);
    _rotY.makeRotationY(paper.group.rotation.y);
    _mat.multiplyMatrices(_rotX, _rotY);
    // 用顶点质心而不是包围盒中心：停放时整机还要绕 Y 转 PARK_YAW，
    // 包围盒中心转过去就不再是中心（实测偏 1.7cm），质心是线性变换，转多少都对得上
    const e = _mat.elements;
    let sx = 0; let sz = 0;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3]; const y = pos[i * 3 + 1]; const z = pos[i * 3 + 2];
      sx += e[0] * x + e[4] * y + e[8] * z;
      sz += e[2] * x + e[6] * y + e[10] * z;
    }
    return [-(sx / n) * open, -(sz / n) * open];
  }

  function applyProgress(force = false) {
    progress = clamp01(progress);
    if (!force && Math.abs(progress - lastBuilt) < 1e-4) return;
    lastBuilt = progress;
    const faces = buildSheet(progress, recipeId);
    paper.update(faces, creaseFor(recipeId).at);
    // 展翼的同时整机绕长轴滚 90°：龙骨立起来，双翼水平展开
    const open = wingOpen(RECIPES[recipeId], progress);
    paper.group.rotation.y = (open * Math.PI) / 2;
    // 落桌高度按纸张真实最低点算：成品上反角把翼尖压到桌面以下 7.5mm，
    // 不抬起来的话翼尖会穿进桌板（用户实锤「机翼陷进去」）。纸是躺在桌上的，
    // 最低点永远贴着桌面，所以整张纸随折叠抬降——而不是让一半扎进木头里。
    const th = (open * Math.PI) / 2;
    const sinT = Math.sin(th);
    const cosT = Math.cos(th);
    let minH = Infinity;
    for (const f of faces) {
      for (const vt of f.verts) {
        const h = -vt.p.x * sinT + (vt.p.z + vt.level * PAPER.GAP) * cosT;
        if (h < minH) minH = h;
      }
    }
    if (Number.isFinite(minH)) paperGroup.position.y = 0.0008 - minH;
    const [sx, sz] = parkedShift(open);
    paperGroup.position.x = sx;
    paperGroup.position.z = sz;
    room.contactShadow.scale.setScalar(1 - 0.16 * progress);
    room.contactShadow.material.opacity = 0.55 - 0.14 * progress;
    ui.setProgress(progress);
    window.__progress = progress;
  }

  // 折痕落位的声音：只认向前跨过阶段终点，往回拖不出声；展翼过半再来一小段纸页抖动
  function soundProgress(from, to) {
    if (!(to > from)) return;
    const R = RECIPES[recipeId];
    for (const s of R.stages) {
      if (from < s.end && to >= s.end) audio.crease(s.key === 'wing' ? 0.75 : 0.9);
    }
    if (wingOpen(R, from) < 0.5 && wingOpen(R, to) >= 0.5) audio.flutter(1);
  }

  // 滑杆纸声：按真实拖动速率出，手停下来纸声跟着收
  let seekSound = { p: 0, t: performance.now() };
  const ui = createUI({
    // 控件音效统一由 ui.js 的委托监听发出来（tap/hover/select/...），这里只转发
    onUiSfx: (kind, arg) => audio.ui(kind, arg),
    onFold: () => startFold(),
    onSeek: (p) => {
      const now = performance.now();
      const dt = Math.max(0.016, (now - seekSound.t) / 1000);
      audio.foldActivity(Math.abs(p - seekSound.p) / dt);
      soundProgress(progress, p);
      seekSound = { p, t: now };
      seek(p);
    },
    onSeekStart: () => {
      auto = false;
      seekSound = { p: progress, t: performance.now() };
      // 按住滑杆不动就不会有 input 事件，自动折停在中途时状态要跟着落到
      // photo/ready，否则一直停在 folding，折成/上传/折法全灰，页面像卡死
      if (state === 'folding') setState(progress >= 0.9995 ? 'ready' : 'photo');
    },
    onUpload: (file) => handleUpload(file),
    onFit: (mode) => {
      fitMode = mode;
      // 用当前这张（可能是用户上传的）重新裁切，别退回默认素材
      rebuildPrint(currentImg);
    },
    onRetrieve: () => retrieve(),
    onRefly: () => refly(),
    onRecipe: (id) => setRecipe(id),
    onSoundToggle: (on) => audio.setOn(on),
    onSoundVolume: (kind, v) => audio.setVolume(kind, v),
    onTheme: (id) => setTheme(id),
  });
  ui.setRecipe(recipeId);
  ui.setTheme(themeId);
  window.__recipe = recipeId;
  window.__theme = themeId;

  // 换背景：材质与灯光参数由 room 改，环境反射换成该主题烘好的 PMREM
  const envCache = new Map([[themeId, envRT]]);

  // 空闲时把另外两套主题的贴图与 PMREM 提前烘好、上传到 GPU。
  // 不预热的话，第一次切到某套背景要在点击那一刻生成木纹/景片、还编译 PMREM，
  // 主线程会被按下去半秒到两秒，读起来就是「切场景很卡」
  let propsWarmed = false;
  function warmThemes(ids) {
    const id = ids.shift();
    if (!id) return;
    // 第一轮先把三套道具的材质编译掉（第一次进黄昏那盏烛光的 Sprite 要 150ms）
    if (!propsWarmed) {
      propsWarmed = true;
      room.warmProps?.(renderer, rig.camera);
    }
    const t = room.prewarm(id);
    if (t) {
      renderer.initTexture(t.wood.map);
      renderer.initTexture(t.wood.roughnessMap);
      renderer.initTexture(t.outside);
    }
    if (!envCache.has(id)) {
      const rt = buildEnvironment(renderer, id);
      envCache.set(id, rt);
      renderer.initTexture(rt.texture);
    }
    setTimeout(() => warmThemes(ids), 140);
  }

  function setTheme(id) {
    const T = THEMES[id];
    if (!T || id === themeId) return;
    themeId = id;
    room.setTheme(id);
    let rt = envCache.get(id);
    if (!rt) {
      rt = buildEnvironment(renderer, id);
      envCache.set(id, rt);
      renderer.initTexture(rt.texture);
    }
    if (scene.environment !== rt.texture) scene.environment = rt.texture;
    dust.setMood(T.dust, T.dustColor);
    localStorage.setItem('paper-theme', id);
    ui.setTheme(id);
    window.__theme = id;
  }

  const audio = new PaperAudio({ onChange: (s) => ui.paintSound(s) });
  ui.paintSound(audio.snapshot());
  window.__audio = audio;

  // UI 内部的 fit 初值是 contain，这里对齐实际默认值，否则按钮文案与实际模式相反
  ui.setFit(fitMode);

  function setState(next) {
    state = next;
    ui.setState(next);
  }

  function startFold() {
    if (state === 'flying' || state === 'folding') return;
    if (state === 'ready' || state === 'away') {
      flight.reset();
      audio.duck(false);
      progress = 0;
      lastBuilt = -1;
      applyProgress(true);
    }
    audio.crease(0.55);
    if (reduced) {
      auto = false;
      progress = 1;
      applyProgress(true);
      audio.flutter(1);
      setState('ready');
      return;
    }
    auto = true;
    setState('folding');
  }

  function seek(p) {
    if (state === 'flying') return;
    // 飞走/回收中拖滑杆：纸不在桌上，必须先把飞行组收回原位，
    // 否则状态切回 photo 但纸停在窗外，画面上一张纸都没有
    if (flight.mode !== 'idle') {
      flight.reset();
      audio.windOn(false);
      audio.duck(false);
    }
    auto = false;
    progress = clamp01(p);
    applyProgress(true);
    if (progress >= 0.9995) setState('ready');
    else setState('photo');
  }

  function launch() {
    if (state !== 'ready' || flight.mode !== 'idle') return;
    flight.start(RECIPES[recipeId].flight);
    audio.whoosh();
    audio.windOn(true);
    audio.duck(true);
    setState('flying');
  }

  function retrieve() {
    if (state !== 'away') return;
    // 落稳之后再解除音乐的让位
    flight.retrieve(() => audio.duck(false));
    audio.windOn(false);
    audio.retrieve();
    setState('ready');
  }

  function refly() {
    if (state !== 'away') return;
    // 不瞬移回桌面：走和「取回」同一条回程，落稳之后再出手，两段动效各看得到一次
    flight.retrieve(() => {
      audio.duck(false);
      launch();
    });
    audio.windOn(false);
    audio.retrieve();
    setState('ready');
  }

  function setRecipe(id) {
    if (!RECIPES[id] || id === recipeId) return;
    if (state === 'flying') return;
    recipeId = id;
    ui.setRecipe(id);
    rig.setReadyProfile(RECIPES[id].ready);
    window.__recipe = id;
    audio.paperFlip();
    // 换折法从头折：直接套新配方到当前进度会停在「折了一半的另一种飞机」上，
    // 看起来像坏了。先回到平面照片，再整段重播一遍新折法。
    flight.reset();
    progress = 0;
    lastBuilt = -1;
    applyProgress(true);
    setState('photo');
    startFold();
  }

  flight.onEnd(() => {
    audio.windOn(false);
    audio.duck(false);
    setState('away');
  });

  function rebuildPrint(img) {
    const canvas = makePrintCanvas(img, fitMode, 17);
    const tex = makePrintTexture(canvas);
    paper.setPrintTexture(tex);
    const old = printTex;
    printTex = tex;
    old?.dispose();
  }

  async function handleUpload(file) {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      ui.toast('照片太大了，换一张 15MB 以内的。');
      return;
    }
    try {
      let img;
      try {
        // Safari 能原生解 HEIC；Chrome/Edge/Firefox 走下面的 wasm 兜底
        img = await loadImageBlob(file);
      } catch (nativeErr) {
        if (!looksLikeHeif(file) && !(await isHeifByMagic(file))) throw nativeErr;
        ui.toast('正在读取 HEIC 照片…', 8000);
        const jpeg = await decodeHeif(file);
        img = await loadImageBlob(jpeg);
        ui.hideToast();
      }
      // 换完不弹提示：纸面自己会变，每选一张都弹同一句会被读成「没换」
      currentImg = img;
      rebuildPrint(img);
      audio.paperFlip();
      // 换照片回到初始状态：整张纸摊平，由用户重新点「折成飞机」再开始，
      // 不自动折（自动折会把还没看的新照片直接卷走）
      auto = false;
      flight.reset();
      progress = 0;
      lastBuilt = -1;
      applyProgress(true);
      setState('photo');
    } catch {
      ui.toast('这张图读不出来，换一张试试。');
    }
  }

  // 点飞机才放飞：先做一次射线拾取，拖拽则一律让给环视，避免转视角误飞
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function hitPlane(clientX, clientY) {
    if (state !== 'ready' || flight.mode !== 'idle') return false;
    const r = canvas.getBoundingClientRect();
    ndc.set(
      ((clientX - r.left) / r.width) * 2 - 1,
      -((clientY - r.top) / r.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, rig.camera);
    return raycaster.intersectObjects(paper.pickTargets(), false).length > 0;
  }

  const controller = {
    canLaunch: () => state === 'ready' && flight.mode === 'idle',
    hitPlane,
    launch: () => launch(),
  };

  const interaction = new Interaction({ canvas, rig, controller });

  // ---- 尺寸 ----
  function resize() {
    const w = Math.max(320, window.innerWidth);
    const h = Math.max(240, window.innerHeight);
    renderer.setPixelRatio(baseDpr * renderScale);
    renderer.setSize(w, h, false);
    pipeline.setSize(w, h);
    rig.resize(w / h);
  }
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) resize();
  });
  resize();

  // 初始进度
  const rawP = Number(params.get('p'));
  const p0 = params.has('p') && Number.isFinite(rawP) ? clamp01(rawP) : 0;
  progress = p0;
  applyProgress(true);
  if (p0 >= 0.9995) setState('ready');
  else setState('photo');

  if (params.get('ui') === '0') document.getElementById('ui').style.display = 'none';

  // ---- 循环 ----
  const clock = new THREE.Clock();
  let time = 0;
  let frameMs = 0;
  let slowStreak = 0;
  let checkedFrames = 0;

  function tick() {
    requestAnimationFrame(tick);
    const rawDt = clock.getDelta();
    const dt = Math.min(0.05, rawDt);
    time += dt;

    if (auto) {
      const prev = progress;
      progress = Math.min(1, progress + dt / PAPER.AUTO_SECONDS);
      applyProgress();
      audio.foldActivity(1 / PAPER.AUTO_SECONDS);
      soundProgress(prev, progress);
      if (progress >= 1) {
        auto = false;
        setState('ready');
      }
    }
    audio.update();

    if (flight.mode === 'flying' || flight.mode === 'returning') flight.update(dt);
    paper.setOpacity(flight.opacity);

    // 停放时的机头朝向：成品朝窗户，没折完则回正
    if (flight.mode === 'idle') {
      const k = 1 - Math.exp(-8 * dt);
      const targetYaw = state === 'ready' ? PARK_YAW : 0;
      flightGroup.rotation.y += (targetYaw - flightGroup.rotation.y) * k;
      flightGroup.rotation.x += (0 - flightGroup.rotation.x) * k;
      flightGroup.rotation.z += (0 - flightGroup.rotation.z) * k;
      flightGroup.position.y += (0 - flightGroup.position.y) * k;
    }

    rig.update(dt, {
      // 回程也把机身位置交给相机，只为跟焦——构图的跟随仍然只认 flying
      planePos: flight.mode === 'flying' || flight.mode === 'returning' ? flight.group.position : null,
      flightActive: flight.mode === 'flying',
      returnU: flight.returnU,
      flightU: flight.mode === 'flying' ? flight.t : 0,
      mode: state,
    });
    pipeline.setFocus(rig.focus);
    dust.update(time, renderer.getPixelRatio());

    pipeline.render(scene, rig.camera, time);

    frameMs = frameMs * 0.92 + rawDt * 1000 * 0.08;
    checkedFrames++;
    if (checkedFrames > 90) {
      if (frameMs > 24 && renderScale > 0.62) slowStreak++;
      else slowStreak = 0;
      if (slowStreak >= 2) {
        renderScale = Math.max(0.62, renderScale - 0.14);
        slowStreak = 0;
        resize();
      }
      checkedFrames = 0;
    }

    if (!readyMarked) {
      readyFrames++;
      if (readyFrames >= 2) {
        readyMarked = true;
        window.__ready = true;
        ui.ready();
        // 换背景要用的贴图与 PMREM 在空闲时分批预生成，避免第一次切换卡一下
        setTimeout(() => warmThemes(Object.keys(THEMES).filter((t) => t !== themeId)), 700);
      }
    }
  }

  window.__page = {
    scene,
    renderer,
    pipeline,
    rig,
    flight,
    get state() {
      return state;
    },
    get progress() {
      return progress;
    },
    get recipe() {
      return recipeId;
    },
    get parkYaw() {
      return PARK_YAW;
    },
    setProgress: seek,
    startFold,
    launch,
    setRecipe,
    setTheme,
    get theme() {
      return themeId;
    },
    hitPlane,
    // QA 用：纸飞机的屏幕坐标（点击放飞前要落在它身上）
    planeScreen() {
      const pos = paper.geometry.getAttribute('position').array;
      const n = paper.geometry.drawRange.count;
      const v = new THREE.Vector3();
      for (let i = 0; i < n; i++) v.x += pos[i * 3], v.y += pos[i * 3 + 1], v.z += pos[i * 3 + 2];
      v.multiplyScalar(1 / Math.max(1, n));
      paper.group.localToWorld(v);
      v.project(rig.camera);
      return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
    },
    recipes: RECIPES,
    paper,
    audio,
    room,
  };
  window.__setProgress = seek;
  window.__progress = progress;

  tick();
}

init().catch((err) => {
  console.error(err);
  const loader = document.getElementById('loader');
  if (!loader) return;
  loader.textContent = '';
  const line1 = document.createElement('div');
  line1.textContent = '这个浏览器暂时开不了这场折叠。';
  const line2 = document.createElement('div');
  line2.style.cssText = 'font-size:11px;opacity:.6;letter-spacing:.08em;margin-top:10px;max-width:70vw;text-align:center';
  line2.textContent = err && err.message ? String(err.message).slice(0, 120) : 'WebGL / 资源加载失败';
  loader.append(line1, line2);
});
