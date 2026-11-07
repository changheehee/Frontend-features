import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { ComponentType, SyntheticEvent } from 'react';
import { flushSync } from 'react-dom';
import './card.css';

export type CardEntry = {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly art: string;
  readonly icon: string;
  readonly notes: string;
  readonly Content: ComponentType;
};

type CardProps = {
  readonly card: CardEntry;
};

export function Card({ card }: CardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const cardRef = useRef<HTMLButtonElement>(null);

  function openPanel() {
    changeOpenState(true);
  }

  function closePanel() {
    changeOpenState(false);
  }

  function changeOpenState(nextIsOpen: boolean) {
    runWithMorph(function applyOpenState() {
      flushSync(function updateIsOpen() {
        setIsOpen(nextIsOpen);
      });

      if (!nextIsOpen) {
        cardRef.current!.focus();
      }
    });
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
            <CardIcon icon={card.icon} />
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

function runWithMorph(applyChange: () => void) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion || !('startViewTransition' in document)) {
    applyChange();
    return;
  }

  document.startViewTransition(applyChange);
}

type CardIconProps = {
  readonly icon: string;
};

function CardIcon({ icon }: CardIconProps) {
  return (
    <span className="card-icon">
      <img src={icon} alt="" />
    </span>
  );
}

type CardPanelProps = {
  readonly card: CardEntry;
  readonly closePanel: () => void;
};

function CardPanel({ card, closePanel }: CardPanelProps) {
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
            <CardIcon icon={card.icon} />
            {card.title}
          </h2>
          <p className="card-panel-summary">{card.summary}</p>
        </header>

        <div className="card-panel-content">
          <Content />
        </div>

        <details className="card-panel-notes">
          <summary>구현 이유 · 검증</summary>
          <p>{card.notes}</p>
        </details>
      </div>
    </dialog>
  );
}
