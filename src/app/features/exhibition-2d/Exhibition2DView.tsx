import { Film, Image as ImageIcon } from 'lucide-react';
import type { Scene2DExhibit } from './sceneToExhibits';

interface Exhibition2DViewProps {
  title: string;
  description?: string | null;
  exhibits: Scene2DExhibit[];
}

function ExhibitMedia({ exhibit }: { exhibit: Scene2DExhibit }) {
  const image = exhibit.thumbnailUrl;
  const imageElement = image ? (
    <img
      src={image}
      alt={exhibit.kind === 'video' ? `${exhibit.title}的影片縮圖` : exhibit.accessibleText}
      loading="lazy"
      decoding="async"
      className="h-full w-full object-contain"
    />
  ) : (
    <div className="flex h-full items-center justify-center text-stone-500" aria-hidden="true">
      {exhibit.kind === 'video' ? <Film className="size-10" /> : <ImageIcon className="size-10" />}
    </div>
  );

  if (exhibit.kind === 'video' && exhibit.mediaUrl) {
    return (
      <a
        href={exhibit.mediaUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`播放《${exhibit.title}》影片（在新分頁開啟）`}
        className="group relative block aspect-[4/3] overflow-hidden rounded-2xl bg-stone-100 outline-none ring-violet-500 focus-visible:ring-4 dark:bg-stone-800"
      >
        {imageElement}
        <span className="absolute bottom-3 left-3 inline-flex min-h-11 items-center rounded-full bg-stone-950/85 px-4 text-sm font-medium text-white group-hover:bg-violet-700">
          <Film className="mr-2 size-4" aria-hidden="true" />播放影片
        </span>
      </a>
    );
  }

  return (
    <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-stone-100 dark:bg-stone-800">
      {imageElement}
    </div>
  );
}

export function Exhibition2DView({ title, description, exhibits }: Exhibition2DViewProps) {
  return (
    <main className="min-h-[calc(100vh-64px)] bg-stone-50 px-4 py-20 text-stone-950 dark:bg-stone-950 dark:text-white">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-3xl">
          <p className="text-sm font-semibold tracking-widest text-violet-700 dark:text-violet-300">2D 圖文展覽</p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-5xl">{title}</h1>
          {description && <p className="mt-5 text-base leading-7 text-stone-600 dark:text-stone-300">{description}</p>}
        </header>

        {exhibits.length ? (
          <ol aria-label="展品清單" className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {exhibits.map((exhibit) => (
              <li key={exhibit.id}>
                <article aria-labelledby={`exhibit-title-${exhibit.id}`} className="h-full rounded-3xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900">
                  {exhibit.kind !== 'text' && <ExhibitMedia exhibit={exhibit} />}
                  <div className={exhibit.kind === 'text' ? 'p-2' : 'px-1 pb-2 pt-5'}>
                    <h2 id={`exhibit-title-${exhibit.id}`} className="text-xl font-semibold">{exhibit.title}</h2>
                    {exhibit.artist && <p className="mt-2 text-sm font-medium text-violet-700 dark:text-violet-300">作者：{exhibit.artist}</p>}
                    {exhibit.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-600 dark:text-stone-300">{exhibit.description}</p>}
                  </div>
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <p role="status" className="mt-12 rounded-2xl border border-stone-200 bg-white p-8 text-stone-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
            此展覽目前沒有可在 2D 模式顯示的作品。
          </p>
        )}
      </div>
    </main>
  );
}
