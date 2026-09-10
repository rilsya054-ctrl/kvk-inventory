import React, { useState, useEffect } from 'react';
import type { UserRole, WorkshopType } from '../types';

export interface Category {
  code: string;
  label: string;
}

interface WorkshopCategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  workshop: WorkshopType;
  userRole: UserRole;
  onCategoriesChange?: (categories: Category[]) => void;
}

export const DEFAULT_WORKSHOP_CATEGORIES: Record<WorkshopType, Category[]> = {
  'Teknologi Penyejukan dan Penyamanan Udara': [
    { code: 'AT', label: 'Alat Tangan' },
    { code: 'ATE', label: 'Alat Tangan Elektrik' },
    { code: 'AU', label: 'Alat Ukur' },
    { code: 'AKT', label: 'Alat Khas & Testing' },
    { code: 'AK', label: 'Alat Khas' },
    { code: 'KGM', label: 'Kelengkapan & Mesin' },
    { code: 'AKE', label: 'Alat Khas Elektrik' },
    { code: 'ME', label: 'Mesin & Peralatan' },
    { code: 'MKE', label: 'Mesin & Kelengkapan Elektrik' },
    { code: 'AUE', label: 'Alat Ukur Elektrik' },
    { code: 'UE', label: 'Ukuran & Ujian Elektrik' },
    { code: 'KE', label: 'Kelengkapan Elektrik' },
    { code: 'ICT', label: 'Teknologi Maklumat & Komunikasi' }
  ],
  'Perakaunan': [
    { code: 'ATULIS', label: 'Alat Tulis & Pejabat' },
    { code: 'ICT', label: 'Komputer & Peranti ICT' },
    { code: 'DOK', label: 'Fail & Dokumen Kewangan' },
    { code: 'PRB', label: 'Perabot Makmal & Pejabat' },
    { code: 'BUKU', label: 'Buku Rujukan & Jurnal' }
  ],
  'Teknologi Automotif': [
    { code: 'AT', label: 'Alat Tangan Automotif' },
    { code: 'MESIN', label: 'Mesin Servis & Diagnostic' },
    { code: 'ALAT', label: 'Peralatan Khas Kenderaan' },
    { code: 'SP', label: 'Alat Ganti (Spare Parts)' },
    { code: 'PEL', label: 'Minyak & Bahan Pelincir' }
  ],
  'Pengurusan Perniagaan': [
    { code: 'ATULIS', label: 'Alat Tulis & Pejabat' },
    { code: 'ICT', label: 'Komputer & Peranti Persembahan' },
    { code: 'PRB', label: 'Perabot Bilik Mesyuarat' },
    { code: 'MODUL', label: 'Bahan Pengajaran & Modul' },
    { code: 'STOK', label: 'Stok Latihan Perniagaan' }
  ]
};

export const getWorkshopCategories = (workshop: WorkshopType): Category[] => {
  const saved = localStorage.getItem(`kv_categories_${workshop}`);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
  }
  return DEFAULT_WORKSHOP_CATEGORIES[workshop] || [];
};

export const WorkshopCategoryManager: React.FC<WorkshopCategoryManagerProps> = ({
  isOpen,
  onClose,
  workshop,
  userRole,
  onCategoriesChange
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCode, setNewCode] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isAuthorized = userRole === 'Ketua Bengkel' || userRole === 'PIC';

  useEffect(() => {
    if (isOpen) {
      setCategories(getWorkshopCategories(workshop));
      setErrorMsg('');
      setNewCode('');
      setNewLabel('');
    }
  }, [isOpen, workshop]);

  if (!isOpen) return null;

  const saveCategories = (updated: Category[]) => {
    localStorage.setItem(`kv_categories_${workshop}`, JSON.stringify(updated));
    setCategories(updated);
    if (onCategoriesChange) {
      onCategoriesChange(updated);
    }
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorized) return;
    setErrorMsg('');

    const codeClean = newCode.trim().toUpperCase();
    const labelClean = newLabel.trim();

    if (!codeClean || !labelClean) {
      setErrorMsg('Sila isi semua medan.');
      return;
    }

    if (categories.some(c => c.code === codeClean)) {
      setErrorMsg(`Kod kategori "${codeClean}" sudah wujud.`);
      return;
    }

    const updated = [...categories, { code: codeClean, label: labelClean }];
    saveCategories(updated);
    setNewCode('');
    setNewLabel('');
  };

  const handleDeleteCategory = (codeToDelete: string) => {
    if (!isAuthorized) return;
    if (!window.confirm(`Adakah anda pasti mahu memadam kategori "${codeToDelete}"?`)) return;

    const updated = categories.filter(c => c.code !== codeToDelete);
    saveCategories(updated);
  };

  const handleResetToDefault = () => {
    if (!isAuthorized) return;
    if (!window.confirm('Adakah anda pasti mahu set semula ke kategori asal (default)? Semua kategori kustom akan dipadam.')) return;

    const defaults = DEFAULT_WORKSHOP_CATEGORIES[workshop] || [];
    saveCategories(defaults);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={onClose}>
      <div
        className="glass-panel"
        style={{
          maxWidth: '540px',
          width: '95vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem',
          overflow: 'hidden',
          animation: 'modalScale 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.4rem' }}>🏷️</span>
            <div>
              <h2 className="modal-title" style={{ margin: 0, fontSize: '1.25rem' }}>Pengurusan Kategori</h2>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {workshop}
              </p>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.25rem', marginBottom: '1rem' }}>
          
          {/* Add Category Form (Only for Authorized Users) */}
          {isAuthorized ? (
            <form onSubmit={handleAddCategory} style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border)' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tambah Kategori Baru</h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Kod (SKU Prefix)</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Contoh: AT"
                    value={newCode}
                    onChange={e => setNewCode(e.target.value)}
                    required
                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Nama Kategori</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Contoh: Alat Tangan"
                    value={newLabel}
                    onChange={e => setNewLabel(e.target.value)}
                    required
                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {errorMsg && (
                <p style={{ color: 'var(--danger)', fontSize: '0.75rem', margin: '0 0 0.75rem 0' }}>⚠️ {errorMsg}</p>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.55rem', fontSize: '0.82rem', background: 'linear-gradient(135deg, var(--primary), #a78bfa)' }}
              >
                ➕ Tambah Kategori
              </button>
            </form>
          ) : (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                ℹ️ Anda log masuk sebagai <strong>{userRole}</strong>. Hanya <strong>Ketua Bengkel</strong> dan <strong>PIC</strong> sahaja yang mempunyai akses untuk menambah atau memadam kategori bengkel ini.
              </p>
            </div>
          )}

          {/* Categories List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Senarai Kategori Semasa</h4>
              {isAuthorized && (
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f43f5e',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0
                  }}
                >
                  Set Semula ke Asal
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {categories.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', margin: '1rem 0' }}>Tiada kategori ditemui.</p>
              ) : (
                categories.map(cat => (
                  <div
                    key={cat.code}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.6rem 0.85rem',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--text-secondary)',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}>
                        {cat.code}
                      </span>
                      <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cat.label}
                      </span>
                    </div>

                    {isAuthorized && (
                      <button
                        onClick={() => handleDeleteCategory(cat.code)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          padding: '0.2rem 0.4rem',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        title="Padam Kategori"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--card-border)', paddingTop: '0.85rem', flexShrink: 0 }}>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkshopCategoryManager;
