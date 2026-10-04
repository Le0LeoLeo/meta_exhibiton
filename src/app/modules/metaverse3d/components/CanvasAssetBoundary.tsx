import { Component, type ErrorInfo, type ReactNode } from "react";

interface CanvasAssetBoundaryProps {
  fallback: ReactNode;
  resetKey?: string;
  children: ReactNode;
}

interface CanvasAssetBoundaryState {
  hasError: boolean;
}

export class CanvasAssetBoundary extends Component<CanvasAssetBoundaryProps, CanvasAssetBoundaryState> {
  state: CanvasAssetBoundaryState = { hasError: false };

  static getDerivedStateFromError(): CanvasAssetBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.warn("3D asset failed to load", error, info.componentStack);
    }
  }

  componentDidUpdate(prevProps: CanvasAssetBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
