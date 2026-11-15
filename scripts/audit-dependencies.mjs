#!/usr/bin/env node
/**
 * Informational vulnerability inventory for the two committed npm lockfiles.
 * No npm install, automatic fix, or network credentials are required.
 * Counts are advisory matches, not proof that an issue is exploitable.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const order = { critical: 4, high: 3, moderate: 2, low: 1, info: 0 };
const scans = [
  { label: 'Application workspaces - all dependencies', directory: root, args: [] },
  { label: 'Application workspaces - runtime dependencies', directory: root, args: ['--omit=dev'] },
  { label: 'Standalone documentation - all dependencies', directory: path.join(root, 'packages/docs'), args: [] },
  { label: 'Standalone documentation - runtime dependencies', directory: path.join(root, 'packages/docs'), args: ['--omit=dev'] },
];
const lines = [
  '## Npm dependency baseline (informational)',
  '',
  'An audit match is not evidence of a reachable exploit. This job reports current advisories without auto-fixing packages or failing for existing vulnerabilities.',
  '',
  '| Lockfile scope | Critical | High | Moderate | Low | Total |',
  '| --- | ---: | ---: | ---: | ---: | ---: |',
];
let failedToAudit = false;
for (const scan of scans) {
  const command = spawnSync('npm', ['audit', '--json', ...scan.args], {
    cwd: scan.directory,
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 16 * 1024 * 1024,
  });
  let report;
  try {
    report = JSON.parse(command.stdout || '');
  } catch {
    report = null;
  }
  const v = report?.metadata?.vulnerabilities;
  if (command.error || command.signal || !v || report.error) {
    failedToAudit = true;
    const reason = command.error?.message || command.signal || report?.error?.summary || command.stderr?.slice(0, 250) || 'No valid npm audit report';
    console.error('Audit could not complete:', scan.label, reason);
    lines.push('| ' + scan.label + ' | Audit unavailable | — | — | — | — |');
    continue;
  }
  const values = ['critical', 'high', 'moderate', 'low'].map((key) => Number(v[key] || 0));
  const total = Number(v.total ?? values.reduce((sum, n) => sum + n, 0));
  lines.push('| ' + scan.label + ' | ' + [...values, total].join(' | ') + ' |');
  console.log(scan.label + ': ' + JSON.stringify({ critical: values[0], high: values[1], moderate: values[2], low: values[3], total }));
  if (values[0] + values[1] > 0) {
    console.log('::warning::' + scan.label + ' has ' + (values[0] + values[1]) + ' high/critical advisory matches; review GitHub Security alerts and affected package paths');
  }
  const highRisk = Object.entries(report.vulnerabilities || {})
    .filter(([, item]) => (order[item.severity] || 0) >= 3)
    .sort((a, b) => (order[b[1].severity] || 0) - (order[a[1].severity] || 0))
    .slice(0, 8)
    .map(([name, item]) => name + ' (' + item.severity + (item.isDirect ? ', direct' : ', transitive') + ')');
  if (highRisk.length) {
    lines.push('');
    lines.push('**' + scan.label + ' - examples requiring triage:** ' + highRisk.join(', ') + '.');
  }
}
lines.push('');
lines.push('Production-only and all-dependency scans overlap and must not be added together. Compare with the active GitHub Dependabot alerts; do not force package upgrades without compatibility and regression review.');
const summary = lines.join('\n') + '\n';
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
if (failedToAudit) process.exitCode = 1;
