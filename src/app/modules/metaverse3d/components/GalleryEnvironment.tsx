import { Component, Suspense, type ReactNode } from 'react';
import { Environment } from '@react-three/drei';

// A remote lighting enhancement must never suspend or remove the gallery.
class EnvironmentBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export function GalleryEnvironment({ brightness }: { brightness: number }) {
  return (
    <EnvironmentBoundary>
      <Suspense fallback={null}>
        <Environment preset="warehouse" background={false} environmentIntensity={0.45 * Math.max(0.2, brightness)} blur={0.1} />
      </Suspense>
    </EnvironmentBoundary>
  );
}
