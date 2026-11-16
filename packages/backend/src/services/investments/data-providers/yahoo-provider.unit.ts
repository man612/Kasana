import { ASSET_CLASS, SECURITY_PROVIDER } from '@bt/shared/types/investments';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { toProviderSymbol } from './base-provider';
import { YahooDataProvider } from './yahoo-provider';

type AsyncCall = (...args: unknown[]) => Promise<unknown>;
const mockSearch = jest.fn<AsyncCall>();
const mockQuote = jest.fn<AsyncCall>();
const mockChart = jest.fn<AsyncCall>();
const mockFindAll = jest.fn<AsyncCall>();
const mockBulkCreate = jest.fn<AsyncCall>();
const mockConstructor = jest.fn();
jest.mock('yahoo-finance2', () => ({
  __esModule: true,
  default: function (options: unknown) {
    mockConstructor(options);
    return { search: mockSearch, quote: mockQuote, chart: mockChart };
  },
}));
jest.mock('@models/investments/security-currency-cache.model', () => ({
  __esModule: true,
  default: {
    findAll: (...args: unknown[]) => mockFindAll(...args),
    bulkCreate: (...args: unknown[]) => mockBulkCreate(...args),
  },
}));
jest.mock('@js/utils', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@common/helpers', () => ({ sleep: jest.fn(async () => undefined) }));

describe('Yahoo provider v4 compatibility', () => {
  let provider: YahooDataProvider;
  beforeEach(() => {
    jest.resetAllMocks();
    mockFindAll.mockResolvedValue([]);
    mockBulkCreate.mockResolvedValue([]);
    provider = new YahooDataProvider();
  });

  it('retains constructor options and load-bearing unvalidated search results', async () => {
    expect(mockConstructor).toHaveBeenCalledWith({
      suppressNotices: ['yahooSurvey', 'ripHistorical'],
      validation: { logErrors: false, logOptionsErrors: false },
    });
    mockSearch.mockResolvedValue({
      quotes: [
        { symbol: 'VOD.L', longname: 'Vodafone', typeDisp: 'Equity', exchange: 'LSE', isYahooFinance: true },
        { symbol: 12 },
        { symbol: 'IGNORED', isYahooFinance: false },
      ],
    });
    mockQuote.mockResolvedValue({ symbol: 'VOD.L', currency: 'GBp' });
    expect(await provider.searchSecurities('Vodafone')).toEqual([
      expect.objectContaining({
        symbol: 'VOD.L',
        providerSymbol: 'VOD.L',
        currencyCode: 'GBP',
        name: 'Vodafone',
        assetClass: ASSET_CLASS.stocks,
        providerName: SECURITY_PROVIDER.yahoo,
      }),
    ]);
    expect(mockSearch).toHaveBeenCalledWith('Vodafone', { newsCount: 0 }, { validateResult: false });
    expect(mockBulkCreate).toHaveBeenCalledWith(
      [{ symbol: 'VOD.L', currencyCode: 'GBP', providerName: SECURITY_PROVIDER.yahoo }],
      { ignoreDuplicates: true },
    );
  });

  it.each(['GBp', 'GBX', 'ZAc', 'ILA', 'USD'])(
    'normalizes quote currency %s without changing the provider symbol',
    async (currency) => {
      mockQuote.mockResolvedValue({
        symbol: 'VENUE',
        currency,
        regularMarketPrice: 123.45,
        regularMarketTime: new Date('2024-01-01'),
      });
      expect(await provider.getLatestPrice(toProviderSymbol('VENUE'))).toEqual({
        providerSymbol: 'VENUE',
        date: new Date('2024-01-01'),
        priceClose: currency === 'USD' ? 123.45 : 1.2345,
        priceAsOf: new Date('2024-01-01'),
        providerName: SECURITY_PROVIDER.yahoo,
      });
    },
  );

  it('keeps adjusted historical prices, zero bars, null filtering and chronological order', async () => {
    mockChart.mockResolvedValue({
      meta: { currency: 'GBp' },
      quotes: [
        { date: '2024-01-02', close: 200, adjclose: 180 },
        { date: '2024-01-01', close: 0 },
        { date: '2024-01-03', close: null },
      ],
    });
    const result = await provider.getHistoricalPrices(toProviderSymbol('VOD.L'), {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-03'),
    });
    expect(result.map((row) => [row.date.toISOString(), row.priceClose])).toEqual([
      ['2024-01-01T00:00:00.000Z', 0],
      ['2024-01-02T00:00:00.000Z', 1.8],
    ]);
    expect(
      result.every((row) => row.providerSymbol === 'VOD.L' && row.priceAsOf.getTime() === row.date.getTime()),
    ).toBe(true);
    expect(mockChart).toHaveBeenCalledWith('VOD.L', { period1: '2024-01-01', period2: '2024-01-03' });
  });

  it('preserves cached currency resolution, empty/partial search and unresolved currency filtering', async () => {
    mockFindAll.mockResolvedValue([{ symbol: 'CACHED', currencyCode: 'GBp' }]);
    mockSearch.mockResolvedValue({ quotes: [{ symbol: 'CACHED' }, { symbol: 'NO-CURRENCY' }] });
    mockQuote.mockResolvedValue({ symbol: 'NO-CURRENCY' });
    expect(await provider.searchSecurities('fund')).toEqual([
      expect.objectContaining({ symbol: 'CACHED', currencyCode: 'GBP', name: 'CACHED' }),
    ]);
    expect(mockQuote).toHaveBeenCalledTimes(1);
    expect(mockBulkCreate).not.toHaveBeenCalled();
    mockSearch.mockResolvedValue({ quotes: null });
    expect(await provider.searchSecurities('empty')).toEqual([]);
  });

  it('retains ISIN multi-venue/name fallback and same-currency price routing', async () => {
    const isin = 'IE00B53L3W79';
    mockSearch.mockResolvedValueOnce({ quotes: [] }).mockResolvedValueOnce({ quotes: [{ symbol: 'MEUD.PA' }] });
    mockQuote.mockImplementation(async (symbol) => {
      if (symbol === `${isin}.IR`)
        return { symbol, currency: 'EUR', longName: 'Synthetic ETF', quoteType: 'MUTUALFUND' };
      if (symbol === 'MEUD.PA') return { symbol, currency: 'EUR', longName: 'Synthetic ETF', quoteType: 'ETF' };
      throw Object.assign(new Error('Not found'), { code: 404 });
    });
    const result = await provider.searchSecurities(isin);
    expect(result).toEqual([
      expect.objectContaining({
        symbol: `${isin}.IR`,
        providerSymbol: `${isin}.IR`,
        isin,
        currencyCode: 'EUR',
        priceSourceSymbol: 'MEUD.PA',
        assetClass: ASSET_CLASS.stocks,
      }),
      expect.objectContaining({ symbol: 'MEUD.PA', providerSymbol: 'MEUD.PA', isin, currencyCode: 'EUR' }),
    ]);
    expect(mockSearch).toHaveBeenLastCalledWith('Synthetic ETF', { newsCount: 0 }, { validateResult: false });
    expect(mockQuote).toHaveBeenCalledTimes(7);
  });

  it('isolates throttled symbols in bulk results and preserves security-ID/date contracts', async () => {
    mockChart
      .mockRejectedValueOnce(new Error('HTTP 429'))
      .mockResolvedValueOnce({ meta: { currency: 'USD' }, quotes: [{ date: '2024-01-01', close: 12.34 }] });
    const result = await provider.fetchPricesForSecurities(
      [
        {
          securityId: 'failed',
          providerSymbol: toProviderSymbol('FAILED'),
          symbol: 'FAILED',
          assetClass: ASSET_CLASS.stocks,
        },
        {
          securityId: 'kept',
          providerSymbol: toProviderSymbol('KEPT'),
          symbol: 'KEPT',
          assetClass: ASSET_CLASS.stocks,
        },
      ],
      new Date('2024-01-01'),
    );
    expect([...result.keys()]).toEqual(['kept']);
    expect(result.get('kept')).toEqual([
      expect.objectContaining({
        securityId: 'kept',
        providerSymbol: 'KEPT',
        priceClose: 12.34,
        date: new Date('2024-01-01'),
      }),
    ]);
    expect(mockChart).toHaveBeenLastCalledWith('KEPT', { period1: '2024-01-01', period2: '2024-01-02' });
    expect(await provider.fetchPricesForSecurities([], new Date('2024-01-01'))).toEqual(new Map());
  });

  it('surfaces failed, malformed and empty provider responses without storing currency data', async () => {
    mockSearch.mockRejectedValue(new Error('HTTP 429'));
    await expect(provider.searchSecurities('failed')).rejects.toThrow('429');
    mockSearch.mockResolvedValue({ quotes: [null] });
    await expect(provider.searchSecurities('malformed')).rejects.toThrow();
    mockQuote.mockResolvedValue(undefined);
    await expect(provider.getLatestPrice(toProviderSymbol('EMPTY'))).rejects.toThrow('No quote data');
    mockChart.mockResolvedValue({ quotes: [] });
    await expect(provider.getHistoricalPrices(toProviderSymbol('EMPTY'))).rejects.toThrow('No historical data');
    expect(mockBulkCreate).not.toHaveBeenCalled();
  });
});
