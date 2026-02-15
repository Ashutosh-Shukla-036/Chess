import React, { useRef, useEffect } from 'react';
import { MoveQuality } from '../../types';
import clsx from 'clsx';
import { Star } from 'lucide-react';
import { playSound } from '../../utils/sounds';
import { celebrateBrilliant } from '../../utils/confetti';

interface MoveData {
    moveNumber: number;
    side: 'white' | 'black';
    san: string;
    label: MoveQuality;
    isCritical: boolean;
}

interface MoveTimelineProps {
    moves: MoveData[];
    currentMoveIndex: number;
    onMoveClick: (index: number) => void;
}

const qualityColors: Record<MoveQuality, string> = {
    'Brilliant': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
    'Great': 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    'Best': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    'Excellent': 'bg-emerald-400/20 text-emerald-300 border-emerald-400/40',
    'Good': 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    'Book': 'bg-amber-700/20 text-amber-500 border-amber-700/40',
    'Forced': 'bg-gray-500/20 text-gray-400 border-gray-500/40',
    'Inaccuracy': 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40',
    'Mistake': 'bg-orange-500/20 text-orange-400 border-orange-500/40',
    'Blunder': 'bg-red-600/20 text-red-400 border-red-600/40',
    'Missed Win': 'bg-pink-500/20 text-pink-400 border-pink-500/40',
};

const qualityDot: Record<string, string> = {
    'Brilliant': 'bg-yellow-400',
    'Great': 'bg-blue-400',
    'Best': 'bg-emerald-400',
    'Excellent': 'bg-emerald-300',
    'Good': 'bg-teal-300',
    'Book': 'bg-amber-500',
    'Forced': 'bg-gray-400',
    'Inaccuracy': 'bg-yellow-300',
    'Mistake': 'bg-orange-400',
    'Blunder': 'bg-red-400',
    'Missed Win': 'bg-pink-400',
};

export const MoveTimeline: React.FC<MoveTimelineProps> = ({ moves, currentMoveIndex, onMoveClick }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const activeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeRef.current) {
            activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [currentMoveIndex]);

    const handleMoveClick = (move: MoveData, index: number) => {
        onMoveClick(index);
        if (move.label === 'Brilliant') {
            playSound('brilliant');
            celebrateBrilliant(`${move.moveNumber}-${move.side}`);
        } else if (move.label === 'Blunder') {
            playSound('blunder');
        } else {
            playSound('move');
        }
    };

    // Group moves into pairs (white + black per row)
    const rows: { white?: MoveData & { index: number }, black?: MoveData & { index: number }, moveNumber: number }[] = [];
    moves.forEach((move, index) => {
        const rowIndex = Math.floor(index / 2);
        if (!rows[rowIndex]) rows[rowIndex] = { moveNumber: move.moveNumber };
        if (move.side === 'white') rows[rowIndex].white = { ...move, index };
        else rows[rowIndex].black = { ...move, index };
    });

    // Detect phase changes
    const getPhaseLabel = (moveNum: number) => {
        if (moveNum <= 10) return { phase: 'opening', icon: '📖', label: 'Opening' };
        if (moveNum <= 30) return { phase: 'middlegame', icon: '⚔️', label: 'Middlegame' };
        return { phase: 'endgame', icon: '👑', label: 'Endgame' };
    };

    return (
        <div
            ref={scrollRef}
            className="h-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 space-y-0.5 pr-1"
        >
            {rows.map((row, rowIdx) => {
                const prevPhase = rowIdx > 0 ? getPhaseLabel(rows[rowIdx - 1].moveNumber).phase : null;
                const currentPhase = getPhaseLabel(row.moveNumber);
                const showPhaseSeparator = prevPhase !== currentPhase.phase;

                return (
                    <React.Fragment key={rowIdx}>
                        {/* Phase separator */}
                        {showPhaseSeparator && (
                            <div className="flex items-center gap-2 py-1.5 px-1 mt-2">
                                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                <span className="text-[9px] text-gray-500 uppercase tracking-wider font-bold flex items-center gap-1">
                                    <span>{currentPhase.icon}</span>
                                    {currentPhase.label}
                                </span>
                                <div className="h-[1px] flex-1 bg-gradient-to-r from-white/20 via-transparent to-transparent" />
                            </div>
                        )}

                        <div className="flex items-center gap-1.5 rounded-lg hover:bg-white/5 transition-colors px-1 py-0.5">
                            {/* Move number */}
                            <span className="text-[10px] text-gray-600 font-mono w-6 shrink-0 text-right">{row.moveNumber}.</span>

                            {/* White move */}
                            {row.white ? (
                                <div
                                    ref={row.white.index === currentMoveIndex ? activeRef : null}
                                    onClick={() => handleMoveClick(row.white!, row.white!.index)}
                                    className={clsx(
                                        "flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer border transition-all duration-150",
                                        qualityColors[row.white.label] || 'bg-white/5 text-gray-300 border-white/10',
                                        row.white.index === currentMoveIndex
                                            ? "ring-1 ring-white/50 scale-[1.02] brightness-125"
                                            : "hover:brightness-110"
                                    )}
                                >
                                    <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", qualityDot[row.white.label] || 'bg-gray-500')} />
                                    <span className="text-sm font-semibold font-mono">{row.white.san}</span>
                                    {row.white.isCritical && <Star className="w-2.5 h-2.5 ml-auto text-yellow-400 fill-yellow-400 shrink-0" />}
                                </div>
                            ) : <div className="flex-1" />}

                            {/* Black move */}
                            {row.black ? (
                                <div
                                    ref={row.black.index === currentMoveIndex ? activeRef : null}
                                    onClick={() => handleMoveClick(row.black!, row.black!.index)}
                                    className={clsx(
                                        "flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer border transition-all duration-150",
                                        qualityColors[row.black.label] || 'bg-white/5 text-gray-300 border-white/10',
                                        row.black.index === currentMoveIndex
                                            ? "ring-1 ring-white/50 scale-[1.02] brightness-125"
                                            : "hover:brightness-110"
                                    )}
                                >
                                    <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", qualityDot[row.black.label] || 'bg-gray-500')} />
                                    <span className="text-sm font-semibold font-mono">{row.black.san}</span>
                                    {row.black.isCritical && <Star className="w-2.5 h-2.5 ml-auto text-yellow-400 fill-yellow-400 shrink-0" />}
                                </div>
                            ) : <div className="flex-1" />}
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );
};