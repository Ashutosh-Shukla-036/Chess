import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { motion } from 'framer-motion';

interface EvaluationData {
    moveNumber: number;
    eval: number; // -10 to +10, clamped
    color: string; // for potential individual point coloring
}

interface EvaluationGraphProps {
    data: EvaluationData[];
    currentMoveIndex: number;
    onPointClick: (index: number) => void;
    className?: string;
}

export const EvaluationGraph: React.FC<EvaluationGraphProps> = ({ data, currentMoveIndex, onPointClick, className }) => {
    const currentData = data[currentMoveIndex];

    return (
        <motion.div
            className={`w-full rounded-xl border border-white/5 p-2 ${className || 'h-[200px]'}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
        >
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} onClick={(e) => {
                    if (e && e.activeTooltipIndex !== undefined) {
                        onPointClick(e.activeTooltipIndex);
                    }
                }}>
                    <defs>
                        <linearGradient id="colorEval" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <XAxis dataKey="moveNumber" hide />
                    <YAxis domain={[-5, 5]} hide />
                    <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" strokeWidth={1.5} />
                    {/* Current move indicator */}
                    {currentMoveIndex >= 0 && currentData && (
                        <ReferenceLine
                            x={currentData.moveNumber}
                            stroke="#10b981"
                            strokeWidth={2}
                            strokeDasharray="0"
                        />
                    )}
                    <Tooltip
                        contentStyle={{ backgroundColor: '#0a0e27', borderColor: '#333' }}
                        itemStyle={{ color: '#fff' }}
                        labelStyle={{ color: '#888' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="eval"
                        stroke="#10b981"
                        fillOpacity={1}
                        fill="url(#colorEval)"
                        animationDuration={1500}
                        dot={(props: any) => {
                            const { cx, cy, payload } = props;
                            if (payload.moveNumber === currentData?.moveNumber) {
                                return (
                                    <circle
                                        cx={cx}
                                        cy={cy}
                                        r={4}
                                        fill="#10b981"
                                        stroke="#0a0e27"
                                        strokeWidth={2}
                                    />
                                );
                            }
                            return null;
                        }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </motion.div>
    );
};