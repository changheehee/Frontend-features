import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createChildEnvironment, forEachLine } from './childProcesses.mjs';
import { LaunchError } from './launchErrors.mjs';
import { SEP, formatSeconds, stripAnsi } from './terminal.mjs';

/**
 * @typedef {{ kind: 'upToDate' }} UpToDatePlan
 * @typedef {{ kind: 'install', appName: string, directory: string, command: 'ci' | 'install', reason: string }} InstallPlan
 * @typedef {UpToDatePlan | InstallPlan} DependencyPlan
 */

/** @type {Readonly<UpToDatePlan>} */
const UP_TO_DATE_PLAN = Object.freeze({ kind: 'upToDate' });

const DECLARED_DEPENDENCY_FIELDS = Object.freeze(['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']);
const NPM_INSTALL_FLAGS = Object.freeze(['--no-audit', '--no-fund', '--prefer-offline']);
const LOCKED_FILE_PATTERN = /EPERM|EBUSY/;

const INSTALL_SUMMARY_WORDS = Object.freeze([
  ['added', '설치'],
  ['changed', '갱신'],
  ['removed', '제거'],
]);

const INSTALL_FAILURE_HINTS = Object.freeze([
  {
    pattern: /ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|network/i,
    hint: '네트워크 연결이나 사내 프록시 설정(npm config get proxy)을 확인해 주세요.',
  },
  {
    pattern: /EPERM|EBUSY|EACCES/,
    hint: '에디터나 실행 중인 dev 서버가 node_modules 파일을 잡고 있을 수 있어요. 닫고 다시 실행해 주세요.',
  },
  { pattern: /EINTEGRITY/, hint: 'npm 캐시가 손상됐을 수 있어요: npm cache verify 후 다시 실행해 주세요.' },
  { pattern: /ERESOLVE/, hint: '의존성 버전이 서로 맞지 않아요. package.json 변경 내용을 확인해 주세요.' },
]);
const DEFAULT_INSTALL_FAILURE_HINT = '위 로그를 확인한 뒤 start.cmd --reinstall 로 다시 시도해 보세요.';

// Windows는 npm의 음수 종료 코드(예: EPERM의 -4048)를 부호 없는 32비트 값으로 넘겨준다.
const MAX_SIGNED_32_BIT = 0x7fffffff;
const UNSIGNED_32_BIT_RANGE = 0x100000000;

/**
 * 설치가 필요한지와 그 이유를 판단한다. 근거는 package.json, package-lock.json,
 * 그리고 npm이 설치할 때 남기는 node_modules/.package-lock.json이다.
 * @param {import('./projectLayout.mjs').AppDefinition} app
 * @returns {DependencyPlan}
 */
export function planInstall(app) {
  const manifest = readManifest(app);
  const lock = readLock(app);
  const modulesDirectory = path.join(app.directory, 'node_modules');

  if (!existsSync(modulesDirectory)) {
    return createInstallPlan(app, freshInstallCommand(lock), '처음 설치');
  }
  if (lock !== null && declaredDependencies(manifest) !== declaredDependencies(lockPackages(lock)[''])) {
    return createInstallPlan(app, 'install', 'package.json 변경됨');
  }
  const missingPackage = findMissingTopLevelPackage(manifest, modulesDirectory);
  if (missingPackage !== null) {
    return createInstallPlan(app, 'install', `${missingPackage} 누락`);
  }
  if (lock === null) {
    return UP_TO_DATE_PLAN;
  }
  const installedRecord = readInstalledRecord(modulesDirectory);
  if (installedRecord.kind !== 'valid') {
    return createInstallPlan(app, 'install', installedRecord.reason);
  }
  const drift = findLockDrift(lock, installedRecord.lock);
  if (drift !== null) {
    return createInstallPlan(app, 'install', `lock 변경: ${drift}`);
  }
  return UP_TO_DATE_PLAN;
}

/**
 * @param {import('./projectLayout.mjs').AppDefinition} app
 * @returns {InstallPlan}
 */
export function planFreshInstall(app) {
  readManifest(app);
  return createInstallPlan(app, freshInstallCommand(readLock(app)), '--reinstall');
}

/**
 * npm ci는 node_modules를 먼저 지우므로, 잠긴 파일 때문에 실패하면 지우지 않는 npm install로 한 번 더 채운다.
 * @param {InstallPlan} plan
 * @param {import('./terminal.mjs').Task} task
 * @param {import('./childProcesses.mjs').ChildProcessGroup} processes
 */
export async function runInstall(plan, task, processes) {
  try {
    await runNpmInstall(plan, task, processes);
  } catch (error) {
    const canRetryWithoutWiping = plan.command === 'ci' && isLockedFileFailure(error);
    if (!canRetryWithoutWiping) {
      throw error;
    }
    await runNpmInstall({ ...plan, command: 'install', reason: 'npm ci가 잠긴 파일에 막혀 재시도' }, task, processes);
  }
}

/**
 * @param {import('./projectLayout.mjs').AppDefinition} app
 * @param {'ci' | 'install'} command
 * @param {string} reason
 * @returns {InstallPlan}
 */
function createInstallPlan(app, command, reason) {
  return { kind: 'install', appName: app.name, directory: app.directory, command, reason };
}

/** @returns {'ci' | 'install'} */
function freshInstallCommand(lock) {
  return lock === null ? 'install' : 'ci';
}

function readManifest(app) {
  const manifestPath = path.join(app.directory, 'package.json');
  const result = readJsonFile(manifestPath);
  switch (result.kind) {
    case 'parsed':
      return result.value;
    case 'missing':
    case 'invalid':
      throw new LaunchError(`${app.name}/package.json 을 읽을 수 없어요.`, { cause: result.kind === 'invalid' ? result.error : undefined });
    default:
      throw new Error(`알 수 없는 JSON 읽기 결과: ${JSON.stringify(result)}`);
  }
}

/** @returns {object | null} lock 파일이 없으면 null */
function readLock(app) {
  const lockPath = path.join(app.directory, 'package-lock.json');
  const result = readJsonFile(lockPath);
  switch (result.kind) {
    case 'parsed':
      return result.value;
    case 'missing':
      return null;
    case 'invalid':
      throw new LaunchError(`${app.name}/package-lock.json 형식이 올바르지 않아요.`, {
        hint: 'git으로 package-lock.json을 되돌리거나 지운 뒤 다시 실행해 주세요.',
        cause: result.error,
      });
    default:
      throw new Error(`알 수 없는 JSON 읽기 결과: ${JSON.stringify(result)}`);
  }
}

// 설치가 중간에 끊기면 npm의 설치 기록이 없거나 잘려 있을 수 있다. 둘 다 다시 설치하면 복구된다.
function readInstalledRecord(modulesDirectory) {
  const result = readJsonFile(path.join(modulesDirectory, '.package-lock.json'));
  switch (result.kind) {
    case 'parsed':
      return { kind: 'valid', lock: result.value };
    case 'missing':
      return { kind: 'missing', reason: '설치 기록 없음' };
    case 'invalid':
      return { kind: 'invalid', reason: '설치 기록 손상' };
    default:
      throw new Error(`알 수 없는 JSON 읽기 결과: ${JSON.stringify(result)}`);
  }
}

/**
 * @returns {{ kind: 'parsed', value: object } | { kind: 'missing' } | { kind: 'invalid', error: Error }}
 */
function readJsonFile(filePath) {
  let text;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { kind: 'missing' };
    }
    throw new LaunchError(`${filePath} 을(를) 읽을 수 없어요.`, { cause: error });
  }

  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { kind: 'invalid', error };
  }
  if (!isPlainObject(value)) {
    return { kind: 'invalid', error: new TypeError(`${filePath}의 최상위 값이 객체가 아니에요.`) };
  }
  return { kind: 'parsed', value };
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function lockPackages(lock) {
  return isPlainObject(lock.packages) ? lock.packages : {};
}

function declaredDependencies(packageEntry) {
  return DECLARED_DEPENDENCY_FIELDS.map(function serializeField(field) {
    const declared = isPlainObject(packageEntry) && isPlainObject(packageEntry[field]) ? packageEntry[field] : {};
    const sortedEntries = Object.entries(declared).sort(function compareNames([nameA], [nameB]) {
      return nameA.localeCompare(nameB);
    });
    return JSON.stringify(sortedEntries);
  }).join('|');
}

function findMissingTopLevelPackage(manifest, modulesDirectory) {
  const names = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
  const missingName = names.find(function isNotInstalled(name) {
    return !existsSync(path.join(modulesDirectory, name, 'package.json'));
  });
  return missingName ?? null;
}

function packageNameFromLockKey(lockKey) {
  const marker = 'node_modules/';
  return lockKey.slice(lockKey.lastIndexOf(marker) + marker.length);
}

/** @returns {string | null} 처음 발견한 차이 설명. 차이가 없으면 null */
function findLockDrift(lock, installedLock) {
  const installedPackages = lockPackages(installedLock);
  for (const [lockKey, wanted] of Object.entries(lockPackages(lock))) {
    const isRootOrLink = lockKey === '' || wanted.link === true;
    if (isRootOrLink) {
      continue;
    }
    const isInstalled = Object.hasOwn(installedPackages, lockKey);
    const isOptional = wanted.optional === true || wanted.devOptional === true || wanted.peer === true;
    if (!isInstalled && !isOptional) {
      return `${packageNameFromLockKey(lockKey)} 누락`;
    }
    if (isInstalled && installedPackages[lockKey].version !== wanted.version) {
      return `${packageNameFromLockKey(lockKey)} ${installedPackages[lockKey].version} → ${wanted.version}`;
    }
  }
  return null;
}

/** @returns {Promise<void>} */
function runNpmInstall(plan, task, processes) {
  task.start(`npm ${plan.command}${SEP}${plan.reason}`);
  const output = [];
  function collectLine(line) {
    output.push(stripAnsi(line));
  }

  const child = processes.spawnNpm([plan.command, ...NPM_INSTALL_FLAGS], { cwd: plan.directory, env: createChildEnvironment() });
  forEachLine(child.stdout, collectLine);
  forEachLine(child.stderr, collectLine);

  return new Promise(function waitForInstall(resolve, reject) {
    child.once('error', function rejectSpawnFailure(error) {
      task.fail('npm 실행 실패');
      reject(new LaunchError(`${plan.appName}: npm을 실행할 수 없어요. (${error.message})`, {
        hint: 'Node.js 설치에 npm이 포함돼 있는지 확인해 주세요.',
        cause: error,
      }));
    });
    child.once('close', function settleInstall(code, signal) {
      if (code === 0) {
        task.succeed(`${summarizeInstall(output)}${SEP}${formatSeconds(task.elapsedMilliseconds)}`);
        resolve();
        return;
      }
      task.fail(`npm ${plan.command} 실패 (code ${formatExitCode(code, signal)})`);
      reject(new LaunchError(`${plan.appName} 패키지 설치에 실패했어요.`, { hint: findInstallFailureHint(output), output }));
    });
  });
}

function isLockedFileFailure(error) {
  return error instanceof LaunchError && error.output.some(function mentionsLockedFile(line) {
    return LOCKED_FILE_PATTERN.test(line);
  });
}

function formatExitCode(code, signal) {
  if (code === null) {
    return signal ?? 'unknown';
  }
  return String(code > MAX_SIGNED_32_BIT ? code - UNSIGNED_32_BIT_RANGE : code);
}

function summarizeInstall(output) {
  const text = output.join('\n');
  const parts = [];
  for (const [word, label] of INSTALL_SUMMARY_WORDS) {
    const match = text.match(new RegExp(`${word} (\\d+) packages?`));
    if (match !== null) {
      parts.push(`${match[1]}개 ${label}`);
    }
  }
  return parts.length > 0 ? parts.join(', ') : '변경 없음';
}

function findInstallFailureHint(output) {
  const text = output.join('\n');
  const matched = INSTALL_FAILURE_HINTS.find(function matchesFailure(entry) {
    return entry.pattern.test(text);
  });
  return matched === undefined ? DEFAULT_INSTALL_FAILURE_HINT : matched.hint;
}
