const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');
const registerIpcHandlers = require('./src/ipc/handlers');
const pathManager = require('./src/utils/paths');
const playlistStore = require('./src/services/store');
const downloader = require('./src/services/downloader');

// Initialize Services
pathManager.initialize();
playlistStore.initialize();
downloader.initialize();

// Register IPC Handlers
const { ipcMain, shell } = require('electron');

// We need to re-register the download handler here if we want to log requests in main process stdout
// But we moved it to ipc/handlers.js. Let's just use that.

registerIpcHandlers();

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 15, y: 15 },
        backgroundColor: '#000000', // Matches your CSS
    });

    mainWindow.loadFile('index.html');

    // Open DevTools in dev mode
    // mainWindow.webContents.openDevTools(); 
}

app.whenReady().then(() => {
    createWindow();

    // Register media keys
    globalShortcut.register('MediaPlayPause', () => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            windows[0].webContents.send('media-play-pause');
        }
    });

    globalShortcut.register('MediaNextTrack', () => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            windows[0].webContents.send('media-next-track');
        }
    });

    globalShortcut.register('MediaPreviousTrack', () => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            windows[0].webContents.send('media-prev-track');
        }
    });

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
