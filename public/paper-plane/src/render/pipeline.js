// HDR 后期：场景 → 亮部提取 → 高斯辉光 → 薄透镜景深 → ACES + grade + 颗粒
import * as THREE from 'three';

const QUAD_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const BRIGHT_FRAG = `
uniform sampler2D tScene;
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;

void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float w = smoothstep(uThreshold, uThreshold + uKnee, l);
  gl_FragColor = vec4(c * w, 1.0);
}
`;

const BLUR_FRAG = `
uniform sampler2D tInput;
uniform vec2 uDir;
varying vec2 vUv;

void main() {
  vec3 sum = texture2D(tInput, vUv).rgb * 0.2270270270;
  sum += texture2D(tInput, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
  sum += texture2D(tInput, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  sum += texture2D(tInput, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
  sum += texture2D(tInput, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(sum, 1.0);
}
`;

const DOF_FRAG = `
#define TAPS 20
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uMaxPx;
varying vec2 vUv;

float linearDepth(float d) {
  float z = d * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}

float cocPx(float dist) {
  float t = abs(1.0 - uFocus / max(dist, 0.001));
  return uMaxPx * clamp(t, 0.0, 1.0);
}

void main() {
  float centerDist = linearDepth(texture2D(tDepth, vUv).x);
  float centerCoc = cocPx(centerDist);
  vec3 base = texture2D(tScene, vUv).rgb;
  if (centerCoc < 0.4) {
    gl_FragColor = vec4(base, 1.0);
    return;
  }

  vec3 acc = base;
  float total = 1.0;
  for (int i = 0; i < TAPS; i++) {
    float fi = float(i) + 0.5;
    float ang = fi * 2.39996323;
    float r = sqrt(fi / float(TAPS)) * centerCoc;
    vec2 off = vec2(cos(ang), sin(ang)) * r * uTexel;
    vec2 suv = clamp(vUv + off, vec2(0.0), vec2(1.0));
    float sd = linearDepth(texture2D(tDepth, suv).x);
    float sc = cocPx(sd);
    float w = clamp(sc - r, 0.0, 1.0);
    if (w <= 0.0) continue;
    acc += texture2D(tScene, suv).rgb * w;
    total += w;
  }
  gl_FragColor = vec4(acc / total, 1.0);
}
`;

const COMPOSITE_FRAG = `
uniform sampler2D tDof;
uniform sampler2D tBloom;
uniform vec2 uResolution;
uniform float uTime;
uniform float uExposure;
uniform float uBloomStrength;
uniform float uCA;
uniform float uVignette;
uniform float uGrain;
uniform float uContrast;
uniform float uSaturation;
uniform vec3 uWB;
uniform float uAspect;
varying vec2 vUv;

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

vec3 linearToSrgb(vec3 c) {
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

void main() {
  vec2 dir = vUv - 0.5;
  vec3 c;
  c.r = texture2D(tDof, vUv + dir * uCA).r;
  c.g = texture2D(tDof, vUv).g;
  c.b = texture2D(tDof, vUv - dir * uCA).b;

  c += texture2D(tBloom, vUv).rgb * uBloomStrength;
  c *= uExposure * uWB;
  c = aces(c);
  c = linearToSrgb(c);

  c = (c - 0.5) * uContrast + 0.5;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSaturation);

  float r = length(dir * vec2(uAspect, 1.0));
  float vig = 1.0 - smoothstep(0.32, 1.02, r);
  c *= mix(1.0, vig, uVignette);

  float n = fract(sin(dot(vUv * uResolution + uTime * 37.0, vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) * uGrain;

  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

function makeRT(w, h, hdr, withDepth, samples = 0) {
  const rt = new THREE.WebGLRenderTarget(w, h, {
    type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
    // 相纸边缘是薄片，没有 MSAA 时斜视的硬边会碎成一串亮点（像缝线）
    samples,
  });
  if (withDepth) {
    const dt = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    dt.minFilter = THREE.NearestFilter;
    dt.magFilter = THREE.NearestFilter;
    rt.depthTexture = dt;
  }
  return rt;
}

export class Pipeline {
  constructor(renderer, spec) {
    this.renderer = renderer;
    this.spec = spec;
    this.focus = spec.camera.focusDistance;
    this.time = 0;

    const gl = renderer.getContext();
    const extFloat = renderer.extensions.has('EXT_color_buffer_float');
    const extHalf = renderer.extensions.has('EXT_color_buffer_half_float');
    this.hdr = !!(extFloat || extHalf);

    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadGeo = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(this.quadGeo, new THREE.MeshBasicMaterial());
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    this.brightMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        uThreshold: { value: spec.post.bloomThreshold },
        uKnee: { value: 0.45 },
      },
      vertexShader: QUAD_VERT,
      fragmentShader: BRIGHT_FRAG,
      depthTest: false,
      depthWrite: false,
    });

    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tInput: { value: null }, uDir: { value: new THREE.Vector2() } },
      vertexShader: QUAD_VERT,
      fragmentShader: BLUR_FRAG,
      depthTest: false,
      depthWrite: false,
    });

    this.dofMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        tDepth: { value: null },
        uTexel: { value: new THREE.Vector2(1, 1) },
        uNear: { value: 0.02 },
        uFar: { value: 20 },
        uFocus: { value: spec.camera.focusDistance },
        uMaxPx: { value: spec.post.dofMaxPx },
      },
      vertexShader: QUAD_VERT,
      fragmentShader: DOF_FRAG,
      depthTest: false,
      depthWrite: false,
    });

    const p = spec.post;
    this.compositeMat = new THREE.ShaderMaterial({
      uniforms: {
        tDof: { value: null },
        tBloom: { value: null },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uExposure: { value: p.exposure },
        uBloomStrength: { value: p.bloomStrength },
        uCA: { value: p.ca },
        uVignette: { value: p.vignette },
        uGrain: { value: p.grain },
        uContrast: { value: p.contrast },
        uSaturation: { value: p.saturation },
        uWB: { value: new THREE.Vector3(...p.whiteBalance) },
        uAspect: { value: 1 },
      },
      vertexShader: QUAD_VERT,
      fragmentShader: COMPOSITE_FRAG,
      depthTest: false,
      depthWrite: false,
    });

    this.sceneRT = null;
    this.dofRT = null;
    this.brightRT = null;
    this.blurA = null;
    this.blurB = null;
    this.width = 1;
    this.height = 1;

    if (this.hdr && gl.checkFramebufferStatus) {
      const test = makeRT(8, 8, true, false);
      renderer.setRenderTarget(test);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      renderer.setRenderTarget(null);
      test.dispose();
      if (!ok) this.hdr = false;
    }
  }

  setSize(w, h) {
    const r = this.renderer;
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const W = Math.max(2, Math.floor(size.x));
    const H = Math.max(2, Math.floor(size.y));
    if (W === this.width && H === this.height && this.sceneRT) return;
    this.width = W;
    this.height = H;

    for (const rt of [this.sceneRT, this.dofRT, this.brightRT, this.blurA, this.blurB]) {
      if (rt) rt.dispose();
    }

    this.sceneRT = makeRT(W, H, this.hdr, true, 4);
    this.dofRT = makeRT(W, H, this.hdr, false);
    const bw = Math.max(2, Math.floor(W / 2));
    const bh = Math.max(2, Math.floor(H / 2));
    this.brightRT = makeRT(bw, bh, this.hdr, false);
    this.blurA = makeRT(bw, bh, this.hdr, false);
    this.blurB = makeRT(bw, bh, this.hdr, false);

    this.dofMat.uniforms.uTexel.value.set(1 / W, 1 / H);
    this.compositeMat.uniforms.uResolution.value.set(W, H);
    this.compositeMat.uniforms.uAspect.value = W / H;
    this.bloomSize = new THREE.Vector2(bw, bh);
  }

  setFocus(d) {
    this.focus = d;
    this.dofMat.uniforms.uFocus.value = d;
  }

  pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  render(scene, camera, time) {
    this.time = time;
    const r = this.renderer;

    r.setRenderTarget(this.sceneRT);
    r.render(scene, camera);

    this.brightMat.uniforms.tScene.value = this.sceneRT.texture;
    this.pass(this.brightMat, this.brightRT);

    this.blurMat.uniforms.tInput.value = this.brightRT.texture;
    this.blurMat.uniforms.uDir.value.set(1.0 / this.bloomSize.x, 0);
    this.pass(this.blurMat, this.blurA);

    this.blurMat.uniforms.tInput.value = this.blurA.texture;
    this.blurMat.uniforms.uDir.value.set(0, 1.0 / this.bloomSize.y);
    this.pass(this.blurMat, this.blurB);

    this.dofMat.uniforms.tScene.value = this.sceneRT.texture;
    this.dofMat.uniforms.tDepth.value = this.sceneRT.depthTexture;
    this.dofMat.uniforms.uNear.value = camera.near;
    this.dofMat.uniforms.uFar.value = camera.far;
    this.pass(this.dofMat, this.dofRT);

    this.compositeMat.uniforms.tDof.value = this.dofRT.texture;
    this.compositeMat.uniforms.tBloom.value = this.blurB.texture;
    this.compositeMat.uniforms.uTime.value = time;
    this.pass(this.compositeMat, null);
  }

  dispose() {
    for (const rt of [this.sceneRT, this.dofRT, this.brightRT, this.blurA, this.blurB]) {
      if (rt) rt.dispose();
    }
    this.quadGeo.dispose();
    for (const m of [this.brightMat, this.blurMat, this.dofMat, this.compositeMat]) m.dispose();
  }
}
