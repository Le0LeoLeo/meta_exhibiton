export function BrandLogo() {
  return <span className="paidea-logo inline-block shrink-0">
    <img src="/brand/paidea-logo-v1.png" alt="Paidea" width={800} height={233} className="block h-auto w-full dark:hidden" />
    <img src="/brand/paidea-logo-dark-v1.png" alt="Paidea" width={800} height={233} className="hidden h-auto w-full dark:block" />
  </span>;
}
