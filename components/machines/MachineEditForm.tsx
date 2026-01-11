import React, { useState, useRef } from 'react';
import { Button, GlassInput } from '../UIComponents';
import { Plus, Save, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { toast } from 'sonner';

interface MachineEditFormProps {
    initialData?: {
        name: string;
        image: string;
        nextMaintenance: string;
    };
    isEditMode: boolean;
    onSave: (data: { name: string; image: string; nextMaintenance: string }) => Promise<void>;
    onCancel: () => void;
}

export const MachineEditForm: React.FC<MachineEditFormProps> = ({ initialData, isEditMode, onSave, onCancel }) => {
    const [formData, setFormData] = useState(initialData || { name: '', image: '', nextMaintenance: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const processFileUpload = async (file: File) => {
        try {
            setIsUploading(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `machine_${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
            const { error } = await supabase.storage.from('article-images').upload(fileName, file);
            if (error) throw error;
            const { data: { publicUrl } } = supabase.storage.from('article-images').getPublicUrl(fileName);
            setFormData(prev => ({ ...prev, image: publicUrl }));
        } catch (error: any) {
            toast.error("Upload Fehler: " + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.name) return toast.error("Name ist erforderlich");
        setIsSubmitting(true);
        try {
            await onSave(formData);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#16181D]">
            <div className="p-6 border-b border-white/5 flex justify-between items-center shrink-0">
                <h2 className="text-xl font-bold text-white">{isEditMode ? 'Maschine bearbeiten' : 'Neue Maschine'}</h2>
                <button onClick={onCancel} className="p-2 -mr-2 text-white/50 hover:text-white rounded-full hover:bg-white/10 transition-colors">
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">

                {/* Image Upload Big Area */}
                <div className="aspect-video w-full bg-black/40 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center relative group cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all overflow-hidden" onClick={() => fileInputRef.current?.click()}>
                    {formData.image ? (
                        <>
                            <img src={formData.image} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity">
                                <ImageIcon size={32} className="text-white mb-2" />
                                <span className="text-sm font-medium text-white">Bild ändern</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Plus size={32} className="text-white/30 group-hover:text-emerald-400" />
                            </div>
                            <span className="text-sm font-medium text-white/50 group-hover:text-emerald-300">Bild hochladen</span>
                        </>
                    )}
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => { if (e.target.files?.[0]) processFileUpload(e.target.files[0]) }} />
                    {isUploading && <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10"><Loader2 className="animate-spin text-emerald-500" /></div>}
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Bezeichnung</label>
                        <GlassInput
                            value={formData.name}
                            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="z.B. Bohrhammer Hilti TE-30"
                            className="bg-[#111111]/50"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Nächste Wartung (Optional)</label>
                        <input
                            type="date"
                            className="w-full bg-[#111111]/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all text-sm" // Matching GlassInput style mostly
                            value={formData.nextMaintenance ? new Date(formData.nextMaintenance).toISOString().split('T')[0] : ''}
                            onChange={e => setFormData(prev => ({ ...prev, nextMaintenance: e.target.value }))}
                        />
                    </div>
                </div>
            </div>

            <div className="p-6 border-t border-white/5 flex justify-end gap-3 bg-[#111111]/30 shrink-0 sticky bottom-0 z-10 backdrop-blur-md">
                <Button variant="secondary" onClick={onCancel} className="h-12 px-6">Abbrechen</Button>
                <Button onClick={handleSave} disabled={isSubmitting || isUploading} className="h-12 px-8 bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20">
                    {isSubmitting ? <Loader2 className="animate-spin" /> : (isEditMode ? 'Speichern' : 'Erstellen')}
                </Button>
            </div>
        </div>
    );
};
