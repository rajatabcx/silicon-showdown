import * as THREE from 'three';

// The Senate hearing room: a fictional committee, built from primitives and canvas textures.

type Draw = (c: CanvasRenderingContext2D, w: number, h: number) => void;
function canvasTex(w: number, h: number, draw: Draw, repeat?: [number, number]) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

const SERIF = '"Times New Roman", Georgia, serif';

function woodTex(base: string, dark: string) {
  return canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
      c.strokeStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.08})`; c.lineWidth = 1 + Math.random() * 3;
      const y = Math.random() * h; c.beginPath(); c.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) c.lineTo(x, y + Math.sin(x * 0.02 + i) * 4);
      c.stroke();
    }
    // Raised panels.
    c.strokeStyle = dark; c.lineWidth = 10;
    for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) c.strokeRect(x * w / 2 + 22, y * h / 2 + 22, w / 2 - 44, h / 2 - 44);
    c.strokeStyle = 'rgba(255,220,170,0.18)'; c.lineWidth = 3;
    for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) c.strokeRect(x * w / 2 + 30, y * h / 2 + 30, w / 2 - 60, h / 2 - 60);
  });
}

function carpetTex() {
  return canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#1b2a52'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { c.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    c.strokeStyle = '#b8923a'; c.lineWidth = 3;
    for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) {
      const cx = x * 128 + 64, cy = y * 128 + 64;
      c.save(); c.translate(cx, cy); c.rotate(Math.PI / 4); c.strokeRect(-26, -26, 52, 52); c.restore();
      c.fillStyle = '#b8923a'; c.beginPath(); c.arc(cx, cy, 5, 0, 7); c.fill();
    }
  }, [5, 3]);
}

function sealTex() {
  return canvasTex(1024, 1024, (c, w) => {
    const r = w / 2;
    c.translate(r, r);
    const g = c.createRadialGradient(0, 0, 40, 0, 0, r);
    g.addColorStop(0, '#f4dc9a'); g.addColorStop(1, '#a87a2a');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r - 6, 0, 7); c.fill();
    c.fillStyle = '#16213f'; c.beginPath(); c.arc(0, 0, r - 70, 0, 7); c.fill();
    c.strokeStyle = '#f0d690'; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, r - 84, 0, 7); c.stroke();
    // Ring text.
    const text = 'COMMITTEE ON COMMERCE, SCIENCE AND HUBRIS  ·  UNITED SENATE  ·  ';
    c.fillStyle = '#3a2408'; c.font = `bold 44px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 0; i < text.length; i++) {
      c.save(); c.rotate((i / text.length) * Math.PI * 2 - Math.PI / 2); c.translate(0, -(r - 38)); c.fillText(text[i], 0, 0); c.restore();
    }
    // Eagle stand-in: a gavel over a ledger, so the seal reads as official without copying a real one.
    c.fillStyle = '#e8c870';
    c.save(); c.rotate(-0.5); c.fillRect(-150, -26, 300, 52); c.fillRect(110, -70, 70, 140); c.restore();
    c.fillRect(-200, 120, 400, 40); c.fillRect(-170, 170, 340, 22);
    c.font = `bold 64px ${SERIF}`; c.fillText('MMXXVI', 0, -180);
    c.font = `italic 40px ${SERIF}`; c.fillText('E pluribus, profit', 0, 270);
  });
}

function nameplateTex(name: string) {
  return canvasTex(512, 96, (c, w, h) => {
    c.fillStyle = '#efe6cf'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#7b6233'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
    c.fillStyle = '#161616'; c.font = `bold 46px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(name, w / 2, h / 2 + 3);
  });
}

function flagTex() {
  return canvasTex(512, 320, (c, w, h) => {
    for (let i = 0; i < 13; i++) { c.fillStyle = i % 2 ? '#f2efe8' : '#a3212f'; c.fillRect(0, (i * h) / 13, w, h / 13 + 1); }
    c.fillStyle = '#1d2b5c'; c.fillRect(0, 0, w * 0.42, h * 0.54);
    c.fillStyle = '#f2efe8';
    for (let y = 0; y < 6; y++) for (let x = 0; x < 7; x++) { c.beginPath(); c.arc(16 + x * 29 + (y % 2) * 14, 14 + y * 27, 5, 0, 7); c.fill(); }
  });
}

function bannerTex() {
  return canvasTex(1024, 128, (c, w, h) => {
    c.fillStyle = '#0f1630'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#d8b25c'; c.fillRect(0, 8, w, 4); c.fillRect(0, h - 12, w, 4);
    c.font = `bold 54px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#f2dfa6';
    c.fillText('OVERSIGHT OF ONLINE BILLIONAIRES', w / 2, h / 2 + 2);
  });
}

const NAMES = ['SEN. QUORUM', 'SEN. FILIBUSTER', 'SEN. RECESS', 'THE CHAIR', 'RANKING MEMBER', 'SEN. AMENDMENT', 'SEN. CLOTURE'];

export type Mood = 'normal' | 'red' | 'grey' | 'gold' | 'dark' | 'blue';

export class Stage {
  group = new THREE.Group();
  private key = new THREE.DirectionalLight('#fff1dc', 2.6);
  private rimL = new THREE.DirectionalLight('#7fb6ff', 2.2);
  private rimR = new THREE.DirectionalLight('#ffb27a', 2.0);
  private hemi = new THREE.HemisphereLight('#c9d4ff', '#2a1c14', 0.55);
  private lamps: { light: THREE.PointLight; bulb: THREE.Mesh; base: number }[] = [];
  private crowd: THREE.InstancedMesh;
  private crowdBase: THREE.Matrix4[] = [];
  private cheerT = 0;
  private flashes: { s: THREE.Sprite; life: number }[] = [];
  private flashTex: THREE.Texture;
  private moodColor = new THREE.Color(1, 1, 1);
  private moodTarget = new THREE.Color(1, 1, 1);
  private disposables: { dispose(): void }[] = [];

  constructor(scene: THREE.Scene) {
    const g = this.group;
    scene.add(g);
    const std = (o: THREE.MeshStandardMaterialParameters) => { const m = new THREE.MeshStandardMaterial(o); this.disposables.push(m); return m; };
    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, shadow = true) => {
      const geo = new THREE.BoxGeometry(w, h, d); this.disposables.push(geo);
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.receiveShadow = shadow; m.castShadow = shadow; g.add(m); return m;
    };

    // Lights.
    this.key.position.set(3, 9, 9); this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048); this.key.shadow.bias = -0.0004;
    const sc = this.key.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 7; sc.bottom = -3; sc.near = 1; sc.far = 30;
    this.rimL.position.set(-6, 5, -6); this.rimR.position.set(6, 4, -6);
    g.add(this.key, this.rimL, this.rimR, this.hemi);

    // Floor: marble border, carpet in the fighting area.
    const marble = canvasTex(512, 512, (c, w, h) => {
      c.fillStyle = '#a89c88'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 30; i++) {
        c.strokeStyle = `rgba(90,80,70,${0.05 + Math.random() * 0.12})`; c.lineWidth = Math.random() * 2;
        c.beginPath(); let x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y);
        for (let k = 0; k < 8; k++) { x += (Math.random() - 0.3) * 80; y += (Math.random() - 0.5) * 60; c.lineTo(x, y); }
        c.stroke();
      }
      c.strokeStyle = 'rgba(60,50,40,0.35)'; c.lineWidth = 2; c.strokeRect(0, 0, w, h);
    }, [10, 6]);
    this.disposables.push(marble);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 24), std({ map: marble, roughness: 0.25, metalness: 0.05 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
    const carpetT = carpetTex(); this.disposables.push(carpetT);
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(15, 6), std({ map: carpetT, roughness: 0.95 }));
    carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.005, -0.4); carpet.receiveShadow = true; g.add(carpet);
    const trim = std({ color: '#b08a3c', metalness: 0.8, roughness: 0.35 });
    box(15.1, 0.03, 0.08, trim, 0, 0.012, 2.6, false); box(15.1, 0.03, 0.08, trim, 0, 0.012, -3.4, false);

    // Back wall: wood wainscot, cream plaster, pilasters, cornice.
    const woodT = woodTex('#5b3520', '#3a2012'); woodT.wrapS = woodT.wrapT = THREE.RepeatWrapping; woodT.repeat.set(12, 1);
    this.disposables.push(woodT);
    const wood = std({ map: woodT, roughness: 0.45, metalness: 0.05 });
    const plaster = std({ color: '#d8ccb2', roughness: 0.9 });
    const darkWood = std({ color: '#3b2114', roughness: 0.5 });
    box(40, 3.2, 0.3, wood, 0, 1.6, -9);
    box(40, 6, 0.3, plaster, 0, 6.2, -9.1);
    box(40, 0.4, 0.6, darkWood, 0, 3.3, -8.9);
    box(40, 0.6, 0.8, std({ color: '#cbbd9b', roughness: 0.7 }), 0, 9.0, -8.8);
    for (const x of [-11, -6.5, 6.5, 11]) {
      box(1.0, 6, 0.4, std({ color: '#e6dcc4', roughness: 0.8 }), x, 6.3, -8.75);
      box(1.3, 0.35, 0.6, std({ color: '#cbbd9b', roughness: 0.7 }), x, 3.6, -8.7);
      box(1.3, 0.35, 0.6, std({ color: '#cbbd9b', roughness: 0.7 }), x, 9.1, -8.6);
    }
    // Drapes behind the seal.
    const drape = std({ color: '#5a1220', roughness: 0.85 });
    for (let i = 0; i < 9; i++) {
      const geo = new THREE.CylinderGeometry(0.28, 0.32, 4.2, 10, 1, true, 0, Math.PI); this.disposables.push(geo);
      const m = new THREE.Mesh(geo, drape); m.position.set(-2.4 + i * 0.6, 6.9, -8.85); m.rotation.y = Math.PI; g.add(m);
    }
    const sealT = sealTex(); this.disposables.push(sealT);
    const seal = new THREE.Mesh(new THREE.CircleGeometry(1.45, 64), std({ map: sealT, roughness: 0.35, metalness: 0.4 }));
    seal.position.set(0, 6.4, -8.5); g.add(seal);
    const bannerT = bannerTex(); this.disposables.push(bannerT);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(8, 1), std({ map: bannerT, roughness: 0.6, emissive: '#ffffff', emissiveMap: bannerT, emissiveIntensity: 0.12 }));
    banner.position.set(0, 4.15, -8.7); g.add(banner);

    // Flags on poles.
    const flagT = flagTex(); this.disposables.push(flagT);
    for (const x of [-4.4, 4.4]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 5.2, 8), trim); pole.position.set(x, 2.6 + 0.4, -7.9); g.add(pole);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), trim); knob.position.set(x, 5.65, -7.9); g.add(knob);
      const fgeo = new THREE.PlaneGeometry(1.5, 1.0, 16, 4);
      const pos = fgeo.attributes.position;
      for (let i = 0; i < pos.count; i++) { const u = (pos.getX(i) + 0.75) / 1.5; pos.setZ(i, Math.sin(u * 7) * 0.08 * u); pos.setY(i, pos.getY(i) - u * u * 0.35); }
      fgeo.computeVertexNormals();
      const flag = new THREE.Mesh(fgeo, std({ map: flagT, side: THREE.DoubleSide, roughness: 0.8 }));
      flag.position.set(x + (x < 0 ? 0.78 : -0.78), 4.9, -7.85); if (x > 0) flag.scale.x = -1; g.add(flag);
    }

    // The dais: two curved tiers of desks with nameplates and microphones, chairs behind.
    const daisWood = std({ map: woodT, roughness: 0.4 });
    const senators: THREE.Vector3[] = [];
    const tiers = [{ r: 12, z: -4.2, h: 1.15, y: 0 }, { r: 13.4, z: -5.7, h: 1.3, y: 0.55 }];
    tiers.forEach((tr, ti) => {
      for (let i = -6; i <= 6; i++) {
        const a = i * 0.075;
        const x = Math.sin(a) * tr.r, z = tr.z - (1 - Math.cos(a)) * tr.r * 0.6;
        const seg = box(1.65, tr.h, 0.7, daisWood, x, tr.y + tr.h / 2, z);
        seg.rotation.y = -a;
        const top = box(1.75, 0.07, 0.95, darkWood, x, tr.y + tr.h + 0.03, z - 0.08); top.rotation.y = -a;
        if (tr.y > 0) { const riser = box(1.7, tr.y, 1.4, darkWood, x, tr.y / 2, z - 0.2); riser.rotation.y = -a; }
        if ((i + 6 + ti) % 2 === 0) {
          const name = NAMES[(i + 6 + ti * 3) % NAMES.length];
          const nt = nameplateTex(name); this.disposables.push(nt);
          const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.17), std({ map: nt, roughness: 0.5 }));
          plate.position.set(x - Math.sin(a) * 0.36, tr.y + tr.h - 0.18, z + Math.cos(a) * 0.36); plate.rotation.y = -a; g.add(plate);
          // Microphone.
          const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 6), trim);
          mic.position.set(x + 0.3, tr.y + tr.h + 0.22, z + 0.1); mic.rotation.x = 0.5; g.add(mic);
          const head = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), std({ color: '#111', roughness: 0.6 }));
          head.position.set(x + 0.3, tr.y + tr.h + 0.4, z + 0.2); g.add(head);
        }
        // High-backed leather chair; about half the senators stayed to watch.
        const chair = box(0.7, 1.5, 0.15, std({ color: '#3d1a14', roughness: 0.55 }), x, tr.y + 0.75 + 0.3, z - 0.75);
        chair.rotation.y = -a;
        if ((i * 7 + ti * 3) % 3 !== 0) senators.push(new THREE.Vector3(x, tr.y + 1.25, z - 0.5));
      }
    });

    // Spectators: senators in their chairs, and gallery rows at the sides, all behind the fighters' line
    // so nothing stands between the camera and the fight.
    const peg = new THREE.CapsuleGeometry(0.17, 0.5, 4, 8); this.disposables.push(peg);
    const crowdMat = std({ roughness: 0.8 });
    const spots: THREE.Vector3[] = [...senators];
    for (const side of [-1, 1]) for (let row = 0; row < 3; row++) for (let k = 0; k < 6; k++) {
      spots.push(new THREE.Vector3(side * (8.6 + row * 0.9), 0.55 + row * 0.35, -6.5 + k * 1.0 + (row % 2) * 0.4));
    }
    this.crowd = new THREE.InstancedMesh(peg, crowdMat, spots.length);
    const col = new THREE.Color(); const pal = ['#2c3446', '#433a33', '#1f2a3a', '#4b4b55', '#5d4636', '#2a2a2a', '#6b5b4a'];
    spots.forEach((p, i) => {
      const mtx = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z);
      this.crowdBase.push(mtx.clone());
      this.crowd.setMatrixAt(i, mtx);
      this.crowd.setColorAt(i, col.set(pal[i % pal.length]));
    });
    this.crowd.userData.pal = pal;
    this.crowd.castShadow = true;
    g.add(this.crowd);
    const headGeo = new THREE.SphereGeometry(0.15, 10, 8); this.disposables.push(headGeo);
    const heads = new THREE.InstancedMesh(headGeo, std({ color: '#d9a785', roughness: 0.7 }), spots.length);
    spots.forEach((p, i) => heads.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y + 0.5, p.z)));
    heads.userData.offset = 0.5;
    g.add(heads);
    this.crowd.userData.heads = heads;
    // Brass rails.
    for (const side of [-1, 1]) {
      box(0.06, 0.06, 6.4, trim, side * 7.9, 1.0, -3.6, false);
      for (let k = 0; k < 5; k++) box(0.05, 1.0, 0.05, trim, side * 7.9, 0.5, -6.6 + k * 1.5, false);
    }

    // Pendant lamps: warm practicals that bloom.
    const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(3) });
    this.disposables.push(bulbMat);
    for (const [x, z] of [[-5, -2.5], [0, -3], [5, -2.5], [-9, -6], [9, -6]] as const) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 3, 4), darkWood); cord.position.set(x, 8.5, z); g.add(cord);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.35, 18, 1, true), std({ color: '#b08a3c', metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide }));
      shade.position.set(x, 6.95, z); g.add(shade);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), bulbMat); bulb.position.set(x, 6.8, z); g.add(bulb);
      const light = new THREE.PointLight('#ffcf8a', 7, 14, 1.6); light.position.set(x, 6.6, z); g.add(light);
      this.lamps.push({ light, bulb, base: 7 });
    }
    // Wall sconces.
    for (const x of [-13, -8.7, 8.7, 13]) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), bulbMat); s.position.set(x, 4.6, -8.6); g.add(s);
    }

    // Press photographers at each side of the floor, outside the fighting area, aiming in.
    const pressMat = std({ color: '#1a1a22', roughness: 0.9 });
    for (const [x, z, s] of [[-8.2, -1.6, 1.05], [-8.6, -0.2, 1.0], [8.2, -1.4, 1.05], [8.7, 0.0, 1.1]] as const) {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3 * s, 0.6 * s, 4, 8), pressMat); body.position.set(x, 0.65 * s, z); g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 10, 8), std({ color: '#c99878', roughness: 0.7 })); head.position.set(x, 1.32 * s, z); g.add(head);
      const cam = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.3), std({ color: '#0b0b0e', roughness: 0.5 })); cam.position.set(x + (x < 0 ? 0.32 : -0.32), 1.3 * s, z); g.add(cam);
    }
    // Overturned witness tables at the back corners of the floor.
    for (const side of [-1, 1]) {
      const t = box(2.2, 0.08, 1.0, daisWood, side * 7.0, 0.5, -2.4);
      t.rotation.z = side * 1.35; t.rotation.y = side * 0.3;
      const cloth = box(2.2, 0.02, 1.0, std({ color: '#2b3f7a', roughness: 0.9 }), side * 7.05, 0.5, -2.4);
      cloth.rotation.copy(t.rotation);
    }

    this.flashTex = canvasTex(128, 128, (c) => {
      const gr = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(220,235,255,0.8)'); gr.addColorStop(1, 'rgba(200,220,255,0)');
      c.fillStyle = gr; c.fillRect(0, 0, 128, 128);
    });
    this.disposables.push(this.flashTex);
  }

  /** Crowd jumps, cameras pop. */
  /** Shows or hides the room itself (walls, floor, benches, crowd) but keeps its lights on: Mork's VR void. */
  setRoom(v: boolean) {
    for (const o of this.group.children) if (!(o as THREE.Light).isLight) o.visible = v;
  }

  cheer(k = 1) {
    this.cheerT = Math.max(this.cheerT, 1.2 * k);
    const n = Math.round(2 + k * 3);
    for (let i = 0; i < n; i++) this.photo();
  }

  photo() {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    const side = Math.random() < 0.5 ? -1 : 1;
    s.position.set(side * (5 + Math.random() * 2.5), 1.2 + Math.random() * 0.6, 3.6 + Math.random() * 1.2);
    s.scale.setScalar(0.6);
    s.userData.delay = Math.random() * 0.5;
    this.group.add(s);
    this.flashes.push({ s, life: -s.userData.delay });
  }

  /** The crowd's own colours, or every spectator in one colour (the blue wave). */
  setCrowd(color: string | null) {
    const col = new THREE.Color(), pal = this.crowd.userData.pal as string[];
    for (let i = 0; i < this.crowd.count; i++) this.crowd.setColorAt(i, col.set(color ?? pal[i % pal.length]));
    if (this.crowd.instanceColor) this.crowd.instanceColor.needsUpdate = true;
  }

  setMood(m: Mood) {
    const c = { normal: [1, 1, 1], red: [1.5, 0.35, 0.3], grey: [0.55, 0.55, 0.6], gold: [1.4, 1.1, 0.6], dark: [0.25, 0.25, 0.32], blue: [0.5, 0.75, 1.5] }[m];
    this.moodTarget.setRGB(c[0], c[1], c[2]);
  }

  update(t: number, dt: number) {
    this.moodColor.lerp(this.moodTarget, Math.min(1, dt * 4));
    const mc = this.moodColor;
    const lum = (mc.r + mc.g + mc.b) / 3;
    this.key.color.setRGB(1 * mc.r, 0.95 * mc.g, 0.86 * mc.b);
    this.key.intensity = 2.6 * Math.min(1.2, lum + 0.15);
    this.hemi.intensity = 0.55 * lum;
    for (const l of this.lamps) {
      l.light.intensity = l.base * lum * (0.96 + Math.sin(t * 13 + l.base) * 0.04);
      l.light.color.setRGB(1 * mc.r, 0.81 * mc.g, 0.54 * mc.b);
    }
    // Crowd bob.
    this.cheerT = Math.max(0, this.cheerT - dt);
    const heads = this.crowd.userData.heads as THREE.InstancedMesh;
    const m = new THREE.Matrix4();
    this.crowdBase.forEach((b, i) => {
      const hop = Math.max(0, Math.sin(t * 9 + i * 1.7)) * 0.18 * Math.min(1, this.cheerT) + Math.sin(t * 1.3 + i) * 0.015;
      m.copy(b); m.elements[13] += hop;
      this.crowd.setMatrixAt(i, m);
      m.elements[13] += heads.userData.offset; heads.setMatrixAt(i, m);
    });
    this.crowd.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
    // Camera flashes.
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life += dt;
      const k = f.life / 0.18;
      f.s.visible = f.life >= 0;
      f.s.material.opacity = Math.max(0, 1 - k);
      f.s.scale.setScalar(0.5 + Math.max(0, k) * 1.4);
      if (k >= 1) { this.group.remove(f.s); f.s.material.dispose(); this.flashes.splice(i, 1); }
    }
    if (Math.random() < dt * 0.6) this.photo();
  }

  dispose() {
    this.group.parent?.remove(this.group);
    for (const d of this.disposables) d.dispose();
    this.group.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh) mesh.geometry.dispose(); });
  }
}
