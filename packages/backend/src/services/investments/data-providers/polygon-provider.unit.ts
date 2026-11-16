import { ASSET_CLASS, SECURITY_PROVIDER } from '@bt/shared/types/investments';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { toProviderSymbol } from './base-provider';
import { PolygonDataProvider } from './polygon-provider';

type AsyncCall = (...args: unknown[]) => Promise<unknown>;
const mockGrouped = jest.fn<AsyncCall>();
const mockAggregates = jest.fn<AsyncCall>();
const mockPrevious = jest.fn<AsyncCall>();
const mockDetails = jest.fn<AsyncCall>();
const mockRestClient = jest.fn(() => ({
  stocks: { aggregatesGroupedDaily: mockGrouped, aggregates: mockAggregates, previousClose: mockPrevious },
  reference: { tickerDetails: mockDetails },
}));
jest.mock('@polygon.io/client-js', () => ({ restClient: (...args: []) => mockRestClient(...args) }));
jest.mock('@js/utils', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const timestamp = Date.UTC(2024, 0, 1);
const symbol = toProviderSymbol('BRK.B');

describe('Polygon provider compatibility', () => {
  let provider: PolygonDataProvider;
  beforeEach(() => {
    jest.resetAllMocks();
    mockRestClient.mockImplementation(() => ({
      stocks: { aggregatesGroupedDaily: mockGrouped, aggregates: mockAggregates, previousClose: mockPrevious },
      reference: { tickerDetails: mockDetails },
    }));
    provider = new PolygonDataProvider('synthetic-provider-key');
  });

  it('initializes with the supplied key and preserves historical shapes and date bounds', async () => {
    expect(mockRestClient).toHaveBeenCalledWith('synthetic-provider-key');
    mockAggregates.mockResolvedValue({
      results: [
        { c: 123.45, t: timestamp },
        { c: null, t: timestamp },
      ],
    });
    expect(
      await provider.getHistoricalPrices(symbol, {
        startDate: new Date(timestamp),
        endDate: new Date(timestamp + 86_400_000),
      }),
    ).toEqual([
      {
        providerSymbol: symbol,
        date: new Date(timestamp),
        priceClose: 123.45,
        priceAsOf: new Date(timestamp),
        providerName: SECURITY_PROVIDER.polygon,
      },
    ]);
    expect(mockAggregates).toHaveBeenCalledWith(symbol, 1, 'day', '2024-01-01', '2024-01-02');
    mockAggregates.mockResolvedValue({});
    expect(await provider.getHistoricalPrices(symbol)).toEqual([]);
  });

  it('maps grouped native symbols to the correct security IDs without changing prices', async () => {
    mockGrouped.mockResolvedValue({
      results: [
        { T: 'BRK.B', c: 123.45, t: timestamp },
        { T: 'OTHER', c: 99, t: timestamp },
      ],
    });
    const result = await provider.fetchPricesForSecurities(
      [
        { securityId: 'security-brkb', providerSymbol: symbol, symbol: 'BRK.B', assetClass: ASSET_CLASS.stocks },
        {
          securityId: 'missing',
          providerSymbol: toProviderSymbol('MISSING'),
          symbol: 'MISSING',
          assetClass: ASSET_CLASS.stocks,
        },
      ],
      new Date(timestamp),
    );
    expect([...result.keys()]).toEqual(['security-brkb']);
    expect(result.get('security-brkb')).toEqual([
      {
        securityId: 'security-brkb',
        providerSymbol: symbol,
        priceClose: 123.45,
        date: new Date(timestamp),
        priceAsOf: new Date(timestamp),
        providerName: SECURITY_PROVIDER.polygon,
      },
    ]);
    expect(mockGrouped).toHaveBeenCalledWith('2024-01-01', { adjusted: 'true' });
    expect(await provider.fetchPricesForSecurities([], new Date(timestamp))).toEqual(new Map());
    mockGrouped.mockResolvedValue({ results: [] });
    expect(
      await provider.fetchPricesForSecurities(
        [{ securityId: 'x', providerSymbol: symbol, symbol: 'BRK.B', assetClass: ASSET_CLASS.stocks }],
        new Date(timestamp),
      ),
    ).toEqual(new Map());
  });

  it.each(['CS', 'ADRC', 'ETF', 'UNKNOWN'])(
    'preserves ticker identity/currency and maps asset type %s',
    async (type) => {
      mockDetails.mockResolvedValue({
        results: {
          ticker: 'BRK.B',
          name: 'Berkshire',
          type,
          primary_exchange: 'XNYS',
          market: 'stocks',
          currency_name: 'usd',
        },
      });
      expect(await provider.searchSecurities('BRK.B')).toEqual([
        expect.objectContaining({
          symbol: 'BRK.B',
          providerSymbol: 'BRK.B',
          name: 'Berkshire',
          currencyCode: 'usd',
          providerName: SECURITY_PROVIDER.polygon,
          assetClass: type === 'UNKNOWN' ? ASSET_CLASS.other : ASSET_CLASS.stocks,
          exchangeName: 'XNYS',
        }),
      ]);
    },
  );

  it('retains previous-close and empty/failure contracts', async () => {
    mockPrevious.mockResolvedValue({ results: [{ T: 'BRK.B', c: 123.45, t: timestamp }] });
    expect(await provider.getLatestPrice(symbol)).toEqual(
      expect.objectContaining({
        providerSymbol: symbol,
        priceClose: 123.45,
        date: new Date(timestamp),
        priceAsOf: expect.any(Date),
        providerName: SECURITY_PROVIDER.polygon,
      }),
    );
    mockPrevious.mockResolvedValue({ results: [] });
    await expect(provider.getLatestPrice(symbol)).rejects.toThrow('No quote data');
    mockDetails.mockResolvedValue({});
    expect(await provider.searchSecurities('EMPTY')).toEqual([]);
    mockDetails.mockRejectedValue(new Error('HTTP 401'));
    expect(await provider.searchSecurities('FAILED')).toEqual([]);
  });

  it('retries the existing Axios 429 path without retrying non-rate errors', async () => {
    jest.useFakeTimers();
    try {
      mockGrouped
        .mockRejectedValueOnce(
          Object.assign(new Error('rate limit'), { isAxiosError: true, response: { status: 429 } }),
        )
        .mockResolvedValueOnce({ results: [] });
      const pending = provider.fetchPricesForSecurities(
        [{ securityId: 'x', providerSymbol: symbol, symbol: 'BRK.B', assetClass: ASSET_CLASS.stocks }],
        new Date(timestamp),
      );
      await jest.advanceTimersByTimeAsync(15_000);
      expect(await pending).toEqual(new Map());
      expect(mockGrouped).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
    mockGrouped.mockReset().mockRejectedValue(new Error('HTTP 500'));
    await expect(
      provider.fetchPricesForSecurities(
        [{ securityId: 'x', providerSymbol: symbol, symbol: 'BRK.B', assetClass: ASSET_CLASS.stocks }],
        new Date(timestamp),
      ),
    ).rejects.toThrow('HTTP 500');
    expect(mockGrouped).toHaveBeenCalledTimes(1);
  });
});
