import { Component, type ReactElement, type ReactNode } from "react";
import { clearPortfolio } from "../learning/portfolio/repository";
import { portfolioStorageKey, type StoragePort } from "../learning/portfolio/schema";
import { downloadPortfolioJson } from "./portfolio/download";

type RootErrorBoundaryProps = Readonly<{
  children: ReactNode;
  /** Undefined in demo mode: the demo keeps its own records, so nothing here touches them. */
  storage: StoragePort | undefined;
  confirmClear?: () => boolean;
  reload?: () => void;
}>;

/** Last resort when the app cannot render at all: saved data stays untouched unless the learner clears it. */
export class RootErrorBoundary extends Component<RootErrorBoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  readonly downloadStored = (): void => {
    const raw = readStored(this.props.storage);
    if (raw !== null) downloadPortfolioJson(raw);
  };

  readonly clearAndReload = (): void => {
    const confirmClear = this.props.confirmClear
      ?? (() => window.confirm("Clear all locally saved learning work in this browser? This cannot be undone."));
    if (!confirmClear()) return;
    clearPortfolio(this.props.storage);
    (this.props.reload ?? (() => window.location.reload()))();
  };

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return <RootErrorScreen
      canDownload={readStored(this.props.storage) !== null}
      canClear={this.props.storage !== undefined}
      onDownload={this.downloadStored}
      onClear={this.clearAndReload}
    />;
  }
}

function RootErrorScreen(props: Readonly<{
  canDownload: boolean;
  canClear: boolean;
  onDownload: () => void;
  onClear: () => void;
}>): ReactElement {
  return <main className="mm-inquiry" role="alert">
    <h1>Musica Mathematica could not start</h1>
    <p>Your saved learning data has not been changed. You can download it, or clear local work and start again.</p>
    {props.canDownload ? <button className="mm-primary-action" type="button" onClick={props.onDownload}>Download saved data</button> : null}
    {props.canClear ? <button type="button" onClick={props.onClear}>Clear local work and reload</button> : null}
  </main>;
}

function readStored(storage: StoragePort | undefined): string | null {
  try {
    return storage?.getItem(portfolioStorageKey) ?? null;
  } catch {
    return null;
  }
}
