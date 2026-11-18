const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const LOCALE = 'en-US';

const DAY_MS = 24 * 60 * 60 * 1000;

export const formatPillTime = (iso: string, now = Date.now()) => {
  const date = new Date(iso);
  if (Math.abs(date.getTime() - now) < 6 * DAY_MS) {
    const weekday = date.toLocaleDateString(LOCALE, { weekday: 'short' });
    const time = date.toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    return `${weekday} ${time}`;
  }
  return date.toLocaleString(LOCALE, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export const formatListTime = (iso: string, now = new Date()) => {
  const date = new Date(iso);
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' });
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(LOCALE, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
};

export const formatDetailTime = (iso: string) =>
  new Date(iso).toLocaleString(LOCALE, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

export const formatRelative = (iso: string, now = Date.now()) => {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  if (abs < 45_000) return diff >= 0 ? 'in a few seconds' : 'just now';
  if (abs < 45 * 60_000) return relative.format(Math.round(diff / 60_000), 'minute');
  if (abs < 22 * 3_600_000) return relative.format(Math.round(diff / 3_600_000), 'hour');
  return relative.format(Math.round(diff / DAY_MS), 'day');
};

export const formatFullTime = (iso: string) => {
  const date = new Date(iso);
  const full = date.toLocaleString(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
  return `${full} (${formatRelative(iso)})`;
};

export const timeZoneLabel = () => {
  const zone = timeZone();
  const offset =
    new Intl.DateTimeFormat(LOCALE, { timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value ?? '';
  return `${zone.replace(/_/g, ' ')}${offset ? ` (${offset})` : ''}`;
};

export const formatCount = (n: number) => n.toLocaleString();

export const displayNameFromEmail = (email: string) => {
  const local = email.split('@')[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export const initialOf = (value: string) => (value.trim().charAt(0) || '?').toUpperCase();
