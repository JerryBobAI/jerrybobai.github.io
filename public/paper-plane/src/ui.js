// 轻量 UI：折法选择、进度轨、上传、状态文案
import { RECIPES } from './paper/engine.js';

export function createUI({
  onFold, onSeek, onSeekStart, onUpload, onFit, onRetrieve, onRefly, onRecipe,
  onSoundToggle, onSoundVolume, onTheme, onUiSfx,
}) {
  const $ = (id) => document.getElementById(id);
  const dock = $('dock');
  const foldBtn = $('foldBtn');
  const fileInput = $('file');
  const uploadBtn = $('uploadBtn');
  const fitBtn = $('fitBtn');
  const rail = $('rail');
  const hints = $('hint');
  const ticksEl = $('ticks');
  const recipeBtns = [...document.querySelectorAll('#styles button')];
  const away = $('away');
  const retrieveBtn = $('retrieveBtn');
  const reflyBtn = $('reflyBtn');
  const toastEl = $('toast');
  const loader = $('loader');
  const sound = $('sound');
  const soundBtn = $('soundBtn');
  const soundPanel = $('soundPanel');
  const soundOn = $('soundOn');
  const soundOnText = $('soundOnText');
  const soundHint = $('soundHint');
  const volMusic = $('volMusic');
  const volSfx = $('volSfx');
  const volMusicV = $('volMusicV');
  const volSfxV = $('volSfxV');
  // 设置面板的两页：声音 / 背景
  const tabSound = $('tabSound');
  const tabBg = $('tabBg');
  const paneSound = $('paneSound');
  const paneBg = $('paneBg');
  const bgList = $('bgList');
  const themeBtns = bgList ? [...bgList.querySelectorAll('button[data-theme]')] : [];

  let state = 'photo';
  let fit = 'cover';
  let tickEls = [...ticksEl.querySelectorAll('span')];
  let toastTimer = 0;
  // 手机上「左键/右键/滚轮」这套说辞不成立，提示语换成手势版
  const touchFirst =
    window.matchMedia('(pointer: coarse)').matches ||
    (navigator.maxTouchPoints > 0 && window.innerWidth <= 820);
  // 悬停音只在真有指针的设备上响：触屏的 pointerenter 是按下时补发的，会和 tap 撞在一起
  const hoverable = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // 所有控件音效都从这里出，统一走一个入口，方便集中限流和静音
  const sfx = (kind, arg) => onUiSfx?.(kind, arg);

  const setRailFill = (p) => {
    rail.style.setProperty('--fill', `${(p * 100).toFixed(2)}%`);
  };

  // 跨过一道折痕就点亮一个标签，同时补一声 stage——滑杆才有「一格一格」的手感。
  // silent 用于程序化设进度（换折法、重建后回位），不该被当成用户在拖
  let passedStages = 0;
  const markTicks = (p, silent = false) => {
    const R = RECIPES[currentRecipe] || RECIPES.dart;
    let passed = 0;
    tickEls.forEach((el, i) => {
      const on = p + 1e-6 >= (R.stages[i]?.end ?? 1);
      el.classList.toggle('on', on);
      if (on) passed++;
    });
    if (!silent && passed !== passedStages) sfx('stage', passed);
    passedStages = passed;
  };

  const setProgress = (p) => {
    rail.value = String(Math.round(p * 1000));
    setRailFill(p);
    markTicks(p, true);
  };

  let currentRecipe = 'dart';
  const setRecipe = (id) => {
    currentRecipe = id;
    const R = RECIPES[id] || RECIPES.dart;
    ticksEl.textContent = '';
    for (const s of R.stages) {
      const sp = document.createElement('span');
      sp.textContent = s.label;
      ticksEl.append(sp);
    }
    tickEls = [...ticksEl.children];
    recipeBtns.forEach((b) => b.setAttribute('aria-pressed', b.dataset.recipe === id ? 'true' : 'false'));
    const active = recipeBtns.find((b) => b.dataset.recipe === id);
    if (active && R.desc) active.title = R.desc;
    setProgress(Number(rail.value) / 1000);
  };

  const stateHints = (next) => {
    const isPhoto = next === 'photo';
    const isFolding = next === 'folding';
    const isReady = next === 'ready';
    const isFlying = next === 'flying';
    const isAway = next === 'away';
    if (isPhoto) hints.textContent = '选一种折法，拖滑杆逐折查看，或按「折成飞机」。';
    else if (isFolding) hints.textContent = '沿着折痕，一点一点。';
    else if (isReady)
      hints.textContent = touchFirst
        ? '点一下纸飞机放飞 · 单指拖拽环视 · 双指捏合缩放'
        : '点一下纸飞机放飞 · 拖拽环视 · 滚轮缩放';
    else if (isFlying) hints.textContent = '它飞出去了。';
    else if (isAway) hints.textContent = '它飞远了，融进窗外的绿意里。';
  };

  const setState = (next) => {
    state = next;
    const isFolding = state === 'folding';
    const isFlying = state === 'flying';
    const isPhoto = state === 'photo';
    const isReady = state === 'ready';
    const isAway = state === 'away';

    foldBtn.hidden = isFlying || isAway;
    foldBtn.disabled = isFolding;
    foldBtn.textContent = isPhoto ? '折成飞机' : '重新折一遍';
    foldBtn.classList.toggle('primary', isPhoto || isReady);

    uploadBtn.classList.toggle('disabled', isFolding || isFlying);
    fitBtn.disabled = isFolding || isFlying;
    rail.disabled = isFlying;
    recipeBtns.forEach((b) => {
      b.disabled = isFolding || isFlying;
    });

    away.classList.toggle('show', isAway);
    dock.classList.toggle('hidden', isFlying);

    stateHints(next);
  };

  const toast = (msg, ms = 2200) => {
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
  };

  const hideToast = () => {
    clearTimeout(toastTimer);
    toastEl.classList.remove('show');
  };

  const setFit = (mode) => {
    fit = mode;
    fitBtn.setAttribute('aria-pressed', mode === 'cover' ? 'true' : 'false');
    fitBtn.textContent = mode === 'cover' ? '铺满纸面' : '完整显示';
  };

  const ready = () => {
    loader.classList.add('done');
    setTimeout(() => loader.remove(), 700);
  };

  foldBtn.addEventListener('click', () => onFold());
  rail.addEventListener('pointerdown', () => onSeekStart?.());
  rail.addEventListener('input', () => {
    const p = Number(rail.value) / 1000;
    setRailFill(p);
    markTicks(p);
    onSeek(p);
  });

  for (const b of recipeBtns) {
    b.addEventListener('click', () => onRecipe?.(b.dataset.recipe));
  }

  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) onUpload(f);
    fileInput.value = '';
  });

  fitBtn.addEventListener('click', () => {
    const next = fit === 'cover' ? 'contain' : 'cover';
    setFit(next);
    onFit(next);
  });

  retrieveBtn.addEventListener('click', () => onRetrieve());
  reflyBtn.addEventListener('click', () => onRefly());

  // ---- 声音：右上角按钮开小面板 ----
  // 用 .open 而不是 [hidden]：面板要有淡入 + 上移的过渡，display 开关会把过渡整段跳过
  const isSoundOpen = () => soundPanel.classList.contains('open');
  const openSound = (open) => {
    if (open === isSoundOpen()) return;
    soundPanel.classList.toggle('open', open);
    sound.classList.toggle('open', open);
    soundBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    sfx(open ? 'open' : 'close');
  };
  soundBtn.addEventListener('click', () => openSound(!isSoundOpen()));
  soundHint.addEventListener('click', () => {
    // 提示本身就是一次点击手势，audio 的常驻监听会顺手解锁
    openSound(true);
  });

  // ---- 设置面板的页签 ----
  // 声音原来独占一个喇叭按钮，读起来像「点一下就把声音关了」；收进设置后
  // 第一页管声音、第二页管背景，字号和开关语义都不变
  const setTab = (name) => {
    const isSound = name === 'sound';
    tabSound.setAttribute('aria-selected', String(isSound));
    tabBg.setAttribute('aria-selected', String(!isSound));
    paneSound.hidden = !isSound;
    paneBg.hidden = isSound;
  };
  tabSound.addEventListener('click', () => setTab('sound'));
  tabBg.addEventListener('click', () => setTab('bg'));

  for (const b of themeBtns) {
    b.addEventListener('click', () => {
      if (b.getAttribute('aria-pressed') === 'true') return;
      onTheme?.(b.dataset.theme);
    });
  }
  soundOn.addEventListener('click', () => onSoundToggle?.(soundOn.getAttribute('aria-checked') !== 'true'));
  const bindVol = (input, label, kind) => {
    // 音量按 10% 一档发 step 声，连续拖动时才不会变成嗡鸣
    let lastStep = Math.round(Number(input.value) / 10);
    input.addEventListener('input', () => {
      const v = Number(input.value) / 100;
      label.textContent = `${Math.round(v * 100)}%`;
      onSoundVolume?.(kind, v);
      const step = Math.round(Number(input.value) / 10);
      if (step !== lastStep) {
        lastStep = step;
        sfx('step');
      }
    });
  };
  bindVol(volMusic, volMusicV, 'music');
  bindVol(volSfx, volSfxV, 'sfx');

  // 点面板外面只收面板；落点在画布上时把这次 pointerup 一起吞掉，
  // 否则用户只是想关面板，镜头却被拖了一下
  let swallowUp = false;
  document.addEventListener('pointerdown', (e) => {
    if (!isSoundOpen()) return;
    if (soundPanel.contains(e.target) || soundBtn.contains(e.target)) return;
    openSound(false);
    if (e.target instanceof HTMLCanvasElement) {
      swallowUp = true;
      e.stopPropagation();
    }
  }, true);
  document.addEventListener('pointerup', (e) => {
    if (!swallowUp) return;
    swallowUp = false;
    e.stopPropagation();
  }, true);
  // 面板开着时 Esc 只关面板，不能顺手触发场景快捷键
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSoundOpen()) {
      openSound(false);
      e.stopImmediatePropagation();
    }
  }, true);

  // ---- 控件音效：委托一层统一听，省得每个按钮自己挂一遍 ----
  // pointerenter 不冒泡，用捕获阶段在 document 上收；点击用捕获是为了赶在
  // 元素自己的 handler 之前发声，音画同步才不会慢半拍
  // e.target 不一定有 closest：CDP 合成的点击、落在 document/svg 上的事件都可能没有
  const clickable = (el) => (el && typeof el.closest === 'function' ? el.closest('button, .btn') : null);
  document.addEventListener('click', (e) => {
    const el = clickable(e.target);
    if (!el || el.disabled || el.classList.contains('disabled')) return;
    if (el.closest('input')) return;              // 滑杆/音量条自己发 step 声
    // 这两个的点击已经有面板开合声/开关声，再叠一层 tap 会糊
    if (el.id === 'soundBtn' || el.id === 'soundHint') return;
    // 捕获阶段先于元素自身 handler：这里读到的 aria-checked 还是切换前的值，
    // 关闭声也能在 mute 生效之前完整放完
    const kind = el.id === 'soundOn'
      ? (el.getAttribute('aria-checked') === 'true' ? 'toggleOff' : 'toggleOn')
      : el.dataset.recipe || el.dataset.theme ? 'select' : 'tap';
    sfx(kind);
    if (touchFirst && navigator.vibrate) navigator.vibrate(6);
  }, true);

  if (hoverable) {
    let lastHover = 0;
    document.addEventListener('pointerenter', (e) => {
      const el = clickable(e.target);
      if (!el || el.disabled || el.classList.contains('disabled')) return;
      const now = performance.now();
      if (now - lastHover < 40) return;          // 划过按钮时会一串一串地补发
      lastHover = now;
      sfx('hover');
    }, true);
  }

  const paintSound = (s) => {
    if (!s) return;
    sound.classList.toggle('muted', !s.on);
    soundOn.setAttribute('aria-checked', s.on ? 'true' : 'false');
    soundOnText.textContent = s.on ? '开' : '关';
    volMusic.value = String(Math.round(s.music * 100));
    volSfx.value = String(Math.round(s.sfx * 100));
    volMusicV.textContent = `${Math.round(s.music * 100)}%`;
    volSfxV.textContent = `${Math.round(s.sfx * 100)}%`;
    soundHint.hidden = !s.blocked;
    // 面板收起来之后，改由「声音」页签上的小点提示当前是静音
    tabSound.dataset.muted = String(!s.on);
  };

  const setTheme = (id) => {
    for (const b of themeBtns) {
      b.setAttribute('aria-pressed', String(b.dataset.theme === id));
    }
  };

  return {
    setState,
    setProgress,
    setRecipe,
    setTheme,
    toast,
    hideToast,
    setFit,
    ready,
    paintSound,
    getState: () => state,
  };
}
