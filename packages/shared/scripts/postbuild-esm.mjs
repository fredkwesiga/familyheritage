import { writeFileSync } from 'node:fs';

/**
 * The package is "type": "commonjs", so Node and bundlers would read the files
 * in dist/esm as CommonJS. This marker file tells them otherwise.
 *
 * Why a dual build at all: the API is CommonJS (NestJS) and the web client is
 * ESM (Vite/Rollup). Shipping only CommonJS makes Rollup unable to see the
 * named exports; shipping only ESM breaks require() in the API. Two small tsc
 * passes and this four-line script is the boring, dependency-free fix.
 */
writeFileSync(
  new URL('../dist/esm/package.json', import.meta.url),
  JSON.stringify({ type: 'module' }, null, 2) + '\n',
);
