import { Article } from '../../../../types';
import { LabelConfig, GroupedLocation } from '../types';

export const drawLabelToCanvas = async (item: Article | GroupedLocation, config: LabelConfig): Promise<string> => {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const scale = 4;
        const ppmm = 3.78 * scale;

        const width = config.width * ppmm;
        const height = config.height * ppmm;

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) { reject("Canvas context failed"); return; }

        // Background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);

        const margin = 3 * ppmm;

        // Determine Mode
        const isLocation = !('sku' in item);

        // Prepare Data
        let qrData = '';

        if (isLocation) {
            const loc = item as GroupedLocation;
            // NEW: Encode both Category and Location for uniqueness
            qrData = `LOC:${loc.category}::${loc.locationName}`;
        } else {
            const art = item as Article;
            qrData = art.id; // UUID for scanning
        }

        // --- IMAGES (QR & Barcode) ---
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;

        // Barcode only for Single Articles
        let barcodeUrl = null;
        if (!isLocation) {
            const art = item as Article;
            const barcodeVal = art.supplierSku || art.sku || art.ean || '0000';
            barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(barcodeVal)}&scale=4&height=20&includetext`;
        }

        const loadImg = (src: string): Promise<HTMLImageElement> => {
            return new Promise((res, rej) => {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.onload = () => res(img);
                img.onerror = rej;
                img.src = src;
            });
        };

        const promises = [loadImg(qrUrl)];

        if (isLocation) {
            const loc = item as GroupedLocation;
            loc.articles.slice(0, 4).forEach(a => {
                const bcVal = a.supplierSku || a.sku || a.ean || '0000';
                const bcUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(bcVal)}&scale=2&height=5&includetext=false`;
                promises.push(loadImg(bcUrl));
            });
        } else if (barcodeUrl) {
            promises.push(loadImg(barcodeUrl));
        }

        Promise.all(promises)
            .then((images) => {
                const [qrImg, barImg] = images;

                // Layout Constants
                const qrSize = 19 * ppmm;
                const rightColX = width - qrSize - margin;
                const textWidth = rightColX - margin - (1 * ppmm);

                // Draw QR Code (Top Right)
                ctx.drawImage(qrImg, rightColX, margin, qrSize, qrSize);

                if (isLocation) {
                    // --- MULTI ITEM / LOCATION LAYOUT ---
                    const loc = item as GroupedLocation;
                    const locationText = `${loc.category} / ${loc.locationName}`;

                    // 1. Footer Text (Location / Shelf) - Centered at Bottom
                    const fontSizeFooter = 12 * config.fontSizeScale * scale; // Large font
                    ctx.font = `bold ${fontSizeFooter}px Inter, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillStyle = 'black';
                    // Position: Bottom center
                    ctx.fillText(locationText, width / 2, height - (margin / 2));

                    // 2. Article List (Top Left) - Start at top
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';

                    let cursorY = margin;
                    const fontSizeList = 8 * config.fontSizeScale * scale;
                    const fontSizeSub = 6 * config.fontSizeScale * scale;

                    // Show up to 4 items because of barcode space
                    const maxItems = 4;
                    const itemsToShow = loc.articles.slice(0, maxItems);

                    itemsToShow.forEach((a, index) => {
                        // Line 1: Article Name
                        ctx.font = `bold ${fontSizeList}px Inter, sans-serif`;
                        ctx.fillStyle = 'black';
                        const name = a.name.length > 25 ? a.name.substring(0, 23) + '..' : a.name;
                        ctx.fillText(`• ${name}`, margin, cursorY, textWidth); // Constrained width near QR
                        cursorY += fontSizeList + (1 * scale);

                        // Line 2: Barcode Image
                        if (images[index + 1]) {
                            const bcImg = images[index + 1];
                            const bcW = bcImg.width * 0.5; // Scale down
                            const bcH = bcImg.height * 0.5;
                            // Limit width
                            const maxBcW = textWidth * 0.8;
                            const finalW = Math.min(bcW, maxBcW);
                            const finalH = bcH * (finalW / bcW) * 0.7; // Reduce height scale slightly

                            ctx.drawImage(bcImg, margin + (2 * scale), cursorY, finalW, finalH);
                            cursorY += finalH;
                        } else {
                            // Fallback info if no barcode
                            ctx.font = `${fontSizeSub}px Inter, sans-serif`;
                            ctx.fillStyle = '#555';
                            const supInfo = `${a.supplier || ''}: ${a.supplierSku || ''}`;
                            ctx.fillText(`   ${supInfo}`, margin, cursorY, textWidth);
                            cursorY += fontSizeSub;
                        }

                        cursorY += (2 * scale); // Spacer
                    });

                } else {
                    // --- SINGLE ARTICLE LAYOUT ---
                    const art = item as Article;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';

                    // Title
                    const fontSizeTitle = 12 * config.fontSizeScale * scale;
                    ctx.font = `bold ${fontSizeTitle}px Inter, sans-serif`;
                    ctx.fillStyle = 'black';
                    ctx.fillText(art.name, margin, margin, textWidth);

                    let cursorY = margin + fontSizeTitle + (4 * scale);

                    // SKU
                    const fontSizeSku = 9 * config.fontSizeScale * scale;
                    ctx.font = `${fontSizeSku}px Inter, sans-serif`;
                    ctx.fillStyle = '#555';
                    ctx.fillText(`Hersteller-Nr.: ${art.sku}`, margin, cursorY);
                    cursorY += fontSizeSku + (8 * scale);

                    // Details
                    const fontSizeInfo = 9 * config.fontSizeScale * scale;
                    ctx.fillStyle = '#333';
                    ctx.fillText(art.location || '-', margin, cursorY);
                    cursorY += fontSizeInfo + (2 * scale);
                    ctx.fillText(art.category || '', margin, cursorY);
                    cursorY += fontSizeInfo + (6 * scale);

                    ctx.font = `bold ${fontSizeInfo}px Inter, sans-serif`;
                    ctx.fillText(art.supplier || '', margin, cursorY);

                    // Barcode (Bottom)
                    if (barImg) {
                        const barHeight = 8 * ppmm;
                        const barWidth = width - (margin * 2);
                        const barY = height - barHeight - margin;
                        ctx.drawImage(barImg, margin, barY, barWidth, barHeight);
                    }
                }

                resolve(canvas.toDataURL('image/png'));
            })
            .catch(err => {
                reject(err);
            });
    });
};
