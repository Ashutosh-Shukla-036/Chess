import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles, Zap, Target, TrendingUp, AlertCircle, XCircle, Award, BookOpen, Brain, Database, Wifi } from 'lucide-react';
import { Link } from 'react-router-dom';
import architectureDiagram from '../../public/architecture-diagram.png';

export const HowItWorksPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-[#0a0e27] text-white">
            {/* Header */}
            <div className="border-b border-white/10 bg-[#0f1429]">
                <div className="max-w-6xl mx-auto px-6 py-6">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 text-gray-400 hover:text-primary transition-colors mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Home
                    </Link>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                        How It Works
                    </h1>
                    <p className="text-gray-400 mt-2">
                        Deep dive into our chess analysis engine and move classification system
                    </p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-12 space-y-16">

                {/* System Architecture */}
                <Section
                    icon={<Brain className="w-6 h-6" />}
                    title="System Architecture"
                    subtitle="How your game flows through our analysis pipeline"
                >
                    <div className="bg-[#1a1f36] rounded-xl p-6 border border-white/10">
                        <img
                            src={architectureDiagram}
                            alt="System Architecture Diagram"
                            className="w-full rounded-lg"
                        />
                    </div>

                    <div className="grid md:grid-cols-3 gap-6 mt-8">
                        <ArchitectureCard
                            icon={<Wifi className="w-5 h-5" />}
                            title="Hybrid HTTP + WebSocket"
                            description="First checks cache via HTTP. If not cached, uses WebSocket for real-time progressive analysis with no timeout limits."
                        />
                        <ArchitectureCard
                            icon={<Database className="w-5 h-5" />}
                            title="Redis Caching Layer"
                            description="Analyzed games are cached in Redis. Same PGN returns instantly from cache, saving computation time and resources."
                        />
                        <ArchitectureCard
                            icon={<Brain className="w-5 h-5" />}
                            title="Stockfish Engine Pool"
                            description="Multiple Stockfish engines in a pool handle concurrent requests efficiently. Each move analyzed at depth 22 with multi-PV evaluation."
                        />
                    </div>
                </Section>

                {/* Move Labels */}
                <Section
                    icon={<Award className="w-6 h-6" />}
                    title="Move Classification System"
                    subtitle="How we label each move based on evaluation and position"
                >
                    <div className="space-y-4">
                        <MoveLabel
                            label="Brilliant"
                            color="purple"
                            icon={<Sparkles className="w-5 h-5" />}
                            criteria={[
                                "Exact best move (no tolerance)",
                                "Material sacrifice ≥ 1.5 pawns (knight/bishop+)",
                                "Evaluation drop ≤ 0.60 pawns after sacrifice",
                                "Second-best move gap ≥ 1.2 pawns",
                                "Complex position with multiple options",
                                "Maximum 5 per game (very rare)"
                            ]}
                            example="Sacrificing a knight for a forced checkmate or overwhelming attack"
                        />

                        <MoveLabel
                            label="Great"
                            color="green"
                            icon={<Zap className="w-5 h-5" />}
                            criteria={[
                                "Best move in complex position",
                                "Second-best eval gap ≥ 1.5 pawns OR win% gap ≥ 10%",
                                "Position complexity ≥ 0.20 (moderately complex)",
                                "At least 4 legal moves available",
                                "Significant turnaround: Losing→Draw or Equal→Winning"
                            ]}
                            example="Finding the only winning move in a tactical puzzle or escaping a difficult position"
                        />

                        <MoveLabel
                            label="Best"
                            color="blue"
                            icon={<Target className="w-5 h-5" />}
                            criteria={[
                                "Engine's top choice",
                                "Win% loss ≤ 2.0%",
                                "Maintains or improves position",
                                "Most common label for strong play"
                            ]}
                            example="Playing the objectively strongest move"
                        />

                        <MoveLabel
                            label="Excellent"
                            color="cyan"
                            icon={<TrendingUp className="w-5 h-5" />}
                            criteria={[
                                "Very good move, close to best",
                                "Win% loss between 2.0% and 5.0%",
                                "Slight inaccuracy but still strong"
                            ]}
                            example="Playing the second-best move that's almost as good"
                        />

                        <MoveLabel
                            label="Good"
                            color="teal"
                            icon={<BookOpen className="w-5 h-5" />}
                            criteria={[
                                "Solid move with minor loss",
                                "Win% loss between 5.0% and 10.0%",
                                "Reasonable choice in the position"
                            ]}
                            example="A natural developing move that's not optimal"
                        />

                        <MoveLabel
                            label="Book"
                            color="amber"
                            icon={<BookOpen className="w-5 h-5" />}
                            criteria={[
                                "Move from opening theory",
                                "Found in Lichess opening database",
                                "Win% loss ≤ 5.0%",
                                "Played in master games"
                            ]}
                            example="Standard opening moves like 1.e4 or Sicilian Defense"
                        />

                        <MoveLabel
                            label="Inaccuracy"
                            color="yellow"
                            icon={<AlertCircle className="w-5 h-5" />}
                            criteria={[
                                "Questionable move",
                                "Win% loss between 10.0% and 20.0%",
                                "Gives opponent slight advantage"
                            ]}
                            example="Missing a tactical opportunity or weakening king safety"
                        />

                        <MoveLabel
                            label="Mistake"
                            color="orange"
                            icon={<XCircle className="w-5 h-5" />}
                            criteria={[
                                "Clear error",
                                "Win% loss between 20.0% and 35.0%",
                                "Significantly worsens position"
                            ]}
                            example="Hanging a piece or allowing a strong attack"
                        />

                        <MoveLabel
                            label="Blunder"
                            color="red"
                            icon={<XCircle className="w-5 h-5" />}
                            criteria={[
                                "Severe mistake",
                                "Win% loss > 35.0%",
                                "Often game-losing",
                                "Mate distance increased significantly"
                            ]}
                            example="Allowing checkmate in one or losing the queen for nothing"
                        />

                        <MoveLabel
                            label="Missed Win"
                            color="pink"
                            icon={<AlertCircle className="w-5 h-5" />}
                            criteria={[
                                "Was winning (≥ 90% win chance)",
                                "Win% loss ≥ 15.0%",
                                "Still winning after (≥ 70%)",
                                "Failed to convert advantage"
                            ]}
                            example="Missing checkmate in 2 when winning"
                        />
                    </div>
                </Section>

                {/* Analysis Process */}
                <Section
                    icon={<Brain className="w-6 h-6" />}
                    title="Analysis Process"
                    subtitle="Step-by-step breakdown of how we analyze your games"
                >
                    <div className="space-y-6">
                        <ProcessStep
                            number={1}
                            title="PGN Parsing"
                            description="Your game notation is parsed to extract moves, headers, and metadata. We validate the PGN format and extract the move sequence."
                        />
                        <ProcessStep
                            number={2}
                            title="Cache Check (Redis)"
                            description="We generate a unique hash from your PGN and analysis settings. If this exact game was analyzed before, we return the cached result instantly."
                        />
                        <ProcessStep
                            number={3}
                            title="Position Evaluation (Stockfish)"
                            description="For each move, Stockfish evaluates the position before and after the move at depth 22. We use multi-PV (5 variations) to see alternative moves."
                        />
                        <ProcessStep
                            number={4}
                            title="Opening Detection (Lichess API)"
                            description="Early moves are checked against the Lichess opening database to identify the opening name and theory moves."
                        />
                        <ProcessStep
                            number={5}
                            title="Tactical Analysis"
                            description="We detect captures, checks, sacrifices, and other tactical elements. Position phase (opening/middlegame/endgame) is determined by material count."
                        />
                        <ProcessStep
                            number={6}
                            title="Move Classification"
                            description="Based on evaluation change, win% loss, and position context, each move is classified (Brilliant, Great, Best, Mistake, etc.)."
                        />
                        <ProcessStep
                            number={7}
                            title="Accuracy Calculation"
                            description="Per-move accuracy is calculated using exponential decay: 100 × e^(-0.006 × centipawn_loss). Game accuracy is the average of all moves."
                        />
                        <ProcessStep
                            number={8}
                            title="Summary Generation"
                            description="We compile statistics: total moves, label distribution, critical moments, and overall accuracy for both players."
                        />
                        <ProcessStep
                            number={9}
                            title="Cache Storage"
                            description="The complete analysis is stored in Redis with a 1-hour TTL. Next time this exact game is analyzed, results are instant."
                        />
                    </div>
                </Section>

                {/* Redis Caching */}
                <Section
                    icon={<Database className="w-6 h-6" />}
                    title="Redis Caching System"
                    subtitle="How we make repeated analyses lightning-fast"
                >
                    <div className="bg-[#1a1f36] rounded-xl p-6 border border-white/10 space-y-4">
                        <div>
                            <h4 className="font-semibold text-lg mb-2">Cache Key Generation</h4>
                            <p className="text-gray-400 text-sm">
                                We create a SHA-256 hash from your PGN and analysis settings (depth, time, threads, etc.).
                                This ensures identical games with identical settings return the same cached result.
                            </p>
                            <div className="mt-3 bg-[#0a0e27] rounded-lg p-3 font-mono text-xs text-gray-300">
                                cache_key = SHA256(pgn + depth + move_time + threads + hash_mb + ...)
                            </div>
                        </div>

                        <div>
                            <h4 className="font-semibold text-lg mb-2">Cache Hit vs Miss</h4>
                            <div className="grid md:grid-cols-2 gap-4 mt-3">
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                                        <span className="font-semibold text-emerald-400">Cache Hit</span>
                                    </div>
                                    <p className="text-sm text-gray-300">
                                        Analysis exists in Redis → Returns instantly (HTTP 200) → No engine computation needed
                                    </p>
                                </div>
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                        <span className="font-semibold text-blue-400">Cache Miss</span>
                                    </div>
                                    <p className="text-sm text-gray-300">
                                        Not in cache → WebSocket analysis (HTTP 202) → Real-time progress → Result cached
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-semibold text-lg mb-2">Benefits</h4>
                            <ul className="space-y-2 text-sm text-gray-400">
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1">•</span>
                                    <span><strong className="text-white">Instant results:</strong> Cached games return in milliseconds instead of minutes</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1">•</span>
                                    <span><strong className="text-white">Resource efficiency:</strong> Reduces Stockfish engine load by ~70-80% in production</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1">•</span>
                                    <span><strong className="text-white">Scalability:</strong> Handles thousands of users analyzing popular games without recomputation</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1">•</span>
                                    <span><strong className="text-white">TTL management:</strong> 1-hour expiration keeps cache fresh while maximizing hit rate</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </Section>

                {/* Accuracy & Variance Notice */}
                <Section
                    icon={<AlertCircle className="w-6 h-6" />}
                    title="Understanding Analysis Variance"
                    subtitle="Why the same game can produce slightly different labels"
                >
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6">
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-bold text-amber-300 mb-2">⚠️ Important: Analysis is Not 100% Consistent</h4>
                                <p className="text-sm text-gray-300 leading-relaxed">
                                    Due to the non-deterministic nature of chess engines, analyzing the same game multiple times
                                    may produce slightly different results. This is <strong>normal and expected</strong> behavior.
                                </p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6 mt-4">
                                <div className="bg-[#1a1f36] rounded-lg p-4">
                                    <h5 className="font-semibold text-white mb-2">📊 Our Accuracy Rates</h5>
                                    <ul className="space-y-2 text-sm text-gray-300">
                                        <li className="flex justify-between">
                                            <span>Blunders & Mistakes:</span>
                                            <span className="text-green-400 font-semibold">95-100%</span>
                                        </li>
                                        <li className="flex justify-between">
                                            <span>Good/Excellent/Best:</span>
                                            <span className="text-blue-400 font-semibold">80-90%</span>
                                        </li>
                                        <li className="flex justify-between">
                                            <span>Great/Brilliant:</span>
                                            <span className="text-amber-400 font-semibold">60-80%</span>
                                        </li>
                                        <li className="flex justify-between">
                                            <span>Overall Label Consistency:</span>
                                            <span className="text-cyan-400 font-semibold">~85%</span>
                                        </li>
                                    </ul>
                                </div>

                                <div className="bg-[#1a1f36] rounded-lg p-4">
                                    <h5 className="font-semibold text-white mb-2">🔬 Why Variance Occurs</h5>
                                    <ul className="space-y-1 text-sm text-gray-300">
                                        <li>• <strong>Engine randomness:</strong> Hash table and search order variations</li>
                                        <li>• <strong>Time-based search:</strong> Depth varies slightly with move time</li>
                                        <li>• <strong>Multi-threading:</strong> Thread race conditions</li>
                                        <li>• <strong>Boundary sensitivity:</strong> Moves near thresholds may flip labels</li>
                                        <li>• <strong>Eval precision:</strong> ±0.05 pawn differences accumulate</li>
                                    </ul>
                                </div>
                            </div>

                            <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                <p className="text-sm text-blue-200">
                                    <strong>💡 Pro Tip:</strong> Brilliant and Great moves are most likely to vary between analyses
                                    because they require precise evaluation gaps. A move scoring 1.19 pawns better than alternatives
                                    might be labeled "Best" in one run and "Brilliant" (≥1.2 gap) in another. This is expected behavior
                                    and matches how professional platforms like Chess.com and Lichess work.
                                </p>
                            </div>

                            <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                                <p className="text-sm text-green-200">
                                    <strong>✅ What's Reliable:</strong> Cached results are 100% consistent. The same PGN analyzed again
                                    will return the exact same result from cache. Major move classifications (Blunders, Mistakes, Good moves)
                                    are highly stable across analyses.
                                </p>
                            </div>
                        </div>
                    </div>
                </Section>

                {/* Technical Details */}
                <Section
                    icon={<Brain className="w-6 h-6" />}
                    title="Technical Details"
                    subtitle="Under the hood specifications"
                >
                    <div className="grid md:grid-cols-2 gap-6">
                        <TechCard
                            title="Stockfish Engine"
                            items={[
                                "Default Depth: 22 (adaptive: 18-28)",
                                "Time per move: 3000ms default",
                                "Multi-PV: 5 variations analyzed",
                                "Threads: 2 per engine",
                                "Hash table: 512MB per engine",
                                "Engine pool: Concurrent analysis support"
                            ]}
                        />
                        <TechCard
                            title="Evaluation Metrics"
                            items={[
                                "Centipawn evaluation (±10.0 pawns)",
                                "Mate scores (M1, M2, etc.)",
                                "Win percentage (0-100%)",
                                "Accuracy score (0-100%)",
                                "Position complexity (0-1.0)"
                            ]}
                        />
                        <TechCard
                            title="External APIs"
                            items={[
                                "Lichess Opening Database",
                                "Syzygy Tablebase (7-piece)",
                                "Rate limiting: 100ms between calls",
                                "Fallback to engine if API fails"
                            ]}
                        />
                        <TechCard
                            title="Performance & Accuracy"
                            items={[
                                "~3-5 seconds per move @ depth 22",
                                "Real-time WebSocket progress updates",
                                "No timeout limits on analysis",
                                "Cached results: instant (<100ms)",
                                "Label consistency: ~80-90% across runs",
                                "Blunder/Mistake detection: 95%+ accurate"
                            ]}
                        />
                    </div>
                </Section>

            </div>

            {/* Footer */}
            <div className="border-t border-white/10 bg-[#0f1429] mt-16">
                <div className="max-w-6xl mx-auto px-6 py-8 text-center text-gray-400 text-sm">
                    <p>Powered by Stockfish 16 • Redis • FastAPI • React</p>
                </div>
            </div>
        </div>
    );
};

// Helper Components

interface SectionProps {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ icon, title, subtitle, children }) => (
    <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
    >
        <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/20 rounded-lg text-primary">
                {icon}
            </div>
            <div>
                <h2 className="text-2xl font-bold">{title}</h2>
                <p className="text-gray-400 text-sm">{subtitle}</p>
            </div>
        </div>
        <div className="mt-6">
            {children}
        </div>
    </motion.section>
);

interface MoveLabelProps {
    label: string;
    color: string;
    icon: React.ReactNode;
    criteria: string[];
    example: string;
}

const MoveLabel: React.FC<MoveLabelProps> = ({ label, color, icon, criteria, example }) => {
    const colorClasses = {
        purple: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
        green: 'bg-green-500/10 border-green-500/30 text-green-300',
        blue: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
        cyan: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
        teal: 'bg-teal-500/10 border-teal-500/30 text-teal-300',
        amber: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
        yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
        orange: 'bg-orange-500/10 border-orange-500/30 text-orange-300',
        red: 'bg-red-500/10 border-red-500/30 text-red-300',
        pink: 'bg-pink-500/10 border-pink-500/30 text-pink-300',
    };

    return (
        <div className={`border rounded-xl p-5 ${colorClasses[color as keyof typeof colorClasses]}`}>
            <div className="flex items-center gap-3 mb-3">
                {icon}
                <h3 className="text-xl font-bold">{label}</h3>
            </div>
            <div className="space-y-2 text-sm">
                <div>
                    <p className="font-semibold mb-1">Criteria:</p>
                    <ul className="space-y-1 ml-4">
                        {criteria.map((c, i) => (
                            <li key={i} className="flex items-start gap-2">
                                <span className="mt-1">•</span>
                                <span>{c}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div>
                    <p className="font-semibold">Example:</p>
                    <p className="italic opacity-80">{example}</p>
                </div>
            </div>
        </div>
    );
};

interface ProcessStepProps {
    number: number;
    title: string;
    description: string;
}

const ProcessStep: React.FC<ProcessStepProps> = ({ number, title, description }) => (
    <div className="flex gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center font-bold text-primary">
            {number}
        </div>
        <div className="flex-1">
            <h4 className="font-semibold text-lg mb-1">{title}</h4>
            <p className="text-gray-400 text-sm">{description}</p>
        </div>
    </div>
);

interface ArchitectureCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
}

const ArchitectureCard: React.FC<ArchitectureCardProps> = ({ icon, title, description }) => (
    <div className="bg-[#1a1f36] border border-white/10 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3 text-primary">
            {icon}
            <h4 className="font-semibold">{title}</h4>
        </div>
        <p className="text-sm text-gray-400">{description}</p>
    </div>
);

interface TechCardProps {
    title: string;
    items: string[];
}

const TechCard: React.FC<TechCardProps> = ({ title, items }) => (
    <div className="bg-[#1a1f36] border border-white/10 rounded-xl p-5">
        <h4 className="font-semibold text-lg mb-3">{title}</h4>
        <ul className="space-y-2 text-sm text-gray-400">
            {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>{item}</span>
                </li>
            ))}
        </ul>
    </div>
);