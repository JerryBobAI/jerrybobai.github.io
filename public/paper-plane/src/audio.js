// 声音：背景音乐 + 程序化音效
// 音效全部是用 Web Audio 现场合成的纸声/折痕/展翼/放飞/回流，跟着折叠进度逐帧出，
// 不额外下资源、不改动几何。背景音乐是一段离线生成并做过无缝循环处理的 88.5s 循环。
//
// 自动播放边界：AudioContext 在没手势时是 suspended 的，元素/缓冲「在播」不等于有声音。
// 所有手势监听常驻（切后台回来还要靠下一次点按把声音捞回来），resume 对 running 是空操作。
import { makeRng } from './rng.js';

const STORE_KEY = 'paper-airplane-audio-v1';
const DEFAULTS = { on: true, music: 0.45, sfx: 0.8 };
const rng = makeRng(0x9a4e21);

const clamp01 = (n) => Math.min(1, Math.max(0, n));

function readStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return { ...DEFAULTS };
    return {
      on: raw.on !== false,
      music: clamp01(Number(raw.music ?? DEFAULTS.music)),
      sfx: clamp01(Number(raw.sfx ?? DEFAULTS.sfx)),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export class PaperAudio {
  constructor({ onChange } = {}) {
    this.state = readStore();
    this.onChange = onChange || (() => {});
    this.ctx = null;
    this.musicBuf = null;
    this.musicSrc = null;
    this._wind = null;
    this._foldPulseAt = -1;
    this._blocked = false;
    this._hintTimer = 0;
    this._musicTried = false;

    this.ensure();
    this._bindGestures();
    this._loadMusic();
    this._scheduleHint();

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this._maybeHint();
    });
  }

  // ---- 基础设施 ----

  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = (this.ctx = new AC({ latencyHint: 'interactive' }));

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    // 总线上挂个分析器给 QA 探针读：验的是「真的出声」的那条路，不是元素在播
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.master.connect(this.analyser);
    // 纸声的瞬态很尖，压一下峰值，音量整体也能抬一点
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 14;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.004;
    comp.release.value = 0.25;
    this.master.connect(comp).connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    // 音乐单独过一道「让位」增益：飞机出手/回程的 1–2 秒里把 BGM 压下去，
    // 音效不用做到震耳也能听见；用户设的音量值本身不动
    this.musicDuck = ctx.createGain();
    this.musicDuck.gain.value = 1;
    this.musicBus.connect(this.musicDuck).connect(this.master);
    this.sfxBus.connect(this.master);

    this._noise = this._makeNoise(2.2);
    this._buildFold();

    ctx.addEventListener('statechange', () => {
      this._applyGains();
      this._emit();
      this._maybeHint();
      if (ctx.state === 'running') this._startMusic();
    });
    this._applyGains(true);
    return ctx;
  }

  _makeNoise(seconds) {
    const ctx = this.ctx;
    const n = Math.floor(seconds * ctx.sampleRate);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    const r = makeRng(0x51ee7);
    for (let i = 0; i < n; i++) d[i] = r.next() * 2 - 1;
    return buf;
  }

  _applyGains(immediate = false) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const on = this.state.on ? 0.9 : 0;
    const apply = (param, v) => {
      if (immediate || ctx.state !== 'running') param.value = v;
      else param.setTargetAtTime(v, t, 0.06);
    };
    apply(this.master.gain, on);
    apply(this.musicBus.gain, this.state.music);
    apply(this.sfxBus.gain, this.state.sfx);
  }

  _save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
    } catch {
      /* 隐私模式写不了就只生效本次 */
    }
  }

  // ---- 解锁 / 状态 ----

  _bindGestures() {
    // 手势监听常驻：iOS 切后台后上下文会挂起，要靠下一次点按恢复
    const unlock = () => this.unlock();
    for (const ev of ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown']) {
      window.addEventListener(ev, unlock, { capture: true, passive: true });
    }
  }

  unlock() {
    const ctx = this.ctx;
    if (!ctx) return;
    // resume 对 running 是空操作，别因为在跑就提前返回——
    // 早退会让「首声」被一个还没走到 play 的分支吞掉
    const p = ctx.state === 'running' ? Promise.resolve() : ctx.resume().catch(() => {});
    p.then(() => {
      this._applyGains();
      this._emit();
      this._maybeHint();
      if (this.state.on) this._startMusic();
    });
  }

  _scheduleHint() {
    clearTimeout(this._hintTimer);
    // 晚 450ms 再提示：正常解锁的那一下不会闪出一条「轻触开声」
    this._hintTimer = setTimeout(() => this._maybeHint(), 450);
  }

  _maybeHint() {
    const blocked = !!this.ctx && this.state.on && this.ctx.state !== 'running';
    if (blocked !== this._blocked) {
      this._blocked = blocked;
      this._emit();
    }
  }

  _emit() {
    this.onChange(this.snapshot());
  }

  snapshot() {
    return {
      on: this.state.on,
      music: this.state.music,
      sfx: this.state.sfx,
      ctx: this.ctx ? this.ctx.state : 'none',
      running: !!this.ctx && this.ctx.state === 'running',
      blocked: this._blocked,
      musicStarted: !!this.musicSrc,
    };
  }

  setOn(on) {
    this.state.on = !!on;
    this._save();
    this._applyGains();
    if (this.state.on) {
      this.unlock();
      this._startMusic();
    }
    this._emit();
    this._maybeHint();
  }

  /** 让位：true = BGM 压到 0.55，飞行/回程结束时恢复 */
  duck(on) {
    if (!this.ctx || !this.musicDuck) return;
    this.musicDuck.gain.setTargetAtTime(on ? 0.55 : 1, this.ctx.currentTime, 0.22);
  }

  setVolume(kind, v) {
    if (kind !== 'music' && kind !== 'sfx') return;
    this.state[kind] = clamp01(Number(v));
    this._save();
    this._applyGains();
    this._emit();
  }

  // 声音是否该出：没解锁也照样排程——AudioContext 的时钟在挂起时冻结，
  // 恢复后已排的事件会从停住处继续触发，首声不会丢。
  _ready() {
    if (!this.ctx || !this.state.on) return false;
    if (this.ctx.state !== 'running') this.unlock();
    return true;
  }

  // ---- 背景音乐 ----

  _loadMusic() {
    if (this._musicTried) return;
    this._musicTried = true;
    const ctx = this.ctx;
    if (!ctx) return;
    fetch('./assets/audio/bgm.m4a')
      .then((r) => {
        if (!r.ok) throw new Error(`bgm ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => ctx.decodeAudioData(buf))
      .then((audioBuf) => {
        this.musicBuf = audioBuf;
        if (this.ctx.state === 'running' && this.state.on) this._startMusic();
      })
      .catch(() => {
        // 离线生成失败也不拦场景：静音兜底
      });
  }

  _startMusic() {
    if (!this.ctx || !this.musicBuf || this.musicSrc || !this.state.on) return;
    if (this.ctx.state !== 'running') return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.musicBuf;
    src.loop = true;
    // 从零淡入，避免点开页面第一下就砸一段副歌进来
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(1, this.ctx.currentTime + 1.6);
    src.connect(g).connect(this.musicBus);
    src.start();
    this.musicSrc = src;
    this._emit();
  }

  // ---- 折叠：连续纸声 + 折痕 + 展翼 ----

  _buildFold() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    src.loop = true;

    const lo = ctx.createBiquadFilter();
    lo.type = 'bandpass';
    lo.frequency.value = 1150;
    lo.Q.value = 0.85;
    const hi = ctx.createBiquadFilter();
    hi.type = 'bandpass';
    hi.frequency.value = 2900;
    hi.Q.value = 0.7;
    const gl = ctx.createGain();
    gl.gain.value = 0.7;
    const gh = ctx.createGain();
    gh.gain.value = 0.32;

    // 9Hz 左右的振幅抖动，纸面摩擦才有「沙沙」而不是一条平稳的嘶声
    const trem = ctx.createGain();
    trem.gain.value = 1;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 9.3;
    const depth = ctx.createGain();
    depth.gain.value = 0.26;
    lfo.connect(depth).connect(trem.gain);

    const out = ctx.createGain();
    out.gain.value = 0;
    src.connect(lo).connect(gl).connect(trem);
    src.connect(hi).connect(gh).connect(trem);
    trem.connect(out).connect(this.sfxBus);
    src.start();
    lfo.start();
    this._fold = { out, trem, depth, lfo };
  }

  /** rate = 折叠速度（进度/秒），滑杆和自动折叠都按真实速率映射 */
  foldActivity(rate) {
    if (!this._ready() || !this._fold) return;
    const level = clamp01(rate * 2.4) * 0.15;
    this._fold.out.gain.setTargetAtTime(level, this.ctx.currentTime, 0.06);
    this._foldPulseAt = this.ctx.currentTime;
  }

  /** 每帧调用：手停下来纸声要跟着收 */
  update() {
    if (!this.ctx || !this._fold) return;
    if (this.ctx.currentTime - this._foldPulseAt > 0.12) {
      this._fold.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.09);
    }
  }

  _grain(t, dur, freq, q, gain, rate = 1) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    src.playbackRate.value = rate;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(this.sfxBus);
    src.start(t, rng.next() * 1.4, dur + 0.02);
  }

  /** 折痕到位：一声干脆的「咔」+ 一点纸体低频 */
  crease(strength = 1) {
    if (!this._ready()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.001;
    this._grain(t, 0.09, 1300 + rng.next() * 900, 1.1, 0.16 * strength, 0.9 + rng.next() * 0.25);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 150 + rng.next() * 50;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05 * strength, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(g).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  /** 展翼：几粒细密的纸页抖动 */
  flutter(strength = 1) {
    if (!this._ready()) return;
    const t0 = this.ctx.currentTime + 0.001;
    for (let i = 0; i < 5; i++) {
      const t = t0 + i * 0.055 + rng.next() * 0.02;
      this._grain(t, 0.05, 2300 + rng.next() * 1100, 0.9, 0.05 * strength, 1);
    }
  }

  // ---- 放飞 / 取回 / 翻页 ----

  /** 出手的一下：带通扫频 + 低频推力 + 声像从中间滑向左前方 */
  whoosh() {
    if (!this._ready()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    src.playbackRate.value = 1;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(380, t);
    bp.frequency.exponentialRampToValueAtTime(1900, t + 0.22);
    bp.frequency.exponentialRampToValueAtTime(520, t + 0.9);
    const g = ctx.createGain();
    // 原来 0.24 的噪声扫频压在同一条总线上，跟 BGM 比几乎被盖住；
    // 提到 0.42 并在下面垫一层低频推力，出手才有「推出去」的体感
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.78, t + 0.07);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
    let node = src.connect(bp).connect(g);
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.setValueAtTime(-0.05, t);
      pan.pan.linearRampToValueAtTime(-0.7, t + 0.9);
      node = node.connect(pan);
    }
    node.connect(this.sfxBus);
    src.start(t);
    src.stop(t + 1.0);

    // 低频推力：纸机不会真的隆隆响，但它给扫频一个落地的「厚度」
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(58, t + 0.32);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.26, t + 0.03);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
    osc.connect(og).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  /** 飞行时的气流：暗噪声慢慢起、慢慢落 */
  windOn(on) {
    if (!this._ready()) return;
    const ctx = this.ctx;
    if (on) {
      if (this._wind) return;
      const src = ctx.createBufferSource();
      src.buffer = this._noise;
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 640;
      lp.Q.value = 0.6;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 90;
      const g = ctx.createGain();
      // 飞行时的底噪原来只有 0.075，等于没响；抬到 0.15 让「在飞」一直有呼吸感
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.21, ctx.currentTime + 1.2);
      src.connect(lp).connect(hp).connect(g).connect(this.sfxBus);
      src.start();
      this._wind = { src, g };
    } else if (this._wind) {
      const w = this._wind;
      this._wind = null;
      const t = ctx.currentTime;
      w.g.gain.setTargetAtTime(0.0001, t, 0.35);
      w.src.stop(t + 1.6);
      w.src.onended = () => {
        try {
          w.src.disconnect();
        } catch { /* 已断开 */ }
      };
    }
  }

  /** 取回：反向扫频穿窗 + 落桌那一记轻扣。时间轴对齐 flight 的 1.15s 回程 + 0.32s 回弹 */
  retrieve() {
    if (!this._ready()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.85;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(1700, t + 0.85);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.62, t + 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    let node = src.connect(bp).connect(g);
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.setValueAtTime(-0.6, t);
      pan.pan.linearRampToValueAtTime(0.05, t + 0.95);
      node = node.connect(pan);
    }
    node.connect(this.sfxBus);
    src.start(t);
    src.stop(t + 1.05);

    // 接近桌面时的纸页抖动，直接排进音频时钟，不靠 setTimeout 追
    for (let i = 0; i < 4; i++) {
      this._grain(t + 0.96 + i * 0.05, 0.05, 2400 + rng.next() * 900, 0.9, 0.07, 1);
    }
    // 落桌：一起短促的纸面扣击 + 一点低频，和回弹的那 0.32s 对得上
    this._grain(t + 1.15, 0.07, 850, 1.2, 0.3, 1.1);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, t + 1.15);
    osc.frequency.exponentialRampToValueAtTime(120, t + 1.3);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t + 1.15);
    og.gain.exponentialRampToValueAtTime(0.12, t + 1.17);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 1.34);
    osc.connect(og).connect(this.sfxBus);
    osc.start(t + 1.15);
    osc.stop(t + 1.36);
  }

  /** 翻页 / 换照片：短促的一下纸面擦过 */
  paperFlip() {
    if (!this._ready()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    src.playbackRate.value = 1.1;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.7;
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + 0.12);
    bp.frequency.exponentialRampToValueAtTime(1400, t + 0.26);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    src.connect(bp).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + 0.3);
  }

  /** 极短一音：振荡器 →（可选带通）→ 包络 → sfx 总线。delay 用来排两音列 */
  _blip({ f0, f1 = f0, dur = 0.06, gain = 0.05, type = 'sine', bp = 0, q = 1, delay = 0 }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let head = osc;
    if (bp) {
      const flt = ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.value = bp;
      flt.Q.value = q;
      head.connect(flt);
      head = flt;
    }
    head.connect(g).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  /**
   * 控件音：全部是几十毫秒的合成短音，音量压在纸声之下。
   * 音高按动作语义挑——悬停最轻最高（只是碰到），点击是中频短促，
   * 选折法是上行两音，开关是上/下行两音，滑杆跨折痕按序升调。
   */
  ui(kind, arg = 0) {
    // 开声那一下 state.on 还是 false，不能走 _ready()，否则「打开声音」本身没声
    const force = kind === 'toggleOn';
    if (!this.ctx || (!this.state.on && !force)) return;
    if (this.ctx.state !== 'running') this.unlock();
    if (this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (!this._uiAt) this._uiAt = Object.create(null);
    const gap = { hover: 0.05, step: 0.04, stage: 0.035 }[kind] || 0;
    if (gap && now - (this._uiAt[kind] ?? -1) < gap) return;
    this._uiAt[kind] = now;

    switch (kind) {
      case 'hover':
        this._blip({ f0: 2560, dur: 0.016, gain: 0.014 });
        break;
      case 'tap':
        this._blip({ f0: 1240, f1: 760, dur: 0.045, gain: 0.048, type: 'triangle', bp: 1500, q: 1.1 });
        break;
      // 换折法：上行两音，像翻到新的一页
      case 'select':
        this._blip({ f0: 880, dur: 0.05, gain: 0.042 });
        this._blip({ f0: 1320, dur: 0.07, gain: 0.038, delay: 0.055 });
        break;
      // 面板：开是上行、关是下行，方向和位移一致
      case 'open':
        this._blip({ f0: 620, f1: 930, dur: 0.085, gain: 0.036 });
        break;
      case 'close':
        this._blip({ f0: 930, f1: 620, dur: 0.08, gain: 0.032 });
        break;
      // 滑杆每跨一道折痕升半音，五道一轮
      case 'stage': {
        const f = 620 * 2 ** ((Math.max(0, arg | 0) % 5) / 12);
        this._blip({ f0: f, dur: 0.09, gain: 0.04 });
        break;
      }
      case 'step':
        this._blip({ f0: 1480, dur: 0.022, gain: 0.02 });
        break;
      case 'toggleOn':
        this._blip({ f0: 660, dur: 0.05, gain: 0.04 });
        this._blip({ f0: 990, dur: 0.07, gain: 0.036, delay: 0.055 });
        break;
      case 'toggleOff':
        this._blip({ f0: 990, dur: 0.05, gain: 0.04 });
        this._blip({ f0: 660, dur: 0.07, gain: 0.036, delay: 0.055 });
        break;
      default:
        break;
    }
  }

  /** 旧接口：按钮哒声，等同一次 tap */
  tick() {
    this.ui('tap');
  }

  /** QA 用：从总线读到的真实 RMS，验证「真的出声」而不是「元素在播」 */
  rms() {
    if (!this.analyser) return 0;
    const buf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }

  /** QA 用：桌面复现「上下文挂起」，再点一下验证能恢复 */
  suspendForTest() {
    this.ctx?.suspend();
  }
}
