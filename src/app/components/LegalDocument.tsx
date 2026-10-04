import { Link } from 'react-router';

export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export function LegalDocument({
  eyebrow,
  title,
  summary,
  updated,
  sections,
  links,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  updated: string;
  sections: LegalSection[];
  links: Array<{ to: string; label: string }>;
}) {
  return (
    <div className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-6 lg:px-8">
      <article className="mx-auto max-w-4xl">
        <header className="border-b border-border pb-8 pt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-curator-brass">{eyebrow}</p>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{title}</h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">{summary}</p>
          <p className="mt-4 text-sm text-muted-foreground">{updated}</p>
        </header>

        <div className="space-y-9 py-10">
          {sections.map((section) => (
            <section key={section.heading} className="border-b border-border pb-8">
              <h2 className="mb-3 text-2xl font-semibold text-foreground">{section.heading}</h2>
              <div className="space-y-3 text-base leading-7 text-muted-foreground">
                {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets && (
                  <ul className="list-disc space-y-2 pl-6">
                    {section.bullets.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>

        <nav className="flex flex-wrap gap-4 border-t border-border py-8" aria-label={title}>
          {links.map((link) => (
            <Link key={link.to} to={link.to} className="text-sm font-medium text-tool-blue hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
      </article>
    </div>
  );
}
