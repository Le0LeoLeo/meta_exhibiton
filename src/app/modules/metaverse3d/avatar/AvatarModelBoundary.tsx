import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";

export type AvatarModelBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
  resetKey: unknown;
  onError?: (error: Error, info: ErrorInfo) => void;
};

type AvatarModelBoundaryState = {
  error: Error | null;
};

export class AvatarModelBoundary extends Component<
  AvatarModelBoundaryProps,
  AvatarModelBoundaryState
> {
  state: AvatarModelBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AvatarModelBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  componentDidUpdate(previousProps: AvatarModelBoundaryProps) {
    if (
      this.state.error &&
      !Object.is(previousProps.resetKey, this.props.resetKey)
    ) {
      this.setState({ error: null });
    }
  }

  render() {
    return this.state.error ? this.props.fallback : this.props.children;
  }
}
