import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * fixed: 다른 앱이 이 포트를 직접 가리키므로 반드시 이 포트에서 떠야 한다.
 * flexible: 포트가 차 있으면 dev 서버가 스스로 빈 포트를 고른다.
 * @typedef {'fixed' | 'flexible'} PortPolicy
 */

/**
 * @typedef {object} AppDefinition
 * @property {'server' | 'client'} name
 * @property {string} directory
 * @property {number} port
 * @property {PortPolicy} portPolicy
 */

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// client/vite.config.ts의 /api 프록시가 3001을 직접 가리킨다.
/** @type {Readonly<AppDefinition>} */
export const SERVER_APP = Object.freeze({
  name: 'server',
  directory: path.join(PROJECT_ROOT, 'server'),
  port: 3001,
  portPolicy: 'fixed',
});

/** @type {Readonly<AppDefinition>} */
export const CLIENT_APP = Object.freeze({
  name: 'client',
  directory: path.join(PROJECT_ROOT, 'client'),
  port: 5173,
  portPolicy: 'flexible',
});

export const APPS = Object.freeze([SERVER_APP, CLIENT_APP]);
