import React from 'react';
import { LayoutDashboard, Package, Drill, ShoppingCart, ScanLine, Shirt, Key, ClipboardList, ClipboardCheck } from 'lucide-react';

export interface NavItemConfig {
    id: string;
    label: string;
    icon: React.ReactNode;
    isSpecial?: boolean;
}

export const ALL_NAV_ITEMS: NavItemConfig[] = [
    { id: 'dashboard', icon: <LayoutDashboard size={24} />, label: 'Home' },
    { id: 'inventory', icon: <Package size={24} />, label: 'Lager' },
    { id: 'commissions', icon: <ClipboardCheck size={24} />, label: 'Kom.' },
    { id: 'SCANNER_ACTION', icon: <ScanLine size={24} />, label: 'Scanner', isSpecial: true },
    { id: 'audit', icon: <ClipboardList size={24} />, label: 'Inventur' },
    { id: 'machines', icon: <Drill size={24} />, label: 'Tools' },
    { id: 'orders', icon: <ShoppingCart size={24} />, label: 'Bestellen' },
    { id: 'workwear', icon: <Shirt size={24} />, label: 'Kleidung' },
    { id: 'keys', icon: <Key size={24} />, label: 'Schlüssel' },
];

export const DEFAULT_SIDEBAR_ORDER = ALL_NAV_ITEMS.map(item => item.id);
