const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { URL } = require('url');
const playlistStore = require('../services/store');
const pathManager = require('../utils/paths');
const parseRange = require('./range');

const mobilePort = 47632;
let server = null;

function sendJson(res, statusCode, body) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify(body));
}

function sendText(res, statusCode, text) {
    res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(text);
}

function serveStatic(res, filePath, contentType) {
    fs.readFile(filePath, (error, data) => {
        if (error) {
            sendText(res, 404, 'not found');
            return;
        }

        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-store'
        });
        res.end(data);
    });
}

function getMobileFilePath(pathname) {
    const staticDir = path.join(__dirname, 'static');
    if (pathname === '/' || pathname === '/mobile') {
        return { filePath: path.join(staticDir, 'index.html'), contentType: 'text/html; charset=utf-8' };
    }
    if (pathname === '/mobile/app.css') {
        return { filePath: path.join(staticDir, 'app.css'), contentType: 'text/css; charset=utf-8' };
    }
    if (pathname === '/mobile/app.js') {
        return { filePath: path.join(staticDir, 'app.js'), contentType: 'application/javascript; charset=utf-8' };
    }
    if (pathname === '/mobile/manifest.webmanifest') {
        return { filePath: path.join(staticDir, 'manifest.webmanifest'), contentType: 'application/manifest+json; charset=utf-8' };
    }
    if (pathname === '/mobile/icon.png') {
        return { filePath: path.join(__dirname, '../../icon.png'), contentType: 'image/png' };
    }
    return null;
}

async function handleApi(req, res, url) {
    if (url.pathname === '/api/playlists' && req.method === 'GET') {
        const playlists = await playlistStore.getPlaylists();
        sendJson(res, 200, { success: true, playlists });
        return;
    }

    if (url.pathname === '/api/songs' && req.method === 'GET') {
        const playlistName = url.searchParams.get('playlist') || 'All_Downloads';
        const songs = await playlistStore.getDownloads(playlistName);
        sendJson(res, 200, {
            success: true,
            songs: songs.map(song => ({
                filename: song.filename,
                title: song.title,
                artist: song.artist,
                duration: song.duration
            }))
        });
        return;
    }

    sendJson(res, 404, { success: false, error: 'Not found' });
}

function handleStream(req, res, url) {
    let filePath;
    try { filePath = pathManager.getSongPath(decodeURIComponent(url.pathname.slice('/stream/'.length))); }
    catch { sendText(res, 400, 'invalid filename'); return; }

    if (!fs.existsSync(filePath) || !fs.lstatSync(filePath).isFile()) {
        sendText(res, 404, 'not found');
        return;
    }

    const stat = fs.statSync(filePath);
    const range = parseRange(req.headers.range, stat.size);
    if (range === false) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end();
        return;
    }
    if (range) {
        res.writeHead(206, {
            'Content-Type': 'audio/mpeg',
            'Accept-Ranges': 'bytes',
            'Content-Length': range.end - range.start + 1,
            'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}`
        });
        streamFile(filePath, res, range);
        return;
    }

    res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Accept-Ranges': 'bytes',
        'Content-Length': stat.size
    });
    streamFile(filePath, res);
}

function streamFile(filePath, res, range) {
    const stream = fs.createReadStream(filePath, range);
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
}

function isTailscaleIPv4(address) {
    const parts = address.split('.').map(part => Number(part));
    return parts.length === 4 &&
        parts[0] === 100 &&
        parts[1] >= 64 &&
        parts[1] <= 127 &&
        parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255);
}

function getTailscaleAddress() {
    const interfaces = os.networkInterfaces();
    for (const addresses of Object.values(interfaces)) {
        for (const addressInfo of addresses || []) {
            if (addressInfo.family === 'IPv4' && !addressInfo.internal && isTailscaleIPv4(addressInfo.address)) {
                return addressInfo.address;
            }
        }
    }
    return null;
}

function start({ port = mobilePort, bindAddress = getTailscaleAddress() || '127.0.0.1' } = {}) {
    if (server) return server;
    server = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
            const mobileFile = getMobileFilePath(url.pathname);
            if (mobileFile && req.method === 'GET') {
                serveStatic(res, mobileFile.filePath, mobileFile.contentType);
                return;
            }
            if (url.pathname.startsWith('/api/')) {
                await handleApi(req, res, url);
                return;
            }
            if (url.pathname.startsWith('/stream/') && req.method === 'GET') {
                handleStream(req, res, url);
                return;
            }
        } catch (error) {
            console.error('Mobile server error:', error);
            sendJson(res, 500, { success: false, error: error.message });
            return;
        }

        sendText(res, 404, 'not found');
    });

    const instance = server;
    server.on('error', error => {
        console.error('Mobile server unavailable:', error.message);
        if (server === instance) server = null;
    });
    server.listen(port, bindAddress, () => {
        console.log(`Tunes mobile server listening on http://${bindAddress}:${mobilePort}/mobile`);
        if (bindAddress === '127.0.0.1') {
            console.log('No Tailscale IPv4 address was detected; mobile server is localhost-only.');
        }
    });
    return instance;
}

function stop() {
    if (!server) return;
    server.close();
    server = null;
}

module.exports = { start, stop };
