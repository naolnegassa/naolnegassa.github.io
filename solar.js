// Approximate solar geometry from NOAA's General Solar Position Calculations:
// https://gml.noaa.gov/grad/solcalc/solareqns.PDF
// Addis Ababa uses UTC+3 year-round. All calendar arithmetic is explicitly UTC.
export const ADDIS = Object.freeze({ latitude: 9.03, longitude: 38.75, utcOffset: 3 });
const radians = Math.PI / 180;
const dayMs = 86400000;
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));

function smooth(low, high, value) {
  const t = clamp((value - low) / (high - low));
  return t * t * (3 - 2 * t);
}

export function addisCalendar(date) {
  const local = new Date(date.getTime() + ADDIS.utcOffset * 3600000);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth(),
    day: local.getUTCDate(),
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes() + local.getUTCSeconds() / 60,
  };
}

export function solarDay(date) {
  const calendar = addisCalendar(date);
  const yearStart = Date.UTC(calendar.year, 0, 1);
  const yearLength = (Date.UTC(calendar.year + 1, 0, 1) - yearStart) / dayMs;
  const dayOfYear = (Date.UTC(calendar.year, calendar.month, calendar.day) - yearStart) / dayMs + 1;
  const gamma = 2 * Math.PI / yearLength * (dayOfYear - 1);
  const equation = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma)
    - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma)
    - 0.040849 * Math.sin(2 * gamma));
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const latitude = ADDIS.latitude * radians;
  const hourAngle = Math.acos(clamp(
    Math.cos(90.833 * radians) / (Math.cos(latitude) * Math.cos(declination))
      - Math.tan(latitude) * Math.tan(declination), -1, 1,
  )) / radians;
  const noon = 720 - 4 * ADDIS.longitude - equation + ADDIS.utcOffset * 60;
  return {
    ...calendar, declination, noon,
    sunrise: noon - 4 * hourAngle,
    sunset: noon + 4 * hourAngle,
    date: `${calendar.year}-${String(calendar.month + 1).padStart(2, '0')}-${String(calendar.day).padStart(2, '0')}`,
  };
}

export function formatTime(minutes) {
  const rounded = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
}

export function lightState(date) {
  const solar = solarDay(date);
  const minutes = solar.minutes;
  const hourAngle = (minutes - solar.noon) / 4 * radians;
  const latitude = ADDIS.latitude * radians;
  const altitude = Math.asin(clamp(
    Math.sin(latitude) * Math.sin(solar.declination)
      + Math.cos(latitude) * Math.cos(solar.declination) * Math.cos(hourAngle), -1, 1,
  )) / radians;
  const daylight = smooth(-6, 4, altitude);
  const highSun = smooth(8, 55, altitude);
  const warmth = 1 - smooth(6, 45, altitude);
  const progress = clamp((minutes - solar.sunrise) / (solar.sunset - solar.sunrise));
  let phase = 'Daylight';
  if (altitude < -6) phase = 'Night';
  else if (minutes < solar.noon && altitude < 6) phase = 'Sunrise';
  else if (minutes >= solar.noon && altitude < 0) phase = 'Dusk';
  else if (minutes >= solar.noon && altitude < 18) phase = 'Golden hour';
  else if (minutes < solar.noon) phase = 'Morning';
  return {
    ...solar, minutes, altitude, phase, daylight, warmth, highSun, progress,
  };
}
