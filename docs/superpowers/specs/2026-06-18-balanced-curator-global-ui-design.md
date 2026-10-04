# Balanced Curator Global UI Design

## Goal

Replace the mixed global visual language with a consistent "balanced curator tool" design: premium enough for online exhibitions, clear enough for gallery creation and admin workflows.

The redesign should make the product feel like a refined digital exhibition platform rather than a playful landing page or a neon metaverse demo. Public pages should feel curated and spacious. Tool pages should feel calm, structured, and efficient.

## Current Context

The app is a Vite and React product with Tailwind CSS v4, shadcn-style UI components, lucide icons, motion animations, and 3D gallery modules. Global styling is concentrated in `src/styles/theme.css`, with app framing in `Layout`, `Navigation`, and `Footer`.

The current UI mixes several visual systems:

- Homepage sections use playful coral, green, yellow, and sky accents.
- Virtual gallery and exhibition pages use violet/sky gradients, glass cards, and floating decorative geometry.
- Studio/editor pages are more tool-like and immersive.

This creates brand drift between public marketing, exhibition browsing, account pages, and 3D tooling.

## Chosen Direction

Use the "Balanced Curator Tool" direction.

The public-facing experience should borrow from premium museums and galleries: warm whites, soft stone surfaces, charcoal text, restrained metallic accents, editorial spacing, and art-forward composition.

The product and workflow experience should borrow from creator SaaS tools: clear panels, predictable controls, legible forms, direct status indicators, and restrained motion.

3D gallery surfaces can keep a small amount of immersive atmosphere, but the surrounding UI should still use the curator-tool system.

## Visual System

### Palette

Primary neutrals:

- Background: warm gallery white.
- Surface: off-white and pale stone.
- Elevated panels: clean white with subtle warm borders.
- Foreground: charcoal rather than pure black.
- Muted text: warm gray.

Accent colors:

- Primary action: charcoal or deep ink.
- Curatorial accent: muted brass/gold.
- Product accent: restrained blue for tool actions, links, and selected operational states.
- Success, warning, and destructive states should be quieter than the current saturated palette.

Avoid dominant violet/sky gradients, playful coral/green/yellow blocks, and heavy glassmorphism as global styling.

### Shape And Depth

- Use restrained radius values, generally 6-8px for cards, buttons, inputs, and panels.
- Use crisp borders and soft shadows instead of frosted glass panels.
- Reserve large rounded shapes for artwork previews or deliberate hero media, not generic UI cards.
- Avoid decorative gradient orbs as page backgrounds.

### Typography

- Keep the existing font stack for this redesign; do not introduce a separate font migration.
- Use editorial hierarchy on public pages: strong H1, calm supporting copy, measured line lengths.
- Use compact hierarchy inside panels and admin views: smaller headings, clear labels, dense but readable spacing.
- Avoid negative letter spacing and viewport-scaled font sizes.

### Motion

- Keep route transitions and small hover motion, but reduce decorative floating motion.
- Use motion to communicate navigation, selection, and preview changes.
- Respect reduced-motion and coarse-pointer behavior already present in the layout.

## Page Treatment

### Global Shell

Navigation should feel like a gallery/product header:

- White or warm-white sticky bar.
- Thin warm border.
- Text-first brand lockup.
- Minimal active state using brass or ink underline.
- Primary account/register action in charcoal or brass, not a violet/sky gradient.

Footer should become a quiet museum-style footer:

- Warm surface.
- Clear link columns.
- Less glass and fewer dark gradients.

### Homepage

The homepage should become the strongest expression of the new brand.

Hero:

- Lead with the platform name and exhibition creation value.
- Use a real-looking gallery/studio preview as the dominant visual signal.
- Use warm gallery surfaces and charcoal/brass actions.
- Keep a hint of the next content section visible on normal viewports.

Feature and showcase sections:

- Replace playful color chips with restrained icon panels.
- Use varied but muted accents.
- Make use cases feel like curated exhibition scenarios.

### Public Gallery Pages

`VirtualGallery` and `Exhibitions` should use the public museum side of the system:

- Editorial hero sections with warm neutral backgrounds.
- Exhibition cards that resemble catalog entries or artwork wall labels.
- Clear primary CTAs for creating, browsing, and entering exhibitions.
- Minimal decorative geometry.

### Account And Information Pages

Login, register, profile, support, resources, and user exhibition pages should use the creator-tool side:

- Clean panels.
- Stable form layouts.
- Clear empty states.
- Consistent button hierarchy.
- Muted borders and strong readability.

### Admin And Creation Workflows

Competition/admin/upload/create flows should be more operational:

- Dense but organized layouts.
- Clear status badges.
- Section headers with direct actions.
- Less decorative content and stronger information scanning.

### 3D Studio And Editor

The studio can remain more immersive inside the canvas, but the interface around it should be curator-tool UI:

- Cleaner editor top bar and side panels.
- Charcoal, stone, and blue/brass accents.
- Consistent icon buttons and tool states.
- Avoid turning editor panels into heavy glass cards.

## Component Rules

- Buttons: primary charcoal or restrained blue depending on context; secondary white/stone outline; destructive muted red.
- Cards: 6-8px radius, warm border, subtle shadow only when elevated.
- Inputs: white surface, warm border, clear focus ring.
- Badges: muted fills with readable text; brass for curated/published states, blue for active tool states.
- Dialogs: white or warm surface, modest radius, clear action footer.
- Icons: lucide icons for controls and actions; avoid text-only tool controls when an icon is familiar.

## Implementation Scope

The implementation should be UI-only unless a component requires tiny markup changes for accessibility or layout. It should not change API behavior, auth behavior, 3D scene logic, database logic, or routing semantics.

Expected edited areas:

- `src/styles/theme.css`
- `src/app/components/Layout.tsx`
- `src/app/components/Navigation.tsx`
- `src/app/components/Footer.tsx`
- Shared shadcn-style components where global variants need adjustment.
- Core public pages and homepage components.
- Account, resources, support, and exhibition management pages.
- Selected metaverse UI panel components.

## Testing And Verification

Run the existing checks after implementation:

- `npm run test`
- `npm run build`

Also verify visually in browser:

- Desktop homepage.
- Mobile navigation.
- Virtual gallery landing page.
- Exhibitions list and empty states.
- Login/register forms.
- My exhibitions or profile page.
- 3D studio/editor UI shell.

Visual verification should check text fit, contrast, page rhythm, button hierarchy, dark mode if retained, and absence of incoherent overlaps.

## Out Of Scope

- Rewriting backend routes or data models.
- Replacing the 3D engine or gallery scene logic.
- Adding new product features.
- Creating a new landing-only marketing site.
- Changing localization content except where text length exposes layout issues.

## Success Criteria

- The site no longer looks like a mix of playful SaaS, glassmorphism, and neon metaverse themes.
- Public pages feel premium and exhibition-oriented.
- Tool and account pages feel clear, fast, and professional.
- CTAs and navigation are visually consistent across the app.
- Existing functionality and tests continue to work.
