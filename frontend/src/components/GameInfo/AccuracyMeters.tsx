import React from 'react';
import { motion } from 'framer-motion';

interface AccuracyMetersProps {
    whiteAccuracy: number;
    blackAccuracy: number;
}

const SingleMeter = ({ accuracy, label, color = "#10b981", delay = 0 }: { accuracy: number, label: string, color?: string, delay?: number }) => {
    const radius = 30; // Reduced from 50
    const strokeWidth = 5;
    const size = 70; // Reduced from 128
    const center = size / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (accuracy / 100) * circumference;

    return (
        <div className="flex flex-col items-center">
            <div className="relative" style={{ width: size, height: size }}>
                {/* Background circle */}
                <svg className="w-full h-full transform -rotate-90">
                    <circle
                        cx={center}
                        cy={center}
                        r={radius}
                        stroke="#333"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                    />
                    {/* Progress circle */}
                    <motion.circle
                        cx={center}
                        cy={center}
                        r={radius}
                        stroke={color}
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset }}
                        transition={{ duration: 1.5, ease: "easeOut", delay }}
                        strokeLinecap="round"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-sm font-bold text-white">{accuracy.toFixed(0)}%</span>
                </div>
            </div>
            <span className="text-xs text-gray-400 font-medium mt-1">{label}</span>
        </div>
    );
};

export const AccuracyMeters: React.FC<AccuracyMetersProps> = ({ whiteAccuracy, blackAccuracy }) => {
    return (
        <div className="flex justify-around items-center bg-[#1a1f36]/50 rounded-xl p-3">
            <SingleMeter accuracy={whiteAccuracy} label="White" />
            <div className="h-8 w-[1px] bg-white/10 mx-2"></div>
            <SingleMeter accuracy={blackAccuracy} label="Black" delay={0.2} />
        </div>
    );
};
