import * as THREE from 'three';
import type { Look } from '../data/fighters';
import { MOVES } from '../sim/constants';
import type { Fighter, PoseKind } from '../sim/types';
import { drawFace } from './faces';

/** Joint angles for the procedural rig. Negative shoulder/hip angles swing forward. */
export type Pose = {
  torsoX: number; torsoY: number; headX: number;
  aL: number; eL: number; aR: number; eR: number; spread: number;
  hL: number; kL: number; hR: number; kR: number;
  y: number; pitch: number; lift: number; spin: number;
};

const GUARD: Pose = {
  torsoX: 0.12, torsoY: -0.35, headX: 0, aL: -1.0, eL: -1.75, aR: -0.75, eR: -1.9, spread: 0,
  hL: -0.28, kL: 0.4, hR: 0.3, kR: 0.4, y: -0.06, pitch: 0, lift: 0, spin: 0,
};
const P = (o: Partial<Pose>): Pose => ({ ...GUARD, ...o });
const CROUCH = { y: -0.38, hL: -1.15, kL: 1.9, hR: -0.95, kR: 1.9 };
const TUCK = { hL: -0.9, kL: 1.5, hR: -0.5, kR: 1.3 };

const WIND: Record<PoseKind, Pose> = {
  punch: P({ aR: -0.3, eR: -2.2, torsoY: -0.75 }),
  low: P({ ...CROUCH, aR: -0.3, eR: -2.2 }),
  kick: P({ hR: 0.5, kR: 1.3, torsoX: 0.1 }),
  sweep: P({ ...CROUCH, torsoY: -0.8 }),
  upper: P({ y: -0.32, aR: 0.4, eR: -1.4, hL: -0.9, kL: 1.5, hR: -0.7, kR: 1.5 }),
  grab: P({ aL: -0.6, aR: -0.6, spread: 0.6 }),
  heavy: P({ aL: 0.5, aR: 0.7, eL: -0.6, eR: -0.6, torsoX: -0.3 }),
  spin: P({ hR: 0.5, kR: 1.4, torsoY: -1.2 }),
  airP: P({ ...TUCK, aR: -0.2, eR: -2 }),
  airK: P({ ...TUCK }),
};
const STRIKE: Record<PoseKind, Pose> = {
  punch: P({ aR: -1.55, eR: 0, torsoY: 0.55, torsoX: 0.22, hL: -0.45 }),
  low: P({ ...CROUCH, aR: -1.35, eR: 0, torsoX: 0.3 }),
  kick: P({ hR: -1.6, kR: 0.05, torsoX: -0.4, aL: -0.4, aR: 0.4 }),
  sweep: P({ y: -0.46, hL: -1.3, kL: 2.1, hR: -1.5, kR: 0.05, torsoX: -0.25, aL: 0.5 }),
  upper: P({ aR: -2.95, eR: -0.25, torsoX: -0.2, lift: 0.3, hL: -0.1, kL: 0.1, hR: 0.1, kR: 0.1 }),
  grab: P({ aL: -1.5, eL: -0.2, aR: -1.5, eR: -0.2, torsoX: 0.4 }),
  heavy: P({ aL: -1.6, eL: 0, aR: -1.6, eR: 0, torsoX: 0.5, hL: -0.7, kL: 0.6, hR: 0.6 }),
  spin: P({ hR: -1.7, kR: 0, torsoX: -0.45, aL: -0.6, aR: 0.6 }),
  airP: P({ ...TUCK, aR: -2, eR: 0, torsoX: 0.4 }),
  airK: P({ hL: -0.6, kL: 1.6, hR: -1.25, kR: 0, torsoX: -0.2 }),
};
const LYING = P({ pitch: -Math.PI / 2, lift: 0.24, aL: -0.4, aR: -0.4, eL: -0.3, eR: -0.3, spread: 1.1, hL: -0.15, hR: 0.2, kL: 0.2, kR: 0.5, torsoX: 0, torsoY: 0, y: 0 });
const POWER = P({ aL: -2.8, aR: -2.8, eL: -0.2, eR: -0.2, spread: 0.5, torsoX: -0.15, torsoY: 0, lift: 0.1, hL: -0.2, hR: 0.2, kL: 0.1, kR: 0.1, y: 0 });

/** Target pose for a fighter's current sim state. `t` is seconds, for idle motion. */
export function poseFor(f: Fighter, t: number, cine: 'none' | 'attacker' | 'victim'): Pose {
  if (cine === 'attacker') return P({ ...POWER, lift: 0.1 + Math.sin(t * 9) * 0.04 });
  if (cine === 'victim') return P({ torsoX: -0.35, headX: -0.4 + Math.sin(t * 14) * 0.2, aL: 0.5, aR: 0.3, eL: -0.4, eR: -0.4, spread: 0.5 });
  switch (f.state) {
    case 'idle': {
      const b = Math.sin(t * 3.2);
      return P({ y: -0.06 + b * 0.02, aL: -1.0 + b * 0.05, aR: -0.75 - b * 0.05 });
    }
    case 'walk': {
      const s = Math.sin(f.frame * 0.36);
      return P({ hL: s * 0.6, hR: -s * 0.6, kL: 0.3 + Math.max(0, -s) * 0.7, kR: 0.3 + Math.max(0, s) * 0.7, y: -0.04 + Math.abs(s) * 0.03 });
    }
    case 'crouch': return P({ ...CROUCH, torsoX: 0.3, aL: -1.3, aR: -1.2 });
    case 'jump': {
      if (f.move) { const mv = MOVES[f.move]; return f.af <= mv.startup + mv.active ? STRIKE[mv.pose] : P(TUCK); }
      return P({ ...TUCK, aL: -0.3, aR: -0.3, spread: 0.7 });
    }
    case 'attack': {
      const mv = MOVES[f.move!];
      const strike = f.af >= mv.startup * 0.55 && f.af <= mv.startup + mv.active + 3;
      const pose = f.af < mv.startup * 0.55 ? WIND[mv.pose] : strike ? STRIKE[mv.pose] : GUARD;
      if (mv.pose !== 'spin') return pose;
      const total = mv.startup + mv.active + mv.recovery * 0.5;
      return { ...pose, spin: -Math.min(1, f.af / total) * Math.PI * 2 };
    }
    case 'hitstun': return P({ torsoX: -0.5, headX: -0.5, aL: 0.5, aR: -0.1, eL: -0.5, eR: -0.6, spread: 0.5, hL: 0.2, hR: 0.5 });
    case 'blockstun': return P({ aL: -1.5, eL: -2.2, aR: -1.5, eR: -2.2, torsoX: -0.12, y: -0.12, ...((f.cur & 8) ? CROUCH : {}) });
    case 'knockdown': return f.y > 0 || f.vy > 0 ? P({ ...LYING, pitch: -1.1, lift: 0 }) : LYING;
    case 'ko': return f.y > 0 || f.vy > 0 ? P({ ...LYING, pitch: -1.1, lift: 0 }) : LYING;
    case 'getup': { const k = 1 - f.frame / 18; return P({ ...CROUCH, pitch: LYING.pitch * k * k, lift: LYING.lift * k }); }
    case 'winded': {
      const b = Math.sin(t * 11);
      return P({ torsoX: 0.8 + b * 0.06, headX: 0.45, aL: 0.15, aR: 0.15, eL: -0.25, eR: -0.25, y: -0.14 + b * 0.02, hL: -0.5, kL: 0.8, hR: -0.4, kR: 0.8 });
    }
    case 'superStart': return POWER;
    case 'win': return P({ ...POWER, lift: Math.abs(Math.sin(t * 6)) * 0.22 });
  }
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const toon = (color: string) => new THREE.MeshToonMaterial({ color });

export class Bobble {
  root = new THREE.Group();
  private tilt = new THREE.Group();
  private body = new THREE.Group();
  private torso = new THREE.Group();
  private headPivot = new THREE.Group();
  private arms: { s: THREE.Group; e: THREE.Group }[] = [];
  private legs: { h: THREE.Group; k: THREE.Group }[] = [];
  private pose: Pose = { ...GUARD };
  private hipY = 0.9;
  private wob = { x: 0, z: 0, vx: 0, vz: 0 };
  private disposables: { dispose(): void }[] = [];

  constructor(look: Look) {
    const skin = toon(look.face.skin), shirt = toon(look.jacket ?? look.shirt), pants = toon(look.pants), shoe = toon('#141414');
    const sleeve = shirt;
    this.disposables.push(skin, shirt, pants, shoe);
    const b = look.build;
    const tw = 0.5 * b, td = 0.3 * Math.sqrt(b), th = 0.62;
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
      const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; this.disposables.push(g); return o;
    };

    this.root.add(this.tilt); this.tilt.add(this.body); this.body.add(this.torso);
    this.torso.add(mesh(new THREE.BoxGeometry(tw, th, td), shirt, 0, th / 2, 0));
    this.torso.add(mesh(new THREE.BoxGeometry(tw * 0.98, 0.14, td * 0.98), pants, 0, 0.02, 0));
    if (look.jacket) {
      const sh = toon(look.shirt); this.disposables.push(sh);
      this.torso.add(mesh(new THREE.BoxGeometry(tw * 0.34, th * 0.7, 0.02), sh, 0, th * 0.62, td / 2 + 0.005));
    }
    if (look.tie) {
      const tie = toon(look.tie); this.disposables.push(tie);
      this.torso.add(mesh(new THREE.BoxGeometry(0.075, th * 0.72, 0.02), tie, 0, th * 0.55, td / 2 + 0.018));
    }

    // Head: an oversized, squashed sphere with the caricature wrapped around it.
    const [hs, hw, hh] = look.head;
    const r = 0.27 * hs;
    const tex = new THREE.CanvasTexture(drawFace(look.face));
    tex.colorSpace = THREE.SRGBColorSpace;
    const headMat = new THREE.MeshToonMaterial({ map: tex });
    this.disposables.push(tex, headMat);
    const head = mesh(new THREE.SphereGeometry(r, 28, 20), headMat, 0, r * hh * 0.86, 0.03);
    head.rotation.y = -Math.PI / 2;
    head.scale.set(1, hh, hw); // local x is depth after the quarter turn
    this.headPivot.position.y = th + 0.03;
    this.headPivot.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.1), skin, 0, 0, 0), head);
    this.torso.add(this.headPivot);

    const limb = (rad: number, len: number, m: THREE.Material) => mesh(new THREE.CapsuleGeometry(rad, len - rad, 3, 8), m, 0, -len / 2, 0);
    for (const s of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(s * (tw / 2 + 0.07), th - 0.08, 0);
      const el = new THREE.Group(); el.position.y = -0.3;
      sh.add(limb(0.075 * Math.sqrt(b), 0.3, sleeve), el);
      el.add(limb(0.065, 0.28, look.jacket ? sleeve : skin), mesh(new THREE.SphereGeometry(0.1, 10, 8), skin, 0, -0.33, 0));
      this.torso.add(sh); this.arms.push({ s: sh, e: el });

      const hip = new THREE.Group(); hip.position.set(s * tw * 0.27, 0, 0);
      const knee = new THREE.Group(); knee.position.y = -0.42;
      hip.add(limb(0.1 * Math.sqrt(b), 0.42, pants), knee);
      knee.add(limb(0.085, 0.4, pants), mesh(new THREE.BoxGeometry(0.15, 0.09, 0.3), shoe, 0, -0.43, 0.06));
      this.body.add(hip); this.legs.push({ h: hip, k: knee });
    }
  }

  /** Shake the head. Called when the fighter gets hit. */
  bonk(strength: number, dir: number) { this.wob.vz += strength * dir * 9; this.wob.vx -= strength * 6; }

  update(target: Pose, dt: number, snap = false) {
    const k = snap ? 1 : 1 - Math.pow(0.0006, dt * 4.2);
    const p = this.pose;
    for (const key of Object.keys(p) as (keyof Pose)[]) p[key] = key === 'spin' ? target.spin : lerp(p[key], target[key], k);

    this.body.position.y = this.hipY + p.y + p.lift;
    this.tilt.rotation.x = p.pitch;
    this.tilt.rotation.y = p.spin;
    this.torso.rotation.set(p.torsoX, p.torsoY, 0);
    const [L, R] = this.arms;
    L.s.rotation.set(p.aL, 0, -p.spread); L.e.rotation.x = p.eL;
    R.s.rotation.set(p.aR, 0, p.spread); R.e.rotation.x = p.eR;
    const [lL, lR] = this.legs;
    lL.h.rotation.x = p.hL; lL.k.rotation.x = p.kL;
    lR.h.rotation.x = p.hR; lR.k.rotation.x = p.kR;

    // Spring-mounted head.
    const w = this.wob, d = Math.min(dt, 0.033);
    w.vx += (-w.x * 140 - w.vx * 7) * d; w.vz += (-w.z * 140 - w.vz * 7) * d;
    w.x += w.vx * d; w.z += w.vz * d;
    this.headPivot.rotation.set(p.headX - p.torsoX * 0.6 + w.x, -p.torsoY * 0.7, w.z);
  }

  dispose() { for (const d of this.disposables) d.dispose(); }
}
