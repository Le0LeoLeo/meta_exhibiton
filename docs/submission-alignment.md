# Submission Alignment Checklist

> Generated: 2026-06-17
> Project: MREI 元境智展 — Metaverse Exhibition Platform

## Verified Claims → Code Evidence

### 1. AI Agent with Three Personalities
| Claim | Evidence |
|-------|----------|
| Three modes: 小白/專家/搞笑 | `server/services/agentService.js` — `buildSystemPrompt()` lines 17-27 |
| 小白 mode uses simple language | `config.ts` — `xiaobai.description: "入門友善，用簡單直白的方式介紹作品"` |
| 專家 mode uses analytical depth | `config.ts` — `expert.description: "深入作品脈絡、媒材分析與策展觀點"` |
| 搞笑 mode uses humor | `config.ts` — `humor.description: "用輕鬆幽默的方式導覽"` |
| Mode selection UI | `AgentModeSelector.tsx` — 3 personality cards |
| Agent reply routing | `POST /api/agent/reply` in `agentRoutes.js` |

### 2. AI Writing Tools
| Claim | Evidence |
|-------|----------|
| Feedback summary | `POST /api/ai/feedback-summary` in `aiWritingRoutes.js` |
| Intro polishing | `POST /api/ai/polish-intro` in `aiWritingRoutes.js` |
| Multi-language output | `POST /api/ai/translate` in `aiWritingRoutes.js` |
| UI: Feedback summary button | `ViewUI.tsx` line 393 — "AI 整理意見" button |
| UI: Polish/Translate buttons | `ExhibitionUploadPlatform.tsx` — near description field |
| UI: Polish/Translate in inspector | `PaintingInspector.tsx` — polish/EN/PT buttons |
| UI: Polish/Translate for text | `TextInspector.tsx` — polish/EN/简中/PT buttons |

### 3. Smart Recommendations
| Claim | Evidence |
|-------|----------|
| Recommends based on visit state | `agentService.js` — `buildRecommendation()` scores unvisited +3, unengaged +2 |
| Same-type preference | `agentService.js` — same type bonus +2 |
| Dwell time consideration | `agentService.js` — `Math.min(dwell[id] / 8, 2)` |
| Avoids repeated recommendations | `agentService.js` — `lastRecommendedExhibitId` penalty -4 |
| Chinese recommendation reasons | `agentService.js` — reasons in Traditional Chinese |
| UI: Recommendation display | `AgentChatPanel.tsx` — amber "下一站推薦" panel |

### 4. Visitor Memory Persistence
| Claim | Evidence |
|-------|----------|
| SQLite `visitor_memories` table | `server/db.js` — CREATE TABLE with visited/engaged/dwell/personality/language |
| GET endpoint | `GET /api/visitor-memory/:galleryId` in `visitorMemoryRoutes.js` |
| PUT endpoint | `PUT /api/visitor-memory/:galleryId` in `visitorMemoryRoutes.js` |
| Load on gallery enter | `ViewUI.tsx` useEffect — calls `loadVisitorMemory()` |
| Periodic save | `ViewUI.tsx` useEffect — debounced `saveVisitorMemory()` on state change |
| Frontend API client | `src/app/api/visitorMemory.ts` |

### 5. Student Exhibition Positioning
| Claim | Evidence |
|-------|----------|
| Hero description: "專為學生打造的線上作品展示與推廣平台" | `I18nProvider.tsx` — `heroDescription` key |
| Showcase section: "專為學生與創作者" | `I18nProvider.tsx` — `showcaseSectionLabel` key |
| Showcase: "學生作品集" use case | `I18nProvider.tsx` — `showcaseUseCase1Title/Desc` keys |
| Exhibitions page: student framing | `I18nProvider.tsx` — `exhibitionsSubtitle` key |

### 6. 3D Exhibition System
| Claim | Evidence |
|-------|----------|
| 3D scene with React Three Fiber | `ViewCanvas.tsx`, `CanvasScene.tsx` |
| Floor plan editor | `FloorPlanUI.tsx`, `FloorPlanTopBar.tsx` |
| Multiplayer via Socket.IO | `server/multiplayer/` — rooms, protocol, Socket.IO server |
| Object placement/painting/text | `PaintingInspector.tsx`, `TextInspector.tsx` |
| Upload platform | `ExhibitionUploadPlatform.tsx` |

### 7. Human-Care & Accessibility
| Claim | Evidence |
|-------|----------|
| Clear mode descriptions | `config.ts` — 3 modes with explicit benefit language |
| Language preference control | `AgentChatPanel.tsx` — EN/中文 toggle button |
| Keyboard focus states | `AgentModeSelector.tsx`, `AgentChatPanel.tsx` — `focus-visible:ring-2` on all interactive elements |
| ARIA labels | `AgentModeSelector.tsx` — `aria-label` on mode/personality buttons |

## Remaining Limitations

1. **AI API dependency**: Qwen/DashScope API key required for AI features; fallback logic exists but provides basic responses
2. **No English UI**: I18n only supports zh-TW and zh-CN; Agent language toggle only affects Agent output
3. **Visitor memory**: No cleanup/expiry for stale memories
4. **File uploads**: Local only (blob/data URLs); no cloud/CDN storage integration
5. **Multiplayer**: Room-based, not persistent across server restarts
6. **No PWA/offline support**: App requires active network connection

## Verification Commands
```bash
npm run test      # 322 tests across 30 test files
npm run check     # Server syntax + tests + build
npm run build     # Vite production build
```
