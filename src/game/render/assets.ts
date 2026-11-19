import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

export type Assets = {
  tusk: GLTF; teal: GLTF; bozo: GLTF; ultman: GLTF; carp: GLTF; jensen: GLTF; mork: GLTF; joe: GLTF; covfefe: GLTF; veep: GLTF; melania: GLTF; pete: GLTF; lootnick: GLTF; wite: GLTF;
  props: { sink: THREE.Object3D; chainsaw: THREE.Object3D; ball: THREE.Object3D };
};

let pending: Promise<Assets> | null = null;

/** Loads every model once. Safe to call early (the title screen does) to warm the cache. */
export function loadAssets(onProgress?: (k: number) => void): Promise<Assets> {
  if (pending) return pending;
  const loader = new GLTFLoader();
  const files = [
    '/models/characters/tusk.glb', '/models/characters/teal.glb', '/models/characters/jeffbozo.glb', '/models/characters/sam.glb', '/models/characters/alex.glb', '/models/characters/jensen.glb', '/models/characters/mark.glb',
    '/models/characters/covfefe.glb', '/models/characters/veep.glb', '/models/characters/melania.glb', '/models/characters/pete.glb', '/models/characters/cutnick.glb', '/models/characters/dana.glb',
    '/models/props/sink.glb', '/models/props/chainsaw.glb', '/models/props/steel_ball.glb',
  ];
  let done = 0;
  const load = (url: string) => loader.loadAsync(url).then((g) => { done++; onProgress?.(done / files.length); return g; });
  // Average Joe: the owner's own model once it exists; until then a grey mannequin on a slim body.
  const joe = loader.loadAsync('/models/characters/joe.glb').catch(() => loader.loadAsync('/models/characters/sam.glb').then(mannequin));
  pending = Promise.all([Promise.all(files.map(load)), joe]).then(([[tusk, teal, bozo, ultman, carp, jensen, mork, covfefe, veep, melania, pete, lootnick, wite, sink, chainsaw, ball], joe]) => ({
    tusk, teal, bozo, ultman, carp, jensen, mork, joe, covfefe, veep, melania, pete, lootnick, wite, props: { sink: sink.scene, chainsaw: chainsaw.scene, ball: ball.scene },
  }));
  pending.catch(() => { pending = null; });
  return pending;
}

/** Strip a model to plain grey clay: a stand-in that can't be mistaken for anyone in the roster. */
function mannequin(g: GLTF): GLTF {
  g.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = new THREE.MeshStandardMaterial({ color: '#9a9ea6', roughness: 0.75 });
  });
  return g;
}
