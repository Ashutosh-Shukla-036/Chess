import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Star, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { MoveAnalysis } from '../../types';
import clsx from 'clsx';

interface MoveInspectorProps {
    isOpen: boolean;
    onClose: () => void;
    move: MoveAnalysis | null;
}

const qualityIcons: Record<string, React.ReactNode> = {
    'Brilliant': <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />,
    'Great': <CheckCircle className="w-5 h-5 text-blue-400" />,
    'Best': <CheckCircle className="w-5 h-5 text-emerald-400" />,
    'Mistake': <AlertTriangle className="w-5 h-5 text-orange-500" />,
    'Blunder': <X className="w-5 h-5 text-red-500" />,
};

export const MoveInspector: React.FC<MoveInspectorProps> = ({ isOpen, onClose, move }) => {
    return (
        <AnimatePresence>
            {isOpen && move && (
                <motion.div
                    className="fixed inset-y-0 right-0 w-[320px] bg-[#1a1f36] border-l border-white/10 shadow-2xl z-50 overflow-y-auto"
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                    <div className="p-4 space-y-6">
                        {/* Header */}
                        <div className="flex justify-between items-center border-b border-white/10 pb-4">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    Move {move.move_number}
                                    <span className="text-gray-400 text-sm font-normal">
                                        {move.side === 'white' ? 'White' : 'Black'}
                                    </span>
                                </h2>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-400 uppercase tracking-wider mt-1 inline-block">
                                    {move.phase}
                                </span>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Move Classification */}
                        <div className="bg-[#0a0e27] p-6 rounded-xl border border-white/5 text-center relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="text-5xl font-bold block mb-2">{move.san}</span>
                            <div className={clsx(
                                "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold",
                                move.label === 'Brilliant' && "bg-yellow-500/20 text-yellow-500",
                                move.label === 'Mistake' && "bg-orange-500/20 text-orange-500",
                                move.label === 'Blunder' && "bg-red-500/20 text-red-500",
                                move.label === 'Best' && "bg-emerald-500/20 text-emerald-500",
                                (!['Brilliant', 'Mistake', 'Blunder', 'Best'].includes(move.label)) && "bg-gray-500/20 text-gray-400"
                            )}>
                                {qualityIcons[move.label] || <Info className="w-4 h-4" />}
                                {move.label}
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#0a0e27] p-4 rounded-xl border border-white/5">
                                <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Evaluation</div>
                                <div className={clsx(
                                    "text-2xl font-mono font-bold",
                                    move.eval_after >= 0 ? "text-emerald-400" : "text-red-400"
                                )}>
                                    {move.eval_after > 0 ? '+' : ''}{move.eval_after}
                                </div>
                            </div>
                            <div className="bg-[#0a0e27] p-4 rounded-xl border border-white/5">
                                <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Accuracy</div>
                                <div className="text-2xl font-mono font-bold text-white">
                                    {move.accuracy.toFixed(1)}%
                                </div>
                            </div>
                        </div>

                        {/* Best Move Recommendation */}
                        {move.best_move && move.best_move !== move.uci && (
                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <Star className="w-4 h-4 text-emerald-500" />
                                    Better Alternative
                                </h3>
                                <div className="bg-[#0a0e27] p-4 rounded-xl border border-emerald-500/30 flex items-center justify-between group cursor-pointer hover:bg-emerald-500/10 transition-colors">
                                    <div>
                                        <div className="font-mono font-bold text-emerald-400 text-lg">{move.best_move}</div>
                                        <div className="text-xs text-gray-500">Recommended by engine</div>
                                    </div>
                                    <ChevronRight className="text-emerald-500 w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        )}

                        {/* Analysis Info */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Analysis Info</h3>
                            <div className="bg-[#0a0e27] p-4 rounded-xl border border-white/5 space-y-2 text-sm text-gray-300">
                                <div className="flex justify-between">
                                    <span>Depth</span>
                                    <span className="font-mono text-white">22</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Engine</span>
                                    <span className="font-mono text-white">Stockfish 18</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
