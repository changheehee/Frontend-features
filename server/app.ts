import express from 'express';
import { CARD_LIST } from './cardList.ts';

const PORT = 3001;

const app = express();
app.use(express.json());

for (const card of CARD_LIST) {
  app[card.method](`/api/${card.path}`, card.sendResponse);
}

app.listen(PORT, announceServerStarted);

function announceServerStarted(error?: Error) {
  if (error !== undefined) {
    throw error;
  }

  console.log(`서버 실행 중: http://localhost:${PORT}`);
}
