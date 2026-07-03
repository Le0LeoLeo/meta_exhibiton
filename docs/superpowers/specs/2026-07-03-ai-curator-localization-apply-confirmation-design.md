# AI Curator Localization and Apply Confirmation Design

## Goal

Improve the editor AI Curator panel with two low-risk usability changes:

- Replace temporary English panel copy with Traditional Chinese copy suitable for Macau/Chinese users.
- Add a confirmation step before applying a generated curator plan to the scene.

## Scope

This change stays inside the existing AI Curator editor panel. It does not change the backend route, AI service, plan schema, scene mapper, or editor store API.

## User Experience

After generating a plan, the panel continues to show the plan preview. The primary action changes from a direct apply action to a confirmation flow:

1. The user clicks "套用到展廳".
2. The panel shows a compact confirmation summary with the generated section count, exhibit count, and a note that the current scene will be replaced by the generated draft.
3. The user can confirm with "確認套用" or return with "返回預覽".

The confirmation is intentionally inline rather than a modal so it fits the existing compact popover pattern.

## Component Behavior

`AiCuratorPanel` keeps local state for:

- form fields
- loading/error state
- generated preview
- whether the confirmation summary is visible

Generating a new preview clears any pending confirmation. Discarding a preview also exits confirmation mode. Applying still calls `mapCuratorPlanToScene(preview, currentScene)` and then `importScene`.

## Error Handling

The existing error alert remains. Login and AI request failures use Traditional Chinese text. Error messages returned by thrown `Error` objects are still shown verbatim so diagnostics are preserved.

## Testing

Update the panel tests to cover:

- Traditional Chinese labels/buttons can generate a preview.
- The scene is not imported when the first apply button is clicked.
- Import happens only after the confirmation button is clicked.
- Request errors render in the alert and do not import a scene.
