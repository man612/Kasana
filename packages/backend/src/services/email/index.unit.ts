import { appName, buildEmailShell, escapeHtml } from './index';

describe('escapeHtml', () => {
  it.each([
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&#39;'],
  ])('escapes %s', (input, expected) => {
    expect(escapeHtml(input)).toBe(expected);
  });

  it('leaves plain text unchanged', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
  });

  it('handles multiple special chars in one string', () => {
    expect(escapeHtml('<b>Hello & "World"</b>')).toBe('&lt;b&gt;Hello &amp; &quot;World&quot;&lt;/b&gt;');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('buildEmailShell', () => {
  it('produces valid HTML document structure', () => {
    const html = buildEmailShell({ innerHtml: '' });
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<html>');
    expect(html).toContain('</html>');
    expect(html).toContain('<body');
    expect(html).toContain('</body>');
  });

  it('injects innerHtml inside the card table', () => {
    const html = buildEmailShell({ innerHtml: '<tr><td id="sentinel">unique-content</td></tr>' });
    expect(html).toContain('unique-content');
    // innerHtml must appear after the brand-name row
    const brandIdx = html.indexOf('#17443d');
    const contentIdx = html.indexOf('unique-content');
    expect(contentIdx).toBeGreaterThan(brandIdx);
  });

  it('includes the Lajur. accent top bar', () => {
    const html = buildEmailShell({ innerHtml: '' });
    expect(html).toContain('#17443d');
  });

  it('includes the brand name (escaped)', () => {
    const html = buildEmailShell({ innerHtml: '' });
    expect(html).toContain(escapeHtml(appName));
  });

  it('escapes special chars in appName', () => {
    const original = process.env.AUTH_RP_NAME;
    try {
      process.env.AUTH_RP_NAME = '<Evil&Co>';
      jest.isolateModules(() => {
        const configured = jest.requireActual<typeof import('./index')>('./index');
        const html = configured.buildEmailShell({ innerHtml: '' });
        expect(html).toContain('&lt;Evil&amp;Co&gt;');
        expect(html).not.toContain('<Evil&Co>');
      });
    } finally {
      if (original === undefined) delete process.env.AUTH_RP_NAME;
      else process.env.AUTH_RP_NAME = original;
    }
  });

  it('includes light color-scheme meta tags', () => {
    const html = buildEmailShell({ innerHtml: '' });
    expect(html).toContain('color-scheme" content="light"');
    expect(html).toContain('color-scheme: light');
  });
});
