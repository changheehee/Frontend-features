export type ServerOptions = {
  readonly delayMilliseconds: number;
  readonly shouldFail: boolean;
};

export function createServerUrl(
  path: string,
  { delayMilliseconds, shouldFail }: ServerOptions,
  query: Readonly<Record<string, string>> = {},
): string {
  const searchParams = new URLSearchParams({
    ...query,
    delayMilliseconds: String(delayMilliseconds),
    fail: String(shouldFail),
  });

  return `${path}?${searchParams}`;
}

export function describeServerOptions(delayMilliseconds: number, shouldFail: boolean): string {
  const delayText = delayMilliseconds === 0 ? '없음' : `${delayMilliseconds / 1000}초`;
  const failText = shouldFail ? '실패 켜짐' : '실패 꺼짐';

  return `응답 지연 ${delayText} · ${failText}`;
}
