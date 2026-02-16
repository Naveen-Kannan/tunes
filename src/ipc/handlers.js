const { ipcMain, shell } = require('electron');
const downloader = require('../services/downloader');
const playlistStore = require('../services/store');

const searchService = require('../services/search');

module.exports = function registerIpcHandlers() {
    // Download handlers
    ipcMain.handle('download-song', async (event, { youtubeUrl, playlistName }) => {
        try {
            return await downloader.downloadSong(youtubeUrl, playlistName);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Search handler
    ipcMain.handle('search-youtube', async (event, query) => {
        return await searchService.search(query);
    });

    // Playlist handlers
    ipcMain.handle('get-playlists', async () => {
        return await playlistStore.getPlaylists();
    });

    ipcMain.handle('get-downloads', async (event, playlistName) => {
        return await playlistStore.getDownloads(playlistName);
    });

    ipcMain.handle('create-playlist', async (event, playlistName) => {
        return await playlistStore.createPlaylist(playlistName);
    });

    ipcMain.handle('delete-playlist', async (event, playlistName) => {
        return await playlistStore.deletePlaylist(playlistName);
    });

    ipcMain.handle('rename-playlist', async (event, oldName, newName) => {
        return await playlistStore.renamePlaylist(oldName, newName);
    });

    // Song management handlers
    ipcMain.handle('add-song-to-playlist', async (event, { filename, playlistName }) => {
        try {
            const success = await playlistStore.addSongToPlaylist(playlistName, filename);
            return { success };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('remove-song-from-playlist', async (event, { filePath, playlistName }) => {
        const filename = require('path').basename(filePath);
        try {
            const result = await playlistStore.removeSongFromPlaylist(playlistName, filename);
            return { success: result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-song-file', async (event, { filePath }) => {
        try {
            // Need to fix store.js to accept full path logic if needed, or reimplement
            // The file path logic was moved to store.js
            return await playlistStore.deleteSongFile(filePath);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // External link handler
    ipcMain.handle('open-external', async (event, url) => {
        try {
            await shell.openExternal(url);
        } catch (error) {
            console.error('Error opening external URL:', error);
        }
    });
};
