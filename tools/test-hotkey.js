const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { KeyWatcher } = require('../src/main/hotkey');

const LOG = path.join(__dirname, '..', 'hotkey-test.log');

app.whenReady().then(() => {
  fs.writeFileSync(LOG, 'start\n');
  const w = new KeyWatcher({
    sequence: ['CTRL', 'CTRL'],
    gap: 600,
    onMatch: () => fs.appendFileSync(LOG, 'MATCH ' + new Date().toISOString() + '\n'),
    onError: (m) => fs.appendFileSync(LOG, 'ERR ' + m + '\n')
  });
  const ok = w.start();
  fs.appendFileSync(LOG, 'started=' + ok + '\n');
  setTimeout(() => { try { w.stop(); } catch (e) {} app.exit(0); }, 14000);
});
