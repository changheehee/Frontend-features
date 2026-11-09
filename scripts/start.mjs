import { ChildProcessGroup, createChildEnvironment, findNpmCli } from './launcher/childProcesses.mjs';
import { planFreshInstall, planInstall, runInstall } from './launcher/dependencies.mjs';
import { DevServer, startApiServer, startWebClient } from './launcher/devServers.mjs';
import { Keyboard, promptChoice } from './launcher/keyboard.mjs';
import { FAILURE_OUTPUT_LINES, LaunchCancelledError, LaunchError } from './launcher/launchErrors.mjs';
import { ensurePortsAvailable } from './launcher/ports.mjs';
import { APPS, CLIENT_APP, PROJECT_ROOT, SERVER_APP } from './launcher/projectLayout.mjs';
import { RunningSession } from './launcher/runningSession.mjs';
import { GLYPH, SEP, Screen, Spinner, Task, displayWidth, stripAnsi, style, truncateStart } from './launcher/terminal.mjs';

/**
 * @typedef {object} LaunchOptions
 * @property {boolean} isHelpRequested
 * @property {boolean} shouldOpenBrowser
 * @property {boolean} isReinstallRequested
 */

/** @typedef {{ kind: 'unsupported' } | { kind: 'native' } | { kind: 'needsStripTypesFlag' }} NodeTypeScriptSupport */

// server는 node로 app.ts를 바로 실행한다. 22.18·23.6부터는 기본으로 되고, 그 전 22.12 이상은 이 옵션이 있어야 한다.
const STRIP_TYPES_NODE_OPTIONS = '--experimental-strip-types --disable-warning=ExperimentalWarning';

const BANNER_MIN_INNER_WIDTH = 44;
const BANNER_MIN_FITTED_WIDTH = 20;
const BANNER_FRAME_COLUMNS = 4;

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const screen = new Screen();
  if (options.isHelpRequested) {
    printHelp(screen);
    return;
  }
  await new Launcher(screen, options).run();
}

/**
 * 실행 전체의 owner. 단계를 순서대로 진행하고, 어느 단계에서 끝나든 띄운 프로세스와 터미널 상태를 정리한다.
 */
class Launcher {
  #screen;
  #options;
  #spinner;
  #keyboard;
  #processes;
  #tasks;
  /** @type {DevServer[]} */
  #devServers = [];
  /** @type {RunningSession | null} */
  #session = null;
  #isShuttingDown = false;

  /**
   * @param {Screen} screen
   * @param {LaunchOptions} options
   */
  constructor(screen, options) {
    this.#screen = screen;
    this.#options = options;
    this.#spinner = new Spinner(screen);
    this.#keyboard = new Keyboard();
    this.#processes = new ChildProcessGroup(findNpmCli());
    this.#tasks = createLaunchTasks(screen, this.#spinner);
  }

  async run() {
    this.#prepareTerminal();
    const startedAt = Date.now();
    try {
      const serverNodeOptions = this.#checkNodeRuntime();
      // 이전 실행이 node_modules 파일을 잡고 있으면 설치가 막히므로, 포트 정리를 설치보다 먼저 한다.
      await ensurePortsAvailable(APPS, this.#tasks.ports, this.#askChoice.bind(this));
      await this.#installDependencies();
      const { server, client } = this.#createDevServers(serverNodeOptions);
      await startApiServer(server, this.#tasks.server);
      const clientUrl = await startWebClient(client, this.#tasks.client);
      this.#enterRunningSession({ server, client, clientUrl, startupMilliseconds: Date.now() - startedAt });
    } catch (error) {
      this.#handleLaunchFailure(error);
    }
  }

  #prepareTerminal() {
    const launcher = this;
    function shutdownCleanly() {
      launcher.#shutdown(0);
    }
    process.on('SIGINT', shutdownCleanly);
    process.on('SIGTERM', shutdownCleanly);
    process.on('SIGHUP', shutdownCleanly);
    process.on('exit', function cleanUpOnExit() {
      launcher.#processes.stopAll();
      launcher.#screen.showCursor();
    });
    this.#keyboard.startListening(shutdownCleanly);

    this.#screen.setTitle(`Frontend-features${SEP}시작 중`);
    this.#screen.hideCursor();
    printBanner(this.#screen);
    this.#screen.setLive(this.#renderTasks.bind(this));
    this.#spinner.start();
  }

  #renderTasks() {
    return listTasksInOrder(this.#tasks).map(function renderTask(task) {
      return task.render();
    });
  }

  #askChoice(question, choices) {
    return promptChoice(this.#keyboard, this.#screen, { question, choices, renderAbove: this.#renderTasks.bind(this) });
  }

  /** @returns {string} server 프로세스에 덧붙일 NODE_OPTIONS. 필요 없으면 빈 문자열 */
  #checkNodeRuntime() {
    const task = this.#tasks.node;
    const version = process.versions.node;
    task.start();
    const support = checkNodeTypeScriptSupport(version);
    switch (support.kind) {
      case 'unsupported': {
        task.fail(`v${version}`);
        const nvmHint = process.env.NVM_HOME ? '\n  nvm을 쓰고 있다면: nvm install lts → nvm use lts' : '';
        throw new LaunchError(`Node.js 22.18 이상이 필요해요. (현재 v${version})`, {
          hint: `https://nodejs.org 에서 LTS 버전을 설치해 주세요.${nvmHint}`,
        });
      }
      case 'native':
        task.succeed(`v${version}`);
        return '';
      case 'needsStripTypesFlag':
        task.warn(`v${version}${SEP}TypeScript 실행 옵션 자동 적용 (22.18 이상 권장)`);
        return STRIP_TYPES_NODE_OPTIONS;
      default:
        throw new Error(`알 수 없는 Node.js 지원 판정: ${JSON.stringify(support)}`);
    }
  }

  async #installDependencies() {
    const installs = [];
    for (const app of APPS) {
      const task = this.#tasks.dependencies[app.name];
      task.start('확인 중');
      const plan = this.#options.isReinstallRequested ? planFreshInstall(app) : planInstall(app);
      if (plan.kind === 'upToDate') {
        task.succeed('최신 상태');
        continue;
      }
      installs.push(runInstall(plan, task, this.#processes));
    }

    const results = await Promise.allSettled(installs);
    const failure = results.find(function isRejected(result) {
      return result.status === 'rejected';
    });
    if (failure !== undefined) {
      throw failure.reason;
    }
  }

  #createDevServers(serverNodeOptions) {
    const nodeOptions = [process.env.NODE_OPTIONS, serverNodeOptions].filter(isNonEmptyText).join(' ');
    const onUnexpectedExit = this.#handleUnexpectedExit.bind(this);
    const server = new DevServer({
      app: SERVER_APP,
      environment: createChildEnvironment({ NODE_OPTIONS: nodeOptions }),
      screen: this.#screen,
      processes: this.#processes,
      onUnexpectedExit,
    });
    const client = new DevServer({
      app: CLIENT_APP,
      environment: createChildEnvironment(),
      screen: this.#screen,
      processes: this.#processes,
      onUnexpectedExit,
    });
    this.#devServers.push(server, client);
    return { server, client };
  }

  #enterRunningSession({ server, client, clientUrl, startupMilliseconds }) {
    this.#spinner.stop();
    this.#screen.redraw();
    this.#screen.freezeLive();
    this.#session = new RunningSession({
      screen: this.#screen,
      keyboard: this.#keyboard,
      server,
      client,
      clientUrl,
      requestShutdown: this.#shutdown.bind(this),
    });
    this.#session.start(startupMilliseconds);
    if (this.#options.shouldOpenBrowser) {
      this.#session.openBrowser();
    }
  }

  // 시작 단계의 종료는 준비 대기 중에 감지해 실패로 보고하므로, 여기서는 실행 중일 때만 알린다.
  #handleUnexpectedExit(devServer, exitCode) {
    if (this.#session !== null) {
      this.#session.reportUnexpectedExit(devServer, exitCode);
    }
  }

  #handleLaunchFailure(error) {
    if (this.#isShuttingDown) {
      return;
    }
    const isKnownOutcome = error instanceof LaunchError || error instanceof LaunchCancelledError;
    const failure = isKnownOutcome ? error : toUnexpectedFailure(error);
    this.#reportFailure(failure);
    this.#shutdown(failure instanceof LaunchCancelledError ? 0 : 1);
  }

  #reportFailure(failure) {
    for (const task of listTasksInOrder(this.#tasks)) {
      task.failIfRunning();
    }
    this.#spinner.stop();
    this.#screen.redraw();
    this.#screen.freezeLive();
    this.#screen.log('');
    if (failure instanceof LaunchCancelledError) {
      this.#screen.log(style.gray(`  ${failure.message}`));
      return;
    }
    printLaunchError(this.#screen, failure);
  }

  #shutdown(exitCode) {
    if (this.#isShuttingDown) {
      return;
    }
    this.#isShuttingDown = true;
    this.#keyboard.clearHandler();
    this.#session?.stop();
    this.#spinner.stop();
    this.#screen.clearLive();
    for (const devServer of this.#devServers) {
      devServer.stop();
    }
    this.#processes.stopAll();
    if (exitCode === 0) {
      this.#screen.log(style.gray(`  ${GLYPH.dot} 종료했어요.`));
    }
    this.#keyboard.stopListening();
    this.#screen.showCursor();
    process.exit(exitCode);
  }
}

/** @returns {LaunchOptions} */
function parseOptions(args) {
  const flags = new Set(args);
  return Object.freeze({
    isHelpRequested: flags.has('--help') || flags.has('-h'),
    shouldOpenBrowser: !flags.has('--no-open'),
    isReinstallRequested: flags.has('--reinstall'),
  });
}

/** @returns {NodeTypeScriptSupport} */
function checkNodeTypeScriptSupport(version) {
  const [major, minor] = version.split('.').map(function parseVersionPart(part) {
    return Number.parseInt(part, 10);
  });
  if (!Number.isInteger(major) || !Number.isInteger(minor)) {
    throw new Error(`Node.js 버전 형식을 읽을 수 없어요: ${version}`);
  }
  function isAtLeast(wantedMajor, wantedMinor) {
    return major > wantedMajor || (major === wantedMajor && minor >= wantedMinor);
  }

  if (!isAtLeast(22, 12)) {
    return { kind: 'unsupported' };
  }
  const runsTypeScriptNatively = (major === 22 && minor >= 18) || isAtLeast(23, 6);
  return runsTypeScriptNatively ? { kind: 'native' } : { kind: 'needsStripTypesFlag' };
}

function createLaunchTasks(screen, spinner) {
  function createTask(label) {
    return new Task(screen, spinner, label);
  }
  return Object.freeze({
    node: createTask('Node.js'),
    ports: createTask('포트'),
    dependencies: Object.freeze({ server: createTask('server 패키지'), client: createTask('client 패키지') }),
    server: createTask('server 시작'),
    client: createTask('client 시작'),
  });
}

function listTasksInOrder(tasks) {
  return [tasks.node, tasks.ports, tasks.dependencies.server, tasks.dependencies.client, tasks.server, tasks.client];
}

function isNonEmptyText(value) {
  return typeof value === 'string' && value !== '';
}

function toUnexpectedFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  const stackLines = error instanceof Error && typeof error.stack === 'string' ? error.stack.split('\n') : [];
  return new LaunchError(`예상하지 못한 오류: ${message}`, { output: stackLines, cause: error });
}

function printLaunchError(screen, failure) {
  screen.log(`  ${style.red(GLYPH.fail)} ${style.bold(failure.message)}`);
  if (failure.output.length > 0) {
    screen.log('');
    for (const line of failure.output.slice(-FAILURE_OUTPUT_LINES)) {
      screen.log(style.gray(`    ${GLYPH.bar} `) + line);
    }
  }
  if (failure.hint) {
    screen.log('');
    screen.log(`  ${style.yellow(GLYPH.arrow)} ${failure.hint}`);
  }
  screen.log('');
}

function printBanner(screen) {
  const lines = [
    `${style.accent(GLYPH.star)} ${style.bold('Frontend-features')}`,
    '',
    style.gray(`  검색${SEP}게시글${SEP}채팅${SEP}Worker 데모`),
    style.gray('  --help 로 실행 옵션 보기'),
    '',
    style.gray(`  cwd: ${PROJECT_ROOT}`),
  ];
  const maxInnerWidth = Math.max(BANNER_MIN_FITTED_WIDTH, screen.columns - BANNER_FRAME_COLUMNS);
  const fittedLines = lines.map(function fitLine(line) {
    return displayWidth(line) > maxInnerWidth ? style.gray(truncateStart(stripAnsi(line), maxInnerWidth)) : line;
  });
  const innerWidth = Math.min(maxInnerWidth, Math.max(BANNER_MIN_INNER_WIDTH, ...fittedLines.map(displayWidth)));
  const { topLeft, topRight, bottomLeft, bottomRight, horizontal, vertical } = GLYPH.box;
  const border = style.accent;

  screen.log(border(`${topLeft}${horizontal.repeat(innerWidth + 2)}${topRight}`));
  for (const line of fittedLines) {
    screen.log(`${border(vertical)} ${line}${' '.repeat(innerWidth - displayWidth(line))} ${border(vertical)}`);
  }
  screen.log(border(`${bottomLeft}${horizontal.repeat(innerWidth + 2)}${bottomRight}`));
  screen.log('');
}

function printHelp(screen) {
  const lines = [
    `${style.accent(GLYPH.star)} ${style.bold('Frontend-features 실행기')}`,
    '',
    `  ${style.bold('사용법')}  start.cmd [옵션]   ${style.gray('(또는 node scripts/start.mjs [옵션])')}`,
    '',
    `  ${style.bold('옵션')}`,
    '    --no-open     준비되면 브라우저를 자동으로 열지 않기',
    '    --reinstall   node_modules를 지우고 lock 파일 그대로 새로 설치',
    '    -h, --help    이 도움말',
    '',
    `  ${style.bold('하는 일')}`,
    '    1. Node.js 버전 확인 (22.12~22.17이면 TypeScript 실행 옵션 자동 적용)',
    `    2. 포트 ${SERVER_APP.port} · ${CLIENT_APP.port} 점검 (이전 실행은 정리, 다른 프로그램이면 물어봄)`,
    '    3. server · client 패키지가 없거나 lock 파일과 다르면 동시에 설치',
    '    4. server 준비 확인 후 client 실행, 로그를 한 화면에 표시',
    '',
    `  ${style.bold('실행 중 단축키')}  o 브라우저 열기 · r 서버 재시작(데이터 초기화) · c 화면 정리 · q 종료`,
  ];
  for (const line of lines) {
    screen.log(line);
  }
}

// 위의 class·상수 선언이 모두 초기화된 뒤에 시작해야 하므로 파일 맨 끝에서 호출한다.
main().catch(function reportCrash(error) {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
