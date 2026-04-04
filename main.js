const { app, BrowserWindow, globalShortcut } = require('electron');
const http = require('http');
const path = require('path');
const registerIpcHandlers = require('./src/ipc/handlers');
const pathManager = require('./src/utils/paths');
const playlistStore = require('./src/services/store');
const downloader = require('./src/services/downloader');
const controlPort = 47631;
let controlServer = null;

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
    return mainWindow;
}

function sendPlaybackEvent(channel) {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        windows[0].webContents.send(channel);
        return;
    }

    const mainWindow = createWindow();
    mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.send(channel);
    });
}

function startControlServer() {
    const actions = {
        '/control/play_pause': 'media-play-pause',
        '/control/next': 'media-next-track',
        '/control/previous': 'media-prev-track'
    };

    controlServer = http.createServer((req, res) => {
        if (req.method !== 'POST') {
            res.writeHead(405);
            res.end('method not allowed');
            return;
        }

        const channel = actions[req.url];
        if (!channel) {
            res.writeHead(404);
            res.end('not found');
            return;
        }

        sendPlaybackEvent(channel);
        res.writeHead(204);
        res.end();
    });

    controlServer.listen(controlPort, '127.0.0.1');
}

app.whenReady().then(() => {
    createWindow();
    startControlServer();

    // Register media keys
    globalShortcut.register('MediaPlayPause', () => {
        sendPlaybackEvent('media-play-pause');
    });

    globalShortcut.register('MediaNextTrack', () => {
        sendPlaybackEvent('media-next-track');
    });

    globalShortcut.register('MediaPreviousTrack', () => {
        sendPlaybackEvent('media-prev-track');
    });

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    if (controlServer) {
        controlServer.close();
        controlServer = null;
    }
});
