const { test } = require('node:test');
const assert = require('node:assert/strict');
const createPlayback = require('../src/playback/dictation');

function player(paused = false) {
    const listeners = {};
    return {
        src: 'file:///song.mp3', paused, ended: false, plays: 0,
        addEventListener(event, callback) { listeners[event] = callback; },
        pause() { this.paused = true; },
        async play() { this.paused = false; this.plays++; listeners.play?.(); },
    };
}

test('pause preserves position and resumes once, including repeated events', async () => {
    const audio = player();
    audio.currentTime = 42;
    const playback = createPlayback(audio);
    playback.begin('a'); playback.begin('a');
    assert.equal(audio.paused, true);
    await playback.end('a'); await playback.end('a');
    assert.equal(audio.plays, 1);
    assert.equal(audio.currentTime, 42);
});

test('already paused and unknown tokens cannot start music', async () => {
    const audio = player(true);
    const playback = createPlayback(audio);
    playback.begin('a');
    await playback.end('b'); await playback.end('a');
    assert.equal(audio.plays, 0);
});

test('overlapping recordings wait for the last stop', async () => {
    const audio = player();
    const playback = createPlayback(audio);
    playback.begin('a'); playback.begin('b');
    await playback.end('a');
    assert.equal(audio.paused, true);
    await playback.end('b');
    assert.equal(audio.plays, 1);
});

test('manual playback and track changes override resume', async () => {
    for (const override of ['play', 'track']) {
        const audio = player();
        const playback = createPlayback(audio);
        playback.begin('a');
        if (override === 'play') { await audio.play(); audio.pause(); }
        else audio.src = 'file:///new.mp3';
        const before = audio.plays;
        await playback.end('a');
        assert.equal(audio.plays, before);
    }
});

test('a lost client recovers playback after its lease expires', async () => {
    const audio = player();
    const playback = createPlayback(audio, 10);
    playback.begin('a');
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(audio.paused, false);
    assert.equal(audio.plays, 1);
});

test('heartbeat renews a long recording without overriding manual playback', async () => {
    const audio = player();
    const playback = createPlayback(audio, 100);
    playback.begin('a');
    await new Promise(resolve => setTimeout(resolve, 60));
    playback.begin('a');
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.equal(audio.paused, true);
    await audio.play();
    playback.begin('a');
    assert.equal(audio.paused, false);
    await playback.end('a');
    assert.equal(audio.plays, 1);
});
