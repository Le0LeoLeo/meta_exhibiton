# Customizable Avatar System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立一套遊戲式 3D 角色自訂系統，讓登入使用者選擇臉型、膚色、髮型、服裝、鞋履與配件，並在個人資料及多人觀展中使用同一外觀。

**Architecture:** 使用 Blender 製作的單一共骨架 `avatar-kit-v1.glb`，在執行時以節點顯示／隱藏及有限色票組合角色；所有選項以受控 asset ID 儲存，不接受任意模型 URL。登入使用者把 `AvatarAppearanceV1` 儲存在 SQLite，訪客只保留本機設定；Socket.IO 僅在加入房間或外觀變更時同步設定，不在每次移動事件重傳。現有程序化角色保留為資產載入失敗及低效能模式的 fallback。

**Tech Stack:** Blender/glTF 2.0、React 18、React Three Fiber、Three.js、Drei、Zustand、Express、Socket.IO、SQLite、Zod、Vitest、Testing Library、Playwright。

---

## 1. 範圍與產品決策

### MVP 包含

- 一個可旋轉、縮放的 3D 角色預覽。
- 分頁：身體、頭髮、上衣、下身、鞋履、配件、顏色。
- 隨機產生、重設、儲存與取消。
- 登入使用者跨裝置保存；未登入訪客保存到 `localStorage`。
- 多人房間加入快照包含角色外觀。
- 房間內修改外觀時，以獨立事件即時更新其他玩家。
- Idle、Walk、Wave 三個動畫。
- 平衡／高畫質模式顯示美術角色；載入失敗時使用現有程序化角色。
- 所有資產選項由 manifest allowlist 驗證。

### MVP 不包含

- 任意 GLB／VRM 上傳。
- 臉部照片生成、AI 換臉或寫實掃描。
- 自由捏臉滑桿及大量 morph target。
- 商城、貨幣、裝備稀有度、付費服裝。
- 跨骨架服裝混搭。
- 使用者自行上傳貼圖。

### 驗收基準

- 首次角色資產 gzip 傳輸不超過 5 MB。
- 單一可見角色不超過 30k triangles、4 張 1024² 貼圖。
- 10 名遠端角色的平衡模式在開發基準機維持至少 50 FPS。
- 多人 `player:move` payload 不包含 avatar 資料。
- 外觀 payload JSON 序列化後不超過 1 KB。
- 未知 asset ID、額外欄位及任意 URL 均被伺服器拒絕或正規化。
- 角色面向 `-Z`、腳底位於 `Y=0`、眼高約 1.65–1.72 m。

## 2. 美術資產契約

### 座標、骨架及模型

- Blender 單位：1 unit = 1 metre。
- Up axis：`+Y`。
- 角色正面：`-Z`，與目前 `Player.tsx` 的前進方向一致。
- Armature 原點及角色腳底：`(0, 0, 0)`。
- 角色總高：1.72–1.78 m。
- 所有可換服裝必須使用同一 Armature 與相同 bone names。
- Skin weights 每 vertex 最多 4 個 influence。
- 不可有負 scale、未套用 transform、重複骨骼名稱或未使用材質。

骨骼最低要求：

```text
Root
└── Hips
    ├── Spine
    │   └── Chest
    │       ├── Neck
    │       │   └── Head
    │       ├── Shoulder_L → UpperArm_L → LowerArm_L → Hand_L
    │       └── Shoulder_R → UpperArm_R → LowerArm_R → Hand_R
    ├── UpperLeg_L → LowerLeg_L → Foot_L
    └── UpperLeg_R → LowerLeg_R → Foot_R
```

### GLB 節點命名

`public/models/avatars/v1/avatar-kit-v1.glb` 必須包含：

```text
AvatarRoot
Armature
Body_body01
Body_body02
Head_head01
Head_head02
Hair_hair01
Hair_hair02
Hair_hair03
Top_top01
Top_top02
Top_top03
Bottom_bottom01
Bottom_bottom02
Bottom_bottom03
Shoes_shoes01
Shoes_shoes02
Accessory_none
Accessory_glasses01
Accessory_hat01
```

每個選項只能有一個對應 node。分類 prefix 必須與 manifest 一致。未選中的 node 仍可存在於 GLB，但預設 `visible=false`。

### 材質插槽

可換色材質使用固定名稱：

```text
MAT_SKIN
MAT_HAIR
MAT_TOP_PRIMARY
MAT_TOP_SECONDARY
MAT_BOTTOM
MAT_SHOES
MAT_ACCESSORY
```

不可在程式中依 mesh index 尋找材質。色彩採有限色票；PBR 參數由美術資產控制，程式只改 `color`，不可改貼圖 URL。

### 動畫 clips

```text
Idle     2–4 秒、loop、原地
Walk     0.8–1.2 秒、loop、原地
Wave     1.5–2.5 秒、一次性
```

動畫不得包含 root translation。角色位置仍由多人 interpolation 控制。

### LOD 與縮圖

- MVP 先交付 `avatar-kit-v1.glb`。
- 第二階段交付 `avatar-kit-v1-lod.glb`，單一可見角色不超過 10k triangles。
- 每個選項提供 256×256 WebP 縮圖，放於：

```text
public/models/avatars/v1/thumbnails/{category}/{assetId}.webp
```

## 3. 固定資料格式

前後端使用相同語意的 V1 格式：

```ts
export type AvatarAppearanceV1 = {
  version: 1;
  body: "body01" | "body02";
  head: "head01" | "head02";
  hair: "hair01" | "hair02" | "hair03";
  top: "top01" | "top02" | "top03";
  bottom: "bottom01" | "bottom02" | "bottom03";
  shoes: "shoes01" | "shoes02";
  accessory: "none" | "glasses01" | "hat01";
  colors: {
    skin: "skin01" | "skin02" | "skin03" | "skin04" | "skin05";
    hair: "hairBlack" | "hairBrown" | "hairBlonde" | "hairRed";
    top: "navy" | "teal" | "violet" | "rose" | "amber";
    bottom: "charcoal" | "navy" | "brown";
    shoes: "black" | "white" | "brown";
  };
};
```

預設值：

```ts
export const DEFAULT_AVATAR_APPEARANCE: AvatarAppearanceV1 = {
  version: 1,
  body: "body01",
  head: "head01",
  hair: "hair01",
  top: "top01",
  bottom: "bottom01",
  shoes: "shoes01",
  accessory: "none",
  colors: {
    skin: "skin02",
    hair: "hairBlack",
    top: "navy",
    bottom: "charcoal",
    shoes: "black",
  },
};
```

SQLite 儲存欄位為 `users.avatar_appearance_json TEXT`。API 回傳已驗證的物件；資料庫中 `NULL`、損壞 JSON 或舊版本均回退預設值。

---

### Task 1: 建立 avatar manifest、型別與驗證

**Files:**

- Create: `src/app/modules/metaverse3d/avatar/avatarManifest.ts`
- Create: `src/app/modules/metaverse3d/avatar/avatarAppearance.ts`
- Test: `src/app/modules/metaverse3d/avatar/avatarAppearance.test.ts`
- Create: `server/schemas/avatarAppearanceSchema.js`
- Test: `server/schemas/avatarAppearanceSchema.test.js`

**Step 1: 寫前端失敗測試**

測試必須覆蓋：

- 預設設定可通過。
- 未知 hair ID 回退預設 hair。
- 額外 URL 欄位被移除。
- `version !== 1` 回退完整預設。
- `normalizeAvatarAppearance` 不修改輸入物件。

**Step 2: 執行測試確認失敗**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/avatar/avatarAppearance.test.ts
```

Expected: FAIL，因模組尚未建立。

**Step 3: 實作 manifest 與 normalizer**

`avatarManifest.ts` 必須是唯一的前端選項來源，包含：

```ts
export const AVATAR_MANIFEST = {
  modelUrl: "/models/avatars/v1/avatar-kit-v1.glb",
  nodes: {
    body: { body01: "Body_body01", body02: "Body_body02" },
    head: { head01: "Head_head01", head02: "Head_head02" },
    hair: {
      hair01: "Hair_hair01",
      hair02: "Hair_hair02",
      hair03: "Hair_hair03",
    },
    top: { top01: "Top_top01", top02: "Top_top02", top03: "Top_top03" },
    bottom: {
      bottom01: "Bottom_bottom01",
      bottom02: "Bottom_bottom02",
      bottom03: "Bottom_bottom03",
    },
    shoes: { shoes01: "Shoes_shoes01", shoes02: "Shoes_shoes02" },
    accessory: {
      none: "Accessory_none",
      glasses01: "Accessory_glasses01",
      hat01: "Accessory_hat01",
    },
  },
} as const;
```

`normalizeAvatarAppearance(value)` 逐欄檢查 allowlist，不可用 `Object.assign` 直接接受未知欄位。

**Step 4: 寫並執行伺服器 schema 測試**

Run:

```bash
npm run test -- server/schemas/avatarAppearanceSchema.test.js
```

Expected before implementation: FAIL。

使用 Zod `.strict()`，限制 `version`、asset ID 及 palette ID。輸出函式：

```js
export function parseAvatarAppearance(value) {}
export function parseStoredAvatarAppearance(json) {}
```

HTTP 寫入遇到非法 payload 回傳 400；資料庫讀取遇到損壞資料則回退預設。

**Step 5: 執行兩組測試**

Run:

```bash
npm run test -- src/app/modules/metaverse3d/avatar/avatarAppearance.test.ts server/schemas/avatarAppearanceSchema.test.js
```

Expected: PASS。

**Step 6: Commit**

```bash
git add src/app/modules/metaverse3d/avatar server/schemas/avatarAppearanceSchema.js server/schemas/avatarAppearanceSchema.test.js
git commit -m "feat: define customizable avatar schema" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

### Task 2: 建立美術資產驗證閘門

**Files:**

- Create: `scripts/validate-avatar-kit.mjs`
- Create: `public/models/avatars/v1/README.md`
- Create after art delivery: `public/models/avatars/v1/avatar-kit-v1.glb`
- Create after art delivery: `public/models/avatars/v1/thumbnails/**`
- Modify: `package.json`
- Test: `scripts/validate-avatar-kit.test.mjs`

**Step 1: 寫失敗測試**

以 fixture manifest 測試 validator 能發現：

- 缺少必要 node。
- 缺少 Idle／Walk／Wave clip。
- 模型超過 triangles 預算。
- 圖片超過 1024²。
- root bounds 未落在腳底 `Y=0 ± 0.01`。
- 正面標記或 head forward 不符合 `-Z`。

**Step 2: 執行測試確認失敗**

```bash
npm run test -- scripts/validate-avatar-kit.test.mjs
```

Expected: FAIL。

**Step 3: 實作 validator**

使用現有 `three` 與 `GLTFLoader`；不可為此腳本新增瀏覽器依賴。腳本輸出每項資產統計並以非零 exit code 阻止不合格資產。

新增 script：

```json
{
  "check:avatar": "node scripts/validate-avatar-kit.mjs"
}
```

並將 `npm run check:avatar` 加入 `npm run check`，但在正式 GLB 尚未交付前先支援：

```text
AVATAR_ASSET_VALIDATION=optional
```

CI／production build 必須設定為 required；本機缺資產時清楚輸出 SKIP，不可靜默。

**Step 4: 加入資產 README**

README 必須收錄本文件第 2 節的 Blender 單位、節點、材質、動畫及 budgets，並列出 Blender export 設定：

- glTF Binary `.glb`
- Apply Modifiers
- Skinning
- Animations
- `+Y Up`
- 不嵌入未使用圖片

**Step 5: 執行測試與 validator**

```bash
npm run test -- scripts/validate-avatar-kit.test.mjs
npm run check:avatar
```

Expected: 測試 PASS；有正式資產時 validator PASS，未交付時明確 SKIP。

**Step 6: Commit**

```bash
git add scripts/validate-avatar-kit.mjs scripts/validate-avatar-kit.test.mjs public/models/avatars/v1/README.md package.json
git commit -m "build: validate avatar art assets" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

### Task 3: 持久化登入使用者的角色設定

**Files:**

- Modify: `server/db.js`
- Modify: `server/dbInitialization.test.js`
- Modify: `server/repositories/userRepository.js`
- Test: `server/repositories/userRepository.test.js`
- Modify: `server/services/userDataExportService.js`
- Modify: `server/services/userDataExportService.test.js`

**Step 1: 寫 migration 失敗測試**

在記憶體 SQLite 執行 `initDb` 後，驗證 `users` 包含：

```sql
avatar_appearance_json TEXT
```

重複執行 `initDb` 必須仍成功。

**Step 2: 執行測試確認失敗**

```bash
npm run test -- server/dbInitialization.test.js
```

Expected: FAIL，缺少欄位。

**Step 3: 加入 idempotent migration**

在 `server/db.js` 既有 `users` 建表後加入：

```js
db.run("ALTER TABLE users ADD COLUMN avatar_appearance_json TEXT", (error) => {
  if (error && !String(error.message || "").includes("duplicate column name")) {
    console.error("[db] failed to add avatar appearance column:", error);
  }
});
```

不可修改或提交 `server/app.db*`。

**Step 4: 寫 repository 失敗測試**

測試：

- `updateUserAvatarAppearance(id, json, db)` 只更新指定使用者。
- `getUserById` 可讀回 JSON。
- 找不到使用者時更新回報 `changes === 0`。

**Step 5: 實作 repository**

新增：

```js
export function updateUserAvatarAppearance(id, appearanceJson, database) {
  return runStatement(
    database,
    "UPDATE users SET avatar_appearance_json = ? WHERE id = ?",
    [appearanceJson, id],
  );
}
```

**Step 6: 將外觀加入個人資料匯出**

`userDataExportService` 匯出已解析的 `avatarAppearance`，不可只輸出原始 JSON 字串。

**Step 7: 執行相關測試**

```bash
npm run test -- server/dbInitialization.test.js server/repositories/userRepository.test.js server/services/userDataExportService.test.js
```

Expected: PASS。

**Step 8: Commit**

```bash
git add server/db.js server/dbInitialization.test.js server/repositories/userRepository.js server/repositories/userRepository.test.js server/services/userDataExportService.js server/services/userDataExportService.test.js
git commit -m "feat: persist user avatar appearance" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

### Task 4: 擴充登入與角色設定 API

**Files:**

- Modify: `server/routes/authRoutes.js`
- Modify: `server/routes/authRoutes.test.js`
- Modify: `server/index.js`
- Modify: `src/app/api/auth.ts`
- Modify: `src/app/api/request.test.ts`

**Step 1: 寫 API 失敗測試**

新增測試：

- `GET /api/auth/me` 回傳 `user.avatarAppearance`。
- `PUT /api/users/me/avatar` 需要登入。
- 合法 V1 外觀回傳 200 並保存 canonical JSON。
- 未知 asset ID、URL、額外欄位回傳 400。
- repository 更新 0 rows 時回傳 404。
- register/login response 亦包含預設或已存外觀。

**Step 2: 執行測試確認失敗**

```bash
npm run test -- server/routes/authRoutes.test.js
```

Expected: FAIL。

**Step 3: 實作伺服器端 API**

在 `registerAuthRoutes` 注入 `updateUserAvatarAppearance`。新增：

```text
PUT /api/users/me/avatar
Content-Type: application/json
Body: AvatarAppearanceV1
Response: { avatarAppearance: AvatarAppearanceV1 }
```

所有 auth user serializer 收斂成單一 helper：

```js
function serializeAuthUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarAppearance: parseStoredAvatarAppearance(row.avatar_appearance_json),
  };
}
```

JWT 只保留身份欄位，不把整份 avatar config 放入 token。

**Step 4: 實作前端 API**

擴充：

```ts
export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarAppearance: AvatarAppearanceV1;
};

export async function updateMyAvatar(
  token: string,
  appearance: AvatarAppearanceV1,
): Promise<{ avatarAppearance: AvatarAppearanceV1 }> {}
```

**Step 5: 執行測試**

```bash
npm run test -- server/routes/authRoutes.test.js src/app/api/request.test.ts
npm run typecheck
```

Expected: PASS。

**Step 6: Commit**

```bash
git add server/routes/authRoutes.js server/routes/authRoutes.test.js server/index.js src/app/api/auth.ts src/app/api/request.test.ts
git commit -m "feat: expose user avatar settings API" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

### Task 5: 擴充多人協定與伺服器驗證

**Files:**

- Modify: `src/app/modules/metaverse3d/network/protocol.ts`
- Modify: `server/multiplayer/protocol.js`
- Modify: `server/multiplayer/socketServer.js`
- Modify: `server/multiplayer/socketServer.test.js`

**Step 1: 寫 Socket.IO 失敗測試**

新增測試：

- `room:join` 接受 `appearance` 並在 `room:joined`／`player:joined` snapshot 回傳。
- 沒有 appearance 的舊客戶端取得預設外觀。
- 非法 appearance 不進入 room state。
- `player:appearance` 只廣播到目前 room。
- `player:appearance` 的 payload 不超過 1 KB。
- `player:move` 不攜帶或廣播 appearance。
- 重複加入同一 room 可更新 nickname 與 appearance，但不產生 ghost player。

**Step 2: 執行測試確認失敗**

```bash
npm run test -- server/multiplayer/socketServer.test.js
```

Expected: FAIL。

**Step 3: 擴充協定**

```ts
export type RoomJoinPayload = {
  roomId: string;
  nickname: string;
  appearance?: AvatarAppearanceV1;
  shareToken?: string;
};

export type PlayerSnapshot = {
  id: string;
  nickname: string;
  appearance: AvatarAppearanceV1;
  position: Vec3;
  yaw: number;
  lastSeq: number;
  updatedAt: number;
};

export type PlayerAppearancePayload = {
  roomId: string;
  appearance: AvatarAppearanceV1;
};

export type PlayerAppearanceChangedPayload = {
  roomId: string;
  id: string;
  appearance: AvatarAppearanceV1;
  updatedAt: number;
};
```

**Step 4: 實作伺服器事件**

```text
client → server: player:appearance
server → room:   player:appearance:changed
```

伺服器必須重新 parse，不信任前端 normalizer。使用目前 room membership、角色授權及 rate limiter；限制每位 socket 每 2 秒最多一次外觀更新。外觀只放在 player room state，不寫入 gallery scene。

**Step 5: 執行 server 測試**

```bash
npm run test -- server/multiplayer/socketServer.test.js
npm run check:server
```

Expected: PASS。

**Step 6: Commit**

```bash
git add src/app/modules/metaverse3d/network/protocol.ts server/multiplayer/protocol.js server/multiplayer/socketServer.js server/multiplayer/socketServer.test.js
git commit -m "feat: synchronize avatar appearance in multiplayer" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

### Task 6: 在前端 store 與 socket client 接收角色外觀

**Files:**

- Modify: `src/app/modules/metaverse3d/network/multiplayerStore.ts`
- Modify: `src/app/modules/metaverse3d/network/multiplayerStore.test.ts`
- Modify: `src/app/modules/metaverse3d/network/socketClient.ts`
- Modify: `src/app/modules/metaverse3d/network/socketClient.test.ts`
- Create: `src/app/modules/metaverse3d/avatar/avatarPreferenceStore.ts`
- Test: `src/app/modules/metaverse3d/avatar/avatarPreferenceStore.test.ts`

**Step 1: 寫 store 失敗測試**

測試：

- `RemotePlayerState` 從 snapshot 取得 appearance。
- appearance event 只更新指定玩家，不重設位置 interpolation。
- invalid client-side data 經 normalizer 回退。
- `clearSession` 清除 remote appearances。
- guest preference 使用版本化 key `mrei.avatar.v1`。
-損壞 localStorage JSON 回退預設並移除損壞值。

**Step 2: 執行測試確認失敗**

```bash
npm run test -- src/app/modules/metaverse3d/network/multiplayerStore.test.ts src/app/modules/metaverse3d/avatar/avatarPreferenceStore.test.ts
```

Expected: FAIL。

**Step 3: 實作 preference store**

狀態：

```ts
type AvatarPreferenceState = {
  appearance: AvatarAppearanceV1;
  source: "default" | "guest" | "account";
  dirty: boolean;
  setAppearance: (value: AvatarAppearanceV1) => void;
  hydrateGuest: () => void;
  hydrateAccount: (value: AvatarAppearanceV1) => void;
  markSaved: () => void;
  reset: () => void;
};
```

只有 guest source 寫入 `localStorage`；account source 由 API 保存。

**Step 4: 擴充 socket client**

- `joinCurrentRoom()` 加入目前 appearance。
- 監聽 `player:appearance:changed`。
- 新增 `emitPlayerAppearance(appearance)`。
- 不修改 `emitPlayerMove()` payload。

**Step 5: 執行測試**

```bash
npm run test -- src/app/modules/metaverse3d/network/multiplayerStore.test.ts src/app/modules/metaverse3d/network/socketClient.test.ts src/app/modules/metaverse3d/avatar/avatarPreferenceStore.test.ts
npm run typecheck
```

Expected: PASS。

**Step 6: Commit**

```bash
git add src/app/modules/metaverse3d/network src/app/modules/metaverse3d/avatar/avatarPreferenceStore.ts src/app/modules/metaverse3d/avatar/avatarPreferenceStore.test.ts
git commit -m "feat: manage avatar preferences and room updates" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

### Task 7: 建立可重用的 Rigged Avatar renderer

**Files:**

- Create: `src/app/modules/metaverse3d/avatar/AvatarModel.tsx`
- Create: `src/app/modules/metaverse3d/avatar/configureAvatarScene.ts`
- Test: `src/app/modules/metaverse3d/avatar/configureAvatarScene.test.ts`
- Create: `src/app/modules/metaverse3d/avatar/useAvatarAnimation.ts`
- Test: `src/app/modules/metaverse3d/avatar/useAvatarAnimation.test.ts`
- Modify: `src/app/modules/metaverse3d/components/CanvasScene.tsx`

**Step 1: 寫 scene configurator 失敗測試**

以小型 `THREE.Group` fixture 建立命名 nodes/materials，測試：

- 每個 category 只有所選 node 可見。
- `accessory=none` 不顯示眼鏡或帽。
- 只修改 clone 的材質，不污染 `useGLTF` cache。
- 缺 node 時回報一次 warning 並繼續 render。
- shared geometry 不被 individual avatar dispose。

**Step 2: 執行測試確認失敗**

```bash
npm run test -- src/app/modules/metaverse3d/avatar/configureAvatarScene.test.ts
```

Expected: FAIL。

**Step 3: 實作 scene configurator**

流程：

1. `useGLTF(AVATAR_MANIFEST.modelUrl)` 只載入一次。
2. `SkeletonUtils.clone(source.scene)` 為每角色建立獨立 skeleton。
3. 按 manifest category 關閉全部 nodes，再開啟 selected node。
4. 只 clone 需要改色的 material；geometry 仍共用。
5. unmount 時只 dispose cloned materials，不 dispose cached geometry/textures。

不可在 `useFrame` 中 clone scene、material、Vector3 或 array。

**Step 4: 寫動畫 state 測試**

建立純函式：

```ts
export function selectAvatarAnimation(
  speedMetersPerSecond: number,
  emote: "none" | "wave",
): "Idle" | "Walk" | "Wave";
```

驗證 idle/walk threshold 有 hysteresis，避免網絡 interpolation 在臨界點快速切換。

**Step 5: 實作動畫 hook**

- 使用 `useAnimations`。
- Idle/Walk cross-fade 0.18 秒。
- Wave 播放一次後回到 Idle/Walk。
- 以 player ID hash 加入 `Idle` 起始 offset，避免所有人同步。
- Walk animation speed 根據移動速度 clamp 至 0.7–1.35。

**Step 6: 預載資產**

在 3D viewer 啟動路徑呼叫：

```ts
useGLTF.preload(AVATAR_MANIFEST.modelUrl);
```

不可在網站首頁預載；只在即將進入角色編輯器或 3D 展館時預載。

**Step 7: 執行測試**

```bash
npm run test -- src/app/modules/metaverse3d/avatar/configureAvatarScene.test.ts src/app/modules/metaverse3d/avatar/useAvatarAnimation.test.ts
npm run typecheck
```

Expected: PASS。

**Step 8: Commit**

```bash
git add src/app/modules/metaverse3d/avatar src/app/modules/metaverse3d/components/CanvasScene.tsx
git commit -m "feat: render modular rigged avatars" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

### Task 8: 將多人 RemotePlayer 切換至美術角色

**Files:**

- Modify: `src/app/modules/metaverse3d/components/Multiplayer/RemotePlayer.tsx`
- Modify: `src/app/modules/metaverse3d/components/Multiplayer/remotePlayerAppearance.ts`
- Modify: `src/app/modules/metaverse3d/components/Multiplayer/remotePlayerAppearance.test.ts`
- Create: `src/app/modules/metaverse3d/components/Multiplayer/RemotePlayer.test.tsx`

**Step 1: 寫失敗測試**

測試：

- 有合法 appearance 時使用 `AvatarModel`。
- model error boundary 或載入失敗時使用現有程序化 visitor。
- `enableRemotePlayers=false` 時不載入 GLB。
- nameplate 與識別圈仍存在。
- root 保持 `renderY - DEFAULT_EYE_HEIGHT`。
- player yaw=0 時正面為 `-Z`。

**Step 2: 執行測試確認失敗**

```bash
npm run test -- src/app/modules/metaverse3d/components/Multiplayer/RemotePlayer.test.tsx
```

Expected: FAIL。

**Step 3: 重構 RemotePlayer**

`RemotePlayer` 只負責：

- multiplayer transform。
- movement speed。
- nameplate／識別圈。
- `AvatarModel` 與 fallback 選擇。

把目前程序化 JSX 移到：

```text
src/app/modules/metaverse3d/avatar/ProceduralAvatarFallback.tsx
```

不要保留 `VITE_REMOTE_AVATAR_GLB` 作為主要模型來源；如需緊急覆寫，只允許同源 public path 並在文件中標示 deprecated。

**Step 4: 效能模式整合**

- `quality`：主模型，陰影開啟。
- `balanced`：主模型，遠端角色陰影關閉或只由最近 4 人投影。
- `performance`：沿用現有 `enableRemotePlayers=false`，不載入角色。
- 遠距 15 m 以上改用 LOD；LOD 資產未交付前先停用該 branch，不可假裝已有。

**Step 5: 執行測試**

```bash
npm run test -- src/app/modules/metaverse3d/components/Multiplayer
npm run typecheck
```

Expected: PASS。

**Step 6: Commit**

```bash
git add src/app/modules/metaverse3d/components/Multiplayer src/app/modules/metaverse3d/avatar/ProceduralAvatarFallback.tsx
git commit -m "feat: display customized multiplayer avatars" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

### Task 9: 建立遊戲式角色自訂介面

**Files:**

- Create: `src/app/pages/AvatarCustomizer.tsx`
- Create: `src/app/pages/AvatarCustomizer.test.tsx`
- Create: `src/app/components/avatar/AvatarPreviewCanvas.tsx`
- Create: `src/app/components/avatar/AvatarOptionGrid.tsx`
- Create: `src/app/components/avatar/AvatarColorPalette.tsx`
- Create: `src/app/components/avatar/randomizeAvatar.ts`
- Test: `src/app/components/avatar/randomizeAvatar.test.ts`
- Modify: `src/app/routes.ts`

**Step 1: 寫 UI 失敗測試**

測試：

- `/avatar` 未登入時仍可編輯 guest appearance。
- 已登入時從 `AuthUser.avatarAppearance` hydrate。
- 選擇 hair 後預覽 props 即時更新。
- Save 按鈕只在 dirty 時可用。
- API 成功後 markSaved 並更新 auth cache。
- API 失敗時保留 dirty draft 並顯示 toast。
- Cancel 恢復最後保存設定。
- Randomize 只產生 manifest 中合法組合。
- keyboard 可操作分頁、選項和色票。

**Step 2: 執行測試確認失敗**

```bash
npm run test -- src/app/pages/AvatarCustomizer.test.tsx src/app/components/avatar/randomizeAvatar.test.ts
```

Expected: FAIL。

**Step 3: 建立頁面布局**

Desktop：

```text
┌──────────────────────────────┬─────────────────────────┐
│ 3D Preview                   │ 身體 髮型 上衣 下身 ... │
│ drag rotate / wheel zoom     │ option grid / palettes  │
│                              │                         │
├──────────────────────────────┴─────────────────────────┤
│ 隨機產生  重設                         取消  儲存角色 │
└────────────────────────────────────────────────────────┘
```

Mobile：

- 3D preview 高度 42vh。
- 下方使用可橫向捲動 tabs。
- 選項至少 44×44 px。
- Save bar 固定於 safe-area 上方。

使用現有 Tailwind token、shadcn/Radix 元件，不引入第二套 UI framework。

**Step 4: 建立預覽 Canvas**

- 相機聚焦角色胸口。
- OrbitControls 只允許水平旋轉、有限 zoom，不允許平移。
- 簡單三點式燈光及中性背景。
- WebGL unavailable 時顯示 option thumbnails，仍允許保存。
- 加入 error boundary 和 retry。

**Step 5: 實作保存流程**

- Guest：保存 `mrei.avatar.v1`。
- Account：呼叫 `updateMyAvatar`，成功後更新 in-memory auth。
- 若 multiplayer 已連線，同步呼叫 `emitPlayerAppearance`；未連線不建立 socket。
- route leave 且 dirty 時顯示確認。

**Step 6: 執行 UI 測試**

```bash
npm run test -- src/app/pages/AvatarCustomizer.test.tsx src/app/components/avatar
npm run typecheck
```

Expected: PASS。

**Step 7: Commit**

```bash
git add src/app/pages/AvatarCustomizer.tsx src/app/pages/AvatarCustomizer.test.tsx src/app/components/avatar src/app/routes.ts
git commit -m "feat: add 3D avatar customizer" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

### Task 10: 將入口、帳戶狀態與翻譯接入產品

**Files:**

- Modify: `src/app/pages/Profile.tsx`
- Create: `src/app/pages/Profile.test.tsx`
- Modify: `src/app/components/Navigation.tsx`
- Modify: `src/app/i18n/catalogs/zh-TW.ts`
- Modify: `src/app/i18n/catalogs/zh-CN.ts`
- Modify: `src/app/i18n/catalogs/en.ts`
- Modify: `src/app/api/auth.ts`

**Step 1: 寫失敗測試**

測試：

- Profile 顯示角色縮圖及「自訂角色」入口。
- Navigation 的使用者 avatar 優先顯示渲染縮圖；尚未產生縮圖時維持 initials fallback。
- 儲存角色後 auth subscribers 收到更新。
- 三種語言都有相同 key。

**Step 2: 執行測試確認失敗**

```bash
npm run test -- src/app/pages/Profile.test.tsx src/app/components/Navigation.test.tsx
```

Expected: FAIL。

**Step 3: 實作產品入口**

- Profile 名稱區塊下方加入角色卡及 `/avatar` 按鈕。
- Navigation 先保持 initials，不在每頁建立 WebGL Canvas。
- 若需要 2D 頭像，角色編輯器保存時以 preview Canvas 產生 256×256 WebP；MVP 可延期，並使用 manifest hair/head 組合縮圖。

**Step 4: 加入 i18n**

至少包含：

```text
avatarCustomizerTitle
avatarCustomizerDescription
avatarCategoryBody
avatarCategoryHead
avatarCategoryHair
avatarCategoryTop
avatarCategoryBottom
avatarCategoryShoes
avatarCategoryAccessory
avatarRandomize
avatarReset
avatarSave
avatarSaved
avatarSaveFailed
avatarUnsavedChanges
avatarPreviewUnavailable
```

不可在 JSX 中硬編碼繁中 UI。

**Step 5: 執行測試與 i18n audit**

```bash
npm run test -- src/app/pages/Profile.test.tsx src/app/components/Navigation.test.tsx
npm run typecheck
```

再執行專案現有 i18n audit 工具；若 root script 名稱已改變，先以 `rg --files .. | rg "i18n.*audit"` 確認，不猜測命令。

**Step 6: Commit**

```bash
git add src/app/pages/Profile.tsx src/app/pages/Profile.test.tsx src/app/components/Navigation.tsx src/app/i18n/catalogs src/app/api/auth.ts
git commit -m "feat: expose avatar customization in profile" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

### Task 11: 多人、視覺、無障礙及效能驗收

**Files:**

- Create: `tests/e2e/avatar-customizer.spec.ts`
- Create: `tests/e2e/multiplayer-avatar.spec.ts`
- Create: `docs/avatar-art-pipeline.md`
- Modify: `doc/README.md`

**Step 1: 建立 E2E 測試**

角色編輯器：

1. 登入測試帳戶。
2. 開啟 `/avatar`。
3. 選擇 `hair02`、`top03`、`glasses01`。
4. 儲存並 reload。
5. 驗證選項及 API response 保留。

多人：

1. Owner 與 collaborator 加入同一 gallery。
2. collaborator 使用指定 appearance 加入。
3. owner 畫面出現相同外觀。
4. collaborator 移動，Walk 動畫啟動。
5. collaborator 更新外觀，owner 不 reload 即更新。
6. collaborator 離開，GPU resources 及 remote state 被清除。

**Step 2: 手動視覺驗收**

在 1440×900、390×844 各截圖：

- 角色編輯器 desktop/mobile。
- 近距離正面、背面、側面。
- 10 名不同外觀遠端角色。
- 深色／淺色模式。
- WebGL unavailable fallback。

檢查：

- 衣服無明顯穿模。
- 手腳沒有 inverse scale 或骨架爆炸。
- 鞋底貼地。
- 頭髮與帽子組合不穿透；不相容組合須由 manifest exclusion 規則禁用。
- 膚色在展館主光源下不過曝。
- 名牌不遮臉。

**Step 3: 無障礙驗收**

- 所有選項有可讀名稱、選取狀態和 focus ring。
- 顏色不只靠色塊識別，必須有文字名稱。
- 鍵盤可完成整個設定與保存流程。
- prefers-reduced-motion 時停止 preview 自動旋轉。
- Canvas 有文字替代說明。

**Step 4: 效能驗收**

Chrome Performance／Three renderer info 記錄：

```text
1 player:
10 players:
20 join/leave cycles:
geometries before/after:
textures before/after:
programs before/after:
average FPS:
95th percentile frame time:
```

20 次 join/leave 後，geometries、textures、programs 不應持續線性增加。

**Step 5: 完整驗證**

```bash
npm run check
```

Expected:

- server syntax PASS
- TypeScript PASS
- ESLint PASS，0 warnings
- Vitest PASS
- Vite build PASS
- bundle budget PASS
- avatar asset validation PASS

**Step 6: 更新文件**

`docs/avatar-art-pipeline.md` 記錄：

- Blender template 路徑及版本。
- 新增一件服裝的命名、weight transfer、export、validator 流程。
- manifest 加入新 ID 的步驟。
- 禁用不相容組合的規則。
- GLB 回滾及版本升級方式。
- V1 → V2 appearance migration 策略。

部署文件加入靜態資產 cache：

```text
/models/avatars/v1/*.glb
Cache-Control: public, max-age=31536000, immutable
```

若檔名未包含 content hash，不可使用 immutable；先改成 hash filename 並由 manifest 指向新檔。

**Step 7: Final commit**

```bash
git add tests/e2e docs/avatar-art-pipeline.md doc/README.md
git commit -m "test: verify customizable avatars end to end" -m "Co-Authored-By: GPT-5 Codex <codex@openai.com>"
```

---

## 4. 交付順序與依賴

```text
美術契約與 manifest
├── 美術製作 avatar-kit-v1.glb
├── API/schema/database
└── multiplayer protocol
        ↓
Rigged Avatar renderer
        ↓
RemotePlayer integration
        ↓
Avatar Customizer UI
        ↓
E2E、效能與視覺驗收
```

可平行進行：

- 美術製作與 Tasks 1、3、4、5、6。
- UI shell 與 thumbnails。
- Server persistence 與 renderer pure helpers。

不可提前：

- 未通過 asset validator，不把 GLB 接入 RemotePlayer。
- 未完成 server allowlist validation，不廣播 appearance。
- 未證明 join/leave 無 GPU 線性增長，不發布多人自訂角色。

## 5. 風險與緩解

| 風險 | 緩解 |
|---|---|
| 衣服穿模 | 共骨架、固定 body variants、manifest exclusion rules，不在 MVP 提供連續體型 slider |
| GLB 太大 | Draco/Meshopt 擇一、清理未使用資料、1024² atlas、validator budget |
| 每位玩家重複 GPU 資源 | `useGLTF` cache、共享 geometry/texture、只 clone skeleton 與需改色 material |
| 惡意 asset URL | 協定只接受 allowlisted ID，Zod strict schema，不接受 URL |
| 移動封包膨脹 | appearance 只在 join／change 傳送 |
| 舊客戶端相容 | appearance optional，server 補 default |
| WebGL 失效 | 現有程序化 avatar／2D thumbnails fallback |
| 全員動畫同步 | 使用 player ID hash 作 animation phase offset |
| 未登入設定遺失 | versioned localStorage；登入後提示採用本機或帳戶設定 |
| 未來新增選項破壞舊設定 | `version: 1`、normalizer、明確 V1→V2 migration |

## 6. Definition of Done

- 美術資產通過自動 validator 及人工 360° 檢查。
- 使用者能完成自訂、保存、reload 還原。
- 訪客與登入帳戶有清楚的持久化行為。
- 兩個瀏覽器 session 能即時看到對方外觀與變更。
- 現有程序化角色只作 fallback，不再是主要品質來源。
- 不接受任意 URL、未知 ID 或超大 payload。
- 角色資源在反覆 join/leave 後沒有可觀察的線性 GPU leak。
- `npm run check` 全部通過。
- 文件包含美術新增資產與版本升級流程。
