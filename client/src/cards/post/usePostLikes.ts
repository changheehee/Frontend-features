import { useRef, useState } from 'react';
import { requestServer } from '../network/packets.ts';
import { createServerUrl } from '../network/serverOptions.ts';
import type { ServerOptions } from '../network/serverOptions.ts';
import { useCloseSignal } from '../network/useCloseSignal.ts';
import type { Post } from './usePosts.ts';

export type Like = {
  readonly isLiked: boolean;
  readonly likeCount: number;
};

type LikeEntry = {
  readonly savedLike: Like;
  readonly chosenLiked: boolean | null;
  readonly isSaving: boolean;
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function usePostLikes(serverOptions: ServerOptions, reportSaveFailure: (post: Post) => void) {
  const [entries, setEntries] = useState<ReadonlyMap<number, LikeEntry>>(new Map());
  const latestChoicesRef = useRef(new Map<number, boolean>());
  const closeSignalRef = useCloseSignal();

  function showLike(post: Post): Like {
    const entry = entries.get(post.id);

    if (entry === undefined) {
      return { isLiked: post.isLiked, likeCount: post.likeCount };
    }

    return combineLike(entry.savedLike, entry.chosenLiked);
  }

  function isSaving(postId: number): boolean {
    const entry = entries.get(postId);
    return entry !== undefined && entry.isSaving;
  }

  function toggleLike(post: Post) {
    const nextLiked = !showLike(post).isLiked;
    const isSaveRunning = latestChoicesRef.current.has(post.id);
    latestChoicesRef.current.set(post.id, nextLiked);
    updateEntry(post, function chooseLike(entry) {
      return { ...entry, chosenLiked: nextLiked, isSaving: true };
    });

    if (!isSaveRunning) {
      void saveLatestChoice(post);
    }
  }

  async function saveLatestChoice(post: Post) {
    const closeSignal = closeSignalRef.current!;

    try {
      while (latestChoicesRef.current.has(post.id)) {
        const choice = latestChoicesRef.current.get(post.id)!;
        const savedLike = await requestLikeSave(post.id, choice, serverOptions, closeSignal);
        const isSettled = latestChoicesRef.current.get(post.id) === savedLike.isLiked;

        if (isSettled) {
          latestChoicesRef.current.delete(post.id);
        }

        updateEntry(post, function keepSavedLike(entry) {
          return { savedLike, chosenLiked: isSettled ? null : entry.chosenLiked, isSaving: !isSettled };
        });
      }
    } catch {
      latestChoicesRef.current.delete(post.id);

      if (closeSignal.aborted) {
        return;
      }

      updateEntry(post, function rollBack(entry) {
        return { ...entry, chosenLiked: null, isSaving: false };
      });
      reportSaveFailure(post);
    }
  }

  function updateEntry(post: Post, changeEntry: (entry: LikeEntry) => LikeEntry) {
    setEntries(function replaceEntry(previousEntries) {
      const entry = previousEntries.get(post.id);
      const currentEntry = entry === undefined ? createEntry(post) : entry;

      return new Map(previousEntries).set(post.id, changeEntry(currentEntry));
    });
  }

  return { showLike, isSaving, toggleLike };
}

async function requestLikeSave(
  postId: number,
  isLiked: boolean,
  serverOptions: ServerOptions,
  signal: AbortSignal,
): Promise<Like> {
  const response = await requestServer('게시글', createServerUrl(`/api/posts/${postId}/like`, serverOptions), {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ isLiked }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`${postId}번 글의 관심을 저장하지 못했습니다. (${response.status})`);
  }

  return response.json();
}

function createEntry(post: Post): LikeEntry {
  return {
    savedLike: { isLiked: post.isLiked, likeCount: post.likeCount },
    chosenLiked: null,
    isSaving: false,
  };
}

function combineLike(savedLike: Like, chosenLiked: boolean | null): Like {
  if (chosenLiked === null || chosenLiked === savedLike.isLiked) {
    return savedLike;
  }

  if (chosenLiked) {
    return { isLiked: true, likeCount: savedLike.likeCount + 1 };
  }

  return { isLiked: false, likeCount: savedLike.likeCount - 1 };
}
