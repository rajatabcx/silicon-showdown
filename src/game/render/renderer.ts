import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { FighterInfo } from '../data/roster';
import { FPS, INTRO_FRAMES, SUPER_STARTUP } from '../sim/constants';
import { sigAt, sigOf } from '../sim/match';
import type { Ev, Match, Projectile, SimDef } from '../sim/types';
import type { Assets } from './assets';
import { FighterView, hipsRest } from './character';
import { gate, label, modelProp, page, postCard, rocket, talkShowSet, tickerScreen, typingDots } from './props';
import { catSprite, tariffStamp } from './sidekick';
import { Stage, type Mood } from './stage';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uSat: { value: 1 }, uVig: { value: 0.32 }, uFlash: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) },
    uAberr: { value: 0 }, uTime: { value: 0 }, uGrain: { value: 0.035 }, uBlur: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uSat, uVig, uFlash, uAberr, uTime, uGrain, uBlur; uniform vec3 uTint; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime) * 43758.5453); }
    void main(){
      vec2 d = (vUv - 0.5);
      vec3 c;
      c.r = texture2D(tDiffuse, vUv + d * uAberr).r;
      c.g = texture2D(tDiffuse, vUv).g;
      c.b = texture2D(tDiffuse, vUv - d * uAberr).b;
      // Slow motion: the edges of the frame streak toward the centre, the middle stays sharp.
      if (uBlur > 0.001) {
        vec3 acc = c;
        for (int i = 1; i < 8; i++) acc += texture2D(tDiffuse, vUv - d * uBlur * 0.11 * float(i) / 8.0).rgb;
        c = mix(c, acc / 8.0, smoothstep(0.05, 0.4, length(d)));
      }
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, uSat) * uTint;
      c *= 1.0 - uVig * smoothstep(0.25, 0.85, length(d * vec2(1.25, 1.0)));
      c += (hash(vUv * 900.0) - 0.5) * uGrain;
      c = mix(c, vec3(1.0, 0.97, 0.92), uFlash);
      gl_FragColor = vec4(c, 1.0);
    }`,
};

type Spark = { s: THREE.Sprite; life: number; max: number; size: number; v?: THREE.Vector3 };
type Shot = { pos: THREE.Vector3; look: THREE.Vector3; fov: number; drift?: THREE.Vector3 };

/** What the scene needs to know about each side. */
export type SideSetup = { info: FighterInfo; def: SimDef };

export class Renderer {
  private gl: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 120);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private grade: ShaderPass;
  private stage: Stage;
  views: FighterView[] = [];
  /** The funded politicians: same rig as the billionaires, limited move set. Hidden until tagged in. */
  private sk: FighterView[] = [];
  private skZ = [0, 0];
  /** Where each billionaire stands while the sidekick fights (walks to the back corner). */
  private restX = [0, 0];
  private sides: SideSetup[];
  private t = 0;
  private shake = 0;
  private flash = 0;
  private aberr = 0;
  private bloomKick = 0;
  private camPos = new THREE.Vector3(0, 2.6, 14);
  private camLook = new THREE.Vector3(0, 1.3, 0);
  private camFov = 30;
  private sparkTex: THREE.Texture;
  private streakTex: THREE.Texture;
  private sparks: Spark[] = [];
  private rings: { m: THREE.Mesh; life: number }[] = [];
  private projViews = new Map<Projectile, THREE.Object3D>();
  private fx = new THREE.Group();
  private sigProps: (THREE.Object3D | null)[] = [null, null];
  private gates: { g: THREE.Object3D; life: number; land: number; x: number; by: number }[] = [];
  private cine: CineState | null = null;
  private policy: PolicyCine | null = null;
  private flashBy = -1;
  private blur = 0;
  /** Knockout: the picture drains to grey until the next round starts. */
  private grey = false;
  private dots: THREE.Sprite | null = null;
  /** Menu mode (nothing is simulated): a slow orbit of the room on the title, a steady two-shot on the select screen. */
  attract = true;
  lobby: 'title' | 'select' = 'title';

  constructor(private canvas: HTMLCanvasElement, private assets: Assets, sides: SideSetup[]) {
    this.sides = sides;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 0.95;
    const pm = new THREE.PMREMGenerator(this.gl);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    pm.dispose();
    this.scene.background = new THREE.Color('#120d0c');
    this.scene.fog = new THREE.Fog('#120d0c', 22, 48);
    this.stage = new Stage(this.scene);
    this.scene.add(this.fx);

    const rest = hipsRest(assets.tusk);
    sides.forEach((s, i) => {
      const gltf = s.info.id === 'teal' ? assets.teal : assets.tusk;
      const v = new FighterView(gltf, assets.tusk.animations, rest, s.info, i as 0 | 1);
      this.scene.add(v.root);
      this.views.push(v);
      const si = s.info.sidekick;
      const sk = new FighterView(assets[si.model], assets.tusk.animations, rest, { ...s.info, height: si.height }, i as 0 | 1, true);
      sk.root.visible = false;
      this.scene.add(sk.root);
      this.sk.push(sk);
    });

    this.composer = new EffectComposer(this.gl);
    this.composer.addPass(new RenderPass(this.scene, this.cam));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.3, 0.4, 1.35);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());

    this.sparkTex = new THREE.CanvasTexture(drawStar());
    this.streakTex = new THREE.CanvasTexture(drawStreak());
    this.resize();
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __ss: unknown }).__ss = { r: this, scene: this.scene, bloom: this.bloom, grade: this.grade, stage: this.stage, gl: this.gl };
  }

  /** A body point on whoever is fighting for this side: the billionaire, or the sidekick when tagged in. */
  private part(side: number, name: 'head' | 'chest' | 'hips', m?: Match) {
    if (m && m.f[side].tag > 0) {
      return this.sk[side].bonePos(name);
    }
    return this.views[side].bonePos(name);
  }

  private flashSide(side: number, m: Match, k: number) {
    if (m.f[side].tag > 0) this.sk[side].hitFlash(k); else this.views[side].hitFlash(k);
  }

  // ---------- effects

  private spark(p: THREE.Vector3, size: number, color: string, life = 0.22) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.sparkTex, color: new THREE.Color(color).multiplyScalar(2.2), transparent: true, depthTest: false, blending: THREE.AdditiveBlending }));
    s.position.copy(p); s.material.rotation = Math.random() * 6;
    this.fx.add(s);
    this.sparks.push({ s, life: 0, max: life, size });
  }

  private burst(p: THREE.Vector3, n: number, color: string, speed = 6) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.streakTex, color: new THREE.Color(color).multiplyScalar(2.5), transparent: true, depthTest: false, blending: THREE.AdditiveBlending }));
      const a = Math.random() * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a), Math.sin(a), (Math.random() - 0.5) * 0.4).multiplyScalar(speed * (0.5 + Math.random()));
      s.material.rotation = a;
      s.position.copy(p);
      this.fx.add(s);
      this.sparks.push({ s, life: 0, max: 0.18 + Math.random() * 0.12, size: 0.5, v });
    }
  }

  private ring(x: number, color = '#f3e3c3') {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 40), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, 0);
    this.fx.add(m); this.rings.push({ m, life: 0 });
  }

  private kick(shake: number, flash = 0, bloom = 0, aberr = 0) {
    this.shake = Math.max(this.shake, shake);
    this.flash = Math.max(this.flash, flash);
    this.bloomKick = Math.max(this.bloomKick, bloom);
    this.aberr = Math.max(this.aberr, aberr);
  }

  onEvent(e: Ev, m: Match) {
    switch (e.t) {
      case 'hit': {
        this.flashSide(1 - e.by, m, e.heavy ? 1 : 0.6);
        const p = this.part(1 - e.by, e.move === 'sweep' ? 'hips' : 'chest', m);
        p.z += 0.4;
        this.spark(p, e.heavy ? 2.4 : 1.4, e.heavy ? '#ffb347' : '#fff0a0');
        this.burst(p, e.heavy ? 12 : 6, e.heavy ? '#ffc56b' : '#fff6c8', e.heavy ? 9 : 6);
        this.kick(e.heavy ? 0.32 : 0.12, e.heavy ? 0.12 : 0, e.heavy ? 0.6 : 0.15, e.heavy ? 0.006 : 0);
        if (e.heavy || e.combo >= 3) this.stage.cheer(e.move === 'sig' ? 1.4 : 0.7);
        break;
      }
      case 'block': {
        const p = this.part(1 - e.by, 'chest', m); p.z += 0.5;
        this.spark(p, e.heavy ? 1.6 : 1.1, '#8fd3ff');
        this.burst(p, 5, '#bfe8ff', 5);
        this.kick(e.heavy ? 0.12 : 0.05);
        break;
      }
      case 'factCheck': {
        const s = m.f[1 - e.by], v = this.views[1 - e.by];
        const p = v.bonePos('head'); p.z += 0.3;
        this.spark(p, 3, '#7ad7ff', 0.35);
        this.burst(p, 16, '#9be2ff', 8);
        this.kick(0.35, 0.25, 1.2, 0.012);
        this.stage.cheer(1.2);
        v.carry(null);
        void s;
        break;
      }
      case 'counter': {
        const p = this.part(e.by, 'chest', m); p.z += 0.4;
        this.spark(p, 2.4, '#8fd3ff', 0.3);
        this.kick(0.3, 0.1, 0.6, 0.006);
        break;
      }
      case 'sigGo': {
        const v = this.views[e.by], id = sigAt(this.sides[e.by].def, e.sig).id;
        if (id === 'losers' || id === 'tariff') {
          const g = id === 'losers' ? gate() : tariffStamp();
          const f = m.f[e.by];
          g.position.set(f.dropX, 8, -0.2);
          const l = label(id === 'losers' ? 'MONOPOLY' : 'TARIFF EVERYTHING', id === 'losers' ? '#ffd34d' : '#ff6b6b', 0.55);
          l.position.set(0, id === 'losers' ? 3.2 : 2.3, 0); g.add(l);
          this.fx.add(g);
          this.gates.push({ g, life: 0, land: sigAt(this.sides[e.by].def, e.sig).startup / FPS, x: f.dropX, by: e.by });
        }
        if (id === 'heart') { const p = v.bonePos('chest'); p.z += 0.3; this.spark(p, 0.8, '#ff8f8f', 0.2); }
        this.kick(0.05, 0, 0.3);
        break;
      }
      case 'throw': {
        const v = this.views[e.by];
        if (sigAt(this.sides[e.by].def, e.sig).id === 'sink') v.carry(null);
        this.kick(0.06);
        break;
      }
      case 'quoteCut': this.views[e.by].carry(null); break;
      case 'tier': if (e.tier >= 2) { this.kick(0.1, 0.05, 0.8); this.stage.cheer(1); } break;
      case 'superStart': this.kick(0.12, 0.35, 1.2, 0.01); this.stage.setMood('dark'); break;
      case 'superHit': {
        this.cine = new CineState(e.by);
        this.kick(0.25, 0.3, 1);
        break;
      }
      case 'superLand': {
        this.endCine();
        const d = this.views[1 - e.by];
        d.floored = true;
        this.ring(m.f[1 - e.by].x);
        this.kick(0.2, 0.05, 0.4);
        break;
      }
      case 'ko': {
        const p = this.views[e.by].bonePos('chest'); p.z += 0.4;
        this.spark(p, 4, '#ffffff', 0.4);
        this.burst(p, 22, '#ffd27a', 11);
        this.kick(0.6, 0.5, 1.6, 0.02);
        this.stage.cheer(2);
        this.grey = true;
        break;
      }
      case 'roundStart': this.endCine(); this.grey = false; break;
      case 'tagIn': {
        const f = m.f[e.by];
        this.restX[e.by] = f.x;
        const p = new THREE.Vector3(f.x, 1.2, 0.3);
        this.burst(p, 14, '#ffe2a0', 7); this.ring(f.x, '#ffd34d');
        this.kick(0.2, 0.05, 0.4); this.stage.cheer(1); this.stage.photo();
        break;
      }
      case 'tagOut': {
        const p = this.sk[e.by].bonePos('head'); p.y -= 0.5;
        this.spark(p, e.scandal ? 3 : 1.4, e.scandal ? '#ff5a52' : '#fff0a0', 0.35);
        this.burst(p, e.scandal ? 18 : 6, e.scandal ? '#ff8f6b' : '#fff6c8', 8);
        if (e.scandal) { this.kick(0.35, 0.15, 0.8, 0.01); this.stage.photo(); }
        break;
      }
    }
  }

  private endCine() {
    if (!this.cine) return;
    this.cine.dispose(this.fx);
    this.cine = null;
    this.views.forEach((v) => { v.role = null; v.roleSpeed = 1; v.roleT = 0; });
    this.stage.setMood('normal');
    if (this.dots) { this.fx.remove(this.dots); this.dots = null; }
  }

  // ---------- signature props in hand

  private updateSigProps(m: Match) {
    m.f.forEach((f, i) => {
      const v = this.views[i], def = this.sides[i].def;
      const sg = f.state === 'quote' || f.state === 'sig' ? sigOf(def, f) : null;
      let want: 'chainsaw' | 'sink' | null = null;
      if (sg?.id === 'chainsaw') want = 'chainsaw';
      if (sg?.id === 'sink' && (f.state === 'quote' || f.af < sg.startup)) want = 'sink';
      const have = v.holding?.userData.kind ?? null;
      if (want === have) return;
      if (!want) { v.carry(null); v.hold(null); return; }
      const prop = modelProp(this.assets, want);
      prop.userData.scale = want === 'chainsaw' ? 0.85 : 0.8;
      v.carry(prop, want);
    });
  }

  private updateProjectiles(m: Match, dt: number) {
    const live = new Set(m.proj);
    for (const [p, o] of this.projViews) if (!live.has(p)) { this.fx.remove(o); this.projViews.delete(p); }
    for (const p of m.proj) {
      let o = this.projViews.get(p);
      if (!o) {
        const id = sigAt(this.sides[p.owner].def, p.sig).id;
        if (id === 'sink') { o = modelProp(this.assets, 'sink'); o.scale.setScalar(0.8); o.add(label('LET THAT SINK IN', '#ffffff', 0.3).translateY(0.8)); }
        else if (id === 'cats') o = catSprite();
        else o = page();
        o.userData.id = id;
        this.fx.add(o); this.projViews.set(p, o);
      }
      o.position.set(p.x, p.y, 0.15);
      if (o.userData.id === 'sink') { o.rotation.z -= dt * 9 * Math.sign(p.vx); }
      else if (o.userData.id === 'cats') { (o as THREE.Sprite).material.rotation += dt * 8 * -Math.sign(p.vx); }
      else { o.rotation.y += dt * 14; o.rotation.z = Math.sin(this.t * 20) * 0.3; }
    }
  }

  // ---------- frame

  draw(m: Match, dt: number) {
    this.t += dt;
    const frozen = m.hitstop > 0 && m.phase !== 'cine';
    const cine = m.phase === 'cine' && this.cine ? this.cine : null;
    if (cine) cine.t = m.phaseFrame / FPS;

    this.updateSigProps(m);
    this.views.forEach((v, i) => {
      const f = m.f[i];
      const sk = this.sk[i];
      if (f.tag > 0) {
        // Steps in from the back of the room to take the billionaire's place.
        if (!sk.root.visible) this.skZ[i] = -2.4;
        sk.root.visible = true;
        sk.update(f, this.sides[i].def, m, dt, frozen);
        if (!frozen) this.skZ[i] += -this.skZ[i] * Math.min(1, dt * 5);
        sk.root.position.z = this.skZ[i];
      } else sk.root.visible = false;
      if (f.tag > 0) {
        // The billionaire walks to the back corner and gets his breath back.
        const corner = Math.max(-5.6, Math.min(5.6, f.x - f.facing * 1.5));
        const from = this.restX[i];
        this.restX[i] += (corner - this.restX[i]) * Math.min(1, dt * 2.5);
        const moving = Math.abs(corner - from) > 0.3;
        const proxy = { ...f, x: this.restX[i], y: 0, tag: 0, move: null, state: moving ? 'walk' : 'winded', frame: f.tag,
          facing: (moving ? Math.sign(corner - from) || 1 : (i === 0 ? 1 : -1)) as 1 | -1, cur: 0 } as typeof f;
        v.update(proxy, this.sides[i].def, m, dt, frozen);
        v.root.position.z = -2.4;
      } else {
        v.update(f, this.sides[i].def, m, dt, frozen);
        this.restX[i] = f.x;
      }
    });
    // The chainsaw lands in his hand: a flash and a jolt.
    for (const v of this.views) {
      if (!v.caughtAt) continue;
      this.spark(v.caughtAt, 1.6, '#fff4d0', 0.25);
      this.burst(v.caughtAt, 14, '#ffd27a', 5);
      this.kick(0.12, 0.06, 0.4);
      v.caughtAt = null;
    }
    this.updateProjectiles(m, dt);

    for (let i = this.gates.length - 1; i >= 0; i--) {
      const g = this.gates[i];
      g.life += dt;
      const k = Math.min(1, g.life / g.land);
      g.g.position.y = 8 * (1 - k * k);
      if (k >= 1 && !g.g.userData.landed) {
        g.g.userData.landed = true;
        this.ring(g.x, '#ffd34d'); this.kick(0.35, 0.05, 0.4);
        this.burst(new THREE.Vector3(g.x, 0.2, 0.3), 10, '#ffe2a0', 6);
      }
      if (g.life > g.land + 1.0) g.g.position.y = -((g.life - g.land - 1.0) ** 2) * 6;
      if (g.life > g.land + 1.8) { this.fx.remove(g.g); this.gates.splice(i, 1); }
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life += dt;
      const k = s.life / s.max;
      if (s.v) { s.s.position.addScaledVector(s.v, dt); s.s.scale.set(s.size * 1.6 * (1 - k * 0.5), s.size * 0.18, 1); }
      else s.s.scale.setScalar(s.size * (0.35 + k * 0.9));
      s.s.material.opacity = 1 - k;
      if (k >= 1) { this.fx.remove(s.s); s.s.material.dispose(); this.sparks.splice(i, 1); }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life += dt;
      r.m.scale.setScalar(1 + r.life * 9);
      (r.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - r.life * 2.2);
      if (r.life > 0.5) { this.fx.remove(r.m); r.m.geometry.dispose(); (r.m.material as THREE.Material).dispose(); this.rings.splice(i, 1); }
    }

    // Teal's long pause: a "typing…" bubble over his head.
    const pausing = m.f.findIndex((f, i) => f.state === 'quote' && sigOf(this.sides[i].def, f).id === 'pause');
    if (pausing >= 0 && !this.dots) { this.dots = typingDots(); this.fx.add(this.dots); }
    if (pausing < 0 && this.dots) { this.fx.remove(this.dots); this.dots = null; }
    if (this.dots && pausing >= 0) {
      // Behind his head, clear of the speech bubble that sits above it.
      const hp = this.views[pausing].bonePos('head', this.dots.position);
      hp.x -= m.f[pausing].facing * 0.95; hp.y += 0.1;
      (this.dots.userData.tick as (t: number, size: number) => void)(this.t, 0.55 + m.f[pausing].frame / 400);
    }

    // Camera. A Super's cinematic, a sidekick's Policy Move and the flash when a Super is called each direct it;
    // otherwise it follows the fight.
    let shot: Shot;
    let snap = false;
    const fighting = !cine && m.phase === 'fight';
    const flashBy = fighting ? m.f.findIndex((f) => f.state === 'superStart') : -1;
    const polBy = fighting && flashBy < 0
      ? m.f.findIndex((f, i) => (f.tag > 0 && f.sig === 3 && (f.state === 'quote' || f.state === 'sig')) || m.proj.some((p) => p.owner === i && p.sig === 3))
      : -1;
    if (polBy >= 0 && this.policy?.by !== polBy) { this.policy = new PolicyCine(polBy as 0 | 1); this.stage.setMood('gold'); }
    if (polBy < 0 && this.policy) { this.policy = null; if (!cine && flashBy < 0) this.stage.setMood('normal'); }
    let wantBlur = 0;
    if (cine) {
      const r = cine.direct(this, m, dt);
      shot = r.shot; snap = r.cut; wantBlur = cine.blur;
    } else if (flashBy >= 0) {
      // The call: a fast low push-in on whoever called it, while the room goes dark.
      const f = m.f[flashBy], k = Math.min(1, f.frame / SUPER_STARTUP);
      const head = this.views[flashBy].bonePos('head');
      shot = { pos: new THREE.Vector3(f.x + f.facing * (2.5 - k * 0.9), 0.95, 4.4 - k * 1.5), look: new THREE.Vector3(f.x, head.y - 0.2, 0), fov: 36 - k * 6 };
      snap = this.flashBy !== flashBy;
      wantBlur = 0.9;
    } else if (this.policy) {
      const r = this.policy.direct(this, m);
      shot = r.shot; snap = r.cut; wantBlur = this.policy.blur;
    } else shot = this.fightShot(m);
    this.flashBy = flashBy;
    if (snap) { this.camPos.copy(shot.pos); this.camLook.copy(shot.look); this.camFov = shot.fov; }
    else {
      const k = Math.min(1, dt * (m.phase === 'intro' ? 2.2 : flashBy >= 0 ? 20 : 5));
      this.camPos.lerp(shot.pos, k); this.camLook.lerp(shot.look, k); this.camFov += (shot.fov - this.camFov) * k;
    }
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const sh = this.shake * this.shake * 0.9;
    this.cam.position.set(this.camPos.x + (Math.random() - 0.5) * sh, this.camPos.y + (Math.random() - 0.5) * sh, this.camPos.z);
    this.cam.lookAt(this.camLook.x + (Math.random() - 0.5) * sh * 0.3, this.camLook.y, this.camLook.z);
    if (Math.abs(this.cam.fov - this.camFov) > 0.01) { this.cam.fov = this.camFov; this.cam.updateProjectionMatrix(); }

    // Post.
    this.flash = Math.max(0, this.flash - dt * 3.5);
    this.aberr = Math.max(0, this.aberr - dt * 0.05);
    this.bloomKick = Math.max(0, this.bloomKick - dt * 2.2);
    const u = this.grade.uniforms;
    u.uFlash.value = this.flash;
    u.uAberr.value = this.aberr;
    u.uTime.value = this.t % 100;
    const wantSat = cine?.sat ?? (this.grey && m.phase === 'roundEnd' ? 0.05 : 1);
    u.uSat.value += (wantSat - u.uSat.value) * Math.min(1, dt * 3);
    u.uVig.value += ((cine || flashBy >= 0 || this.policy ? 0.55 : 0.34) - u.uVig.value) * Math.min(1, dt * 6);
    this.blur += (wantBlur - this.blur) * Math.min(1, dt * 14);
    u.uBlur.value = this.blur;
    this.bloom.strength = 0.2 + this.bloomKick * 0.7 + (cine?.bloom ?? 0);

    this.stage.update(this.t, dt);
    this.composer.render(dt);
  }

  /** Screen rectangle (0..1, y down) of the prop a fighter holds, once it has landed in his hands. */
  propRect(side: 0 | 1) {
    const o = this.views[side].settledProp;
    if (!o) return null;
    const box = new THREE.Box3().setFromObject(o);
    let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
    const v = new THREE.Vector3();
    for (let k = 0; k < 8; k++) {
      v.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).project(this.cam);
      const sx = (v.x + 1) / 2, sy = (1 - v.y) / 2;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    return { x0, x1, y0, y1 };
  }

  /** Screen position (0..1) above a head. `who` picks the billionaire or the sidekick; default is whoever is fighting. */
  headOnScreen(side: 0 | 1, m?: Match, who?: 'boss' | 'sk') {
    const sk = who ? who === 'sk' : !!m && m.f[side].tag > 0;
    const p = sk ? this.sk[side].bonePos('head') : this.views[side].bonePos('head');
    p.y += 0.35;
    p.project(this.cam);
    return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
  }

  fightShot(m: Match): Shot {
    if (this.attract && this.lobby === 'select') {
      // Far enough back, and aimed low enough, that both stand in the gap between the heading and the name plates.
      return { pos: new THREE.Vector3(Math.sin(this.t * 0.25) * 0.2, 1.1, 9.2), look: new THREE.Vector3(0, 0.1, 0), fov: 30 };
    }
    if (this.attract) {
      const a = this.t * 0.07;
      return { pos: new THREE.Vector3(Math.sin(a) * 3.2, 1.9 + Math.sin(this.t * 0.2) * 0.2, 9 + Math.cos(a) * 1.2), look: new THREE.Vector3(0, 1.45, 0), fov: 30 };
    }
    const [a, b] = m.f;
    const spread = Math.abs(a.x - b.x), cx = (a.x + b.x) / 2;
    const maxY = Math.max(a.y, b.y);
    const talking = m.f.findIndex((f) => f.state === 'quote');
    // Lean in on whoever is talking, but only while both still fit in the frame.
    const lean = talking >= 0 ? Math.max(0, Math.min(1, (4.5 - spread) / 2)) : 0;
    const dist = 7.6 + spread * 0.72 - lean;
    const fx = talking >= 0 ? cx * (1 - 0.4 * lean) + m.f[talking].x * 0.4 * lean : cx;
    if (m.phase === 'intro') {
      const k = Math.min(1, m.phaseFrame / INTRO_FRAMES);
      const e = 1 - Math.pow(1 - k, 3);
      return { pos: new THREE.Vector3(Math.sin((1 - e) * 1.2) * 9, 1.8 + (1 - e) * 3.2, 7 + e * (dist - 7)), look: new THREE.Vector3(0, 1.25, 0), fov: 30 };
    }
    return { pos: new THREE.Vector3(fx, 1.6 + maxY * 0.35 + spread * 0.04, dist), look: new THREE.Vector3(fx, 1.32 + maxY * 0.4, 0), fov: 30 };
  }

  /** Used by the Super and Policy Move scripts. */
  scene3d() { return this.fx; }
  now() { return this.t; }
  defOf(side: number) { return this.sides[side].def; }
  /** Head of whoever is fighting for a side (billionaire or tagged-in sidekick). */
  headOf(side: number, m: Match) { return this.part(side, 'head', m); }
  /** Height of the tariff stamp a sidekick is dropping, or null once it is gone. */
  stampY(by: number) { const g = this.gates.find((x) => x.by === by); return g ? g.g.position.y : null; }
  stageRef() { return this.stage; }
  propsFor() { return this.assets; }
  fxKick(shake: number, flash = 0, bloom = 0, aberr = 0) { this.kick(shake, flash, bloom, aberr); }
  fxSpark(p: THREE.Vector3, size: number, color: string, life = 0.3) { this.spark(p, size, color, life); }
  fxBurst(p: THREE.Vector3, n: number, color: string, speed = 8) { this.burst(p, n, color, speed); }
  fxRing(x: number, color?: string) { this.ring(x, color); }

  resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.gl.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
  }

  dispose() {
    this.endCine();
    this.views.forEach((v) => v.dispose());
    this.sk.forEach((v) => v.dispose());
    this.stage.dispose();
    this.sparkTex.dispose(); this.streakTex.dispose();
    this.composer.dispose();
    this.gl.dispose();
  }
}

// ---------- Supers

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
type Beat = { name: string; shot: Shot };

/**
 * Runs one Super: camera cuts, props, lighting and roles, keyed to the seconds in data/roster.ts.
 *
 * The simulation is stopped for the whole cinematic and a real voice clip plays under it, so the clock here runs at
 * full speed. Slow motion is staged instead: fighters and props move at a fraction of their speed in the beats that
 * call for it (`roleSpeed`, the rocket's fall), with the frame streaking at the edges (`blur`).
 */
class CineState {
  t = 0;
  sat = 1;
  bloom = 0;
  blur = 0;
  private props: THREE.Object3D[] = [];
  private beat = '';
  private objs: Record<string, THREE.Object3D> = {};
  private flags = new Set<string>();

  constructor(public by: 0 | 1) {}

  private once(k: string) { if (this.flags.has(k)) return false; this.flags.add(k); return true; }
  private add(r: Renderer, name: string, o: THREE.Object3D) { this.objs[name] = o; this.props.push(o); r.scene3d().add(o); return o; }

  direct(r: Renderer, m: Match, dt: number): { shot: Shot; cut: boolean } {
    const atk = m.f[this.by], vic = m.f[1 - this.by];
    const av = r.views[this.by], vv = r.views[1 - this.by];
    const dir = atk.facing;
    this.blur = 0;
    av.roleSpeed = 1; vv.roleSpeed = 1;
    const id = av.info.id;
    const b = id === 'tusk' ? this.tusk(r, atk.x, vic.x, dir, this.t, av, vv) : this.teal(r, atk.x, vic.x, dir, this.t, av, vv);
    const cut = b.name !== this.beat;
    this.beat = b.name;
    void dt;
    return { shot: b.shot, cut };
  }

  /** Beat 1, shared: the blow that starts it, from low behind the attacker, in slow motion. */
  private contact(ax: number, vx: number, dir: number, t: number, av: FighterView, vv: FighterView): Beat {
    const k = clamp01(t / 0.6), mid = (ax + vx) / 2;
    av.role = 'strike'; av.roleT = k; vv.role = 'reel'; vv.roleSpeed = 0.3;
    this.blur = 0.9 - k * 0.5;
    return { name: 'contact', shot: { pos: V(mid - dir * (1.9 - k * 0.5), 0.9, 4.7 - k * 0.8), look: V(mid + dir * 0.35, 1.35, 0), fov: 36 } };
  }

  /**
   * The final blow, shared: the victim is thrown up and comes down flat, slowly, seen from the floor.
   * `k` runs 0..1 across the fall; the first tenth is a held frame.
   */
  private blow(vx: number, dir: number, k: number, vv: FighterView, height: number): Shot {
    const kk = clamp01((k - 0.1) / 0.9);
    const arc = Math.sin(Math.PI * Math.min(1, kk * 1.05)) * height;
    vv.role = 'fall'; vv.roleT = kk;
    vv.root.position.y += arc;
    this.blur = 0.6 - kk * 0.4;
    return { pos: V(vx - dir * (2.5 + kk * 0.3), 0.5, 4.3), look: V(vx, 1.15 + arc * 0.45, 0), fov: 42 };
  }

  private tusk(r: Renderer, ax: number, vx: number, dir: number, t: number, av: FighterView, vv: FighterView): Beat {
    const st = r.stageRef();
    const mid = (ax + vx) / 2;
    if (t < 0.6) return this.contact(ax, vx, dir, t, av, vv);
    if (t < 2.4) {
      // Title: a low hero close-up that drifts around him.
      av.role = 'talk'; vv.role = 'fight';
      if (this.once('dark')) st.setMood('dark');
      const k = (t - 0.6) / 1.8, head = av.bonePos('head');
      return { name: 'title', shot: { pos: V(ax + dir * (2.3 - k * 0.7), 0.75 + k * 0.1, 2.7 - k * 0.25), look: V(ax, head.y - 0.12, 0), fov: 34 } };
    }
    if (t < 4.4) {
      if (this.once('post')) {
        st.setMood('normal');
        const card = postCard('Am considering taking Tesla private at $420. Funding secured.', '@melontusk', 'Melon Tusk', 'POST ON X · AUG 2018', 3.6);
        card.position.set(mid, 9, -1.2);
        this.add(r, 'post', card);
        st.cheer(1);
      }
      const card = this.objs.post;
      const k = Math.min(1, (t - 2.4) / 0.45);
      card.position.y = 9 - (9 - 3.4) * (1 - Math.pow(1 - k, 3)) + (k >= 1 ? Math.sin(t * 2) * 0.03 : 0);
      card.rotation.z = (1 - k) * 0.4;
      if (k >= 1 && this.once('postLand')) r.fxKick(0.25, 0.05, 0.4);
      // The post drops in: wide first, then from behind the opponent, looking up at it over his shoulder.
      if (t < 3.5) return { name: 'prop', shot: { pos: V(mid - dir * 1.5, 2.2, 9.2), look: V(mid, 2.3, -1), fov: 30 } };
      const k2 = (t - 3.5) / 0.9;
      return { name: 'reverse', shot: { pos: V(vx + dir * (2.1 - k2 * 0.2), 1.6, 4.4), look: V(mid - dir * 0.3, 1.9, -0.6), fov: 48 } };
    }
    if (t < 5.4) {
      if (this.once('ticker')) {
        const s = tickerScreen(); s.position.set(0, 3.0, -2.6); this.add(r, 'ticker', s);
        if (this.objs.post) this.objs.post.visible = false;
      }
      const k = Math.min(1, (t - 4.4) / 0.9);
      (this.objs.ticker.userData.tick as (k: number) => void)(k);
      return { name: 'insert', shot: { pos: V(0, 3.0, 0.2 - k * 0.3), look: V(0, 3.0, -2.6), fov: 34 } };
    }
    if (this.once('rocket')) {
      if (this.objs.ticker) this.objs.ticker.visible = false;
      st.setMood('red');
      const rk = rocket(); rk.scale.setScalar(0.55); this.add(r, 'rocket', rk);
      const tag = label('TO THE MOON', '#ffd34d', 0.9).translateY(3.6); tag.name = 'tag'; rk.add(tag);
      this.bloom = 0.3;
    }
    const rk = this.objs.rocket;
    const sx = ax - dir * 2.2;
    if (t < 6.5) {
      // Lift-off behind him, seen from the floor.
      av.role = 'pump'; vv.role = 'fight';
      const k = (t - 5.4) / 1.1;
      rk.position.set(sx, -1.5 + k * k * 11, -1.5); rk.rotation.z = 0;
      if (this.once('rumble')) r.fxKick(0.35, 0.1, 0.6);
      return { name: 'launch', shot: { pos: V(THREE.MathUtils.clamp(sx - dir * 1.5, -3.6, 3.6), 0.9, 5.2), look: V(sx, 2.0 + k * k * 6.5, -1.5), fov: 38 } };
    }
    if (t < 7.5) {
      // It turns over and comes down on the opponent, in slow motion: first from the floor looking up past them,
      // then tight on their face as its light reaches them.
      av.role = 'pump'; vv.role = 'reel'; vv.roleSpeed = 0.22;
      const k = t - 6.5;
      rk.rotation.z = Math.PI;
      const tag = rk.getObjectByName('tag'); if (tag) tag.visible = false;
      rk.position.set(sx + (vx - sx) * Math.min(1, k * 2.5), 7.4 - Math.pow(k, 1.6) * 5.6, -1.5 + Math.min(1, k * 2.5) * 1.5);
      this.blur = 0.4 + k * 0.25;
      if (t < 7.12) return { name: 'lookup', shot: { pos: V(vx + dir * 1.4, 0.3, 3.5), look: V(vx - dir * 0.1, 1.9, 0), fov: 56 } };
      const head = vv.bonePos('head'), kf = (t - 7.12) / 0.38;
      this.sat = 0.6;
      return { name: 'face', shot: { pos: V(head.x - dir * 0.6, head.y + 0.1, 2.0 - kf * 0.3), look: V(head.x, head.y + 0.08, 0), fov: 30 } };
    }
    rk.visible = false;
    this.sat = 1;
    if (this.once('boom')) {
      const p = V(vx, 0.8, 0.3);
      r.fxSpark(p, 5, '#ffffff', 0.3); r.fxSpark(p, 3.5, '#ff7a3a', 0.45); r.fxBurst(p, 30, '#ffb347', 14);
      r.fxRing(vx, '#ff9b6a'); r.fxKick(1.0, 0.8, 1.2, 0.03); vv.hitFlash(1); st.cheer(2);
    }
    const fall = (t - 7.5) / 1.25;
    if (t < 8.3) {
      // The final blow.
      av.role = 'pump';
      if (fall > 0.3 && this.once('boom2')) { r.fxBurst(V(vx, 1.4, 0.3), 18, '#ffd27a', 9); r.fxKick(0.45, 0.2, 1.2, 0.012); }
      return { name: 'impact', shot: this.blow(vx, dir, fall, vv, 1.25) };
    }
    if (fall < 1) this.blow(vx, dir, fall, vv, 1.25); else { vv.role = 'down'; if (this.once('thud')) { r.fxRing(vx, '#ffd9a8'); r.fxKick(0.4, 0.05, 0.3); } }
    this.blur = 0;
    if (t < 9.3) {
      av.role = 'pump';
      return { name: 'payoff', shot: { pos: V(mid, 2.6, 11.5), look: V(mid + dir * 0.6, 1.7, 0), fov: 32 } };
    }
    // Last word: from the floor beside the loser, looking up at him.
    av.role = 'talk';
    this.bloom = 0;
    if (t > 9.6 && this.once('relight')) st.setMood('normal');
    const k = (t - 9.3) / 1.3;
    return { name: 'punch', shot: { pos: V(mid + dir * 0.5, 0.5, 4.3 - k * 0.3), look: V(mid - dir * 0.1, 1.25, 0), fov: 40 } };
  }

  private teal(r: Renderer, ax: number, vx: number, dir: number, t: number, av: FighterView, vv: FighterView): Beat {
    const st = r.stageRef();
    const mid = (ax + vx) / 2;
    if (this.objs.set) {
      const clock = this.objs.set.getObjectByName('hand');
      if (clock && t > 3.6) clock.rotation.z = -Math.floor((t - 3.6) * 2) * (Math.PI / 6);
    }
    if (t < 0.6) return this.contact(ax, vx, dir, t, av, vv);
    if (t < 2.0) {
      av.role = 'talk'; vv.role = 'fight';
      if (this.once('dark')) st.setMood('dark');
      return { name: 'title', shot: { pos: V(ax + dir * 2.0, 1.4, 2.7), look: V(ax, 1.55, 0), fov: 34 } };
    }
    if (t < 3.6) {
      if (this.once('set')) {
        st.setMood('normal');
        const s = talkShowSet(); s.position.set(mid, 8, -1.6); this.add(r, 'set', s);
        s.add(label('THE QUESTION', '#ffffff', 0.5).translateY(2.4));
      }
      const k = Math.min(1, (t - 2.0) / 0.5);
      this.objs.set.position.y = 8 * (1 - k) * (1 - k);
      if (k >= 1 && this.once('setLand')) { r.fxKick(0.3, 0.05, 0.3); r.fxRing(mid); }
      return { name: 'prop', shot: { pos: V(mid, 2.4, 9.5), look: V(mid, 1.6, -1), fov: 30 } };
    }
    if (t < 5.6) {
      av.role = 'frozen';
      // Extreme close-up on his face while he says nothing.
      const head = av.bonePos('head');
      const k = (t - 3.6) / 2;
      return { name: 'insert', shot: { pos: V(head.x + dir * 0.7, head.y + 0.15, head.z + 2.1 - k * 0.3), look: V(head.x, head.y + 0.1, head.z), fov: 30 } };
    }
    if (t < 11.4) {
      av.role = 'frozen'; vv.role = 'fight';
      if (this.once('grey')) { st.setMood('grey'); this.sat = 0.12; }
      // A "typing…" bubble that never turns into an answer; it grows as the silence drags on.
      if (!this.objs.dots) this.add(r, 'dots', typingDots());
      const head = av.bonePos('head');
      this.objs.dots.position.set(head.x, head.y + 0.62, head.z);
      (this.objs.dots.userData.tick as (t: number, size: number) => void)(r.now(), 0.55 + (t - 5.6) * 0.075);
      const k = (t - 5.6) / 5.8;
      return { name: 'freeze', shot: { pos: V(mid + Math.sin(k * 1.4) * 1.2, 2.0 + k * 0.6, 8.5 - k * 1.2), look: V(mid, 1.3, 0), fov: 30 } };
    }
    // The silence finally lands: the opponent drops, slowly, seen from the floor; then he shrugs.
    av.role = 'shrug';
    if (this.once('unfreeze')) {
      st.setMood('normal'); this.sat = 1; r.fxKick(0.8, 0.45, 0.9, 0.02); if (this.objs.dots) this.objs.dots.visible = false;
      const p = V(vx, 1.3, 0.3);
      r.fxSpark(p, 3, '#ffffff', 0.3); r.fxBurst(p, 22, '#cfe6ff', 11); r.fxRing(vx, '#cfe6ff'); vv.hitFlash(1); st.cheer(1.5);
    }
    const fall = (t - 11.4) / 1.0;
    if (t < 12.05) return { name: 'impact', shot: this.blow(vx, dir, fall, vv, 0.8) };
    if (fall < 1) this.blow(vx, dir, fall, vv, 0.8); else vv.role = 'down';
    this.blur = 0;
    return { name: 'payoff', shot: { pos: V(mid, 1.9, 8), look: V(mid, 1.1, 0), fov: 30 } };
  }

  dispose(fx: THREE.Object3D) { for (const p of this.props) fx.remove(p); }
}

// ---------- Policy Moves

/**
 * Directs a sidekick's Policy Move. The fight is frozen for the opponent while it plays, so the camera can leave the
 * fight view: a low close-up as the line starts, over the sidekick's shoulder at the frozen opponent, tight on the
 * opponent just before it lands, then the move itself in slow motion and a hard low shot on the hit.
 */
class PolicyCine {
  blur = 0;
  private beat = '';

  constructor(public by: 0 | 1) {}

  direct(r: Renderer, m: Match): { shot: Shot; cut: boolean } {
    const f = m.f[this.by], v = m.f[1 - this.by];
    const def = sigAt(r.defOf(this.by), 3);
    const dir = v.x >= f.x ? 1 : -1;
    const head = r.headOf(this.by, m), vh = r.headOf(1 - this.by, m);
    let b: Beat;
    this.blur = 0;
    if (f.state === 'quote') {
      const t = f.frame / FPS, T = def.quote / FPS;
      if (t < Math.min(1.4, T * 0.35)) {
        b = { name: 'hero', shot: { pos: V(f.x + dir * (1.7 - t * 0.2), 0.8, 2.7 - t * 0.2), look: V(f.x, head.y - 0.12, 0), fov: 34 } };
      } else if (t < T - 1.1) {
        const k = (t - 1.4) / Math.max(0.1, T - 2.5);
        b = { name: 'shoulder', shot: { pos: V(f.x - dir * (1.5 - k * 0.2), 1.95, 3.1), look: V(f.x + (v.x - f.x) * 0.55, 1.25, 0), fov: 40 } };
      } else {
        const k = clamp01((t - (T - 1.1)) / 1.1);
        this.blur = 0.3;
        b = { name: 'target', shot: { pos: V(v.x - dir * 1.7, vh.y - 0.05, 2.8 - k * 0.4), look: V(v.x, vh.y - 0.15, 0), fov: 32 } };
      }
    } else if (def.kind === 'drop') {
      const y = r.stampY(this.by);
      if (f.state === 'sig' && f.af <= def.startup) {
        this.blur = 0.7;
        b = { name: 'drop', shot: { pos: V(v.x - dir * 2.2, 0.35, 4.0), look: V(v.x, 1.0 + Math.min(8, y ?? 0) * 0.1, 0), fov: 56 } };
      } else {
        this.blur = 0.35;
        b = { name: 'impact', shot: { pos: V(v.x - dir * 3.0, 0.7, 5.4), look: V(v.x, 1.0, 0), fov: 40 } };
      }
    } else {
      // Thrown things: ride alongside the one in front, then stay on the opponent as the rest arrive.
      const ps = m.proj.filter((p) => p.owner === this.by && p.sig === 3);
      const lead = ps.sort((a, c) => Math.abs(a.x - v.x) - Math.abs(c.x - v.x))[0];
      if (lead && Math.abs(lead.x - v.x) > 1.6 && this.beat !== 'impact') {
        this.blur = 0.6;
        b = { name: 'track', shot: { pos: V(lead.x - dir * 1.3, 0.6 + lead.y * 0.5, 3.4), look: V(lead.x + dir * 0.9, 0.3 + lead.y * 0.75, 0), fov: 40 } };
      } else if (f.state === 'sig' && f.af <= def.startup && !lead) {
        b = { name: 'windup', shot: { pos: V(f.x + dir * 2.4, 1.2, 3.6), look: V(f.x, 1.35, 0), fov: 36 } };
      } else {
        this.blur = 0.5;
        b = { name: 'impact', shot: { pos: V(v.x - dir * 2.6, 0.7, 4.6), look: V(v.x, 0.95, 0), fov: 40 } };
      }
    }
    const cut = b.name !== this.beat;
    this.beat = b.name;
    return { shot: b.shot, cut };
  }
}

function drawStar() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  c.translate(64, 64); c.fillStyle = '#fff';
  c.beginPath();
  for (let i = 0; i < 16; i++) { const r = i % 2 ? 10 : 62, a = (i / 16) * Math.PI * 2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  c.fill();
  return cv;
}

function drawStreak() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 16;
  const c = cv.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 4, 128, 8);
  return cv;
}

export type { Mood };
