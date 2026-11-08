import { logPacket, requestServer } from '../network/packets.ts';
import { createServerUrl } from '../network/serverOptions.ts';
import type { ServerOptions } from '../network/serverOptions.ts';
import type { ChatMessage, ChatUser, ServerMessage } from './chatState.ts';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const PACKET_TAGS: Readonly<Record<ChatUser, string>> = { user1: '채팅·사용자1', user2: '채팅·사용자2' };

export function openChatEvents(user: ChatUser, lastReceivedId: number): EventSource {
  const url = `/api/chat/events?${new URLSearchParams({ user, lastId: String(lastReceivedId) })}`;
  logPacket(PACKET_TAGS[user], 'request', `SSE GET ${url}`);
  return new EventSource(url);
}

export function readChatEvent<Payload>(user: ChatUser, event: MessageEvent<string>): Payload {
  const payload: Payload = JSON.parse(event.data);
  logPacket(PACKET_TAGS[user], 'event', `SSE ${event.type}`, payload);
  return payload;
}

export async function requestMessageSave(
  message: ChatMessage,
  serverOptions: ServerOptions,
  signal: AbortSignal,
): Promise<ServerMessage> {
  const response = await requestServer(PACKET_TAGS[message.from], createServerUrl('/api/chat/messages', serverOptions), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ clientId: message.key, from: message.from, text: message.text }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`메시지를 보내지 못했습니다. (${response.status})`);
  }

  return response.json();
}

export function reportRead(user: ChatUser, upToId: number) {
  sendSignal(user, '/api/chat/read', { user, upToId });
}

export function reportTyping(user: ChatUser) {
  sendSignal(user, '/api/chat/typing', { user });
}

function sendSignal(user: ChatUser, path: string, body: object) {
  requestServer(PACKET_TAGS[user], path, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) })
    .then(function checkSignal(response) {
      if (!response.ok) {
        throw new Error(`${path} 응답 ${response.status}`);
      }
    })
    .catch(function logSignalFailure(error: unknown) {
      console.error(`${path} 신호를 보내지 못했습니다.`, error);
    });
}
