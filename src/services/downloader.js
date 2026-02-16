const YTDlpWrap = require('yt-dlp-wrap').default;
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const pathManager = require('../utils/paths');
const playlistStore = require('./store');

class Downloader {
    constructor() {
        this.ytDlpWrap = null;
        this.ffmpegPath = null;
    }

    initialize() {
        this.initYtDlp();
        this.initFfmpeg();
    }

    initYtDlp() {
        try {
            let ytDlpPath = null;
            const possibleYtDlpPaths = [
                '/opt/homebrew/bin/yt-dlp',
                '/usr/local/bin/yt-dlp',
                '/usr/bin/yt-dlp',
                'yt-dlp'
            ];

            for (const testPath of possibleYtDlpPaths) {
                try {
                    if (testPath === 'yt-dlp') {
                        execSync('yt-dlp --version', { stdio: 'ignore' });
                        ytDlpPath = 'yt-dlp';
                        break;
                    } else {
                        if (fs.existsSync(testPath)) {
                            ytDlpPath = testPath;
                            break;
                        }
                    }
                } catch (error) { continue; }
            }

            if (ytDlpPath) {
                this.ytDlpWrap = new YTDlpWrap(ytDlpPath);
                console.log(`Using yt-dlp at: ${ytDlpPath}`);
            } else {
                this.ytDlpWrap = new YTDlpWrap();
                console.log('Using default yt-dlp initialization');
            }
        } catch (error) {
            console.error('Error initializing yt-dlp:', error);
            this.ytDlpWrap = new YTDlpWrap();
        }
    }

    initFfmpeg() {
        const possiblePaths = [
            '/opt/homebrew/bin/ffmpeg',
            '/usr/local/bin/ffmpeg',
            '/usr/bin/ffmpeg',
            'ffmpeg'
        ];

        for (const testPath of possiblePaths) {
            try {
                if (testPath === 'ffmpeg') {
                    execSync('ffmpeg -version', { stdio: 'ignore' });
                    this.ffmpegPath = 'ffmpeg';
                    break;
                } else {
                    if (fs.existsSync(testPath)) {
                        this.ffmpegPath = testPath;
                        break;
                    }
                }
            } catch (error) { continue; }
        }

        if (this.ffmpegPath) {
            console.log(`Using ffmpeg at: ${this.ffmpegPath}`);
        } else {
            console.warn('ffmpeg not found. Please install ffmpeg: brew install ffmpeg');
        }
    }

    async downloadSong(youtubeUrl, playlistName = 'All_Downloads') {
        if (!this.ffmpegPath) {
            throw new Error('ffmpeg not found. Please install ffmpeg: brew install ffmpeg');
        }

        console.log(`Received download request for: ${youtubeUrl} in playlist: ${playlistName}`);

        try {
            const metadata = await this.ytDlpWrap.getVideoInfo([youtubeUrl, '--no-playlist']);
            const title = metadata.title || 'downloaded_song';
            const safeTitle = title.replace(/[<>:"/\\|?*]+/g, '_');
            const allDownloadsDir = pathManager.getAllDownloadsDir();
            const outputFilePath = path.join(allDownloadsDir, `${safeTitle}.mp3`);

            console.log(`Downloading to: ${outputFilePath}`);

            const downloadArgs = [
                youtubeUrl,
                '--no-playlist',
                '-x',
                '--audio-format', 'mp3',
                '--audio-quality', '0',
                '--add-metadata',
                '--embed-thumbnail',
                '-o', outputFilePath,
                '--ffmpeg-location', this.ffmpegPath,
                '--no-warnings'
            ];

            await this.ytDlpWrap.execPromise(downloadArgs);
            console.log(`Download complete: ${outputFilePath}`);

            if (playlistName !== 'All_Downloads') {
                await playlistStore.addSongToPlaylist(playlistName, `${safeTitle}.mp3`);
            }

            return { success: true, filePath: outputFilePath, title: title, filename: `${safeTitle}.mp3` };

        } catch (error) {
            console.error('Error downloading song:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new Downloader();
