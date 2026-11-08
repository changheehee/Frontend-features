import { useEffect, useState } from 'react';

type Notice = {
  readonly text: string;
};

export function useTimedNotice(shownMilliseconds: number) {
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(
    function hideNoticeLater() {
      if (notice === null) {
        return undefined;
      }

      const timerId = setTimeout(function hideNotice() {
        setNotice(null);
      }, shownMilliseconds);

      return function cancelHide() {
        clearTimeout(timerId);
      };
    },
    [notice, shownMilliseconds],
  );

  function showNotice(text: string) {
    setNotice({ text });
  }

  return { noticeText: notice === null ? null : notice.text, showNotice };
}
