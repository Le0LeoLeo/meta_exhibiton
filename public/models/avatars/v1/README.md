# Avatar Kit V1 art contract

The production asset belongs at `avatar-kit-v1.glb`. Do not add a placeholder
GLB: local validation deliberately reports `SKIP` until the real art is
delivered.

## Scene and rig

- Author in metres: one Blender unit equals one metre.
- Use `+Y` as up and make the character face `-Z`.
- Put the armature origin and the lowest point of both feet at `(0, 0, 0)`.
- Keep total character height between 1.72 m and 1.78 m.
- Apply transforms and modifiers. Do not export negative scales.
- Use one shared armature and stable bone names for every body and outfit.
- Limit skinning to four bone influences per vertex.

Required rig nodes:

```text
Root
Hips
Spine
Chest
Neck
Head
Shoulder_L UpperArm_L LowerArm_L Hand_L
Shoulder_R UpperArm_R LowerArm_R Hand_R
UpperLeg_L LowerLeg_L Foot_L
UpperLeg_R LowerLeg_R Foot_R
```

Required asset nodes:

```text
AvatarRoot
Armature
Body_body01 Body_body02
Head_head01 Head_head02
Hair_hair01 Hair_hair02 Hair_hair03
Top_top01 Top_top02 Top_top03
Bottom_bottom01 Bottom_bottom02 Bottom_bottom03
Shoes_shoes01 Shoes_shoes02
Accessory_none Accessory_glasses01 Accessory_hat01
```

Node names must be unique. Keep unselected variants in the GLB, hidden by
default.

## Materials and animation

Required material slots:

```text
MAT_SKIN
MAT_HAIR
MAT_TOP_PRIMARY
MAT_TOP_SECONDARY
MAT_BOTTOM
MAT_SHOES
MAT_ACCESSORY
```

Required animation clips:

| Clip | Duration | Playback |
|---|---:|---|
| `Idle` | 2–4 s | looping, in place |
| `Walk` | 0.8–1.2 s | looping, in place |
| `Wave` | 1.5–2.5 s | one shot, in place |

Do not animate root translation; multiplayer movement owns the root position.

## Budgets

- At most 30,000 triangles for one visible character.
- At most four textures, each no larger than 1024×1024.
- Use PBR materials and omit unused materials and images.
- Future `avatar-kit-v1-lod.glb`: at most 10,000 triangles.
- Option thumbnails: 256×256 WebP under
  `thumbnails/{category}/{assetId}.webp`.

## Blender export

Export **glTF Binary (`.glb`)** with:

- Apply Modifiers
- Skinning
- Animations
- `+Y Up`
- only the required meshes, materials, and images

Run `npm run check:avatar` after export. Local development defaults to optional
validation and prints an explicit `SKIP` while the production asset is absent.
CI and production builds must run `npm run check:avatar:required` (equivalent to
`AVATAR_ASSET_VALIDATION=required`); missing or invalid art then exits with a
failure.
