import type { ReactNode } from 'react';
import './controlPanel.css';

type ControlPanelProps = {
  readonly summary: string;
  readonly children: ReactNode;
};

export function ControlPanel({ summary, children }: ControlPanelProps) {
  return (
    <details className="control-panel">
      <summary className="control-panel-toggle">
        <svg className="control-panel-chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path d="m6 3.5 4.5 4.5L6 12.5" />
        </svg>
        <span className="control-panel-title">조절</span>
        <span className="control-panel-summary">{summary}</span>
      </summary>
      <div className="control-panel-body">{children}</div>
    </details>
  );
}
