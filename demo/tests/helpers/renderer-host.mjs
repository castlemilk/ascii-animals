// Extends the repository's existing numerical/RAF harness with DOM ownership
// bookkeeping. Canvas draw calls remain no-ops: this is NOT a layout engine,
// browser, accessibility check, pixel comparison or performance benchmark.
import { fakeBrowser } from '../../../test/helpers/fake-browser.mjs';

export function rendererHost({ reducedMotion = false } = {}) {
  const browser = fakeBrowser({ reducedMotion });
  const elements = [];
  browser.view.innerWidth = 1440;
  browser.view.innerHeight = 1000;

  function element(tagName = 'div') {
    const node = browser.canvas(960, 540);
    node.nodeName = node.tagName = tagName.toUpperCase();
    node.nodeType = 1;
    node.children = [];
    node.parentNode = null;
    node.style = {};
    node.dataset = {};
    node.attributes = new Map();
    node.textContent = '';
    node.setAttribute = (name, value) => node.attributes.set(name, String(value));
    node.getAttribute = name => node.attributes.get(name) ?? null;
    node.appendChild = child => {
      child.remove();
      node.children.push(child);
      child.parentNode = node;
      return child;
    };
    node.remove = () => {
      const parent = node.parentNode;
      if (parent) parent.children.splice(parent.children.indexOf(node), 1);
      node.parentNode = null;
    };
    const readRect = node.getBoundingClientRect;
    node.getBoundingClientRect = () => {
      const rect = readRect();
      return { ...rect, x: rect.left, y: rect.top, right: rect.left + rect.width, bottom: rect.top + rect.height };
    };
    // Dragonfly's real renderer measures its font cell. Fixed metrics exercise
    // the numerical renderer without pretending to verify browser typography.
    node.getContext().measureText = () => ({ width: 6 });
    elements.push(node);
    return node;
  }

  browser.document.createElement = element;
  const host = element();
  const sibling = element('p');
  sibling.textContent = 'Caller-owned fallback and description';
  host.appendChild(sibling);

  return {
    ...browser,
    // Spreading a getter would freeze its initial value, so expose live counts.
    get pending() { return browser.pending; },
    get now() { return browser.now; },
    host, sibling, elements,
    intersectAll(isIntersecting = true) {
      for (const observer of [...browser.intersections]) {
        observer.callback([{ target: observer.target, isIntersecting, intersectionRatio: isIntersecting ? 1 : 0 }]);
      }
    },
    get resourceCount() {
      return browser.pending + browser.resizes.size + browser.intersections.size
        + browser.view.listenerCount + browser.document.listenerCount + browser.motion.listenerCount
        + elements.reduce((total, node) => total + node.listenerCount, 0);
    },
  };
}
