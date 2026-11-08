import './flowDiagram.css';

export type FlowStep =
  | {
      readonly type: 'message';
      readonly from: 'left' | 'right';
      readonly label: string;
      readonly detail: string;
    }
  | {
      readonly type: 'note';
      readonly side: 'left' | 'right';
      readonly text: string;
    };

export type DataFlow = {
  readonly lanes: readonly [FlowLane, FlowLane];
  readonly steps: readonly FlowStep[];
  readonly caption: string | null;
};

type FlowLane = {
  readonly name: string;
  readonly detail: string;
};

type FlowDiagramProps = {
  readonly flow: DataFlow;
};

const STEP_DELAY_MILLISECONDS = 70;

export function FlowDiagram({ flow }: FlowDiagramProps) {
  const [leftLane, rightLane] = flow.lanes;

  return (
    <figure className="flow">
      {flow.caption !== null && <figcaption className="flow-caption">{flow.caption}</figcaption>}
      <div className="flow-lane" data-side="left">
        <span className="flow-lane-name">{leftLane.name}</span>
        <span className="flow-lane-detail">{leftLane.detail}</span>
      </div>
      <div className="flow-lane" data-side="right">
        <span className="flow-lane-name">{rightLane.name}</span>
        <span className="flow-lane-detail">{rightLane.detail}</span>
      </div>

      <ol className="flow-steps">
        {flow.steps.map(function renderStep(step, index) {
          return (
            <li
              key={describeStep(step)}
              className="flow-step"
              style={{ animationDelay: `${index * STEP_DELAY_MILLISECONDS}ms` }}
            >
              <FlowStepContent step={step} number={index + 1} lanes={flow.lanes} />
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

type FlowStepContentProps = {
  readonly step: FlowStep;
  readonly number: number;
  readonly lanes: readonly [FlowLane, FlowLane];
};

function FlowStepContent({ step, number, lanes }: FlowStepContentProps) {
  if (step.type === 'note') {
    return (
      <p className="flow-note" data-side={step.side}>
        <span className="flow-number">{number}</span>
        <span className="flow-hidden">{findLane(lanes, step.side).name}: </span>
        {step.text}
      </p>
    );
  }

  const target = step.from === 'left' ? 'right' : 'left';

  return (
    <div className="flow-message" data-from={step.from}>
      <span className="flow-message-label">
        <span className="flow-number">{number}</span>
        <span className="flow-hidden">
          {findLane(lanes, step.from).name}에서 {findLane(lanes, target).name}로:{' '}
        </span>
        <code>{step.label}</code>
      </span>
      <span className="flow-arrow" aria-hidden="true" />
      <span className="flow-message-detail">{step.detail}</span>
    </div>
  );
}

function findLane(lanes: readonly [FlowLane, FlowLane], side: 'left' | 'right'): FlowLane {
  return side === 'left' ? lanes[0] : lanes[1];
}

function describeStep(step: FlowStep): string {
  return step.type === 'message' ? step.label : step.text;
}
