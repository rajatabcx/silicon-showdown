import * as THREE from 'three';
import { DISPLAY_F } from './props';

// Props for the sidekick politicians' Policy Moves. The sidekicks themselves are rigged models (FighterView, limited).

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
