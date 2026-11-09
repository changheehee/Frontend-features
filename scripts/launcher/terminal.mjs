const stdout = process.stdout;

export const IS_INTERACTIVE = Boolean(stdout.isTTY && process.stdin.isTTY);
export const USES_COLOR = !('NO_COLOR' in process.env) && (Boolean(stdout.isTTY) || 'FORCE_COLOR' in process.env);

// 한국어 Windows의 기존 콘솔(conhost)은 상자·점자 문자를 두 칸으로 그리거나 빈칸으로 보여 줘서, 확실히 그려 주는 터미널에서만 쓴다.
const SUPPORTS_FANCY_GLYPHS = process.platform !== 'win32' || Boolean(process.env.WT_SESSION) || process.env.TERM_PROGRAM === 'vscode';

const DEFAULT_COLUMNS = 80;
const SPINNER_FRAME_MILLISECONDS = 80;
const MILLISECONDS_PER_SECOND = 1000;

export const GLYPH = Object.freeze(
  SUPPORTS_FANCY_GLYPHS
    ? {
        ok: '✓',
        fail: '✗',
        warn: '!',
        pending: '·',
        pointer: '❯',
        arrow: '➜',
        bar: '│',
        star: '✻',
        dot: '●',
        sep: '·',
        upDown: '↑↓',
        rule: '─',
        box: Object.freeze({ topLeft: '╭', topRight: '╮', bottomLeft: '╰', bottomRight: '╯', horizontal: '─', vertical: '│' }),
        spinner: Object.freeze(['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']),
      }
    : {
        ok: 'v',
        fail: 'x',
        warn: '!',
        pending: '-',
        pointer: '>',
        arrow: '->',
        bar: '|',
        star: '*',
        dot: '*',
        sep: '|',
        upDown: 'Up/Down',
        rule: '-',
        box: Object.freeze({ topLeft: '+', topRight: '+', bottomLeft: '+', bottomRight: '+', horizontal: '-', vertical: '|' }),
        spinner: Object.freeze(['|', '/', '-', '\\']),
      },
);

export const SEP = ` ${GLYPH.sep} `;

function paint(openCode, closeCode) {
  return function applyStyle(text) {
    return USES_COLOR ? `\x1b[${openCode}m${text}\x1b[${closeCode}m` : String(text);
  };
}

function rgb(red, green, blue) {
  return paint(`38;2;${red};${green};${blue}`, '39');
}

export const style = Object.freeze({
  bold: paint('1', '22'),
  accent: rgb(217, 119, 87),
  green: rgb(78, 186, 101),
  red: rgb(255, 107, 128),
  yellow: rgb(255, 193, 7),
  gray: rgb(140, 140, 140),
  server: rgb(177, 151, 252),
  client: rgb(80, 200, 230),
});

const ANSI_PATTERN = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07/g;

// 터미널에서 두 칸을 차지하는 문자 범위: 한글 자모·음절, 한중일 문자, 전각 문자, 그림 이모지.
const WIDE_CODE_POINT_RANGES = Object.freeze([
  [0x1100, 0x115f],
  [0x2e80, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe4f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1f300, 0x1faff],
]);

export function stripAnsi(text) {
  return text.replace(ANSI_PATTERN, '');
}

function isWideCodePoint(codePoint) {
  return WIDE_CODE_POINT_RANGES.some(function containsCodePoint([first, last]) {
    return codePoint >= first && codePoint <= last;
  });
}

export function displayWidth(text) {
  let width = 0;
  for (const character of stripAnsi(text)) {
    width += isWideCodePoint(character.codePointAt(0)) ? 2 : 1;
  }
  return width;
}

export function truncateStart(text, maxWidth) {
  if (displayWidth(text) <= maxWidth) {
    return text;
  }
  let kept = text;
  while (displayWidth(kept) > maxWidth - 1) {
    kept = kept.slice(1);
  }
  return `…${kept}`;
}

export function formatSeconds(milliseconds) {
  return `${(milliseconds / MILLISECONDS_PER_SECOND).toFixed(1)}s`;
}

function renderNoLines() {
  return [];
}

function appendNewline(line) {
  return `${line}\n`;
}

/**
 * stdout의 유일한 owner. 화면 맨 아래의 "살아 있는 영역"(작업 목록, 선택 메뉴, 하단 바)을 지우고 다시 그리면서
 * 그 위로는 로그를 쌓는다. TTY가 아니면 살아 있는 영역 없이 로그만 순서대로 쓴다.
 */
export class Screen {
  #renderLive = renderNoLines;
  #liveRows = 0;

  get columns() {
    return stdout.columns ?? DEFAULT_COLUMNS;
  }

  /** @param {() => string[]} renderLive */
  setLive(renderLive) {
    this.#renderLive = renderLive;
    this.redraw();
  }

  redraw() {
    if (!stdout.isTTY) {
      return;
    }
    stdout.write(this.#eraseLive() + this.#drawLive());
  }

  log(text = '') {
    if (!stdout.isTTY) {
      stdout.write(`${USES_COLOR ? text : stripAnsi(text)}\n`);
      return;
    }
    stdout.write(`${this.#eraseLive()}${text}\n${this.#drawLive()}`);
  }

  freezeLive() {
    this.#renderLive = renderNoLines;
    this.#liveRows = 0;
  }

  clearLive() {
    if (stdout.isTTY) {
      stdout.write(this.#eraseLive());
    }
    this.freezeLive();
  }

  clearAll() {
    if (stdout.isTTY) {
      stdout.write('\x1b[2J\x1b[3J\x1b[H');
    }
    this.#liveRows = 0;
  }

  setTitle(title) {
    if (stdout.isTTY) {
      stdout.write(`\x1b]0;${title}\x07`);
    }
  }

  hideCursor() {
    if (stdout.isTTY) {
      stdout.write('\x1b[?25l');
    }
  }

  showCursor() {
    if (stdout.isTTY) {
      stdout.write('\x1b[?25h');
    }
  }

  /**
   * @param {() => void} onResize
   * @returns {() => void} 감시를 멈추는 함수
   */
  watchResize(onResize) {
    stdout.on('resize', onResize);
    return function stopWatchingResize() {
      stdout.off('resize', onResize);
    };
  }

  #eraseLive() {
    const erase = this.#liveRows > 0 ? `\x1b[${this.#liveRows}F\x1b[0J` : '';
    this.#liveRows = 0;
    return erase;
  }

  #drawLive() {
    const lines = this.#renderLive();
    this.#liveRows = this.#countRows(lines);
    return lines.map(appendNewline).join('');
  }

  #countRows(lines) {
    const columns = this.columns;
    let rows = 0;
    for (const line of lines) {
      rows += Math.max(1, Math.ceil(displayWidth(line) / columns));
    }
    return rows;
  }
}

/** 진행 중 표시용 회전 문자와 그 갱신 timer를 소유한다. */
export class Spinner {
  #screen;
  #frameIndex = 0;
  #timer = null;

  /** @param {Screen} screen */
  constructor(screen) {
    this.#screen = screen;
  }

  get glyph() {
    return GLYPH.spinner[this.#frameIndex];
  }

  start() {
    if (!stdout.isTTY || this.#timer !== null) {
      return;
    }
    this.#timer = setInterval(this.#advanceFrame.bind(this), SPINNER_FRAME_MILLISECONDS);
  }

  stop() {
    clearInterval(this.#timer);
    this.#timer = null;
  }

  #advanceFrame() {
    this.#frameIndex = (this.#frameIndex + 1) % GLYPH.spinner.length;
    this.#screen.redraw();
  }
}

/** @typedef {'pending' | 'running' | 'done' | 'warn' | 'fail'} TaskState */

/** 작업 목록의 한 줄. 상태가 바뀔 때마다 화면을 다시 그리고, TTY가 아니면 끝난 결과를 한 줄로 남긴다. */
export class Task {
  #screen;
  #spinner;
  #label;
  /** @type {TaskState} */
  #state = 'pending';
  #detail = '';
  #startedAt = 0;

  /**
   * @param {Screen} screen
   * @param {Spinner} spinner
   * @param {string} label
   */
  constructor(screen, spinner, label) {
    this.#screen = screen;
    this.#spinner = spinner;
    this.#label = label;
  }

  get elapsedMilliseconds() {
    return Date.now() - this.#startedAt;
  }

  start(detail = '') {
    this.#state = 'running';
    this.#detail = detail;
    this.#startedAt = Date.now();
    this.#screen.redraw();
  }

  update(detail) {
    this.#detail = detail;
    this.#screen.redraw();
  }

  succeed(detail = this.#detail) {
    this.#finish('done', detail);
  }

  warn(detail = this.#detail) {
    this.#finish('warn', detail);
  }

  fail(detail = this.#detail) {
    this.#finish('fail', detail);
  }

  failIfRunning() {
    if (this.#state === 'running') {
      this.fail();
    }
  }

  render() {
    const label = this.#state === 'pending' ? style.gray(this.#label) : this.#label;
    const detail = this.#detail ? style.gray(`  ${this.#detail}`) : '';
    const elapsed = this.#state === 'running' ? style.gray(`  ${formatSeconds(this.elapsedMilliseconds)}`) : '';
    return `  ${this.#renderIcon()} ${label}${detail}${elapsed}`;
  }

  #renderIcon() {
    switch (this.#state) {
      case 'pending':
        return style.gray(GLYPH.pending);
      case 'running':
        return style.accent(this.#spinner.glyph);
      case 'done':
        return style.green(GLYPH.ok);
      case 'warn':
        return style.yellow(GLYPH.warn);
      case 'fail':
        return style.red(GLYPH.fail);
      default:
        throw new Error(`알 수 없는 작업 상태: ${JSON.stringify(this.#state)}`);
    }
  }

  #finish(state, detail) {
    this.#state = state;
    this.#detail = detail;
    if (stdout.isTTY) {
      this.#screen.redraw();
    } else {
      this.#screen.log(this.render());
    }
  }
}
