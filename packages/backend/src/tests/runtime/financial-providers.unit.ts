import { execFileSync } from 'node:child_process';
import path from 'node:path';

describe('financial provider native runtime contracts', () => {
  it('loads actual locked SDKs and exercises only synthetic HTTP/fetch responses', () => {
    const output = execFileSync(process.execPath, ['--test', path.join(__dirname, 'financial-providers.test.cjs')], {
      encoding: 'utf8',
      timeout: 60_000,
      env: { PATH: process.env.PATH, TZ: 'UTC', NODE_ENV: 'test', DB_QUERY_LOGGING: 'false' },
    });
    expect(output).toMatch(/(?:#|ℹ) fail(?:ures)?\s+0/);
  }, 65_000);
});
