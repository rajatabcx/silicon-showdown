import * as THREE from 'three';

export type StageId = 'senate' | 'playa';
export const STAGES: { id: StageId; name: string; sky: string; fog: string }[] = [
  { id: 'senate', name: 'Senate Hearing Room', sky: '#1b1410', fog: '#1b1410' },
  { id: 'playa', name: 'Desert Festival at Dusk', sky: '#f08a4b', fog: '#c96f4a' },
];

export type Stage = { group: THREE.Group; update(t: number): void; cheer(): void; dispose(): void };

const mat = (color: string, emissive?: string) => new THREE.MeshToonMaterial({ color, emissive: emissive ?? '#000' });

function textTexture(text: string, bg: string, fg: string, w = 1024, h = 128) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  c.fillStyle = fg; c.font = `bold ${h * 0.5}px Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, w / 2, h / 2);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildStage(id: StageId): Stage {
  const group = new THREE.Group();
  const bobbers: { o: THREE.Object3D; base: number; phase: number; amp: number }[] = [];
  const flickers: THREE.Material[] = [];
  let hype = 0;
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = group) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o;
  };
  const person = (x: number, y: number, z: number, shirt: string, skin: string, amp: number) => {
    const g = new THREE.Group(); g.position.set(x, y, z);
    box(0.5, 0.6, 0.3, mat(shirt), 0, 0.3, 0, g);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), mat(skin)); head.position.y = 0.85; g.add(head);
    group.add(g); bobbers.push({ o: g, base: y, phase: x * 1.7 + z, amp });
  };
  const skins = ['#f0c9a8', '#c68e63', '#8d5a3b', '#e6b999', '#f3d4bd'];

  if (id === 'senate') {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), mat('#6b4a32'));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; group.add(floor);
    box(18, 0.02, 3.2, mat('#7a1f2b'), 0, 0.011, 0).receiveShadow = true;
    box(40, 9, 0.4, mat('#3b2618'), 0, 4.5, -6.5);
    for (let i = -9; i <= 9; i++) box(0.35, 9, 0.3, mat('#4f3422'), i * 2.1, 4.5, -6.2);
    // The dais, with senators asleep behind it.
    box(17, 1.25, 0.9, mat('#4a2f1d'), 0, 0.62, -4.2);
    box(17.4, 0.12, 1.2, mat('#2d1b10'), 0, 1.3, -4.2);
    const suits = ['#27304a', '#3a3a3a', '#1f3b2c', '#4a2030'];
    for (let i = 0; i < 9; i++) {
      const x = (i - 4) * 1.9;
      person(x, 1.05, -4.9, suits[i % 4], skins[i % 5], 0.03);
      box(0.7, 0.16, 0.05, mat('#d9c58a'), x, 1.45, -3.7);
    }
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(11, 1.1),
      new THREE.MeshBasicMaterial({ map: textTexture("COMMITTEE ON THINGS WE DON'T UNDERSTAND", '#2d1b10', '#e7cf8a') }));
    banner.position.set(0, 5.1, -6.25); group.add(banner);
    const seal = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), mat('#c9a227')); seal.position.set(0, 3.4, -6.25); group.add(seal);
    for (const s of [-1, 1]) {
      box(0.08, 4.4, 0.08, mat('#c9a227'), s * 9.6, 2.2, -5.4);
      box(1.3, 0.85, 0.04, mat(s < 0 ? '#b22234' : '#27408b'), s * 9.6 + 0.7, 3.8, -5.4);
    }
    // Press photographers in front of the dais; their flashes pop on big hits.
    for (let i = 0; i < 10; i++) {
      const x = (i - 4.5) * 1.75 + 0.4;
      person(x, 0, -3.1, '#222', skins[(i + 2) % 5], 0.05);
      const flash = new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0 });
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), flash); f.position.set(x + 0.2, 0.95, -2.85); group.add(f);
      flickers.push(flash);
    }
  } else {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), mat('#d9b98a'));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; group.add(floor);
    const sun = new THREE.Mesh(new THREE.CircleGeometry(3, 32), new THREE.MeshBasicMaterial({ color: '#ffd27a' }));
    sun.position.set(-6, 3.2, -24); group.add(sun);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(4 + (i % 3) * 2, 3 + (i % 4), 4), mat('#8a4a3a'));
      m.position.set((i - 3.5) * 6.5, 1.4, -21 + (i % 2)); group.add(m);
    }
    // The wooden effigy. It glows on big hits.
    const wood = mat('#7a4a25', '#ff6a00'); (wood as THREE.MeshToonMaterial).emissiveIntensity = 0; flickers.push(wood);
    const eff = new THREE.Group(); eff.position.set(3.5, 0, -8);
    box(0.5, 3.2, 0.5, wood, -0.5, 1.6, 0, eff); box(0.5, 3.2, 0.5, wood, 0.5, 1.6, 0, eff);
    box(1.7, 2.2, 0.6, wood, 0, 4.2, 0, eff); box(4.2, 0.4, 0.4, wood, 0, 4.9, 0, eff);
    box(0.9, 0.9, 0.9, wood, 0, 5.9, 0, eff); group.add(eff);
    const tents = ['#e5484d', '#f59e0b', '#14b8a6', '#8b5cf6', '#ec4899'];
    for (let i = 0; i < 7; i++) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.7, 5), mat(tents[i % 5]));
      t.position.set((i - 3) * 3.6 - 1, 0.85, -6.5 - (i % 3)); group.add(t);
    }
    // Art car
    const car = new THREE.Group(); car.position.set(-6.5, 0, -5);
    box(3.4, 1, 1.5, mat('#3b82f6'), 0, 0.8, 0, car); box(1.6, 0.9, 1.3, mat('#ec4899'), -0.4, 1.7, 0, car);
    for (const x of [-1.1, 1.1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.7, 12), mat('#161616')); w.rotation.x = Math.PI / 2; w.position.set(x, 0.4, 0); car.add(w); }
    group.add(car);
    const shirts = ['#f97316', '#22d3ee', '#fde047', '#f472b6', '#a3e635'];
    for (let i = 0; i < 14; i++) person((i - 6.5) * 1.35, 0, -3.4 - (i % 2) * 0.7, shirts[i % 5], skins[i % 5], 0.09);
  }

  return {
    group,
    update(t) {
      hype = Math.max(0, hype - 0.02);
      for (const b of bobbers) b.o.position.y = b.base + Math.abs(Math.sin(t * (2 + hype * 5) + b.phase)) * b.amp * (1 + hype * 3);
      flickers.forEach((m, i) => {
        if (m instanceof THREE.MeshBasicMaterial) m.opacity = hype > 0.05 && Math.sin(t * 40 + i * 2.3) > 0.72 ? 1 : 0;
        else (m as THREE.MeshToonMaterial).emissiveIntensity = hype * (0.6 + Math.sin(t * 30) * 0.2);
      });
    },
    cheer() { hype = 1; },
    dispose() {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material as THREE.Material & { map?: THREE.Texture | null };
          m.map?.dispose(); m.dispose();
        }
      });
    },
  };
}
