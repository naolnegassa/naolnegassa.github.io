import { lightState, formatTime } from './solar.js';

let state = lightState(new Date());
const listeners = new Set();
const root = document.querySelector('.daylight-clock');
const layer = document.querySelector('.evening-light');

export const currentLight = () => state;
export function onLightChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function update() {
  state = lightState(new Date());
  const time = formatTime(Math.floor(state.minutes));
  root.querySelector('.clock-time').textContent = time;
  root.querySelector('.clock-time').dateTime = `${state.date}T${time}:00+03:00`;
  root.querySelector('.clock-phase').textContent = state.phase;
  // The still CSS fallback follows the same clock if WebGL isn't available.
  const x = Math.round(state.sunX * 100);
  const y = Math.round(state.sunY * 100);
  layer.style.background = `
    radial-gradient(ellipse at 98% 78%, rgba(245, 187, 113, ${state.lamp * 0.28}), transparent 75%),
    radial-gradient(ellipse at ${x}% ${y}%, rgba(239, 179, 104, ${state.daylight * state.warmth * 0.24}), transparent 75%),
    linear-gradient(116deg, transparent 32%, rgba(139, 108, 76, ${state.daylight * 0.06}) 45%, transparent 56%),
    rgb(${Math.round(244 - state.lamp * 7)}, ${Math.round(241 - state.lamp * 4)}, ${Math.round(233 + state.lamp * 3)})`;
  for (const listener of listeners) listener(state);
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) update();
});
setInterval(() => {
  if (!document.hidden) update();
}, 15000);
update();
root.hidden = false;
