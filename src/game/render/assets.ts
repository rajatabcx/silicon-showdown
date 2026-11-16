import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

export type Assets = {
  tusk: GLTF; teal: GLTF;
  props: { sink: THREE.Object3D; chainsaw: THREE.Object3D; ball: THREE.Object3D };
};

let pending: Promise<Assets> | null = null;

/** Loads every model once. Safe to call early (the title screen does) to warm the cache. */
export function loadAssets(onProgress?: (k: number) => void): Promise<Assets> {
  if (pending) return pending;
  const loader = new GLTFLoader();
  const files = ['/models/characters/tusk.glb', '/models/characters/teal.glb', '/models/props/sink.glb', '/models/props/chainsaw.glb', '/models/props/steel_ball.glb'];
  let done = 0;
  const load = (url: string) => loader.loadAsync(url).then((g) => { done++; onProgress?.(done / files.length); return g; });
  pending = Promise.all(files.map(load)).then(([tusk, teal, sink, chainsaw, ball]) => ({
    tusk, teal, props: { sink: sink.scene, chainsaw: chainsaw.scene, ball: ball.scene },
  }));
  pending.catch(() => { pending = null; });
  return pending;
}
