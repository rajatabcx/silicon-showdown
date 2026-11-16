import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Head-and-shoulders portraits for the select screen, photographed from the fighters' own 3D models so the tiles
 * always match what is in the fight. Returns a PNG data URL per model (transparent background).
 */
export function makePortraits<K extends string>(models: Record<K, GLTF>, size = 320): Record<K, string> {
  const gl = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  gl.setSize(size, size, false);
  gl.setPixelRatio(1);
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff4e0', '#3a3550', 1.5));
  const key = new THREE.DirectionalLight('#fff1d6', 2.6); key.position.set(1.5, 2.2, 3); scene.add(key);
  const rim = new THREE.DirectionalLight('#9fc4ff', 1.6); rim.position.set(-2.5, 1.5, -2); scene.add(rim);
  const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 20);
  const out = {} as Record<K, string>;
  for (const id of Object.keys(models) as K[]) {
    const model = SkeletonUtils.clone(models[id].scene);
    scene.add(model);
    model.updateMatrixWorld(true);
    const head = model.getObjectByName('mixamorigHead');
    const p = new THREE.Vector3();
    if (head) head.getWorldPosition(p); else new THREE.Box3().setFromObject(model).getCenter(p);
    // Bobble-head proportions: the head bone sits at the jaw, so aim a little above it.
    const target = p.clone().add(new THREE.Vector3(0, 0.16, 0));
    cam.position.copy(target).add(new THREE.Vector3(0.38, 0.06, 1.75));
    cam.lookAt(target);
    gl.render(scene, cam);
    out[id] = gl.domElement.toDataURL('image/png');
    scene.remove(model);
  }
  gl.dispose();
  gl.forceContextLoss();
  return out;
}
