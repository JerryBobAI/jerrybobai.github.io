// 放飞：三次贝塞尔轨迹 + 切线姿态；取回时沿同一条曲线倒着穿回窗洞
import * as THREE from 'three';

// 航迹朝窗户飞出去：经过窗洞（x∈[-0.5,0.5]、y>-0.08）穿到窗外的景片前。
// 终点不能拉到 9m 外：那样飞机半程就缩成十几像素的小点，淡出发生在看不见的地方，
// 读起来就是「一按就没了」。现在停在窗外 2.6m，整段航程里机身都在
// 45–280px 之间，淡出时还能看清是纸飞机在绿意里化开。
const P0 = new THREE.Vector3(0, 0.004, 0);
const C1 = new THREE.Vector3(0.02, 0.07, -0.25);
const C2 = new THREE.Vector3(-0.4, 0.2, -0.95);
const P1 = new THREE.Vector3(-0.85, 0.42, -2.6);
// 取回走同一条曲线的反向：穿回窗洞的路径不用重新调
const FADE_Z0 = 1.7;
const FADE_Z1 = 2.65;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const FLIP_Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
// 取回段的终点姿态是常量，别在逐帧循环里每次 new
const IDENTITY_Q = new THREE.Quaternion();

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function bezier(p0, c1, c2, p1, t, out) {
  const it = 1 - t;
  const a = it * it * it;
  const b = 3 * it * it * t;
  const c = 3 * it * t * t;
  const d = t * t * t;
  out.set(
    p0.x * a + c1.x * b + c2.x * c + p1.x * d,
    p0.y * a + c1.y * b + c2.y * c + p1.y * d,
    p0.z * a + c1.z * b + c2.z * c + p1.z * d
  );
  return out;
}

function bezierTangent(p0, c1, c2, p1, t, out) {
  const it = 1 - t;
  out.set(
    3 * it * it * (c1.x - p0.x) + 6 * it * t * (c2.x - c1.x) + 3 * t * t * (p1.x - c2.x),
    3 * it * it * (c1.y - p0.y) + 6 * it * t * (c2.y - c1.y) + 3 * t * t * (p1.y - c2.y),
    3 * it * it * (c1.z - p0.z) + 6 * it * t * (c2.z - c1.z) + 3 * t * t * (p1.z - c2.z)
  );
  return out.normalize();
}

export class Flight {
  constructor(outerGroup) {
    this.group = outerGroup;
    this.mode = 'idle';
    this.t = 0;
    this.duration = 2.2;
    this.speed = 1;
    this.roll = 0;
    this._p = new THREE.Vector3();
    this._tan = new THREE.Vector3();
    this._startQuat = new THREE.Quaternion();
    this._q0 = new THREE.Quaternion();
    this._qTarget = new THREE.Quaternion();
    this._qRoll = new THREE.Quaternion();
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._returnT = 0;
    this._settle = 0;
    this._endCallback = null;
    this._returnCallback = null;
    this.group.visible = true;
  }

  /**
   * speed: 机型系数（滑翔机飞得慢、飞镖快），只改时长不改航迹。
   */
  start(speed = 1) {
    this.mode = 'flying';
    this.speed = clamp(speed, 0.6, 1.6);
    this.t = 0;
    this.duration = 2.2 / this.speed;
    this.group.visible = true;
    this.group.position.set(0, 0, 0);
    // 保留桌面上的停放朝向，起飞后用四元数插值并入航迹切线，避免朝向硬切
    this._q0.copy(this.group.quaternion);
    this.group.scale.setScalar(1);
    this._settle = 0;
    this._returnCallback = null;
  }

  get active() {
    return this.mode === 'flying';
  }

  /** 回程进度 0..1，非回程时为 null（相机据此决定何时把机位交还给成品构图） */
  get returnU() {
    return this.mode === 'returning' ? Math.min(1, this._returnT) : null;
  }

  /** 越飞越淡：按真实纵深淡出。终点改成窗外 3m 之后，淡出发生在机身还有
   *  40px 上下的位置，能看见它在绿意里化开，而不是一个小点无声消失 */
  get opacity() {
    if (this.mode === 'flying') return 1 - smoothstep(FADE_Z0, FADE_Z1, -this.group.position.z);
    if (this.mode === 'done') return 0;
    if (this.mode === 'returning') return smoothstep(0, 0.3, this._returnT);
    return 1;
  }

  get position() {
    return this.mode === 'flying' ? this.group.position : null;
  }

  update(dt) {
    if (this.mode === 'flying') {
      this.t += dt / this.duration;
      const u = Math.min(1, this.t);
      const e = 1 - Math.pow(1 - u, 2.3);
      bezier(P0, C1, C2, P1, e, this._p);
      this.group.position.copy(this._p);

      bezierTangent(P0, C1, C2, P1, Math.min(0.999, e), this._tan);
      const tx = this._tan.x;
      const tz = this._tan.z;
      const ty = this._tan.y;
      const pitch = Math.asin(clamp(ty, -0.9, 0.9));
      const yaw = Math.atan2(-tx, -tz);
      // 出手的一下带一点自然的滚转，后半程收平。幅度太小的话飞出窗时只剩
      // 一条边的剪影，远看就是个噪点；0.18 约 10°，机翼在绿意上扫得出来
      const roll = Math.sin(u * Math.PI * 1.7) * 0.18 * (1 - u);
      this.roll = roll;
      this._euler.set(pitch, yaw, roll, 'YXZ');
      this._qTarget.setFromEuler(this._euler);
      // 前 0.25 的航程里把停放朝向并入切线姿态
      const b = Math.min(1, u / 0.25);
      this.group.quaternion.copy(this._q0).slerp(this._qTarget, b * b * (3 - 2 * b));

      // 起飞瞬间的抬升感
      this.group.position.y += Math.sin(Math.min(1, u * 3) * Math.PI * 0.5) * 0.012;

      if (this.t >= 1) {
        this.mode = 'done';
        // 不隐藏：停在窗外那一小点上，取回时才有来处
        this.group.visible = true;
        this._endCallback?.();
      }
    } else if (this.mode === 'returning') {
      // 原来的直线回位 0.55s、从 9.5m 外起步，观感是「闪一下就在桌上了」。
      // 现在倒着走同一条贝塞尔、用 1.15s 穿回窗洞，边飞边长大，落地再补一个小回弹
      this._returnT += dt / 1.15;
      const u = Math.min(1, this._returnT);
      const e = u * u * (3 - 2 * u);
      this.group.visible = true;
      bezier(P1, C2, C1, P0, e, this._p);
      this.group.position.copy(this._p);
      this.group.quaternion.slerpQuaternions(this._startQuat, IDENTITY_Q, e);
      // 回程带一点侧倾：机头朝外时剪影只有一条边，压出 30° 左右的坡度才看得出是机翼
      this._qRoll.setFromAxisAngle(Z_AXIS, -0.52 * Math.sin(e * Math.PI));
      this.group.quaternion.multiply(this._qRoll);
      this.group.scale.setScalar(0.72 + 0.28 * e);
      if (u >= 1) {
        this.mode = 'idle';
        this.group.position.set(0, 0, 0);
        this.group.rotation.set(0, 0, 0);
        this.group.scale.setScalar(1);
        this._settle = 0.32;
        const cb = this._returnCallback;
        this._returnCallback = null;
        cb?.();
      }
    } else if (this._settle > 0) {
      // 落桌的回弹：轻轻一压再弹回 1，0.32s 收干净，最后一位精确回到静止姿态
      this._settle = Math.max(0, this._settle - dt);
      const s = this._settle / 0.32;
      this.group.scale.setScalar(1 + Math.sin(s * Math.PI) * 0.05);
      this.group.position.y = 0.011 * s;
    }
  }

  onEnd(cb) {
    this._endCallback = cb;
  }

  reset() {
    this.mode = 'idle';
    this.t = 0;
    this.group.visible = true;
    this.group.position.set(0, 0, 0);
    this.group.rotation.set(0, 0, 0);
    this.group.scale.setScalar(1);
    this._settle = 0;
    this._returnCallback = null;
  }

  /** onDone：穿过窗洞落回桌面、回弹收干净之后回调（「再飞一次」靠它接力起飞） */
  retrieve(onDone) {
    if (this.mode === 'idle') {
      onDone?.();
      return;
    }
    this.mode = 'returning';
    this._returnT = 0;
    this._settle = 0;
    // 飞出去的终点姿态是「机头朝窗外」，直接拿它当回程起点就是拖着尾巴往回飞。
    // 绕机身竖轴翻 180° 让机头对着桌子，回程是一段带坡度的掉头
    this._startQuat.copy(this.group.quaternion).multiply(FLIP_Q);
    this._returnCallback = onDone || null;
  }
}
