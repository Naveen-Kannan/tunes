(function (root) {
    function createDictationPlayback(audio, leaseMs = 10 * 60 * 1000) {
        const leases = new Map();
        let resumeSource = null;

        // A user's play/track change takes precedence over automatic restoration.
        audio.addEventListener('play', () => { resumeSource = null; });
        audio.addEventListener('emptied', () => { resumeSource = null; });

        function begin(token) {
            const renewal = leases.has(token);
            if (renewal) {
                clearTimeout(leases.get(token));
            }
            if (!leases.has(token) && leases.size >= 64) throw new Error('too many recording sessions');
            if (leases.size === 0) {
                resumeSource = !audio.paused && !audio.ended ? audio.src : null;
            }
            if (!renewal) audio.pause();
            const timer = setTimeout(() => {
                end(token).catch(console.error);
            }, leaseMs);
            leases.set(token, timer);
            return { paused: audio.paused };
        }

        async function end(token) {
            if (!leases.has(token)) return { resumed: false };
            clearTimeout(leases.get(token));
            leases.delete(token);
            if (leases.size !== 0) return { resumed: false };
            const source = resumeSource;
            resumeSource = null;
            if (source && audio.src === source && audio.paused && !audio.ended) {
                await audio.play();
                return { resumed: true };
            }
            return { resumed: false };
        }

        return { begin, end };
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = createDictationPlayback;
    } else {
        root.createDictationPlayback = createDictationPlayback;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
