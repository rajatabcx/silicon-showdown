import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import type { FighterInfo } from '../data/roster';
import { FPS, MOVES } from '../sim/constants';
import { sigOf } from '../sim/match';
import type { Fighter, Match, MoveKey, SimDef } from '../sim/types';
import { litMaterial, type ToonUniforms } from './toon';

/** Which slice of which clip a fight state plays. Clip times are in seconds. */
type Win = { clip: string; impact: number; lead: number; tail: number };

const MOVE_ANIM: Record<MoveKey, Win> = {
  jab: { clip: 'Left_Jab_from_Guard', impact: 0.5, lead: 0.3, tail: 0.5 },
  cross: { clip: 'Right_Jab_from_Guard', impact: 0.625, lead: 0.32, tail: 0.5 },
  hook: { clip: 'Left_Hook_from_Guard', impact: 0.333, lead: 0.28, tail: 0.5 },
  upper: { clip: 'Right_Uppercut_from_Guard', impact: 0.62, lead: 0.4, tail: 0.38 },
  kick: { clip: 'Spartan_Kick', impact: 0.6, lead: 0.45, tail: 0.55 },
  sweep: { clip: 'Leg_Sweep', impact: 0.8, lead: 0.5, tail: 0.8 },
  roundhouse: { clip: 'Roundhouse_Kick', impact: 0.833, lead: 0.5, tail: 0.9 },
  airPunch: { clip: 'Left_Jab_from_Guard', impact: 0.5, lead: 0.15, tail: 0.3 },
  airKick: { clip: 'Spartan_Kick', impact: 0.6, lead: 0.3, tail: 0.3 },
};

/** Signature actions, by signature id. */
const SIG_ANIM: Record<string, Win> = {
  heart: { clip: 'Long_Breathe_and_Look_Around', impact: 0.7, lead: 0.2, tail: 0.3 },
  chainsaw: { clip: 'Left_Hook_from_Guard', impact: 0.333, lead: 0.25, tail: 0.3 },
  sink: { clip: 'Right_Jab_from_Guard', impact: 0.625, lead: 0.5, tail: 0.7 },
  losers: { clip: 'Right_Uppercut_from_Guard', impact: 0.62, lead: 0.55, tail: 0.38 },
  lecture: { clip: 'Right_Jab_from_Guard', impact: 0.625, lead: 0.25, tail: 0.25 },
  pause: { clip: 'Long_Breathe_and_Look_Around', impact: 1, lead: 0, tail: 0 },
  // Sidekick Policy Moves: an arm raised to bring the stamp down; a quick toss for each cat.
  tariff: { clip: 'Right_Uppercut_from_Guard', impact: 0.62, lead: 0.5, tail: 0.38 },
  cats: { clip: 'Right_Jab_from_Guard', impact: 0.625, lead: 0.3, tail: 0.3 },
};

const HIPS = 'mixamorigHips';
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _fwd = new THREE.Vector3(), _up = new THREE.Vector3(), _side = new THREE.Vector3();

/** Strip root drift and per-bone stretch from a clip so it plays in place on any body with this skeleton. */
function prepareClip(clip: THREE.AnimationClip, model: THREE.Object3D, srcHipsRest: THREE.Vector3): THREE.AnimationClip {
  const hips = model.getObjectByName(HIPS)!;
  hips.parent!.updateWorldMatrix(true, false);
  const pq = new THREE.Quaternion(); hips.parent!.getWorldQuaternion(pq);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(pq.invert()).normalize();
  const tgtRest = hips.position.clone();
  const ratio = tgtRest.dot(up) / Math.max(1e-6, srcHipsRest.dot(up));
  const tracks: THREE.KeyframeTrack[] = [];
  for (const t of clip.tracks) {
    if (t.name.endsWith('.quaternion')) { tracks.push(t); continue; }
    if (t.name === `${HIPS}.position`) {
      const v = t.values.slice();
      const p = new THREE.Vector3();
      for (let i = 0; i < v.length; i += 3) {
        p.set(v[i] - srcHipsRest.x, v[i + 1] - srcHipsRest.y, v[i + 2] - srcHipsRest.z);
        const dy = p.dot(up) * ratio;
        v[i] = tgtRest.x + up.x * dy; v[i + 1] = tgtRest.y + up.y * dy; v[i + 2] = tgtRest.z + up.z * dy;
      }
      tracks.push(new THREE.VectorKeyframeTrack(t.name, t.times, v));
    }
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

export type Role = 'fight' | 'talk' | 'pump' | 'reel' | 'frozen' | 'down' | 'shrug';

/** One fighter on screen: the model, its cel materials and ink outline, and a mixer driven by the simulation. */
export class FighterView {
  root = new THREE.Group();
  model: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private cur: THREE.AnimationAction | null = null;
  private curKey = '';
  private uniforms: ToonUniforms[] = [];
  private flash = 0;
  private yaw = 0;
  private bones: Record<string, THREE.Object3D> = {};
  private loopT = 0;
  hand: { r: THREE.Object3D; l: THREE.Object3D };
  private held: THREE.Object3D | null = null;
  /** Props placed in world space from the arm pose each frame ('grip' follows the forearm, 'both' sits between the hands). */
  private carried: { o: THREE.Object3D; kind: 'chainsaw' | 'sink' } | null = null;
  /** Blend weights for the procedural arm poses, 0..1. */
  private poseW = { salute: 0, chest: 0, overhead: 0, carry: 0 };
  /** Cinematic override: what the fighter does while a Super plays. */
  role: Role | null = null;

  /**
   * `limited`: a sidekick politician. Same skeleton and clips, but a small move set: no kicks, no boxing guard,
   * every attack is a short jab or shove, and no jumping pose.
   */
  constructor(gltf: GLTF, clips: THREE.AnimationClip[], srcHipsRest: THREE.Vector3, public info: FighterInfo, public side: 0 | 1,
    private limited = false) {
    this.model = SkeletonUtils.clone(gltf.scene);
    this.model.scale.setScalar(info.height);
    this.root.add(this.model);
    const meshes: THREE.SkinnedMesh[] = [];
    this.model.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.SkinnedMesh);
      if ((o as THREE.Bone).isBone) this.bones[o.name] = o;
    });
    for (const mesh of meshes) {
      const mat = litMaterial(mesh.material as THREE.Material, info.id === 'tusk' ? 0x3a2418 : 0x1c2e3c);
      // The sidekick models have very pale hair that blooms under the top light; take a little off.
      if (limited) { mat.color.multiplyScalar(0.84); mat.roughness = Math.max(mat.roughness, 0.7); }
      this.uniforms.push(mat.userData.u);
      mesh.material = mat;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
    }
    this.hand = { r: this.bones.mixamorigRightHand, l: this.bones.mixamorigLeftHand };
    this.mixer = new THREE.AnimationMixer(this.model);
    for (const c of clips) {
      const a = this.mixer.clipAction(prepareClip(c, this.model, srcHipsRest));
      a.setLoop(THREE.LoopRepeat, Infinity);
      this.actions.set(c.name, a);
    }
  }

  /** Put a prop in a hand. Pass null to empty the hands. */
  hold(prop: THREE.Object3D | null, hand: 'r' | 'l' = 'r', offset?: (o: THREE.Object3D) => void) {
    if (this.held) this.held.parent?.remove(this.held);
    this.held = prop;
    if (!prop) return;
    const h = this.hand[hand];
    // Hand bones carry the rig's tiny scale; cancel it so props keep their real size.
    const ws = new THREE.Vector3(); h.getWorldScale(ws);
    prop.scale.setScalar(1 / ws.x);
    prop.position.set(0, 0, 0); prop.rotation.set(0, 0, 0);
    offset?.(prop);
    h.add(prop);
  }
  get holding() { return this.held ?? this.carried?.o ?? null; }

  /** Carry a prop posed from the arms (chainsaw in the left fist, sink in both hands). Null drops it. */
  carry(prop: THREE.Object3D | null, kind: 'chainsaw' | 'sink' = 'sink') {
    if (this.carried) this.root.remove(this.carried.o);
    this.carried = prop ? { o: prop, kind } : null;
    if (prop) { prop.userData.kind = kind; this.root.add(prop); }
  }

  private hitN = 0;
  /** Called on every hit taken: flashes the body and restarts the reaction. */
  hitFlash(k = 1) { this.flash = Math.max(this.flash, k); this.hitN++; }

  /** World position of a bone (for sparks, props, camera aims). */
  bonePos(name: 'head' | 'chest' | 'rhand' | 'lhand' | 'hips', out = new THREE.Vector3()) {
    const b = { head: 'mixamorigHead', chest: 'mixamorigSpine2', rhand: 'mixamorigRightHand', lhand: 'mixamorigLeftHand', hips: HIPS }[name];
    return this.bones[b].getWorldPosition(out);
  }

  /** Choose the clip and the time inside it for this frame. `frozen` stops time (hit-stop). */
  update(f: Fighter, def: SimDef, m: Match, dt: number, frozen: boolean) {
    this.root.position.set(f.x, f.y, 0);
    const want = f.facing * (Math.PI / 2) - f.facing * 0.38;
    this.yaw += (want - this.yaw) * Math.min(1, dt * 12);
    this.root.rotation.y = this.yaw;

    const pick = this.pick(f, def);
    this.play(pick.key, pick.clip, pick.fade);
    const a = this.cur!;
    if (pick.t !== undefined) { a.paused = true; a.time = pick.t; }
    else { a.paused = false; a.timeScale = pick.speed ?? 1; }
    this.mixer.update(frozen ? 0 : dt);
    if (pick.t !== undefined) { a.time = pick.t; this.mixer.update(0); }

    this.armPoses(f, def, dt);
    // Breathing in the guard stance, so the idle never looks frozen.
    if (pick.key === 'idle' && !frozen) {
      const s = Math.sin(this.loopT * 2.4);
      this.bones.mixamorigSpine1?.rotateX(s * 0.025);
      this.bones.mixamorigHead?.rotateX(-s * 0.02);
    }
    if (!frozen) this.loopT += dt;

    this.flash = Math.max(0, this.flash - dt * 6);
    for (const u of this.uniforms) u.uFlash.value = this.flash * 0.75;
  }

  /** Rotate `bone` (in world space) so the direction to `child` points along `dir`, blended by w. */
  private aim(bone: THREE.Object3D, child: THREE.Object3D, dir: THREE.Vector3, w: number) {
    if (w <= 0.001) return;
    const a = bone.getWorldPosition(_v1), b = child.getWorldPosition(_v2);
    const cur = b.sub(a).normalize();
    const delta = _q1.setFromUnitVectors(cur, _v3.copy(dir).normalize());
    const world = bone.getWorldQuaternion(_q2);
    const target = delta.multiply(world);
    const parentQ = bone.parent!.getWorldQuaternion(_q3).invert();
    bone.quaternion.slerp(parentQ.multiply(target), w);
    bone.updateMatrixWorld(true);
  }

  /**
   * Hand-made arm poses layered over the clips:
   * - heart: right hand to the chest, then the arm thrown out straight and high, palm down.
   * - chainsaw: the saw held up overhead while he says the line, then swung.
   * - sink: carried in both hands in front of the belly, lifted overhead to throw.
   */
  private armPoses(f: Fighter, def: SimDef, dt: number) {
    const sg = f.state === 'quote' || f.state === 'sig' ? sigOf(def, f) : null;
    const id = sg?.id;
    const want = { salute: 0, chest: 0, overhead: 0, carry: 0 };
    if (id === 'heart' && f.state === 'quote') want.chest = 1;
    if (id === 'heart' && f.state === 'sig') { if (f.af < 5) want.chest = 1; else want.salute = 1; }
    if (id === 'chainsaw' && f.state === 'quote') want.overhead = 1;
    if (id === 'sink' && (f.state === 'quote' || f.af < sg!.startup)) want.carry = 1;
    const k = Math.min(1, dt * 14);
    for (const n of Object.keys(want) as (keyof typeof want)[]) this.poseW[n] += (want[n] - this.poseW[n]) * k;

    this.model.updateMatrixWorld(true);
    const B = this.bones;
    const fwd = _fwd.set(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
    const up = _up.set(0, 1, 0);
    const side = _side.crossVectors(up, fwd).normalize(); // the fighter's left
    const w = this.poseW;

    if (w.chest > 0.01) {
      // Right hand flat over the heart.
      const chest = B.mixamorigSpine2.getWorldPosition(new THREE.Vector3()).addScaledVector(fwd, 0.16).addScaledVector(side, 0.05);
      this.aim(B.mixamorigRightArm, B.mixamorigRightForeArm, new THREE.Vector3().copy(up).multiplyScalar(-1).addScaledVector(fwd, 0.55).addScaledVector(side, -0.25), w.chest);
      const elbow = B.mixamorigRightForeArm.getWorldPosition(new THREE.Vector3());
      this.aim(B.mixamorigRightForeArm, B.mixamorigRightHand, chest.sub(elbow), w.chest);
    }
    if (w.salute > 0.01) {
      // Arm straight out, forward and up at about 40 degrees, hand in line with it.
      // Aimed at the opponent across the screen (not along the body, which is turned toward the camera).
      const dir = new THREE.Vector3(f.facing * 0.8, 0.58, 0.06);
      this.aim(B.mixamorigRightArm, B.mixamorigRightForeArm, dir, w.salute);
      this.aim(B.mixamorigRightForeArm, B.mixamorigRightHand, dir, w.salute);
      const tip = B.mixamorigRightHandMiddle1 ?? B.mixamorigRightHandIndex1;
      if (tip) this.aim(B.mixamorigRightHand, tip, dir, w.salute);
    }
    if (w.overhead > 0.01) {
      // Held high and a little toward the camera so the far arm isn't hidden behind his head.
      const dir = new THREE.Vector3().copy(up).addScaledVector(fwd, 0.2).add(new THREE.Vector3(0, 0, 0.45));
      this.aim(B.mixamorigLeftArm, B.mixamorigLeftForeArm, dir, w.overhead);
      this.aim(B.mixamorigLeftForeArm, B.mixamorigLeftHand, dir, w.overhead);
    }
    if (w.carry > 0.01) {
      // Both hands meet at a point in front of the belly; it rises overhead during the throw's wind-up.
      const lift = f.state === 'sig' ? Math.min(1, f.af / Math.max(1, sg!.startup)) : 0;
      const p = B.mixamorigSpine2.getWorldPosition(new THREE.Vector3()).addScaledVector(fwd, 0.42 - lift * 0.25).addScaledVector(up, -0.22 + lift * 0.75);
      for (const [arm, fore, hand, s] of [['RightArm', 'RightForeArm', 'RightHand', -1], ['LeftArm', 'LeftForeArm', 'LeftHand', 1]] as const) {
        const grip = p.clone().addScaledVector(side, 0.2 * s);
        const sh = B[`mixamorig${arm}`].getWorldPosition(new THREE.Vector3());
        // Upper arm points between the shoulder and the grip, a little outward so the elbow bends.
        this.aim(B[`mixamorig${arm}`], B[`mixamorig${fore}`], grip.clone().sub(sh).addScaledVector(side, 0.12 * s).addScaledVector(up, -0.1), w.carry);
        const el = B[`mixamorig${fore}`].getWorldPosition(new THREE.Vector3());
        this.aim(B[`mixamorig${fore}`], B[`mixamorig${hand}`], grip.sub(el), w.carry);
      }
    }
    this.placeCarried(fwd, up);
  }

  private placeCarried(fwd: THREE.Vector3, up: THREE.Vector3) {
    const c = this.carried;
    if (!c) return;
    const B = this.bones;
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    if (c.kind === 'chainsaw') {
      // Blade (+X) continues the left forearm; handle (+Y) away from the body.
      const hand = B.mixamorigLeftHand.getWorldPosition(new THREE.Vector3());
      const el = B.mixamorigLeftForeArm.getWorldPosition(new THREE.Vector3());
      const x = hand.clone().sub(el).normalize();
      const y = new THREE.Vector3().copy(up).addScaledVector(x, -x.dot(up));
      if (y.lengthSq() < 1e-4) y.copy(fwd);
      y.normalize();
      const z = new THREE.Vector3().crossVectors(x, y);
      m.makeBasis(x, y, z);
      // The rear grip sits in the fist.
      pos.copy(hand).addScaledVector(x, 0.18).addScaledVector(y, -0.16);
    } else {
      const r = B.mixamorigRightHand.getWorldPosition(new THREE.Vector3());
      const l = B.mixamorigLeftHand.getWorldPosition(new THREE.Vector3());
      pos.copy(r).add(l).multiplyScalar(0.5).addScaledVector(up, -0.05).addScaledVector(fwd, 0.04);
      // Basin up (+Y), taps (-Z) toward his body.
      m.makeBasis(new THREE.Vector3().crossVectors(up, fwd).normalize(), up.clone(), fwd.clone());
    }
    // Into the fighter root's local space.
    this.root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    const world = m.setPosition(pos);
    const local = inv.multiply(world);
    const sc = c.o.userData.scale ?? 1;
    local.decompose(c.o.position, c.o.quaternion, c.o.scale);
    c.o.scale.setScalar(sc);
  }

  private play(key: string, clip: string, fade = 0.1) {
    if (key === this.curKey) return;
    const next = this.actions.get(clip);
    if (!next) return;
    this.curKey = key;
    if (this.cur === next) return;
    next.reset(); next.enabled = true; next.setEffectiveWeight(1);
    next.play();
    if (this.cur) next.crossFadeFrom(this.cur, fade, false);
    this.cur = next;
  }

  /** Map one window of a clip onto [0, startup] (wind-up to impact) and [startup, end] (follow-through). */
  private win(w: Win, af: number, startup: number, end: number) {
    if (af <= startup) return w.impact - w.lead + (w.lead * af) / Math.max(1, startup);
    return w.impact + (w.tail * (af - startup)) / Math.max(1, end - startup);
  }

  private pick(f: Fighter, def: SimDef): { key: string; clip: string; t?: number; speed?: number; fade?: number } {
    const fr = f.frame;
    if (this.role) {
      switch (this.role) {
        case 'talk': return { key: 'c-talk', clip: 'Long_Breathe_and_Look_Around', speed: 1.1, fade: 0.25 };
        case 'pump': return { key: 'c-pump', clip: 'Victory_Fist_Pump', speed: 1, fade: 0.2 };
        case 'reel': return { key: 'c-reel', clip: 'Hit_Reaction', speed: 0.8, fade: 0.15 };
        case 'frozen': return { key: 'c-frozen', clip: 'Long_Breathe_and_Look_Around', t: 2.0, fade: 0.3 };
        case 'down': return { key: 'c-down', clip: 'Knock_Down', t: 2.45, fade: 0.2 };
        case 'shrug': return { key: 'c-shrug', clip: 'Long_Breathe_and_Look_Around', speed: 0.6, fade: 0.3 };
        case 'fight': return { key: 'c-fight', clip: 'Block1', t: 0.3, fade: 0.2 };
      }
    }
    if (this.limited) {
      const atk = f.move && (f.state === 'attack' || f.state === 'jump');
      if (atk) {
        const k = f.move!, mv = MOVES[k];
        const w = k === 'jab' || k === 'hook' || k === 'airPunch' ? MOVE_ANIM.jab : MOVE_ANIM.cross;
        return { key: `atk-${k}-${f.chain}`, clip: w.clip, t: this.win(w, f.af, mv.startup, mv.startup + mv.active + mv.recovery), fade: 0.08 };
      }
      if (f.state === 'idle' || f.state === 'crouch' || f.state === 'jump') {
        // Stands upright and fidgets, like a man at a podium: the first seconds of the breathing clip.
        const p = (Math.sin(this.loopT * 0.9) + 1) / 2;
        return { key: 'idle', clip: 'Long_Breathe_and_Look_Around', t: 0.4 + p * 1.6, fade: 0.2 };
      }
      if (f.state === 'walk') {
        const back = (f.cur & (f.facing === 1 ? 1 : 2)) !== 0;
        return { key: back ? 'walkB' : 'walkF', clip: 'Walk_Fight_Forward', speed: back ? -0.9 : 1.0, fade: 0.15 };
      }
    }
    switch (f.state) {
      case 'idle': {
        // Block1's opening is a high guard; drift through its first half-second and back.
        const p = (Math.sin(this.loopT * 1.6) + 1) / 2;
        return { key: 'idle', clip: 'Block1', t: 0.05 + p * 0.45, fade: 0.14 };
      }
      case 'walk': {
        const back = (f.cur & (f.facing === 1 ? 1 : 2)) !== 0;
        return { key: back ? 'walkB' : 'walkF', clip: 'Walk_Fight_Forward', speed: back ? -1.1 : 1.25, fade: 0.12 };
      }
      case 'crouch': return { key: 'crouch', clip: 'Leg_Sweep', t: 0.42, fade: 0.08 };
      case 'jump': {
        if (f.move) { const w = MOVE_ANIM[f.move]; const mv = MOVES[f.move]; return { key: `air-${f.move}`, clip: w.clip, t: this.win(w, f.af, mv.startup, mv.startup + mv.active + 12), fade: 0.05 }; }
        return { key: 'jump', clip: 'Spartan_Kick', t: 0.28, fade: 0.08 };
      }
      case 'attack': {
        const k = f.move!, mv = MOVES[k], w = MOVE_ANIM[k];
        return { key: `atk-${k}-${f.chain}`, clip: w.clip, t: this.win(w, f.af, mv.startup, mv.startup + mv.active + mv.recovery), fade: 0.06 };
      }
      case 'quote': {
        const sg = sigOf(def, f);
        if (sg.id === 'pause') return { key: 'pause', clip: 'Long_Breathe_and_Look_Around', t: 3.1, fade: 0.25 };
        return { key: `quote-${f.sig}`, clip: 'Long_Breathe_and_Look_Around', t: 0.6 + (fr / FPS) * 0.9, fade: 0.2 };
      }
      case 'sig': {
        const sg = sigOf(def, f), w = SIG_ANIM[sg.id] ?? SIG_ANIM.lecture;
        if (sg.id === 'chainsaw') {
          // Three sweeps across the active frames.
          const per = sg.active / (sg.hits ?? 1);
          if (f.af <= sg.startup) return { key: 'sig-cs-0', clip: w.clip, t: this.win(w, f.af, sg.startup, sg.startup + per) };
          const k = Math.min((sg.hits ?? 1) - 1, Math.floor((f.af - sg.startup) / per));
          const local = f.af - sg.startup - k * per;
          return { key: `sig-cs-${k + 1}`, clip: w.clip, t: w.impact - 0.15 + (local / per) * 0.5, fade: 0.04 };
        }
        if (sg.id === 'lecture') {
          const k = Math.max(0, Math.min(2, Math.floor((f.af - sg.startup + 6) / 12)));
          const local = f.af - (sg.startup + k * 12) + 8;
          return { key: `sig-lec-${k}`, clip: w.clip, t: w.impact - w.lead + (Math.max(0, local) / 18) * (w.lead + w.tail), fade: 0.05 };
        }
        return { key: `sig-${sg.id}`, clip: w.clip, t: this.win(w, f.af, sg.startup, sg.startup + sg.active + sg.recovery), fade: 0.08 };
      }
      case 'hitstun': return { key: `hit-${this.hitN}`, clip: 'Hit_Reaction', t: 0.3 + (fr / Math.max(1, fr + f.stun)) * 0.7, fade: 0.05 };
      case 'blockstun': return { key: 'block', clip: 'Block1', t: 1.15 + Math.min(1, fr / 10) * 0.35, fade: 0.06 };
      case 'stunned': return { key: 'stunned', clip: 'Face_Punch_Reaction', t: 0.1 + Math.min(1, fr / Math.max(1, fr + f.stun)) * 2.3, fade: 0.06 };
      case 'knockdown': return { key: 'down', clip: 'Knock_Down', t: Math.min(2.45, 0.5 + (fr / FPS) * 1.6 + (f.y > 0 ? 0 : 0.3)), fade: 0.06 };
      case 'getup': return { key: 'getup', clip: 'Stand_Up1', t: 3.2 + (fr / 26) * 3.6, fade: 0.1 };
      case 'dodge': return { key: 'dodge', clip: 'Stand_Dodge', t: 0.15 + (fr / 26) * 1.0, fade: 0.05 };
      case 'winded': return { key: 'winded', clip: 'Long_Breathe_and_Look_Around', speed: 1.6, fade: 0.25 };
      case 'superStart': return { key: 'super', clip: 'Right_Jab_from_Guard', t: 0.3 + (fr / 18) * 0.33, fade: 0.06 };
      case 'superWhiff': return { key: 'superWhiff', clip: 'Right_Jab_from_Guard', t: 0.63 + (fr / 40) * 1.0, fade: 0.06 };
      case 'ko': return { key: 'ko', clip: 'Knock_Down', t: Math.min(2.45, 0.5 + (fr / FPS) * 1.2), fade: 0.08 };
      case 'win': return { key: 'win', clip: 'Victory_Fist_Pump', speed: 0.9, fade: 0.25 };
    }
    return { key: 'idle', clip: 'Block1', t: 0.1 };
  }

  dispose() {
    this.mixer.stopAllAction();
    this.model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((x) => x.dispose());
    });
  }
}

/** Tusk's hips rest position: the clips were authored on his body. */
export function hipsRest(gltf: GLTF) {
  return gltf.scene.getObjectByName(HIPS)!.position.clone();
}
