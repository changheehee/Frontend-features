import type { ChangeEvent } from 'react';
import { SegmentedChoice } from './SegmentedChoice.tsx';
import './serverControls.css';

const DELAY_OPTIONS = [
  { value: 0, label: '없음' },
  { value: 1000, label: '1초' },
  { value: 3000, label: '3초' },
];

type ServerControlsProps = {
  readonly delayMilliseconds: number;
  readonly shouldFail: boolean;
  readonly changeDelay: (milliseconds: number) => void;
  readonly changeShouldFail: (shouldFail: boolean) => void;
};

export function ServerControls({
  delayMilliseconds,
  shouldFail,
  changeDelay,
  changeShouldFail,
}: ServerControlsProps) {
  function updateShouldFail(event: ChangeEvent<HTMLInputElement>) {
    changeShouldFail(event.currentTarget.checked);
  }

  return (
    <fieldset className="server-controls">
      <legend className="server-controls-title">서버 조절</legend>
      <SegmentedChoice
        title="응답 지연"
        options={DELAY_OPTIONS}
        value={delayMilliseconds}
        changeValue={changeDelay}
      />
      <label className="server-controls-switch">
        <span className="server-controls-option-name">요청 실패시키기</span>
        <input type="checkbox" checked={shouldFail} onChange={updateShouldFail} />
      </label>
    </fieldset>
  );
}
