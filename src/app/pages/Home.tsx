import { Hero } from '../components/Hero';
import { Features } from '../components/Features';
import { Stats } from '../components/Stats';
import { Showcase } from '../components/Showcase';
import { Testimonials } from '../components/Testimonials';
import { InfoBanner } from '../components/InfoBanner';

export default function Home() {
  return (
    <div className="bg-gradient-to-b from-purple-50 to-white">
      <Hero />
      <Features />
      <Stats />
      <Showcase />
      <Testimonials />
      <InfoBanner />
    </div>
  );
}
