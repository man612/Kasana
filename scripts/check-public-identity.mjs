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
];

const forbiddenRuntime = /MoneyMatter|moneymatter\\.app|moneymatter:\/\/|letehaha|Dmytro|donatr\\.ee\/letehaha/gi;
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
