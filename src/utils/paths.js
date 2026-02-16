const { app } = require('electron');
const path = require('path');
const fs = require('fs');

class PathManager {
    constructor() {
        this.downloadsDir = null;
        this.musicDir = null;
        this.allDownloadsDir = null;
    }

    initialize() {
        // Use ~/Music/ElectronTunes for persistent storage
        this.musicDir = app.getPath('music');
        this.downloadsDir = path.join(this.musicDir, 'ElectronTunes');
        this.allDownloadsDir = path.join(this.downloadsDir, 'All_Downloads');

        // Ensure directories exist
        if (!fs.existsSync(this.downloadsDir)) {
            console.log(`Creating main downloads directory at: ${this.downloadsDir}`);
            fs.mkdirSync(this.downloadsDir, { recursive: true });
        }

        if (!fs.existsSync(this.allDownloadsDir)) {
            fs.mkdirSync(this.allDownloadsDir, { recursive: true });
        }

        return {
            downloadsDir: this.downloadsDir,
            allDownloadsDir: this.allDownloadsDir
        };
    }

    getDownloadsDir() {
        if (!this.downloadsDir) this.initialize();
        return this.downloadsDir;
    }

    getAllDownloadsDir() {
        if (!this.allDownloadsDir) this.initialize();
        return this.allDownloadsDir;
    }

    // Helper to get playlist JSON path
    getPlaylistPath(playlistName) {
        return path.join(this.getDownloadsDir(), `${playlistName}.json`);
    }
}

module.exports = new PathManager();
