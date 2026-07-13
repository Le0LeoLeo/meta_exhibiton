import { Component, type ErrorInfo, type ReactNode } from "react";
import { WebGLRecoveryOverlay } from "./WebGLRecoveryOverlay";

type Props = {
  children: ReactNode;
  onReload: () => void;
};

type State = {
  hasError: boolean;
};

export class WebGLCanvasBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[WebGLCanvasBoundary] canvas failed", error, errorInfo);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  handleReload = () => {
    this.setState({ hasError: false });
    this.props.onReload();
  };

  render() {
    if (this.state.hasError) {
      return <WebGLRecoveryOverlay onReload={this.handleReload} />;
    }
    return this.props.children;
  }
}
