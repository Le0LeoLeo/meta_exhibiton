# Homepage CSS 3D Gallery Design

Date: 2026-06-17

## Goal

Optimize the homepage 3D preview so it feels like a polished, playful mini exhibition space instead of a simple CSS box. The result should improve the main interface's first impression while staying lightweight and responsive.

## Direction

Use the approved "refined CSS 3D gallery" direction:

- Keep the current CSS 3D approach in `Gallery3D.tsx`.
- Do not introduce Three.js or new runtime dependencies for this homepage preview.
- Make the gallery feel more like a real creator product preview: clearer room depth, richer walls and floor, better artwork frames, brighter exhibition lighting, and subtle interactive polish.
- Match the existing playful creator homepage palette: coral, sky blue, emerald, warm yellow, and clean light surfaces.

## Scope

In scope:

- Improve `src/app/components/Gallery3D.tsx`.
- Make small wrapper or sizing adjustments in `src/app/components/Hero.tsx` only if needed for framing.
- Fix any remaining visible mojibake in the 3D preview and hero-local labels.
- Preserve reduced-motion behavior and visibility-aware animation behavior.

Out of scope:

- Replacing the preview with Three.js.
- Changing the full 3D editor under `src/app/modules/metaverse3d`.
- Changing gallery creation, upload, authentication, routes, backend, or database behavior.
- Adding generated bitmap assets or new external images.

## Visual Requirements

The 3D preview should include:

- A stronger room shell with visible back wall, left wall, right wall, floor, and ceiling.
- More refined surface treatment: subtle wall texture, floor grid or plank/tile hint, soft inner shadows, and ambient glow.
- Artwork frames that look like framed works rather than plain colored blocks.
- At least one pedestal or small exhibit object to improve depth.
- Ceiling light strips or spotlights that make the space read as an exhibition room.
- Small visitor/path markers or UI-like spatial accents that fit the creator platform mood.
- Clean readable hint text in Chinese.

Avoid:

- Heavy dark museum mood.
- Beige/tan-dominant palette.
- Overly complex animation.
- Random decorative orbs inside the gallery.
- Text labels inside the 3D room that are too tiny to read.

## Interaction

- Desktop hover should continue to tilt the room based on pointer position.
- Idle animation should remain subtle and should pause while hovering.
- Respect `prefers-reduced-motion`.
- Keep `document.visibilityState` handling so background tabs do not keep animating.
- Mobile should not depend on hover and should render a stable attractive default angle.

## Responsiveness

- Desktop: the room should fill the hero preview card more confidently without clipping.
- Tablet/mobile: the room should scale down without horizontal overflow.
- The preview must remain usable inside the existing hero product frame.

## Implementation Notes

Prefer small internal helpers inside `Gallery3D.tsx`:

- `ArtworkFrame` for repeated framed works.
- `PedestalObject` for simple floor objects.
- `LightStrip` or inline light strip markup for ceiling accents.

Keep the component self-contained. Do not create global CSS unless Tailwind utilities are insufficient.

## Verification

Run:

- `npm run build`
- `npm run test`

Browser verification:

- Open `/` at the local dev server.
- Inspect desktop homepage first viewport.
- Inspect mobile width around 390px.
- Confirm no visible mojibake in the 3D preview.
- Confirm no horizontal overflow.
- Confirm the 3D preview is visible, framed, and animated/interactable on desktop.

