import { useState, useEffect } from 'react';

export const useIsIOS = (): boolean => {
    const [isIOS, setIsIOS] = useState<boolean>(false);

    useEffect(() => {
        const checkIsIOS = () => {
            const userAgent = window.navigator.userAgent.toLowerCase();
            // Check for iPhone, iPad, iPod
            // Note: iPads on iPadOS 13+ often report as Macintosh. We can check for touch support + Mac.
            const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
            const isMacWithTouch = userAgent.includes('mac') && navigator.maxTouchPoints > 0;

            return isIosDevice || isMacWithTouch;
        };

        setIsIOS(checkIsIOS());
    }, []);

    return isIOS;
};
