import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { lightState } from '../solar.js';

const source = readFileSync(new URL('../evening-light.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/, '');
const atMinute = minutes => new Date(Date.parse('2026-10-10T21:00:00Z') + minutes * 60000);

function renderer({ reducedMotion = false, minute = 750 } = {}) {
  const frames = new Map();
  const events = new Map();
  const uniforms = new Map();
  const classes = new Set();
  let draws = 0;
  let frameId = 0;
  let changeLight;
  const initial = lightState(atMinute(minute));
  const gl = new Proxy({
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getUniformLocation: (_, name) => name,
    uniform1f: (name, value) => uniforms.set(name, value),
    uniform4fv: (name, value) => uniforms.set(name, [...value]),
    uniform3fv: (name, value) => uniforms.set(name, [...value]),
    drawArrays: () => draws++,
  }, { get: (target, name) => target[name] ?? (() => ({})) });
  const canvas = {
    getContext: () => gl,
    addEventListener: (name, callback) => events.set(name, callback),
  };
  const layer = {
    querySelector: () => canvas,
    classList: { add: value => classes.add(value), remove: value => classes.delete(value) },
  };
  const document = { hidden: false, querySelector: () => layer,
    addEventListener: (name, callback) => events.set(name, callback) };
  const media = { matches: reducedMotion, addEventListener: (name, callback) => events.set(`media:${name}`, callback) };
  runInNewContext(source, {
    currentLight: () => initial,
    onLightChange: callback => { changeLight = callback; },
    document,
    window: { innerWidth: 1440, innerHeight: 960, devicePixelRatio: 2,
      matchMedia: () => media, addEventListener: (name, callback) => events.set(name, callback) },
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  return {
    frames, uniforms, classes, document, media, events,
    draws: () => draws,
    change: minute => changeLight(lightState(atMinute(minute))),
    step: timestamp => {
      const [id, callback] = frames.entries().next().value ?? [];
      if (callback) { frames.delete(id); callback(timestamp); }
    },
  };
}

test('reduced motion renders the current light without animation frames', () => {
  const render = renderer({ reducedMotion: true });
  assert.equal(render.frames.size, 0);
  const before = render.draws();
  render.change(1320);
  assert.deepEqual(render.uniforms.get('u_cycle').slice(0, 3), [0, 1, 1]);
  assert.equal(render.frames.size, 0);
  assert.ok(render.draws() > before);
});

test('nighttime stops drawing after transitions settle and daylight restarts it', () => {
  const render = renderer({ minute: 1320 });
  render.step(0);
  assert.equal(render.frames.size, 0);
  render.change(750);
  assert.equal(render.frames.size, 1);
  for (let step = 0; step < 120; step++) render.step(step * 40);
  assert.ok(render.uniforms.get('u_cycle')[0] > 0.99);
  render.change(1320);
  for (let step = 0; step < 120; step++) render.step(step * 40);
  assert.equal(render.frames.size, 0);
  assert.ok(render.uniforms.get('u_cycle')[2] > 0.99);
});

test('hidden pages stop drawing and a discarded WebGL context shows the fallback', () => {
  const render = renderer();
  render.document.hidden = true;
  render.events.get('visibilitychange')();
  assert.equal(render.frames.size, 0);
  render.document.hidden = false;
  render.events.get('visibilitychange')();
  assert.equal(render.frames.size, 1);
  render.events.get('webglcontextlost')();
  assert.equal(render.frames.size, 0);
  assert.equal(render.classes.has('is-ready'), false);
  render.change(1320);
  assert.equal(render.frames.size, 0);
});
