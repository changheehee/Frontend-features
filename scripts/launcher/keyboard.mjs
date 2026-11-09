import readline from 'node:readline';
import { GLYPH, IS_INTERACTIVE, SEP, style } from './terminal.mjs';

/** @typedef {{ name: string, text: string }} KeyPress */

/**
 * @template T
 * @typedef {{ value: T, label: string }} Choice
 */

const QUIT_KEY_NAMES = Object.freeze(['c', 'd']);
const CHOICE_NUMBER_PATTERN = /^[1-9]$/;

function toKeyPress(text, key) {
  const typedText = text ?? '';
  const name = key === undefined || key.name === undefined ? typedText : key.name;
  return { name, text: typedText };
}

/**
 * raw mode 키 입력의 owner. raw mode에서는 Ctrl+C가 SIGINT로 오지 않으므로 Ctrl+C·Ctrl+D는 단계와 상관없이 onQuit으로 보내고,
 * 나머지 키는 지금 등록된 handler 하나에게만 전달한다.
 */
export class Keyboard {
  /** @type {((keyPress: KeyPress) => void) | null} */
  #keyHandler = null;
  #keypressListener = null;

  /** @param {() => void} onQuit */
  startListening(onQuit) {
    if (!IS_INTERACTIVE || this.#keypressListener !== null) {
      return;
    }
    const keyboard = this;
    this.#keypressListener = function dispatchKeypress(text, key) {
      keyboard.#dispatch(toKeyPress(text, key), key, onQuit);
    };
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('keypress', this.#keypressListener);
  }

  /** @param {(keyPress: KeyPress) => void} keyHandler */
  setHandler(keyHandler) {
    this.#keyHandler = keyHandler;
  }

  clearHandler() {
    this.#keyHandler = null;
  }

  stopListening() {
    if (this.#keypressListener === null) {
      return;
    }
    process.stdin.off('keypress', this.#keypressListener);
    this.#keypressListener = null;
    process.stdin.setRawMode(false);
    process.stdin.pause();
  }

  #dispatch(keyPress, key, onQuit) {
    const isQuitShortcut = key !== undefined && key.ctrl === true && QUIT_KEY_NAMES.includes(keyPress.name);
    if (isQuitShortcut) {
      onQuit();
      return;
    }
    if (this.#keyHandler !== null) {
      this.#keyHandler(keyPress);
    }
  }
}

/**
 * 화면 아래에 번호 메뉴를 띄우고 고른 값을 돌려준다. 마지막 선택지는 Esc를 눌렀을 때와
 * 키 입력을 받을 수 없는 실행에서 고르는 안전한 기본값이다.
 * @template T
 * @param {Keyboard} keyboard
 * @param {import('./terminal.mjs').Screen} screen
 * @param {{ question: string, choices: readonly Choice<T>[], renderAbove: () => string[] }} request
 * @returns {Promise<T>}
 */
export function promptChoice(keyboard, screen, request) {
  const { question, choices, renderAbove } = request;
  const fallbackIndex = choices.length - 1;
  if (!IS_INTERACTIVE) {
    screen.log(`  ${GLYPH.warn} ${question}`);
    return Promise.resolve(choices[fallbackIndex].value);
  }

  let selectedIndex = 0;
  return new Promise(function waitForChoice(resolve) {
    function renderMenu() {
      const choiceLines = choices.map(function renderChoice(choice, index) {
        const label = `${index + 1}. ${choice.label}`;
        return index === selectedIndex ? `    ${style.accent(GLYPH.pointer)} ${style.accent(label)}` : `      ${label}`;
      });
      return [
        ...renderAbove(),
        '',
        `  ${style.yellow(GLYPH.warn)} ${question}`,
        '',
        ...choiceLines,
        '',
        style.gray(`    ${GLYPH.upDown} 이동${SEP}Enter 선택${SEP}Esc 취소`),
      ];
    }

    function choose(index) {
      keyboard.clearHandler();
      screen.setLive(renderAbove);
      resolve(choices[index].value);
    }

    function moveSelection(step) {
      selectedIndex = (selectedIndex + step + choices.length) % choices.length;
      screen.redraw();
    }

    function chooseByNumber(text) {
      const isChoiceNumber = CHOICE_NUMBER_PATTERN.test(text) && Number.parseInt(text, 10) <= choices.length;
      if (isChoiceNumber) {
        choose(Number.parseInt(text, 10) - 1);
        return;
      }
      screen.redraw();
    }

    keyboard.setHandler(function handleMenuKey(keyPress) {
      switch (keyPress.name) {
        case 'up':
        case 'k':
          moveSelection(-1);
          return;
        case 'down':
        case 'j':
          moveSelection(1);
          return;
        case 'return':
        case 'enter':
          choose(selectedIndex);
          return;
        case 'escape':
          choose(fallbackIndex);
          return;
        default:
          chooseByNumber(keyPress.text);
      }
    });
    screen.setLive(renderMenu);
  });
}
