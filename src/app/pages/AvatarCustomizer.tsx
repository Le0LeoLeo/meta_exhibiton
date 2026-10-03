import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router";
import { Eye, ImagePlus, Redo2, Sparkles, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { AvatarColorPalette } from "@/app/components/avatar/AvatarColorPalette";
import { AvatarCustomColorControl } from "@/app/components/avatar/AvatarCustomColorControl";
import { FacialPlacementControls } from "@/app/components/avatar/FacialPlacementControls";
import { AvatarOptionGrid } from "@/app/components/avatar/AvatarOptionGrid";
import { AvatarPreviewCanvas } from "@/app/components/avatar/AvatarPreviewCanvas";
import { randomizeAvatar } from "@/app/components/avatar/randomizeAvatar";
import {
  AVATAR_CUSTOMIZER_COPY,
  AVATAR_LOOK_PRESETS,
  harmonizeAvatarColors,
} from "@/app/components/avatar/avatarLooks";
import { Button } from "@/app/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/tabs";
import { useI18n } from "@/app/components/I18nProvider";
import {
  getMe,
  loadAuth,
  saveAuth,
  updateMyAvatar,
} from "@/app/api/auth";
import { uploadMediaAsset } from "@/app/api/media";
import {
  DEFAULT_AVATAR_APPEARANCE,
  normalizeAvatarAppearance,
  type AvatarAppearanceV1,
} from "@/app/modules/metaverse3d/avatar/avatarAppearance";
import { DEFAULT_AVATAR_FACIAL_PLACEMENT } from "@/app/modules/metaverse3d/avatar/avatarFacialPlacement";
import { AVATAR_MANIFEST } from "@/app/modules/metaverse3d/avatar/avatarManifest";
import { useAvatarPreferenceStore } from "@/app/modules/metaverse3d/avatar/avatarPreferenceStore";
import { emitPlayerAppearance } from "@/app/modules/metaverse3d/network/socketClient";

type AppearanceOptionKey = Exclude<
  keyof AvatarAppearanceV1,
  "version" | "colors" | "facialPlacement" | "topPhotoUrl"
>;
type ColorKey = keyof typeof AVATAR_MANIFEST.colors;
type AppearanceTab = {
  key: AppearanceOptionKey;
  label: string;
  entries: Readonly<Record<string, string>>;
  optionLabels?: Readonly<Record<string, string>>;
};

const SHIRT_PHOTO_COPY = {
  "zh-TW": {
    title: "上衣相片",
    description: "上傳 JPG、PNG 或 WebP，相片會顯示在上衣正面。",
    upload: "上傳相片",
    replace: "更換相片",
    remove: "移除相片",
    loginRequired: "請先登入再上傳上衣相片。",
    invalid: "請選擇 15 MB 以下的 JPG、PNG 或 WebP 圖片。",
    uploading: "上傳中…",
  },
  "zh-CN": {
    title: "上衣照片",
    description: "上传 JPG、PNG 或 WebP，照片会显示在上衣正面。",
    upload: "上传照片",
    replace: "更换照片",
    remove: "移除照片",
    loginRequired: "请先登录再上传上衣照片。",
    invalid: "请选择 15 MB 以下的 JPG、PNG 或 WebP 图片。",
    uploading: "上传中…",
  },
  en: {
    title: "Shirt photo",
    description: "Upload a JPG, PNG, or WebP image for the front of the shirt.",
    upload: "Upload photo",
    replace: "Replace photo",
    remove: "Remove photo",
    loginRequired: "Sign in before uploading a shirt photo.",
    invalid: "Choose a JPG, PNG, or WebP image under 15 MB.",
    uploading: "Uploading…",
  },
} as const;

function optionList(entries: Readonly<Record<string, string>>, label: string) {
  return Object.keys(entries).map((value, index) => ({
    value,
    label: `${label} ${index + 1}`,
  }));
}

function colorList(entries: Readonly<Record<string, string>>) {
  return Object.entries(entries).map(([value, color]) => ({
    value,
    color,
    label: value,
  }));
}

export default function AvatarCustomizer() {
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const copy = AVATAR_CUSTOMIZER_COPY[locale];
  const shirtPhotoCopy = SHIRT_PHOTO_COPY[locale];
  const appearance = useAvatarPreferenceStore((state) => state.appearance);
  const dirty = useAvatarPreferenceStore((state) => state.dirty);
  const setAppearance = useAvatarPreferenceStore((state) => state.setAppearance);
  const hydrateGuest = useAvatarPreferenceStore((state) => state.hydrateGuest);
  const hydrateAccount = useAvatarPreferenceStore((state) => state.hydrateAccount);
  const markSaved = useAvatarPreferenceStore((state) => state.markSaved);
  const savedAppearanceRef = useRef<AvatarAppearanceV1>(
    normalizeAvatarAppearance(DEFAULT_AVATAR_APPEARANCE),
  );
  const appearanceGestureStartRef = useRef<AvatarAppearanceV1 | null>(null);
  const shirtPhotoInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingShirtPhoto, setUploadingShirtPhoto] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [activeTab, setActiveTab] = useState("looks");
  const [isComparing, setIsComparing] = useState(false);
  const [history, setHistory] = useState<{
    past: AvatarAppearanceV1[];
    future: AvatarAppearanceV1[];
  }>({ past: [], future: [] });

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const cached = loadAuth();
      if (cached.user) {
        if (!cancelled) {
          hydrateAccount(cached.user.avatarAppearance);
          savedAppearanceRef.current = normalizeAvatarAppearance(
            cached.user.avatarAppearance,
          );
          setHydrating(false);
        }
        return;
      }

      if (!document.cookie.includes("mrei_csrf=")) {
        hydrateGuest();
        savedAppearanceRef.current = useAvatarPreferenceStore.getState().appearance;
        setHydrating(false);
        return;
      }

      try {
        const auth = await getMe();
        if (cancelled) return;
        saveAuth(auth);
        hydrateAccount(auth.user.avatarAppearance);
        savedAppearanceRef.current = normalizeAvatarAppearance(
          auth.user.avatarAppearance,
        );
      } catch {
        if (cancelled) return;
        hydrateGuest();
        savedAppearanceRef.current = useAvatarPreferenceStore.getState().appearance;
      } finally {
        if (!cancelled) setHydrating(false);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [hydrateAccount, hydrateGuest]);

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  useEffect(
    () => () => {
      appearanceGestureStartRef.current = null;
    },
    [],
  );

  const beginAppearanceGesture = () => {
    if (appearanceGestureStartRef.current) return;
    appearanceGestureStartRef.current = normalizeAvatarAppearance(appearance);
  };

  const previewAppearance = (nextValue: AvatarAppearanceV1) => {
    setIsComparing(false);
    setAppearance(normalizeAvatarAppearance(nextValue));
  };

  const commitAppearanceGesture = (nextValue: AvatarAppearanceV1) => {
    const start =
      appearanceGestureStartRef.current ??
      normalizeAvatarAppearance(appearance);
    const next = normalizeAvatarAppearance(nextValue);
    appearanceGestureStartRef.current = null;
    if (JSON.stringify(start) !== JSON.stringify(next)) {
      setHistory((current) => ({
        past: [...current.past, start].slice(-30),
        future: [],
      }));
    }
    setIsComparing(false);
    setAppearance(next);
  };

  const cancelAppearanceGesture = () => {
    const start = appearanceGestureStartRef.current;
    appearanceGestureStartRef.current = null;
    if (start) setAppearance(start);
  };

  const commitAppearance = (nextValue: AvatarAppearanceV1) => {
    const currentAppearance =
      appearanceGestureStartRef.current ??
      normalizeAvatarAppearance(appearance);
    appearanceGestureStartRef.current = null;
    const next = normalizeAvatarAppearance(nextValue);
    if (JSON.stringify(next) === JSON.stringify(currentAppearance)) {
      setAppearance(currentAppearance);
      return;
    }
    setHistory((current) => ({
      past: [...current.past, currentAppearance].slice(-30),
      future: [],
    }));
    setIsComparing(false);
    setAppearance(next);
  };

  const updatePart = (key: AppearanceOptionKey, value: string) => {
    commitAppearance({ ...appearance, [key]: value } as AvatarAppearanceV1);
  };

  const updateColor = (key: ColorKey, value: string) => {
    const colors = { ...appearance.colors, [key]: value };
    if (key === "top") delete colors.topCustom;
    commitAppearance({
      ...appearance,
      colors,
    } as AvatarAppearanceV1);
  };

  const updateCustomTopColor = (value: string) => {
    commitAppearance({
      ...appearance,
      colors: { ...appearance.colors, topCustom: value },
    });
  };

  const clearCustomTopColor = () => {
    if (!appearance.colors.topCustom) return;
    const colors = { ...appearance.colors };
    delete colors.topCustom;
    commitAppearance({ ...appearance, colors });
  };

  const handleShirtPhotoSelected = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowedTypes.has(file.type) || file.size > 15 * 1024 * 1024) {
      toast.error(shirtPhotoCopy.invalid);
      return;
    }

    const auth = loadAuth();
    if (!auth.token || !auth.user) {
      toast.error(shirtPhotoCopy.loginRequired);
      return;
    }

    setUploadingShirtPhoto(true);
    try {
      const asset = await uploadMediaAsset(auth.token, file, "avatar");
      commitAppearance({ ...appearance, topPhotoUrl: asset.url });
    } catch (error) {
      toast.error(t("avatarSaveFailed"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setUploadingShirtPhoto(false);
    }
  };

  const removeShirtPhoto = () => {
    const nextAppearance = { ...appearance };
    delete nextAppearance.topPhotoUrl;
    commitAppearance(nextAppearance);
  };

  const undoAppearance = () => {
    cancelAppearanceGesture();
    const previous = history.past.at(-1);
    if (!previous) return;
    setHistory((current) => ({
      past: current.past.slice(0, -1),
      future: [normalizeAvatarAppearance(appearance), ...current.future].slice(0, 30),
    }));
    setIsComparing(false);
    setAppearance(previous);
  };

  const redoAppearance = () => {
    cancelAppearanceGesture();
    const next = history.future[0];
    if (!next) return;
    setHistory((current) => ({
      past: [...current.past, normalizeAvatarAppearance(appearance)].slice(-30),
      future: current.future.slice(1),
    }));
    setIsComparing(false);
    setAppearance(next);
  };

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const auth = loadAuth();
      if (auth.token && auth.user) {
        const result = await updateMyAvatar(auth.token, appearance);
        saveAuth({
          token: auth.token,
          user: { ...auth.user, avatarAppearance: result.avatarAppearance },
        });
        hydrateAccount(result.avatarAppearance);
        savedAppearanceRef.current = normalizeAvatarAppearance(
          result.avatarAppearance,
        );
        emitPlayerAppearance(result.avatarAppearance);
      } else {
        markSaved();
        savedAppearanceRef.current = normalizeAvatarAppearance(appearance);
        emitPlayerAppearance(appearance);
      }
      setHistory({ past: [], future: [] });
      setIsComparing(false);
      toast.success(t("avatarSaved"));
    } catch (error) {
      toast.error(t("avatarSaveFailed"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const appearanceTabs: AppearanceTab[] = [
    {
      key: "body",
      label: t("avatarCategoryBody"),
      entries: AVATAR_MANIFEST.nodes.body,
    },
    {
      key: "head",
      label: t("avatarCategoryHead"),
      entries: AVATAR_MANIFEST.nodes.head,
      optionLabels: copy.headLabels,
    },
    {
      key: "eyes",
      label: copy.featureLabels.eyes,
      entries: AVATAR_MANIFEST.features.eyes,
      optionLabels: copy.featureOptionLabels.eyes,
    },
    {
      key: "eyebrows",
      label: copy.featureLabels.eyebrows,
      entries: AVATAR_MANIFEST.features.eyebrows,
      optionLabels: copy.featureOptionLabels.eyebrows,
    },
    {
      key: "mouth",
      label: copy.featureLabels.mouth,
      entries: AVATAR_MANIFEST.features.mouth,
      optionLabels: copy.featureOptionLabels.mouth,
    },
    {
      key: "hair",
      label: t("avatarCategoryHair"),
      entries: AVATAR_MANIFEST.nodes.hair,
    },
    {
      key: "top",
      label: t("avatarCategoryTop"),
      entries: AVATAR_MANIFEST.nodes.top,
    },
    {
      key: "bottom",
      label: t("avatarCategoryBottom"),
      entries: AVATAR_MANIFEST.nodes.bottom,
    },
    {
      key: "shoes",
      label: t("avatarCategoryShoes"),
      entries: AVATAR_MANIFEST.nodes.shoes,
    },
    {
      key: "accessory",
      label: t("avatarCategoryAccessory"),
      entries: AVATAR_MANIFEST.nodes.accessory,
    },
  ];

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-curator-brass">
              Avatar Studio
            </p>
            <h1 className="mt-2 text-3xl font-semibold">{t("avatarCustomizerTitle")}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {t("avatarCustomizerDescription")}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>
            {t("avatarBack")}
          </Button>
        </header>

        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
          <section className="relative h-[42vh] min-h-80 min-w-0 lg:sticky lg:top-6 lg:h-[calc(100vh-9rem)]">
            <Button
              type="button"
              size="sm"
              variant={isComparing ? "default" : "secondary"}
              aria-pressed={isComparing}
              onClick={() => setIsComparing((value) => !value)}
              className="absolute right-3 top-3 z-10 gap-2 shadow-md"
            >
              <Eye className="size-4" />
              {isComparing ? copy.comparingOriginal : copy.compareOriginal}
            </Button>
            <AvatarPreviewCanvas
              previewLabel={t('avatarPreviewLabel')}
              appearance={isComparing ? savedAppearanceRef.current : appearance}
              unavailableLabel={t("avatarPreviewUnavailable")}
            />
          </section>

          <section className="min-w-0 overflow-hidden rounded-md border border-border bg-card p-4 sm:p-6">
            {hydrating ? (
              <div className="py-20 text-center text-sm text-muted-foreground">
                {t("loading")}
              </div>
            ) : (
              <Tabs
                value={activeTab}
                onValueChange={(value) => {
                  cancelAppearanceGesture();
                  setActiveTab(value);
                }}
              >
                <TabsList className="h-auto w-full max-w-full justify-start overflow-x-auto p-1">
                  <TabsTrigger value="looks" className="min-h-11 gap-2">
                    <Sparkles className="size-4" />
                    {copy.looks}
                  </TabsTrigger>
                  {appearanceTabs.map((tab) => (
                    <TabsTrigger key={tab.key} value={tab.key} className="min-h-11">
                      {tab.label}
                    </TabsTrigger>
                  ))}
                  <TabsTrigger value="facial-placement" className="min-h-11">
                    {t("avatarFacialPlacementTab")}
                  </TabsTrigger>
                  <TabsTrigger value="colors" className="min-h-11">
                    {t("avatarCategoryColors")}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="looks" className="space-y-4 pt-4">
                  <div>
                    <h2 className="text-sm font-semibold">{copy.looks}</h2>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {copy.looksDescription}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {AVATAR_LOOK_PRESETS.map((preset) => {
                      const selected =
                        JSON.stringify(appearance) === JSON.stringify(preset.appearance);
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => commitAppearance(preset.appearance)}
                          className={`rounded-xl border p-3 text-left outline-none transition ${
                            selected
                              ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                              : "border-border bg-card hover:border-primary/50 hover:bg-accent"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              aria-hidden="true"
                              className="size-6 rounded-full border border-black/10 shadow-inner"
                              style={{ backgroundColor: preset.accent }}
                            />
                            <span className="text-sm font-semibold">
                              {preset.name[locale]}
                            </span>
                          </span>
                          <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                            {preset.description[locale]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => commitAppearance(harmonizeAvatarColors(appearance))}
                    className="flex w-full items-center gap-3 rounded-xl border border-curator-brass/40 bg-curator-brass/10 p-3 text-left transition hover:bg-curator-brass/15"
                  >
                    <span className="rounded-full bg-curator-brass/15 p-2 text-curator-brass">
                      <Sparkles className="size-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{copy.smartMatch}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {copy.smartMatchDescription}
                      </span>
                    </span>
                  </button>
                </TabsContent>

                {appearanceTabs.map((tab) => (
                  <TabsContent key={tab.key} value={tab.key} className="space-y-5 pt-4">
                    <AvatarOptionGrid
                      label={tab.label}
                      options={
                        tab.optionLabels
                          ? Object.keys(tab.entries).map((value) => ({
                              value,
                              label: tab.optionLabels?.[value] ?? value,
                            }))
                          : optionList(tab.entries, tab.label)
                      }
                      value={appearance[tab.key]}
                      onValueChange={(value) => updatePart(tab.key, value)}
                    />
                    {tab.key === "top" && (
                      <div className="rounded-xl border border-border bg-muted/30 p-4">
                        <h3 className="text-sm font-semibold">
                          {shirtPhotoCopy.title}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {shirtPhotoCopy.description}
                        </p>
                        <input
                          ref={shirtPhotoInputRef}
                          data-testid="shirt-photo-input"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          onChange={handleShirtPhotoSelected}
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={uploadingShirtPhoto}
                            onClick={() => shirtPhotoInputRef.current?.click()}
                          >
                            <ImagePlus className="size-4" />
                            {uploadingShirtPhoto
                              ? shirtPhotoCopy.uploading
                              : appearance.topPhotoUrl
                                ? shirtPhotoCopy.replace
                                : shirtPhotoCopy.upload}
                          </Button>
                          {appearance.topPhotoUrl && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={removeShirtPhoto}
                            >
                              <Trash2 className="size-4" />
                              {shirtPhotoCopy.remove}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                ))}

                <TabsContent value="facial-placement" className="pt-4">
                  <FacialPlacementControls
                    value={appearance.facialPlacement}
                    labels={{
                      help: t("avatarFacialPlacementHelp"),
                      eyes: t("avatarFacialPlacementEyes"),
                      eyeHeight: t("avatarEyeHeight"),
                      eyeSpacing: t("avatarEyeSpacing"),
                      eyeSize: t("avatarEyeSize"),
                      eyebrows: t("avatarFacialPlacementEyebrows"),
                      eyebrowHeight: t("avatarEyebrowHeight"),
                      eyebrowSpacing: t("avatarEyebrowSpacing"),
                      eyebrowTilt: t("avatarEyebrowTilt"),
                      mouth: t("avatarFacialPlacementMouth"),
                      mouthHorizontal: t("avatarMouthHorizontal"),
                      mouthHeight: t("avatarMouthHeight"),
                      mouthWidth: t("avatarMouthWidth"),
                      mouthHeightScale: t("avatarMouthHeightScale"),
                      reset: t("avatarResetFacialPlacement"),
                    }}
                    onGestureStart={beginAppearanceGesture}
                    onPreview={(facialPlacement) =>
                      previewAppearance({ ...appearance, facialPlacement })
                    }
                    onCommit={(facialPlacement) =>
                      commitAppearanceGesture({ ...appearance, facialPlacement })
                    }
                    onCancel={cancelAppearanceGesture}
                    onReset={() =>
                      commitAppearance({
                        ...appearance,
                        facialPlacement: {
                          eyes: { ...DEFAULT_AVATAR_FACIAL_PLACEMENT.eyes },
                          eyebrows: {
                            ...DEFAULT_AVATAR_FACIAL_PLACEMENT.eyebrows,
                          },
                          mouth: { ...DEFAULT_AVATAR_FACIAL_PLACEMENT.mouth },
                        },
                      })
                    }
                  />
                </TabsContent>

                <TabsContent value="colors" className="space-y-6 pt-4">
                  {(Object.keys(AVATAR_MANIFEST.colors) as ColorKey[]).map((key) => (
                    <div key={key}>
                      <h2 className="mb-3 text-sm font-semibold">
                        {copy.colorLabels[key]}
                      </h2>
                      <AvatarColorPalette
                        label={key}
                        options={colorList(AVATAR_MANIFEST.colors[key])}
                        value={appearance.colors[key]}
                        onValueChange={(value) => updateColor(key, value)}
                      />
                      {key === "top" ? (
                        <AvatarCustomColorControl
                          value={appearance.colors.topCustom}
                          fallbackColor={
                            AVATAR_MANIFEST.colors.top[appearance.colors.top]
                          }
                          labels={{
                            title: t("avatarCustomTopColorTitle"),
                            description: t("avatarCustomTopColorDescription"),
                            picker: t("avatarCustomTopColorPicker"),
                            input: t("avatarCustomTopColorInput"),
                            invalid: t("avatarCustomTopColorInvalid"),
                            clear: t("avatarCustomTopColorClear"),
                          }}
                          onValueChange={updateCustomTopColor}
                          onClear={clearCustomTopColor}
                          onPickerGestureStart={beginAppearanceGesture}
                          onPickerPreview={(value) =>
                            previewAppearance({
                              ...appearance,
                              colors: {
                                ...appearance.colors,
                                topCustom: value,
                              },
                            })
                          }
                          onPickerCommit={(value) =>
                            commitAppearanceGesture({
                              ...appearance,
                              colors: {
                                ...appearance.colors,
                                topCustom: value,
                              },
                            })
                          }
                          onPickerCancel={cancelAppearanceGesture}
                        />
                      ) : null}
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            )}

            <div className="sticky bottom-0 mt-8 flex flex-wrap gap-3 border-t border-border bg-card pt-4 pb-[max(0px,env(safe-area-inset-bottom))]">
              <Button
                size="icon"
                variant="outline"
                aria-label={copy.undo}
                title={copy.undo}
                disabled={history.past.length === 0}
                onClick={undoAppearance}
              >
                <Undo2 className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                aria-label={copy.redo}
                title={copy.redo}
                disabled={history.future.length === 0}
                onClick={redoAppearance}
              >
                <Redo2 className="size-4" />
              </Button>
              <Button variant="outline" onClick={() => commitAppearance(randomizeAvatar())}>
                {t("avatarRandomize")}
              </Button>
              <Button
                variant="outline"
                onClick={() => commitAppearance(DEFAULT_AVATAR_APPEARANCE)}
              >
                {t("avatarReset")}
              </Button>
              <div className="flex-1" />
              <Button
                variant="ghost"
                disabled={!dirty}
                onClick={() => {
                  cancelAppearanceGesture();
                  setAppearance(savedAppearanceRef.current);
                  setHistory({ past: [], future: [] });
                  setIsComparing(false);
                  markSaved();
                }}
              >
                {t("avatarCancel")}
              </Button>
              <Button disabled={!dirty || saving} onClick={handleSave}>
                {saving ? t("saving") : t("avatarSave")}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
