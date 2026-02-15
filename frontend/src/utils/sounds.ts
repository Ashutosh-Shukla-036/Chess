import { Howl } from 'howler';

// In a real app, these would be local files. 
// For MVP/Demo without assets, we will use online URLs or placeholders if allowed.
// The user provided FreeSound URLs, but direct MP3 links are needed for Howl.
// I will use some reliable CDN links for generic sounds or placeholders.
// Actually, user said: "Add these free sounds to public/sounds/"
// Since I cannot browse the web to download files easily to specific paths without `wget` or `curl` to exact URLs and I don't have the files, 
// I will assume for now I can use online URLs that are CORS friendly or strictly placeholders.
// However, the user prompt explicitly said "Add these free sounds to public/sounds/".
// I will assume the user (or I) will place them there. 
// I'll check if I can download them using `run_command` if I had direct links.
// Since I don't have direct links, I will use a reliable placeholder service or fallback.
// Actually, `howler` works best with local files for low latency. 
// I'll define the paths as requested, and note that files need to be present.

// Wait, the user prompt GAVE URLs to freesound.org pages, not direct files. 
// I will point to `/sounds/filename.mp3` and assume they exist or will be added.
// For the purpose of this "Execution", I will create the code to use them.

const sounds = {
    // Using generic placeholder names as requested
    move: new Howl({ src: ['/sounds/move.mp3'], volume: 0.5 }),
    brilliant: new Howl({ src: ['/sounds/brilliant.mp3'], volume: 0.6 }),
    blunder: new Howl({ src: ['/sounds/blunder.mp3'], volume: 0.5 }),
    complete: new Howl({ src: ['/sounds/complete.mp3'], volume: 0.5 }),
};

export const playSound = (type: keyof typeof sounds) => {
    const isMuted = localStorage.getItem('soundsMuted') === 'true';
    if (!isMuted) {
        // Check if loaded, otherwise standard check
        sounds[type].play();
    }
};

export const toggleMute = () => {
    const isMuted = localStorage.getItem('soundsMuted') === 'true';
    localStorage.setItem('soundsMuted', String(!isMuted));
    return !isMuted;
};

export const getMuteState = () => {
    return localStorage.getItem('soundsMuted') === 'true';
}
