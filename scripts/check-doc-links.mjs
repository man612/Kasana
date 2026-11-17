#!/usr/bin/env node
// Validate maintained documentation paths and local Markdown anchors offline.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'README.md',
  'AGENTS.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'LICENSING.md',
  '.github/SECURITY.md',
  'self-hosting/README.md',
  'packages/backend/README.md',
  'packages/frontend/README.md',
  'packages/docs/README.md',
  'packages/landing/README.md',
  ...fs
    .readdirSync(path.join(root, 'docs'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => `docs/${name}`),
  ...fs
    .readdirSync(path.join(root, 'self-hosting/docs'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => `self-hosting/docs/${name}`),
  ...fs
    .readdirSync(path.join(root, 'docs/security'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => `docs/security/${name}`),
];
const withoutCode = (text) => text.replace(/^```[^\n]*\n[\s\S]*?^```/gm, '');
const anchors = (text) => {
  const seen = new Map();
  return [...withoutCode(text).matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => {
    const slug = match[1]
      .toLowerCase()
      .replace(/<[^>]*>/g, '')
      .replace(/[^\p{L}\p{N}_\-\s]/gu, '')
      .replace(/\s/g, '-');
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    return count ? `${slug}-${count}` : slug;
  });
};
const failures = [];
let checked = 0;
for (const file of files) {
  const text = withoutCode(fs.readFileSync(path.join(root, file), 'utf8'));
  if (/\[[^\]\n]+\]\s+\(if enabled\)\(https?:/.test(text)) failures.push(`${file}: malformed reporting link`);
  for (const match of text.matchAll(/\[[^\]\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1].replace(/^<|>$/g, '');
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) continue;
    const [pathname, fragment] = target.split('#');
    const absolute = path.resolve(
      path.dirname(path.join(root, file)),
      decodeURIComponent(pathname || path.basename(file)),
    );
    checked++;
    if (!fs.existsSync(absolute)) {
      failures.push(`${file}: missing ${target}`);
      continue;
    }
    if (
      fragment &&
      /\.md$/i.test(absolute) &&
      !anchors(fs.readFileSync(absolute, 'utf8')).includes(decodeURIComponent(fragment))
    ) {
      failures.push(`${file}: missing anchor ${target}`);
    }
  }
}
assert.equal(failures.length, 0, failures.join('\n'));
console.log(
  `PASS: ${checked} local documentation links/anchors in ${files.length} maintained files (external URLs not fetched).`,
);
