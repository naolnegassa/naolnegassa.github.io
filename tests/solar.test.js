import test from 'node:test';
import assert from 'node:assert/strict';
import { addisCalendar, solarDay, lightState, formatTime } from '../solar.js';

const atMinute = minutes => new Date(Date.parse('2026-10-10T21:00:00Z') + minutes * 60000);

test('Addis calendar crosses midnight independently of the visitor timezone', () => {
  assert.deepEqual(addisCalendar(new Date('2026-10-11T21:05:00Z')), {
    year: 2026, month: 9, day: 12, minutes: 5,
  });
});

test('October solar times agree with published Addis times within two minutes', () => {
  // https://www.timeanddate.com/sun/ethiopia/addis-ababa?month=10&year=2026
  const solar = solarDay(new Date('2026-10-11T12:00:00Z'));
  assert.ok(Math.abs(solar.sunrise - 372) < 2);
  assert.ok(Math.abs(solar.sunset - 1090) < 2);
});

test('solar events adjust seasonally instead of using fixed clock hours', () => {
  const june = solarDay(new Date('2026-06-21T12:00:00Z'));
  const december = solarDay(new Date('2026-12-21T12:00:00Z'));
  assert.ok(june.sunset - june.sunrise > december.sunset - december.sunrise + 50);
});

test('sunlight fades away at night and returns during the day', () => {
  const night = lightState(atMinute(22 * 60));
  const noon = lightState(atMinute(12 * 60 + 30));
  assert.equal(night.phase, 'Night');
  assert.equal(night.daylight, 0);
  assert.equal(night.progress, 1);
  assert.equal(noon.phase, 'Daylight');
  assert.equal(noon.daylight, 1);
  assert.ok(noon.progress > 0.4 && noon.progress < 0.6);
});

test('sunlight fades gradually through dusk to neutral paper', () => {
  const date = new Date('2026-10-11T12:00:00Z');
  const { sunset } = solarDay(date);
  const before = lightState(atMinute(sunset - 20));
  const during = lightState(atMinute(sunset + 10));
  const after = lightState(atMinute(sunset + 30));
  assert.ok(before.daylight > during.daylight && during.daylight > after.daylight);
  assert.ok(during.daylight > 0 && during.daylight < 1);
  assert.equal(after.daylight, 0);
});

test('the solar cycle stays continuous across midnight and works in leap years', () => {
  const late = lightState(new Date('2028-02-29T20:59:59Z'));
  const early = lightState(new Date('2028-02-29T21:00:00Z'));
  assert.equal(late.date, '2028-02-29');
  assert.equal(early.date, '2028-03-01');
  assert.equal(late.daylight, early.daylight);
  for (const date of [new Date('2028-02-29T12:00:00Z'), new Date('2028-12-31T23:00:00Z')]) {
    const state = lightState(date);
    assert.ok(Number.isFinite(state.altitude));
    assert.ok(state.sunrise < state.noon && state.noon < state.sunset);
  }
});

test('times use a consistent 24-hour clock', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(1439), '23:59');
  assert.equal(formatTime(1440), '00:00');
});
