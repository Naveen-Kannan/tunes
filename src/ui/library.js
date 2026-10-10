(function (root) {
    function selectSongs(songs, query = '') {
        const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
        const result = songs.filter(song => {
            const text = `${song.title || song.filename} ${song.artist || ''}`.toLocaleLowerCase();
            return words.every(word => text.includes(word));
        });
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
