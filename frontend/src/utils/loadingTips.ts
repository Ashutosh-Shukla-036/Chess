/**
 * Chess Tips and Facts for Loading Screen
 */

export const chessTips = [
    "💡 The longest possible chess game is 5,949 moves",
    "♟️ There are more possible chess games than atoms in the observable universe",
    "🏆 The word 'checkmate' comes from the Persian phrase 'Shah Mat' meaning 'the king is dead'",
    "⚡ The fastest checkmate possible is in 2 moves (Fool's Mate)",
    "🎯 A knight can visit every square on the board exactly once (Knight's Tour)",
    "👑 The queen is the most powerful piece, worth about 9 pawns",
    "🔄 Castling is the only move where two pieces move at once",
    "📚 The longest official chess game lasted 269 moves (20 hours!)",
    "🌟 Garry Kasparov became World Champion at age 22",
    "🎲 There are 400 different positions after one move each",
    "🧠 Chess improves memory, concentration, and problem-solving skills",
    "⏱️ Blitz chess games are played in under 10 minutes",
    "🏅 Magnus Carlsen has the highest rating ever recorded (2882)",
    "♟️ En passant is French for 'in passing'",
    "🎭 The rook is also called a 'castle' in some languages"
];

/**
 * Get a random chess tip
 */
export function getRandomTip(): string {
    return chessTips[Math.floor(Math.random() * chessTips.length)];
}

/**
 * Format elapsed time as MM:SS
 */
export function formatElapsedTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get estimated time remaining
 */
export function getEstimatedTimeRemaining(elapsedSeconds: number, progress: number): string {
    if (progress === 0) return "Estimating...";
    if (progress >= 95) return "Almost done...";

    // Estimate based on current progress
    const estimatedTotal = (elapsedSeconds / progress) * 100;
    const remaining = Math.max(0, Math.ceil(estimatedTotal - elapsedSeconds));

    if (remaining < 60) return `~${remaining}s remaining`;
    const mins = Math.ceil(remaining / 60);
    return `~${mins}m remaining`;
}
