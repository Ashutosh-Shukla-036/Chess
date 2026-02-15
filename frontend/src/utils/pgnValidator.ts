/**
 * PGN Validation Utility
 * Provides client-side validation for PGN input before API calls
 */

export interface PGNValidationResult {
    isValid: boolean;
    moveCount: number;
    errors: string[];
    warnings: string[];
    moves: string[];
}

const MAX_PGN_SIZE = 50 * 1024; // 50KB (matches backend)
const MIN_MOVES = 10;

/**
 * Validates PGN structure and extracts basic information
 */
export function validatePGN(pgnText: string): PGNValidationResult {
    const result: PGNValidationResult = {
        isValid: true,
        moveCount: 0,
        errors: [],
        warnings: [],
        moves: []
    };

    // Check if empty
    if (!pgnText || !pgnText.trim()) {
        result.isValid = false;
        result.errors.push('PGN is empty');
        return result;
    }

    // Check size
    const sizeBytes = new Blob([pgnText]).size;
    if (sizeBytes > MAX_PGN_SIZE) {
        result.isValid = false;
        result.errors.push(`PGN too large (${Math.round(sizeBytes / 1024)}KB, max 50KB)`);
        return result;
    }

    // Extract moves
    const moves = extractMoves(pgnText);
    result.moves = moves;
    result.moveCount = moves.length;

    // Check if any moves found
    if (moves.length === 0) {
        result.isValid = false;
        result.errors.push('No valid chess moves found');
        return result;
    }

    // Warning for short games
    if (moves.length < MIN_MOVES) {
        result.warnings.push(`Short game (${moves.length} moves, recommended minimum: ${MIN_MOVES})`);
    }

    // Check for basic PGN structure (optional headers)
    const hasHeaders = /\[Event\s+".+"\]/.test(pgnText) || /\[White\s+".+"\]/.test(pgnText);
    if (!hasHeaders) {
        result.warnings.push('No PGN headers found (optional but recommended)');
    }

    return result;
}

/**
 * Extracts chess moves from PGN text
 * Supports both standard PGN format and plain move text
 */
export function extractMoves(pgnText: string): string[] {
    // Remove PGN headers (lines starting with [)
    let cleanText = pgnText.replace(/\[.*?\]\s*/g, '');

    // Remove comments in braces {}
    cleanText = cleanText.replace(/\{[^}]*\}/g, '');

    // Remove comments in parentheses ()
    cleanText = cleanText.replace(/\([^)]*\)/g, '');

    // Remove result indicators
    cleanText = cleanText.replace(/(1-0|0-1|1\/2-1\/2|\*)\s*$/g, '');

    // Remove move numbers (e.g., "1.", "23...")
    cleanText = cleanText.replace(/\d+\.\s*/g, '');

    // Extract move-like tokens
    // Matches: e4, Nf3, Qxd5, O-O, O-O-O, e8=Q, Nbd7, etc.
    const movePattern = /\b([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|O-O-O|O-O)\b/g;
    const matches = cleanText.match(movePattern);

    return matches || [];
}

/**
 * Quick check if text looks like PGN
 */
export function looksLikePGN(text: string): boolean {
    if (!text || text.trim().length < 5) return false;

    // Check for PGN headers OR chess moves
    const hasHeaders = /\[.*?\]/.test(text);
    const hasMoves = /\b([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8]|O-O-O|O-O)\b/.test(text);

    return hasHeaders || hasMoves;
}

/**
 * Format move count for display
 */
export function formatMoveCount(count: number): string {
    if (count === 0) return 'No moves';
    if (count === 1) return '1 move';
    return `${count} moves`;
}
