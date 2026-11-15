import type { Face } from '../data/fighters';

// Procedural placeholder caricatures, drawn on a canvas that wraps around the head sphere.
// The face sits in the middle of the texture (u = 0.5). Swap these for illustrated
// textures later by loading a PNG instead of calling drawFace.

const W = 1024, H = 512;

export function drawFace(face: Face, canvas = document.createElement('canvas')) {
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d')!;
  const cx = W / 2;
  c.fillStyle = face.skin; c.fillRect(0, 0, W, H);

  // Hair: covers the back of the head and a strip on top, shaped per style.
  c.fillStyle = face.hair;
  const hs = face.hairStyle;
  if (hs !== 'bald') {
    const top = hs === 'wild' ? 150 : hs === 'buzz' ? 95 : hs === 'curly' ? 135 : 120;
    c.fillRect(0, 0, W, top - 30);
    c.fillRect(0, 0, cx - 215, hs === 'buzz' ? 250 : 330);
    c.fillRect(cx + 215, 0, W, hs === 'buzz' ? 250 : 330);
    c.beginPath();
    if (hs === 'side') { c.moveTo(cx - 220, top - 40); c.quadraticCurveTo(cx - 40, top + 55, cx + 220, top - 20); c.lineTo(cx + 220, 0); c.lineTo(cx - 220, 0); }
    else if (hs === 'slick') { c.moveTo(cx - 220, top + 10); c.quadraticCurveTo(cx, top - 70, cx + 220, top + 40); c.lineTo(cx + 220, 0); c.lineTo(cx - 220, 0); }
    else if (hs === 'wild' || hs === 'curly') {
      c.moveTo(cx - 225, 0);
      for (let i = 0; i <= 10; i++) c.lineTo(cx - 225 + i * 45, top + (i % 2 ? (hs === 'wild' ? 34 : 14) : -14));
      c.lineTo(cx + 225, 0);
    } else { c.rect(cx - 220, 0, 440, top); }
    c.fill();
    if (hs === 'curly' || hs === 'wild') {
      for (let i = 0; i < 26; i++) { c.beginPath(); c.arc((i * 197) % W, 40 + ((i * 71) % (top - 20)), 34, 0, 7); c.fill(); }
    }
  } else {
    c.fillStyle = 'rgba(255,255,255,0.28)';
    c.beginPath(); c.ellipse(cx - 60, 80, 70, 26, -0.3, 0, 7); c.fill();
  }

  if (face.extra === 'sunscreen') {
    c.fillStyle = 'rgba(255,255,255,0.82)';
    c.beginPath(); c.ellipse(cx, 300, 150, 150, 0, 0, 7); c.fill();
  }

  // Ears
  c.fillStyle = shade(face.skin, -18);
  c.beginPath(); c.ellipse(cx - 232, 280, 22, 42, 0, 0, 7); c.ellipse(cx + 232, 280, 22, 42, 0, 0, 7); c.fill();

  // Eyes
  const ey = 250, ex = 78;
  for (const s of [-1, 1]) {
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(cx + s * ex, ey, 36, 30, 0, 0, 7); c.fill();
    c.lineWidth = face.extra === 'eyeliner' ? 9 : 4; c.strokeStyle = '#161616'; c.stroke();
    c.fillStyle = '#161616'; c.beginPath(); c.arc(cx + s * ex + 4, ey + 3, 13, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(cx + s * ex + 9, ey - 3, 4, 0, 7); c.fill();
  }
  // Brows
  c.strokeStyle = face.hairStyle === 'bald' ? '#5a4030' : shade(face.hair, -25); c.lineWidth = 15; c.lineCap = 'round';
  for (const s of [-1, 1]) {
    const tilt = face.brows === 'angry' ? 22 : face.brows === 'raised' ? -14 : 0;
    const lift = face.brows === 'raised' ? 16 : 0;
    c.beginPath(); c.moveTo(cx + s * (ex + 44), ey - 52 - lift - tilt * 0.4); c.lineTo(cx + s * (ex - 40), ey - 52 - lift + tilt); c.stroke();
  }
  if (face.glasses) {
    c.strokeStyle = '#1a1a1a'; c.lineWidth = 8;
    for (const s of [-1, 1]) { c.beginPath(); c.roundRect(cx + s * ex - 50, ey - 40, 100, 80, 22); c.stroke(); }
    c.beginPath(); c.moveTo(cx - 28, ey); c.lineTo(cx + 28, ey); c.stroke();
  }
  // Nose
  c.strokeStyle = shade(face.skin, -45); c.lineWidth = 7;
  c.beginPath(); c.moveTo(cx - 6, ey + 26); c.quadraticCurveTo(cx - 30, ey + 82, cx + 12, ey + 84); c.stroke();
  // Cheeks
  c.fillStyle = 'rgba(230,90,90,0.22)';
  c.beginPath(); c.arc(cx - 135, 345, 34, 0, 7); c.arc(cx + 135, 345, 34, 0, 7); c.fill();

  // Beard
  const beardCol = face.hairStyle === 'bald' ? '#6a5546' : face.hair;
  if (face.beard === 'full') {
    c.fillStyle = beardCol;
    c.beginPath(); c.moveTo(cx - 215, 330); c.quadraticCurveTo(cx, 370, cx + 215, 330); c.lineTo(cx + 215, H); c.lineTo(cx - 215, H); c.fill();
  } else if (face.beard === 'stubble') {
    c.fillStyle = 'rgba(40,30,25,0.22)';
    c.beginPath(); c.moveTo(cx - 200, 350); c.quadraticCurveTo(cx, 380, cx + 200, 350); c.lineTo(cx + 200, H); c.lineTo(cx - 200, H); c.fill();
  }

  // Mouth
  const my = 392;
  c.lineWidth = 6; c.strokeStyle = '#1a1010';
  if (face.mouth === 'grin') {
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(cx - 100, my - 16); c.quadraticCurveTo(cx, my + 4, cx + 100, my - 16);
    c.quadraticCurveTo(cx, my + 78, cx - 100, my - 16); c.fill(); c.stroke();
    c.lineWidth = 3; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(cx + i * 24, my - 8); c.lineTo(cx + i * 24, my + 30); c.stroke(); }
  } else if (face.mouth === 'open') {
    c.fillStyle = '#4a1414'; c.beginPath(); c.ellipse(cx, my + 8, 62, 44, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.fillRect(cx - 40, my - 30, 80, 16);
    c.fillStyle = '#e2606a'; c.beginPath(); c.ellipse(cx, my + 34, 34, 14, 0, 0, 7); c.fill();
  } else if (face.mouth === 'smirk') {
    c.lineWidth = 11; c.beginPath(); c.moveTo(cx - 70, my + 12); c.quadraticCurveTo(cx + 10, my + 30, cx + 92, my - 20); c.stroke();
  } else {
    c.lineWidth = 11; c.beginPath(); c.moveTo(cx - 70, my + 8); c.lineTo(cx + 70, my + 8); c.stroke();
  }
  if (face.beard === 'mustache') {
    c.fillStyle = beardCol;
    c.beginPath(); c.ellipse(cx - 46, my - 36, 58, 20, 0.25, 0, 7); c.ellipse(cx + 46, my - 36, 58, 20, -0.25, 0, 7); c.fill();
  }
  return canvas;
}

/** A flat, cropped portrait for menus. */
export function drawPortrait(face: Face, size = 160) {
  const full = drawFace(face);
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const c = out.getContext('2d')!;
  c.drawImage(full, W / 2 - 256, 0, 512, 512, 0, 0, size, size);
  return out.toDataURL();
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.max(0, Math.min(255, ((n >> s) & 255) + amt));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

export function emojiCanvas(emoji: string, size = 128) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d')!;
  c.font = `${size * 0.78}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(emoji, size / 2, size / 2 + size * 0.06);
  return cv;
}
