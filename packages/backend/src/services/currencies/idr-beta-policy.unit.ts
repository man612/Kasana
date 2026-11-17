import { afterEach, describe, expect, it } from '@jest/globals';

import { enforceBetaIdrCurrency, isIdrOnlyBetaEnabled } from './idr-beta-policy';

const original = process.env.LAJUR_IDR_ONLY_BETA;
afterEach(() => {
  if (original === undefined) delete process.env.LAJUR_IDR_ONLY_BETA;
  else process.env.LAJUR_IDR_ONLY_BETA = original;
});

describe('IDR-only private beta gate', () => {
  it('does not change upstream multi-currency behavior unless explicitly enabled', () => {
    delete process.env.LAJUR_IDR_ONLY_BETA;
    expect(isIdrOnlyBetaEnabled()).toBe(false);
    expect(() => enforceBetaIdrCurrency('USD')).not.toThrow();
  });

  it('accepts IDR when the private beta gate is enabled', () => {
    process.env.LAJUR_IDR_ONLY_BETA = 'true';
    expect(isIdrOnlyBetaEnabled()).toBe(true);
    expect(() => enforceBetaIdrCurrency('IDR')).not.toThrow();
  });

  it('rejects other newly chosen currencies while preserving existing persisted data', () => {
    process.env.LAJUR_IDR_ONLY_BETA = '1';
    expect(() => enforceBetaIdrCurrency('USD')).toThrow(/IDR only/);
    expect(() => enforceBetaIdrCurrency('EUR')).toThrow(/IDR only/);
  });

  it('does not enable the policy for unrelated environment values', () => {
    process.env.LAJUR_IDR_ONLY_BETA = 'false';
    expect(isIdrOnlyBetaEnabled()).toBe(false);
  });
});
