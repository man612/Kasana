import { describe, expect, it } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('independent Kasana backend translations', () => {
  it('never directs users to the upstream product or its support contact', () => {
    const folder = path.join(__dirname, 'locales');
    for (const filename of fs.readdirSync(folder).filter((file) => file.endsWith('.json'))) {
      const content = fs.readFileSync(path.join(folder, filename), 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
      expect(content).not.toMatch(/MoneyMatter|moneymatter\.app|support@moneymatter\.app|letehaha/i);
    }
  });
});
