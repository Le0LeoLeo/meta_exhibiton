import { Monitor } from "lucide-react";
import { Link } from "react-router";
import { Button } from "./ui/button";
import { useI18n } from "./I18nProvider";

export function DesktopEditorNotice({ viewHref, onView }: { viewHref?: string; onView?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-5 py-10 text-foreground">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <Monitor className="mx-auto mb-4 size-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold">{t("mobileEditorDesktopRequired")}</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{t("mobileEditorReadOnlyDescription")}</p>
        <div className="mt-6 flex flex-col gap-3">
          {!onView && !viewHref && <Button asChild className="min-h-11"><Link to="/virtual-gallery/quick-create">{t("quickExhibitionCreateAction")}</Link></Button>}
          {onView && <Button className="min-h-11" onClick={onView}>{t("mobileEditorViewOnly")}</Button>}
          {!onView && viewHref && <Button asChild className="min-h-11"><Link to={viewHref}>{t("mobileEditorViewOnly")}</Link></Button>}
          <Button asChild variant="outline" className="min-h-11"><Link to="/exhibitions">{t("viewBackToExhibitions")}</Link></Button>
        </div>
      </section>
    </div>
  );
}
