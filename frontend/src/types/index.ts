export type MoveQuality =
    | 'Brilliant'
    | 'Great'
    | 'Best'
    | 'Excellent'
    | 'Good'
    | 'Book'
    | 'Forced'
    | 'Inaccuracy'
    | 'Mistake'
    | 'Blunder'
    | 'Missed Win';

export interface MoveAnalysis {
    move_number: number;
    side: 'white' | 'black';
    san: string;              // e.g., "Nf3"
    uci: string;              // e.g., "g1f3"
    eval_before: number;      // Position eval before move
    eval_after: number;       // Position eval after move  
    label: MoveQuality;
    accuracy: number;         // 0-100
    phase: string;            // "opening", "middlegame", "endgame"
    best_move: string | null; // What engine recommended
    is_critical: boolean;     // Critical moment flag
}

export interface GameSummary {
    total_moves: number;
    opening: string | null;   // Opening name
    accuracy: {
        white: number;
        black: number;
    };
    white: Record<string, number>;  // Move quality counts
    black: Record<string, number>;
    critical_moments: Array<{
        move_number: number;
        side: string;
        san: string;
        label: string;
    }>;
}

export interface GameAnalysis {
    moves: MoveAnalysis[];
    summary: GameSummary;
}
