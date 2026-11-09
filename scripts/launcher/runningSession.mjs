import { spawn } from 'node:child_process';
import { waitForApiServer, waitForWebClient } from './devServers.mjs';
import { LaunchError } from './launchErrors.mjs';
import { waitForPortRelease } from './ports.mjs';
import { GLYPH, IS_INTERACTIVE, SEP, formatSeconds, style } from './terminal.mjs';

const RULE_MAX_WIDTH = 72;
const SHORTCUTS = Object.freeze([
  ['o', '브라우저'],
  ['r', '서버 재시작'],
  ['c', '화면 정리'],
  ['q', '종료'],
]);

/**
 * 두 앱이 준비된 뒤의 화면과 단축키를 소유한다. 하단 바, 서버 재시작, 브라우저 열기를 처리하고
 * 실행 중에 앱이 갑자기 끝나면 알린다. 종료 결정은 requestShutdown으로 실행기에 넘긴다.
 */
export class RunningSession {
  #screen;
  #keyboard;
  #server;
  #client;
  #clientUrl;
  #requestShutdown;
  /** @type {Promise<void> | null} */
  #restartTask = null;
  /** @type {(() => void) | null} */
  #stopWatchingResize = null;

  /**
   * @param {object} options
   * @param {import('./terminal.mjs').Screen} options.screen
   * @param {import('./keyboard.mjs').Keyboard} options.keyboard
   * @param {import('./devServers.mjs').DevServer} options.server
   * @param {import('./devServers.mjs').DevServer} options.client
   * @param {string} options.clientUrl
   * @param {(exitCode: number) => void} options.requestShutdown
   */
  constructor({ screen, keyboard, server, client, clientUrl, requestShutdown }) {
    this.#screen = screen;
    this.#keyboard = keyboard;
    this.#server = server;
    this.#client = client;
    this.#clientUrl = clientUrl;
    this.#requestShutdown = requestShutdown;
  }

  start(startupMilliseconds) {
    this.#printReadySummary(startupMilliseconds);
    this.#server.goLive();
    this.#client.goLive();
    this.#screen.setTitle(`Frontend-features${SEP}실행 중`);
    if (!IS_INTERACTIVE) {
      this.#screen.log(style.gray('  Ctrl+C로 종료'));
      return;
    }
    this.#screen.setLive(this.#renderFooter.bind(this));
    this.#keyboard.setHandler(this.#handleKey.bind(this));
    this.#stopWatchingResize = this.#screen.watchResize(this.#screen.redraw.bind(this.#screen));
  }

  stop() {
    this.#keyboard.clearHandler();
    if (this.#stopWatchingResize !== null) {
      this.#stopWatchingResize();
      this.#stopWatchingResize = null;
    }
  }

  openBrowser() {
    const screen = this.#screen;
    const url = this.#clientUrl;
    const opener = spawnBrowserOpener(url);
    opener.on('error', function reportOpenFailure() {
      screen.log(style.yellow(`  ${GLYPH.warn} 브라우저를 열지 못했어요: ${url}`));
    });
    opener.unref();
  }

  /**
   * @param {import('./devServers.mjs').DevServer} devServer
   * @param {number | null} exitCode
   */
  reportUnexpectedExit(devServer, exitCode) {
    const restartHint = IS_INTERACTIVE ? ` ${style.bold('r')}로 다시 시작할 수 있어요.` : '';
    this.#screen.log(`  ${style.red(GLYPH.fail)} ${devServer.app.name}이(가) 종료됐어요 (code ${exitCode}).${restartHint}`);
    if (!IS_INTERACTIVE) {
      this.#requestShutdown(1);
      return;
    }
    this.#screen.redraw();
  }

  #handleKey(keyPress) {
    switch (keyPress.name) {
      case 'q':
      case 'escape':
        this.#requestShutdown(0);
        return;
      case 'o':
        this.openBrowser();
        return;
      case 'r':
        this.#requestRestart();
        return;
      case 'c':
        this.#screen.clearAll();
        this.#printReadySummary(null);
        return;
      default:
        return;
    }
  }

  // 재시작은 한 번에 하나만 돈다. 진행 중에 r을 다시 누르면 무시한다.
  #requestRestart() {
    if (this.#restartTask !== null) {
      return;
    }
    const session = this;
    this.#restartTask = this.#restartServer().finally(function releaseRestartSlot() {
      session.#restartTask = null;
    });
  }

  async #restartServer() {
    const server = this.#server;
    const client = this.#client;
    const startedAt = Date.now();
    this.#screen.log(style.gray(`  ${GLYPH.arrow} server 다시 시작 중 (메모리 데이터 초기화)`));
    try {
      server.stop();
      const isReleased = await waitForPortRelease(server.app.port);
      if (!isReleased) {
        throw new LaunchError(`포트 ${server.app.port}이(가) 비지 않아 server를 다시 시작하지 못했어요.`);
      }
      server.start();
      await waitForApiServer(server);
      server.goLive();
      if (!client.isRunning) {
        client.start();
        await waitForWebClient(client);
        client.goLive();
      }
      this.#screen.log(`  ${style.green(GLYPH.ok)} 다시 시작했어요 ${style.gray(formatSeconds(Date.now() - startedAt))}`);
    } catch (error) {
      this.#reportRestartFailure(error);
    } finally {
      this.#screen.redraw();
    }
  }

  #reportRestartFailure(error) {
    const message = error instanceof Error ? error.message : String(error);
    this.#screen.log(`  ${style.red(GLYPH.fail)} ${message}`);
    if (error instanceof LaunchError) {
      for (const line of error.output) {
        this.#screen.log(style.gray(`    ${line}`));
      }
    }
  }

  /** @param {number | null} startupMilliseconds 화면을 정리한 뒤 다시 보여 줄 때는 시간을 빼고 null */
  #printReadySummary(startupMilliseconds) {
    const timing = startupMilliseconds === null ? '' : style.gray(`${SEP}${formatSeconds(startupMilliseconds)}`);
    this.#screen.log('');
    this.#screen.log(`  ${style.accent(GLYPH.star)} ${style.bold('준비 완료')}${timing}`);
    this.#screen.log('');
    this.#screen.log(`    ${style.gray('앱 ')}  ${style.bold(style.client(this.#clientUrl))}`);
    this.#screen.log(`    ${style.gray('API')}  ${style.server(`http://localhost:${this.#server.app.port}`)}`);
    this.#screen.log('');
  }

  #renderFooter() {
    const statuses = [this.#server, this.#client].map(function renderStatus(devServer) {
      const dot = devServer.isRunning ? style.green(GLYPH.dot) : style.red(GLYPH.dot);
      return `${dot} ${style[devServer.app.name](devServer.app.name)}`;
    });
    const shortcuts = SHORTCUTS.map(function renderShortcut([key, label]) {
      return `${style.bold(key)} ${style.gray(label)}`;
    });
    const rule = style.gray(GLYPH.rule.repeat(Math.min(this.#screen.columns - 1, RULE_MAX_WIDTH)));
    return [rule, `  ${statuses.join('  ')}   ${shortcuts.join(style.gray(SEP))}`];
  }
}

function spawnBrowserOpener(url) {
  if (process.platform === 'win32') {
    return spawn('cmd.exe', ['/d', '/s', '/c', `start "" "${url}"`], {
      windowsVerbatimArguments: true,
      stdio: 'ignore',
      detached: true,
      windowsHide: true,
    });
  }
  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
  return spawn(opener, [url], { stdio: 'ignore', detached: true });
}
