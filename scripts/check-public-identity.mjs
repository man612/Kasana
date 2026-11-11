#!/usr/bin/env node
/**
 * Protect the PUBLIC RUNTIME identity of the independent Kasana application.
 * This is not a license-cleanup script: original copyright, provenance,
 * historical Git commits, upstream technical identifiers and billing IDs stay
 * untouched. Only public-facing names, outbound links, and email contacts
 * belonging to the runtime product are checked.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const failures = [];
const files = [
  'packages/backend/src/config/auth.ts',
  'packages/backend/src/controllers/github.controller.ts',
  'packages/backend/src/setup-routes.ts',
  'packages/backend/src/services/email/index.ts',
  'packages/backend/src/services/billing/send-subscription-welcome-email.ts',
  'packages/backend/src/services/sharing/share-user-snapshot.ts',
  'packages/backend/src/services/data-export/export-data.service.ts',
  'packages/frontend/src/api/_api.ts',
  'packages/frontend/src/api/github-releases.ts',
  'packages/frontend/src/composable/use-support-button.ts',
  'packages/frontend/src/components/dialogs/feedback-dialog.vue',
  'packages/frontend/src/pages/accounts/integrations/components/enable-banking/instructions-dialog.vue',
  'packages/shared/src/const/external-urls.ts',
  'packages/frontend/public/.well-known/apple-app-site-association',
  'packages/frontend/public/.well-known/security.txt',
  'packages/frontend/public/llms.txt',
  'packages/frontend/public/llms-full.txt',
  'packages/frontend/public/skills/connect-kasana/SKILL.md',
  'packages/backend/src/scripts/generate-mcp-metadata.ts',
];

const forbiddenRuntime = /MoneyMatter|moneymatter\.app|moneymatter:\/\/|letehaha|Dmytro|donatr\.ee\/letehaha/gi;
const forbiddenPrivateFeedback = /trackAnalyticsEvent|user_feedback_submitted|posthog/gi;
const report = (file, text, regex) => {
  for (const match of text.matchAll(regex)) {
    const line = text.slice(0, match.index).split('\n').length;
    failures.push(`${file}:${line} must not expose upstream identity or send private feedback`);
  }
};
for (const file of files) {
  const source = read(file);
  report(file, source, forbiddenRuntime);
  if (file.endsWith('/feedback-dialog.vue')) report(file, source, forbiddenPrivateFeedback);
}

// Names may still appear in LICENSE, LICENSING, CLA and original-history
// references. Customer-facing translations and server errors must not
// redirect users to the original author's hosted service or support inbox.
const locales = [
  'packages/frontend/src/i18n/locales/chunks',
  'packages/backend/src/i18n/locales',
];
const walk = (folder) => {
  for (const entry of fs.readdirSync(path.join(ROOT, folder), { withFileTypes: true })) {
    const child = path.posix.join(folder.replaceAll('\\', '/'), entry.name);
    if (entry.isDirectory()) walk(child);
    else if (child.endsWith('.json')) report(child, read(child), forbiddenRuntime);
  }
};
for (const localeDir of locales) walk(localeDir);
// Do not ship a skill URL carrying the old project's name. The public catalog
// stays unadvertised until an operator configures a real HTTPS origin.
if (fs.existsSync(path.join(ROOT, 'packages/frontend/public/skills/connect-moneymatter/SKILL.md'))) {
  failures.push('The public agent skill must use the Kasana path, not the inherited one');
}
// An unreferenced legacy social image is still publicly downloadable after a
// frontend build. Keep it out of the Kasana runtime asset tree.
if (fs.existsSync(path.join(ROOT, 'packages/frontend/public/img/og-image.jpg'))) {
  failures.push('The inherited promotional image must not ship with Kasana');
}
const appHtml = read('packages/frontend/index.html');
const manifest = JSON.parse(read('packages/frontend/public/site.webmanifest'));
if (!appHtml.includes(`name="theme-color" content="${manifest.theme_color}"`)) {
  failures.push('The frontend theme color must match Kasana PWA branding');
}
if (!appHtml.includes('property="og:image" content="/web-app-manifest-512x512.png"')) {
  failures.push('Kasana social previews must use the current branded artwork');
}
// These build boundaries are security-critical on public forks. Shipping the
// upstream marketing site or embedding Sentry credentials as ARG values can
// expose misleading content or build provenance despite green app tests.
const frontendDockerfile = read('self-hosting/frontend/Dockerfile');
if (/ARG\s+SENTRY_AUTH_TOKEN|ENV\s+SENTRY_AUTH_TOKEN/.test(frontendDockerfile)) {
  failures.push('Sentry credentials must be passed as BuildKit secrets, not Docker ARG/ENV');
}
if (/COPY\s+packages\/landing\s|COPY\s+--from=.*\/landing\/dist/.test(frontendDockerfile)) {
  failures.push('Inherited landing content must never be copied into the Kasana production image');
}
if (!frontendDockerfile.includes('org.opencontainers.image.source="https://github.com/man612/Kasana"')) {
  failures.push('Production Docker image source label must identify the Kasana repository');
}
// Require the vetted, patched NGINX stable release in production Dockerfiles.
for (const [dockerfile, expected] of [
  ['self-hosting/frontend/Dockerfile', 'FROM nginx:1.30.6-alpine AS production-stage'],
  ['packages/docs/Dockerfile', 'FROM nginxinc/nginx-unprivileged:1.30.6-alpine'],
]) {
  if (!read(dockerfile).includes(expected)) failures.push(`${dockerfile} must use vetted NGINX stable 1.30.6`);
}
// Both production images must identify this independent repository in OCI
// metadata. A wrong label can misroute source and security reports.
if (!read('self-hosting/backend/Dockerfile').includes('org.opencontainers.image.source="https://github.com/man612/Kasana"')) {
  failures.push('Backend production Docker image source label must identify Kasana');
}
// Never allow a plain docker compose up to run another product's money app.
const baseCompose = read('self-hosting/docker-compose.yml');
if (/image:\s*letehaha\/budget-tracker-(?:fe|be)/.test(baseCompose)) {
  failures.push('The base Compose file must never pull upstream finance frontend/backend images');
}
for (const image of ['kasana-build-required-frontend:local', 'kasana-build-required-backend:local']) {
  if (!baseCompose.includes(`image: ${image}`)) failures.push(`Missing fail-closed Compose placeholder: ${image}`);
}
const associatedApps = JSON.parse(read('packages/frontend/public/.well-known/apple-app-site-association'));
if (associatedApps.webcredentials?.apps?.length !== 0) {
  failures.push('Apple webcredentials may not advertise the original project\'s native app identifiers');
}
if (failures.length) {
  console.error(failures.join('\n'));
  console.error(`${failures.length} independent-product identity regression(s)`);
  process.exit(1);
}
console.log('Kasana public identity and outbound destination audit OK');
