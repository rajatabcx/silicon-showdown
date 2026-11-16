import * as THREE from 'three';

let gradient: THREE.DataTexture | null = null;

/** Three hard light bands: the cel look. */
export function toonGradient() {
  if (gradient) return gradient;
  const d = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 235, 235, 235, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

export type ToonUniforms = { uRim: { value: THREE.Color }; uRimPow: { value: number }; uFlash: { value: number } };

/** Cel-shaded material with a fresnel rim and a hit-flash tint, keeping the model's own texture. */
export function toonMaterial(src: THREE.Material, rim: THREE.ColorRepresentation): THREE.MeshToonMaterial & { userData: { u: ToonUniforms } } {
  const s = src as THREE.MeshStandardMaterial;
  const m = new THREE.MeshToonMaterial({ map: s.map ?? null, color: s.map ? 0xffffff : s.color, gradientMap: toonGradient() });
  if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
  const u: ToonUniforms = { uRim: { value: new THREE.Color(rim) }, uRimPow: { value: 2.6 }, uFlash: { value: 0 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRim; uniform float uRimPow; uniform float uFlash;')
      .replace('#include <opaque_fragment>', `
        float fres = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), uRimPow);
        outgoingLight += uRim * smoothstep(0.35, 0.75, fres);
        outgoingLight = mix(outgoingLight, vec3(1.0, 0.96, 0.9), uFlash);
        #include <opaque_fragment>`);
  };
  m.userData.u = u;
  return m as THREE.MeshToonMaterial & { userData: { u: ToonUniforms } };
}

/** Inverted-hull ink outline that follows skinning. Thickness is in the mesh's local units. */
export function outlineMaterial(thickness: number, color: THREE.ColorRepresentation = 0x0a0608) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  const u = { uOutline: { value: thickness } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uOutline;')
      .replace('#include <skinning_vertex>', '#include <skinning_vertex>\n#ifdef USE_SKINNING\ntransformed += normalize(objectNormal) * uOutline;\n#else\ntransformed += normalize(normal) * uOutline;\n#endif');
  };
  m.userData.u = u;
  return m;
}

/** Give a static prop or set piece the same cel look and ink line. */
export function toonify(root: THREE.Object3D, rim: THREE.ColorRepresentation = 0x000000, outline = 0.012) {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  for (const mesh of meshes) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mesh.material = mats.length === 1 ? toonMaterial(mats[0], rim) : mats.map((x) => toonMaterial(x, rim));
    mesh.castShadow = true;
    if (outline > 0) {
      const ws = new THREE.Vector3(); mesh.getWorldScale(ws);
      const hull = new THREE.Mesh(mesh.geometry, outlineMaterial(outline / Math.max(1e-4, ws.x)));
      hull.name = 'outline';
      mesh.add(hull);
    }
  }
  return root;
}
