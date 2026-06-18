# Balanced Curator Global UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the app to the approved Balanced Curator global UI direction while preserving existing routes, auth, API calls, and 3D scene behavior.

**Architecture:** Implement the redesign from the outside in: first define global design tokens and shared component variants, then update the app shell, then apply the system to public pages, account/workflow pages, and selected 3D editor UI panels. Use the attached HTML mockup as visual reference for palette, spacing, header style, catalog cards, tool panels, and status badges; do not copy its CDN scripts, inline view-switching script, or standalone HTML structure into the React app.

**Tech Stack:** React 18, Vite, Tailwind CSS v4, shadcn-style components, lucide-react, motion/react, Vitest, Testing Library.

---

## Reference Mapping

Use these values from the attached mockup:

- Gallery white: `#FAF9F6`
- Soft stone: `#F4F3EE`
- Panel white: `#FFFFFF`
- Warm border: `#E5E2D9`
- Charcoal ink: `#1C1C1A`
- Muted warm gray: `#797670`
- Muted brass: `#BCA374`
- Operational blue: `#3E6496`
- Quiet success: `#4C8262`
- Quiet warning: `#D29D54`
- Quiet destructive: `#A84C4C`

Do not import the mockup's Google Fonts in this pass. Keep the app's existing font stack, as required by the spec.

## File Structure

Modify:

- `src/styles/theme.css`: global color tokens, radius, body background, dark-mode equivalents.
- `src/app/components/ui/button.tsx`: button variants and radius defaults.
- `src/app/components/ui/card.tsx`: card radius, border, and surface defaults.
- `src/app/components/ui/input.tsx`: input surface, border, and focus styling.
- `src/app/components/ui/dialog.tsx`: dialog radius and warm-surface polish.
- `src/app/components/Navigation.tsx`: sticky gallery/product header.
- `src/app/components/Footer.tsx`: quiet museum-style footer.
- `src/app/components/Layout.tsx`: remove hard-coded pure white shell in favor of tokenized background.
- `src/app/components/Hero.tsx`: homepage editorial hero.
- `src/app/components/Features.tsx`: restrained feature panels.
- `src/app/components/Showcase.tsx`: curated use-case showcase.
- `src/app/components/InfoBanner.tsx`: final homepage CTA alignment.
- `src/app/pages/VirtualGallery.tsx`: public gallery landing treatment.
- `src/app/pages/Exhibitions.tsx`: exhibition catalog treatment and empty states.
- `src/app/pages/Login.tsx`, `src/app/pages/Register.tsx`, `src/app/pages/Profile.tsx`, `src/app/pages/MyExhibitions.tsx`, `src/app/pages/Support.tsx`, `src/app/pages/Resources.tsx`: creator-tool page treatment.
- `src/app/modules/metaverse3d/components/UI/EditorTopBar.tsx`, `src/app/modules/metaverse3d/components/UI/EditorLeftToolbar.tsx`, `src/app/modules/metaverse3d/components/UI/EditorInspectorPanel.tsx`, `src/app/modules/metaverse3d/components/UI/ViewUI.tsx`, `src/app/modules/metaverse3d/components/UI/EditUI.tsx`, `src/app/modules/metaverse3d/components/UI/FloorPlanUI.tsx`: selected 3D studio shell and panel styling.

No new runtime dependencies are needed.

## Tasks

### Task 1: Establish Global Tokens

**Files:**
- Modify: `src/styles/theme.css`

- [ ] **Step 1: Snapshot current token usage**

Run:

```bash
rg "violet|sky|rose|amber|emerald|teal|glass|backdrop-blur|rounded-3xl|gradient-to" src/app src/styles
```

Expected: a list of current visual classes to replace gradually. Save the important recurring patterns in implementation notes inside the task branch, not in source code.

- [ ] **Step 2: Replace root tokens with Balanced Curator palette**

In `src/styles/theme.css`, update the `:root` block to use this shape:

```css
:root {
  --font-size: 16px;
  --background: #faf9f6;
  --foreground: #1c1c1a;
  --card: #ffffff;
  --card-foreground: #1c1c1a;
  --popover: #ffffff;
  --popover-foreground: #1c1c1a;
  --primary: #1c1c1a;
  --primary-foreground: #ffffff;
  --secondary: #f4f3ee;
  --secondary-foreground: #1c1c1a;
  --muted: #f4f3ee;
  --muted-foreground: #797670;
  --accent: #ede8dc;
  --accent-foreground: #1c1c1a;
  --destructive: #a84c4c;
  --destructive-foreground: #ffffff;
  --border: #e5e2d9;
  --input: #e5e2d9;
  --input-background: #ffffff;
  --switch-background: #d8d2c5;
  --font-weight-medium: 500;
  --font-weight-normal: 400;
  --ring: #bca374;
  --chart-1: #bca374;
  --chart-2: #3e6496;
  --chart-3: #4c8262;
  --chart-4: #d29d54;
  --chart-5: #a84c4c;
  --radius: 0.5rem;
  --sidebar: #ffffff;
  --sidebar-foreground: #1c1c1a;
  --sidebar-primary: #1c1c1a;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #f4f3ee;
  --sidebar-accent-foreground: #1c1c1a;
  --sidebar-border: #e5e2d9;
  --sidebar-ring: #bca374;
  --curator-brass: #bca374;
  --tool-blue: #3e6496;
  --success-quiet: #4c8262;
  --warning-quiet: #d29d54;
}
```

- [ ] **Step 3: Add theme mappings for new custom tokens**

Inside `@theme inline`, add:

```css
  --color-curator-brass: var(--curator-brass);
  --color-tool-blue: var(--tool-blue);
  --color-success-quiet: var(--success-quiet);
  --color-warning-quiet: var(--warning-quiet);
```

- [ ] **Step 4: Replace body background**

Replace the current radial-gradient body background with:

```css
  body {
    @apply bg-background text-foreground;
    background-image:
      linear-gradient(to bottom, rgba(250, 249, 246, 0.98), rgba(244, 243, 238, 0.98));
    background-attachment: fixed;
    transition: background-color 0.3s ease, color 0.3s ease;
  }
```

Use a restrained dark-mode background:

```css
  .dark body {
    background-image:
      linear-gradient(to bottom, rgba(22, 22, 20, 0.98), rgba(13, 13, 12, 0.99));
  }
```

- [ ] **Step 5: Run CSS/build verification**

Run:

```bash
npm run build
```

Expected: build completes with no Tailwind token errors.

- [ ] **Step 6: Commit**

```bash
git add src/styles/theme.css
git commit -m "style: add balanced curator design tokens"
```

### Task 2: Update Shared UI Component Defaults

**Files:**
- Modify: `src/app/components/ui/button.tsx`
- Modify: `src/app/components/ui/card.tsx`
- Modify: `src/app/components/ui/input.tsx`
- Modify: `src/app/components/ui/dialog.tsx`

- [ ] **Step 1: Inspect current variants**

Run:

```bash
Get-Content -Raw src/app/components/ui/button.tsx
Get-Content -Raw src/app/components/ui/card.tsx
Get-Content -Raw src/app/components/ui/input.tsx
Get-Content -Raw src/app/components/ui/dialog.tsx
```

Expected: identify existing class-variance-authority variants and avoid breaking prop APIs.

- [ ] **Step 2: Update button variants without changing component API**

In `button.tsx`, keep existing variant names and replace their classes with this intent:

```tsx
default: 'bg-primary text-primary-foreground shadow-sm hover:bg-curator-brass hover:text-white',
destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
outline: 'border border-border bg-card text-foreground shadow-sm hover:bg-secondary hover:text-foreground',
secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-accent',
ghost: 'text-foreground hover:bg-secondary hover:text-foreground',
link: 'text-tool-blue underline-offset-4 hover:underline',
```

Keep size variants stable, but ensure default radius is `rounded-md`, not `rounded-full` or `rounded-3xl`.

- [ ] **Step 3: Update card defaults**

In `card.tsx`, make the root card style:

```tsx
'bg-card text-card-foreground flex flex-col gap-6 rounded-md border border-border py-6 shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)]'
```

Keep the exported component names and props unchanged.

- [ ] **Step 4: Update input defaults**

In `input.tsx`, ensure the input includes:

```tsx
'border-input bg-input-background text-foreground placeholder:text-muted-foreground focus-visible:border-curator-brass focus-visible:ring-curator-brass/30 rounded-md'
```

Keep disabled and file-input styling intact.

- [ ] **Step 5: Update dialog surface**

In `dialog.tsx`, make `DialogContent` use:

```tsx
'bg-card text-card-foreground border border-border rounded-md shadow-[0_24px_70px_-36px_rgba(28,28,26,0.5)]'
```

Keep Radix behavior, accessibility, close button, and animations unchanged.

- [ ] **Step 6: Run focused component tests**

Run:

```bash
npm run test -- src/app/components
```

Expected: existing component tests pass, or Vitest reports no matching component tests without TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/components/ui/button.tsx src/app/components/ui/card.tsx src/app/components/ui/input.tsx src/app/components/ui/dialog.tsx
git commit -m "style: align shared UI components with curator system"
```

### Task 3: Redesign Global Shell

**Files:**
- Modify: `src/app/components/Layout.tsx`
- Modify: `src/app/components/Navigation.tsx`
- Modify: `src/app/components/Footer.tsx`

- [ ] **Step 1: Update layout background**

In `Layout.tsx`, change the wrapper class from hard-coded white/stone values to tokenized classes:

```tsx
className="flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground transition-colors duration-300"
```

Keep fullscreen route logic and page transitions unchanged.

- [ ] **Step 2: Convert navigation shell**

In `Navigation.tsx`, use the attached mockup as reference and set the `nav` shell to:

```tsx
className="sticky top-0 z-50 border-b border-border bg-card/90 shadow-[0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-md dark:bg-card/90"
```

Replace violet/sky active states with:

```tsx
isActive
  ? 'text-foreground'
  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
```

Use an active underline:

```tsx
className="absolute inset-x-3 -bottom-0.5 h-px rounded-full bg-curator-brass"
```

- [ ] **Step 3: Convert account/register controls**

Replace gradient register/user avatar classes with charcoal and brass styling:

```tsx
className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground shadow-sm transition-all hover:bg-curator-brass"
```

For avatar initials, use:

```tsx
className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
```

- [ ] **Step 4: Convert mobile menu**

Use `rounded-md`, `bg-card`, `bg-secondary`, `border-border`, and brass active state. Keep the same open/close behavior and route links.

- [ ] **Step 5: Convert footer**

In `Footer.tsx`, set the root footer to:

```tsx
className="border-t border-border bg-secondary text-muted-foreground"
```

Use charcoal headings and muted links:

```tsx
className="text-sm font-medium uppercase tracking-wide text-foreground"
className="text-sm text-muted-foreground transition-colors hover:text-foreground"
```

- [ ] **Step 6: Verify navigation behavior**

Run:

```bash
npm run test -- src/app
npm run build
```

Expected: tests and build pass. Manually verify login/logout links and mobile menu still work.

- [ ] **Step 7: Commit**

```bash
git add src/app/components/Layout.tsx src/app/components/Navigation.tsx src/app/components/Footer.tsx
git commit -m "style: redesign global shell for curator UI"
```

### Task 4: Redesign Homepage Components

**Files:**
- Modify: `src/app/components/Hero.tsx`
- Modify: `src/app/components/Features.tsx`
- Modify: `src/app/components/Showcase.tsx`
- Modify: `src/app/components/InfoBanner.tsx`
- Modify: `src/app/pages/Home.tsx`

- [ ] **Step 1: Remove playful decorative color language**

Run:

```bash
rg "ff6b6b|10b981|facc15|38bdf8|rose|emerald|amber|rounded-full|blur-3xl" src/app/components/Hero.tsx src/app/components/Features.tsx src/app/components/Showcase.tsx src/app/components/InfoBanner.tsx
```

Expected: identify homepage classes to replace with warm gallery surfaces.

- [ ] **Step 2: Update `Home.tsx` page wrapper**

Use:

```tsx
<div className="bg-background text-foreground transition-colors duration-300">
```

- [ ] **Step 3: Rework hero layout**

In `Hero.tsx`, keep `Gallery3D`, existing routes, and translated text. Replace the section shell with:

```tsx
<section className="relative overflow-hidden bg-background">
  <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 px-4 pb-14 pt-12 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:pb-16 lg:pt-14">
```

Use primary CTA:

```tsx
className="h-12 w-full rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-curator-brass sm:w-auto"
```

Use secondary CTA:

```tsx
className="h-12 w-full rounded-md border-border bg-card px-6 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-secondary sm:w-auto"
```

- [ ] **Step 4: Rework hero preview frame**

Replace playful window dots and colorful labels with the mockup-inspired frame:

```tsx
className="rounded-md border border-border bg-secondary p-3 shadow-[0_28px_90px_-56px_rgba(28,28,26,0.65)]"
```

Use inner canvas wrapper:

```tsx
className="overflow-hidden rounded-md border border-border bg-[linear-gradient(135deg,#faf9f6_0%,#f4f3ee_100%)] px-3 pb-4 pt-5"
```

- [ ] **Step 5: Rework feature cards**

In `Features.tsx`, use consistent cards:

```tsx
className="group relative min-h-44 overflow-hidden rounded-md border border-border bg-card p-5 shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition-colors hover:border-curator-brass/70"
```

Use icon container:

```tsx
className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-secondary text-foreground"
```

- [ ] **Step 6: Rework showcase cards**

In `Showcase.tsx`, replace gradient tones with neutral panels and brass/blue accents:

```tsx
className="relative overflow-hidden rounded-md border border-border bg-card p-6 shadow-[0_24px_70px_-48px_rgba(28,28,26,0.55)] sm:p-8"
```

Use brass for curatorial highlights and tool blue only for operational links.

- [ ] **Step 7: Run homepage verification**

Run:

```bash
npm run build
```

Then run the dev server and inspect `/` at desktop and mobile widths.

Expected: no overlapping hero text, no playful color blocks, next section hint visible, CTAs readable.

- [ ] **Step 8: Commit**

```bash
git add src/app/pages/Home.tsx src/app/components/Hero.tsx src/app/components/Features.tsx src/app/components/Showcase.tsx src/app/components/InfoBanner.tsx
git commit -m "style: redesign homepage as balanced curator experience"
```

### Task 5: Redesign Public Gallery Pages

**Files:**
- Modify: `src/app/pages/VirtualGallery.tsx`
- Modify: `src/app/pages/Exhibitions.tsx`

- [ ] **Step 1: Replace decorative geometry**

Remove or stop rendering `GradientOrb`, `FloatingCube`, `FloatingRing`, `FloatingDot`, and excessive `GridPattern` usage in these two pages. If a subtle grid remains, keep it low-contrast and local to the hero preview area.

- [ ] **Step 2: Update public hero sections**

Use this section shell in both pages:

```tsx
<div className="relative overflow-hidden border-b border-border bg-background">
  <div className="relative mx-auto max-w-4xl px-6 pb-14 pt-20 text-center">
```

Use badge style:

```tsx
className="mb-6 inline-flex items-center rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
```

Use title style:

```tsx
className="mb-5 text-4xl font-semibold leading-tight text-foreground sm:text-5xl"
```

- [ ] **Step 3: Update exhibition/catalog cards**

Use this recurring card style for feature, step, and exhibition cards:

```tsx
className="rounded-md border border-border bg-card p-5 text-left shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition hover:-translate-y-0.5 hover:border-curator-brass/70"
```

Use status badges:

```tsx
className="rounded border border-curator-brass/60 bg-card px-2 py-1 text-xs font-semibold uppercase tracking-wide text-curator-brass"
```

- [ ] **Step 4: Update empty and loading states**

Replace rounded-3xl/glass containers with:

```tsx
className="rounded-md border border-border bg-card p-8 text-center text-muted-foreground shadow-sm"
```

Keep API loading/error behavior unchanged.

- [ ] **Step 5: Fix visible malformed dialog text if present**

In `Exhibitions.tsx`, inspect the `DialogDescription` around the enter-exhibition dialog. If it contains malformed characters around `visitingExhibition?.title`, replace only the display expression with:

```tsx
<DialogDescription>
  {t('prepareEnter')} {visitingExhibition?.title ?? ''}
</DialogDescription>
```

Do not change dialog navigation behavior.

- [ ] **Step 6: Run tests/build**

```bash
npm run test -- src/app/pages/ExhibitionView.test.tsx src/app/pages/VirtualGalleryCreate.test.tsx
npm run build
```

Expected: tests pass and pages compile.

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/VirtualGallery.tsx src/app/pages/Exhibitions.tsx
git commit -m "style: redesign public gallery pages"
```

### Task 6: Redesign Account And Information Pages

**Files:**
- Modify: `src/app/pages/Login.tsx`
- Modify: `src/app/pages/Register.tsx`
- Modify: `src/app/pages/Profile.tsx`
- Modify: `src/app/pages/MyExhibitions.tsx`
- Modify: `src/app/pages/Support.tsx`
- Modify: `src/app/pages/Resources.tsx`

- [ ] **Step 1: Find mixed styles in workflow pages**

Run:

```bash
rg "violet|sky|rose|amber|emerald|teal|rounded-3xl|gradient-to|backdrop-blur|bg-white/|dark:bg-stone" src/app/pages/Login.tsx src/app/pages/Register.tsx src/app/pages/Profile.tsx src/app/pages/MyExhibitions.tsx src/app/pages/Support.tsx src/app/pages/Resources.tsx
```

Expected: list of page-specific classes to convert.

- [ ] **Step 2: Use a consistent page shell**

For top-level workflow pages, use:

```tsx
<div className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-6 lg:px-8">
  <div className="mx-auto max-w-5xl">
```

For centered auth forms, use:

```tsx
<div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center px-4 py-12">
```

- [ ] **Step 3: Use consistent panels**

Replace large glass cards with:

```tsx
className="rounded-md border border-border bg-card p-6 shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)]"
```

- [ ] **Step 4: Use consistent page headers**

Use:

```tsx
<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-curator-brass">...</p>
<h1 className="text-3xl font-semibold text-foreground">...</h1>
<p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">...</p>
```

- [ ] **Step 5: Preserve form and API logic**

Do not change calls to auth APIs, profile loading, exhibition loading, toast behavior, or redirects. Only update className values and small layout wrappers.

- [ ] **Step 6: Run auth and page tests**

```bash
npm run test -- src/app/auth.test.tsx src/app/api/gallery.test.ts
npm run build
```

Expected: tests and build pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/Login.tsx src/app/pages/Register.tsx src/app/pages/Profile.tsx src/app/pages/MyExhibitions.tsx src/app/pages/Support.tsx src/app/pages/Resources.tsx
git commit -m "style: apply curator tool system to account pages"
```

### Task 7: Redesign Selected 3D Studio UI Panels

**Files:**
- Modify: `src/app/modules/metaverse3d/components/UI/EditorTopBar.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/EditorLeftToolbar.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/EditorInspectorPanel.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/ViewUI.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/EditUI.tsx`
- Modify: `src/app/modules/metaverse3d/components/UI/FloorPlanUI.tsx`

- [ ] **Step 1: Inspect editor UI classes**

Run:

```bash
rg "bg-|border-|rounded-|shadow-|violet|sky|backdrop-blur|glass|gradient" src/app/modules/metaverse3d/components/UI
```

Expected: locate editor top bar, toolbar, inspector, and view overlay styling.

- [ ] **Step 2: Define editor shell classes locally**

In each edited UI component, use these class patterns directly rather than adding a new abstraction:

```tsx
const panelClass = 'rounded-md border border-border bg-card/95 text-foreground shadow-[0_18px_45px_-38px_rgba(28,28,26,0.55)] backdrop-blur-sm';
const toolButtonClass = 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition hover:border-curator-brass hover:text-foreground';
const activeToolButtonClass = 'border-curator-brass bg-secondary text-foreground';
```

If a file already has constants for shared classes, update those constants instead of duplicating.

- [ ] **Step 3: Update editor top bar**

Use charcoal/brass/blue states:

- Primary create/publish/play actions: `bg-primary text-primary-foreground hover:bg-curator-brass`.
- Tool mode selected states: `border-curator-brass bg-secondary text-foreground`.
- Operational performance/network status: `text-tool-blue` or `border-tool-blue/50`.

- [ ] **Step 4: Update inspector panels**

Use:

```tsx
className="rounded-md border border-border bg-card/95 p-4 text-foreground shadow-[0_18px_45px_-38px_rgba(28,28,26,0.55)] backdrop-blur-sm"
```

Inputs inside inspectors should rely on the shared input component when already used. Native inputs should use `border-border`, `bg-input-background`, `focus:border-curator-brass`.

- [ ] **Step 5: Keep canvas behavior untouched**

Do not edit `StudioCanvas.tsx`, physics, player controls, networking, scene store, item placement logic, or floor-plan geometry unless a className in the UI wrapper requires a small change.

- [ ] **Step 6: Run metaverse focused tests**

```bash
npm run test -- src/app/modules/metaverse3d
npm run build
```

Expected: tests pass and TypeScript build passes.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/metaverse3d/components/UI/EditorTopBar.tsx src/app/modules/metaverse3d/components/UI/EditorLeftToolbar.tsx src/app/modules/metaverse3d/components/UI/EditorInspectorPanel.tsx src/app/modules/metaverse3d/components/UI/ViewUI.tsx src/app/modules/metaverse3d/components/UI/EditUI.tsx src/app/modules/metaverse3d/components/UI/FloorPlanUI.tsx
git commit -m "style: align studio panels with curator tool UI"
```

### Task 8: Final Visual QA And Cleanup

**Files:**
- Modify only files with missed visual inconsistencies discovered during QA.

- [ ] **Step 1: Start dev server**

Run:

```bash
npm run dev
```

Expected: Vite prints a local URL.

- [ ] **Step 2: Verify target routes in browser**

Open and inspect:

```text
/
/virtual-gallery
/exhibitions
/login
/register
/profile
/resources
/support
/virtual-gallery/my-exhibitions
/virtual-gallery/create
```

Expected:

- No overlapping text.
- Buttons fit their labels in Traditional Chinese, Simplified Chinese, and English.
- Cards use 6-8px radius.
- No dominant violet/sky gradient page.
- No decorative gradient orbs.
- Navigation and footer feel consistent.
- Studio shell remains usable and canvas remains visible.

- [ ] **Step 3: Run full verification**

```bash
npm run test
npm run build
```

Expected: both commands pass.

- [ ] **Step 4: Inspect remaining global style drift**

Run:

```bash
rg "from-violet|to-sky|rounded-3xl|blur-3xl|backdrop-blur-\\[16px\\]|shadow-violet|bg-violet|text-violet" src/app
```

Expected: remaining matches are either inside unmodified deep 3D internals, third-party-style components, or intentionally retained localized states. Convert any public-page or shared-shell matches.

- [ ] **Step 5: Commit final cleanup**

```bash
git add src/styles src/app
git commit -m "style: finish balanced curator UI cleanup"
```

## Self-Review

Spec coverage:

- Global tokens: Task 1.
- Shared components: Task 2.
- Navigation, layout, footer: Task 3.
- Homepage: Task 4.
- Public gallery pages: Task 5.
- Account and information pages: Task 6.
- Selected 3D studio/editor panels: Task 7.
- Testing and browser verification: Task 8.

Reference mockup coverage:

- Palette tokens are mapped in Task 1.
- Header and footer system are mapped in Task 3.
- Editorial landing treatment is mapped in Task 4.
- Exhibition catalog treatment is mapped in Task 5.
- Creator SaaS panels and statuses are mapped in Tasks 6 and 7.

Scope check:

The plan stays UI-only and does not modify backend routes, database code, auth semantics, 3D scene logic, or routing semantics.
