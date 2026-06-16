export function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex min-h-[50vh] w-full max-w-6xl items-center px-4 py-12"
    >
      <div className="w-full animate-pulse space-y-5">
        <div className="h-4 w-24 rounded-full bg-stone-200 dark:bg-stone-800" />
        <div className="h-10 w-2/3 rounded-2xl bg-stone-200 dark:bg-stone-800" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-40 rounded-3xl bg-stone-100 dark:bg-stone-900"
            />
          ))}
        </div>
        <span className="sr-only">正在載入展覽…</span>
      </div>
    </div>
  );
}
