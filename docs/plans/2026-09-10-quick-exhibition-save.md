# Quick exhibition save action — 2026-09-10

Added a translated Save exhibition button before Publish exhibition in the image exhibition preview footer. A successful ready preview is already persisted by the existing build/apply API. Save returns to My exhibitions without publishing or duplicating the draft. The action is disabled during operations or errors and is unavailable for unconfirmed candidates and published exhibitions.

Validation: 81 focused page/controller/upload/deployment tests passed, including save navigation without publication. TypeScript and scoped ESLint passed. Fresh Hong Kong build and actual-output bundle budgets passed.

Not deployed. Comparison against the current production slogans release found concurrent unrelated 3D, template, CSS and static asset changes in the fresh build. The release was stopped before upload or production mutation. Working changes are preserved; the generated `.tmp/hk-quicksave-release-20260910` and archive must not be deployed as an isolated save-button release. The current production web was verified as `sha256:f249660959a25a7134bc7c508323f80896733497637e77f610f6daea62f23824`; app as `sha256:542698bfbded216582915d4f789f025b328abb5b6b754e5d4e577552eb7ead7f`. Both were running.

Deployment remains pending a validated combined release or a reproducible frontend source baseline that excludes the concurrent changes. No Git commit/push or production data changes were made.
