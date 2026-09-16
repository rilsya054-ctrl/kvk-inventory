import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, InventoryItem, Transaction, Notification, UserRole, WorkshopType, AuditLog, AuditLogType, PendingTransfer, UserAccount, OrganizationSettings } from '../types';
import { WORKSHOP_STORES, STOR_INDUK, defaultOrgSettings } from '../types';

interface InventoryContextType {
  user: User | null;
  userAccounts: UserAccount[];
  orgSettings: OrganizationSettings;
  items: InventoryItem[];
  transactions: Transaction[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  pendingTransfers: PendingTransfer[];
  registerUser: (name: string, role: UserRole, workshop: WorkshopType) => void;
  loginWithPin: (name: string, pin: string) => { success: boolean; message?: string };
  registerNewAccount: (name: string, role: UserRole, workshop: WorkshopType, pin: string) => { success: boolean; message?: string };
  addUserAccount: (account: Omit<UserAccount, 'id' | 'registeredAt'>) => { success: boolean; message?: string };
  updateUserPin: (id: string, newPin: string) => void;
  deleteUserAccount: (id: string) => void;
  updateOrgSettings: (settings: Partial<OrganizationSettings>) => void;
  updateUserProfile: (newName: string, newPin?: string, avatarUrl?: string) => { success: boolean; message?: string };
  selectStore: (storeName: string) => void;
  logout: () => void;
  addItem: (item: Omit<InventoryItem, 'id' | 'store' | 'workshop' | 'totalQuantity'> & { totalQuantity?: number }) => void;
  updateItem: (item: InventoryItem, oldQuantity?: number) => void;
  deleteItem: (id: string, catatan?: string) => void;
  requestBorrow: (itemId: string, quantity: number, purpose: string, tarikhJangkaPulang?: string, tarikhMahuPinjam?: string) => void;
  approveTransaction: (id: string) => void;
  rejectTransaction: (id: string) => void;
  returnItems: (id: string) => void;
  clearNotifications: () => void;
  transferStock: (sourceItemId: string, targetStore: string, quantity: number, catatan?: string) => void;
  requestTransfer: (sourceItemId: string, targetStore: string, quantity: number, catatan?: string) => void;
  approveTransfer: (transferId: string) => void;
  rejectTransfer: (transferId: string) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Mock initial data
const initialMockItems: InventoryItem[] = [
  // Perakaunan
  { id: 'pa-1', name: 'Fail Akruan Hasil 2025', brand: 'Abba', sku: 'AB-FA-01', quantity: 15, totalQuantity: 15, store: 'Stor Makmal Perakaunan 1', workshop: 'Perakaunan', location: 'Rak A-1', kategori: 'peralatan', unit: 'unit', stokMinima: 5 },
  { id: 'pa-2', name: 'Fail Pemiutang Tempatan', brand: 'Lion', sku: 'LN-FP-02', quantity: 20, totalQuantity: 20, store: 'Stor Makmal Perakaunan 1', workshop: 'Perakaunan', location: 'Rak A-2', kategori: 'peralatan', unit: 'unit', stokMinima: 5 },
  { id: 'pa-3', name: 'Laptop Dell Latitude 3420', brand: 'Dell', sku: 'DELL-LAT-3420', quantity: 8, totalQuantity: 8, store: 'Stor Makmal Perakaunan 2', workshop: 'Perakaunan', location: 'Rak B-1', kategori: 'peralatan', unit: 'unit', stokMinima: 2 },
  { id: 'pa-4', name: 'Kalkulator Saintifik 570MS', brand: 'Casio', sku: 'CAS-570MS', quantity: 30, totalQuantity: 30, store: 'Stor Makmal Perakaunan 2', workshop: 'Perakaunan', location: 'Kabinet C', kategori: 'peralatan', unit: 'unit', stokMinima: 5 },
  { id: 'pa-5', name: 'Kertas A4 Double A 80gsm', brand: 'Double A', sku: 'DBP-PA-T4', quantity: 50, totalQuantity: 50, store: 'Stor Makmal Perakaunan 2', workshop: 'Perakaunan', location: 'Rak D-1', kategori: 'habis_pakai', unit: 'kotak', stokMinima: 10 },

  // PPU
  { id: 'ppu-1', name: 'Leak Detector Refrigerant Gas', brand: 'Inficon', sku: 'INF-LD-01', quantity: 4, totalQuantity: 4, store: 'Stor Bengkel PPU 1', workshop: 'Teknologi Penyejukan dan Penyamanan Udara', location: 'Rak Logam 1', kategori: 'peralatan', unit: 'unit', stokMinima: 2 },
  { id: 'ppu-2', name: 'Kompresor 1.5 HP R32', brand: 'Panasonic', sku: 'PAN-COMP-1.5', quantity: 6, totalQuantity: 6, store: 'Stor Bengkel PPU 2', workshop: 'Teknologi Penyejukan dan Penyamanan Udara', location: 'Rak Logam 2', kategori: 'peralatan', unit: 'unit', stokMinima: 2 },
  { id: 'ppu-3', name: 'Tiub Kuprum 1/4" (30m Roll)', brand: 'Kembla', sku: 'KEM-TUBE-14', quantity: 10, totalQuantity: 10, store: 'Stor Bengkel PPU 3', workshop: 'Teknologi Penyejukan dan Penyamanan Udara', location: 'Rak Gantung', kategori: 'habis_pakai', unit: 'roll', stokMinima: 3 },
  { id: 'ppu-4', name: 'Tong Gas R32 (9.5kg)', brand: 'Daikin', sku: 'DAI-GAS-R32', quantity: 3, totalQuantity: 3, store: 'Stor Bengkel PPU 4', workshop: 'Teknologi Penyejukan dan Penyamanan Udara', location: 'Kawasan Bahan Kimia', kategori: 'habis_pakai', unit: 'tong', stokMinima: 1 },

  // Automotif
  { id: 'auto-1', name: 'Enjin Toyota 1NZ-FE (Cut Section)', brand: 'Toyota', sku: 'TOY-1NZ-CUT', quantity: 2, totalQuantity: 2, store: 'Stor Bengkel Automotif 1', workshop: 'Teknologi Automotif', location: 'Tengah Bengkel', kategori: 'peralatan', unit: 'unit', stokMinima: 1 },
  { id: 'auto-2', name: 'Tayar Michelin Primacy 4 205/55R16', brand: 'Michelin', sku: 'MICH-P4-205', quantity: 12, totalQuantity: 12, store: 'Stor Bengkel SLDN 2', workshop: 'Teknologi Automotif', location: 'Rak Tayar A', kategori: 'habis_pakai', unit: 'biji', stokMinima: 4 },
  { id: 'auto-3', name: 'Set Soket & Sepana 120-pcs', brand: 'SATA', sku: 'SATA-SET-120', quantity: 5, totalQuantity: 5, store: 'Stor Bengkel Automotif 3', workshop: 'Teknologi Automotif', location: 'Troli Alatan 1', kategori: 'peralatan', unit: 'set', stokMinima: 2 },
  { id: 'auto-4', name: 'Air Impact Wrench 1/2"', brand: 'Ingersoll Rand', sku: 'IR-IW-12', quantity: 4, totalQuantity: 4, store: 'Stor Bengkel Automotif 4', workshop: 'Teknologi Automotif', location: 'Troli Alatan 2', kategori: 'peralatan', unit: 'unit', stokMinima: 2 },

  // Pengurusan Perniagaan
  { id: 'pp-1', name: 'Kertas A4 Double A 80gsm', brand: 'Double A', sku: 'DA-A4-80', quantity: 45, totalQuantity: 45, store: 'Stor PPN Aras 1', workshop: 'Pengurusan Perniagaan', location: 'Almari Alat Tulis', kategori: 'habis_pakai', unit: 'kotak', stokMinima: 10 },
  { id: 'pp-2', name: 'Projektor EPSON EB-X06', brand: 'Epson', sku: 'EPS-EBX06', quantity: 6, totalQuantity: 6, store: 'Stor PPN Aras 2', workshop: 'Pengurusan Perniagaan', location: 'Almari Projektor', kategori: 'peralatan', unit: 'unit', stokMinima: 2 },
  { id: 'pp-3', name: 'Fail Putih Tebal 3 Inci', brand: 'Lion', sku: 'LN-FB-3', quantity: 100, totalQuantity: 100, store: 'Stor PPN Aras 3', workshop: 'Pengurusan Perniagaan', location: 'Rak Fail Besar', kategori: 'habis_pakai', unit: 'keping', stokMinima: 20 }
];

// Initial mock registered accounts with 4-digit PINs (default "1234")
const initialMockUsers: UserAccount[] = [
  // Teknologi Automotif
  { id: 'usr-auto-1', name: 'Ts. Khairul Nizam', role: 'Ketua Bengkel', workshop: 'Teknologi Automotif', pin: '1234', registeredAt: '12/01/2026' },
  { id: 'usr-auto-2', name: 'Encik Razak Abdullah', role: 'PIC', workshop: 'Teknologi Automotif', pin: '1234', registeredAt: '15/01/2026' },
  { id: 'usr-auto-3', name: 'Encik Hafiz Rahman', role: 'Pensyarah', workshop: 'Teknologi Automotif', pin: '1234', registeredAt: '20/01/2026' },
  { id: 'usr-auto-4', name: 'Encik Shahril Azman', role: 'Pensyarah', workshop: 'Teknologi Automotif', pin: '1234', registeredAt: '25/01/2026' },

  // Teknologi Penyejukan dan Penyamanan Udara (TPPU)
  { id: 'usr-ppu-1', name: 'Encik Kamarul Ariffin', role: 'Ketua Bengkel', workshop: 'Teknologi Penyejukan dan Penyamanan Udara', pin: '1234', registeredAt: '10/01/2026' },
  { id: 'usr-ppu-2', name: 'Encik Azman Ismail', role: 'PIC', workshop: 'Teknologi Penyejukan dan Penyamanan Udara', pin: '1234', registeredAt: '14/01/2026' },
  { id: 'usr-ppu-3', name: 'Encik Mohd Firdaus', role: 'Pensyarah', workshop: 'Teknologi Penyejukan dan Penyamanan Udara', pin: '1234', registeredAt: '18/01/2026' },
  { id: 'usr-ppu-4', name: 'Puan Rohaya Bakar', role: 'Pensyarah', workshop: 'Teknologi Penyejukan dan Penyamanan Udara', pin: '1234', registeredAt: '22/01/2026' },

  // Perakaunan
  { id: 'usr-pa-1', name: 'Cikgu Nurul Huda', role: 'Ketua Bengkel', workshop: 'Perakaunan', pin: '1234', registeredAt: '05/01/2026' },
  { id: 'usr-pa-2', name: 'Puan Siti Fatimah', role: 'PIC', workshop: 'Perakaunan', pin: '1234', registeredAt: '08/01/2026' },
  { id: 'usr-pa-3', name: 'Encik Ahmad Zaki', role: 'Pensyarah', workshop: 'Perakaunan', pin: '1234', registeredAt: '12/01/2026' },
  { id: 'usr-pa-4', name: 'Puan Noraini Hashim', role: 'Pensyarah', workshop: 'Perakaunan', pin: '1234', registeredAt: '19/01/2026' },

  // Pengurusan Perniagaan
  { id: 'usr-pp-1', name: 'Dr. Zaidah binti Mansor', role: 'Ketua Bengkel', workshop: 'Pengurusan Perniagaan', pin: '1234', registeredAt: '03/01/2026' },
  { id: 'usr-pp-2', name: 'Puan Salmah Idris', role: 'PIC', workshop: 'Pengurusan Perniagaan', pin: '1234', registeredAt: '07/01/2026' },
  { id: 'usr-pp-3', name: 'Encik Yusof Ghazali', role: 'Pensyarah', workshop: 'Pengurusan Perniagaan', pin: '1234', registeredAt: '15/01/2026' },
];

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('kv_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [userAccounts, setUserAccounts] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem('kv_user_accounts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // fallback
      }
    }
    return initialMockUsers;
  });

  const [items, setItems] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem('kv_inventory_items');
    return saved ? JSON.parse(saved) : initialMockItems;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('kv_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const saved = localStorage.getItem('kv_notifications');
    return saved ? JSON.parse(saved) : [];
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('kv_audit_logs');
    return saved ? JSON.parse(saved) : [];
  });

  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>(() => {
    const saved = localStorage.getItem('kv_pending_transfers');
    return saved ? JSON.parse(saved) : [];
  });

  const [orgSettings, setOrgSettings] = useState<OrganizationSettings>(() => {
    const saved = localStorage.getItem('kv_organization_settings');
    if (saved) {
      try {
        return { ...defaultOrgSettings, ...JSON.parse(saved) };
      } catch {
        // fallback
      }
    }
    return defaultOrgSettings;
  });

  useEffect(() => {
    localStorage.setItem('kv_organization_settings', JSON.stringify(orgSettings));
  }, [orgSettings]);

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('kv_user', user ? JSON.stringify(user) : '');
  }, [user]);

  useEffect(() => {
    localStorage.setItem('kv_user_accounts', JSON.stringify(userAccounts));
  }, [userAccounts]);

  useEffect(() => {
    localStorage.setItem('kv_inventory_items', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('kv_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('kv_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('kv_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem('kv_pending_transfers', JSON.stringify(pendingTransfers));
  }, [pendingTransfers]);

  // Keep user and userAccounts avatar synchronized
  useEffect(() => {
    if (user && user.avatarUrl) {
      setUserAccounts(prev => {
        const account = prev.find(
          acc => (user.id && acc.id === user.id) ||
                 (acc.name.toLowerCase().trim() === user.name.toLowerCase().trim() && acc.workshop === user.workshop)
        );
        if (account && account.avatarUrl !== user.avatarUrl) {
          const updated = prev.map(acc => {
            if ((user.id && acc.id === user.id) ||
                (acc.name.toLowerCase().trim() === user.name.toLowerCase().trim() && acc.workshop === user.workshop)) {
              return { ...acc, avatarUrl: user.avatarUrl };
            }
            return acc;
          });
          localStorage.setItem('kv_user_accounts', JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
    } else if (user && !user.avatarUrl) {
      const account = userAccounts.find(
        acc => (user.id && acc.id === user.id) ||
               (acc.name.toLowerCase().trim() === user.name.toLowerCase().trim() && acc.workshop === user.workshop)
      );
      if (account?.avatarUrl) {
        setUser(prev => prev ? { ...prev, avatarUrl: account.avatarUrl } : null);
      }
    }
  }, [user, userAccounts]);

  // ── Central Audit Log Utility ─────────────────────────────────────────────
  const addAuditLog = (
    type: AuditLogType,
    item: Pick<InventoryItem, 'name' | 'sku' | 'store' | 'workshop' | 'unit'>,
    details: {
      quantity: number;
      oldQuantity?: number;
      targetStore?: string;
      catatan?: string;
    }
  ) => {
    if (!user) return;
    const now = new Date();
    const timestamp =
      now.toLocaleDateString('ms-MY', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' +
      now.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
    const log: AuditLog = {
      id: generateId(),
      timestamp,
      createdAt: now.getTime(),
      type,
      itemName: item.name,
      sku: item.sku,
      store: item.store,
      targetStore: details.targetStore,
      workshop: item.workshop,
      quantity: details.quantity,
      unit: item.unit,
      oldQuantity: details.oldQuantity,
      performedBy: user.name,
      performedByRole: user.role,
      catatan: details.catatan,
    };
    setAuditLogs(prev => [log, ...prev]);
  };

  // Auth actions
  const registerUser = (name: string, role: UserRole, workshop: WorkshopType) => {
    const existing = userAccounts.find(
      u => u.name.toLowerCase().trim() === name.toLowerCase().trim() && u.workshop === workshop
    );
    setUser({
      id: existing?.id,
      name,
      role,
      workshop,
      selectedStore: '',
      avatarUrl: existing?.avatarUrl,
    });
  };

  const selectStore = (storeName: string) => {
    if (user) {
      setUser({ ...user, selectedStore: storeName });
    }
  };

  const logout = () => {
    setUser(null);
  };

  const loginWithPin = (name: string, pin: string): { success: boolean; message?: string } => {
    const account = userAccounts.find(u => u.name.toLowerCase().trim() === name.toLowerCase().trim());
    if (!account) {
      return { success: false, message: 'Nama pengguna tidak dijumpai dalam senarai sistem.' };
    }
    if (account.pin !== pin) {
      return { success: false, message: 'PIN 4-Digit tidak tepat. Sila cuba lagi.' };
    }
    const stores = WORKSHOP_STORES[account.workshop] || [];
    const defaultStore = account.role === 'Ketua Bengkel' ? STOR_INDUK : (stores[0] || '');
    setUser({
      id: account.id,
      name: account.name,
      role: account.role,
      workshop: account.workshop,
      selectedStore: defaultStore,
      avatarUrl: account.avatarUrl,
    });
    return { success: true };
  };

  const registerNewAccount = (
    name: string,
    role: UserRole,
    workshop: WorkshopType,
    pin: string
  ): { success: boolean; message?: string } => {
    const trimmed = name.trim();
    if (!trimmed) return { success: false, message: 'Sila masukkan nama penuh anda.' };
    if (!/^\d{4}$/.test(pin)) return { success: false, message: 'PIN mestilah 4 digit nombor.' };
    const exists = userAccounts.some(u => u.name.toLowerCase().trim() === trimmed.toLowerCase());
    if (exists) return { success: false, message: 'Nama ini telah pun didaftarkan dalam sistem.' };

    const now = new Date();
    const dateStr = now.toLocaleDateString('ms-MY', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const newAcc: UserAccount = {
      id: generateId(),
      name: trimmed,
      role,
      workshop,
      pin,
      registeredAt: dateStr,
    };
    const nextAccounts = [newAcc, ...userAccounts];
    setUserAccounts(nextAccounts);
    localStorage.setItem('kv_user_accounts', JSON.stringify(nextAccounts));

    const stores = WORKSHOP_STORES[workshop] || [];
    const defaultStore = role === 'Ketua Bengkel' ? STOR_INDUK : (stores[0] || '');
    const newUser: User = {
      id: newAcc.id,
      name: newAcc.name,
      role: newAcc.role,
      workshop: newAcc.workshop,
      selectedStore: defaultStore,
      avatarUrl: newAcc.avatarUrl,
    };
    setUser(newUser);
    localStorage.setItem('kv_user', JSON.stringify(newUser));

    return { success: true };
  };

  const addUserAccount = (
    accountData: Omit<UserAccount, 'id' | 'registeredAt'>
  ): { success: boolean; message?: string } => {
    const trimmed = accountData.name.trim();
    if (!trimmed) return { success: false, message: 'Sila masukkan nama penuh ahli.' };
    if (!/^\d{4}$/.test(accountData.pin)) return { success: false, message: 'PIN mestilah 4 digit nombor.' };
    const exists = userAccounts.some(u => u.name.toLowerCase().trim() === trimmed.toLowerCase());
    if (exists) return { success: false, message: 'Nama ahli ini telah didaftarkan sebelum ini.' };

    const now = new Date();
    const dateStr = now.toLocaleDateString('ms-MY', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const newAcc: UserAccount = {
      id: generateId(),
      name: trimmed,
      role: accountData.role,
      workshop: accountData.workshop,
      pin: accountData.pin,
      avatarUrl: accountData.avatarUrl,
      registeredAt: dateStr,
    };
    const nextAccounts = [newAcc, ...userAccounts];
    setUserAccounts(nextAccounts);
    localStorage.setItem('kv_user_accounts', JSON.stringify(nextAccounts));
    return { success: true };
  };

  const updateUserPin = (id: string, newPin: string) => {
    setUserAccounts(prev => {
      const next = prev.map(u => u.id === id ? { ...u, pin: newPin } : u);
      localStorage.setItem('kv_user_accounts', JSON.stringify(next));
      return next;
    });
  };

  const deleteUserAccount = (id: string) => {
    setUserAccounts(prev => {
      const next = prev.filter(u => u.id !== id);
      localStorage.setItem('kv_user_accounts', JSON.stringify(next));
      return next;
    });
  };

  const updateOrgSettings = (newSettings: Partial<OrganizationSettings>) => {
    setOrgSettings(prev => ({ ...prev, ...newSettings }));
  };

  const updateUserProfile = (
    newName: string,
    newPin?: string,
    avatarUrl?: string
  ): { success: boolean; message?: string } => {
    if (!user) return { success: false, message: 'Tiada pengguna aktif log masuk.' };
    const trimmed = newName.trim();
    if (!trimmed) return { success: false, message: 'Sila masukkan nama penuh.' };

    const oldName = user.name;
    const resolvedAvatar = avatarUrl !== undefined ? avatarUrl : user.avatarUrl;
    const updatedUser: User = {
      ...user,
      name: trimmed,
      avatarUrl: resolvedAvatar,
    };
    setUser(updatedUser);
    localStorage.setItem('kv_user', JSON.stringify(updatedUser));

    // Update in userAccounts as well
    const updatedAccounts = userAccounts.map(acc => {
      const isMatch =
        (user.id && acc.id === user.id) ||
        (acc.name.toLowerCase().trim() === oldName.toLowerCase().trim() && acc.workshop === user.workshop);
      if (isMatch) {
        return {
          ...acc,
          name: trimmed,
          pin: newPin ? newPin : acc.pin,
          avatarUrl: resolvedAvatar,
        };
      }
      return acc;
    });

    setUserAccounts(updatedAccounts);
    localStorage.setItem('kv_user_accounts', JSON.stringify(updatedAccounts));

    return { success: true };
  };

  // Helper to add notification
  const addNotification = (message: string, type: Notification['type'], store: string, workshop: WorkshopType) => {
    const newNotif: Notification = {
      id: generateId(),
      message,
      timestamp: new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + new Date().toLocaleDateString('ms-MY'),
      type,
      store,
      workshop
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  // Inventory CRUD
  const addItem = (newItemData: Omit<InventoryItem, 'id' | 'store' | 'workshop' | 'totalQuantity'> & { totalQuantity?: number }) => {
    if (!user || !user.selectedStore) return;
    const newItem: InventoryItem = {
      ...newItemData,
      id: generateId(),
      store: user.selectedStore,
      workshop: user.workshop,
      totalQuantity: newItemData.totalQuantity !== undefined ? newItemData.totalQuantity : newItemData.quantity
    };
    setItems(prev => [...prev, newItem]);
    addNotification(
      `[BARANG BARU] ${user.name} (${user.role}) menambah ${newItem.name} (Kuantiti: ${newItem.quantity} ${newItem.unit}) ke dalam ${user.selectedStore}.`,
      'tambah',
      user.selectedStore,
      user.workshop
    );
    addAuditLog('TAMBAH', newItem, { quantity: newItem.quantity });
  };

  const updateItem = (updatedItem: InventoryItem, oldQuantity?: number) => {
    setItems(prev => prev.map(item => (item.id === updatedItem.id ? updatedItem : item)));

    // Check for low stock notification
    if (updatedItem.quantity <= updatedItem.stokMinima) {
      addNotification(
        `[STOK RENDAH] Barang "${updatedItem.name}" hanya tinggal ${updatedItem.quantity} ${updatedItem.unit} di ${updatedItem.store}! (Had Minima: ${updatedItem.stokMinima})`,
        'stok_rendah',
        updatedItem.store,
        updatedItem.workshop
      );
    } else {
      addNotification(
        `[KEMAS KINI] ${user?.name || 'Sistem'} mengemas kini barang "${updatedItem.name}".`,
        'tambah',
        updatedItem.store,
        updatedItem.workshop
      );
    }
    addAuditLog('KEMASKINI', updatedItem, { quantity: updatedItem.quantity, oldQuantity });
  };

  const deleteItem = (id: string, catatan?: string) => {
    const itemToDelete = items.find(i => i.id === id);
    if (!itemToDelete) return;
    setItems(prev => prev.filter(item => item.id !== id));
    addNotification(
      `[PADAM] ${user?.name || 'Sistem'} memadam barang "${itemToDelete.name}" daripada ${itemToDelete.store}.`,
      'stok_rendah',
      itemToDelete.store,
      itemToDelete.workshop
    );
    addAuditLog('PADAM', itemToDelete, { quantity: itemToDelete.quantity, catatan });
  };

  // Borrowing / usage workflow
  const requestBorrow = (itemId: string, quantity: number, purpose: string, tarikhJangkaPulang?: string, tarikhMahuPinjam?: string) => {
    if (!user || !user.selectedStore) return;
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const isBarangLuak = item.kategori === 'habis_pakai';
    const newTransaction: Transaction = {
      id: generateId(),
      itemId,
      itemName: item.name,
      store: user.selectedStore,
      workshop: user.workshop,
      borrowerName: user.name,
      borrowerRole: user.role,
      quantity,
      purpose,
      dateBorrowed: new Date().toLocaleDateString('ms-MY') + ' ' + new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }),
      tarikhJangkaPulang: isBarangLuak ? undefined : tarikhJangkaPulang,
      tarikhMahuPinjam,
      status: 'Menunggu Kelulusan',
      kategori: item.kategori
    };

    setTransactions(prev => [newTransaction, ...prev]);

    addNotification(
      `[${isBarangLuak ? 'PENGAMBILAN' : 'PINJAMAN'}] Permohonan ${isBarangLuak ? 'ambil' : 'pinjam'} "${item.name}" (${quantity} ${item.unit}) oleh ${user.role} ${user.name} sedang menunggu kelulusan Ketua Bengkel.`,
      'pinjam',
      user.selectedStore,
      user.workshop
    );
  };

  const approveTransaction = (id: string) => {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    // Check inventory quantity
    const item = items.find(i => i.id === transaction.itemId);
    if (!item) {
      alert('Ralat: Barang tidak dijumpai dalam stor.');
      return;
    }

    if (item.quantity < transaction.quantity) {
      alert('Ralat: Kuantiti barang dalam stor tidak mencukupi untuk kelulusan.');
      return;
    }

    const isBarangLuak = item.kategori === 'habis_pakai' || transaction.kategori === 'habis_pakai';

    // Deduct stock quantity (stok_semasa)
    const updatedItem: InventoryItem = {
      ...item,
      quantity: item.quantity - transaction.quantity
    };

    setItems(prev => prev.map(i => (i.id === item.id ? updatedItem : i)));
    setTransactions(prev =>
      prev.map(t =>
        t.id === id
          ? {
              ...t,
              status: isBarangLuak ? 'Telah Diambil' : 'Diluluskan',
              dateReturned: isBarangLuak ? undefined : t.dateReturned
            }
          : t
      )
    );

    const isLapse = item.kategori === 'habis_pakai';
    addNotification(
      `[${isLapse ? 'DIAMBIL' : 'DILULUSKAN'}] Permohonan ${isLapse ? 'ambil' : 'pinjam'} "${transaction.itemName}" oleh ${transaction.borrowerName} telah diluluskan oleh Ketua Bengkel.`,
      'lulus',
      transaction.store,
      transaction.workshop
    );

    // Trigger warning if stock falls low after approval
    if (updatedItem.quantity <= updatedItem.stokMinima) {
      addNotification(
        `[STOK RENDAH] Amaran! Stok "${updatedItem.name}" tinggal ${updatedItem.quantity} ${updatedItem.unit} (Stok minima: ${updatedItem.stokMinima}).`,
        'stok_rendah',
        updatedItem.store,
        updatedItem.workshop
      );
    }
  };

  const rejectTransaction = (id: string) => {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    setTransactions(prev =>
      prev.map(t => (t.id === id ? { ...t, status: 'Ditolak' } : t))
    );

    addNotification(
      `[DITOLAK] Permohonan "${transaction.itemName}" oleh ${transaction.borrowerName} ditolak oleh Ketua Bengkel.`,
      'stok_rendah',
      transaction.store,
      transaction.workshop
    );
  };

  const returnItems = (id: string) => {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    const item = items.find(i => i.id === transaction.itemId);
    if (!item) return;

    // Only Peralatan can be returned
    if (item.kategori === 'habis_pakai') return;

    // Restore stock quantity
    const updatedItem = {
      ...item,
      quantity: item.quantity + transaction.quantity
    };

    setItems(prev => prev.map(i => (i.id === item.id ? updatedItem : i)));
    setTransactions(prev =>
      prev.map(t =>
        t.id === id
          ? {
              ...t,
              status: 'Telah Dipulangkan',
              dateReturned: new Date().toLocaleDateString('ms-MY') + ' ' + new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })
            }
          : t
      )
    );

    addNotification(
      `[PEMULANGAN] Peralatan "${transaction.itemName}" (${transaction.quantity} ${item.unit}) dipulangkan oleh ${transaction.borrowerName}.`,
      'pulang',
      transaction.store,
      transaction.workshop
    );
  };

  const clearNotifications = () => {
    if (!user) return;
    setNotifications(prev => prev.filter(n => !(n.store === user.selectedStore && n.workshop === user.workshop)));
  };

  const transferStock = (sourceItemId: string, targetStore: string, quantity: number, catatan?: string) => {
    if (!user) return;

    setItems(prev => {
      const source = prev.find(i => i.id === sourceItemId);
      if (!source || quantity <= 0 || quantity > source.quantity) return prev;

      // 1. Deduct from source — ONLY reduce `quantity` (baki), `totalQuantity` (jumlah asal) KEKAL
      const updatedSource: InventoryItem = {
        ...source,
        quantity: Math.max(0, source.quantity - quantity),
        // totalQuantity (jumlah/kapasiti) KEKAL TIDAK BERUBAH di stor asal
      };

      // 2. Try to find existing matching item in target store (same SKU)
      const existingTarget = prev.find(
        i => i.store === targetStore && i.workshop === source.workshop && i.sku === source.sku
      );

      let nextItems: InventoryItem[];
      if (existingTarget) {
        // Upsert: Tambah baki (quantity) & selaraskan jumlah (totalQuantity) supaya totalQuantity >= quantity
        const newQuantity = existingTarget.quantity + quantity;
        const newTotalQuantity = Math.max(existingTarget.totalQuantity + quantity, newQuantity);

        nextItems = prev.map(i => {
          if (i.id === sourceItemId) return updatedSource;
          if (i.id === existingTarget.id) return {
            ...existingTarget,
            quantity: newQuantity,
            totalQuantity: newTotalQuantity,
          };
          return i;
        });
      } else {
        // Insert: create new item entry in target store with initial quantity & totalQuantity
        const newTargetItem: InventoryItem = {
          ...source,
          id: generateId(),
          store: targetStore,
          quantity,
          totalQuantity: quantity,
        };
        nextItems = prev.map(i => i.id === sourceItemId ? updatedSource : i);
        nextItems = [...nextItems, newTargetItem];
      }

      return nextItems;
    });

    // Notifications — run after state update (use current snapshot for names)
    const source = items.find(i => i.id === sourceItemId);
    if (!source) return;
    const catatanStr = catatan ? ` | Catatan: ${catatan}` : '';
    addNotification(
      `[PINDAH STOK] ${user.name} memindahkan ${quantity} ${source.unit} "${source.name}" daripada ${source.store} → ${targetStore}.${catatanStr}`,
      'tambah',
      source.store,
      source.workshop
    );
    addNotification(
      `[PINDAH STOK MASUK] ${quantity} ${source.unit} "${source.name}" diterima daripada ${source.store}.${catatanStr}`,
      'tambah',
      targetStore,
      source.workshop
    );
    addAuditLog('PINDAH', source, { quantity, targetStore, catatan });
  };

  // ── PIC: Hantar Permohonan Pindahan (tiada potongan stok) ────────────────
  const requestTransfer = (sourceItemId: string, targetStore: string, quantity: number, catatan?: string) => {
    if (!user) return;
    const source = items.find(i => i.id === sourceItemId);
    if (!source || quantity <= 0 || quantity > source.quantity) return;

    const now = new Date();
    const timestamp =
      now.toLocaleDateString('ms-MY', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' +
      now.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });

    const transfer: PendingTransfer = {
      id: generateId(),
      timestamp,
      sourceItemId,
      sourceItemName: source.name,
      sourceSku: source.sku,
      sourceStore: source.store,
      targetStore,
      workshop: source.workshop,
      quantity,
      unit: source.unit,
      requestedBy: user.name,
      requestedByRole: user.role,
      catatan,
      status: 'Menunggu Kelulusan',
    };
    setPendingTransfers(prev => [transfer, ...prev]);

    // Audit log — tandakan sebagai menunggu kelulusan
    const log: AuditLog = {
      id: generateId(),
      timestamp,
      createdAt: Date.now(),
      type: 'PINDAH',
      itemName: source.name,
      sku: source.sku,
      store: source.store,
      targetStore,
      workshop: source.workshop,
      quantity,
      unit: source.unit,
      performedBy: user.name,
      performedByRole: user.role,
      catatan,
      pendingStatus: 'Menunggu Kelulusan',
    };
    setAuditLogs(prev => [log, ...prev]);

    addNotification(
      `[PERMOHONAN PINDAHAN] ${user.name} memohon pindahan ${quantity} ${source.unit} "${source.name}" daripada ${source.store} → ${targetStore}. Menunggu kelulusan Ketua Bengkel.`,
      'pinjam',
      source.store,
      source.workshop
    );
  };

  // ── Ketua Bengkel: Luluskan Permohonan Pindahan ───────────────────────────
  const approveTransfer = (transferId: string) => {
    if (!user) return;
    const transfer = pendingTransfers.find(t => t.id === transferId);
    if (!transfer || transfer.status !== 'Menunggu Kelulusan') return;

    // Execute the actual stock transfer
    transferStock(transfer.sourceItemId, transfer.targetStore, transfer.quantity, transfer.catatan);

    // Mark as Diluluskan
    setPendingTransfers(prev =>
      prev.map(t => t.id === transferId ? { ...t, status: 'Diluluskan' } : t)
    );

    // Update audit log pendingStatus
    setAuditLogs(prev =>
      prev.map(log =>
        log.type === 'PINDAH' &&
        log.store === transfer.sourceStore &&
        log.targetStore === transfer.targetStore &&
        log.pendingStatus === 'Menunggu Kelulusan'
          ? { ...log, pendingStatus: 'Diluluskan' }
          : log
      )
    );

    addNotification(
      `[PINDAHAN DILULUSKAN] ${user.name} (${user.role}) meluluskan pindahan ${transfer.quantity} ${transfer.unit} "${transfer.sourceItemName}" daripada ${transfer.sourceStore} → ${transfer.targetStore}.`,
      'lulus',
      transfer.sourceStore,
      transfer.workshop
    );
  };

  // ── Ketua Bengkel: Tolak Permohonan Pindahan ─────────────────────────────
  const rejectTransfer = (transferId: string) => {
    if (!user) return;
    const transfer = pendingTransfers.find(t => t.id === transferId);
    if (!transfer) return;
    setPendingTransfers(prev =>
      prev.map(t => t.id === transferId ? { ...t, status: 'Ditolak' } : t)
    );
    addNotification(
      `[PINDAHAN DITOLAK] Permohonan pindahan "${transfer.sourceItemName}" daripada ${transfer.sourceStore} → ${transfer.targetStore} telah ditolak.`,
      'tambah',
      transfer.sourceStore,
      transfer.workshop
    );
  };

  return (
    <InventoryContext.Provider
      value={{
        user,
        userAccounts,
        orgSettings,
        items,
        transactions,
        notifications,
        auditLogs,
        pendingTransfers,
        registerUser,
        loginWithPin,
        registerNewAccount,
        addUserAccount,
        updateUserPin,
        deleteUserAccount,
        updateOrgSettings,
        updateUserProfile,
        selectStore,
        logout,
        addItem,
        updateItem,
        deleteItem,
        requestBorrow,
        approveTransaction,
        rejectTransaction,
        returnItems,
        clearNotifications,
        transferStock,
        requestTransfer,
        approveTransfer,
        rejectTransfer,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
