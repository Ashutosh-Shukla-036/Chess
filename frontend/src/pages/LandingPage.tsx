import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { PGNUpload } from '../components/Upload/PGNUpload';
import { ChevronDown, Github, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LandingPageProps {
    onUpload: (pgn: string) => Promise<void>;
    isLoading: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onUpload, isLoading }) => {
    const { scrollYProgress } = useScroll();
    const y = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);
    const uploadRef = useRef<HTMLDivElement>(null);

    const heroScroll = () => {
        uploadRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-[#0a0e27] text-white selection:bg-primary/30 selection:text-primary">
            {/* Navbar */}
            <nav className="fixed w-full z-50 px-6 py-4 flex justify-between items-center backdrop-blur-md bg-[#0a0e27]/70 border-b border-white/5">
                <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
                    <span className="text-2xl">♟️</span>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">ChessMind</span>
                </div>
                <div className="flex gap-6 text-sm font-medium text-gray-300">
                    <a href="#features" className="hover:text-white transition-colors">Features</a>
                    <Link to="/how-it-works" className="hover:text-white transition-colors">How it Works</Link>
                    <a href="https://github.com/Ashutosh-Shukla-036/Chess" target="_blank" className="hover:text-white transition-colors"><Github className="w-5 h-5" /></a>
                </div>
            </nav>

            {/* Hero */}
            <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 py-24 overflow-hidden">
                <motion.div style={{ y }} className="absolute inset-0 pointer-events-none opacity-20">
                    <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500 rounded-full blur-[128px]" />
                    <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-emerald-500 rounded-full blur-[128px]" />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="relative z-10 max-w-4xl mx-auto space-y-6 mb-16"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-blue-300">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        New: Evaluation Algorithm v1.0
                    </div>

                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-tight mt-6">
                        Analyze Games Like a <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 animate-gradient-x">
                            Grandmaster
                        </span>
                    </h1>

                    <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed pt-4">
                        Professional-grade move classification with honest accuracy metrics. No inflated ratings, just transparent analysis.
                    </p>

                    <div className="flex justify-center pt-6">
                        <button
                            onClick={heroScroll}
                            className="px-8 py-4 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform shadow-xl shadow-white/10"
                        >
                            Analyze Your Game
                        </button>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1, duration: 1 }}
                    className="absolute bottom-16 left-1/2 -translate-x-1/2 animate-bounce"
                >
                    <ChevronDown className="w-8 h-8 text-gray-500" />
                </motion.div>
            </section>

            {/* Upload Section */}
            <section id="upload" ref={uploadRef} className="py-24 bg-[#0a0e27] relative">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold mb-4">Start Analysis</h2>
                        <p className="text-gray-400">Paste your PGN or upload a file to get instant insights.</p>
                    </div>

                    <div className="bg-[#1a1f36]/50 p-8 rounded-3xl border border-white/10 backdrop-blur-sm shadow-2xl">
                        <PGNUpload onUpload={onUpload} isLoading={isLoading} />
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section id="how-it-works" className="py-24 bg-gradient-to-b from-[#0a0e27] to-[#050714]">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-5xl font-bold mb-4">How It Works</h2>
                        <p className="text-xl text-gray-400">Professional chess analysis in three simple steps</p>
                    </div>

                    {/* Process Steps */}
                    <div className="grid md:grid-cols-3 gap-8 mb-12">
                        {[
                            {
                                step: "1",
                                title: "Upload Your Game",
                                desc: "Paste PGN text or upload a .pgn file. Works with any chess game (yours or professional games).",
                                icon: "📤"
                            },
                            {
                                step: "2",
                                title: "Deep Analysis",
                                desc: "Our proprietary engine evaluates each position, compares moves vs. optimal play, and identifies critical moments.",
                                icon: "🔍"
                            },
                            {
                                step: "3",
                                title: "Beautiful Results",
                                desc: "Interactive board, visual timeline, accuracy scores, and detailed explanations for key moments.",
                                icon: "✨"
                            }
                        ].map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.15 }}
                                className="relative p-8 rounded-2xl bg-white/5 border border-white/10"
                            >
                                <div className="text-6xl mb-4">{item.icon}</div>
                                <div className="absolute top-4 right-4 text-6xl font-bold text-white/5">{item.step}</div>
                                <h3 className="text-2xl font-bold mb-3">{item.title}</h3>
                                <p className="text-gray-400 leading-relaxed">{item.desc}</p>
                            </motion.div>
                        ))}
                    </div>

                    <div className="flex justify-center mb-24">
                        <Link
                            to="/how-it-works"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white font-semibold transition-all hover:scale-105"
                        >
                            <BookOpen className="w-5 h-5" />
                            Read Full Guide
                        </Link>
                    </div>

                    {/* Move Quality */}
                    <div className="mb-24">
                        <h3 className="text-3xl font-bold mb-8 text-center">Understanding Move Quality</h3>
                        <p className="text-gray-400 text-center mb-12">Every move gets classified into one of 11 categories</p>

                        <div className="grid md:grid-cols-2 gap-8">
                            {/* Positive Moves */}
                            <div className="p-8 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                                <h4 className="text-2xl font-bold mb-6 text-emerald-400">✓ Positive Moves</h4>
                                <div className="space-y-4">
                                    {[
                                        { label: "⭐ Brilliant", desc: "Exceptional moves involving creative sacrifices or deep calculation. Rare and special." },
                                        { label: "💎 Great", desc: "Significantly better than alternatives. Shows strong understanding." },
                                        { label: "✓ Best", desc: "The optimal move. Solid, accurate chess." },
                                        { label: "Excellent", desc: "Very good move with minimal downsides." },
                                        { label: "Good", desc: "Solid chess move that keeps your position stable." }
                                    ].map((move, i) => (
                                        <div key={i} className="pb-3 border-b border-emerald-500/10 last:border-0">
                                            <div className="font-bold text-white mb-1">{move.label}</div>
                                            <div className="text-sm text-gray-400">{move.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Mistakes */}
                            <div className="p-8 rounded-2xl bg-red-500/10 border border-red-500/20">
                                <h4 className="text-2xl font-bold mb-6 text-red-400">⚠️ Mistakes</h4>
                                <div className="space-y-4">
                                    {[
                                        { label: "⚠️ Inaccuracy", desc: "A small slip that gives your opponent a slight edge." },
                                        { label: "❌ Mistake", desc: "A clear error that worsens your position noticeably." },
                                        { label: "💥 Blunder", desc: "A major error that could lose the game." },
                                        { label: "😱 Missed Win", desc: "You had a winning position but let it slip." }
                                    ].map((move, i) => (
                                        <div key={i} className="pb-3 border-b border-red-500/10 last:border-0">
                                            <div className="font-bold text-white mb-1">{move.label}</div>
                                            <div className="text-sm text-gray-400">{move.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Special Categories */}
                        <div className="mt-8 p-6 rounded-xl bg-amber-500/10 border border-amber-500/20">
                            <h4 className="text-xl font-bold mb-4 text-amber-400">📖 Special Categories</h4>
                            <div className="grid md:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="font-bold text-white">Book:</span>
                                    <span className="text-gray-400 ml-2">Established opening theory</span>
                                </div>
                                <div>
                                    <span className="font-bold text-white">Forced:</span>
                                    <span className="text-gray-400 ml-2">The only reasonable move available</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Key Features */}
                    <div className="mb-24">
                        <h3 className="text-3xl font-bold mb-12 text-center">Key Features Explained</h3>
                        <div className="space-y-6">
                            {[
                                {
                                    title: "Accuracy Score (0-100%)",
                                    desc: "Scientific calculation measuring how closely you played to perfect chess. 95-100% = Superhuman, 85-95% = Excellent, 75-85% = Good, 65-75% = Decent, Below 65% = Rough game.",
                                    icon: "📊"
                                },
                                {
                                    title: "Evaluation Graph",
                                    desc: "Visual representation of who's winning at each point. Positive = White better, Negative = Black better, Zero = Equal. See exactly when the game shifted.",
                                    icon: "📈"
                                },
                                {
                                    title: "Critical Moments",
                                    desc: "Automatically detects game-deciding blunders, brilliant tactical shots, and complex positions. Jump directly to the most important moments.",
                                    icon: "⚡"
                                },
                                {
                                    title: "Game Phases",
                                    desc: "Recognizes Opening, Middlegame, and Endgame. Different phases require different skills, and our analysis adapts accordingly.",
                                    icon: "🎯"
                                },
                                {
                                    title: "Opening Recognition",
                                    desc: "Identifies what opening you played, how popular the line is, and when you deviated from theory.",
                                    icon: "📖"
                                }
                            ].map((feature, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.1 }}
                                    className="flex gap-4 p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                                >
                                    <div className="text-4xl flex-shrink-0">{feature.icon}</div>
                                    <div>
                                        <h4 className="text-xl font-bold mb-2">{feature.title}</h4>
                                        <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* What Makes Us Special */}
                    <div>
                        <h3 className="text-3xl font-bold mb-12 text-center">What Makes Our Engine Special</h3>
                        <div className="grid md:grid-cols-2 gap-8">
                            {[
                                {
                                    title: "Rating-Independent Analysis",
                                    desc: "Every move is judged by the same objective standard, whether you're rated 800 or 2800. No bias, just honest feedback.",
                                    icon: "⚖️"
                                },
                                {
                                    title: "Anti-Inflation Technology",
                                    desc: "We don't spam 'Brilliant!' labels. Our strict criteria ensure honest feedback that actually helps you improve.",
                                    icon: "🛡️"
                                },
                                {
                                    title: "Context-Aware Classification",
                                    desc: "The same move can be labeled differently depending on position complexity, game phase, and material balance.",
                                    icon: "🧠"
                                },
                                {
                                    title: "Honest About Accuracy",
                                    desc: "~85% label consistency across analyses. We're transparent about engine variance—Brilliant/Great moves may vary slightly between runs.",
                                    icon: "📊"
                                }
                            ].map((item, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.1 }}
                                    className="p-8 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20"
                                >
                                    <div className="text-5xl mb-4">{item.icon}</div>
                                    <h4 className="text-2xl font-bold mb-3">{item.title}</h4>
                                    <p className="text-gray-400 leading-relaxed">{item.desc}</p>
                                </motion.div>
                            ))}
                        </div>

                        {/* Accuracy Notice */}
                        <div className="mt-12 p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                            <div className="flex items-start gap-4">
                                <div className="text-3xl">⚠️</div>
                                <div>
                                    <h4 className="text-xl font-bold text-amber-300 mb-2">Understanding Analysis Variance</h4>
                                    <p className="text-gray-300 leading-relaxed mb-3">
                                        Chess engines are non-deterministic. The same game analyzed twice may produce slightly
                                        different labels (especially for Brilliant/Great moves). This is normal and happens on all
                                        chess platforms including Chess.com and Lichess.
                                    </p>
                                    <div className="grid md:grid-cols-3 gap-4 text-sm">
                                        <div className="bg-[#1a1f36] rounded-lg p-3">
                                            <div className="text-green-400 font-bold mb-1">95%+ Accurate</div>
                                            <div className="text-gray-400">Blunders & Mistakes</div>
                                        </div>
                                        <div className="bg-[#1a1f36] rounded-lg p-3">
                                            <div className="text-blue-400 font-bold mb-1">80-90% Consistent</div>
                                            <div className="text-gray-400">Good/Excellent/Best</div>
                                        </div>
                                        <div className="bg-[#1a1f36] rounded-lg p-3">
                                            <div className="text-amber-400 font-bold mb-1">60-80% Consistent</div>
                                            <div className="text-gray-400">Great/Brilliant</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-24 bg-[#050714]">
                <div className="max-w-7xl mx-auto px-6">
                    <h2 className="text-4xl font-bold text-center mb-16">Why ChessMind?</h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                title: "11-Tier Classification",
                                desc: "From 'Brilliant' to 'Blunder', understand the quality of every move with context-aware labels.",
                                icon: "🎯"
                            },
                            {
                                title: "Anti-Inflation Tech",
                                desc: "We don't flatter you. Our engine uses strict criteria so you know when you actually played well.",
                                icon: "🛡️"
                            },
                            {
                                title: "Visual Timeline",
                                desc: "See the flow of the game at a glance with our beautiful, color-coded move timeline.",
                                icon: "📊"
                            }
                        ].map((feature, i) => (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                key={i}
                                className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                            >
                                <div className="text-4xl mb-4">{feature.icon}</div>
                                <h3 className="text-2xl font-bold mb-2">{feature.title}</h3>
                                <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-white/5 bg-[#0a0e27]">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-gray-500 text-sm">
                        © 2026 ChessMind Analysis.
                    </div>
                    <div className="flex gap-6 text-gray-400">
                        <a href="https://github.com/Ashutosh-Shukla-036/Chess" className="hover:text-white"><Github className="w-5 h-5" /></a>
                    </div>
                </div>
            </footer>
        </div>
    );
};