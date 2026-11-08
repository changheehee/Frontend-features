import { Suspense, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ComponentType, SyntheticEvent } from 'react';
import { flushSync } from 'react-dom';
import './card.css';
import { FlowDiagram } from './FlowDiagram.tsx';
import type { DataFlow } from './FlowDiagram.tsx';

export type CardEntry = {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly art: string;
  readonly icon: string;
  readonly tone: string;
  readonly notes: readonly string[];
  readonly flow: DataFlow;
  readonly Content: ComponentType;
};

type CardProps = {
  readonly card: CardEntry;
};

export function Card({ card }: CardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const cardRef = useRef<HTMLButtonElement>(null);

  function openPanel() {
    const cardElement = cardRef.current!;
    cardElement.style.viewTransitionName = 'active-card';

    runWithMorph(function showPanel() {
      cardElement.style.viewTransitionName = 'none';
      flushSync(function markOpen() {
        setIsOpen(true);
      });
    });
  }

  async function closePanel() {
    const cardElement = cardRef.current!;

    await runWithMorph(function showCard() {
      flushSync(function markClosed() {
        setIsOpen(false);
      });
      cardElement.style.viewTransitionName = 'active-card';
      cardElement.focus();
    });

    cardElement.style.viewTransitionName = 'none';
  }

  return (
    <>
      <button
        ref={cardRef}
        className="card"
        type="button"
        aria-label={`${card.title} 카드 열기`}
        aria-haspopup="dialog"
        data-open={isOpen}
        onClick={openPanel}
      >
        <img className="card-art" src={card.art} alt="" width="900" height="540" />
        <span className="card-body">
          <span className="card-head">
            <CardIcon icon={card.icon} tone={card.tone} />
            <span className="card-title">{card.title}</span>
          </span>
          <span className="card-detail">
            <span className="card-summary">{card.summary}</span>
            <span className="card-open" aria-hidden="true"> 열기 → </span>
          </span>
        </span>
      </button>

      {isOpen && <CardPanel card={card} closePanel={closePanel} />}
    </>
  );
}

async function runWithMorph(applyChange: () => void) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion || !('startViewTransition' in document)) {
    applyChange();
    return;
  }

  await document.startViewTransition(applyChange).finished;
}

type CardIconProps = {
  readonly icon: string;
  readonly tone: string;
};

function CardIcon({ icon, tone }: CardIconProps) {
  return (
    <span className="card-icon" style={{ backgroundColor: tone }}>
      <img src={icon} alt="" />
    </span>
  );
}

type CardPanelProps = {
  readonly card: CardEntry;
  readonly closePanel: () => void;
};

function CardPanel({ card, closePanel }: CardPanelProps) {
  const [isShowingFlow, setIsShowingFlow] = useState(false);
  const panelRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const { Content } = card;

  useLayoutEffect(function showAsModal() {
    const panel = panelRef.current!;

    panel.showModal();
    titleRef.current!.focus();

    return function hideModal() {
      panel.close();
    };
  }, []);

  function closeWithMorph(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    closePanel();
  }

  function toggleFlow() {
    setIsShowingFlow(!isShowingFlow);
  }

  return (
    <dialog
      ref={panelRef}
      className="card-panel"
      aria-labelledby={titleId}
      closedby="any"
      onCancel={closeWithMorph}
    >
      <div className="card-panel-layout">
        <button
          className="card-panel-close"
          type="button"
          aria-label="카드로 돌아가기"
          onClick={closePanel}
        >
          ✕
        </button>

        <header className="card-panel-header">
          <h2 ref={titleRef} className="card-panel-title" id={titleId} tabIndex={-1}>
            <CardIcon icon={card.icon} tone={card.tone} />
            {card.title}
          </h2>
          <button
            className="card-panel-flow"
            type="button"
            aria-pressed={isShowingFlow}
            onClick={toggleFlow}
          >
            <svg className="card-panel-flow-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 8h14m-4-4 4 4-4 4M20 16H6m4-4-4 4 4 4" />
            </svg>
            요청·응답
          </button>
          <p className="card-panel-summary">{card.summary}</p>
        </header>

        <div className="card-panel-content">
          <div className="card-panel-demo" hidden={isShowingFlow}>
            <Suspense fallback={<p className="card-panel-loading">불러오는 중…</p>}>
              <Content />
            </Suspense>
          </div>
          {isShowingFlow && <FlowDiagram flow={card.flow} />}
        </div>

        <details className="card-panel-notes">
          <summary>구현 이유 · 검증</summary>
          <ul className="card-panel-notes-list">
            {card.notes.map(function renderNote(note) {
              return <li key={note}>{note}</li>;
            })}
          </ul>
        </details>
      </div>
    </dialog>
  );
}
