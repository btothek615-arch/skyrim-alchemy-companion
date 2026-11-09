# Building Skyrim Alchemy Companion from source (Windows)

These steps rebuild the same Windows program that ships in `SkyrimAlchemyCompanion_win.zip`, starting from this source code.

## Prerequisites
- **Windows 10 or 11, x64.**
- **Node.js 22 LTS.** The release was built with **Node.js v22.23.4** (npm 11). Any Node.js 22 release from 22.12.0 onward works. Download it from https://nodejs.org/ and accept the default options in the installer.
- **Git** is optional. You can download this repository as a ZIP from GitHub instead (green **Code** button → **Download ZIP**).
- **Python 3** is only needed if you want to re-download the ingredient data from UESP (optional, see below). It is not needed to build the app.

npm installs the exact tool versions recorded in `package-lock.json`:

| Package | Version | Purpose |
|---|---|---|
| electron | 33.4.11 | The runtime the app runs in |
| @electron/packager | 20.3.0 | Bundles the app into a Windows folder with an .exe |
| resedit | 3.1.0 | Pure-JavaScript tool that embeds the icon and version info into the .exe |

## Build steps
Open **Command Prompt** or **PowerShell** in the project folder (the folder that contains `package.json`) and run:

```
npm ci
npm test
npm run package:win
```

- `npm ci` installs the pinned dependencies from `package-lock.json`. `npm install` also works.
- `npm test` runs the alchemy logic tests. It should end with `8 tests passed`.
- `npm run package:win` runs `scripts/package-win.mjs`. That script:
  1. Packages the app with @electron/packager (win32/x64, with the app files in an `app.asar` archive).
  2. Runs `scripts/set_exe_icon.js` to embed `assets/icon.ico` and the version info into the .exe.

The build uses plain Node.js scripts, so it works the same way in Command Prompt, PowerShell, macOS or Linux.

## Output
```
dist\Skyrim Alchemy Companion-win32-x64\Skyrim Alchemy Companion.exe
```
The whole `dist\Skyrim Alchemy Companion-win32-x64\` folder is the program. To run it, double-click the .exe.

### Comparing with the released zip
The released `SkyrimAlchemyCompanion_win.zip` contains exactly this folder, with `README.md` and `BUILDING.md` copied into it. The `LICENSE` and `LICENSES.chromium.html` files inside the folder are Electron's own license files and are part of every Electron build. It was built from this source with the commands above.

- **The app code** is `resources\app.asar`. To list or extract its contents, run `npx asar list "dist\Skyrim Alchemy Companion-win32-x64\resources\app.asar"`. It contains only `package.json` and the files in `app/`, which are the same files you see in this repository.
- **Every other file** in the folder (DLLs, `.pak` files, `locales\`) comes unmodified from the official Electron 33.4.11 Windows x64 release.
- **The .exe** is the official `electron.exe`, renamed, with the icon and version info replaced.

The build is reproducible. Two independent builds from a clean extract of this source gave byte-identical files. SHA-256 hashes for release 1.0.0:

| File | SHA-256 |
|---|---|
| `Skyrim Alchemy Companion.exe` | `d31b809160c13b1a63b6c74dd4534f90dc260d5edc62dc7a4e0a6ebc4417c813` |
| `resources\app.asar` | `49f1f8bd021d5ff1aee5bec1d1c0282d6de8c79a01a3c297ef176f5b7fab833a` |

To check a hash, run `certutil -hashfile "<file>" SHA256` in Command Prompt or `Get-FileHash "<file>"` in PowerShell. The repository's `.gitattributes` keeps LF line endings on Windows, so `app.asar` comes out identical whether you clone the repository or download it as a ZIP.

## If npm warns about "install scripts"
Recent npm versions may print `install-scripts ... electron@33.4.11 (postinstall: node install.js)` and skip Electron's download step. **This does not affect `npm run package:win`**, because the packager downloads Electron for Windows by itself. It only matters for `npm start`, which runs the app without packaging it. To use `npm start`, run this once:
```
node node_modules/electron/install.js
```

## Optional: download mirror
`npm ci` and `npm run package:win` download the Electron binary from GitHub. If GitHub downloads are slow or blocked on your network, you can point them at a mirror before building. This only changes the download location, not what gets built.

```
PowerShell:      $env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
Command Prompt:  set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
```

## Optional: refresh the data from UESP
The ingredient data in `app/data/` is already included, so you don't need to do this to build the app. To regenerate it:
```
npm run data:fetch   (runs scripts/fetch_uesp.py, which downloads pages from the en.uesp.net API into scripts/raw/)
npm run data         (runs scripts/build_data.py, which writes app/data/alchemy.json and app/data/alchemy-data.js)
```

## What each folder contains
| Path | Contents |
|---|---|
| `app/` | The application itself, and the only code that ends up in the .exe's `app.asar`. `main.js` is the Electron main process: it creates the window and saves favorites. `preload.js` is a small, isolated bridge between `main.js` and the page. `index.html`, `renderer.js` and `styles.css` are the user interface. `alchemy.js` holds the potion formulas. `data/` holds the ingredient and effect data, and `icon.*` is the window icon. |
| `scripts/` | Build-time tools that never ship in the app. `fetch_uesp.py` and `build_data.py` are the data pipeline from UESP. `package-win.mjs` is the Windows packaging script. `set_exe_icon.js` embeds the icon into the .exe. |
| `tests/` | `logic.test.js` holds the formula and data tests (`npm test`). `ui/` holds a development-only harness and scripts used to take screenshots and check the interface. |
| `assets/` | The .exe icon (`icon.ico`) and the full-size icon artwork (`icon_1024.png`). |
| `docs/` | Screenshots used in the README. |

## Privacy and security notes
- **No network access at runtime.** The app makes no network requests. The page runs under a Content-Security-Policy of `default-src 'self'`, and the main process blocks opening new windows and navigating away. All data is bundled locally.
- **Locked-down renderer.** The page runs with `contextIsolation: true`, `nodeIntegration: false` and `sandbox: true`. It can only reach the main process to read and write favorites and to set the theme.
- **No telemetry, analytics, auto-update or ads.**
- **Local storage only.**
  - Favorites are saved to `%APPDATA%\Skyrim Alchemy Companion\favorites.json`.
  - The theme and source-filter choices are kept in the app's local storage in the same folder.
  - To remove all app data, delete that folder.
- **No installer or registry changes.** The app runs straight from the unzipped folder.
- **Unsigned.** The .exe is not code-signed, so Windows SmartScreen may show a warning the first time you run it.
