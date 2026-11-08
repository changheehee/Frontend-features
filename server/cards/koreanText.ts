const FIRST_SYLLABLE_CODE = 0xac00;
const LAST_SYLLABLE_CODE = 0xd7a3;
const SYLLABLES_PER_INITIAL = 588;
const FINALS_PER_MEDIAL = 28;

const INITIALS = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const MEDIALS = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ',
  'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
];
const FINALS = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ',
  'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];
const COMPOUND_JAMO: Readonly<Record<string, string>> = {
  ㄳ: 'ㄱㅅ',
  ㄵ: 'ㄴㅈ',
  ㄶ: 'ㄴㅎ',
  ㄺ: 'ㄹㄱ',
  ㄻ: 'ㄹㅁ',
  ㄼ: 'ㄹㅂ',
  ㄽ: 'ㄹㅅ',
  ㄾ: 'ㄹㅌ',
  ㄿ: 'ㄹㅍ',
  ㅀ: 'ㄹㅎ',
  ㅄ: 'ㅂㅅ',
  ㅘ: 'ㅗㅏ',
  ㅙ: 'ㅗㅐ',
  ㅚ: 'ㅗㅣ',
  ㅝ: 'ㅜㅓ',
  ㅞ: 'ㅜㅔ',
  ㅟ: 'ㅜㅣ',
  ㅢ: 'ㅡㅣ',
};

export function splitIntoJamo(text: string): string {
  return Array.from(text.toLowerCase(), splitCharacter).join('');
}

export function measureEditDistance(first: string, second: string): number {
  const previousRow = Array.from({ length: second.length + 1 }, function startRow(_value: unknown, index: number) {
    return index;
  });

  for (let firstIndex = 1; firstIndex <= first.length; firstIndex++) {
    const currentRow = [firstIndex];

    for (let secondIndex = 1; secondIndex <= second.length; secondIndex++) {
      const substitutionCost = first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1;
      currentRow[secondIndex] = Math.min(
        previousRow[secondIndex]! + 1,
        currentRow[secondIndex - 1]! + 1,
        previousRow[secondIndex - 1]! + substitutionCost,
      );
    }

    previousRow.splice(0, previousRow.length, ...currentRow);
  }

  return previousRow[second.length]!;
}

function splitCharacter(character: string): string {
  const code = character.charCodeAt(0);

  if (code < FIRST_SYLLABLE_CODE || code > LAST_SYLLABLE_CODE) {
    return splitCompound(character);
  }

  const syllableIndex = code - FIRST_SYLLABLE_CODE;
  const initial = INITIALS[Math.floor(syllableIndex / SYLLABLES_PER_INITIAL)]!;
  const medial = MEDIALS[Math.floor((syllableIndex % SYLLABLES_PER_INITIAL) / FINALS_PER_MEDIAL)]!;
  const final = FINALS[syllableIndex % FINALS_PER_MEDIAL]!;

  return initial + splitCompound(medial) + splitCompound(final);
}

function splitCompound(jamo: string): string {
  const parts = COMPOUND_JAMO[jamo];
  return parts === undefined ? jamo : parts;
}
