import * as THREE from 'three';
import type { Assets } from './assets';
import { litify, outlineMaterial } from './toon';

// Props for signatures and Supers. The sink, chainsaw and steel ball are Blender models;
// the rest are built here from primitives and canvas textures.

/** The page fonts (loaded by next/font under hashed names), for drawing on canvases. */
function family(v: string, fallback: string) {
  if (typeof document === 'undefined') return fallback;
  const f = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  return f ? `${f}, ${fallback}` : fallback;
}
export const DISPLAY_F = () => family('--ff-display', 'Impact, sans-serif');
export const SANS_F = () => family('--ff-sans', 'Arial, sans-serif');

export function canvasPlane(w: number, h: number, px: number, draw: (c: CanvasRenderingContext2D, W: number, H: number) => void, emissive = 0) {
  const cv = document.createElement('canvas'); cv.width = px; cv.height = Math.round((px * h) / w);
  const c = cv.getContext('2d')!;
  draw(c, cv.width, cv.height);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = emissive > 0
    ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: new THREE.Color(1, 1, 1).multiplyScalar(emissive) })
    : new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.userData.redraw = (fn: typeof draw) => { c.clearRect(0, 0, cv.width, cv.height); fn(c, cv.width, cv.height); tex.needsUpdate = true; };
  return mesh;
}

function wrap(c: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' '); let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (c.measureText(test).width > maxW && line) { c.fillText(line, x, y); y += lh; line = w; } else line = test;
  }
  if (line) c.fillText(line, x, y);
  return y;
}

/** A post card, drawn like a social post (generic, no real logo). */
export function postCard(text: string, handle: string, name: string, stamp: string, w = 3.2) {
  const mesh = canvasPlane(w, w * 0.5, 1024, (c, W, H) => {
    c.fillStyle = '#ffffff'; roundRect(c, 0, 0, W, H, 40); c.fill();
    c.fillStyle = '#16181c';
    c.beginPath(); c.arc(90, 90, 46, 0, 7); c.fill();
    c.fillStyle = '#ffffff'; c.font = `900 50px ${DISPLAY_F()}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(name[0], 90, 94);
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillStyle = '#0f1419'; c.font = `800 40px ${SANS_F()}`; c.fillText(name, 156, 82);
    c.fillStyle = '#536471'; c.font = `500 34px ${SANS_F()}`; c.fillText(handle, 156, 124);
    c.fillStyle = '#0f1419'; c.font = `500 50px ${SANS_F()}`;
    wrap(c, text, 50, 220, W - 100, 64);
    c.fillStyle = '#536471'; c.font = `600 28px ${SANS_F()}`; c.fillText(stamp, 50, H - 44);
  });
  mesh.add(new THREE.Mesh(new THREE.PlaneGeometry(w + 0.08, w * 0.5 + 0.08), new THREE.MeshBasicMaterial({ color: '#111' })).translateZ(-0.01));
  return mesh;
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

/** A floating label that names a prop ("NO COMPETITION", "$420"). Always faces the camera. */
export function label(text: string, color = '#ffd34d', size = 0.5) {
  const cv = document.createElement('canvas'); const c = cv.getContext('2d')!;
  c.font = `900 120px ${DISPLAY_F()}`;
  const tw = c.measureText(text).width;
  cv.width = Math.ceil(tw + 80); cv.height = 170;
  c.font = `900 120px ${DISPLAY_F()}`; c.textBaseline = 'middle'; c.textAlign = 'center';
  c.lineWidth = 18; c.strokeStyle = '#120a0a'; c.lineJoin = 'round'; c.strokeText(text, cv.width / 2, 92);
  c.fillStyle = color; c.fillText(text, cv.width / 2, 92);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  s.scale.set((size * cv.width) / cv.height, size, 1);
  s.renderOrder = 10;
  return s;
}

/** "NO COMPETITION": a gilded monolith that drops from the ceiling. */
export function gate() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: '#d6a83a', metalness: 0.9, roughness: 0.25 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.6, 0.5), gold);
  slab.position.y = 1.3; slab.castShadow = true; g.add(slab);
  const hull = new THREE.Mesh(slab.geometry, outlineMaterial(0.02)); slab.add(hull);
  const face = canvasPlane(1.3, 2.2, 512, (c, W, H) => {
    c.fillStyle = '#1b1406'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#f2d27a'; c.lineWidth = 12; c.strokeRect(18, 18, W - 36, H - 36);
    c.fillStyle = '#f2d27a'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `900 120px ${DISPLAY_F()}`; c.fillText('NO', W / 2, H * 0.32);
    c.font = `900 96px ${DISPLAY_F()}`; c.fillText('COMPETITION', W / 2, H * 0.5, W - 80);
    c.font = `600 34px ${SANS_F()}`; c.fillText('A MONOPOLY', W / 2, H * 0.82);
  });
  face.position.set(0, 1.3, 0.26); g.add(face);
  const back = face.clone(); back.position.z = -0.26; back.rotation.y = Math.PI; g.add(back);
  return g;
}

/** A sheet of lecture notes. */
export function page() {
  const m = canvasPlane(0.42, 0.56, 256, (c, W, H) => {
    c.fillStyle = '#f6f1e3'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#7a1d1d'; c.font = `900 30px ${DISPLAY_F()}`; c.fillText('LECTURE IV', 18, 44);
    c.fillStyle = '#555'; for (let y = 70; y < H - 20; y += 18) c.fillRect(18, y, W - 36 - (y % 3) * 20, 4);
  });
  (m.material as THREE.Material).side = THREE.DoubleSide;
  return m;
}

/** Super prop: a rocket. */
export function rocket() {
  const g = new THREE.Group();
  const white = new THREE.MeshToonMaterial({ color: '#eceff3' });
  const dark = new THREE.MeshToonMaterial({ color: '#202530' });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 4.2, 24), white); g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 24), white); nose.position.y = 2.65; g.add(nose);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.3, 24), dark); band.position.y = 1.4; g.add(band);
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.7), dark);
    fin.position.set(Math.cos((i * Math.PI) / 2) * 0.45, -1.8, Math.sin((i * Math.PI) / 2) * 0.45);
    fin.rotation.y = -(i * Math.PI) / 2; g.add(fin);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.6, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb347').multiplyScalar(4), transparent: true, opacity: 0.9 }));
  flame.position.y = -2.9; flame.rotation.x = Math.PI; flame.name = 'flame'; g.add(flame);
  const lbl = canvasPlane(0.9, 2.6, 256, (c, W, H) => {
    c.fillStyle = '#16181c'; c.font = `900 120px ${DISPLAY_F()}`; c.textAlign = 'center';
    c.save(); c.translate(W / 2, H / 2); c.rotate(-Math.PI / 2); c.fillText('TO THE MOON', 0, 40); c.restore();
  });
  lbl.position.set(0, 0.2, 0.43); g.add(lbl);
  const meshes: THREE.Mesh[] = [];
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.name !== 'flame') meshes.push(o as THREE.Mesh); });
  for (const mesh of meshes) { mesh.castShadow = true; mesh.add(new THREE.Mesh(mesh.geometry, outlineMaterial(0.03))); }
  return g;
}

/** Super insert: a market ticker screen. Call .userData.tick(k) with 0..1 to animate the line up to $420. */
export function tickerScreen() {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.0, 0.12), new THREE.MeshStandardMaterial({ color: '#0b0d12', metalness: 0.5, roughness: 0.4 }));
  g.add(frame);
  const scr = canvasPlane(3.2, 1.8, 1024, () => {}, 1.4);
  scr.position.z = 0.07; g.add(scr);
  const pts: number[] = []; for (let i = 0; i < 60; i++) pts.push(Math.sin(i * 0.7) * 0.06 + Math.sin(i * 2.3) * 0.03);
  g.userData.tick = (k: number) => scr.userData.redraw((c: CanvasRenderingContext2D, W: number, H: number) => {
    c.fillStyle = '#06110b'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(80,255,150,0.12)'; c.lineWidth = 2;
    for (let x = 0; x < W; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y < H; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    const n = Math.floor(10 + k * 50);
    c.strokeStyle = '#3dff8a'; c.lineWidth = 8; c.beginPath();
    for (let i = 0; i < n; i++) {
      const x = 40 + (i / 59) * (W - 260);
      const up = i > 40 ? Math.pow((i - 40) / 19, 2) * 0.62 : 0;
      const y = H * (0.78 - pts[i] - up);
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
    const price = k < 0.66 ? 240 + k * 120 : 320 + ((k - 0.66) / 0.34) * 100;
    c.fillStyle = '#3dff8a'; c.font = `900 150px ${DISPLAY_F()}`; c.textAlign = 'right';
    c.fillText(`$${Math.round(Math.min(420, price))}`, W - 40, 170);
    c.font = `700 44px ${SANS_F()}`; c.fillStyle = '#9dffc4'; c.fillText('PRIVATE AT', W - 44, 240);
    c.textAlign = 'left'; c.fillStyle = '#ff5b5b'; c.font = `800 40px ${SANS_F()}`; c.fillText('LIVE  ● TRADING HALTED?', 40, H - 40);
  });
  g.userData.tick(0);
  return g;
}

/** Super prop for Teal: a talk-show desk, two microphones and a wall clock. */
export function talkShowSet() {
  const g = new THREE.Group();
  const desk = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.9, 40, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: '#2b2f3a', roughness: 0.35, metalness: 0.3 }));
  desk.position.y = 0.45; desk.rotation.y = Math.PI / 2; desk.castShadow = true; g.add(desk);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.06, 40, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: '#d7dbe3', roughness: 0.3 }));
  top.position.y = 0.92; top.rotation.y = Math.PI / 2; g.add(top);
  const front = canvasPlane(2.2, 0.5, 512, (c, W, H) => {
    c.fillStyle = '#c8202f'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#fff'; c.font = `900 84px ${DISPLAY_F()}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('THE QUESTION', W / 2, H / 2 + 4);
  });
  front.position.set(0, 0.45, 1.41); g.add(front);
  for (const x of [-0.6, 0.6]) {
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), new THREE.MeshStandardMaterial({ color: '#222' }));
    stand.position.set(x, 1.2, 0.6); stand.rotation.x = 0.4; g.add(stand);
    const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.12, 4, 8), new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.5 }));
    head.position.set(x, 1.46, 0.7); head.rotation.x = 0.4; g.add(head);
  }
  const clock = new THREE.Group();
  const faceM = canvasPlane(1.2, 1.2, 512, (c, W) => {
    c.fillStyle = '#f7f3ea'; c.beginPath(); c.arc(W / 2, W / 2, W / 2 - 8, 0, 7); c.fill();
    c.strokeStyle = '#111'; c.lineWidth = 16; c.stroke();
    c.fillStyle = '#111';
    for (let i = 0; i < 12; i++) { c.save(); c.translate(W / 2, W / 2); c.rotate((i / 12) * Math.PI * 2); c.fillRect(-6, -W / 2 + 26, 12, 40); c.restore(); }
  });
  clock.add(faceM);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.02), new THREE.MeshBasicMaterial({ color: '#c8202f' }));
  hand.geometry.translate(0, 0.22, 0); hand.position.z = 0.02; hand.name = 'hand'; clock.add(hand);
  clock.position.set(0, 3.2, -1.2); clock.name = 'clock'; g.add(clock);
  return g;
}

/** Clones of the Blender props, cel-shaded and outlined. */
export function modelProp(assets: Assets, which: 'sink' | 'chainsaw' | 'ball') {
  const o = assets.props[which].clone(true);
  litify(o);
  // Keep white porcelain below the bloom threshold.
  o.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh) (m.material as THREE.MeshStandardMaterial).color.multiplyScalar(0.88); });
  return o;
}
