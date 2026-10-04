import { Link } from 'react-router';
import { formatDate } from '@/app/utils/formatDate';
import { exportGraduationData, graduationRequest, type GraduationProject } from '@/app/api/graduation';
import { Button } from '@/app/components/ui/button';
import { useGraduationCopy } from './copy';
import { ErrorNotice, GraduationShell, ResourceNotice, panelClass, useGraduationAction, useGraduationResource } from './shared';
import { ProjectDetails } from './ProjectDetails';
import { useState } from 'react';
import { useTeachingCopy } from './teachingCopy';
import { ProjectHistory } from './ProjectHistory';
import { downloadPortfolio } from './portfolioDocument';
import type { GraduationRelease } from '@/app/api/graduation';

export default function GraduationPortfolio() {
  const c = useGraduationCopy();
  const t = useTeachingCopy(); const [historyId, setHistoryId] = useState<string | null>(null);
  const resource = useGraduationResource<{ projects: GraduationProject[]; releases?: GraduationRelease[] }>('/portfolio');
  const action = useGraduationAction();
  return <GraduationShell title={c.portfolio} description={c.portfolioHelp}>
    <ResourceNotice {...resource} /><ErrorNotice error={action.error} />
    {resource.value && <>
      <Button variant="outline" disabled={!resource.value.projects.length} onClick={() => exportGraduationData(resource.value, 'graduation-portfolio.json')}>{c.export}</Button>
      <Button variant="outline" disabled={!resource.value.projects.length} onClick={() => downloadPortfolio(resource.value!.projects, c)}>{t.printPortfolio}</Button>
      {resource.value.projects.length === 0 && <p className="text-muted-foreground">{c.noPortfolio}</p>}
      {resource.value.projects.map((project) => <article key={project.id} className={panelClass}><h2 className="text-xl font-semibold">{project.title}</h2><p className="text-sm text-muted-foreground">{c[project.status]}</p><ProjectDetails project={project} /><div className="flex flex-wrap gap-3"><Link className="inline-flex min-h-11 items-center text-sm text-primary underline" to={`/graduation/classes/${project.classId}`}>{c.workspace}</Link><Button variant="outline" aria-expanded={historyId === project.id} onClick={() => setHistoryId(historyId === project.id ? null : project.id)}>{t.history}</Button></div>{historyId === project.id && <ProjectHistory key={project.id} projectId={project.id} />}</article>)}
      {!!resource.value.releases?.length && <section className={panelClass}>
        <h2 className="text-xl font-semibold">{c.releaseTitle}</h2><p className="text-sm text-muted-foreground">{c.projectVisibilityHelp}</p>
        <ul className="space-y-4">{resource.value.releases.map((release) => <li key={release.id} className="space-y-3 border-t border-border pt-3">
          <p className="break-words font-medium">{release.title} · {c.version} {release.version} · {formatDate(release.createdAt)}</p>
          {release.withdrawnAt ? <p className="text-sm text-muted-foreground">{c.releasePausedHelp}</p> : release.projects.some((project) => !project.withdrawnAt) && <Link className="inline-flex min-h-11 items-center text-primary underline" to={`/graduation/public/${release.token}`}>{c.viewRelease}</Link>}
          {release.projects.map((project) => <div key={project.id} className="flex flex-wrap items-center gap-3 text-sm">
            <span className="break-words">{project.title}{project.withdrawnAt ? ` · ${c.projectWithdrawn}` : ''}</span>
            <Button variant="outline" disabled={action.pending || resource.loading} onClick={() => void action.run(async () => {
              await graduationRequest(`/releases/${release.id}/projects/${project.id}/visibility`, 'POST', { visible: !!project.withdrawnAt }); resource.reload();
            })}>{project.withdrawnAt ? c.restoreProject : c.withdrawProject}</Button>
          </div>)}
        </li>)}</ul>
      </section>}
    </>}
  </GraduationShell>;
}
