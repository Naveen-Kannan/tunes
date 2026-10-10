const playlistRow = document.getElementById('playlist-row');
const songList = document.getElementById('song-list');
const searchInput = document.getElementById('search-input');
const audioPlayer = document.getElementById('audio-player');
const nowTitle = document.getElementById('now-title');
const nowArtist = document.getElementById('now-artist');
const prevButton = document.getElementById('prev-button');
const playButton = document.getElementById('play-button');
const nextButton = document.getElementById('next-button');
const shuffleButton = document.getElementById('shuffle-button');
const repeatButton = document.getElementById('repeat-button');
const seekSlider = document.getElementById('seek-slider');

let currentPlaylist = 'All_Downloads';
let playlists = [];
let songs = [];
let filteredSongs = [];
let currentIndex = -1;
let isSeeking = false;
let isShuffleEnabled = false;
let repeatMode = 'none';

function formatDuration(seconds) {
    if (!seconds) return '';
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remaining}`;
}

async function api(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error('Request failed');
    return response.json();
}

function renderError(message) {
    songList.innerHTML = '';
    const item = document.createElement('li');
    item.className = 'empty-state';
    item.textContent = message;
    songList.appendChild(item);
}

function renderPlaylists() {
    playlistRow.innerHTML = '';
    playlists.forEach(playlist => {
        const button = document.createElement('button');
        button.textContent = playlist === 'All_Downloads' ? 'All Downloads' : playlist;
        button.className = playlist === currentPlaylist ? 'active' : '';
        button.addEventListener('click', () => loadSongs(playlist));
        playlistRow.appendChild(button);
    });
}

function renderSongs() {
    const query = searchInput.value.trim().toLowerCase();
    filteredSongs = songs.filter(song => {
        return !query || `${song.title} ${song.artist} ${song.filename}`.toLowerCase().includes(query);
    });

    songList.innerHTML = '';
    filteredSongs.forEach(song => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        const title = document.createElement('span');
        const detail = document.createElement('span');

        title.className = 'song-title';
        detail.className = 'song-detail';
        title.textContent = song.title || song.filename;
        detail.textContent = [song.artist, formatDuration(song.duration)].filter(Boolean).join(' · ');

        button.appendChild(title);
        button.appendChild(detail);
        button.addEventListener('click', () => playSong(song));
        item.appendChild(button);
        songList.appendChild(item);
    });
}

async function loadSongs(playlist) {
    currentPlaylist = playlist;
    currentIndex = -1;
    renderPlaylists();
    const data = await api(`/api/songs?playlist=${encodeURIComponent(playlist)}`);
    songs = data.songs || [];
    renderSongs();
}

async function loadApp() {
    try {
        const data = await api('/api/playlists');
        playlists = data.playlists || ['All_Downloads'];
        renderPlaylists();
        updateModeButtons();
        await loadSongs(currentPlaylist);
    } catch (error) {
        renderError('Could not connect to Tunes on your Mac.');
    }
}

function playSong(song) {
    currentIndex = filteredSongs.findIndex(item => item.filename === song.filename);
    nowTitle.textContent = song.title || song.filename;
    nowArtist.textContent = song.artist || currentPlaylist;
    audioPlayer.src = `/stream/${encodeURIComponent(song.filename)}`;
    audioPlayer.play();
}

function getRandomIndex() {
    if (filteredSongs.length <= 1) return 0;
    let nextIndex = currentIndex;
    while (nextIndex === currentIndex) {
        nextIndex = Math.floor(Math.random() * filteredSongs.length);
    }
    return nextIndex;
}

function getRelativeIndex(offset) {
    if (!filteredSongs.length) return -1;
    if (isShuffleEnabled && offset > 0) return getRandomIndex();
    if (currentIndex < 0) return 0;
    return currentIndex + offset;
}

function playRelative(offset, fromEnded = false) {
    if (!filteredSongs.length) return;
    if (fromEnded && repeatMode === 'one') {
        audioPlayer.currentTime = 0;
        audioPlayer.play();
        return;
    }

    let nextIndex = getRelativeIndex(offset);
    const isPastEnd = nextIndex >= filteredSongs.length;
    const isBeforeStart = nextIndex < 0;

    if (isPastEnd || isBeforeStart) {
        if (repeatMode === 'all') {
            nextIndex = isPastEnd ? 0 : filteredSongs.length - 1;
        } else {
            audioPlayer.pause();
            return;
        }
    }

    playSong(filteredSongs[nextIndex]);
}

function updateModeButtons() {
    shuffleButton.classList.toggle('active', isShuffleEnabled);
    shuffleButton.textContent = isShuffleEnabled ? 'Shuffle On' : 'Shuffle';

    repeatButton.classList.toggle('active', repeatMode !== 'none');
    if (repeatMode === 'one') {
        repeatButton.textContent = 'Repeat One';
    } else if (repeatMode === 'all') {
        repeatButton.textContent = 'Repeat All';
    } else {
        repeatButton.textContent = 'Repeat Off';
    }
}

searchInput.addEventListener('input', renderSongs);
prevButton.addEventListener('click', () => playRelative(-1));
nextButton.addEventListener('click', () => playRelative(1));
shuffleButton.addEventListener('click', () => {
    isShuffleEnabled = !isShuffleEnabled;
    updateModeButtons();
});
repeatButton.addEventListener('click', () => {
    repeatMode = repeatMode === 'none' ? 'all' : repeatMode === 'all' ? 'one' : 'none';
    updateModeButtons();
});

playButton.addEventListener('click', () => {
    if (!audioPlayer.src && filteredSongs[0]) {
        playSong(filteredSongs[0]);
    } else if (audioPlayer.paused) {
        audioPlayer.play();
    } else {
        audioPlayer.pause();
    }
});

audioPlayer.addEventListener('play', () => {
    playButton.textContent = 'Pause';
});

audioPlayer.addEventListener('pause', () => {
    playButton.textContent = 'Play';
});

audioPlayer.addEventListener('ended', () => playRelative(1, true));

audioPlayer.addEventListener('timeupdate', () => {
    if (isSeeking || !audioPlayer.duration) return;
    seekSlider.value = String(Math.round((audioPlayer.currentTime / audioPlayer.duration) * 1000));
});

seekSlider.addEventListener('input', () => {
    isSeeking = true;
});

seekSlider.addEventListener('change', () => {
    if (audioPlayer.duration) {
        audioPlayer.currentTime = (Number(seekSlider.value) / 1000) * audioPlayer.duration;
    }
    isSeeking = false;
});

loadApp();
