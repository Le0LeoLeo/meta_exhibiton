// The logo renders at most 160px wide; the 480px files stay sharp at 3x density and weigh ~10 KB
// each instead of ~80 KB for the 800px masters (both variants load because the theme is a class).
export function BrandLogo() {
  return <span className="paidea-logo inline-block shrink-0">
    <img src="/brand/paidea-logo-v1-480.png" alt="Paidea" width={480} height={140} className="block h-auto w-full dark:hidden" />
    <img src="/brand/paidea-logo-dark-v1-480.png" alt="Paidea" width={480} height={140} className="hidden h-auto w-full dark:block" />
  </span>;
}
