import { describe, expect, it } from 'vitest';
import { isValidEmail, splitAddresses } from '@/lib/emails';

describe('email rules', () => {
  it('matches what the API accepts', () => {
    for (const ok of ['a@b.co', 'first.last+tag@sub.example.com', "o'neil@x.io"]) expect(isValidEmail(ok)).toBe(true);
    for (const bad of ['a@b', '.a@b.com', 'a..b@c.com', 'a@-b.com', `${'x'.repeat(250)}@b.com`]) expect(isValidEmail(bad)).toBe(false);
  });

  it('splits a pasted block on commas, semicolons, spaces and newlines', () => {
    expect(splitAddresses(' A@x.com,b@x.com;\n<c@x.com>  mailto:d@x.com ')).toEqual(['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com']);
  });
});
