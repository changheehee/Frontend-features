import net from 'node:net';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { killProcessTree, readCommandOutput } from './childProcesses.mjs';
import { LaunchCancelledError, LaunchError } from './launchErrors.mjs';
import { PROJECT_ROOT, SERVER_APP } from './projectLayout.mjs';
import { IS_INTERACTIVE, SEP } from './terminal.mjs';

/**
 * @typedef {object} ProcessInfo
 * @property {number} pid
 * @property {string | null} name 알아내지 못하면 null
 * @property {string | null} commandLine 알아내지 못하면 null
 * @property {number | null} parentPid
 * @property {string | null} parentCommandLine
 */

/**
 * @typedef {{ kind: 'free' }
 *   | { kind: 'released' }
 *   | { kind: 'stoppedPrevious', pid: number }
 *   | { kind: 'stoppedOther', ownerLabel: string }
 *   | { kind: 'shifted' }} PortOutcome
 */

/**
 * @typedef {(question: string, choices: readonly import('./keyboard.mjs').Choice<ConflictChoice>[]) => Promise<ConflictChoice>} AskChoice
 * @typedef {'stop' | 'shift' | 'cancel'} ConflictChoice
 */

const IS_WINDOWS = process.platform === 'win32';
const LOOPBACK_HOSTS = Object.freeze(['127.0.0.1', '::1']);
const PORT_PROBE_TIMEOUT_MILLISECONDS = 500;
const PORT_RELEASE_TIMEOUT_MILLISECONDS = 5000;
const PORT_RELEASE_POLL_MILLISECONDS = 150;
const OWN_SERVER_PROBE_TIMEOUT_MILLISECONDS = 1500;
const UNKNOWN_PROGRAM = '알 수 없는 프로그램';

// 대기(LISTEN) 소켓은 상대 주소가 와일드카드라서, 언어마다 다른 상태 문구 대신 이것으로 찾는다.
const LISTENING_FOREIGN_ADDRESSES = Object.freeze(['0.0.0.0:0', '[::]:0']);

// 이 프로젝트의 server는 이 경로에 { products: [...] } 모양으로 답한다.
const OWN_SERVER_PROBE_PATH = '/api/search?keyword=a&delayMilliseconds=0';

// node --watch는 자식이 죽어도 남아서 파일이 바뀌면 다시 띄우므로, 감시 프로세스까지 함께 정리한다.
const WATCH_PARENT_PATTERN = /--watch\b/;

/** @type {Readonly<PortOutcome>} */
const FREE_OUTCOME = Object.freeze({ kind: 'free' });

/**
 * 앱마다 포트를 비운다. 이 프로젝트의 이전 실행은 바로 정리하고, 다른 프로그램이면 사용자에게 묻는다.
 * @param {readonly import('./projectLayout.mjs').AppDefinition[]} apps
 * @param {import('./terminal.mjs').Task} task
 * @param {AskChoice} askChoice
 */
export async function ensurePortsAvailable(apps, task, askChoice) {
  const portList = apps.map(function readPort(app) {
    return app.port;
  }).join(', ');
  task.start(`${portList} 확인 중`);

  const notes = [];
  for (const app of apps) {
    const outcome = (await isPortInUse(app.port)) ? await resolvePortConflict(app, task, askChoice) : FREE_OUTCOME;
    const note = describePortOutcome(app, outcome);
    if (note !== null) {
      notes.push(note);
    }
  }
  task.succeed(notes.length > 0 ? notes.join(SEP) : `${portList} 비어 있음`);
}

export async function isPortInUse(port) {
  const probes = LOOPBACK_HOSTS.map(function probeHost(host) {
    return canConnect(port, host);
  });
  const results = await Promise.all(probes);
  return results.includes(true);
}

/** @returns {Promise<boolean>} 제한 시간 안에 포트가 비면 true */
export async function waitForPortRelease(port) {
  const deadline = Date.now() + PORT_RELEASE_TIMEOUT_MILLISECONDS;
  while (Date.now() < deadline) {
    if (!(await isPortInUse(port))) {
      return true;
    }
    await delay(PORT_RELEASE_POLL_MILLISECONDS);
  }
  return false;
}

function canConnect(port, host) {
  return new Promise(function probeConnection(resolve) {
    const socket = net.connect({ port, host });
    function finish(isOpen) {
      socket.destroy();
      resolve(isOpen);
    }
    socket.setTimeout(PORT_PROBE_TIMEOUT_MILLISECONDS);
    socket.once('connect', function reportOpen() {
      finish(true);
    });
    socket.once('timeout', function reportTimeout() {
      finish(false);
    });
    socket.once('error', function reportClosed() {
      finish(false);
    });
  });
}

/** @returns {Promise<PortOutcome>} */
async function resolvePortConflict(app, task, askChoice) {
  task.update(`${app.port} 사용 중${SEP}확인 중`);
  const owner = findPortOwner(app.port);

  if (owner !== null && (await isOwnDevProcess(app, owner))) {
    const stoppedPid = pidToStop(owner);
    await stopPortOwner(app.port, owner, stoppedPid);
    return { kind: 'stoppedPrevious', pid: stoppedPid };
  }
  // 앞서 정리한 이전 실행기가 스스로 내려가는 중이면 그사이 포트가 비므로, 묻기 전에 한 번 더 확인한다.
  if (!(await isPortInUse(app.port))) {
    return { kind: 'released' };
  }

  const ownerLabel = owner === null ? '다른 프로그램' : `${owner.name ?? UNKNOWN_PROGRAM} (PID ${owner.pid})`;
  if (IS_INTERACTIVE) {
    task.update('응답 대기 중');
  }
  const question = `포트 ${app.port}을(를) ${ownerLabel}이(가) 쓰고 있어요. ${app.name}은(는) 이 포트가 필요해요.`;
  const choice = await askChoice(question, buildConflictChoices(app, owner, ownerLabel));

  switch (choice) {
    case 'stop':
      task.update(`${ownerLabel} 종료 중`);
      await stopPortOwner(app.port, owner, owner.pid);
      return { kind: 'stoppedOther', ownerLabel };
    case 'shift':
      return { kind: 'shifted' };
    case 'cancel':
      throw new LaunchCancelledError();
    default:
      throw new Error(`알 수 없는 포트 충돌 선택: ${choice}`);
  }
}

function buildConflictChoices(app, owner, ownerLabel) {
  const choices = [];
  if (owner !== null) {
    choices.push({ value: 'stop', label: `${ownerLabel} 종료하고 계속` });
  }
  if (app.portPolicy === 'flexible') {
    choices.push({ value: 'shift', label: '다른 포트로 실행' });
  }
  choices.push({ value: 'cancel', label: '그만두기' });
  return choices;
}

/**
 * @param {import('./projectLayout.mjs').AppDefinition} app
 * @param {PortOutcome} outcome
 * @returns {string | null} 작업 줄에 덧붙일 설명. 알릴 것이 없으면 null
 */
function describePortOutcome(app, outcome) {
  switch (outcome.kind) {
    case 'free':
    case 'released':
      return null;
    case 'stoppedPrevious':
      return `이전 ${app.name} 종료 (PID ${outcome.pid})`;
    case 'stoppedOther':
      return `${app.port}: ${outcome.ownerLabel} 종료`;
    case 'shifted':
      return `${app.port} 사용 중 → ${app.name}는 빈 포트로`;
    default:
      throw new Error(`알 수 없는 포트 처리 결과: ${JSON.stringify(outcome)}`);
  }
}

async function isOwnDevProcess(app, owner) {
  const isLaunchedFromProject = owner.commandLine !== null && owner.commandLine.toLowerCase().includes(PROJECT_ROOT.toLowerCase());
  if (isLaunchedFromProject) {
    return true;
  }
  return app.name === SERVER_APP.name && (await fetchIsOwnApiServer(app.port));
}

async function fetchIsOwnApiServer(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}${OWN_SERVER_PROBE_PATH}`, {
      signal: AbortSignal.timeout(OWN_SERVER_PROBE_TIMEOUT_MILLISECONDS),
    });
    if (!response.ok) {
      return false;
    }
    const body = await response.json();
    return typeof body === 'object' && body !== null && Array.isArray(body.products);
  } catch {
    // 연결 실패, 시간 초과, JSON이 아닌 응답은 모두 "이 프로젝트의 server가 아니다"라는 답이다.
    return false;
  }
}

function pidToStop(owner) {
  const isWatchedChild = owner.parentPid !== null && owner.parentCommandLine !== null && WATCH_PARENT_PATTERN.test(owner.parentCommandLine);
  return isWatchedChild ? owner.parentPid : owner.pid;
}

async function stopPortOwner(port, owner, targetPid) {
  killProcessTree(targetPid);
  const isReleased = await waitForPortRelease(port);
  if (!isReleased) {
    throw new LaunchError(`포트 ${port}을(를) 비우지 못했어요. (${owner.name ?? UNKNOWN_PROGRAM}, PID ${owner.pid})`, {
      hint: '작업 관리자에서 해당 프로세스를 종료한 뒤 다시 실행해 주세요.',
    });
  }
}

/** @returns {ProcessInfo | null} 포트를 쓰는 프로세스를 찾지 못하면 null */
function findPortOwner(port) {
  const pid = findListeningPid(port);
  return pid === null ? null : describeProcess(pid);
}

function findListeningPid(port) {
  if (!IS_WINDOWS) {
    const output = readCommandOutput('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']);
    return output === null ? null : parsePid(output.trim().split('\n')[0]);
  }

  const listings = [readCommandOutput('netstat', ['-ano', '-p', 'TCP']), readCommandOutput('netstat', ['-ano', '-p', 'TCPv6'])];
  for (const listing of listings) {
    if (listing === null) {
      continue;
    }
    for (const line of listing.split(/\r?\n/)) {
      const columns = line.trim().split(/\s+/);
      const [, localAddress, foreignAddress] = columns;
      const isListeningOnPort = localAddress !== undefined
        && localAddress.endsWith(`:${port}`)
        && LISTENING_FOREIGN_ADDRESSES.includes(foreignAddress);
      if (isListeningOnPort) {
        return parsePid(columns[columns.length - 1]);
      }
    }
  }
  return null;
}

/** @returns {ProcessInfo} 일부 정보를 알아내지 못하면 그 필드만 null */
function describeProcess(pid) {
  if (!IS_WINDOWS) {
    return describePosixProcess(pid);
  }
  const query = [
    '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
    `$self = Get-CimInstance Win32_Process -Filter "ProcessId=${pid}"`,
    '$parent = Get-CimInstance Win32_Process -Filter "ProcessId=$($self.ParentProcessId)"',
    '@{ name = $self.Name; commandLine = $self.CommandLine; parentPid = $self.ParentProcessId; parentCommandLine = $parent.CommandLine } | ConvertTo-Json -Compress',
  ].join('; ');
  const output = readCommandOutput('powershell', ['-NoProfile', '-NonInteractive', '-Command', query]);
  return output === null ? createUnknownProcess(pid) : parseWindowsProcessInfo(pid, output.trim());
}

function parseWindowsProcessInfo(pid, jsonText) {
  let info;
  try {
    info = JSON.parse(jsonText);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createUnknownProcess(pid);
    }
    throw error;
  }
  if (typeof info !== 'object' || info === null) {
    return createUnknownProcess(pid);
  }
  return {
    pid,
    name: textOrNull(info.name),
    commandLine: textOrNull(info.commandLine),
    parentPid: Number.isSafeInteger(info.parentPid) && info.parentPid > 0 ? info.parentPid : null,
    parentCommandLine: textOrNull(info.parentCommandLine),
  };
}

function describePosixProcess(pid) {
  const output = readCommandOutput('ps', ['-o', 'ppid=,command=', '-p', String(pid)]);
  if (output === null) {
    return createUnknownProcess(pid);
  }
  const [parentPidText, ...commandWords] = output.trim().split(/\s+/);
  const parentPid = parsePid(parentPidText);
  const parentCommandLine = parentPid === null ? null : textOrNull(readCommandOutput('ps', ['-o', 'command=', '-p', String(parentPid)])?.trim());
  return {
    pid,
    name: commandWords.length > 0 ? path.basename(commandWords[0]) : null,
    commandLine: commandWords.length > 0 ? commandWords.join(' ') : null,
    parentPid,
    parentCommandLine,
  };
}

function createUnknownProcess(pid) {
  return { pid, name: null, commandLine: null, parentPid: null, parentCommandLine: null };
}

function textOrNull(value) {
  return typeof value === 'string' && value !== '' ? value : null;
}

function parsePid(text) {
  if (text === undefined || !/^\d+$/.test(text)) {
    return null;
  }
  const pid = Number.parseInt(text, 10);
  return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
}
