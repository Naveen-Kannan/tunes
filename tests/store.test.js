const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), os = require('os'), Module = require('module');
let root;
const app = { isPackaged: false, getPath: name => path.join(root, name) };
const load = Module._load;
Module._load = function(name, ...args) { return name === 'electron' ? { app } : load.call(this, name, ...args); };
const manager = require('../src/utils/paths'), store = require('../src/services/store');
Module._load = load;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'tunes-review-')); manager.initialize(); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); app.isPackaged = false; });
const file = () => path.join(manager.getAllDownloadsDir(), 'song.mp3');

test('playlist paths and song names cannot escape their library', () => {
    for (const name of ['../outside', 'nested/name', 'nested\\name', '']) assert.throws(() => manager.getPlaylistPath(name));
    for (const name of ['../song.mp3', '/song.mp3', 'nested\\song.mp3', 'not-a-song.json']) assert.throws(() => manager.getSongPath(name));
});
test('malformed playlists are never overwritten by add operations', async () => {
    const playlist = manager.getPlaylistPath('broken');
    for (const value of ['{', '{}', '["../song.mp3"]', '[null]']) {
        fs.writeFileSync(playlist, value);
        await assert.rejects(store.addSongToPlaylist('broken', 'song.mp3'));
        assert.equal(fs.readFileSync(playlist, 'utf8'), value);
    }
});
test('failed atomic replacement preserves the playlist and cleans up', () => {
    store.writePlaylist('keep', ['song.mp3']);
    const rename = fs.renameSync;
    fs.renameSync = () => { throw new Error('fixture'); };
    try { assert.equal(store.writePlaylist('keep', []), false); } finally { fs.renameSync = rename; }
    assert.deepEqual(store.readPlaylist('keep'), ['song.mp3']);
    assert.equal(fs.readdirSync(manager.getDownloadsDir()).some(name => name.endsWith('.tmp')), false);
});
test('delete rejects sibling directories and symlinks without changing playlists', async () => {
    store.writePlaylist('keep', ['song.mp3']);
    const sibling = manager.getDownloadsDir() + '-backup';
    fs.mkdirSync(sibling);
    const outside = path.join(sibling, 'song.mp3'); fs.writeFileSync(outside, 'fixture');
    assert.equal((await store.deleteSongFile(outside)).success, false);
    fs.symlinkSync(outside, file());
    assert.equal((await store.deleteSongFile(file())).success, false);
    assert.equal(fs.existsSync(outside), true);
    assert.deepEqual(store.readPlaylist('keep'), ['song.mp3']);
});
test('failed deletion restores playlist references', async () => {
    fs.writeFileSync(file(), 'fixture'); store.writePlaylist('keep', ['song.mp3']);
    const unlink = fs.unlinkSync;
    fs.unlinkSync = name => { if (name === file()) throw new Error('fixture'); return unlink(name); };
    try { assert.equal((await store.deleteSongFile(file())).success, false); } finally { fs.unlinkSync = unlink; }
    assert.deepEqual(store.readPlaylist('keep'), ['song.mp3']);
    assert.equal(fs.existsSync(file()), true);
});
test('successful deletion removes the song and references', async () => {
    fs.writeFileSync(file(), 'fixture'); store.writePlaylist('keep', ['song.mp3', 'other.mp3']);
    assert.equal((await store.deleteSongFile(file())).success, true);
    assert.equal(fs.existsSync(file()), false);
    assert.deepEqual(store.readPlaylist('keep'), ['other.mp3']);
});
test('legacy imports cannot resurrect deleted songs', () => {
    app.isPackaged = true;
    const previous = process.resourcesPath; process.resourcesPath = path.join(root, 'resources');
    const legacy = path.join(process.resourcesPath, 'app.asar.unpacked/music-downloads/All_Downloads');
    fs.mkdirSync(legacy, { recursive: true }); fs.writeFileSync(path.join(legacy, 'song.mp3'), 'fixture');
    try {
        store.initialize(); assert.equal(fs.existsSync(file()), true);
        fs.unlinkSync(file()); store.initialize(); assert.equal(fs.existsSync(file()), false);
    } finally { process.resourcesPath = previous; }
});
test('existing canonical libraries are authoritative during upgrade', () => {
    fs.writeFileSync(file(), 'fixture'); let imported = false;
    const merge = store.mergeLegacyData; store.mergeLegacyData = () => { imported = true; };
    try { store.initialize(); } finally { store.mergeLegacyData = merge; }
    assert.equal(imported, false); assert.equal(fs.readFileSync(file(), 'utf8'), 'fixture');
});
