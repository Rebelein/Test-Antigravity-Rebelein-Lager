import { Article } from '../../../../types';
import { LabelConfig, GroupedLocation } from '../types';

export const handlePrintPDFHelper = (
    itemsToPrint: (Article | GroupedLocation)[],
    getConfigForItem: (id: string) => LabelConfig,
    singleMode: boolean = false,
    previewItem?: Article | GroupedLocation
) => {
    if (itemsToPrint.length === 0) return;

    const printWindow = window.open('', 'PRINT_LABELS', 'height=600,width=800');
    if (!printWindow) return;

    // --- TITLE GENERATION ---
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // YYYY-MM-DD_HH-mm-ss
    let docTitle = `Etiketten_Batch_${timestamp}`;

    if (singleMode && previewItem) {
        const isLoc = !('sku' in previewItem);
        const name = isLoc ? (previewItem as GroupedLocation).locationName : (previewItem as Article).name;
        // Sanitize filename
        const safeName = name.replace(/[^a-zA-Z0-9-_]/g, '_');
        docTitle = `Etikett_${safeName}_${timestamp}`;
    }

    const labelsHtml = itemsToPrint.map(item => {
        const isLocation = !('sku' in item);
        const id = isLocation ? (item as GroupedLocation).uniqueKey : (item as Article).id;
        const config = getConfigForItem(id);

        let qrData = '';
        let contentHtml = '';

        if (isLocation) {
            const loc = item as GroupedLocation;
            // NEW: Use composite key for unique QR
            qrData = `LOC:${loc.category}::${loc.locationName}`;

            // List items: Max 4
            const itemsToShow = loc.articles.slice(0, 4);
            const listHtml = itemsToShow.map(a => {
                const bcVal = a.supplierSku || a.sku || a.ean || '0000';
                const bcUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(bcVal)}&scale=2&height=3&includetext=false`;

                return `<div style="margin-bottom: 1.5mm; line-height: 1;">
                  <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: bold; color: #000; font-size: 0.9em;">• ${a.name}</div>
                  <!-- Barcode Image -->
                  <img src="${bcUrl}" crossorigin="anonymous" style="height: 3.5mm; max-width: 90%; margin-top: 0.2mm; display: block;" />
                  <div style="font-size: 0.45em; color: #777; margin-top: 0; padding-left: 1px;">${a.supplierSku || a.sku}</div>
               </div>`;
            }).join('');

            contentHtml = `
            <div style="display: flex; flex-direction: column; height: 100%; justify-content: space-between;">
                <div style="display: flex; justify-content: space-between;">
                     <div style="flex: 1; font-size: ${8 * config.fontSizeScale}pt; overflow: hidden; padding-right: 2mm;">
                        ${listHtml}
                     </div>
                     <div style="width: 19mm; height: 19mm; flex-shrink: 0;">
                         <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}" style="width: 100%; height: 100%; object-fit: contain;" crossorigin="anonymous" />
                     </div>
                </div>
                <div style="text-align: center; font-weight: bold; font-size: ${12 * config.fontSizeScale}pt; border-top: 1px solid #eee; padding-top: 1mm; margin-top: 1mm;">
                    ${loc.category} / ${loc.locationName}
                </div>
            </div>
          `;

            return `
            <div class="label-wrapper" style="width: ${config.width}mm; height: ${config.height}mm;">
                <div class="label-content" style="padding: 3mm; box-sizing: border-box; width: 100%; height: 100%;">
                    ${contentHtml}
                </div>
            </div>
          `;

        } else {
            const art = item as Article;
            qrData = art.id;
            const barcodeValue = art.supplierSku || art.sku || art.ean || '0000';
            const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(barcodeValue)}&scale=2&height=10&includetext`;

            contentHtml = `
            <div class="label-content-single">
                <div class="header">
                    <div class="title" style="font-size: ${9 * config.fontSizeScale}pt;">${art.name}</div>
                    <div class="sku" style="font-size: ${6 * config.fontSizeScale}pt;">Hersteller-Nr.: ${art.sku}</div>
                </div>
                <div class="qr-container">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}" crossorigin="anonymous" />
                </div>
                <div class="info" style="font-size: ${6 * config.fontSizeScale}pt;">
                    <div>${art.location || '-'}</div>
                    <div>${art.category || ''}</div>
                    <div style="margin-top:1mm;"><strong>${art.supplier || ''}</strong></div>
                </div>
                <div class="barcode-container">
                    <img src="${barcodeUrl}" crossorigin="anonymous" />
                </div>
            </div>
          `;

            return `
            <div class="label-wrapper" style="width: ${config.width}mm; height: ${config.height}mm;">
                <div style="width: 100%; height: 100%; padding: 3mm; box-sizing: border-box;">
                    ${contentHtml}
                </div>
            </div>
          `;
        }
    }).join('');

    printWindow.document.write(`
    <html>
    <head>
        <title>${docTitle}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
            @page { 
                size: A4 landscape; 
                margin: 10mm; 
            }
            body { 
                margin: 0; 
                padding: 0; 
                font-family: 'Inter', sans-serif; 
                background: white; 
            }
            
            .print-container {
                display: flex;
                flex-wrap: wrap;
                align-content: flex-start;
                align-content: flex-start;
                gap: 0; /* No gap between labels */
            }

            .label-wrapper {
                border: 1px solid black; /* Black border for cutting */
                box-sizing: border-box;
                background: white;
                position: relative;
                overflow: hidden;
                page-break-inside: avoid;
                break-inside: avoid;
            }

            /* Single Label Grid */
            .label-content-single {
                width: 100%;
                height: 100%;
                display: grid;
                grid-template-columns: 1fr 20mm;
                grid-template-rows: auto 1fr auto;
                gap: 1mm;
            }
            .header { grid-column: 1 / 2; }
            .title { font-weight: 700; line-height: 1.1; overflow: hidden; max-height: 2.4em; }
            .sku { color: #555; margin-top: 1mm; }
            .qr-container { grid-column: 2 / 3; grid-row: 1 / 3; display: flex; justify-content: center; align-items: flex-start; }
            .qr-container img { width: 19mm; height: 19mm; object-fit: contain; }
            .info { grid-column: 1 / 2; align-self: center; overflow: hidden; }
            .barcode-container { grid-column: 1 / 3; display: flex; justify-content: center; align-items: flex-end; padding-top: 1mm; }
            .barcode-container img { max-width: 100%; height: 8mm; object-fit: contain; }

            @media print {
                body { background: none; }
                .label-wrapper { border-color: black; } /* Ensure black border prints */
            }
        </style>
    </head>
    <body>
        <div class="print-container">
            ${labelsHtml}
        </div>
        <script>
            window.onload = function() { setTimeout(() => { window.print(); }, 800); }
        </script>
    </body>
    </html>
  `);
    printWindow.document.close();
};
