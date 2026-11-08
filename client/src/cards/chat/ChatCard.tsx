import { useState } from 'react';
import { ControlPanel } from '../controls/ControlPanel.tsx';
import { ServerControls } from '../controls/ServerControls.tsx';
import { describeServerOptions } from '../network/serverOptions.ts';
import './chatCard.css';
import { ChatPhone } from './ChatPhone.tsx';

export function ChatCard() {
  const [delayMilliseconds, setDelayMilliseconds] = useState(0);
  const [shouldFail, setShouldFail] = useState(false);
  const serverOptions = { delayMilliseconds, shouldFail };

  return (
    <div className="chat-card">
      <ControlPanel summary={describeServerOptions(delayMilliseconds, shouldFail)}>
        <ServerControls
          delayMilliseconds={delayMilliseconds}
          shouldFail={shouldFail}
          changeDelay={setDelayMilliseconds}
          changeShouldFail={setShouldFail}
        />
      </ControlPanel>
      <div className="chat-card-phones">
        <ChatPhone user="user1" partner="user2" serverOptions={serverOptions} />
        <ChatPhone user="user2" partner="user1" serverOptions={serverOptions} />
      </div>
    </div>
  );
}
