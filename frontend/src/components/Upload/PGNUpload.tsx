import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Check, AlertCircle, Loader2, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';
import { validatePGN, formatMoveCount } from '../../utils/pgnValidator';
import { exampleGames, type ExampleGame } from '../../data/exampleGames';

interface PGNUploadProps {
    onUpload: (pgn: string) => Promise<void>;
    isLoading: boolean;
}

export const PGNUpload: React.FC<PGNUploadProps> = ({ onUpload, isLoading }) => {
    const [pgnText, setPgnText] = useState('');
    const [isDragActive, setIsDragActive] = useState(false);
    const [validation, setValidation] = useState<ReturnType<typeof validatePGN> | null>(null);
    const [showExamples, setShowExamples] = useState(false);

    // Debounced validation
    useEffect(() => {
        if (!pgnText.trim()) {
            setValidation(null);
            return;
        }

        const timer = setTimeout(() => {
            const result = validatePGN(pgnText);
            setValidation(result);
        }, 500);

        return () => clearTimeout(timer);
    }, [pgnText]);

    const handleDrop = useCallback((acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (file) {
            if (file.size > 1024 * 1024) { // 1MB limit
                toast.error('File too large (max 1MB)');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                setPgnText(text);
                toast.success(`Loaded ${file.name}`);
            };
            reader.readAsText(file);
        }
    }, []);

    const { getRootProps, getInputProps } = useDropzone({
        onDrop: handleDrop,
        accept: { 'application/x-chess-pgn': ['.pgn'], 'text/plain': ['.txt'] },
        maxFiles: 1,
        onDragEnter: () => setIsDragActive(true),
        onDragLeave: () => setIsDragActive(false),
        onDropAccepted: () => setIsDragActive(false)
    });

    const handleSubmit = async () => {
        if (!pgnText.trim()) {
            toast.error("Please enter PGN text or upload a file");
            return;
        }

        // Validate before submitting
        const result = validatePGN(pgnText);
        if (!result.isValid) {
            toast.error(result.errors[0] || 'Invalid PGN');
            return;
        }

        try {
            await onUpload(pgnText);
        } catch (e) {
            console.error(e);
            // Error handled by parent/hook
        }
    };

    const loadExample = (game: ExampleGame) => {
        setPgnText(game.pgn);
        setShowExamples(false);
        toast.success(`Loaded: ${game.title}`);
    };

    const clearPGN = () => {
        setPgnText('');
        setValidation(null);
    };

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6">
            {/* Try Example Button */}
            <div className="flex justify-end">
                <div className="relative">
                    <button
                        onClick={() => setShowExamples(!showExamples)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-lg text-amber-300 hover:bg-amber-500/30 transition-all duration-200 hover:scale-105"
                    >
                        <Sparkles className="w-4 h-4" />
                        Try Example
                    </button>

                    {/* Example Dropdown */}
                    <AnimatePresence>
                        {showExamples && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute right-0 mt-2 w-80 bg-[#1a1f36] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-10"
                            >
                                {exampleGames.map((game) => (
                                    <button
                                        key={game.id}
                                        onClick={() => loadExample(game)}
                                        className="w-full p-4 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                                    >
                                        <div className="font-bold text-white mb-1">{game.title}</div>
                                        <div className="text-sm text-gray-400 mb-2">{game.description}</div>
                                        <div className="flex flex-wrap gap-1">
                                            {game.highlights.map((tag, i) => (
                                                <span
                                                    key={i}
                                                    className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Drag & Drop Area */}
            <div
                {...getRootProps()}
                className={clsx(
                    "relative group cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden",
                    isDragActive ? "border-primary bg-primary/10" : "border-white/10 hover:border-primary/50 hover:bg-white/5",
                    isLoading && "pointer-events-none opacity-50"
                )}
            >
                <input {...getInputProps()} />
                <div className="h-[200px] flex flex-col items-center justify-center gap-4 text-center p-6">
                    <div className={clsx(
                        "p-4 rounded-full transition-transform duration-300",
                        isDragActive ? "bg-primary/20 scale-110" : "bg-white/5 group-hover:scale-110"
                    )}>
                        <Upload className={clsx("w-8 h-8", isDragActive ? "text-primary" : "text-gray-400")} />
                    </div>
                    <div>
                        <p className="text-lg font-medium text-white group-hover:text-primary transition-colors">
                            Drag & drop PGN file
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                            or click to browse
                        </p>
                    </div>
                </div>
            </div>

            {/* Divider */}
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-[#0a0e27] text-gray-500">OR PASTE TEXT</span>
                </div>
            </div>

            {/* Textarea */}
            <div className="relative">
                <textarea
                    value={pgnText}
                    onChange={(e) => setPgnText(e.target.value)}
                    placeholder="Paste your PGN here...&#10;&#10;[Event &quot;My Game&quot;]&#10;[White &quot;Player1&quot;]&#10;[Black &quot;Player2&quot;]&#10;&#10;1. e4 e5 2. Nf3 Nc6 3. Bb5..."
                    className="w-full h-40 bg-[#1a1f36] border border-white/10 rounded-xl p-4 text-sm font-mono text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                    disabled={isLoading}
                />
                {pgnText && (
                    <button
                        onClick={clearPGN}
                        className="absolute top-2 right-2 p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-all"
                        title="Clear"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Validation Feedback */}
            <AnimatePresence>
                {validation && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2"
                    >
                        {/* Move Preview */}
                        {validation.isValid && (
                            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                                <div className="flex-1">
                                    <span className="text-emerald-300 font-medium">
                                        {formatMoveCount(validation.moveCount)} detected
                                    </span>
                                    {validation.moves.length > 0 && (
                                        <div className="text-xs text-emerald-400/70 mt-1 font-mono">
                                            {validation.moves.slice(0, 10).join(' ')}
                                            {validation.moves.length > 10 && '...'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Errors */}
                        {validation.errors.map((error, i) => (
                            <div key={i} className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                <span className="text-red-300 text-sm">{error}</span>
                            </div>
                        ))}

                        {/* Warnings */}
                        {validation.warnings.map((warning, i) => (
                            <div key={i} className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                <span className="text-amber-300 text-sm">{warning}</span>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Submit Button */}
            <motion.button
                onClick={handleSubmit}
                disabled={isLoading || !pgnText.trim() || (validation && !validation.isValid)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={clsx(
                    "w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all",
                    isLoading || !pgnText.trim() || (validation && !validation.isValid)
                        ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                        : "bg-gradient-to-r from-primary to-blue-600 hover:shadow-primary/25 text-white"
                )}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analyzing Game...
                    </>
                ) : (
                    <>
                        Analyze Game
                        <ChevronRight className="w-5 h-5" />
                    </>
                )}
            </motion.button>
        </div>
    );
};

// Helper for icon
function ChevronRight(props: any) {
    return (
        <svg
            {...props}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m9 18 6-6-6-6" />
        </svg>
    )
}
