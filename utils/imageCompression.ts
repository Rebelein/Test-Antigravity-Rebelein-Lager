
/**
 * Compresses an image file client-side using Canvas.
 * Resizes the image to a maximum dimension (default 1024px) 
 * and converts it to WebP with reduced quality (default 0.7).
 */
export const compressImage = async (
    file: File,
    maxWidthHeight = 1024,
    quality = 0.7
): Promise<File> => {
    // If it's not an image, return original
    if (!file.type.startsWith('image/')) return file;

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Caclulate new dimensions
                if (width > height) {
                    if (width > maxWidthHeight) {
                        height = Math.round((height * maxWidthHeight) / width);
                        width = maxWidthHeight;
                    }
                } else {
                    if (height > maxWidthHeight) {
                        width = Math.round((width * maxWidthHeight) / height);
                        height = maxWidthHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(file); // Fallback to original
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                // Convert to WebP blob
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            // Create new File object
                            const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                                type: 'image/webp',
                                lastModified: Date.now(),
                            });

                            // Check if we actually saved space. If not, return original (rare but possible for already optimized images)
                            if (newFile.size < file.size) {
                                resolve(newFile);
                            } else {
                                resolve(file);
                            }
                        } else {
                            resolve(file);
                        }
                    },
                    'image/webp',
                    quality
                );
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};
