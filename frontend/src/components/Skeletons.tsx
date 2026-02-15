export const BoardSkeleton = () => (
    <div className="w-full max-w-[600px] mx-auto">
        <div className="aspect-square bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg animate-pulse" />
    </div>
);

export const TimelineSkeleton = () => (
    <div className="space-y-4 w-full">
        <div className="flex gap-2 overflow-hidden">
            {[...Array(10)].map((_, i) => (
                <div
                    key={`metrics-${i}`}
                    className="h-8 w-16 bg-gray-700/50 rounded-full animate-pulse"
                    style={{ animationDelay: `${i * 100}ms` }}
                />
            ))}
        </div>
        <div className="flex gap-2 overflow-hidden opacity-50">
            {[...Array(10)].map((_, i) => (
                <div
                    key={`moves-${i}`}
                    className="h-6 w-12 bg-gray-700/30 rounded-full animate-pulse"
                    style={{ animationDelay: `${i * 100}ms` }}
                />
            ))}
        </div>
    </div>
);

export const GraphSkeleton = () => (
    <div className="w-full h-[200px] bg-[#1a1f36] rounded-xl border border-white/5 p-4 mt-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer"
            style={{ transform: 'skewX(-20deg)' }} />
        <div className="h-full w-full bg-gray-700/10 rounded-lg" />
    </div>
);

export const MetersSkeleton = () => (
    <div className="flex gap-12 justify-center py-6">
        {[0, 1].map(i => (
            <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-32 h-32 rounded-full border-8 border-gray-700/30 animate-pulse flex items-center justify-center"
                    style={{ animationDelay: `${i * 200}ms` }}>
                    <div className="w-16 h-8 bg-gray-700/50 rounded" />
                </div>
                <div className="h-4 w-12 bg-gray-700/50 rounded animate-pulse"
                    style={{ animationDelay: `${i * 200}ms` }} />
            </div>
        ))}
    </div>
);
