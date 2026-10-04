import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowUpRight, BookOpen, GraduationCap, Users } from 'lucide-react';
import { graduationRequest, type GraduationClass } from '@/app/api/graduation';
import { Button } from '@/app/components/ui/button';
import { useI18n } from '@/app/components/I18nProvider';
import { useGraduationCopy } from './copy';
import { ErrorNotice, Field, GraduationShell, ResourceNotice, inputClass, panelClass, useGraduationAction, useGraduationResource } from './shared';

const guidance = {
  'zh-TW': {
    existing: '繼續我的班級展', open: '進入班級工作台',
    teacherHeading: '我是教師／組展者', teacherIntro: '建立班級展，邀請學生投稿，並集中評閱與策展。',
    teacherSteps: ['建立班級展；可選擇設定投稿截止時間', '進入班級頁面，將邀請碼交給學生', '評閱投稿；確認公開內容後發布典藏'],
    studentHeading: '我是學生', studentIntro: '取得教師提供的邀請碼後加入班級，開始準備自己的作品。',
    studentSteps: ['輸入班級邀請碼', '建立作品草稿，記錄理念、過程與成果', '提交評閱，依教師意見修訂'],
  },
  en: {
    existing: 'Continue my class exhibitions', open: 'Open class workspace',
    teacherHeading: 'I organise a class', teacherIntro: 'Create a class exhibition, invite students, and review their work in one place.',
    teacherSteps: ['Create the class exhibition and set an optional deadline', 'Open the class page and share its invitation code', 'Review submissions, then check content before publishing an archive'],
    studentHeading: 'I am a student', studentIntro: 'Join with the code from your teacher and start preparing your project.',
    studentSteps: ['Enter the class invitation code', 'Draft your project and document your idea, process, and outcome', 'Submit for review and revise from feedback'],
  },
  'zh-CN': {
    existing: '继续我的班级展', open: '进入班级工作台',
    teacherHeading: '我是教师／组展者', teacherIntro: '建立班级展，邀请学生投稿，并集中评阅与策展。',
    teacherSteps: ['建立班级展；可选择设置投稿截止时间', '进入班级页面，将邀请码交给学生', '评阅投稿；确认公开内容后发布典藏'],
    studentHeading: '我是学生', studentIntro: '取得教师提供的邀请码后加入班级，开始准备自己的作品。',
    studentSteps: ['输入班级邀请码', '建立作品草稿，记录理念、过程与成果', '提交评阅，依教师意见修订'],
  },
} as const;

export default function GraduationWorkspace() {
  const c = useGraduationCopy();
  const { locale } = useI18n();
  const guide = guidance[locale];
  const navigate = useNavigate();
  const location = useLocation();
  const resource = useGraduationResource<{ classes: GraduationClass[] }>('/classes');
  const action = useGraduationAction();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [inviteToken, setInviteToken] = useState(() => new URLSearchParams(location.search).get('invite') || '');
  const [role, setRole] = useState<'teacher' | 'student'>(() => location.hash === '#teacher' ? 'teacher' : 'student');
  const { clearError } = action;
  // An error from one role's form (e.g. a bad invitation code) should not follow the user to the other.
  useEffect(() => { clearError(); }, [role, clearError]);
  useEffect(() => {
    const nextRole = location.hash === '#teacher' ? 'teacher' : location.hash === '#student' ? 'student' : null;
    if (!nextRole) return;
    setRole(nextRole);
    const id = location.hash.slice(1);
    const frame = window.requestAnimationFrame(() => {
      const form = document.getElementById(id);
      form?.focus({ preventScroll: true });
      form?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash]);
  function create(event: FormEvent) {
    event.preventDefault();
    void action.run(async () => {
      const result = await graduationRequest<{ class: GraduationClass }>('/classes', 'POST', {
        title, description, deadline: deadline ? new Date(deadline).toISOString() : null,
      });
      navigate(`/graduation/classes/${result.class.id}`);
    });
  }
  function join(event: FormEvent) {
    event.preventDefault();
    void action.run(async () => {
      const result = await graduationRequest<{ class: GraduationClass }>('/join', 'POST', { inviteToken: inviteToken.trim() });
      navigate(`/graduation/classes/${result.class.id}`);
    });
  }
  return <GraduationShell title={c.title} description={c.intro}>
    <ResourceNotice {...resource} /><ErrorNotice error={action.error} />
    {resource.value?.classes.length ? <section aria-label={c.workspace} className="space-y-4">
      <h2 className="text-xl font-semibold">{guide.existing}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resource.value.classes.map((exhibition) => <Link key={exhibition.id} to={`/graduation/classes/${exhibition.id}`} className={`${panelClass} transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>
          <div className="flex justify-between text-primary"><BookOpen className="size-5" aria-hidden="true" /><ArrowUpRight className="size-5" aria-hidden="true" /></div>
          <p className="text-xs font-medium text-muted-foreground">{c[exhibition.role]}</p>
          <h3 className="break-words text-xl font-semibold">{exhibition.title}</h3>
          <p className="line-clamp-3 text-sm text-muted-foreground">{exhibition.description}</p>
          <p className="text-sm font-medium text-primary">{guide.open}</p>
        </Link>)}
      </div>
    </section> : null}
    {!resource.loading && resource.value?.classes.length === 0 && <p className="text-muted-foreground">{c.emptyClasses}</p>}
    <div role="tablist" aria-label={locale === 'en' ? 'Choose your role' : locale === 'zh-CN' ? '选择你的身份' : '選擇你的身份'} className="flex flex-wrap gap-2">
      {(['student', 'teacher'] as const).map((option) => <Button key={option} type="button" role="tab" aria-selected={role === option}
        variant={role === option ? 'default' : 'outline'} onClick={() => navigate(`/graduation#${option}`)}>
        {option === 'student' ? guide.studentHeading : guide.teacherHeading}
      </Button>)}
    </div>
    <div className="grid items-start gap-6">
      {role === 'teacher' && <form id="teacher" tabIndex={-1} onSubmit={create} className={`${panelClass} scroll-mt-24`}>
        <div className="flex items-center gap-2 text-primary"><GraduationCap className="size-5" aria-hidden="true" /><h2 className="text-xl font-semibold">{guide.teacherHeading}</h2></div>
        <p className="text-sm text-muted-foreground">{guide.teacherIntro}</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">{guide.teacherSteps.map((step) => <li key={step}>{step}</li>)}</ol>
        <h3 className="font-semibold">{c.create}</h3>
        <Field label={c.classTitle}><input className={inputClass} required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label={c.description}><textarea className={inputClass} rows={3} required maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label={c.deadline}><input type="datetime-local" className={inputClass} value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
        <p className="text-xs text-muted-foreground">{c.roleNote}</p>
        <Button type="submit" disabled={action.pending}>{action.pending ? c.working : c.create}</Button>
      </form>}
      {role === 'student' && <form id="student" tabIndex={-1} onSubmit={join} className={`${panelClass} scroll-mt-24`}>
        <div className="flex items-center gap-2 text-primary"><Users className="size-5" aria-hidden="true" /><h2 className="text-xl font-semibold">{guide.studentHeading}</h2></div>
        <p className="text-sm text-muted-foreground">{guide.studentIntro}</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">{guide.studentSteps.map((step) => <li key={step}>{step}</li>)}</ol>
        <h3 className="font-semibold">{c.join}</h3><p className="text-sm text-muted-foreground">{c.joinHelp}</p>
        <Field label={c.invite}><input className={inputClass} required maxLength={200} autoComplete="off" value={inviteToken} onChange={(e) => setInviteToken(e.target.value)} /></Field>
        <Button type="submit" disabled={action.pending}>{action.pending ? c.working : c.join}</Button>
      </form>}
    </div>
  </GraduationShell>;
}
