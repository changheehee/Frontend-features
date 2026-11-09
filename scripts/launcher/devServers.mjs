import { setTimeout as delay } from 'node:timers/promises';
import { forEachLine, stopChildTree } from './childProcesses.mjs';
import { FAILURE_OUTPUT_LINES, LaunchError } from './launchErrors.mjs';
import { isPortInUse } from './ports.mjs';
import { GLYPH, SEP, formatSeconds, stripAnsi, style } from './terminal.mjs';

const SERVER_READY_TIMEOUT_MILLISECONDS = 30000;
const CLIENT_READY_TIMEOUT_MILLISECONDS = 60000;
const READY_POLL_MILLISECONDS = 150;
const MILLISECONDS_PER_SECOND = 1000;
const KEPT_OUTPUT_LINES = 300;
const LOG_PREFIX_WIDTH = 'server'.length;

// 기본 설정의 Vite는 "Local: http://localhost:5173/" 형태로 주소를 알린다. 셸에 넘길 값이라 호스트·포트 문자만 받는다.
const VITE_LOCAL_URL_PATTERN = /Local:\s+(https?:\/\/[A-Za-z0-9.\-[\]:]+)\/?(?:\s|$)/;

// node --watch는 코드 오류가 나도 종료하지 않고, 이 문구를 찍은 채 파일 변경을 기다린다.
const WATCH_FAILURE_PATTERN = /Failed running/;

// 실행 중 로그로 흘려보낼 필요가 없는 Vite 시작 안내. 시작 단계에서 이미 요약해 보여 준다.
const NOISE_PATTERNS = Object.freeze([/^\s*$/, /press h \+ enter/i, /Network: use --host/i, /^\s*VITE v/, /➜\s+Local:/]);

/**
 * npm run dev로 띄운 앱 하나의 수명 owner. 출력은 준비될 때까지 모아 두었다가(실패하면 그대로 보여 준다)
 * goLive 이후부터 앱 이름을 붙여 화면에 흘려보낸다.
 */
export class DevServer {
  #app;
  #environment;
  #screen;
  #processes;
  #onUnexpectedExit;
  #child = null;
  #output = [];
  #isLive = false;
  #isStopping = false;

  /**
   * @param {object} options
   * @param {import('./projectLayout.mjs').AppDefinition} options.app
   * @param {NodeJS.ProcessEnv} options.environment
   * @param {import('./terminal.mjs').Screen} options.screen
   * @param {import('./childProcesses.mjs').ChildProcessGroup} options.processes
   * @param {(devServer: DevServer, exitCode: number | null) => void} options.onUnexpectedExit stop()하지 않았는데 끝났을 때 한 번 호출된다.
   */
  constructor({ app, environment, screen, processes, onUnexpectedExit }) {
    this.#app = app;
    this.#environment = environment;
    this.#screen = screen;
    this.#processes = processes;
    this.#onUnexpectedExit = onUnexpectedExit;
  }

  get app() {
    return this.#app;
  }

  get isRunning() {
    return this.#child !== null;
  }

  start() {
    this.#output = [];
    this.#isLive = false;
    this.#isStopping = false;
    const child = this.#processes.spawnNpm(['run', 'dev', '--silent'], { cwd: this.#app.directory, env: this.#environment });
    this.#child = child;

    const devServer = this;
    function receiveLine(line) {
      devServer.#receive(line);
    }
    forEachLine(child.stdout, receiveLine);
    forEachLine(child.stderr, receiveLine);
    child.once('error', function recordSpawnFailure(error) {
      devServer.#receive(`실행 실패: ${error.message}`);
    });
    child.once('exit', function handleChildExit(code) {
      devServer.#handleExit(child, code);
    });
  }

  stop() {
    if (this.#child === null) {
      return;
    }
    this.#isStopping = true;
    stopChildTree(this.#child);
  }

  goLive() {
    this.#isLive = true;
  }

  /** @returns {string[]} 최근 출력의 복사본 */
  tail(count = FAILURE_OUTPUT_LINES) {
    return this.#output.slice(-count);
  }

  hasOutputMatching(pattern) {
    return this.#output.some(function matchesPattern(line) {
      return pattern.test(stripAnsi(line));
    });
  }

  /** @returns {RegExpMatchArray | null} */
  findOutputMatch(pattern) {
    for (const line of this.#output) {
      const match = stripAnsi(line).match(pattern);
      if (match !== null) {
        return match;
      }
    }
    return null;
  }

  #receive(line) {
    this.#output.push(line);
    if (this.#output.length > KEPT_OUTPUT_LINES) {
      this.#output.shift();
    }
    const plainLine = stripAnsi(line);
    const isNoise = NOISE_PATTERNS.some(function matchesNoise(pattern) {
      return pattern.test(plainLine);
    });
    if (this.#isLive && !isNoise) {
      const prefix = style[this.#app.name](this.#app.name.padEnd(LOG_PREFIX_WIDTH));
      this.#screen.log(`  ${prefix} ${style.gray(GLYPH.bar)} ${line}`);
    }
  }

  #handleExit(child, exitCode) {
    const isCurrentChild = this.#child === child;
    if (!isCurrentChild) {
      return;
    }
    this.#child = null;
    if (!this.#isStopping) {
      this.#onUnexpectedExit(this, exitCode);
    }
  }
}

/**
 * @param {DevServer} devServer
 * @param {import('./terminal.mjs').Task} task
 */
export async function startApiServer(devServer, task) {
  task.start('npm run dev');
  devServer.start();
  await waitForApiServer(devServer);
  task.succeed(`http://localhost:${devServer.app.port}${SEP}${formatSeconds(task.elapsedMilliseconds)}`);
}

/**
 * @param {DevServer} devServer
 * @param {import('./terminal.mjs').Task} task
 * @returns {Promise<string>} Vite가 알린 접속 주소
 */
export async function startWebClient(devServer, task) {
  task.start('npm run dev');
  devServer.start();
  const url = await waitForWebClient(devServer);
  task.succeed(`${url}${SEP}${formatSeconds(task.elapsedMilliseconds)}`);
  return url;
}

/** @param {DevServer} devServer */
export function waitForApiServer(devServer) {
  return waitUntilReady(devServer, {
    timeoutMilliseconds: SERVER_READY_TIMEOUT_MILLISECONDS,
    findReady: function checkApiServerListening() {
      return isPortInUse(devServer.app.port);
    },
    failPattern: WATCH_FAILURE_PATTERN,
  });
}

/**
 * @param {DevServer} devServer
 * @returns {Promise<string>}
 */
export function waitForWebClient(devServer) {
  return waitUntilReady(devServer, {
    timeoutMilliseconds: CLIENT_READY_TIMEOUT_MILLISECONDS,
    findReady: function findAnnouncedUrl() {
      return findViteUrl(devServer);
    },
    failPattern: null,
  });
}

/**
 * findReady가 truthy 값을 돌려줄 때까지 기다린다. 그 전에 프로세스가 끝나거나 failPattern이 출력되거나 시간이 지나면 실패한다.
 * @template T
 * @param {DevServer} devServer
 * @param {{ timeoutMilliseconds: number, findReady: () => T | Promise<T>, failPattern: RegExp | null }} readiness
 * @returns {Promise<T>}
 */
async function waitUntilReady(devServer, readiness) {
  const name = devServer.app.name;
  const deadline = Date.now() + readiness.timeoutMilliseconds;
  while (Date.now() < deadline) {
    const readyValue = await readiness.findReady();
    if (readyValue) {
      return readyValue;
    }
    if (!devServer.isRunning) {
      throw new LaunchError(`${name}이(가) 시작하자마자 종료됐어요.`, { output: devServer.tail() });
    }
    if (readiness.failPattern !== null && devServer.hasOutputMatching(readiness.failPattern)) {
      throw new LaunchError(`${name} 코드를 실행하다 오류가 났어요.`, {
        hint: '오류를 고친 뒤 start.cmd를 다시 실행해 주세요.',
        output: devServer.tail(),
      });
    }
    await delay(READY_POLL_MILLISECONDS);
  }
  const timeoutSeconds = readiness.timeoutMilliseconds / MILLISECONDS_PER_SECOND;
  throw new LaunchError(`${name}이(가) ${timeoutSeconds}초 안에 준비되지 않았어요.`, { output: devServer.tail() });
}

function findViteUrl(devServer) {
  const match = devServer.findOutputMatch(VITE_LOCAL_URL_PATTERN);
  return match === null ? null : match[1];
}
