import { Hero } from '../components/Hero';
import { Features } from '../components/Features';
import { Showcase } from '../components/Showcase';
import { InfoBanner } from '../components/InfoBanner';

export default function Home() {
  return (
    <div className="bg-background text-foreground transition-colors duration-300">
      <Hero />
      <Features />
      <Showcase />
      <InfoBanner />
    </div>
  );
}
