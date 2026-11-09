const { app, BrowserWindow, ipcMain, nativeTheme, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const favFile = () => path.join(app.getPath('userData'), 'favorites.json');

function readFavorites() {
  try { return JSON.parse(fs.readFileSync(favFile(), 'utf8')); } catch { return []; }
}
function writeFavorites(list) {
  fs.mkdirSync(path.dirname(favFile()), { recursive: true });
  fs.writeFileSync(favFile(), JSON.stringify(list, null, 2), 'utf8');
  return true;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 1024, minHeight: 680,
    title: 'Skyrim Alchemy Companion',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0d0d0d' : '#f4efe4',
    autoHideMenuBar: true,
    icon: path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  // Offline app: never open new windows or navigate away from the bundled page.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.handle('favorites:get', () => readFavorites());
ipcMain.handle('favorites:set', (_e, list) => writeFavorites(Array.isArray(list) ? list : []));
ipcMain.handle('theme:set', (_e, mode) => { nativeTheme.themeSource = ['light', 'dark', 'system'].includes(mode) ? mode : 'system'; return nativeTheme.shouldUseDarkColors; });

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
