import { useId } from 'react';
import { CARD_LIST } from './cards/cardList.ts';
import { Card } from './cards/frame/Card.tsx';
import './hub.css';

export function Hub() {
  const packetTipId = useId();

  return (
    <main className="hub">
      <div className="hub-heading">
        <h1 className="hub-title">기능 모음</h1>
        <button className="hub-info" type="button" popoverTarget={packetTipId} aria-label="서버 패킷 보는 방법">
          !
        </button>
        <p id={packetTipId} className="hub-info-tip" popover="auto">
          F12를 누르고 Console을 열면 각 카드가 서버와 주고받는 요청·응답 패킷을 볼 수 있습니다.
        </p>
      </div>
      <div className="hub-cards">
        {CARD_LIST.map(function renderCard(card) {
          return <Card key={card.id} card={card} />;
        })}
      </div>
    </main>
  );
}
