// Single backend entrypoint lives in src/server.ts.
// Keep this file as a stable build output (`dist/index.js`) for `npm start`.
import './server.js';

export { default } from './server.js';
