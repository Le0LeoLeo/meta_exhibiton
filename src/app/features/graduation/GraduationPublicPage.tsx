import { useParams } from 'react-router';
import { exportGraduationData, type GraduationRelease } from '@/app/api/graduation';
import { Button } from '@/app/components/ui/button';
import { PublicLinkUnavailable } from '@/app/components/PublicLinkUnavailable';
import { useGraduationCopy } from './copy';
import { GraduationShell, useGraduationResource } from './shared';
import { PublicProjectCard } from './ProjectDetails';
import { useState } from 'react';
import { useTeachingCopy } from './teachingCopy';
import { Field, inputClass } from './shared';

export default function GraduationPublicPage() {
  const { token = '' } = useParams(); const c = useGraduationCopy();
  const t = useTeachingCopy(); const [query, setQuery] = useState('');
  const resource = useGraduationResource<{ release: GraduationRelease }>(`/public/${encodeURIComponent(token)}`);
  const release = resource.error ? undefined : resource.value?.release;
  const matching = new Set(release?.projects.filter((p) => [p.title, p.authorName, p.concept, p.researchQuestion].some((value) => value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))).map((p) => p.id));
  if (resource.error) return <div className="px-4 py-14 sm:px-6"><PublicLinkUnavailable status={resource.errorStatus} onRetry={resource.reload} /></div>;
  return <GraduationShell title={release?.title || c.releaseTitle} description={release?.description} showWorkspaceNav={false}>
    {resource.loading && <p role="status" className="py-4 text-muted-foreground">{c.loading}</p>}
    {release && <>
      <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-4"><p className="text-sm font-medium">{c.version} {release.version} · {new Date(release.createdAt).toLocaleString()}</p><p className="text-sm text-muted-foreground">{c.archiveNote}</p><Button variant="outline" onClick={() => exportGraduationData(release, `graduation-release-v${release.version}.json`)}>{c.export}</Button></div>
      <nav aria-label={t.contents} className="space-y-3 rounded-md border border-border p-4"><h2 className="font-semibold">{t.contents}</h2><Field label={t.search}><input type="search" className={inputClass} value={query} onChange={(e) => setQuery(e.target.value)} /></Field><ul className="grid gap-2 sm:grid-cols-2">{release.projects.filter((p) => matching.has(p.id)).map((p) => <li key={p.id}><a href={`#project-${p.id}`} className="inline-flex min-h-11 items-center break-words text-sm text-primary underline">{p.title} · {p.authorName}</a></li>)}</ul>{matching.size === 0 && <p role="status">{t.noMatch}</p>}</nav>
      <div className="space-y-6">{release.groups?.length ? release.groups.filter((g) => g.projectIds.some((id) => matching.has(id))).map((group, index) => <section key={index} className="space-y-5"><h2 className="break-words text-2xl font-semibold">{group.title}</h2><p className="whitespace-pre-wrap break-words text-muted-foreground">{group.rationale}</p>{group.guide && <p className="whitespace-pre-wrap break-words leading-relaxed">{group.guide}</p>}{group.projectIds.filter((id) => matching.has(id)).map((id) => { const project = release.projects.find((p) => p.id === id); return project ? <PublicProjectCard key={id} project={project} token={token} /> : null; })}</section>) : release.projects.filter((p) => matching.has(p.id)).map((project) => <PublicProjectCard key={project.id} project={project} token={token} />)}</div>
    </>}
  </GraduationShell>;
}
