import { Link } from 'react-router';
import { ArrowRight, Bot, GraduationCap, UsersRound } from 'lucide-react';
import { useI18n, type Locale } from '../components/I18nProvider';

const copy = {
  'zh-TW': {
    eyebrow: 'AI 教育實踐',
    title: '透過 3D 作品展建構、討論與提問',
    intro: '選用可在課堂使用的素材建立 3D 作品展，與同學在共享空間討論，再向展覽 Agent 提問，並回到作品和來源核對回應。',
    teacher: '教師：設計探究問題',
    teacherSteps: [
      '建立班級展覽、訂出探究問題，將邀請碼交給參展學生。',
      '在班級工作台評閱學生提交的專題說明，提供意見或退回修改。',
      '核准準備完成的作品，確認公開範圍後建立班級公開典藏。',
    ],
    student: '學生：策展並交流觀點',
    studentSteps: [
      '用教師提供的邀請碼加入班級，挑選獲准使用的作品並保留來源。',
      '在 3D 展覽安排作品，並說明一項空間或策展選擇如何連結探究問題。',
      '在班級工作台儲存並提交專題說明，依教師回饋修改，再提交審核。',
    ],
    agent: '向展覽 Agent 提問並核對',
    agentSteps: [
      '以觀展者身分進入展覽，選擇 AI 導覽模式。',
      '請 Agent 比較作品、說明回應依據，或區分可觀察內容與推論。',
      '回到作品和列出的來源核對回應，記下不準確、缺少來源或仍待回答之處。',
    ],
    teacherAction: '開啟班級工作台',
    studentAction: '加入班級展覽',
    agentAction: '瀏覽展覽',
    note: 'AI 回應可能有錯誤或缺少脈絡，不是評分或事實判定。請以作品、來源和師生討論核對內容；分享前確認素材授權與公開範圍。',
  },
  'zh-CN': {
    eyebrow: 'AI 教育实践',
    title: '通过 3D 作品展进行策展、讨论与提问',
    intro: '选用获准在课堂使用的素材创建 3D 作品展，与同学在共享空间讨论，再向展览 Agent 提问，并回到作品和来源核对回答。',
    teacher: '教师：设计探究问题',
    teacherSteps: [
      '创建班级展览、设定探究问题，将邀请码交给参展学生。',
      '在班级工作台评阅学生提交的项目说明，提供意见或退回修改。',
      '批准准备完成的作品，确认公开范围后创建班级公开典藏。',
    ],
    student: '学生：策展并交流观点',
    studentSteps: [
      '用教师提供的邀请码加入班级，挑选获准使用的作品并保留来源。',
      '在 3D 展览中安排作品，并说明一项空间或策展选择如何关联探究问题。',
      '在班级工作台保存并提交项目说明，根据教师反馈修改，再提交审核。',
    ],
    agent: '向展览 Agent 提问并核对',
    agentSteps: [
      '以观展者身份进入展览，选择 AI 导览模式。',
      '请 Agent 比较作品、说明回答依据，或区分可观察内容与推论。',
      '回到作品和列出的来源核对回答，记录不准确、缺少来源或仍待回答之处。',
    ],
    teacherAction: '打开班级工作台',
    studentAction: '加入班级展览',
    agentAction: '浏览展览',
    note: 'AI 回答可能有误或缺少背景，不用于评分或事实判定。请通过作品、来源和师生讨论核对内容；分享前确认素材授权和公开范围。',
  },
  en: {
    eyebrow: 'AI for education',
    title: 'Build, discuss, and question a 3D exhibition',
    intro: 'Create a 3D exhibition from material permitted for class use. Discuss it with classmates in a shared space, then ask the gallery Agent questions and check its replies against the works and sources.',
    teacher: 'Teacher: frame an inquiry',
    teacherSteps: [
      'Create a class exhibition, set an inquiry question, and give participating students the invitation code.',
      'Review submitted project descriptions in the class workspace, leave feedback, or return them for revision.',
      'Approve ready projects and confirm what will be public before creating the class archive.',
    ],
    student: 'Student: curate and exchange ideas',
    studentSteps: [
      'Join with your teacher’s invitation code, choose permitted works, and keep their sources.',
      'Arrange works in the 3D exhibition and explain how one curatorial choice connects to the inquiry.',
      'Save and submit your project in the class workspace, revise it using teacher feedback, and submit again.',
    ],
    agent: 'Question the gallery Agent and verify',
    agentSteps: [
      'Enter an exhibition as a visitor and choose the AI guide mode.',
      'Ask the Agent to compare works, explain the basis for a reply, or separate observations from inferences.',
      'Check replies against the works and listed sources; note inaccuracies, missing sources, and unanswered questions.',
    ],
    teacherAction: 'Open class workspace',
    studentAction: 'Join a class exhibition',
    agentAction: 'Browse exhibitions',
    note: 'AI replies can be wrong or lack context; they do not grade work or establish facts. Check them against the works, sources, and class discussion. Confirm permissions and what will be public before sharing.',
  },
} satisfies Record<Locale, {
  eyebrow: string; title: string; intro: string; teacher: string; teacherSteps: string[];
  student: string; studentSteps: string[]; agent: string; agentSteps: string[];
  teacherAction: string; studentAction: string; agentAction: string; note: string;
}>;

export function educationGuideIntro(locale: Locale = 'en') {
  return copy[locale].intro;
}

export default function EducationGuide() {
  const { locale } = useI18n();
  const c = copy[locale ?? 'en'];
  const guides = [
    { title: c.teacher, steps: c.teacherSteps, icon: GraduationCap, href: '/graduation', action: c.teacherAction },
    { title: c.student, steps: c.studentSteps, icon: UsersRound, href: '/graduation', action: c.studentAction },
    { title: c.agent, steps: c.agentSteps, icon: Bot, href: '/exhibitions', action: c.agentAction },
  ];

  return (
    <section aria-labelledby="education-guide-title" className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-curator-brass">{c.eyebrow}</p>
      <h2 id="education-guide-title" className="mb-3 text-3xl font-semibold">{c.title}</h2>
      <p className="mb-7 max-w-3xl text-muted-foreground">{c.intro}</p>
      <div className="grid gap-5 lg:grid-cols-3">
        {guides.map(({ title, steps, icon: Icon, href, action }) => (
          <article key={title} className="flex flex-col rounded-md border border-border bg-card p-6">
            <Icon aria-hidden="true" className="mb-4 size-7 text-curator-brass" />
            <h3 className="mb-4 text-xl font-semibold">{title}</h3>
            <ol className="mb-6 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
              {steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
            <Link to={href} className="mt-auto inline-flex min-h-11 items-center gap-2 font-medium text-primary underline underline-offset-4">
              {action}<ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </article>
        ))}
      </div>
      <p className="mt-6 rounded-md border border-border bg-secondary p-4 text-sm leading-relaxed text-foreground">{c.note}</p>
    </section>
  );
}
