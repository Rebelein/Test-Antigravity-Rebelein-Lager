
import { Article, Machine, MachineStatus, Order, Warehouse } from './types';

export const APP_NAME = "Rebelein LagerApp";

export const MOCK_MACHINES: Machine[] = [
  {
    id: 'm1',
    name: 'Hilti TE 6-A22 Bohrhammer',
    status: MachineStatus.AVAILABLE,
    nextMaintenance: '2024-08-15',
  },
  {
    id: 'm2',
    name: 'Rothenberger Romax 4000',
    status: MachineStatus.RENTED,
    assignedTo: 'Max Mustermann',
    nextMaintenance: '2024-06-20',
  },
  {
    id: 'm3',
    name: 'Bosch GWS 18V-10',
    status: MachineStatus.REPAIR,
    nextMaintenance: '2024-05-01',
  },
  {
    id: 'm4',
    name: 'Rems Amigo 2',
    status: MachineStatus.AVAILABLE,
    nextMaintenance: '2024-11-12',
  }
];

export const MOCK_ARTICLES: Article[] = [
  { id: 'a1', name: 'Kupferrohr 15mm', sku: 'CU-15-001', stock: 120, targetStock: 50, location: 'Regal A-01', category: 'Rohre', price: 4.50, supplier: 'Sanitär-Heinze' },
  { id: 'a2', name: 'Winkel 90° 15mm', sku: 'FI-90-15', stock: 15, targetStock: 30, location: 'Box B-12', category: 'Fittings', price: 1.20, supplier: 'GC Gruppe' },
  { id: 'a3', name: 'T-Stück 15mm', sku: 'FI-T-15', stock: 45, targetStock: 20, location: 'Box B-13', category: 'Fittings', price: 2.10, supplier: 'GC Gruppe' },
  { id: 'a4', name: 'Hanf Zopf', sku: 'SE-HA-01', stock: 8, targetStock: 10, location: 'Regal C-05', category: 'Dichtmaterial', price: 3.00, supplier: 'Sanitär-Heinze' },
  { id: 'a5', name: 'Dichtpaste Neofermit', sku: 'SE-PA-01', stock: 3, targetStock: 5, location: 'Regal C-05', category: 'Dichtmaterial', price: 6.50, supplier: 'Sanitär-Heinze' },
  { id: 'a6', name: 'Rotguss Kappen 3/8 Zoll', sku: '281854', stock: 40, targetStock: 10, location: 'Fach 1', category: 'Rotguss Fittinge', price: 2.50, supplier: 'Sanitär-Heinze' },
  { id: 'a7', name: 'Rotguss Stopfen 1/2 Zoll', sku: '362902', stock: 22, targetStock: 15, location: 'Fach 2', category: 'Rotguss Fittinge', price: 1.80, supplier: 'Sanitär-Heinze' },
  { id: 'a8', name: 'Rotguss Kappe 1/2 Zoll', sku: '363002', stock: 5, targetStock: 10, location: 'Fach 2', category: 'Rotguss Fittinge', price: 2.80, supplier: 'Sanitär-Heinze' },
];

export const MOCK_ORDERS: Order[] = [
  { id: 'o1', supplier: 'GC Gruppe', date: '2024-05-20', itemCount: 12, status: 'Ordered', total: 450.20 },
  { id: 'o2', supplier: 'Richter+Frenzel', date: '2024-05-18', itemCount: 5, status: 'Draft', total: 120.00 },
];

export const MOCK_WAREHOUSES: Warehouse[] = [
  { id: 'w1', name: 'Zentrallager Süd', type: 'Main', location: 'Industriestr. 5, 80339 München', itemsCount: 1250 },
  { id: 'w2', name: 'Fahrzeug Max (M-XY 123)', type: 'Vehicle', location: 'Unterwegs', itemsCount: 120 },
  { id: 'w3', name: 'Fahrzeug Anna (M-AB 456)', type: 'Vehicle', location: 'Baustelle Krankenhaus', itemsCount: 95 },
  { id: 'w4', name: 'Container Baustelle Nord', type: 'Site', location: 'Am Stadtpark 1', itemsCount: 340 },
];

export const CHART_DATA = [
  { name: 'Rohre', value: 400 },
  { name: 'Fittings', value: 300 },
  { name: 'Werkzeug', value: 150 },
  { name: 'Dicht.', value: 100 },
];
