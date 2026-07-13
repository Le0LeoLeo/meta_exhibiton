# Homepage Creator UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `/` homepage into a readable, playful, creator-focused landing experience.

**Architecture:** Keep the existing React/Vite page composition (`Home` renders `Hero`, `Features`, `Showcase`, `InfoBanner`) and redesign those component internals in place. Keep routing, authentication, server code, and gallery editor behavior unchanged. Replace homepage-visible corrupted i18n strings with concise Traditional and Simplified Chinese copy so the redesigned UI renders professionally.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS v4, lucide-react, motion/react, existing shadcn-style button primitives.

---

## File Structure

- Modify `src/app/components/I18nProvider.tsx`: replace homepage-visible nav, hero, feature, showcase, CTA, and basic auth/footer strings with readable Traditional and Simplified Chinese copy.
- Modify `src/app/components/Hero.tsx`: create the playful two-column hero, creator stats strip, CTA treatment, and code-native product preview.
- Modify `src/app/components/Features.tsx`: redesign feature cards around the creator workflow: upload, arrange, personalize, preview, share, visit.
- Modify `src/app/components/Showcase.tsx`: redesign audience routes for creators, classrooms, and curators with varied card layouts.
- Modify `src/app/components/InfoBanner.tsx`: replace the dark corporate CTA with a bright final action band.
- Optionally modify `src/app/components/Gallery3D.tsx`: fix the visible hover hint text only if it remains visible in the hero.

## Task 1: Homepage Copy

**Files:**
- Modify: `src/app/components/I18nProvider.tsx`

- [ ] **Step 1: Identify homepage-visible keys**

Use this exact key set when editing the dictionaries:

```ts
const homepageKeys = [
  'appName',
  'appShort',
  'learnMore',
  'heroTitle1',
  'heroTitle2',
  'heroDescription',
  'featureSectionLabel',
  'featureSectionTitle',
  'featureSectionDesc',
  'featureSceneTitle',
  'featureSceneDesc',
  'featureMoveTitle',
  'featureMoveDesc',
  'featureLightTitle',
  'featureLightDesc',
  'featurePreviewTitle',
  'featurePreviewDesc',
  'featureInteractTitle',
  'featureInteractDesc',
  'featureDeviceTitle',
  'featureDeviceDesc',
  'showcaseSectionLabel',
  'showcaseSectionTitle',
  'browseGallery',
  'showcaseUseCase1Title',
  'showcaseUseCase1Desc',
  'showcaseUseCase2Title',
  'showcaseUseCase2Desc',
  'showcaseUseCase3Title',
  'showcaseUseCase3Desc',
  'ctaTitle',
  'ctaDesc',
  'freeStart',
  'navHome',
  'navVirtualGallery',
  'navExhibitions',
  'navCompetitions',
  'navSupport',
  'navResources',
  'login',
  'register',
  'logout',
  'profile',
  'openMenu',
  'closeMenu',
  'themeLight',
  'themeDark',
  'localeTraditional',
  'localeSimplified',
  'switchLocale',
  'loggedOut',
];
```

- [ ] **Step 2: Replace Traditional Chinese values**

Set the `zh-TW` values for the keys above to:

```ts
{
  appName: 'MetaRealm Expo Intelligence',
  appShort: 'MREI 元境智展',
  learnMore: '探索展廳',
  heroTitle1: '幾分鐘內建立',
  heroTitle2: '你的 3D 展覽',
  heroDescription: '上傳作品、安排展牆、調整光線，快速把課堂成果、藝術創作或策展提案變成可分享的線上 3D 展廳。',
  featureSectionLabel: '創作流程',
  featureSectionTitle: '從作品到展廳，一路保持直覺',
  featureSectionDesc: '把繁瑣的展覽製作拆成清楚步驟，讓創作者專注在作品與故事。',
  featureSceneTitle: '上傳作品',
  featureSceneDesc: '加入圖片、影片、文件與作品資訊，快速整理成可展示的素材庫。',
  featureMoveTitle: '安排空間',
  featureMoveDesc: '拖放作品、調整位置與比例，像佈置真實展場一樣建立觀看節奏。',
  featureLightTitle: '設計氛圍',
  featureLightDesc: '套用牆面、材質、燈光與主題，讓每個展間都有自己的性格。',
  featurePreviewTitle: '即時預覽',
  featurePreviewDesc: '隨時切換觀看模式，檢查觀眾進入展廳後看到的每個細節。',
  featureInteractTitle: '分享參觀',
  featureInteractDesc: '發布公開展覽或分享連結，邀請同學、觀眾與評審直接進入展場。',
  featureDeviceTitle: '跨裝置瀏覽',
  featureDeviceDesc: '桌機、平板與手機都能開啟展覽，讓作品更容易被看見。',
  showcaseSectionLabel: '適合誰使用',
  showcaseSectionTitle: '為創作者、課堂與策展團隊打造',
  browseGallery: '瀏覽展廳',
  showcaseUseCase1Title: '創作者作品集',
  showcaseUseCase1Desc: '把作品整理成有路線、有光線、有節奏的 3D 展覽，比單純相簿更有記憶點。',
  showcaseUseCase2Title: '課堂成果展',
  showcaseUseCase2Desc: '老師可以收集學生作品、安排主題展間，讓期末成果在線上完整呈現。',
  showcaseUseCase3Title: '策展提案展示',
  showcaseUseCase3Desc: '用可互動的空間草圖展示策展概念，讓團隊更快討論動線與作品關係。',
  ctaTitle: '準備好把作品放進 3D 展場了嗎？',
  ctaDesc: '從一個空白展間開始，幾分鐘內完成第一版線上展覽。',
  freeStart: '開始創建',
  navHome: '首頁',
  navVirtualGallery: '虛擬展廳',
  navExhibitions: '展覽列表',
  navCompetitions: '競賽',
  navSupport: '支援',
  navResources: '資源',
  login: '登入',
  register: '註冊',
  logout: '登出',
  profile: '個人資料',
  openMenu: '開啟選單',
  closeMenu: '關閉選單',
  themeLight: '切換淺色模式',
  themeDark: '切換深色模式',
  localeTraditional: '繁中',
  localeSimplified: '简中',
  switchLocale: '切換語言',
  loggedOut: '已登出',
}
```

- [ ] **Step 3: Replace Simplified Chinese values**

Set the `zh-CN` values for the same keys to Simplified Chinese equivalents:

```ts
{
  appName: 'MetaRealm Expo Intelligence',
  appShort: 'MREI 元境智展',
  learnMore: '探索展厅',
  heroTitle1: '几分钟内建立',
  heroTitle2: '你的 3D 展览',
  heroDescription: '上传作品、安排展墙、调整灯光，快速把课堂成果、艺术创作或策展提案变成可分享的线上 3D 展厅。',
  featureSectionLabel: '创作流程',
  featureSectionTitle: '从作品到展厅，一路保持直觉',
  featureSectionDesc: '把繁琐的展览制作拆成清楚步骤，让创作者专注在作品与故事。',
  featureSceneTitle: '上传作品',
  featureSceneDesc: '加入图片、视频、文档与作品信息，快速整理成可展示的素材库。',
  featureMoveTitle: '安排空间',
  featureMoveDesc: '拖放作品、调整位置与比例，像布置真实展场一样建立观看节奏。',
  featureLightTitle: '设计氛围',
  featureLightDesc: '套用墙面、材质、灯光与主题，让每个展间都有自己的性格。',
  featurePreviewTitle: '实时预览',
  featurePreviewDesc: '随时切换观看模式，检查观众进入展厅后看到的每个细节。',
  featureInteractTitle: '分享参观',
  featureInteractDesc: '发布公开展览或分享链接，邀请同学、观众与评审直接进入展场。',
  featureDeviceTitle: '跨设备浏览',
  featureDeviceDesc: '桌机、平板与手机都能打开展览，让作品更容易被看见。',
  showcaseSectionLabel: '适合谁使用',
  showcaseSectionTitle: '为创作者、课堂与策展团队打造',
  browseGallery: '浏览展厅',
  showcaseUseCase1Title: '创作者作品集',
  showcaseUseCase1Desc: '把作品整理成有路线、有灯光、有节奏的 3D 展览，比单纯相册更有记忆点。',
  showcaseUseCase2Title: '课堂成果展',
  showcaseUseCase2Desc: '老师可以收集学生作品、安排主题展间，让期末成果在线上完整呈现。',
  showcaseUseCase3Title: '策展提案展示',
  showcaseUseCase3Desc: '用可互动的空间草图展示策展概念，让团队更快讨论动线与作品关系。',
  ctaTitle: '准备好把作品放进 3D 展场了吗？',
  ctaDesc: '从一个空白展间开始，几分钟内完成第一版线上展览。',
  freeStart: '开始创建',
  navHome: '首页',
  navVirtualGallery: '虚拟展厅',
  navExhibitions: '展览列表',
  navCompetitions: '竞赛',
  navSupport: '支持',
  navResources: '资源',
  login: '登录',
  register: '注册',
  logout: '退出',
  profile: '个人资料',
  openMenu: '开启菜单',
  closeMenu: '关闭菜单',
  themeLight: '切换浅色模式',
  themeDark: '切换深色模式',
  localeTraditional: '繁中',
  localeSimplified: '简中',
  switchLocale: '切换语言',
  loggedOut: '已退出登录',
}
```

- [ ] **Step 4: Run type/build check for syntax**

Run:

```bash
npm run build
```

Expected: build may reveal unrelated repo issues, but `I18nProvider.tsx` should have no TypeScript syntax errors.

## Task 2: Hero Redesign

**Files:**
- Modify: `src/app/components/Hero.tsx`

- [ ] **Step 1: Replace imports**

Use these imports:

```tsx
import { Button } from './ui/button';
import { Link } from 'react-router';
import { ArrowRight, Boxes, ImagePlus, Sparkles, UsersRound } from 'lucide-react';
import { motion } from 'motion/react';
import { FloatingDot, GridPattern } from './Geo3D';
import { Gallery3D } from './Gallery3D';
import { useI18n } from './I18nProvider';
```

- [ ] **Step 2: Add hero support arrays inside `Hero`**

Add these constants after `const { t } = useI18n();`:

```tsx
const quickStats = [
  { icon: ImagePlus, label: '作品素材', value: 'PDF / IMG / Video' },
  { icon: Boxes, label: '3D 展間', value: '拖放佈置' },
  { icon: UsersRound, label: '分享參觀', value: '公開連結' },
];
```

- [ ] **Step 3: Replace the returned JSX**

Implement a two-column hero with these structural requirements:

```tsx
return (
  <section className="relative overflow-hidden bg-[linear-gradient(180deg,#fffdfa_0%,#f8fcff_58%,#ffffff_100%)] dark:bg-[linear-gradient(180deg,#0c0c10_0%,#10151b_58%,#0c0c10_100%)]">
    <GridPattern />
    <div className="absolute left-8 top-24 h-24 w-24 rounded-full bg-coral-200/40 blur-3xl" />
    <div className="absolute right-10 top-32 h-32 w-32 rounded-full bg-teal-200/35 blur-3xl" />
    <FloatingDot className="right-[18%] top-32" delay={0} color="bg-[#ff6b6b]/55 dark:bg-[#ff8a8a]/35" />
    <FloatingDot className="left-[8%] top-60" delay={1.2} color="bg-[#22c55e]/45 dark:bg-[#4ade80]/30" />

    <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 px-4 pb-14 pt-12 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:pb-18 lg:pt-16">
      <div className="max-w-2xl text-left">
        // badge, h1, paragraph, CTA row, quickStats grid
      </div>
      <div className="relative">
        // colorful product preview frame containing Gallery3D and small native UI rows
      </div>
    </div>
  </section>
);
```

Use Tailwind arbitrary colors `[#ff6b6b]`, `[#10b981]`, `[#38bdf8]`, and `[#facc15]` for the playful palette. Keep cards at `rounded-lg` or less where possible.

- [ ] **Step 4: Preserve links**

Primary CTA link must remain:

```tsx
<Link to="/virtual-gallery/my-exhibitions">...</Link>
```

Secondary CTA link must remain:

```tsx
<Link to="/virtual-gallery">...</Link>
```

## Task 3: Workflow Feature Cards

**Files:**
- Modify: `src/app/components/Features.tsx`

- [ ] **Step 1: Replace feature data shape**

Use six workflow cards with lucide icons already imported or newly imported:

```tsx
const features = [
  { icon: ImagePlus, title: t('featureSceneTitle'), desc: t('featureSceneDesc'), accent: 'bg-[#e0f2fe] text-sky-700 dark:bg-sky-400/12 dark:text-sky-200' },
  { icon: Move3D, title: t('featureMoveTitle'), desc: t('featureMoveDesc'), accent: 'bg-[#dcfce7] text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-200' },
  { icon: WandSparkles, title: t('featureLightTitle'), desc: t('featureLightDesc'), accent: 'bg-[#fef3c7] text-amber-700 dark:bg-amber-400/12 dark:text-amber-200' },
  { icon: Eye, title: t('featurePreviewTitle'), desc: t('featurePreviewDesc'), accent: 'bg-[#ede9fe] text-violet-700 dark:bg-violet-400/12 dark:text-violet-200' },
  { icon: Share2, title: t('featureInteractTitle'), desc: t('featureInteractDesc'), accent: 'bg-[#ffe4e6] text-rose-700 dark:bg-rose-400/12 dark:text-rose-200' },
  { icon: Smartphone, title: t('featureDeviceTitle'), desc: t('featureDeviceDesc'), accent: 'bg-[#ccfbf1] text-teal-700 dark:bg-teal-400/12 dark:text-teal-200' },
];
```

- [ ] **Step 2: Replace section layout**

Use a white/light section with:

- top label `t('featureSectionLabel')`
- heading `t('featureSectionTitle')`
- paragraph `t('featureSectionDesc')`
- six cards in `grid gap-3 sm:grid-cols-2 lg:grid-cols-3`

Each card should be a compact workflow tile with a small step number, icon, title, and description. Use `rounded-lg`, `border`, and restrained shadows.

## Task 4: Audience Showcase

**Files:**
- Modify: `src/app/components/Showcase.tsx`

- [ ] **Step 1: Keep three use cases**

Use the existing translated keys and icons:

```tsx
const useCases = [
  { icon: Palette, title: t('showcaseUseCase1Title'), desc: t('showcaseUseCase1Desc'), tone: 'from-rose-50 to-orange-50 dark:from-rose-950/30 dark:to-orange-950/20' },
  { icon: GraduationCap, title: t('showcaseUseCase2Title'), desc: t('showcaseUseCase2Desc'), tone: 'from-sky-50 to-cyan-50 dark:from-sky-950/30 dark:to-cyan-950/20' },
  { icon: Building2, title: t('showcaseUseCase3Title'), desc: t('showcaseUseCase3Desc'), tone: 'from-lime-50 to-emerald-50 dark:from-lime-950/20 dark:to-emerald-950/20' },
];
```

- [ ] **Step 2: Make layout varied**

Implement a section where the first use-case card spans two columns on desktop and the other two stack in the adjacent column:

```tsx
<div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
  <motion.article className="rounded-lg ...">first card</motion.article>
  <div className="grid gap-4">second and third cards</div>
</div>
```

Keep the existing `browseGallery` link to `/virtual-gallery`.

## Task 5: Bright CTA Band

**Files:**
- Modify: `src/app/components/InfoBanner.tsx`

- [ ] **Step 1: Replace dark banner**

Use a bright section with a coral primary button and a secondary gallery link:

```tsx
<div className="relative overflow-hidden bg-white py-16 dark:bg-stone-950 sm:py-20">
  <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
    <div className="relative overflow-hidden rounded-lg border border-rose-100 bg-[linear-gradient(135deg,#fff7ed_0%,#ecfeff_52%,#f0fdf4_100%)] p-6 shadow-[0_24px_70px_-44px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(127,29,29,0.28),rgba(8,47,73,0.24),rgba(20,83,45,0.18))] sm:p-8 lg:p-10">
      // title, desc, CTA buttons
    </div>
  </div>
</div>
```

Primary link remains `/register`. Secondary link goes to `/virtual-gallery`.

## Task 6: Visual QA And Build

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run build**

Run:

```bash
npm run build
```

Expected: Vite build succeeds, or failures are documented if caused by unrelated pre-existing changes.

- [ ] **Step 2: Start dev server**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: local Vite URL prints, usually `http://127.0.0.1:5173/`.

- [ ] **Step 3: Inspect homepage**

Open `/` in the browser and check:

- hero has readable Chinese copy
- first viewport has a clear 3D exhibition product signal
- CTA links are visible and tappable
- next section is visible after scroll
- no homepage-visible mojibake remains in the optimized sections
- mobile width does not overflow

- [ ] **Step 4: Commit implementation**

Only stage files changed for this homepage task:

```bash
git add src/app/components/I18nProvider.tsx src/app/components/Hero.tsx src/app/components/Features.tsx src/app/components/Showcase.tsx src/app/components/InfoBanner.tsx src/app/components/Gallery3D.tsx docs/superpowers/plans/2026-06-16-homepage-creator-ui-implementation.md
git commit -m "feat: refresh homepage creator UI"
```

If `Gallery3D.tsx` was not changed, omit it from `git add`.

## Self-Review

- Spec coverage: Task 1 covers readable homepage copy; Task 2 covers first viewport and product signal; Task 3 covers workflow cards; Task 4 covers creator/classroom/curator routes; Task 5 covers bright CTA; Task 6 covers build and visual verification.
- Placeholder scan: no TBD/TODO placeholders are present.
- Scope check: no backend, routing, auth, or 3D editor behavior changes are included.

