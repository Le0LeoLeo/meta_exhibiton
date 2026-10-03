import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { graduationRequest, exportGraduationData, type GraduationProject, type ProjectInput } from '@/app/api/graduation';
import { getMyGalleries, type GallerySummary } from '@/app/api/gallery';
import { loadAuth } from '@/app/api/auth';
import { Button } from '@/app/components/ui/button';
import { useGraduationCopy } from './copy';
import { ErrorNotice, Field, inputClass, useGraduationAction } from './shared';
import { projectFields } from './ProjectDetails';
import { graduationErrorMessage } from './errors';
import { useI18n } from '@/app/components/I18nProvider';
import { useUnsavedChanges } from '@/app/components/UnsavedChangesProvider';

const emptyProject: ProjectInput = { title: '', researchQuestion: '', concept: '', process: '', outcome: '', team: '', supervisor: '', galleryId: null };
export function ProjectEditor({ classId, project, onSaved, workflow = false, onContinue }: {
  classId: string; project?: GraduationProject; onSaved: () => void; workflow?: boolean; onContinue?: () => void;
}) {
  const c = useGraduationCopy();
  const { locale } = useI18n();
  const flowTitle = locale === 'en' ? '1. Describe the experience' : locale === 'zh-CN' ? '1. 描述经历' : '1. 描述經歷';
  const flowHelp = locale === 'en' ? 'Start with the project, what happened, and the result. Add your personal role in the next step.' : locale === 'zh-CN' ? '先介绍作品、经历和成果，下一步再补充你的个人角色。' : '先介紹作品、經歷和成果，下一步再補充你的個人角色。';
  const saveContinue = locale === 'en' ? 'Save and continue' : locale === 'zh-CN' ? '保存并继续' : '儲存並繼續';
  const stepFields = workflow ? projectFields.filter((key) => !['team', 'supervisor'].includes(key)) : projectFields;
  const optionalDetails = locale === 'en' ? 'Optional details' : locale === 'zh-CN' ? '其他资料（可选）' : '其他資料（可選）';
  const action = useGraduationAction();
  const [form, setForm] = useState<ProjectInput>(() => project ? Object.fromEntries(Object.keys(emptyProject).map((key) => [key, project[key as keyof ProjectInput]])) as ProjectInput : { ...emptyProject });
  const [dirty, setDirty] = useState(false);
  const [waitingForReload, setWaitingForReload] = useState(false);
  const [galleries, setGalleries] = useState<GallerySummary[]>([]);
  const [galleryError, setGalleryError] = useState('');
  useUnsavedChanges(dirty || action.pending);
  useEffect(() => {
    let active = true;
    getMyGalleries(loadAuth().token || '').then((data) => { if (active) setGalleries(data.galleries); })
      .catch((error: unknown) => { if (active) setGalleryError(graduationErrorMessage(error, locale)); });
    return () => { active = false; };
  }, [locale]);
  function update(key: keyof ProjectInput, value: string | null) { setForm((old) => ({ ...old, [key]: value })); setDirty(true); }
  function save(event: FormEvent) {
    event.preventDefault();
    if (workflow && project && !dirty) { onContinue?.(); return; }
    void action.run(async () => {
      await graduationRequest(project ? `/projects/${project.id}` : `/classes/${classId}/projects`, project ? 'PATCH' : 'POST', {
        ...form, ...(project ? { expectedRevision: project.revision } : {}),
      });
      setDirty(false); setWaitingForReload(true); onSaved(); onContinue?.();
    });
  }
  return <form onSubmit={save} className="space-y-4">
    {workflow && <div><h3 className="text-lg font-semibold">{flowTitle}</h3><p className="text-sm text-muted-foreground">{flowHelp}</p></div>}
    <fieldset disabled={action.pending || waitingForReload} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><Field label={`${c.titleField} · ${c.required}`}><input className={inputClass} required maxLength={200} value={form.title} onChange={(e) => update('title', e.target.value)} /></Field></div>
      {stepFields.map((key) => <div key={key} className={key === 'process' || key === 'outcome' ? 'sm:col-span-2' : ''}>
        <Field label={workflow && key === 'researchQuestion' ? (locale === 'en' ? 'What question were you exploring?' : locale === 'zh-CN' ? '你想探索什么问题？' : '你想探索甚麼問題？') : workflow && key === 'concept' ? (locale === 'en' ? 'What idea were you trying?' : locale === 'zh-CN' ? '你尝试了什么想法？' : '你嘗試了甚麼想法？') : c[key]}><textarea className={inputClass} rows={key === 'team' || key === 'supervisor' ? 2 : 4} maxLength={key === 'supervisor' ? 500 : key === 'team' ? 1000 : 4000} value={form[key]} onChange={(e) => update(key, e.target.value)} /></Field>
      </div>)}
      {workflow ? <details className="space-y-3 sm:col-span-2"><summary className="cursor-pointer text-sm font-medium">{optionalDetails}</summary>
        <div className="grid gap-4 pt-2 sm:grid-cols-2">
          {(['team', 'supervisor'] as const).map((key) => <Field key={key} label={c[key]}><textarea className={inputClass} rows={2} maxLength={key === 'team' ? 1000 : 500} value={form[key]} onChange={(e) => update(key, e.target.value)} /></Field>)}
          {renderGalleryField()}
        </div>
      </details> : renderGalleryField()}
    </fieldset>
    <ErrorNotice error={action.error} />
    <div className="flex flex-wrap gap-3">
      <Button type="submit" disabled={action.pending || waitingForReload}>{waitingForReload ? c.saved : action.pending ? c.working : workflow ? saveContinue : c.save}</Button>
      {!workflow && project && <Button type="button" variant="outline" disabled={action.pending || dirty || waitingForReload} onClick={() => void action.run(async () => {
        await graduationRequest(`/projects/${project.id}/submit`, 'POST', { expectedRevision: project.revision }); setWaitingForReload(true); onSaved();
      })}>{c.submit}</Button>}
      {!workflow && <Button type="button" variant="ghost" onClick={() => exportGraduationData(form, 'graduation-draft.json')}>{c.downloadDraft}</Button>}
    </div><p className="text-xs text-muted-foreground">{workflow ? locale === 'en' ? 'Save each step; the project and its skill cards are sent together in the final step.' : locale === 'zh-CN' ? '每一步先保存；最后一步会一并提交作品和能力卡。' : '每一步先儲存；最後一步會一併提交作品和能力卡。' : c.submitHelp}</p>
  </form>;

  function renderGalleryField() {
    return <div className="space-y-2 sm:col-span-2"><Field label={c.galleryId}><select className={inputClass} value={form.galleryId || ''} onChange={(e) => update('galleryId', e.target.value || null)}>
        <option value="">{c.noGallery}</option>
        {form.galleryId && !galleries.some((gallery) => gallery.id === form.galleryId) && <option value={form.galleryId}>{form.galleryId}</option>}
        {galleries.map((gallery) => <option key={gallery.id} value={gallery.id}>{gallery.title}</option>)}
      </select></Field><p className="text-xs text-muted-foreground">{c.galleryHelp}</p><Link className="text-sm text-primary underline" to="/virtual-gallery/my-exhibitions" target="_blank" rel="noopener">{c.workspace} · 3D</Link><ErrorNotice error={galleryError} /></div>;
  }
}
