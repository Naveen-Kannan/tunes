const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    downloadSong: (youtubeUrl, playlistName) => ipcRenderer.invoke('download-song', { youtubeUrl, playlistName }),
    getDownloads: (playlistName) => ipcRenderer.invoke('get-downloads', playlistName),
    getPlaylists: () => ipcRenderer.invoke('get-playlists'),
    createPlaylist: (playlistName) => ipcRenderer.invoke('create-playlist', playlistName),
    deletePlaylist: (playlistName) => ipcRenderer.invoke('delete-playlist', playlistName),
    renamePlaylist: (oldName, newName) => ipcRenderer.invoke('rename-playlist', oldName, newName),
    addSongToPlaylist: (filename, playlistName) => ipcRenderer.invoke('add-song-to-playlist', { filename, playlistName }),
    removeSongFromPlaylist: (filePath, playlistName) => ipcRenderer.invoke('remove-song-from-playlist', { filePath, playlistName })
});
