// Original Underwatch pixel art. Shared verbatim by browser and skin server.
// Minecraft Java classic/wide UV layout: one 64x64 PNG, six base/outer meshes.
export const SKIN_VERSION = 1;
const GARMENT_PARTS = {
  head: { field: 'headPreset', label: 'Head', options: [
    { id: 'wanderer', name: 'The Wanderer', detail: 'Weathered hood · open face', color: '#4b5740' },
    { id: 'scout', name: 'The Scout', detail: 'Swept hair · leather headband', color: '#73533b' },
    { id: 'scholar', name: 'The Scholar', detail: 'Copper spectacles · dark hair', color: '#463b50' },
    { id: 'sentinel', name: 'The Sentinel', detail: 'Obsidian coif · gold brow', color: '#343b40' },
    { id: 'ranger', name: 'The Ranger', detail: 'Forest cowl · stitched edge', color: '#3b5949' },
    { id: 'seafarer', name: 'The Seafarer', detail: 'Woven cap · salt-grey hair', color: '#415769' },
    { id: 'willow', name: 'Willow Braid', detail: 'Chestnut braid · open face', color: '#5b4839', faceStyle: 'feminine', hairColor: '#654631', hairStyle: 'braid' },
    { id: 'ember', name: 'Ember Scout', detail: 'Copper bob · side-swept fringe', color: '#8e4b30', faceStyle: 'feminine', hairColor: '#914e30', hairStyle: 'bob' },
    { id: 'luna', name: 'Moonlit Scholar', detail: 'Dark hair · copper spectacles', color: '#453d54', faceStyle: 'feminine', hairColor: '#302b36', hairStyle: 'long' },
    { id: 'fern', name: 'Forest Ranger', detail: 'Forest cowl · loose dark hair', color: '#3b5949', faceStyle: 'feminine', hairColor: '#40342c', hairStyle: 'long', hood: true },
    { id: 'silver', name: 'Silver Wanderer', detail: 'Silver hair · woven headband', color: '#59616a', faceStyle: 'feminine', hairColor: '#b2aea1', hairStyle: 'long' },
    { id: 'copper', name: 'Copper Keeper', detail: 'Long auburn hair · gold clasp', color: '#794738', faceStyle: 'feminine', hairColor: '#784432', hairStyle: 'long' }
  ] },
  torso: { field: 'torsoPreset', label: 'Torso', options: [
    { id: 'ranger', name: 'Forest Keeper', detail: 'Moss linen · leather harness', color: '#49604b' },
    { id: 'explorer', name: 'Copper Explorer', detail: 'Russet coat · cross-body strap', color: '#86553e' },
    { id: 'watcher', name: 'Obsidian Watcher', detail: 'Midnight cloth · eye insignia', color: '#3e3c50' },
    { id: 'nomad', name: 'Dune Nomad', detail: 'Sand layers · crimson sash', color: '#a18a5f' },
    { id: 'scholar', name: 'Ivory Scribe', detail: 'Parchment linen · ink seams', color: '#b4ad8c' },
    { id: 'sailor', name: 'Tide Wanderer', detail: 'Blue wool · brass fastenings', color: '#496479' }
  ] },
  arms: { field: 'armsPreset', label: 'Arms', options: [
    { id: 'sleeved', name: 'Linen Sleeves', detail: 'Full sleeves · embroidered cuffs', color: '#49604b' },
    { id: 'rolled', name: 'Rolled Sleeves', detail: 'Bare forearms · folded linen', color: '#86553e' },
    { id: 'bracers', name: 'Leather Bracers', detail: 'Worn leather · riveted wrists', color: '#555343' },
    { id: 'wrapped', name: 'Trail Wraps', detail: 'Layered wraps · exposed hands', color: '#aca080' },
    { id: 'gloves', name: 'Watch Gloves', detail: 'Dark sleeves · leather gloves', color: '#3e3c50' }
  ] },
  legs: { field: 'legsPreset', label: 'Legs', options: [
    { id: 'trail', name: 'Trail Boots', detail: 'Charcoal trousers · worn boots', color: '#414b43' },
    { id: 'ranger', name: 'Ranger Greaves', detail: 'Forest cloth · leather knee guards', color: '#4c5a43' },
    { id: 'guard', name: 'Night Watch', detail: 'Indigo trousers · strapped boots', color: '#3c4053' },
    { id: 'nomad', name: 'Desert Strides', detail: 'Sand trousers · wrapped calves', color: '#8d7e5e' },
    { id: 'sailor', name: 'Seafarer Boots', detail: 'Blue cloth · tall leather boots', color: '#42586a' }
  ] }
};
export const SKIN_PARTS = Object.freeze({
  head: GARMENT_PARTS.head, torso: GARMENT_PARTS.torso,
  rightArm: { ...GARMENT_PARTS.arms, field: 'rightArmPreset', label: 'Right arm', group: 'arms', legacy: 'armsPreset' },
  leftArm: { ...GARMENT_PARTS.arms, field: 'leftArmPreset', label: 'Left arm', group: 'arms', legacy: 'armsPreset' },
  rightLeg: { ...GARMENT_PARTS.legs, field: 'rightLegPreset', label: 'Right leg', group: 'legs', legacy: 'legsPreset' },
  leftLeg: { ...GARMENT_PARTS.legs, field: 'leftLegPreset', label: 'Left leg', group: 'legs', legacy: 'legsPreset' }
});
export const SKIN_TONES = ['#f0cbb0', '#d7b18c', '#be9069', '#a57553', '#80573e', '#5c3e32'];
const defaults = { headPreset: 'wanderer', torsoPreset: 'ranger', rightArmPreset: 'sleeved', leftArmPreset: 'sleeved', rightLegPreset: 'trail', leftLegPreset: 'trail' };
const isHex = value => /^#[0-9a-f]{6}$/i.test(value ?? '');
export function normalizeAppearance(input = {}, { strict = false } = {}) {
  const out = { ...input, skinVersion: SKIN_VERSION, skinModel: 'classic' };
  if (strict && input.faceStyle !== undefined && !['feminine', 'masculine'].includes(input.faceStyle)) throw Error('Invalid face style.');
  for (const part of Object.values(SKIN_PARTS)) {
    const value = input[part.field] ?? input[part.legacy] ?? (part.field === 'headPreset' && input.faceStyle === 'feminine' ? 'willow' : defaults[part.field]);
    if (strict && !part.options.some(o => o.id === value)) throw Error(`Unknown ${part.label.toLowerCase()} preset.`);
    out[part.field] = part.options.some(o => o.id === value) ? value : defaults[part.field];
  }
  for (const field of ['linkArms', 'linkLegs']) {
    if (strict && input[field] !== undefined && typeof input[field] !== 'boolean') throw Error('Invalid linked-limb option.');
    out[field] = typeof input[field] === 'boolean' ? input[field] : true;
  }
  if (out.linkArms) out.leftArmPreset = out.rightArmPreset;
  if (out.linkLegs) out.leftLegPreset = out.rightLegPreset;
  const selectedHead = SKIN_PARTS.head.options.find(o => o.id === out.headPreset);
  out.faceStyle = selectedHead.faceStyle ?? 'masculine';
  for (const [field, fallback] of Object.entries({ skinTone: '#d7b18c', eyeColor: '#8cac83', hairColor: selectedHead.hairColor ?? '#49382f',
    tunicColor: SKIN_PARTS.torso.options.find(o => o.id === out.torsoPreset).color })) {
    if (strict && input[field] !== undefined && !isHex(input[field])) throw Error(`Invalid ${field}.`);
    out[field] = isHex(input[field]) ? input[field].toLowerCase() : fallback;
  }
  delete out.armsPreset; delete out.legsPreset;
  for (const field of Object.keys(out)) if (out[field] === undefined) delete out[field];
  return out;
}

// Box UVs match Minecraft / skinview3d. Origin is the upper left of the box net.
export function boxUV(u, v, w, h, d) {
  return { top: [u + d, v, w, d], bottom: [u + d + w, v, w, d],
    right: [u, v + d, d, h], front: [u + d, v + d, w, h], left: [u + d + w, v + d, d, h], back: [u + 2 * d + w, v + d, w, h] };
}
export const SKIN_UV = Object.freeze({
  head: boxUV(0, 0, 8, 8, 8), hat: boxUV(32, 0, 8, 8, 8),
  torso: boxUV(16, 16, 8, 12, 4), jacket: boxUV(16, 32, 8, 12, 4),
  rightArm: boxUV(40, 16, 4, 12, 4), rightSleeve: boxUV(40, 32, 4, 12, 4),
  leftArm: boxUV(32, 48, 4, 12, 4), leftSleeve: boxUV(48, 48, 4, 12, 4),
  rightLeg: boxUV(0, 16, 4, 12, 4), rightTrouser: boxUV(0, 32, 4, 12, 4),
  leftLeg: boxUV(16, 48, 4, 12, 4), leftTrouser: boxUV(0, 48, 4, 12, 4)
});
export function composeSkin(input = {}) {
  const appearance = normalizeAppearance(input), pixels = new Uint8ClampedArray(64 * 64 * 4);
  const rgb = hex => hex.slice(1).match(/../g).map(s => parseInt(s, 16));
  const shade = (hex, scale) => '#' + rgb(hex).map(c => Math.max(0, Math.min(255, Math.round(c * scale))).toString(16).padStart(2, '0')).join('');
  const put = (x, y, color, alpha = 255) => { if (x < 0 || x >= 64 || y < 0 || y >= 64) return; const i = (y * 64 + x) * 4; pixels.set([...rgb(color), alpha], i); };
  const rect = (uv, x, y, w, h, color) => { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) put(uv[0] + x + xx, uv[1] + y + yy, color); };
  const fill = (faces, color, texture = true) => {
    for (const [face, uv] of Object.entries(faces)) {
      const light = face === 'top' ? 1.08 : face === 'bottom' ? .78 : face === 'back' ? .94 : 1;
      for (let y = 0; y < uv[3]; y++) for (let x = 0; x < uv[2]; x++) {
        const weave = texture ? (((x * 17 + y * 31 + uv[0]) % 13 === 0) ? -.07 : ((x + y * 3) % 11 === 0) ? .035 : 0) : 0;
        put(uv[0] + x, uv[1] + y, shade(color, light + weave));
      }
    }
  };
  const leather = '#574333', darkLeather = '#392f2b', gold = '#bd9a57', seam = '#c1ac79';
  const head = SKIN_PARTS.head.options.find(o => o.id === appearance.headPreset);
  const torso = appearance.tunicColor;

  fill(SKIN_UV.head, appearance.skinTone, false);
  for (const side of ['top', 'back', 'right', 'left']) fill({ [side]: SKIN_UV.head[side] }, appearance.hairColor);
  for (const side of ['right', 'left']) rect(SKIN_UV.head[side], 5, 4, 2, 2, shade(appearance.skinTone, .92));
  const face = SKIN_UV.head.front;
  rect(face, 0, 0, 8, 2, appearance.hairColor); rect(face, 0, 2, 1, 3, appearance.hairColor); rect(face, 7, 2, 1, 3, appearance.hairColor);
  rect(face, 1, 4, 2, 1, '#e6dfcf'); rect(face, 5, 4, 2, 1, '#e6dfcf');
  rect(face, 2, 4, 1, 1, appearance.eyeColor); rect(face, 5, 4, 1, 1, appearance.eyeColor);
  rect(face, 3, 5, 2, 1, shade(appearance.skinTone, .85)); rect(face, 3, 6, 2, 1, '#9c715a');
  rect(face, 1, 3, 2, 1, shade(appearance.hairColor, .85)); rect(face, 5, 3, 2, 1, shade(appearance.hairColor, .85));
  if (head.faceStyle === 'feminine') {
    rect(face, 1, 3, 1, 1, appearance.skinTone); rect(face, 6, 3, 1, 1, appearance.skinTone);
    rect(face, 0, 4, 1, 1, shade(appearance.hairColor, .8)); rect(face, 7, 4, 1, 1, shade(appearance.hairColor, .8));
    rect(face, 1, 5, 1, 1, shade(appearance.skinTone, .95)); rect(face, 6, 5, 1, 1, shade(appearance.skinTone, .95));
    rect(face, 3, 6, 2, 1, '#ac776d');
    for (const side of ['right', 'left']) fill({ [side]: SKIN_UV.head[side] }, appearance.hairColor);
    rect(face, 0, 2, 2, 1, appearance.hairColor); rect(face, 1, 1, 3, 1, appearance.hairColor);
    if (head.hairStyle === 'bob') { rect(face, 0, 5, 1, 3, appearance.hairColor); rect(face, 7, 5, 1, 2, appearance.hairColor); }
    if (head.hairStyle === 'long' || head.hairStyle === 'braid') {
      const back = SKIN_UV.jacket.back, front = SKIN_UV.jacket.front;
      if (head.hairStyle === 'braid') {
        for (let y = 0; y < 9; y++) rect(back, y % 2 ? 3 : 2, y, 3, 1, shade(appearance.hairColor, y % 2 ? .88 : 1));
        rect(back, 3, 8, 2, 1, gold);
      } else {
        rect(back, 1, 0, 6, 6, appearance.hairColor); rect(back, 2, 6, 4, 1, shade(appearance.hairColor, .9));
        rect(front, 0, 0, 1, 4, appearance.hairColor); rect(front, 7, 0, 1, 5, appearance.hairColor);
      }
    }
    if (head.id === 'silver' || head.id === 'copper') {
      for (const side of ['front', 'right', 'left', 'back']) rect(SKIN_UV.hat[side], 0, 2, 8, 1, head.id === 'silver' ? leather : gold);
    }
    if (head.id === 'luna') {
      for (const x of [1, 5]) { rect(face, x, 3, 2, 1, gold); rect(face, x, 5, 2, 1, gold); }
      rect(face, 3, 4, 2, 1, gold);
    }
  }
  if (['wanderer', 'ranger', 'sentinel', 'seafarer'].includes(head.id) || head.hood) {
    for (const side of ['top', 'back', 'left', 'right']) fill({ [side]: SKIN_UV.hat[side] }, head.color);
    for (const side of ['left', 'right', 'back']) { rect(SKIN_UV.hat[side], 0, 6, 8, 1, shade(head.color, .72)); }
    rect(SKIN_UV.hat.front, 0, 0, 8, 2, head.color);
    if (head.id !== 'seafarer') {
      rect(SKIN_UV.hat.front, 0, 2, 1, 6, head.color); rect(SKIN_UV.hat.front, 7, 2, 1, 6, head.color);
      rect(SKIN_UV.hat.front, 0, 7, 2, 1, shade(head.color, .8)); rect(SKIN_UV.hat.front, 6, 7, 2, 1, shade(head.color, .8));
    }
    for (let x = 1; x < 7; x += 2) rect(SKIN_UV.hat.front, x, 1, 1, 1, head.id === 'sentinel' ? gold : seam);
    if (head.id === 'sentinel') rect(SKIN_UV.hat.front, 3, 1, 2, 1, '#74a993');
  } else if (head.id === 'scout') {
    for (const side of ['front', 'left', 'right', 'back']) rect(SKIN_UV.hat[side], 0, 2, 8, 1, leather);
    rect(SKIN_UV.hat.front, 6, 2, 1, 1, gold); rect(face, 1, 2, 3, 1, appearance.hairColor);
  } else if (head.id === 'scholar') {
    for (const x of [1, 5]) { rect(face, x, 3, 2, 1, gold); rect(face, x, 5, 2, 1, gold); }
    rect(face, 0, 4, 1, 1, gold); rect(face, 3, 4, 2, 1, gold); rect(face, 7, 4, 1, 1, gold);
  }

  fill(SKIN_UV.torso, torso);
  for (const side of ['front', 'back', 'right', 'left']) {
    const uv = SKIN_UV.torso[side]; rect(uv, 0, 10, uv[2], 2, leather); rect(uv, 0, 9, uv[2], 1, shade(torso, .75));
  }
  const chest = SKIN_UV.torso.front;
  rect(chest, 3, 0, 2, 2, appearance.skinTone); rect(chest, 2, 0, 1, 2, shade(torso, .7)); rect(chest, 5, 0, 1, 2, shade(torso, .7));
  rect(chest, 3, 10, 2, 1, gold);
  if (['ranger', 'explorer'].includes(appearance.torsoPreset)) {
    for (let y = 1; y < 10; y++) rect(chest, Math.min(7, Math.floor(y * .7)), y, 1, 1, darkLeather);
    rect(chest, 5, 7, 3, 3, leather); rect(chest, 6, 7, 1, 1, gold);
    for (let y = 2; y < 9; y += 2) rect(SKIN_UV.torso.back, 1, y, 1, 1, seam);
  } else if (appearance.torsoPreset === 'watcher') {
    rect(chest, 3, 3, 2, 1, gold); rect(chest, 2, 4, 4, 1, gold); rect(chest, 3, 5, 2, 1, gold); rect(chest, 3, 4, 2, 1, '#70a58b');
    for (let y = 6; y < 10; y++) rect(chest, 3, y, 2, 1, shade(torso, .7));
  } else if (appearance.torsoPreset === 'nomad') {
    for (const side of ['front', 'back', 'right', 'left']) { const uv = SKIN_UV.torso[side]; rect(uv, 0, 8, uv[2], 2, '#80463c'); }
    for (let y = 3; y < 8; y += 2) rect(chest, 1, y, 6, 1, shade(torso, .86));
  } else if (appearance.torsoPreset === 'scholar') {
    rect(chest, 1, 0, 1, 10, '#514538'); rect(chest, 6, 0, 1, 10, '#514538');
    rect(chest, 3, 3, 2, 1, gold); rect(chest, 3, 5, 2, 1, leather); rect(chest, 6, 6, 1, 2, '#e3d5a8');
  } else { for (let y = 3; y < 9; y += 2) { rect(chest, 2, y, 1, 1, gold); rect(chest, 5, y, 1, 1, gold); } }
  for (const name of ['rightArm', 'leftArm']) {
    const armsPreset = appearance[SKIN_PARTS[name].field], arms = SKIN_PARTS[name].options.find(o => o.id === armsPreset).color;
    fill(SKIN_UV[name], arms);
    for (const side of ['front', 'back', 'right', 'left']) {
      const uv = SKIN_UV[name][side];
      rect(uv, 0, 9, 4, 3, appearance.skinTone);
      if (armsPreset === 'rolled') { rect(uv, 0, 5, 4, 7, appearance.skinTone); rect(uv, 0, 4, 4, 1, shade(arms, 1.2)); }
      else if (armsPreset === 'bracers') { rect(uv, 0, 6, 4, 4, leather); rect(uv, 1, 6, 1, 1, gold); rect(uv, 1, 9, 1, 1, gold); }
      else if (armsPreset === 'wrapped') { for (let y = 4; y < 10; y += 2) rect(uv, 0, y, 4, 1, shade(arms, .72)); }
      else if (armsPreset === 'gloves') { rect(uv, 0, 8, 4, 4, darkLeather); rect(uv, 0, 8, 4, 1, gold); }
      else { rect(uv, 0, 8, 4, 1, shade(arms, .65)); rect(uv, 1, 8, 1, 1, seam); }
    }
    if (armsPreset !== 'gloves') fill({ bottom: SKIN_UV[name].bottom }, appearance.skinTone, false);
  }
  for (const name of ['rightLeg', 'leftLeg']) {
    const legsPreset = appearance[SKIN_PARTS[name].field], legs = SKIN_PARTS[name].options.find(o => o.id === legsPreset).color;
    fill(SKIN_UV[name], legs);
    for (const side of ['front', 'back', 'right', 'left']) {
      const uv = SKIN_UV[name][side], bootHeight = legsPreset === 'sailor' ? 6 : 4;
      rect(uv, 0, 12 - bootHeight, 4, bootHeight, leather); rect(uv, 0, 11, 4, 1, darkLeather);
      rect(uv, 0, 0, 1, 8, shade(legs, .8));
      if (legsPreset === 'ranger') { rect(uv, 1, 4, 2, 2, darkLeather); rect(uv, 1, 4, 1, 1, gold); }
      if (legsPreset === 'guard') { rect(uv, 0, 8, 4, 1, '#968262'); rect(uv, 1, 8, 1, 1, gold); }
      if (legsPreset === 'nomad') for (let y = 6; y < 11; y += 2) rect(uv, 0, y, 4, 1, '#b7a98a');
    }
    fill({ bottom: SKIN_UV[name].bottom }, darkLeather, false);
  }
  return { width: 64, height: 64, pixels, appearance };
}

export function skinCanvas(appearance) {
  const skin = composeSkin(appearance), canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  canvas.getContext('2d').putImageData(new ImageData(skin.pixels, 64, 64), 0, 0); return canvas;
}
