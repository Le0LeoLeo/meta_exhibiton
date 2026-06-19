import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { BookOpen, Video, FileText, Code, Download, Clock, Search, ArrowRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { useI18n } from '../components/I18nProvider';

export default function Resources() {
  const [searchQuery, setSearchQuery] = useState('');
  const { t } = useI18n();

  const tutorials = [
    { title: t('resourceTutorial1Title'), description: t('resourceTutorial1Desc'), duration: t('minutes10'), type: t('videoTutorial'), icon: Video },
    { title: t('resourceTutorial2Title'), description: t('resourceTutorial2Desc'), duration: t('minutes25'), type: t('videoTutorial'), icon: Video },
    { title: t('resourceTutorial3Title'), description: t('resourceTutorial3Desc'), duration: t('minutes15'), type: t('videoTutorial'), icon: Video },
    { title: t('resourceTutorial4Title'), description: t('resourceTutorial4Desc'), duration: t('minutes20'), type: t('document'), icon: FileText },
  ];

  const documentation = [
    { title: t('resourceDoc1Title'), description: t('resourceDoc1Desc'), icon: Code },
    { title: t('resourceDoc2Title'), description: t('resourceDoc2Desc'), icon: BookOpen },
    { title: t('resourceDoc3Title'), description: t('resourceDoc3Desc'), icon: FileText },
    { title: t('resourceDoc4Title'), description: t('resourceDoc4Desc'), icon: BookOpen },
  ];

  const downloads = [
    { title: t('resourceDownload1Title'), description: t('resourceDownload1Desc'), size: t('resourceDownload1Size') },
    { title: t('resourceDownload2Title'), description: t('resourceDownload2Desc'), size: t('resourceDownload2Size') },
    { title: t('resourceDownload3Title'), description: t('resourceDownload3Desc'), size: t('resourceDownload3Size') },
  ];

  const blogPosts = [
    { title: t('resourceBlog1Title'), date: t('resourceBlog1Date'), category: t('resourceBlog1Category'), readTime: t('minutes8') },
    { title: t('resourceBlog2Title'), date: t('resourceBlog2Date'), category: t('resourceBlog2Category'), readTime: t('minutes6') },
    { title: t('resourceBlog3Title'), date: t('resourceBlog3Date'), category: t('resourceBlog3Category'), readTime: t('minutes10') },
    { title: t('resourceBlog4Title'), date: t('resourceBlog4Date'), category: t('resourceBlog4Category'), readTime: t('minutes12') },
  ];

  const filterItems = <T extends { title: string; description?: string }>(items: T[]) => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item) => item.title.toLowerCase().includes(q) || (item.description && item.description.toLowerCase().includes(q)));
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="border-b border-border bg-background py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div className="mx-auto max-w-3xl text-center" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <motion.p className="mb-2 text-xs font-semibold uppercase tracking-wide text-curator-brass" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              {t('resourceTabDocs')}
            </motion.p>
            <motion.h1 className="mb-6 text-4xl font-semibold text-foreground sm:text-5xl" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              {t('resourcesCenter')}
            </motion.h1>
            <motion.p className="mb-8 text-lg text-muted-foreground" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              {t('resourcesSubtitle')}
            </motion.p>
            <motion.div className="mx-auto max-w-2xl" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder={t('resourceSearchPlaceholder')} className="bg-card py-6 pl-12 text-lg text-foreground" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <div className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Tabs defaultValue="tutorials" className="w-full">
            <TabsList className="mx-auto mb-12 grid w-full max-w-3xl grid-cols-4 rounded-md border border-border bg-secondary p-1">
              <TabsTrigger value="tutorials">{t('resourceTabTutorials')}</TabsTrigger>
              <TabsTrigger value="documentation">{t('resourceTabDocs')}</TabsTrigger>
              <TabsTrigger value="downloads">{t('resourceTabDownloads')}</TabsTrigger>
              <TabsTrigger value="blog">{t('resourceTabBlog')}</TabsTrigger>
            </TabsList>

            <TabsContent value="tutorials">
              <motion.div className="mb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="mb-4 text-3xl font-semibold text-foreground">{t('resourceTutorialSectionTitle')}</h2>
                <p className="text-muted-foreground">{t('resourceTutorialSectionDesc')}</p>
              </motion.div>
              <div className="grid gap-6 md:grid-cols-2">
                <AnimatePresence>
                  {filterItems(tutorials).map((tutorial, index) => (
                    <motion.div key={tutorial.title} className="group cursor-pointer rounded-md border border-border bg-card p-6 shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition-all hover:border-curator-brass/70" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ delay: index * 0.1 }} whileHover={{ y: -3 }} onClick={() => toast.info(`${t('resourceStartLearning')}：${tutorial.title}`, { description: `${t('resourceEstDuration')} ${tutorial.duration}` })}>
                      <div className="mb-4 flex items-start">
                        <motion.div className="mr-4 rounded-md border border-border bg-secondary p-3 text-curator-brass" whileHover={{ rotate: 10 }}>
                          <tutorial.icon className="size-6" />
                        </motion.div>
                        <div className="flex-1">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="rounded border border-curator-brass/60 px-2 py-1 text-xs text-curator-brass">{tutorial.type}</span>
                            <div className="flex items-center text-sm text-muted-foreground"><Clock className="mr-1 size-4" />{tutorial.duration}</div>
                          </div>
                        </div>
                      </div>
                      <h3 className="mb-2 text-xl font-medium text-foreground transition-colors group-hover:text-curator-brass">{tutorial.title}</h3>
                      <p className="mb-4 text-muted-foreground">{tutorial.description}</p>
                      <Button variant="outline" className="w-full">{t('resourceStartLearning')}</Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {filterItems(tutorials).length === 0 && <div className="col-span-2 rounded-md border border-border bg-card p-8 text-center text-muted-foreground">{t('resourceNoResult')}「{searchQuery}」</div>}
              </div>
            </TabsContent>

            <TabsContent value="documentation">
              <motion.div className="mb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="mb-4 text-3xl font-semibold text-foreground">{t('resourceDocsTitle')}</h2>
                <p className="text-muted-foreground">{t('resourceDocsDesc')}</p>
              </motion.div>
              <div className="grid gap-6 md:grid-cols-2">
                {filterItems(documentation).map((doc, index) => (
                  <motion.div key={doc.title} className="group cursor-pointer rounded-md border border-border bg-card p-8 shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition-all hover:border-curator-brass/70" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} whileHover={{ y: -3 }} onClick={() => toast.info(`${t('resourceOpening')}：${doc.title}`, { description: t('resourceLoadingDoc') })}>
                    <motion.div className="mb-4 flex h-14 w-14 items-center justify-center rounded-md border border-border bg-secondary text-tool-blue" whileHover={{ rotate: 10 }}>
                      <doc.icon className="size-7" />
                    </motion.div>
                    <h3 className="mb-2 text-xl font-medium text-foreground transition-colors group-hover:text-curator-brass">{doc.title}</h3>
                    <p className="mb-4 text-muted-foreground">{doc.description}</p>
                    <span className="flex items-center text-sm text-tool-blue">{t('resourceReadDoc')} <ArrowRight className="ml-1 size-4" /></span>
                  </motion.div>
                ))}
                {filterItems(documentation).length === 0 && <div className="col-span-2 rounded-md border border-border bg-card p-8 text-center text-muted-foreground">{t('resourceNoResult')}「{searchQuery}」</div>}
              </div>
            </TabsContent>

            <TabsContent value="downloads">
              <motion.div className="mb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="mb-4 text-3xl font-semibold text-foreground">{t('resourceDownloadsTitle')}</h2>
                <p className="text-muted-foreground">{t('resourceDownloadsDesc')}</p>
              </motion.div>
              <div className="grid gap-6 md:grid-cols-3">
                {filterItems(downloads).map((download, index) => (
                  <motion.div key={download.title} className="rounded-md border border-border bg-card p-8 shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition-colors hover:border-curator-brass/70" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} whileHover={{ y: -5 }}>
                    <motion.div className="mb-4 flex h-14 w-14 items-center justify-center rounded-md border border-border bg-secondary text-curator-brass" whileHover={{ rotate: 10 }}>
                      <Download className="size-7" />
                    </motion.div>
                    <h3 className="mb-2 text-xl font-medium text-foreground">{download.title}</h3>
                    <p className="mb-4 text-muted-foreground">{download.description}</p>
                    <div className="mb-4 text-sm text-curator-brass">{download.size}</div>
                    <Button className="w-full bg-primary text-primary-foreground hover:bg-curator-brass" onClick={() => toast.success(`${t('resourceDownloading')}：${download.title}`, { description: t('resourceDownloadSoon'), duration: 3000 })}>
                      <Download className="mr-2 size-4" />{t('resourceDownload')}
                    </Button>
                  </motion.div>
                ))}
                {filterItems(downloads).length === 0 && <div className="col-span-3 rounded-md border border-border bg-card p-8 text-center text-muted-foreground">{t('resourceNoResult')}「{searchQuery}」</div>}
              </div>
            </TabsContent>

            <TabsContent value="blog">
              <motion.div className="mb-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="mb-4 text-3xl font-semibold text-foreground">{t('resourceBlogTitle')}</h2>
                <p className="text-muted-foreground">{t('resourceBlogDesc')}</p>
              </motion.div>
              <div className="space-y-6">
                {filterItems(blogPosts.map((p) => ({ ...p, description: p.category }))).map((post, index) => (
                  <motion.div key={post.title} className="group cursor-pointer rounded-md border border-border bg-card p-6 shadow-[0_18px_45px_-38px_rgba(28,28,26,0.45)] transition-all hover:border-curator-brass/70" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} whileHover={{ x: 5 }} onClick={() => toast.info(`${t('resourceOpenArticle')}：${post.title}`, { description: `${t('resourceReadTime')} ${post.readTime}` })}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-3">
                          <span className="rounded border border-curator-brass/60 px-3 py-1 text-xs text-curator-brass">{post.category}</span>
                          <span className="text-sm text-muted-foreground">{post.date}</span>
                          <div className="flex items-center text-sm text-muted-foreground"><Clock className="mr-1 size-4" />{post.readTime}</div>
                        </div>
                        <h3 className="mb-2 text-xl font-medium text-foreground transition-colors group-hover:text-curator-brass">{post.title}</h3>
                      </div>
                      <Button variant="ghost" className="flex-shrink-0 text-tool-blue">{t('resourceRead')} <ArrowRight className="ml-1 size-4" /></Button>
                    </div>
                  </motion.div>
                ))}
                {filterItems(blogPosts.map((p) => ({ ...p, description: p.category }))).length === 0 && <div className="rounded-md border border-border bg-card p-8 text-center text-muted-foreground">{t('resourceNoResult')}「{searchQuery}」</div>}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <motion.div className="border-t border-border bg-secondary py-16 text-foreground" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <motion.h2 className="mb-4 text-3xl font-semibold" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>{t('resourceNeedMore')}</motion.h2>
          <motion.p className="mb-8 text-lg text-muted-foreground" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>{t('resourceContactSupport')}</motion.p>
          <motion.div className="inline-block" whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
            <Link to="/support"><Button className="bg-primary px-8 py-6 text-lg text-primary-foreground hover:bg-curator-brass">{t('resourceContactSupportBtn')}</Button></Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
