import React, { useEffect, useState } from 'react';
import { KeyProtocol } from '../components/KeyProtocol';
import { Key } from '../types';

const PrintProtocol: React.FC = () => {
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        try {
            const storedData = sessionStorage.getItem('printProtocolData');
            if (storedData) {
                const parsed = JSON.parse(storedData);
                // Convert date string back to Date object
                if (parsed.date) parsed.date = new Date(parsed.date);
                setData(parsed);

                // Auto-print after a short delay to allow rendering
                setTimeout(() => {
                    window.print();
                    // Optional: close after print? 
                    // window.close(); 
                }, 500);
            }
        } catch (e) {
            console.error("Failed to load print data", e);
        }
    }, []);

    if (!data) {
        return <div className="p-10 text-center text-gray-500">Lade Protokoll...</div>;
    }

    return (
        <div>
            <KeyProtocol
                type={data.type}
                keys={data.keys}
                partnerName={data.partnerName}
                partnerAddress={data.partnerAddress}
                date={data.date}
                notes={data.notes}
            />

            {data.type === 'issue' && (
                <>
                    <div style={{ pageBreakBefore: 'always' }} />
                    <KeyProtocol
                        type="return"
                        keys={data.keys}
                        partnerName={data.partnerName}
                        partnerAddress={data.partnerAddress}
                        date={data.date} // Use same date for document creation, can be crossed out if needed
                        companyName={data.companyName}
                        notes="" // Clear notes for return form
                    />
                </>
            )}
        </div>
    );
};

export default PrintProtocol;
