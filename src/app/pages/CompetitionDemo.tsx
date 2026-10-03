import { ArrowRight, BookOpenCheck, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';

const examples = [
  {
    label: 'Synthetic practice card A · supported detail',
    text: 'I sorted 18 fictional survey responses into three themes for a class project.',
    question: 'Which part of this statement could a reviewer check in the supplied work log?',
  },
  {
    label: 'Synthetic practice card B · unsupported claim',
    text: 'I helped with a survey. A draft says I led the team and improved every student’s results.',
    question: 'Which claims go beyond the supplied detail? What would you ask before keeping them?',
  },
  {
    label: 'Synthetic practice card C · link only',
    text: 'Source: example.invalid/class-project. No page text or file is supplied.',
    question: 'Can a link alone support a claim if its contents have not been read?',
  },
];

export default function CompetitionDemo() {
  return <main lang="en" className="mx-auto max-w-5xl px-4 py-10 text-foreground sm:px-6 lg:py-16">
    <header className="mb-10 max-w-3xl">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-curator-brass">AI for Education · learning prototype</p>
      <h1 className="mb-4 text-4xl font-semibold sm:text-5xl">MetaEXB Learn</h1>
      <p className="text-lg leading-relaxed text-muted-foreground">A guided practice in turning a learning experience into a clear reflection, checking what the evidence supports, and making a student’s own decision about any AI suggestion.</p>
      <p className="mt-4 rounded-md border border-border bg-secondary p-4 text-sm leading-relaxed">The practice examples below are fictional, not live AI output. Open the workspace to try AI suggestions with your own permitted material.</p>
    </header>

    <section aria-labelledby="learning-goals" className="mb-10 rounded-md border border-border bg-card p-6">
      <h2 id="learning-goals" className="mb-4 text-2xl font-semibold">Learning goals</h2>
      <ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
        <li>Describe your own role and actions in a specific learning experience.</li>
        <li>Match each factual claim to a source you have actually reviewed.</li>
        <li>Identify missing or exaggerated claims in a suggested draft.</li>
        <li>Explain why you accepted, edited, or rejected a suggestion.</li>
      </ul>
    </section>

    <section aria-labelledby="practice-steps" className="mb-10">
      <h2 id="practice-steps" className="mb-4 text-2xl font-semibold">Practice sequence</h2>
      <ol className="grid gap-4 md:grid-cols-2">
        {[
          ['1. Record', 'Write the situation, your role, actions, outcome, and reflection in your own words.'],
          ['2. Check', 'Choose only material you are allowed to use. Read it yourself; a URL alone is not evidence of page content.'],
          ['3. Review', 'Inspect each AI suggestion and compare every claim with sources you have read. Ask what is missing before you decide.'],
          ['4. Decide', 'Keep, edit, or reject a suggestion and explain your reasoning. A teacher reviews work before anything is shared publicly.'],
        ].map(([title, body]) => <li key={title} className="rounded-md border border-border bg-card p-5">
          <h3 className="mb-2 font-semibold">{title}</h3><p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
        </li>)}
      </ol>
    </section>

    <section aria-labelledby="synthetic-examples" className="mb-10">
      <div className="mb-4 flex items-start gap-3">
        <BookOpenCheck aria-hidden="true" className="mt-1 size-6 shrink-0 text-curator-brass" />
        <div><h2 id="synthetic-examples" className="text-2xl font-semibold">Fixed practice examples</h2>
          <p className="mt-1 text-sm text-muted-foreground">All names, activities, counts, and text below are invented for practice. They are not participant data, consent records, research results, or outputs from a live model.</p></div>
      </div>
      <div className="grid gap-4">
        {examples.map(({ label, text, question }) => <article key={label} className="rounded-md border border-border bg-card p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-curator-brass">{label}</p>
          <blockquote className="mb-3 border-l-2 border-border pl-4 leading-relaxed">{text}</blockquote>
          <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Discuss:</span> {question}</p>
        </article>)}
      </div>
    </section>

    <section aria-labelledby="existing-flow" className="mb-10 rounded-md border border-border bg-secondary p-6">
      <div className="mb-3 flex items-center gap-2"><ShieldCheck aria-hidden="true" className="size-5 text-curator-brass" /><h2 id="existing-flow" className="text-xl font-semibold">Continue in the existing graduation workflow</h2></div>
      <p className="mb-5 text-sm leading-relaxed text-muted-foreground">The links open the existing signed-in workspace and portfolio. Sign-in and the platform’s current permissions still apply. Use only material you have permission to enter; public sharing requires the existing review and publishing steps.</p>
      <div className="flex flex-wrap gap-3">
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 font-medium text-primary-foreground underline-offset-4 hover:underline" to="/graduation#student">Open student workspace <ArrowRight aria-hidden="true" className="size-4" /></Link>
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-4 font-medium text-foreground underline-offset-4 hover:underline" to="/graduation/portfolio">Open my portfolio <ArrowRight aria-hidden="true" className="size-4" /></Link>
      </div>
    </section>
  </main>;
}
