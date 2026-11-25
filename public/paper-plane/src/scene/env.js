// 程序化环境球 → PMREM，给 PBR 材质提供柔和的间接光
import * as THREE from 'three';
import { makeEnvTexture } from '../paper/texture.js';

// 返回整个 render target 而不是 texture：换背景时调用方要 dispose 的是 RT，
// 只放掉 texture 会把底层的 RT 留在显存里
export function buildEnvironment(renderer, kind = 'desk') {
  const envTex = makeEnvTexture(kind);
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const rt = pmrem.fromEquirectangular(envTex);
  pmrem.dispose();
  envTex.dispose();
  return rt;
}
