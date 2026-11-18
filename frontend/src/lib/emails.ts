const EMAIL_RE = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

export const normaliseEmail = (value: string) => value.trim().replace(/^mailto:/i, '').toLowerCase();

export const isValidEmail = (value: string) => value.length <= 254 && EMAIL_RE.test(value);

export const splitAddresses = (text: string) =>
  text
    .split(/[\s,;]+/)
    .map((part) => part.replace(/^[<"'(]+|[>"')]+$/g, ''))
    .map(normaliseEmail)
    .filter(Boolean);
