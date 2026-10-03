import type { GalleryAtmosphere } from '../constants/gallerySceneTemplates';
import { useI18n } from './I18nProvider';

const atmospheres: { value: GalleryAtmosphere; label: string; color: string }[] = [
  { value: 'bright', label: 'vgAtmosphereBright', color: '#e9e4d9' },
  { value: 'spotlight', label: 'vgAtmosphereSpotlight', color: '#183d3f' },
  { value: 'warm', label: 'vgAtmosphereWarm', color: '#694334' },
];

export function GalleryAtmosphereSelector({ value, onChange, disabled = false }: {
  value: GalleryAtmosphere;
  onChange: (value: GalleryAtmosphere) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return <fieldset className="space-y-2" disabled={disabled}>
    <legend className="mb-2 text-sm font-medium text-foreground">{t('vgAtmosphere')}</legend>
    <div className="grid grid-cols-3 gap-2">
      {atmospheres.map((atmosphere) => <button
        key={atmosphere.value}
        type="button"
        aria-pressed={value === atmosphere.value}
        onClick={() => onChange(atmosphere.value)}
        className={`flex min-h-12 flex-wrap items-center justify-center gap-2 rounded-md border px-2 py-3 text-xs font-medium transition disabled:opacity-50 ${value === atmosphere.value ? 'border-curator-brass bg-secondary text-foreground ring-1 ring-curator-brass' : 'border-border bg-card text-muted-foreground hover:text-foreground'}`}
      >
        <span aria-hidden="true" className="size-4 shrink-0 rounded-full border border-foreground/20" style={{ backgroundColor: atmosphere.color }} />
        {t(atmosphere.label)}
      </button>)}
    </div>
  </fieldset>;
}
