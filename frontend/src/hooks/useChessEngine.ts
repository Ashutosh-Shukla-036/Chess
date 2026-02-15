import { useState, useEffect, useCallback } from 'react';
import { GameAnalysis } from '../types';
import { toast } from 'react-hot-toast';

interface UseChessEngineReturn {
    analyzeGame: (pgn: string) => Promise<GameAnalysis | null>;
    analysis: GameAnalysis | null;
    loading: boolean;
    error: Error | null;
    resetAnalysis: () => void;
    progress: number; // 0-100 (real progress from WebSocket)
    elapsedTime: number; // seconds
    currentMove: number; // Current move being analyzed
    totalMoves: number; // Total moves to analyze
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const useChessEngine = (): UseChessEngineReturn => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
    const [progress, setProgress] = useState(0);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [currentMove, setCurrentMove] = useState(0);
    const [totalMoves, setTotalMoves] = useState(0);

    // Timer for elapsed time
    useEffect(() => {
        if (!loading) {
            setElapsedTime(0);
            return;
        }

        const startTime = Date.now();
        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            setElapsedTime(elapsed);
        }, 1000);

        return () => clearInterval(interval);
    }, [loading]);

    const analyzeGame = useCallback(async (pgn: string): Promise<GameAnalysis | null> => {
        setLoading(true);
        setError(null);
        setProgress(0);
        setElapsedTime(0);
        setCurrentMove(0);
        setTotalMoves(0);

        const notificationId = toast.loading('Checking cache...');

        try {
            // Step 1: Check cache via HTTP POST
            const response = await fetch(`${API_URL}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pgn })
            });

            // Cache HIT - Return immediately (200)
            if (response.status === 200) {
                const result = await response.json() as GameAnalysis;
                setAnalysis(result);
                setProgress(100);
                setCurrentMove(result.moves?.length || 0);
                setTotalMoves(result.moves?.length || 0);
                setLoading(false);
                toast.success('✓ Cached result (instant)', { id: notificationId });
                return result;
            }

            // Cache MISS - Use WebSocket (202)
            if (response.status === 202) {
                toast.loading('Analyzing game...', { id: notificationId });
                return await analyzeViaWebSocket(pgn, notificationId);
            }

            // Unexpected status
            throw new Error(`Unexpected response: ${response.status}`);

        } catch (err: any) {
            console.error("Analysis failed:", err);
            const errorMessage = err.message || "Failed to analyze game";
            setError(new Error(errorMessage));
            setLoading(false);
            toast.error(`Analysis failed: ${errorMessage}`, { id: notificationId });
            return null;
        }
    }, []);

    const analyzeViaWebSocket = (pgn: string, notificationId: string): Promise<GameAnalysis> => {
        return new Promise((resolve, reject) => {
            // Convert http:// to ws:// or https:// to wss://
            const wsUrl = API_URL.replace(/^http/, 'ws') + '/ws/analyze';
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                ws.send(JSON.stringify({ pgn }));
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.type === 'progress') {
                    // Real-time progress updates
                    setCurrentMove(data.current);
                    setTotalMoves(data.total);
                    setProgress(data.percentage);

                } else if (data.type === 'complete') {
                    // Analysis complete
                    const result: GameAnalysis = data.data;
                    setAnalysis(result);
                    setProgress(100);
                    setCurrentMove(result.moves?.length || 0);
                    setTotalMoves(result.moves?.length || 0);
                    setLoading(false);
                    ws.close();
                    toast.success('Analysis complete!', { id: notificationId });
                    resolve(result);

                } else if (data.type === 'error') {
                    // Error occurred
                    const errorMessage = data.message || 'Analysis failed';
                    setError(new Error(errorMessage));
                    setLoading(false);
                    ws.close();
                    toast.error(`Error: ${errorMessage}`, { id: notificationId });
                    reject(new Error(errorMessage));
                }
            };

            ws.onerror = () => {
                const errorMessage = 'WebSocket connection failed';
                setError(new Error(errorMessage));
                setLoading(false);
                toast.error(errorMessage, { id: notificationId });
                reject(new Error(errorMessage));
            };

            ws.onclose = (event) => {
                if (!event.wasClean && loading) {
                    const errorMessage = 'Connection closed unexpectedly';
                    setError(new Error(errorMessage));
                    setLoading(false);
                    toast.error(errorMessage, { id: notificationId });
                    reject(new Error(errorMessage));
                }
            };
        });
    };

    const resetAnalysis = () => {
        setAnalysis(null);
        setError(null);
        setProgress(0);
        setElapsedTime(0);
        setCurrentMove(0);
        setTotalMoves(0);
    };

    return {
        analyzeGame,
        analysis,
        loading,
        error,
        resetAnalysis,
        progress,
        elapsedTime,
        currentMove,
        totalMoves
    };
};

