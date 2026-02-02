import React, { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';

interface UnifiedScannerProps {
    onScan: (result: string) => void;
    onError?: (error: string) => void;
    className?: string;
}

const UnifiedScanner: React.FC<UnifiedScannerProps> = ({ onScan, onError, className }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const scannerRef = useRef<QrScanner | null>(null);
    const [errorState, setErrorState] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const startScanner = async () => {
            if (!videoRef.current) return;

            try {
                // Instantiate QrScanner
                // It automatically prefers Native Barcode Detector if available
                const scanner = new QrScanner(
                    videoRef.current,
                    (result) => {
                        if (isMounted) onScan(result.data);
                    },
                    {
                        onDecodeError: (error) => {
                            // Ignore decode errors (scanning emptiness)
                        },
                        preferredCamera: 'environment',
                        highlightScanRegion: true,
                        highlightCodeOutline: true,
                        maxScansPerSecond: 10, // Limit FPS 
                    }
                );

                scannerRef.current = scanner;

                await scanner.start();
                if (isMounted) setIsScanning(true);

            } catch (err: any) {
                console.error("Scanner failed to start", err);
                const msg = err.message || "Kamera konnte nicht gestartet werden.";
                if (isMounted) setErrorState(msg);
                if (onError) onError(msg);
            }
        };

        // Small delay to ensure DOM is ready (iOS habit, good practice)
        const timer = setTimeout(startScanner, 100);

        return () => {
            isMounted = false;
            clearTimeout(timer);
            if (scannerRef.current) {
                scannerRef.current.stop();
                scannerRef.current.destroy();
                scannerRef.current = null;
            }
        };
    }, []); // Run once on mount

    return (
        <div className={`relative w-full h-full bg-black overflow-hidden ${className}`}>
            <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline // Crucial for iOS
                muted // Crucial for auto-play
            />

            {/* Overlay if Error */}
            {errorState && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 p-4 text-center">
                    <div className="text-red-400">
                        <p className="font-bold mb-2">Kamera Fehler</p>
                        <p className="text-sm">{errorState}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UnifiedScanner;
