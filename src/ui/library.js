(function (root) {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    function selectSongs(songs, query = '', sort = 'order') {
        const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
        const result = songs.filter(song => {
            const text = `${song.title || song.filename} ${song.artist || ''}`.toLocaleLowerCase();
            return words.every(word => text.includes(word));
        });
        if (sort === 'title' || sort === 'title-desc') {
            result.sort((a, b) => collator.compare(a.title || a.filename, b.title || b.filename) * (sort === 'title' ? 1 : -1));
        } else if (sort === 'duration') {
            result.sort((a, b) => (b.duration || 0) - (a.duration || 0));
        }
        return result;
    }
    function summarizeSongs(songs) {
        const minutes = Math.round(songs.reduce((sum, song) => sum + (song.duration || 0), 0) / 60);
        const time = minutes >= 60 ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min` : `${minutes} min`;
        return `${songs.length} ${songs.length === 1 ? 'song' : 'songs'} · ${time}`;
    }
    function songURL(filePath) {
        return `file://${filePath.split('/').map(encodeURIComponent).join('/')}`;
    }
    const api = { selectSongs, summarizeSongs, songURL };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.tunesLibrary = api;
})(globalThis);
