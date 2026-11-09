import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { USES_COLOR } from './terminal.mjs';

const IS_WINDOWS = process.platform === 'win32';

/**
 * node 옆에 설치된 npm-cli.js를 찾는다. node로 직접 실행하면 Windows에서 cmd.exe 껍데기 없이 프로세스 트리를 끝까지 정리할 수 있다.
 * @returns {string | null} 찾지 못하면 null이고, 그때는 PATH의 npm을 셸로 실행한다.
 */
export function findNpmCli() {
  const nodeDirectory = path.dirname(process.execPath);
  const candidates = [
    path.join(nodeDirectory, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(nodeDirectory, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  return candidates.find(function isExistingFile(candidate) {
    return existsSync(candidate);
  }) ?? null;
}

/** @param {Record<string, string>} [extraEnvironment] */
export function createChildEnvironment(extraEnvironment = {}) {
  const colorEnvironment = USES_COLOR ? { FORCE_COLOR: '1' } : { NO_COLOR: '1' };
  return { ...process.env, ...colorEnvironment, npm_config_update_notifier: 'false', ...extraEnvironment };
}

/** 실행기가 띄운 npm 프로세스들의 owner. 종료할 때 아직 살아 있는 프로세스 트리를 모두 정리한다. */
export class ChildProcessGroup {
  #npmCli;
  #children = new Set();

  /** @param {string | null} npmCli */
  constructor(npmCli) {
    this.#npmCli = npmCli;
  }

  /**
   * @param {readonly string[]} npmArgs
   * @param {{ cwd: string, env: NodeJS.ProcessEnv }} location
   */
  spawnNpm(npmArgs, location) {
    /** @type {import('node:child_process').SpawnOptionsWithStdioTuple<'ignore', 'pipe', 'pipe'>} */
    const spawnOptions = { ...location, stdio: ['ignore', 'pipe', 'pipe'], detached: !IS_WINDOWS, windowsHide: true };
    const child = this.#npmCli === null
      ? spawn('npm', npmArgs, { ...spawnOptions, shell: IS_WINDOWS })
      : spawn(process.execPath, [this.#npmCli, ...npmArgs], spawnOptions);
    this.#children.add(child);

    const children = this.#children;
    function forgetChild() {
      children.delete(child);
    }
    child.once('exit', forgetChild);
    child.once('error', forgetChild);
    return child;
  }

  stopAll() {
    for (const child of [...this.#children]) {
      stopChildTree(child);
    }
  }
}

export function stopChildTree(child) {
  const hasExited = child.exitCode !== null || child.signalCode !== null;
  if (hasExited || child.pid === undefined) {
    return;
  }
  killProcessTree(child.pid);
}

export function killProcessTree(pid) {
  if (IS_WINDOWS) {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    return;
  }
  const wasGroupSignaled = sendTerminate(-pid);
  if (!wasGroupSignaled) {
    sendTerminate(pid);
  }
}

function sendTerminate(target) {
  try {
    process.kill(target, 'SIGTERM');
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') {
      return false;
    }
    throw error;
  }
}

/**
 * 끝까지 기다려 출력 전체를 돌려준다. 이 실행기에서는 포트 주인 같은 부가 정보를 찾는 데만 쓴다.
 * @returns {string | null} 명령이 실패하면 null
 */
export function readCommandOutput(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { encoding: 'utf8', windowsHide: true });
  return result.status === 0 ? result.stdout : null;
}

/** @param {(line: string) => void} onLine */
export function forEachLine(stream, onLine) {
  let pending = '';
  stream.setEncoding('utf8');
  stream.on('data', function splitIntoLines(chunk) {
    const lines = (pending + chunk).split(/\r?\n/);
    pending = lines.pop();
    for (const line of lines) {
      onLine(line);
    }
  });
  stream.on('end', function flushLastLine() {
    if (pending !== '') {
      onLine(pending);
    }
  });
}
