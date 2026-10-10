const { test } = require('node:test');
const assert = require('node:assert/strict');
const parseRange = require('../src/mobile/range');
test('range requests clamp the end and support suffix and open ranges', () => {
    assert.deepEqual(parseRange('bytes=2-500', 10), { start: 2, end: 9 });
    assert.deepEqual(parseRange('bytes=3-', 10), { start: 3, end: 9 });
    assert.deepEqual(parseRange('bytes=-3', 10), { start: 7, end: 9 });
    assert.deepEqual(parseRange('bytes=-50', 10), { start: 0, end: 9 });
    assert.equal(parseRange(undefined, 10), null);
});
test('unsatisfiable or malformed ranges are rejected', () => {
    for (const header of ['bytes=10-', 'bytes=3-2', 'bytes=-0', 'bytes=-', 'bad', 'bytes=0-1,3-4']) assert.equal(parseRange(header, 10), false);
    assert.equal(parseRange('bytes=0-', 0), false);
});
