const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { URL } = require('url');
const playlistStore = require('../services/store');
const pathManager = require('../utils/paths');

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

function parseRange(rangeHeader, fileSize) {
    if (!rangeHeader) return null;
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
    if (!match) return null;

    let start;
    let end;
    if (!match[1] && match[2]) {
        const suffixLength = Number(match[2]);
        if (Number.isNaN(suffixLength) || suffixLength <= 0) return null;
        start = Math.max(fileSize - suffixLength, 0);
        end = fileSize - 1;
    } else {
        start = match[1] ? Number(match[1]) : 0;
        end = match[2] ? Number(match[2]) : fileSize - 1;
    }

    if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= fileSize) {
        return null;
    }
    return { start, end };
}

function handleStream(req, res, url) {
    const encodedFilename = url.pathname.slice('/stream/'.length);
    const filename = decodeURIComponent(encodedFilename);
    if (!filename || path.basename(filename) !== filename || path.extname(filename).toLowerCase() !== '.mp3') {
        sendText(res, 400, 'invalid filename');
        return;
    }

    const filePath = path.join(pathManager.getAllDownloadsDir(), filename);
    if (!fs.existsSync(filePath)) {
        sendText(res, 404, 'not found');
        return;
    }

    const stat = fs.statSync(filePath);
    const range = parseRange(req.headers.range, stat.size);
    if (range) {
        res.writeHead(206, {
            'Content-Type': 'audio/mpeg',
            'Accept-Ranges': 'bytes',
            'Content-Length': range.end - range.start + 1,
            'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}`
        });
        fs.createReadStream(filePath, range).pipe(res);
        return;
    }

    res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Accept-Ranges': 'bytes',
        'Content-Length': stat.size
    });
    fs.createReadStream(filePath).pipe(res);
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

function start() {
    if (server) return;
    const bindAddress = getTailscaleAddress() || '127.0.0.1';
    server = http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
        const mobileFile = getMobileFilePath(url.pathname);
        if (mobileFile && req.method === 'GET') {
            serveStatic(res, mobileFile.filePath, mobileFile.contentType);
            return;
        }

        try {
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

    server.listen(mobilePort, bindAddress, () => {
        console.log(`Tunes mobile server listening on http://${bindAddress}:${mobilePort}/mobile`);
        if (bindAddress === '127.0.0.1') {
            console.log('No Tailscale IPv4 address was detected; mobile server is localhost-only.');
        }
    });
}

function stop() {
    if (!server) return;
    server.close();
    server = null;
}

module.exports = { start, stop };
