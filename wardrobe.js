import { SKIN_PARTS, SKIN_TONES, normalizeAppearance, skinCanvas } from './skin-system.js';
import './avatar.js';

let library;
function loadViewer() {
  return library ??= new Promise((resolve, reject) => {
    if (window.skinview3d) return resolve(window.skinview3d);
    const script = document.createElement('script'); script.src = '/skinview3d.bundle.js';
    script.onload = () => resolve(window.skinview3d); script.onerror = () => reject(Error('3D viewer could not load.'));
    document.head.append(script);
  });
}
export function mountWardrobe(container, { appearance = {}, onChange = () => {}, locked = false } = {}) {
  let draft = normalizeAppearance(appearance), viewer, dead = false, rotation = -.35;
  const headsByStyle = {};
  const rememberHead = () => { headsByStyle[draft.faceStyle] = { headPreset: draft.headPreset, hairColor: draft.hairColor }; };
  rememberHead();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const row = key => {
    const part = SKIN_PARTS[key];
    return `<section class="wardrobe-part" data-part="${key}"><div class="wardrobe-part-heading"><span>${part.label.toUpperCase()}</span><small data-count></small></div><div class="wardrobe-stepper"><button type="button" data-step="-1" aria-label="Previous ${part.label.toLowerCase()} style">‹</button><div aria-live="polite"><strong data-name></strong></div><button type="button" data-step="1" aria-label="Next ${part.label.toLowerCase()} style">›</button></div></section>`;
  };
  const pair = (group, label, right, left) => `<div class="wardrobe-pair-heading"><span>${label}</span><label><input type="checkbox" data-link="${group}" checked> Match both ${group}</label></div><div class="wardrobe-pair">${row(right)}${row(left)}</div>`;
  const choicesFor = part => part.field === 'headPreset' ? part.options.filter(o => (o.faceStyle ?? 'masculine') === draft.faceStyle) : part.options;
  const faceStyleMarkup = '<div class="wardrobe-face-style"><span class="eyebrow">FACE STYLE</span><div><button type="button" data-face-style="feminine" aria-pressed="false">Feminine</button><button type="button" data-face-style="masculine" aria-pressed="false">Masculine</button></div></div>';
  const partsMarkup = faceStyleMarkup + row('head') + row('torso') + pair('arms', 'ARMS', 'rightArm', 'leftArm') + pair('legs', 'LEGS', 'rightLeg', 'leftLeg');

  container.classList.add('wardrobe');
  container.innerHTML = `<div class="wardrobe-preview"><div class="wardrobe-stage-label"><span class="wardrobe-gem">◇</span> YOUR CHARACTER</div><div class="wardrobe-model"><canvas width="540" height="650" aria-label="Minecraft skin preview. Drag to rotate."></canvas></div><div class="wardrobe-orbit"><button type="button" data-turn="-1" aria-label="Rotate character left">↶</button><span>360°</span><button type="button" data-turn="1" aria-label="Rotate character right">↷</button></div></div><div class="wardrobe-options"><fieldset class="wardrobe-controls"><legend class="sr-only">Appearance</legend><div class="wardrobe-parts">${partsMarkup}</div><div class="wardrobe-complexion"><span class="eyebrow">COMPLEXION</span><div class="wardrobe-tones">${SKIN_TONES.map((tone, i) => `<button type="button" data-tone="${tone}" style="--tone:${tone}" aria-label="Skin tone ${i + 1}" aria-pressed="false"></button>`).join('')}</div></div><div class="wardrobe-tools"><button type="button" class="text-link" data-random>Randomize</button></div></fieldset><div class="wardrobe-lock-status" role="status" ${locked ? '' : 'hidden'}>Appearance saved · Locked</div></div>`;
  const canvas = container.querySelector('canvas');
  function update() {
    draft = normalizeAppearance(draft);
    container.querySelectorAll('[data-face-style]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.faceStyle === draft.faceStyle)));
    container.querySelector('[data-link=arms]').checked = draft.linkArms;
    container.querySelector('[data-link=legs]').checked = draft.linkLegs;
    for (const [key, part] of Object.entries(SKIN_PARTS)) {
      const choices = choicesFor(part), index = choices.findIndex(o => o.id === draft[part.field]), row = container.querySelector(`[data-part="${key}"]`), option = choices[index];
      row.querySelector('[data-name]').textContent = option.name;
      row.querySelector('[data-count]').textContent = `${String(index + 1).padStart(2, '0')} / ${String(choices.length).padStart(2, '0')}`;
    }
    container.querySelectorAll('[data-tone]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.tone === draft.skinTone)));
    if (viewer) { viewer.loadSkin(skinCanvas(draft), { model: 'default' }); viewer.playerObject.rotation.y = rotation; viewer.render(); }
    else window.drawVoxelAvatar(canvas, draft);
    onChange({ ...draft });
  }
  function exportSkin() {
    const link = document.createElement('a'); link.download = 'ai-underwatch-skin.png'; link.href = skinCanvas(draft).toDataURL('image/png'); link.click();
  }
  function click(event) {
    const button = event.target.closest('button'); if (!button || !container.contains(button)) return;
    if (locked && !button.dataset.turn) return;
    if (button.dataset.faceStyle) {
      const index = choicesFor(SKIN_PARTS.head).findIndex(o => o.id === draft.headPreset);
      rememberHead();
      draft.faceStyle = button.dataset.faceStyle;
      const choices = choicesFor(SKIN_PARTS.head), corresponding = choices[Math.max(0, Math.min(index, choices.length - 1))];
      Object.assign(draft, headsByStyle[draft.faceStyle] ?? { headPreset: corresponding.id, hairColor: corresponding.hairColor ?? '#49382f' });
    } else if (button.dataset.step) {
      const key = button.closest('[data-part]').dataset.part, part = SKIN_PARTS[key];
      const choices = choicesFor(part), index = choices.findIndex(o => o.id === draft[part.field]);
      const option = choices[(index + Number(button.dataset.step) + choices.length) % choices.length];
      draft[part.field] = option.id; if (key === 'head') draft.hairColor = option.hairColor ?? '#49382f'; if (key === 'torso') draft.tunicColor = option.color;
      if (part.group === 'arms' && draft.linkArms) draft.rightArmPreset = draft.leftArmPreset = option.id;
      if (part.group === 'legs' && draft.linkLegs) draft.rightLegPreset = draft.leftLegPreset = option.id;
    } else if (button.dataset.tone) draft.skinTone = button.dataset.tone;
    else if (button.hasAttribute('data-random')) {
      for (const part of Object.values(SKIN_PARTS)) { const choices = choicesFor(part); draft[part.field] = choices[Math.floor(Math.random() * choices.length)].id; }
      draft.hairColor = SKIN_PARTS.head.options.find(o => o.id === draft.headPreset).hairColor ?? '#49382f';
      draft.tunicColor = SKIN_PARTS.torso.options.find(o => o.id === draft.torsoPreset).color;
    } else if (button.dataset.turn) {
      rotation += Number(button.dataset.turn) * Math.PI / 4;
      if (viewer) {
        // OrbitControls was constructed before SkinViewer positioned its camera.
        // Its initial reset state is inside the model; use the viewer's public
        // reset method to retain a valid framing distance instead.
        viewer.resetCameraPose(); viewer.playerObject.rotation.y = rotation; viewer.render();
      }
      return;
    } else if (button.hasAttribute('data-export')) { exportSkin(); return; } else return;
    rememberHead(); update();
  }
  const change = event => {
    if (locked) return;
    if (event.target.dataset.link === 'arms') draft.linkArms = event.target.checked;
    else if (event.target.dataset.link === 'legs') draft.linkLegs = event.target.checked;
    else return;
    update();
  };
  container.addEventListener('click', click); container.addEventListener('change', change); update();
  function setLocked(value) {
    locked = Boolean(value);
    container.querySelector('.wardrobe-controls').disabled = locked;
    container.querySelector('.wardrobe-lock-status').hidden = !locked;
    container.classList.toggle('is-locked', locked);
  }
  setLocked(locked);
  const resize = () => {
    if (!viewer || dead) return;
    const rect = container.querySelector('.wardrobe-model').getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) viewer.setSize(Math.round(rect.width), Math.round(rect.height));
  };
  const observer = new ResizeObserver(resize); observer.observe(container.querySelector('.wardrobe-model'));
  loadViewer().then(api => {
    if (dead) return;
    const glCanvas = document.createElement('canvas'); glCanvas.setAttribute('aria-label', canvas.getAttribute('aria-label')); canvas.replaceWith(glCanvas);
    try {
      viewer = new api.SkinViewer({ canvas: glCanvas, width: 400, height: 530, pixelRatio: Math.min(devicePixelRatio, 2), skin: skinCanvas(draft), model: 'default' });
      viewer.fov = 35; viewer.zoom = .88; viewer.cameraLight.intensity = .7; viewer.globalLight.intensity = 1.6;
      viewer.controls.enableZoom = false; viewer.controls.enablePan = false; viewer.playerObject.rotation.y = rotation;
      if (!reduced) viewer.animation = new api.IdleAnimation();
      resize(); viewer.render(); container.dataset.renderer = 'minecraft-3d';
    } catch {
      viewer?.dispose(); viewer = null;
      glCanvas.replaceWith(canvas); window.drawVoxelAvatar(canvas, draft); container.dataset.renderer = 'texture-portrait';
    }
  }).catch(() => { container.dataset.renderer = 'texture-portrait'; });
  return { getAppearance: () => ({ ...draft }), exportSkin, setLocked,
    destroy() { dead = true; observer.disconnect(); container.removeEventListener('click', click); container.removeEventListener('change', change); viewer?.dispose(); } };
}
