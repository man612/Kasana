import { ASSET_CLASS } from '@bt/shared/types/investments';
import { describe, expect, it } from 'vitest';

import { beiLotsToShares, isBeiStock } from './investment-units';

describe('BEI trade quantity', () => {
  const stock = { assetClass: ASSET_CLASS.stocks, currencyCode: 'IDR', exchangeMic: null, providerSymbol: 'BBCA.JK' };

  it('recognizes IDR stocks listed on BEI only', () => {
    expect(isBeiStock(stock)).toBe(true);
    expect(isBeiStock({ ...stock, providerSymbol: 'BBCA', exchangeMic: 'XIDX' })).toBe(true);
    expect(isBeiStock({ ...stock, assetClass: ASSET_CLASS.crypto })).toBe(false);
    expect(isBeiStock({ ...stock, providerSymbol: 'AAPL', currencyCode: 'USD' })).toBe(false);
    expect(isBeiStock({ ...stock, providerSymbol: 'OTHER' })).toBe(false);
  });

  it('converts whole lots to share quantities without floating-point rounding', () => {
    expect(beiLotsToShares('1')).toBe('100');
    expect(beiLotsToShares('12')).toBe('1200');
    expect(beiLotsToShares('1234567890123456')).toBe('123456789012345600');
  });

  it.each(['0', '', '-1', '1.5', '1e2'])('rejects invalid whole-lot quantity %s', (lots) => {
    expect(beiLotsToShares(lots)).toBeNull();
  });
});
