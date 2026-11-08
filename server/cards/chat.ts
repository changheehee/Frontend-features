import type { Request, Response } from 'express';

type ChatUser = 'user1' | 'user2';

type ChatMessage = {
  readonly id: number;
  readonly clientId: string;
  readonly from: ChatUser;
  readonly text: string;
  readonly sentAt: number;
};

type MessageRequest = {
  readonly clientId: string;
  readonly from: ChatUser;
  readonly text: string;
};

type ReadReceipt = {
  readonly user: ChatUser;
  readonly upToId: number;
};

type Listener = {
  readonly user: ChatUser;
  readonly response: Response;
};

const messages: ChatMessage[] = [];
const listeners = new Set<Listener>();
const readUpToIds: Record<ChatUser, number> = { user1: 0, user2: 0 };
let lastMessageId = 0;

addMessage({ clientId: 'seed-1', from: 'user2', text: '안녕하세요! 캠핑 의자 아직 있나요?' }, 26);
addMessage({ clientId: 'seed-2', from: 'user1', text: '네, 아직 있어요.' }, 24);
addMessage({ clientId: 'seed-3', from: 'user2', text: '내일 저녁에 망원역 근처에서 볼 수 있을까요?' }, 23);
readUpToIds.user1 = lastMessageId;
readUpToIds.user2 = lastMessageId;

export function streamChatEvents(request: Request, response: Response) {
  const listener: Listener = { user: request.query.user as ChatUser, response };
  const lastEventId = request.get('Last-Event-ID');
  const lastId = lastEventId === undefined ? Number(request.query.lastId) : Number(lastEventId);

  response.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  response.flushHeaders();
  response.write('retry: 1000\n\n');

  for (const message of messages) {
    if (message.id > lastId) {
      writeEvent(response, 'message', message, message.id);
    }
  }

  writeEvent(response, 'read', { user: 'user1', upToId: readUpToIds.user1 });
  writeEvent(response, 'read', { user: 'user2', upToId: readUpToIds.user2 });

  listeners.add(listener);
  request.on('close', function removeListener() {
    listeners.delete(listener);
  });
}

export function saveChatMessage(request: Request, response: Response) {
  const messageRequest = request.body as MessageRequest;
  const delayMilliseconds = Number(request.query.delayMilliseconds);
  const shouldFail = request.query.fail === 'true';

  const timerId = setTimeout(finishSaving, delayMilliseconds);
  response.on('close', cancelSaving);

  function finishSaving() {
    if (shouldFail) {
      response.status(500).json({ message: '전송 실패를 재현했습니다.' });
      return;
    }

    const savedMessage = messages.find(function isSameRequest(message) {
      return message.clientId === messageRequest.clientId;
    });

    if (savedMessage !== undefined) {
      response.json(savedMessage);
      return;
    }

    response.json(addMessage(messageRequest, 0));
  }

  function cancelSaving() {
    clearTimeout(timerId);
  }
}

export function saveChatRead(request: Request, response: Response) {
  const receipt = request.body as ReadReceipt;
  readUpToIds[receipt.user] = Math.max(readUpToIds[receipt.user], receipt.upToId);
  broadcast('read', { user: receipt.user, upToId: readUpToIds[receipt.user] });
  response.status(204).end();
}

export function sendChatTyping(request: Request, response: Response) {
  broadcast('typing', { user: (request.body as { user: ChatUser }).user });
  response.status(204).end();
}

function addMessage(messageRequest: MessageRequest, minutesAgo: number): ChatMessage {
  lastMessageId += 1;

  const message: ChatMessage = {
    id: lastMessageId,
    clientId: messageRequest.clientId,
    from: messageRequest.from,
    text: messageRequest.text,
    sentAt: Date.now() - minutesAgo * 60 * 1000,
  };

  messages.push(message);
  broadcast('message', message, message.id);
  return message;
}

function broadcast(eventName: string, data: object, id?: number) {
  for (const listener of listeners) {
    writeEvent(listener.response, eventName, data, id);
  }
}

function writeEvent(response: Response, eventName: string, data: object, id?: number) {
  const idLine = id === undefined ? '' : `id: ${id}\n`;
  response.write(`${idLine}event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
}
