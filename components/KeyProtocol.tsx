import React from 'react';
import { Key } from '../types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface KeyProtocolProps {
    type: 'issue' | 'return'; // 'issue' = Wir geben aus (an Kunde/MA), 'return' = Wir nehmen an (von Kunde/MA)
    keys: Key[];
    partnerName: string; // Name des Empfängers oder Übergebers
    partnerAddress?: string;
    date: Date;
    companyName?: string;
    notes?: string;
}

export const KeyProtocol = React.forwardRef<HTMLDivElement, KeyProtocolProps>(({
    type,
    keys,
    partnerName,
    partnerAddress,
    date,
    companyName = 'Rebelein Haustechnik',
    notes
}, ref) => {

    const title = type === 'issue' ? 'Schlüssel-Ausgabeprotokoll' : 'Schlüssel-Rücknahmeprotokoll';
    const partnerRole = type === 'issue' ? 'Empfänger' : 'Übergeber';
    const ownRole = type === 'issue' ? 'Ausgeber' : 'Annehmer';

    return (
        <div ref={ref} className="bg-white text-black p-[20mm] w-full max-w-none mx-auto relative print:p-[20mm] print:m-0 print:w-full">

            {/* CSS to hide browser headers/footers and set page size */}
            <style type="text/css" media="print">
                {`
                    @page { 
                        size: A4; 
                        margin: 0;
                    }
                    body {
                        background: white;
                    }
                `}
            </style>

            {/* Header */}
            <header className="flex justify-between items-start mb-8 border-b-2 border-black pb-4">
                <div className="flex flex-col gap-4">
                    {/* Logo */}
                    <img
                        src="https://badpartner.net/wp-content/uploads/2025/10/F9H5sXtHVUajNJ7AzSlnUpxWR5RDXnOskYs0c98m.jpeg"
                        alt="Rebelein Haustechnik Logo"
                        className="h-16 object-contain self-start"
                    />

                    {/* Address Block */}
                    <div className="text-sm text-gray-800 leading-snug">
                        <h1 className="font-bold uppercase tracking-wide text-lg mb-1">Stefan Rebelein Sanitär GmbH</h1>
                        <p>Martin-Behaim-Straße 6</p>
                        <p>(Büro Steinacher Straße 11)</p>
                        <p>90765 Fürth – Stadeln</p>
                    </div>
                </div>

                <div className="text-right pt-2">
                    <h2 className="text-xl font-bold uppercase tracking-tight">{title}</h2>
                    <p className="text-sm mt-1 font-mono">Datum: {format(date, 'dd.MM.yyyy', { locale: de })}</p>
                </div>
            </header>

            {/* Contract Partners */}
            <section className="grid grid-cols-2 gap-8 mb-8">
                <div className="border border-gray-400 p-4 rounded-sm bg-gray-50/50">
                    <h3 className="font-bold text-xs uppercase text-gray-400 mb-2 tracking-widest">{ownRole} (Wir)</h3>
                    <p className="font-bold text-lg leading-tight">{companyName}</p>
                    <div className="mt-6 border-b border-gray-300 border-dashed w-3/4"></div>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase">Mitarbeiter Handzeichen</p>
                </div>
                <div className="border border-gray-400 p-4 rounded-sm bg-gray-50/50">
                    <h3 className="font-bold text-xs uppercase text-gray-400 mb-2 tracking-widest">{partnerRole}</h3>
                    <p className="font-bold text-lg leading-tight mb-1">{partnerName}</p>
                    {partnerAddress && <p className="whitespace-pre-wrap text-sm text-gray-700 leading-snug">{partnerAddress}</p>}
                </div>
            </section>

            {/* Keys List */}
            <section className="mb-8">
                <h3 className="font-bold text-sm mb-3 border-b-2 border-black pb-1 uppercase tracking-wide">Betroffene Schlüssel</h3>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-100 text-xs uppercase tracking-wider border-y border-gray-400">
                            <th className="p-2 w-16 text-center font-bold text-gray-700">Platz</th>
                            <th className="p-2 font-bold text-gray-700">Bezeichnung</th>
                            <th className="p-2 font-bold text-gray-700">Objekt / Adresse</th>
                            <th className="p-2 w-20 text-center font-bold text-gray-700">Anzahl</th>
                        </tr>
                    </thead>
                    <tbody>
                        {keys.map((key, index) => (
                            <tr key={key.id} className="border-b border-gray-200">
                                <td className="p-2 text-center font-bold text-sm">{key.slot_number}</td>
                                <td className="p-2 font-bold text-sm">{key.name}</td>
                                <td className="p-2 text-sm text-gray-700">{key.address || '-'}</td>
                                <td className="p-2 text-center text-sm">1</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            {/* Notes */}
            {notes && (
                <section className="mb-8">
                    <h3 className="font-bold text-sm mb-1 uppercase tracking-wide">Bemerkungen</h3>
                    <div className="border-l-2 border-gray-300 pl-3 py-1 italic text-gray-700 bg-gray-50 text-sm">
                        {notes}
                    </div>
                </section>
            )}

            {/* Disclaimer & Footer Section */}
            <div className="mt-8 page-break-inside-avoid">
                <div className="mb-8 text-xs text-gray-500 text-justify leading-relaxed">
                    <p>
                        {type === 'issue'
                            ? 'Der Empfänger bestätigt hiermit den Erhalt der oben aufgeführten Schlüssel und verpflichtet sich zu deren sorgfältiger Aufbewahrung und Rückgabe. Für Verlust oder Beschädigung haftet der Empfänger in vollem Umfang.'
                            : 'Der Annehmer bestätigt die vollständige und unversehrte Rücknahme der oben aufgeführten Schlüssel.'}
                    </p>
                </div>

                {/* Signatures */}
                <footer className="grid grid-cols-2 gap-12">
                    <div>
                        <div className="border-b border-black mb-2 h-16"></div>
                        <p className="text-left font-bold text-xs uppercase tracking-wider">Unterschrift {ownRole}</p>
                    </div>
                    <div>
                        <div className="border-b border-black mb-2 h-16"></div>
                        <p className="text-left font-bold text-xs uppercase tracking-wider">Unterschrift {partnerRole}</p>
                    </div>
                </footer>
            </div>

            {/* Timestamp Footer */}
            <div className="mt-8 text-center text-[10px] text-gray-300">
                <p>Dokument digital erstellt am {format(new Date(), 'dd.MM.yyyy HH:mm')} via Rebelein LagerApp</p>
            </div>
        </div>
    );
});

KeyProtocol.displayName = 'KeyProtocol';
