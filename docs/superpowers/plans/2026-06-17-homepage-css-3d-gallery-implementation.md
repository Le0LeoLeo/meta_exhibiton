# Homepage CSS 3D Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the homepage CSS 3D gallery preview into a polished, playful mini exhibition space.

**Architecture:** Keep the existing self-contained `Gallery3D.tsx` CSS 3D room and improve its internal visual primitives. Make only small hero-wrapper copy fixes in `Hero.tsx`; do not touch routing, backend, Three.js editor modules, or app state. Preserve the current reduced-motion and visibility-aware animation behavior.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v4 utility classes, CSS 3D transforms, motion/react.

---

## File Structure

- Modify `src/app/components/Gallery3D.tsx`: add helper components for framed artworks, pedestal exhibits, floor accents, and light strips; refine room surfaces and readable hint text.
- Modify `src/app/components/Hero.tsx`: fix hero-local quick stat mojibake and adjust the 3D preview card padding/sizing only if needed after visual inspection.
- Create no new files and add no dependencies.

## Task 1: Clean Copy And Constants

**Files:**
- Modify: `src/app/components/Gallery3D.tsx`
- Modify: `src/app/components/Hero.tsx`

- [ ] **Step 1: Fix `Gallery3D` hint text**

In `src/app/components/Gallery3D.tsx`, replace the current mojibake inside the hint `<motion.p>` with:

```tsx
移動滑鼠預覽展廳角度
```

- [ ] **Step 2: Fix hero quick stats**

In `src/app/components/Hero.tsx`, replace the `quickStats` array with:

```tsx
const quickStats = [
  { icon: ImagePlus, label: '作品素材', value: 'PDF / IMG / Video' },
  { icon: Boxes, label: '3D 展間', value: '拖放佈置' },
  { icon: UsersRound, label: '分享參觀', value: '公開連結' },
];
```

## Task 2: Add Gallery Visual Helpers

**Files:**
- Modify: `src/app/components/Gallery3D.tsx`

- [ ] **Step 1: Add `ArtworkFrame` helper above `Gallery3D`**

Add:

```tsx
type ArtworkFrameProps = {
  className?: string;
  palette: string;
  orientation?: 'portrait' | 'landscape';
};

function ArtworkFrame({ className = '', palette, orientation = 'portrait' }: ArtworkFrameProps) {
  const sizeClass = orientation === 'portrait' ? 'h-16 w-12' : 'h-11 w-16';
  return (
    <div className={`rounded-sm bg-white p-1 shadow-[0_8px_18px_rgba(15,23,42,0.18)] ring-1 ring-stone-200/70 dark:bg-stone-200/90 dark:ring-white/10 ${className}`}>
      <div className={`${sizeClass} rounded-[2px] bg-gradient-to-br ${palette}`}>
        <div className="h-full w-full rounded-[2px] bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.65),transparent_26%),linear-gradient(135deg,rgba(255,255,255,0.18),transparent_52%)]" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `PedestalObject` helper above `Gallery3D`**

Add:

```tsx
type PedestalObjectProps = {
  accent: string;
  className?: string;
};

function PedestalObject({ accent, className = '' }: PedestalObjectProps) {
  return (
    <div className={`absolute ${className}`}>
      <div className="mx-auto h-5 w-9 rounded-sm bg-gradient-to-t from-stone-300 to-white shadow-[0_8px_14px_rgba(15,23,42,0.2)] dark:from-stone-600 dark:to-stone-300" />
      <div className={`mx-auto -mt-5 h-5 w-5 rounded-full bg-gradient-to-br ${accent} shadow-[0_8px_18px_rgba(15,23,42,0.25)] ring-2 ring-white/70 dark:ring-white/20`} />
    </div>
  );
}
```

- [ ] **Step 3: Add `LightStrip` helper above `Gallery3D`**

Add:

```tsx
function LightStrip({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute h-1 rounded-full bg-gradient-to-r from-transparent via-[#facc15]/70 to-transparent shadow-[0_0_18px_rgba(250,204,21,0.45)] dark:via-[#fde68a]/35 ${className}`} />
  );
}
```

## Task 3: Refine Room Surfaces

**Files:**
- Modify: `src/app/components/Gallery3D.tsx`

- [ ] **Step 1: Increase room size slightly**

Change dimensions to:

```ts
const W = 300;
const H = 170;
const D = 230;
```

- [ ] **Step 2: Update scene container sizing**

Change the scene container class to:

```tsx
className="relative h-72 w-full cursor-grab active:cursor-grabbing sm:h-80"
```

- [ ] **Step 3: Add richer wall and floor backgrounds**

Use surface classes that include gradients, soft borders, and subtle CSS background patterns. Keep all styles inside `Gallery3D.tsx` with Tailwind and inline `backgroundImage` where needed.

Back wall should include:

```tsx
backgroundImage:
  'radial-gradient(circle at 18% 18%, rgba(56,189,248,.16), transparent 24%), radial-gradient(circle at 82% 20%, rgba(255,107,107,.14), transparent 24%), linear-gradient(rgba(15,23,42,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,.035) 1px, transparent 1px)'
```

Floor should include:

```tsx
backgroundImage:
  'linear-gradient(rgba(15,23,42,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,.10) 1px, transparent 1px), radial-gradient(circle at 50% 52%, rgba(16,185,129,.18), transparent 38%)'
```

## Task 4: Replace Plain Blocks With Exhibits

**Files:**
- Modify: `src/app/components/Gallery3D.tsx`

- [ ] **Step 1: Replace back wall painting blocks**

Use `ArtworkFrame` components:

```tsx
<ArtworkFrame palette={paintingColors[0]} />
<ArtworkFrame palette={paintingColors[1]} orientation="landscape" className="translate-y-2" />
<ArtworkFrame palette={paintingColors[2]} />
```

- [ ] **Step 2: Replace side wall painting blocks**

Use two framed works per side wall with smaller gaps:

```tsx
<ArtworkFrame palette={paintingColors[3]} orientation="landscape" />
<ArtworkFrame palette={paintingColors[4]} className="-translate-y-1" />
```

and:

```tsx
<ArtworkFrame palette={paintingColors[5]} className="-translate-y-1" />
<ArtworkFrame palette={paintingColors[6]} orientation="landscape" />
```

- [ ] **Step 3: Replace pedestal markup**

Use `PedestalObject` twice:

```tsx
<PedestalObject accent={paintingColors[0]} className="left-[31%] top-[43%] -translate-x-1/2 -translate-y-1/2" />
<PedestalObject accent={paintingColors[1]} className="left-[70%] top-[42%] -translate-x-1/2 -translate-y-1/2" />
```

- [ ] **Step 4: Add path markers**

Add small floor markers:

```tsx
<div className="absolute left-1/2 top-[62%] h-2 w-2 -translate-x-1/2 rounded-full bg-[#38bdf8]/70 shadow-[0_0_12px_rgba(56,189,248,0.45)]" />
<div className="absolute left-[42%] top-[70%] h-1.5 w-1.5 rounded-full bg-[#ff6b6b]/65 shadow-[0_0_10px_rgba(255,107,107,0.42)]" />
<div className="absolute left-[58%] top-[74%] h-1.5 w-1.5 rounded-full bg-[#10b981]/65 shadow-[0_0_10px_rgba(16,185,129,0.42)]" />
```

## Task 5: Improve Lighting And Framing

**Files:**
- Modify: `src/app/components/Gallery3D.tsx`

- [ ] **Step 1: Replace ceiling light strips with helper**

Use:

```tsx
<LightStrip className="inset-x-8 top-1/2 -translate-y-1/2" />
<LightStrip className="inset-x-20 top-[38%] h-0.5 opacity-70" />
```

- [ ] **Step 2: Add ambient edge glows**

Inside the scene container, add subtle absolute glows that are children of the scene and do not affect layout:

```tsx
<div className="absolute left-1/2 top-1/2 h-28 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#38bdf8]/10 blur-xl" />
<div className="absolute left-[48%] top-[62%] h-20 w-28 -translate-x-1/2 rounded-full bg-[#10b981]/10 blur-xl" />
```

## Task 6: Verify

**Files:**
- Verify: `src/app/components/Gallery3D.tsx`
- Verify: `src/app/components/Hero.tsx`

- [ ] **Step 1: Run build**

Run:

```bash
npm run build
```

Expected: Vite build succeeds. Existing large chunk warnings may remain.

- [ ] **Step 2: Run tests**

Run:

```bash
npm run test
```

Expected: Vitest suite passes.

- [ ] **Step 3: Browser verify desktop and mobile**

Start or reuse the local dev server:

```bash
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/` and verify:

- desktop first viewport shows a richer 3D room with framed artworks and lighting
- the hint text is readable Chinese
- 390px mobile width has no horizontal overflow
- no visible mojibake remains in the hero-local 3D preview area

## Self-Review

- Spec coverage: Tasks 1-5 cover copy cleanup, richer room shell, refined surfaces, framed artworks, pedestal objects, lights, interaction preservation, and responsive framing. Task 6 covers build, tests, desktop browser verification, and mobile browser verification.
- Placeholder scan: no TBD/TODO placeholders are present.
- Scope check: the plan does not add Three.js, new dependencies, routes, backend changes, database changes, or editor module changes.

