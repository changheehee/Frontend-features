import { useEffect, useReducer, useRef } from 'react';
import type { ServerOptions } from '../network/serverOptions.ts';
import { openChatEvents, readChatEvent, reportRead, reportTyping, requestMessageSave } from './chatApi.ts';
import { INITIAL_CHAT_STATE, updateChat } from './chatState.ts';
import type { ChatMessage, ChatUser, ServerMessage } from './chatState.ts';

type ReadReceipt = {
  readonly user: ChatUser;
  readonly upToId: number;
};

type TypingSignal = {
  readonly user: ChatUser;
};

const TYPING_SIGNAL_GAP_MILLISECONDS = 1500;
const TYPING_SHOWN_MILLISECONDS = 2500;
const READ_REPORT_DELAY_MILLISECONDS = 150;

export function useChat(user: ChatUser, { delayMilliseconds, shouldFail }: ServerOptions) {
  const [chat, dispatch] = useReducer(updateChat, INITIAL_CHAT_STATE);
  const lastReceivedIdRef = useRef(0);
  const lastTypingSignalRef = useRef(0);
  const isOnline = chat.connection !== 'offline';
  const nextMessage = chat.messages.find(isWaiting);

  useEffect(
    function listenToServer() {
      if (!isOnline) {
        return undefined;
      }

      const timers = { readReportId: 0, typingHideId: 0 };
      const readTarget = { upToId: 0 };
      const events = openChatEvents(user, lastReceivedIdRef.current);
      events.addEventListener('open', markConnected);
      events.addEventListener('error', markConnectionLost);
      events.addEventListener('message', receiveMessage);
      events.addEventListener('read', receiveRead);
      events.addEventListener('typing', receiveTyping);

      function markConnected() {
        dispatch({ type: 'connected' });
      }

      function markConnectionLost() {
        dispatch({ type: 'connectionLost' });
      }

      function receiveMessage(event: MessageEvent<string>) {
        const message = readChatEvent<ServerMessage>(user, event);
        lastReceivedIdRef.current = Math.max(lastReceivedIdRef.current, message.id);
        dispatch({ type: 'messageSaved', message });

        if (message.from !== user) {
          dispatch({ type: 'partnerStoppedTyping' });
          scheduleReadReport(message.id);
        }
      }

      function receiveRead(event: MessageEvent<string>) {
        const receipt = readChatEvent<ReadReceipt>(user, event);

        if (receipt.user !== user) {
          dispatch({ type: 'partnerRead', upToId: receipt.upToId });
        }
      }

      function receiveTyping(event: MessageEvent<string>) {
        const signal = readChatEvent<TypingSignal>(user, event);

        if (signal.user === user) {
          return;
        }

        dispatch({ type: 'partnerTyping' });
        clearTimeout(timers.typingHideId);
        timers.typingHideId = window.setTimeout(function hideTyping() {
          dispatch({ type: 'partnerStoppedTyping' });
        }, TYPING_SHOWN_MILLISECONDS);
      }

      function scheduleReadReport(messageId: number) {
        readTarget.upToId = Math.max(readTarget.upToId, messageId);
        clearTimeout(timers.readReportId);
        timers.readReportId = window.setTimeout(function sendReadReport() {
          reportRead(user, readTarget.upToId);
        }, READ_REPORT_DELAY_MILLISECONDS);
      }

      return function stopListening() {
        events.close();
        clearTimeout(timers.readReportId);
        clearTimeout(timers.typingHideId);
      };
    },
    [isOnline, user],
  );

  useEffect(
    function sendNextMessage() {
      if (nextMessage === undefined || chat.connection !== 'online') {
        return undefined;
      }

      const controller = new AbortController();

      requestMessageSave(nextMessage, { delayMilliseconds, shouldFail }, controller.signal)
        .then(function markSaved(savedMessage) {
          dispatch({ type: 'messageSaved', message: savedMessage });
        })
        .catch(function markFailed() {
          if (!controller.signal.aborted) {
            dispatch({ type: 'messageFailed', key: nextMessage.key });
          }
        });

      return function cancelSave() {
        controller.abort();
      };
    },
    [nextMessage, chat.connection, delayMilliseconds, shouldFail],
  );

  function sendText(text: string) {
    dispatch({
      type: 'messageWritten',
      message: { key: crypto.randomUUID(), id: null, from: user, text, sentAt: Date.now(), status: 'waiting' },
    });
  }

  function retryMessage(key: string) {
    dispatch({ type: 'messageRetried', key, retriedAt: Date.now() });
  }

  function toggleOnline() {
    dispatch({ type: isOnline ? 'wentOffline' : 'cameOnline' });
  }

  function signalTyping() {
    const now = Date.now();
    const isTooSoon = now - lastTypingSignalRef.current < TYPING_SIGNAL_GAP_MILLISECONDS;

    if (chat.connection !== 'online' || isTooSoon) {
      return;
    }

    lastTypingSignalRef.current = now;
    reportTyping(user);
  }

  return { ...chat, isOnline, sendText, retryMessage, toggleOnline, signalTyping };
}

function isWaiting(message: ChatMessage): boolean {
  return message.status === 'waiting';
}
