# Homepage Creator UI Design

Date: 2026-06-16

## Goal

Optimize the homepage at `/` into a playful, creator-focused entry point for MetaRealm Expo Intelligence. The page should feel useful and energetic for students, artists, teachers, and curators who want to build online 3D exhibitions quickly.

## Direction

Use the approved "playful creator" direction:

- Bright, optimistic product UI rather than a dark corporate landing page.
- White or very light background with coral, teal, sky blue, lime, and warm yellow accents.
- A strong first viewport that clearly says the product creates 3D exhibitions.
- A large product signal in the hero: a stylized 3D gallery or editor preview.
- Three clear audience paths: creators, classrooms, and curators.

Avoid one-note purple gradients, beige/tan dominance, generic stock imagery, heavy glassmorphism, decorative bokeh/orbs, and unreadable tiny text.

## Homepage Structure

1. Navigation remains shared across the site, with only homepage-safe visual adjustments if needed.
2. Hero section:
   - Left side: product name, direct headline, short supporting copy, primary CTA, secondary CTA.
   - Right side: a large, lively gallery/editor preview built with code-native UI and the existing 3D gallery component style.
   - Include a subtle hint of the next section below the first viewport.
3. Feature section:
   - Replace generic feature-grid feeling with practical creator workflow cards.
   - Emphasize upload, arrange, personalize, preview, share, and visit.
4. Showcase section:
   - Reframe as audience routes for creators, classrooms, and curators.
   - Use varied card layouts rather than repetitive identical tiles.
5. CTA banner:
   - Keep one clear final action.
   - Make it brighter and less corporate than the current dark banner.

## Content

Fix homepage-visible localization strings so the homepage renders readable Traditional Chinese and Simplified Chinese. This includes navigation labels used above the homepage, hero copy, feature cards, showcase cards, and CTA copy.

The implementation may use concise Chinese copy rather than literal translations of the prior corrupted strings. The English concept text is not required in the final UI.

## Components

Expected files:

- `src/app/components/Hero.tsx`
- `src/app/components/Features.tsx`
- `src/app/components/Showcase.tsx`
- `src/app/components/InfoBanner.tsx`
- `src/app/components/Gallery3D.tsx` only if small text or styling fixes are needed
- `src/app/components/I18nProvider.tsx` for homepage-visible copy

No new routing, backend behavior, authentication changes, or gallery editor behavior are in scope.

## Interaction And Accessibility

- CTAs must remain real links.
- Existing reduced-motion handling should be preserved.
- Decorative motion should not be required to understand the page.
- Buttons and cards need visible focus states through existing Tailwind/shadcn conventions.
- Text must not overlap or overflow on mobile.

## Responsive Behavior

- Desktop: two-column hero with copy and product preview.
- Tablet: hero can stack while keeping the product preview visible early.
- Mobile: single-column layout, CTA buttons full-width or comfortably tappable, cards stack with stable spacing.

## Verification

Run the app locally and inspect:

- Desktop homepage first viewport and scroll.
- Mobile-width homepage.
- Light and dark mode if practical.
- Homepage copy is readable and no visible mojibake remains in the optimized sections.
- Build or test command available in the repo, at minimum `npm run build`.

