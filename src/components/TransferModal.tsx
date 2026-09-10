import React, { useState, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import type { InventoryItem, PendingTransfer } from '../types';
import { WORKSHOP_STORES } from '../types';

// ── Icons ────────────────────────────────────────────────────────────────────
const IconArrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
  </svg>
);
const IconSend = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
  </svg>
);
const IconTransfer = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3H5a2 2 0 00-2 2v14a2 2 0 002 2h3M16 3h3a2 2 0 012 2v14a2 2 0 01-2 2h-3M12 8l4 4-4 4M8 12h8" />
  </svg>
);

// ── StatusBadge ───────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: PendingTransfer['status'] }> = ({ status }) => {
  const cfg = {
    'Menunggu Kelulusan': { bg: '#78350f', text: '#fde68a', border: '#b45309', label: 'Menunggu Kelulusan' },
    'Diluluskan':         { bg: '#064e3b', text: '#6ee7b7', border: '#059669', label: 'Diluluskan' },
    'Ditolak':            { bg: '#7f1d1d', text: '#fca5a5', border: '#dc2626', label: 'Ditolak' },
  }[status];

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`,
      borderRadius: '999px', padding: '0.15rem 0.6rem', fontSize: '0.7rem', fontWeight: 700,
    }}>
      {status === 'Menunggu Kelulusan' && <IconClock />}
      {status === 'Diluluskan' && <IconCheck />}
      {status === 'Ditolak' && <IconX />}
      {cfg.label}
    </span>
  );
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: InventoryItem | null;
  initialTab?: 'borang' | 'senarai';
}

// ── Component ─────────────────────────────────────────────────────────────────
const TransferModal: React.FC<TransferModalProps> = ({ isOpen, onClose, item = null, initialTab = 'borang' }) => {
  const { user, transferStock, requestTransfer, approveTransfer, rejectTransfer, pendingTransfers } = useInventory();

  const [targetStore, setTargetStore] = useState('');
  const [qty, setQty] = useState<number | ''>(1);
  const [catatan, setCatatan] = useState('');
  const [activeTab, setActiveTab] = useState<'borang' | 'senarai'>(
    !item ? 'senarai' : initialTab
  );
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(!item ? 'senarai' : initialTab);
    }
  }, [isOpen, initialTab, item]);

  if (!isOpen || !user) return null;

  const isPIC = user.role === 'PIC';
  const isKetuaBengkel = user.role === 'Ketua Bengkel';

  // Workshop type for filtering pending transfers
  const workshopType = item?.workshop || user.workshop;

  // Stores in same workshop, exclude current store
  const availableStores = item ? (WORKSHOP_STORES[item.workshop] ?? []).filter(s => s !== item.store) : [];

  // Pending transfers for this workshop, visible to Ketua Bengkel
  const workshopPendingTransfers = pendingTransfers.filter(
    t => t.workshop === workshopType
  );
  const pendingCount = workshopPendingTransfers.filter(t => t.status === 'Menunggu Kelulusan').length;

  const isValid =
    !!item &&
    !!targetStore &&
    qty !== '' &&
    Number(qty) >= 1 &&
    Number(qty) <= (item.quantity ?? 0);

  const handleClose = () => {
    setTargetStore('');
    setQty(1);
    setCatatan('');
    setSuccessMsg('');
    setActiveTab('borang');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !isValid) return;
    const qtyNum = Number(qty);

    if (isPIC) {
      // PIC: hantar permohonan — stok TIDAK dipotong lagi
      requestTransfer(item.id, targetStore, qtyNum, catatan || undefined);
      setSuccessMsg(`✅ Permohonan pindahan ${qtyNum} ${item.unit} "${item.name}" ke ${targetStore} telah dihantar. Menunggu kelulusan Ketua Bengkel.`);
    } else if (isKetuaBengkel) {
      // Ketua Bengkel: laksana terus
      transferStock(item.id, targetStore, qtyNum, catatan || undefined);
      setSuccessMsg(`✅ Pindahan ${qtyNum} ${item.unit} "${item.name}" ke ${targetStore} berjaya dilaksanakan.`);
    }
    setTargetStore('');
    setQty(1);
    setCatatan('');
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          border: '1px solid #334155',
          borderRadius: '1rem',
          width: '100%',
          maxWidth: '580px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #1e293b',
          background: 'linear-gradient(135deg, #312e81 0%, #1e293b 60%)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                background: 'rgba(99,102,241,0.25)', border: '1px solid #6366f1',
                borderRadius: '0.5rem', padding: '0.4rem', display: 'flex',
              }}>
                <IconTransfer />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f1f5f9' }}>
                  Pindah Stok Inter-Stor
                </h2>
                <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>
                  {workshopType}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              style={{
                background: 'rgba(255,255,255,0.08)', border: '1px solid #475569',
                color: '#94a3b8', borderRadius: '0.4rem', width: '2rem', height: '2rem',
                cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>
          </div>

          {/* Role badge */}
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              background: isPIC ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)',
              border: `1px solid ${isPIC ? '#6366f1' : '#10b981'}`,
              color: isPIC ? '#a5b4fc' : '#6ee7b7',
              borderRadius: '999px', padding: '0.2rem 0.6rem',
              fontSize: '0.68rem', fontWeight: 700,
            }}>
              {user.role} — {user.name}
            </span>
            {isPIC && (
              <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                Permohonan akan dihantar kepada Ketua Bengkel untuk kelulusan
              </span>
            )}
            {isKetuaBengkel && (
              <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                Pindahan akan dilaksanakan serta-merta
              </span>
            )}
          </div>
        </div>

        {/* ── Tabs (Ketua Bengkel & PIC) ── */}
        <div style={{
          display: 'flex', borderBottom: '1px solid #334155',
          background: '#0f172a', flexShrink: 0,
        }}>
          {(['borang', 'senarai'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: '0.65rem', border: 'none', cursor: 'pointer',
                fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.15s',
                background: activeTab === tab ? '#1e293b' : 'transparent',
                color: activeTab === tab ? '#f1f5f9' : '#64748b',
                borderBottom: activeTab === tab ? '2px solid #6366f1' : '2px solid transparent',
              }}
            >
              {tab === 'borang' ? '📋 Borang Pindahan' : (
                <span>
                  📑 Senarai Permohonan
                  {pendingCount > 0 && (
                    <span style={{
                      marginLeft: '0.4rem', background: '#dc2626', color: '#fff',
                      borderRadius: '999px', padding: '0.05rem 0.4rem', fontSize: '0.65rem',
                    }}>
                      {pendingCount}
                    </span>
                  )}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '1.25rem 1.5rem' }}>

          {/* ── Success message ── */}
          {successMsg && (
            <div style={{
              background: '#064e3b', border: '1px solid #059669', borderRadius: '0.6rem',
              padding: '0.75rem 1rem', marginBottom: '1rem',
              color: '#6ee7b7', fontSize: '0.8rem', lineHeight: 1.5,
            }}>
              {successMsg}
              <div style={{ marginTop: '0.5rem' }}>
                <button
                  onClick={handleClose}
                  style={{
                    background: '#059669', border: 'none', color: '#fff',
                    borderRadius: '0.4rem', padding: '0.3rem 0.75rem',
                    fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Tutup
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              TAB 1: BORANG PINDAHAN
          ══════════════════════════════════════════════ */}
          {activeTab === 'borang' && !successMsg && (
            !item ? (
              <div style={{
                textAlign: 'center',
                padding: '2.5rem 1.5rem',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '0.75rem',
                color: '#94a3b8',
              }}>
                <p style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>📦</p>
                <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9', margin: '0 0 0.4rem' }}>
                  Tiada Barang Dipilih
                </p>
                <p style={{ fontSize: '0.78rem', margin: 0, color: '#94a3b8' }}>
                  Sila pilih barang daripada jadual inventori untuk memulakan pindahan baharu.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {/* Item info card */}
                <div style={{
                  background: '#1e293b', border: '1px solid #334155',
                  borderRadius: '0.75rem', padding: '0.9rem 1rem', marginBottom: '1.25rem',
                }}>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.68rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Barang Dipindah
                  </p>
                  <p style={{ margin: '0 0 0.15rem', fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9' }}>
                    {item.name}
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>SKU: <strong style={{ color: '#cbd5e1' }}>{item.sku}</strong></span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      Baki: <strong style={{ color: item.quantity <= item.stokMinima ? '#f87171' : '#34d399' }}>
                        {item.quantity} {item.unit}
                      </strong>
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Stor Asal: <strong style={{ color: '#cbd5e1' }}>{item.store}</strong></span>
                  </div>
                </div>

                {/* 1. Stor Sasaran */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    1 · STOR SASARAN (PENERIMA) *
                  </label>
                  {availableStores.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: '#f87171', margin: 0 }}>
                      ⚠️ Tiada stor lain dalam bengkel ini.
                    </p>
                  ) : (
                    <select
                      value={targetStore}
                      onChange={e => setTargetStore(e.target.value)}
                      required
                      style={{
                        width: '100%', background: '#0f172a', color: '#f1f5f9',
                        border: `1px solid ${targetStore ? '#6366f1' : '#334155'}`,
                        borderRadius: '0.5rem', padding: '0.55rem 0.75rem',
                        fontSize: '0.85rem', outline: 'none', cursor: 'pointer',
                      }}
                    >
                      <option value="">— Pilih stor penerima —</option>
                      {availableStores.map(s => (
                        <option key={s} value={s} style={{ background: '#0f172a', color: '#f1f5f9' }}>{s}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Arrow separator */}
                {targetStore && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#6366f1' }}>
                    <div style={{ flex: 1, height: '1px', background: '#1e293b' }} />
                    <span style={{ fontSize: '0.7rem', color: '#6366f1' }}>{item.store}</span>
                    <IconArrow />
                    <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700 }}>{targetStore}</span>
                    <div style={{ flex: 1, height: '1px', background: '#1e293b' }} />
                  </div>
                )}

                {/* 2. Kuantiti */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    2 · KUANTITI DIPINDAH *
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setQty(q => q === '' ? 1 : Math.max(1, Number(q) - 1))}
                      style={{
                        background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9',
                        borderRadius: '0.4rem', width: '2.2rem', height: '2.2rem',
                        fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >−</button>
                    <input
                      type="number"
                      min={1}
                      max={item.quantity}
                      value={qty}
                      onChange={e => setQty(e.target.value === '' ? '' : Number(e.target.value))}
                      required
                      style={{
                        flex: 1, textAlign: 'center', background: '#0f172a', color: '#f1f5f9',
                        border: `1px solid ${qty !== '' && Number(qty) > item.quantity ? '#dc2626' : '#334155'}`,
                        borderRadius: '0.5rem', padding: '0.5rem',
                        fontSize: '1rem', fontWeight: 700, outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setQty(q => Math.min(item.quantity, (q === '' ? 0 : Number(q)) + 1))}
                      style={{
                        background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9',
                        borderRadius: '0.4rem', width: '2.2rem', height: '2.2rem',
                        fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >+</button>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.unit}</span>
                  </div>
                  {qty !== '' && Number(qty) > item.quantity && (
                    <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: '#f87171' }}>
                      ⚠️ Kuantiti melebihi baki semasa ({item.quantity} {item.unit})
                    </p>
                  )}
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                    Baki selepas pindah: <strong style={{ color: '#f1f5f9' }}>
                      {qty !== '' && Number(qty) <= item.quantity
                        ? `${item.quantity - Number(qty)} ${item.unit}`
                        : '—'}
                    </strong>
                  </p>
                </div>

                {/* 3. Catatan */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    3 · CATATAN / SEBAB PINDAHAN
                  </label>
                  <textarea
                    value={catatan}
                    onChange={e => setCatatan(e.target.value)}
                    rows={2}
                    placeholder={isPIC ? 'Nyatakan sebab permohonan pindahan...' : 'Nyatakan sebab pindahan (pilihan)...'}
                    style={{
                      width: '100%', background: '#0f172a', color: '#f1f5f9',
                      border: '1px solid #334155', borderRadius: '0.5rem',
                      padding: '0.55rem 0.75rem', fontSize: '0.82rem',
                      outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* ── Submit button (role-based) ── */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={handleClose}
                    style={{
                      flex: 1, background: 'transparent', border: '1px solid #475569',
                      color: '#94a3b8', borderRadius: '0.6rem', padding: '0.6rem',
                      fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Batal
                  </button>

                  {isPIC && (
                    <button
                      type="submit"
                      disabled={!isValid}
                      style={{
                        flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: '0.5rem', border: 'none', borderRadius: '0.6rem',
                        padding: '0.6rem 1rem', fontSize: '0.85rem', fontWeight: 700,
                        cursor: isValid ? 'pointer' : 'not-allowed',
                        background: isValid
                          ? 'linear-gradient(135deg, #4f46e5, #6366f1)'
                          : '#1e293b',
                        color: isValid ? '#fff' : '#475569',
                        boxShadow: isValid ? '0 4px 15px rgba(99,102,241,0.4)' : 'none',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { if (isValid) e.currentTarget.style.background = 'linear-gradient(135deg, #4338ca, #4f46e5)'; }}
                      onMouseLeave={e => { if (isValid) e.currentTarget.style.background = 'linear-gradient(135deg, #4f46e5, #6366f1)'; }}
                    >
                      <IconSend />
                      Hantar Permohonan Pindahan
                    </button>
                  )}

                  {isKetuaBengkel && (
                    <button
                      type="submit"
                      disabled={!isValid}
                      style={{
                        flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: '0.5rem', border: 'none', borderRadius: '0.6rem',
                        padding: '0.6rem 1rem', fontSize: '0.85rem', fontWeight: 700,
                        cursor: isValid ? 'pointer' : 'not-allowed',
                        background: isValid
                          ? 'linear-gradient(135deg, #047857, #059669)'
                          : '#1e293b',
                        color: isValid ? '#fff' : '#475569',
                        boxShadow: isValid ? '0 4px 15px rgba(5,150,105,0.4)' : 'none',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { if (isValid) e.currentTarget.style.background = 'linear-gradient(135deg, #065f46, #047857)'; }}
                      onMouseLeave={e => { if (isValid) e.currentTarget.style.background = 'linear-gradient(135deg, #047857, #059669)'; }}
                    >
                      <IconCheck />
                      Sahkan &amp; Laksana Pindahan
                    </button>
                  )}
                </div>
              </form>
            )
          )}

          {/* ══════════════════════════════════════════════
              TAB 2: SENARAI PERMOHONAN
          ══════════════════════════════════════════════ */}
          {activeTab === 'senarai' && (
            <div>
              {workshopPendingTransfers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#475569' }}>
                  <p style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>📭</p>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>Tiada permohonan pindahan dalam bengkel ini.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {workshopPendingTransfers.map(transfer => (
                    <div
                      key={transfer.id}
                      style={{
                        background: '#1e293b',
                        border: `1px solid ${transfer.status === 'Menunggu Kelulusan' ? '#b45309' : transfer.status === 'Diluluskan' ? '#059669' : '#475569'}`,
                        borderRadius: '0.75rem',
                        padding: '0.9rem 1rem',
                      }}
                    >
                      {/* Header row */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div>
                          <p style={{ margin: '0 0 0.15rem', fontSize: '0.88rem', fontWeight: 700, color: '#f1f5f9' }}>
                            {transfer.sourceItemName}
                          </p>
                          <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b' }}>SKU: {transfer.sourceSku}</p>
                        </div>
                        <StatusBadge status={transfer.status} />
                      </div>

                      {/* Details */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
                        <span style={{ fontSize: '0.72rem', background: '#0f172a', color: '#94a3b8', borderRadius: '0.3rem', padding: '0.2rem 0.5rem', border: '1px solid #334155' }}>
                          📦 {transfer.quantity} {transfer.unit}
                        </span>
                        <span style={{ fontSize: '0.72rem', background: '#0f172a', color: '#94a3b8', borderRadius: '0.3rem', padding: '0.2rem 0.5rem', border: '1px solid #334155' }}>
                          {transfer.sourceStore}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#6366f1' }}>→</span>
                        <span style={{ fontSize: '0.72rem', background: '#0f172a', color: '#10b981', borderRadius: '0.3rem', padding: '0.2rem 0.5rem', border: '1px solid #065f46' }}>
                          {transfer.targetStore}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ margin: 0, fontSize: '0.68rem', color: '#64748b' }}>
                            Dimohon oleh <strong style={{ color: '#94a3b8' }}>{transfer.requestedBy}</strong> · {transfer.timestamp}
                          </p>
                          {transfer.catatan && (
                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>
                              "{transfer.catatan}"
                            </p>
                          )}
                        </div>

                        {/* Action buttons — only for Menunggu Kelulusan for Ketua Bengkel */}
                        {isKetuaBengkel && transfer.status === 'Menunggu Kelulusan' && (
                          <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                            <button
                              onClick={() => rejectTransfer(transfer.id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '0.25rem',
                                background: '#7f1d1d', border: '1px solid #dc2626',
                                color: '#fca5a5', borderRadius: '0.4rem',
                                padding: '0.3rem 0.6rem', fontSize: '0.72rem', fontWeight: 600,
                                cursor: 'pointer',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#991b1b'}
                              onMouseLeave={e => e.currentTarget.style.background = '#7f1d1d'}
                            >
                              <IconX /> Tolak
                            </button>
                            <button
                              onClick={() => approveTransfer(transfer.id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '0.25rem',
                                background: '#064e3b', border: '1px solid #059669',
                                color: '#6ee7b7', borderRadius: '0.4rem',
                                padding: '0.3rem 0.6rem', fontSize: '0.72rem', fontWeight: 600,
                                cursor: 'pointer',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#065f46'}
                              onMouseLeave={e => e.currentTarget.style.background = '#064e3b'}
                            >
                              <IconCheck /> Luluskan
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransferModal;
