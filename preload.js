const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onDictationControl: callback => {
        ipcRenderer.on('dictation-control', async (_event, request) => {
            try {
                const result = await callback(request.action, request.token);
                ipcRenderer.send('dictation-control-result', { ...result, requestID: request.requestID });
            } catch (error) {
                ipcRenderer.send('dictation-control-result', { requestID: request.requestID, error: error.message });
            }
        });
    },
    downloadSong: (youtubeUrl, playlistName) => ipcRenderer.invoke('download-song', { youtubeUrl, playlistName }),
    getDownloads: (playlistName) => ipcRenderer.invoke('get-downloads', playlistName),
    getPlaylists: () => ipcRenderer.invoke('get-playlists'),
    createPlaylist: (playlistName) => ipcRenderer.invoke('create-playlist', playlistName),
    deletePlaylist: (playlistName) => ipcRenderer.invoke('delete-playlist', playlistName),
    renamePlaylist: (oldName, newName) => ipcRenderer.invoke('rename-playlist', oldName, newName),
    addSongToPlaylist: (filename, playlistName) => ipcRenderer.invoke('add-song-to-playlist', { filename, playlistName }),
    removeSongFromPlaylist: (filePath, playlistName) => ipcRenderer.invoke('remove-song-from-playlist', { filePath, playlistName }),
    deleteSongFile: (filePath) => ipcRenderer.invoke('delete-song-file', { filePath }),
    on: (channel, callback) => {
        const validChannels = ['media-play-pause', 'media-next-track', 'media-prev-track'];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => callback(...args));
        }
    },
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    searchYouTube: (query) => ipcRenderer.invoke('search-youtube', query)
});
