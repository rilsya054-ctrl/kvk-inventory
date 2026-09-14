import React from 'react';
import { useInventory } from '../context/InventoryContext';
import { WORKSHOP_STORES } from '../types';

export const StoreSelectPage: React.FC = () => {
  const { user, selectStore, logout, items } = useInventory();

  if (!user) return null;

  const stores = WORKSHOP_STORES[user.workshop] || [];

  // Helper to choose a relevant icon for each store
  const getStoreIcon = (storeName: string) => {
    const name = storeName.toLowerCase();
    if (name.includes('ppu 1')) return '🔍';
    if (name.includes('ppu 2')) return '⚙️';
    if (name.includes('ppu 3')) return '📏';
    if (name.includes('ppu 4')) return '🧪';
    if (name.includes('ppu 5a')) return '🧭';
    if (name.includes('ppu 5b')) return '🛠️';
    if (name.includes('fail') || name.includes('dokumen') || name.includes('rekod')) return '📁';
    if (name.includes('komputer') || name.includes('laptop') || name.includes('projektor')) return '💻';
    if (name.includes('buku')) return '📚';
    if (name.includes('enjin') || name.includes('transmisi')) return '🚗';
    if (name.includes('tayar') || name.includes('alignment')) return '🛞';
    if (name.includes('mekanikal') || name.includes('alatan')) return '🛠️';
    if (name.includes('tulis')) return '✏️';
    if (name.includes('ppu')) return '❄️';
    if (name.includes('ppn') || name.includes('aras')) return '🏢';
    return '📦';
  };

  const getStoreCategoryTag = (storeName: string) => {
    const name = storeName.toLowerCase();
    if (name.includes('ppu 1')) return 'Diagnostik & Pengesan';
    if (name.includes('ppu 2')) return 'Pemampat & Elektrikal';
    if (name.includes('ppu 3')) return 'Tiub Kuprum & Penebat';
    if (name.includes('ppu 4')) return 'Gas Pendingin & Kimia';
    if (name.includes('ppu 5a')) return 'Tolok Manifold & Vakum';
    if (name.includes('ppu 5b')) return 'Flaring & Kimpalan';
    if (name.includes('perakaunan 1')) return 'Rekod & Fail Kewangan';
    if (name.includes('perakaunan 2')) return 'IT & Bahan Kursus';
    if (name.includes('automotif 1')) return 'Enjin & Transmisi';
    if (name.includes('sldn 2') || name.includes('tayar')) return 'Tayar & Alignment';
    if (name.includes('automotif 3')) return 'Soket & Alatan Mekanikal';
    if (name.includes('automotif 4')) return 'Alatan Pneumatik & Khusus';
    if (name.includes('aras 1')) return 'Alat Tulis & Kertas';
    if (name.includes('aras 2')) return 'Projektor & IT';
    if (name.includes('aras 3')) return 'Fail & Dokumentasi';
    return 'Pengurusan Alatan';
  };

  const getStoreDescription = (storeName: string) => {
    const name = storeName.toLowerCase();
    if (name.includes('ppu 1')) return 'Alatan diagnostik HVAC, pengesan kebocoran gas refrigeran, anemometer dan termometer inframerah.';
    if (name.includes('ppu 2')) return 'Unit pemampat R32/R410A, motor penghembus indoor, kapasitor pemula dan komponen kawalan elektrikal.';
    if (name.includes('ppu 3')) return 'Tiub kuprum pelbagai saiz (1/4", 3/8", 1/2"), penebat haba Armaflex dan kelengkapan paip.';
    if (name.includes('ppu 4')) return 'Silinder gas refrigeran R32, R410A, cecair pencuci pemeluwap dan minyak pemampat sintetik POE.';
    if (name.includes('ppu 5a')) return 'Set tolok manifold digital 4-injap, pam vakum dua peringkat dan tolok mikron berketepatan tinggi.';
    if (name.includes('ppu 5b')) return 'Set alat flaring & swaging, pemotong tiub kuprum, rod kimpalan perak brazing dan set obor pematerian.';
    if (name.includes('fail') || name.includes('dokumen')) return 'Penyimpanan rekod bertulis, laporan kewangan, dan dokumen arkib.';
    if (name.includes('komputer') || name.includes('laptop')) return 'Peralatan IT, komputer riba pengajaran, projektor, dan gajet elektronik.';
    if (name.includes('buku')) return 'Buku teks akademik, rujukan utama pelajar, dan modul pembelajaran.';
    if (name.includes('enjin')) return 'Model enjin latihan, kotak gear manual/auto, dan komponen transmisi.';
    if (name.includes('tayar')) return 'Set tayar kenderaan latihan, mesin pengimbang tayar, dan alatan alignment.';
    if (name.includes('mekanikal') || name.includes('alatan')) return 'Kotak soket sata, spanar kotak, pemutar skru, dan ragum kerja.';
    if (name.includes('tulis')) return 'Peralatan pejabat, kertas A4, fail putih ring, dan bekalan dakwat pencetak.';
    if (name.includes('ppn') || name.includes('aras')) return 'Peralatan pejabat, laptop, fail pengurusan, dan rekod perniagaan.';
    return 'Pengurusan peralatan dan inventori umum stor.';
  };

  const formatStoreShort = (name: string) => {
    if (name.includes('PPU 1')) return 'PPU 1';
    if (name.includes('PPU 2')) return 'PPU 2';
    if (name.includes('PPU 3')) return 'PPU 3';
    if (name.includes('PPU 4')) return 'PPU 4';
    if (name.includes('PPU 5A')) return 'PPU 5A';
    if (name.includes('PPU 5B')) return 'PPU 5B';
    return name.replace('Stor Bengkel ', '').replace('Stor Makmal ', '').replace('Stor ', '');
  };

  return (
    <div className="store-wrapper">
      <div className="store-container">
        <div className="store-header">
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <span className="workshop-badge">
              {user.workshop === 'Teknologi Penyejukan dan Penyamanan Udara'
                ? '❄️ Bengkel TPPU (Penyamanan Udara)'
                : user.workshop}
            </span>
          </div>
          <h2 style={{ marginTop: '0.85rem' }}>Pilih Stor Inventori</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '560px', margin: '0.25rem auto 0 auto' }}>
            Hai <strong>{user.name}</strong> ({user.role}). Sila pilih stor untuk menguruskan atau meminjam alatan & bahan.
          </p>
        </div>

        {/* Quick store shortcut strip on mobile */}
        <div className="store-quick-jump-bar">
          <span className="store-jump-label">Pilih Pantas:</span>
          <div className="store-jump-chips">
            {stores.map((store) => (
              <button
                key={store}
                type="button"
                onClick={() => selectStore(store)}
                className="store-jump-chip"
                title={store}
              >
                <span>{getStoreIcon(store)}</span>
                <span>{formatStoreShort(store)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="store-grid">
          {stores.map((store) => {
            const count = items.filter(i => i.store === store && i.workshop === user.workshop).length;
            const tag = getStoreCategoryTag(store);
            const icon = getStoreIcon(store);
            const shortCode = formatStoreShort(store);

            return (
              <div
                key={store}
                onClick={() => selectStore(store)}
                className="store-card glass-panel"
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div className="store-card-icon">{icon}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span className="store-tag-badge">{tag}</span>
                      <span className="store-item-counter-badge">{count} Item</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span className="store-code-pill">{shortCode}</span>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{store}</h3>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: '0.35rem 0 1rem 0' }}>
                    {getStoreDescription(store)}
                  </p>
                </div>
                <div className="store-card-arrow">
                  <span>Buka Stor {shortCode}</span> <span>➔</span>
                </div>
              </div>
            );
          })}
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
