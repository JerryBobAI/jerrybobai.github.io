// 相机：基础构图 + 观察轨道 + 蓄力预兆 + 放飞跟随（全部走低通）
import * as THREE from 'three';

const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));
const smooth01 = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class CameraRig {
  constructor(spec) {
    this.camera = new THREE.PerspectiveCamera(
      spec.camera.vFovDeg,
      1,
      0.02,
      20
    );
    this.baseFov = spec.camera.vFovDeg;
    this.baseTarget = new THREE.Vector3(...spec.camera.target);
    this.basePos = new THREE.Vector3(...spec.camera.position);
    this.baseOffset = this.basePos.clone().sub(this.baseTarget);
    this.baseDist = this.baseOffset.length();
    this.baseYaw = Math.atan2(this.baseOffset.x, this.baseOffset.z);
    this.basePitch = Math.asin(this.baseOffset.y / this.baseDist);

    this.yaw = this.baseYaw;
    this.pitch = this.basePitch;
    this.dist = this.baseDist;
    this.targetYaw = this.baseYaw;
    this.targetPitch = this.basePitch;
    this.targetDist = this.baseDist;

    this.pos = this.basePos.clone();
    this.look = this.baseTarget.clone();
    this.focus = spec.camera.focusDistance;
    this.fov = spec.camera.vFovDeg;
    this._desiredPos = new THREE.Vector3();
    this._desiredLook = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._blend = new THREE.Vector3();
    this._awayPos = new THREE.Vector3(0.42, 0.44, 0.77);
    this._awayLook = new THREE.Vector3(-0.10, 0.22, -0.55);
    this._followPos = new THREE.Vector3();
    this._followLook = new THREE.Vector3();
    this._flightCamStart = new THREE.Vector3();
    this._flying = false;
    // 成品机位参数按折法切换（见 engine.js 的 RECIPES[id].ready）
    this.ready = { dist: 0.46, pitch: -0.06, yaw: 0.5, lookX: -0.035, lookY: -0.045 };

    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }

  orbit(dx, dy) {
    this.targetYaw -= dx * 0.0042;
    this.targetPitch = Math.min(this.basePitch + 0.62, Math.max(0.12, this.targetPitch + dy * 0.0032));
  }

  zoom(factor) {
    this.targetDist = Math.min(1.15, Math.max(0.26, this.targetDist * factor));
  }

  resetOrbit() {
    this.targetYaw = this.baseYaw;
    this.targetPitch = this.basePitch;
    this.targetDist = this.baseDist;
  }

  // 换折法时切成品机位。只改叠加量，用户的轨道参数原样保留。
  setReadyProfile(p) {
    if (!p) return;
    this.ready = { ...this.ready, ...p };
  }

  update(dt, state) {
    const { planePos, flightActive, flightU = 0, mode, returnU = null } = state;
    const k = 1 - Math.exp(-9 * dt);

    this.yaw += (this.targetYaw - this.yaw) * k;
    this.pitch += (this.targetPitch - this.pitch) * k;
    this.dist += (this.targetDist - this.dist) * k;

    // 成品阶段自动推近并偏到侧后方，给出一架飞机的读法；
    // 只叠在用户轨道之上，不覆盖 targetYaw/targetPitch/targetDist
    this.readyMix = damp(this.readyMix || 0, mode === 'ready' ? 1 : 0, 3.2, dt);
    const mix = this.readyMix;
    // 成品机位是「机身后左上方 3/4」：机头朝窗户（远处），龙骨对着镜头，
    // 俯角略低于上反角，双翼的 V 和竖直的龙骨同时读得出来。
    // 偏航约 +0.5 是绕机身轴线偏左，正后方会只剩两片翼面。
    const pitch = this.pitch + this.ready.pitch * mix;
    const yaw = this.yaw + this.ready.yaw * mix;
    // 竖屏的成品机位要按 aspectFix 后退（见 resize）。成品机位已经退到 0.5m 上下，
    // 飞机在竖屏的窄水平视角里也只占三成宽，再按 1.6 倍整份后退就小成一个点，
    // 所以只取 aspectFix 的一小部分当保险。
    const dist = this.dist * (1 - this.ready.dist * mix) * (1 + ((this.aspectFix || 1) - 1) * mix * 0.15);
    const cosP = Math.cos(pitch);
    const orbitPos = this._tmp.set(
      Math.sin(yaw) * cosP,
      Math.sin(pitch),
      Math.cos(yaw) * cosP
    ).multiplyScalar(dist).add(this.baseTarget);

    this._desiredPos.copy(orbitPos);
    // 视点的纵向偏移：负值下压（飞机上抬、避开底部面板），正值抬头（把窗景带进画面上沿）
    this._desiredLook.copy(this.baseTarget);
    this._desiredLook.y += this.ready.lookY * mix;
    // 成品的视觉重心偏在左翼一侧，视点往左让一点（负值），整架飞机才不会贴画面左缘
    this._desiredLook.x += this.ready.lookX * mix;

    if (flightActive && planePos) {
      // 跟拍：起步阶段镜头跟着飞机往前推一点、视线咬住它，
      // 再慢慢后退抬高，把桌面和整扇窗一起框进来（全跟会甩到窗外绿墙前）
      if (!this._flying) {
        this._flying = true;
        this._flightCamStart.copy(this.pos);
      }
      const e = smooth01(0.10, 0.85, flightU);
      const follow = 1 - smooth01(0.15, 0.60, flightU);
      this._followPos.copy(this._flightCamStart).lerp(planePos, 0.16 * follow);
      this._desiredPos.copy(this._followPos).lerp(this._awayPos, e);
      this._followLook.copy(this.baseTarget).lerp(planePos, 0.32 + 0.46 * follow);
      this._desiredLook.copy(this._followLook).lerp(this._awayLook, e * 0.9);
    } else if (mode === 'away') {
      // 停在送它飞走的机位上（纸已淡出，画面只剩窗外的绿意与空桌）
      this._flying = false;
      this._desiredPos.copy(this._awayPos);
      this._desiredLook.copy(this._awayLook);
    } else {
      this._flying = false;
    }

    // 回程：状态已经切回 ready，机位却还没就位——直接拉回成品构图会把
    // 还在窗外 3m 的飞机甩出画幅。前三分之一咬住机身看它穿窗，
    // 后三分之二再把镜头交还给成品机位
    if (returnU !== null && returnU !== undefined && planePos) {
      const k = smooth01(0.35, 0.95, returnU);
      this._blend.copy(this._awayPos).lerp(this._desiredPos, k);
      this._desiredPos.copy(this._blend);
      this._blend.copy(planePos).lerp(this._desiredLook, k);
      this._desiredLook.copy(this._blend);
    }

    const posLambda = flightActive ? 5.2 : 8.5;
    const kp = 1 - Math.exp(-posLambda * dt);
    this.pos.lerp(this._desiredPos, kp);
    this.look.lerp(this._desiredLook, 1 - Math.exp(-7.5 * dt));

    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);

    // 飞行/回程时跟焦到飞机上：机位不动、目标跑到 2–3m 外，
    // 按视点距离对焦会让机身在景深里糊成一团，飞出去的过程就看不清了
    const focusTarget = planePos
      ? Math.max(0.22, this.pos.distanceTo(planePos))
      : Math.max(0.22, this.pos.distanceTo(this.look));
    this.focus = damp(this.focus, focusTarget, 7, dt);
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    // 竖屏时水平视角会塌到底（纸飞机被裁掉）：按水平视角 34° 抬高垂直视角，封顶 66°
    const need = (2 * Math.atan(Math.tan((17 * Math.PI) / 180) / aspect) * 180) / Math.PI;
    this.camera.fov = Math.min(66, Math.max(this.baseFov, need));
    this.camera.updateProjectionMatrix();
    // 成品机位是按 16:10 定的。竖屏的垂直视角虽然抬到 66°，水平视野仍比横屏窄一截，
    // 同一距离下整机会撑出画幅：按两者水平半宽之比把成品机位等比后退
    const hHalf = Math.tan((this.camera.fov * Math.PI) / 360) * aspect;
    this.aspectFix = Math.min(1.9, Math.max(1, (Math.tan((17 * Math.PI) / 180) * 1.6) / hHalf));
  }
}
