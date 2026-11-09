// Cross-platform Windows build: `npm run package:win`
// 1) electron-packager -> dist/Skyrim Alchemy Companion-win32-x64/
// 2) embed assets/icon.ico + version info into the .exe (scripts/set_exe_icon.js, pure JS via resedit)
// Electron binaries are downloaded by @electron/get from the official GitHub release (cached afterwards).
// Optional: set ELECTRON_MIRROR to use a mirror if GitHub downloads fail.
import { packager } from '@electron/packager';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = await packager({
  dir: root,
  name: 'Skyrim Alchemy Companion',
  platform: 'win32',
  arch: 'x64',
  out: path.join(root, 'dist'),
  overwrite: true,
  asar: true,
  prune: true,
  // ship only app/ + package.json; everything else is source/tooling.
  // The app has no runtime npm dependencies, so node_modules is not shipped at all.
  ignore: [/^\/node_modules(\/|$)/, /^\/(scripts|tests|dist|out|screenshots|assets|docs)(\/|$)/, /^\/(README|BUILDING|LICENSE)/, /^\/\.(git|gitignore|abacus)/],
});
console.log('Packaged:', out.join(', '));
execFileSync(process.execPath, [path.join(root, 'scripts', 'set_exe_icon.js')], { stdio: 'inherit' });
console.log('Done. Output: dist\\Skyrim Alchemy Companion-win32-x64\\Skyrim Alchemy Companion.exe');
