import { useId, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, UIEvent } from 'react';
import type { ServerOptions } from '../network/serverOptions.ts';
import { ChatBubble } from './ChatBubble.tsx';
import type { ChatUser, Connection } from './chatState.ts';
import { useChat } from './useChat.ts';
import { useStickToLatest } from './useStickToLatest.ts';

type ChatPhoneProps = {
  readonly user: ChatUser;
  readonly partner: ChatUser;
  readonly serverOptions: ServerOptions;
};

const USER_NAMES: Readonly<Record<ChatUser, string>> = { user1: '사용자 1', user2: '사용자 2' };

export function ChatPhone({ user, partner, serverOptions }: ChatPhoneProps) {
  const chat = useChat(user, serverOptions);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const latestMessage = chat.messages.at(-1);
  const stickToLatest = useStickToLatest(
    listRef,
    latestMessage === undefined ? null : latestMessage.key,
    latestMessage !== undefined && latestMessage.from === partner,
  );

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    stickToLatest.followScroll(event.currentTarget);
  }

  function updateDraft(event: ChangeEvent<HTMLInputElement>) {
    setDraft(event.currentTarget.value);

    if (event.currentTarget.value.trim() !== '') {
      chat.signalTyping();
    }
  }

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();

    if (text === '') {
      return;
    }

    chat.sendText(text);
    setDraft('');
    stickToLatest.jumpToLatest();
  }

  return (
    <section className="chat-phone-area" aria-label={`${USER_NAMES[user]}의 화면`}>
      <p className="chat-phone-caption" aria-hidden="true">
        {USER_NAMES[user]}의 화면
      </p>
      <div className="chat-phone">
        <header className="chat-phone-header">
          <span className="chat-avatar" data-user={partner} aria-hidden="true">
            {USER_NAMES[partner].slice(-1)}
          </span>
          <div className="chat-phone-who">
            <h3 className="chat-phone-name">{USER_NAMES[partner]}</h3>
            <p className="chat-phone-status" data-connection={chat.connection}>
              {describeStatus(chat.connection, chat.isPartnerTyping)}
            </p>
          </div>
          <button className="chat-phone-network" type="button" aria-pressed={!chat.isOnline} onClick={chat.toggleOnline}>
            <svg className="chat-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0" />
              <path d="M12 19h.01" />
            </svg>
            연결 끊기
          </button>
        </header>

        <div className="chat-phone-product">
          <img className="chat-product-photo" src="/api/posts/photos/camping-chair.jpg" alt="" width={400} height={400} />
          <div className="chat-product-text">
            <p className="chat-product-title">캠핑 의자 2개 일괄</p>
            <p className="chat-product-price">30,000원</p>
          </div>
        </div>

        {!chat.isOnline && (
          <p className="chat-phone-offline">연결이 끊겼습니다. 보낸 메시지는 다시 연결되면 순서대로 전송됩니다.</p>
        )}

        <div className="chat-phone-body">
          <div
            ref={listRef}
            className="chat-phone-messages"
            role="log"
            aria-label={`${USER_NAMES[partner]}와 나눈 대화`}
            onScroll={handleScroll}
          >
            <p className="chat-day">오늘</p>
            <ol className="chat-message-list">
              {chat.messages.map(function renderMessage(message, index) {
                const previousMessage = chat.messages[index - 1];

                return (
                  <ChatBubble
                    key={message.key}
                    message={message}
                    isMine={message.from === user}
                    isFirstOfGroup={previousMessage === undefined || previousMessage.from !== message.from}
                    isRead={message.id !== null && message.id <= chat.partnerReadUpToId}
                    isOnline={chat.isOnline}
                    retryMessage={chat.retryMessage}
                  />
                );
              })}
            </ol>
          </div>
          {stickToLatest.hasUnseenMessage && (
            <button className="chat-new-below" type="button" onClick={stickToLatest.jumpToLatest}>
              새 메시지 ↓
            </button>
          )}
        </div>

        <form className="chat-composer" onSubmit={submitMessage}>
          <label className="chat-hidden" htmlFor={inputId}>
            {USER_NAMES[partner]}에게 보낼 메시지
          </label>
          <input
            id={inputId}
            className="chat-input"
            value={draft}
            placeholder="메시지 보내기"
            autoComplete="off"
            onChange={updateDraft}
          />
          <button className="chat-send" type="submit" disabled={draft.trim() === ''}>
            <svg className="chat-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12 20 4l-4 16-4-7-8-1z" />
              <path d="m12 13 8-9" />
            </svg>
            <span className="chat-hidden">보내기</span>
          </button>
        </form>
      </div>
    </section>
  );
}

function describeStatus(connection: Connection, isPartnerTyping: boolean): string {
  switch (connection) {
    case 'online':
      return isPartnerTyping ? '입력 중…' : '온라인';
    case 'connecting':
      return '연결하는 중…';
    case 'offline':
      return '연결 끊김';
  }
}
