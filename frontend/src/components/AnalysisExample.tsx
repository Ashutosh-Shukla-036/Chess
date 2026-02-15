import React, { useState } from 'react';
import { useChessAnalysis } from '../hooks/useChessAnalysis';

/**
 * Example component demonstrating WebSocket-based chess analysis
 * 
 * Features:
 * - Real-time progress bar
 * - Move-by-move updates
 * - Instant results for cached analyses
 */
export const AnalysisExample: React.FC = () => {
    const [pgnText, setPgnText] = useState('');
    const {
        analyze,
        progress,
        currentMove,
        totalMoves,
        moves,
        summary,
        isAnalyzing,
        error,
        resetAnalysis
    } = useChessAnalysis();

    const handleAnalyze = async () => {
        try {
            await analyze({
                pgn: pgnText,
                depth: 16,
                move_time_ms: 1500,
                threads: 1,
                hash_mb: 128,
                use_lichess: true,
                use_tablebase: true
            });
        } catch (err) {
            console.error('Analysis failed:', err);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-4">Chess Analysis</h1>

            {/* PGN Input */}
            <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                    Enter PGN:
                </label>
                <textarea
                    value={pgnText}
                    onChange={(e) => setPgnText(e.target.value)}
                    className="w-full h-32 p-3 border rounded-lg font-mono text-sm"
                    placeholder="[Event &quot;Game&quot;]&#10;&#10;1. e4 e5 2. Nf3 Nc6..."
                    disabled={isAnalyzing}
                />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mb-6">
                <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !pgnText}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {isAnalyzing ? 'Analyzing...' : 'Analyze Game'}
                </button>

                <button
                    onClick={resetAnalysis}
                    disabled={isAnalyzing}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                    Reset
                </button>
            </div>

            {/* Progress Bar */}
            {isAnalyzing && (
                <div className="mb-6">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Analyzing move {currentMove} of {totalMoves}...</span>
                        <span>{progress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                            className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800 font-medium">Error:</p>
                    <p className="text-red-600">{error}</p>
                </div>
            )}

            {/* Summary Stats */}
            {summary && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h2 className="text-lg font-semibold mb-3">Game Summary</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-gray-600">Opening</p>
                            <p className="font-medium">{summary.opening || 'Unknown'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Total Moves</p>
                            <p className="font-medium">{summary.total_moves}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">White Accuracy</p>
                            <p className="font-medium">{summary.accuracy.white.toFixed(1)}%</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Black Accuracy</p>
                            <p className="font-medium">{summary.accuracy.black.toFixed(1)}%</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Move List */}
            {moves.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold mb-3">
                        Move Analysis ({moves.length} moves)
                    </h2>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {moves.map((move, idx) => (
                            <div
                                key={idx}
                                className={`p-3 border rounded-lg ${move.label === 'Brilliant' ? 'bg-purple-50 border-purple-200' :
                                        move.label === 'Great' ? 'bg-green-50 border-green-200' :
                                            move.label === 'Best' ? 'bg-blue-50 border-blue-200' :
                                                move.label === 'Blunder' ? 'bg-red-50 border-red-200' :
                                                    move.label === 'Mistake' ? 'bg-orange-50 border-orange-200' :
                                                        'bg-gray-50 border-gray-200'
                                    }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="font-mono font-semibold">
                                            {move.move_number}{move.side === 'white' ? '.' : '...'} {move.san}
                                        </span>
                                        <span className={`ml-3 px-2 py-1 rounded text-xs font-medium ${move.label === 'Brilliant' ? 'bg-purple-200 text-purple-800' :
                                                move.label === 'Great' ? 'bg-green-200 text-green-800' :
                                                    move.label === 'Best' ? 'bg-blue-200 text-blue-800' :
                                                        move.label === 'Blunder' ? 'bg-red-200 text-red-800' :
                                                            move.label === 'Mistake' ? 'bg-orange-200 text-orange-800' :
                                                                'bg-gray-200 text-gray-800'
                                            }`}>
                                            {move.label}
                                        </span>
                                    </div>
                                    <div className="text-right text-sm">
                                        {move.eval_after !== undefined && (
                                            <div className="font-mono">
                                                {move.eval_after > 0 ? '+' : ''}{move.eval_after.toFixed(2)}
                                            </div>
                                        )}
                                        {move.accuracy !== undefined && (
                                            <div className="text-gray-600">
                                                {move.accuracy.toFixed(1)}% acc
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {move.best_move_san && move.best_move_san !== move.san && (
                                    <div className="mt-2 text-sm text-gray-600">
                                        Best: <span className="font-mono">{move.best_move_san}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
