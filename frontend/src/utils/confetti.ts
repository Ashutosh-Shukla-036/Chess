import confetti from 'canvas-confetti';

const celebratedMoves = new Set<string>();

export const celebrateBrilliant = (moveId: string) => {
    // Only celebrate each move once per session
    if (celebratedMoves.has(moveId)) return;
    celebratedMoves.add(moveId);

    // Gold confetti explosion
    confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#FFD700', '#FFA500', '#FFFF00', '#FFD700'],
        scalar: 1.2,
        gravity: 0.8,
        ticks: 200,
    });

    // Small second burst
    setTimeout(() => {
        confetti({
            particleCount: 30,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#FFD700', '#FFA500'],
        });
        confetti({
            particleCount: 30,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#FFD700', '#FFA500'],
        });
    }, 150);
};

export const resetCelebrations = () => {
    celebratedMoves.clear();
};
