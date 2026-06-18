import { Hero } from '../components/Hero';
import { Features } from '../components/Features';
import { Stats } from '../components/Stats';
import { Showcase } from '../components/Showcase';
import { Testimonials } from '../components/Testimonials';
import { InfoBanner } from '../components/InfoBanner';

export default function Home() {
  return (
    <div className="bg-background text-foreground transition-colors duration-300">
      <Hero />
      <Features />
      <Stats />
      <Showcase />
      <Testimonials />
      <InfoBanner />
    </div>
  );
}
