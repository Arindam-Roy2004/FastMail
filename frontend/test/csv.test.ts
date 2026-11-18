import { describe, expect, it } from 'vitest';
import { parseLeadList } from '@/lib/csv';

describe('parseLeadList', () => {
  it('finds addresses in any column of a CRM export and skips the header', () => {
    const csv = 'name,email,company\nJohn,john@acme.com,Acme\n"Smith, Jane",jane@example.org,Ex\n';
    expect(parseLeadList(csv)).toEqual({ emails: ['john@acme.com', 'jane@example.org'], duplicates: 0, invalid: 0 });
  });

  it('reads one address per line, semicolons and angle brackets', () => {
    const text = 'a@x.com\nb@x.com; c@x.com\nJohn <d@x.com>\n';
    expect(parseLeadList(text).emails).toEqual(['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com']);
  });

  it('lower-cases and counts duplicates, including ones already added', () => {
    const result = parseLeadList('A@X.com\na@x.com\nb@x.com', ['b@x.com']);
    expect(result).toEqual({ emails: ['a@x.com'], duplicates: 2, invalid: 0 });
  });

  it('counts address-shaped tokens that are not valid', () => {
    const result = parseLeadList('ok@x.com, bad@x, two@@x.com, dots..@x.com');
    expect(result.emails).toEqual(['ok@x.com']);
    expect(result.invalid).toBe(3);
  });

  it('strips trailing punctuation from prose', () => {
    expect(parseLeadList('Contact sales@acme.com.').emails).toEqual(['sales@acme.com']);
  });
});
