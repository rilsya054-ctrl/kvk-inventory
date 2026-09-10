import React, { useState, useCallback, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useInventory } from '../context/InventoryContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImportRow {
  _id: string;
  isSelected: boolean;
  // Core fields from Excel
  namaBarang: string;
  jenis: 'Peralatan' | 'Barang Luak';
  kategori: string;
  kod: string;
  kuantitiBaki: number | '';
  jumlahStok: number | '';
  unit: string;
  hadStokMin: number | '';
  brand: string;
  sku: string;
  seksyen: string;
  lokasi: string;
  // Parse status
  hasError: boolean;
  errorMsg: string;
}

interface ExcelImportModalProps {
  onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const UNIT_OPTIONS = ['unit', 'pcs', 'roll', 'kotak', 'set', 'meter', 'botol', 'biji', 'tong', 'keping', 'pasang'];

const KATEGORI_LIST: [string, string][] = [
  ['AT',  'Alat Tangan'],
  ['ATE', 'Alat Tangan Elektrik'],
  ['AU',  'Alat Ukur'],
  ['AKT', 'Alat Khas & Testing'],
  ['AK',  'Alat Khas'],
  ['KGM', 'Kelengkapan & Mesin'],
  ['AKE', 'Alat Khas Elektrik'],
  ['ME',  'Mesin & Peralatan'],
  ['MKE', 'Mesin & Kelengkapan Elektrik'],
  ['AUE', 'Alat Ukur Elektrik'],
  ['UE',  'Ukuran & Ujian Elektrik'],
  ['KE',  'Kelengkapan Elektrik'],
  ['ICT', 'Teknologi Maklumat & Komunikasi'],
];

// 11 Standard Template Headers in order (Kolom A - Kolom K)
const TEMPLATE_HEADERS = [
  'NAMA BARANG',
  'JENIS',
  'KATEGORI',
  'KOD',
  'BRAND',
  'SKU',
  'SEKSYEN',
  'LOKASI',
  'KUANTITI BAKI',
  'HAD STOK MIN',
  'UNIT',
];

const TEMPLATE_SAMPLE_ROWS = [
  ['Spanar Kombinasi 10mm', 'Peralatan', 'Alat Tangan', 'AT', 'Stanley', 'AT-001', 'WRENCH', 'RAK-A1', 10, 5, 'unit'],
  ['Pita Elektrik 3M', 'Barang Luak', 'Alat Khas Elektrik', 'AKE', '3M', 'AKE-002', 'ELEKTRIK', 'RAK-B2', 50, 10, 'roll'],
  ['Minyak Pelincir 4T 10W-40', 'Barang Luak', 'Pelincir', 'PL', 'Shell', 'PL-003', 'AUTOMOTIF', 'RAK-C3', 20, 5, 'botol'],
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateTempId = () => '_' + Math.random().toString(36).substr(2, 9);

const normalizeJenis = (val: string): 'Peralatan' | 'Barang Luak' => {
  const lower = (val || '').toLowerCase().trim();
  if (lower.includes('luak') || lower.includes('habis') || lower.includes('consumable') || lower.includes('pakai')) {
    return 'Barang Luak';
  }
  return 'Peralatan';
};

// Regex numeric parser: extracts numeric values from string e.g. "8 roll" -> 8, "1 pcs" -> 1
const cleanNumericValue = (val: unknown): number | null => {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const str = String(val).trim();
  const cleaned = str.replace(/[^0-9]/g, '');
  if (!cleaned) return null;
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? null : parsed;
};

// Unit string extractor: extracts non-numeric unit suffix e.g. "8 roll" -> "roll", "1 pcs" -> "pcs"
const extractUnitString = (val: unknown): string | null => {
  if (val === undefined || val === null || typeof val === 'number') return null;
  const str = String(val).trim();
  const unitText = str.replace(/[0-9.]/g, '').trim().toLowerCase();
  if (unitText.length > 0) {
    return unitText;
  }
  return null;
};

type TargetField = keyof Pick<
  ImportRow,
  | 'namaBarang'
  | 'jenis'
  | 'kategori'
  | 'kod'
  | 'brand'
  | 'sku'
  | 'seksyen'
  | 'lokasi'
  | 'kuantitiBaki'
  | 'hadStokMin'
  | 'unit'
  | 'jumlahStok'
>;

// Maps official & user Excel headers (lowercase trimmed) to internal fields
const HEADER_MAP: Record<string, TargetField> = {
  // NAMA BARANG (Kolom A)
  'nama barang': 'namaBarang',
  'nama alatan': 'namaBarang',
  'nama item': 'namaBarang',
  'nama': 'namaBarang',
  'name': 'namaBarang',
  'alatan': 'namaBarang',
  'item': 'namaBarang',
  'item name': 'namaBarang',

  // JENIS (Kolom B)
  'jenis': 'jenis',
  'jenis barang': 'jenis',
  'type': 'jenis',
  'item type': 'jenis',

  // KATEGORI (Kolom C)
  'kategori': 'kategori',
  'category': 'kategori',
  'nama kategori': 'kategori',

  // KOD (Kolom D)
  'kod': 'kod',
  'code': 'kod',
  'kod kategori': 'kod',
  'category code': 'kod',

  // BRAND (Kolom E)
  'brand': 'brand',
  'jenama': 'brand',
  'catatan / brand': 'brand',
  'catatan/brand': 'brand',
  'catatan / sub': 'brand',
  'catatan/sub': 'brand',
  'catatan': 'brand',
  'sub': 'brand',
  'make': 'brand',

  // SKU (Kolom F)
  'sku': 'sku',
  'kod / sku': 'sku',
  'kod/sku': 'sku',
  'kod alatan': 'sku',
  'sku code': 'sku',
  'item code': 'sku',
  'kod item': 'sku',

  // SEKSYEN (Kolom G)
  'seksyen': 'seksyen',
  'section': 'seksyen',
  'bahagian': 'seksyen',

  // LOKASI (Kolom H)
  'lokasi': 'lokasi',
  'kedudukan': 'lokasi',
  'kedudukan rak': 'lokasi',
  'rak': 'lokasi',
  'location': 'lokasi',
  'shelf': 'lokasi',
  'rack': 'lokasi',

  // KUANTITI BAKI (Kolom I)
  'kuantiti baki': 'kuantitiBaki',
  'baki kuantiti': 'kuantitiBaki',
  'kuantiti': 'kuantitiBaki',
  'baki stok': 'kuantitiBaki',
  'baki': 'kuantitiBaki',
  'quantity': 'kuantitiBaki',
  'qty': 'kuantitiBaki',
  'balance': 'kuantitiBaki',

  // HAD STOK MIN (Kolom J)
  'had stok min': 'hadStokMin',
  'had stok minima': 'hadStokMin',
  'had min': 'hadStokMin',
  'had minima': 'hadStokMin',
  'stok min': 'hadStokMin',
  'stok minima': 'hadStokMin',
  'min stock': 'hadStokMin',
  'minimum stock': 'hadStokMin',
  'minimum': 'hadStokMin',
  'min': 'hadStokMin',

  // UNIT (Kolom K)
  'unit': 'unit',
  'unit ukuran': 'unit',
  'uom': 'unit',

  // JUMLAH STOK (Optional field)
  'jumlah stok': 'jumlahStok',
  'jumlah': 'jumlahStok',
  'total stock': 'jumlahStok',
  'total quantity': 'jumlahStok',
  'total': 'jumlahStok',
};

// Robust dynamic header resolver: strips parenthetical notes, normalizes whitespace, and matches keywords
const resolveHeaderField = (header: string): TargetField | null => {
  if (!header || typeof header !== 'string') return null;

  // 1. Strip notes in parentheses e.g. "KUANTITI BAKI (Nilai angka)" -> "KUANTITI BAKI"
  const withoutBrackets = header.replace(/\(.*?\)/g, '').trim();
  const clean = withoutBrackets.toLowerCase().replace(/[\r\n\t_]+/g, ' ').replace(/\s+/g, ' ').trim();

  if (HEADER_MAP[clean]) return HEADER_MAP[clean];

  const rawClean = header.toLowerCase().replace(/[\r\n\t_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (HEADER_MAP[rawClean]) return HEADER_MAP[rawClean];

  // 2. Keyword heuristic matching (order matters)
  if (clean.includes('baki') || clean.includes('kuantiti') || clean.includes('quantity') || clean.includes('qty')) {
    if (clean.includes('min')) return 'hadStokMin';
    if (clean.includes('jumlah') || clean.includes('total')) return 'jumlahStok';
    return 'kuantitiBaki';
  }
  if (clean.includes('min')) return 'hadStokMin';
  if (clean.includes('jumlah') || clean.includes('total')) return 'jumlahStok';
  if (clean.includes('nama') || clean.includes('item') || clean === 'alatan') return 'namaBarang';
  if (clean.includes('jenis') || clean === 'type') return 'jenis';
  if (clean === 'kod' || clean === 'code' || clean === 'kod kategori') return 'kod';
  if (clean.includes('sku') || clean === 'kod alatan') return 'sku';
  if (clean.includes('kategori') || clean.includes('category')) return 'kategori';
  if (clean.includes('brand') || clean.includes('jenama') || clean.includes('catatan') || clean === 'sub') return 'brand';
  if (clean.includes('seksyen') || clean.includes('section') || clean.includes('bahagian')) return 'seksyen';
  if (clean.includes('lokasi') || clean.includes('kedudukan') || clean.includes('location') || clean.includes('rak') || clean.includes('shelf')) return 'lokasi';
  if (clean.includes('unit') || clean === 'uom') return 'unit';

  return null;
};

// ─── Template Download ────────────────────────────────────────────────────────

const downloadTemplate = () => {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_SAMPLE_ROWS]);

  // Column widths: Kolom A hingga Kolom K
  ws['!cols'] = [
    { wch: 30 }, // A: NAMA BARANG
    { wch: 14 }, // B: JENIS
    { wch: 20 }, // C: KATEGORI
    { wch: 10 }, // D: KOD
    { wch: 16 }, // E: BRAND
    { wch: 14 }, // F: SKU
    { wch: 16 }, // G: SEKSYEN
    { wch: 14 }, // H: LOKASI
    { wch: 16 }, // I: KUANTITI BAKI
    { wch: 14 }, // J: HAD STOK MIN
    { wch: 12 }, // K: UNIT
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventori');
  XLSX.writeFile(wb, 'Template_Inventori_KV.xlsx');
};

// ─── InlineNumber ─────────────────────────────────────────────────────────────

interface InlineNumberProps {
  value: number | '';
  onChange: (v: number | '') => void;
  min?: number;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

const InlineNumber: React.FC<InlineNumberProps> = ({ value, onChange, min = 0, placeholder, disabled, id }) => (
  <input
    id={id}
    type="number"
    className="import-inline-input"
    value={value === undefined || value === null ? '' : value}
    min={min}
    placeholder={placeholder}
    disabled={disabled}
    onFocus={(e) => e.target.select()}
    onChange={(e) => {
      const raw = e.target.value;
      const cleaned = raw.replace(/^0+(?=\d)/, '');
      if (cleaned === '') { onChange(''); return; }
      const n = Number(cleaned);
      onChange(isNaN(n) ? '' : n);
    }}
  />
);

// ─── Kategori Badge ───────────────────────────────────────────────────────────

const KATEGORI_COLORS: Record<string, { bg: string; text: string }> = {
  AT:   { bg: '#1e3a5f', text: '#60a5fa' },
  ATE:  { bg: '#1e3a5f', text: '#93c5fd' },
  AU:   { bg: '#1a3a2e', text: '#34d399' },
  AKT:  { bg: '#2d2a1e', text: '#fbbf24' },
  AK:   { bg: '#2d1e3a', text: '#c084fc' },
  KGM:  { bg: '#3a1e1e', text: '#f87171' },
  AKE:  { bg: '#1e2d3a', text: '#38bdf8' },
  ME:   { bg: '#1a2d1e', text: '#4ade80' },
  MKE:  { bg: '#1a2d1e', text: '#86efac' },
  AUE:  { bg: '#2d2a1e', text: '#fde68a' },
  UE:   { bg: '#1e1e3a', text: '#818cf8' },
  KE:   { bg: '#1e1e3a', text: '#a5b4fc' },
  ICT:  { bg: '#1e2d3a', text: '#7dd3fc' },
};

const KategoriBadge: React.FC<{ value: string }> = ({ value }) => {
  const style = KATEGORI_COLORS[value] || { bg: '#1e2430', text: '#94a3b8' };
  return (
    <span style={{
      background: style.bg,
      color: style.text,
      border: `1px solid ${style.text}40`,
      borderRadius: 4,
      padding: '1px 6px',
      fontSize: '0.7rem',
      fontWeight: 700,
      letterSpacing: '0.03em',
      whiteSpace: 'nowrap',
    }}>
      {value || '—'}
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({ onClose }) => {
  const { addItem } = useInventory();

  // ── State ──────────────────────────────────────────────────────────────────
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview filter states
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewJenis, setPreviewJenis] = useState('Semua');
  const [previewKategori, setPreviewKategori] = useState('Semua');
  const [previewStatus, setPreviewStatus] = useState('Semua');

  // ── Parse Excel ────────────────────────────────────────────────────────────

  // ── Parse Excel (Dynamic Header Mapping) ────────────────────────────────────

  const parseExcel = useCallback((file: File) => {
    setParseError('');
    setRows([]);
    setSavedCount(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        if (!sheet) {
          setParseError('Fail Excel tidak mengandungi helaian (sheet) yang sah.');
          return;
        }

        // 1. Convert sheet to 2D array of rows
        const rawAoa: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (rawAoa.length === 0) {
          setParseError('Fail Excel ini kosong atau tidak mengandungi data.');
          return;
        }

        // 2. Locate header row dynamically (scans first 15 rows)
        let headerRowIdx = -1;
        let colIndexToField: Record<number, TargetField> = {};

        for (let r = 0; r < Math.min(rawAoa.length, 15); r++) {
          const row = rawAoa[r];
          if (!Array.isArray(row)) continue;
          const tempMap: Record<number, TargetField> = {};
          let matchedCount = 0;

          for (let c = 0; c < row.length; c++) {
            const cellVal = String(row[c] ?? '').trim();
            if (!cellVal) continue;
            const field = resolveHeaderField(cellVal);
            if (field) {
              tempMap[c] = field;
              matchedCount++;
            }
          }

          // Found header row if at least 2 known column headers match
          if (matchedCount >= 2) {
            headerRowIdx = r;
            colIndexToField = tempMap;
            break;
          }
        }

        type RowDataHolder = {
          fields: Partial<Record<TargetField, string>>;
          rawBaki?: unknown;
          rawJumlah?: unknown;
          rawUnit?: unknown;
          rawHadMin?: unknown;
        };

        const parsedRowsData: RowDataHolder[] = [];

        if (headerRowIdx !== -1) {
          for (let r = headerRowIdx + 1; r < rawAoa.length; r++) {
            const rowData = rawAoa[r];
            if (!Array.isArray(rowData)) continue;
            const hasAnyData = rowData.some(cell => cell !== '' && cell !== null && cell !== undefined);
            if (!hasAnyData) continue;

            const fields: Partial<Record<TargetField, string>> = {};
            let rawBaki: unknown = undefined;
            let rawJumlah: unknown = undefined;
            let rawUnit: unknown = undefined;
            let rawHadMin: unknown = undefined;

            for (let c = 0; c < rowData.length; c++) {
              const field = colIndexToField[c];
              if (!field) continue;
              const val = rowData[c];

              if (field === 'kuantitiBaki') {
                rawBaki = val;
              } else if (field === 'jumlahStok') {
                rawJumlah = val;
              } else if (field === 'unit') {
                rawUnit = val;
              } else if (field === 'hadStokMin') {
                rawHadMin = val;
              } else {
                fields[field] = String(val ?? '').trim();
              }
            }

            parsedRowsData.push({ fields, rawBaki, rawJumlah, rawUnit, rawHadMin });
          }
        } else {
          // Object-based fallback
          const rawObjRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          for (const objRow of rawObjRows) {
            const fields: Partial<Record<TargetField, string>> = {};
            let rawBaki: unknown = undefined;
            let rawJumlah: unknown = undefined;
            let rawUnit: unknown = undefined;
            let rawHadMin: unknown = undefined;

            for (const [colKey, rawVal] of Object.entries(objRow)) {
              const field = resolveHeaderField(colKey);
              if (!field) continue;

              if (field === 'kuantitiBaki') {
                rawBaki = rawVal;
              } else if (field === 'jumlahStok') {
                rawJumlah = rawVal;
              } else if (field === 'unit') {
                rawUnit = rawVal;
              } else if (field === 'hadStokMin') {
                rawHadMin = rawVal;
              } else {
                fields[field] = String(rawVal ?? '').trim();
              }
            }

            parsedRowsData.push({ fields, rawBaki, rawJumlah, rawUnit, rawHadMin });
          }
        }

        if (parsedRowsData.length === 0) {
          setParseError('Tiada baris data dijumpai dalam fail Excel anda.');
          return;
        }

        const mapped: ImportRow[] = parsedRowsData.map(({ fields, rawBaki, rawJumlah, rawUnit, rawHadMin }) => {
          const namaBarang = fields.namaBarang || '';
          const jenis = normalizeJenis(fields.jenis || '');
          let kategori = fields.kategori || '';
          let kod = (fields.kod || '').toUpperCase();
          const brand = fields.brand || 'N/A';
          let sku = (fields.sku || '').toUpperCase();
          const seksyen = fields.seksyen || 'N/A';
          const lokasi = fields.lokasi || 'RAK-A1';

          // If kod is provided but kategori is empty, try to match code in KATEGORI_LIST
          if (kod && !kategori) {
            const found = KATEGORI_LIST.find(([code]) => code.toUpperCase() === kod);
            if (found) kategori = found[1];
          }
          // If kategori is provided but kod is empty, try to match label or code in KATEGORI_LIST
          if (kategori && !kod) {
            const foundByCode = KATEGORI_LIST.find(([code]) => code.toUpperCase() === kategori.toUpperCase());
            if (foundByCode) {
              kod = foundByCode[0];
            } else {
              const foundByLabel = KATEGORI_LIST.find(([, label]) => label.toLowerCase() === kategori.toLowerCase());
              if (foundByLabel) kod = foundByLabel[0];
            }
          }

          // Auto-derive SKU if empty
          if (!sku) {
            const prefix = (kod || kategori || 'BRG').replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'BRG';
            sku = `${prefix}-${generateTempId().slice(-3).toUpperCase()}`;
          }

          // 1. Clean & Parse BAKI (kuantitiBaki) using regex numeric parser
          const parsedBaki = cleanNumericValue(rawBaki);
          const kuantitiBaki = parsedBaki !== null ? parsedBaki : '';

          // 2. Clean & Parse JUMLAH STOK (jumlahStok) — Fallback to kuantitiBaki if empty
          const parsedJumlah = cleanNumericValue(rawJumlah);
          const jumlahStok = parsedJumlah !== null ? parsedJumlah : (parsedBaki !== null ? parsedBaki : '');

          // 3. Unit Determination
          let unit = 'unit';
          if (rawUnit && String(rawUnit).trim()) {
            unit = String(rawUnit).trim();
          } else {
            const extracted = extractUnitString(rawBaki) || extractUnitString(rawJumlah);
            if (extracted) unit = extracted;
          }

          // 4. HAD MIN (hadStokMin) — Default to 5 if missing or empty
          const parsedHadMin = cleanNumericValue(rawHadMin);
          const hadStokMin = parsedHadMin !== null ? parsedHadMin : 5;

          const rowItem: ImportRow = {
            _id: generateTempId(),
            isSelected: false,
            namaBarang,
            jenis,
            kategori: kategori || kod || 'Alat Tangan',
            kod: kod || 'AT',
            brand,
            sku,
            seksyen,
            lokasi,
            kuantitiBaki,
            jumlahStok,
            unit,
            hadStokMin,
            hasError: false,
            errorMsg: '',
          };

          // Validate required fields
          const errors: string[] = [];
          if (!rowItem.namaBarang) errors.push('Nama Barang kosong');
          if (rowItem.kuantitiBaki === '') errors.push('Kuantiti Baki diperlukan');
          rowItem.hasError = errors.length > 0;
          rowItem.errorMsg = errors.join(', ');
          rowItem.isSelected = !rowItem.hasError;

          return rowItem;
        }).filter(r => r.namaBarang && r.namaBarang.length > 0);

        if (mapped.length === 0) {
          setParseError('Tiada baris data yang sah dijumpai. Pastikan fail mengandungi tajuk kolom seperti NAMA BARANG dan KUANTITI BAKI.');
          return;
        }

        setRows(mapped);
      } catch {
        setParseError('Gagal membaca fail Excel. Pastikan fail adalah format .xlsx atau .xls yang sah.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleFile = (file: File | null) => {
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setParseError('Hanya fail format .xlsx atau .xls dibenarkan.');
      return;
    }
    setFileName(file.name);
    parseExcel(file);
  };

  // ── Drag & Drop ────────────────────────────────────────────────────────────

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  // ── Filtered Preview Rows ─────────────────────────────────────────────────

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (previewSearch) {
        const term = previewSearch.toLowerCase();
        const matchesName = r.namaBarang.toLowerCase().includes(term);
        const matchesSku = r.sku.toLowerCase().includes(term);
        const matchesKod = r.kod.toLowerCase().includes(term);
        if (!matchesName && !matchesSku && !matchesKod) return false;
      }
      if (previewJenis !== 'Semua' && r.jenis !== previewJenis) return false;
      if (previewKategori !== 'Semua' && r.kategori !== previewKategori && r.kod !== previewKategori) return false;
      if (previewStatus === 'Dipilih' && !r.isSelected) return false;
      if (previewStatus === 'Tidak Dipilih' && r.isSelected) return false;
      if (previewStatus === 'Ada Ralat' && !r.hasError) return false;
      return true;
    });
  }, [rows, previewSearch, previewJenis, previewKategori, previewStatus]);

  // ── Checkbox Logic ─────────────────────────────────────────────────────────

  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every(r => r.isSelected);
  const someFilteredSelected = filteredRows.some(r => r.isSelected);
  const totalSelected = rows.filter(r => r.isSelected);

  const toggleRow = (id: string) => {
    setRows(prev => prev.map(r => r._id === id ? { ...r, isSelected: !r.isSelected } : r));
  };

  const toggleAll = () => {
    const next = !allFilteredSelected;
    const filteredIds = new Set(filteredRows.map(r => r._id));
    setRows(prev => prev.map(r => filteredIds.has(r._id) ? { ...r, isSelected: next } : r));
  };

  const updateRow = <K extends keyof ImportRow>(id: string, field: K, value: ImportRow[K]) => {
    setRows(prev => prev.map(r => r._id === id ? { ...r, [field]: value } : r));
  };

  // ── Validation ─────────────────────────────────────────────────────────────

  const getRowError = (row: ImportRow): string | null => {
    if (!row.isSelected) return null;
    if (row.kuantitiBaki === '' || Number(row.kuantitiBaki) < 0) return 'Kuantiti Baki diperlukan';
    if (row.hadStokMin === '' || Number(row.hadStokMin) < 0) return 'Had Stok Min diperlukan';
    if (!row.unit) return 'Unit diperlukan';
    return null;
  };

  const hasValidationErrors = totalSelected.some(r => getRowError(r) !== null);

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (hasValidationErrors || totalSelected.length === 0) return;
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 400));

    for (const row of totalSelected) {
      const bakiNum = Number(row.kuantitiBaki);
      const jumlahNum = row.jumlahStok !== '' ? Number(row.jumlahStok) : bakiNum;
      addItem({
        name: row.namaBarang.trim(),
        brand: row.brand || 'N/A',
        sku: row.sku.trim().toUpperCase() || `SKU-${generateTempId().toUpperCase()}`,
        quantity: bakiNum,
        totalQuantity: Math.max(jumlahNum, bakiNum),
        location: row.lokasi || 'RAK-A1',
        kategori: row.jenis === 'Barang Luak' ? 'habis_pakai' : 'peralatan',
        unit: row.unit,
        stokMinima: Number(row.hadStokMin),
      });
    }

    setIsSaving(false);
    setSavedCount(totalSelected.length);
  };

  // ── Unique filter options from data ────────────────────────────────────────
  const uniqueKategori = useMemo(() => {
    const set = new Set(rows.map(r => r.kategori).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="import-modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <h2 className="modal-title">📂 Import Inventori dari Excel</h2>
            <p className="modal-subtitle">Muat naik fail Excel, semak pralihat, dan simpan barang yang dipilih ke inventori.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Template Download Button */}
            <button
              className="btn btn-outline"
              style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
              onClick={downloadTemplate}
              title="Muat turun fail template Excel dengan header rasmi"
            >
              ⬇️ Muat Turun Template
            </button>
            <button className="modal-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* ── Success State ── */}
        {savedCount !== null ? (
          <div className="import-success-state">
            <div className="import-success-icon">✅</div>
            <h3>{savedCount} barang berjaya diimport!</h3>
            <p>Semua barang yang dipilih telah ditambah ke inventori stor semasa.</p>
            <button className="btn" onClick={onClose}>Tutup</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>

            {/* ── Upload Zone ── */}
            {rows.length === 0 && (
              <div
                className={`import-dropzone ${isDragging ? 'dragging' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
                <div className="import-dropzone-icon">📊</div>
                <h3 className="import-dropzone-title">Seret &amp; Lepas Fail Excel di Sini</h3>
                <p className="import-dropzone-sub">atau klik untuk pilih fail (.xlsx / .xls)</p>
                <div className="import-dropzone-hint">
                  <strong>Header Rasmi Template:</strong> NAMA BARANG · JENIS · KATEGORI · KOD · BRAND · SKU · SEKSYEN · LOKASI · KUANTITI BAKI · HAD STOK MIN · UNIT
                </div>
              </div>
            )}

            {/* ── Error Banner ── */}
            {parseError && (
              <div className="import-error-banner">
                ⚠️ {parseError}
                <button
                  onClick={() => setParseError('')}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '0.9rem' }}
                >✕</button>
              </div>
            )}

            {/* ── Preview Section ── */}
            {rows.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

                {/* File Info */}
                <div className="import-file-info">
                  <span className="import-file-badge">📄 {fileName}</span>
                  <span className="import-row-count">{rows.length} baris dijumpai</span>
                  <button
                    className="btn-change-store"
                    style={{ marginLeft: 'auto', fontSize: '0.75rem' }}
                    onClick={() => { setRows([]); setFileName(''); setParseError(''); setPreviewSearch(''); setPreviewJenis('Semua'); setPreviewKategori('Semua'); setPreviewStatus('Semua'); }}
                  >
                    🔄 Tukar Fail
                  </button>
                </div>

                {/* ── Preview Filter Bar ── */}
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  padding: '0.6rem 1rem',
                  background: 'rgba(15,23,42,0.6)',
                  borderBottom: '1px solid rgba(100,116,139,0.15)',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  flexShrink: 0,
                }}>
                  {/* Search */}
                  <div style={{ position: 'relative', flex: '1 1 150px', minWidth: 120 }}>
                    <span style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', opacity: 0.5 }}>🔍</span>
                    <input
                      type="text"
                      placeholder="Cari nama / SKU..."
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                      style={{
                        width: '100%',
                        paddingLeft: '1.6rem',
                        paddingRight: '0.5rem',
                        paddingTop: '0.3rem',
                        paddingBottom: '0.3rem',
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

                  {/* Jenis filter */}
                  <select
                    className="filter-dropdown-select"
                    value={previewJenis}
                    onChange={(e) => setPreviewJenis(e.target.value)}
                    style={{ flex: '0 0 auto', minWidth: 110 }}
                  >
                    <option value="Semua">Semua Jenis</option>
                    <option value="Peralatan">Peralatan</option>
                    <option value="Barang Luak">Barang Luak</option>
                  </select>

                  {/* Kategori filter */}
                  <select
                    className="filter-dropdown-select"
                    value={previewKategori}
                    onChange={(e) => setPreviewKategori(e.target.value)}
                    style={{ flex: '0 0 auto', minWidth: 200 }}
                  >
                    <option value="Semua" style={{ background: '#0f172a', color: '#f1f5f9' }}>Semua Kategori</option>
                    {(uniqueKategori.length > 0
                      ? KATEGORI_LIST.filter(([code]) => uniqueKategori.includes(code))
                      : KATEGORI_LIST
                    ).map(([code, label]) => (
                      <option key={code} value={code} style={{ background: '#0f172a', color: '#f1f5f9' }}>
                        {code} — {label}
                      </option>
                    ))}
                  </select>

                  {/* Status filter */}
                  <select
                    className="filter-dropdown-select"
                    value={previewStatus}
                    onChange={(e) => setPreviewStatus(e.target.value)}
                    style={{ flex: '0 0 auto', minWidth: 120 }}
                  >
                    <option value="Semua">Semua Status</option>
                    <option value="Dipilih">✅ Dipilih</option>
                    <option value="Tidak Dipilih">☐ Tidak Dipilih</option>
                    <option value="Ada Ralat">⚠️ Ada Ralat</option>
                  </select>

                  {/* Result count */}
                  <span style={{ fontSize: '0.7rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                    {filteredRows.length}/{rows.length} baris
                  </span>
                </div>

                {/* ── Preview Table ── */}
                <div className="import-table-wrapper" style={{ flex: 1, minHeight: 0 }}>
                  <table className="import-table">
                    <thead>
                      <tr>
                        <th className="import-th-check">
                          <input
                            type="checkbox"
                            className="import-checkbox"
                            checked={allFilteredSelected}
                            ref={el => { if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected; }}
                            onChange={toggleAll}
                            title="Pilih / Nyahpilih Semua (dalam paparan)"
                          />
                        </th>
                        <th style={{ minWidth: 160 }}>Nama Barang</th>
                        <th style={{ minWidth: 80 }}>Jenis</th>
                        <th style={{ minWidth: 80 }}>Kategori</th>
                        <th style={{ minWidth: 60 }}>Kod</th>
                        <th style={{ minWidth: 60 }}>Brand</th>
                        <th style={{ minWidth: 80 }}>SKU</th>
                        <th style={{ minWidth: 70 }}>Seksyen</th>
                        <th style={{ minWidth: 80 }}>Lokasi</th>
                        <th className="import-th-required" style={{ minWidth: 90 }}>Kuantiti Baki <span className="required-star">*</span></th>
                        <th className="import-th-required" style={{ minWidth: 90 }}>Had Stok Min <span className="required-star">*</span></th>
                        <th className="import-th-required" style={{ minWidth: 80 }}>Unit <span className="required-star">*</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={12} style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.85rem' }}>
                            Tiada baris yang sepadan dengan penapis semasa.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((row) => {
                          const rowErr = getRowError(row);
                          return (
                            <tr
                              key={row._id}
                              className={`import-row ${row.isSelected ? 'selected' : 'unselected'} ${rowErr ? 'has-error' : ''}`}
                            >
                              {/* Checkbox */}
                              <td className="import-td-check">
                                <input
                                  type="checkbox"
                                  className="import-checkbox"
                                  checked={row.isSelected}
                                  onChange={() => toggleRow(row._id)}
                                />
                              </td>

                              {/* Static: Nama Barang */}
                              <td className="import-td-name">
                                <span className="import-item-name" title={row.namaBarang}>{row.namaBarang}</span>
                                {row.hasError && !row.isSelected && (
                                  <span title={row.errorMsg} style={{ marginLeft: 4, color: '#f97316', fontSize: '0.65rem' }}>⚠️</span>
                                )}
                              </td>

                              {/* Jenis */}
                              <td className="import-td-sm">
                                <span style={{
                                  background: row.jenis === 'Barang Luak' ? 'rgba(251,146,60,0.15)' : 'rgba(167,139,250,0.15)',
                                  color: row.jenis === 'Barang Luak' ? '#fb923c' : '#a78bfa',
                                  border: `1px solid ${row.jenis === 'Barang Luak' ? '#fb923c40' : '#a78bfa40'}`,
                                  borderRadius: 4,
                                  padding: '1px 6px',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                }}>
                                  {row.jenis}
                                </span>
                              </td>

                              {/* Kategori */}
                              <td className="import-td-sm">
                                <KategoriBadge value={row.kategori} />
                              </td>

                              {/* Kod */}
                              <td className="import-td-sm">
                                <span style={{
                                  background: 'rgba(99, 102, 241, 0.12)',
                                  color: '#a5b4fc',
                                  border: '1px solid rgba(99, 102, 241, 0.25)',
                                  borderRadius: 4,
                                  padding: '1px 6px',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                }}>
                                  {row.kod || '—'}
                                </span>
                              </td>

                              {/* Brand */}
                              <td className="import-td-sm" style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{row.brand}</td>

                              {/* SKU */}
                              <td className="import-td-sm">
                                <code className="import-sku-badge">{row.sku || '—'}</code>
                              </td>

                              {/* Seksyen */}
                              <td className="import-td-sm" style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{row.seksyen}</td>

                              {/* Lokasi */}
                              <td className="import-td-sm" style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{row.lokasi}</td>

                              {/* Kuantiti Baki (editable) */}
                              <td className="import-td-input">
                                <InlineNumber
                                  id={`qty-${row._id}`}
                                  value={row.kuantitiBaki}
                                  onChange={(v) => updateRow(row._id, 'kuantitiBaki', v)}
                                  min={0}
                                  placeholder="0"
                                  disabled={!row.isSelected}
                                />
                              </td>

                              {/* Had Stok Min (editable) */}
                              <td className="import-td-input">
                                <InlineNumber
                                  id={`min-${row._id}`}
                                  value={row.hadStokMin}
                                  onChange={(v) => updateRow(row._id, 'hadStokMin', v)}
                                  min={0}
                                  placeholder="0"
                                  disabled={!row.isSelected}
                                />
                              </td>

                              {/* Unit (editable) */}
                              <td className="import-td-input">
                                <select
                                  className="import-inline-select"
                                  value={row.unit}
                                  disabled={!row.isSelected}
                                  onChange={(e) => updateRow(row._id, 'unit', e.target.value)}
                                >
                                  {Array.from(new Set([...UNIT_OPTIONS, row.unit].filter(Boolean))).map(u => (
                                    <option key={u} value={u}>{u}</option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* ── Footer ── */}
                <div className="import-footer" style={{ flexShrink: 0 }}>
                  <div className="import-footer-info">
                    {totalSelected.length > 0 ? (
                      <>
                        <span className="import-selected-count">✅ {totalSelected.length} barang dipilih</span>
                        {hasValidationErrors && (
                          <span className="import-validation-warn">⚠️ Lengkapkan semua medan wajib (*) untuk barang dipilih</span>
                        )}
                      </>
                    ) : (
                      <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>Tiada barang dipilih. Tandakan checkbox untuk memilih.</span>
                    )}
                  </div>
                  <div className="import-footer-actions">
                    <button className="btn btn-outline" onClick={onClose}>Batal</button>
                    <button
                      className="btn btn-success"
                      disabled={totalSelected.length === 0 || hasValidationErrors || isSaving}
                      onClick={handleSave}
                    >
                      {isSaving
                        ? '⏳ Menyimpan...'
                        : `💾 Simpan ${totalSelected.length > 0 ? `(${totalSelected.length})` : ''} Barang Dipilih`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExcelImportModal;
