import React, { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  Barcode as BarcodeIcon, 
  Sparkles, 
  Layers, 
  CheckSquare, 
  Square, 
  Sliders, 
  Copy, 
  Package, 
  Activity, 
  Edit3, 
  Info,
  Calendar,
  Building2,
  Maximize2
} from 'lucide-react';
import { StripReagentItem, DtxMachine, QcLotConfig } from '../types';

interface BarcodePrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockItems?: StripReagentItem[];
  lotConfigs?: QcLotConfig[];
  machines?: DtxMachine[];
  initialSource?: 'stock' | 'lot' | 'machines' | 'custom';
  initialItemCode?: string;
  initialLotNumber?: string;
}

interface PrintableLabel {
  id: string;
  header: string;
  title: string;
  barcode: string;
  displayCode: string;
  subInfo1: string; // e.g. LOT: 2026-A
  subInfo2: string; // e.g. EXP: 2026-12-31
  showOpenDateBlank: boolean;
  copies: number;
}

// Crisp Vector Barcode Generator (Code128 visual pattern)
function BarcodeSvg({ text, height = 32, width = 140 }: { text: string; height?: number; width?: number }) {
  if (!text) return null;
  
  // Deterministic bar pattern based on char codes
  const bars: { x: number; w: number }[] = [];
  let currentX = 2;
  const hashSeed = text.split('').reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0);
  
  // Guard start bar
  bars.push({ x: currentX, w: 2 });
  currentX += 3;
  bars.push({ x: currentX, w: 1 });
  currentX += 3;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const p1 = (code % 3) + 1;
    const p2 = ((code * 3 + hashSeed) % 2) + 1;
    const p3 = ((code * 7) % 3) + 1;

    bars.push({ x: currentX, w: p1 });
    currentX += p1 + 1;
    bars.push({ x: currentX, w: p2 });
    currentX += p2 + 2;
    bars.push({ x: currentX, w: p3 });
    currentX += p3 + 1;
  }

  // Guard end bar
  bars.push({ x: currentX, w: 2 });
  currentX += 3;
  bars.push({ x: currentX, w: 1 });
  currentX += 2;

  return (
    <svg 
      viewBox={`0 0 ${currentX} 32`} 
      className="w-full"
      style={{ height: `${height}px`, maxWidth: `${width}px` }}
      preserveAspectRatio="none"
    >
      <rect width="100%" height="100%" fill="white" />
      {bars.map((bar, idx) => (
        <rect key={idx} x={bar.x} y="0" width={bar.w} height="32" fill="#000000" />
      ))}
    </svg>
  );
}

export const BarcodePrinterModal: React.FC<BarcodePrinterModalProps> = ({
  isOpen,
  onClose,
  stockItems = [],
  lotConfigs = [],
  machines = [],
  initialSource = 'stock',
  initialItemCode,
  initialLotNumber
}) => {
  const [sourceType, setSourceType] = useState<'stock' | 'lot' | 'machines' | 'custom'>(initialSource);
  const [printMode, setPrintMode] = useState<'roll_50x25' | 'a4_grid'>('roll_50x25');
  const [orgHeader, setOrgHeader] = useState<string>('รพ.สังขะ • งานชันสูตร');
  const [showOpenDateBlank, setShowOpenDateBlank] = useState<boolean>(true);
  const [globalCopies, setGlobalCopies] = useState<number>(1);
  const [zoomPreview, setZoomPreview] = useState<boolean>(false);

  // Stock selection state
  const [selectedStockIds, setSelectedStockIds] = useState<string[]>([]);

  // LOT selection state
  const [selectedLot, setSelectedLot] = useState<string>(initialLotNumber || lotConfigs[0]?.lotNumber || 'LOT2026-A');
  const [lotItemType, setLotItemType] = useState<'strip' | 'control_solution'>('strip');
  const [lotExpDate, setLotExpDate] = useState<string>(() => lotConfigs[0]?.expDate || '2026-12-31');
  const [lotPrintQty, setLotPrintQty] = useState<number>(10);

  // Machine selection state
  const [selectedMachineSerials, setSelectedMachineSerials] = useState<string[]>([]);
  const [machineWardFilter, setMachineWardFilter] = useState<string>('all');

  // Custom label state
  const [customTitle, setCustomTitle] = useState<string>('VivaChek Test Strip');
  const [customBarcode, setCustomBarcode] = useState<string>(initialItemCode || 'ST-2026A-01');
  const [customSub1, setCustomSub1] = useState<string>('LOT: LOT2026-A');
  const [customSub2, setCustomSub2] = useState<string>('EXP: 2026-12-31');
  const [customCopies, setCustomCopies] = useState<number>(5);

  // Initialize selected stock items
  useEffect(() => {
    if (stockItems && stockItems.length > 0) {
      if (initialItemCode) {
        const found = stockItems.filter(i => i.itemCode === initialItemCode).map(i => i.id);
        if (found.length > 0) setSelectedStockIds(found);
        else setSelectedStockIds(stockItems.slice(0, 8).map(i => i.id));
      } else {
        setSelectedStockIds(stockItems.slice(0, 8).map(i => i.id));
      }
    }
  }, [stockItems, initialItemCode]);

  // Update lot details when lot selection changes
  useEffect(() => {
    const cfg = lotConfigs.find(c => c.lotNumber === selectedLot);
    if (cfg) {
      if (cfg.expDate) setLotExpDate(cfg.expDate);
    }
  }, [selectedLot, lotConfigs]);

  if (!isOpen) return null;

  // Build the list of printable labels
  const getLabelsToPrint = (): PrintableLabel[] => {
    const labels: PrintableLabel[] = [];

    if (sourceType === 'stock') {
      const selected = stockItems.filter(item => selectedStockIds.includes(item.id));
      selected.forEach(item => {
        labels.push({
          id: item.id,
          header: orgHeader,
          title: item.itemType === 'control_solution' ? 'Control Solution' : 'VivaChek Fad Strip',
          barcode: item.itemCode,
          displayCode: item.itemCode,
          subInfo1: `LOT: ${item.lotNumber}`,
          subInfo2: `EXP: ${item.expDate || '-'}`,
          showOpenDateBlank: showOpenDateBlank,
          copies: globalCopies
        });
      });
    } else if (sourceType === 'lot') {
      for (let i = 1; i <= lotPrintQty; i++) {
        const prefix = lotItemType === 'control_solution' ? 'QC' : 'ST';
        const formattedIndex = String(i).padStart(2, '0');
        const unitCode = `${prefix}-${selectedLot.replace(/[^A-Za-z0-9]/g, '')}-${formattedIndex}`;
        labels.push({
          id: `LOT-${selectedLot}-${i}`,
          header: orgHeader,
          title: lotItemType === 'control_solution' ? 'Control Solution' : 'VivaChek Fad Strip',
          barcode: unitCode,
          displayCode: unitCode,
          subInfo1: `LOT: ${selectedLot}`,
          subInfo2: `EXP: ${lotExpDate || '-'}`,
          showOpenDateBlank: showOpenDateBlank,
          copies: 1
        });
      }
    } else if (sourceType === 'machines') {
      const selected = machines.filter(m => selectedMachineSerials.includes(m.serialNumber));
      selected.forEach(m => {
        labels.push({
          id: m.id || m.serialNumber,
          header: orgHeader,
          title: `เครื่อง DTX • ${m.ward || 'ไม่ระบุตึก'}`,
          barcode: m.serialNumber,
          displayCode: `S/N: ${m.serialNumber}`,
          subInfo1: `รุ่น: ${m.model || 'VivaChek Fad'}`,
          subInfo2: m.machineSerial ? `SN: ${m.machineSerial.slice(-8)}` : `LOT: ${m.lotNumber || '-'}`,
          showOpenDateBlank: false,
          copies: globalCopies
        });
      });
    } else if (sourceType === 'custom') {
      labels.push({
        id: 'CUSTOM-1',
        header: orgHeader,
        title: customTitle || 'VivaChek Test Strip',
        barcode: customBarcode || 'ST-2026A-01',
        displayCode: customBarcode || 'ST-2026A-01',
        subInfo1: customSub1 || 'LOT: LOT2026-A',
        subInfo2: customSub2 || 'EXP: 2026-12-31',
        showOpenDateBlank: showOpenDateBlank,
        copies: customCopies
      });
    }

    return labels;
  };

  const labelsToPrint = getLabelsToPrint();
  const totalStickers = labelsToPrint.reduce((sum, l) => sum + l.copies, 0);

  const handleSelectAllStock = () => {
    if (selectedStockIds.length === stockItems.length) {
      setSelectedStockIds([]);
    } else {
      setSelectedStockIds(stockItems.map(i => i.id));
    }
  };

  const handleToggleStock = (id: string) => {
    setSelectedStockIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllMachines = () => {
    const filtered = machines.filter(m => machineWardFilter === 'all' || m.ward === machineWardFilter);
    if (selectedMachineSerials.length === filtered.length) {
      setSelectedMachineSerials([]);
    } else {
      setSelectedMachineSerials(filtered.map(m => m.serialNumber));
    }
  };

  const handleToggleMachine = (sn: string) => {
    setSelectedMachineSerials(prev =>
      prev.includes(sn) ? prev.filter(s => s !== sn) : [...prev, sn]
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const uniqueWards = Array.from(new Set(machines.map(m => m.ward).filter(Boolean)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/80 backdrop-blur-xs overflow-y-auto animate-fade-in" id="barcode-printer-modal">
      
      {/* Dynamic Print Styles for 50x25mm and A4 sheets */}
      <style>{`
        @media print {
          /* Hide everything except printable barcode container */
          body * {
            visibility: hidden;
          }
          #printable-barcode-area, #printable-barcode-area * {
            visibility: visible;
          }
          #printable-barcode-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: #ffffff !important;
          }
          .no-print {
            display: none !important;
          }

          ${printMode === 'roll_50x25' ? `
            @page {
              size: 50mm 25mm;
              margin: 0;
            }
            .label-item-50x25 {
              width: 50mm !important;
              height: 25mm !important;
              max-width: 50mm !important;
              max-height: 25mm !important;
              page-break-after: always;
              page-break-inside: avoid;
              break-after: page;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              padding: 1.2mm 2mm 1mm 2mm !important;
              box-sizing: border-box !important;
              background: #ffffff !important;
              color: #000000 !important;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
            }
          ` : `
            @page {
              size: A4 portrait;
              margin: 8mm 6mm;
            }
            .a4-grid-container {
              display: grid !important;
              grid-template-columns: repeat(4, 48mm) !important;
              gap: 2mm 3mm !important;
              justify-content: center !important;
              width: 100% !important;
            }
            .label-item-50x25 {
              width: 48mm !important;
              height: 24.5mm !important;
              page-break-inside: avoid;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              padding: 1.2mm 2mm 1mm 2mm !important;
              box-sizing: border-box !important;
              border: 0.25mm dashed #888888 !important;
              border-radius: 1mm !important;
              background: #ffffff !important;
              color: #000000 !important;
            }
          `}
        }
      `}</style>

      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/70 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center font-bold shadow-md shadow-sky-500/20 shrink-0">
              <BarcodeIcon size={22} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  ระบบพิมพ์สติกเกอร์บาร์โค้ด (50 x 25 mm)
                </h2>
                <span className="text-[10px] font-black bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 px-2.5 py-0.5 rounded-full">
                  Standard 50x25 mm Label
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ขนาดมาตรฐาน 50x25 มม. สำหรับเครื่องพิมพ์สติกเกอร์ม้วนเทอร์มอลความร้อน (Thermal) หรือกระดาษสติกเกอร์ A4
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body: Two-Column Layout (Controls on Left, Live Preview on Right) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: SOURCE & CONFIG (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            
            {/* Source Type Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-700 dark:text-slate-200">
                1. เลือกแหล่งข้อมูลบาร์โค้ดที่ต้องการพิมพ์:
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setSourceType('stock')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                    sourceType === 'stock'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Package size={14} />
                  <span>กล่องในสต็อก</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('lot')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                    sourceType === 'lot'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Layers size={14} />
                  <span>ทั้ง LOT ชุดใหญ่</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('machines')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                    sourceType === 'machines'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Activity size={14} />
                  <span>เครื่องตรวจ DTX</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('custom')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                    sourceType === 'custom'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Edit3 size={14} />
                  <span>กำหนดเอง</span>
                </button>
              </div>
            </div>

            {/* SOURCE 1: Stock Item Selection */}
            {sourceType === 'stock' && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-slate-700 dark:text-slate-200">
                    เลือกรายการกล่องในสต็อก ({selectedStockIds.length}/{stockItems.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleSelectAllStock}
                    className="text-sky-600 dark:text-sky-400 font-bold hover:underline cursor-pointer"
                  >
                    {selectedStockIds.length === stockItems.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs">
                  {stockItems.length === 0 ? (
                    <div className="text-center py-4 text-slate-400">ยังไม่มีรายการกล่องในระบบ</div>
                  ) : (
                    stockItems.map((item) => {
                      const isSelected = selectedStockIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleToggleStock(item.id)}
                          className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-300 dark:border-sky-700 text-sky-950 dark:text-sky-200 font-bold'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            {isSelected ? <CheckSquare size={15} className="text-sky-600 shrink-0" /> : <Square size={15} className="text-slate-300 shrink-0" />}
                            <span className="font-mono text-[11px]">{item.itemCode}</span>
                          </div>
                          <div className="text-[10px] text-right font-mono">
                            <span>LOT: {item.lotNumber}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* SOURCE 2: Batch by LOT */}
            {sourceType === 'lot' && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">เลือก LOT Number:</label>
                  <select
                    value={selectedLot}
                    onChange={(e) => setSelectedLot(e.target.value)}
                    className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold dark:text-white"
                  >
                    {lotConfigs.map((cfg, idx) => (
                      <option key={idx} value={cfg.lotNumber}>{cfg.lotNumber} ({cfg.expDate || 'ไม่ระบุวันหมดอายุ'})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-slate-500 block mb-1 font-medium">ประเภทพัสดุ:</label>
                    <select
                      value={lotItemType}
                      onChange={(e) => setLotItemType(e.target.value as any)}
                      className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold dark:text-white"
                    >
                      <option value="strip">แผ่นตรวจ (Test Strip)</option>
                      <option value="control_solution">น้ำยา (Control Solution)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1 font-medium">วันหมดอายุ (EXP):</label>
                    <input
                      type="date"
                      value={lotExpDate}
                      onChange={(e) => setLotExpDate(e.target.value)}
                      className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex justify-between">
                    <span>จำนวนสติกเกอร์ที่ต้องการพิมพ์ (ดวง):</span>
                    <span className="font-mono text-sky-600 font-black">{lotPrintQty} ดวง</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={lotPrintQty}
                    onChange={(e) => setLotPrintQty(Number(e.target.value))}
                    className="w-full accent-sky-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>1 ดวง</span>
                    <span>25 ดวง</span>
                    <span>50 ดวง</span>
                    <span>100 ดวง</span>
                  </div>
                </div>
              </div>
            )}

            {/* SOURCE 3: DTX Machine Labels */}
            {sourceType === 'machines' && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-slate-700 dark:text-slate-200">
                    เลือกเครื่อง DTX ({selectedMachineSerials.length}/{machines.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleSelectAllMachines}
                    className="text-sky-600 dark:text-sky-400 font-bold hover:underline cursor-pointer"
                  >
                    {selectedMachineSerials.length === machines.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                  </button>
                </div>

                <div className="text-xs">
                  <label className="text-slate-500 block mb-1 font-medium">กรองตามหน่วยงาน:</label>
                  <select
                    value={machineWardFilter}
                    onChange={(e) => setMachineWardFilter(e.target.value)}
                    className="w-full text-xs p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold dark:text-white"
                  >
                    <option value="all">ทุกหน่วยงาน ({machines.length} เครื่อง)</option>
                    {uniqueWards.map((w, idx) => (
                      <option key={idx} value={w}>{w}</option>
                    ))}
                  </select>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 text-xs">
                  {machines
                    .filter(m => machineWardFilter === 'all' || m.ward === machineWardFilter)
                    .map((m) => {
                      const isSelected = selectedMachineSerials.includes(m.serialNumber);
                      return (
                        <div
                          key={m.id || m.serialNumber}
                          onClick={() => handleToggleMachine(m.serialNumber)}
                          className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-300 dark:border-sky-700 text-sky-950 dark:text-sky-200 font-bold'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            {isSelected ? <CheckSquare size={15} className="text-sky-600 shrink-0" /> : <Square size={15} className="text-slate-300 shrink-0" />}
                            <span className="font-mono text-[11px] font-bold text-sky-700 dark:text-sky-400">{m.serialNumber}</span>
                          </div>
                          <span className="text-[11px] text-slate-500">{m.ward}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* SOURCE 4: Custom Label Generator */}
            {sourceType === 'custom' && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">ชื่อรายการ (Label Title):</label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="เช่น VivaChek Test Strip หรือ Control Level 2"
                    className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">รหัสบาร์โค้ด (Barcode Data):</label>
                  <input
                    type="text"
                    value={customBarcode}
                    onChange={(e) => setCustomBarcode(e.target.value)}
                    placeholder="เช่น ST-2026A-01 หรือ DTX-BGM-001"
                    className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-slate-500 block mb-1 font-medium">ข้อความแถว 1 (LOT):</label>
                    <input
                      type="text"
                      value={customSub1}
                      onChange={(e) => setCustomSub1(e.target.value)}
                      placeholder="LOT: 2026-A"
                      className="w-full text-xs p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1 font-medium">ข้อความแถว 2 (EXP):</label>
                    <input
                      type="text"
                      value={customSub2}
                      onChange={(e) => setCustomSub2(e.target.value)}
                      placeholder="EXP: 2026-12-31"
                      className="w-full text-xs p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">จำนวนที่พิมพ์ (ดวง):</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={customCopies}
                    onChange={(e) => setCustomCopies(Math.max(1, Number(e.target.value)))}
                    className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold dark:text-white"
                  />
                </div>
              </div>
            )}

            {/* STICKER OPTIONS & FORMAT */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3.5">
              <span className="text-xs font-black text-slate-700 dark:text-slate-200 block">
                2. การตั้งค่าหน้าพิมพ์ (Print Configuration):
              </span>

              {/* Print Format Mode */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">โหมดกระดาษ / เครื่องพิมพ์:</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPrintMode('roll_50x25')}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center cursor-pointer ${
                      printMode === 'roll_50x25'
                        ? 'bg-sky-50 dark:bg-sky-950 border-sky-500 text-sky-700 dark:text-sky-300 shadow-xs'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span>🖨️ ม้วนเทอร์มอล 50x25 mm</span>
                    <span className="text-[10px] font-normal text-slate-400">1 สติกเกอร์ / หน้า (Roll)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintMode('a4_grid')}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center cursor-pointer ${
                      printMode === 'a4_grid'
                        ? 'bg-sky-50 dark:bg-sky-950 border-sky-500 text-sky-700 dark:text-sky-300 shadow-xs'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span>📄 แผ่นสติกเกอร์ A4</span>
                    <span className="text-[10px] font-normal text-slate-400">4 คอลัมน์ x แถว (Grid)</span>
                  </button>
                </div>
              </div>

              {/* Organization Header Text */}
              <div className="space-y-1">
                <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">หัวกระดาษสติกเกอร์ (Header):</label>
                <input
                  type="text"
                  value={orgHeader}
                  onChange={(e) => setOrgHeader(e.target.value)}
                  className="w-full text-xs p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-bold"
                />
              </div>

              {/* Show Open Date Blank checkbox */}
              <label className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={showOpenDateBlank}
                  onChange={(e) => setShowOpenDateBlank(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>แสดงช่องเขียนวันที่เปิดใช้งาน (เปิด: ____/____/____)</span>
              </label>
            </div>

          </div>

          {/* RIGHT COLUMN: LIVE 50x25mm STICKER PREVIEW & PRINT TRIGGER (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                    ตัวอย่างสติกเกอร์บาร์โค้ด 50x25 mm ({totalStickers} ดวง)
                  </h3>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setZoomPreview(!zoomPreview)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center space-x-1 cursor-pointer"
                  >
                    <Maximize2 size={13} />
                    <span>{zoomPreview ? 'ขนาดมาตรฐาน' : 'ขยายดูชัดเจน'}</span>
                  </button>
                </div>
              </div>

              {/* PREVIEW CONTAINER */}
              <div 
                className={`p-4 bg-slate-200/70 dark:bg-slate-950/70 rounded-3xl border border-slate-300 dark:border-slate-800 overflow-y-auto max-h-[460px] flex flex-wrap gap-3 items-start justify-center transition-all ${
                  zoomPreview ? 'scale-110 origin-top' : ''
                }`}
              >
                {labelsToPrint.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    กรุณาเลือกรายการที่ต้องการพิมพ์สติกเกอร์
                  </div>
                ) : (
                  labelsToPrint.slice(0, 16).map((label, idx) => (
                    <div
                      key={idx}
                      style={{
                        width: '50mm',
                        height: '25mm',
                        minWidth: '50mm',
                        maxWidth: '50mm',
                        minHeight: '25mm',
                        maxHeight: '25mm'
                      }}
                      className="bg-white text-black p-1.5 rounded shadow-sm border border-slate-300 flex flex-col justify-between select-none overflow-hidden"
                    >
                      {/* Line 1: Header Org & Title */}
                      <div className="flex items-center justify-between leading-none text-[8px] font-black border-b border-black/20 pb-0.5">
                        <span className="truncate max-w-[28mm]">{label.header}</span>
                        <span className="truncate max-w-[18mm] text-slate-700 font-bold">{label.title}</span>
                      </div>

                      {/* Line 2: Barcode SVG */}
                      <div className="flex flex-col items-center justify-center my-auto py-0.5">
                        <BarcodeSvg text={label.barcode} height={18} width={130} />
                        <span className="font-mono text-[8px] font-black tracking-wider leading-none mt-0.5">
                          {label.displayCode}
                        </span>
                      </div>

                      {/* Line 3: LOT, EXP & Open Date Blank */}
                      <div className="leading-none text-[7.5px] font-mono font-bold flex items-center justify-between border-t border-black/20 pt-0.5">
                        <div className="flex space-x-1 truncate max-w-[26mm]">
                          <span>{label.subInfo1}</span>
                          <span>{label.subInfo2}</span>
                        </div>
                        {label.showOpenDateBlank && (
                          <span className="text-[7px] font-sans font-black bg-slate-100 px-1 py-0.2 rounded shrink-0">
                            เปิด: __/__/__
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {labelsToPrint.length > 16 && (
                <div className="text-center text-xs text-slate-500 font-bold">
                  ... และอีก {labelsToPrint.length - 16} สติกเกอร์ (แสดงตัวอย่าง 16 ดวงแรก)
                </div>
              )}
            </div>

            {/* PRINT ACTION FOOTER */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs space-y-0.5">
                <div className="font-black text-slate-900 dark:text-white flex items-center space-x-1.5">
                  <Printer size={15} className="text-sky-600" />
                  <span>พร้อมสั่งพิมพ์สติกเกอร์ 50x25 mm ทั้งหมด {totalStickers} ดวง</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  โหมด: {printMode === 'roll_50x25' ? 'ม้วนเทอร์มอลความร้อน (50x25 mm Continuous Roll)' : 'แผ่นสติกเกอร์ A4 (A4 Label Grid)'}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  ปิดหน้าต่าง
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={totalStickers === 0}
                  className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-98 text-white text-xs font-black flex items-center space-x-2 cursor-pointer shadow-lg shadow-sky-600/30 transition-all disabled:opacity-50"
                  id="btn-print-barcode-50x25"
                >
                  <Printer size={16} />
                  <span>สั่งพิมพ์ทันที (Print Now)</span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* HIDDEN PRINTABLE CONTAINER ACCESSED ONLY BY @media print */}
      <div id="printable-barcode-area" className="hidden">
        {printMode === 'roll_50x25' ? (
          <div>
            {labelsToPrint.map((label, idx) => (
              <div 
                key={idx} 
                className="label-item-50x25"
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: 'bold', borderBottom: '0.2mm solid #000', paddingBottom: '0.4mm' }}>
                  <span>{label.header}</span>
                  <span>{label.title}</span>
                </div>

                {/* Visual Barcode & Alphanumeric Code */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: 'auto 0' }}>
                  <BarcodeSvg text={label.barcode} height={20} width={140} />
                  <span style={{ fontFamily: 'monospace', fontSize: '8px', fontWeight: 'bold', letterSpacing: '0.5px', marginTop: '0.4mm' }}>
                    {label.displayCode}
                  </span>
                </div>

                {/* Footer LOT, EXP, Open Date blank */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7.5px', fontFamily: 'monospace', fontWeight: 'bold', borderTop: '0.2mm solid #000', paddingTop: '0.4mm' }}>
                  <div>
                    <span>{label.subInfo1} </span>
                    <span>{label.subInfo2}</span>
                  </div>
                  {label.showOpenDateBlank && (
                    <span style={{ fontSize: '7px' }}>
                      เปิด: __/__/__
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="a4-grid-container">
            {labelsToPrint.map((label, idx) => (
              <div 
                key={idx} 
                className="label-item-50x25"
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7.5px', fontWeight: 'bold', borderBottom: '0.2mm solid #000', paddingBottom: '0.3mm' }}>
                  <span>{label.header}</span>
                  <span>{label.title}</span>
                </div>

                {/* Visual Barcode & Alphanumeric Code */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: 'auto 0' }}>
                  <BarcodeSvg text={label.barcode} height={18} width={130} />
                  <span style={{ fontFamily: 'monospace', fontSize: '7.5px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                    {label.displayCode}
                  </span>
                </div>

                {/* Footer LOT, EXP, Open Date blank */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px', fontFamily: 'monospace', fontWeight: 'bold', borderTop: '0.2mm solid #000', paddingTop: '0.3mm' }}>
                  <div>
                    <span>{label.subInfo1} </span>
                    <span>{label.subInfo2}</span>
                  </div>
                  {label.showOpenDateBlank && (
                    <span style={{ fontSize: '6.5px' }}>
                      เปิด: __/__/__
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
