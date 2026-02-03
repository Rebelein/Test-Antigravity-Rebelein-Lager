import React, { useState, useEffect } from 'react';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src?: string;
    articleId: string;
    fallbackSrc?: string;
}

const CACHE_PREFIX = 'img_cache_';

export const CachedImage: React.FC<CachedImageProps> = ({ src, articleId, fallbackSrc, className, alt, ...props }) => {
    const [displaySrc, setDisplaySrc] = useState<string>(src || fallbackSrc || '');
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // If no source provided, just fallback
        if (!src) {
            setDisplaySrc(fallbackSrc || '');
            return;
        }

        const cacheKey = `${CACHE_PREFIX}${articleId}`;

        // 1. Check LocalStorage
        try {
            const cachedItem = localStorage.getItem(cacheKey);
            if (cachedItem) {
                const { dataUrl, originalUrl } = JSON.parse(cachedItem);

                // If the URL hasn't changed, use the cached version immediately
                if (originalUrl === src) {
                    setDisplaySrc(dataUrl);
                    setIsLoaded(true);
                    return;
                }
            }
        } catch (e) {
            console.warn('Failed to read image cache', e);
        }

        // 2. If not cached or changed, fetch and cache
        // We use a regular Image object to load it? No, we need the data to store it.
        // We fetch the blob.
        let isMounted = true;

        const fetchAndCache = async () => {
            try {
                // If it's already a data URL (e.g. uploaded preview), no need to fetch, just use it 
                // (but maybe we want to persist it if it's large? usually data URLs passed as src are already available)
                if (src.startsWith('data:')) {
                    setDisplaySrc(src);
                    return;
                }

                const response = await fetch(src);
                const blob = await response.blob();
                const reader = new FileReader();

                reader.onloadend = () => {
                    if (!isMounted) return;
                    const base64data = reader.result as string;

                    setDisplaySrc(base64data);

                    // Try to save to localStorage
                    try {
                        // Simple LRU-like safety: if full, clear all image cache
                        try {
                            localStorage.setItem(cacheKey, JSON.stringify({
                                dataUrl: base64data,
                                originalUrl: src,
                                timestamp: Date.now()
                            }));
                        } catch (err: any) {
                            if (err.name === 'QuotaExceededError' || err.code === 22) {
                                // Clear old image caches
                                console.warn("LocalStorage full, clearing image cache...");
                                Object.keys(localStorage).forEach(key => {
                                    if (key.startsWith(CACHE_PREFIX)) {
                                        localStorage.removeItem(key);
                                    }
                                });
                                // Try again once
                                try {
                                    localStorage.setItem(cacheKey, JSON.stringify({
                                        dataUrl: base64data,
                                        originalUrl: src,
                                        timestamp: Date.now()
                                    }));
                                } catch (e) { }
                            }
                        }
                    } catch (e) {
                        // Ignore storage errors
                    }
                };

                reader.readAsDataURL(blob);

            } catch (err) {
                // Determine fallback on fetch error
                if (isMounted) setDisplaySrc(src || fallbackSrc || '');
            }
        };

        fetchAndCache();

        return () => { isMounted = false; };

    }, [src, articleId, fallbackSrc]);

    return (
        <img
            src={displaySrc}
            alt={alt}
            className={className}
            {...props}
            onError={(e) => {
                // If whatever we tried failed, fallback
                if (fallbackSrc && displaySrc !== fallbackSrc) {
                    setDisplaySrc(fallbackSrc);
                }
            }}
        />
    );
};
