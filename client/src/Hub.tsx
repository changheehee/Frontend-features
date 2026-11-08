import { CARD_LIST } from './cards/cardList.ts';
import { Card } from './cards/frame/Card.tsx';
import './hub.css';

export function Hub() {
  return (
    <main className="hub">
      <h1 className="hub-title">기능 모음</h1>
      <div className="hub-cards">
        {CARD_LIST.map(function renderCard(card) {
          return <Card key={card.id} card={card} />;
        })}
      </div>
    </main>
  );
}
