import { Hero } from '../components/Hero';
import { Features } from '../components/Features';
import { Showcase } from '../components/Showcase';
import { Testimonials } from '../components/Testimonials';
import { InfoBanner } from '../components/InfoBanner';
import { RecentSouvenirs } from '../components/RecentSouvenirs';

export default function Home() {
  return (
    <div className="bg-background text-foreground transition-colors duration-300">
      <Hero />
      <Features />
      <Showcase />
      <RecentSouvenirs />
      <Testimonials />
      <InfoBanner />
    </div>
  );
}
