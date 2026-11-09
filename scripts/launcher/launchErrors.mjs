export const FAILURE_OUTPUT_LINES = 25;

/** 실행을 멈춰야 하는 실패. 사용자에게 보여 줄 안내와 원인이 된 로그를 함께 담는다. */
export class LaunchError extends Error {
  /**
   * @param {string} message
   * @param {{ hint?: string, output?: readonly string[], cause?: unknown }} [details]
   */
  constructor(message, details = {}) {
    super(message, { cause: details.cause });
    this.name = 'LaunchError';
    this.hint = details.hint ?? '';
    this.output = details.output ?? [];
  }
}

/** 사용자가 실행을 그만두기로 고른 경우. 실패가 아니므로 종료 코드 0으로 끝낸다. */
export class LaunchCancelledError extends Error {
  constructor() {
    super('실행을 취소했어요.');
    this.name = 'LaunchCancelledError';
  }
}
