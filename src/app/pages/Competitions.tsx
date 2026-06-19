import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, Loader2, Users, Clock, Vote, Lock } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { getCompetitions, type Competition } from '../api/client';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { useI18n } from '../components/I18nProvider';

export default function Competitions() {
  const [items, setItems] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getCompetitions();
        setItems(result.competitions);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('loadCompetitionsFailed'));
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [t]);

  const stats = useMemo(() => {
    const open = items.filter((item) => item.status === 'open').length;
    const publicCount = items.filter((item) => item.isPublic).length;
    return [
      { label: t('publicCompetitions'), value: publicCount, icon: Trophy },
      { label: t('registering'), value: open, icon: Users },
      { label: t('totalRounds'), value: items.length, icon: Vote },
    ];
  }, [items, t]);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-600 py-20 text-white dark:from-violet-950 dark:via-fuchsia-950 dark:to-indigo-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1 text-sm">
              <Trophy className="size-4" /> {t('competitionHub')}
            </p>
            <h1 className="text-5xl tracking-tight">{t('competitionTitle')}</h1>
            <p className="mt-4 text-lg text-violet-100">{t('competitionSubtitle')}</p>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-violet-50 p-3 text-violet-700"><stat.icon className="size-5" /></div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-stone-400">{stat.label}</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-white">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl text-slate-900 dark:text-white">{t('publicCompetitionList')}</h2>
            <p className="mt-2 text-slate-600 dark:text-stone-400">{t('competitionListDesc')}</p>
          </div>
          <Link to="/virtual-gallery/my-exhibitions">
            <Button>{t('hostCompetition')}</Button>
          </Link>
        </div>

        {loading ? (
          <div className="mt-8 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">
            <Loader2 className="size-4 animate-spin" /> {t('loadingCompetitions')}
          </div>
        ) : error ? (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-8 text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">{error}</div>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400">{t('noPublicCompetitions')}</div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {items.map((item, index) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.06 }} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900">
                <div className="h-56 bg-slate-100 dark:bg-stone-800">
                  <ImageWithFallback src={item.coverImage || 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&q=80'} alt={item.title} className="h-full w-full object-cover" />
                </div>
                <div className="p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">{t(`competitionStatus_${item.status}`)}</span>
                    {!item.isPublic ? <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-stone-800 dark:text-stone-300"><Lock className="size-3" /> {t('private')}</span> : null}
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                  <p className="mt-2 line-clamp-2 text-slate-600 dark:text-stone-400">{item.description}</p>
                  <div className="mt-4 space-y-2 text-sm text-slate-500 dark:text-stone-400">
                    <p className="flex items-center gap-2"><Clock className="size-4" /> {t('registrationDeadline')}：{new Date(item.registrationDeadline).toLocaleString('zh-Hant')}</p>
                    <p className="flex items-center gap-2"><Vote className="size-4" /> {t('votingDeadline')}：{item.votingDeadline ? new Date(item.votingDeadline).toLocaleString('zh-Hant') : t('notSet')}</p>
                  </div>
                  <div className="mt-6">
                    <Link to={`/competitions/${encodeURIComponent(item.id)}`}>
                      <Button className="w-full">{t('viewWorks')}</Button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
