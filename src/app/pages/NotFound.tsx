import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { FloatingCube, GridPattern, GradientOrb } from '../components/Geo3D';
import { useI18n } from '../components/I18nProvider';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-white dark:bg-stone-950 px-6 relative overflow-hidden">
      <GridPattern />
      <GradientOrb className="w-56 h-56 bg-rose-100/40 dark:bg-rose-900/15 top-8 right-[15%]" />
      <FloatingCube className="top-16 right-[20%] hidden md:block" size={40} delay={0.3} />

      <motion.div
        className="text-center max-w-sm relative"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-6xl font-semibold bg-gradient-to-r from-rose-300 via-violet-300 to-sky-300 bg-clip-text text-transparent mb-4">404</p>
        <h2 className="text-xl text-stone-800 dark:text-white mb-2">{t('notFoundHeading')}</h2>
        <p className="text-sm text-stone-400 dark:text-stone-500 mb-8">{t('notFoundDesc')}</p>
        <Link to="/">
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button className="bg-gradient-to-r from-violet-500 to-sky-500 hover:from-violet-600 hover:to-sky-600 text-white px-6 py-2.5 rounded-lg shadow-lg shadow-violet-500/15 inline-flex items-center gap-2">
              <ArrowLeft className="size-4" />
              {t('notFoundHome')}
            </Button>
          </motion.div>
        </Link>
      </motion.div>
    </div>
  );
}
