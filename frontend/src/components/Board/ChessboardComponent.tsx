import React, { useRef, useEffect, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { motion } from 'framer-motion';

interface ChessboardComponentProps {
    fen: string;
    arrows?: Array<[string, string, string]>;
    highlightSquares?: Record<string, { backgroundColor: string }>;
    onPieceDrop?: (sourceSquare: string, targetSquare: string) => boolean;
    boardOrientation?: 'white' | 'black';
}

export const ChessboardComponent: React.FC<ChessboardComponentProps> = ({
    fen,
    arrows = [],
    highlightSquares = {},
    onPieceDrop,
    boardOrientation = 'white'
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [boardWidth, setBoardWidth] = useState(480);

    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                setBoardWidth(containerRef.current.offsetWidth);
            }
        };
        updateSize();
        const observer = new ResizeObserver(updateSize);
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <motion.div
            ref={containerRef}
            className="relative w-full aspect-square"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
        >
            <Chessboard
                position={fen}
                onPieceDrop={onPieceDrop}
                boardOrientation={boardOrientation}
                customDarkSquareStyle={{ backgroundColor: '#2d4a6e' }}
                customLightSquareStyle={{ backgroundColor: '#b8d4e8' }}
                customSquareStyles={highlightSquares}
                customArrows={arrows as any}
                animationDuration={250}
                boardWidth={boardWidth}
            />
        </motion.div>
    );
};