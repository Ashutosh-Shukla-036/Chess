import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { ChevronLeft, ChevronRight, Play, Pause, Save, Share2, Volume2, VolumeX, BookOpen, Swords, BarChart2, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GameAnalysis } from '../types';
import { ChessboardComponent } from '../components/Board/ChessboardComponent';
import { MoveTimeline } from '../components/Analysis/MoveTimeline';
import { EvaluationGraph } from '../components/Analysis/EvaluationGraph';
import { AccuracyMeters } from '../components/GameInfo/AccuracyMeters';
import { MoveInspector } from '../components/Analysis/MoveInspector';
import { toast } from 'react-hot-toast';
import { resetCelebrations } from '../utils/confetti';
import { getMuteState, toggleMute, playSound } from '../utils/sounds';
import clsx from 'clsx';

interface AnalysisPageProps {
    analysis: GameAnalysis;
    onBack: () => void;
}

type RightTab = 'move' | 'game' | 'info';

const labelColors: Record<string, string> = {
    'Brilliant': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'Great': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'Best': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'Excellent': 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30',
    'Good': 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    'Book': 'bg-amber-700/20 text-amber-500 border-amber-700/30',
    'Forced': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    'Inaccuracy': 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30',
    'Mistake': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    'Blunder': 'bg-red-500/20 text-red-400 border-red-500/30',
    'Missed Win': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
};

const StatCard = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
    <div className="bg-white/5 rounded-lg p-2.5 border border-white/5">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="text-lg font-mono font-bold text-white mt-0.5 leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
);

const LabelBadge = ({ label }: { label: string }) => (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border', labelColors[label] || 'bg-white/10 text-gray-400 border-white/10')}>
        <span className="w-1 h-1 rounded-full bg-current" />
        {label}
    </span>
);

export const AnalysisPage: React.FC<AnalysisPageProps> = ({ analysis, onBack }) => {
    const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [game, setGame] = useState(new Chess());
    const [isMuted, setIsMuted] = useState(getMuteState());
    const [isInspectorOpen, setIsInspectorOpen] = useState(false);
    const [rightTab, setRightTab] = useState<RightTab>('move');
    const navigate = useNavigate();

    useEffect(() => { resetCelebrations(); playSound('complete'); }, []);

    useEffect(() => {
        const newGame = new Chess();
        for (let i = 0; i <= currentMoveIndex; i++) {
            if (analysis.moves[i]) newGame.move(analysis.moves[i].san);
        }
        setGame(newGame);
    }, [currentMoveIndex, analysis]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') setCurrentMoveIndex(prev => Math.min(prev + 1, analysis.moves.length - 1));
            else if (e.key === 'ArrowLeft') setCurrentMoveIndex(prev => Math.max(prev - 1, -1));
            else if (e.key === ' ') { e.preventDefault(); setIsPlaying(prev => !prev); }
            else if (e.key === 'Escape') setIsInspectorOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [analysis.moves.length]);

    useEffect(() => {
        let interval: any;
        if (isPlaying) {
            interval = setInterval(() => {
                setCurrentMoveIndex(prev => {
                    if (prev >= analysis.moves.length - 1) { setIsPlaying(false); return prev; }
                    return prev + 1;
                });
            }, 800);
        }
        return () => clearInterval(interval);
    }, [isPlaying, analysis.moves.length]);

    const handleMoveClick = (index: number) => {
        setCurrentMoveIndex(index);
        setRightTab('move');
    };

    const currentMove = currentMoveIndex >= 0 ? analysis.moves[currentMoveIndex] : null;
    const gi = analysis.summary.game_info;

    const graphData = analysis.moves.map((m, i) => ({
        moveNumber: i + 1,
        eval: Math.max(-5, Math.min(5, m.eval_after ?? (m.mate_after != null ? (m.mate_after > 0 ? 5 : -5) : 0))),
        color: '#10b981'
    }));

    const arrows: Array<[string, string, string]> = [];
    if (currentMove?.best_move) {
        arrows.push([currentMove.best_move.substring(0, 2), currentMove.best_move.substring(2, 4), 'rgba(16,185,129,0.7)']);
    }

    const evalDisplay = currentMove
        ? currentMove.mate_after != null
            ? `M${Math.abs(currentMove.mate_after)}`
            : currentMove.eval_after != null
                ? `${currentMove.eval_after > 0 ? '+' : ''}${currentMove.eval_after.toFixed(2)}`
                : '—'
        : null;

    const evalColor = currentMove
        ? currentMove.mate_after != null
            ? currentMove.mate_after < 0 ? 'text-red-400' : 'text-emerald-400'
            : (currentMove.eval_after ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
        : 'text-gray-400';

    // Label count bar helpers
    const allLabels = ['Brilliant', 'Great', 'Best', 'Excellent', 'Good', 'Book', 'Forced', 'Inaccuracy', 'Mistake', 'Blunder', 'Missed Win'];
    const labelDotColor: Record<string, string> = {
        'Brilliant': 'bg-yellow-400', 'Great': 'bg-blue-400', 'Best': 'bg-emerald-400',
        'Excellent': 'bg-emerald-300', 'Good': 'bg-teal-300', 'Book': 'bg-amber-500',
        'Forced': 'bg-gray-400', 'Inaccuracy': 'bg-yellow-300', 'Mistake': 'bg-orange-400',
        'Blunder': 'bg-red-400', 'Missed Win': 'bg-pink-400',
    };

    return (
        <div className="h-screen bg-[#080c1e] text-white flex flex-col overflow-hidden">
            {/* Header */}
            <header className="h-12 shrink-0 border-b border-white/10 flex items-center justify-between px-4 bg-[#080c1e]/95 backdrop-blur z-20">
                <div className="flex items-center gap-3 min-w-0">
                    <button onClick={onBack} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors shrink-0">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="min-w-0">
                        <h1 className="font-bold text-sm truncate leading-tight">{analysis.summary.opening || 'Chess Game Analysis'}</h1>
                        <p className="text-[10px] text-gray-500">
                            {gi?.white ?? 'White'} vs {gi?.black ?? 'Black'}
                            {gi?.date ? ` · ${gi.date}` : ''}
                            {gi?.result ? ` · ${gi.result}` : ''}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => { const s = toggleMute(); setIsMuted(s); toast.success(s ? 'Muted' : 'Unmuted'); }}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-all">
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <button className="p-1.5 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-all" onClick={() => toast.success('Saved!')}>
                        <Save className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-all" onClick={() => toast.success('Link copied!')}>
                        <Share2 className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-all" onClick={() => navigate('/how-it-works')}>
                        <BookOpen className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* 3-column layout */}
            <main className="flex-1 flex overflow-hidden min-h-0">

                {/* ── LEFT: Move List ── */}
                <div className="w-[200px] shrink-0 border-r border-white/10 bg-[#0a0e27] flex flex-col overflow-hidden">
                    <div className="px-3 py-2 border-b border-white/10 shrink-0">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Moves</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">{analysis.summary.total_moves} half-moves</p>
                    </div>
                    <div className="flex-1 overflow-hidden min-h-0 p-2">
                        <MoveTimeline
                            moves={analysis.moves.map(m => ({
                                moveNumber: m.move_number,
                                side: m.side,
                                san: m.san,
                                label: m.label,
                                isCritical: m.is_critical
                            }))}
                            currentMoveIndex={currentMoveIndex}
                            onMoveClick={handleMoveClick}
                        />
                    </div>
                </div>

                {/* ── CENTER: Board + Controls ── */}
                <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-[#0c1128] to-[#080c1e]">
                    <div className="flex-1 flex items-center justify-center p-4 min-h-0">
                        <div style={{ width: 'min(calc(100vh - 180px), 100%)', aspectRatio: '1' }} className="max-w-full">
                            <ChessboardComponent
                                fen={game.fen()}
                                arrows={arrows}
                                highlightSquares={currentMove ? {
                                    [currentMove.uci.substring(0, 2)]: { backgroundColor: 'rgba(255,255,0,0.22)' },
                                    [currentMove.uci.substring(2, 4)]: { backgroundColor: 'rgba(255,255,0,0.22)' },
                                } : {}}
                            />
                        </div>
                    </div>
                    <div className="shrink-0 h-14 flex items-center justify-center gap-2 border-t border-white/10 bg-[#080c1e]/80 backdrop-blur px-4">
                        <button onClick={() => setCurrentMoveIndex(-1)} title="Start"
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-gray-400 hover:text-white flex items-center">
                            <ChevronLeft className="w-3.5 h-3.5" /><ChevronLeft className="w-3.5 h-3.5 -ml-2" />
                        </button>
                        <button onClick={() => setCurrentMoveIndex(prev => Math.max(prev - 1, -1))}
                            className="p-2 hover:bg-white/10 rounded-lg transition-all text-gray-400 hover:text-white">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button onClick={() => setIsPlaying(!isPlaying)}
                            className="p-2.5 bg-emerald-500 hover:bg-emerald-400 rounded-xl text-white shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95">
                            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                        </button>
                        <button onClick={() => setCurrentMoveIndex(prev => Math.min(prev + 1, analysis.moves.length - 1))}
                            className="p-2 hover:bg-white/10 rounded-lg transition-all text-gray-400 hover:text-white">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                        <button onClick={() => setCurrentMoveIndex(analysis.moves.length - 1)} title="End"
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-gray-400 hover:text-white flex items-center">
                            <ChevronRight className="w-3.5 h-3.5" /><ChevronRight className="w-3.5 h-3.5 -ml-2" />
                        </button>
                        <span className="ml-3 text-xs text-gray-600 font-mono tabular-nums">
                            {currentMoveIndex + 1} / {analysis.moves.length}
                        </span>
                    </div>
                </div>

                {/* ── RIGHT: Tabbed Panel ── */}
                <div className="w-[320px] shrink-0 border-l border-white/10 bg-[#0a0e27] flex flex-col overflow-hidden">

                    {/* Accuracy + Graph - always visible */}
                    <div className="shrink-0 p-3 border-b border-white/10">
                        <AccuracyMeters
                            whiteAccuracy={analysis.summary.accuracy.white}
                            blackAccuracy={analysis.summary.accuracy.black}
                        />
                    </div>
                    <div className="shrink-0 px-3 py-2 border-b border-white/10">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Evaluation</p>
                        <EvaluationGraph
                            data={graphData}
                            currentMoveIndex={currentMoveIndex}
                            onPointClick={(idx) => setCurrentMoveIndex(idx)}
                            className="h-[75px]"
                        />
                    </div>

                    {/* Tab switcher */}
                    <div className="shrink-0 flex border-b border-white/10">
                        {([
                            { id: 'move', icon: <Swords className="w-3.5 h-3.5" />, label: 'Move' },
                            { id: 'game', icon: <BarChart2 className="w-3.5 h-3.5" />, label: 'Stats' },
                            { id: 'info', icon: <Info className="w-3.5 h-3.5" />, label: 'Game Info' },
                        ] as { id: RightTab; icon: React.ReactNode; label: string }[]).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setRightTab(tab.id)}
                                className={clsx(
                                    'flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold transition-all border-b-2',
                                    rightTab === tab.id
                                        ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                                        : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                )}
                            >
                                {tab.icon}{tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    <div className="flex-1 overflow-y-auto min-h-0 p-3">

                        {/* ── MOVE TAB ── */}
                        {rightTab === 'move' && (
                            currentMove ? (
                                <div className="space-y-3">
                                    {/* Move header */}
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className="text-3xl font-bold font-mono text-white">{currentMove.san}</span>
                                            <p className="text-[10px] text-gray-500 mt-0.5">
                                                Move {currentMove.move_number} · {currentMove.side === 'white' ? '⬜ White' : '⬛ Black'} · {currentMove.phase}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-xl font-mono font-bold ${evalColor}`}>{evalDisplay}</p>
                                            {currentMove.mate_before != null && (
                                                <p className="text-[10px] text-gray-500">was M{Math.abs(currentMove.mate_before)}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Label */}
                                    <LabelBadge label={currentMove.label} />

                                    {/* Eval stats */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <StatCard label="Accuracy" value={`${currentMove.accuracy?.toFixed(1) ?? '—'}%`} />
                                        <StatCard label="Win % After" value={`${currentMove.win_percent_after?.toFixed(1) ?? '—'}%`} />
                                        <StatCard label="Eval Before"
                                            value={currentMove.eval_before != null ? `${currentMove.eval_before > 0 ? '+' : ''}${currentMove.eval_before.toFixed(2)}` : '—'} />
                                        <StatCard label="Eval After"
                                            value={currentMove.eval_after != null ? `${currentMove.eval_after > 0 ? '+' : ''}${currentMove.eval_after.toFixed(2)}` : evalDisplay ?? '—'} />
                                        <StatCard label="Delta"
                                            value={currentMove.delta != null ? `${currentMove.delta > 0 ? '+' : ''}${currentMove.delta.toFixed(2)}` : '—'}
                                            sub="eval change" />
                                        <StatCard label="Win % Delta"
                                            value={currentMove.win_percent_delta != null ? `${currentMove.win_percent_delta > 0 ? '+' : ''}${currentMove.win_percent_delta.toFixed(1)}%` : '—'}
                                            sub="from mover's view" />
                                        <StatCard label="Win % Before" value={`${currentMove.win_percent_before?.toFixed(1) ?? '—'}%`} />
                                        <StatCard label="Mate Before"
                                            value={currentMove.mate_before != null ? `M${Math.abs(currentMove.mate_before)}` : '—'} />
                                    </div>

                                    {/* Best move */}
                                    {currentMove.best_move && currentMove.best_move !== currentMove.uci && (
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                                            <p className="text-[10px] text-emerald-500 uppercase tracking-wider font-bold mb-1.5">Engine Best Move</p>
                                            <div className="flex items-center justify-between">
                                                <span className="font-mono font-bold text-emerald-400 text-xl">
                                                    {currentMove.best_move_san || currentMove.best_move}
                                                </span>
                                                <span className="text-[10px] font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded">
                                                    {currentMove.best_move}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Opening */}
                                    {currentMove.opening && (
                                        <div className="bg-white/5 border border-white/5 rounded-lg p-3">
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Opening</p>
                                            <p className="text-xs text-gray-300 leading-snug">{currentMove.opening}</p>
                                        </div>
                                    )}

                                    {/* Tactical info */}
                                    {currentMove.tactical_info && (
                                        <div className="bg-white/5 border border-white/5 rounded-lg p-3 space-y-2">
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Tactical Info</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {currentMove.tactical_info.is_capture && <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/20">Capture</span>}
                                                {currentMove.tactical_info.is_check && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/20">Check</span>}
                                                {currentMove.tactical_info.is_checkmate && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/20">Checkmate</span>}
                                                {currentMove.tactical_info.is_sacrifice && <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/20">Sacrifice</span>}
                                                {currentMove.tactical_info.is_castle && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/20">Castle</span>}
                                                {currentMove.tactical_info.is_promotion && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/20">Promotion</span>}
                                                {currentMove.tactical_info.is_en_passant && <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/20">En Passant</span>}
                                                {currentMove.tactical_info.is_exchange_sacrifice && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/20">Exchange Sac</span>}
                                                {currentMove.tactical_info.is_recapture && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/20">Recapture</span>}
                                            </div>
                                            <div className="grid grid-cols-2 gap-1.5 pt-1">
                                                {currentMove.tactical_info.moved_piece && (
                                                    <div className="text-[10px] text-gray-500">
                                                        Piece: <span className="text-gray-300 capitalize">{currentMove.tactical_info.moved_piece}</span>
                                                    </div>
                                                )}
                                                {currentMove.tactical_info.sacrifice_value > 0 && (
                                                    <div className="text-[10px] text-gray-500">
                                                        Sac value: <span className="text-pink-400">{currentMove.tactical_info.sacrifice_value}</span>
                                                    </div>
                                                )}
                                                {currentMove.tactical_info.captured_piece_value > 0 && (
                                                    <div className="text-[10px] text-gray-500">
                                                        Captured: <span className="text-orange-400">{currentMove.tactical_info.captured_piece_value}</span>
                                                    </div>
                                                )}
                                                {currentMove.tactical_info.moved_piece_value > 0 && (
                                                    <div className="text-[10px] text-gray-500">
                                                        Piece val: <span className="text-gray-300">{currentMove.tactical_info.moved_piece_value}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Flags */}
                                    {(currentMove.is_critical || currentMove.is_sacrifice) && (
                                        <div className="flex gap-2">
                                            {currentMove.is_critical && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">⚡ Critical</span>
                                            )}
                                            {currentMove.is_sacrifice && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">♟ Sacrifice</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
                                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
                                        <ChevronRight className="w-5 h-5 text-gray-600" />
                                    </div>
                                    <p className="text-sm text-gray-500">Select a move to see analysis</p>
                                    <p className="text-[10px] text-gray-600 mt-1">Use arrow keys or click any move</p>
                                </div>
                            )
                        )}

                        {/* ── STATS TAB ── */}
                        {rightTab === 'game' && (
                            <div className="space-y-4">
                                {/* Accuracy summary */}
                                <div>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Accuracy</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <StatCard label="White" value={`${analysis.summary.accuracy.white.toFixed(1)}%`} />
                                        <StatCard label="Black" value={`${analysis.summary.accuracy.black.toFixed(1)}%`} />
                                    </div>
                                </div>

                                {/* White label breakdown */}
                                <div>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">⬜ White Moves</p>
                                    <div className="space-y-1">
                                        {allLabels.filter(l => (analysis.summary.white[l] ?? 0) > 0).map(label => (
                                            <div key={label} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-white/5 transition-colors">
                                                <div className="flex items-center gap-2">
                                                    <span className={clsx('w-2 h-2 rounded-full', labelDotColor[label] || 'bg-gray-400')} />
                                                    <span className="text-xs text-gray-300">{label}</span>
                                                </div>
                                                <span className="text-xs font-mono font-bold text-white">{analysis.summary.white[label]}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Black label breakdown */}
                                <div>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">⬛ Black Moves</p>
                                    <div className="space-y-1">
                                        {allLabels.filter(l => (analysis.summary.black[l] ?? 0) > 0).map(label => (
                                            <div key={label} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-white/5 transition-colors">
                                                <div className="flex items-center gap-2">
                                                    <span className={clsx('w-2 h-2 rounded-full', labelDotColor[label] || 'bg-gray-400')} />
                                                    <span className="text-xs text-gray-300">{label}</span>
                                                </div>
                                                <span className="text-xs font-mono font-bold text-white">{analysis.summary.black[label]}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Critical moments */}
                                {analysis.summary.critical_moments?.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">⚡ Critical Moments</p>
                                        <div className="space-y-1.5">
                                            {analysis.summary.critical_moments.map((m, i) => (
                                                <div
                                                    key={i}
                                                    onClick={() => {
                                                        const idx = analysis.moves.findIndex(mv => mv.move_number === m.move_number && mv.side === m.side);
                                                        if (idx !== -1) { setCurrentMoveIndex(idx); setRightTab('move'); }
                                                    }}
                                                    className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors border border-white/5"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-mono text-gray-500 w-8">{m.move_number}{m.side === 'white' ? '.' : '…'}</span>
                                                        <span className="text-xs font-mono font-bold text-white">{m.san}</span>
                                                        <LabelBadge label={m.label} />
                                                    </div>
                                                    {m.delta != null && (
                                                        <span className={`text-[10px] font-mono ${m.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                            {m.delta > 0 ? '+' : ''}{m.delta.toFixed(2)}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── INFO TAB ── */}
                        {rightTab === 'info' && (
                            <div className="space-y-4">
                                {gi ? (
                                    <>
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Players</p>
                                            <div className="space-y-2">
                                                <div className="bg-white/5 border border-white/5 rounded-lg p-3 flex items-center justify-between">
                                                    <div>
                                                        <p className="text-[10px] text-gray-500">⬜ White</p>
                                                        <p className="text-sm font-bold text-white">{gi.white ?? '—'}</p>
                                                    </div>
                                                    {gi.white_elo && <span className="text-xs font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded">{gi.white_elo}</span>}
                                                </div>
                                                <div className="bg-white/5 border border-white/5 rounded-lg p-3 flex items-center justify-between">
                                                    <div>
                                                        <p className="text-[10px] text-gray-500">⬛ Black</p>
                                                        <p className="text-sm font-bold text-white">{gi.black ?? '—'}</p>
                                                    </div>
                                                    {gi.black_elo && <span className="text-xs font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded">{gi.black_elo}</span>}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Game Details</p>
                                            <div className="space-y-1">
                                                {[
                                                    { label: 'Result', value: gi.result },
                                                    { label: 'Event', value: gi.event },
                                                    { label: 'Site', value: gi.site },
                                                    { label: 'Date', value: gi.date },
                                                    { label: 'ECO', value: gi.eco },
                                                    { label: 'Time Control', value: gi.time_control },
                                                    { label: 'Termination', value: gi.termination },
                                                ].filter(r => r.value).map(row => (
                                                    <div key={row.label} className="flex items-start justify-between py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors">
                                                        <span className="text-[10px] text-gray-500 uppercase tracking-wider shrink-0 w-20">{row.label}</span>
                                                        <span className="text-xs text-gray-300 text-right">{row.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Analysis</p>
                                            <div className="space-y-1">
                                                {[
                                                    { label: 'Opening', value: analysis.summary.opening },
                                                    { label: 'Total Moves', value: `${analysis.summary.total_moves} half-moves` },
                                                    { label: 'Engine', value: 'Stockfish 18' },
                                                ].filter(r => r.value).map(row => (
                                                    <div key={row.label} className="flex items-start justify-between py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors">
                                                        <span className="text-[10px] text-gray-500 uppercase tracking-wider shrink-0 w-20">{row.label}</span>
                                                        <span className="text-xs text-gray-300 text-right">{row.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-xs text-gray-500 text-center py-8">No game info available</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <MoveInspector isOpen={isInspectorOpen} onClose={() => setIsInspectorOpen(false)} move={currentMove} />
        </div>
    );
};