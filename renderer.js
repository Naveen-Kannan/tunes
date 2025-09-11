const youtubeUrlInput = document.getElementById('youtube-url');
const downloadButton = document.getElementById('download-button');
const downloadStatus = document.getElementById('download-status');
const songList = document.getElementById('song-list');
const audioPlayer = document.getElementById('audio-player');
const nowPlaying = document.getElementById('now-playing');
const playlistList = document.getElementById('playlist-list');

let currentPlayingItem = null;
let currentPlaylist = 'All_Downloads';
let isShuffleEnabled = false;
let repeatMode = 'none'; // 'none', 'all', or 'single'
let shuffledQueue = [];

// Audio player functionality
const audioPlayerElement = document.createElement('audio');
audioPlayerElement.style.display = 'none';
document.body.appendChild(audioPlayerElement);

// Player controls
const playButton = document.getElementById('play-button');
const prevButton = document.getElementById('prev-button');
const nextButton = document.getElementById('next-button');
const muteButton = document.getElementById('mute-button');
const progressBar = document.querySelector('.progress-bar');
const progressFill = document.querySelector('.progress-fill');
const volumeSlider = document.querySelector('.volume-slider');
const volumeFill = document.querySelector('.volume-fill');
const currentTimeDisplay = document.getElementById('current-time');
const durationDisplay = document.getElementById('duration');

// Add new control buttons after the existing player controls
const shuffleButton = document.createElement('button');
shuffleButton.id = 'shuffle-button';
shuffleButton.textContent = '🔀';
shuffleButton.title = 'Shuffle';
shuffleButton.className = 'player-control';

const repeatButton = document.createElement('button');
repeatButton.id = 'repeat-button';
repeatButton.textContent = '🔁';
repeatButton.title = 'Repeat Off';
repeatButton.className = 'player-control';

// Insert new buttons into the player controls
nextButton.parentNode.insertBefore(shuffleButton, nextButton.nextSibling);
nextButton.parentNode.insertBefore(repeatButton, shuffleButton);

// Format time as MM:SS
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Update progress bar
audioPlayerElement.addEventListener('timeupdate', () => {
    const progress = (audioPlayerElement.currentTime / audioPlayerElement.duration) * 100;
    progressFill.style.width = `${progress}%`;
    currentTimeDisplay.textContent = formatTime(audioPlayerElement.currentTime);
});

// Update duration when metadata is loaded
audioPlayerElement.addEventListener('loadedmetadata', () => {
    durationDisplay.textContent = formatTime(audioPlayerElement.duration);
});

// Play/Pause button
playButton.addEventListener('click', () => {
    if (audioPlayerElement.paused) {
        audioPlayerElement.play();
        playButton.textContent = '⏸';
    } else {
        audioPlayerElement.pause();
        playButton.textContent = '▶';
    }
});

// Progress bar click (seek functionality)
progressBar.addEventListener('click', (e) => {
    if (audioPlayerElement.duration) {
        const rect = progressBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        const newTime = pos * audioPlayerElement.duration;
        audioPlayerElement.currentTime = newTime;
        
        // Update progress bar immediately for better UX
        const progress = (newTime / audioPlayerElement.duration) * 100;
        progressFill.style.width = `${progress}%`;
        currentTimeDisplay.textContent = formatTime(newTime);
    }
});

// Volume control
let lastVolume = 1;
const volumeDisplay = document.getElementById('volume-display');

muteButton.addEventListener('click', () => {
    if (audioPlayerElement.volume > 0) {
        lastVolume = audioPlayerElement.volume;
        audioPlayerElement.volume = 0;
        muteButton.textContent = '🔇';
        volumeFill.style.width = '0%';
        volumeDisplay.textContent = '0%';
    } else {
        audioPlayerElement.volume = lastVolume;
        muteButton.textContent = '🔊';
        volumeFill.style.width = `${lastVolume * 100}%`;
        volumeDisplay.textContent = `${Math.round(lastVolume * 100)}%`;
    }
});

volumeSlider.addEventListener('click', (e) => {
    const rect = volumeSlider.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    audioPlayerElement.volume = Math.max(0, Math.min(1, pos));
    volumeFill.style.width = `${audioPlayerElement.volume * 100}%`;
    volumeDisplay.textContent = `${Math.round(audioPlayerElement.volume * 100)}%`;
    muteButton.textContent = audioPlayerElement.volume > 0 ? '🔊' : '🔇';
});

// Function to add a song item to the list
function addSongToList(song) {
    const listItem = document.createElement('li');
    listItem.textContent = song.title;
    listItem.dataset.filePath = song.filePath;
    listItem.dataset.filename = song.filename;
    listItem.classList.add('song-item');

    listItem.addEventListener('click', () => {
        playSong(song.filePath, listItem);
    });

    // Add context menu listener for song management
    listItem.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showSongContextMenu(e, song, listItem);
    });

    songList.appendChild(listItem);
}

// Function to play a song
function playSong(filePath, listItem) {
    console.log(`Playing: ${filePath}`);
    audioPlayerElement.src = `file://${filePath}`;
    audioPlayerElement.play();
    playButton.textContent = '⏸';
    nowPlaying.textContent = `Now Playing: ${listItem.textContent}`;

    if (currentPlayingItem) {
        currentPlayingItem.classList.remove('playing');
    }
    listItem.classList.add('playing');
    currentPlayingItem = listItem;
}

// Function to load songs for a specific playlist
async function loadPlaylistSongs(playlistName) {
    console.log(`Loading songs for playlist: ${playlistName}`);
    const downloads = await window.electronAPI.getDownloads(playlistName);
    console.log('Received downloads:', downloads);
    songList.innerHTML = '';
    if (downloads && downloads.length > 0) {
        downloads.forEach(addSongToList);
        if (isShuffleEnabled) {
            updateShuffleQueue();
        }
    } else {
        console.log('No downloads found or error occurred.');
    }
}

// Function to load all playlists
async function loadPlaylists() {
    const playlists = await window.electronAPI.getPlaylists();
    playlistList.innerHTML = '';
    
    // Add "All Downloads" as the first playlist
    const allDownloadsItem = document.createElement('li');
    allDownloadsItem.textContent = 'All Downloads';
    allDownloadsItem.classList.add('active');
    allDownloadsItem.addEventListener('click', () => switchPlaylist('All_Downloads'));
    playlistList.appendChild(allDownloadsItem);
    
    // Add other playlists
    playlists.forEach(playlist => {
        if (playlist !== 'All_Downloads') {
            const playlistItem = document.createElement('li');
            playlistItem.textContent = playlist;
            playlistItem.addEventListener('click', () => switchPlaylist(playlist));
            
            // Add context menu for playlist management
            playlistItem.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showPlaylistContextMenu(e, playlist, playlistItem);
            });
            
            playlistList.appendChild(playlistItem);
        }
    });
}

// Function to switch between playlists
async function switchPlaylist(playlistName) {
    currentPlaylist = playlistName;
    
    // Update active state in playlist list
    playlistList.querySelectorAll('li').forEach(item => {
        item.classList.remove('active');
        if (item.textContent === playlistName) {
            item.classList.add('active');
        }
    });
    
    // Update the main content title
    const mainTitle = document.querySelector('.main-content h1');
    mainTitle.textContent = playlistName;
    
    // Load songs for the selected playlist
    await loadPlaylistSongs(playlistName);
}

// Function to show context menu for playlist management
function showPlaylistContextMenu(event, playlistName, playlistItem) {
    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
        <div class="context-menu-item rename-playlist">Rename Playlist</div>
        <div class="context-menu-item delete-playlist">Delete Playlist</div>
    `;
    
    // Position the menu at the click location
    menu.style.left = `${event.pageX}px`;
    menu.style.top = `${event.pageY}px`;
    
    // Add click handler for rename option
    const renameOption = menu.querySelector('.rename-playlist');
    renameOption.addEventListener('click', async () => {
        const newName = prompt(`Rename playlist "${playlistName}" to:`, playlistName);
        if (newName && newName.trim() !== '' && newName !== playlistName) {
            await renamePlaylist(playlistName, newName.trim(), playlistItem);
        }
        menu.remove();
    });
    
    // Add click handler for delete option
    const deleteOption = menu.querySelector('.delete-playlist');
    deleteOption.addEventListener('click', async () => {
        if (confirm(`Are you sure you want to delete the playlist "${playlistName}"?`)) {
            const result = await window.electronAPI.deletePlaylist(playlistName);
            if (result.success) {
                // Remove the playlist item from the UI
                playlistItem.remove();
                // If we were viewing the deleted playlist, switch to All Downloads
                if (currentPlaylist === playlistName) {
                    await switchPlaylist('All_Downloads');
                }
            } else {
                alert(result.error || 'Failed to delete playlist');
            }
        }
        menu.remove();
    });
    
    // Add click handler to close menu when clicking outside
    const closeMenu = (e) => {
        // Check if the click target is outside the menu itself
        if (menu && !menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu, true); // Clean up listener
        }
    };
    // Use capture phase to ensure this runs before other click listeners
    document.addEventListener('click', closeMenu, true);
    
    // Add the menu to the document
    document.body.appendChild(menu);
}

// Function to show context menu for song management
function showSongContextMenu(event, song, listItem) {
    // Remove any existing context menus
    document.querySelectorAll('.context-menu').forEach(menu => menu.remove());

    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    
    let menuHTML = '';
    
    if (currentPlaylist === 'All_Downloads') {
        // For All Downloads, show add to playlist and delete options
        menuHTML = `
            <div class="context-menu-item add-to-playlist">Add to Playlist</div>
            <div class="context-menu-item delete-song">Delete Song</div>
        `;
    } else {
        // For other playlists, show remove from playlist option
        menuHTML = `
            <div class="context-menu-item remove-song">Remove from Playlist</div>
        `;
    }
    
    menu.innerHTML = menuHTML;

    // Position the menu at the click location
    menu.style.left = `${event.pageX}px`;
    menu.style.top = `${event.pageY}px`;

    // Add click handlers based on current playlist
    if (currentPlaylist === 'All_Downloads') {
        // Add to playlist handler
        const addToPlaylistOption = menu.querySelector('.add-to-playlist');
        if (addToPlaylistOption) {
            addToPlaylistOption.addEventListener('click', () => {
                showAddToPlaylistModal(song);
                menu.remove();
            });
        }

        // Delete song handler
        const deleteOption = menu.querySelector('.delete-song');
        if (deleteOption) {
            deleteOption.addEventListener('click', async () => {
                if (confirm(`Are you sure you want to delete "${song.title}"? This will remove it from all playlists.`)) {
                    await deleteSong(song, listItem);
                }
                menu.remove();
            });
        }
    } else {
        // Remove from playlist handler
        const removeOption = menu.querySelector('.remove-song');
        if (removeOption) {
            removeOption.addEventListener('click', async () => {
                await removeSongFromPlaylist(song, listItem);
                menu.remove();
            });
        }
    }

    // Add click handler to close menu when clicking outside
    const closeMenu = (e) => {
        if (menu && !menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu, true);
        }
    };
    document.addEventListener('click', closeMenu, true);

    // Add the menu to the document
    document.body.appendChild(menu);
}

// Event listener for the download button
downloadButton.addEventListener('click', async () => {
    const url = youtubeUrlInput.value.trim();
    if (!url) {
        downloadStatus.textContent = 'Please enter a YouTube URL.';
        return;
    }

    downloadStatus.textContent = 'Starting download...';
    downloadButton.disabled = true;
    youtubeUrlInput.disabled = true;

    try {
        console.log(`Sending download request for ${url} to main process.`);
        const result = await window.electronAPI.downloadSong(url, currentPlaylist);
        console.log('Download result:', result);

        if (result.success) {
            downloadStatus.textContent = `Downloaded: ${result.title}`;
            addSongToList({ 
                title: result.title, 
                filePath: result.filePath, 
                filename: result.filename 
            });
            youtubeUrlInput.value = '';
        } else {
            downloadStatus.textContent = `Error: ${result.error}`;
            console.error('Download failed:', result.error);
        }
    } catch (error) {
        downloadStatus.textContent = `Error: ${error.message}`;
        console.error('IPC Error:', error);
    } finally {
        downloadButton.disabled = false;
        youtubeUrlInput.disabled = false;
    }
});

// Playlist creation functionality
const createPlaylistBtn = document.getElementById('create-playlist-btn');
const createPlaylistModal = document.getElementById('create-playlist-modal');
const playlistNameInput = document.getElementById('playlist-name-input');
const confirmCreatePlaylistBtn = document.getElementById('confirm-create-playlist');
const cancelCreatePlaylistBtn = document.getElementById('cancel-create-playlist');
const closeModalBtn = document.querySelector('.close-modal');

// Show modal when create playlist button is clicked
createPlaylistBtn.addEventListener('click', () => {
    createPlaylistModal.style.display = 'block';
    playlistNameInput.focus();
    playlistNameInput.value = '';
});

// Hide modal when close button is clicked
closeModalBtn.addEventListener('click', hideModal);

// Hide modal when cancel button is clicked
cancelCreatePlaylistBtn.addEventListener('click', hideModal);

// Hide modal when clicking outside of it
createPlaylistModal.addEventListener('click', (e) => {
    if (e.target === createPlaylistModal) {
        hideModal();
    }
});

// Handle Enter key in input field
playlistNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleCreatePlaylist();
    }
});

// Handle Escape key to close modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && createPlaylistModal.style.display === 'block') {
        hideModal();
    }
});

// Keyboard shortcuts for player controls
document.addEventListener('keydown', (e) => {
    // Only handle shortcuts if no input is focused
    if (document.activeElement.tagName === 'INPUT') return;
    
    switch (e.key) {
        case ' ':
            e.preventDefault();
            playButton.click();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            prevButton.click();
            break;
        case 'ArrowRight':
            e.preventDefault();
            nextButton.click();
            break;
        case 'm':
        case 'M':
            e.preventDefault();
            muteButton.click();
            break;
        case 's':
        case 'S':
            e.preventDefault();
            shuffleButton.click();
            break;
        case 'r':
        case 'R':
            e.preventDefault();
            repeatButton.click();
            break;
    }
});

// Function to hide the modal
function hideModal() {
    createPlaylistModal.style.display = 'none';
    playlistNameInput.value = '';
}

// Function to handle playlist creation
async function handleCreatePlaylist() {
    const playlistName = playlistNameInput.value.trim();
    
    if (!playlistName) {
        alert('Please enter a playlist name');
        return;
    }

    // Disable button during creation
    confirmCreatePlaylistBtn.disabled = true;
    confirmCreatePlaylistBtn.textContent = 'Creating...';

    try {
        const result = await window.electronAPI.createPlaylist(playlistName);
        
        if (result.success) {
            // Hide modal
            hideModal();
            
            // Reload playlists to show the new one
            await loadPlaylists();
            
            // Switch to the newly created playlist
            await switchPlaylist(result.playlistName);
            
            console.log(`Created playlist: ${result.playlistName}`);
        } else {
            alert(`Error creating playlist: ${result.error}`);
        }
    } catch (error) {
        console.error('Error creating playlist:', error);
        alert('An error occurred while creating the playlist');
    } finally {
        // Re-enable button
        confirmCreatePlaylistBtn.disabled = false;
        confirmCreatePlaylistBtn.textContent = 'Create';
    }
}

// Handle confirm button click
confirmCreatePlaylistBtn.addEventListener('click', handleCreatePlaylist);

// Add to Playlist Modal elements
const addToPlaylistModal = document.getElementById('add-to-playlist-modal');
const closeAddToPlaylistModalBtn = document.querySelector('.close-add-to-playlist-modal');
const cancelAddToPlaylistBtn = document.getElementById('cancel-add-to-playlist');
const confirmAddToPlaylistBtn = document.getElementById('confirm-add-to-playlist');
const playlistSelect = document.getElementById('playlist-select');

// Show modal when create playlist button is clicked
createPlaylistBtn.addEventListener('click', () => {
    createPlaylistModal.style.display = 'block';
    playlistNameInput.focus();
    playlistNameInput.value = '';
});

// Hide add to playlist modal when close button is clicked
closeAddToPlaylistModalBtn.addEventListener('click', hideAddToPlaylistModal);

// Hide add to playlist modal when cancel button is clicked
cancelAddToPlaylistBtn.addEventListener('click', hideAddToPlaylistModal);

// Hide add to playlist modal when clicking outside of it
addToPlaylistModal.addEventListener('click', (e) => {
    if (e.target === addToPlaylistModal) {
        hideAddToPlaylistModal();
    }
});

// Handle confirm add to playlist button click
confirmAddToPlaylistBtn.addEventListener('click', handleAddToPlaylist);

// Function to hide the add to playlist modal
function hideAddToPlaylistModal() {
    addToPlaylistModal.style.display = 'none';
    playlistSelect.value = '';
}

// Function to handle adding song to playlist
async function handleAddToPlaylist() {
    const selectedPlaylist = playlistSelect.value;
    
    if (!selectedPlaylist) {
        alert('Please select a playlist');
        return;
    }
    
    const song = JSON.parse(addToPlaylistModal.dataset.song);
    
    // Disable button during operation
    confirmAddToPlaylistBtn.disabled = true;
    confirmAddToPlaylistBtn.textContent = 'Adding...';
    
    try {
        await addSongToPlaylist(song, selectedPlaylist);
        hideAddToPlaylistModal();
    } catch (error) {
        console.error('Error adding song to playlist:', error);
        alert('An error occurred while adding the song to the playlist');
    } finally {
        // Re-enable button
        confirmAddToPlaylistBtn.disabled = false;
        confirmAddToPlaylistBtn.textContent = 'Add to Playlist';
    }
}

// Function to show add to playlist modal
function showAddToPlaylistModal(song) {
    // Get all playlists except All_Downloads
    const playlists = Array.from(playlistList.querySelectorAll('li'))
        .map(li => li.textContent)
        .filter(name => name !== 'All Downloads');
    
    if (playlists.length === 0) {
        alert('No playlists available. Create a playlist first.');
        return;
    }
    
    // Show the modal
    const modal = document.getElementById('add-to-playlist-modal');
    const songTitle = document.getElementById('add-to-playlist-song-title');
    const playlistSelect = document.getElementById('playlist-select');
    
    // Set the song title
    songTitle.textContent = `"${song.title}"`;
    
    // Clear and populate the select dropdown
    playlistSelect.innerHTML = '<option value="">Choose a playlist...</option>';
    playlists.forEach(playlist => {
        const option = document.createElement('option');
        option.value = playlist;
        option.textContent = playlist;
        playlistSelect.appendChild(option);
    });
    
    // Show the modal
    modal.style.display = 'block';
    
    // Store the song for later use
    modal.dataset.song = JSON.stringify(song);
}

// Function to add song to playlist
async function addSongToPlaylist(song, playlistName) {
    try {
        const result = await window.electronAPI.addSongToPlaylist(song.filename, playlistName);
        if (result.success) {
            console.log(`Added ${song.title} to ${playlistName}`);
            // Show success message
            const status = document.getElementById('download-status');
            status.textContent = `Added "${song.title}" to ${playlistName}`;
            setTimeout(() => {
                status.textContent = '';
            }, 3000);
        } else {
            alert(`Error adding song to playlist: ${result.error}`);
        }
    } catch (error) {
        console.error('Error adding song to playlist:', error);
        alert('An error occurred while adding the song to the playlist');
    }
}

// Function to remove song from playlist
async function removeSongFromPlaylist(song, listItem) {
    try {
        const result = await window.electronAPI.removeSongFromPlaylist(song.filePath, currentPlaylist);
        if (result.success) {
            console.log('Song removed successfully from backend.');
            // Remove the song item from the UI
            listItem.remove();
            // If the removed song was playing, stop playback
            if (currentPlayingItem === listItem) {
                audioPlayerElement.pause();
                audioPlayerElement.src = '';
                nowPlaying.textContent = 'No song playing';
                currentPlayingItem.classList.remove('playing');
                currentPlayingItem = null;
            }
            updateShuffleQueue(); // Update shuffle queue if needed
        } else {
            alert(result.error || 'Failed to remove song from playlist');
            console.error('Failed to remove song:', result.error);
        }
    } catch (error) {
        alert('An error occurred while removing the song.');
        console.error('Error calling removeSongFromPlaylist:', error);
    }
}

// Function to delete song completely
async function deleteSong(song, listItem) {
    try {
        // This would need a new IPC handler for deleting songs
        // For now, we'll just remove from all playlists
        const playlists = await window.electronAPI.getPlaylists();
        
        for (const playlist of playlists) {
            if (playlist !== 'All_Downloads') {
                await window.electronAPI.removeSongFromPlaylist(song.filePath, playlist);
            }
        }
        
        // Remove from UI
        listItem.remove();
        
        // If the deleted song was playing, stop playback
        if (currentPlayingItem === listItem) {
            audioPlayerElement.pause();
            audioPlayerElement.src = '';
            nowPlaying.textContent = 'No song playing';
            currentPlayingItem.classList.remove('playing');
            currentPlayingItem = null;
        }
        
        updateShuffleQueue();
        console.log(`Deleted song: ${song.title}`);
        
    } catch (error) {
        console.error('Error deleting song:', error);
        alert('An error occurred while deleting the song');
    }
}

// Function to rename playlist
async function renamePlaylist(oldName, newName, playlistItem) {
    try {
        // This would need a new IPC handler for renaming playlists
        // For now, we'll use a simple approach
        const result = await window.electronAPI.renamePlaylist(oldName, newName);
        if (result.success) {
            // Update the UI
            playlistItem.textContent = newName;
            
            // If we're currently viewing this playlist, update the title
            if (currentPlaylist === oldName) {
                currentPlaylist = newName;
                const mainTitle = document.querySelector('.main-content h1');
                mainTitle.textContent = newName;
            }
            
            console.log(`Renamed playlist from ${oldName} to ${newName}`);
        } else {
            alert(`Error renaming playlist: ${result.error}`);
        }
    } catch (error) {
        console.error('Error renaming playlist:', error);
        alert('An error occurred while renaming the playlist');
    }
}

// Initial load when the page loads
window.addEventListener('DOMContentLoaded', async () => {
    await loadPlaylists();
    await loadPlaylistSongs(currentPlaylist);
});

// Function to get all song items
function getAllSongItems() {
    return Array.from(songList.querySelectorAll('.song-item'));
}

// Function to get the index of the current playing song
function getCurrentSongIndex() {
    const songs = getAllSongItems();
    return songs.findIndex(item => item === currentPlayingItem);
}

// Function to shuffle array
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Function to update shuffle queue
function updateShuffleQueue() {
    const songs = getAllSongItems();
    shuffledQueue = shuffleArray(songs);
    
    // If there's a current song playing, move it to the start of the queue
    if (currentPlayingItem) {
        const currentIndex = shuffledQueue.findIndex(item => item === currentPlayingItem);
        if (currentIndex !== -1) {
            shuffledQueue.splice(currentIndex, 1);
            shuffledQueue.unshift(currentPlayingItem);
        }
    }
}

// Modify playNextSong function to handle shuffle and repeat
function playNextSong() {
    const songs = getAllSongItems();
    if (songs.length === 0) return;

    if (repeatMode === 'single') {
        // Replay the current song
        if (currentPlayingItem) {
            playSong(currentPlayingItem.dataset.filePath, currentPlayingItem);
            return;
        }
    }

    let nextSong;
    if (isShuffleEnabled) {
        const currentShuffleIndex = shuffledQueue.findIndex(item => item === currentPlayingItem);
        if (currentShuffleIndex === shuffledQueue.length - 1) {
            if (repeatMode === 'all') {
                updateShuffleQueue();
                nextSong = shuffledQueue[0];
            }
        } else {
            nextSong = shuffledQueue[currentShuffleIndex + 1];
        }
    } else {
        const currentIndex = getCurrentSongIndex();
        if (currentIndex === songs.length - 1) {
            if (repeatMode === 'all') {
                nextSong = songs[0];
            }
        } else {
            nextSong = songs[currentIndex + 1];
        }
    }

    if (nextSong) {
        playSong(nextSong.dataset.filePath, nextSong);
    }
}

// Modify playPreviousSong function to handle shuffle
function playPreviousSong() {
    const songs = getAllSongItems();
    if (songs.length === 0) return;

    if (isShuffleEnabled) {
        const currentShuffleIndex = shuffledQueue.findIndex(item => item === currentPlayingItem);
        const prevIndex = currentShuffleIndex <= 0 ? shuffledQueue.length - 1 : currentShuffleIndex - 1;
        const prevSong = shuffledQueue[prevIndex];
        if (prevSong) {
            playSong(prevSong.dataset.filePath, prevSong);
        }
    } else {
        const currentIndex = getCurrentSongIndex();
        const prevIndex = currentIndex <= 0 ? songs.length - 1 : currentIndex - 1;
        const prevSong = songs[prevIndex];
        if (prevSong) {
            playSong(prevSong.dataset.filePath, prevSong);
        }
    }
}

// Add event listeners for shuffle and repeat buttons
shuffleButton.addEventListener('click', () => {
    isShuffleEnabled = !isShuffleEnabled;
    shuffleButton.classList.toggle('active');
    if (isShuffleEnabled) {
        updateShuffleQueue();
    }
});

repeatButton.addEventListener('click', () => {
    switch (repeatMode) {
        case 'none':
            repeatMode = 'all';
            repeatButton.textContent = '🔁';
            repeatButton.title = 'Repeat All';
            repeatButton.classList.add('active');
            break;
        case 'all':
            repeatMode = 'single';
            repeatButton.textContent = '🔂';
            repeatButton.title = 'Repeat One';
            break;
        case 'single':
            repeatMode = 'none';
            repeatButton.textContent = '🔁';
            repeatButton.title = 'Repeat Off';
            repeatButton.classList.remove('active');
            break;
    }
});

// Add event listeners for next and previous buttons
nextButton.addEventListener('click', playNextSong);
prevButton.addEventListener('click', playPreviousSong);

// Auto-play next song when current song ends
audioPlayerElement.addEventListener('ended', playNextSong);
