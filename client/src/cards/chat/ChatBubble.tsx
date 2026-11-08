import type { ChatMessage, MessageStatus } from './chatState.ts';

type ChatBubbleProps = {
  readonly message: ChatMessage;
  readonly isMine: boolean;
  readonly isFirstOfGroup: boolean;
  readonly isRead: boolean;
  readonly isOnline: boolean;
  readonly retryMessage: (key: string) => void;
};

const TIME_FORMAT = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' });

export function ChatBubble({ message, isMine, isFirstOfGroup, isRead, isOnline, retryMessage }: ChatBubbleProps) {
  function retryThisMessage() {
    retryMessage(message.key);
  }

  return (
    <li className="chat-row" data-mine={isMine} data-first={isFirstOfGroup}>
      <div className="chat-bubble" data-status={message.status}>
        <span className="chat-text">{message.text}</span>
        <span className="chat-meta">
          <time dateTime={new Date(message.sentAt).toISOString()}>{TIME_FORMAT.format(message.sentAt)}</time>
          {isMine && <MessageTick status={message.status} isRead={isRead} isOnline={isOnline} />}
        </span>
      </div>
      {message.status === 'failed' && (
        <button className="chat-retry" type="button" onClick={retryThisMessage}>
          보내지 못했습니다 · 다시 보내기
        </button>
      )}
    </li>
  );
}

type MessageTickProps = {
  readonly status: MessageStatus;
  readonly isRead: boolean;
  readonly isOnline: boolean;
};

function MessageTick({ status, isRead, isOnline }: MessageTickProps) {
  switch (status) {
    case 'waiting':
      return (
        <span className="chat-tick" data-tick="waiting">
          <svg className="chat-tick-icon" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="5.5" />
            <path d="M8 5v3l2 1.5" />
          </svg>
          <span className="chat-hidden">{isOnline ? '보내는 중' : '연결되면 보냄'}</span>
        </span>
      );
    case 'failed':
      return (
        <span className="chat-tick" data-tick="failed">
          <svg className="chat-tick-icon" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="6" />
            <path d="M8 4.8v3.6M8 10.9h.01" />
          </svg>
          <span className="chat-hidden">보내지 못함</span>
        </span>
      );
    case 'sent':
      return (
        <span className="chat-tick" data-tick={isRead ? 'read' : 'sent'}>
          <svg className="chat-tick-icon" viewBox="0 0 18 16" aria-hidden="true">
            <path d="m1.5 8.5 3.2 3.2L11 5" />
            {isRead && <path d="m7.5 11.2.5.5L14.5 5" />}
          </svg>
          <span className="chat-hidden">{isRead ? '읽음' : '보냄'}</span>
        </span>
      );
  }
}
