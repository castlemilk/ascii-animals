import assert from 'node:assert/strict';
import test from 'node:test';
import { mountPufferfishCharacter } from '../build/character.js';
import { mountPufferfish } from '../build/controller.js';
import { fakeBrowser, legacy } from './fake-browser.mjs';

test('Reef Curmudgeon is a private opt-in with one lifecycle and no effect on the original', () => {
  const originalHost = fakeBrowser();
  const alternateHost = fakeBrowser();
  const options = { species: { seed: 23 }, paused: true, render: { view: 'front' } };
  const original = mountPufferfish(originalHost.canvas, legacy, options);
  const alternate = mountPufferfishCharacter(alternateHost.canvas, options);
  assert.deepEqual(alternate.getSnapshot(), original.getSnapshot());
  assert.notEqual(alternate.exportText(), original.exportText());
  assert.match(alternate.exportText(), /^[ -~\n]+$/);
  assert.equal(alternateHost.rafs.size, 0);
  assert.equal(originalHost.rafs.size, 0);
  const frozenOriginal = original.exportText();
  assert.equal(alternate.approach().kind, 'static-poster');
  const inflated = alternate.exportText();
  assert.equal(alternate.retreat().kind, 'static-poster');
  assert.notEqual(alternate.exportText(), inflated);
  assert.equal(original.exportText(), frozenOriginal);

  alternate.setPaused(false);
  assert.equal(alternateHost.rafs.size, 1, 'only the controller owns RAF');
  alternateHost.reduce(true);
  assert.equal(alternateHost.rafs.size, 0);
  alternate.destroy();
  assert.equal(alternateHost.resources().listeners, 0);
  assert.equal(alternateHost.resources().observedTargets, 0);
  assert.equal(original.getStatus().destroyed, false);
  original.destroy();
});

test('unsupported Canvas rolls back the alternate mount', () => {
  const environment = fakeBrowser({ noCanvas: true });
  assert.throws(() => mountPufferfishCharacter(environment.canvas), /Canvas 2D unavailable/);
  assert.equal(environment.resources().listeners, 0);
  assert.equal(environment.resources().observedTargets, 0);
  assert.equal(environment.resources().rafs, 0);
});
