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

/**
 * A chat "typing" bubble: three dots that bob one after another, like someone composing a reply that never comes.
 * Call userData.tick(seconds, height) every frame; it always faces the camera.
 */
export function typingDots() {
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 220;
  const c = cv.getContext('2d')!;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  s.renderOrder = 10;
  s.center.set(0.5, 0);
  s.userData.tick = (t: number, size = 0.7) => {
    c.clearRect(0, 0, 320, 220);
    c.lineJoin = 'round'; c.lineWidth = 12; c.strokeStyle = '#120a0a'; c.fillStyle = '#ffffff';
    // Bubble with a small tail at the bottom left.
    c.beginPath();
    c.moveTo(70, 172); c.lineTo(46, 212); c.lineTo(112, 172);
    c.lineTo(250, 172); c.quadraticCurveTo(310, 172, 310, 112); c.lineTo(310, 72); c.quadraticCurveTo(310, 12, 250, 12);
    c.lineTo(70, 12); c.quadraticCurveTo(10, 12, 10, 72); c.lineTo(10, 112); c.quadraticCurveTo(10, 172, 70, 172);
    c.closePath(); c.fill(); c.stroke();
    for (let i = 0; i < 3; i++) {
      // Each dot rises and brightens in turn, then rests.
      const ph = (t * 1.25 - i * 0.16) % 1;
      const up = ph < 0.45 ? Math.sin((ph / 0.45) * Math.PI) : 0;
      c.fillStyle = `rgb(${Math.round(150 - up * 110)},${Math.round(156 - up * 112)},${Math.round(168 - up * 116)})`;
      c.beginPath(); c.arc(92 + i * 68, 96 - up * 26, 21 + up * 4, 0, Math.PI * 2); c.fill();
    }
    tex.needsUpdate = true;
    s.scale.set((size * 320) / 220, size, 1);
  };
  s.userData.tick(0);
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
export function rocket(text = 'TO THE MOON') {
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
    c.save(); c.translate(W / 2, H / 2); c.rotate(-Math.PI / 2); c.fillText(text, 0, 40, H - 30); c.restore();
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

// ---------- Jeff Bozo, Sam Ultman and Madame Producer

function outlined(g: THREE.Object3D, w = 0.02) {
  const meshes: THREE.Mesh[] = [];
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !(m.material as THREE.Material).transparent) meshes.push(m); });
  for (const mesh of meshes) { mesh.castShadow = true; mesh.add(new THREE.Mesh(mesh.geometry, outlineMaterial(w))); }
  return g;
}

/** A shipping box with a printed label (You Paid For This, and the Super's box rain). */
export function parcel(text = 'YOU PAID FOR THIS', size = 0.55) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.72, size * 0.8), new THREE.MeshToonMaterial({ color: '#c99a5b' }));
  g.add(box);
  const tape = new THREE.Mesh(new THREE.BoxGeometry(size * 0.2, size * 0.725, size * 0.805), new THREE.MeshToonMaterial({ color: '#e7d3a3' }));
  g.add(tape);
  outlined(g, 0.015);
  const face = canvasPlane(size * 0.9, size * 0.6, 256, (c, W, H) => {
    c.fillStyle = '#f4efe4'; c.fillRect(W * 0.08, H * 0.12, W * 0.84, H * 0.76);
    c.fillStyle = '#16181c'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `900 ${Math.round(H * 0.2)}px ${DISPLAY_F()}`;
    const words = text.split(' '); const half = Math.ceil(words.length / 2);
    c.fillText(words.slice(0, half).join(' '), W / 2, H * 0.36, W * 0.78);
    c.fillText(words.slice(half).join(' '), W / 2, H * 0.6, W * 0.78);
    c.fillStyle = '#d0342c'; c.font = `800 ${Math.round(H * 0.1)}px ${SANS_F()}`; c.fillText('ARRIVING TODAY', W / 2, H * 0.8);
  });
  face.position.z = size * 0.405; g.add(face);
  const back = face.clone(); back.position.z = -size * 0.405; back.rotation.y = Math.PI; g.add(back);
  return g;
}

/** An error dialog card, flicked like a playing card (Quite Wrong). */
export function errorCard() {
  const m = canvasPlane(0.72, 0.46, 256, (c, W, H) => {
    c.fillStyle = '#f2f2f2'; roundRect(c, 0, 0, W, H, 14); c.fill();
    c.fillStyle = '#d0342c'; roundRect(c, 0, 0, W, H * 0.26, 14); c.fill(); c.fillRect(0, H * 0.14, W, H * 0.12);
    c.fillStyle = '#fff'; c.font = `900 ${Math.round(H * 0.16)}px ${DISPLAY_F()}`; c.textBaseline = 'middle';
    c.fillText('ERROR', 16, H * 0.14);
    c.fillStyle = '#d0342c'; c.beginPath(); c.moveTo(42, H * 0.42); c.lineTo(70, H * 0.78); c.lineTo(14, H * 0.78); c.closePath(); c.fill();
    c.fillStyle = '#fff'; c.font = `900 ${Math.round(H * 0.22)}px ${DISPLAY_F()}`; c.textAlign = 'center'; c.fillText('!', 42, H * 0.64);
    c.fillStyle = '#16181c'; c.textAlign = 'left'; c.font = `800 ${Math.round(H * 0.13)}px ${SANS_F()}`;
    c.fillText('It went', 86, H * 0.48); c.fillText('quite wrong.', 86, H * 0.66);
    c.strokeStyle = '#999'; c.lineWidth = 3; roundRect(c, W - 84, H - 46, 70, 32, 6); c.stroke();
    c.fillStyle = '#333'; c.font = `700 ${Math.round(H * 0.09)}px ${SANS_F()}`; c.textAlign = 'center'; c.fillText('OK', W - 49, H - 30);
  }, 1.0);
  (m.material as THREE.Material).side = THREE.DoubleSide;
  return m;
}

/** A burning asteroid that comes down on the opponent (End of the World). Its base sits at y = 0, like the gate. */
export function meteor() {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(0.85, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const k = 1 + Math.sin(i * 12.9898) * 0.12;
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  geo.scale(0.8, 0.8, 0.8);
  const rock = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: '#3b302b', emissive: new THREE.Color('#ff4a12'), emissiveIntensity: 0.18 }));
  rock.position.y = 0.7; g.add(rock);
  outlined(g, 0.03);
  // The trail it leaves on the way down (hidden once it lands).
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.2, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a2a').multiplyScalar(2), transparent: true, opacity: 0.32, depthWrite: false }));
  fire.position.y = 2.2; fire.name = 'fire'; g.add(fire);
  return g;
}

/** A movie poster in a gold frame ($40M Premiere). A generic one-sheet: title, credit, release line. */
export function moviePoster() {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.12), new THREE.MeshStandardMaterial({ color: '#d6a83a', metalness: 0.85, roughness: 0.3 }));
  frame.position.y = 1.3; g.add(frame);
  outlined(g, 0.02);
  const face = canvasPlane(1.45, 2.22, 512, (c, W, H) => {
    const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b0a12'); bg.addColorStop(1, '#2a1c3a');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,230,170,0.18)'; c.beginPath(); c.arc(W / 2, H * 0.34, W * 0.34, 0, 7); c.fill();
    c.fillStyle = '#f2d27a'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `600 30px ${SANS_F()}`; c.fillText('A $40,000,000 PRODUCTION', W / 2, H * 0.07, W - 30);
    c.font = `900 120px ${DISPLAY_F()}`; c.fillText('HERE', W / 2, H * 0.62); c.fillText('IT IS', W / 2, H * 0.73);
    c.font = `700 28px ${SANS_F()}`; c.fillStyle = '#cfc6b0'; c.fillText('EXECUTIVE PRODUCER: HERSELF', W / 2, H * 0.84, W - 30);
    c.font = `900 40px ${DISPLAY_F()}`; c.fillStyle = '#ffffff'; c.fillText('NOW STREAMING', W / 2, H * 0.93);
  });
  face.position.set(0, 1.3, 0.07); g.add(face);
  const back = face.clone(); back.position.z = -0.07; back.rotation.y = Math.PI; g.add(back);
  return g;
}

/** One panel of an ad wall (Last Resort): a loud sponsored banner on a frame. */
export function adPanel(text: string, color: string) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.0, 0.1), new THREE.MeshToonMaterial({ color: '#1b1f27' }));
  frame.position.y = 1.0; g.add(frame);
  outlined(g, 0.02);
  const face = canvasPlane(1.0, 1.9, 256, (c, W, H) => {
    c.fillStyle = color; c.fillRect(0, 0, W, H);
    c.fillStyle = '#fff36a'; c.fillRect(0, 0, W, H * 0.12);
    c.fillStyle = '#16181c'; c.font = `900 ${Math.round(H * 0.07)}px ${DISPLAY_F()}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('SPONSORED', W / 2, H * 0.06);
    c.fillStyle = '#fff'; c.font = `900 ${Math.round(H * 0.2)}px ${DISPLAY_F()}`; c.fillText('AD', W / 2, H * 0.38);
    c.font = `900 ${Math.round(H * 0.08)}px ${DISPLAY_F()}`;
    text.split(' ').forEach((w, i) => c.fillText(w, W / 2, H * (0.6 + i * 0.1), W * 0.9));
  }, 1.1);
  face.position.set(0, 1.0, 0.06); g.add(face);
  const back = face.clone(); back.position.z = -0.06; back.rotation.y = Math.PI; g.add(back);
  return g;
}

/** A banknote for the Super's money rain. Generic, no real currency design. */
export function bill() {
  const m = canvasPlane(0.5, 0.24, 128, (c, W, H) => {
    c.fillStyle = '#7fbf7a'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#2f5d34'; c.lineWidth = 4; c.strokeRect(5, 5, W - 10, H - 10);
    c.fillStyle = '#2f5d34'; c.beginPath(); c.arc(W / 2, H / 2, H * 0.3, 0, 7); c.fill();
    c.fillStyle = '#cfe8c9'; c.font = `900 ${Math.round(H * 0.42)}px ${DISPLAY_F()}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', W / 2, H / 2 + 2);
  });
  (m.material as THREE.Material).side = THREE.DoubleSide;
  return m;
}

/**
 * Super backdrop for Ultman: a giant announcement screen. Call .userData.tick(k) with 0..1 to count the money up,
 * and the jobs with it.
 */
export function announcementScreen() {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.4, 0.14), new THREE.MeshStandardMaterial({ color: '#0b0d12', metalness: 0.5, roughness: 0.4 }));
  g.add(frame);
  const scr = canvasPlane(5.0, 2.2, 1024, () => {}, 1.3);
  scr.position.z = 0.08; g.add(scr);
  g.userData.tick = (k: number) => scr.userData.redraw((c: CanvasRenderingContext2D, W: number, H: number) => {
    const bg = c.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0a1a2a'); bg.addColorStop(1, '#0d3a33');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    c.fillStyle = '#9ff0cf'; c.font = `700 36px ${SANS_F()}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('ANNOUNCING · THE MOST IMPORTANT PROJECT OF THIS ERA', W / 2, H * 0.14, W - 60);
    const n = Math.round(Math.min(1, k) * 500);
    c.fillStyle = '#ffffff'; c.font = `900 170px ${DISPLAY_F()}`;
    c.fillText(`$${n},000,000,000`, W / 2, H * 0.47, W - 60);
    const jobs = Math.round(Math.min(1, k) * 100) * 1000;
    c.fillStyle = '#ffd34d'; c.font = `800 50px ${SANS_F()}`;
    c.fillText(`JOBS: ${jobs.toLocaleString('en-US')}+   ·   AGI: BUILT HERE`, W / 2, H * 0.76, W - 80);
    c.fillStyle = '#ff5b5b'; c.font = `800 30px ${SANS_F()}`; c.fillText('● LIVE · PRESS CONFERENCE', W / 2, H * 0.92);
  });
  g.userData.tick(0);
  return g;
}

/**
 * Carp's Super: a grey surveillance quadcopter with a yellow tank slung underneath ("LIGHTLY LACED") and a nozzle.
 * userData.tick(t) spins the rotors and pulses the eye. `nozzle` is the spray origin.
 */
export function drone() {
  const g = new THREE.Group();
  const grey = new THREE.MeshToonMaterial({ color: '#5b6270' });
  const dark = new THREE.MeshToonMaterial({ color: '#23272f' });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.6), grey); g.add(body);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), dark); dome.position.y = 0.1; g.add(dome);
  const rotors: THREE.Object3D[] = [];
  for (const [x, z] of [[-0.62, -0.42], [0.62, -0.42], [-0.62, 0.42], [0.62, 0.42]]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.08), dark);
    arm.position.set(x / 2, 0.04, z / 2); arm.rotation.y = Math.atan2(-z, x); g.add(arm);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 10), dark); hub.position.set(x, 0.1, z); g.add(hub);
    const blade = new THREE.Group(); blade.position.set(x, 0.17, z);
    for (const r of [0, Math.PI / 2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.015, 0.07), dark); b.rotation.y = r; blade.add(b); }
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.33, 24), new THREE.MeshBasicMaterial({ color: '#c9d2e0', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    disc.rotation.x = -Math.PI / 2; blade.add(disc);
    g.add(blade); rotors.push(blade);
  }
  // The tank, with its warning label on both faces.
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 20), new THREE.MeshToonMaterial({ color: '#f2c933' }));
  tank.rotation.z = Math.PI / 2; tank.position.y = -0.27; g.add(tank);
  const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 12), dark); nozzle.position.set(0, -0.5, 0.05); nozzle.rotation.x = Math.PI; g.add(nozzle);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3b30').multiplyScalar(2) }));
  eye.position.set(0, 0.0, 0.31); g.add(eye);
  outlined(g, 0.018);
  const sticker = (z: number, ry: number) => {
    const m = canvasPlane(0.62, 0.26, 512, (c, W, H) => {
      c.fillStyle = '#ffe14d'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#16181c'; c.fillRect(0, 0, W, H * 0.12); c.fillRect(0, H * 0.88, W, H * 0.12);
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 ${Math.round(H * 0.36)}px ${DISPLAY_F()}`;
      c.fillText('LIGHTLY LACED', W / 2, H * 0.42, W * 0.92);
      c.font = `800 ${Math.round(H * 0.16)}px ${SANS_F()}`; c.fillText('FOR ANALYSTS ONLY', W / 2, H * 0.72, W * 0.9);
    });
    m.position.set(0, -0.27, z); m.rotation.y = ry; g.add(m);
  };
  sticker(0.205, 0); sticker(-0.205, Math.PI);
  g.userData.nozzle = nozzle;
  g.userData.tick = (t: number) => {
    rotors.forEach((r, i) => { r.rotation.y = t * 40 * (i % 2 ? 1 : -1); });
    (eye.material as THREE.MeshBasicMaterial).color.setRGB(2 + Math.sin(t * 12) * 0.8, 0.25, 0.2);
  };
  return g;
}

/** A floor reticle with a tag ("ANALYST", "TARGET ACQUIRED"). Its base sits at y = 0. userData.tick(k) closes it in. */
export function reticle(text: string, color = '#ff3b30') {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const outer = new THREE.Mesh(new THREE.RingGeometry(0.85, 0.95, 48), mat); outer.rotation.x = -Math.PI / 2; outer.position.y = 0.04; g.add(outer);
  const inner = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.38, 36), mat); inner.rotation.x = -Math.PI / 2; inner.position.y = 0.04; g.add(inner);
  for (let i = 0; i < 4; i++) {
    const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.07), mat);
    tick.rotation.x = -Math.PI / 2; tick.rotation.z = (i * Math.PI) / 2;
    tick.position.set(Math.cos((i * Math.PI) / 2) * 0.62, 0.045, -Math.sin((i * Math.PI) / 2) * 0.62); g.add(tick);
  }
  const tag = label(text, color, 0.34); tag.position.y = 2.75; g.add(tag);
  g.userData.tick = (k: number, t = 0) => {
    const s = 1.9 - Math.min(1, k) * 0.9;
    outer.scale.setScalar(s); inner.rotation.z = t * 3; outer.rotation.z = -t * 1.2;
    mat.opacity = 0.55 + Math.sin(t * 18) * 0.25;
    tag.material.opacity = Math.min(1, k * 2);
  };
  g.userData.tick(0);
  return g;
}

/** On Occasion: a cartoon precision munition, nose down. Its tip sits at y = 0, like the gate's base. */
export function strikeMissile() {
  const g = new THREE.Group();
  const white = new THREE.MeshToonMaterial({ color: '#e4e7ec' });
  const dark = new THREE.MeshToonMaterial({ color: '#2a2f38' });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.5, 20), white); body.position.y = 1.15; g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 20), dark); nose.rotation.x = Math.PI; nose.position.y = 0.2; g.add(nose);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.12, 20), new THREE.MeshToonMaterial({ color: '#d0342c' })); band.position.y = 0.6; g.add(band);
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.03), dark);
    fin.position.set(Math.cos((i * Math.PI) / 2) * 0.3, 1.8, Math.sin((i * Math.PI) / 2) * 0.3); fin.rotation.y = -(i * Math.PI) / 2; g.add(fin);
  }
  outlined(g, 0.02);
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.4, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb347').multiplyScalar(2), transparent: true, opacity: 0.4, depthWrite: false }));
  fire.position.y = 2.6; fire.name = 'fire'; g.add(fire);
  return g;
}

/**
 * Make Them Poorer: a trading-floor chart on a stand. userData.tick(k) redraws the short sellers' position crashing
 * (k 0..1), and the loss counting up.
 */
export function shortChart() {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 0.1), new THREE.MeshStandardMaterial({ color: '#0b0d12', metalness: 0.5, roughness: 0.4 }));
  frame.position.y = 1.5; g.add(frame);
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), new THREE.MeshToonMaterial({ color: '#23272f' })); leg.position.y = 0.4; g.add(leg);
  outlined(g, 0.02);
  const scr = canvasPlane(2.1, 1.3, 768, () => {}, 1.25);
  scr.position.set(0, 1.5, 0.06); g.add(scr);
  g.userData.tick = (k: number) => scr.userData.redraw((c: CanvasRenderingContext2D, W: number, H: number) => {
    c.fillStyle = '#07120f'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(120,255,190,0.12)'; c.lineWidth = 2;
    for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(0, (H * i) / 6); c.lineTo(W, (H * i) / 6); c.stroke(); }
    c.fillStyle = '#9fffd0'; c.font = `800 ${Math.round(H * 0.08)}px ${SANS_F()}`; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText('SHORT SELLERS · POSITION', 24, H * 0.09);
    const n = 40, kk = Math.min(1, k);
    c.lineWidth = 9; c.lineJoin = 'round'; c.strokeStyle = kk > 0.2 ? '#ff4a3d' : '#3dff9a';
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const x = 30 + ((W - 60) * i) / n;
      const wob = Math.sin(i * 1.7) * 0.035;
      const fall = i / n > 0.45 ? Math.min(1, ((i / n - 0.45) / 0.55) * kk * 1.3) : 0;
      const y = H * (0.3 + wob + fall * 0.6);
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    }
    c.stroke();
    c.fillStyle = '#ff4a3d'; c.font = `900 ${Math.round(H * 0.2)}px ${DISPLAY_F()}`; c.textAlign = 'right';
    c.fillText(`-$${Math.round(kk * 912)}M`, W - 24, H * 0.24);
    c.fillStyle = '#ffffff'; c.font = `900 ${Math.round(H * 0.11)}px ${DISPLAY_F()}`; c.textAlign = 'center';
    if (kk > 0.6) c.fillText('MARGIN CALL', W / 2, H * 0.92);
  });
  g.userData.tick(0);
  return g;
}

/**
 * Group Chat: a giant phone showing a secure group chat about the war plans, with the opponent just added to it.
 * Generic messenger look, no real app branding. Its base sits at y = 0.
 */
export function chatPhone() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.8, 0.16), new THREE.MeshStandardMaterial({ color: '#15171c', metalness: 0.6, roughness: 0.35 }));
  body.position.y = 1.45; g.add(body);
  outlined(g, 0.02);
  const scr = canvasPlane(1.36, 2.62, 512, (c, W, H) => {
    c.fillStyle = '#f4f5f8'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#2c6bed'; c.fillRect(0, 0, W, H * 0.12);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `800 ${Math.round(H * 0.034)}px ${SANS_F()}`; c.fillText('🔒 WAR PLANS 🇺🇸', W / 2, H * 0.05, W - 30);
    c.font = `600 ${Math.round(H * 0.022)}px ${SANS_F()}`; c.fillText('18 members', W / 2, H * 0.09);
    const bub = (y: number, mine: boolean, text: string, col = mine ? '#2c6bed' : '#e2e5ec') => {
      c.font = `600 ${Math.round(H * 0.03)}px ${SANS_F()}`;
      const w = Math.min(W * 0.78, c.measureText(text).width + 40);
      const x = mine ? W - w - 20 : 20;
      c.fillStyle = col; roundRect(c, x, y, w, H * 0.06, 22); c.fill();
      c.fillStyle = mine ? '#fff' : '#16181c'; c.textAlign = 'left'; c.fillText(text, x + 20, y + H * 0.031, w - 36);
    };
    bub(H * 0.16, false, 'Weather is FAVORABLE');
    bub(H * 0.24, true, 'Strike at 1215 🇺🇸');
    bub(H * 0.32, false, 'Typed up the plan below');
    bub(H * 0.4, true, '👊🇺🇸🔥');
    c.fillStyle = '#ff3b30'; c.textAlign = 'center'; c.font = `900 ${Math.round(H * 0.05)}px ${DISPLAY_F()}`;
    c.fillText('YOU WERE ADDED', W / 2, H * 0.57, W - 30);
    c.fillStyle = '#6b7280'; c.font = `600 ${Math.round(H * 0.024)}px ${SANS_F()}`; c.fillText('by Pete Hexseth', W / 2, H * 0.62);
    bub(H * 0.68, true, 'Nobody was texting war plans');
    c.fillStyle = '#e2e5ec'; roundRect(c, 20, H * 0.9, W - 40, H * 0.06, 26); c.fill();
    c.fillStyle = '#9aa0ab'; c.textAlign = 'left'; c.font = `600 ${Math.round(H * 0.026)}px ${SANS_F()}`; c.fillText('Message', 50, H * 0.93);
  }, 1.05);
  scr.position.set(0, 1.45, 0.085); g.add(scr);
  return g;
}

/** A glowing yellow droplet for the drone's spray. */
export function sprayDrop() {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: new THREE.Color('#ffd83a').multiplyScalar(1.6), transparent: true, depthWrite: false }));
  s.scale.setScalar(0.12);
  return s;
}

/** Clones of the Blender props, cel-shaded and outlined. */
export function modelProp(assets: Assets, which: 'sink' | 'chainsaw' | 'ball') {
  const o = assets.props[which].clone(true);
  litify(o);
  // Keep white porcelain below the bloom threshold.
  o.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh) (m.material as THREE.MeshStandardMaterial).color.multiplyScalar(0.88); });
  return o;
}

// ---------- Jacket Jensen and Howard Lootnick

/** A graphics card (The More You Buy, and the Super's GPU rain): a dark shroud, a green stripe, two fans. Generic. */
export function gpuCard(size = 1) {
  const g = new THREE.Group();
  const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.8 * size, 0.3 * size, 0.14 * size), new THREE.MeshStandardMaterial({ color: '#23262b', metalness: 0.6, roughness: 0.35 }));
  g.add(shroud);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.805 * size, 0.04 * size, 0.145 * size), new THREE.MeshBasicMaterial({ color: new THREE.Color('#76b900').multiplyScalar(1.6) }));
  stripe.position.y = 0.11 * size; g.add(stripe);
  const pcb = new THREE.Mesh(new THREE.BoxGeometry(0.78 * size, 0.06 * size, 0.02 * size), new THREE.MeshToonMaterial({ color: '#2f6b3a' }));
  pcb.position.set(0, -0.17 * size, -0.05 * size); g.add(pcb);
  outlined(g, 0.012);
  const fans: THREE.Object3D[] = [];
  for (const x of [-0.2, 0.2]) {
    const fan = canvasPlane(0.24 * size, 0.24 * size, 128, (c, W, H) => {
      c.fillStyle = '#0e0f11'; c.beginPath(); c.arc(W / 2, H / 2, W / 2, 0, 7); c.fill();
      c.fillStyle = '#5a5f66';
      for (let i = 0; i < 7; i++) { c.save(); c.translate(W / 2, H / 2); c.rotate((i / 7) * Math.PI * 2); c.beginPath(); c.ellipse(W * 0.22, 0, W * 0.2, W * 0.07, 0.5, 0, 7); c.fill(); c.restore(); }
      c.fillStyle = '#76b900'; c.beginPath(); c.arc(W / 2, H / 2, W * 0.1, 0, 7); c.fill();
    });
    fan.position.set(x * size, -0.01 * size, 0.072 * size); g.add(fan); fans.push(fan);
  }
  g.userData.tick = (t: number) => fans.forEach((f) => { f.rotation.z = -t * 30; });
  return g;
}

/**
 * The Super's backdrop: a market screen. tick(k, t): the chart climbs on the GPU pitch (k 0..0.5), then crashes
 * (k 0.5..1) while the loss counts up; a BREAKING ticker scrolls along the bottom once `news` is set.
 */
export function crashScreen() {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.6, 0.14), new THREE.MeshStandardMaterial({ color: '#0b0d12', metalness: 0.5, roughness: 0.4 }));
  g.add(frame);
  const scr = canvasPlane(5.0, 2.4, 1024, () => {}, 1.35);
  scr.position.z = 0.08; g.add(scr);
  const news = 'BREAKING · JACKET JENSEN OUT AFTER AFFAIR REPORTS · ONE PARTNER A SUSPECTED SPY (ALLEGED) · SENATE WANTS ANSWERS · ';
  const pts: number[] = []; for (let i = 0; i <= 60; i++) pts.push(Math.sin(i * 0.9) * 0.025 + Math.sin(i * 2.1) * 0.015);
  g.userData.news = false;
  g.userData.tick = (k: number, t = 0) => scr.userData.redraw((c: CanvasRenderingContext2D, W: number, H: number) => {
    c.fillStyle = '#05080a'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(160,255,120,0.1)'; c.lineWidth = 2;
    for (let x = 0; x < W; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y < H; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    const crash = Math.max(0, (k - 0.5) * 2), up = Math.min(1, k * 2);
    const n = Math.round(20 + up * 30 + crash * 10);
    c.lineWidth = 9; c.lineJoin = 'round'; c.strokeStyle = crash > 0.05 ? '#ff4a3d' : '#8be04a';
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const x = 40 + (i / 60) * (W - 300);
      let y = 0.72 - pts[i] - Math.min(i, 50) / 50 * 0.42 * up;
      if (i > 50) y += ((i - 50) / 10) * 0.6 * crash;
      if (i === 0) c.moveTo(x, H * y); else c.lineTo(x, H * y);
    }
    c.stroke();
    c.textAlign = 'right'; c.textBaseline = 'middle';
    c.fillStyle = crash > 0.05 ? '#ff4a3d' : '#8be04a'; c.font = `900 120px ${DISPLAY_F()}`;
    const v = crash > 0.05 ? `−$${Math.round(crash * 1000)}B` : `+${Math.round(up * 240)}%`;
    c.fillText(v, W - 40, H * 0.2);
    c.fillStyle = '#d8ffd0'; c.font = `700 38px ${SANS_F()}`;
    c.fillText(crash > 0.05 ? 'MARKET CAP' : 'THE MORE YOU BUY', W - 44, H * 0.34);
    c.textAlign = 'left'; c.fillStyle = '#bfe8a8'; c.font = `800 34px ${SANS_F()}`; c.fillText('JKT · CHIPS', 40, H * 0.08);
    if (g.userData.news) {
      c.fillStyle = '#c8102e'; c.fillRect(0, H * 0.84, W, H * 0.16);
      c.fillStyle = '#ffffff'; c.font = `900 56px ${DISPLAY_F()}`; c.textBaseline = 'middle';
      const tw = c.measureText(news).width, off = (t * 420) % tw;
      c.fillText(news + news, W * 0.2 - off, H * 0.92);
      c.fillStyle = '#ffd34d'; c.fillRect(0, H * 0.84, W * 0.18, H * 0.16);
      c.fillStyle = '#111'; c.textAlign = 'center'; c.font = `900 50px ${DISPLAY_F()}`; c.fillText('LIVE', W * 0.09, H * 0.92);
    }
  });
  g.userData.tick(0);
  return g;
}

/** A giant red down arrow, the chart's last leg, that comes down on the opponent. Its tip sits at y = 0. */
export function crashArrow() {
  const g = new THREE.Group();
  const red = new THREE.MeshToonMaterial({ color: '#e0302a', emissive: new THREE.Color('#ff2a1a'), emissiveIntensity: 0.25 });
  // One extruded shape: a shaft and a wide head, the tip at the origin.
  const sh = new THREE.Shape();
  sh.moveTo(0, 0); sh.lineTo(1.0, 1.15); sh.lineTo(0.38, 1.15); sh.lineTo(0.38, 3.6); sh.lineTo(-0.38, 3.6); sh.lineTo(-0.38, 1.15); sh.lineTo(-1.0, 1.15); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.4, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1 });
  geo.translate(0, 0, -0.2);
  g.add(new THREE.Mesh(geo, red));
  outlined(g, 0.03);
  const l = label('−$1T', '#ffffff', 0.6); l.position.set(0, 2.4, 0.35); g.add(l);
  return g;
}

/** Fourth Best: a giant rubber stamp. Its face says DENIED and flips to APPROVED (4TH BEST) as it lands. */
export function exportStamp() {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: '#b3121f', roughness: 0.5 });
  const wood = new THREE.MeshStandardMaterial({ color: '#3a3f47', roughness: 0.6, metalness: 0.3 });
  const pad = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.3, 1.0), red); pad.position.y = 0.15; g.add(pad);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.0, 16), wood); neck.position.y = 0.8; g.add(neck);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 14), wood); knob.position.y = 1.45; g.add(knob);
  outlined(g, 0.02);
  const face = canvasPlane(1.8, 0.28, 512, () => {});
  face.position.set(0, 0.15, 0.505); g.add(face);
  const draw = (ok: boolean) => face.userData.redraw((c: CanvasRenderingContext2D, W: number, H: number) => {
    c.fillStyle = ok ? '#1f7a3a' : '#b3121f'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#ffe6d6'; c.lineWidth = 8; c.strokeRect(10, 10, W - 20, H - 20);
    c.fillStyle = '#ffe6d6'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 ${Math.round(H * 0.6)}px ${DISPLAY_F()}`;
    c.fillText(ok ? 'APPROVED · 4TH BEST' : 'EXPORT DENIED', W / 2, H * 0.54, W - 40);
  });
  draw(false);
  g.userData.flip = () => draw(true);
  return g;
}

// ---------- Mork Zuckerbot and Dana Wite

/** A pop-up ad card flicked across the floor (Senator, We Run Ads). */
export function adCard() {
  const m = canvasPlane(0.7, 0.5, 256, (c, W, H) => {
    c.fillStyle = '#ffffff'; roundRect(c, 0, 0, W, H, 16); c.fill();
    c.fillStyle = '#2d7ff9'; roundRect(c, 0, 0, W, H * 0.24, 16); c.fill(); c.fillRect(0, H * 0.12, W, H * 0.12);
    c.fillStyle = '#fff'; c.font = `800 ${Math.round(H * 0.13)}px ${SANS_F()}`; c.textBaseline = 'middle'; c.textAlign = 'left';
    c.fillText('Sponsored', 14, H * 0.12);
    c.textAlign = 'right'; c.fillText('✕', W - 14, H * 0.12);
    c.fillStyle = '#16181c'; c.textAlign = 'center'; c.font = `900 ${Math.round(H * 0.3)}px ${DISPLAY_F()}`; c.fillText('WE RUN', W / 2, H * 0.5);
    c.fillStyle = '#d0342c'; c.fillText('ADS', W / 2, H * 0.78);
  }, 1.05);
  (m.material as THREE.Material).side = THREE.DoubleSide;
  return m;
}

/** A barbecue sauce bottle (On the Ribs). Generic label. */
export function sauceBottle() {
  const g = new THREE.Group();
  const glass = new THREE.MeshToonMaterial({ color: '#5a1a0e' });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.32, 16), glass); body.position.y = 0.16; g.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.09, 0.12, 14), glass); neck.position.y = 0.38; g.add(neck);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 14), new THREE.MeshToonMaterial({ color: '#c8102e' })); cap.position.y = 0.46; g.add(cap);
  outlined(g, 0.01);
  const tag = canvasPlane(0.2, 0.14, 128, (c, W, H) => {
    c.fillStyle = '#f4e3c0'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#5a1a0e'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 ${Math.round(H * 0.42)}px ${DISPLAY_F()}`; c.fillText('BBQ', W / 2, H / 2);
  });
  tag.position.set(0, 0.17, 0.112); g.add(tag);
  return g;
}

/**
 * Board Meeting: an eight-sided fight cage with a boardroom table in the middle and a wall clock reading 9 to 6.
 * Its base sits at y = 0.
 */
export function octagonCage() {
  const g = new THREE.Group();
  const post = new THREE.MeshToonMaterial({ color: '#16181c' });
  const pad = new THREE.MeshToonMaterial({ color: '#c8102e' });
  const fence = canvasPlane(1.0, 1.6, 256, (c, W, H) => {
    c.strokeStyle = 'rgba(30,32,36,0.9)'; c.lineWidth = 4;
    for (let i = -H; i < W + H; i += 22) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + H, H); c.stroke(); c.beginPath(); c.moveTo(i + H, 0); c.lineTo(i, H); c.stroke(); }
  });
  (fence.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  const R = 1.45;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8), post); p.position.set(Math.cos(a) * R, 0.9, Math.sin(a) * R); g.add(p);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 8), pad); top.position.set(Math.cos(a) * R, 1.8, Math.sin(a) * R); g.add(top);
    const b = (i / 8) * Math.PI * 2;
    const f = fence.clone(); const r2 = R * Math.cos(Math.PI / 8);
    f.position.set(Math.cos(b) * r2, 0.95, Math.sin(b) * r2); f.rotation.y = -b + Math.PI / 2; f.scale.x = (2 * R * Math.sin(Math.PI / 8)) / 1.0; g.add(f);
  }
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.6), new THREE.MeshToonMaterial({ color: '#5a3a22' })); table.position.y = 0.75; g.add(table);
  for (const [x, z] of [[-0.6, -0.22], [0.6, -0.22], [-0.6, 0.22], [0.6, 0.22]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 0.06), post); leg.position.set(x, 0.36, z); g.add(leg);
  }
  outlined(g, 0.015);
  const clock = canvasPlane(0.9, 0.9, 256, (c, W, H) => {
    c.fillStyle = '#f4f1e8'; c.beginPath(); c.arc(W / 2, H / 2, W * 0.47, 0, 7); c.fill();
    c.strokeStyle = '#16181c'; c.lineWidth = 12; c.stroke();
    c.fillStyle = '#16181c'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 ${Math.round(H * 0.16)}px ${DISPLAY_F()}`;
    c.fillText('9 → 6', W / 2, H * 0.72);
    c.lineWidth = 10; c.beginPath(); c.moveTo(W / 2, H / 2); c.lineTo(W / 2, H * 0.2); c.stroke();
    c.lineWidth = 14; c.beginPath(); c.moveTo(W / 2, H / 2); c.lineTo(W * 0.3, H / 2); c.stroke();
  });
  clock.position.set(0, 2.5, 0); g.add(clock);
  return g;
}

/**
 * Mork's Super: the VR void. A neon grid floor, a wireframe dome, and floating low-poly shards. tick(t) slowly turns
 * it. The "LEGS: COMING SOON" sign is a separate prop.
 */
export function vrVoid() {
  const g = new THREE.Group();
  const grid = new THREE.GridHelper(40, 40, new THREE.Color('#7fb6ff').multiplyScalar(1.5), new THREE.Color('#2d5fa8'));
  grid.position.y = 0.02; g.add(grid);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: '#070b1a', transparent: true, opacity: 0.88, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01; g.add(floor);
  const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(12, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color('#4a8cff').multiplyScalar(1.3), wireframe: true, transparent: true, opacity: 0.35 }));
  g.add(dome);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(13, 24, 16), new THREE.MeshBasicMaterial({ color: '#04060f', side: THREE.BackSide }));
  g.add(sky);
  const shards: THREE.Mesh[] = [];
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.25 + (i % 4) * 0.12, 0), new THREE.MeshStandardMaterial({ color: i % 2 ? '#9cc6ff' : '#2d7ff9', flatShading: true, roughness: 0.5 }));
    // Kept behind the fighters and off to the sides, clear of the camera.
    const x = ((i * 5.3) % 16) - 8, z = -3 - (i % 4) * 1.6;
    s.position.set(x, 1.0 + (i % 3) * 1.3, z); g.add(s); shards.push(s);
  }
  g.userData.tick = (t: number) => {
    dome.rotation.y = t * 0.05;
    shards.forEach((s, i) => { s.rotation.set(t * 0.6 + i, t * 0.9 + i, 0); s.position.y += Math.sin(t * 1.3 + i) * 0.002; });
  };
  return g;
}

/** A floating sign in the void: "LEGS · COMING SOON". */
export function legsSign() {
  const m = canvasPlane(2.6, 1.0, 768, (c, W, H) => {
    c.fillStyle = 'rgba(10,18,40,0.92)'; roundRect(c, 0, 0, W, H, 40); c.fill();
    c.strokeStyle = '#9cc6ff'; c.lineWidth = 10; roundRect(c, 8, 8, W - 16, H - 16, 34); c.stroke();
    c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 ${Math.round(H * 0.42)}px ${DISPLAY_F()}`;
    c.fillText('LEGS', W / 2, H * 0.4);
    c.fillStyle = '#9cc6ff'; c.font = `800 ${Math.round(H * 0.18)}px ${SANS_F()}`; c.fillText('COMING SOON · MOST REQUESTED FEATURE', W / 2, H * 0.76, W - 60);
  }, 1.3);
  (m.material as THREE.Material).side = THREE.DoubleSide;
  return m;
}
