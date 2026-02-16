const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const pathManager = require('../utils/paths');

class PlaylistStore {
    initialize() {
        pathManager.initialize();
        this.mergeLegacyData();
        this.migratePlaylists();
    }

    mergeLegacyData() {
        const downloadsDir = pathManager.getDownloadsDir();

        // 1. Local development folder (music-downloads in project root)
        // We assume project root is 2 levels up from services/store.js (src/services) -> src -> root
        // Actually, __dirname is src/services. So ../../music-downloads
        const localMusicDir = path.join(__dirname, '../../music-downloads');
        if (fs.existsSync(localMusicDir)) {
            console.log(`Merging data from local directory: ${localMusicDir}...`);
            this.mergeDirectories(localMusicDir, downloadsDir);
        }

        // 2. Old Production/UserData folder
        const userDataMusicDir = path.join(app.getPath('userData'), 'music-downloads');
        if (fs.existsSync(userDataMusicDir)) {
            console.log(`Merging data from userData directory: ${userDataMusicDir}...`);
            this.mergeDirectories(userDataMusicDir, downloadsDir);
        }

        // 3. Initial app resources (for fresh installs that might come with bundled music)
        if (app.isPackaged) {
            const bundledMusicDir = path.join(process.resourcesPath, 'app.asar.unpacked', 'music-downloads');
            if (fs.existsSync(bundledMusicDir)) {
                console.log(`Merging bundled music resources...`);
                this.mergeDirectories(bundledMusicDir, downloadsDir);
            }
        }
    }

    mergeDirectories(source, target) {
        if (!fs.existsSync(source)) return;
        if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });

        try {
            const items = fs.readdirSync(source, { withFileTypes: true });
            for (const item of items) {
                const sourcePath = path.join(source, item.name);
                const targetPath = path.join(target, item.name);

                if (item.isDirectory()) {
                    this.mergeDirectories(sourcePath, targetPath);
                } else if (item.isFile()) {
                    // Only copy if file doesn't exist in target (preserve existing)
                    if (!fs.existsSync(targetPath)) {
                        try {
                            fs.copyFileSync(sourcePath, targetPath);
                            console.log(`Migrated: ${item.name}`);
                        } catch (err) {
                            console.error(`Failed to migrate ${item.name}:`, err);
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Error in mergeDirectories:', e);
        }
    }

    // Helper to read playlist JSON
    readPlaylist(playlistName) {
        const playlistPath = pathManager.getPlaylistPath(playlistName);
        if (!fs.existsSync(playlistPath)) {
            return [];
        }
        try {
            const data = fs.readFileSync(playlistPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error reading playlist ${playlistName}:`, error);
            return [];
        }
    }

    // Helper to write playlist JSON
    writePlaylist(playlistName, songs) {
        const playlistPath = pathManager.getPlaylistPath(playlistName);
        try {
            fs.writeFileSync(playlistPath, JSON.stringify(songs, null, 2));
            return true;
        } catch (error) {
            console.error(`Error writing playlist ${playlistName}:`, error);
            return false;
        }
    }

    // Helper to add song to playlist
    async addSongToPlaylist(playlistName, filename) {
        const songs = this.readPlaylist(playlistName);
        if (!songs.includes(filename)) {
            songs.push(filename);
            return this.writePlaylist(playlistName, songs);
        }
        return true; // Already exists
    }

    // Helper to remove song from playlist
    async removeSongFromPlaylist(playlistName, filename) {
        const songs = this.readPlaylist(playlistName);
        const updatedSongs = songs.filter(song => song !== filename);
        return this.writePlaylist(playlistName, updatedSongs);
    }

    // Get all playlists
    async getPlaylists() {
        const downloadsDir = pathManager.getDownloadsDir();
        try {
            const items = fs.readdirSync(downloadsDir);
            const playlists = items
                .filter(item => {
                    const fullPath = path.join(downloadsDir, item);
                    return fs.statSync(fullPath).isFile() && path.extname(item) === '.json';
                })
                .map(item => path.basename(item, '.json'));

            // Always include All_Downloads as the first playlist
            return ['All_Downloads', ...playlists.filter(p => p !== 'All_Downloads')];
        } catch (error) {
            console.error('Error reading playlists:', error);
            return ['All_Downloads'];
        }
    }

    // Migration function to convert old playlist structure to new JSON structure
    async migratePlaylists() {
        try {
            const downloadsDir = pathManager.getDownloadsDir();
            const allDownloadsDir = pathManager.getAllDownloadsDir();
            const items = fs.readdirSync(downloadsDir);
            const directories = items.filter(item => {
                const fullPath = path.join(downloadsDir, item);
                return fs.statSync(fullPath).isDirectory() && item !== 'All_Downloads';
            });

            for (const dirName of directories) {
                const playlistPath = pathManager.getPlaylistPath(dirName);

                // Skip if JSON file already exists
                if (fs.existsSync(playlistPath)) {
                    console.log(`Playlist ${dirName} already migrated`);
                    continue;
                }

                const dirPath = path.join(downloadsDir, dirName);
                const files = fs.readdirSync(dirPath);
                const mp3Files = files.filter(file => path.extname(file).toLowerCase() === '.mp3');

                if (mp3Files.length > 0) {
                    // Move files to All_Downloads
                    for (const file of mp3Files) {
                        const oldPath = path.join(dirPath, file);
                        const newPath = path.join(allDownloadsDir, file);

                        // Only move if file doesn't already exist in All_Downloads
                        if (!fs.existsSync(newPath)) {
                            fs.renameSync(oldPath, newPath);
                            console.log(`Moved ${file} to All_Downloads`);
                        }
                    }

                    // Create JSON playlist with the moved files
                    this.writePlaylist(dirName, mp3Files);
                    console.log(`Created playlist JSON for ${dirName} with ${mp3Files.length} songs`);

                    // Remove the old directory
                    fs.rmdirSync(dirPath);
                    console.log(`Removed old directory ${dirName}`);
                }
            }
            console.log('Playlist migration completed');
        } catch (error) {
            console.error('Error during playlist migration:', error);
        }
    }

    async deletePlaylist(playlistName) {
        if (playlistName === 'All_Downloads') {
            return { success: false, error: 'Cannot delete the All Downloads playlist' };
        }

        const playlistPath = pathManager.getPlaylistPath(playlistName);
        if (!fs.existsSync(playlistPath)) {
            return { success: false, error: 'Playlist not found' };
        }

        try {
            fs.unlinkSync(playlistPath);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async createPlaylist(playlistName) {
        if (!playlistName || playlistName.trim() === '') {
            return { success: false, error: 'Playlist name cannot be empty' };
        }

        const sanitizedName = playlistName.replace(/[<>:"/\\|?*]+/g, '_').trim();
        if (sanitizedName !== playlistName) {
            return { success: false, error: 'Playlist name contains invalid characters' };
        }

        const playlistPath = pathManager.getPlaylistPath(sanitizedName);
        if (fs.existsSync(playlistPath)) {
            return { success: false, error: 'Playlist already exists' };
        }

        const success = this.writePlaylist(sanitizedName, []);
        if (success) {
            return { success: true, playlistName: sanitizedName };
        } else {
            return { success: false, error: 'Failed to create playlist file' };
        }
    }

    async renamePlaylist(oldName, newName) {
        if (oldName === 'All_Downloads') {
            return { success: false, error: 'Cannot rename the All Downloads playlist' };
        }

        if (!newName || newName.trim() === '') {
            return { success: false, error: 'Playlist name cannot be empty' };
        }

        const sanitizedName = newName.replace(/[<>:"/\\|?*]+/g, '_').trim();
        if (sanitizedName !== newName) {
            return { success: false, error: 'Playlist name contains invalid characters' };
        }

        const oldPath = pathManager.getPlaylistPath(oldName);
        const newPath = pathManager.getPlaylistPath(sanitizedName);

        if (!fs.existsSync(oldPath)) {
            return { success: false, error: 'Playlist not found' };
        }

        if (fs.existsSync(newPath)) {
            return { success: false, error: 'A playlist with this name already exists' };
        }

        try {
            fs.renameSync(oldPath, newPath);
            return { success: true, newName: sanitizedName };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getDownloads(playlistName = 'All_Downloads') {
        const { parseFile } = await import('music-metadata');
        const allDownloadsDir = pathManager.getAllDownloadsDir();

        let filesList = [];
        if (playlistName === 'All_Downloads') {
            const files = fs.readdirSync(allDownloadsDir);
            filesList = files.filter(file => path.extname(file).toLowerCase() === '.mp3');
        } else {
            filesList = this.readPlaylist(playlistName);
        }

        const songs = [];
        for (const filename of filesList) {
            const filePath = path.join(allDownloadsDir, filename);
            if (fs.existsSync(filePath)) {
                let metadata = {
                    title: path.basename(filename, '.mp3'),
                    artist: 'Unknown Artist',
                    duration: 0,
                    picture: null
                };

                try {
                    const meta = await parseFile(filePath);
                    if (meta.common.title) metadata.title = meta.common.title;
                    if (meta.common.artist) metadata.artist = meta.common.artist;
                    if (meta.format.duration) metadata.duration = meta.format.duration;
                    if (meta.common.picture && meta.common.picture.length > 0) {
                        const picture = meta.common.picture[0];
                        metadata.picture = `data:${picture.format};base64,${picture.data.toString('base64')}`;
                    }
                } catch (e) {
                    console.error(`Error reading metadata for ${filename}:`, e);
                }

                // Fallback: Parse filename for Artist - Title
                if ((!metadata.artist || metadata.artist === 'Unknown Artist') || !metadata.title) {
                    const base = path.basename(filename, '.mp3');
                    const parts = base.split(' - ');
                    if (parts.length >= 2) {
                        // Assume "Artist - Title" format
                        if (!metadata.artist || metadata.artist === 'Unknown Artist') metadata.artist = parts[0].trim();
                        if (!metadata.title) metadata.title = parts.slice(1).join(' - ').trim();
                    } else {
                        // Just use filename as title
                        if (!metadata.title) metadata.title = base;
                    }
                }

                songs.push({
                    ...metadata,
                    filePath: filePath,
                    filename: filename
                });
            }
        }
        return songs;
    }

    async deleteSongFile(filePath) {
        if (!fs.existsSync(filePath)) {
            return { success: false, error: 'File not found' };
        }
        if (path.extname(filePath).toLowerCase() !== '.mp3') {
            return { success: false, error: 'Invalid file type' };
        }

        const normalizedFilePath = path.normalize(filePath);
        const downloadsDir = pathManager.getDownloadsDir();
        if (!normalizedFilePath.startsWith(path.normalize(downloadsDir))) {
            return { success: false, error: 'File is not in downloads directory' };
        }

        const filename = path.basename(filePath);

        // Remove from playlists
        const playlists = await this.getPlaylists();
        for (const playlistName of playlists) {
            if (playlistName === 'All_Downloads') continue;
            await this.removeSongFromPlaylist(playlistName, filename);
        }

        try {
            fs.unlinkSync(filePath);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = new PlaylistStore();
