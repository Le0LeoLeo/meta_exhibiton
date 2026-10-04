import { JourneyConsent } from '@/app/features/journey-analytics/JourneyConsent';
import { LegalDocument, type LegalSection } from '../components/LegalDocument';
import { useI18n, type Locale } from '../components/I18nProvider';

type PrivacyCopy = {
  eyebrow: string;
  title: string;
  summary: string;
  updated: string;
  sections: LegalSection[];
  terms: string;
  support: string;
};

const copy: Record<Locale, PrivacyCopy> = {
  'zh-TW': {
    eyebrow: 'Paidea 法律資訊',
    title: '隱私權政策',
    summary: '本政策說明 Paidea 在你使用網站、建立展覽或透過 Google 登入時，如何收集、使用、保存及保護資料。',
    updated: '生效日期：2026 年 9 月 12 日',
    sections: [
      { heading: '展覽參觀統計', paragraphs: ['參觀展覽時，本站使用瀏覽器本機儲存中的隨機識別碼及分頁工作階段識別碼，記錄參觀次數、可見視窗的停留時間和作品觀看時間。這些記錄不附帶姓名或電子郵件，並由本站保存，供展覽作者查看彙總數據。登入中的作者與編輯者不計入。清除瀏覽器儲存會重設識別碼；封鎖儲存時，同一分頁內仍可使用暫時識別碼。'] },
      {
        heading: '我們收集的資料',
        bullets: [
          '帳戶資料：姓名、電子郵件地址、密碼的安全雜湊，以及你選擇的頭像設定。',
          'Google 登入資料：Google 帳戶的唯一識別碼、已驗證的電子郵件地址及顯示名稱。',
          '你建立的內容：展覽、作品資料、上傳圖片、留言、投票及相關設定。',
          '服務運作資料：登入工作階段、安全性紀錄，以及維持多人同步與服務可靠性所需的技術資料。',
        ],
      },
      {
        heading: 'Google 使用者資料',
        paragraphs: [
          '我們只使用 Google 提供的基本身分資料來建立或連結 Paidea 帳戶、辨識登入者並維持登入工作階段。Paidea 不會要求或儲存 Google OAuth 存取權杖或更新權杖，也不會存取 Google Drive、日曆、聯絡人、郵件或其他 Google 服務內容。',
          'Google 使用者資料不會出售、用於廣告，也不會提供給第三方作獨立行銷。只有在提供服務、維護安全、依法回應有效要求，或經你明確同意時才會使用或披露。',
        ],
      },
      {
        heading: '我們如何使用資料',
        bullets: [
          '建立、驗證及管理你的帳戶與登入工作階段。',
          '保存、展示及分享你要求發佈的展覽與內容。',
          '提供多人互動、資料匯出、帳戶刪除、安全防護及故障排除。',
          '改進服務的可靠性與使用體驗。',
        ],
      },
      {
        heading: '保存、安全與分享',
        paragraphs: [
          '帳戶與內容資料會保留至提供服務不再需要、你刪除內容或帳戶，或法律要求的期限為止。我們採用安全連線、受保護的工作階段 Cookie、存取控制及密碼雜湊等合理措施。任何網路服務都無法保證絕對安全。',
          '我們不出售個人資料。為營運網站而使用的基礎設施服務商，只能在提供服務所需範圍內處理資料；我們也可能依法回應具約束力的政府或司法要求。',
        ],
      },
      {
        heading: '你的選擇與權利',
        paragraphs: [
          '你可在帳戶頁面更新資料、匯出帳戶資料或刪除帳戶。刪除帳戶會終止有效工作階段，並安排移除屬於該帳戶的內容與檔案。你也可透過支援中心提出隱私問題。',
          '瀏覽器可讓你封鎖 Cookie，但必要的工作階段 Cookie 被停用後，登入功能可能無法運作。',
        ],
      },
      {
        heading: '政策更新',
        paragraphs: ['我們可能隨服務變更更新本政策，並在本頁標示新的生效日期。重大變更會以合理方式通知。'],
      },
    ],
    terms: '服務條款',
    support: '支援中心',
  },
  'zh-CN': {
    eyebrow: 'Paidea 法律信息',
    title: '隐私政策',
    summary: '本政策说明 Paidea 在你使用网站、创建展览或通过 Google 登录时，如何收集、使用、保存及保护数据。',
    updated: '生效日期：2026 年 9 月 12 日',
    sections: [
      { heading: '展览参观统计', paragraphs: ['参观展览时，本站使用浏览器本地存储中的随机标识符及标签页会话标识符，记录参观次数、可见窗口的停留时间和作品观看时间。这些记录不附带姓名或电子邮件，并由本站保存，供展览作者查看汇总数据。已登录的作者与编辑者不计入。清除浏览器存储会重设标识符；屏蔽存储时，同一标签页内仍可使用临时标识符。'] },
      { heading: '我们收集的数据', bullets: ['账户数据：姓名、电子邮件地址、密码的安全哈希，以及你选择的头像设置。', 'Google 登录数据：Google 账户的唯一标识符、已验证的电子邮件地址及显示名称。', '你创建的内容：展览、作品数据、上传图片、留言、投票及相关设置。', '服务运行数据：登录会话、安全记录，以及维持多人同步与服务可靠性所需的技术数据。'] },
      { heading: 'Google 用户数据', paragraphs: ['我们只使用 Google 提供的基本身份数据来创建或关联 Paidea 账户、识别登录者并维持登录会话。Paidea 不会请求或存储 Google OAuth 访问令牌或刷新令牌，也不会访问 Google Drive、日历、联系人、邮件或其他 Google 服务内容。', 'Google 用户数据不会出售、用于广告，也不会提供给第三方作独立营销。只有在提供服务、维护安全、依法回应有效要求，或经你明确同意时才会使用或披露。'] },
      { heading: '我们如何使用数据', bullets: ['创建、验证及管理你的账户与登录会话。', '保存、展示及分享你要求发布的展览与内容。', '提供多人互动、数据导出、账户删除、安全防护及故障排除。', '改进服务的可靠性与使用体验。'] },
      { heading: '保存、安全与分享', paragraphs: ['账户与内容数据会保留至提供服务不再需要、你删除内容或账户，或法律要求的期限为止。我们采用安全连接、受保护的会话 Cookie、访问控制及密码哈希等合理措施。任何网络服务都无法保证绝对安全。', '我们不出售个人数据。为运营网站而使用的基础设施服务商，只能在提供服务所需范围内处理数据；我们也可能依法回应具约束力的政府或司法要求。'] },
      { heading: '你的选择与权利', paragraphs: ['你可在账户页面更新数据、导出账户数据或删除账户。删除账户会终止有效会话，并安排移除属于该账户的内容与文件。你也可通过支持中心提出隐私问题。', '浏览器可让你屏蔽 Cookie，但必要的会话 Cookie 被禁用后，登录功能可能无法运行。'] },
      { heading: '政策更新', paragraphs: ['我们可能随服务变更更新本政策，并在本页标示新的生效日期。重大变更会以合理方式通知。'] },
    ],
    terms: '服务条款',
    support: '支持中心',
  },
  en: {
    eyebrow: 'Paidea legal',
    title: 'Privacy Policy',
    summary: 'This policy explains how Paidea collects, uses, stores, and protects data when you use the site, create exhibitions, or sign in with Google.',
    updated: 'Effective: September 12, 2026',
    sections: [
      { heading: 'Exhibition visit statistics', paragraphs: ['When you view an exhibition, this site uses a random identifier in browser local storage and a tab session identifier to record visits, time in a visible tab, and artwork viewing time. These records do not include names or email addresses and are stored by this site to provide aggregate figures to the exhibition owner. Signed-in owners and editors are excluded. Clearing browser storage resets the identifier; when storage is blocked, a temporary identifier can still be used within the tab.'] },
      { heading: 'Data we collect', bullets: ['Account data: name, email address, a secure password hash, and avatar settings you choose.', 'Google sign-in data: your unique Google Account identifier, verified email address, and display name.', 'Content you create: exhibitions, artwork details, uploaded images, comments, votes, and related settings.', 'Service data: sessions, security records, and technical data required for multiplayer synchronization and service reliability.'] },
      { heading: 'Google user data', paragraphs: ['We use only the basic identity data Google provides to create or link a Paidea account, identify the person signing in, and maintain a session. Paidea does not request or store Google OAuth access or refresh tokens and does not access Google Drive, Calendar, Contacts, Gmail, or content from other Google services.', 'Google user data is not sold, used for advertising, or provided to third parties for their independent marketing. We use or disclose it only to provide the service, protect security, respond to valid legal requirements, or with your explicit consent.'] },
      { heading: 'How we use data', bullets: ['Create, authenticate, and manage your account and sessions.', 'Store, display, and share exhibitions and content you ask us to publish.', 'Provide multiplayer features, data export, account deletion, security, and troubleshooting.', 'Improve service reliability and user experience.'] },
      { heading: 'Retention, security, and sharing', paragraphs: ['We retain account and content data until it is no longer needed to provide the service, you delete the content or account, or applicable law requires retention. We use reasonable safeguards including encrypted connections, protected session cookies, access controls, and password hashing. No online service can guarantee absolute security.', 'We do not sell personal data. Infrastructure providers used to operate the site may process data only as needed to provide their services, and we may respond to binding governmental or judicial requests.'] },
      { heading: 'Your choices and rights', paragraphs: ['From your account page, you can update details, export account data, or delete your account. Account deletion ends active sessions and schedules removal of content and files owned by the account. You can also raise privacy questions through the support center.', 'You may block cookies in your browser, but sign-in may not work when essential session cookies are disabled.'] },
      { heading: 'Policy updates', paragraphs: ['We may update this policy as the service changes. We will show the new effective date here and provide reasonable notice of material changes.'] },
    ],
    terms: 'Terms of Service',
    support: 'Support center',
  },
};

export default function Privacy() {
  const { locale } = useI18n();
  const content = copy[locale];

  return <><div className="px-4"><JourneyConsent settings /></div><LegalDocument {...content} links={[{ to: '/terms', label: content.terms }, { to: '/support', label: content.support }]} /></>;
}
