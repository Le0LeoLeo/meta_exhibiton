import type { GraduationProject } from '@/app/api/graduation';

const fields = ['researchQuestion', 'concept', 'process', 'outcome', 'team', 'supervisor'] as const;
const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

export function portfolioDocument(projects: GraduationProject[], copy: { portfolio: string; by: string; version: string } & Record<typeof fields[number], string>) {
  // Only selected creative text is exported: no private reviews, IDs, invitation codes or live assets.
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(copy.portfolio)}</title><style>body{font-family:system-ui,sans-serif;max-width:850px;margin:auto;padding:32px;color:#202020;line-height:1.7}article{border-top:1px solid #ccc;margin-top:32px;padding-top:24px}h1,h2,h3{line-height:1.3}p{white-space:pre-wrap;overflow-wrap:anywhere}h3{font-size:1rem;margin-bottom:4px}@media print{body{padding:0}article{break-before:page}h2,h3{break-after:avoid}p{orphans:3;widows:3}}</style></head><body><h1>${escape(copy.portfolio)}</h1>${projects.map((p) => `<article><h2>${escape(p.title)}</h2><p>${escape(copy.by)}: ${escape(p.authorName)} · ${escape(copy.version)} ${p.revision}</p>${fields.filter((field) => p[field]).map((field) => `<section><h3>${escape(copy[field])}</h3><p>${escape(p[field])}</p></section>`).join('')}</article>`).join('')}</body></html>`;
}

export function downloadPortfolio(projects: GraduationProject[], copy: Parameters<typeof portfolioDocument>[1]) {
  const url = URL.createObjectURL(new Blob([portfolioDocument(projects, copy)], { type: 'text/html;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'graduation-portfolio.html';
  document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
