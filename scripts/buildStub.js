//@ts-check
const { promises: Fs } = require('fs');

(async () => {
  await Fs.mkdir('./dist', { recursive: true });
  await Fs.writeFile(
    './dist/index.js',
    `throw new Error('Invariant violation: nostalgie should never be used outside of nostalgie builds');`
  );
})().then(
  () => {
    console.error('✅ Successfully wrote nostalgie entrypoint stub');
  },
  (err) => {
    console.error('❌ Error writing nostalgie entrypoint stub', err.message);
  }
);
