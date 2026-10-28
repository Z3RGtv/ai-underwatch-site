import { skinCanvas, SKIN_UV } from './skin-system.js';

// Portraits share the live wardrobe/Java texture without a WebGL context per card.
window.drawVoxelAvatar = function(canvas, appearance = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d'), texture = skinCanvas(appearance);
  const w = canvas.width, h = canvas.height, unit = Math.min(w / 25, h / 39), ox = w * .5, oy = h * .91;
  const project = ([x, y, z]) => [ox + (x * .92 + z * .45) * unit, oy + (-y + z * .23 - x * .10) * unit];
  ctx.clearRect(0, 0, w, h); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#050b0780'; ctx.beginPath(); ctx.ellipse(ox, oy + unit * .3, unit * 9, unit * 1.5, 0, 0, Math.PI * 2); ctx.fill();
  const faces = [];
  function box(x, y, z, dx, dy, dz, uv) {
    const add = (points, face) => faces.push({ points, uv: uv[face],
      depth: points.reduce((s, p) => s + p[2] - p[0] * .5 + p[1] * .15, 0) / 3 });
    add([[x, y + dy, z], [x, y + dy, z + dz], [x, y, z]], 'right');
    add([[x, y + dy, z], [x + dx, y + dy, z], [x, y + dy, z + dz]], 'top');
    add([[x, y + dy, z + dz], [x + dx, y + dy, z + dz], [x, y, z + dz]], 'front');
  }
  box(-4, 0, -2, 4, 12, 4, SKIN_UV.rightLeg); box(0, 0, -2, 4, 12, 4, SKIN_UV.leftLeg);
  box(-4, 12, -2, 8, 12, 4, SKIN_UV.torso);
  box(-4.25, 11.75, -2.25, 8.5, 12.5, 4.5, SKIN_UV.jacket);
  box(-8, 12, -2, 4, 12, 4, SKIN_UV.rightArm); box(4, 12, -2, 4, 12, 4, SKIN_UV.leftArm);
  box(-4, 24, -4, 8, 8, 8, SKIN_UV.head); box(-4.5, 23.5, -4.5, 9, 9, 9, SKIN_UV.hat);
  faces.sort((a, b) => a.depth - b.depth);
  for (const face of faces) {
    const [p0, p1, p2] = face.points.map(project), [sx, sy, sw, sh] = face.uv;
    ctx.save(); ctx.setTransform((p1[0] - p0[0]) / sw, (p1[1] - p0[1]) / sw,
      (p2[0] - p0[0]) / sh, (p2[1] - p0[1]) / sh, p0[0], p0[1]);
    ctx.drawImage(texture, sx, sy, sw, sh, 0, 0, sw, sh); ctx.restore();
  }
};

window.drawVoxelHead=function(canvas,appearance={}){if(!canvas)return;const ctx=canvas.getContext('2d'),skin=skinCanvas(appearance);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(skin,8,8,8,8,0,0,canvas.width,canvas.height);ctx.drawImage(skin,40,8,8,8,0,0,canvas.width,canvas.height);};
