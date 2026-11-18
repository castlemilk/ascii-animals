// Simulated DOM/RAF/observers with the real Owl core and text sampler.
// These tests do not establish browser rendering, accessibility or device speed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwlArtwork as mountOwl} from '../lib/public/owl.js';
import { createScheduler } from '../src/core/scheduler.js';

const STEP = 1000 / 60;

class TrackedTarget extends EventTarget {
  listeners = new Map();
  addEventListener(type, listener, options) {
    super.addEventListener(type, listener, options);
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener, options) {
    super.removeEventListener(type, listener, options);
    this.listeners.get(type)?.delete(listener);
  }
  get listenerCount() { return [...this.listeners.values()].reduce((total, set) => total + set.size, 0); }
}

function browserHarness() {
  const queue = new Map();
  let nextFrame = 1;
  const observers = { resize: new Set(), intersection: new Set() };
  const allObservers = [];
  const view = new TrackedTarget();
  view.innerWidth = 1400;
  view.innerHeight = 1000;
  view.requestAnimationFrame = callback => { const id = nextFrame++; queue.set(id, callback); return id; };
  view.cancelAnimationFrame = id => queue.delete(id);
  const media = new TrackedTarget();
  media.matches = false;
  view.matchMedia = () => media;
  const doc = new TrackedTarget();
  doc.hidden = false;
  doc.defaultView = view;
  class Element extends TrackedTarget {
    children = [];
    parentNode = null;
    style = {};
    textContent = '';
    attributes = new Map();
    ownerDocument = doc;
    rect = { left: 10, top: 10, width: 960, height: 540 };
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
    remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    getBoundingClientRect() { const r = this.rect; return { ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height }; }
  }
  doc.createElement = () => new Element();
  class ResizeObserver {
    constructor(callback) { this.callback = callback; this.target = null; observers.resize.add(this); allObservers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { observers.resize.delete(this); }
  }
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; this.target = null; observers.intersection.add(this); allObservers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { observers.intersection.delete(this); }
  }
  const host = new Element();
  const environment = { document: doc, requestFrame: view.requestAnimationFrame, cancelFrame: view.cancelAnimationFrame,
    matchMedia: () => media, ResizeObserver, IntersectionObserver };
  return { host, view, doc, media, queue, observers, allObservers, environment, Element,
    mount(options = {}) { return mountOwl(host, { environment, ...options }); },
    frame(timestamp) { const callbacks = [...queue.values()]; queue.clear(); for (const callback of callbacks) callback(timestamp); },
    intersect(value = true) {
      for (const observer of [...observers.intersection]) observer.callback([{ target: observer.target, isIntersecting: value, intersectionRatio: value ? 1 : 0 }]);
    },
    resize(width, height) {
      host.rect.width = width; host.rect.height = height;
      for (const observer of [...observers.resize]) observer.callback([{ target: observer.target }]);
    },
    hidden(value) { doc.hidden = value; doc.dispatchEvent(new Event('visibilitychange')); },
    reduced(value) { media.matches = value; media.dispatchEvent(new Event('change')); },
    pointer(type, x = 720, y = 240) { const event = new Event(type); Object.assign(event, { clientX: x, clientY: y, pointerType: 'mouse' }); host.dispatchEvent(event); },
    get resourceCount() { return queue.size + observers.resize.size + observers.intersection.size + host.listenerCount + view.listenerCount + doc.listenerCount + media.listenerCount; },
  };
}

test('public Owl factory retains semantic text and uses a shared scheduler by default',()=>{
 const h=browserHarness();const {requestFrame,cancelFrame,...environment}=h.environment;
 const a=mountOwl(h.host,{environment}),other=new h.Element(),b=mountOwl(other,{environment});
 h.intersect();assert.equal(h.queue.size,1);h.frame(0);h.frame(STEP);assert.equal(a.getSnapshot().simulation.tick,1);assert.equal(b.getSnapshot().simulation.tick,1);
 a.pause();const frozen=a.getSnapshot().simulation;a.pulse();h.frame(STEP*2);assert.equal(a.getSnapshot().simulation,frozen);assert.equal(h.queue.size,1);
 a.restart();assert(a.getStatus().paused);b.pause();assert.equal(h.queue.size,0);a.dispose();b.dispose();assert.equal(h.resourceCount,0);assert(a.disposed);
});
test('public Owl factory keeps reduced-motion and invalid scheduler contracts',()=>{
 const h=browserHarness();assert.throws(()=>mountOwl(h.host,{frameSource:null}));h.media.matches=true;
 const a=h.mount();h.intersect();a.play();assert.equal(a.pulse().kind,'poster');assert.equal(h.queue.size,0);assert.equal(a.getSnapshot().simulation.tick,0);assert(a.exportText().length>100);a.dispose();
});
