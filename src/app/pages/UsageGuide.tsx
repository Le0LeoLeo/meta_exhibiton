import { Link } from 'react-router';
import { ArrowRight, Bot, Hammer, LayoutTemplate, ShieldCheck, UsersRound } from 'lucide-react';
import { useI18n, type Locale } from '../components/I18nProvider';

type Guide = { id: string; title: string; when: string; steps: string[]; tip: string; action: string };
type Copy = { eyebrow: string; title: string; intro: string; tipLabel: string; guides: Guide[] };

// Steps name the buttons exactly as they appear in each language's interface.
const copy: Record<Locale, Copy> = {
  en: {
    eyebrow: 'How to use Paidea',
    title: 'Step-by-step guides',
    intro: 'Each guide follows one task from start to finish. Button names match what you see on screen.',
    tipLabel: 'Tip',
    guides: [
      {
        id: 'guide-build', title: '1. Build a learning exhibition', when: 'For students presenting their work.',
        steps: [
          'Sign in and open My Exhibitions. Choose Select Template, name the exhibition, pick a template and press Create & Edit.',
          'In the editor, click a work on the wall to open the Inspector. Replace the image with your own file or link, then edit the title, artist and description.',
          'Under the description, fill in My contribution, Process, Outcome and Reflection. Use Add source for evidence such as feedback or a reference, and paste a short excerpt.',
          'Press Save Exhibition. Auto save also keeps your changes while you work.',
          'Back in My Exhibitions, open More actions → Publish when you are ready for visitors. Use Share to copy the link.',
        ],
        tip: 'Write what you actually did in your own words. Visitors and the AI guide read these fields as your account, not as verified facts.',
        action: 'Open My Exhibitions',
      },
      {
        id: 'guide-visit', title: '2. Visit an exhibition together', when: 'For classmates and teachers exploring the same room.',
        steps: [
          'Open the exhibition link and choose Solo Mode or AI Companion, then Confirm.',
          'Click the gallery to control the view. Use WASD to move and the mouse to look; press Esc to release the mouse. On a phone, drag the joystick and swipe to look.',
          'Click a work to read its details, including the creator’s contribution, process, reflection and sources. Use Previous and Next to move between works.',
          'Open Room chat at the bottom left to talk with everyone in the room. The button shows how many people are here and any new messages.',
          'Use Wave, Cheer, Clap or Bow (keys 1–4) to react. Switch to 2D artworks at the top right for a readable list with the same information.',
        ],
        tip: 'Messages sent before you joined are not shown, so agree on a start time before a class discussion.',
        action: 'Visit an exhibition',
      },
      {
        id: 'guide-ask', title: '3. Ask the AI guide about a work', when: 'For visitors who want to explore a work further.',
        steps: [
          'Click a work, then press Ask the Agent about this work. The guide panel opens with that work in focus.',
          'Ask a specific question, such as what the creator did, how two works compare, or what you can see in the image.',
          'Ask follow-up questions; the guide keeps the same work in focus until you open or walk up to another one.',
          'Compare each answer with the work and its listed sources. Note anything inaccurate, unsupported or missing.',
        ],
        tip: 'The guide answers only from the exhibition’s text and image. When the material does not say something, it should tell you so instead of guessing.',
        action: 'Try a sample exhibition',
      },
      {
        id: 'guide-layout', title: '4. Arrange a room with the AI layout builder', when: 'For creators who want help with placement.',
        steps: [
          'In the editor, open More → AI Builder.',
          'Describe the change in the Exhibition brief, for example “Swap the positions of the two portraits” or “Group the prints on the main wall”. Press Generate exhibition.',
          'Read the preview: it lists what moved, was added or was removed. Your exhibition does not change yet.',
          'Press Apply generated exhibition to keep the result, or Discard result to drop it. Undo also reverses an applied change.',
          'If generation stops with nothing changed, read the warning (it names the works involved), simplify the brief and generate again.',
        ],
        tip: 'Small, specific requests work best. Existing works are never removed unless you allow it in Assets & settings.',
        action: 'Open My Exhibitions',
      },
      {
        id: 'guide-care', title: '5. Use material and AI responsibly', when: 'For everyone before sharing.',
        steps: [
          'Only upload images, video and text you are allowed to share, and keep their sources.',
          'Do not include sensitive personal information about yourself or others.',
          'Treat AI answers and layouts as suggestions. Check them, edit them, and decide for yourself what to keep.',
          'Before publishing, check every work and its context as a visitor would see it.',
        ],
        tip: 'Text and images you ask about are sent to the AI service to produce an answer.',
        action: 'Read the privacy policy',
      },
    ],
  },
  'zh-TW': {
    eyebrow: 'Paidea 使用方法',
    title: '逐步使用指南',
    intro: '每份指南帶你由頭到尾完成一項工作，按鈕名稱與畫面上一致。',
    tipLabel: '提示',
    guides: [
      {
        id: 'guide-build', title: '1. 建立學習展覽', when: '適合要展示作品的學生。',
        steps: [
          '登入後打開「我的展覽」，按「選擇模板」，輸入展覽名稱、選擇模板，再按「建立並編輯」。',
          '在編輯器點選牆上的作品打開「屬性設定」，換上自己的圖片或連結，再修改標題、作者和說明。',
          '在說明下方填寫「我的創作貢獻」「創作過程」「成果」「創作反思」。按「新增來源」記錄佐證，例如回饋或參考資料，並貼上簡短摘錄。',
          '按「儲存展覽」。編輯期間自動儲存也會保留你的修改。',
          '回到「我的展覽」，準備好讓人參觀時，打開「更多操作 → 發布展覽」，再用「分享」複製連結。',
        ],
        tip: '用自己的話寫下實際做過的事。訪客和 AI 導覽會把這些欄位視為你的自述，而不是已核實的事實。',
        action: '打開我的展覽',
      },
      {
        id: 'guide-visit', title: '2. 一起參觀展覽', when: '適合在同一展廳參觀的同學和老師。',
        steps: [
          '打開展覽連結，選擇「個人參展」或「AI 智慧伴展」，再按「確定」。',
          '點一下展廳開始操作：WASD 移動、滑鼠轉視角，按 Esc 釋放滑鼠。手機上拖動搖桿移動、滑動畫面轉視角。',
          '點選作品閱讀詳情，包括創作者的貢獻、過程、反思和來源；用「上一件」「下一件」切換作品。',
          '打開左下角的「展廳聊天」與展廳內所有人交流，按鈕會顯示在場人數和新訊息。',
          '用揮手、歡呼、鼓掌、鞠躬（鍵盤 1–4）互動；右上角切換「2D 圖文」可閱讀相同資料的清單。',
        ],
        tip: '加入前的訊息不會顯示，課堂討論前請先約好開始時間。',
        action: '前往參觀展覽',
      },
      {
        id: 'guide-ask', title: '3. 向 AI 導覽提問', when: '適合想深入了解作品的訪客。',
        steps: [
          '點選作品，再按「詢問 Agent 這件作品」，導覽面板會以這件作品為焦點打開。',
          '提出具體問題，例如創作者做了甚麼、兩件作品有何異同，或圖片中看到甚麼。',
          '可以繼續追問；在你打開或走近另一件作品之前，導覽會一直以同一件作品為焦點。',
          '把每個回答與作品和列出的來源比對，記下不準確、沒有依據或缺漏之處。',
        ],
        tip: '導覽只根據展覽中的文字和圖片回答；資料沒有提到的內容，它應該直接說明，而不是猜測。',
        action: '試用示範展覽',
      },
      {
        id: 'guide-layout', title: '4. 用 AI 佈展助手調整展廳', when: '適合需要排位協助的創作者。',
        steps: [
          '在編輯器打開「更多 → AI 建展」。',
          '在展覽需求中描述想要的改動，例如「把兩幅肖像互換位置」或「把版畫集中在主牆」，再按「生成展覽」。',
          '閱讀預覽：它會列出移動、新增或移除了甚麼，此時你的展覽還沒有改變。',
          '按「套用生成展覽」保留結果，或按「放棄結果」放棄；套用後也可以用「復原」撤回。',
          '如果生成停止且沒有任何改動，閱讀警告（會寫出相關作品名稱），把需求寫得簡單些再生成一次。',
        ],
        tip: '細小而具體的要求效果最好。除非你在「素材與設定」中允許，否則不會移除現有作品。',
        action: '打開我的展覽',
      },
      {
        id: 'guide-care', title: '5. 負責任地使用素材和 AI', when: '適合每一位分享前的使用者。',
        steps: [
          '只上載你獲准分享的圖片、影片和文字，並保留來源。',
          '不要放入自己或他人的敏感個人資料。',
          '把 AI 的回答和佈展結果當作建議：先核對、再修改，由你決定保留甚麼。',
          '發布前以訪客身分檢查每件作品和它的學習脈絡。',
        ],
        tip: '你向 AI 提問時，相關文字和圖片會傳送到 AI 服務以產生回答。',
        action: '閱讀私隱政策',
      },
    ],
  },
  'zh-CN': {
    eyebrow: 'Paidea 使用方法',
    title: '分步使用指南',
    intro: '每份指南带你从头到尾完成一项工作，按钮名称与界面一致。',
    tipLabel: '提示',
    guides: [
      {
        id: 'guide-build', title: '1. 创建学习展览', when: '适合要展示作品的学生。',
        steps: [
          '登录后打开“我的展览”，点击“选择模板”，输入展览名称、选择模板，再点击“建立并编辑”。',
          '在编辑器点选墙上的作品打开“属性设定”，换上自己的图片或链接，再修改标题、作者和说明。',
          '在说明下方填写“我的创作贡献”“创作过程”“成果”“创作反思”。点击“添加来源”记录佐证，例如反馈或参考资料，并贴上简短摘录。',
          '点击“储存展览”。编辑期间自动保存也会保留你的修改。',
          '回到“我的展览”，准备好让人参观时，打开“更多操作 → 发布展览”，再用“分享”复制链接。',
        ],
        tip: '用自己的话写下实际做过的事。访客和 AI 导览会把这些字段视为你的自述，而不是已核实的事实。',
        action: '打开我的展览',
      },
      {
        id: 'guide-visit', title: '2. 一起参观展览', when: '适合在同一展厅参观的同学和老师。',
        steps: [
          '打开展览链接，选择“个人参展”或“AI 智慧伴展”，再点击“确定”。',
          '点一下展厅开始操作：WASD 移动、鼠标转视角，按 Esc 释放鼠标。手机上拖动摇杆移动、滑动画面转视角。',
          '点选作品阅读详情，包括创作者的贡献、过程、反思和来源；用“上一件”“下一件”切换作品。',
          '打开左下角的“展厅聊天”与展厅内所有人交流，按钮会显示在场人数和新消息。',
          '用挥手、欢呼、鼓掌、鞠躬（键盘 1–4）互动；右上角切换“2D 图文”可阅读相同资料的列表。',
        ],
        tip: '加入前的消息不会显示，课堂讨论前请先约好开始时间。',
        action: '前往参观展览',
      },
      {
        id: 'guide-ask', title: '3. 向 AI 导览提问', when: '适合想深入了解作品的访客。',
        steps: [
          '点选作品，再点击“询问 Agent 这件作品”，导览面板会以这件作品为焦点打开。',
          '提出具体问题，例如创作者做了什么、两件作品有何异同，或图片中看到什么。',
          '可以继续追问；在你打开或走近另一件作品之前，导览会一直以同一件作品为焦点。',
          '把每个回答与作品和列出的来源比对，记下不准确、没有依据或缺漏之处。',
        ],
        tip: '导览只根据展览中的文字和图片回答；资料没有提到的内容，它应该直接说明，而不是猜测。',
        action: '试用示范展览',
      },
      {
        id: 'guide-layout', title: '4. 用 AI 布展助手调整展厅', when: '适合需要排位协助的创作者。',
        steps: [
          '在编辑器打开“更多 → AI 建展”。',
          '在展览需求中描述想要的改动，例如“把两幅肖像互换位置”或“把版画集中在主墙”，再点击“生成展览”。',
          '阅读预览：它会列出移动、新增或移除了什么，此时你的展览还没有改变。',
          '点击“套用生成展览”保留结果，或点击“放弃结果”放弃；套用后也可以用“撤销”撤回。',
          '如果生成停止且没有任何改动，阅读警告（会写出相关作品名称），把需求写得简单些再生成一次。',
        ],
        tip: '细小而具体的要求效果最好。除非你在“素材与设置”中允许，否则不会移除现有作品。',
        action: '打开我的展览',
      },
      {
        id: 'guide-care', title: '5. 负责任地使用素材和 AI', when: '适合每一位分享前的用户。',
        steps: [
          '只上传你获准分享的图片、视频和文字，并保留来源。',
          '不要放入自己或他人的敏感个人信息。',
          '把 AI 的回答和布展结果当作建议：先核对、再修改，由你决定保留什么。',
          '发布前以访客身份检查每件作品和它的学习脉络。',
        ],
        tip: '你向 AI 提问时，相关文字和图片会发送到 AI 服务以生成回答。',
        action: '阅读隐私政策',
      },
    ],
  },
};

const guideMeta: Record<string, { icon: typeof Bot; href: string }> = {
  'guide-build': { icon: LayoutTemplate, href: '/virtual-gallery/my-exhibitions' },
  'guide-visit': { icon: UsersRound, href: '/exhibitions' },
  'guide-ask': { icon: Bot, href: '/demo' },
  'guide-layout': { icon: Hammer, href: '/virtual-gallery/my-exhibitions' },
  'guide-care': { icon: ShieldCheck, href: '/privacy' },
};

export default function UsageGuide() {
  const { locale } = useI18n();
  const c = copy[locale ?? 'en'];
  return (
    <section aria-labelledby="usage-guide-title" className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-curator-brass">{c.eyebrow}</p>
      <h2 id="usage-guide-title" className="mb-3 text-3xl font-semibold">{c.title}</h2>
      <p className="mb-6 max-w-3xl text-muted-foreground">{c.intro}</p>
      <nav aria-label={c.title} className="mb-8 flex flex-wrap gap-2">
        {c.guides.map((guide) => <a key={guide.id} href={`#${guide.id}`} className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-secondary">{guide.title}</a>)}
      </nav>
      <div className="grid gap-5 lg:grid-cols-2">
        {c.guides.map((guide) => {
          const { icon: Icon, href } = guideMeta[guide.id];
          return (
            <article key={guide.id} id={guide.id} aria-labelledby={`${guide.id}-title`} className="flex scroll-mt-24 flex-col rounded-md border border-border bg-card p-6">
              <Icon aria-hidden="true" className="mb-4 size-7 text-curator-brass" />
              <h3 id={`${guide.id}-title`} className="text-xl font-semibold">{guide.title}</h3>
              <p className="mb-4 mt-1 text-sm text-muted-foreground">{guide.when}</p>
              <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-foreground">
                {guide.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
              <p className="mb-5 rounded-md bg-secondary p-3 text-sm leading-relaxed"><strong>{c.tipLabel}: </strong>{guide.tip}</p>
              <Link to={href} className="mt-auto inline-flex min-h-11 items-center gap-2 font-medium text-primary underline underline-offset-4">
                {guide.action}<ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
