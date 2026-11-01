const { app, BrowserWindow, shell, Menu, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let mainWindow;
let updateCheckInProgress = false;
let manualUpdateCheck = false;

// Updates are downloaded in the background and installed when the user restarts.
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowDowngrade = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 650,
    title: 'Mr Pryer Math Version 8 Deep Sea',
    icon: path.join(__dirname, 'anchor.ico'),
    backgroundColor: '#061522',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

async function checkForUpdates(manual = false) {
  if (!app.isPackaged) {
    if (manual) dialog.showMessageBox({ type: 'info', title: 'MP Math Updates', message: 'Update checks are available in the installed version.' });
    return;
  }
  if (updateCheckInProgress) return;
  updateCheckInProgress = true;
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    console.error('Update check failed:', error);
    if (manual) dialog.showMessageBox({ type: 'warning', title: 'Could not check for updates', message: 'MP Math could not contact the update server. Check your internet connection and try again.', detail: error.message });
  } finally {
    updateCheckInProgress = false;
    // The updater events below report whether a manual check found anything.
  }
}

autoUpdater.on('checking-for-update', () => console.log('Checking for MP Math updates...'));
autoUpdater.on('update-available', info => {
  console.log(`MP Math update available: ${info.version}`);
  if (mainWindow) mainWindow.setTitle(`Mr Pryer Math Version 8 Deep Sea - Updating to ${info.version}`);
});
autoUpdater.on('update-not-available', () => {
  console.log('MP Math is up to date.');
  if (manualUpdateCheck) dialog.showMessageBox({ type: 'info', title: 'MP Math Updates', message: 'You are already running the latest version.' });
  manualUpdateCheck = false;
});
autoUpdater.on('update-available', info => {
  if (manualUpdateCheck) console.log(`Manual check found version ${info.version}. Downloading it now.`);
  manualUpdateCheck = false;
});
autoUpdater.on('download-progress', progress => {
  console.log(`MP Math update download: ${Math.round(progress.percent)}%`);
});
autoUpdater.on('update-downloaded', async info => {
  const choice = await dialog.showMessageBox({
    type: 'info',
    title: 'MP Math update ready',
    message: `Version ${info.version} has downloaded and is ready to install.`,
    detail: 'Save your progress, then restart MP Math to finish updating.',
    buttons: ['Restart and install', 'Later'],
    defaultId: 0,
    cancelId: 1
  });
  if (choice.response === 0) autoUpdater.quitAndInstall();
});
autoUpdater.on('error', error => console.error('MP Math updater error:', error));

function installApplicationMenu() {
  const template = [
    {
      label: 'File',
      submenu: [{ role: 'quit', label: 'Exit MP Math' }]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates...',
          click: () => { manualUpdateCheck = true; checkForUpdates(true); }
        },
        { type: 'separator' },
        {
          label: 'About MP Math',
          click: () => dialog.showMessageBox({
            type: 'info',
            title: 'About MP Math',
            message: 'Mr Pryer Math Version 8 Deep Sea',
            detail: `Version ${app.getVersion()}\nDeep Sea Platinum Edition`
          })
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  installApplicationMenu();
  createWindow();
  // Give the first window time to appear before checking GitHub Releases.
  setTimeout(() => checkForUpdates(false), 3500);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
