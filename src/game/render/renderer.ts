import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { FighterInfo } from '../data/roster';
import { FPS, INTRO_FRAMES, SUPER_STARTUP } from '../sim/constants';
import { sigAt, sigOf, staging } from '../sim/match';
import type { Ev, Match, Projectile, SimDef } from '../sim/types';
import type { Assets } from './assets';
import { FighterView, hipsRest } from './character';
import {
  adCard, adPanel, announcementScreen, bill, chatPhone, crashArrow, crashScreen, drone, errorCard, exportStamp, gate, gpuCard, label,
  legsSign, meteor, modelProp, moviePoster, octagonCage, page, parcel, postCard, reticle, rocket, sauceBottle, shortChart, sprayDrop,
  strikeMissile, talkShowSet, tickerScreen, typingDots, vrVoid,
} from './props';
import { catSprite, tariffStamp } from './sidekick';
import { Stage, type Mood } from './stage';

/** Signatures and Policy Moves that drop something on the opponent: the prop, its caption and where the caption sits. */
const DROPS: Record<string, { make: () => THREE.Object3D; text: string; color: string; labelY: number }> = {
  losers: { make: gate, text: 'MONOPOLY', color: '#ffd34d', labelY: 3.2 },
  tariff: { make: tariffStamp, text: 'TARIFF EVERYTHING', color: '#ff6b6b', labelY: 2.3 },
  end: { make: meteor, text: 'THE END OF THE WORLD', color: '#ff8a3a', labelY: 2.2 },
  poster: { make: moviePoster, text: 'NOW STREAMING', color: '#f2d27a', labelY: 3.0 },
  occasion: { make: strikeMissile, text: 'ON OCCASION', color: '#ff6b5e', labelY: 3.4 },
  chat: { make: chatPhone, text: 'YOU WERE ADDED', color: '#8fb8ff', labelY: 3.3 },
  export: { make: exportStamp, text: 'FOURTH BEST', color: '#8be04a', labelY: 2.3 },
  octagon: { make: octagonCage, text: 'BOARD MEETING · 9 TO 6', color: '#ff6b6b', labelY: 3.3 },
};

/** Signatures whose hits each throw up a word over the opponent's head: the words, and their colours. */
const WORDS: Record<string, [string[], string[]]> = {
  earnings: [["WE'RE DOING IT!", 'RULE OF 114', '+121% GROWTH'], ['#7dffb5', '#9fc0ff', '#7dffb5']],
  ceomath: [['−9,000%', '+$5 TRILLION'], ['#ff6b6b', '#8be04a']],
  pain: [['PAIN', 'SUFFERING', 'GREATNESS'], ['#ff6b6b', '#ff9b6a', '#c8f56a']],
  energy: [['MASCULINE ENERGY', '+AGGRESSION'], ['#9cc6ff', '#ffd34d']],
};

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
      const gltf = assets[s.info.id];
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
  private part(side: number, name: 'head' | 'chest' | 'hips' | 'rhand', m?: Match) {
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
      case 'sigGo': {
        const v = this.views[e.by], id = sigAt(this.sides[e.by].def, e.sig).id;
        const drop = DROPS[id];
        if (drop) {
          const g = drop.make();
          const f = m.f[e.by];
          g.position.set(f.dropX, 8, -0.2);
          const l = label(drop.text, drop.color, 0.55);
          l.position.set(0, drop.labelY, 0); g.add(l);
          this.fx.add(g);
          this.gates.push({ g, life: 0, land: sigAt(this.sides[e.by].def, e.sig).startup / FPS, x: f.dropX, by: e.by });
        }
        if (id === 'heart') { const p = v.bonePos('chest'); p.z += 0.3; this.spark(p, 0.8, '#ff8f8f', 0.2); }
        if (['ads', 'guarantee', 'dayone', 'occasion', 'poorer', 'ribs'].includes(id) || WORDS[id]) this.startSigFx(e.by, id, m);
        this.kick(0.05, 0, 0.3);
        break;
      }
      case 'throw': {
        const v = this.views[e.by];
        if (sigAt(this.sides[e.by].def, e.sig).id === 'sink') v.carry(null);
        this.kick(0.06);
        break;
      }
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
        else if (id === 'paid') o = parcel();
        else if (id === 'wrong') o = errorCard();
        else if (id === 'gpus') { o = gpuCard(0.8); o.add(label('BUY MORE', '#c8f56a', 0.22).translateY(0.35)); }
        else if (id === 'runads') o = adCard();
        else o = page();
        o.userData.id = id;
        this.fx.add(o); this.projViews.set(p, o);
      }
      o.position.set(p.x, p.y, 0.15);
      if (o.userData.id === 'sink') { o.rotation.z -= dt * 9 * Math.sign(p.vx); }
      else if (o.userData.id === 'cats') { (o as THREE.Sprite).material.rotation += dt * 8 * -Math.sign(p.vx); }
      else if (o.userData.id === 'paid') { o.rotation.z -= dt * 6 * Math.sign(p.vx); o.rotation.y += dt * 2; }
      else if (o.userData.id === 'wrong' || o.userData.id === 'runads') { o.rotation.y = Math.sin(this.t * 9) * 0.5; o.rotation.z -= dt * 10 * Math.sign(p.vx); }
      else if (o.userData.id === 'gpus') { o.rotation.z = Math.sin(this.t * 12) * 0.15; (o.userData.tick as (t: number) => void)(this.t); }
      else { o.rotation.y += dt * 14; o.rotation.z = Math.sin(this.t * 20) * 0.3; }
    }
  }

  // ---------- signature effects that follow the move frame by frame (ad wall, data grab, Day One)

  private sigFx: ({ id: string; g: THREE.Group; parts: THREE.Object3D[]; out: number } | null)[] = [null, null];

  private clearSigFx(by: number) {
    const fx = this.sigFx[by];
    if (fx) { this.fx.remove(fx.g); this.sigFx[by] = null; }
  }

  private startSigFx(by: number, id: string, m: Match) {
    this.clearSigFx(by);
    const g = new THREE.Group(), parts: THREE.Object3D[] = [];
    if (id === 'ads') {
      // Two ad panels come up out of the floor on either side of the opponent and clap shut on them, once per hit.
      ([[-1, 'BUY NOW', '#d0342c'], [1, 'LIMITED TIME', '#2f6fd6']] as const).forEach(([s, t, c]) => {
        const p = adPanel(t, c); p.userData.s = s; g.add(p); parts.push(p);
      });
    } else if (id === 'guarantee') {
      // The opponent's data, pulled out of them and into his hands.
      ['YOUR DATA', 'CONTACTS', 'PURCHASES', 'VOICE CLIPS'].forEach((t, i) => {
        const l = label(t, i % 2 ? '#9fd6ff' : '#ffd27a', 0.28); l.userData.i = i; g.add(l); parts.push(l);
      });
    } else if (id === 'dayone') {
      const l = label('DAY 1', '#ffd34d', 0.9); g.add(l); parts.push(l);
    } else if (id === 'occasion') {
      // The target is painted on the floor under the opponent while the strike comes down.
      const r = reticle('TARGET ACQUIRED'); g.add(r); parts.push(r);
    } else if (id === 'poorer') {
      // The short sellers' position, on a trading screen behind the opponent; it crashes with each hit.
      const c = shortChart(); g.add(c); parts.push(c);
    } else if (WORDS[id]) {
      // Each hit of the flurry throws up a word: the earnings call, Jensen's wrong numbers, the blessing, the energy.
      const [ws, cs] = WORDS[id];
      ws.forEach((t, i) => {
        // Long words come out smaller so they stay over the opponent.
        const l = label(t, cs[i], 0.42 * Math.min(1, 11 / t.length)); l.userData.i = i; l.visible = false; g.add(l); parts.push(l);
      });
    } else if (id === 'ribs') {
      // The sauce bottle in his hand for the sweep, and the verdict over the opponent.
      const b = sauceBottle(); g.add(b); parts.push(b);
      const l = label('ON THE RIBS', '#ff9b6a', 0.5); l.visible = false; g.add(l); parts.push(l);
    }
    void m;
    this.fx.add(g);
    this.sigFx[by] = { id, g, parts, out: 0 };
  }

  private updateSigFx(m: Match, dt: number) {
    for (const by of [0, 1] as const) {
      const fx = this.sigFx[by];
      if (!fx) continue;
      const f = m.f[by], o = m.f[1 - by];
      const sg = sigAt(this.sides[by].def, f.sig);
      const live = f.state === 'sig' && sg.id === fx.id;
      if (!live) fx.out += dt;
      if (fx.out > 0.5) { this.clearSigFx(by); continue; }
      const af = live ? f.af : sg.startup + sg.active;
      const n = sg.hits ?? 1, per = sg.active / n;
      if (fx.id === 'ads') {
        fx.g.position.set(o.x, Math.min(0, -2.2 * (1 - clamp01(af / sg.startup))) - fx.out * 6, -0.55);
        const local = af <= sg.startup ? 0 : ((af - sg.startup - 1) % per) / per;
        const gap = af <= sg.startup ? 1.7 : 0.5 + 0.9 * Math.sin(Math.PI * local);
        for (const p of fx.parts) {
          const s = p.userData.s as number;
          p.position.x = s * gap;
          p.rotation.y = -s * 0.35;
        }
      } else if (fx.id === 'guarantee') {
        const from = this.part(1 - by, 'chest', m), to = this.part(by, 'rhand', m);
        for (const p of fx.parts) {
          const i = p.userData.i as number;
          const k = clamp01((af - sg.startup - i * 4) / 16);
          p.visible = k > 0 && k < 1;
          p.position.lerpVectors(from, to, k);
          p.position.y += Math.sin(Math.PI * k) * (0.6 + i * 0.15);
          p.position.z += 0.4;
          (p as THREE.Sprite).material.opacity = 1 - fx.out * 2;
        }
      } else if (fx.id === 'dayone') {
        const h = this.part(by, 'head', m);
        const l = fx.parts[0] as THREE.Sprite;
        const k = clamp01(af / (sg.startup + sg.active + 6));
        l.position.set(h.x, h.y + 0.6 + k * 0.5, h.z + 0.2);
        l.material.opacity = 1 - fx.out * 2;
      } else if (fx.id === 'occasion') {
        const r = fx.parts[0];
        r.position.set(f.dropX, 0, 0);
        (r.userData.tick as (k: number, t: number) => void)(af / Math.max(1, sg.startup), this.t);
        r.visible = fx.out < 0.15;
      } else if (fx.id === 'poorer') {
        const c = fx.parts[0], away = o.x >= f.x ? 1 : -1;
        const rise = clamp01(af / sg.startup);
        c.position.set(o.x + away * 1.2, -2.6 * (1 - rise) * (1 - rise) - fx.out * 6, -1.1);
        c.rotation.y = -away * 0.35;
        (c.userData.tick as (k: number) => void)(clamp01((af - sg.startup) / sg.active));
      } else if (WORDS[fx.id]) {
        const h = this.part(1 - by, 'head', m);
        for (const p of fx.parts) {
          const i = p.userData.i as number, age = af - sg.startup - i * per;
          const l = p as THREE.Sprite;
          l.visible = age >= 0 && age < 26;
          const k = clamp01(age / 26);
          l.position.set(h.x + (i - (fx.parts.length - 1) / 2) * 0.55, h.y + 0.55 + k * 0.7, h.z + 0.3);
          l.material.opacity = Math.min(1, (1 - k) * 2) * (1 - fx.out * 2);
        }
      } else if (fx.id === 'ribs') {
        const [b, l] = fx.parts as [THREE.Object3D, THREE.Sprite];
        b.position.copy(this.part(by, 'rhand', m)); b.rotation.z = -f.facing * (0.6 + clamp01(af / sg.startup) * 1.4);
        b.visible = fx.out < 0.2;
        const age = af - sg.startup, h = this.part(1 - by, 'head', m);
        l.visible = age >= 0 && age < 34;
        const k = clamp01(age / 34);
        l.position.set(h.x, h.y + 0.5 + k * 0.6, h.z + 0.3);
        l.material.opacity = Math.min(1, (1 - k) * 2) * (1 - fx.out * 2);
      }
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
    // The title screen shows the empty hearing room; the fighters walk on at the select screen.
    const empty = this.attract && this.lobby === 'title';
    this.views.forEach((v) => { v.root.visible = !empty; });
    if (empty) this.sk.forEach((s) => { s.root.visible = false; });
    // The chainsaw lands in his hand: a flash and a jolt.
    for (const v of this.views) {
      if (!v.caughtAt) continue;
      this.spark(v.caughtAt, 1.6, '#fff4d0', 0.25);
      this.burst(v.caughtAt, 14, '#ffd27a', 5);
      this.kick(0.12, 0.06, 0.4);
      v.caughtAt = null;
    }
    this.updateProjectiles(m, dt);
    this.updateSigFx(m, dt);

    for (let i = this.gates.length - 1; i >= 0; i--) {
      const g = this.gates[i];
      g.life += dt;
      const k = Math.min(1, g.life / g.land);
      g.g.position.y = 8 * (1 - k * k);
      if (k >= 1 && !g.g.userData.landed) {
        g.g.userData.landed = true;
        const fire = g.g.getObjectByName('fire'); if (fire) fire.visible = false;
        (g.g.userData.flip as (() => void) | undefined)?.();
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
    // A signature or a Policy Move being staged (the opponent is frozen for it).
    const polBy = fighting && flashBy < 0 ? ([0, 1] as const).findIndex((i) => staging(m, i)) : -1;
    if (polBy >= 0 && (this.policy?.by !== polBy || this.policy.sig !== m.f[polBy].sig)) {
      this.policy = new PolicyCine(polBy as 0 | 1, m.f[polBy].sig);
      if (m.f[polBy].sig === 3) this.stage.setMood('gold');
    }
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
    const tint = cine?.tint ?? WHITE;
    (u.uTint.value as THREE.Color).lerp(tint, Math.min(1, dt * 4));
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

  /**
   * Screen rectangle (0..1, y down) around a head and its hair, from any camera angle; null if it's off screen or
   * behind the camera. Speech bubbles are kept out of these so a face is never covered.
   */
  headRect(side: 0 | 1, m?: Match, who?: 'boss' | 'sk') {
    const sk = who ? who === 'sk' : !!m && m.f[side].tag > 0;
    const v = sk ? this.sk[side] : this.views[side];
    const c = v.bonePos('head');
    const s = v.info.height;
    let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
    const p = new THREE.Vector3();
    for (let k = 0; k < 8; k++) {
      p.set(c.x + (k & 1 ? 0.26 : -0.26) * s, c.y + (k & 2 ? 0.42 : -0.14) * s, c.z + (k & 4 ? 0.26 : -0.26) * s).project(this.cam);
      if (p.z > 1) return null;
      const sx = (p.x + 1) / 2, sy = (1 - p.y) / 2;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    if (x1 < 0 || x0 > 1 || y1 < 0 || y0 > 1) return null;
    return { x0, x1, y0, y1 };
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
const WHITE = new THREE.Color(1, 1, 1);
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
  /** Colour grade over the whole frame while the Super plays (null = none). */
  tint: THREE.Color | null = null;
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
    const script = { tusk: this.tusk, teal: this.teal, bozo: this.bozo, ultman: this.ultman, carp: this.carp, jensen: this.jensen, mork: this.mork }[id];
    const b = script.call(this, r, atk.x, vic.x, dir, this.t, av, vv);
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

  /**
   * Things that rain on the opponent (Bozo's boxes, Ultman's money): `n` of them, falling from `t0` on, staggered over
   * `spread` seconds, landing in a heap around `vx` (boxes) or fluttering down and looping (bills).
   */
  private rain(r: Renderer, name: string, n: number, make: (i: number) => THREE.Object3D) {
    if (this.objs[name]) return this.objs[name] as THREE.Group;
    const g = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const o = make(i);
      const h = Math.sin(i * 78.233) * 43758.5453;
      o.userData.rx = (h - Math.floor(h)) * 2 - 1;
      o.userData.rz = Math.sin(i * 3.7) ;
      o.userData.d = (i / n);
      g.add(o);
    }
    return this.add(r, name, g) as THREE.Group;
  }

  private bozo(r: Renderer, ax: number, vx: number, dir: number, t: number, av: FighterView, vv: FighterView): Beat {
    const st = r.stageRef();
    const mid = (ax + vx) / 2;
    if (t < 0.6) return this.contact(ax, vx, dir, t, av, vv);
    // The box rain: parcels drop on the opponent from 3.8 s and pile up round them until the end.
    if (t > 3.8) {
      const boxes = this.rain(r, 'boxes', 16, (i) => parcel(i % 3 ? 'BEST DAY EVER' : 'YOU PAID FOR THIS', 0.5 + (i % 4) * 0.08));
      const slow = t > 5.2 && t < 7.0 ? 0.35 : 1;
      boxes.children.forEach((o, i) => {
        const start = 3.8 + o.userData.d * 3.0;
        const k = clamp01(((t - start) * slow) / 0.9);
        const land = 0.25 + (i % 3) * 0.42;
        o.visible = t > start;
        // On and behind the opponent, never between the two of them (the close-ups look across that gap).
        o.position.set(vx + dir * (0.15 + (o.userData.rx + 1) * 0.6), land + (9 - land) * (1 - k) * (1 - k), o.userData.rz * 0.7);
        o.rotation.set(o.userData.rz * (1 - k) * 2, i * 0.7, o.userData.rx * 0.4 * (1 - k));
        if (k >= 1 && !o.userData.landed) { o.userData.landed = true; r.fxKick(0.08); }
      });
    }
    if (t < 2.4) {
      // He laughs. A low hero close-up that drifts in.
      av.role = 'talk'; vv.role = 'fight';
      if (this.once('dark')) st.setMood('dark');
      const k = (t - 0.6) / 1.8, head = av.bonePos('head');
      return { name: 'title', shot: { pos: V(ax + dir * (2.2 - k * 0.6), 0.8 + k * 0.1, 2.7 - k * 0.2), look: V(ax, head.y - 0.1, 0), fov: 34 } };
    }
    if (this.once('rocket')) {
      st.setMood('normal');
      const rk = rocket('BEST DAY EVER'); rk.scale.setScalar(0.55); this.add(r, 'rocket', rk);
      this.bloom = 0.3;
    }
    const rk = this.objs.rocket;
    const sx = ax - dir * 2.2;
    if (t < 4.6) {
      // Lift-off behind him, still laughing, seen from the floor; then wide as the first boxes come down.
      av.role = 'pump'; vv.role = 'fight';
      // On the pad for a beat, then up.
      const lift = Math.max(0, t - 2.8);
      const y = 1.25 + lift * lift * 6;
      rk.position.set(sx, y, -1.5); rk.rotation.z = 0;
      const flame = rk.getObjectByName('flame'); if (flame) flame.visible = t > 2.65;
      if (t > 2.65 && this.once('rumble')) r.fxKick(0.35, 0.1, 0.6);
      if (t < 3.7) return { name: 'launch', shot: { pos: V(THREE.MathUtils.clamp(sx - dir * 2.2, -3.6, 3.6), 0.7, 6.2), look: V(sx, 1.6 + (y - 1.25) * 0.85, -1.5), fov: 40 } };
      return { name: 'prop', shot: { pos: V(mid, 2.6, 10.5), look: V(mid, 2.4, 0), fov: 34 } };
    }
    if (t < 5.2) {
      // Insert: a box comes down past the lens.
      vv.role = 'reel'; vv.roleSpeed = 0.5;
      const k = (t - 4.6) / 0.6;
      return { name: 'insert', shot: { pos: V(vx - dir * 1.1, 2.6 - k * 1.2, 2.6), look: V(vx, 1.4 - k * 0.5, 0), fov: 44 } };
    }
    if (t < 7.0) {
      // Slow motion: the boxes keep coming and the capsule comes back down on them.
      av.role = 'pump'; vv.role = 'reel'; vv.roleSpeed = 0.22;
      this.blur = 0.45;
      const k = (t - 5.2) / 1.8;
      rk.rotation.z = Math.PI;
      rk.position.set(vx, 9 - Math.pow(k, 1.7) * 8.2, 0);
      if (t < 6.3) return { name: 'rain', shot: { pos: V(vx - dir * 2.8, 0.5, 4.4), look: V(vx, 1.6, 0), fov: 46 } };
      const head = vv.bonePos('head');
      this.sat = 0.6;
      return { name: 'lookup', shot: { pos: V(vx + dir * 1.3, 0.3, 3.4), look: V(head.x, 2.2, 0), fov: 56 } };
    }
    rk.visible = false;
    this.sat = 1;
    if (this.once('boom')) {
      const p = V(vx, 0.8, 0.3);
      r.fxSpark(p, 5, '#ffffff', 0.3); r.fxSpark(p, 3.5, '#ffb347', 0.45); r.fxBurst(p, 30, '#ffd27a', 14);
      r.fxRing(vx, '#ffb347'); r.fxKick(1.0, 0.8, 1.2, 0.03); vv.hitFlash(1); st.cheer(2);
    }
    const fall = (t - 7.0) / 1.2;
    if (t < 7.8) { av.role = 'pump'; return { name: 'impact', shot: this.blow(vx, dir, fall, vv, 1.1) }; }
    if (fall < 1) this.blow(vx, dir, fall, vv, 1.1); else { vv.role = 'down'; if (this.once('thud')) { r.fxRing(vx, '#ffd9a8'); r.fxKick(0.4, 0.05, 0.3); } }
    this.blur = 0;
    if (t < 9.0) {
      // "Best day ever!": tight on him as he says it.
      av.role = 'pump';
      const head = av.bonePos('head');
      return { name: 'cheer', shot: { pos: V(head.x + dir * 0.7, head.y - 0.08, 2.5), look: V(head.x, head.y - 0.04, 0), fov: 32 } };
    }
    av.role = 'talk';
    this.bloom = 0;
    if (t > 9.2 && this.once('relight')) st.setMood('normal');
    return { name: 'payoff', shot: { pos: V(mid, 2.4, 10.5), look: V(mid, 1.4, 0), fov: 32 } };
  }

  private ultman(r: Renderer, ax: number, vx: number, dir: number, t: number, av: FighterView, vv: FighterView): Beat {
    const st = r.stageRef();
    const mid = (ax + vx) / 2;
    if (t < 0.6) return this.contact(ax, vx, dir, t, av, vv);
    if (this.objs.screen) (this.objs.screen.userData.tick as (k: number) => void)(clamp01((t - 3.0) / 7.0));
    // The money rain: bills flutter down on the opponent through the whole speech, looping.
    if (t > 3.6 && t < 12.4) {
      const bills = this.rain(r, 'bills', 46, () => bill());
      bills.children.forEach((o, i) => {
        const cyc = ((t - 3.6) * 0.45 + o.userData.d) % 1;
        o.visible = t < 11.6 || cyc > 0.5;
        o.position.set(vx + o.userData.rx * 1.6 + Math.sin(t * 2 + i) * 0.2, 6.5 * (1 - cyc), o.userData.rz * 0.9);
        o.rotation.set(Math.sin(t * 3 + i) * 1.2, t * 1.5 + i, Math.cos(t * 2.5 + i) * 0.8);
      });
    } else if (this.objs.bills) this.objs.bills.visible = false;
    if (t < 2.4) {
      // At the podium: a low close-up while the line starts.
      av.role = 'talk'; vv.role = 'fight';
      if (this.once('dark')) st.setMood('dark');
      const k = (t - 0.6) / 1.8, head = av.bonePos('head');
      return { name: 'title', shot: { pos: V(ax + dir * (2.0 - k * 0.5), 1.2, 2.7), look: V(ax, head.y - 0.08, 0), fov: 34 } };
    }
    if (t < 3.6) {
      if (this.once('screen')) {
        st.setMood('normal');
        const s = announcementScreen(); s.position.set(mid, 9, -2.8); this.add(r, 'screen', s);
      }
      const k = Math.min(1, (t - 2.4) / 0.5);
      this.objs.screen.position.y = 3.3 + (9 - 3.3) * (1 - k) * (1 - k);
      if (k >= 1 && this.once('screenLand')) { r.fxKick(0.3, 0.05, 0.4); st.cheer(1); }
      return { name: 'prop', shot: { pos: V(mid, 2.4, 10), look: V(mid, 2.2, -1), fov: 32 } };
    }
    if (t < 7.6) {
      // The speech goes on: over his shoulder at the screen, the numbers climbing and the money coming down.
      av.role = 'talk'; vv.role = 'reel'; vv.roleSpeed = 0.35;
      const k = (t - 3.6) / 4;
      if (t < 5.6) return { name: 'insert', shot: { pos: V(ax - dir * (1.2 - k * 0.3), 1.9, 3.2), look: V(mid + dir * 0.4, 2.6, -2.8), fov: 40 } };
      return { name: 'buried', shot: { pos: V(vx + Math.sin(k * 2) * 1.2, 1.3, 4.4 - k * 0.6), look: V(vx, 1.4, 0), fov: 38 } };
    }
    if (t < 10.3) {
      // "Is he still talking?" A slow wide drift: him still going, the opponent under a pile of money.
      av.role = 'talk'; vv.role = 'reel'; vv.roleSpeed = 0.25;
      if (this.once('grey')) this.sat = 0.7;
      const k = (t - 7.6) / 2.7;
      return { name: 'drift', shot: { pos: V(mid + Math.sin(k * 1.4) * 1.4, 2.2 + k * 0.5, 8.6 - k * 1.2), look: V(mid, 1.5, 0), fov: 30 } };
    }
    if (t < 11.6) {
      // "We couldn't do this without you, Mr. President." Tight on his face.
      av.role = 'shrug'; vv.role = 'reel';
      this.sat = 1;
      const head = av.bonePos('head'), k = (t - 10.3) / 1.3;
      return { name: 'thanks', shot: { pos: V(head.x + dir * 0.75, head.y + 0.12, head.z + 2.2 - k * 0.35), look: V(head.x, head.y + 0.06, head.z), fov: 30 } };
    }
    av.role = 'pump';
    if (this.once('payday')) {
      r.fxKick(0.8, 0.5, 1.0, 0.02);
      const p = V(vx, 1.3, 0.3);
      r.fxSpark(p, 3, '#ffffff', 0.3); r.fxBurst(p, 26, '#9ff0cf', 12); r.fxRing(vx, '#9ff0cf'); vv.hitFlash(1); st.cheer(1.6);
    }
    const fall = (t - 11.6) / 1.0;
    if (t < 12.3) return { name: 'impact', shot: this.blow(vx, dir, fall, vv, 0.9) };
    if (fall < 1) this.blow(vx, dir, fall, vv, 0.9); else vv.role = 'down';
    this.blur = 0;
    return { name: 'payoff', shot: { pos: V(mid, 2.3, 9.5), look: V(mid, 1.4, -0.5), fov: 32 } };
  }

  /**
   * LOWER PURPOSE. His "higher purpose / lower purpose" line over a close-up while a surveillance drone rises behind
   * him; it hovers over his head for "getting a drone", shows its tank for "fentanyl-laced", flies over the opponent and
   * paints them ANALYST, then sprays them through "spraying on analysts who tried to screw us" (the health drains), and
   * they go down. "So that's my lower purpose": tight on him with the drone over his shoulder.
   */
  private carp(r: Renderer, ax: number, vx: number, dir: number, t: number, av: FighterView, vv: FighterView): Beat {
    const st = r.stageRef();
    const mid = (ax + vx) / 2;
    if (t < 0.6) return this.contact(ax, vx, dir, t, av, vv);
    // The drone: rises behind him from 3.4 s, hovers over him, then flies to the opponent and holds over them.
    if (t > 3.4 && !this.objs.drone) { const d = drone(); d.scale.setScalar(0.9); this.add(r, 'drone', d); }
    const dr = this.objs.drone;
    const home = V(ax - dir * 0.45, 3.0, -0.5), over = V(vx, 2.75, 0.1);
    if (dr) {
      (dr.userData.tick as (t: number) => void)(r.now());
      const bob = Math.sin(r.now() * 3) * 0.06;
      if (t < 5.1) {
        const k = clamp01((t - 3.4) / 1.7), e = 1 - Math.pow(1 - k, 3);
        dr.position.set(ax - dir * (1.4 - e * 0.95), -0.4 + e * 3.4 + bob, -1.4 + e * 0.9);
        dr.rotation.set(0, 0, 0);
      } else if (t < 9.0) {
        dr.position.copy(home).setY(home.y + bob); dr.rotation.set(0, 0, 0);
      } else {
        const k = clamp01((t - 9.0) / 1.2), e = k * k * (3 - 2 * k);
        dr.position.lerpVectors(home, over, e); dr.position.y += Math.sin(Math.PI * e) * 0.5 + bob;
        if (t > 13.4) dr.position.y += (t - 13.4) * 0.6;
        dr.rotation.set(0, 0, -dir * Math.sin(Math.PI * e) * 0.35);
      }
    }
    // The reticle on the opponent, from the lock-on until they go down.
    if (t > 9.2 && t < 13.4) {
      if (!this.objs.lock) { this.add(r, 'lock', reticle('ANALYST')); r.fxKick(0.15, 0.05, 0.4); }
      this.objs.lock.visible = true;
      this.objs.lock.position.set(vx, 0, 0);
      (this.objs.lock.userData.tick as (k: number, t: number) => void)((t - 9.2) / 0.6, r.now());
    } else if (this.objs.lock) this.objs.lock.visible = false;
    // The spray: a stream of droplets from the nozzle to the opponent, with a splash where it hits.
    const spraying = t > 10.7 && t < 13.3;
    if (spraying && dr) {
      if (!this.objs.spray) {
        const g = new THREE.Group();
        for (let i = 0; i < 70; i++) { const d = sprayDrop(); d.userData.d = i / 70; d.userData.j = Math.sin(i * 12.9898) * 43758.5453 % 1; g.add(d); }
        this.add(r, 'spray', g);
      }
      const from = (dr.userData.nozzle as THREE.Object3D).getWorldPosition(new THREE.Vector3());
      const to = vv.bonePos('head').add(V(0, -0.15, 0.1));
      this.objs.spray.visible = true;
      this.objs.spray.children.forEach((o, i) => {
        const p = ((t - 10.7) * 2.6 + o.userData.d) % 1;
        const j = o.userData.j as number;
        o.position.lerpVectors(from, to, p);
        o.position.x += Math.sin(i * 7.1 + t * 9) * 0.07 * p; o.position.z += Math.cos(i * 3.3 + t * 7) * 0.08 * p;
        o.position.y -= Math.sin(Math.PI * p) * 0.12 + j * 0.05;
        o.scale.setScalar(0.07 + p * 0.09);
      });
      if (this.once(`splash${Math.floor(t * 7)}`)) { r.fxBurst(to, 5, '#ffd83a', 4); r.fxKick(0.06); vv.hitFlash(0.4); }
    } else if (this.objs.spray) this.objs.spray.visible = false;

    if (t < 2.4) {
      // "You need a higher purpose": a low hero close-up, drifting in.
      av.role = 'talk'; vv.role = 'fight';
      if (this.once('dark')) st.setMood('dark');
      const k = (t - 0.6) / 1.8, head = av.bonePos('head');
      return { name: 'title', shot: { pos: V(ax + dir * (2.2 - k * 0.6), 0.85 + k * 0.1, 2.8 - k * 0.2), look: V(ax, head.y - 0.1, 0), fov: 34 } };
    }
    if (t < 3.4) {
      // "…and I also think you often need a lower purpose." Over his shoulder at the opponent.
      av.role = 'talk'; vv.role = 'fight';
      const k = t - 2.4;
      return { name: 'shoulder', shot: { pos: V(ax - dir * (1.6 - k * 0.2), 1.9, 3.2), look: V(mid + dir * 0.4, 1.4, 0), fov: 38 } };
    }
    if (t < 5.1) {
      // The drone comes up out of the dark behind him; seen from the floor in front of him.
      av.role = 'talk'; vv.role = 'fight';
      if (this.once('hum')) { r.fxKick(0.2, 0.05, 0.5); this.bloom = 0.2; }
      const k = (t - 3.4) / 1.7;
      return { name: 'prop', shot: { pos: V(ax + dir * 2.4, 0.55, 4.2 - k * 0.4), look: V(ax - dir * 0.3, 1.5 + k * 1.0, -0.6), fov: 42 } };
    }
    if (t < 7.6) {
      // "Well, I love the idea of getting a drone": low and close, the drone hanging over his head.
      av.role = 'talk'; vv.role = 'fight';
      const k = (t - 5.1) / 2.5, head = av.bonePos('head');
      return { name: 'hover', shot: { pos: V(ax + dir * (1.9 - k * 0.3), 0.7, 3.3), look: V(ax, head.y + 0.55 + k * 0.2, -0.3), fov: 40 } };
    }
    if (t < 9.0) {
      // "…fentanyl-laced": insert on the tank's label.
      av.role = 'talk'; vv.role = 'fight';
      const k = (t - 7.6) / 1.4;
      const p = dr ? dr.position.clone() : home;
      return { name: 'insert', shot: { pos: V(p.x + dir * 0.25, p.y - 0.3, p.z + 1.6 - k * 0.3), look: V(p.x, p.y - 0.25, p.z), fov: 30 } };
    }
    if (t < 10.7) {
      // It flies over the opponent and locks on.
      av.role = 'pump'; vv.role = t > 9.5 ? 'reel' : 'fight'; vv.roleSpeed = 0.5;
      if (this.once('red')) st.setMood('red');
      if (t < 9.9) return { name: 'fly', shot: { pos: V(mid, 1.6, 7.2), look: V(mid + dir * 0.6, 2.1, 0), fov: 34 } };
      return { name: 'lookup', shot: { pos: V(vx + dir * 1.3, 0.35, 3.3), look: V(vx - dir * 0.1, 2.3, 0), fov: 52 } };
    }
    if (t < 13.3) {
      // "…spraying on analysts who tried to screw us." Slow motion, the frame gone yellow.
      av.role = 'pump'; vv.role = 'reel'; vv.roleSpeed = 0.3;
      this.tint = YELLOW; this.blur = 0.35;
      if (this.once('sprayStart')) { r.fxKick(0.3, 0.15, 0.6); st.cheer(1.4); }
      if (t < 11.9) return { name: 'spray', shot: { pos: V(vx - dir * 3.0, 1.1, 5.0), look: V(vx, 1.8, 0), fov: 40 } };
      const head = vv.bonePos('head'), k = (t - 11.9) / 1.4;
      return { name: 'face', shot: { pos: V(head.x - dir * 0.7, head.y + 0.15, 2.2 - k * 0.3), look: V(head.x, head.y + 0.05, 0), fov: 32 } };
    }
    this.tint = null;
    if (this.once('boom')) {
      st.setMood('normal');
      const p = V(vx, 1.2, 0.3);
      r.fxSpark(p, 4, '#ffffff', 0.3); r.fxBurst(p, 28, '#ffd83a', 12); r.fxRing(vx, '#ffd83a'); r.fxKick(0.9, 0.5, 1.0, 0.02);
      vv.hitFlash(1); st.cheer(2);
    }
    const fall = (t - 13.3) / 1.1;
    if (t < 14.2) { av.role = 'pump'; return { name: 'impact', shot: this.blow(vx, dir, fall, vv, 0.9) }; }
    if (fall < 1) this.blow(vx, dir, fall, vv, 0.9); else vv.role = 'down';
    this.blur = 0;
    // "So that's my lower purpose." Tight on him, the drone drifting up over his shoulder.
    av.role = 'shrug';
    this.bloom = 0;
    const head = av.bonePos('head'), k = (t - 14.2) / 1.8;
    return { name: 'payoff', shot: { pos: V(head.x + dir * (1.1 + k * 0.6), head.y + 0.1, 2.6 + k * 1.2), look: V(head.x - dir * 0.2, head.y + 0.1, 0), fov: 34 } };
  }

  /**
   * TRILLION-DOLLAR AFFAIR. "This is like common sense": a market screen drops in behind them and climbs while GPUs
   * rain on the opponent ("the more GPUs you buy, the more money you save"). Then the news breaks on the ticker, the
   * chart turns and crashes, and its last leg, a giant red arrow, comes down on the opponent. "I wish upon you plenty of
   * pain and suffering": tight on him, the jacket, the shrug.
   */
  private jensen(r: Renderer, ax: number, vx: number, dir: number, t: number, av: FighterView, vv: FighterView): Beat {
    const st = r.stageRef();
    const mid = (ax + vx) / 2;
    if (t < 0.6) return this.contact(ax, vx, dir, t, av, vv);
    const scr = this.objs.screen;
    if (scr) {
      const k = t < 10.2 ? clamp01((t - 2.6) / 5.4) * 0.5 : 0.5 + clamp01((t - 10.2) / 1.6) * 0.5;
      (scr.userData.tick as (k: number, t: number) => void)(k, Math.max(0, t - 8.2));
    }
    // The GPU rain, through the pitch.
    if (t > 3.0 && t < 8.6) {
      const gpus = this.rain(r, 'gpus', 34, () => gpuCard(0.9));
      gpus.children.forEach((o, i) => {
        const cyc = ((t - 3.0) * 0.5 + o.userData.d) % 1;
        o.visible = t < 7.6 || cyc > 0.5;
        o.position.set(vx + o.userData.rx * 1.5 + Math.sin(t * 2 + i) * 0.15, 6.5 * (1 - cyc), o.userData.rz * 0.8);
        o.rotation.set(Math.sin(t * 3 + i) * 1.1, t * 1.4 + i, Math.cos(t * 2.2 + i) * 0.9);
        (o.userData.tick as (t: number) => void)(r.now());
      });
    } else if (this.objs.gpus) this.objs.gpus.visible = false;
    // The arrow: falls from 10.2 s and lands on the opponent at 11.8 s.
    if (t > 10.2 && !this.objs.arrow) { const a = crashArrow(); this.add(r, 'arrow', a); }
    const arrow = this.objs.arrow;
    if (arrow) {
      const k = clamp01((t - 10.2) / 1.6);
      arrow.position.set(vx, 9 * (1 - k) * (1 - k), 0.1);
      if (t > 12.6) arrow.position.y = -((t - 12.6) ** 2) * 6;
    }

    if (t < 2.6) {
      av.role = 'talk'; vv.role = 'fight';
      if (this.once('dark')) st.setMood('dark');
      const k = (t - 0.6) / 2.0, head = av.bonePos('head');
      return { name: 'title', shot: { pos: V(ax + dir * (2.1 - k * 0.5), 0.9 + k * 0.1, 2.8 - k * 0.2), look: V(ax, head.y - 0.1, 0), fov: 34 } };
    }
    if (t < 3.6) {
      if (this.once('screen')) {
        st.setMood('normal');
        const s = crashScreen(); s.position.set(mid, 9, -2.8); this.add(r, 'screen', s);
      }
      const k = Math.min(1, (t - 2.6) / 0.5);
      this.objs.screen.position.y = 3.4 + (9 - 3.4) * (1 - k) * (1 - k);
      if (k >= 1 && this.once('screenLand')) { r.fxKick(0.3, 0.05, 0.4); st.cheer(1); }
      av.role = 'talk'; vv.role = 'fight';
      return { name: 'prop', shot: { pos: V(mid, 2.4, 10), look: V(mid, 2.3, -1), fov: 32 } };
    }
    if (t < 8.2) {
      // The pitch: over his shoulder at the climbing chart, then the opponent under the GPUs.
      av.role = 'talk'; vv.role = 'reel'; vv.roleSpeed = 0.35;
      const k = (t - 3.6) / 4.6;
      if (t < 5.6) return { name: 'insert', shot: { pos: V(ax - dir * (1.2 - k * 0.3), 1.9, 3.2), look: V(mid + dir * 0.4, 2.7, -2.8), fov: 40 } };
      return { name: 'buried', shot: { pos: V(vx + Math.sin(k * 2) * 1.2, 1.3, 4.4 - k * 0.6), look: V(vx, 1.4, 0), fov: 38 } };
    }
    if (t < 10.2) {
      // The news breaks. Tight on the ticker, then the opponent looking up at it.
      if (this.once('news')) { scr.userData.news = true; st.setMood('red'); r.fxKick(0.25, 0.2, 0.5); }
      av.role = 'shrug'; vv.role = 'reel'; vv.roleSpeed = 0.3;
      if (t < 9.3) return { name: 'news', shot: { pos: V(mid, 3.0, 4.6), look: V(mid, 3.1, -2.8), fov: 40 } };
      return { name: 'lookup', shot: { pos: V(vx + dir * 1.3, 0.35, 3.3), look: V(vx - dir * 0.1, 2.4, 0), fov: 52 } };
    }
    if (t < 12.0) {
      // The crash: slow motion, the arrow coming down, the frame drained of colour.
      av.role = 'shrug'; vv.role = 'reel'; vv.roleSpeed = 0.25;
      this.sat = 0.45; this.blur = 0.4;
      if (t > 11.8 && this.once('land')) { r.fxKick(0.5, 0.2, 0.6); r.fxRing(vx, '#ff4a3d'); }
      if (t < 11.0) return { name: 'crash', shot: { pos: V(mid, 2.0, 7.8), look: V(mid, 2.4, -0.5), fov: 36 } };
      return { name: 'under', shot: { pos: V(vx - dir * 2.0, 0.4, 3.6), look: V(vx, 2.0, 0), fov: 50 } };
    }
    this.sat = 1;
    if (this.once('boom')) {
      st.setMood('normal');
      const p = V(vx, 1.2, 0.3);
      r.fxSpark(p, 4, '#ffffff', 0.3); r.fxBurst(p, 28, '#ff4a3d', 12); r.fxRing(vx, '#ff4a3d'); r.fxKick(0.9, 0.5, 1.0, 0.02);
      vv.hitFlash(1); st.cheer(2);
    }
    const fall = (t - 12.0) / 1.0;
    if (t < 13.0) { av.role = 'pump'; return { name: 'impact', shot: this.blow(vx, dir, fall, vv, 0.9) }; }
    if (fall < 1) this.blow(vx, dir, fall, vv, 0.9); else vv.role = 'down';
    this.blur = 0;
    // "I wish upon you plenty of pain and suffering." Tight on him, the ticker still running behind.
    av.role = 'shrug';
    const head = av.bonePos('head'), k = (t - 13.0) / 2.6;
    return { name: 'payoff', shot: { pos: V(head.x + dir * (1.1 + k * 0.6), head.y + 0.1, 2.6 + k * 1.2), look: V(head.x - dir * 0.2, head.y + 0.1, 0), fov: 34 } };
  }

  /** Puts the victim's legs back, and the room (Metaverse Exile hides both). */
  private restore: (() => void) | null = null;
  private unroom: (() => void) | null = null;

  /**
   * METAVERSE EXILE. "One more feature coming soon…": the room drops away into a low-poly VR void, a neon grid and a
   * wire dome. The opponent is an avatar now, floating with no legs. "…the most requested feature on our roadmap. Legs."
   * A sign floats in: LEGS · COMING SOON. "Legs! I know you've been waiting for this.": he throws them out of the void,
   * spinning, and they land back in the hearing room. "But seriously, legs are hard": tight on him, deadpan.
   */
  private mork(r: Renderer, ax: number, vx: number, dir: number, t: number, av: FighterView, vv: FighterView): Beat {
    const st = r.stageRef();
    const mid = (ax + vx) / 2;
    if (t < 0.6) return this.contact(ax, vx, dir, t, av, vv);
    const inVoid = t > 2.8 && t < 11.6;
    if (inVoid && !this.objs.void) { this.add(r, 'void', vrVoid()); r.fxKick(0.3, 0.6, 0.8, 0.015); }
    if (this.objs.void) {
      this.objs.void.visible = inVoid;
      st.setRoom(!inVoid);
      if (!this.unroom) this.unroom = () => st.setRoom(true);
      (this.objs.void.userData.tick as (t: number) => void)(r.now());
    }
    this.tint = inVoid ? CYAN : null;
    // No legs in the metaverse: the leg bones are folded away to nothing while they're in it.
    const legless = t > 4.4 && t < 11.6;
    if (legless) {
      if (!this.restore) {
        const bones = ['mixamorigLeftUpLeg', 'mixamorigRightUpLeg'].map((n) => vv.root.getObjectByName(n)).filter((b): b is THREE.Object3D => !!b);
        const was = bones.map((b) => b.scale.clone());
        this.restore = () => bones.forEach((b, i) => b.scale.copy(was[i]));
      }
      ['mixamorigLeftUpLeg', 'mixamorigRightUpLeg'].forEach((n) => vv.root.getObjectByName(n)?.scale.setScalar(0.001));
      if (t < 9.4) vv.root.position.y += 0.35 + Math.sin(r.now() * 2.2) * 0.08;
    } else if (this.restore) { this.restore(); this.restore = null; }
    // The sign drifts in beside the opponent.
    if (t > 6.6 && t < 9.4) {
      if (!this.objs.sign) { const s = legsSign(); this.add(r, 'sign', s); r.fxKick(0.15, 0.1, 0.4); }
      const k = clamp01((t - 6.6) / 0.8), e = 1 - Math.pow(1 - k, 3);
      this.objs.sign.visible = true;
      this.objs.sign.position.set(vx + dir * 0.4, 3.0 + (1 - e) * 3 + Math.sin(r.now() * 1.5) * 0.05, -0.6);
    } else if (this.objs.sign) this.objs.sign.visible = false;

    if (t < 2.8) {
      av.role = 'talk'; vv.role = 'fight';
      if (this.once('dark')) st.setMood('dark');
      const k = (t - 0.6) / 2.2, head = av.bonePos('head');
      return { name: 'title', shot: { pos: V(ax + dir * (2.1 - k * 0.5), 0.95, 2.8 - k * 0.2), look: V(ax, head.y - 0.1, 0), fov: 34 } };
    }
    if (t < 4.4) {
      // The void opens: wide and high, the grid running off to the horizon.
      av.role = 'talk'; vv.role = 'fight';
      const k = (t - 2.8) / 1.6;
      return { name: 'void', shot: { pos: V(mid + Math.sin(k) * 1.5, 3.4 - k * 0.6, 9.5 - k * 1.2), look: V(mid, 1.2, 0), fov: 38 } };
    }
    if (t < 6.6) {
      // The opponent, an avatar now, floating with no legs.
      av.role = 'talk'; vv.role = 'reel'; vv.roleSpeed = 0.3;
      const k = (t - 4.4) / 2.2;
      return { name: 'legless', shot: { pos: V(vx - dir * (2.6 - k * 0.5), 0.6, 3.8), look: V(vx, 1.3, 0), fov: 44 } };
    }
    if (t < 8.4) {
      // "Legs." Over his shoulder at the sign.
      av.role = 'talk'; vv.role = 'reel'; vv.roleSpeed = 0.3;
      const k = (t - 6.6) / 1.8;
      return { name: 'sign', shot: { pos: V(ax - dir * (1.5 - k * 0.2), 2.0, 3.4), look: V(vx, 2.5, -0.4), fov: 40 } };
    }
    if (t < 9.4) {
      // "Legs!" Tight on him.
      av.role = 'pump'; vv.role = 'reel';
      const head = av.bonePos('head');
      return { name: 'legs', shot: { pos: V(head.x + dir * 0.8, head.y + 0.1, 2.1), look: V(head.x, head.y, 0), fov: 30 } };
    }
    if (t < 11.6) {
      // "I know you've been waiting for this." Thrown out of the void: up and spinning, in slow motion.
      av.role = 'pump'; vv.role = 'reel'; vv.roleSpeed = 0.25;
      this.blur = 0.45;
      if (this.once('eject')) { r.fxKick(0.4, 0.2, 0.7); st.cheer(1.2); }
      const k = clamp01((t - 9.4) / 2.2);
      vv.root.position.y += 0.35 + Math.sin(Math.PI * k) * 2.2;
      vv.root.rotation.z = dir * k * Math.PI * 2;
      return { name: 'eject', shot: { pos: V(vx - dir * 2.6, 2.0, 7.6), look: V(vx, 1.3 + Math.sin(Math.PI * k) * 2.0, 0), fov: 46 } };
    }
    vv.root.rotation.z = 0;
    if (this.once('boom')) {
      st.setMood('normal');
      const p = V(vx, 1.2, 0.3);
      r.fxSpark(p, 4, '#ffffff', 0.3); r.fxBurst(p, 28, '#9cc6ff', 12); r.fxRing(vx, '#9cc6ff'); r.fxKick(0.9, 0.6, 1.0, 0.02);
      vv.hitFlash(1); st.cheer(2);
    }
    const fall = (t - 11.6) / 1.0;
    if (t < 12.6) { av.role = 'pump'; return { name: 'impact', shot: this.blow(vx, dir, fall, vv, 0.9) }; }
    if (fall < 1) this.blow(vx, dir, fall, vv, 0.9); else vv.role = 'down';
    this.blur = 0;
    // "But seriously, legs are hard." Deadpan, tight on him.
    av.role = 'talk';
    const head = av.bonePos('head'), k = (t - 12.6) / 6;
    return { name: 'payoff', shot: { pos: V(head.x + dir * (0.9 + k * 0.5), head.y + 0.08, 2.3 + k * 0.8), look: V(head.x - dir * 0.15, head.y + 0.06, 0), fov: 32 } };
  }

  dispose(fx: THREE.Object3D) { for (const p of this.props) fx.remove(p); this.restore?.(); this.restore = null; this.unroom?.(); this.unroom = null; }
}

const YELLOW = new THREE.Color(1.08, 1.0, 0.55);
const CYAN = new THREE.Color(0.8, 0.95, 1.15);

// ---------- Signatures and Policy Moves

/**
 * Directs a signature or a sidekick's Policy Move. The opponent is frozen while it plays, so the camera can leave the
 * fight view. A Policy Move (a long line) gets a low close-up as the line starts, over the sidekick's shoulder at the
 * frozen opponent, then tight on the opponent; a signature (a short wind-up) holds the close-up. Then the move itself
 * and a hard low shot on the hit.
 */
class PolicyCine {
  blur = 0;
  private beat = '';

  constructor(public by: 0 | 1, public sig: number) {}

  direct(r: Renderer, m: Match): { shot: Shot; cut: boolean } {
    const f = m.f[this.by], v = m.f[1 - this.by];
    const def = sigAt(r.defOf(this.by), this.sig);
    const dir = v.x >= f.x ? 1 : -1;
    const head = r.headOf(this.by, m), vh = r.headOf(1 - this.by, m);
    let b: Beat;
    this.blur = 0;
    if (f.state === 'quote' && def.quote < 90) {
      // A signature's wind-up: one slow push-in on the speaker, framed so the face sits low and clear of the bubble.
      const k = clamp01(f.frame / def.quote);
      b = { name: 'hero', shot: { pos: V(f.x + dir * (2.0 - k * 0.35), 1.0, 3.3 - k * 0.3), look: V(f.x + dir * 0.35, head.y + 0.05, 0), fov: 36 } };
    } else if (f.state === 'quote') {
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
    } else if (def.kind === 'melee') {
      // The dash in, from the side, then low on the hit.
      if (f.state === 'sig' && f.af <= def.startup) {
        this.blur = 0.5;
        const mid = (f.x + v.x) / 2;
        b = { name: 'dash', shot: { pos: V(mid - dir * 0.4, 0.9, 4.4), look: V(mid + dir * 0.3, 1.15, 0), fov: 44 } };
      } else {
        this.blur = 0.35;
        b = { name: 'impact', shot: { pos: V(v.x - dir * 2.6, 0.65, 4.4), look: V(v.x - dir * 0.4, 1.0, 0), fov: 42 } };
      }
    } else {
      // Thrown things: ride alongside the one in front, then stay on the opponent as the rest arrive.
      const ps = m.proj.filter((p) => p.owner === this.by && p.sig === this.sig);
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
