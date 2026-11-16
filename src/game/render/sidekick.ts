import * as THREE from 'three';
import type { SidekickInfo } from '../data/roster';
import type { Fighter } from '../sim/types';
import { DISPLAY_F, SANS_F } from './props';

// The funded politician who tags in when a billionaire runs out of cardio.
// Until real sidekick models exist this is a printed cardboard cutout on a stand: it hops, lunges and
// topples like one. The joke holds up on its own (a politician who is a cardboard cutout).

const W = 0.95, H = 1.85;

function drawCutout(c: CanvasRenderingContext2D, w: number, h: number, sk: SidekickInfo) {
  const L = sk.look;
  const s = w / 512;
  c.save(); c.scale(s, s);
  const ink = '#14100e';
  c.lineJoin = 'round'; c.lineCap = 'round';
  const path = (fn: () => void, fill: string, stroke = ink, lw = 9) => { c.beginPath(); fn(); c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); };

  // Legs and shoes.
  path(() => { c.moveTo(170, 640); c.lineTo(160, 930); c.lineTo(245, 930); c.lineTo(250, 660); c.lineTo(262, 660); c.lineTo(268, 930); c.lineTo(352, 930); c.lineTo(342, 640); c.closePath(); }, L.suit);
  path(() => { c.ellipse(195, 944, 62, 22, 0, 0, Math.PI * 2); }, '#0d0b0a');
  path(() => { c.ellipse(318, 944, 62, 22, 0, 0, Math.PI * 2); }, '#0d0b0a');
  // Arms.
  path(() => { c.moveTo(118, 330); c.quadraticCurveTo(70, 470, 96, 610); c.lineTo(150, 606); c.quadraticCurveTo(150, 470, 170, 360); c.closePath(); }, L.suit);
  path(() => { c.moveTo(394, 330); c.quadraticCurveTo(442, 470, 416, 610); c.lineTo(362, 606); c.quadraticCurveTo(362, 470, 342, 360); c.closePath(); }, L.suit);
  path(() => { c.arc(122, 628, 30, 0, Math.PI * 2); }, L.skin);
  path(() => { c.arc(390, 628, 30, 0, Math.PI * 2); }, L.skin);
  // Jacket.
  path(() => { c.moveTo(150, 300); c.quadraticCurveTo(256, 268, 362, 300); c.lineTo(392, 340); c.lineTo(356, 660); c.lineTo(156, 660); c.lineTo(120, 340); c.closePath(); }, L.suit);
  // Shirt and tie.
  path(() => { c.moveTo(214, 292); c.lineTo(256, 420); c.lineTo(298, 292); c.closePath(); }, '#f4f1ea', ink, 6);
  path(() => {
    c.moveTo(244, 300); c.lineTo(268, 300); c.lineTo(274, 330); c.lineTo(286, sk.look.hairStyle === 'swoop' ? 640 : 520);
    c.lineTo(256, sk.look.hairStyle === 'swoop' ? 672 : 552); c.lineTo(226, sk.look.hairStyle === 'swoop' ? 640 : 520); c.lineTo(238, 330); c.closePath();
  }, L.tie, ink, 6);
  // Flag pin.
  c.fillStyle = '#c8102e'; c.fillRect(312, 352, 26, 16); c.fillStyle = '#1b3a8a'; c.fillRect(312, 352, 11, 8);

  // Head.
  path(() => { c.ellipse(256, 180, 96, 112, 0, 0, Math.PI * 2); }, L.skin);
  path(() => { c.ellipse(160, 190, 18, 28, 0, 0, Math.PI * 2); }, L.skin);
  path(() => { c.ellipse(352, 190, 18, 28, 0, 0, Math.PI * 2); }, L.skin);
  if (L.hairStyle === 'swoop') {
    // A big swept-over comb.
    path(() => { c.moveTo(150, 150); c.quadraticCurveTo(170, 40, 290, 52); c.quadraticCurveTo(388, 62, 372, 150); c.quadraticCurveTo(330, 104, 250, 120); c.quadraticCurveTo(190, 128, 150, 150); c.closePath(); }, L.hair);
    path(() => { c.moveTo(286, 56); c.quadraticCurveTo(410, 70, 384, 168); c.quadraticCurveTo(360, 120, 318, 108); c.closePath(); }, L.hair);
  } else {
    // Short parted hair and a full beard.
    path(() => { c.moveTo(162, 150); c.quadraticCurveTo(176, 62, 262, 64); c.quadraticCurveTo(352, 66, 352, 150); c.quadraticCurveTo(300, 108, 228, 116); c.quadraticCurveTo(190, 122, 162, 150); c.closePath(); }, L.hair);
    path(() => { c.moveTo(166, 196); c.quadraticCurveTo(170, 300, 256, 304); c.quadraticCurveTo(342, 300, 346, 196); c.quadraticCurveTo(320, 250, 256, 248); c.quadraticCurveTo(192, 250, 166, 196); c.closePath(); }, L.hair);
  }
  // Face.
  c.fillStyle = ink;
  c.beginPath(); c.ellipse(220, 176, 9, 11, 0, 0, Math.PI * 2); c.ellipse(292, 176, 9, 11, 0, 0, Math.PI * 2); c.fill();
  c.lineWidth = 7; c.strokeStyle = ink;
  c.beginPath(); c.moveTo(198, 152); c.lineTo(238, 158); c.moveTo(314, 152); c.lineTo(274, 158); c.stroke();
  if (L.hairStyle === 'swoop') { c.beginPath(); c.ellipse(256, 238, 26, 13, 0, 0, Math.PI * 2); c.fillStyle = '#8a2f2a'; c.fill(); c.stroke(); }
  else { c.beginPath(); c.moveTo(232, 232); c.quadraticCurveTo(256, 242, 280, 232); c.stroke(); }

  // Name sash across the stand.
  c.fillStyle = '#f3ecdc'; c.fillRect(56, 978, 400, 70);
  c.strokeStyle = ink; c.lineWidth = 6; c.strokeRect(56, 978, 400, 70);
  c.fillStyle = ink; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `900 44px ${DISPLAY_F()}`; c.fillText(sk.name.toUpperCase(), 256, 1006, 380);
  c.font = `600 18px ${SANS_F()}`; c.fillText('FUNDED POLITICIAN · LIFE SIZE', 256, 1036, 380);
  c.restore();
}

export class SidekickView {
  root = new THREE.Group();
  private board: THREE.Group;
  private flash = 0;
  private mats: THREE.MeshStandardMaterial[] = [];
  private t = 0;
  private enter = 0;

  constructor(private sk: SidekickInfo) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 1060;
    drawCutout(cv.getContext('2d')!, 512, 1060, sk);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const front = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, roughness: 0.75 });
    // The back is plain cardboard in the same silhouette.
    const bc = document.createElement('canvas'); bc.width = 512; bc.height = 1060;
    const bx = bc.getContext('2d')!;
    bx.drawImage(cv, 0, 0); bx.globalCompositeOperation = 'source-in'; bx.fillStyle = '#a77d4f'; bx.fillRect(0, 0, 512, 1060);
    const btex = new THREE.CanvasTexture(bc); btex.colorSpace = THREE.SRGBColorSpace;
    const back = new THREE.MeshStandardMaterial({ map: btex, roughness: 0.95, alphaTest: 0.5, transparent: true, side: THREE.BackSide });
    this.mats.push(front);
    const h = (W * 1060) / 512;
    const geo = new THREE.PlaneGeometry(W, h);
    this.board = new THREE.Group();
    const f = new THREE.Mesh(geo, front); f.castShadow = true;
    const b = new THREE.Mesh(geo, back); b.position.z = -0.012;
    this.board.add(f, b);
    this.board.position.y = h / 2;
    // A little wooden strut behind it.
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.04), new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 0.9 }));
    strut.position.set(0, 0.45, -0.22); strut.rotation.x = -0.45;
    this.board.add(strut);
    strut.position.y -= h / 2;
    this.root.add(this.board);
    this.root.visible = false;
    void H;
  }

  get name() { return this.sk.name; }

  hitFlash() { this.flash = 1; }

  /** World position of the printed head, for bubbles and sparks. */
  headPos(out = new THREE.Vector3()) {
    return this.board.localToWorld(out.set(0, (W * 1060) / 512 / 2 - 0.42, 0.05));
  }

  update(f: Fighter, dt: number, frozen: boolean) {
    const on = f.tag > 0;
    if (on && !this.root.visible) { this.enter = 0; this.t = 0; }
    this.root.visible = on;
    if (!on) return;
    if (!frozen) { this.t += dt; this.enter = Math.min(1, this.enter + dt * 3); }
    this.root.position.set(f.x, f.y, 0.05);
    // A flat print faces the camera; it turns a little toward the opponent.
    this.root.rotation.y = f.facing * 0.2;
    let lean = 0, hop = 0, slide = 0, fall = 0;
    switch (f.state) {
      case 'walk': hop = Math.abs(Math.sin(this.t * 11)) * 0.12; lean = 0.05; break;
      case 'idle': hop = Math.abs(Math.sin(this.t * 4)) * 0.03; break;
      case 'attack': case 'sig': { const k = Math.min(1, (f.af || 1) / 8); lean = -0.32 * Math.sin(k * Math.PI); slide = 0.25 * Math.sin(k * Math.PI); break; }
      case 'quote': hop = Math.abs(Math.sin(this.t * 7)) * 0.06; lean = Math.sin(this.t * 5) * 0.06; break;
      case 'hitstun': case 'blockstun': lean = 0.25 * Math.sin(this.t * 30) * Math.exp(-(f.frame) / 12) + 0.15; break;
      case 'knockdown': fall = Math.min(1, f.frame / 10 + 0.3); break;
      case 'getup': fall = 1 - Math.min(1, f.frame / 20); break;
      case 'jump': lean = -0.1; break;
    }
    // Drop in from above on tag-in.
    const drop = (1 - this.enter) ** 2 * 6;
    this.board.position.x = slide * f.facing;
    this.board.position.y = (W * 1060) / 512 / 2 + hop + drop;
    this.board.rotation.z = lean * f.facing;
    this.root.rotation.x = -fall * 1.45;
    this.flash = Math.max(0, this.flash - dt * 6);
    for (const m of this.mats) m.emissive.setScalar(this.flash * 0.8);
  }

  dispose() {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.map?.dispose(); mat.dispose();
    });
  }
}

/** A giant red rubber stamp that drops on the opponent (Tariff Everything). */
export function tariffStamp() {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: '#b3121f', roughness: 0.5 });
  const wood = new THREE.MeshStandardMaterial({ color: '#7a4f2a', roughness: 0.7 });
  const pad = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 1.0), red); pad.position.y = 0.15; g.add(pad);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.0, 16), wood); neck.position.y = 0.8; g.add(neck);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 14), wood); knob.position.y = 1.45; g.add(knob);
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#b3121f'; c.fillRect(0, 0, 512, 160);
  c.strokeStyle = '#ffe6d6'; c.lineWidth = 10; c.strokeRect(14, 14, 484, 132);
  c.fillStyle = '#ffe6d6'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 110px ${DISPLAY_F()}`;
  c.fillText('TARIFF', 256, 86, 460);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.27), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
  face.position.set(0, 0.15, 0.505); g.add(face);
  return g;
}

/** A cartoon cat thrown across the floor (Cat Lady Barrage). */
export function catSprite() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
  const c = cv.getContext('2d')!;
  const ink = '#14100e';
  c.lineWidth = 10; c.strokeStyle = ink; c.lineJoin = 'round';
  c.fillStyle = '#e9a04a';
  c.beginPath(); c.moveTo(60, 110); c.lineTo(78, 30); c.lineTo(118, 80); c.lineTo(150, 80); c.lineTo(182, 30); c.lineTo(198, 110);
  c.quadraticCurveTo(222, 220, 128, 226); c.quadraticCurveTo(34, 220, 60, 110); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = ink;
  c.beginPath(); c.ellipse(98, 136, 12, 18, 0, 0, Math.PI * 2); c.ellipse(160, 136, 12, 18, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(116, 172); c.lineTo(142, 172); c.lineTo(129, 186); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(30, 170); c.lineTo(92, 176); c.moveTo(30, 194); c.lineTo(92, 186); c.moveTo(228, 170); c.lineTo(166, 176); c.moveTo(228, 194); c.lineTo(166, 186); c.stroke();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  s.scale.setScalar(0.6);
  return s;
}
