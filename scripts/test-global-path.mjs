import assert from 'node:assert/strict';
import path from 'node:path';
import globalPath from '../src/global-path.js';

const { getGlobalDevinRoot } = globalPath;

assert.equal(
  getGlobalDevinRoot({
    platform: 'darwin',
    homeDirectory: '/Users/example',
    pathApi: path.posix,
  }),
  '/Users/example/.config/devin',
);

assert.equal(
  getGlobalDevinRoot({
    platform: 'linux',
    homeDirectory: '/home/example',
    pathApi: path.posix,
  }),
  '/home/example/.config/devin',
);

assert.equal(
  getGlobalDevinRoot({
    platform: 'win32',
    env: { APPDATA: 'C:\\Users\\example\\AppData\\Roaming' },
    homeDirectory: 'C:\\Users\\example',
    pathApi: path.win32,
  }),
  'C:\\Users\\example\\AppData\\Roaming\\devin',
);

assert.equal(
  getGlobalDevinRoot({
    platform: 'win32',
    env: {},
    homeDirectory: 'C:\\Users\\example',
    pathApi: path.win32,
  }),
  'C:\\Users\\example\\AppData\\Roaming\\devin',
);

console.log('Rutas globales de Devin válidas para macOS, Linux y Windows');
