import { useId } from 'react';
import './segmentedChoice.css';

type SegmentedOption<Value extends string | number> = {
  readonly value: Value;
  readonly label: string;
};

type SegmentedChoiceProps<Value extends string | number> = {
  readonly title: string;
  readonly options: readonly SegmentedOption<Value>[];
  readonly value: Value;
  readonly changeValue: (value: Value) => void;
};

export function SegmentedChoice<Value extends string | number>({
  title,
  options,
  value,
  changeValue,
}: SegmentedChoiceProps<Value>) {
  const groupName = useId();

  return (
    <fieldset className="segmented">
      <legend className="segmented-title">{title}</legend>
      <div className="segmented-options">
        {options.map(function renderOption(option) {
          function chooseOption() {
            changeValue(option.value);
          }

          return (
            <label className="segmented-option" key={option.value}>
              <input
                type="radio"
                name={groupName}
                value={option.value}
                checked={option.value === value}
                onChange={chooseOption}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
