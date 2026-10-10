const youtubeUrlInput = document.getElementById('youtube-url');
const downloadStatus = document.getElementById('download-status');
const songList = document.getElementById('song-list');
const audioPlayer = document.getElementById('audio-player');
const nowPlaying = document.getElementById('now-playing');
const playlistList = document.getElementById('playlist-list');

let currentPlayingItem = null;
let currentSong = null;
let playlistSongs = [];
let loadRequest = 0;
let preferences = {};
try { preferences = JSON.parse(localStorage.getItem('tunes.preferences') || '{}') || {}; } catch (_) {}
function savePreference(key, value) {
    preferences[key] = value;
    try { localStorage.setItem('tunes.preferences', JSON.stringify(preferences)); } catch (_) {}
}
let currentPlaylist = 'All_Downloads';
let isShuffleEnabled = preferences.shuffle === true;
let repeatMode = ['none', 'all', 'single'].includes(preferences.repeat) ? preferences.repeat : 'none'; // 'none', 'all', or 'single'
let shuffledQueue = [];
let queue = []; // Playback queue

// Audio player functionality
const audioPlayerElement = document.createElement('audio');
audioPlayerElement.style.display = 'none';
document.body.appendChild(audioPlayerElement);

// Player controls
const playButton = document.getElementById('play-button');
const prevButton = document.getElementById('prev-button');
const nextButton = document.getElementById('next-button');
const muteButton = document.getElementById('mute-button');
const shuffleButton = document.getElementById('shuffle-button');
const repeatButton = document.getElementById('repeat-button');


const progressBar = document.querySelector('.progress-bar');
const volumeSlider = document.querySelector('.volume-slider');
const currentTimeDisplay = document.getElementById('current-time');
const durationDisplay = document.getElementById('total-duration');

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

function updateProgress() {
    const duration = audioPlayerElement.duration;
    const position = audioPlayerElement.currentTime;
    const percent = Number.isFinite(duration) && duration > 0 ? position / duration * 100 : 0;
    progressBar.disabled = !Number.isFinite(duration) || duration <= 0;
    progressBar.value = percent;
    progressBar.style.setProperty('--fill', `${percent}%`);
    progressBar.setAttribute('aria-valuetext', `${formatTime(position)} of ${formatTime(duration)}`);
    currentTimeDisplay.textContent = formatTime(position);
    durationDisplay.textContent = formatTime(duration);
}
audioPlayerElement.addEventListener('timeupdate', updateProgress);
audioPlayerElement.addEventListener('loadedmetadata', updateProgress);
audioPlayerElement.addEventListener('emptied', updateProgress);
progressBar.addEventListener('input', () => {
    if (Number.isFinite(audioPlayerElement.duration)) {
        audioPlayerElement.currentTime = Number(progressBar.value) / 100 * audioPlayerElement.duration;
        updateProgress();
    }
});

function updatePlaybackControls() {
    const playing = !audioPlayerElement.paused;
    setControlIcon(playButton, playing ? 'pause' : 'play', playing ? 'Pause (Space)' : 'Play (Space)');
    const label = nowPlaying.querySelector('.now-playing-label');
    if (label && currentSong) label.textContent = playing ? 'Now playing' : 'Paused';
}
playButton.addEventListener('click', () => {
    if (!currentSong) {
        const first = getAllSongItems().find(item => !item.hidden);
        if (first) playSong(songMetadataMap.get(first.dataset.filename), first);
        return;
    }
    if (audioPlayerElement.paused) audioPlayerElement.play().catch(() => showToast('Could not play this song.'));
    else audioPlayerElement.pause();
});

let lastVolume = Number.isFinite(preferences.lastVolume) && preferences.lastVolume > 0 && preferences.lastVolume <= 1 ? preferences.lastVolume : 1;
const volumeDisplay = document.getElementById('volume-display');
function updateVolume() {
    const volume = audioPlayerElement.volume;
    volumeSlider.value = Math.round(volume * 100);
    volumeSlider.style.setProperty('--fill', `${volume * 100}%`);
    volumeDisplay.textContent = `${Math.round(volume * 100)}%`;
    volumeSlider.setAttribute('aria-valuetext', volumeDisplay.textContent);
    setControlIcon(muteButton, volume > 0 ? 'volume' : 'muted', volume > 0 ? 'Mute (M)' : 'Unmute (M)');
}
function setVolume(volume) {
    audioPlayerElement.volume = Math.max(0, Math.min(1, volume));
    if (audioPlayerElement.volume > 0) lastVolume = audioPlayerElement.volume;
    savePreference('volume', audioPlayerElement.volume);
    savePreference('lastVolume', lastVolume);
    updateVolume();
}
audioPlayerElement.volume = Number.isFinite(preferences.volume) ? Math.max(0, Math.min(1, preferences.volume)) : 1;
updateVolume();
muteButton.addEventListener('click', () => setVolume(audioPlayerElement.volume > 0 ? 0 : lastVolume));
volumeSlider.addEventListener('input', () => setVolume(Number(volumeSlider.value) / 100));

// Function to add a song item to the list
let songMetadataMap = new Map();

function addSongToList(song) {
    if (!song.title) song.title = song.filename;
    songMetadataMap.set(song.filename, song);

    const listItem = document.createElement('li');
    listItem.className = 'song-item';
    listItem.dataset.filePath = song.filePath;
    listItem.dataset.filename = song.filename;
    listItem.draggable = true;
    listItem.tabIndex = 0;
    listItem.setAttribute('aria-label', `Play ${song.title}`);
    const number = document.createElement('span');
    number.className = 'song-number';
    number.textContent = songList.children.length + 1;
    listItem.appendChild(number);

    // Drag events
    listItem.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/json', JSON.stringify(song));
        e.dataTransfer.effectAllowed = 'copy';
    });

    // Create info container
    const info = document.createElement('div');
    info.className = 'song-info';

    const title = document.createElement('div');
    title.className = 'song-title';
    title.textContent = song.title;
    title.title = song.title;

    info.appendChild(title);
    if (song.artist && song.artist !== 'Unknown Artist') {
        const artist = document.createElement('div');
        artist.className = 'song-artist';
        artist.textContent = song.artist;
        info.appendChild(artist);
    }

    // Duration
    const duration = document.createElement('div');
    duration.className = 'song-duration';
    duration.textContent = formatTime(song.duration || 0);

    // Append all
    listItem.appendChild(info);
    listItem.appendChild(duration);
    const actions = document.createElement('div');
    actions.className = 'song-actions';
    const queueAction = document.createElement('button');
    queueAction.className = 'icon-button';
    setControlIcon(queueAction, 'plus', `Add ${song.title} to queue`);
    queueAction.addEventListener('click', e => { e.stopPropagation(); addToQueue(song); });
    const moreAction = document.createElement('button');
    moreAction.className = 'icon-button';
    setControlIcon(moreAction, 'more', `Options for ${song.title}`);
    moreAction.addEventListener('click', e => {
        e.stopPropagation();
        const rect = moreAction.getBoundingClientRect();
        showSongContextMenu({ pageX: rect.left, pageY: rect.bottom }, song, listItem);
    });
    actions.append(queueAction, moreAction);
    listItem.appendChild(actions);
    listItem.addEventListener('keydown', e => {
        if (e.target === listItem && e.key === 'Enter') {
            e.preventDefault();
            playSong(song, listItem);
        }
    });

    listItem.addEventListener('click', () => {
        playSong(song, listItem);
    });

    // Add context menu listener for song management
    listItem.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showSongContextMenu(e, song, listItem);
    });

    songList.appendChild(listItem);
}

const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('total-duration');

// ...

// Function to play a song
function playSong(song, listItem) {
    if (!song || !song.filePath) {
        console.error('Missing file path for song:', song);
        return;
    }
    console.log(`Playing: ${song.filePath}`);

    let displayTitle = song.title;
    if (!displayTitle && song.filename) {
        displayTitle = song.filename.replace(/\.[^/.]+$/, "");
    }
    displayTitle = displayTitle || 'Unknown Title';

    currentSong = song;
    audioPlayerElement.src = tunesLibrary.songURL(song.filePath);
    audioPlayerElement.play().catch(() => showToast('Could not play this song.'));
    updateProgress();

    // Update Now Playing UI: Text Only
    nowPlaying.innerHTML = '';

    const textContainer = document.createElement('div');
    textContainer.className = 'now-playing-text';

    const titleEl = document.createElement('div');
    titleEl.className = 'now-playing-title';
    titleEl.textContent = displayTitle;
    titleEl.title = displayTitle;

    const label = document.createElement('span');
    label.className = 'now-playing-label';
    label.textContent = 'Now playing';
    textContainer.appendChild(label);
    textContainer.appendChild(titleEl);
    nowPlaying.appendChild(textContainer);

    currentPlayingItem = listItem || getAllSongItems().find(item => item.dataset.filename === song.filename) || null;
    refreshPlayingRows();
}

function refreshPlayingRows() {
    getAllSongItems().forEach((item, index) => {
        const active = !!currentSong && item.dataset.filename === currentSong.filename;
        item.classList.toggle('playing', active);
        item.querySelector('.song-number').innerHTML = active ? tunesIcon('music') : String(index + 1);
    });
}

// Function to load songs for a specific playlist
async function loadPlaylistSongs(playlistName) {
    const request = ++loadRequest;
    try {
        const downloads = await window.electronAPI.getDownloads(playlistName);
        if (request !== loadRequest) return;
        playlistSongs = downloads || [];
        songList.innerHTML = '';
        playlistSongs.forEach(addSongToList);
        currentPlayingItem = currentSong ? getAllSongItems().find(item => item.dataset.filename === currentSong.filename) || null : null;
        applyLibraryView();
        if (isShuffleEnabled) updateShuffleQueue();
    } catch (error) {
        if (request === loadRequest) showToast('Could not load this playlist.');
        console.error(error);
    }
}

// Function to load all playlists
async function loadPlaylists() {
    const playlists = await window.electronAPI.getPlaylists();
    playlistList.innerHTML = '';

    // Add "All Downloads" as the first playlist
    const allDownloadsItem = document.createElement('li');
    allDownloadsItem.innerHTML = `${tunesIcon('library')}<span>All Downloads</span>`;
    allDownloadsItem.dataset.playlistName = 'All_Downloads';
    allDownloadsItem.classList.toggle('active', currentPlaylist === 'All_Downloads');
    makePlaylistAccessible(allDownloadsItem, 'All_Downloads');
    allDownloadsItem.addEventListener('click', () => switchPlaylist('All_Downloads'));
    playlistList.appendChild(allDownloadsItem);

    // Add other playlists
    playlists.forEach(playlist => {
        if (playlist !== 'All_Downloads') {
            const playlistItem = document.createElement('li');
            playlistItem.innerHTML = tunesIcon('music');
            const label = document.createElement('span');
            label.textContent = playlist;
            playlistItem.appendChild(label);
            playlistItem.classList.toggle('active', currentPlaylist === playlist);
            makePlaylistAccessible(playlistItem, playlist);
            playlistItem.dataset.playlistName = playlist;

            // Drag and Drop handlers
            playlistItem.addEventListener('dragover', (e) => {
                e.preventDefault();
                playlistItem.style.background = 'rgba(255, 255, 255, 0.2)';
            });

            playlistItem.addEventListener('dragleave', (e) => {
                playlistItem.style.background = '';
            });

            playlistItem.addEventListener('drop', async (e) => {
                e.preventDefault();
                playlistItem.style.background = '';
                const data = e.dataTransfer.getData('application/json');
                if (data) {
                    try {
                        const song = JSON.parse(data);
                        await addSongToPlaylist(song, playlist);
                    } catch (err) {
                        console.error('Drop error:', err);
                    }
                }
            });

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
        if (item.dataset.playlistName === playlistName) {
            item.classList.add('active');
        }
    });

    // Update the main content title
    const mainTitle = document.querySelector('.main-content h1');
    mainTitle.textContent = playlistName === 'All_Downloads' ? 'All Downloads' : playlistName;

    // Load songs for the selected playlist
    await loadPlaylistSongs(playlistName);
}

// Function to show context menu for playlist management
function showPlaylistContextMenu(event, playlistName, playlistItem) {
    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
        <button class="context-menu-item rename-playlist">Rename Playlist</button>
        <button class="context-menu-item delete-playlist">Delete Playlist</button>
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
    mountContextMenu(menu);
}

// Function to show context menu for song management
function showSongContextMenu(event, song, listItem) {
    // Remove any existing context menus
    document.querySelectorAll('.context-menu').forEach(menu => menu.remove());

    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'context-menu';

    let menuHTML = `<button class="context-menu-item add-to-queue">Add to Queue</button>`;

    if (currentPlaylist === 'All_Downloads') {
        // For All Downloads, show add to playlist and delete options
        menuHTML += `
            <button class="context-menu-item add-to-playlist">Add to Playlist</button>
            <button class="context-menu-item delete-song">Delete Song</button>
        `;
    } else {
        // For other playlists, show remove from playlist option
        menuHTML += `
            <button class="context-menu-item remove-song">Remove from Playlist</button>
        `;
    }

    menu.innerHTML = menuHTML;

    // Position the menu at the click location
    menu.style.left = `${event.pageX}px`;
    menu.style.top = `${event.pageY}px`;

    // Add Queue Handler (common)
    const addToQueueOption = menu.querySelector('.add-to-queue');
    if (addToQueueOption) {
        addToQueueOption.addEventListener('click', () => {
            addToQueue(song);

            menu.remove();
        });
    }

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

    // Add Lyrics Search handler (common to both)
    // Add "Search Lyrics" item to menuHTML
    const lyricsItem = document.createElement('button');
    lyricsItem.className = 'context-menu-item lyrics-search';
    lyricsItem.textContent = 'Search Lyrics';
    menu.insertBefore(lyricsItem, menu.firstChild); // Add to top

    lyricsItem.addEventListener('click', () => {
        const query = encodeURIComponent(`${song.title} lyrics`);
        const url = `https://www.google.com/search?q=${query}`;
        // Use window.open to open in default browser (Electron handles this by default usually, or needs shell.openExternal)
        // Since we have contextIsolation, we might need an IPC handler for 'open-external'
        // But for <a target="_blank"> it works. For window.open, it might open a new window.
        // Let's use a new IPC method for safety.
        window.electronAPI.openExternal(url);
        menu.remove();
    });

    // Add click handler to close menu when clicking outside
    const closeMenu = (e) => {
        if (menu && !menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu, true);
        }
    };
    document.addEventListener('click', closeMenu, true);

    // Add the menu to the document
    mountContextMenu(menu);
}


// Extract download logic
async function handleDownloadInput() {
    let input = youtubeUrlInput.value.trim();
    if (!input) {
        downloadStatus.textContent = 'Please enter a URL or search term.';
        return;
    }

    // Check if input is a valid URL
    let isUrl = false;
    try {
        new URL(input);
        isUrl = true;
    } catch (_) {
        isUrl = false;
    }

    if (!isUrl) {
        // Assume it's a search term
        performSearch(input);
        return;
    }

    // It is a URL, proceed with download
    let url = input;

    // Remove playlist and radio parameters
    try {
        const urlObj = new URL(url);
        urlObj.searchParams.delete('list');
        urlObj.searchParams.delete('index');
        urlObj.searchParams.delete('start_radio');
        url = urlObj.toString();
    } catch (e) {
        // Fallback
    }

    console.log('Cleaned URL:', url);
    downloadStatus.textContent = 'Starting download...';
    youtubeUrlInput.disabled = true;

    try {
        console.log(`Sending download request for ${url} to main process.`);
        const result = await window.electronAPI.downloadSong(url, currentPlaylist);
        console.log('Download result:', result);

        if (result.success) {
            downloadStatus.textContent = `Downloaded: ${result.title}`;
            await loadPlaylistSongs(currentPlaylist);
            youtubeUrlInput.value = '';
        } else {
            downloadStatus.textContent = `Error: ${result.error}`;
            console.error('Download failed:', result.error);
        }
    } catch (error) {
        downloadStatus.textContent = `Error: ${error.message}`;
        console.error('IPC Error:', error);
    } finally {
        youtubeUrlInput.disabled = false;
        youtubeUrlInput.focus();
    }
}

// Event listener for Enter key in search input
document.getElementById('add-song-btn').addEventListener('click', handleDownloadInput);
youtubeUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        handleDownloadInput();
    }
});

// Search functionality
const searchResultsModal = document.getElementById('search-results-modal');
const closeSearchResultsBtn = document.querySelector('.close-search-results-modal');
const searchResultsList = document.getElementById('search-results-list');
const searchLoading = document.getElementById('search-loading');

closeSearchResultsBtn.addEventListener('click', () => {
    searchResultsModal.style.display = 'none';
});

searchResultsModal.addEventListener('click', (e) => {
    if (e.target === searchResultsModal) {
        searchResultsModal.style.display = 'none';
    }
});

async function performSearch(query) {
    searchResultsModal.style.display = 'block';
    searchResultsList.innerHTML = '';
    searchLoading.style.display = 'block';

    try {
        const result = await window.electronAPI.searchYouTube(query);
        searchLoading.style.display = 'none';

        if (result.success && result.results.length > 0) {
            result.results.forEach(video => {
                const li = document.createElement('li');
                li.className = 'search-result-item';
                li.tabIndex = 0;
                li.setAttribute('aria-label', `Download ${video.title}`);
                const thumbnail = document.createElement('img');
                thumbnail.src = video.thumbnail;
                thumbnail.className = 'search-result-thumbnail';
                thumbnail.alt = '';
                const info = document.createElement('div');
                info.className = 'search-result-info';
                const title = document.createElement('div');
                title.className = 'search-result-title';
                title.textContent = video.title;
                const meta = document.createElement('div');
                meta.className = 'search-result-meta';
                meta.textContent = `${video.author} · ${video.duration}`;
                info.append(title, meta);
                li.append(thumbnail, info);
                li.addEventListener('keydown', e => { if (e.key === 'Enter') li.click(); });


                li.addEventListener('click', () => {
                    // Trigger download
                    searchResultsModal.style.display = 'none';
                    youtubeUrlInput.value = video.url;
                    handleDownloadInput();
                });

                searchResultsList.appendChild(li);
            });
        } else {
            searchResultsList.innerHTML = '<li style="padding:20px; text-align:center;">No results found.</li>';
        }
    } catch (error) {
        searchLoading.style.display = 'none';
        searchResultsList.textContent = `Search failed: ${error.message}`;
    }
}

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

// Shortcuts leave text fields, native controls and open dialogs in charge of their keys.
document.addEventListener('keydown', e => {
    const modal = getOpenModal();
    if (e.key === 'Escape') {
        if (modal) modal.style.display = 'none';
        else if (document.querySelector('.context-menu')) document.querySelectorAll('.context-menu').forEach(menu => menu.remove());
        else clearFilter();
        return;
    }
    if (modal) {
        if (e.key === 'Tab') trapDialogFocus(e, modal);
        return;
    }
    if ((e.metaKey || e.ctrlKey) && ['f', 'k'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        const input = e.key.toLowerCase() === 'f' ? localSearchInput : youtubeUrlInput;
        input.focus();
        input.select();
        return;
    }
    const target = document.activeElement;
    if (target.matches('input, select, textarea, button, [contenteditable=true]') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '?' && !e.repeat) {
        e.preventDefault();
        document.getElementById('shortcuts-modal').style.display = 'block';
        return;
    }
    if (e.shiftKey && ['ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        if (Number.isFinite(audioPlayerElement.duration)) {
            audioPlayerElement.currentTime = Math.max(0, Math.min(audioPlayerElement.duration, audioPlayerElement.currentTime + (e.key === 'ArrowLeft' ? -10 : 10)));
        }
        return;
    }
    if (e.repeat) return;
    const controls = { ' ': playButton, ArrowLeft: prevButton, ArrowRight: nextButton, m: muteButton, s: shuffleButton, r: repeatButton, q: queueButton };
    const control = controls[e.key] || controls[e.key.toLowerCase()];
    if (control) { e.preventDefault(); control.click(); }
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

// Queue Modal Logic
const queueButton = document.getElementById('queue-button');
const queueModal = document.getElementById('queue-modal');
const closeQueueModalBtn = document.querySelector('.close-queue-modal');
const queueList = document.getElementById('queue-list');
const clearQueueBtn = document.getElementById('clear-queue-btn');

queueButton.addEventListener('click', () => {
    updateQueueList();
    queueModal.style.display = 'block';
});

closeQueueModalBtn.addEventListener('click', () => {
    queueModal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === queueModal) {
        queueModal.style.display = 'none';
    }
});

clearQueueBtn.addEventListener('click', () => {
    queue.length = 0; // Clear array
    updateQueueList();
});

function updateQueueList() {
    queueList.innerHTML = '';
    const badge = document.getElementById('queue-count');
    badge.hidden = queue.length === 0;
    badge.textContent = queue.length;
    queueButton.setAttribute('aria-label', `Queue, ${queue.length} ${queue.length === 1 ? 'song' : 'songs'}`);
    clearQueueBtn.style.display = queue.length ? 'inline-flex' : 'none';
    if (!queue.length) {
        const empty = document.createElement('li');
        empty.className = 'empty-state';
        empty.textContent = 'Use + beside a song to add it here.';
        queueList.appendChild(empty);
    }
    queue.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'queue-item';
        const title = document.createElement('span');
        title.textContent = item.title || item.filename;
        title.title = title.textContent;
        const remove = document.createElement('button');
        remove.className = 'icon-button';
        setControlIcon(remove, 'close', `Remove ${title.textContent} from queue`);
        remove.onclick = () => { queue.splice(index, 1); updateQueueList(); };
        li.append(title, remove);
        queueList.appendChild(li);
    });
}

function addToQueue(song) {
    queue.push({ ...song });
    updateQueueList();
    showToast(`Added to queue: ${song.title}`);
}

const localSearchInput = document.getElementById('local-search-input');
localSearchInput.addEventListener('input', applyLibraryView);
document.getElementById('clear-filter-btn').addEventListener('click', clearFilter);
function clearFilter() {
    localSearchInput.value = '';
    applyLibraryView();
}
function applyLibraryView() {
    const visible = tunesLibrary.selectSongs(playlistSongs, localSearchInput.value);
    const visibleNames = new Set(visible.map(song => song.filename));
    getAllSongItems().forEach(item => { item.hidden = !visibleNames.has(item.dataset.filename); });
    const filtering = !!localSearchInput.value.trim();
    document.getElementById('clear-filter-btn').hidden = !localSearchInput.value;
    document.getElementById('filter-hint').hidden = !!localSearchInput.value;
    document.getElementById('library-summary').textContent = filtering ? `${visible.length} of ${playlistSongs.length} songs · ${tunesLibrary.summarizeSongs(visible).split(' · ')[1]}` : tunesLibrary.summarizeSongs(playlistSongs);
    document.getElementById('library-empty').hidden = visible.length > 0;
    document.getElementById('empty-title').textContent = filtering ? 'No matches' : 'No songs';
    document.getElementById('empty-description').textContent = filtering ? 'Try a different title or artist. Press Esc to clear the filter.' : currentPlaylist === 'All_Downloads' ? 'Find a song above to add it to your library.' : 'Drag songs here from All Downloads, or find a new song above.';
    document.getElementById('play-library-btn').disabled = !visible.length;
    refreshPlayingRows();
}


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
        .map(li => li.dataset.playlistName)
        .filter(name => name && name !== 'All_Downloads');

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
            playlistSongs = playlistSongs.filter(item => item.filename !== song.filename);
            applyLibraryView();
            // If the removed song was playing, stop playback
            if (currentPlayingItem === listItem) {
                audioPlayerElement.pause();
                audioPlayerElement.src = '';
                nowPlaying.textContent = 'No song playing';
                currentPlayingItem.classList.remove('playing');
                currentPlayingItem = null;
                currentSong = null;
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
        // Since we're in All_Downloads, delete the actual file
        const result = await window.electronAPI.deleteSongFile(song.filePath);

        if (!result.success) {
            alert(result.error || 'Failed to delete song');
            return;
        }

        // Remove from UI
        listItem.remove();
        playlistSongs = playlistSongs.filter(item => item.filename !== song.filename);
        applyLibraryView();

        // If the deleted song was playing, stop playback
        if (currentPlayingItem === listItem) {
            audioPlayerElement.pause();
            audioPlayerElement.src = '';
            nowPlaying.textContent = 'No song playing';
            currentPlayingItem.classList.remove('playing');
            currentPlayingItem = null;
            currentSong = null;
        }

        queue = queue.filter(item => item.filename !== song.filename);
        updateQueueList();
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
            playlistItem.querySelector('span').textContent = newName;
            playlistItem.dataset.playlistName = newName;

            // If we're currently viewing this playlist, update the title
            if (currentPlaylist === oldName) {
                currentPlaylist = newName;
                const mainTitle = document.querySelector('.main-content h1');
                mainTitle.textContent = newName;
            }

            await loadPlaylists();
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
function playNextSong(automatic = false) {
    const songs = getAllSongItems();
    // if (songs.length === 0) return; // Allow playing from queue even if list is empty?
    // But mostly we play within context.

    if (queue.length > 0) {
        const queueItem = queue.shift();
        updateQueueList();

        let listItem = null;
        if (queueItem.listItem && document.body.contains(queueItem.listItem)) {
            listItem = queueItem.listItem;
        } else {
            // Find by filename in current view
            listItem = Array.from(songList.children).find(li => li.dataset.filename === queueItem.filename);
        }

        const song = songMetadataMap.get(queueItem.filename) || queueItem;
        playSong(song, listItem);
        return;
    }

    if (automatic === true && repeatMode === 'single' && currentSong) {
        playSong(currentSong, currentPlayingItem);
        return;
    }
    if (songs.length === 0) return;


    let nextItem;
    if (isShuffleEnabled) {
        const currentShuffleIndex = shuffledQueue.findIndex(item => item === currentPlayingItem);
        if (currentShuffleIndex === shuffledQueue.length - 1) {
            if (repeatMode === 'all') {
                updateShuffleQueue();
                nextItem = shuffledQueue[0];
            }
        } else {
            nextItem = shuffledQueue[currentShuffleIndex + 1];
        }
    } else {
        const currentIndex = getCurrentSongIndex();
        if (currentIndex === songs.length - 1) {
            if (repeatMode === 'all') {
                nextItem = songs[0];
            }
        } else {
            nextItem = songs[currentIndex + 1];
        }
    }

    if (nextItem) {
        // The `nextItem` is a DOM element (listItem).
        // We need to get the song metadata from it.
        const filename = nextItem.dataset.filename;
        const song = songMetadataMap.get(filename);
        playSong(song, nextItem);
    }
}

// Modify playPreviousSong function to handle shuffle
function playPreviousSong() {
    const songs = getAllSongItems();
    if (songs.length === 0) return;

    let prevItem;
    if (isShuffleEnabled) {
        const currentShuffleIndex = shuffledQueue.findIndex(item => item === currentPlayingItem);
        const prevIndex = currentShuffleIndex <= 0 ? shuffledQueue.length - 1 : currentShuffleIndex - 1;
        prevItem = shuffledQueue[prevIndex];
    } else {
        const currentIndex = getCurrentSongIndex();
        const prevIndex = currentIndex <= 0 ? songs.length - 1 : currentIndex - 1;
        prevItem = songs[prevIndex];
    }

    if (prevItem) {
        const song = songMetadataMap.get(prevItem.dataset.filename);
        playSong(song, prevItem);
    }
}

function updateModeControls() {
    shuffleButton.classList.toggle('active', isShuffleEnabled);
    shuffleButton.setAttribute('aria-pressed', String(isShuffleEnabled));
    shuffleButton.setAttribute('aria-label', isShuffleEnabled ? 'Shuffle on' : 'Shuffle off');
    repeatButton.classList.toggle('active', repeatMode !== 'none');
    const label = { none: 'Repeat off', all: 'Repeat all', single: 'Repeat one' }[repeatMode];
    setControlIcon(repeatButton, repeatMode === 'single' ? 'repeat-one' : 'repeat', `${label} (R)`);
}
shuffleButton.addEventListener('click', () => {
    isShuffleEnabled = !isShuffleEnabled;
    savePreference('shuffle', isShuffleEnabled);
    if (isShuffleEnabled) updateShuffleQueue();
    updateModeControls();
});
repeatButton.addEventListener('click', () => {
    repeatMode = { none: 'all', all: 'single', single: 'none' }[repeatMode];
    savePreference('repeat', repeatMode);
    updateModeControls();
});
updateModeControls();

// Add event listeners for next and previous buttons
nextButton.addEventListener('click', playNextSong);
prevButton.addEventListener('click', playPreviousSong);

// Auto-play next song when current song ends
audioPlayerElement.addEventListener('ended', () => playNextSong(true));

// Media Key Handlers
if (window.electronAPI && window.electronAPI.on) {
    window.electronAPI.on('media-play-pause', () => {
        playButton.click();
    });

    window.electronAPI.on('media-prev-track', () => {
        prevButton.click();
    });

    window.electronAPI.on('media-next-track', () => {
        nextButton.click();
    });
}

// Recording control acknowledges the pause before Flow opens the microphone.
const dictationPlayback = createDictationPlayback(audioPlayerElement);
audioPlayerElement.addEventListener('play', updatePlaybackControls);
audioPlayerElement.addEventListener('pause', updatePlaybackControls);
window.electronAPI.onDictationControl(async (action, token) => {
    if (action === 'begin') return dictationPlayback.begin(token);
    if (action === 'end') return dictationPlayback.end(token);
    return { paused: audioPlayerElement.paused, currentTime: audioPlayerElement.currentTime };
});


let toastTimer;
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
}

function makePlaylistAccessible(item, name) {
    item.tabIndex = 0;
    item.title = name === 'All_Downloads' ? 'All Downloads' : name;
    item.addEventListener('keydown', e => {
        if (e.target === item && e.key === 'Enter') { e.preventDefault(); item.click(); }
    });
}
function mountContextMenu(menu) {
    document.querySelectorAll('.context-menu').forEach(item => item.remove());
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(parseFloat(menu.style.left), innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(56, Math.min(parseFloat(menu.style.top), innerHeight - rect.height - 8))}px`;
    menu.querySelector('button')?.focus();
}

const sidebarToggle = document.getElementById('sidebar-toggle');
function setSidebar(open) {
    document.body.classList.toggle('sidebar-open', open);
    sidebarToggle.setAttribute('aria-expanded', String(open));
}
setSidebar(preferences.sidebar !== false);
sidebarToggle.addEventListener('click', () => {
    const open = !document.body.classList.contains('sidebar-open');
    setSidebar(open);
    savePreference('sidebar', open);
});
document.getElementById('play-library-btn').addEventListener('click', () => {
    const first = getAllSongItems().find(item => !item.hidden);
    if (first) playSong(songMetadataMap.get(first.dataset.filename), first);
});
document.getElementById('now-playing-button').addEventListener('click', async () => {
    if (!currentSong) return;
    if (!currentPlayingItem) await switchPlaylist('All_Downloads');
    clearFilter();
    if (currentPlayingItem) {
        currentPlayingItem.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        currentPlayingItem.focus({ preventScroll: true });
    }
});

const shortcutsModal = document.getElementById('shortcuts-modal');
document.getElementById('shortcuts-button').addEventListener('click', () => { shortcutsModal.style.display = 'block'; });
document.querySelector('.close-shortcuts-modal').addEventListener('click', () => { shortcutsModal.style.display = 'none'; });
shortcutsModal.addEventListener('click', e => { if (e.target === shortcutsModal) shortcutsModal.style.display = 'none'; });
function getOpenModal() {
    return Array.from(document.querySelectorAll('.modal')).find(modal => modal.style.display === 'block');
}
function dialogControls(modal) {
    return Array.from(modal.querySelectorAll('button, input, select, [tabindex="0"]')).filter(el => !el.disabled && el.getClientRects().length);
}
function trapDialogFocus(event, modal) {
    const controls = dialogControls(modal);
    const first = controls[0], last = controls[controls.length - 1];
    if (!first) return;
    if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
    }
}
document.querySelectorAll('.modal').forEach(modal => {
    let wasOpen = false, returnFocus;
    const observer = new MutationObserver(() => {
        const open = modal.style.display === 'block';
        if (open && !wasOpen) {
            returnFocus = modal.contains(document.activeElement) ? createPlaylistBtn : document.activeElement;
            (modal.querySelector('input, select') || dialogControls(modal)[0])?.focus();
        } else if (!open && wasOpen && returnFocus?.isConnected) returnFocus.focus();
        wasOpen = open;
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
});
updateQueueList();
