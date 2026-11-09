// Dev-only UI test harness (NOT shipped in the packaged app).
// Usage: electron tests/ui/harness.js <script.js> <out.png> [light|dark]
// Starts the real app (app/main.js) with a throw-away profile, runs the given
// script in the page, prints its result and saves a screenshot.
const { app, nativeTheme } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(process.argv.findIndex((a) => a.endsWith('harness.js')) + 1).filter((a) => !a.startsWith('--'));
const [scriptFile, outPng, theme = 'light'] = args;
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'sac-ui-')));

app.on('browser-window-created', (_e, win) => {
  win.webContents.once('did-finish-load', () => setTimeout(async () => {
    nativeTheme.themeSource = theme;
    await win.webContents.executeJavaScript(`(() => { const t = document.querySelector('#theme'); t.value = ${JSON.stringify(theme)}; t.dispatchEvent(new Event('change')); })()`);
    if (scriptFile) console.log('SCRIPT RESULT', JSON.stringify(await win.webContents.executeJavaScript(fs.readFileSync(scriptFile, 'utf8'))));
    await new Promise((r) => setTimeout(r, 600));
    if (outPng) fs.writeFileSync(outPng, (await win.webContents.capturePage()).toPNG());
    app.quit();
  }, 800));
});

require('../../app/main.js');
