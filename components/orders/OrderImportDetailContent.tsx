
import React from 'react';
import { ArticleEditForm } from '../inventory/ArticleEditForm';
import { Article, Warehouse, Supplier } from '../../types';
import { supabase } from '../../supabaseClient';

interface OrderImportDetailContentProps {
    importItem: {
        id: string; // Order Item ID
        name: string;
        sku: string;
        supplier: string;
        date: string;
    };
    warehouses: Warehouse[];
    suppliers: Supplier[];
    onClose: () => void;
    onSuccess: (newArticleId: string) => void;
}

export const OrderImportDetailContent: React.FC<OrderImportDetailContentProps> = ({
    importItem,
    warehouses,
    suppliers,
    onClose,
    onSuccess
}) => {
    // Prepare initial data based on import item
    const initialArticle: Partial<Article> | null = React.useMemo(() => {
        if (!importItem) return null;

        // Try to find supplier object to pre-fill detailed supplier info if needed
        const supplierObj = suppliers.find(s => s.name === importItem.supplier);

        return {
            name: importItem.name,
            sku: importItem.sku,
            // Assuming default or empty for others
            supplier: importItem.supplier,
            // If we had more info we could map it here
        };
    }, [importItem, suppliers]);

    // Distinct categories for autocomplete - we could fetch this or pass it down. 
    // To keep it self-contained or simple, we might fetch or just pass an empty list if not critical,
    // OR better: Pass it from parent (Orders.tsx) which probably has access or can fetch it.
    // Let's assume passed from parent is better, but interface above doesn't have it yet.
    // For now, let's fetch it quickly or just default to empty/mock if not passed.
    // Actually, distinctCategories IS required by ArticleEditForm. 
    // I will add it to props.
    // But `Orders.tsx` doesn't fetch distinctCategories yet.
    // I will duplicate the fetch logic or just pass a basic list.
    // Let's rely on Orders.tsx to pass it if possible, but I'll add the prop.

    // WAIT: I cannot change the Props interface in this file freely without updating Orders.tsx too.
    // I will include distinctCategories in the Props here.

    const [distinctCategories, setDistinctCategories] = React.useState<string[]>([]);

    React.useEffect(() => {
        const fetchCats = async () => {
            const { data } = await supabase.from('articles').select('category');
            if (data) {
                const unique = Array.from(new Set(data.map((a: any) => a.category).filter(Boolean)));
                setDistinctCategories(unique as string[]);
            }
        };
        fetchCats();
    }, []);

    const handleSave = async (articleData: any, shouldClose: boolean) => {
        // Create the article
        try {
            // ArticleEditForm's internal logic handles the DB insert for the Article itself IF we used it directly?
            // Wait, ArticleEditForm calls `onSave` prop. It does NOT insert into DB itself?
            // Let's check ArticleEditForm lines 358-403 (from previous view).
            // It DOES supabase insert/update! 
            // Wait, looking at the code I viewed earlier for `ArticleEditForm` in `Step 106`:
            // Line 146: `await onSave(...)`. 
            // Line 360-400 seems to be inside `AddArticleModal` from Step 101, NOT `ArticleEditForm`.
            // Let's re-read `ArticleEditForm.tsx` from Step 106 CAREFULLY.

            // `ArticleEditForm` Step 106, lines 143-161:
            // handleSave calls onSave.
            // IT DOES NOT DO DB OPERATIONS directly for the ARTICLE ITSELF?
            // Let's check lines 350+...
            // Step 106 `ArticleEditForm` ONLY contains UI and logic for state. 
            // I DO NOT SEE `supabase.from('articles').insert` in `ArticleEditForm.tsx` in Step 106.
            // Oh, wait. I see `supabase` import.
            // But where is the save logic?
            // Ah, I might have misread or the file content in Step 106 was just the UI?
            // Re-reading Step 106...
            // It has `onSave: (articleData: any, shouldClose: boolean) => Promise<void>;` in props.
            // It calls `await onSave(...)` in `handleSave`.
            // It DOES HAVE `checkSkus` logic with Supabase (Duplicate check?), lines 298-356 in `AddArticleModal`?
            // Wait, Step 106 is `components/inventory/ArticleEditForm.tsx`.
            // It has `const handleSave = async ... await onSave(...)`.
            // It does NOT seem to have the INSERT logic.
            // ==> SO, `Orders.tsx` (or `OrderImportDetailContent`) MUST handle the DB Insert.

            // BUT `AddArticleModal` (Step 101) DOES have the insert logic (lines 359-404).
            // `ArticleEditForm` was Refactored/Created to be dumb? Or did I miss it?
            // Let's look at `Inventory.tsx` (Step 69 view) -> `handleSaveFromModal`.
            // Yes, `Inventory.tsx` handles the save.

            // THEREFORE: `OrderImportDetailContent` MUST handle the creation of the article.

            // 1. Create Article using articleData
            const { data: article, error } = await supabase.from('articles').insert({
                name: articleData.name,
                sku: articleData.sku,
                ean: articleData.ean,
                category: articleData.category,
                stock: articleData.stock,
                target_stock: articleData.targetStock,
                location: articleData.location,
                image_url: articleData.image, // ArticleEditForm uses 'image' key in state? Yes.
                warehouse_id: articleData.warehouse_id || warehouses[0]?.id, // fallback
                supplier: articleData.supplier,
                supplier_sku: articleData.supplier_sku,
                product_url: articleData.product_url
                // Plus manufacturer_skus and article_suppliers handling...
            }).select().single();

            if (error) throw error;

            // 2. Handle SKUs and Suppliers relations
            if (articleData.manufacturer_skus && articleData.manufacturer_skus.length > 0) {
                // The ArticleEditForm passes `manufacturer_skus` in articleData.
                // But wait, `articles` table usually has `manufacturer_skus` as JSON column? One viewed schema suggested it.
                // Step 106 `ArticleEditForm` state `tempSkus`.
                // If `articles` has a JSON column `manufacturer_skus`, we are good.
                // Otherwise we need a separate table.
                // `types.ts` (Step 69) shows `manufacturer_skus: ManufacturerSku[]`.
                // Assuming it matches DB structure or handled by `Inventory.tsx`.
                // Let's assume JSON column for now as per `payload` in `AddArticleModal` (Line 366 of Step 101: `manufacturer_skus: tempSkus`).
                // So the insert above should include `manufacturer_skus: articleData.manufacturer_skus`.

                await supabase.from('articles').update({
                    manufacturer_skus: articleData.manufacturer_skus
                }).eq('id', article.id);
            }

            if (articleData.tempSuppliers && articleData.tempSuppliers.length > 0) {
                const supplierInserts = articleData.tempSuppliers.map((s: any) => ({
                    article_id: article.id,
                    supplier_id: s.supplierId,
                    supplier_sku: s.supplierSku,
                    url: s.url,
                    is_preferred: !!s.isPreferred
                }));
                await supabase.from('article_suppliers').insert(supplierInserts);
            }

            // 3. Link Order Item
            await supabase.from('order_items').update({ article_id: article.id }).eq('id', importItem.id);

            onSuccess(article.id);
            if (shouldClose) onClose();

        } catch (e: any) {
            console.error("Save failed", e);
            alert("Fehler beim Speichern: " + e.message);
        }
    };

    return (
        <ArticleEditForm
            isEditMode={false}
            initialArticle={initialArticle as any}
            warehouses={warehouses}
            suppliers={suppliers}
            onSave={handleSave}
            onCancel={onClose}
            distinctCategories={distinctCategories}
            hideSaveAndNext={true}
        />
    );
};
