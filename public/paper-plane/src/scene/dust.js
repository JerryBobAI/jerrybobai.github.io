// 光柱里的浮尘：固定种子布点，相位驱动，单 draw call
import * as THREE from 'three';
import { makeRng } from '../rng.js';

const VERT = `
attribute float aPhase;
attribute float aSpeed;
attribute float aSize;
uniform float uTime;
uniform float uPixelRatio;
varying float vAlpha;

void main() {
  vec3 p = position;
  float span = 0.92;
  p.y = 0.03 + mod(position.y + uTime * aSpeed, span);
  p.x += sin(uTime * 0.13 + aPhase) * 0.026;
  p.z += cos(uTime * 0.11 + aPhase * 1.7) * 0.026;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPixelRatio * (1.0 / max(0.08, -mv.z)) * 0.6;

  float life = p.y / span;
  vAlpha = sin(clamp(life, 0.0, 1.0) * 3.14159265);
}
`;

const FRAG = `
uniform float uOpacity;
uniform vec3 uColor;
varying float vAlpha;

void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  float a = smoothstep(0.5, 0.06, d) * vAlpha * uOpacity;
  if (a < 0.002) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

export function buildDust() {
  const COUNT = 260;
  const rng = makeRng(0x51ed270b);
  const pos = new Float32Array(COUNT * 3);
  const phase = new Float32Array(COUNT);
  const speed = new Float32Array(COUNT);
  const size = new Float32Array(COUNT);

  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = rng.range(-0.62, 0.42);
    pos[i * 3 + 1] = rng.range(0, 0.92);
    pos[i * 3 + 2] = rng.range(-0.42, 0.38);
    phase[i] = rng.range(0, Math.PI * 2);
    speed[i] = rng.range(0.006, 0.022);
    size[i] = rng.range(0.5, 1.9);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uOpacity: { value: 0.32 },
      uColor: { value: new THREE.Color(1.0, 0.93, 0.82) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  return {
    points,
    update(t, pixelRatio) {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uPixelRatio.value = pixelRatio;
    },
    // 背景换了，浮尘的亮度和色温跟着走（海边的尘偏冷白，黄昏偏橙）
    setMood(opacity, rgb) {
      mat.uniforms.uOpacity.value = 0.32 * opacity;
      mat.uniforms.uColor.value.setRGB(rgb[0], rgb[1], rgb[2]);
    },
  };
}
