// 纸张网格：正反两面 + 边缘芯条，预分配缓冲，逐帧只改 drawRange
import * as THREE from 'three';
import { buildPaperData } from './engine.js';

const VERT_CAP = 60000;
const EDGE_CAP = 40000;
// QA 专用：?idview=1 时印花/白纸/纸边换成红/蓝/绿纯色，探针脚本按颜色数
// 「这一像素是谁画的」，层序错乱（同一面一半照片一半白纸）才可度量。
const ID_VIEW = new URLSearchParams(location.search).get('idview') === '1';

function makeGeometry(cap) {
  const geo = new THREE.BufferGeometry();
  const position = new Float32Array(cap * 3);
  const uv = new Float32Array(cap * 2);
  const normal = new Float32Array(cap * 3);
  const color = new Float32Array(cap * 3);
  const level = new Float32Array(cap);
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(normal, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(color, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aLevel', new THREE.BufferAttribute(level, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setDrawRange(0, 0);
  return geo;
}

function makeEdgeGeometry(cap) {
  const geo = new THREE.BufferGeometry();
  const position = new Float32Array(cap * 3);
  const normal = new Float32Array(cap * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(normal, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setDrawRange(0, 0);
  return geo;
}

// 层序偏移：谁在上由「叠放层号」决定，落在**深度缓冲的 ndc 值**上。
// 几何上沿世界 z 错开只对平放的纸有效；纸立起来以后世界 z 落在纸面内，
// 两层不再分开，而同一片纸被折成两层的两块面又只是「几乎」共面（折后顶点
// 差 0.2–0.4mm），深度比较会在面上切出一条直线边界——一张面左边印照片、
// 右边露白纸，拖动滑杆边界还会移动（实测 p≈0.509，白纸背面被切掉 7456 像素）。
// 偏移直接加在 gl_Position.z / w 折算回 ndc：深度缓冲的量化步长在 ndc 上是
// 常数，所以常数 ndc 偏移在任何视距都稳稳压过精度；同时不动 x/y，不会像
// 「挪 mvPosition.z」那样把高层的面按 1/(1-δ/z) 放大（level 12 时约 1.8%，
// 上层翼尖轮廓会相对下层的漂）。量级标定：0.4mm 的折后顶点噪声在 0.47m
// 处约 7.3e-5 ndc，取 2e-4 约 3 倍余量。
const LAYER_BIAS_NDC = 2.0e-4;
function applyLayerBias(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = 'attribute float aLevel;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
       gl_Position.z -= aLevel * ${LAYER_BIAS_NDC.toFixed(8)} * gl_Position.w;`
    );
  };
  mat.customProgramCacheKey = () => 'paper-layer-bias';
}

function grow(geo, name, cap, itemSize) {
  const attr = new THREE.BufferAttribute(new Float32Array(cap * itemSize), itemSize);
  attr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute(name, attr);
  return attr;
}

export class PaperMesh {
  constructor(printTexture, fiber) {
    this.group = new THREE.Group();
    this.geometry = makeGeometry(VERT_CAP);
    this.whiteGeometry = makeGeometry(VERT_CAP);
    this.edgeGeometry = makeEdgeGeometry(EDGE_CAP);
    this.capacity = VERT_CAP;
    this.whiteCapacity = VERT_CAP;
    this.edgeCapacity = EDGE_CAP;

    const frontMat = new THREE.MeshPhysicalMaterial({
      map: printTexture,
      normalMap: fiber.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughnessMap: fiber.roughnessMap,
      roughness: 0.92,
      metalness: 0,
      sheen: 0.32,
      sheenColor: new THREE.Color(0xfff2dd),
      sheenRoughness: 0.85,
      side: THREE.FrontSide,
      vertexColors: true,
      envMapIntensity: 0.55,
    });
    // 相纸只印一面：纸背是白纸底，只有纤维和折痕，不挂印花。纸背不是单独的
    // BackSide 材质，而是白纸网格里那套反绕序三角形（见 engine.js 的
    // buildPaperData）——BackSide / DoubleSide 的背面片元着色法线是翻的，
    // 阴影 normalBias 却按顶点法线推，会在这层纸上打出 1mm 网格状的阴影麻点。
    const whiteMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xf7f3ea),
      normalMap: fiber.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughnessMap: fiber.roughnessMap,
      roughness: 0.94,
      metalness: 0,
      side: THREE.FrontSide,
      vertexColors: true,
      envMapIntensity: 0.45,
    });
    const edgeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xefe6d3),
      roughness: 0.95,
      metalness: 0,
      side: THREE.DoubleSide,
    });

    applyLayerBias(frontMat);
    applyLayerBias(whiteMat);

    this.front = new THREE.Mesh(this.geometry, frontMat);
    this.white = new THREE.Mesh(this.whiteGeometry, whiteMat);
    this.edge = new THREE.Mesh(this.edgeGeometry, edgeMat);
    for (const m of [this.front, this.white, this.edge]) {
      m.frustumCulled = false;
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
    }
    this.front.renderOrder = 0;
    this.white.renderOrder = 0;
    this.edge.renderOrder = 1;
    this.frontMat = frontMat;
    this.whiteMat = whiteMat;
    this.edgeMat = edgeMat;
    // 旧接口别名：纸背就是白纸网格的另一半绕序，QA / 探针脚本按 back 取
    // 「非印花面」时仍然能拿到对象（paper.back === paper.white）。
    this.back = this.white;
    this.backMat = whiteMat;

    if (ID_VIEW) {
      // 纯色替身也带上同一份层序偏移，否则探针量的是「没有偏移」的另一套
      // 遮挡关系，比真实渲染更容易互搏，报出来的翻面数没有意义。
      const idFront = new THREE.MeshBasicMaterial({ color: 0xff0000, toneMapped: false });
      const idWhite = new THREE.MeshBasicMaterial({ color: 0x0000ff, toneMapped: false });
      const idEdge = new THREE.MeshBasicMaterial({ color: 0x00ff00, toneMapped: false, side: THREE.DoubleSide });
      applyLayerBias(idFront);
      applyLayerBias(idWhite);
      this.front.material = idFront;
      this.white.material = idWhite;
      this.edge.material = idEdge;
      this.frontMat = idFront;
      this.whiteMat = idWhite;
      this.edgeMat = idEdge;
      this.backMat = idWhite;
    }
  }

  setPrintTexture(tex) {
    this.printTexture = tex;
    if (ID_VIEW) return; // 纯色替身挂上印花会让红/蓝不再是常数
    this.frontMat.map = tex;
    this.frontMat.needsUpdate = true;
  }

  /** 放飞淡出用：1 为常态；小于 1 时走透明混合，接近 0 时不再写深度 */
  setOpacity(o) {
    if (this._opacity === o) return;
    this._opacity = o;
    const transparent = o < 0.999;
    for (const m of [this.frontMat, this.whiteMat, this.edgeMat]) {
      // 只改 transparent 属性不够：three 只在 material.version 变化时重设
      // 渲染状态，混合模式会一直停在 NoBlending —— opacity 归零了，纸飞机
      // 仍按不透明全亮画在窗外（实测「飞走了还在那儿、没淡出」）。
      // 跨过 0.999 阈值时各标一次 needsUpdate 即可，program 走缓存复用。
      if (m.transparent !== transparent) m.needsUpdate = true;
      m.transparent = transparent;
      m.opacity = o;
      m.depthWrite = !transparent || o > 0.95;
    }
  }

  /** 点击拾取用：印花面 + 纸背面 + 边缘条一起算命中 */
  pickTargets() {
    return [this.front, this.white, this.edge];
  }

  update(faces, creaseAt) {
    const data = buildPaperData(faces, creaseAt);

    if (data.count > this.capacity) {
      this.capacity = Math.ceil(data.count / 8192) * 8192 + 8192;
      grow(this.geometry, 'position', this.capacity, 3);
      grow(this.geometry, 'uv', this.capacity, 2);
      grow(this.geometry, 'normal', this.capacity, 3);
      grow(this.geometry, 'color', this.capacity, 3);
      grow(this.geometry, 'aLevel', this.capacity, 1);
    }
    if (data.whiteCount > this.whiteCapacity) {
      this.whiteCapacity = Math.ceil(data.whiteCount / 8192) * 8192 + 8192;
      grow(this.whiteGeometry, 'position', this.whiteCapacity, 3);
      grow(this.whiteGeometry, 'uv', this.whiteCapacity, 2);
      grow(this.whiteGeometry, 'normal', this.whiteCapacity, 3);
      grow(this.whiteGeometry, 'color', this.whiteCapacity, 3);
      grow(this.whiteGeometry, 'aLevel', this.whiteCapacity, 1);
    }
    if (data.edgeCount > this.edgeCapacity) {
      this.edgeCapacity = Math.ceil(data.edgeCount / 8192) * 8192 + 8192;
      grow(this.edgeGeometry, 'position', this.edgeCapacity, 3);
      grow(this.edgeGeometry, 'normal', this.edgeCapacity, 3);
    }

    const pos = this.geometry.getAttribute('position');
    const uv = this.geometry.getAttribute('uv');
    const nor = this.geometry.getAttribute('normal');
    const col = this.geometry.getAttribute('color');
    const lvl = this.geometry.getAttribute('aLevel');
    pos.array.set(data.position, 0);
    uv.array.set(data.uv, 0);
    nor.array.set(data.normal, 0);
    col.array.set(data.color, 0);
    lvl.array.set(data.level, 0);
    pos.addUpdateRange(0, data.count * 3);
    uv.addUpdateRange(0, data.count * 2);
    nor.addUpdateRange(0, data.count * 3);
    col.addUpdateRange(0, data.count * 3);
    lvl.addUpdateRange(0, data.count);
    pos.needsUpdate = true;
    uv.needsUpdate = true;
    nor.needsUpdate = true;
    col.needsUpdate = true;
    lvl.needsUpdate = true;
    this.geometry.setDrawRange(0, data.count);

    const wpos = this.whiteGeometry.getAttribute('position');
    const wuv = this.whiteGeometry.getAttribute('uv');
    const wnor = this.whiteGeometry.getAttribute('normal');
    const wcol = this.whiteGeometry.getAttribute('color');
    const wlvl = this.whiteGeometry.getAttribute('aLevel');
    wpos.array.set(data.whitePosition, 0);
    wuv.array.set(data.whiteUv, 0);
    wnor.array.set(data.whiteNormal, 0);
    wcol.array.set(data.whiteColor, 0);
    wlvl.array.set(data.whiteLevel, 0);
    wpos.addUpdateRange(0, data.whiteCount * 3);
    wuv.addUpdateRange(0, data.whiteCount * 2);
    wnor.addUpdateRange(0, data.whiteCount * 3);
    wcol.addUpdateRange(0, data.whiteCount * 3);
    wlvl.addUpdateRange(0, data.whiteCount);
    wpos.needsUpdate = true;
    wuv.needsUpdate = true;
    wnor.needsUpdate = true;
    wcol.needsUpdate = true;
    wlvl.needsUpdate = true;
    this.whiteGeometry.setDrawRange(0, data.whiteCount);

    const epos = this.edgeGeometry.getAttribute('position');
    const enor = this.edgeGeometry.getAttribute('normal');
    epos.array.set(data.edgePosition, 0);
    enor.array.set(data.edgeNormal, 0);
    epos.addUpdateRange(0, data.edgeCount * 3);
    enor.addUpdateRange(0, data.edgeCount * 3);
    epos.needsUpdate = true;
    enor.needsUpdate = true;
    this.edgeGeometry.setDrawRange(0, data.edgeCount);

    return { verts: data.count, whiteVerts: data.whiteCount, edgeVerts: data.edgeCount };
  }
}
