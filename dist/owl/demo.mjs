import { createOwlArtwork as mountOwl } from './runtime/public/owl.js';

const byId = id => document.getElementById(id);
const host = byId('owl-host');
const announcement = byId('announcement');
const phaseLabel = status => {
  const behavior = status.behavior;
  if (status.displayedPoster === 'react') return 'Still / wing stretch';
  if (status.displayedPoster === 'attention') return 'Still / attention';
  if (!status.running) return 'Still / resting';
  if (behavior.kind === 'response') return ({ blink: 'A blink', ruffle: 'Feather ruffle', stretch: 'Wing stretch' })[behavior.phase];
  return ({ idle: 'Quietly perched', approach: 'Following your attention', recovery: 'Returning to rest', cooldown: 'Settling' })[behavior.kind];
};
let controller;
let lastPolicy;

function statusChanged(status) {
  byId('pause').textContent = status.paused ? 'Play' : 'Pause';
  byId('pause').setAttribute('aria-pressed', String(status.paused));
  byId('mode').textContent = status.running ? 'Live text study' : 'Static text study';
  byId('behavior').textContent = phaseLabel(status);
  byId('grid-label').textContent = `${status.cols} × ${status.rows} CELLS`;
  byId('detail').value = String(status.cols);
  let message = 'The wings stay folded between reactions.';
  if (status.blockedBy.includes('reduced-motion')) message = 'Reduced motion is on. Guide and React choose one still pose; the animation stays stopped.';
  else if (status.blockedBy.includes('small-container')) message = 'This small display uses a still poster. Guide and React can change its pose.';
  else if (status.blockedBy.includes('motion-preference-unavailable') || status.blockedBy.includes('animation-unavailable')) message = 'This browser is using the static preview. Guide and React can change its pose.';
  else if (status.paused) message = 'Paused. Guide and React show still poses. Reset keeps this pause.';
  else if (!status.running) message = 'Motion rests while the artwork is hidden or outside the view.';
  byId('policy').textContent = message;
  const policy = status.blockedBy.join(',');
  if (lastPolicy !== undefined && lastPolicy !== policy) announcement.textContent = message;
  lastPolicy = policy;
}

function action(callback) {
  try { callback(); }
  catch (error) {
    announcement.textContent = `The preview could not complete this action: ${error instanceof Error ? error.message : String(error)}`;
  }
}

try {
  controller = mountOwl(host, { owl: { seed: 7, reactionStrength: 0.8 }, onStatus: statusChanged });
  byId('fallback').hidden = true;
  // Explicit demo diagnostics for reproduction; not a library/global API export.
  window.owlDemo = Object.freeze({ controller, host });
} catch (error) {
  byId('mode').textContent = 'Text preview unavailable';
  announcement.textContent = `The description remains available. ${error instanceof Error ? error.message : String(error)}`;
  for (const element of document.querySelectorAll('button,select,input')) element.disabled = true;
}

byId('pause').addEventListener('click', () => action(() => {
  controller.setPaused(!controller.getStatus().paused);
  announcement.textContent = controller.getStatus().paused ? 'Motion paused.' : controller.getStatus().running ? 'Motion playing.' : byId('policy').textContent;
}));
byId('reset').addEventListener('click', () => action(() => {
  controller.reset(7);
  byId('guide').value = 'rest';
  announcement.textContent = controller.getStatus().paused ? 'Owl reset. Motion remains paused.' : 'Owl reset to its initial pose.';
}));
byId('react').addEventListener('click', () => action(() => {
  const result = controller.react();
  announcement.textContent = result.kind === 'poster' ? 'Still wing-stretch pose.' : 'Reaction requested. The owl completes its current gesture and cooldown before it can react again.';
}));
byId('guide').addEventListener('change', event => action(() => {
  const value = event.target.value;
  const directions = { left: [-0.9, 0], right: [0.9, 0], up: [0, -0.8], down: [0, 0.8] };
  if (value === 'rest') controller.leave(); else controller.guide(...directions[value]);
  announcement.textContent = value === 'rest' ? 'Attention returns to rest.' : `Attention directed ${value}.`;
}));
byId('detail').addEventListener('change', event => action(() => {
  const cols = Number(event.target.value);
  controller.setGrid({ cols, rows: cols * 9 / 16 });
  announcement.textContent = `Text detail set to ${cols} by ${cols * 9 / 16} cells.`;
}));
byId('head-limit').addEventListener('input', event => action(() => {
  const value = Number(event.target.value);
  controller.update({ headYawLimitDeg: value });
  byId('head-value').value = `${value}°`;
}));
byId('reaction').addEventListener('input', event => action(() => {
  const value = Number(event.target.value);
  controller.update({ reactionStrength: value / 100 });
  byId('reaction-value').value = `${value}%`;
}));
byId('download').addEventListener('click', () => action(() => {
  const text = controller.exportText();
  const url = URL.createObjectURL(new Blob([text + '\n'], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `owl-frame-${String(controller.getStatus().tick).padStart(5, '0')}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  announcement.textContent = 'The current text frame is ready to download.';
}));
const refreshText = () => action(() => { byId('text-output').value = controller.exportText(); });
byId('text-frame').addEventListener('toggle', event => { if (event.target.open) refreshText(); });
byId('refresh-text').addEventListener('click', () => { refreshText(); announcement.textContent = 'Selectable text frame refreshed.'; });
window.addEventListener('pagehide', event => { if (!event.persisted) controller?.dispose(); });
