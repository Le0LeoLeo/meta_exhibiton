// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createHomeDocument, escapeHtml } from './homePrerender';

describe('homepage document isolation', () => {
  it('adds readable content and homepage metadata without altering the deep-route shell', () => {
    const shell = '<html lang="en"><head><title>MREI</title><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>';
    const home = createHomeDocument(shell, '<main><h1>MetaEXB</h1><a href="/demo">Enter exhibition</a></main>');
    expect(home).toContain('<html lang="en">');
    expect(home).toContain('<h1>MetaEXB</h1>');
    expect(home).toContain('rel="canonical" href="https://metaexb.com/"');
    expect(home).toContain('name="description"');
    expect(home).toContain('src="/assets/app.js"');
    expect(shell).not.toContain('canonical');
    expect(shell).toContain('<div id="root"></div>');
  });
  it('fails packaging rather than silently emitting an unreadable homepage', () => {
    expect(() => createHomeDocument('<body>unexpected</body>', '<main/>')).toThrow('Expected empty app shell');
  });
  it('escapes metadata attributes', () => {
    expect(escapeHtml('A "quote" & <tag>')).toBe('A &quot;quote&quot; &amp; &lt;tag&gt;');
  });
});
