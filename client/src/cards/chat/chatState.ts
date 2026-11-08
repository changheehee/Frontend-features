export type ChatUser = 'user1' | 'user2';

export type Connection = 'connecting' | 'online' | 'offline';

export type MessageStatus = 'waiting' | 'sent' | 'failed';

export type ChatMessage = {
  readonly key: string;
  readonly id: number | null;
  readonly from: ChatUser;
  readonly text: string;
  readonly sentAt: number;
  readonly status: MessageStatus;
};

export type ServerMessage = {
  readonly id: number;
  readonly clientId: string;
  readonly from: ChatUser;
  readonly text: string;
  readonly sentAt: number;
};

export type ChatState = {
  readonly messages: readonly ChatMessage[];
  readonly connection: Connection;
  readonly partnerReadUpToId: number;
  readonly isPartnerTyping: boolean;
};

export type ChatEvent =
  | { readonly type: 'connected' }
  | { readonly type: 'connectionLost' }
  | { readonly type: 'wentOffline' }
  | { readonly type: 'cameOnline' }
  | { readonly type: 'messageWritten'; readonly message: ChatMessage }
  | { readonly type: 'messageSaved'; readonly message: ServerMessage }
  | { readonly type: 'messageFailed'; readonly key: string }
  | { readonly type: 'messageRetried'; readonly key: string; readonly retriedAt: number }
  | { readonly type: 'partnerRead'; readonly upToId: number }
  | { readonly type: 'partnerTyping' }
  | { readonly type: 'partnerStoppedTyping' };

export const INITIAL_CHAT_STATE: ChatState = {
  messages: [],
  connection: 'connecting',
  partnerReadUpToId: 0,
  isPartnerTyping: false,
};

export function updateChat(state: ChatState, event: ChatEvent): ChatState {
  switch (event.type) {
    case 'connected':
      return { ...state, connection: 'online' };
    case 'connectionLost':
      return { ...state, connection: 'connecting' };
    case 'wentOffline':
      return { ...state, connection: 'offline', isPartnerTyping: false };
    case 'cameOnline':
      return { ...state, connection: 'connecting' };
    case 'messageWritten':
      return { ...state, messages: [...state.messages, event.message] };
    case 'messageSaved':
      return { ...state, messages: placeSavedMessage(state.messages, event.message) };
    case 'messageFailed':
      return { ...state, messages: markFailed(state.messages, event.key) };
    case 'messageRetried':
      return { ...state, messages: moveToEndAsWaiting(state.messages, event.key, event.retriedAt) };
    case 'partnerRead':
      return { ...state, partnerReadUpToId: Math.max(state.partnerReadUpToId, event.upToId) };
    case 'partnerTyping':
      return { ...state, isPartnerTyping: true };
    case 'partnerStoppedTyping':
      return { ...state, isPartnerTyping: false };
  }
}

function placeSavedMessage(messages: readonly ChatMessage[], serverMessage: ServerMessage): readonly ChatMessage[] {
  const savedMessage: ChatMessage = {
    key: serverMessage.clientId,
    id: serverMessage.id,
    from: serverMessage.from,
    text: serverMessage.text,
    sentAt: serverMessage.sentAt,
    status: 'sent',
  };
  const otherMessages = messages.filter(function isOtherMessage(message) {
    return message.key !== serverMessage.clientId;
  });
  const savedMessages = [...otherMessages.filter(hasServerId), savedMessage].sort(compareServerId);
  const unsavedMessages = otherMessages.filter(function hasNoServerId(message) {
    return message.id === null;
  });

  return [...savedMessages, ...unsavedMessages];
}

function markFailed(messages: readonly ChatMessage[], key: string): readonly ChatMessage[] {
  return messages.map(function failTarget(message) {
    return message.key === key ? { ...message, status: 'failed' } : message;
  });
}

function moveToEndAsWaiting(messages: readonly ChatMessage[], key: string, retriedAt: number): readonly ChatMessage[] {
  const failedMessage = messages.find(function isTarget(message) {
    return message.key === key;
  })!;
  const otherMessages = messages.filter(function isOther(message) {
    return message.key !== key;
  });

  return [...otherMessages, { ...failedMessage, sentAt: retriedAt, status: 'waiting' }];
}

function hasServerId(message: ChatMessage): boolean {
  return message.id !== null;
}

function compareServerId(first: ChatMessage, second: ChatMessage): number {
  return first.id! - second.id!;
}
