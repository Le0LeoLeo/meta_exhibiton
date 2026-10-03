import { LegalDocument, type LegalSection } from '../components/LegalDocument';
import { useI18n, type Locale } from '../components/I18nProvider';

type TermsCopy = {
  eyebrow: string;
  title: string;
  summary: string;
  updated: string;
  sections: LegalSection[];
  privacy: string;
  support: string;
};

const copy: Record<Locale, TermsCopy> = {
  'zh-TW': {
    eyebrow: 'Paidea 法律資訊',
    title: '服務條款',
    summary: '使用 Paidea 即表示你同意以下規則。請在建立帳戶、透過 Google 登入或發佈內容前閱讀本條款。',
    updated: '生效日期：2026 年 9 月 4 日',
    sections: [
      { heading: '帳戶與使用資格', paragraphs: ['你提供的帳戶資料應準確且保持更新。你須妥善保管登入方式，並對帳戶內的活動負責。若你未達所在地獨立同意使用線上服務的年齡，應先取得家長或監護人同意。Google 登入只是驗證方式，不代表 Google 贊助或管理 Paidea。'] },
      { heading: '你的內容', paragraphs: ['你保留自己內容的權利。為了代你儲存、處理、展示、分享及備份內容，你授予 Paidea 一項非專屬、全球性且免權利金的必要授權；此授權以營運及改善服務所需為限，並在內容刪除後於合理的技術處理期內終止。', '你應確認自己有權上傳及發佈相關文字、圖片、模型和其他素材，並自行決定公開分享設定。'] },
      { heading: '禁止行為', bullets: ['侵犯他人智慧財產、隱私或其他權利。', '發佈違法、欺詐、惡意、仇恨、騷擾或剝削性內容。', '散布惡意程式、規避安全措施、未經授權存取或干擾服務。', '濫用多人功能、自動化流量或平台資源，影響其他使用者或服務穩定性。'] },
      { heading: '服務變更與帳戶處理', paragraphs: ['我們可能為安全、維護或產品改進而調整、中斷或停止部分功能。若帳戶違反本條款、造成安全風險或依法必須處理，我們可能限制或終止存取。你可隨時在帳戶頁面匯出資料或刪除帳戶。'] },
      { heading: '責任與保證', paragraphs: ['服務依現況提供。在法律允許的範圍內，我們不保證服務永不中斷、完全無錯誤或適合所有特定用途。使用者應保存重要內容的獨立備份。任何依法不能排除或限制的權利與責任均不受本條款影響。'] },
      { heading: '條款更新與聯絡', paragraphs: ['我們可能更新本條款，並在本頁標示新的生效日期。重大變更會以合理方式通知。繼續使用更新後的服務代表接受新條款；若不同意，可停止使用並刪除帳戶。相關問題可透過支援中心提出。'] },
    ],
    privacy: '隱私權政策',
    support: '支援中心',
  },
  'zh-CN': {
    eyebrow: 'Paidea 法律信息',
    title: '服务条款',
    summary: '使用 Paidea 即表示你同意以下规则。请在创建账户、通过 Google 登录或发布内容前阅读本条款。',
    updated: '生效日期：2026 年 9 月 4 日',
    sections: [
      { heading: '账户与使用资格', paragraphs: ['你提供的账户数据应准确且保持更新。你须妥善保管登录方式，并对账户内的活动负责。若你未达到所在地独立同意使用在线服务的年龄，应先取得家长或监护人同意。Google 登录只是验证方式，不代表 Google 赞助或管理 Paidea。'] },
      { heading: '你的内容', paragraphs: ['你保留自己内容的权利。为了代你存储、处理、展示、分享及备份内容，你授予 Paidea 一项非专属、全球性且免许可费的必要许可；此许可仅限于运营及改进服务所需，并在内容删除后的合理技术处理期内终止。', '你应确认自己有权上传及发布相关文字、图片、模型和其他素材，并自行决定公开分享设置。'] },
      { heading: '禁止行为', bullets: ['侵犯他人知识产权、隐私或其他权利。', '发布违法、欺诈、恶意、仇恨、骚扰或剥削性内容。', '散布恶意程序、规避安全措施、未经授权访问或干扰服务。', '滥用多人功能、自动化流量或平台资源，影响其他用户或服务稳定性。'] },
      { heading: '服务变更与账户处理', paragraphs: ['我们可能为安全、维护或产品改进而调整、中断或停止部分功能。若账户违反本条款、造成安全风险或依法必须处理，我们可能限制或终止访问。你可随时在账户页面导出数据或删除账户。'] },
      { heading: '责任与保证', paragraphs: ['服务按现状提供。在法律允许的范围内，我们不保证服务永不中断、完全无错误或适合所有特定用途。用户应保存重要内容的独立备份。任何依法不能排除或限制的权利与责任均不受本条款影响。'] },
      { heading: '条款更新与联系', paragraphs: ['我们可能更新本条款，并在本页标示新的生效日期。重大变更会以合理方式通知。继续使用更新后的服务代表接受新条款；若不同意，可停止使用并删除账户。相关问题可通过支持中心提出。'] },
    ],
    privacy: '隐私政策',
    support: '支持中心',
  },
  en: {
    eyebrow: 'Paidea legal',
    title: 'Terms of Service',
    summary: 'By using Paidea, you agree to these rules. Please read them before creating an account, signing in with Google, or publishing content.',
    updated: 'Effective: September 4, 2026',
    sections: [
      { heading: 'Accounts and eligibility', paragraphs: ['Keep your account details accurate and protect your sign-in methods. You are responsible for activity under your account. If you are not old enough to consent independently to online services where you live, obtain permission from a parent or guardian. Google sign-in is an authentication method and does not mean Google sponsors or operates Paidea.'] },
      { heading: 'Your content', paragraphs: ['You retain rights in your content. To store, process, display, share, and back it up for you, you grant Paidea a non-exclusive, worldwide, royalty-free license limited to what is necessary to operate and improve the service. This license ends after deletion, subject to a reasonable technical processing period.', 'Make sure you have the rights needed to upload and publish any text, images, models, or other materials, and choose public-sharing settings carefully.'] },
      { heading: 'Prohibited conduct', bullets: ['Infringing intellectual property, privacy, or other rights.', 'Publishing illegal, fraudulent, malicious, hateful, harassing, or exploitative material.', 'Distributing malware, bypassing security, gaining unauthorized access, or disrupting the service.', 'Abusing multiplayer features, automated traffic, or platform resources in ways that affect other users or service stability.'] },
      { heading: 'Service changes and accounts', paragraphs: ['We may change, interrupt, or discontinue features for security, maintenance, or product improvement. We may restrict or end access when an account violates these terms, creates a security risk, or when required by law. You may export your data or delete your account from the account page.'] },
      { heading: 'Warranty and liability', paragraphs: ['The service is provided as available. To the extent permitted by law, we do not promise uninterrupted or error-free operation or fitness for every particular purpose. Keep independent backups of important content. Nothing in these terms excludes rights or liabilities that cannot legally be excluded or limited.'] },
      { heading: 'Updates and contact', paragraphs: ['We may update these terms and will show the new effective date here. We will provide reasonable notice of material changes. Continued use after an update means you accept the revised terms; if you disagree, you may stop using the service and delete your account. Contact the support center with questions.'] },
    ],
    privacy: 'Privacy Policy',
    support: 'Support center',
  },
};

export default function Terms() {
  const { locale } = useI18n();
  const content = copy[locale];

  return <LegalDocument {...content} links={[{ to: '/privacy', label: content.privacy }, { to: '/support', label: content.support }]} />;
}
