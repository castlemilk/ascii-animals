import assert from 'node:assert/strict';
import test from 'node:test';
import { fakeBrowser } from '../../test/helpers/fake-browser.mjs';
import { createInkPuppetVariant } from '../src/lib/ink-puppet.mjs';
import { activateInkPuppetAction } from '../src/lib/ink-puppet-actions.mjs';

test('Ink Puppet shell adapter starts paused, then removes its native scheduler and observers on dispose', () => {
  const host = fakeBrowser();
  const canvas = host.canvas(390, 410);
  const { controller, playback } = createInkPuppetVariant(canvas);
  assert(controller.paused);
  assert.equal(host.pending, 0);
  playback.play();
  assert.equal(host.pending, 1);
  host.frame();
  host.frame();
  assert(controller.getStats().tick > 0);
  playback.pause();
  playback.restart();
  assert(controller.paused);
  assert.equal(host.pending, 0);
  playback.dispose();
  playback.dispose();
  playback.play();
  assert(playback.disposed);
  assert.equal(host.pending, 0);
  assert.equal(canvas.listenerCount + host.document.listenerCount + host.view.listenerCount + host.motion.listenerCount, 0);
  assert.equal(host.resizes.size + host.intersections.size, 0);
  assert.equal(activateInkPuppetAction(controller, 'investigate', false), 'unavailable');
});

test('buttons trigger distinct aimed actions and choose the next canvas tap tool', () => {
  const host = fakeBrowser();
  const canvas = host.canvas(390, 410);
  const {controller, playback} = createInkPuppetVariant(canvas);
  playback.play();
  assert.equal(activateInkPuppetAction(controller, 'investigate', false), 'animated');
  assert.equal(controller.getState().action.kind, 'investigate');
  assert.deepEqual(controller.getState().action.target, {x:.22,y:-.12});
  playback.restart();
  assert.equal(activateInkPuppetAction(controller, 'retreat', false), 'animated');
  assert.equal(controller.getState().action.kind, 'retreat');
  assert.deepEqual(controller.getState().action.target, {x:-.22,y:.08});
  playback.restart();
  canvas.emit('pointerdown', {pointerType:'touch',clientX:300,clientY:150});
  assert.equal(controller.getState().action.kind, 'retreat');
  assert(controller.getState().action.target.x > 0);
  playback.dispose();
});

test('paused and system-reduced actions are deliberate stills, never playback', () => {
  for (const reducedMotion of [false,true]) {
    const host = fakeBrowser({ reducedMotion });
    const { controller, playback } = createInkPuppetVariant(host.canvas());
    if (reducedMotion) playback.play();
    assert.equal(activateInkPuppetAction(controller, 'retreat', !reducedMotion), 'still');
    assert.equal(controller.getState().action.kind, 'retreat');
    assert(controller.paused);
    assert.equal(host.pending, 0);
    if (reducedMotion) {
      playback.play();
      assert.equal(host.pending, 0);
    }
    playback.dispose();
  }
});
