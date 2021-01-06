//@ts-check
const ChildProcess = require('child_process');
const Util = require('util');

const execFileAsync = Util.promisify(ChildProcess.execFile);

execFileAsync('./node_modules/.bin/tsc', ['--build', 'tsconfig.types.json']).then(
  () => {
    console.error('✅ Successfully generated type definitions');
  },
  (err) => {
    console.error('❌ Error while building type definitions:', err.stdout);
  }
);
