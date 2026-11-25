import React from 'react';
import { useInventory } from '../context/InventoryContext';
import { WORKSHOP_STORES } from '../types';

export const StoreSelectPage: React.FC = () => {
  const { user, selectStore, logout, theme, toggleTheme } = useInventory();

  if (!user) return null;

  const stores = WORKSHOP_STORES[user.workshop] || [];

  // Helper to choose a relevant icon for the store
  const getStoreIcon = (storeName: string) => {
    const name = storeName.toLowerCase();
    if (name.includes('fail') || name.includes('dokumen') || name.includes('rekod')) return '📁';
    if (name.includes('komputer') || name.includes('laptop') || name.includes('projektor')) return '💻';
    if (name.includes('buku')) return '📚';
    if (name.includes('alat pengesan') || name.includes('kebocoran')) return '🔍';
    if (name.includes('kompresor') || name.includes('tiub')) return '⚙️';
    if (name.includes('pendingin') || name.includes('gas') || name.includes('kimia')) return '🧪';
    if (name.includes('enjin') || name.includes('transmisi')) return '🚗';
    if (name.includes('tayar') || name.includes('alignment')) return '🛞';
    if (name.includes('mekanikal') || name.includes('alatan')) return '🛠️';
    if (name.includes('tulis')) return '✏️';
    if (name.includes('ppu')) return '❄️';
    if (name.includes('ppn') || name.includes('aras')) return '🏢';
    return '📦';
  };

  const getStoreDescription = (storeName: string) => {
    const name = storeName.toLowerCase();
    if (name.includes('fail') || name.includes('dokumen')) return 'Penyimpanan rekod bertulis, laporan kewangan, dan dokumen arkib.';
    if (name.includes('komputer') || name.includes('laptop')) return 'Peralatan IT, komputer riba pengajaran, projektor, dan gajet elektronik.';
    if (name.includes('buku')) return 'Buku teks akademik, rujukan utama pelajar, dan modul pembelajaran.';
    if (name.includes('pengesan')) return 'Alat diagnostik HVAC, pengesan gas, dan alatan pengukuran tepat.';
    if (name.includes('kompresor')) return 'Alatan berat pemampat udara, tiub kuprum, dan set pemotongan tiub.';
    if (name.includes('pendingin')) return 'Bahan kimia pendingin, gas R32/R410A, dan silinder simpanan.';
    if (name.includes('enjin')) return 'Model enjin latihan, kotak gear manual/auto, dan komponen transmisi.';
    if (name.includes('tayar')) return 'Set tayar kenderaan latihan, mesin pengimbang tayar, dan alatan alignment.';
    if (name.includes('mekanikal') || name.includes('alatan')) return 'Kotak soket sata, spanar kotak, pemutar skru, dan ragum kerja.';
    if (name.includes('tulis')) return 'Peralatan pejabat, kertas A4, fail putih ring, dan bekalan dakwat pencetak.';
    if (name.includes('ppu')) return 'Bilik penyimpanan komponen penyamanan udara, alat tangan, dan peralatan TPPU.';
    if (name.includes('ppn') || name.includes('aras')) return 'Peralatan pejabat, laptop, fail pengurusan, dan rekod perniagaan.';
    return 'Pengurusan peralatan dan inventori umum stor.';
  };

  return (
    <div className="store-wrapper" style={{ position: 'relative' }}>
      <div className="floating-theme-toggle">
        <button
          type="button"
          id="theme-toggle-store-btn"
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Tukar ke Mod Malam (🌙)' : 'Tukar ke Mod Pagi (☀️)'}
          aria-label="Tukar Tema Pagi / Malam"
        >
          <span className="theme-toggle-icon">{theme === 'light' ? '☀️' : '🌙'}</span>
          <span className="theme-toggle-text">{theme === 'light' ? 'Mod Pagi' : 'Mod Malam'}</span>
        </button>
      </div>
      <div className="store-container">
        <div className="store-header">
          <span className="workshop-badge">{user.workshop}</span>
          <h2 style={{ marginTop: '1rem' }}>Pilih Stor Inventori</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Hai <strong>{user.name}</strong> ({user.role}). Sila pilih stor aktif untuk menguruskan atau meminjam barangan.
          </p>
        </div>

        <div className="store-grid">
          {stores.map((store) => (
            <div
              key={store}
              onClick={() => selectStore(store)}
              className="store-card glass-panel"
            >
              <div>
                <div className="store-card-icon">{getStoreIcon(store)}</div>
                <h3>{store}</h3>
                <p>{getStoreDescription(store)}</p>
              </div>
              <div className="store-card-arrow">
                Pilih Stor <span>➔</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
          <button id="back-register-btn" onClick={logout} className="btn btn-secondary">
            ← Tukar Nama / Bengkel
          </button>
        </div>
      </div>
    </div>
  );
};
