import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../supabaseClient';
import { GlassCard, Button, GlassModal, GlassInput as Input } from '../../../components/UIComponents';
import { Plus, X, Edit2, Archive, Check, Image as ImageIcon, Trash2, ArrowLeft, ClipboardCopy } from 'lucide-react';
import { WorkwearTemplate } from '../../../../types';
import { toast } from 'sonner';
import { clsx } from 'clsx';

interface AdminTemplateEditorProps {
    onBack: () => void;
}

export const AdminTemplateEditor: React.FC<AdminTemplateEditorProps> = ({ onBack }) => {
    const [templates, setTemplates] = useState<WorkwearTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<WorkwearTemplate>>({
        name: '',
        category: 'T-Shirt',
        article_number: '',
        price: 0,
        image_url: '',
        is_active: true
    });

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('workwear_templates').select('*').order('created_at', { ascending: false });
        if (error) {
            toast.error("Fehler beim Laden der Artikel");
        } else {
            setTemplates(data || []);
        }
        setLoading(false);
    };

    const uploadFile = async (file: File) => {
        try {
            setUploading(true);
            const fileExt = file.name.split('.').pop() || 'png';
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('workwear')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('workwear').getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, image_url: data.publicUrl }));
            toast.success("Bild hochgeladen");

        } catch (error) {
            toast.error("Fehler beim Hochladen");
            console.error(error);
        } finally {
            setUploading(false);
        }
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) await uploadFile(file);
    };

    const handlePasteImage = async () => {
        try {
            const clipboardItems = await navigator.clipboard.read();
            for (const item of clipboardItems) {
                if (!item.types.some(type => type.startsWith('image/'))) continue;

                const blob = await item.getType(item.types.find(type => type.startsWith('image/'))!);
                const file = new File([blob], "pasted_image.png", { type: blob.type });
                await uploadFile(file);
                return;
            }
            toast.error("Kein Bild in der Zwischenablage");
        } catch (err) {
            console.error(err);
            toast.error("Zugriff auf Zwischenablage verweigert oder Fehler");
        }
    };

    const handleSave = async () => {
        if (!formData.name || !formData.category || !formData.article_number) {
            toast.error("Bitte alle Pflichtfelder ausfüllen");
            return;
        }

        try {
            if (editingId) {
                const { error } = await supabase
                    .from('workwear_templates')
                    .update(formData)
                    .eq('id', editingId);
                if (error) throw error;
                toast.success("Artikel aktualisiert");
            } else {
                const { error } = await supabase
                    .from('workwear_templates')
                    .insert([formData]);
                if (error) throw error;
                toast.success("Artikel erstellt");
            }
            setIsModalOpen(false);
            setEditingId(null);
            setFormData({ name: '', category: 'T-Shirt', article_number: '', price: 0, image_url: '', is_active: true });
            fetchTemplates();
        } catch (error) {
            console.error(error);
            toast.error("Fehler beim Speichern");
        }
    };

    const handleEdit = (template: WorkwearTemplate) => {
        setEditingId(template.id);
        setFormData(template);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Artikel wirklich löschen?")) return;
        const { error } = await supabase.from('workwear_templates').delete().eq('id', id);
        if (error) toast.error("Fehler beim Löschen");
        else {
            toast.success("Artikel gelöscht");
            fetchTemplates();
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button onClick={onBack} variant="ghost" className="rounded-full w-10 h-10 p-0 flex items-center justify-center">
                    <ArrowLeft size={20} />
                </Button>
                <div>
                    <h2 className="text-2xl font-bold text-white">Artikel Vorlagen</h2>
                    <p className="text-white/50">Katalog verwalten</p>
                </div>
                <div className="ml-auto">
                    <Button onClick={() => {
                        setEditingId(null);
                        setFormData({ name: '', category: 'T-Shirt', article_number: '', price: 0, image_url: '', is_active: true });
                        setIsModalOpen(true);
                    }} icon={<Plus size={18} />}>
                        Neuer Artikel
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(item => (
                    <GlassCard key={item.id} className="flex gap-4 p-4 items-start group">
                        <div className="w-20 h-20 bg-black/30 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                            {item.image_url ? (
                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                                <ImageIcon className="text-white/20" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                                <div className="text-xs text-emerald-400 font-medium uppercase">{item.category}</div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(item)} className="p-1 hover:bg-white/10 rounded text-emerald-400"><Edit2 size={14} /></button>
                                    <button onClick={() => handleDelete(item.id)} className="p-1 hover:bg-white/10 rounded text-rose-400"><Trash2 size={14} /></button>
                                </div>
                            </div>
                            <h3 className="font-bold text-white truncate">{item.name}</h3>
                            <div className="text-sm text-white/50">{item.article_number}</div>
                            <div className="mt-2 font-mono text-emerald-300">{item.price?.toFixed(2)} €</div>
                        </div>
                    </GlassCard>
                ))}
            </div>

            <GlassModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <h2 className="text-xl font-bold">{editingId ? 'Artikel bearbeiten' : 'Neuer Artikel'}</h2>
                    <button onClick={() => setIsModalOpen(false)}><X className="text-white/50 hover:text-white" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-white/60 ml-1">Bezeichnung</label>
                        <Input
                            value={formData.name || ''}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="z.B. T-Shirt Premium"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-white/60 ml-1">Artikelnummer</label>
                            <Input
                                value={formData.article_number || ''}
                                onChange={e => setFormData({ ...formData, article_number: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-white/60 ml-1">Kategorie</label>
                            <select
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                            >
                                <option className="bg-zinc-900" value="T-Shirt">T-Shirt</option>
                                <option className="bg-zinc-900" value="Pullover">Pullover</option>
                                <option className="bg-zinc-900" value="Hose">Hose</option>
                                <option className="bg-zinc-900" value="Jacke">Jacke</option>
                                <option className="bg-zinc-900" value="Schuhe">Schuhe</option>
                                <option className="bg-zinc-900" value="PSA">PSA</option>
                                <option className="bg-zinc-900" value="Sonstiges">Sonstiges</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-white/60 ml-1">Preis (€)</label>
                            <Input
                                type="number"
                                value={formData.price?.toString() || ''}
                                onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-white/60 ml-1">Bild</label>
                            <div className="flex gap-4 items-center">
                                {formData.image_url && (
                                    <div className="w-16 h-16 bg-black/30 rounded-lg overflow-hidden shrink-0 border border-white/10">
                                        <img src={formData.image_url} className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <div className="flex-1 flex gap-2">
                                    <label className="flex-1 flex items-center justify-center px-4 py-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl cursor-pointer transition-colors text-sm font-medium text-white/70 hover:text-white">
                                        <ImageIcon size={18} className="mr-2" />
                                        {formData.image_url ? 'Bild ändern' : 'Hochladen'}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleImageUpload}
                                            disabled={uploading}
                                        />
                                    </label>
                                    <Button
                                        type="button"
                                        onClick={handlePasteImage}
                                        disabled={uploading}
                                        variant="secondary"
                                        className="px-4"
                                        title="Aus Zwischenablage einfügen"
                                    >
                                        <ClipboardCopy size={18} />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Logo Toggle */}
                        <div className="flex items-center gap-3 pt-2">
                            <div
                                onClick={() => setFormData(prev => ({ ...prev, has_logo: !prev.has_logo }))}
                                className={clsx(
                                    "w-12 h-7 rounded-full p-1 transition-colors cursor-pointer border border-white/10",
                                    formData.has_logo ? 'bg-emerald-500' : 'bg-black/40'
                                )}
                            >
                                <div className={clsx(
                                    "w-5 h-5 rounded-full bg-white shadow-sm transition-transform",
                                    formData.has_logo ? 'translate-x-5' : 'translate-x-0'
                                )} />
                            </div>
                            <span className="text-sm font-medium text-white/80">Mit Firmenlogo (wird automatisch angehängt)</span>
                        </div>
                    </div>
                </div>
                <div className="p-6 pt-0 flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Abbrechen</Button>
                    <Button onClick={handleSave}>Speichern</Button>
                </div>
            </GlassModal>
        </div>
    );
};
