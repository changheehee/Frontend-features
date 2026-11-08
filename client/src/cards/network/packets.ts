type PacketDirection = 'request' | 'response' | 'event' | 'failure';

const DIRECTION_MARKS: Readonly<Record<PacketDirection, string>> = {
  request: '→',
  response: '←',
  event: '⇠',
  failure: '✕',
};
const TAG_STYLE = 'padding: 1px 6px; border-radius: 4px; background: #335fff; color: #ffffff; font-weight: 600;';
const FAILURE_TAG_STYLE = 'padding: 1px 6px; border-radius: 4px; background: #d92d3a; color: #ffffff; font-weight: 600;';

export function logPacket(tag: string, direction: PacketDirection, summary: string, payload?: unknown) {
  const line = `%c${tag}%c ${DIRECTION_MARKS[direction]} ${decodeURIComponent(summary)}`;
  const tagStyle = direction === 'failure' ? FAILURE_TAG_STYLE : TAG_STYLE;

  if (payload === undefined) {
    console.log(line, tagStyle, '');
    return;
  }

  console.log(line, tagStyle, '', payload);
}

export async function requestServer(tag: string, url: string, init: RequestInit = {}): Promise<Response> {
  const method = init.method === undefined ? 'GET' : init.method;
  logPacket(tag, 'request', `${method} ${url}`, readRequestBody(init.body));

  try {
    const response = await fetch(url, init);
    logPacket(tag, 'response', `${response.status} ${method} ${url}`, await readResponseBody(response));
    return response;
  } catch (error) {
    const reason = error instanceof DOMException && error.name === 'AbortError' ? '취소' : '실패';
    logPacket(tag, 'failure', `${reason} ${method} ${url}`);
    throw error;
  }
}

function readRequestBody(body: RequestInit['body']): unknown {
  return typeof body === 'string' ? JSON.parse(body) : undefined;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const isJson = response.headers.get('Content-Type') !== null && response.headers.get('Content-Type')!.includes('json');
  return isJson ? response.clone().json() : undefined;
}
