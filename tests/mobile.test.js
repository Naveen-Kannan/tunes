const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const { once } = require('events');
const Module = require('module');
let root;
const load = Module._load;
Module._load = function(name, ...args) {
    if (name === '../services/store') return {};
    if (name === '../utils/paths') return { getSongPath: filename => {
        if (path.basename(filename) !== filename || path.extname(filename) !== '.mp3') throw Error('invalid');
        return path.join(root, filename);
    } };
    return load.call(this, name, ...args);
};
const mobile = require('../src/mobile/server');
Module._load = load;
function request(port, route, headers = {}) {
    return new Promise((resolve, reject) => {
        http.get({ hostname: '127.0.0.1', port, path: route, headers }, response => {
            let body = '';
            response.on('data', chunk => { body += chunk; });
            response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
        }).on('error', reject);
    });
}
test('mobile streaming returns correct ranges and rejects symlinks', async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'tunes-stream-'));
    fs.writeFileSync(path.join(root, 'song.mp3'), '0123456789');
    fs.symlinkSync(path.join(root, 'song.mp3'), path.join(root, 'alias.mp3'));
    const server = mobile.start({ port: 0, bindAddress: '127.0.0.1' });
    await once(server, 'listening');
    try {
        const port = server.address().port;
        const partial = await request(port, '/stream/song.mp3', { Range: 'bytes=3-100' });
        assert.equal(partial.status, 206); assert.equal(partial.body, '3456789');
        assert.equal(partial.headers['content-range'], 'bytes 3-9/10');
        const invalid = await request(port, '/stream/song.mp3', { Range: 'bytes=100-' });
        assert.equal(invalid.status, 416); assert.equal(invalid.headers['content-range'], 'bytes */10');
        assert.equal((await request(port, '/stream/alias.mp3')).status, 404);
        assert.equal((await request(port, '/stream/%ZZ')).status, 400);
    } finally {
        mobile.stop(); await once(server, 'close'); fs.rmSync(root, { recursive: true, force: true });
    }
});
test('occupied mobile ports fail without crashing and allow a later start', async () => {
    const blocker = http.createServer(); blocker.listen(0, '127.0.0.1'); await once(blocker, 'listening');
    const failed = mobile.start({ port: blocker.address().port, bindAddress: '127.0.0.1' });
    const [error] = await once(failed, 'error'); assert.equal(error.code, 'EADDRINUSE');
    const replacement = mobile.start({ port: 0, bindAddress: '127.0.0.1' }); await once(replacement, 'listening');
    mobile.stop(); await once(replacement, 'close'); blocker.close(); await once(blocker, 'close');
});
