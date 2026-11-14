#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scans = [
  { name: 'root-all', cwd: root, args: [] },
  { name: 'root-runtime', cwd: root, args: ['--omit=dev'] },
  { name: 'docs-all', cwd: path.join(root, 'packages/docs'), args: [] },
  { name: 'docs-runtime', cwd: path.join(root, 'packages/docs'), args: ['--omit=dev'] },
];
let errors = 0;
for (const scan of scans) {
  const r = spawnSync('npm', ['audit', '--json', ...scan.args], {
    cwd: scan.cwd, encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024,
  });
  let data;
  try { data = JSON.parse(r.stdout); } catch { data = {}; }
  if (r.error || data.error || !data.metadata?.vulnerabilities) {
    console.error('AUDIT ERROR ' + scan.name + ' ' + String(data.error?.summary || r.error || r.stderr).slice(0, 350));
    errors++;
    continue;
  }
  const v = data.metadata.vulnerabilities;
  const vulnerable = Object.entries(data.vulnerabilities ?? {})
    .map(([name, obj]) => ({ name, severity: obj.severity, direct: obj.isDirect, via: obj.via?.filter(x => typeof x === 'string') }))
    .sort((a, b) => ({ critical: 4, high: 3, moderate: 2, low: 1 }[b.severity] || 0) - ({ critical: 4, high: 3, moderate: 2, low: 1 }[a.severity] || 0));
  console.log('AUDIT SNAPSHOT ' + JSON.stringify({ scan: scan.name, critical: v.critical, high: v.high, moderate: v.moderate, low: v.low, total: v.total }));
  console.log('AFFECTED PACKAGES ' + scan.name + ' ' + JSON.stringify(vulnerable.slice(0, 55)));
}
if (errors) process.exitCode = 1;
