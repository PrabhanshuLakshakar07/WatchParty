/**
 * VideoAdapter.js (Hybrid Version)
 * ───────────────────────────────
 * Supports: Local MP4, Direct URLs, and YouTube Links.
 */

class VideoAdapter {
    constructor(element) {
        this.el = element; // HTML5 <video> element
        this.ytPlayer = null;
        this.activePlayer = 'html5'; // 'html5' or 'youtube'
        this.ytContainer = document.getElementById('yt-player-container');
        
        // Callbacks for events
        this.callbacks = {
            play: () => {},
            pause: () => {},
            seeked: () => {},
            loaded: () => {}
        };
    }

    /** Set Source: Detects if URL is YouTube or Direct Video */
    setSrc(src) {
        if (src.includes('youtube.com') || src.includes('youtu.be')) {
            this.activePlayer = 'youtube';
            this.el.style.display = 'none';
            this.ytContainer.style.display = 'block';
            this.initYouTube(this.extractYTId(src));
        } else {
            this.activePlayer = 'html5';
            this.ytContainer.style.display = 'none';
            this.el.style.display = 'block';
            this.el.src = src;
            this.el.load();
        }
    }

    extractYTId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    initYouTube(videoId) {
        if (this.ytPlayer && this.ytPlayer.loadVideoById) {
            this.ytPlayer.loadVideoById(videoId);
        } else {
            // Check if YT API is ready
            if (typeof YT !== 'undefined' && YT.Player) {
                this.ytPlayer = new YT.Player('yt-player-container', {
                    height: '100%',
                    width: '100%',
                    videoId: videoId,
                    playerVars: { 'autoplay': 1, 'controls': 1, 'rel': 0 },
                    events: {
                        'onStateChange': (event) => this.handleYTState(event)
                    }
                });
            } else {
                console.error("YouTube API not loaded yet!");
            }
        }
    }

    handleYTState(event) {
        // YT.PlayerState.PLAYING = 1, PAUSED = 2
        if (event.data === 1) this.callbacks.play();
        if (event.data === 2) this.callbacks.pause();
    }

    // ── Playback Controls ────────────────────────────────────────────────────

    play() {
        if (this.activePlayer === 'html5') return this.el.play();
        if (this.ytPlayer?.playVideo) this.ytPlayer.playVideo();
    }

    pause() {
        if (this.activePlayer === 'html5') this.el.pause();
        if (this.ytPlayer?.pauseVideo) this.ytPlayer.pauseVideo();
    }

    seek(t) {
        if (this.activePlayer === 'html5') this.el.currentTime = t;
        if (this.ytPlayer?.seekTo) this.ytPlayer.seekTo(t, true);
    }

    // ── State Getters ────────────────────────────────────────────────────────

    getCurrentTime() {
        if (this.activePlayer === 'html5') return this.el.currentTime;
        return this.ytPlayer?.getCurrentTime() || 0;
    }

    // ── Event Listeners ──────────────────────────────────────────────────────

    onPlay(fn) {
        this.callbacks.play = fn;
        this.el.addEventListener('play', fn);
    }

    onPause(fn) {
        this.callbacks.pause = fn;
        this.el.addEventListener('pause', fn);
    }

    onSeeked(fn) {
        this.el.addEventListener('seeked', fn);
        // YouTube doesn't have a direct 'seeked' event like HTML5
        // but it triggers 'onStateChange'
    }

    onSourceLoaded(fn) {
        this.el.addEventListener('loadedmetadata', fn);
    }

    // ── Controls Visibility ──────────────────────────────────────────────────

    showControls() {
        if (this.activePlayer === 'html5') this.el.setAttribute('controls', '');
    }

    hideControls() {
        if (this.activePlayer === 'html5') this.el.removeAttribute('controls');
    }
}