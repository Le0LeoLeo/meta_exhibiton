import { useState } from 'react';
import { formatDateTime } from '@/app/utils/formatDate';
import { exportGraduationData, type GraduationProject } from '@/app/api/graduation';
import { Button } from '@/app/components/ui/button';
import { Field, ResourceNotice, inputClass, useGraduationResource } from './shared';
import { useTeachingCopy } from './teachingCopy';
import { useGraduationCopy } from './copy';
import { ProjectDetails } from './ProjectDetails';
import { downloadPortfolio } from './portfolioDocument';

export function ProjectHistory({ projectId }: { projectId: string }) {
  const t = useTeachingCopy(); const c = useGraduationCopy();
  const resource = useGraduationResource<{ versions: GraduationProject[] }>(`/projects/${encodeURIComponent(projectId)}/history`);
  const [revision, setRevision] = useState<number | null>(null);
  const selected = resource.value?.versions.find((p) => p.revision === revision) || resource.value?.versions[0];
  return <section className="space-y-4 border-t border-border pt-4"><p className="text-sm text-muted-foreground">{t.historyHelp}</p><ResourceNotice {...resource} />
    {selected && <><Field label={t.selectedVersion}><select className={inputClass} value={selected.revision} onChange={(event) => setRevision(Number(event.target.value))}>{resource.value?.versions.map((p) => <option key={p.revision} value={p.revision}>{c.version} {p.revision} · {c[p.status]} · {formatDateTime(p.updatedAt)}</option>)}</select></Field>
      <h3 className="break-words text-lg font-semibold">{selected.title}</h3><ProjectDetails project={{ ...selected, galleryId: null }} />
      {selected.feedback && <p className="whitespace-pre-wrap break-words text-sm">{c.feedback}: {selected.feedback}</p>}
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => downloadPortfolio([selected], c)}>{t.printPortfolio}</Button><Button variant="outline" onClick={() => exportGraduationData(resource.value, 'graduation-project-versions.json')}>{t.versionData}</Button></div>
    </>}
  </section>;
}
