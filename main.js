const { app, BrowserWindow, globalShortcut } = require('electron');
const http = require('http');
const path = require('path');
const registerIpcHandlers = require('./src/ipc/handlers');
const pathManager = require('./src/utils/paths');
const playlistStore = require('./src/services/store');
const downloader = require('./src/services/downloader');
const mobileServer = require('./src/mobile/server');
const controlPort = 47631;
let controlServer = null;
let controlRequestID = 0;
const pendingControls = new Map();

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
        height: 760,
        minWidth: 660,
        minHeight: 520,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 16, y: 19 },
        backgroundColor: '#151515',
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

ipcMain.on('dictation-control-result', (event, result) => {
    const pending = pendingControls.get(result.requestID);
    if (pending && pending.webContents === event.sender) pending.finish(result);
});

function dictationControl(action, token) {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) return Promise.resolve({ paused: true, resumed: false });
    return new Promise((resolve, reject) => {
        const requestID = ++controlRequestID;
        const finish = result => {
            clearTimeout(timer);
            pendingControls.delete(requestID);
            if (result.error) reject(new Error(result.error));
            else resolve(result);
        };
        const timer = setTimeout(() => finish({ error: 'player did not respond' }), 600);
        pendingControls.set(requestID, { webContents: window.webContents, finish });
        window.webContents.send('dictation-control', { requestID, action, token });
    });
}

function startControlServer() {
    const actions = {
        '/control/play_pause': 'media-play-pause',
        '/control/next': 'media-next-track',
        '/control/previous': 'media-prev-track'
    };

    controlServer = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1');
        const match = url.pathname.match(/^\/control\/dictation\/(begin|end)$/);
        if (match || (req.method === 'GET' && url.pathname === '/control/state')) {
            const action = match ? match[1] : 'state';
            const token = url.searchParams.get('token');
            if (match && req.method !== 'POST') {
                res.writeHead(405).end('method not allowed');
                return;
            }
            if (match && !/^[0-9a-f-]{36}$/i.test(token || '')) {
                res.writeHead(400).end('invalid recording token');
                return;
            }
            try {
                const result = await dictationControl(action, token);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                res.writeHead(503).end(error.message);
            }
            return;
        }
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
    mobileServer.start();

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
    mobileServer.stop();
});
