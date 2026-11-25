// 指针手势：拖拽环视 / 双指捏合缩放 / 点一下纸飞机放飞
// 放飞不再用拖拽蓄力：转视角时手指总会挪几像素，蓄力很容易被误触发。
import { clamp01 } from './paper/engine.js';

const CLICK_MOVE_PX = 6;
const CLICK_MAX_MS = 700;

export class Interaction {
  constructor({ canvas, rig, controller }) {
    this.canvas = canvas;
    this.rig = rig;
    this.controller = controller;

    this.pointers = new Map();
    this.orbiting = false;
    this.press = null;
    this.lastX = 0;
    this.lastY = 0;
    this.pinchDist = 0;

    this.bind();
  }

  bind() {
    const el = this.canvas;
    el.addEventListener('pointerdown', (e) => this.onDown(e));
    el.addEventListener('pointermove', (e) => this.onMove(e));
    el.addEventListener('pointerup', (e) => this.onUp(e));
    el.addEventListener('pointercancel', (e) => this.onCancel(e));
    el.addEventListener('pointerleave', () => {
      if (!this.pointers.size && this.controller.canLaunch?.()) this.canvas.style.cursor = 'grab';
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    window.addEventListener('blur', () => this.cancelAll());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.cancelAll();
    });
  }

  beginOrbit(x, y) {
    this.orbiting = true;
    this.lastX = x;
    this.lastY = y;
  }

  onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    this.canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.canvas.style.cursor = 'grabbing';

    if (this.pointers.size === 2) {
      const pts = [...this.pointers.values()];
      this.pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.press = null;
      this.beginOrbit((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
      return;
    }
    if (this.pointers.size > 2) return;

    this.beginOrbit(e.clientX, e.clientY);
    this.press = {
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
      moved: false,
      // 只有左键/触摸落在飞机身上才算「点飞机」，右键只环视
      plane: e.button !== 2 && (this.controller.hitPlane?.(e.clientX, e.clientY) || false),
    };
  }

  onMove(e) {
    if (!this.pointers.has(e.pointerId)) {
      // 悬停：指着飞机时给一个可点的光标
      if (!e.buttons && this.controller.canLaunch?.()) {
        this.canvas.style.cursor =
          this.controller.hitPlane?.(e.clientX, e.clientY) ? 'pointer' : 'grab';
      }
      return;
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size >= 2) {
      const pts = [...this.pointers.values()];
      const cx = (pts[0].x + pts[1].x) / 2;
      const cy = (pts[0].y + pts[1].y) / 2;
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (this.pinchDist > 0 && d > 0) {
        this.rig.zoom(Math.pow(this.pinchDist / d, 0.55));
      }
      this.pinchDist = d;
      if (this.orbiting) {
        this.rig.orbit(cx - this.lastX, cy - this.lastY);
        this.lastX = cx;
        this.lastY = cy;
      }
      return;
    }

    if (this.press && !this.press.moved) {
      const dx = e.clientX - this.press.x;
      const dy = e.clientY - this.press.y;
      if (Math.hypot(dx, dy) > CLICK_MOVE_PX) this.press.moved = true;
    }
    if (this.orbiting) {
      this.rig.orbit(e.clientX - this.lastX, e.clientY - this.lastY);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    }
  }

  onUp(e) {
    const press = this.press;
    this.pointers.delete(e.pointerId);
    this.canvas.releasePointerCapture?.(e.pointerId);

    if (this.pointers.size === 0) {
      this.orbiting = false;
      this.press = null;
      this.canvas.style.cursor = 'grab';
      const quick = performance.now() - (press?.t ?? 0) < CLICK_MAX_MS;
      if (press && !press.moved && press.plane && quick && this.controller.canLaunch?.()) {
        this.controller.launch();
      }
    } else if (this.pointers.size === 1) {
      const p = [...this.pointers.values()][0];
      this.beginOrbit(p.x, p.y);
      this.pinchDist = 0;
      this.press = null;
    }
  }

  onCancel(e) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) this.cancelAll();
  }

  cancelAll() {
    this.pointers.clear();
    this.orbiting = false;
    this.press = null;
    this.pinchDist = 0;
    this.canvas.style.cursor = 'grab';
  }

  onWheel(e) {
    e.preventDefault();
    const integerWheel =
      e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 50;
    if (e.ctrlKey || integerWheel) {
      this.rig.zoom(Math.exp(e.deltaY * 0.0012));
    } else {
      this.rig.orbit(e.deltaX, e.deltaY);
    }
  }
}
