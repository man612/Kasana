import { parseSignupLimit } from './signup-limit';

describe('parseSignupLimit', () => {
  it.each([undefined, ''])('keeps legacy unlimited behavior only for missing/empty %s', (raw) => {
    expect(parseSignupLimit(raw)).toEqual({ kind: 'unlimited' });
  });

  it.each([
    ['0', 0],
    ['1', 1],
    ['42', 42],
    ['  3  ', 3],
    [String(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER],
  ])('accepts deliberate non-negative integer %s', (raw, max) => {
    expect(parseSignupLimit(raw)).toEqual({ kind: 'capped', max });
  });

  it.each([
    'NaN', 'Infinity', '-1', '1.5', '1e5', '0x10', '01', '+1',
    ' ', '\t', '100accounts', '9007199254740992',
  ])('rejects malformed cap %s without opening registration', (raw) => {
    expect(parseSignupLimit(raw)).toEqual({ kind: 'invalid' });
  });
});
