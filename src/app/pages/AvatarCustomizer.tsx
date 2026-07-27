import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AvatarColorPalette } from "@/app/components/avatar/AvatarColorPalette";
import { AvatarOptionGrid } from "@/app/components/avatar/AvatarOptionGrid";
import { AvatarPreviewCanvas } from "@/app/components/avatar/AvatarPreviewCanvas";
import { randomizeAvatar } from "@/app/components/avatar/randomizeAvatar";
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
import {
  DEFAULT_AVATAR_APPEARANCE,
  normalizeAvatarAppearance,
  type AvatarAppearanceV1,
} from "@/app/modules/metaverse3d/avatar/avatarAppearance";
import { AVATAR_MANIFEST } from "@/app/modules/metaverse3d/avatar/avatarManifest";
import { useAvatarPreferenceStore } from "@/app/modules/metaverse3d/avatar/avatarPreferenceStore";
import { emitPlayerAppearance } from "@/app/modules/metaverse3d/network/socketClient";

type PartKey = "body" | "head" | "hair" | "top" | "bottom" | "shoes" | "accessory";
type ColorKey = keyof AvatarAppearanceV1["colors"];

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
  const { t } = useI18n();
  const appearance = useAvatarPreferenceStore((state) => state.appearance);
  const dirty = useAvatarPreferenceStore((state) => state.dirty);
  const setAppearance = useAvatarPreferenceStore((state) => state.setAppearance);
  const hydrateGuest = useAvatarPreferenceStore((state) => state.hydrateGuest);
  const hydrateAccount = useAvatarPreferenceStore((state) => state.hydrateAccount);
  const markSaved = useAvatarPreferenceStore((state) => state.markSaved);
  const savedAppearanceRef = useRef<AvatarAppearanceV1>(
    normalizeAvatarAppearance(DEFAULT_AVATAR_APPEARANCE),
  );
  const [saving, setSaving] = useState(false);
  const [hydrating, setHydrating] = useState(true);

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

  const updatePart = (key: PartKey, value: string) => {
    setAppearance({ ...appearance, [key]: value } as AvatarAppearanceV1);
  };

  const updateColor = (key: ColorKey, value: string) => {
    setAppearance({
      ...appearance,
      colors: { ...appearance.colors, [key]: value },
    } as AvatarAppearanceV1);
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
      toast.success(t("avatarSaved"));
    } catch (error) {
      toast.error(t("avatarSaveFailed"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const partTabs: Array<{ key: PartKey; label: string }> = [
    { key: "body", label: t("avatarCategoryBody") },
    { key: "head", label: t("avatarCategoryHead") },
    { key: "hair", label: t("avatarCategoryHair") },
    { key: "top", label: t("avatarCategoryTop") },
    { key: "bottom", label: t("avatarCategoryBottom") },
    { key: "shoes", label: t("avatarCategoryShoes") },
    { key: "accessory", label: t("avatarCategoryAccessory") },
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
          <section className="h-[42vh] min-h-80 min-w-0 lg:sticky lg:top-6 lg:h-[calc(100vh-9rem)]">
            <AvatarPreviewCanvas
              appearance={appearance}
              unavailableLabel={t("avatarPreviewUnavailable")}
            />
          </section>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
            {hydrating ? (
              <div className="py-20 text-center text-sm text-muted-foreground">
                {t("loading")}
              </div>
            ) : (
              <Tabs defaultValue="body">
                <TabsList className="h-auto w-full max-w-full justify-start overflow-x-auto p-1">
                  {partTabs.map((tab) => (
                    <TabsTrigger key={tab.key} value={tab.key} className="min-h-11">
                      {tab.label}
                    </TabsTrigger>
                  ))}
                  <TabsTrigger value="colors" className="min-h-11">
                    {t("avatarCategoryColors")}
                  </TabsTrigger>
                </TabsList>

                {partTabs.map((tab) => (
                  <TabsContent key={tab.key} value={tab.key} className="pt-4">
                    <AvatarOptionGrid
                      label={tab.label}
                      options={optionList(AVATAR_MANIFEST.nodes[tab.key], tab.label)}
                      value={appearance[tab.key]}
                      onValueChange={(value) => updatePart(tab.key, value)}
                    />
                  </TabsContent>
                ))}

                <TabsContent value="colors" className="space-y-6 pt-4">
                  {(Object.keys(AVATAR_MANIFEST.colors) as ColorKey[]).map((key) => (
                    <div key={key}>
                      <h2 className="mb-3 text-sm font-semibold capitalize">{key}</h2>
                      <AvatarColorPalette
                        label={key}
                        options={colorList(AVATAR_MANIFEST.colors[key])}
                        value={appearance.colors[key]}
                        onValueChange={(value) => updateColor(key, value)}
                      />
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            )}

            <div className="sticky bottom-0 mt-8 flex flex-wrap gap-3 border-t border-border bg-card pt-4 pb-[max(0px,env(safe-area-inset-bottom))]">
              <Button variant="outline" onClick={() => setAppearance(randomizeAvatar())}>
                {t("avatarRandomize")}
              </Button>
              <Button
                variant="outline"
                onClick={() => setAppearance(DEFAULT_AVATAR_APPEARANCE)}
              >
                {t("avatarReset")}
              </Button>
              <div className="flex-1" />
              <Button
                variant="ghost"
                disabled={!dirty}
                onClick={() => {
                  setAppearance(savedAppearanceRef.current);
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
