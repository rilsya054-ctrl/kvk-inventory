export type UserRole = 'Ketua Bengkel' | 'PIC' | 'Pensyarah';

export type WorkshopType =
  | 'Perakaunan'
  | 'Teknologi Penyejukan dan Penyamanan Udara'
  | 'Teknologi Automotif'
  | 'Pengurusan Perniagaan';

export type ItemKategori = 'peralatan' | 'habis_pakai';

export interface User {
  id?: string;
  name: string;
  role: UserRole;
  workshop: WorkshopType;
  selectedStore: string;
  avatarUrl?: string;
}

export interface UserAccount {
  id: string;
  name: string;
  role: UserRole;
  workshop: WorkshopType;
  pin: string; // 4-digit PIN
  registeredAt: string;
  avatarUrl?: string;
}

export interface OrganizationSettings {
  kvName: string;
  workshopName: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string;
}

export const defaultOrgSettings: OrganizationSettings = {
  kvName: 'Kolej Vokasional Shah Alam',
  workshopName: 'Teknologi Penyejukan dan Penyamanan Udara',
  address: 'Jalan Batu Tiga, Seksyen 19, 40300 Shah Alam, Selangor Darul Ehsan',
  phone: '03-5519 1234',
  email: 'bengkel.kv@moe.gov.my',
  logoUrl: '',
};

export interface InventoryItem {
  id: string;
  name: string;
  brand: string;
  sku: string;
  quantity: number;
  totalQuantity: number; // For equipment: available + borrowed. For consumables: total stock count.
  store: string;
  workshop: WorkshopType;
  location: string; // Shelf/Rack location
  kategori: ItemKategori;
  unit: string; // e.g. 'pcs', 'kotak', 'roll', 'meter', 'botol'
  stokMinima: number; // threshold for low stock alert
}

export interface Transaction {
  id: string;
  itemId: string;
  itemName: string;
  store: string;
  workshop: WorkshopType;
  borrowerName: string;
  borrowerRole: UserRole;
  quantity: number;
  purpose: string;
  dateBorrowed: string;
  dateReturned?: string;
  tarikhJangkaPulang?: string; // only for equipment loans
  tarikhMahuPinjam?: string; // requested borrow/use date
  status: 'Menunggu Kelulusan' | 'Diluluskan' | 'Ditolak' | 'Telah Dipulangkan' | 'Telah Diambil';
  kategori: ItemKategori;
}

export interface Notification {
  id: string;
  message: string;
  timestamp: string;
  type: 'tambah' | 'pinjam' | 'lulus' | 'pulang' | 'stok_rendah';
  store: string;
  workshop: WorkshopType;
}

export type AuditLogType = 'TAMBAH' | 'KEMASKINI' | 'PADAM' | 'PINDAH';

export interface AuditLog {
  id: string;
  timestamp: string;        // e.g. '22/08/2026 10:30'
  createdAt?: number;       // epoch timestamp ms untuk penjejakan rekod baharu (unread)
  type: AuditLogType;
  itemName: string;
  sku: string;
  store: string;            // source store
  targetStore?: string;     // for PINDAH only
  workshop: WorkshopType;
  quantity: number;
  unit: string;
  oldQuantity?: number;     // for KEMASKINI only
  performedBy: string;      // user.name
  performedByRole: UserRole;
  catatan?: string;         // optional note
  pendingStatus?: 'Menunggu Kelulusan' | 'Diluluskan' | 'Ditolak'; // for PIC transfer requests
}

// ── Pending Transfer (PIC → Ketua Bengkel approval flow) ──────────────────
export interface PendingTransfer {
  id: string;
  timestamp: string;
  sourceItemId: string;
  sourceItemName: string;
  sourceSku: string;
  sourceStore: string;
  targetStore: string;
  workshop: WorkshopType;
  quantity: number;
  unit: string;
  requestedBy: string;      // user.name of PIC
  requestedByRole: UserRole;
  catatan?: string;
  status: 'Menunggu Kelulusan' | 'Diluluskan' | 'Ditolak';
}

export const WORKSHOP_STORES: Record<WorkshopType, string[]> = {
  'Perakaunan': [
    'Stor Makmal Perakaunan 1',
    'Stor Makmal Perakaunan 2'
  ],
  'Teknologi Penyejukan dan Penyamanan Udara': [
    'Stor Bengkel PPU 1',
    'Stor Bengkel PPU 2',
    'Stor Bengkel PPU 3',
    'Stor Bengkel PPU 4',
    'Stor Bengkel PPU 5A',
    'Stor Bengkel PPU 5B'
  ],
  'Teknologi Automotif': [
    'Stor Bengkel Automotif 1',
    'Stor Bengkel SLDN 2',
    'Stor Bengkel Automotif 3',
    'Stor Bengkel Automotif 4'
  ],
  'Pengurusan Perniagaan': [
    'Stor PPN Aras 1',
    'Stor PPN Aras 2',
    'Stor PPN Aras 3'
  ]
};

export const STOR_INDUK = 'Stor Induk (Semua Stor)';
