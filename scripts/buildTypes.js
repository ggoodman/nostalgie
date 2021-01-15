//@ts-check
const ChildProcess = require('child_process');
const Util = require('util');
const { promises: Fs } = require('fs');

const execFileAsync = Util.promisify(ChildProcess.execFile);

(async () => {
  const fileTypes = await Fs.readFile('./runtime/browser/fileTypes.d.ts', 'utf8');
  await execFileAsync('./node_modules/.bin/tsc', ['--build', 'tsconfig.types.json']);

  await Fs.appendFile(
    './dist/index.d.ts',
    `\n${fileTypes.replace(/import\('nostalgie'\)\./g, '')}\n`
  );
})().then(
  () => {
    console.error('✅ Successfully generated type definitions');
  },
  (err) => {
    console.error('❌ Error while building type definitions:', err.stdout || err.message);
  }
);
