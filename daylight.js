import { lightState, formatTime } from './solar.js';

const root = document.querySelector('.daylight-clock');
const layer = document.querySelector('.paper-surface');
const clock = root.querySelector('.clock-time');
const phase = root.querySelector('.clock-phase');

function update() {
  const state = lightState(new Date());
  const time = formatTime(Math.floor(state.minutes));
  clock.textContent = time;
  clock.dateTime = `${state.date}T${time}:00+03:00`;
  phase.textContent = state.phase;

  // One window-shaped wash and its shadows share a slowly changing direction.
  // The warmer evening palette stays within the sunlight; the paper stays neutral.
  const evening = state.minutes >= state.noon;
  const green = Math.round(251 - state.warmth * (evening ? 23 : 10));
  const blue = Math.round(238 - state.warmth * (evening ? 48 : 16));
  layer.style.setProperty('--sun-color', `255, ${green}, ${blue}`);
  layer.style.setProperty('--daylight-opacity', state.daylight.toFixed(4));
  layer.style.setProperty('--light-x', `${-16 + state.progress * 23}%`);
  layer.style.setProperty('--light-y', `${-3 + state.highSun * 4}%`);
  layer.style.setProperty('--light-angle', `${-24 + state.progress * 12}deg`);
  layer.style.setProperty('--light-reach', `${86 - state.highSun * 16}%`);
  layer.style.setProperty('--light-blur', `${18 + state.highSun * 8}px`);
  layer.style.setProperty('--near-blur', `${4 + state.highSun * 3}px`);
  layer.style.setProperty('--middle-blur', `${16 + state.highSun * 5}px`);
  layer.style.setProperty('--far-blur', `${38 + state.highSun * 9}px`);
  root.style.setProperty('--clock-color', state.daylight > 0 ? '#bb8a4b' : '#a7a196');
  layer.dataset.daylight = String(state.daylight > 0);
}

document.addEventListener('visibilitychange', () => {
  layer.dataset.paused = String(document.hidden);
  if (!document.hidden) update();
});
setInterval(() => {
  if (!document.hidden) update();
}, 15000);
update();
// Set the initial light immediately; subsequent solar changes interpolate quietly.
requestAnimationFrame(() => requestAnimationFrame(() => { layer.dataset.ready = 'true'; }));
root.hidden = false;
