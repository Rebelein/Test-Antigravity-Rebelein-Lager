import React from 'react';
import { Article, Warehouse, Supplier } from '../../types';
import { ArticleEditForm } from './ArticleEditForm';

interface ArticleEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    isEditMode: boolean;
    initialArticle: Article | null;
    warehouses: Warehouse[];
    suppliers: Supplier[];
    onSave: (articleData: any, shouldClose: boolean) => Promise<void>;
    onNavigate: (direction: 'prev' | 'next') => void;
    hasNavigation: boolean;
    distinctCategories: string[];
}

export const ArticleEditModal: React.FC<ArticleEditModalProps> = ({
    isOpen,
    onClose,
    isEditMode,
    initialArticle,
    warehouses,
    suppliers,
    onSave,
    onNavigate,
    hasNavigation,
    distinctCategories
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[170] flex items-center justify-center sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden animate-in fade-in">
            <div className="w-full h-full sm:h-auto sm:max-h-[90vh] max-w-2xl bg-[#1a1d24] border-0 sm:border border-white/10 sm:rounded-2xl shadow-2xl flex flex-col relative z-10 sm:overflow-hidden">
                <ArticleEditForm
                    isEditMode={isEditMode}
                    initialArticle={initialArticle}
                    warehouses={warehouses}
                    suppliers={suppliers}
                    onSave={onSave}
                    onCancel={onClose}
                    distinctCategories={distinctCategories}
                    onNavigate={onNavigate}
                    hasNavigation={hasNavigation}
                />
            </div>
        </div>
    );
};
