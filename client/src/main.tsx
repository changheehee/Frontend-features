import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './global.css';
import { Hub } from './Hub.tsx';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('index.html에 id="root" 요소가 없어 앱을 시작할 수 없습니다.');
}

createRoot(rootElement).render(
  <StrictMode>
    <Hub />
  </StrictMode>,
);
