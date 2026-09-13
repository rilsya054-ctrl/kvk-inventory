import React, { useState, useRef, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import type { UserRole, WorkshopType, UserAccount } from '../types';

export const RegisterPage: React.FC = () => {
  const { userAccounts, loginWithPin, registerNewAccount } = useInventory();

  // ── Tabs Navigasi: 'login' (Lalai / Default) | 'register' ──
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // ── State Log Masuk (Autocomplete Search & PIN) ──
  const [searchName, setSearchName] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<UserAccount | null>(null);
  const [loginPin, setLoginPin] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loginError, setLoginError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // ── State Daftar Akaun Baharu ──
  const [regName, setRegName] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('Pensyarah');
  const [regWorkshop, setRegWorkshop] = useState<WorkshopType>('Perakaunan');
  const [regPin, setRegPin] = useState('');
  const [regPasscode, setRegPasscode] = useState('');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  // Tutup dropdown autocomplete apabila klik di luar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tapis senarai pengguna untuk Autocomplete Carian Pintar
  const filteredUsers = userAccounts.filter(acc => {
    if (!searchName.trim()) return true;
    const term = searchName.toLowerCase().trim();
    return (
      acc.name.toLowerCase().includes(term) ||
      acc.workshop.toLowerCase().includes(term) ||
      acc.role.toLowerCase().includes(term)
    );
  });

  const handleSelectUser = (account: UserAccount) => {
    setSelectedAccount(account);
    setSearchName(account.name);
    setIsDropdownOpen(false);
    setLoginError('');
    // Fokus automatik ke ruang PIN selepas memilih nama
    setTimeout(() => {
      pinInputRef.current?.focus();
    }, 100);
  };

  const handleClearSelectedUser = () => {
    setSelectedAccount(null);
    setSearchName('');
    setLoginPin('');
    setLoginError('');
    setIsDropdownOpen(true);
  };

  // ── Pengendali Log Masuk ──
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const targetName = selectedAccount ? selectedAccount.name : searchName.trim();
    if (!targetName) {
      setLoginError('Sila pilih atau taip nama anda.');
      return;
    }

    if (!loginPin || loginPin.length !== 4) {
      setLoginError('Sila masukkan PIN 4-Digit yang sah.');
      return;
    }

    const result = loginWithPin(targetName, loginPin);
    if (!result.success) {
      setLoginError(result.message || 'Log masuk gagal. Sila semak PIN anda.');
    }
  };

  // ── Pengendali Pendaftaran Akaun Baharu ──
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    if (!regName.trim()) {
      setRegError('Sila masukkan nama penuh anda.');
      return;
    }

    if (!regPin || regPin.length !== 4 || !/^\d{4}$/.test(regPin)) {
      setRegError('PIN mestilah tepat 4-digit nombor.');
      return;
    }

    // Kawalan Keselamatan: Master Passcode untuk Ketua Bengkel & PIC
    if (regRole === 'Ketua Bengkel' || regRole === 'PIC') {
      const MASTER_PASSCODE = 'KV123';
      if (!regPasscode.trim() || regPasscode.trim().toUpperCase() !== MASTER_PASSCODE) {
        setRegError('Kunci Pengesahan Bengkel (Master Passcode) tidak sah! Hanya kakitangan yang diberi kuasa boleh mendaftar peranan ini.');
        return;
      }
    }

    const result = registerNewAccount(regName.trim(), regRole, regWorkshop, regPin);
    if (!result.success) {
      setRegError(result.message || 'Pendaftaran gagal.');
    } else {
      setRegSuccess('Pendaftaran berjaya! Mengarahkan ke Dashboard...');
    }
  };

  return (
    <div className="auth-wrapper" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="auth-card glass-panel" style={{ width: '100%', maxWidth: '520px', borderRadius: '18px', padding: '2.25rem', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)' }}>
        
        {/* Header Logo & Tajuk */}
        <div className="auth-header" style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div className="logo-badge" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏫</div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.4rem 0', background: 'linear-gradient(135deg, #a5b4fc, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            KV Inventori
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0 }}>
            Sistem Pengurusan Stor, Alatan & Bahan Habis Pakai
          </p>
        </div>

        {/* ── 1. TABS NAVIGASI UTAMA [ Log Masuk ] | [ Daftar Akaun Baharu ] ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: '10px',
          padding: '0.3rem',
          gap: '0.3rem',
          marginBottom: '1.75rem',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setLoginError('');
            }}
            style={{
              padding: '0.65rem 0.5rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.88rem',
              fontWeight: activeTab === 'login' ? 700 : 500,
              background: activeTab === 'login' ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : 'transparent',
              color: activeTab === 'login' ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: activeTab === 'login' ? '0 4px 15px rgba(79, 70, 229, 0.35)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem'
            }}
          >
            <span>🔑</span> Log Masuk
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setRegError('');
            }}
            style={{
              padding: '0.65rem 0.5rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.88rem',
              fontWeight: activeTab === 'register' ? 700 : 500,
              background: activeTab === 'register' ? 'linear-gradient(135deg, #0891b2, #06b6d4)' : 'transparent',
              color: activeTab === 'register' ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: activeTab === 'register' ? '0 4px 15px rgba(6, 182, 212, 0.35)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem'
            }}
          >
            <span>📝</span> Daftar Akaun Baharu
          </button>
        </div>

        {/* ── 2. MOD LOG MASUK (CARIAN NAMA PINTAR + PIN) ── */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="auth-form" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {loginError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                color: '#fca5a5',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span>⚠️</span>
                <span>{loginError}</span>
              </div>
            )}

            {/* Ruang Carian Nama Pintar (Searchable Input / Autocomplete) */}
            <div className="form-group" style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }} ref={dropdownRef}>
              <label htmlFor="search-name-input" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Nama Pengguna / Pensyarah
              </label>
              
              <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
                <input
                  id="search-name-input"
                  type="text"
                  className="input-field"
                  placeholder="Taip nama anda untuk carian pantas..."
                  value={searchName}
                  autoComplete="off"
                  onChange={(e) => {
                    setSearchName(e.target.value);
                    setSelectedAccount(null);
                    setIsDropdownOpen(true);
                    setLoginError('');
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    paddingRight: selectedAccount || searchName ? '2.5rem' : '1rem',
                    paddingLeft: '1rem',
                    paddingTop: '0.75rem',
                    paddingBottom: '0.75rem',
                    fontSize: '0.9rem'
                  }}
                  required
                />
                
                {(selectedAccount || searchName) && (
                  <button
                    type="button"
                    onClick={handleClearSelectedUser}
                    title="Padam carian"
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      padding: '0.2rem 0.4rem',
                      borderRadius: '4px'
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Lencana Maklumat Pengguna yang Dipilih */}
              {selectedAccount && (
                <div style={{
                  marginTop: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ color: '#818cf8', fontWeight: 700 }}>[{selectedAccount.role}]</span>
                    <span style={{ color: 'var(--text-secondary)' }}>•</span>
                    <span style={{ color: '#e2e8f0' }}>{selectedAccount.workshop}</span>
                  </div>
                  <span style={{ color: '#34d399', fontWeight: 600 }}>✓ Dipilih</span>
                </div>
              )}

              {/* Senarai Dropdown Autocomplete Real-time */}
              {isDropdownOpen && !selectedAccount && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  width: '100%',
                  boxSizing: 'border-box',
                  marginTop: '4px',
                  background: '#1e293b',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  zIndex: 50,
                }}>
                  {filteredUsers.length === 0 ? (
                    <div style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                      Tiada nama ditemui untuk &quot;{searchName}&quot;. Sila daftar di tab sebelah.
                    </div>
                  ) : (
                    filteredUsers.map(userAcc => (
                      <div
                        key={userAcc.id}
                        onClick={() => handleSelectUser(userAcc)}
                        style={{
                          padding: '0.85rem 1rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'background 0.15s ease',
                          minHeight: '52px',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99, 102, 241, 0.18)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#f8fafc' }}>
                            {userAcc.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {userAcc.workshop}
                          </div>
                        </div>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          background: userAcc.role === 'Ketua Bengkel' ? 'rgba(168, 85, 247, 0.2)' : userAcc.role === 'PIC' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                          color: userAcc.role === 'Ketua Bengkel' ? '#c084fc' : userAcc.role === 'PIC' ? '#22d3ee' : '#94a3b8'
                        }}>
                          {userAcc.role}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Ruang PIN 4-Digit */}
            <div className="form-group" style={{ width: '100%', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label htmlFor="login-pin-input" style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Masukkan PIN 4-Digit
                </label>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  (Lalai: 1234)
                </span>
              </div>
              <input
                id="login-pin-input"
                ref={pinInputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                className="input-field"
                placeholder="••••"
                value={loginPin}
                onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, ''))}
                required
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  fontSize: '1.35rem',
                  letterSpacing: '0.4em',
                  textAlign: 'center',
                  paddingTop: '0.75rem',
                  paddingBottom: '0.75rem',
                  minHeight: '48px',
                }}
              />
            </div>

            <button
              id="login-btn"
              type="submit"
              className="btn"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                marginTop: '0.5rem',
                background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                boxShadow: '0 4px 15px rgba(79, 70, 229, 0.4)'
              }}
            >
              Masuk Sistem <span>➔</span>
            </button>
          </form>
        )}

        {/* ── 3. MOD DAFTAR AKAUN BAHARU (TERUS AKTIF) ── */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="auth-form" style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            
            {regError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                color: '#fca5a5',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span>⚠️</span>
                <span>{regError}</span>
              </div>
            )}

            {regSuccess && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                color: '#6ee7b7',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span>✓</span>
                <span>{regSuccess}</span>
              </div>
            )}

            {/* Nama Penuh */}
            <div className="form-group">
              <label htmlFor="reg-name-input" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Nama Penuh *
              </label>
              <input
                id="reg-name-input"
                type="text"
                className="input-field"
                placeholder="Contoh: Encik Ahmad Zaki"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                required
              />
            </div>

            {/* Peranan (Role) */}
            <div className="form-group">
              <label htmlFor="reg-role-select" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Peranan (Role) *
              </label>
              <select
                id="reg-role-select"
                className="input-field select-field"
                value={regRole}
                onChange={(e) => setRegRole(e.target.value as UserRole)}
              >
                <option value="Pensyarah">Pensyarah (Peminjam sahaja)</option>
                <option value="PIC">PIC Stor (Urus stor sendiri)</option>
                <option value="Ketua Bengkel">Ketua Bengkel (Urus & Lulus Pinjaman)</option>
              </select>
            </div>

            {/* Bengkel */}
            <div className="form-group">
              <label htmlFor="reg-workshop-select" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Bengkel *
              </label>
              <select
                id="reg-workshop-select"
                className="input-field select-field"
                value={regWorkshop}
                onChange={(e) => setRegWorkshop(e.target.value as WorkshopType)}
              >
                <option value="Perakaunan">Perakaunan</option>
                <option value="Teknologi Penyejukan dan Penyamanan Udara">Teknologi Penyejukan dan Penyamanan Udara (TPPU)</option>
                <option value="Teknologi Automotif">Teknologi Automotif</option>
                <option value="Pengurusan Perniagaan">Pengurusan Perniagaan</option>
              </select>
            </div>

            {/* Cipta PIN 4-Digit Peribadi */}
            <div className="form-group">
              <label htmlFor="reg-pin-input" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Cipta PIN 4-Digit Peribadi *
              </label>
              <input
                id="reg-pin-input"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                className="input-field"
                placeholder="Contoh: 5678"
                value={regPin}
                onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
                required
                style={{ fontSize: '1.1rem', letterSpacing: '0.3em', textAlign: 'center' }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                PIN ini akan digunakan semasa anda log masuk ke sistem.
              </span>
            </div>

            {/* KAWALAN KESELAMATAN (Master Passcode untuk PIC / Ketua Bengkel) */}
            {(regRole === 'Ketua Bengkel' || regRole === 'PIC') && (
              <div className="form-group" style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                padding: '0.85rem',
                borderRadius: '8px'
              }}>
                <label htmlFor="reg-passcode-input" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 700, fontSize: '0.82rem', color: '#fbbf24' }}>
                  🔒 Kunci Pengesahan Bengkel (Master Passcode) *
                </label>
                <input
                  id="reg-passcode-input"
                  type="password"
                  className="input-field"
                  placeholder="Masukkan passcode (lalai: KV123)"
                  value={regPasscode}
                  onChange={(e) => setRegPasscode(e.target.value)}
                  required
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  Diperlukan untuk mendaftar peranan pengurusan stor (lalai: <strong>KV123</strong>).
                </span>
              </div>
            )}

            <button
              id="register-submit-btn"
              type="submit"
              className="btn"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                marginTop: '0.5rem',
                background: 'linear-gradient(135deg, #0891b2, #06b6d4)',
                boxShadow: '0 4px 15px rgba(6, 182, 212, 0.35)'
              }}
            >
              Daftar & Terus Masuk <span>➔</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
