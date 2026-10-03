# Viewing mode UI — 2026-09-10

## Change
AgentModeSelector now uses the shared card, border, primary, muted text and focus tokens. Small corners, the project CJK serif heading, outlined mode icons, checkmarks and the shared Button replace the former cyan/navy styling. AI personality options use the same selected state. Existing participation actions are preserved. The dialog follows the global light/dark theme and retains a scrollable body with a fixed confirmation footer.

## Validation
- Six existing AgentModeSelector and DemoParticipation tests passed.
- Typecheck and scoped ESLint passed; 41 release/bundle helper tests passed.
- Fresh HK build `.tmp/hk-mode-ui-final-build-20260910/dist` and its bundle budget check passed.
- Browser checked actual `/demo/participate`: light/dark desktop appearance, AI personality selection, and 390 × 844 mobile scrolling with the confirm action visible. Temporary viewport and theme changes restored.

## Deployment pending
No production mutation or upload was performed. The shared workspace contains simultaneous, unfinished template changes from the active task “完善所有展覽模版”, including Room, GalleryScenePreview, template assets and display logic. The generated release includes those changes and must not be deployed as an isolated UI update. The save-exhibition task is also active. Preserve all concurrent work.

The UI change is validated and ready to include in the next coordinated, validated frontend release. Rebuild from the final accepted shared source, check the actual output, and recheck the current production image before deployment. Do not deploy the intermediate `.tmp/hk-mode-ui-release-20260910` archive: it contains an in-progress snapshot of the template work.

Last read-only production check: web `sha256:f249660959a25a7134bc7c508323f80896733497637e77f610f6daea62f23824` (the slogans release). No Git commit or push.
