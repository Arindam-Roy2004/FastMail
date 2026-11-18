import { isValidEmail, normaliseEmail } from './emails';

export type LeadParseResult = {
  emails: string[];
  duplicates: number;
  invalid: number;
};

// Anything shaped like local@domain inside a cell, a line, or quotes.
const CANDIDATE_RE = /[^\s,;"'<>()[\]]+@[^\s,;"'<>()[\]]+/g;

export const parseLeadList = (text: string, alreadyAdded: Iterable<string> = []): LeadParseResult => {
  const seen = new Set(Array.from(alreadyAdded, normaliseEmail));
  const emails: string[] = [];
  let duplicates = 0;
  let invalid = 0;

  for (const match of text.matchAll(CANDIDATE_RE)) {
    const email = normaliseEmail(match[0].replace(/[.:]+$/, ''));
    if (!isValidEmail(email)) {
      invalid++;
      continue;
    }
    if (seen.has(email)) {
      duplicates++;
      continue;
    }
    seen.add(email);
    emails.push(email);
  }

  return { emails, duplicates, invalid };
};

export const LEAD_FILE_MAX_BYTES = 1024 * 1024;
export const LEAD_FILE_ACCEPT = '.csv,.txt,text/csv,text/plain';

export const isLeadFile = (file: File) => /\.(csv|txt)$/i.test(file.name) || /^text\/(csv|plain)$/.test(file.type);
