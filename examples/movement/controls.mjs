/**
 * A small, framework-neutral controls view. The port owns playback and motion
 * policy. This view never schedules animation or installs page-wide shortcuts.
 * Importing it is safe without a DOM; call mount only after the host exists.
 * @param {HTMLElement} host
 * @param {import('./controls.js').MovementControlsPort} port
 * @returns {import('./controls.js').MovementControls}
 */
export function mountMovementControls(host, port) {
  const document = host?.ownerDocument;
  if (!document || typeof host.appendChild !== 'function') {
    throw new TypeError('Movement controls need a browser element.');
  }
  for (const name of ['getMovementControls', 'configureMovementControls', 'toggleMovementPause',
    'reverseMovement', 'restartMovement', 'showMovementStill']) {
    if (typeof port?.[name] !== 'function') throw new TypeError(`Movement controls need ${name}().`);
  }

  let serial = 1;
  while (document.getElementById(`movement-controls-${serial}`)) serial++;
  const prefix = `movement-controls-${serial}`;
  const disposers = [];
  const fields = new Map();
  let disposed = false;
  let lastStatus = '';
  let invalidField = null;

  function element(tag, className = '', text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  function listen(node, type, listener) {
    node.addEventListener(type, listener);
    disposers.push(() => node.removeEventListener(type, listener));
  }
  function describe(node, id) {
    const before = node.getAttribute('aria-describedby');
    node.setAttribute('aria-describedby', before ? `${before} ${id}` : id);
  }
  const root = element('section', 'movement-controls');
  root.id = prefix;
  root.setAttribute('aria-labelledby', `${prefix}-title`);
  const heading = element('h2', 'movement-controls__title', 'Across-screen journey');
  heading.id = `${prefix}-title`;
  const introduction = element('p', 'movement-controls__intro',
    'Choose how the cast travels. Their natural reactions remain part of the scene.');
  root.append(heading, introduction);

  const error = element('p', 'movement-controls__error');
  error.id = `${prefix}-error`;
  error.setAttribute('role', 'alert');
  error.hidden = true;
  const status = element('p', 'movement-controls__status');
  status.id = `${prefix}-status`;
  status.setAttribute('role', 'status');
  status.setAttribute('aria-atomic', 'true');

  function clearError() {
    if (invalidField) {
      invalidField.removeAttribute('aria-invalid');
      const ids = (invalidField.getAttribute('aria-describedby') ?? '')
        .split(' ').filter(id => id && id !== error.id);
      if (ids.length) invalidField.setAttribute('aria-describedby', ids.join(' '));
      else invalidField.removeAttribute('aria-describedby');
    }
    invalidField = null;
    error.textContent = '';
    error.hidden = true;
  }
  function fail(reason, field) {
    clearError();
    if (field) {
      invalidField = field;
      field.setAttribute('aria-invalid', 'true');
      describe(field, error.id);
    }
    error.textContent = reason instanceof Error ? reason.message : 'The setting could not be applied.';
    error.hidden = false;
  }
  function invoke(action, field) {
    if (disposed) return;
    try {
      action();
      clearError();
      refresh();
    } catch (reason) {
      fail(reason, field);
    }
  }
  function commit(key, value, field) {
    invoke(() => port.configureMovementControls({ [key]: value }), field);
  }

  function checkbox(key, label, parent) {
    const wrapper = element('label', 'movement-controls__check');
    const input = element('input');
    input.type = 'checkbox';
    input.id = `${prefix}-${key}`;
    input.name = key;
    wrapper.append(input, element('span', '', label));
    parent.appendChild(wrapper);
    fields.set(key, { input });
    listen(input, 'change', () => commit(key, input.checked, input));
    return input;
  }
  const enabled = checkbox('enabled', 'Travel across the viewport', root);
  const naturalHint = element('p', 'movement-controls__hint',
    'Turn this off to return to the scene’s natural movement.');
  naturalHint.id = `${prefix}-natural-hint`;
  describe(enabled, naturalHint.id);
  root.appendChild(naturalHint);

  const settings = element('fieldset', 'movement-controls__settings');
  settings.appendChild(element('legend', 'movement-controls__legend', 'Journey settings'));
  const mainGrid = element('div', 'movement-controls__grid');
  settings.appendChild(mainGrid);

  function select(key, label, choices, parent) {
    const wrapper = element('div', 'movement-controls__field');
    const caption = element('label', 'movement-controls__label', label);
    const input = element('select', 'movement-controls__select');
    input.id = `${prefix}-${key}`;
    input.name = key;
    caption.htmlFor = input.id;
    for (const [value, text] of choices) {
      const option = element('option', '', text);
      option.value = value;
      input.appendChild(option);
    }
    wrapper.append(caption, input);
    parent.appendChild(wrapper);
    fields.set(key, { input, wrapper });
    listen(input, 'change', () => commit(key, input.value, input));
    return input;
  }
  select('path', 'Journey path', [['horizontal', 'Horizontal'], ['vertical', 'Vertical'],
    ['diagonal', 'Diagonal'], ['free', 'Free · seeded curve']], mainGrid);
  select('direction', 'Route direction', [['forward', 'Forward'], ['reverse', 'Reverse']], mainGrid);
  select('timing', 'Set pace by', [['duration', 'Travel duration'], ['speed', 'Travel speed']], mainGrid);

  function number(key, label, { min, max, step = 1, unit = '', slider = false }, parent) {
    const wrapper = element('div', 'movement-controls__field');
    const caption = element('label', 'movement-controls__label', label);
    const input = element('input', 'movement-controls__number');
    input.type = 'number';
    input.id = `${prefix}-${key}`;
    input.name = key;
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.inputMode = step === 1 ? 'numeric' : 'decimal';
    caption.htmlFor = input.id;
    const row = element('div', 'movement-controls__number-row');
    row.appendChild(input);
    if (unit) {
      const suffix = element('span', 'movement-controls__unit', unit);
      suffix.id = `${input.id}-unit`;
      row.appendChild(suffix);
      describe(input, suffix.id);
    }
    wrapper.append(caption, row);
    let range;
    if (slider) {
      range = element('input', 'movement-controls__range');
      range.type = 'range';
      range.min = input.min;
      range.max = input.max;
      range.step = input.step;
      range.setAttribute('aria-label', `${label}${unit ? ` (${unit})` : ''}`);
      wrapper.appendChild(range);
      listen(range, 'input', () => { input.value = range.value; });
      listen(range, 'change', () => commit(key, Number(range.value), range));
    }
    parent.appendChild(wrapper);
    fields.set(key, { input, range, wrapper });
    listen(input, 'change', () => {
      invoke(() => {
        const value = input.value.trim() === '' ? NaN : Number(input.value);
        if (!Number.isFinite(value) || value < min || value > max || (step === 1 && !Number.isInteger(value))) {
          throw new RangeError(`${label} must be ${step === 1 ? 'a whole number ' : ''}between ${min} and ${max}${unit ? ` ${unit}` : ''}.`);
        }
        port.configureMovementControls({ [key]: value });
      }, input);
    });
    return wrapper;
  }
  const duration = number('durationSeconds', 'Travel duration', { min: 2, max: 120, step: .5, unit: 's', slider: true }, mainGrid);
  const speed = number('speedPixelsPerSecond', 'Travel speed', { min: 10, max: 300, step: 1, unit: 'px/s', slider: true }, mainGrid);
  number('lingerSeconds', 'Pause in the middle', { min: 0, max: 30, step: .5, unit: 's' }, mainGrid);
  checkbox('repeat', 'Repeat the journey', settings);

  const details = element('details', 'movement-controls__details');
  details.appendChild(element('summary', '', 'Lanes, spacing and seed'));
  const castGrid = element('div', 'movement-controls__grid');
  number('lanes', 'Lanes', { min: 1, max: 3 }, castGrid);
  number('staggerSeconds', 'Time between arrivals', { min: 0, max: 10, step: .1, unit: 's' }, castGrid);
  number('edgePadding', 'Space beyond the edge', { min: 0, max: 240, step: 1, unit: 'px' }, castGrid);
  number('seed', 'Journey seed', { min: 0, max: 4294967295, step: 1 }, castGrid);
  details.appendChild(castGrid);
  details.appendChild(element('p', 'movement-controls__hint',
    'The same seed recreates the same route. Lanes and stagger control where and when cast members arrive.'));
  settings.appendChild(details);
  root.appendChild(settings);

  const policy = element('p', 'movement-controls__policy');
  policy.id = `${prefix}-policy`;
  root.appendChild(policy);
  const actions = element('div', 'movement-controls__actions');
  actions.setAttribute('role', 'group');
  actions.setAttribute('aria-label', 'Journey playback');
  function button(text, method, primary = false) {
    const node = element('button', `movement-controls__button${primary ? ' movement-controls__button--primary' : ''}`, text);
    node.type = 'button';
    listen(node, 'click', () => invoke(method));
    actions.appendChild(node);
    return node;
  }
  const pause = button('Pause', () => port.toggleMovementPause(), true);
  const reverse = button('Reverse now', () => port.reverseMovement());
  const restart = button('Restart journey', () => port.restartMovement());
  const still = button('Show midpoint', () => port.showMovementStill(.5));
  describe(pause, policy.id);
  describe(still, policy.id);
  root.append(actions, error, status);

  function refresh() {
    if (disposed) return;
    const state = port.getMovementControls();
    if (!state || typeof state !== 'object') throw new TypeError('Movement controls need a state snapshot.');
    for (const [key, field] of fields) {
      if (field.input === invalidField || field.range === invalidField) continue;
      if (field.input.type === 'checkbox') field.input.checked = Boolean(state[key]);
      else field.input.value = String(state[key]);
      if (field.range) field.range.value = String(state[key]);
    }
    settings.disabled = !state.enabled;
    duration.hidden = state.timing !== 'duration';
    speed.hidden = state.timing !== 'speed';
    // Journey settings can change a still without reopening the playback gate.
    pause.disabled = state.reducedMotion;
    pause.textContent = state.reducedMotion ? 'Reduced motion · still' : state.paused ? 'Play' : 'Pause';
    reverse.disabled = !state.enabled;
    restart.disabled = !state.enabled;
    still.disabled = !state.enabled;
    policy.textContent = state.reducedMotion
      ? 'Reduced motion is on. Settings, reverse and midpoint update a still; automatic travel stays off.'
      : 'Pause holds the current pose. Show midpoint makes a still without starting playback.';
    const nextStatus = String(state.status ?? '');
    if (nextStatus !== lastStatus) {
      status.textContent = nextStatus;
      lastStatus = nextStatus;
    }
  }

  try {
    refresh();
    host.appendChild(root);
  } catch (reason) {
    for (const dispose of disposers.splice(0)) dispose();
    root.remove();
    throw reason;
  }
  return Object.freeze({
    refresh,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const dispose of disposers.splice(0)) dispose();
      root.remove();
    }
  });
}
