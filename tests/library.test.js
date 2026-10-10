const { test } = require('node:test');
const assert = require('node:assert/strict');
const { selectSongs, summarizeSongs, songURL } = require('../src/ui/library');
const songs = [
    { title: 'Song 10', artist: 'Evan Call', filename: '10.mp3', duration: 120 },
    { title: 'Song 2', artist: 'YOASOBI', filename: '2.mp3', duration: 240 },
    { title: '勇者', artist: 'YOASOBI', filename: 'jp.mp3', duration: 0 }
];
test('filter matches title and artist, without altering playlist order', () => {
    assert.deepEqual(selectSongs(songs, 'yoasobi song').map(s=>s.filename), ['2.mp3']);
    assert.deepEqual(selectSongs(songs, '勇者').map(s=>s.filename), ['jp.mp3']);
    assert.deepEqual(selectSongs(songs, 'nothing'), []);
    assert.deepEqual(selectSongs(songs, '   '), songs);
});
test('filter preserves playlist order and does not mutate the source', () => {
    const original = [...songs];
    assert.deepEqual(selectSongs(songs, 'song'), [songs[0], songs[1]]);
    assert.deepEqual(selectSongs(songs), original);
    assert.deepEqual(songs, original);
});
test('summaries handle empty libraries and missing duration metadata', () => {
    assert.equal(summarizeSongs([]), '0 songs · 0 min');
    assert.equal(summarizeSongs([{ filename: 'missing.mp3' }]), '1 song · 0 min');
    assert.equal(summarizeSongs([{ duration: 3660 }]), '1 song · 1 hr 1 min');
});
test('file URLs preserve spaces, punctuation and unicode in local song paths', () => {
    const file = '/Users/example/Music/勇者 #1? 100%.mp3';
    const url = new URL(songURL(file));
    assert.equal(url.hash, '');
    assert.equal(url.search, '');
    assert.equal(decodeURIComponent(url.pathname), file);
});
