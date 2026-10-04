import { useEffect, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { listSkills, type SkillCard } from '@/app/api/skills';
import { submitGraduationProject, type GraduationProject } from '@/app/api/graduation';
import { useI18n } from '@/app/components/I18nProvider';
import { graduationErrorMessage } from './errors';
import { ErrorNotice, panelClass } from './shared';
import { useGraduationCopy } from './copy';
import { ProjectDetails } from './ProjectDetails';
import { ProjectEditor } from './ProjectEditor';
import { SkillPortfolio } from './SkillPortfolio';

export type GraduationStep = 1 | 2 | 3;
type Step = GraduationStep;

const labels = {
  en: ['Describe the experience', 'Add and check evidence', 'Preview and submit'],
  'zh-TW': ['描述經歷', '加入並核對佐證', '預覽並提交'],
  'zh-CN': ['描述经历', '添加并核对佐证', '预览并提交'],
} as const;

export function StudentSubmissionFlow({ classId, project, onSaved, step, onStepChange }: {
  classId: string; project?: GraduationProject; onSaved: () => void; step: Step; onStepChange: (step: Step) => void;
}) {
  const { locale } = useI18n();
  const c = useGraduationCopy();
  const setStep = onStepChange;
  const [skills, setSkills] = useState<SkillCard[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [skillsReady, setSkillsReady] = useState(false);
  const [refreshSkills, setRefreshSkills] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (step !== 3 || !project) return;
    let active = true;
    setLoadingSkills(true); setSkillsReady(false); setError('');
    listSkills(project.id).then(({ skills: result }) => { if (active) { setSkills(result); setSkillsReady(true); } })
      .catch((reason: unknown) => { if (active) setError(graduationErrorMessage(reason, locale)); })
      .finally(() => { if (active) setLoadingSkills(false); });
    return () => { active = false; };
  }, [locale, project, refreshSkills, step]);

  const copy = labels[locale];
  const ready = !!project && !!project.title.trim() && !!project.researchQuestion.trim() && !!project.concept.trim()
    && !!project.process.trim() && !!project.outcome.trim();

  async function submit() {
    if (!project || !ready) return;
    setPending(true); setError('');
    try {
      await submitGraduationProject(project.id, project.revision,
        skills.filter((skill) => skill.status === 'draft' || skill.status === 'returned').map(({ id, revision }) => ({ id, revision })));
      setComplete(true); onSaved();
    } catch (reason) { setSkillsReady(false); setError(graduationErrorMessage(reason, locale)); }
    finally { setPending(false); }
  }

  return <section className={`${panelClass} space-y-5`} aria-label="Student submission">
    <ol className="grid gap-2 sm:grid-cols-3" aria-label="Submission steps">
      {copy.map((label, index) => {
        const number = (index + 1) as Step;
        return <li key={label}>
          <div className={`w-full rounded-lg border p-3 text-sm ${step === number ? 'border-primary bg-primary/5 font-semibold' : 'border-border'}`}
            aria-current={step === number ? 'step' : undefined}><span className="mr-2 text-muted-foreground">{number}</span>{label}</div>
        </li>;
      })}
    </ol>
    <ErrorNotice error={error} />
    {complete && <p role="status" className="rounded-lg bg-secondary p-3 text-sm">{locale === 'en' ? 'Saved and sent to your teacher. Your next step is to wait for feedback.' : locale === 'zh-CN' ? '已保存并提交给教师。接下来请等待反馈。' : '已儲存並提交給教師。接下來請等待意見。'}</p>}

    {step === 1 && <ProjectEditor classId={classId} project={project} onSaved={onSaved} workflow onContinue={() => setStep(2)} />}
    {step === 2 && project && <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{locale === 'en' ? 'Describe what you personally did, and add a source if you have one. AI help is optional; you can finish manually when AI is unavailable.' : locale === 'zh-CN' ? '写下你个人做了什么，有资料来源时可在此添加。AI 辅助为可选；AI 暂不可用时仍可手动完成。' : '寫下你個人做了甚麼，如有資料來源可在此加入。AI 輔助為可選；AI 暫不可用時仍可手動完成。'}</p>
      <SkillPortfolio projectId={project.id} teacher={false} guided project={project} onBack={() => setStep(1)} onContinue={() => { setError(''); setStep(3); }} />
    </div>}
    {step === 3 && project && <div className="space-y-5">
      <div><h3 className="text-lg font-semibold">{locale === 'en' ? '3. Preview and submit' : locale === 'zh-CN' ? '3. 预览并提交' : '3. 預覽並提交'}</h3><p className="text-sm text-muted-foreground">{locale === 'en' ? 'Check the saved project and skill cards before sending them together for teacher review.' : locale === 'zh-CN' ? '检查已保存的作品和能力卡，再一并提交给教师审核。' : '檢查已儲存的作品和能力卡，再一併提交給教師審核。'}</p></div>
      <article className="space-y-3 rounded-lg border border-border p-4">
        <h4 className="font-semibold">{project.title || c.newProject}</h4>
        <ProjectDetails project={project} />
      </article>
      <section className="space-y-3" aria-label="Related skill cards">
        <h4 className="font-semibold">{locale === 'en' ? 'Personal reflection and evidence' : locale === 'zh-CN' ? '个人反思与佐证' : '個人反思與佐證'}</h4>
        {loadingSkills ? <p role="status" className="text-sm text-muted-foreground">{locale === 'en' ? 'Loading saved cards…' : locale === 'zh-CN' ? '正在载入已保存的能力卡…' : '正在載入已儲存的能力卡…'}</p> : error ? <Button type="button" variant="outline" onClick={() => setRefreshSkills((key) => key + 1)}>{locale === 'en' ? 'Retry loading cards' : locale === 'zh-CN' ? '重新载入能力卡' : '重新載入能力卡'}</Button> : skills.length ? skills.map((skill) => <article key={skill.id} className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex flex-wrap justify-between gap-2"><strong>{skill.title}</strong><span className="text-xs text-muted-foreground">{skill.status}</span></div>
          {skill.role && <p className="text-sm"><b>{locale === 'en' ? 'My role:' : locale === 'zh-CN' ? '我的角色：' : '我的角色：'}</b> {skill.role}</p>}
          {skill.actions && <p className="whitespace-pre-wrap text-sm">{skill.actions}</p>}
          {skill.outcome && <p className="whitespace-pre-wrap text-sm"><b>{locale === 'en' ? 'Result:' : locale === 'zh-CN' ? '结果：' : '成果：'}</b> {skill.outcome}</p>}
          {skill.reflection && <p className="whitespace-pre-wrap text-sm"><b>{locale === 'en' ? 'What I learned:' : locale === 'zh-CN' ? '我的收获：' : '我的收穫：'}</b> {skill.reflection}</p>}
          {skill.summary && <p className="whitespace-pre-wrap text-sm"><b>{locale === 'en' ? 'Summary:' : locale === 'zh-CN' ? '摘要：' : '摘要：'}</b> {skill.summary}</p>}
          {!!skill.evidence.length && <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">{skill.evidence.map((item) => <li key={item.id}>
            <span>{item.label} · {item.source} · {item.visibility} · {item.kind === 'text' ? (locale === 'en' ? 'student-provided text' : locale === 'zh-CN' ? '学生提供的文字' : '學生提供的文字') : (locale === 'en' ? 'link not read' : locale === 'zh-CN' ? '未读取链接内容' : '未讀取連結內容')}</span>
            {(item.content || item.url) && <p className="break-all">{item.content || item.url}</p>}
          </li>)}</ul>}
        </article>) : <p className="text-sm text-muted-foreground">{locale === 'en' ? 'No skill cards added. You can still submit your project.' : locale === 'zh-CN' ? '尚未添加能力卡。你仍可提交作品。' : '尚未加入能力卡。你仍可提交作品。'}</p>}
      </section>
      {!ready && <p role="status" className="text-sm text-amber-700">{locale === 'en' ? 'Complete the title, question, concept, process, and outcome in step 1 before submitting.' : locale === 'zh-CN' ? '提交前请在第一步完成作品名称、问题、理念、过程和成果。' : '提交前請在第一步完成作品名稱、問題、理念、過程和成果。'}</p>}
      <div className="flex flex-wrap justify-between gap-3">
        <Button type="button" variant="outline" disabled={pending} onClick={() => setStep(2)}>{locale === 'en' ? 'Back' : locale === 'zh-CN' ? '返回' : '返回'}</Button>
        <Button type="button" disabled={pending || loadingSkills || !skillsReady || !ready || complete} onClick={() => void submit()}>{pending ? c.working : locale === 'en' ? 'Submit to teacher' : locale === 'zh-CN' ? '提交给教师' : '提交給教師'}</Button>
      </div>
    </div>}
  </section>;
}
