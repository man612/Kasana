// Native Node contracts: Jest's CJS VM cannot prove synchronous require(ESM).
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createServer } = require('node:http');
const { createRequire } = require('node:module');
const { dirname, join } = require('node:path');
const { after, before, test } = require('node:test');
const { restClient } = require('@polygon.io/client-js');
// Resolve through the SDK's own dependency edges, including nested installs.
const polygonRequire = createRequire(require.resolve('@polygon.io/client-js'));
const queryString = polygonRequire('query-string');
const queryRequire = createRequire(polygonRequire.resolve('query-string'));
const YahooFinance = require('yahoo-finance2').default;

// All Yahoo HTTP is injected below; fail closed if a library path escapes it.
Object.defineProperty(globalThis, 'fetch', {
  value: async () => {
    throw new Error('Live provider requests are disabled in runtime contracts');
  },
  writable: true,
  configurable: true,
});
let handler;
let baseUrl;
const requests = [];
const server = createServer((request, response) => {
  assert.equal(request.headers.authorization, 'Bearer synthetic-provider-key');
  const url = new URL(request.url, baseUrl);
  assert.equal(url.searchParams.has('apiKey'), false);
  requests.push(url);
  const result = handler(url);
  response.writeHead(result.status ?? 200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(result.body));
});
before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
});
const polygon = ({ pagination = false } = {}) => restClient('synthetic-provider-key', baseUrl, { pagination });

test('the actual CJS consumer parses with the patched ESM decoder', () => {
  const decoderFile = queryRequire.resolve('decode-uri-component');
  assert.equal(JSON.parse(readFileSync(join(dirname(decoderFile), 'package.json'))).version, '0.5.1');
  assert.deepEqual(
    { ...queryString.parse('currency=IDR&name=Rp%20%E2%82%AC&repeat=1&repeat=2&empty=') },
    {
      currency: 'IDR',
      empty: '',
      name: 'Rp €',
      repeat: ['1', '2'],
    },
  );
  assert.equal(queryString.parse('name=%C3%A5%zz').name, 'å%zz');
  assert.equal(
    queryString.stringify({ adjusted: true, cursor: 'a+b/c', limit: 2, unused: undefined }),
    'adjusted=true&cursor=a%2Bb%2Fc&limit=2',
  );
});

test('patched malformed-run decoding completes in the isolated process', () => {
  const decode = queryRequire('decode-uri-component').default;
  const input =
    Array.from(
      { length: 32_000 },
      (_, index) =>
        `%${Math.floor(index / 256)
          .toString(16)
          .padStart(2, '0')}%${(index % 256).toString(16).padStart(2, '0')}x`,
    ).join('') + '%zz';
  assert.ok(decode(input).endsWith('%zz'));
});

test('Polygon grouped and historical aggregates preserve query, authentication and responses', async () => {
  const body = { status: 'OK', results: [{ T: 'AAPL', c: 123.45, t: 1_704_067_200_000 }] };
  handler = (url) => {
    assert.match(url.pathname, /\/v2\/aggs\//);
    return { body };
  };
  const client = polygon();
  assert.deepEqual(await client.stocks.aggregatesGroupedDaily('2024-01-01', { adjusted: 'true' }), body);
  assert.equal(requests.at(-1).searchParams.get('adjusted'), 'true');
  assert.deepEqual(await client.stocks.aggregates('BRK.B', 1, 'day', '2024-01-01', '2024-01-02'), body);
  assert.equal(requests.at(-1).pathname, '/v2/aggs/ticker/BRK.B/range/1/day/2024-01-01/2024-01-02');
});

test('Polygon previous close, ticker details and currency conversion remain available', async () => {
  const client = polygon();
  handler = (url) => ({
    body: { status: 'OK', results: { ticker: url.pathname.split('/').at(-1), currency_name: 'usd' } },
  });
  assert.equal((await client.reference.tickerDetails('AAPL')).results.ticker, 'AAPL');
  handler = () => ({ body: { results: [{ T: 'AAPL', c: 123.45, t: 1_704_067_200_000 }] } });
  assert.equal((await client.stocks.previousClose('AAPL')).results[0].c, 123.45);
  handler = (url) => {
    assert.equal(url.pathname, '/v1/conversion/USD/IDR');
    assert.equal(url.searchParams.get('amount'), '2');
    return { body: { converted: 31_234.5, initialAmount: 2, status: 'success' } };
  };
  assert.equal((await client.forex.conversion('USD', 'IDR', { amount: 2, precision: 2 })).converted, 31_234.5);
});

test('Polygon pagination retains encoded cursors and combines every result', async () => {
  const start = requests.length;
  handler = (url) => ({
    body: url.searchParams.has('cursor')
      ? { results: [{ ticker: 'MSFT' }] }
      : { results: [{ ticker: 'AAPL' }], next_url: `${baseUrl}/v3/reference/tickers?cursor=next%2Bpage` },
  });
  const result = await polygon({ pagination: true }).reference.tickers({ limit: 1 });
  assert.deepEqual(result.results, [{ ticker: 'AAPL' }, { ticker: 'MSFT' }]);
  assert.equal(result.count, 2);
  assert.equal(result.next_url, null);
  assert.equal(requests.length - start, 2);
  assert.equal(requests.at(-1).searchParams.get('cursor'), 'next+page');
});

test('Polygon empty results, missing auth, rate limits and failures keep their contracts', async () => {
  handler = () => ({ body: { results: [] } });
  assert.deepEqual((await polygon().stocks.previousClose('EMPTY')).results, []);
  await assert.rejects(restClient('', baseUrl).stocks.previousClose('AAPL'), /API KEY not configured/);
  for (const status of [401, 429, 500]) {
    handler = () => ({
      status,
      body: { message: `Synthetic HTTP ${status}`, status: 'ERROR', request_id: 'synthetic' },
    });
    await assert.rejects(polygon().stocks.previousClose('AAPL'), new RegExp(`Synthetic HTTP ${status}`));
  }
});

const quote = ({ currency = 'USD' } = {}) => ({
  symbol: 'AAPL',
  quoteType: 'EQUITY',
  currency,
  regularMarketPrice: 123.45,
  regularMarketTime: 1_704_067_200,
  esgPopulated: false,
  exchange: 'NMS',
  exchangeDataDelayedBy: 0,
  exchangeTimezoneName: 'America/New_York',
  exchangeTimezoneShortName: 'EST',
  fullExchangeName: 'NasdaqGS',
  gmtOffSetMilliseconds: -18_000_000,
  language: 'en-US',
  market: 'us_market',
  marketState: 'REGULAR',
  region: 'US',
  sourceInterval: 15,
  tradeable: false,
  triggerable: true,
});
const chart = () => ({
  chart: {
    error: null,
    result: [
      {
        meta: {
          currency: 'GBp',
          symbol: 'AAPL',
          exchangeName: 'LSE',
          instrumentType: 'EQUITY',
          firstTradeDate: 1_000,
          regularMarketTime: 1_704_067_200,
          gmtoffset: 0,
          timezone: 'GMT',
          exchangeTimezoneName: 'Europe/London',
          regularMarketPrice: 123.45,
          priceHint: 2,
          dataGranularity: '1d',
          range: '',
          validRanges: ['1d'],
          currentTradingPeriod: Object.fromEntries(
            ['pre', 'regular', 'post'].map((key) => [
              key,
              {
                timezone: 'GMT',
                start: 1_704_067_200,
                end: 1_704_153_600,
                gmtoffset: 0,
              },
            ]),
          ),
        },
        timestamp: [1_704_067_200],
        indicators: {
          quote: [{ high: [125], low: [120], open: [121], close: [123.45], volume: [50] }],
          adjclose: [{ adjclose: [122.5] }],
        },
      },
    ],
  },
});
const yahoo = ({ payload, status = 200, fail = false } = {}) =>
  new YahooFinance({
    suppressNotices: ['yahooSurvey', 'ripHistorical'],
    validation: { logErrors: false, logOptionsErrors: false },
    versionCheck: false,
    fetch: async (input) => {
      const url = new URL(input);
      assert.ok(['finance.yahoo.com', 'query1.finance.yahoo.com', 'query2.finance.yahoo.com'].includes(url.hostname));
      if (url.pathname === '/quote/AAPL')
        return new Response('', { headers: { 'set-cookie': 'A1=synthetic; Domain=.yahoo.com; Path=/; Secure' } });
      if (url.pathname === '/v1/test/getcrumb') return new Response('synthetic-crumb');
      if (fail) throw new Error('Synthetic provider outage');
      return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
    },
  });

test('Yahoo v4 constructor/search retain validateResult false and unfamiliar UCITS metadata', async () => {
  const payload = { quotes: [{ symbol: 'IE00B53L3W79.IR', typeDisp: 'MUTUALFUND', futureField: { venue: 'IR' } }] };
  assert.deepEqual(
    await yahoo({ payload }).search('IE00B53L3W79', { newsCount: 0 }, { validateResult: false }),
    payload,
  );
  assert.deepEqual(
    (await yahoo({ payload: { quotes: [] } }).search('EMPTY', {}, { validateResult: false })).quotes,
    [],
  );
});

test('Yahoo v4 quotes and historical charts retain numbers, currency and Date coercion', async () => {
  const result = await yahoo({ payload: { quoteResponse: { result: [quote()], error: null } } }).quote('AAPL');
  assert.equal(result.regularMarketPrice, 123.45);
  assert.equal(result.currency, 'USD');
  assert.equal(result.regularMarketTime.toISOString(), '2024-01-01T00:00:00.000Z');
  const history = await yahoo({ payload: chart() }).chart('AAPL', { period1: '2024-01-01', period2: '2024-01-02' });
  assert.equal(history.meta.currency, 'GBp');
  assert.equal(history.quotes[0].close, 123.45);
  assert.equal(history.quotes[0].adjclose, 122.5);
  assert.equal(history.quotes[0].date.toISOString(), '2024-01-01T00:00:00.000Z');
});

test('Yahoo v4 continues to reject malformed validated data, invalid options and failed upstreams', async () => {
  await assert.rejects(
    yahoo({ payload: { quoteResponse: { result: [{ symbol: 'AAPL', quoteType: 'UNKNOWN' }], error: null } } }).quote(
      'AAPL',
    ),
  );
  await assert.rejects(yahoo({ payload: {} }).search('AAPL', { newsCount: 'invalid' }));
  for (const status of [429, 500])
    await assert.rejects(yahoo({ payload: { message: 'Synthetic failure' }, status }).search('AAPL'));
  await assert.rejects(yahoo({ fail: true }).search('AAPL'), /Synthetic provider outage/);
});

test('patched Zod rejects an oversized constrained array without validating every invalid element', () => {
  const { z } = require('zod');
  const result = z.array(z.number()).max(1).safeParse(Array(10_000).fill(null));
  assert.equal(result.success, false);
  assert.equal(result.error.issues.length, 1);
  assert.equal(result.error.issues[0].code, 'too_big');
});

module.exports = {};
