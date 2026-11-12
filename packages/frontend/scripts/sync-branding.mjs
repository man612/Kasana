import fs from 'node:fs';
import path from 'node:path';
const dir = path.resolve(import.meta.dirname, '..');
const filename = path.join(dir, 'branding.json');
const b = JSON.parse(fs.readFileSync(filename, 'utf8'));
if (![b.name, b.shortName, b.description, b.lastSyncedName].every((x) => typeof x === 'string' && x.length > 0))
  throw new Error('Invalid branding config');
const rename = (s) =>
  s
    .replaceAll('https://github.com/man612/Kasana', '__BRAND_REPO_URL__')
    .replaceAll(b.lastSyncedName, b.name)
    .replaceAll('__BRAND_REPO_URL__', 'https://github.com/man612/Kasana');
const htmlFile = path.join(dir, 'index.html');
fs.writeFileSync(htmlFile, rename(fs.readFileSync(htmlFile, 'utf8')));
const manifestFile = path.join(dir, 'public/site.webmanifest');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
manifest.name = b.name;
manifest.short_name = b.shortName;
manifest.description = b.description;
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
const walk = (value) => {
  if (typeof value === 'string') return rename(value);
  if (Array.isArray(value)) return value.map(walk);
  if (value && typeof value === 'object') for (const key of Object.keys(value)) value[key] = walk(value[key]);
  return value;
};
function visit(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (entry.name.endsWith('.json')) {
      const source = fs.readFileSync(file, 'utf8'),
        old = JSON.parse(source);
      const result = walk(structuredClone(old));
      if (JSON.stringify(old) !== JSON.stringify(result))
        fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
    }
  }
}
visit(path.join(dir, 'src/i18n/locales/chunks'));
for (const filename of [
  'llms.txt',
  'llms-full.txt',
  'panduan.html',
  'operator-notice.html',
  'legal.html',
  'skills/connect-kasana/SKILL.md',
]) {
  const file = path.join(dir, 'public', filename);
  fs.writeFileSync(file, rename(fs.readFileSync(file, 'utf8')));
}
b.lastSyncedName = b.name;
fs.writeFileSync(filename, JSON.stringify(b, null, 2) + '\n');
console.log('Synced app display branding:', b.name);
