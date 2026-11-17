import { describe, expect, it } from '@jest/globals';
import fs from 'fs';
import path from 'path';

import { MCP_SERVER_INFO } from '../services/mcp/server';
import { buildMcpMetadataFiles } from './generate-mcp-metadata';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SERVER_CARD_PATH = path.join(REPO_ROOT, 'packages/frontend/public/.well-known/mcp/server-card.json');
const REGISTRY_SERVER_JSON_PATH = path.join(REPO_ROOT, 'server.json');

describe('MCP metadata', () => {
  it('the committed server card, OAuth mirrors and SKILL.md match the generator', () => {
    const stale = Object.entries(buildMcpMetadataFiles())
      .filter(([file, content]) => fs.readFileSync(file, 'utf-8') !== content)
      .map(([file]) => path.relative(REPO_ROOT, file));

    if (stale.length) {
      // Include a concrete first discrepancy so contributors can repair the
      // generated data without guessing which tool or field became stale.
      const cardPath = SERVER_CARD_PATH;
      const expectedCard = JSON.parse(buildMcpMetadataFiles()[cardPath]!);
      const actualCard = JSON.parse(fs.readFileSync(cardPath, 'utf-8'));
      const firstDifferences: string[] = [];
      for (const [section, expected] of Object.entries(expectedCard)) {
        const actual = actualCard[section];
        if (JSON.stringify(actual) === JSON.stringify(expected)) continue;
        if (Array.isArray(expected) && Array.isArray(actual)) {
          const index = expected.findIndex((item, i) => JSON.stringify(item) !== JSON.stringify(actual[i]));
          firstDifferences.push(
            section + '[' + index + '] expected ' + JSON.stringify(expected[index]) + ', found ' + JSON.stringify(actual[index]),
          );
        } else {
          firstDifferences.push(section + ' expected ' + JSON.stringify(expected) + ', found ' + JSON.stringify(actual));
        }
      }
      throw new Error(
        `Stale MCP metadata: ${stale.join(', ')}. Run \`npm run mcp:generate-metadata\` in packages/backend.\nFirst differences: ${firstDifferences.slice(0, 5).join('; ')}`,
      );
    }
  });

  it('only publishes a registry descriptor when the MCP endpoint is real', () => {
    const card = JSON.parse(fs.readFileSync(SERVER_CARD_PATH, 'utf-8'));

    // The independent Kasana repository has no public MCP server yet.
    // Keep the registry descriptor unpublished instead of pointing users to
    // a different project's live OAuth/MCP service.
    if (!fs.existsSync(REGISTRY_SERVER_JSON_PATH)) {
      expect(new URL(card.transport.url).hostname).toBe('kasana.invalid');
      return;
    }

    const registry = JSON.parse(fs.readFileSync(REGISTRY_SERVER_JSON_PATH, 'utf-8'));
    expect(registry.version).toBe(MCP_SERVER_INFO.version);
    expect(registry.remotes).toEqual([card.transport]);
    expect(registry.description.length).toBeLessThanOrEqual(100);
  });
});
