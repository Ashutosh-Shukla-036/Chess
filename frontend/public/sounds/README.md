# Sound Files Setup

The application uses sound effects to enhance user experience. You need to add the following sound files to `frontend/public/sounds/`:

## Required Sound Files

1. **move.mp3** - Soft chess piece placement sound
2. **brilliant.mp3** - Sparkle/chime sound for brilliant moves
3. **blunder.mp3** - Low "thud" sound for blunders
4. **complete.mp3** - Success chime when analysis completes

## Where to Find Free Sounds

You can download free chess-related sounds from:

- **Freesound.org**: https://freesound.org
  - Move sound: Search for "chess piece" or "wood click"
  - Brilliant: Search for "success chime" or "sparkle"
  - Blunder: Search for "error" or "thud"
  - Complete: Search for "success" or "achievement"

- **Alternative**: Use any royalty-free sound library like:
  - Zapsplat.com
  - Mixkit.co
  - Soundbible.com

## File Format

- Format: MP3
- Keep file sizes small (< 100KB each)
- Ensure sounds are short (< 2 seconds)

## Installation

1. Download the 4 sound files
2. Place them in `frontend/public/sounds/`
3. Ensure they are named exactly as listed above
4. The app will automatically load them via Howler.js

## Testing

After adding the sounds:
1. Run `npm run dev`
2. Upload a PGN file
3. Click on moves in the timeline to hear sounds
4. Use the volume toggle in the header to mute/unmute

**Note**: Sounds are muted by default if localStorage has `soundsMuted=true`. Clear localStorage or use the toggle to enable.
