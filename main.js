const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const YTDlpWrap = require('yt-dlp-wrap').default;

// Initialize yt-dlp
const ytDlpWrap = new YTDlpWrap(); // Default path, adjust if needed

// Define downloads directory within the project
const downloadsDir = path.join(__dirname, 'music-downloads');

// Ensure downloads directory exists
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}

// Ensure All_Downloads playlist exists
const allDownloadsDir = path.join(downloadsDir, 'All_Downloads');
if (!fs.existsSync(allDownloadsDir)) {
    fs.mkdirSync(allDownloadsDir, { recursive: true });
}

// Migration function to convert old playlist structure to new JSON structure
async function migratePlaylists() {
    try {
        const items = fs.readdirSync(downloadsDir);
        const directories = items.filter(item => {
            const fullPath = path.join(downloadsDir, item);
            return fs.statSync(fullPath).isDirectory() && item !== 'All_Downloads';
        });

        for (const dirName of directories) {
            const playlistPath = getPlaylistPath(dirName);
            
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
                writePlaylist(dirName, mp3Files);
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

// Run migration on startup
migratePlaylists();

// Helper function to get playlist JSON file path
function getPlaylistPath(playlistName) {
    return path.join(downloadsDir, `${playlistName}.json`);
}

// Helper function to read playlist JSON
function readPlaylist(playlistName) {
    const playlistPath = getPlaylistPath(playlistName);
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

// Helper function to write playlist JSON
function writePlaylist(playlistName, songs) {
    const playlistPath = getPlaylistPath(playlistName);
    try {
        fs.writeFileSync(playlistPath, JSON.stringify(songs, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing playlist ${playlistName}:`, error);
        return false;
    }
}

// Helper function to add song to playlist
async function addSongToPlaylist(playlistName, filename) {
    const songs = readPlaylist(playlistName);
    if (!songs.includes(filename)) {
        songs.push(filename);
        return writePlaylist(playlistName, songs);
    }
    return true; // Already exists
}

// Helper function to remove song from playlist
async function removeSongFromPlaylist(playlistName, filename) {
    const songs = readPlaylist(playlistName);
    const updatedSongs = songs.filter(song => song !== filename);
    return writePlaylist(playlistName, updatedSongs);
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // Use preload script for secure IPC
            contextIsolation: true,
            nodeIntegration: false,
        },
        titleBarStyle: 'hiddenInset', // Allows dragging while keeping custom styling
        trafficLightPosition: { x: 15, y: 15 }, // Position traffic lights on macOS
    });

    mainWindow.loadFile('index.html');

    // Open DevTools - remove for production
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers ---

// Handle download request
ipcMain.handle('download-song', async (event, { youtubeUrl, playlistName = 'All_Downloads' }) => {
    console.log(`Received download request for: ${youtubeUrl} in playlist: ${playlistName}`);
    try {
        const metadata = await ytDlpWrap.getVideoInfo(youtubeUrl);
        const title = metadata.title || 'downloaded_song';
        // Sanitize title for filename
        const safeTitle = title.replace(/[<>:"/\\|?*]+/g, '_');
        
        // Always download to All_Downloads directory
        const allDownloadsDir = path.join(downloadsDir, 'All_Downloads');
        if (!fs.existsSync(allDownloadsDir)) {
            fs.mkdirSync(allDownloadsDir, { recursive: true });
        }
        
        const outputFilePath = path.join(allDownloadsDir, `${safeTitle}.mp3`);

        console.log(`Downloading to: ${outputFilePath}`);

        // Download audio only, best quality, convert to mp3
        await ytDlpWrap.execPromise([
            youtubeUrl,
            '-x', // Extract audio
            '--audio-format', 'mp3',
            '--audio-quality', '0', // 0 is best quality
            '-o', outputFilePath,
            '--ffmpeg-location', '/opt/homebrew/bin/ffmpeg', // *** IMPORTANT: SET YOUR FFMPEG PATH HERE ***
            // You might need to install ffmpeg: brew install ffmpeg
        ]);

        console.log(`Download complete: ${outputFilePath}`);
        
        // If not All_Downloads, add to the specified playlist
        if (playlistName !== 'All_Downloads') {
            await addSongToPlaylist(playlistName, `${safeTitle}.mp3`);
        }
        
        return { success: true, filePath: outputFilePath, title: title, filename: `${safeTitle}.mp3` };

    } catch (error) {
        console.error('Error downloading song:', error);
        return { success: false, error: error.message };
    }
});

// Handle request to get downloaded songs
ipcMain.handle('get-downloads', async (event, playlistName = 'All_Downloads') => {
    try {
        if (playlistName === 'All_Downloads') {
            // For All_Downloads, return all MP3 files from the All_Downloads directory
            const files = fs.readdirSync(allDownloadsDir);
            const mp3Files = files
                .filter(file => path.extname(file).toLowerCase() === '.mp3')
                .map(file => ({
                    title: path.basename(file, '.mp3'),
                    filePath: path.join(allDownloadsDir, file),
                    filename: file
                }));
            return mp3Files;
        } else {
            // For other playlists, read from JSON and get songs from All_Downloads
            const songFilenames = readPlaylist(playlistName);
            const songs = [];
            
            for (const filename of songFilenames) {
                const filePath = path.join(allDownloadsDir, filename);
                if (fs.existsSync(filePath)) {
                    songs.push({
                        title: path.basename(filename, '.mp3'),
                        filePath: filePath,
                        filename: filename
                    });
                }
            }
            return songs;
        }
    } catch (error) {
        console.error('Error reading downloads directory:', error);
        return [];
    }
});

// Handle request to get all playlists
ipcMain.handle('get-playlists', async () => {
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
});

// Handle playlist deletion
ipcMain.handle('delete-playlist', async (event, playlistName) => {
    try {
        // Don't allow deletion of All_Downloads playlist
        if (playlistName === 'All_Downloads') {
            return { success: false, error: 'Cannot delete the All Downloads playlist' };
        }

        const playlistPath = getPlaylistPath(playlistName);
        if (!fs.existsSync(playlistPath)) {
            return { success: false, error: 'Playlist not found' };
        }

        // Delete the playlist JSON file
        fs.unlinkSync(playlistPath);
        console.log(`Deleted playlist: ${playlistName}`);
        return { success: true };
    } catch (error) {
        console.error('Error deleting playlist:', error);
        return { success: false, error: error.message };
    }
});

// Handle creating a new playlist
ipcMain.handle('create-playlist', async (event, playlistName) => {
    console.log(`Received request to create playlist: ${playlistName}`);
    try {
        // Validate playlist name
        if (!playlistName || playlistName.trim() === '') {
            return { success: false, error: 'Playlist name cannot be empty' };
        }

        // Sanitize playlist name for filesystem
        const sanitizedName = playlistName.replace(/[<>:"/\\|?*]+/g, '_').trim();
        if (sanitizedName !== playlistName) {
            return { success: false, error: 'Playlist name contains invalid characters' };
        }

        // Check if playlist already exists
        const playlistPath = getPlaylistPath(sanitizedName);
        if (fs.existsSync(playlistPath)) {
            return { success: false, error: 'Playlist already exists' };
        }

        // Create the playlist JSON file with empty array
        const success = writePlaylist(sanitizedName, []);
        if (success) {
            console.log(`Created playlist: ${sanitizedName}`);
            return { success: true, playlistName: sanitizedName };
        } else {
            return { success: false, error: 'Failed to create playlist file' };
        }

    } catch (error) {
        console.error('Error creating playlist:', error);
        return { success: false, error: error.message };
    }
});

// Handle adding a song to a playlist
ipcMain.handle('add-song-to-playlist', async (event, { filename, playlistName }) => {
    console.log(`Received request to add song ${filename} to playlist ${playlistName}`);
    try {
        if (playlistName === 'All_Downloads') {
            return { success: false, error: 'Cannot add songs to All Downloads - they are automatically added there' };
        }

        const success = await addSongToPlaylist(playlistName, filename);
        if (success) {
            console.log(`Added song ${filename} to playlist ${playlistName}`);
            return { success: true };
        } else {
            return { success: false, error: 'Failed to add song to playlist' };
        }

    } catch (error) {
        console.error(`Error adding song ${filename} to playlist ${playlistName}:`, error);
        return { success: false, error: error.message };
    }
});

// Handle renaming a playlist
ipcMain.handle('rename-playlist', async (event, oldName, newName) => {
    console.log(`Received request to rename playlist from ${oldName} to ${newName}`);
    try {
        // Don't allow renaming All_Downloads
        if (oldName === 'All_Downloads') {
            return { success: false, error: 'Cannot rename the All Downloads playlist' };
        }

        // Validate new name
        if (!newName || newName.trim() === '') {
            return { success: false, error: 'Playlist name cannot be empty' };
        }

        // Sanitize new name
        const sanitizedName = newName.replace(/[<>:"/\\|?*]+/g, '_').trim();
        if (sanitizedName !== newName) {
            return { success: false, error: 'Playlist name contains invalid characters' };
        }

        const oldPath = getPlaylistPath(oldName);
        const newPath = getPlaylistPath(sanitizedName);

        if (!fs.existsSync(oldPath)) {
            return { success: false, error: 'Playlist not found' };
        }

        if (fs.existsSync(newPath)) {
            return { success: false, error: 'A playlist with this name already exists' };
        }

        // Rename the file
        fs.renameSync(oldPath, newPath);
        console.log(`Renamed playlist from ${oldName} to ${sanitizedName}`);
        return { success: true, newName: sanitizedName };

    } catch (error) {
        console.error('Error renaming playlist:', error);
        return { success: false, error: error.message };
    }
});

// Handle removing a specific song from a specific playlist
ipcMain.handle('remove-song-from-playlist', async (event, { filePath, playlistName }) => {
    console.log(`Received request to remove song ${filePath} from playlist ${playlistName}`);
    try {
        // Prevent removal from the virtual "All Downloads"
        if (playlistName === 'All_Downloads') {
            return { success: false, error: 'Cannot remove songs directly from All Downloads view. Delete the song file to remove it completely.' };
        }

        const playlistPath = getPlaylistPath(playlistName);
        if (!fs.existsSync(playlistPath)) {
            console.error(`Playlist not found: ${playlistPath}`);
            return { success: false, error: 'Playlist not found' };
        }

        // Extract filename from the file path
        const songFileName = path.basename(filePath);
        
        // Remove the song from the playlist JSON
        const success = await removeSongFromPlaylist(playlistName, songFileName);
        if (success) {
            console.log(`Removed song ${songFileName} from playlist ${playlistName}`);
            return { success: true };
        } else {
            return { success: false, error: 'Failed to remove song from playlist' };
        }

    } catch (error) {
        console.error(`Error removing song ${filePath} from playlist ${playlistName}:`, error);
        return { success: false, error: error.message };
    }
});
