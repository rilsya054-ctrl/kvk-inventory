import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useInventory } from '../context/InventoryContext';
import type { InventoryItem, UserAccount } from '../types';
import { STOR_INDUK } from '../types';
import { ExcelImportModal } from './ExcelImportModal';
import TransferModal from './TransferModal';
import { WorkshopCategoryManager, getWorkshopCategories } from './WorkshopCategoryManager';

type TabType = 'dashboard' | 'inventori' | 'pinjam' | 'sejarah' | 'notifikasi' | 'ahli' | 'tetapan';

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number | '';
  onChange: (val: number | '') => void;
}

const NumberInput: React.FC<NumberInputProps> = ({ value, onChange, ...props }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const cleaned = raw.replace(/^0+(?=\d)/, '');
    if (cleaned === '') {
      onChange('');
    } else {
      const num = Number(cleaned);
      onChange(isNaN(num) ? '' : num);
    }
  };

  // Always pass a defined value to keep the input "controlled"
  const safeValue = value === undefined || value === null ? '' : value;

  return (
    <input
      type="number"
      value={safeValue}
      onChange={handleChange}
      onFocus={(e) => e.target.select()}
      {...props}
    />
  );
};

const parseMsMyDate = (dateStr: string): Date => {
  if (!dateStr) return new Date(0);
  const [dPart, tPart] = dateStr.trim().split(' ');
  const [day, month, year] = dPart.split('/').map(Number);
  if (!day || !month || !year) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }
  let hour = 0, minute = 0;
  if (tPart) {
    const [h, m] = tPart.split(':').map(Number);
    if (!isNaN(h)) hour = h;
    if (!isNaN(m)) minute = m;
  }
  return new Date(year, month - 1, day, hour, minute);
};

const GLOBAL_SEKSYEN_MAP: Record<string, string[]> = {
  // TPPU
  AT:  ['WRENCH', 'HAMMER', 'MARKING', 'PLIERS', 'TOOL SET', 'CUTTING', 'SCREWDRIVER', 'FILE'],
  ATE: ['DRILL', 'GRINDER', 'SANDER', 'CUTTING', 'FASTENING'],
  AU:  ['Scale', 'Marking', 'Gauge', 'Caliper'],
  AKT: ['ACCESSORIES', 'TESTER'],
  AK:  ['ACCESSORIES'],
  KGM: ['ACCESSORIES', 'GAS_REGULATOR', 'OIL_PUMP'],
  AKE: ['WIRING', 'CONNECTOR', 'ACCESSORIES'],
  ME:  ['MOTOR', 'PUMP', 'FAN', 'COMPRESSOR'],
  MKE: ['DRIVE', 'CONTROLLER', 'ACCESSORIES'],
  AUE: ['METER', 'TESTER', 'OSCILLOSCOPE', 'ANALYSER'],
  UE:  ['PANEL', 'SWITCHGEAR', 'ACCESSORIES'],
  KE:  ['CABLE', 'CONDUIT', 'FITTING', 'ACCESSORIES'],
  ICT: ['NETWORK', 'SERVER', 'PERIPHERAL', 'CABLE'],
  
  // Perakaunan
  ATULIS: ['PEN', 'PENCIL', 'PAPER', 'CALCULATOR', 'STAPLER', 'CLIP', 'FOLDER'],
  DOK: ['INVOICE', 'RECEIPT', 'LEDGER', 'REPORT', 'TAX'],
  PRB: ['CHAIR', 'TABLE', 'CABINET', 'SHELF'],
  BUKU: ['TEXTBOOK', 'JOURNAL', 'REFERENCE', 'MANUAL'],
  
  // Automotif
  MESIN: ['DIAGNOSTIC', 'ALIGNMENT', 'BALANCER', 'LIFT'],
  ALAT: ['WRENCH', 'SOCKET', 'JACK', 'PULLER', 'COMPRESSOR'],
  SP: ['SPARK_PLUG', 'FILTER', 'BELT', 'BRAKE_PAD', 'BULB'],
  PEL: ['ENGINE_OIL', 'GEAR_OIL', 'COOLANT', 'GREASE', 'BRAKE_FLUID'],
  
  // Pengurusan Perniagaan
  MODUL: ['SLIDES', 'HANDOUT', 'GUIDE', 'BOOKLET'],
  STOK: ['SAMPLE', 'PROTOTYPE', 'INVENTORY_KIT']
};

const getCategoryBadgeStyles = (code: string) => {
  const hash = code.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    { color: '#818cf8', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.25)' },
    { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)' },
    { color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
    { color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' },
    { color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)' },
    { color: '#fb7185', bg: 'rgba(251,113,133,0.12)', border: 'rgba(251,113,133,0.25)' },
    { color: '#c084fc', bg: 'rgba(192,132,252,0.12)', border: 'rgba(192,132,252,0.25)' },
    { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)' },
    { color: '#e879f9', bg: 'rgba(232,121,249,0.12)', border: 'rgba(232,121,249,0.25)' },
    { color: '#22d3ee', bg: 'rgba(34,211,238,0.12)', border: 'rgba(34,211,238,0.25)' },
    { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.25)' },
    { color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.25)' },
    { color: '#a3e635', bg: 'rgba(163,230,53,0.12)', border: 'rgba(163,230,53,0.25)' }
  ];
  return colors[hash % colors.length];
};

export const DashboardPage: React.FC = () => {
  const {
    user,
    items,
    transactions,
    notifications,
    auditLogs,
    logout,
    selectStore,
    addItem,
    updateItem,
    deleteItem,
    requestBorrow,
    approveTransaction,
    rejectTransaction,
    returnItems,
    clearNotifications,
    pendingTransfers,
    userAccounts,
    addUserAccount,
    updateUserPin,
    deleteUserAccount,
    orgSettings,
    updateOrgSettings,
    updateUserProfile,
  } = useInventory();

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');

  // Settings Page States
  const [settingsTab, setSettingsTab] = useState<'organisasi' | 'peribadi'>(() =>
    user?.role === 'Pensyarah' ? 'peribadi' : 'organisasi'
  );

  const [orgKvName, setOrgKvName] = useState(orgSettings?.kvName || '');
  const [orgWorkshopName, setOrgWorkshopName] = useState(orgSettings?.workshopName || user?.workshop || '');
  const [orgAddress, setOrgAddress] = useState(orgSettings?.address || '');
  const [orgPhone, setOrgPhone] = useState(orgSettings?.phone || '');
  const [orgEmail, setOrgEmail] = useState(orgSettings?.email || '');
  const [orgLogoUrl, setOrgLogoUrl] = useState(orgSettings?.logoUrl || '');

  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(user?.avatarUrl || '');
  const [profileCurrentPin, setProfileCurrentPin] = useState('');
  const [profileNewPin, setProfileNewPin] = useState('');
  const [profileConfirmPin, setProfileConfirmPin] = useState('');

  useEffect(() => {
    if (orgSettings) {
      setOrgKvName(orgSettings.kvName || '');
      setOrgWorkshopName(orgSettings.workshopName || user?.workshop || '');
      setOrgAddress(orgSettings.address || '');
      setOrgPhone(orgSettings.phone || '');
      setOrgEmail(orgSettings.email || '');
      setOrgLogoUrl(orgSettings.logoUrl || '');
    }
  }, [orgSettings, user?.workshop]);

  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfileAvatarUrl(user.avatarUrl || '');
      if (user.role === 'Pensyarah' && settingsTab === 'organisasi') {
        setSettingsTab('peribadi');
      }
    }
  }, [user, settingsTab]);

  // Sidebar Collapsible State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('kv_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Mobile Drawer State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile drawer on Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navigateTab = (tab: TabType) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('kv_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Member Management States
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'Pensyarah' | 'PIC' | 'Ketua Bengkel'>('Pensyarah');
  const [newMemberPin, setNewMemberPin] = useState('1234');
  const [editingMember, setEditingMember] = useState<UserAccount | null>(null);
  const [editMemberPin, setEditMemberPin] = useState('');
  const [memberSearchTerm, setMemberSearchTerm] = useState('');

  // 7 Dropdown Filter States
  const [filterJenis, setFilterJenis] = useState('Semua Jenis');
  const [filterKategori, setFilterKategori] = useState('Semua Kategori');
  const [filterKod, setFilterKod] = useState('Semua Kod');
  const [filterSeksyen, setFilterSeksyen] = useState('Semua Seksyen');
  const [filterKedudukan, setFilterKedudukan] = useState('Semua Kedudukan');
  const [filterStatus, setFilterStatus] = useState('Semua Status');
  const [filterAbjad, setFilterAbjad] = useState('Semua Abjad');

  // Audit Log filter tab
  type AuditFilterType = 'Semua' | 'TAMBAH' | 'KEMASKINI' | 'PADAM' | 'PINDAH';
  const [auditLogFilter, setAuditLogFilter] = useState<AuditFilterType>('Semua');

  const handleResetFilters = () => {
    setFilterJenis('Semua Jenis');
    setFilterKategori('Semua Kategori');
    setFilterKod('Semua Kod');
    setFilterSeksyen('Semua Seksyen');
    setFilterKedudukan('Semua Kedudukan');
    setFilterStatus('Semua Status');
    setFilterAbjad('Semua Abjad');
    setSearchTerm('');
  };

  // Modals / Forms state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferModalInitialTab, setTransferModalInitialTab] = useState<'borang' | 'senarai'>('borang');

  // Pending transfer count for this workshop (Ketua Bengkel only)
  const pendingCount = user
    ? pendingTransfers.filter(
        t => t.workshop === user.workshop && t.status === 'Menunggu Kelulusan'
      ).length
    : 0;

  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  
  // Add/Edit Form Fields
  const [itemName, setItemName] = useState('');
  const [itemBrand, setItemBrand] = useState('');
  const [itemSku, setItemSku] = useState('');
  const [itemQty, setItemQty] = useState<number | ''>(1);
  const [itemLocation, setItemLocation] = useState('');
  const [itemKategori, setItemKategori] = useState<'peralatan' | 'habis_pakai'>('peralatan');
  const [itemKodKategori, setItemKodKategori] = useState('AT');
  const [itemSeksyen, setItemSeksyen] = useState('');
  const [itemUnit, setItemUnit] = useState('unit');
  const [itemStokMinima, setItemStokMinima] = useState<number | ''>(5);
  const [isNewRack, setIsNewRack] = useState(false);
  const [newRackName, setNewRackName] = useState('');
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [workshopCategories, setWorkshopCategories] = useState<{ code: string; label: string }[]>([]);

  useEffect(() => {
    if (user?.workshop) {
      setWorkshopCategories(getWorkshopCategories(user.workshop));
    }
  }, [user?.workshop]);

  // Borrow Form Fields
  const [borrowQty, setBorrowQty] = useState<number | ''>(1);
  const [borrowPurpose, setBorrowPurpose] = useState('');
  const [borrowReturnDate, setBorrowReturnDate] = useState('');
  const [borrowStartDate, setBorrowStartDate] = useState('');

  // ── Sub-tab untuk Halaman Pinjaman & Pengambilan (Tab 1: 'aktif' [Utama/Default], Tab 2: 'kelulusan') ──
  const [pinjamActiveSubTab, setPinjamActiveSubTab] = useState<'aktif' | 'kelulusan'>('aktif');

  // Transaction History Filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyJenis, setHistoryJenis] = useState('Semua');
  const [historyStatus, setHistoryStatus] = useState('Semua');
  const [historyTarikhRange, setHistoryTarikhRange] = useState('Semua Tarikh');
  const [historySort, setHistorySort] = useState('Terkini');

  // ── Sub-tab untuk Halaman Sejarah Transaksi (Tab 1: 'pinjaman' [Utama/Default], Tab 2: 'audit') ──
  const [historyActiveSubTab, setHistoryActiveSubTab] = useState<'pinjaman' | 'audit'>('pinjaman');

  // ── Paginasi: Had maksimum 10 rekod bagi setiap halaman ──
  const [historyPage, setHistoryPage] = useState(1);
  const [auditLogPage, setAuditLogPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setHistoryPage(1);
  }, [historySearch, historyJenis, historyStatus, historyTarikhRange, historySort]);

  useEffect(() => {
    setAuditLogPage(1);
  }, [auditLogFilter]);

  // ── Penjejak Waktu Pengguna Melihat Halaman Sejarah / Audit Log ──
  const auditLogStorageKey = user
    ? `kv_last_viewed_audit_log_${user.workshop}_${user.selectedStore}`
    : 'kv_last_viewed_audit_log_default';

  const [lastViewedAuditLog, setLastViewedAuditLog] = useState<number>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(auditLogStorageKey) : null;
    return saved ? Number(saved) : Date.now();
  });

  // Segerakkan lastViewedAuditLog jika pengguna menukar stor / login
  useEffect(() => {
    const saved = localStorage.getItem(auditLogStorageKey);
    if (saved) {
      setLastViewedAuditLog(Number(saved));
    } else {
      const now = Date.now();
      setLastViewedAuditLog(now);
      localStorage.setItem(auditLogStorageKey, String(now));
    }
  }, [auditLogStorageKey]);

  // Auto-clear / Mark as read apabila pengguna membuka atau melawat halaman 'sejarah'
  useEffect(() => {
    if (activeTab === 'sejarah') {
      const now = Date.now();
      setLastViewedAuditLog(now);
      localStorage.setItem(auditLogStorageKey, String(now));
    }
  }, [activeTab, auditLogStorageKey]);

  // Set Tab 1 ('aktif') sebagai tab utama/default setiap kali pengguna membuka halaman Pinjaman & Pengambilan
  useEffect(() => {
    if (activeTab === 'pinjam') {
      setPinjamActiveSubTab('aktif');
    }
  }, [activeTab]);

  if (!user || !user.selectedStore) return null;

  // STOR_INDUK: aggregate all sub-stores for this workshop (Ketua Bengkel only)
  const isStorInduk = user.selectedStore === STOR_INDUK;

  // Filter audit logs for the current store/workshop
  const storeAuditLogs = auditLogs.filter(
    l => l.workshop === user.workshop &&
         (isStorInduk || l.store === user.selectedStore || l.targetStore === user.selectedStore)
  );

  // Kira bilangan rekod baharu yang ditambah SELEPAS lastViewedAuditLog
  const unreadAuditLogsCount = storeAuditLogs.filter(l => {
    const logTime = l.createdAt || parseMsMyDate(l.timestamp).getTime();
    return logTime > lastViewedAuditLog;
  }).length;

  // Filter inventory items
  const filteredItems = items.filter((item) =>
    isStorInduk
      ? item.workshop === user.workshop
      : item.store === user.selectedStore && item.workshop === user.workshop
  );

  // Dynamic unique lists for filters
  const uniqueSkus = Array.from(new Set(filteredItems.map(item => item.sku).filter(Boolean))).sort();
  const uniqueSeksyens = Array.from(new Set(filteredItems.map(item => item.brand).filter(Boolean))).sort();
  const uniqueLocations = Array.from(new Set(filteredItems.map(item => item.location).filter(Boolean))).sort();

  const searchedItems = filteredItems.filter((item) => {
    // 1. Text Search
    const matchesSearch = searchTerm.trim() === '' ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.brand || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // 2. Jenis
    if (filterJenis !== 'Semua Jenis') {
      const typeStr = item.kategori === 'peralatan' ? 'PERALATAN' : 'BARANG LUAK';
      if (typeStr !== filterJenis) return false;
    }

    // 3. Kategori
    if (filterKategori !== 'Semua Kategori') {
      const skuPrefix = item.sku.split('-')[0].toUpperCase();
      if (skuPrefix !== filterKategori) return false;
    }

    // 4. Kod / SKU
    if (filterKod !== 'Semua Kod') {
      if (item.sku !== filterKod) return false;
    }

    // 5. Seksyen
    if (filterSeksyen !== 'Semua Seksyen') {
      if (item.brand !== filterSeksyen) return false;
    }

    // 6. Kedudukan
    if (filterKedudukan !== 'Semua Kedudukan') {
      if (item.location !== filterKedudukan) return false;
    }

    // 7. Status
    if (filterStatus !== 'Semua Status') {
      let currentStatus = 'Tersedia';
      if (item.quantity === 0) {
        currentStatus = 'Kehabisan Stok';
      } else if (item.quantity <= item.stokMinima) {
        currentStatus = 'Stok Rendah';
      }
      if (currentStatus !== filterStatus) return false;
    }

    // 8. Carian Huruf / Abjad
    if (filterAbjad !== 'Semua Abjad') {
      const firstChar = item.name.trim().charAt(0).toUpperCase();
      if (firstChar !== filterAbjad) return false;
    }

    return true;
  });

  // Filter transactions
  const filteredTransactions = transactions.filter((t) =>
    isStorInduk
      ? t.workshop === user.workshop
      : t.store === user.selectedStore && t.workshop === user.workshop
  );

  // Filter notifications
  const filteredNotifications = notifications.filter((n) =>
    isStorInduk
      ? n.workshop === user.workshop
      : n.store === user.selectedStore && n.workshop === user.workshop
  );

  // Calculate statistics
  const totalItemTypes = filteredItems.length;
  const totalItemCount = filteredItems.reduce((acc, item) => acc + item.quantity, 0);
  const totalBorrowedCount = filteredTransactions
    .filter((t) => t.status === 'Diluluskan')
    .reduce((acc, t) => acc + t.quantity, 0);
  const pendingApprovals = filteredTransactions.filter((t) => t.status === 'Menunggu Kelulusan');
  const lowStockItems = filteredItems.filter((item) => item.quantity <= item.stokMinima);
  const activeBorrows = filteredTransactions.filter((t) => t.status === 'Diluluskan');

  // Handlers
  const handleOpenAddModal = () => {
    setItemName('');
    setItemBrand('');
    setItemSku('');
    setItemQty(1);
    setItemLocation('');
    setItemKategori('peralatan');

    // Get default dynamic categories
    const cats = getWorkshopCategories(user.workshop);
    const firstCode = cats.length > 0 ? cats[0].code : 'AT';
    setItemKodKategori(firstCode);
    const secs = GLOBAL_SEKSYEN_MAP[firstCode] || ['ACCESSORIES', 'GENERAL'];
    setItemSeksyen(secs[0]);

    setItemUnit('unit');
    setItemStokMinima(5);

    // Populate existing racks for the select dropdown
    const racks = Array.from(new Set(filteredItems.map(item => item.location).filter(Boolean)));
    if (racks.length > 0) {
      setIsNewRack(false);
      setItemLocation(racks[0]);
    } else {
      setIsNewRack(true);
      setItemLocation('');
    }
    setNewRackName('');
    setIsAddModalOpen(true);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      alert('Sila isi Nama Barang.');
      return;
    }
    if (itemQty === '' || itemQty <= 0) {
      alert('Sila isi kuantiti mula yang sah.');
      return;
    }
    const finalLocation = isNewRack ? newRackName.trim() : itemLocation;
    if (!finalLocation) {
      alert('Sila tentukan kedudukan rak.');
      return;
    }
    // Auto-build SKU from kategori prefix if not provided
    const finalSku = itemSku.trim()
      ? itemSku.trim().toUpperCase()
      : `${itemKodKategori}-${Date.now().toString(36).toUpperCase().slice(-4)}`;

    addItem({
      name: itemName.trim(),
      brand: itemSeksyen || 'N/A', // SEKSYEN stored in brand field
      sku: finalSku,
      quantity: Number(itemQty),
      location: finalLocation,
      kategori: itemKategori,
      unit: (itemUnit ?? 'unit').trim() || 'unit',
      stokMinima: itemStokMinima === '' ? 0 : Number(itemStokMinima)
    });
    setIsAddModalOpen(false);
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setItemName(item.name);
    setItemBrand(item.brand);
    setItemSku(item.sku);
    setItemQty(item.quantity);
    setItemLocation(item.location);
    setItemKategori(item.kategori);
    setItemUnit(item.unit ?? 'unit');
    setItemStokMinima(item.stokMinima);

    // Derive kategori code from SKU prefix (e.g. "AT-001" → "AT")
    const cats = getWorkshopCategories(item.workshop);
    const ALL_KAT_CODES = cats.map(c => c.code);
    const skuPrefix = (item.sku || '').split('-')[0].toUpperCase();
    const derivedKodKat = ALL_KAT_CODES.includes(skuPrefix) ? skuPrefix : (ALL_KAT_CODES[0] || 'AT');
    setItemKodKategori(derivedKodKat);

    // brand field is re-used to store Seksyen value
    setItemSeksyen(item.brand || 'ACCESSORIES');

    const racks = Array.from(new Set(filteredItems.map(i => i.location).filter(Boolean)));
    if (racks.includes(item.location)) {
      setIsNewRack(false);
    } else {
      setIsNewRack(true);
      setNewRackName(item.location);
    }
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (!itemName.trim() || !itemSku.trim()) return;
    if (itemQty === '' || itemQty < 0) {
      alert('Sila isi kuantiti baki yang sah.');
      return;
    }

    const finalLocation = isNewRack ? newRackName.trim() : itemLocation;
    if (!finalLocation) {
      alert('Sila tentukan kedudukan rak.');
      return;
    }

    const newQty = Number(itemQty);
    const oldQty = selectedItem.quantity;
    updateItem({
      ...selectedItem,
      name: itemName.trim(),
      brand: (itemBrand ?? '').trim() || 'N/A',
      sku: itemSku.trim().toUpperCase(),
      quantity: newQty,
      totalQuantity: selectedItem.kategori === 'habis_pakai'
        ? newQty
        : newQty + (selectedItem.totalQuantity - selectedItem.quantity),
      location: finalLocation,
      kategori: itemKategori,
      unit: (itemUnit ?? 'unit').trim() || 'unit',
      stokMinima: itemStokMinima === '' ? 0 : Number(itemStokMinima)
    }, oldQty);
    setIsEditModalOpen(false);
    setSelectedItem(null);
  };

  const handleDeleteItem = (id: string) => {
    const itemName = items.find(i => i.id === id)?.name || 'barang ini';
    const catatan = window.prompt(`Adakah anda pasti mahu memadam "${itemName}"?\n\nMasukkan sebab pemadaman (pilihan):`);
    if (catatan === null) return; // user clicked Cancel
    deleteItem(id, catatan.trim() || undefined);
  };

  const handleExportExcel = () => {
    const rows = searchedItems.map((item, index) => {
      const skuPrefix = item.sku.split('-')[0].toUpperCase();
      const kategoriCode = skuPrefix || (item.kategori === 'peralatan' ? 'AT' : 'AK');
      
      let statusStr = 'Tersedia';
      if (item.quantity === 0) {
        statusStr = 'Kehabisan Stok';
      } else if (item.quantity <= item.stokMinima) {
        statusStr = 'Stok Rendah';
      }

      return {
        'BIL': index + 1,
        'NAMA ALATAN': item.name,
        'CATATAN / SUB': item.brand || 'N/A',
        'JENIS': item.kategori === 'peralatan' ? 'Peralatan' : 'Barang Luak',
        'KATEGORI': kategoriCode,
        'KOD ALATAN': item.sku,
        'SEKSYEN': item.brand || 'N/A',
        'KEDUDUKAN': item.location,
        'BAKI STOK': `${item.quantity} ${item.unit}`,
        'JUMLAH STOK': `${item.totalQuantity} ${item.unit}`,
        'STATUS': statusStr
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);

    const maxLens = Object.keys(rows[0] || {}).map(key => {
      const headerLen = key.length;
      const colValuesLen = rows.map(row => String((row as any)[key] || '').length);
      return Math.max(headerLen, ...colValuesLen);
    });
    worksheet['!cols'] = maxLens.map(len => ({ wch: Math.max(len + 3, 10) }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventori');

    const todayStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Laporan_Inventori_KV_${todayStr}.xlsx`);
  };

  const handleExportPDF = () => {
    if (searchedItems.length === 0) {
      alert('Tiada data inventori untuk dieksport berdasarkan penapis semasa.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const totalPagesExp = '{total_pages_count_string}';
    const today = new Date();
    const printDateStr = today.toLocaleDateString('ms-MY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }) + ' ' + today.toLocaleTimeString('ms-MY', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const dateFileStr = today.toISOString().split('T')[0];

    // ── 1. Kepala Surat (Header) ──
    let logoDrawn = false;
    if (orgSettings.logoUrl) {
      try {
        doc.addImage(orgSettings.logoUrl, 'PNG', 14, 10, 14, 14);
        logoDrawn = true;
      } catch {
        logoDrawn = false;
      }
    }
    if (!logoDrawn) {
      doc.setFillColor(79, 70, 229); // Indigo 600
      doc.roundedRect(14, 10, 14, 14, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('KV', 21, 19, { align: 'center' });
    }

    // Header Text
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(99, 102, 241);
    doc.text(`${(orgSettings.kvName || 'KOLEJ VOKASIONAL').toUpperCase()} • SISTEM PENGURUSAN INVENTORI & STOR`, 32, 14);

    doc.setFontSize(13.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Laporan Inventori Alatan & Stok - ${orgSettings.workshopName || user.workshop}`, 32, 20.5);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Stor: ${user.selectedStore}   |   Tarikh Cetakan: ${printDateStr}   |   Dijana Oleh: ${user.name} (${user.role})   |   Jumlah Rekod: ${searchedItems.length}`,
      32,
      25.5
    );

    // Divider Line
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(14, 28, 283, 28);

    // ── 2. Data Jadual ──
    const tableData = searchedItems.map((item, index) => {
      const jenisStr = item.kategori === 'peralatan' ? 'Peralatan' : 'Barang Luak';

      let statusStr = 'Tersedia';
      if (item.quantity === 0) {
        statusStr = 'Kehabisan Stok';
      } else if (item.quantity <= item.stokMinima) {
        statusStr = 'Stok Rendah';
      }

      return [
        index + 1,
        item.name,
        jenisStr,
        item.sku,
        item.brand || '—',
        item.location || '—',
        `${item.quantity} ${item.unit}`,
        statusStr,
      ];
    });

    // ── 3. Penjanaan Jadual (Landscape Table) ──
    autoTable(doc, {
      startY: 32,
      head: [['Bil', 'Nama Alatan', 'Kategori', 'Kod', 'Seksyen', 'Kedudukan', 'Baki Stok', 'Status']],
      body: tableData,
      margin: { left: 14, right: 14, bottom: 15 },
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59], // Dark Slate
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center',
        valign: 'middle',
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 41, 59],
        valign: 'middle',
        cellPadding: 2.2,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' }, // Bil
        1: { cellWidth: 72, halign: 'left' },   // Nama Alatan
        2: { cellWidth: 32, halign: 'center' }, // Kategori
        3: { cellWidth: 32, halign: 'center' }, // Kod
        4: { cellWidth: 32, halign: 'center' }, // Seksyen
        5: { cellWidth: 28, halign: 'center' }, // Kedudukan
        6: { cellWidth: 28, halign: 'center' }, // Baki Stok
        7: { cellWidth: 33, halign: 'center' }, // Status
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 7) {
          const status = String(data.cell.raw);
          if (status === 'Kehabisan Stok') {
            data.cell.styles.textColor = [220, 38, 38]; // Red
            data.cell.styles.fontStyle = 'bold';
          } else if (status === 'Stok Rendah') {
            data.cell.styles.textColor = [217, 119, 6]; // Amber
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [22, 163, 74]; // Green
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      didDrawPage: (data) => {
        // Footnote & Page Number
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text('Dokumen ini dijana secara automatik oleh Sistem Pengurusan Inventori & Stor KV.', 14, 203);
        doc.text(`Halaman ${data.pageNumber} daripada ${totalPagesExp}`, 283, 203, { align: 'right' });
      },
    });

    if (typeof doc.putTotalPages === 'function') {
      doc.putTotalPages(totalPagesExp);
    }

    const cleanWorkshopName = user.workshop.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Laporan_Inventori_${cleanWorkshopName}_${dateFileStr}.pdf`);
  };

  const handleOpenBorrowModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setBorrowQty(1);
    setBorrowPurpose('');
    
    // Default start date: today
    setBorrowStartDate(new Date().toISOString().split('T')[0]);
    
    // Default return date for equipment: 7 days from now
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setBorrowReturnDate(nextWeek.toISOString().split('T')[0]);
    setIsBorrowModalOpen(true);
  };

  const handleQuickBorrow = () => {
    const available = filteredItems.filter(i => i.quantity > 0);
    if (available.length === 0) {
      alert('Tiada barang dengan baki stok sedia ada untuk dipinjam atau diambil.');
      return;
    }
    handleOpenBorrowModal(available[0]);
  };

  const handleBorrowSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    const qty = Number(borrowQty);
    if (isNaN(qty) || qty <= 0) {
      alert('Kuantiti tidak sah.');
      return;
    }
    if (qty > selectedItem.quantity) {
      alert('Kuantiti dipinta melebihi baki stok sedia ada.');
      return;
    }
    if (!borrowPurpose.trim()) {
      alert('Sila nyatakan tujuan.');
      return;
    }
    if (!borrowStartDate) {
      alert(selectedItem.kategori === 'peralatan' ? 'Sila tentukan tarikh mahu pinjam.' : 'Sila tentukan tarikh mahu pakai.');
      return;
    }
    if (selectedItem.kategori === 'peralatan' && !borrowReturnDate) {
      alert('Sila tentukan tarikh jangka pulang.');
      return;
    }

    requestBorrow(
      selectedItem.id,
      qty,
      borrowPurpose.trim(),
      selectedItem.kategori === 'peralatan' ? borrowReturnDate : undefined,
      borrowStartDate
    );
    setIsBorrowModalOpen(false);
    setSelectedItem(null);
  };

  // Helper icons as SVG elements
  const iconHome = (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );

  const iconDownload = (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" x2="12" y1="15" y2="3"/>
    </svg>
  );

  const iconBox = (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );

  const iconSwap = (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  );

  const iconHistory = (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const iconBell = (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );

  const iconUsers = (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );

  const iconSettings = (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  return (
    <div className="dashboard-wrapper">
      {/* Mobile Drawer Backdrop Overlay */}
      <div
        className={`mobile-drawer-overlay ${isMobileMenuOpen ? 'active' : ''}`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar (Desktop Sticky & Mobile Slide-Over Drawer) */}
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-left">
            {orgSettings.logoUrl ? (
              <img
                src={orgSettings.logoUrl}
                alt="Logo KV"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--radius-sm)',
                  objectFit: 'contain',
                  background: 'rgba(255,255,255,0.05)',
                  padding: '2px',
                  flexShrink: 0
                }}
              />
            ) : (
              <div className="sidebar-logo">🏫</div>
            )}
            <div className="sidebar-title">KV Inventori</div>
          </div>
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={toggleSidebar}
            title={isSidebarCollapsed ? "Kembangkan Menu (Expand)" : "Kecilkan Menu (Collapse)"}
            aria-label="Toggle Sidebar"
          >
            {isSidebarCollapsed ? '❯' : '❮'}
          </button>
          {/* Mobile Drawer Close Button */}
          <button
            type="button"
            className="mobile-drawer-close-btn"
            onClick={() => setIsMobileMenuOpen(false)}
            title="Tutup Menu"
            aria-label="Tutup Menu"
          >
            ✕
          </button>
        </div>

        <ul className="sidebar-menu">
          <li className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}>
            <button onClick={() => navigateTab('dashboard')} title={isSidebarCollapsed ? 'Dashboard' : undefined}>
              {iconHome} <span className="sidebar-label">Dashboard</span>
            </button>
          </li>
          <li className={`sidebar-item ${activeTab === 'inventori' ? 'active' : ''}`}>
            <button onClick={() => navigateTab('inventori')} title={isSidebarCollapsed ? 'Inventori' : undefined}>
              {iconBox} <span className="sidebar-label">Inventori</span>
              <span className="tab-badge">{totalItemTypes}</span>
            </button>
          </li>
          <li className={`sidebar-item ${activeTab === 'pinjam' ? 'active' : ''}`}>
            <button
              onClick={() => {
                navigateTab('pinjam');
                setPinjamActiveSubTab('aktif');
              }}
              title={isSidebarCollapsed ? 'Pinjam & Ambil' : undefined}
            >
              {iconSwap} <span className="sidebar-label">Pinjam & Ambil</span>
              {pendingApprovals.length > 0 && (user.role === 'Ketua Bengkel' || user.role === 'PIC') && (
                <span className="tab-badge" style={{ backgroundColor: '#ef4444', color: '#fff' }}>
                  {pendingApprovals.length}
                </span>
              )}
            </button>
          </li>
          <li className={`sidebar-item ${activeTab === 'sejarah' ? 'active' : ''}`}>
            <button
              onClick={() => {
                navigateTab('sejarah');
                const now = Date.now();
                setLastViewedAuditLog(now);
                localStorage.setItem(auditLogStorageKey, String(now));
              }}
              title={isSidebarCollapsed ? 'Sejarah Transaksi' : undefined}
            >
              {iconHistory} <span className="sidebar-label">Sejarah Transaksi</span>
              {unreadAuditLogsCount > 0 && (
                <span className="tab-badge" style={{
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.68rem',
                  padding: '0.12rem 0.45rem',
                  borderRadius: '9999px',
                  boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)',
                  animation: 'pulse 2s infinite',
                }}>
                  +{unreadAuditLogsCount}
                </span>
              )}
            </button>
          </li>
          <li className={`sidebar-item ${activeTab === 'notifikasi' ? 'active' : ''}`}>
            <button onClick={() => navigateTab('notifikasi')} title={isSidebarCollapsed ? 'Notifikasi' : undefined}>
              {iconBell} <span className="sidebar-label">Notifikasi</span>
              {filteredNotifications.length > 0 && (
                <span className="tab-badge" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
                  {filteredNotifications.length}
                </span>
              )}
            </button>
          </li>
          {(user.role === 'Ketua Bengkel' || user.role === 'PIC') && (
            <li className={`sidebar-item ${activeTab === 'ahli' ? 'active' : ''}`}>
              <button onClick={() => navigateTab('ahli')} title={isSidebarCollapsed ? 'Ahli Bengkel' : undefined}>
                {iconUsers} <span className="sidebar-label">Ahli Bengkel</span>
              </button>
            </li>
          )}
          <li className={`sidebar-item ${activeTab === 'tetapan' ? 'active' : ''}`}>
            <button onClick={() => navigateTab('tetapan')} title={isSidebarCollapsed ? 'Tetapan' : undefined}>
              {iconSettings} <span className="sidebar-label">Tetapan</span>
            </button>
          </li>
        </ul>

        <div className="sidebar-user">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '1.5px solid var(--primary)',
                  flexShrink: 0
                }}
              />
            ) : (
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: '#ffffff',
                  flexShrink: 0
                }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-role-badge">{user.role}</span>
            </div>
          </div>
          <button
            id="logout-btn"
            onClick={() => {
              setIsMobileMenuOpen(false);
              logout();
            }}
            className="btn btn-secondary btn-logout"
            title="Keluar Sistem"
          >
            {isSidebarCollapsed ? '🚪' : 'Keluar Sistem'}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Mobile Topbar (Shown on tablets and phones) */}
        <div className="mobile-topbar">
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Buka Menu"
            title="Buka Menu Navigasi"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <div className="mobile-topbar-brand">
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span className="mobile-topbar-title">KV Inventori</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.workshop}
              </span>
            </div>
            <span className="mobile-topbar-store">{user.selectedStore}</span>
          </div>

          <button
            type="button"
            className="mobile-avatar-btn"
            onClick={() => navigateTab('tetapan')}
            title={`Profil: ${user.name}`}
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} />
            ) : (
              <span>{user.name.charAt(0).toUpperCase()}</span>
            )}
          </button>
        </div>
        {/* Header */}
        <header className="dashboard-header">
          <div className="header-title-section">
            <h2>
              {activeTab === 'dashboard'
                ? 'Ringkasan Stor'
                : activeTab === 'sejarah'
                ? 'Sejarah Transaksi'
                : activeTab === 'pinjam'
                ? 'Pinjaman & Pengambilan'
                : activeTab === 'ahli'
                ? `Pengurusan Ahli Bengkel - ${user.workshop}`
                : activeTab === 'tetapan'
                ? 'Tetapan Sistem & Profil'
                : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </h2>
            <p>{user.workshop} / {user.selectedStore}</p>
          </div>
          <div className="store-indicator">
            <div className="store-indicator-dot"></div>
            <span className="store-indicator-text">{user.selectedStore}</span>
            <button id="change-store-btn" onClick={() => selectStore('')} className="btn-change-store">
              Tukar Stor
            </button>
          </div>
        </header>

        {/* Tab contents */}
        {activeTab === 'dashboard' && (
          <>
            {/* ── 1. BAR TINDAKAN PANTAS (QUICK ACTION BAR) ── */}
            <div className="quick-action-bar" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              background: 'rgba(30, 41, 59, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '0.85rem 1.25rem',
              marginBottom: '1.25rem',
              flexWrap: 'wrap',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.25rem' }}>⚡</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>Tindakan Pantas</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Akses segera ke fungsi utama operasi stor</div>
                </div>
              </div>

              <div className="quick-action-buttons" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                {/* [ ⚡ Pinjam / Ambil Pantas ] */}
                <button
                  id="quick-borrow-btn"
                  onClick={handleQuickBorrow}
                  className="btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    background: 'linear-gradient(135deg, #06b6d4, #2563eb)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.5rem 1.15rem',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(6, 182, 212, 0.28)',
                    transition: 'all 0.15s ease',
                  }}
                  title="Buka borang pinjaman alatan atau pengambilan barang luak secara pantas"
                >
                  <span>⚡</span>
                  <span>Pinjam / Ambil Pantas</span>
                </button>

                {/* [ 📦 Tambah Stok Baru ] */}
                {(user.role === 'Ketua Bengkel' || user.role === 'PIC') && (
                  <button
                    id="quick-add-btn"
                    onClick={handleOpenAddModal}
                    className="btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '0.5rem 1.15rem',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(99, 102, 241, 0.28)',
                      transition: 'all 0.15s ease',
                    }}
                    title="Daftar alatan atau barang baru ke dalam stor"
                  >
                    <span>📦</span>
                    <span>Tambah Stok Baru</span>
                  </button>
                )}
              </div>
            </div>

            {/* ── 2. KAD KPI INTERAKTIF (KLIK UNTUK LIHAT / TAPIS) ── */}
            <div className="stats-grid">
              {/* Kad 1: Jenis Alatan / Barang */}
              <div
                className="stat-card glass-panel"
                onClick={() => {
                  setActiveTab('inventori');
                  setFilterStatus('Semua Status');
                }}
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(99, 102, 241, 0.15)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.borderColor = 'var(--card-border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                title="Klik untuk ke Halaman Inventori (Semua Barang)"
              >
                <div className="stat-header">
                  <span>Jenis Alatan / Barang</span>
                  <div className="stat-icon-wrapper" style={{ background: 'var(--primary-glow)', color: 'var(--primary)' }}>📦</div>
                </div>
                <div className="stat-value">{totalItemTypes}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <div className="stat-subtext" style={{ margin: 0 }}>{totalItemCount} unit baki stok</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>Inventori →</span>
                </div>
              </div>

              {/* Kad 2: Barang Dipinjam Aktif */}
              <div
                className="stat-card glass-panel"
                onClick={() => {
                  setActiveTab('pinjam');
                  setPinjamActiveSubTab('aktif');
                }}
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.5)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(6, 182, 212, 0.15)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.borderColor = 'var(--card-border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                title="Klik untuk ke Halaman Rekod Pinjaman Aktif"
              >
                <div className="stat-header">
                  <span>Barang Dipinjam Aktif</span>
                  <div className="stat-icon-wrapper" style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'var(--secondary)' }}>🔄</div>
                </div>
                <div className="stat-value">{totalBorrowedCount}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <div className="stat-subtext" style={{ margin: 0 }}>Peralatan di luar stor</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--secondary)', fontWeight: 600 }}>Rekod →</span>
                </div>
              </div>

              {/* Kad 3: Permohonan Baru */}
              <div
                className="stat-card glass-panel"
                onClick={() => {
                  setActiveTab('pinjam');
                  setPinjamActiveSubTab('kelulusan');
                }}
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.5)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(245, 158, 11, 0.15)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.borderColor = 'var(--card-border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                title="Klik untuk ke Halaman Permohonan Menunggu Kelulusan"
              >
                <div className="stat-header">
                  <span>Permohonan Baru</span>
                  <div className="stat-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>⏳</div>
                </div>
                <div className="stat-value" style={{ color: pendingApprovals.length > 0 ? 'var(--warning)' : 'inherit' }}>
                  {pendingApprovals.length}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <div className="stat-subtext" style={{ margin: 0 }}>Menunggu kelulusan</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 600 }}>Kelulusan →</span>
                </div>
              </div>

              {/* Kad 4: Stok Rendah (<= Had Minima) */}
              <div
                className="stat-card glass-panel"
                onClick={() => {
                  setActiveTab('inventori');
                  setFilterStatus('Stok Rendah');
                }}
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(239, 68, 68, 0.15)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.borderColor = 'var(--card-border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                title="Klik untuk melihat senarai barang Stok Rendah di Inventori"
              >
                <div className="stat-header">
                  <span>Stok Rendah (&le; Had Minima)</span>
                  <div className="stat-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>⚠️</div>
                </div>
                <div className="stat-value" style={{ color: lowStockItems.length > 0 ? 'var(--danger)' : 'inherit' }}>
                  {lowStockItems.length}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <div className="stat-subtext" style={{ margin: 0 }}>Perlu penambahan segera</div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600 }}>Tapis →</span>
                </div>
              </div>
            </div>

            {/* ── 3. STRUKTUR WIDGET BAWAH (SPLIT 2 KOLOM) ── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
              gap: '1.5rem',
              marginTop: '1.5rem',
            }}>
              {/* ── KOLOM KIRI: ⚠️ Stok Perlu Ditambah (Maksimum 5 barang) ── */}
              <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 className="section-title" style={{ margin: 0 }}>
                    <span>⚠️</span> Stok Perlu Ditambah
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: lowStockItems.length > 0 ? '#f87171' : 'var(--text-muted)', fontWeight: lowStockItems.length > 0 ? 700 : 400 }}>
                    {lowStockItems.length > 0 ? `${lowStockItems.length} item perlukan perhatian` : 'Semua stok mencukupi'}
                  </span>
                </div>

                {lowStockItems.length === 0 ? (
                  <div className="empty-state" style={{ padding: '2.5rem 1rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{ fontSize: '2.5rem' }}>✅</span>
                    <h4 style={{ margin: '0.5rem 0 0.25rem 0', color: 'var(--success)' }}>Semua Stok Mencukupi</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tiada alatan atau barang luak di bawah paras had stok minimum.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div className="table-container" style={{ flex: 1 }}>
                      <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            <th>Barang</th>
                            <th>Baki / Had Min</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Tindakan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lowStockItems.slice(0, 5).map((item) => (
                            <tr key={item.id}>
                              <td>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: '0.4rem', marginTop: '0.15rem' }}>
                                  <span>{item.sku}</span>
                                  <span>•</span>
                                  <span>{item.location}</span>
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 700, color: item.quantity === 0 ? '#ef4444' : '#f59e0b' }}>
                                  {item.quantity} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary)' }}>/ {item.totalQuantity} {item.unit}</span>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  Had Min: {item.stokMinima}
                                </div>
                              </td>
                              <td>
                                {item.quantity === 0 ? (
                                  <span className="badge-status out" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>Stok Habis</span>
                                ) : (
                                  <span className="badge-status low" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>Stok Rendah</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {(user.role === 'Ketua Bengkel' || user.role === 'PIC') ? (
                                  <button
                                    onClick={() => handleOpenEditModal(item)}
                                    className="btn btn-secondary"
                                    style={{
                                      padding: '0.35rem 0.7rem',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      borderColor: '#f59e0b',
                                      color: '#fbbf24',
                                      background: 'rgba(245, 158, 11, 0.1)',
                                      whiteSpace: 'nowrap',
                                    }}
                                    title="Kemaskini kuantiti baki stok ini"
                                  >
                                    ➕ Tambah Stok
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setActiveTab('inventori');
                                      setSearchTerm(item.name);
                                    }}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                                    title="Lihat barang di inventori"
                                  >
                                    🔍 Lihat
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {lowStockItems.length > 5 && (
                      <div style={{ textAlign: 'center', paddingTop: '1rem', marginTop: '0.75rem', borderTop: '1px solid var(--card-border)' }}>
                        <button
                          className="btn-change-store"
                          onClick={() => {
                            setActiveTab('inventori');
                            setFilterStatus('Stok Rendah');
                          }}
                        >
                          Lihat semua {lowStockItems.length} barang stok rendah →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── KOLOM KANAN: 📌 Pinjaman Aktif & Lewat (Maksimum 5 rekod) ── */}
              <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column' }}>
                {(() => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  // Susun pinjaman aktif: Letakkan pinjaman lewat di bahagian atas
                  const sortedActiveBorrows = [...activeBorrows].sort((a, b) => {
                    const aLate = a.kategori === 'peralatan' && a.tarikhJangkaPulang && a.tarikhJangkaPulang < todayStr ? 1 : 0;
                    const bLate = b.kategori === 'peralatan' && b.tarikhJangkaPulang && b.tarikhJangkaPulang < todayStr ? 1 : 0;
                    return bLate - aLate;
                  });
                  const lateLoansCount = activeBorrows.filter(
                    b => b.kategori === 'peralatan' && b.tarikhJangkaPulang && b.tarikhJangkaPulang < todayStr
                  ).length;
                  const displayedLoans = sortedActiveBorrows.slice(0, 5);

                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h3 className="section-title" style={{ margin: 0 }}>
                          <span>📌</span> Pinjaman Aktif & Lewat
                        </h3>
                        {lateLoansCount > 0 ? (
                          <span style={{
                            background: 'rgba(239, 68, 68, 0.18)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '9999px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
                            {lateLoansCount} LEWAT PULANG
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {activeBorrows.length} pinjaman aktif
                          </span>
                        )}
                      </div>

                      {activeBorrows.length === 0 ? (
                        <div className="empty-state" style={{ padding: '2.5rem 1rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <span style={{ fontSize: '2.5rem' }}>🔄</span>
                          <h4 style={{ margin: '0.5rem 0 0.25rem 0' }}>Tiada Pinjaman Aktif</h4>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Semua peralatan selamat berada di dalam stor ketika ini.</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <div className="table-container" style={{ flex: 1 }}>
                            <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                              <thead>
                                <tr>
                                  <th>Peminjam</th>
                                  <th>Peralatan</th>
                                  <th>Target Pulang</th>
                                  <th style={{ textAlign: 'right' }}>Tindakan</th>
                                </tr>
                              </thead>
                              <tbody>
                                {displayedLoans.map((loan) => {
                                  const itemUnit = items.find(i => i.id === loan.itemId)?.unit || 'unit';
                                  const isLate = loan.kategori === 'peralatan' && loan.tarikhJangkaPulang && loan.tarikhJangkaPulang < todayStr;
                                  return (
                                    <tr key={loan.id} style={{ background: isLate ? 'rgba(239, 68, 68, 0.07)' : 'transparent' }}>
                                      <td>
                                        <div style={{ fontWeight: 600, color: isLate ? '#f87171' : 'var(--text-primary)' }}>
                                          {loan.borrowerName}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                          {loan.borrowerRole}
                                        </div>
                                      </td>
                                      <td>
                                        <div style={{ fontWeight: 500 }}>{loan.itemName}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                          Kuantiti: <strong>{loan.quantity} {itemUnit}</strong>
                                        </div>
                                      </td>
                                      <td>
                                        {isLate ? (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                            <span style={{
                                              background: '#ef4444',
                                              color: '#ffffff',
                                              padding: '0.15rem 0.45rem',
                                              borderRadius: '4px',
                                              fontSize: '0.66rem',
                                              fontWeight: 800,
                                              width: 'fit-content',
                                            }}>
                                              🚨 LEWAT
                                            </span>
                                            <span style={{ fontSize: '0.74rem', color: '#f87171', fontWeight: 600 }}>
                                              {loan.tarikhJangkaPulang}
                                            </span>
                                          </div>
                                        ) : (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                            <span className="status-badge approved" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem', width: 'fit-content' }}>
                                              DIPINJAM
                                            </span>
                                            <span style={{ fontSize: '0.74rem', color: 'var(--warning)' }}>
                                              {loan.tarikhJangkaPulang || '-'}
                                            </span>
                                          </div>
                                        )}
                                      </td>
                                      <td style={{ textAlign: 'right' }}>
                                        {(user.name === loan.borrowerName || user.role === 'Ketua Bengkel' || user.role === 'PIC') ? (
                                          <button
                                            id={`dash-return-btn-${loan.id}`}
                                            onClick={() => returnItems(loan.id)}
                                            className="btn btn-secondary"
                                            style={{
                                              padding: '0.35rem 0.65rem',
                                              fontSize: '0.75rem',
                                              borderColor: isLate ? '#ef4444' : 'var(--primary)',
                                              color: isLate ? '#f87171' : '#a5b4fc',
                                              background: isLate ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                                            }}
                                            title="Pulangkan peralatan ini"
                                          >
                                            ↩ Pulang
                                          </button>
                                        ) : (
                                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          {activeBorrows.length > 5 && (
                            <div style={{ textAlign: 'center', paddingTop: '1rem', marginTop: '0.75rem', borderTop: '1px solid var(--card-border)' }}>
                              <button
                                className="btn-change-store"
                                onClick={() => {
                                  setActiveTab('pinjam');
                                  setPinjamActiveSubTab('aktif');
                                }}
                              >
                                Lihat semua {activeBorrows.length} rekod pinjaman →
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </>
        )}

        {activeTab === 'inventori' && (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div className="inventory-controls" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', width: '100%' }}>
                
                {/* Left side: Search Wrapper & Horizontal Filters */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexGrow: 1, flexWrap: 'wrap' }}>
                  <div className="search-wrapper" style={{ minWidth: '200px', maxWidth: '280px', flexGrow: 1 }}>
                    <span className="search-icon" style={{ fontSize: '0.85rem' }}>🔍</span>
                    <input
                      type="text"
                      placeholder="Cari barang..."
                      className="input-field search-input"
                      style={{ fontSize: '0.75rem', paddingLeft: '2.2rem', paddingTop: '0.4rem', paddingBottom: '0.4rem', height: 'auto' }}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  {/* 7 Dropdowns Penapis */}
                  <div className="filters-group-responsive" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    
                    {/* 1. Jenis */}
                    <select
                      className="filter-dropdown-select text-white rounded-lg focus:ring-1 focus:ring-blue-500 text-xs py-1.5 px-2 outline-none cursor-pointer"
                      style={{ minWidth: '100px' }}
                      value={filterJenis}
                      onChange={(e) => setFilterJenis(e.target.value)}
                    >
                      <option value="Semua Jenis">Semua Jenis</option>
                      <option value="PERALATAN">PERALATAN</option>
                      <option value="BARANG LUAK">BARANG LUAK</option>
                    </select>

                    {/* 2. Kategori */}
                    <select
                      className="filter-dropdown-select text-white rounded-lg focus:ring-1 focus:ring-blue-500 text-xs py-1.5 px-2 outline-none cursor-pointer"
                      style={{ minWidth: '195px' }}
                      value={filterKategori}
                      onChange={(e) => setFilterKategori(e.target.value)}
                    >
                      <option value="Semua Kategori" style={{ background: '#0f172a', color: '#f1f5f9' }}>Semua Kategori</option>
                      {workshopCategories.map(cat => (
                        <option key={cat.code} value={cat.code} style={{ background: '#0f172a', color: '#f1f5f9' }}>
                          {cat.code} — {cat.label}
                        </option>
                      ))}
                    </select>

                    {/* 3. Kod / SKU */}
                    <select
                      className="filter-dropdown-select text-white rounded-lg focus:ring-1 focus:ring-blue-500 text-xs py-1.5 px-2 outline-none cursor-pointer max-w-[120px]"
                      value={filterKod}
                      onChange={(e) => setFilterKod(e.target.value)}
                    >
                      <option value="Semua Kod">Semua Kod</option>
                      {uniqueSkus.map(sku => (
                        <option key={sku} value={sku}>{sku}</option>
                      ))}
                    </select>

                    {/* 4. Seksyen */}
                    <select
                      className="filter-dropdown-select text-white rounded-lg focus:ring-1 focus:ring-blue-500 text-xs py-1.5 px-2 outline-none cursor-pointer"
                      style={{ minWidth: '110px' }}
                      value={filterSeksyen}
                      onChange={(e) => setFilterSeksyen(e.target.value)}
                    >
                      <option value="Semua Seksyen">Semua Seksyen</option>
                      {uniqueSeksyens.map(sec => (
                        <option key={sec} value={sec}>{sec}</option>
                      ))}
                    </select>

                    {/* 5. Kedudukan */}
                    <select
                      className="filter-dropdown-select text-white rounded-lg focus:ring-1 focus:ring-blue-500 text-xs py-1.5 px-2 outline-none cursor-pointer"
                      style={{ minWidth: '110px' }}
                      value={filterKedudukan}
                      onChange={(e) => setFilterKedudukan(e.target.value)}
                    >
                      <option value="Semua Kedudukan">Semua Kedudukan</option>
                      {uniqueLocations.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>

                    {/* 6. Status */}
                    <select
                      className="filter-dropdown-select text-white rounded-lg focus:ring-1 focus:ring-blue-500 text-xs py-1.5 px-2 outline-none cursor-pointer"
                      style={{ minWidth: '110px' }}
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <option value="Semua Status">Semua Status</option>
                      <option value="Tersedia">Tersedia</option>
                      <option value="Stok Rendah">Stok Rendah</option>
                      <option value="Kehabisan Stok">Kehabisan Stok</option>
                    </select>

                    {/* 7. Carian Huruf / Abjad */}
                    <select
                      className="filter-dropdown-select text-white rounded-lg focus:ring-1 focus:ring-blue-500 text-xs py-1.5 px-2 outline-none cursor-pointer"
                      style={{ minWidth: '100px' }}
                      value={filterAbjad}
                      onChange={(e) => setFilterAbjad(e.target.value)}
                    >
                      <option value="Semua Abjad">Semua Abjad</option>
                      {Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).map(char => (
                        <option key={char} value={char}>{char}</option>
                      ))}
                    </select>

                    {/* Reset Button */}
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      title="Reset semua penapis"
                      style={{
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        backgroundColor: '#1e293b',
                        border: '1px solid #475569',
                        color: '#f8fafc',
                        borderRadius: '0.5rem',
                        fontSize: '0.75rem',
                        padding: '0.375rem 0.5rem',
                        transition: 'background-color 0.15s',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#334155')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#1e293b')}
                    >
                      🔄 Reset
                    </button>
                  </div>
                </div>

                {/* Right side: Action buttons */}
                {(user.role === 'Ketua Bengkel' || user.role === 'PIC') && (
                  <div className="inventory-actions-responsive" style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button
                      id="import-excel-btn"
                      onClick={() => setIsImportModalOpen(true)}
                      className="btn btn-outline"
                      title="Import barang dari fail Excel master list"
                      style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                    >
                      📂 Import Excel
                    </button>
                    <button
                      onClick={handleExportExcel}
                      title="Eksport senarai barang ke fail Excel"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        cursor: 'pointer',
                        backgroundColor: '#059669',
                        border: '1px solid #34d399',
                        color: '#ffffff',
                        borderRadius: '0.75rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '0.5rem 1rem',
                        boxShadow: '0 4px 15px rgba(5,150,105,0.35)',
                        transition: 'background-color 0.15s, transform 0.1s',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#10b981')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#059669')}
                      onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
                      onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                      {iconDownload}
                      <span>Eksport Excel</span>
                    </button>
                    {(user.role === 'Ketua Bengkel' || user.role === 'PIC') && (
                      <button
                        id="export-pdf-btn"
                        onClick={handleExportPDF}
                        title="Eksport senarai alatan & stok ke fail PDF (Landscape)"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          cursor: 'pointer',
                          backgroundColor: '#991b1b',
                          border: '1px solid #f87171',
                          color: '#ffffff',
                          borderRadius: '0.75rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '0.5rem 1rem',
                          boxShadow: '0 4px 15px rgba(185,28,28,0.35)',
                          transition: 'background-color 0.15s, transform 0.1s',
                          whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#dc2626')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#991b1b')}
                        onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
                        onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                      >
                        <span style={{ fontSize: '0.85rem' }}>📄</span>
                        <span>Eksport PDF</span>
                      </button>
                    )}
                    <button
                      id="add-item-btn"
                      onClick={handleOpenAddModal}
                      className="btn"
                      style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                    >
                      ✚ Tambah Barang Baru
                    </button>

                    {/* ── Permohonan Pindahan Button (Ketua Bengkel only) ── */}
                    {user.role === 'Ketua Bengkel' && (
                      <button
                        id="pending-transfer-btn"
                        onClick={() => {
                          setTransferModalInitialTab('senarai');
                          setSelectedItem(null);
                          setIsTransferModalOpen(true);
                        }}
                        title={pendingCount > 0 ? `${pendingCount} permohonan menunggu kelulusan` : 'Tiada permohonan pindahan'}
                        style={{
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          cursor: 'pointer',
                          backgroundColor: pendingCount > 0 ? '#451a03' : '#1e293b',
                          border: `1px solid ${pendingCount > 0 ? '#b45309' : '#334155'}`,
                          color: pendingCount > 0 ? '#fde68a' : '#64748b',
                          borderRadius: '0.75rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '0.5rem 0.85rem',
                          transition: 'all 0.15s',
                          whiteSpace: 'nowrap',
                          boxShadow: pendingCount > 0 ? '0 0 12px rgba(180,83,9,0.3)' : 'none',
                          opacity: pendingCount === 0 ? 0.7 : 1,
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.backgroundColor = pendingCount > 0 ? '#78350f' : '#334155';
                          e.currentTarget.style.color = pendingCount > 0 ? '#fef3c7' : '#94a3b8';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = pendingCount > 0 ? '#451a03' : '#1e293b';
                          e.currentTarget.style.color = pendingCount > 0 ? '#fde68a' : '#64748b';
                        }}
                      >
                        {/* Clock icon */}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                        </svg>
                        <span>Permohonan Pindahan</span>

                        {/* Animated badge */}
                        {pendingCount > 0 && (
                          <span
                            className="animate-pulse"
                            style={{
                              position: 'absolute',
                              top: '-7px',
                              right: '-7px',
                              minWidth: '18px',
                              height: '18px',
                              borderRadius: '999px',
                              background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                              color: '#fff',
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0 4px',
                              border: '2px solid #0f172a',
                              boxShadow: '0 0 8px rgba(239,68,68,0.7)',
                              animation: 'badgePulse 1.5s ease-in-out infinite',
                            }}
                          >
                            {pendingCount}
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                )}

              </div>
            </div>

            {searchedItems.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">🔍</span>
                <h4>Tiada hasil dijumpai</h4>
                <p>Cuba kata kunci carian yang lain atau daftarkan barang baru.</p>
              </div>
            ) : (
              <div className="table-container">
                <div className="table-scroll-hint">
                  <span>👈</span> Leret ke kiri/kanan untuk melihat semua maklumat <span>👉</span>
                </div>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th style={{ width: '48px', textAlign: 'center' }}>BIL</th>
                      <th>NAMA ALATAN</th>
                      <th>KATEGORI</th>
                      <th>KOD</th>
                      <th>SEKSYEN</th>
                      <th>KEDUDUKAN</th>
                      <th>BAKI STOK</th>
                      <th>STATUS</th>
                      <th style={{ textAlign: 'right' }}>TINDAKAN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchedItems.map((item, index) => {
                      // Derive category badge code from SKU prefix or kategori
                      const skuPrefix = item.sku.split('-')[0].toUpperCase();
                      const kategoriCode = skuPrefix || (item.kategori === 'peralatan' ? 'AT' : 'AK');
                      const badgeStyles = getCategoryBadgeStyles(kategoriCode);

                      return (
                        <tr key={item.id}>

                          {/* 1. BIL */}
                          <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                            {index + 1}
                          </td>

                          {/* 2. NAMA ALATAN */}
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{item.brand}</div>
                          </td>

                          {/* 3. KATEGORI badge */}
                          <td>
                            <span style={{
                              display: 'inline-block',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              letterSpacing: '0.04em',
                              padding: '0.22rem 0.55rem',
                              borderRadius: '6px',
                              background: badgeStyles.bg,
                              color: badgeStyles.color,
                              border: `1px solid ${badgeStyles.border}`,
                            }}>
                              {kategoriCode}
                            </span>
                          </td>

                          {/* 4. KOD (SKU) */}
                          <td>
                            <span className="sku-text" style={{ fontSize: '0.8rem' }}>{item.sku}</span>
                          </td>

                          {/* 5. SEKSYEN (brand field) */}
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            <span style={{
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              borderRadius: '6px',
                              padding: '0.2rem 0.5rem',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              letterSpacing: '0.03em',
                              textTransform: 'uppercase',
                            }}>
                              {item.brand}
                            </span>
                          </td>

                          {/* 6. KEDUDUKAN */}
                          <td>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              fontSize: '0.8rem',
                              color: 'var(--text-secondary)',
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.07)',
                              borderRadius: '6px',
                              padding: '0.2rem 0.5rem',
                            }}>
                              📍 {item.location}
                            </span>
                          </td>

                          {/* 7. BAKI STOK */}
                          <td>
                            <span style={{ fontWeight: 700, fontSize: '1rem', color: item.quantity === 0 ? 'var(--danger)' : item.quantity <= item.stokMinima ? 'var(--warning)' : 'var(--text-primary)' }}>
                              {item.quantity}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0 0.2rem' }}>
                              / {item.totalQuantity}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.unit}</span>
                          </td>

                          {/* 8. STATUS */}
                          <td>
                            {item.quantity === 0 ? (
                              <span className="badge-status out">Habis Stok</span>
                            ) : item.quantity <= item.stokMinima ? (
                              <span className="badge-status low" title={`Had minima: ${item.stokMinima}`}>Stok Rendah</span>
                            ) : (
                              <span className="badge-status available">Tersedia</span>
                            )}
                          </td>

                          {/* 9. TINDAKAN */}
                          <td style={{ textAlign: 'right' }}>
                            <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                              {user.role === 'Pensyarah' ? (
                                <button
                                  onClick={() => handleOpenBorrowModal(item)}
                                  className="btn"
                                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', background: item.kategori === 'peralatan' ? 'linear-gradient(135deg, var(--primary), var(--primary))' : 'linear-gradient(135deg, var(--secondary), var(--secondary))' }}
                                  disabled={item.quantity === 0}
                                >
                                  {item.kategori === 'peralatan' ? '🔀 Pinjam' : '🧪 Ambil'}
                                </button>
                              ) : (
                                <>
                                  {/* Pindah [ArrowRightLeft] */}
                                  <button
                                    onClick={() => {
                                      setSelectedItem(item);
                                      setIsTransferModalOpen(true);
                                    }}
                                    className="btn-icon"
                                    title="Pindah Stok ke Stor Lain"
                                    disabled={item.quantity === 0}
                                    style={{ color: '#a78bfa', borderColor: 'rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.08)' }}
                                  >
                                    ⇄
                                  </button>
                                  {/* Edit [Pencil] */}
                                  <button
                                    onClick={() => handleOpenEditModal(item)}
                                    className="btn-icon edit"
                                    title="Kemaskini"
                                  >
                                    ✏️
                                  </button>
                                  {/* Padam [Trash2] */}
                                  <button
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="btn-icon delete"
                                    title="Padam"
                                  >
                                    🗑️
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'pinjam' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* ── 2 Sub-Tabs Navigation (Tab 1: Rekod Pinjaman Aktif [Utama/Default], Tab 2: Permohonan Menunggu Kelulusan) ── */}
            <div className="loan-subtabs-responsive" style={{
              display: 'flex',
              gap: '0.6rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              paddingBottom: '0.75rem',
              marginBottom: '0.5rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}>
              {/* Tab 1: Rekod Pinjaman Aktif (Peralatan) (UTAMA / DEFAULT) */}
              <button
                onClick={() => setPinjamActiveSubTab('aktif')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 1.25rem',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  fontWeight: pinjamActiveSubTab === 'aktif' ? 700 : 500,
                  background: pinjamActiveSubTab === 'aktif' ? 'rgba(99, 102, 241, 0.22)' : 'rgba(30, 41, 59, 0.45)',
                  color: pinjamActiveSubTab === 'aktif' ? '#ffffff' : 'var(--text-secondary)',
                  border: pinjamActiveSubTab === 'aktif' ? '1px solid rgba(99, 102, 241, 0.65)' : '1px solid rgba(255, 255, 255, 0.06)',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  boxShadow: pinjamActiveSubTab === 'aktif' ? '0 0 16px rgba(99, 102, 241, 0.25)' : 'none',
                }}
              >
                <span>🔄</span>
                <span>Rekod Pinjaman Aktif (Peralatan)</span>
                <span style={{
                  background: pinjamActiveSubTab === 'aktif' ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  borderRadius: '6px',
                  padding: '0.1rem 0.45rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}>
                  [{activeBorrows.length}]
                </span>
              </button>

              {/* Tab 2: Permohonan Menunggu Kelulusan */}
              <button
                onClick={() => setPinjamActiveSubTab('kelulusan')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 1.25rem',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  fontWeight: pinjamActiveSubTab === 'kelulusan' ? 700 : 500,
                  background: pinjamActiveSubTab === 'kelulusan' ? 'rgba(99, 102, 241, 0.22)' : 'rgba(30, 41, 59, 0.45)',
                  color: pinjamActiveSubTab === 'kelulusan' ? '#ffffff' : 'var(--text-secondary)',
                  border: pinjamActiveSubTab === 'kelulusan'
                    ? (pendingApprovals.length > 0 ? '1px solid rgba(239, 68, 68, 0.65)' : '1px solid rgba(99, 102, 241, 0.65)')
                    : '1px solid rgba(255, 255, 255, 0.06)',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  boxShadow: pinjamActiveSubTab === 'kelulusan'
                    ? (pendingApprovals.length > 0 ? '0 0 16px rgba(239, 68, 68, 0.25)' : '0 0 16px rgba(99, 102, 241, 0.25)')
                    : 'none',
                }}
              >
                <span>⏳</span>
                <span>Permohonan Menunggu Kelulusan</span>
                <span style={{
                  background: pendingApprovals.length > 0 ? '#ef4444' : (pinjamActiveSubTab === 'kelulusan' ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.1)'),
                  color: '#ffffff',
                  borderRadius: '6px',
                  padding: '0.1rem 0.45rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}>
                  [{pendingApprovals.length}]
                </span>
                {pendingApprovals.length > 0 && (
                  <span
                    title={`${pendingApprovals.length} permohonan menunggu kelulusan`}
                    style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#ef4444',
                      boxShadow: '0 0 8px #ef4444',
                    }}
                  />
                )}
              </button>
            </div>

            {/* ── TAB 1: Rekod Pinjaman Aktif (Peralatan) (DEFAULT / UTAMA) ── */}
            {pinjamActiveSubTab === 'aktif' && (
              <div className="glass-panel" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 className="section-title" style={{ margin: 0 }}>🔄 Rekod Pinjaman Aktif (Peralatan)</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Jumlah pinjaman aktif: <strong style={{ color: '#e2e8f0' }}>{activeBorrows.length}</strong> rekod
                  </span>
                </div>
                {activeBorrows.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>Tiada peralatan yang sedang dipinjam ketika ini.</p>
                ) : (
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Peminjam</th>
                          <th>Nama Peralatan</th>
                          <th>Kuantiti</th>
                          <th>Tarikh Pinjam</th>
                          <th>Target Pulang</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Tindakan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeBorrows.map((loan) => {
                          const itemUnit = items.find(i => i.id === loan.itemId)?.unit || 'unit';
                          return (
                            <tr key={loan.id}>
                              <td style={{ fontWeight: 600 }}>{loan.borrowerName} ({loan.borrowerRole})</td>
                              <td>{loan.itemName}</td>
                              <td>{loan.quantity} {itemUnit}</td>
                              <td>{loan.dateBorrowed}</td>
                              <td style={{ color: 'var(--warning)', fontWeight: 500 }}>{loan.tarikhJangkaPulang || '-'}</td>
                              <td><span className="status-badge approved">Diluluskan</span></td>
                              <td style={{ textAlign: 'right' }}>
                                {(user.name === loan.borrowerName || user.role === 'Ketua Bengkel' || user.role === 'PIC') ? (
                                  <button
                                    id={`return-btn-${loan.id}`}
                                    onClick={() => returnItems(loan.id)}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', borderColor: 'var(--primary)', color: '#a5b4fc' }}
                                  >
                                    ↩ Pulangkan
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tiada Tindakan</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 2: Permohonan Menunggu Kelulusan ── */}
            {pinjamActiveSubTab === 'kelulusan' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Ketua Bengkel & PIC View: Approve / Reject Requests */}
                {(user.role === 'Ketua Bengkel' || user.role === 'PIC') && (
                  <div className="glass-panel" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <h3 className="section-title" style={{ margin: 0 }}>⏳ Pengesahan & Kelulusan Stor</h3>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Menunggu tindakan: <strong style={{ color: pendingApprovals.length > 0 ? '#f87171' : '#e2e8f0' }}>{pendingApprovals.length}</strong> permohonan
                      </span>
                    </div>
                    {pendingApprovals.length === 0 ? (
                      <div className="empty-state">
                        <span style={{ fontSize: '3rem' }}>✓</span>
                        <h4>Tiada Permohonan Menunggu Kelulusan</h4>
                        <p>Semua permohonan telah diproses sepenuhnya.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
                        {pendingApprovals.map((loan) => {
                          const itemUnit = items.find(i => i.id === loan.itemId)?.unit || 'unit';
                          return (
                            <div key={loan.id} className="loan-card" style={{ borderTop: loan.kategori === 'peralatan' ? '4px solid var(--primary)' : '4px solid var(--secondary)' }}>
                              <div className="loan-meta">
                                <span className="loan-borrower">👤 Peminjam: {loan.borrowerName}</span>
                                <span className="loan-date">{loan.dateBorrowed}</span>
                              </div>
                              <div className="loan-details">
                                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, color: loan.kategori === 'peralatan' ? '#a5b4fc' : '#22d3ee' }}>
                                  {loan.kategori === 'peralatan' ? '🔧 Pinjaman Peralatan' : '🧪 Pengambilan Barang Luak'}
                                </span>
                                <h4 style={{ margin: '0.25rem 0' }}>{loan.itemName}</h4>
                                <p>Kuantiti dipinta: <strong style={{ color: loan.kategori === 'peralatan' ? 'var(--primary)' : 'var(--secondary)' }}>{loan.quantity} {itemUnit}</strong></p>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                  {loan.kategori === 'peralatan' ? 'Tarikh Mahu Pinjam: ' : 'Tarikh Mahu Pakai: '}
                                  <strong style={{ color: 'var(--text-primary)' }}>{loan.tarikhMahuPinjam || '-'}</strong>
                                </p>
                                {loan.kategori === 'peralatan' && (
                                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                    Target Pulang: <strong style={{ color: 'var(--warning)' }}>{loan.tarikhJangkaPulang}</strong>
                                  </p>
                                )}
                                <p className="loan-purpose">Tujuan: &ldquo;{loan.purpose}&rdquo;</p>
                              </div>
                              <div className="loan-actions">
                                <button
                                  id={`approve-btn-${loan.id}`}
                                  onClick={() => approveTransaction(loan.id)}
                                  className="btn"
                                  style={{ flexGrow: 1, backgroundColor: 'var(--success)' }}
                                >
                                  Luluskan
                                </button>
                                <button
                                  id={`reject-btn-${loan.id}`}
                                  onClick={() => rejectTransaction(loan.id)}
                                  className="btn btn-danger"
                                  style={{ flexGrow: 1 }}
                                >
                                  Tolak
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Pensyarah View: Permohonan Alatan & Barang Luak */}
                {user.role === 'Pensyarah' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Status Permohonan Semasa Pensyarah yang Menunggu Kelulusan */}
                    {pendingApprovals.filter(l => l.borrowerName === user.name).length > 0 && (
                      <div className="glass-panel" style={{ padding: '2rem' }}>
                        <h3 className="section-title">⏳ Permohonan Anda Menunggu Kelulusan</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                          {pendingApprovals.filter(l => l.borrowerName === user.name).map((loan) => {
                            const itemUnit = items.find(i => i.id === loan.itemId)?.unit || 'unit';
                            return (
                              <div key={loan.id} className="loan-card" style={{ borderLeft: loan.kategori === 'peralatan' ? '4px solid var(--primary)' : '4px solid var(--secondary)' }}>
                                <div className="loan-meta">
                                  <span className="loan-date">{loan.dateBorrowed}</span>
                                  <span className="status-badge pending">Menunggu Kelulusan</span>
                                </div>
                                <div className="loan-details">
                                  <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, color: loan.kategori === 'peralatan' ? '#a5b4fc' : '#22d3ee' }}>
                                    {loan.kategori === 'peralatan' ? '🔧 Pinjaman Peralatan' : '🧪 Pengambilan Barang Luak'}
                                  </span>
                                  <h4 style={{ margin: '0.25rem 0' }}>{loan.itemName}</h4>
                                  <p>Kuantiti dipinta: <strong>{loan.quantity} {itemUnit}</strong></p>
                                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {loan.kategori === 'peralatan' ? 'Tarikh Mahu Pinjam: ' : 'Tarikh Mahu Pakai: '}
                                    <strong style={{ color: 'var(--text-primary)' }}>{loan.tarikhMahuPinjam || '-'}</strong>
                                  </p>
                                  {loan.kategori === 'peralatan' && (
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                      Target Pulang: <strong style={{ color: 'var(--warning)' }}>{loan.tarikhJangkaPulang}</strong>
                                    </p>
                                  )}
                                  <p className="loan-purpose">Tujuan: &ldquo;{loan.purpose}&rdquo;</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="glass-panel" style={{ padding: '2rem' }}>
                      <h3 className="section-title">🔀 Permohonan Alatan & Barang Luak</h3>
                      {filteredItems.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)' }}>Tiada barang didaftarkan dalam stor ini untuk dipinjam/diambil.</p>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                          {filteredItems.map(item => (
                            <div key={item.id} className="loan-card" style={{ borderLeft: item.kategori === 'peralatan' ? '4px solid var(--primary)' : '4px solid var(--secondary)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <span className="sku-text">{item.sku}</span>
                                  <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem', fontWeight: 600, color: item.kategori === 'peralatan' ? '#a5b4fc' : '#22d3ee' }}>
                                    {item.kategori === 'peralatan' ? '🔧 Peralatan' : '🧪 Barang Luak'}
                                  </span>
                                  <h4 style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '1.1rem' }}>{item.name}</h4>
                                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Baki Stok: <strong>{item.quantity}</strong> {item.unit}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleOpenBorrowModal(item)}
                                className="btn"
                                style={{ width: '100%', padding: '0.5rem', fontSize: '0.9rem', background: item.kategori === 'peralatan' ? '' : 'linear-gradient(135deg, var(--secondary), var(--secondary))' }}
                                disabled={item.quantity === 0}
                              >
                                {item.kategori === 'peralatan' ? 'Isi Borang Pinjam' : 'Borang Pengambilan'}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'sejarah' && (() => {
          // ── Helper render bar paginasi ──
          const renderPaginationBar = (
            currentPage: number,
            totalPages: number,
            totalItems: number,
            onPageChange: (p: number) => void
          ) => {
            if (totalItems <= ITEMS_PER_PAGE) return null;

            const startIdx = (currentPage - 1) * ITEMS_PER_PAGE + 1;
            const endIdx = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

            const getPageNumbers = () => {
              const pages: (number | string)[] = [];
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                if (currentPage > 3) pages.push('...');
                const start = Math.max(2, currentPage - 1);
                const end = Math.min(totalPages - 1, currentPage + 1);
                for (let i = start; i <= end; i++) pages.push(i);
                if (currentPage < totalPages - 2) pages.push('...');
                pages.push(totalPages);
              }
              return pages;
            };

            return (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '1.25rem',
                paddingTop: '1rem',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Menunjukkan <strong style={{ color: '#e2e8f0' }}>{startIdx}</strong> - <strong style={{ color: '#e2e8f0' }}>{endIdx}</strong> daripada <strong style={{ color: '#e2e8f0' }}>{totalItems}</strong> rekod
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <button
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.78rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(30,41,59,0.7)',
                      color: currentPage === 1 ? 'rgba(148,163,184,0.4)' : '#e2e8f0',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    ← Sebelumnya
                  </button>

                  {getPageNumbers().map((p, idx) => {
                    if (p === '...') {
                      return (
                        <span key={`gap-${idx}`} style={{ color: 'var(--text-muted)', padding: '0 0.25rem', fontSize: '0.78rem' }}>
                          ...
                        </span>
                      );
                    }
                    const pageNum = p as number;
                    const isActive = currentPage === pageNum;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => onPageChange(pageNum)}
                        style={{
                          padding: '0.35rem 0.65rem',
                          fontSize: '0.78rem',
                          fontWeight: isActive ? 700 : 500,
                          borderRadius: '6px',
                          border: isActive ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                          background: isActive ? '#6366f1' : 'rgba(30,41,59,0.7)',
                          color: isActive ? '#ffffff' : '#94a3b8',
                          cursor: 'pointer',
                          minWidth: '2.1rem',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.78rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(30,41,59,0.7)',
                      color: currentPage === totalPages ? 'rgba(148,163,184,0.4)' : '#e2e8f0',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Seterusnya →
                  </button>
                </div>
              </div>
            );
          };

          // ── Data Audit Log ──
          const storeAuditLogs = auditLogs.filter(
            l => l.workshop === user.workshop &&
                 (isStorInduk || l.store === user.selectedStore || l.targetStore === user.selectedStore)
          );

          const filteredAuditLogs = auditLogFilter === 'Semua'
            ? storeAuditLogs
            : storeAuditLogs.filter(l => l.type === auditLogFilter);

          // Susun Audit Log: Terkini di atas (Descending)
          const sortedAuditLogs = [...filteredAuditLogs].sort((a, b) => {
            const timeA = a.createdAt || parseMsMyDate(a.timestamp).getTime();
            const timeB = b.createdAt || parseMsMyDate(b.timestamp).getTime();
            return timeB - timeA;
          });

          // Paginasi Audit Log (10 rekod per halaman)
          const totalAuditPages = Math.ceil(sortedAuditLogs.length / ITEMS_PER_PAGE) || 1;
          const currentAuditPage = Math.min(auditLogPage, totalAuditPages);
          const startAuditIdx = (currentAuditPage - 1) * ITEMS_PER_PAGE;
          const paginatedAuditLogs = sortedAuditLogs.slice(startAuditIdx, startAuditIdx + ITEMS_PER_PAGE);

          const BADGE_CONFIG: Record<string, { label: string; bg: string; color: string; border: string; activeBg: string; icon: string }> = {
            TAMBAH:   { label: 'TAMBAH',    bg: 'rgba(16,185,129,0.08)',  color: '#34d399', border: 'rgba(16,185,129,0.25)',  activeBg: 'rgba(16,185,129,0.22)',  icon: '➕' },
            KEMASKINI:{ label: 'KEMASKINI', bg: 'rgba(99,102,241,0.08)',  color: '#818cf8', border: 'rgba(99,102,241,0.25)',  activeBg: 'rgba(99,102,241,0.22)',  icon: '✏️' },
            PADAM:    { label: 'PADAM',     bg: 'rgba(239,68,68,0.08)',   color: '#f87171', border: 'rgba(239,68,68,0.25)',   activeBg: 'rgba(239,68,68,0.22)',   icon: '🗑️' },
            PINDAH:   { label: 'PINDAH',    bg: 'rgba(245,158,11,0.08)',  color: '#fbbf24', border: 'rgba(245,158,11,0.25)',  activeBg: 'rgba(245,158,11,0.22)',  icon: '⇄' },
          };

          const countByType: Record<string, number> = { TAMBAH: 0, KEMASKINI: 0, PADAM: 0, PINDAH: 0 };
          storeAuditLogs.forEach(l => { if (countByType[l.type] !== undefined) countByType[l.type]++; });

          // ── Data Sejarah Pinjaman & Pemulangan ──
          const getStatusLabel = (t: any) => {
            const todayStr = new Date().toISOString().split('T')[0];
            if (t.kategori === 'habis_pakai' || t.status === 'Telah Diambil') return 'DIAMBIL (HABIS)';
            const isLate = t.kategori === 'peralatan' && t.status === 'Diluluskan' && t.tarikhJangkaPulang && t.tarikhJangkaPulang < todayStr;
            if (isLate) return 'LAMBAT PULANG';
            if (t.status === 'Diluluskan') return 'DIPINJAM';
            if (t.status === 'Telah Dipulangkan') return 'PULANG';
            return t.status;
          };

          const txList = filteredTransactions.filter(t => {
            if (historySearch) {
              const term = historySearch.toLowerCase();
              const matchesSearch = t.borrowerName.toLowerCase().includes(term) || t.itemName.toLowerCase().includes(term);
              if (!matchesSearch) return false;
            }
            if (historyJenis !== 'Semua') {
              if (historyJenis === 'Peralatan' && t.kategori !== 'peralatan') return false;
              if (historyJenis === 'Barang Luak' && t.kategori !== 'habis_pakai') return false;
            }
            if (historyStatus !== 'Semua') {
              const sLabel = getStatusLabel(t);
              if (historyStatus === 'DIPINJAM' && sLabel !== 'DIPINJAM') return false;
              if (historyStatus === 'PULANG' && sLabel !== 'PULANG') return false;
              if (historyStatus === 'LAMBAT PULANG' && sLabel !== 'LAMBAT PULANG') return false;
              if (historyStatus === 'DIAMBIL (HABIS)' && sLabel !== 'DIAMBIL (HABIS)') return false;
            }
            if (historyTarikhRange !== 'Semua Tarikh') {
              const daysLimit = Number(historyTarikhRange);
              if (!isNaN(daysLimit)) {
                const now = new Date();
                const txDate = parseMsMyDate(t.dateBorrowed);
                const diffTime = Math.abs(now.getTime() - txDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays > daysLimit) return false;
              }
            }
            return true;
          });

          // Susun Sejarah Pinjaman: Lalai Terkini (Descending)
          const sortedTxList = [...txList].sort((a, b) => {
            if (historySort === 'Terlama') {
              return parseMsMyDate(a.dateBorrowed).getTime() - parseMsMyDate(b.dateBorrowed).getTime();
            }
            if (historySort === 'A-Z') {
              return a.itemName.localeCompare(b.itemName);
            }
            // Terkini (Lalai / Descending)
            return parseMsMyDate(b.dateBorrowed).getTime() - parseMsMyDate(a.dateBorrowed).getTime();
          });

          // Paginasi Sejarah Pinjaman (10 rekod per halaman)
          const totalTxPages = Math.ceil(sortedTxList.length / ITEMS_PER_PAGE) || 1;
          const currentTxPage = Math.min(historyPage, totalTxPages);
          const startTxIdx = (currentTxPage - 1) * ITEMS_PER_PAGE;
          const paginatedTxList = sortedTxList.slice(startTxIdx, startTxIdx + ITEMS_PER_PAGE);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* ── 2 Sub-Tabs Navigation (Tab 1: Pinjaman & Pemulangan [Utama], Tab 2: Audit Log) ── */}
              <div style={{
                display: 'flex',
                gap: '0.6rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: '0.75rem',
                marginBottom: '0.5rem',
                flexWrap: 'wrap',
              }}>
                {/* Tab 1: Sejarah Pinjaman & Pemulangan (UTAMA / DEFAULT) */}
                <button
                  onClick={() => setHistoryActiveSubTab('pinjaman')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.55rem 1.25rem',
                    borderRadius: '8px',
                    fontSize: '0.88rem',
                    fontWeight: historyActiveSubTab === 'pinjaman' ? 700 : 500,
                    background: historyActiveSubTab === 'pinjaman' ? 'rgba(99, 102, 241, 0.22)' : 'rgba(30, 41, 59, 0.45)',
                    color: historyActiveSubTab === 'pinjaman' ? '#ffffff' : 'var(--text-secondary)',
                    border: historyActiveSubTab === 'pinjaman' ? '1px solid rgba(99, 102, 241, 0.65)' : '1px solid rgba(255, 255, 255, 0.06)',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: historyActiveSubTab === 'pinjaman' ? '0 0 16px rgba(99, 102, 241, 0.25)' : 'none',
                  }}
                >
                  <span>📋</span> Sejarah Pinjaman & Pemulangan
                </button>

                {/* Tab 2: Audit Log Inventori Stor */}
                <button
                  onClick={() => setHistoryActiveSubTab('audit')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.55rem 1.25rem',
                    borderRadius: '8px',
                    fontSize: '0.88rem',
                    fontWeight: historyActiveSubTab === 'audit' ? 700 : 500,
                    background: historyActiveSubTab === 'audit' ? 'rgba(99, 102, 241, 0.22)' : 'rgba(30, 41, 59, 0.45)',
                    color: historyActiveSubTab === 'audit' ? '#ffffff' : 'var(--text-secondary)',
                    border: historyActiveSubTab === 'audit' ? '1px solid rgba(99, 102, 241, 0.65)' : '1px solid rgba(255, 255, 255, 0.06)',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: historyActiveSubTab === 'audit' ? '0 0 16px rgba(99, 102, 241, 0.25)' : 'none',
                  }}
                >
                  <span>📜</span> Audit Log Inventori Stor
                  {unreadAuditLogsCount > 0 && (
                    <span style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      borderRadius: '9999px',
                      padding: '0.1rem 0.45rem',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      animation: 'pulse 2s infinite',
                    }}>
                      +{unreadAuditLogsCount}
                    </span>
                  )}
                </button>
              </div>

              {/* ══════════════════════════════════════════════════════════════════════
                  TAB 1: SEJARAH PINJAMAN & PEMULANGAN (UTAMA / DEFAULT)
              ══════════════════════════════════════════════════════════════════════ */}
              {historyActiveSubTab === 'pinjaman' && (
                <div className="glass-panel" style={{ padding: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <h3 className="section-title" style={{ margin: 0 }}>📋 Sejarah Pinjaman & Pemulangan</h3>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                        Menunjukkan rekod transaksi pinjaman alatan dan pengambilan barang luak di stor semasa.
                      </p>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {sortedTxList.length} transaksi dijumpai
                    </span>
                  </div>

                  {/* ── Filters Bar ── */}
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    padding: '0.65rem 1rem',
                    background: 'rgba(15,23,42,0.4)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '10px',
                    marginBottom: '1.25rem',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}>
                    {/* Search Text */}
                    <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '150px' }}>
                      <span style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', opacity: 0.5 }}>🔍</span>
                      <input
                        type="text"
                        placeholder="Cari peminjam / barang..."
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        style={{
                          width: '100%',
                          paddingLeft: '1.6rem',
                          paddingRight: '0.5rem',
                          paddingTop: '0.35rem',
                          paddingBottom: '0.35rem',
                          background: 'rgba(30,41,59,0.9)',
                          border: '1px solid rgba(100,116,139,0.35)',
                          borderRadius: 6,
                          color: '#e2e8f0',
                          fontSize: '0.75rem',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    {/* Filter Jenis */}
                    <select
                      className="filter-dropdown-select text-white rounded-lg focus:ring-1 focus:ring-blue-500 text-xs py-1.5 px-2 outline-none cursor-pointer"
                      value={historyJenis}
                      onChange={(e) => setHistoryJenis(e.target.value)}
                      style={{ minWidth: '110px', background: '#0f172a' }}
                    >
                      <option value="Semua">Semua Jenis</option>
                      <option value="Peralatan">🔧 Peralatan</option>
                      <option value="Barang Luak">🧪 Barang Luak</option>
                    </select>

                    {/* Filter Status */}
                    <select
                      className="filter-dropdown-select text-white rounded-lg focus:ring-1 focus:ring-blue-500 text-xs py-1.5 px-2 outline-none cursor-pointer"
                      value={historyStatus}
                      onChange={(e) => setHistoryStatus(e.target.value)}
                      style={{ minWidth: '130px', background: '#0f172a' }}
                    >
                      <option value="Semua">Semua Status</option>
                      <option value="DIPINJAM">DIPINJAM</option>
                      <option value="PULANG">PULANG</option>
                      <option value="LAMBAT PULANG">LAMBAT PULANG</option>
                      <option value="DIAMBIL (HABIS)">DIAMBIL (HABIS)</option>
                    </select>

                    {/* Filter Tarikh */}
                    <select
                      className="filter-dropdown-select text-white rounded-lg focus:ring-1 focus:ring-blue-500 text-xs py-1.5 px-2 outline-none cursor-pointer"
                      value={historyTarikhRange}
                      onChange={(e) => setHistoryTarikhRange(e.target.value)}
                      style={{ minWidth: '120px', background: '#0f172a' }}
                    >
                      <option value="Semua Tarikh">Semua Tarikh</option>
                      <option value="30">30 Hari Terakhir</option>
                      <option value="60">60 Hari Terakhir</option>
                      <option value="90">90 Hari Terakhir</option>
                    </select>

                    {/* Sort */}
                    <select
                      className="filter-dropdown-select text-white rounded-lg focus:ring-1 focus:ring-blue-500 text-xs py-1.5 px-2 outline-none cursor-pointer"
                      value={historySort}
                      onChange={(e) => setHistorySort(e.target.value)}
                      style={{ minWidth: '110px', background: '#0f172a' }}
                    >
                      <option value="Terkini">⏰ Terkini</option>
                      <option value="Terlama">⏰ Terlama</option>
                      <option value="A-Z">🔤 Nama A-Z</option>
                    </select>
                  </div>

                  {sortedTxList.length === 0 ? (
                    <div className="empty-state">
                      <span className="empty-icon">📁</span>
                      <h4>Tiada Rekod Transaksi</h4>
                      <p>Tiada rekod pinjaman atau pengambilan yang sepadan dengan penapis semasa.</p>
                    </div>
                  ) : (
                    <>
                      <div className="table-container">
                        <table className="custom-table">
                          <thead>
                            <tr>
                              <th>1. PEMINJAM / PENGAMBIL</th>
                              <th>2. BARANG</th>
                              <th>3. JENIS</th>
                              <th>4. KUANTITI</th>
                              <th>5. TARIKH PINJAM / AMBIL</th>
                              <th>6. TARIKH PULANG</th>
                              <th>7. STATUS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedTxList.map((t) => {
                              const itemUnit = items.find(i => i.id === t.itemId)?.unit || 'unit';
                              const sLabel = getStatusLabel(t);

                              return (
                                <tr key={t.id}>
                                  {/* 1. PEMINJAM / PENGAMBIL */}
                                  <td>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.borrowerName}</div>
                                    <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>{t.borrowerRole}</div>
                                    {t.purpose && (
                                      <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.15rem' }}>
                                        Catatan: &ldquo;{t.purpose}&rdquo;
                                      </div>
                                    )}
                                  </td>

                                  {/* 2. BARANG */}
                                  <td style={{ fontWeight: 600 }}>{t.itemName}</td>

                                  {/* 3. JENIS */}
                                  <td>
                                    {t.kategori === 'peralatan' ? (
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                        fontSize: '0.7rem', fontWeight: 700,
                                        background: 'rgba(99,102,241,0.12)', color: '#a5b4fc',
                                        border: '1px solid rgba(99,102,241,0.25)', borderRadius: '20px', padding: '0.2rem 0.6rem'
                                      }}>
                                        🔧 Peralatan
                                      </span>
                                    ) : (
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                        fontSize: '0.7rem', fontWeight: 700,
                                        background: 'rgba(34,211,238,0.12)', color: '#22d3ee',
                                        border: '1px solid rgba(34,211,238,0.25)', borderRadius: '20px', padding: '0.2rem 0.6rem'
                                      }}>
                                        🧪 Barang Luak
                                      </span>
                                    )}
                                  </td>

                                  {/* 4. KUANTITI */}
                                  <td>
                                    <strong style={{ fontSize: '0.9rem' }}>{t.quantity}</strong>{' '}
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{itemUnit}</span>
                                  </td>

                                  {/* 5. TARIKH PINJAM / AMBIL */}
                                  <td>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{t.dateBorrowed}</div>
                                    {t.tarikhMahuPinjam && (
                                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                        Mahu Pinjam/Pakai: <strong style={{ color: 'var(--text-secondary)' }}>{t.tarikhMahuPinjam}</strong>
                                      </div>
                                    )}
                                  </td>

                                  {/* 6. TARIKH PULANG */}
                                  <td>
                                    {t.kategori === 'habis_pakai' || t.status === 'Telah Diambil' || sLabel === 'DIAMBIL (HABIS)' ? (
                                      <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 500, fontStyle: 'italic' }}>N/A (Barang Luak)</span>
                                    ) : (
                                      <div style={{ fontSize: '0.8rem' }}>
                                        {t.dateReturned ? (
                                          <strong style={{ color: 'var(--success)' }}>{t.dateReturned}</strong>
                                        ) : (
                                          <span style={{ color: '#fbbf24', fontSize: '0.75rem', fontWeight: 500 }}>Belum Pulang</span>
                                        )}
                                      </div>
                                    )}
                                  </td>

                                  {/* 7. STATUS */}
                                  <td>
                                    {sLabel === 'DIPINJAM' && (
                                      <span className="status-badge approved" style={{ textTransform: 'uppercase' }}>
                                        DIPINJAM
                                      </span>
                                    )}
                                    {sLabel === 'PULANG' && (
                                      <span className="status-badge returned" style={{ textTransform: 'uppercase' }}>
                                        PULANG
                                      </span>
                                    )}
                                    {sLabel === 'LAMBAT PULANG' && (
                                      <span className="status-badge rejected" style={{
                                        background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.35)',
                                        animation: 'pulse 2s infinite', textTransform: 'uppercase', fontWeight: 800
                                      }}>
                                        ⚠️ LAMBAT PULANG
                                      </span>
                                    )}
                                    {sLabel === 'DIAMBIL (HABIS)' && (
                                      <span className="status-badge" style={{
                                        backgroundColor: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.3)',
                                        textTransform: 'uppercase'
                                      }}>
                                        DIAMBIL (HABIS)
                                      </span>
                                    )}
                                    {sLabel !== 'DIPINJAM' && sLabel !== 'PULANG' && sLabel !== 'LAMBAT PULANG' && sLabel !== 'DIAMBIL (HABIS)' && (
                                      <span className="status-badge pending" style={{ textTransform: 'uppercase' }}>
                                        {sLabel}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Bar Navigasi Paginasi (Maksimum 10 rekod) */}
                      {renderPaginationBar(currentTxPage, totalTxPages, sortedTxList.length, setHistoryPage)}
                    </>
                  )}
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════════════
                  TAB 2: AUDIT LOG INVENTORI STOR
              ══════════════════════════════════════════════════════════════════════ */}
              {historyActiveSubTab === 'audit' && (
                <div className="glass-panel" style={{ padding: '2rem' }}>
                  {/* ── Header row ── */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <h3 className="section-title" style={{ margin: 0 }}>📜 Audit Log Inventori Stor</h3>
                      {unreadAuditLogsCount > 0 && (
                        <span style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          borderRadius: '20px',
                          padding: '0.15rem 0.6rem',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                        }}>
                          +{unreadAuditLogsCount} Baharu
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                      {auditLogFilter === 'Semua'
                        ? `${storeAuditLogs.length} rekod keseluruhan`
                        : `${filteredAuditLogs.length} rekod (${auditLogFilter}) · ${storeAuditLogs.length} rekod keseluruhan`}
                    </span>
                  </div>

                  {/* ── Filter Tabs ── */}
                  <div style={{
                    display: 'flex',
                    gap: '0.45rem',
                    flexWrap: 'wrap',
                    marginBottom: '1.25rem',
                    padding: '0.5rem',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    {/* Semua Tab */}
                    <button
                      onClick={() => setAuditLogFilter('Semua')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.35rem 0.85rem',
                        borderRadius: '7px',
                        border: auditLogFilter === 'Semua' ? '1px solid rgba(148,163,184,0.5)' : '1px solid transparent',
                        background: auditLogFilter === 'Semua' ? 'rgba(148,163,184,0.15)' : 'transparent',
                        color: auditLogFilter === 'Semua' ? '#e2e8f0' : 'var(--text-muted)',
                        fontSize: '0.78rem',
                        fontWeight: auditLogFilter === 'Semua' ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.18s ease',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      📋 Semua
                    </button>

                    {/* Divider */}
                    <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', margin: '0.2rem 0' }} />

                    {/* Dynamic type tabs */}
                    {(Object.entries(BADGE_CONFIG) as [string, typeof BADGE_CONFIG[string]][]).map(([type, cfg]) => {
                      const isActive = auditLogFilter === type;
                      const count = countByType[type] ?? 0;
                      return (
                        <button
                          key={type}
                          onClick={() => setAuditLogFilter(type as 'TAMBAH' | 'KEMASKINI' | 'PADAM' | 'PINDAH')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.35rem 0.85rem',
                            borderRadius: '7px',
                            border: isActive ? `1px solid ${cfg.border}` : '1px solid transparent',
                            background: isActive ? cfg.activeBg : 'transparent',
                            color: isActive ? cfg.color : 'var(--text-muted)',
                            fontSize: '0.78rem',
                            fontWeight: isActive ? 700 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.18s ease',
                            fontFamily: 'var(--font-sans)',
                            opacity: count === 0 ? 0.4 : 1,
                          }}
                        >
                          <span>{cfg.icon}</span>
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>

                  {sortedAuditLogs.length === 0 ? (
                    <div className="empty-state">
                      <span className="empty-icon">📋</span>
                      <h4>Tiada Log Audit</h4>
                      <p>Setiap tindakan Tambah, Edit, Padam dan Pindah akan direkodkan di sini secara automatik.</p>
                    </div>
                  ) : (
                    <>
                      <div className="table-container">
                        <table className="custom-table">
                          <thead>
                            <tr>
                              <th>Masa</th>
                              <th>Jenis</th>
                              <th>Nama Barang</th>
                              <th>SKU</th>
                              <th>Kuantiti</th>
                              <th>Stor</th>
                              <th>Oleh</th>
                              <th>Catatan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedAuditLogs.map((log) => {
                              const badge = BADGE_CONFIG[log.type];
                              return (
                                <tr key={log.id}>
                                  <td>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                      {log.timestamp}
                                    </span>
                                  </td>
                                  <td>
                                    <span style={{
                                      fontSize: '0.73rem', fontWeight: 700,
                                      background: badge.bg, color: badge.color,
                                      border: `1px solid ${badge.border}`,
                                      borderRadius: '20px', padding: '0.2rem 0.6rem',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {badge.icon} {badge.label}
                                    </span>
                                  </td>
                                  <td style={{ fontWeight: 600 }}>{log.itemName}</td>
                                  <td><span className="sku-text">{log.sku}</span></td>
                                  <td>
                                    {log.type === 'KEMASKINI' && log.oldQuantity !== undefined ? (
                                      <span>
                                        <span style={{ color: 'var(--danger)', textDecoration: 'line-through', marginRight: '0.3rem' }}>
                                          {log.oldQuantity}
                                        </span>
                                        <span style={{ color: 'var(--success)' }}>→ {log.quantity}</span>
                                        <span style={{ color: 'var(--text-muted)', marginLeft: '0.2rem' }}>{log.unit}</span>
                                      </span>
                                    ) : (
                                      <span><strong>{log.quantity}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{log.unit}</span></span>
                                    )}
                                  </td>
                                  <td style={{ fontSize: '0.82rem' }}>
                                    {log.type === 'PINDAH' ? (
                                      <span>
                                        <span style={{ color: '#a78bfa' }}>{log.store}</span>
                                        <span style={{ color: 'var(--text-muted)', margin: '0 0.3rem' }}>→</span>
                                        <span style={{ color: '#34d399' }}>{log.targetStore}</span>
                                      </span>
                                    ) : (
                                      <span style={{ color: 'var(--text-secondary)' }}>{log.store}</span>
                                    )}
                                  </td>
                                  <td>
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{log.performedBy}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{log.performedByRole}</div>
                                  </td>
                                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontStyle: log.catatan ? 'normal' : 'italic' }}>
                                    {log.catatan || <span style={{ opacity: 0.4 }}>—</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Bar Navigasi Paginasi (Maksimum 10 rekod) */}
                      {renderPaginationBar(currentAuditPage, totalAuditPages, sortedAuditLogs.length, setAuditLogPage)}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })()}


        {activeTab === 'notifikasi' && (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 className="section-title" style={{ margin: 0 }}>🔔 Semua Notifikasi Stor</h3>
              {filteredNotifications.length > 0 && (
                <button className="btn btn-secondary" onClick={clearNotifications} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
                  Padam Semua Notifikasi
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredNotifications.length === 0 ? (
                <div className="empty-state">
                  <span style={{ fontSize: '3.5rem' }}>📭</span>
                  <h4>Tiada Notifikasi</h4>
                  <p>Aktiviti stor anda adalah bersih dan tiada pemberitahuan baru.</p>
                </div>
              ) : (
                filteredNotifications.map((n) => (
                  <div key={n.id} className={`notif-card ${n.type}`} style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: 600 }}>
                        {n.type === 'tambah' && '📦 Kemas Kini Barang'}
                        {n.type === 'pinjam' && '⏳ Permohonan Baru'}
                        {n.type === 'lulus' && '✓ Kelulusan Diberi'}
                        {n.type === 'pulang' && '↩ Pemulangan Selesai'}
                        {n.type === 'stok_rendah' && '⚠️ Amaran Stok Rendah'}
                      </span>
                      <span className="notif-time">{n.timestamp}</span>
                    </div>
                     <p style={{ marginTop: '0.5rem', color: 'var(--text-primary)', fontSize: '0.9rem' }}>{n.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'ahli' && (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1.5rem',
              borderBottom: '1px solid var(--card-border)',
              paddingBottom: '1.25rem'
            }}>
              <div>
                <h3 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span>👥</span> Pengurusan Ahli Bengkel - {user.workshop}
                </h3>
                <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  Senarai pensyarah dan staf berdaftar di bawah bengkel ini berserta kawalan keselamatan PIN 4-digit.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setNewMemberName('');
                  setNewMemberRole('Pensyarah');
                  setNewMemberPin('1234');
                  setIsAddMemberModalOpen(true);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
              >
                <span>➕</span> Tambah Ahli Baru
              </button>
            </div>

            {/* Filter Bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
              marginBottom: '1.25rem'
            }}>
              <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
                <input
                  type="text"
                  placeholder="Cari nama atau peranan ahli..."
                  value={memberSearchTerm}
                  onChange={e => setMemberSearchTerm(e.target.value)}
                  className="input-field"
                  style={{
                    paddingLeft: '2.2rem',
                    fontSize: '0.9rem',
                    background: 'rgba(0,0,0,0.2)',
                    borderColor: 'var(--card-border)'
                  }}
                />
                <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
                  🔍
                </span>
                {memberSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setMemberSearchTerm('')}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Memaparkan{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {
                    userAccounts
                      .filter(m => m.workshop === user.workshop)
                      .filter(m =>
                        m.name.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
                        m.role.toLowerCase().includes(memberSearchTerm.toLowerCase())
                      ).length
                  }
                </strong>{' '}
                daripada{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {userAccounts.filter(m => m.workshop === user.workshop).length}
                </strong>{' '}
                ahli berdaftar
              </div>
            </div>

            {/* Table */}
            {(() => {
              const currentWorkshopMembers = userAccounts
                .filter(m => m.workshop === user.workshop)
                .filter(m =>
                  m.name.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
                  m.role.toLowerCase().includes(memberSearchTerm.toLowerCase())
                );

              if (currentWorkshopMembers.length === 0) {
                return (
                  <div className="empty-state" style={{ padding: '3rem 1rem' }}>
                    <span style={{ fontSize: '3rem' }}>👥</span>
                    <h4>Tiada Ahli Dijumpai</h4>
                    <p>
                      {memberSearchTerm
                        ? 'Tiada rekod ahli yang sepadan dengan carian anda.'
                        : 'Belum ada ahli berdaftar untuk bengkel ini.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="table-responsive" style={{ overflowX: 'auto' }}>
                  <table className="inventory-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '0.9rem 1rem' }}>Nama Penuh Pensyarah / Staf</th>
                        <th style={{ textAlign: 'center', padding: '0.9rem 1rem' }}>Peranan</th>
                        <th style={{ textAlign: 'center', padding: '0.9rem 1rem' }}>Tarikh Daftar</th>
                        <th style={{ textAlign: 'center', padding: '0.9rem 1rem' }}>Tindakan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentWorkshopMembers.map((member) => {
                        const isCurrentLoggedInUser = member.name === user.name;
                        const roleColor =
                          member.role === 'Ketua Bengkel'
                            ? { bg: 'rgba(168, 85, 247, 0.12)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.25)', icon: '👑' }
                            : member.role === 'PIC'
                            ? { bg: 'rgba(6, 182, 212, 0.12)', text: '#22d3ee', border: 'rgba(6, 182, 212, 0.25)', icon: '🛡️' }
                            : { bg: 'rgba(16, 185, 129, 0.12)', text: '#34d399', border: 'rgba(16, 185, 129, 0.25)', icon: '👨‍🏫' };

                        const formattedDate = member.registeredAt
                          ? new Date(member.registeredAt).toLocaleDateString('ms-MY', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                          : '05/03/2026';

                        const memberAvatar = member.avatarUrl || (isCurrentLoggedInUser ? user.avatarUrl : undefined);

                        return (
                          <tr key={member.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                            <td style={{ padding: '0.9rem 1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                {memberAvatar ? (
                                  <img
                                    src={memberAvatar}
                                    alt={member.name}
                                    style={{
                                      width: '36px',
                                      height: '36px',
                                      borderRadius: '50%',
                                      objectFit: 'cover',
                                      flexShrink: 0,
                                      border: isCurrentLoggedInUser ? '2px solid var(--primary)' : '1px solid var(--card-border)',
                                      boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: '36px',
                                      height: '36px',
                                      borderRadius: '50%',
                                      background:
                                        member.role === 'Ketua Bengkel'
                                          ? 'linear-gradient(135deg, #a855f7, #6366f1)'
                                          : member.role === 'PIC'
                                          ? 'linear-gradient(135deg, #06b6d4, #3b82f6)'
                                          : 'linear-gradient(135deg, #10b981, #059669)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 700,
                                      fontSize: '0.9rem',
                                      color: '#fff',
                                      flexShrink: 0,
                                      boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                                    }}
                                  >
                                    {member.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span>{member.name}</span>
                                    {isCurrentLoggedInUser && (
                                      <span
                                        style={{
                                          fontSize: '0.68rem',
                                          padding: '0.12rem 0.45rem',
                                          borderRadius: '4px',
                                          background: 'rgba(99, 102, 241, 0.2)',
                                          color: '#a5b4fc',
                                          border: '1px solid rgba(99, 102, 241, 0.4)',
                                          fontWeight: 700
                                        }}
                                      >
                                        Akaun Anda
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                                    PIN Akses: ••••
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td style={{ textAlign: 'center', padding: '0.9rem 1rem' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  padding: '0.25rem 0.7rem',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  background: roleColor.bg,
                                  color: roleColor.text,
                                  border: `1px solid ${roleColor.border}`
                                }}
                              >
                                <span>{roleColor.icon}</span>
                                <span>{member.role}</span>
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', padding: '0.9rem 1rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                              {formattedDate}
                            </td>
                            <td style={{ textAlign: 'center', padding: '0.9rem 1rem' }}>
                              <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => {
                                    setEditingMember(member);
                                    setEditMemberPin('');
                                  }}
                                  style={{
                                    padding: '0.35rem 0.75rem',
                                    fontSize: '0.8rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    borderColor: 'rgba(234, 179, 8, 0.3)',
                                    color: '#facc15'
                                  }}
                                  title="Tukar Kod PIN 4-Digit"
                                >
                                  🔑 Tukar PIN
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => {
                                    if (isCurrentLoggedInUser) {
                                      alert('Anda tidak boleh memadam akaun diri sendiri yang sedang digunakan!');
                                      return;
                                    }
                                    if (window.confirm(`Adakah anda pasti mahu memadam akaun ${member.name}?`)) {
                                      deleteUserAccount(member.id);
                                    }
                                  }}
                                  style={{
                                    padding: '0.35rem 0.75rem',
                                    fontSize: '0.8rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    borderColor: 'rgba(239, 68, 68, 0.3)',
                                    color: '#f87171'
                                  }}
                                  title="Padam Akaun Ahli"
                                >
                                  🗑️ Padam
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'tetapan' && (
          <div className="glass-panel" style={{ padding: '2rem' }}>
            {/* Header section */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1.5rem',
              borderBottom: '1px solid var(--card-border)',
              paddingBottom: '1.25rem'
            }}>
              <div>
                <h3 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span>⚙️</span> Tetapan Sistem & Profil
                </h3>
                <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  Urus maklumat organisasi kolej, bengkel, serta profil peribadi dan keselamatan PIN 4-digit akaun anda.
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.75rem' }}>
              {(user.role === 'Ketua Bengkel' || user.role === 'PIC') && (
                <button
                  type="button"
                  onClick={() => setSettingsTab('organisasi')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.6rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                    border: settingsTab === 'organisasi' ? '1px solid var(--primary)' : '1px solid transparent',
                    background: settingsTab === 'organisasi' ? 'var(--primary-glow)' : 'rgba(255,255,255,0.03)',
                    color: settingsTab === 'organisasi' ? '#a5b4fc' : 'var(--text-secondary)',
                    fontWeight: settingsTab === 'organisasi' ? 700 : 500,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    transition: 'var(--transition-fast)'
                  }}
                >
                  <span>🏫</span> Maklumat Organisasi & Bengkel
                </button>
              )}
              <button
                type="button"
                onClick={() => setSettingsTab('peribadi')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  border: settingsTab === 'peribadi' ? '1px solid var(--primary)' : '1px solid transparent',
                  background: settingsTab === 'peribadi' ? 'var(--primary-glow)' : 'rgba(255,255,255,0.03)',
                  color: settingsTab === 'peribadi' ? '#a5b4fc' : 'var(--text-secondary)',
                  fontWeight: settingsTab === 'peribadi' ? 700 : 500,
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  transition: 'var(--transition-fast)'
                }}
              >
                <span>👤</span> Maklumat Peribadi
              </button>
            </div>

            {/* TAB 1: MAKLUMAT ORGANISASI & BENGKEL */}
            {settingsTab === 'organisasi' && (user.role === 'Ketua Bengkel' || user.role === 'PIC') && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!orgKvName.trim()) {
                    alert('Sila masukkan Nama Kolej Vokasional.');
                    return;
                  }
                  if (!orgWorkshopName.trim()) {
                    alert('Sila masukkan Nama Bengkel / Jabatan.');
                    return;
                  }
                  updateOrgSettings({
                    kvName: orgKvName.trim(),
                    workshopName: orgWorkshopName.trim(),
                    address: orgAddress.trim(),
                    phone: orgPhone.trim(),
                    email: orgEmail.trim(),
                    logoUrl: orgLogoUrl,
                  });
                  alert('Tetapan Organisasi Berjaya Disimpan!');
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '820px' }}
              >
                {/* 1. Muat Naik Logo KV */}
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.5rem'
                }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>📷</span> Logo Rasmi Kolej Vokasional (KV)
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{
                      width: '90px',
                      height: '90px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(0,0,0,0.3)',
                      border: '2px dashed var(--card-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}>
                      {orgLogoUrl ? (
                        <img
                          src={orgLogoUrl}
                          alt="Logo Preview"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        <span style={{ fontSize: '2.5rem' }}>🏫</span>
                      )}
                    </div>
                    <div style={{ flexGrow: 1, minWidth: '240px' }}>
                      <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Logo ini akan digunakan secara automatik pada Header Sistem dan Cetakan Laporan PDF (Format: PNG, JPG, WEBP • Maksimum: 3MB).
                      </p>
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <label
                          className="btn btn-secondary"
                          style={{
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.82rem',
                            padding: '0.45rem 0.9rem'
                          }}
                        >
                          <span>📷</span> Muat Naik Logo Baharu
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (!file.type.startsWith('image/')) {
                                alert('Sila pilih fail imej yang sah (PNG, JPG, atau WEBP).');
                                return;
                              }
                              if (file.size > 3 * 1024 * 1024) {
                                alert('Saiz fail imej melebihi had 3MB. Sila pilih fail yang lebih kecil.');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                if (evt.target?.result) {
                                  setOrgLogoUrl(evt.target.result as string);
                                }
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                        {orgLogoUrl && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setOrgLogoUrl('')}
                            style={{
                              borderColor: 'rgba(239, 68, 68, 0.4)',
                              color: '#f87171',
                              fontSize: '0.82rem',
                              padding: '0.45rem 0.9rem'
                            }}
                          >
                            Padam Logo
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Butiran Organisasi & Bengkel */}
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem'
                }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>🏫</span> Butiran Kolej Vokasional & Bengkel
                  </h4>

                  <div className="form-row">
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                        Nama Kolej Vokasional <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={orgKvName}
                        onChange={(e) => setOrgKvName(e.target.value)}
                        placeholder="Contoh: KV Shah Alam"
                        className="input-field"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                        Nama Bengkel / Jabatan <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={orgWorkshopName}
                        onChange={(e) => setOrgWorkshopName(e.target.value)}
                        placeholder="Contoh: Teknologi Penyejukan dan Penyamanan Udara"
                        className="input-field"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                        No. Telefon Pejabat / Bengkel
                      </label>
                      <input
                        type="text"
                        value={orgPhone}
                        onChange={(e) => setOrgPhone(e.target.value)}
                        placeholder="Contoh: 03-5519 1234"
                        className="input-field"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                        E-mel Rasmi Bengkel / Stor
                      </label>
                      <input
                        type="email"
                        value={orgEmail}
                        onChange={(e) => setOrgEmail(e.target.value)}
                        placeholder="Contoh: bengkel.kv@moe.gov.my"
                        className="input-field"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                      Alamat Penuh Bengkel / Kolej
                    </label>
                    <textarea
                      rows={3}
                      value={orgAddress}
                      onChange={(e) => setOrgAddress(e.target.value)}
                      placeholder="Contoh: Jalan Batu Tiga, Seksyen 19, 40300 Shah Alam, Selangor Darul Ehsan"
                      className="input-field"
                      style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                  </div>
                </div>

                {/* 3. Butang Simpan */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.5rem', fontWeight: 600 }}
                  >
                    <span>💾</span> Simpan Tetapan Organisasi
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: MAKLUMAT PERIBADI */}
            {settingsTab === 'peribadi' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!profileName.trim()) {
                    alert('Sila masukkan nama penuh anda.');
                    return;
                  }

                  // If user fills in any PIN field, validate all 3
                  const hasPinInput = profileCurrentPin || profileNewPin || profileConfirmPin;
                  if (hasPinInput) {
                    if (!profileCurrentPin) {
                      alert('Sila masukkan PIN 4-digit semasa anda untuk pengesahan keselamatan.');
                      return;
                    }
                    const myAcc = userAccounts.find(
                      (u) => u.name.toLowerCase().trim() === user.name.toLowerCase().trim() && u.workshop === user.workshop
                    );
                    if (myAcc && myAcc.pin !== profileCurrentPin) {
                      alert('PIN 4-digit semasa tidak tepat!');
                      return;
                    }
                    if (!/^\d{4}$/.test(profileNewPin)) {
                      alert('PIN baharu mestilah tepat 4 digit angka nombor!');
                      return;
                    }
                    if (profileNewPin !== profileConfirmPin) {
                      alert('Pengesahan PIN baharu tidak sepadan dengan PIN baharu!');
                      return;
                    }
                  }

                  const res = updateUserProfile(profileName.trim(), profileNewPin ? profileNewPin : undefined, profileAvatarUrl);
                  if (!res.success) {
                    alert(res.message || 'Ralat mengemaskini profil.');
                    return;
                  }

                  alert('Profil Berjaya Dikemaskini!');
                  setProfileCurrentPin('');
                  setProfileNewPin('');
                  setProfileConfirmPin('');
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '820px' }}
              >
                {/* 1. Profil Pengguna */}
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem'
                }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>👤</span> Profil Pengguna
                  </h4>

                  {/* Avatar Upload */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{
                      width: '76px',
                      height: '76px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                      border: '2px solid var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}>
                      {profileAvatarUrl ? (
                        <img
                          src={profileAvatarUrl}
                          alt="Avatar Preview"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span style={{ fontSize: '2rem', fontWeight: 700, color: '#fff' }}>
                          {profileName.charAt(0).toUpperCase() || 'U'}
                        </span>
                      )}
                    </div>
                    <div style={{ flexGrow: 1, minWidth: '220px' }}>
                      <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Pilih gambar profil peribadi anda (Format: PNG, JPG, WEBP • Maksimum: 2MB).
                      </p>
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <label
                          className="btn btn-secondary"
                          style={{
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.82rem',
                            padding: '0.45rem 0.9rem'
                          }}
                        >
                          <span>📷</span> Muat Naik Gambar Profil
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (!file.type.startsWith('image/')) {
                                alert('Sila pilih fail imej yang sah.');
                                return;
                              }
                              if (file.size > 2 * 1024 * 1024) {
                                alert('Saiz fail gambar melebihi had 2MB.');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                if (evt.target?.result) {
                                  setProfileAvatarUrl(evt.target.result as string);
                                }
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                        {profileAvatarUrl && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setProfileAvatarUrl('')}
                            style={{
                              borderColor: 'rgba(239, 68, 68, 0.4)',
                              color: '#f87171',
                              fontSize: '0.82rem',
                              padding: '0.45rem 0.9rem'
                            }}
                          >
                            Padam Gambar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="form-row">
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                        Nama Penuh <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="input-field"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                        Peranan / Role (Read-only)
                      </label>
                      <input
                        type="text"
                        disabled
                        value={user.role}
                        className="input-field"
                        style={{ width: '100%', boxSizing: 'border-box', opacity: 0.7, cursor: 'not-allowed', background: 'rgba(255,255,255,0.05)' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                      Bengkel Berdaftar (Read-only)
                    </label>
                    <input
                      type="text"
                      disabled
                      value={user.workshop}
                      className="input-field"
                      style={{ width: '100%', boxSizing: 'border-box', opacity: 0.7, cursor: 'not-allowed', background: 'rgba(255,255,255,0.05)' }}
                    />
                  </div>
                </div>

                {/* 2. Keselamatan & Kemaskini PIN */}
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem'
                }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>🔒</span> Keselamatan & Kemaskini PIN 4-Digit
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      Untuk menukar PIN akses 4-digit anda, sila isi semua medan di bawah. Biarkan kosong jika tidak mahu mengubah PIN semasa.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                        PIN 4-Digit Semasa
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        value={profileCurrentPin}
                        onChange={(e) => setProfileCurrentPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        className="input-field"
                        style={{ width: '100%', boxSizing: 'border-box', letterSpacing: '0.25em', fontSize: '1.05rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                        PIN 4-Digit Baharu
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        value={profileNewPin}
                        onChange={(e) => setProfileNewPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        className="input-field"
                        style={{ width: '100%', boxSizing: 'border-box', letterSpacing: '0.25em', fontSize: '1.05rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                        Pengesahan PIN Baharu
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        value={profileConfirmPin}
                        onChange={(e) => setProfileConfirmPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        className="input-field"
                        style={{ width: '100%', boxSizing: 'border-box', letterSpacing: '0.25em', fontSize: '1.05rem' }}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Butang Simpan */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.5rem', fontWeight: 600 }}
                  >
                    <span>🔒</span> Kemaskini Profil & PIN
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>

      {/* ═══════════════════════════════════════════
           TAMBAH BARANG BARU — Modal Redesign
          ═══════════════════════════════════════════ */}
      {isAddModalOpen && (() => {
        // ── Data definitions ────────────────────────
        const KATEGORI_LIST = workshopCategories.map(cat => ({
          code: cat.code,
          label: cat.label,
          ...getCategoryBadgeStyles(cat.code)
        }));

        const SEKSYEN_MAP = GLOBAL_SEKSYEN_MAP;

        const currentKat = KATEGORI_LIST.find(k => k.code === itemKodKategori) ?? KATEGORI_LIST[0] ?? { code: '', label: '', color: '#94a3b8', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' };
        const seksyenOptions = SEKSYEN_MAP[itemKodKategori] ?? ['ACCESSORIES', 'GENERAL'];
        const existingRacks = Array.from(new Set(filteredItems.map(i => i.location).filter(Boolean)));
        const isAuthorized = user.role === 'Ketua Bengkel' || user.role === 'PIC';

        return (
          <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
            <div className="glass-panel" style={{
              maxWidth: '680px',
              width: '95vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '1.5rem',
              overflow: 'hidden',
              animation: 'modalScale 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
            }} onClick={e => e.stopPropagation()}>

              {/* ── Header ─────────────────────────────── */}
              <div className="modal-header" style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>📦</span>
                  <div>
                    <h2 className="modal-title" style={{ margin: 0, fontSize: '1.25rem' }}>Tambah Barang Baru</h2>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {user.selectedStore} · {user.workshop}
                    </p>
                  </div>
                </div>
                <button className="btn-close" onClick={() => setIsAddModalOpen(false)}>&times;</button>
              </div>

              <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                
                {/* ── Scrollable Body ────────────────────── */}
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  paddingRight: '0.5rem',
                  marginBottom: '0.5rem'
                }}>
                  {/* ── 1. JENIS BARANG ─────────────────────── */}
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      1 · Jenis Barang *
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      {[
                        { value: 'peralatan' as const, icon: '🔧', label: 'Peralatan', sublabel: 'Boleh Pinjam', color: '#a5b4fc', bg: 'rgba(99,102,241,0.10)', border: 'rgba(99,102,241,0.35)' },
                        { value: 'habis_pakai' as const, icon: '🧪', label: 'Barang Luak', sublabel: 'Habis Guna', color: '#22d3ee', bg: 'rgba(6,182,212,0.10)', border: 'rgba(6,182,212,0.35)' },
                      ].map(opt => (
                        <label key={opt.value} style={{
                          display: 'flex', alignItems: 'center', gap: '0.9rem',
                          padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                          border: `2px solid ${itemKategori === opt.value ? opt.border : 'rgba(255,255,255,0.07)'}`,
                          background: itemKategori === opt.value ? opt.bg : 'rgba(255,255,255,0.02)',
                          transition: 'all 0.2s ease',
                        }}>
                          <input type="radio" name="jenis" value={opt.value} checked={itemKategori === opt.value}
                            onChange={() => {
                              setItemKategori(opt.value);
                              setItemUnit(opt.value === 'peralatan' ? 'unit' : 'pcs');
                            }}
                            style={{ display: 'none' }}
                          />
                          <span style={{ fontSize: '1.4rem' }}>{opt.icon}</span>
                          <div>
                            <div style={{ fontWeight: 700, color: itemKategori === opt.value ? opt.color : 'var(--text-primary)', fontSize: '0.88rem' }}>
                              {opt.label}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{opt.sublabel}</div>
                          </div>
                          {itemKategori === opt.value && (
                            <span style={{ marginLeft: 'auto', color: opt.color, fontWeight: 700, fontSize: '1rem' }}>✓</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* ── 2. KATEGORI ─────────────────────────── */}
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label style={{ margin: 0, fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        2 · Kategori *
                      </label>
                      {isAuthorized && (
                        <button
                          type="button"
                          onClick={() => setIsCategoryManagerOpen(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#a78bfa',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: 0
                          }}
                        >
                          ➕ Urus Kategori
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <select
                        className="input-field"
                        value={itemKodKategori}
                        onChange={(e) => {
                          const code = e.target.value;
                          setItemKodKategori(code);
                          const opts = SEKSYEN_MAP[code] ?? ['ACCESSORIES'];
                          setItemSeksyen(opts[0]);
                        }}
                        style={{ flex: 1, padding: '0.7rem 1rem' }}
                      >
                        {KATEGORI_LIST.map(k => (
                          <option key={k.code} value={k.code}>{k.code} — {k.label}</option>
                        ))}
                      </select>
                      {/* Live badge preview */}
                      <span style={{
                        flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 800,
                        padding: '0.3rem 0.8rem', borderRadius: '8px',
                        background: currentKat.bg, color: currentKat.color, border: `1px solid ${currentKat.border}`,
                        letterSpacing: '0.06em', transition: 'all 0.2s',
                      }}>
                        {currentKat.code}
                      </span>
                    </div>
                    <div style={{ marginTop: '0.35rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {currentKat.label}
                    </div>
                  </div>

                  {/* ── 3 & 4. NAMA + KOD ─────────────────── */}
                  <div className="form-row" style={{ marginBottom: '1rem' }}>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        3 · Nama Barang *
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder={itemKategori === 'peralatan' ? 'Contoh: Kunci Momen 1/2"' : 'Contoh: Gris Hitam 500g'}
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        required
                        style={{ padding: '0.7rem 1rem' }}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        4 · Kod / SKU
                        <span style={{ fontWeight: 400, marginLeft: '0.4rem', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'none' }}>(Auto: {itemKodKategori}-XXXX)</span>
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder={`Contoh: ${itemKodKategori}-001`}
                        value={itemSku}
                        onChange={(e) => setItemSku(e.target.value)}
                        style={{ padding: '0.7rem 1rem' }}
                      />
                    </div>
                  </div>

                  {/* ── 5 & 6. SEKSYEN + KEDUDUKAN ─────────── */}
                  <div className="form-row" style={{ marginBottom: '1rem' }}>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        5 · Seksyen *
                      </label>
                      <select
                        className="input-field"
                        value={itemSeksyen}
                        onChange={(e) => setItemSeksyen(e.target.value)}
                        required
                        style={{ padding: '0.7rem 1rem' }}
                      >
                        {seksyenOptions.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        6 · Kedudukan Rak *
                      </label>
                      <select
                        className="input-field"
                        value={isNewRack ? '__new__' : itemLocation}
                        onChange={(e) => {
                          if (e.target.value === '__new__') {
                            setIsNewRack(true);
                            setItemLocation('');
                          } else {
                            setIsNewRack(false);
                            setItemLocation(e.target.value);
                          }
                        }}
                        required={!isNewRack}
                        style={{ padding: '0.7rem 1rem' }}
                      >
                        {existingRacks.map(r => <option key={r} value={r}>{r}</option>)}
                        <option value="__new__">➕ Kedudukan Baru...</option>
                      </select>
                      {isNewRack && (
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Contoh: RAK-A1, RAK-B3"
                          value={newRackName}
                          onChange={(e) => setNewRackName(e.target.value)}
                          style={{ marginTop: '0.5rem', padding: '0.7rem 1rem' }}
                          required
                          autoFocus
                        />
                      )}
                    </div>
                  </div>

                  {/* ── 7, 8, 9. QTY + UNIT + MINIMA ─────── */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        7 · Kuantiti Mula *
                      </label>
                      <NumberInput
                        min="1"
                        className="input-field"
                        value={itemQty}
                        onChange={setItemQty}
                        required
                        style={{ padding: '0.7rem 1rem' }}
                      />
                      {itemQty !== '' && Number(itemQty) > 0 && (
                        <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Baki: <strong style={{ color: 'var(--success)' }}>{itemQty}</strong> / {itemQty} {itemUnit}
                        </div>
                      )}
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        8 · Unit *
                      </label>
                      <select
                        className="input-field"
                        value={itemUnit}
                        onChange={(e) => setItemUnit(e.target.value)}
                        style={{ padding: '0.7rem 1rem' }}
                      >
                        {['pcs','unit','roll','cm','m','kaki','kotak','carton','paket','botol','biji','keping','set'].map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        9 · Had Min *
                      </label>
                      <NumberInput
                        min="0"
                        className="input-field"
                        value={itemStokMinima}
                        onChange={setItemStokMinima}
                        required
                        style={{ padding: '0.7rem 1rem' }}
                      />
                    </div>
                  </div>
                </div>

                {/* ── Footer ───────────────────────────────── */}
                <div className="modal-footer" style={{ borderTop: '1px solid var(--card-border)', paddingTop: '0.85rem', marginTop: '0.25rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                    Batal
                  </button>
                  <button type="submit" className="btn" style={{
                    background: itemKategori === 'peralatan'
                      ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                      : 'linear-gradient(135deg, #0891b2, #06b6d4)',
                  }}>
                    {itemKategori === 'peralatan' ? '🔧' : '🧪'} Simpan Barang
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════
           KEMASKINI BARANG — Modal Redesign
          ═══════════════════════════════════════════ */}
      {isEditModalOpen && selectedItem && (() => {
        // ── Data definitions (mirror AddModal exactly) ──────────────
        const EDIT_KATEGORI_LIST = workshopCategories.map(cat => ({
          code: cat.code,
          label: cat.label,
          ...getCategoryBadgeStyles(cat.code)
        }));

        const EDIT_SEKSYEN_MAP = GLOBAL_SEKSYEN_MAP;

        const editKat = EDIT_KATEGORI_LIST.find(k => k.code === itemKodKategori) ?? EDIT_KATEGORI_LIST[0] ?? { code: '', label: '', color: '#94a3b8', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' };
        const editSeksyenOptions = EDIT_SEKSYEN_MAP[itemKodKategori] ?? ['ACCESSORIES', 'GENERAL'];
        const editExistingRacks = Array.from(new Set(filteredItems.map(i => i.location).filter(Boolean)));
        const isAuthorized = user.role === 'Ketua Bengkel' || user.role === 'PIC';

        return (
          <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
            <div className="glass-panel" style={{
              maxWidth: '680px',
              width: '95vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '1.5rem',
              overflow: 'hidden',
              animation: 'modalScale 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            }} onClick={e => e.stopPropagation()}>

              {/* ── Header ─────────────────────────────── */}
              <div className="modal-header" style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>✏️</span>
                  <div>
                    <h2 className="modal-title" style={{ margin: 0, fontSize: '1.25rem' }}>Kemaskini Barangan</h2>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {user.selectedStore} · {user.workshop}
                    </p>
                  </div>
                </div>
                <button className="btn-close" onClick={() => setIsEditModalOpen(false)}>&times;</button>
              </div>

              <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

                {/* ── Scrollable Body ────────────────────── */}
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', marginBottom: '0.5rem' }}>

                  {/* ── 1. JENIS BARANG ─────────────────────── */}
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      1 · Jenis Barang *
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      {[
                        { value: 'peralatan' as const,   icon: '🔧', label: 'Peralatan',   sublabel: 'Boleh Pinjam', color: '#a5b4fc', bg: 'rgba(99,102,241,0.10)',  border: 'rgba(99,102,241,0.35)' },
                        { value: 'habis_pakai' as const, icon: '🧪', label: 'Barang Luak', sublabel: 'Habis Guna',  color: '#22d3ee', bg: 'rgba(6,182,212,0.10)',   border: 'rgba(6,182,212,0.35)' },
                      ].map(opt => (
                        <label key={opt.value} style={{
                          display: 'flex', alignItems: 'center', gap: '0.9rem',
                          padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                          border: `2px solid ${itemKategori === opt.value ? opt.border : 'rgba(255,255,255,0.07)'}`,
                          background: itemKategori === opt.value ? opt.bg : 'rgba(255,255,255,0.02)',
                          transition: 'all 0.2s ease',
                        }}>
                          <input type="radio" name="edit-jenis" value={opt.value} checked={itemKategori === opt.value}
                            onChange={() => {
                              setItemKategori(opt.value);
                              setItemUnit(opt.value === 'peralatan' ? 'unit' : 'pcs');
                            }}
                            style={{ display: 'none' }}
                          />
                          <span style={{ fontSize: '1.4rem' }}>{opt.icon}</span>
                          <div>
                            <div style={{ fontWeight: 700, color: itemKategori === opt.value ? opt.color : 'var(--text-primary)', fontSize: '0.88rem' }}>
                              {opt.label}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{opt.sublabel}</div>
                          </div>
                          {itemKategori === opt.value && (
                            <span style={{ marginLeft: 'auto', color: opt.color, fontWeight: 700, fontSize: '1rem' }}>✓</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* ── 2. KATEGORI ─────────────────────────── */}
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label style={{ margin: 0, fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        2 · Kategori *
                      </label>
                      {isAuthorized && (
                        <button
                          type="button"
                          onClick={() => setIsCategoryManagerOpen(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#a78bfa',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: 0
                          }}
                        >
                          ➕ Urus Kategori
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <select
                        className="input-field"
                        value={itemKodKategori}
                        onChange={(e) => {
                          const code = e.target.value;
                          setItemKodKategori(code);
                          const opts = EDIT_SEKSYEN_MAP[code] ?? ['ACCESSORIES'];
                          setItemSeksyen(opts[0]);
                        }}
                        style={{ flex: 1, padding: '0.7rem 1rem' }}
                      >
                        {EDIT_KATEGORI_LIST.map(k => (
                          <option key={k.code} value={k.code}>{k.code} — {k.label}</option>
                        ))}
                      </select>
                      {/* Live badge */}
                      <span style={{
                        flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 800,
                        padding: '0.3rem 0.8rem', borderRadius: '8px',
                        background: editKat.bg, color: editKat.color, border: `1px solid ${editKat.border}`,
                        letterSpacing: '0.06em', transition: 'all 0.2s',
                      }}>
                        {editKat.code}
                      </span>
                    </div>
                    <div style={{ marginTop: '0.35rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {editKat.label}
                    </div>
                  </div>

                  {/* ── 3 & 4. NAMA + KOD ─────────────────── */}
                  <div className="form-row" style={{ marginBottom: '1rem' }}>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        3 · Nama Barang *
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder={itemKategori === 'peralatan' ? 'Contoh: Kunci Momen 1/2"' : 'Contoh: Gris Hitam 500g'}
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        required
                        style={{ padding: '0.7rem 1rem' }}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        4 · Kod / SKU
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder={`Contoh: ${itemKodKategori}-001`}
                        value={itemSku}
                        onChange={(e) => setItemSku(e.target.value)}
                        style={{ padding: '0.7rem 1rem' }}
                      />
                    </div>
                  </div>

                  {/* ── 5 & 6. SEKSYEN + KEDUDUKAN ─────────── */}
                  <div className="form-row" style={{ marginBottom: '1rem' }}>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        5 · Seksyen *
                      </label>
                      <select
                        className="input-field"
                        value={itemSeksyen}
                        onChange={(e) => setItemSeksyen(e.target.value)}
                        required
                        style={{ padding: '0.7rem 1rem' }}
                      >
                        {editSeksyenOptions.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        6 · Kedudukan Rak *
                      </label>
                      <select
                        className="input-field"
                        value={isNewRack ? '__new__' : itemLocation}
                        onChange={(e) => {
                          if (e.target.value === '__new__') {
                            setIsNewRack(true);
                            setItemLocation('');
                          } else {
                            setIsNewRack(false);
                            setItemLocation(e.target.value);
                          }
                        }}
                        required={!isNewRack}
                        style={{ padding: '0.7rem 1rem' }}
                      >
                        {editExistingRacks.map(r => <option key={r} value={r}>{r}</option>)}
                        <option value="__new__">➕ Kedudukan Baru...</option>
                      </select>
                      {isNewRack && (
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Contoh: RAK-A1, RAK-B3"
                          value={newRackName}
                          onChange={(e) => setNewRackName(e.target.value)}
                          style={{ marginTop: '0.5rem', padding: '0.7rem 1rem' }}
                          required
                          autoFocus
                        />
                      )}
                    </div>
                  </div>

                  {/* ── 7, 8, 9. QTY + UNIT + MINIMA ─────── */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        7 · Kuantiti Baki *
                      </label>
                      <NumberInput
                        min="0"
                        className="input-field"
                        value={itemQty}
                        onChange={setItemQty}
                        required
                        style={{ padding: '0.7rem 1rem' }}
                      />
                      {itemQty !== '' && Number(itemQty) >= 0 && (
                        <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Asal: <strong style={{ color: '#f97316' }}>{selectedItem.quantity}</strong>
                          {' → '}
                          <strong style={{ color: 'var(--success)' }}>{itemQty}</strong> {itemUnit}
                        </div>
                      )}
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        8 · Unit *
                      </label>
                      <select
                        className="input-field"
                        value={itemUnit}
                        onChange={(e) => setItemUnit(e.target.value)}
                        style={{ padding: '0.7rem 1rem' }}
                      >
                        {['pcs','unit','roll','cm','m','kaki','kotak','carton','paket','botol','biji','keping','set'].map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        9 · Had Min *
                      </label>
                      <NumberInput
                        min="0"
                        className="input-field"
                        value={itemStokMinima}
                        onChange={setItemStokMinima}
                        required
                        style={{ padding: '0.7rem 1rem' }}
                      />
                    </div>
                  </div>
                </div>

                {/* ── Footer ───────────────────────────────── */}
                <div className="modal-footer" style={{ borderTop: '1px solid var(--card-border)', paddingTop: '0.85rem', marginTop: '0.25rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>
                    Batal
                  </button>
                  <button type="submit" className="btn" style={{
                    background: 'linear-gradient(135deg, #5b21b6, #7c3aed)',
                    boxShadow: '0 4px 15px rgba(124,58,237,0.35)',
                  }}>
                    ✏️ Simpan Perubahan
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Borrow / Usage Request Modal */}
      {isBorrowModalOpen && selectedItem && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h3>
                {selectedItem.kategori === 'peralatan' ? 'Borang Pinjaman Peralatan' : 'Borang Pengambilan Barang Luak'}
              </h3>
              <button className="btn-close" onClick={() => setIsBorrowModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleBorrowSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Dropdown Tukar/Pilih Alatan & Barang */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Pilih / Tukar Barang:
                </label>
                <select
                  className="input-field"
                  value={selectedItem.id}
                  onChange={(e) => {
                    const found = filteredItems.find(i => i.id === e.target.value);
                    if (found) {
                      handleOpenBorrowModal(found);
                    }
                  }}
                  style={{ padding: '0.65rem 1rem' }}
                >
                  {filteredItems.map(item => (
                    <option key={item.id} value={item.id} disabled={item.quantity === 0}>
                      {item.name} ({item.kategori === 'peralatan' ? '🔧 Peralatan' : '🧪 Barang Luak'}) — Baki: {item.quantity} {item.unit} {item.quantity === 0 ? '(Habis)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border)' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Item Dipilih:</p>
                <h4 style={{ fontSize: '1.15rem', color: 'var(--text-primary)' }}>{selectedItem.name}</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Baki Stok Sedia Ada: <strong>{selectedItem.quantity}</strong> {selectedItem.unit}
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Kategori: {selectedItem.kategori === 'peralatan' ? '🔧 Peralatan (Perlu Pulang)' : '🧪 Barang Luak (Tidak Perlu Pulang)'}
                </p>
              </div>

              <div className="form-group">
                <label>Kuantiti yang Diminta ({selectedItem.unit}) *</label>
                <NumberInput
                  min="1"
                  max={selectedItem.quantity}
                  className="input-field"
                  value={borrowQty}
                  onChange={setBorrowQty}
                  required
                />
              </div>

              {selectedItem.kategori === 'peralatan' ? (
                <div className="form-row">
                  <div className="form-group">
                    <label>Tarikh Mahu Pinjam *</label>
                    <input
                      type="date"
                      className="input-field"
                      value={borrowStartDate}
                      onChange={(e) => setBorrowStartDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Tarikh Jangka Pulang *</label>
                    <input
                      type="date"
                      className="input-field"
                      value={borrowReturnDate}
                      onChange={(e) => setBorrowReturnDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label>Tarikh Mahu Pakai *</label>
                  <input
                    type="date"
                    className="input-field"
                    value={borrowStartDate}
                    onChange={(e) => setBorrowStartDate(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label>Tujuan & Kelas/Destinasi *</label>
                <textarea
                  className="input-field"
                  rows={3}
                  placeholder={selectedItem.kategori === 'peralatan' ? "Contoh: Amali pendawaian di Makmal A oleh kelas DVM TPPU." : "Contoh: Untuk kegunaan cetakan kertas amali peperiksaan perniagaan kelas 2 SVM."}
                  value={borrowPurpose}
                  onChange={(e) => setBorrowPurpose(e.target.value)}
                  style={{ resize: 'none' }}
                  required
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsBorrowModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn" style={{ background: selectedItem.kategori === 'peralatan' ? '' : 'linear-gradient(135deg, var(--secondary), var(--secondary))' }}>
                  {selectedItem.kategori === 'peralatan' ? 'Hantar Permohonan Pinjam' : 'Minta Barang Luak'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {isImportModalOpen && (
        <ExcelImportModal onClose={() => setIsImportModalOpen(false)} />
      )}

      {/* Workshop Category Manager Modal */}
      <WorkshopCategoryManager
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        workshop={user.workshop}
        userRole={user.role}
        onCategoriesChange={(updated) => setWorkshopCategories(updated)}
      />

      {/* ── Pindah Stok Modal (Role-Based) ── */}
      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        item={selectedItem}
        initialTab={transferModalInitialTab}
      />

      {/* ── Modal Tambah Ahli Baru ── */}
      {isAddMemberModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddMemberModalOpen(false)}>
          <div
            className="glass-panel"
            style={{
              maxWidth: '480px',
              width: '95vw',
              padding: '1.75rem',
              animation: 'modalScale 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.4rem' }}>👥</span>
                <div>
                  <h2 className="modal-title" style={{ margin: 0, fontSize: '1.25rem' }}>Tambah Ahli Baru</h2>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Pendaftaran staf baharu untuk bengkel ini
                  </p>
                </div>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setIsAddMemberModalOpen(false)}>✕</button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                if (!newMemberName.trim()) {
                  alert('Sila masukkan nama penuh ahli!');
                  return;
                }
                if (!/^\d{4}$/.test(newMemberPin)) {
                  alert('Sila masukkan tepat 4 digit nombor untuk PIN!');
                  return;
                }
                const duplicate = userAccounts.some(
                  u => u.name.trim().toLowerCase() === newMemberName.trim().toLowerCase() && u.workshop === user.workshop
                );
                if (duplicate) {
                  alert(`Akaun untuk "${newMemberName.trim()}" telah pun wujud dalam ${user.workshop}!`);
                  return;
                }

                addUserAccount({
                  name: newMemberName.trim(),
                  role: newMemberRole,
                  workshop: user.workshop,
                  pin: newMemberPin
                });

                alert(`Ahli baharu "${newMemberName.trim()}" berjaya didaftarkan!`);
                setIsAddMemberModalOpen(false);
                setNewMemberName('');
                setNewMemberPin('1234');
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}
            >
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.88rem', fontWeight: 600 }}>
                  Nama Penuh Pensyarah / Staf <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newMemberName}
                  onChange={e => setNewMemberName(e.target.value)}
                  placeholder="Contoh: Ts. Dr. Siti Aminah"
                  className="input-field"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.88rem', fontWeight: 600 }}>
                  Peranan
                </label>
                <select
                  value={newMemberRole}
                  onChange={e => setNewMemberRole(e.target.value as any)}
                  className="input-field"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="Pensyarah">👨‍🏫 Pensyarah</option>
                  <option value="PIC">🛡️ PIC (Person In Charge)</option>
                  <option value="Ketua Bengkel">👑 Ketua Bengkel</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.88rem', fontWeight: 600 }}>
                  PIN 4-Digit (Lalai: 1234) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={newMemberPin}
                  onChange={e => setNewMemberPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="1234"
                  className="input-field"
                  style={{ width: '100%', boxSizing: 'border-box', letterSpacing: '0.25em' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>
                  Hanya 4 digit angka dibenarkan untuk PIN akses.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.88rem', fontWeight: 600 }}>
                  Bengkel (Ditetapkan Mengikut Bengkel Semasa)
                </label>
                <input
                  type="text"
                  disabled
                  value={user.workshop}
                  className="input-field"
                  style={{ width: '100%', boxSizing: 'border-box', opacity: 0.7, cursor: 'not-allowed', background: 'rgba(255,255,255,0.05)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddMemberModalOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ fontWeight: 600 }}
                >
                  Daftar Ahli
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Tukar PIN Ahli ── */}
      {editingMember && (
        <div className="modal-overlay" onClick={() => setEditingMember(null)}>
          <div
            className="glass-panel"
            style={{
              maxWidth: '420px',
              width: '95vw',
              padding: '1.75rem',
              animation: 'modalScale 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.4rem' }}>🔑</span>
                <div>
                  <h2 className="modal-title" style={{ margin: 0, fontSize: '1.15rem' }}>Tukar PIN Ahli</h2>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {editingMember.name} ({editingMember.role})
                  </p>
                </div>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setEditingMember(null)}>✕</button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                if (!/^\d{4}$/.test(editMemberPin)) {
                  alert('Sila masukkan tepat 4 digit nombor untuk PIN baharu!');
                  return;
                }
                updateUserPin(editingMember.id, editMemberPin);
                alert(`PIN bagi akaun ${editingMember.name} berjaya dikemaskini!`);
                setEditingMember(null);
                setEditMemberPin('');
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}
            >
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.88rem', fontWeight: 600 }}>
                  PIN Baharu (4-Digit) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={editMemberPin}
                  onChange={e => setEditMemberPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="input-field"
                  style={{ width: '100%', boxSizing: 'border-box', letterSpacing: '0.25em', fontSize: '1.1rem' }}
                  autoFocus
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.35rem' }}>
                  Masukkan 4 digit angka nombor untuk PIN baharu pengguna ini.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingMember(null)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ fontWeight: 600 }}
                >
                  Simpan PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Phones & Small Tablets) */}
      <nav className="mobile-bottom-nav" aria-label="Navigasi Mudah Alih">
        <button
          type="button"
          className={`mobile-bottom-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => navigateTab('dashboard')}
        >
          <span className="bottom-icon">📊</span>
          <span>Ringkasan</span>
        </button>

        <button
          type="button"
          className={`mobile-bottom-item ${activeTab === 'inventori' ? 'active' : ''}`}
          onClick={() => navigateTab('inventori')}
        >
          <span className="bottom-icon">📦</span>
          <span>Inventori</span>
          <span className="mobile-bottom-badge" style={{ backgroundColor: 'var(--primary)' }}>
            {totalItemTypes}
          </span>
        </button>

        <button
          type="button"
          className={`mobile-bottom-item ${activeTab === 'pinjam' ? 'active' : ''}`}
          onClick={() => {
            navigateTab('pinjam');
            setPinjamActiveSubTab('aktif');
          }}
        >
          <span className="bottom-icon">🔄</span>
          <span>Pinjam</span>
          {pendingApprovals.length > 0 && (user.role === 'Ketua Bengkel' || user.role === 'PIC') && (
            <span className="mobile-bottom-badge">
              {pendingApprovals.length}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`mobile-bottom-item ${activeTab === 'sejarah' ? 'active' : ''}`}
          onClick={() => {
            navigateTab('sejarah');
            const now = Date.now();
            setLastViewedAuditLog(now);
            localStorage.setItem(auditLogStorageKey, String(now));
          }}
        >
          <span className="bottom-icon">📜</span>
          <span>Sejarah</span>
          {unreadAuditLogsCount > 0 && (
            <span className="mobile-bottom-badge">
              {unreadAuditLogsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`mobile-bottom-item ${isMobileMenuOpen || activeTab === 'notifikasi' || activeTab === 'ahli' || activeTab === 'tetapan' ? 'active' : ''}`}
          onClick={() => setIsMobileMenuOpen(prev => !prev)}
        >
          <span className="bottom-icon">☰</span>
          <span>Menu</span>
          {filteredNotifications.length > 0 && (
            <span className="mobile-bottom-badge" style={{ backgroundColor: 'var(--accent)' }}>
              {filteredNotifications.length}
            </span>
          )}
        </button>
      </nav>
    </div>
  );
};
