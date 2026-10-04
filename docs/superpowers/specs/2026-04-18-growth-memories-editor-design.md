# Growth Memories Editor Design

## Goal
Turn the current `GrowthMemories` flow into a real editor experience for content curation and publication. The editor should support draft-based editing, structured sections, asset organization, sharing, and live 3D preview.

## Problem Statement
The current implementation is closer to a CRUD form than an editor. It lets a user create a child profile, create an exhibit, add assets, add comments, and preview a 3D space, but the data model and interaction model are still flat:

- there is no explicit draft vs published state
- assets are not organized into editorial sections
- there is no editor state machine for selection, dirty state, or history
- preview, editing, and sharing are loosely coupled instead of being different views of the same content model

## Product Direction
The product should behave like a curated studio for a child growth exhibition:

- **Content editing** for child/exhibit metadata
- **Curation** through sections and asset ordering
- **Preview** through a synced 3D gallery view
- **Publishing** through snapshots and share links

This is not a layout-heavy page builder yet. The primary interaction model is editorial curation, with the data model designed so layout editing can be added later.

## Core Entities

### Project
Represents a family or collection of related growth exhibitions.

Fields:
- `id`
- `ownerId`
- `title`
- `description`
- `themeId`
- `createdAt`
- `updatedAt`

Purpose:
- supports multiple children or multiple growth journeys under one account
- provides a root container for future expansion

### Exhibit
Represents one editable exhibition draft and its published output.

Fields:
- `id`
- `projectId`
- `childId`
- `title`
- `introStory`
- `status`: `draft | published | archived`
- `visibility`: `private | unlisted | public`
- `templateId`
- `coverAssetId`
- `publishedAt`
- `createdAt`
- `updatedAt`

Purpose:
- the main editor object
- all changes happen on a draft exhibit
- publishing produces a stable snapshot for sharing

### Section
Represents a curated chapter inside an exhibit.

Fields:
- `id`
- `exhibitId`
- `type`: `hero | timeline | gallery | text | quote | audio | video | milestone`
- `title`
- `description`
- `order`
- `layout`
- `settings`
- `createdAt`
- `updatedAt`

Purpose:
- gives the exhibit narrative structure
- supports grouping and sequencing assets
- creates room for later layout customization

### Asset
Represents one media or text item in the exhibit.

Fields:
- `id`
- `exhibitId`
- `sectionId?`
- `type`: `photo | video | audio | text | file`
- `title`
- `contentUrl`
- `fileName`
- `mimeType`
- `note`
- `capturedAt`
- `order`
- `meta`
- `createdAt`
- `updatedAt`

Purpose:
- stores the content that appears in the editor, share page, and 3D preview
- can exist in an ungrouped pool or inside a section

### Comment
Represents a reaction or message from family and friends.

Fields:
- `id`
- `exhibitId`
- `assetId?`
- `userName`
- `content`
- `status`: `visible | hidden | pending`
- `createdAt`

Purpose:
- supports exhibit-level and asset-level comments
- lets moderation be introduced later without changing the main model

### ShareLink
Represents a time-bound or permission-controlled public entry point.

Fields:
- `id`
- `exhibitId`
- `token`
- `role`: `viewer | commenter`
- `expiresAt`
- `revokedAt`

Purpose:
- decouples public access from the editor
- supports revoked or expiring links

## Editor State Model
The editor should use a centralized state store instead of many local component states.

### EditorState
Fields:
- `activeProjectId`
- `activeExhibitId`
- `activeSectionId`
- `selectedNodeId`
- `dirty`
- `saving`
- `previewMode`
- `panelMode`
- `history`

Purpose:
- tracks what the user is editing
- records unsaved changes
- makes undo/redo possible
- keeps preview and editor panels synchronized

## Interaction Model
The editor should behave as a three-column workspace.

### Left Panel
- project / exhibit navigation
- section tree
- ungrouped asset pool
- comments entry point
- publish/share entry point

### Center Panel
- primary editing surface
- exhibit metadata form
- section editing form
- asset sorting and assignment
- curation actions such as move, duplicate, delete

### Right Panel
- live 3D preview
- selected item properties
- publish status and share controls
- future layout controls

## Primary Workflows

### 1. Create or choose a project
A user opens a project as the top-level container for a family story.

### 2. Create a draft exhibit
The editor creates an exhibit in `draft` status.
All edits happen on this draft object.

### 3. Add sections
The user adds narrative sections such as birth, first steps, birthdays, school moments, or highlights.

### 4. Add and organize assets
Assets can be uploaded, linked, or moved into sections.
The user can reorder assets within a section and move them between sections.

### 5. Review in 3D
The 3D preview reflects the current draft state.
It should be synchronized with section and asset changes.

### 6. Publish and share
Publishing creates a stable snapshot.
Share links point to the published version, not the draft.

## API Shape
The backend should expose editor-oriented endpoints instead of only CRUD endpoints.

Recommended route groups:
- `/projects`
- `/exhibits`
- `/sections`
- `/assets`
- `/comments`
- `/shares`
- `/publish`
- `/history`

Useful endpoints:
- `GET /exhibits/:id/editor` — load the full editable snapshot
- `PATCH /exhibits/:id` — update exhibit metadata
- `POST /exhibits/:id/publish` — publish the current draft
- `POST /sections/:id/assets/reorder` — reorder assets inside a section
- `POST /assets/:id/move` — move an asset into another section
- `GET /exhibits/:id/history` — fetch version history

## Frontend Structure
The page structure should evolve into a studio shell.

### Main route
`/growth-memories`
- loads the editor shell
- fetches the active draft snapshot
- coordinates panels and preview

### Preview route
`/growth-memories/3d/:exhibitId`
- remains a focused immersive preview view
- should read the published or draft exhibit depending on the access context

### Share route
`/growth-memories/share/:token`
- remains read-only for viewers
- allows comments if the token grants that permission

## Implementation Phasing

### Phase 1
- introduce editor-oriented state and data shapes
- split the current page into workspace panels
- keep the existing API behavior where possible

### Phase 2
- add sections and asset grouping
- support asset ordering and section assignment
- update the 3D preview to consume sectioned content

### Phase 3
- add draft/publish/snapshot flow
- make share links read from published state
- add undo/redo and change history

## Non-Goals
The following are intentionally out of scope for the first iteration:

- full Figma-style freeform canvas editing
- arbitrary drag-resize layout blocks
- collaborative real-time multi-user editing
- advanced moderation workflows
- analytics dashboards

## Success Criteria
The redesign is successful if:

- the editor has a clear draft-based object model
- assets can be grouped into sections and reordered
- preview reflects the same content model as the editor
- published shares are stable and separate from draft editing
- the UI feels like a studio instead of a form page

## Open Questions
- Should a project support multiple children from day one, or should it remain single-child for the first release?
- Should sections be mandatory for every exhibit, or optional until the user adds them?
- Should publishing create a full immutable snapshot immediately, or should it store a lightweight revision record first?
