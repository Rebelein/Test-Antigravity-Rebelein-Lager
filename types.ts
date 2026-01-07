

export enum MachineStatus {
  AVAILABLE = 'Available',
  RENTED = 'Rented',
  REPAIR = 'In Repair'
}

export interface Machine {
  id: string;
  name: string;
  status: MachineStatus;
  assignedTo?: string; // User ID if internal
  externalBorrower?: string; // Name string if external
  nextMaintenance: string;
  image?: string;
  notes?: string; // Defect notes
  profiles?: UserProfile; // Joined user data
}

export interface MachineEvent {
  id: string;
  machine_id: string;
  user_id: string;
  action: 'rented' | 'returned' | 'transfer' | 'defect' | 'repaired' | 'reserved';
  details: string;
  created_at: string;
  profiles?: { full_name: string };
}

export interface MachineReservation {
  id: string;
  machine_id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  note?: string;
  profiles?: { full_name: string };
}

export interface ManufacturerSku {
  sku: string;
  isPreferred: boolean;
}

export interface ArticleSupplier {
  id?: string; // Optional for new entries
  supplierId: string;
  supplierName: string;
  supplierSku: string;
  url?: string; // New: URL per supplier
  isPreferred: boolean;
}

export interface Article {
  id: string;
  name: string;
  sku: string; // Primary SKU (legacy/fallback)
  manufacturerSkus?: ManufacturerSku[]; // New JSON list
  stock: number;
  targetStock: number;
  location: string;
  category: string;
  price: number;
  supplier?: string; // Legacy/Primary supplier name
  warehouseId?: string;
  ean?: string;
  supplierSku?: string; // Legacy/Primary supplier SKU
  productUrl?: string;
  image?: string;
  onOrderDate?: string | null; // New field for order status
  lastCountedAt?: string | null; // New field for Audit/Stocktaking
}

export interface OrderItem {
  id: string;
  articleId?: string | null; // Made optional for custom items
  articleName?: string; // From join
  articleSku?: string; // From join
  custom_name?: string; // NEW: For manual items not in DB
  custom_sku?: string;  // NEW: For manual items not in DB
  quantityOrdered: number;
  quantityReceived: number;
}

export interface Order {
  id: string;
  supplier: string;
  date: string;
  itemCount: number;
  // Updated status to include ReadyForPickup
  status: 'Draft' | 'Ordered' | 'PartiallyReceived' | 'Received' | 'ReadyForPickup';
  total: number;
  commissionNumber?: string;
  supplierOrderNumber?: string;
  warehouseId?: string; // Link order to a specific warehouse
  warehouseName?: string; // Display name
  warehouseType?: WarehouseType; // Helper for UI logic
  items?: OrderItem[];
}

export type WarehouseType = 'Main' | 'Vehicle' | 'Site';

export interface Warehouse {
  id: string;
  name: string;
  type: WarehouseType;
  location: string;
  itemsCount?: number;
}

export interface Supplier {
  id: string;
  name: string;
  customer_number?: string;
  contact_email?: string;
  website?: string;
  csv_format?: string; // New field for CSV template
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  role?: 'admin' | 'worker';
  avatar_url?: string;
  primary_warehouse_id?: string;
  secondary_warehouse_id?: string;
  collapsed_categories?: string[];
  has_seen_tour?: boolean; // Control for Onboarding Tour
  workwear_role?: WorkwearRole;
}

// --- COMMISSION MODULE TYPES ---

// Updated Status to include Return Flow
export type CommissionStatus = 'Draft' | 'Preparing' | 'Ready' | 'Withdrawn' | 'ReturnPending' | 'ReturnReady' | 'ReturnComplete' | 'Missing';

export interface Commission {
  id: string;
  order_number: string; // Reference to project/Baustelle
  name: string; // Human readable name e.g. "Bad Müller OG"
  notes?: string;
  status: CommissionStatus;
  warehouse_id: string;
  created_at: string;
  withdrawn_at?: string;
  deleted_at?: string; // Trash bin date
  needs_label?: boolean; // Print later queue
  supplier_id?: string;
  supplier_order_number?: string;
  is_processed?: boolean; // Office status
  office_notes?: string; // Office notes
}

export type CommissionItemType = 'Stock' | 'External';

export interface CommissionItem {
  id: string;
  commission_id: string;
  type: CommissionItemType;
  article_id?: string; // If Stock
  article?: Article; // Joined data
  custom_name?: string; // If External
  external_reference?: string; // Delivery Note No. / Supplier Ref
  attachment_data?: string; // Base64 data for attachment (delivery note image/pdf)
  is_backorder?: boolean; // NEW: Rückstand
  notes?: string; // NEW: Item Notes
  amount: number;
  is_picked: boolean; // Checklist status
}

export interface CommissionEvent {
  id: string;
  commission_id: string;
  commission_name: string;
  user_id: string;
  action: string; // 'created', 'labels_printed', etc.
  details: string;
  created_at: string;
  profiles?: { full_name: string }; // Joined user data
}

export type NavRoute = 'dashboard' | 'inventory' | 'machines' | 'orders' | 'stocktaking' | 'warehouses' | 'audit' | 'commissions' | 'workwear';

export interface OrderProposal {
  warehouseId: string;
  warehouseName: string;
  supplier: string;
  supplierId?: string;
  csvFormat?: string;
  articles: {
    article: Article;
    missingAmount: number;
  }[];
  totalItems: number;
}

// --- KEY MANAGEMENT (Schlüsselkasten) TYPES ---

export type KeyStatus = 'Available' | 'InUse' | 'Lost';

export interface Key {
  id: string;
  slot_number: number;
  name: string;
  address?: string;
  status: KeyStatus;
  holder_id?: string;
  holder_name?: string; // For manual formatting or fallback
  owner?: string; // Owner/Customer of the keys
  notes?: string;
  category_id?: string;
  key_categories?: { color: string; name: string }; // Joined
}

export interface KeyEvent {
  id: string;
  key_id: string;
  user_id: string;
  action: 'checkout' | 'checkin' | 'create' | 'update' | 'delete';
  details: string;
  created_at: string;
  profiles?: { full_name: string };
  key_slot?: number; // For log display join
  key_name?: string; // For log display join
}

// --- WORKWEAR MODULE TYPES ---

export type WorkwearRole = 'chef' | 'besteller' | 'monteur';
export type WorkwearCategory = 'T-Shirt' | 'Pullover' | 'Jacke' | 'Hose' | 'Schuhe' | 'PSA' | 'Sonstiges';
export type WorkwearOrderStatus = 'REQUESTED' | 'ORDERED' | 'RETURNED' | 'COMPLETED';

export interface WorkwearTemplate {
  id: string;
  name: string;
  category: string; // Plain string in DB, but we treat it as WorkwearCategory in UI usually
  article_number: string;
  price: number;
  image_url?: string;
  is_active: boolean;
  has_logo?: boolean;
}

export interface WorkwearBudget {
  id: string;
  user_id: string;
  year: number;
  budget_limit: number;
  // Computed on client side usually, or separate query
}

export interface CartItem {
  id: string;
  template: WorkwearTemplate;
  size: string;
  quantity: number;
}

export interface UserSize {
  id: string;
  user_id: string;
  category: string;
  size_value: string;
}

export interface WorkwearOrder {
  id: string;
  user_id: string;
  status: WorkwearOrderStatus;
  total_amount: number;
  created_at: string;
  updated_at: string;
  // Joins
  profiles?: { full_name: string };
  files?: any;
}

export interface WorkwearOrderItem {
  id: string;
  order_id: string;
  template_id?: string;
  workwear_templates?: WorkwearTemplate; // Join
  quantity: number;
  size: string;
  use_logo: boolean;
  price_at_order: number;
}
