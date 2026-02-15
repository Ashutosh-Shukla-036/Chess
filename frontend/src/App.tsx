import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { HowItWorksPage } from './pages/HowItWorksPage'; // This is new
import { useChessEngine } from './hooks/useChessEngine';
import { BoardSkeleton, TimelineSkeleton, GraphSkeleton, MetersSkeleton } from './components/Skeletons';
import { getRandomTip, formatElapsedTime, getEstimatedTimeRemaining } from './utils/loadingTips';

function App() {
    const { analyzeGame, analysis, loading: isLoading, error, resetAnalysis, progress, elapsedTime, currentMove, totalMoves } = useChessEngine();
    const [currentTip, setCurrentTip] = useState(getRandomTip());
    const navigate = useNavigate();
    const location = useLocation();

    // Rotate tips every 10 seconds
    useEffect(() => {
        if (!isLoading) return;

        const interval = setInterval(() => {
            setCurrentTip(getRandomTip());
        }, 10000);

        return () => clearInterval(interval);
    }, [isLoading]);

    const handleUpload = async (pgn: string) => {
        const result = await analyzeGame(pgn);
        if (result) {
            navigate('/analysis');
        }
    };

    const handleBack = () => {
        resetAnalysis();
        navigate('/');
    };

    return (
        <>
            <div className="bg-[#0a0e27] min-h-screen text-white font-sans selection:bg-primary/30">
                <AnimatePresence mode="wait">
                    {isLoading ? (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="min-h-screen flex flex-col items-center justify-center p-8 space-y-8"
                        >
                            {/* Header */}
                            <div className="text-center space-y-4 mb-8">
                                <h2 className="text-3xl font-bold text-blue-400 animate-pulse">
                                    {totalMoves > 0 ? `Analyzing move ${currentMove} of ${totalMoves}...` : 'Analyzing your game...'}
                                </h2>
                                <p className="text-gray-400">Deep analysis with Stockfish engine</p>
                            </div>

                            {/* Progress Section */}
                            <div className="w-full max-w-2xl space-y-6 mb-8">
                                {/* Progress Bar */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Progress</span>
                                        <span className="text-primary font-bold">{progress}%</span>
                                    </div>
                                    <div className="h-3 bg-[#1a1f36] rounded-full overflow-hidden border border-white/10">
                                        <motion.div
                                            className="h-full bg-gradient-to-r from-primary to-blue-600 rounded-full"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            transition={{ duration: 0.5 }}
                                        />
                                    </div>
                                </div>

                                {/* Time Info */}
                                <div className="flex justify-between items-center p-4 bg-[#1a1f36] rounded-xl border border-white/10">
                                    <div className="text-center flex-1">
                                        <div className="text-2xl font-bold text-white font-mono">
                                            {formatElapsedTime(elapsedTime)}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">Elapsed</div>
                                    </div>
                                    <div className="w-px h-12 bg-white/10"></div>
                                    <div className="text-center flex-1">
                                        <div className="text-lg font-bold text-primary">
                                            {getEstimatedTimeRemaining(elapsedTime, progress)}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">Estimated</div>
                                    </div>
                                </div>

                                {/* Chess Tip */}
                                <motion.div
                                    key={currentTip}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl text-center"
                                >
                                    <p className="text-amber-200 text-sm">{currentTip}</p>
                                </motion.div>
                            </div>

                            {/* Skeleton Previews */}
                            <div className="w-full max-w-4xl space-y-8">
                                <BoardSkeleton />
                                <TimelineSkeleton />
                                <GraphSkeleton />
                                <MetersSkeleton />
                            </div>
                        </motion.div>
                    ) : (
                        <Routes location={location} key={location.pathname}>
                            <Route
                                path="/"
                                element={
                                    <motion.div
                                        key="landing"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <LandingPage onUpload={handleUpload} isLoading={isLoading} />
                                    </motion.div>
                                }
                            />
                            <Route
                                path="/analysis"
                                element={
                                    analysis ? (
                                        <motion.div
                                            key="analysis"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.4 }}
                                        >
                                            <AnalysisPage analysis={analysis} onBack={handleBack} />
                                        </motion.div>
                                    ) : (
                                        <Navigate to="/" replace />
                                    )
                                }
                            />
                            <Route
                                path="/how-it-works"
                                element={
                                    <motion.div
                                        key="how-it-works"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <HowItWorksPage />
                                    </motion.div>
                                }
                            />
                        </Routes>
                    )}
                </AnimatePresence>
            </div>
            <Toaster
                position="bottom-center"
                toastOptions={{
                    style: {
                        background: '#1a1f36',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.1)',
                    },
                }}
            />
        </>
    )
}

export default App
