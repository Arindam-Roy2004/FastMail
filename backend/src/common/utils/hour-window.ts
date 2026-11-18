export const HOUR_MS = 60 * 60 * 1000;

export const hourWindow = (ms: number) => Math.floor(ms / HOUR_MS);

export const windowStart = (window: number) => window * HOUR_MS;

export const windowEnd = (window: number) => (window + 1) * HOUR_MS;
