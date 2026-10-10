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
test('title sorting is natural and reversible, with original order retained', () => {
    const original = [...songs];
    const ascending = selectSongs(songs, '', 'title');
    assert.equal(ascending.indexOf(songs[1]) < ascending.indexOf(songs[0]), true);
    assert.deepEqual(selectSongs(songs, '', 'title-desc'), [...ascending].reverse());
    assert.deepEqual(selectSongs(songs), original);
    assert.deepEqual(songs, original);
});
test('duration sorting handles missing metadata and summaries handle empty libraries', () => {
    assert.equal(selectSongs([...songs, { filename: 'missing.mp3' }], '', 'duration')[0], songs[1]);
    assert.equal(summarizeSongs([]), '0 songs · 0 min');
    assert.equal(summarizeSongs([{ duration: 3660 }]), '1 song · 1 hr 1 min');
});
test('file URLs preserve spaces, punctuation and unicode in local song paths', () => {
    const file = '/Users/example/Music/勇者 #1? 100%.mp3';
    const url = new URL(songURL(file));
    assert.equal(url.hash, '');
    assert.equal(url.search, '');
    assert.equal(decodeURIComponent(url.pathname), file);
});
