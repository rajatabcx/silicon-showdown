import * as THREE from 'three';
import type { FighterDef } from '../data/fighters';
import type { Ev, Match } from '../sim/types';
import { Bobble, poseFor } from './bobblehead';
import { emojiCanvas } from './faces';
import { buildStage, STAGES, type Stage, type StageId } from './stages';

const YAW = 1.05; // fighters stand three-quarters on to the camera so the faces read
const CLOSEUP_FRAMES = 55;

type Side = { def: FighterDef; main: Bobble; sk: Bobble; yaw: number; ice: THREE.Sprite };

export class Renderer {
  private gl: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 120);
  private hemi = new THREE.HemisphereLight('#ffffff', '#5a4636', 1.5);
  private sun = new THREE.DirectionalLight('#fff4e0', 2.3);
  private sides: Side[] = [];
  private stage: Stage | null = null;
  private sky = new THREE.Color();
  private t = 0;
  private shake = 0;
  private camPos = new THREE.Vector3(0, 2.2, 9);
  private camLook = new THREE.Vector3(0, 1.6, 0);
  private emoji = new Map<string, THREE.Texture>();
  private sparkTex: THREE.Texture;
  private sparks: { s: THREE.Sprite; life: number; max: number; size: number }[] = [];
  private shots: THREE.Sprite[] = [];
  private rain: { s: THREE.Sprite; vy: number }[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.gl.shadowMap.enabled = true;
    this.sun.position.set(4, 10, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -11; sc.right = 11; sc.top = 9; sc.bottom = -3; sc.far = 40;
    this.scene.add(this.hemi, this.sun);
    this.sparkTex = new THREE.CanvasTexture(drawSpark());
    this.sparkTex.colorSpace = THREE.SRGBColorSpace;
    for (let i = 0; i < 2; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true })); s.scale.setScalar(0.9); s.visible = false;
      this.scene.add(s); this.shots.push(s);
    }
    this.resize();
  }

  private tex(e: string) {
    let t = this.emoji.get(e);
    if (!t) { t = new THREE.CanvasTexture(emojiCanvas(e)); t.colorSpace = THREE.SRGBColorSpace; this.emoji.set(e, t); }
    return t;
  }

  load(a: FighterDef, b: FighterDef, stageId: StageId) {
    this.clearMatch();
    this.stage = buildStage(stageId);
    this.scene.add(this.stage.group);
    const info = STAGES.find((s) => s.id === stageId)!;
    this.sky.set(info.sky);
    this.scene.fog = new THREE.Fog(info.fog, 18, 60);
    [a, b].forEach((def, i) => {
      const main = new Bobble(def.look), sk = new Bobble(def.sidekick.look);
      const ice = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex('🧊'), transparent: true }));
      ice.scale.setScalar(0.8); ice.visible = false;
      this.scene.add(main.root, sk.root, ice);
      this.sides.push({ def, main, sk, yaw: i === 0 ? YAW : -YAW, ice });
      if (def.projectile) { this.shots[i].material.map = this.tex(def.projectile); this.shots[i].material.needsUpdate = true; }
    });
  }

  private clearMatch() {
    for (const s of this.sides) { this.scene.remove(s.main.root, s.sk.root, s.ice); s.main.dispose(); s.sk.dispose(); s.ice.material.dispose(); }
    this.sides = [];
    if (this.stage) { this.scene.remove(this.stage.group); this.stage.dispose(); this.stage = null; }
    for (const r of this.rain) { this.scene.remove(r.s); r.s.material.dispose(); }
    for (const s of this.sparks) { this.scene.remove(s.s); s.s.material.dispose(); }
    this.rain = []; this.sparks = [];
  }

  private spark(x: number, y: number, size: number, color: string) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.sparkTex, color, transparent: true, depthTest: false }));
    s.position.set(x, y, 0.6); s.material.rotation = Math.random() * 6;
    this.scene.add(s);
    this.sparks.push({ s, life: 0, max: 0.22, size });
  }

  onEvent(e: Ev, m: Match) {
    switch (e.t) {
      case 'hit': {
        this.spark(e.x, e.y, e.heavy ? 2.6 : 1.5, e.heavy ? '#ffb020' : '#fff27a');
        this.shake = Math.max(this.shake, e.heavy ? 0.28 : 0.1);
        const d = this.sides[1 - e.by], f = m.f[1 - e.by];
        (f.sk ? d.sk : d.main).bonk(e.heavy ? 1 : 0.5, e.by === 0 ? -1 : 1);
        if (e.heavy || e.combo >= 3) this.stage?.cheer();
        break;
      }
      case 'block': this.spark(e.x, e.y, 1.1, '#7ad7ff'); break;
      case 'superLand': {
        const d = m.f[1 - e.by];
        this.spark(d.x, 1.6, 5, '#ffffff'); this.shake = 0.7; this.stage?.cheer();
        break;
      }
      case 'ko': case 'scandal': this.shake = Math.max(this.shake, 0.5); this.stage?.cheer(); break;
    }
  }

  draw(m: Match, dt: number) {
    this.t += dt;
    const t = this.t, cine = m.phase === 'cine';

    this.sides.forEach((s, i) => {
      const f = m.f[i];
      const role = !cine ? 'none' : m.cineBy === i ? 'attacker' : 'victim';
      const active = f.sk ? s.sk : s.main;
      s.yaw += (f.facing * YAW - s.yaw) * Math.min(1, dt * 14);
      active.root.visible = true;
      active.root.position.set(f.x, f.y, 0);
      active.root.rotation.y = s.yaw;
      active.update(poseFor(f, t, role), dt);
      if (f.sk) {
        // The billionaire catches their breath at the back while the sidekick fights.
        const side = i === 0 ? -1 : 1;
        s.main.root.position.set(f.x + side * 2.2, 0, -2.2);
        s.main.root.rotation.y = -side * 0.5;
        s.main.update(poseFor({ ...f, state: 'winded' }, t, 'none'), dt);
        s.ice.visible = true;
        s.ice.position.set(s.main.root.position.x, 2.9 + Math.sin(t * 4) * 0.08, -2.2);
      } else { s.sk.root.visible = false; s.ice.visible = false; }
    });

    this.shots.forEach((s, i) => {
      const p = m.proj.find((q) => q.owner === i);
      s.visible = !!p && !!s.material.map;
      if (p) { s.position.set(p.x, p.y, 0.3); s.material.rotation = t * 9 * Math.sign(p.vx); }
    });

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life += dt;
      const k = s.life / s.max;
      s.s.scale.setScalar(s.size * (0.4 + k * 0.9)); s.s.material.opacity = 1 - k;
      if (k >= 1) { this.scene.remove(s.s); s.s.material.dispose(); this.sparks.splice(i, 1); }
    }

    // Super cinematic: close-up on the attacker, then things rain on the victim.
    const [a, b] = m.f;
    let pos: [number, number, number], look: [number, number, number];
    if (cine) {
      const atk = m.f[m.cineBy], vic = m.f[1 - m.cineBy], def = this.sides[m.cineBy].def;
      if (m.phaseFrame < CLOSEUP_FRAMES) {
        pos = [atk.x + atk.facing * 1.5, 2.3, 3.7]; look = [atk.x, 2.25, 0];
      } else {
        pos = [vic.x - atk.facing * 0.8, 2.7, 7]; look = [vic.x, 1.9, 0];
        if (m.phaseFrame % 8 === 0) {
          const e = def.superEmoji[Math.floor((m.phaseFrame / 8) % def.superEmoji.length)];
          const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex(e), transparent: true }));
          s.scale.setScalar(1.1 + Math.random() * 0.9);
          s.position.set(vic.x + (Math.random() - 0.5) * 2.4, 7.5, (Math.random() - 0.5) * 1.2);
          this.scene.add(s); this.rain.push({ s, vy: -0.05 });
        }
      }
    } else {
      const spread = Math.abs(a.x - b.x), cx = (a.x + b.x) / 2;
      pos = [cx, 2.15 + spread * 0.06, 7.4 + spread * 0.62]; look = [cx, 1.65, 0];
    }
    for (let i = this.rain.length - 1; i >= 0; i--) {
      const r = this.rain[i];
      r.vy -= 0.012 * dt * 60; r.s.position.y += r.vy * dt * 60; r.s.material.rotation += dt * 3;
      if (r.s.position.y < 1.2) {
        if (cine) { this.spark(r.s.position.x, 1.4, 1.6, '#ffd27a'); this.shake = Math.max(this.shake, 0.16); }
        this.scene.remove(r.s); r.s.material.dispose(); this.rain.splice(i, 1);
      }
    }

    const k = Math.min(1, dt * (cine ? 6 : 9));
    this.camPos.lerp(new THREE.Vector3(...pos), k);
    this.camLook.lerp(new THREE.Vector3(...look), k);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    const sh = this.shake * this.shake * 1.6;
    this.cam.position.set(this.camPos.x + (Math.random() - 0.5) * sh, this.camPos.y + (Math.random() - 0.5) * sh, this.camPos.z);
    this.cam.lookAt(this.camLook);

    const dim = cine ? 0.45 : 1;
    this.hemi.intensity += (1.5 * dim - this.hemi.intensity) * 0.12;
    this.scene.background = this.sky.clone().multiplyScalar(this.hemi.intensity / 1.5);
    this.stage?.update(t);
    this.gl.render(this.scene, this.cam);
  }

  resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.gl.setSize(w, h, false);
    this.cam.aspect = w / h;
    // Keep both fighters in frame on tall, narrow screens.
    this.cam.fov = w / h < 1.4 ? 38 + (1.4 - w / h) * 34 : 38;
    this.cam.updateProjectionMatrix();
  }

  dispose() {
    this.clearMatch();
    for (const t of this.emoji.values()) t.dispose();
    this.sparkTex.dispose();
    for (const s of this.shots) s.material.dispose();
    this.gl.dispose();
  }
}

function drawSpark() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const c = cv.getContext('2d')!;
  c.translate(64, 64); c.fillStyle = '#fff';
  c.beginPath();
  for (let i = 0; i < 16; i++) { const r = i % 2 ? 22 : 62, a = (i / 16) * Math.PI * 2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  c.fill();
  return cv;
}
