import { useState, useCallback } from 'react';

/**
 * Request schema for chess analysis
 */
interface AnalyzeRequest {
    pgn: string;
    depth?: number;
    move_time_ms?: number;
    threads?: number;
    hash_mb?: number;
    use_lichess?: boolean;
    use_tablebase?: boolean;
}

/**
 * Move analysis result
 */
interface MoveAnalysis {
    move_number: number;
    side: string;
    san: string;
    uci: string;
    eval_before?: number;
    eval_after?: number;
    delta?: number;
    mate_before?: number;
    mate_after?: number;
    label: string;
    best_move?: string;
    best_move_san?: string;
    opening?: string;
    phase?: string;
    win_percent_before?: number;
    win_percent_after?: number;
    win_percent_delta?: number;
    is_critical?: boolean;
    is_sacrifice?: boolean;
    accuracy?: number;
}

/**
 * Game summary statistics
 */
interface GameSummary {
    total_moves: number;
    opening?: string;
    accuracy: { white: number; black: number };
    white: Record<string, number>;
    black: Record<string, number>;
    combined: Record<string, number>;
    critical_moments: any[];
    game_info?: any;
}

/**
 * Complete analysis response
 */
interface AnalyzeResponse {
    game_id: string;
    moves: MoveAnalysis[];
    summary?: GameSummary;
}

/**
 * Hook return type
 */
interface UseChessAnalysisReturn {
    analyze: (request: AnalyzeRequest) => Promise<AnalyzeResponse | null>;
    progress: number;
    currentMove: number;
    totalMoves: number;
    moves: MoveAnalysis[];
    summary: GameSummary | null;
    isAnalyzing: boolean;
    error: string | null;
    resetAnalysis: () => void;
}

/**
 * Custom hook for chess analysis with WebSocket support
 * 
 * Features:
 * - Checks cache via HTTP first (instant if cached)
 * - Falls back to WebSocket for progressive analysis
 * - Real-time progress updates
 * - No timeout issues
 */
export const useChessAnalysis = (): UseChessAnalysisReturn => {
    const [progress, setProgress] = useState(0);
    const [currentMove, setCurrentMove] = useState(0);
    const [totalMoves, setTotalMoves] = useState(0);
    const [moves, setMoves] = useState<MoveAnalysis[]>([]);
    const [summary, setSummary] = useState<GameSummary | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const resetAnalysis = useCallback(() => {
        setProgress(0);
        setCurrentMove(0);
        setTotalMoves(0);
        setMoves([]);
        setSummary(null);
        setError(null);
    }, []);

    const analyze = useCallback(async (request: AnalyzeRequest): Promise<AnalyzeResponse | null> => {
        setIsAnalyzing(true);
        setError(null);
        setMoves([]);
        setProgress(0);
        setCurrentMove(0);
        setTotalMoves(0);

        try {
            // Step 1: Check cache via HTTP
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/api/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request)
            });

            // Cache hit - return immediately
            if (response.status === 200) {
                const data: AnalyzeResponse = await response.json();
                setMoves(data.moves);
                setSummary(data.summary || null);
                setProgress(100);
                setCurrentMove(data.moves.length);
                setTotalMoves(data.moves.length);
                setIsAnalyzing(false);
                return data;
            }

            // Cache miss (202) - use WebSocket
            if (response.status === 202) {
                return await analyzeViaWebSocket(apiUrl, request);
            }

            // Unexpected status
            throw new Error(`Unexpected response status: ${response.status}`);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
            setError(errorMessage);
            setIsAnalyzing(false);
            throw err;
        }
    }, []);

    const analyzeViaWebSocket = (apiUrl: string, request: AnalyzeRequest): Promise<AnalyzeResponse> => {
        return new Promise((resolve, reject) => {
            // Convert http:// to ws:// or https:// to wss://
            const wsUrl = apiUrl.replace(/^http/, 'ws') + '/api/analyze/ws/analyze';
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                ws.send(JSON.stringify(request));
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.type === 'progress') {
                    // Update progress
                    setCurrentMove(data.current);
                    setTotalMoves(data.total);
                    setProgress(data.percentage);

                    // Add move to list (real-time updates)
                    setMoves(prev => [...prev, data.move]);

                } else if (data.type === 'complete') {
                    // Analysis complete
                    const result: AnalyzeResponse = data.data;
                    setMoves(result.moves);
                    setSummary(result.summary || null);
                    setProgress(100);
                    setCurrentMove(result.moves.length);
                    setTotalMoves(result.moves.length);
                    setIsAnalyzing(false);
                    ws.close();
                    resolve(result);

                } else if (data.type === 'error') {
                    // Error occurred
                    setError(data.message);
                    setIsAnalyzing(false);
                    ws.close();
                    reject(new Error(data.message));
                }
            };

            ws.onerror = (error) => {
                const errorMessage = 'WebSocket connection failed';
                setError(errorMessage);
                setIsAnalyzing(false);
                reject(new Error(errorMessage));
            };

            ws.onclose = (event) => {
                if (!event.wasClean) {
                    const errorMessage = 'WebSocket connection closed unexpectedly';
                    setError(errorMessage);
                    setIsAnalyzing(false);
                    reject(new Error(errorMessage));
                }
            };
        });
    };

    return {
        analyze,
        progress,
        currentMove,
        totalMoves,
        moves,
        summary,
        isAnalyzing,
        error,
        resetAnalysis
    };
};
