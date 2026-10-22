/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Maximize2,
  FileCode,
  Download,
  Check
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
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

// Standard Highly Compliant Code128 Vector Barcode Generator
function BarcodeSvg({ text, height = 20, barWidth = 1.05 }: { text: string; height?: number; barWidth?: number }) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && text) {
      try {
        JsBarcode(svgRef.current, text, {
          format: "CODE128", // Standard Code128 (auto mode: dense and 100% compliant)
          lineColor: "#000000",
          width: barWidth,
          height: height,
          displayValue: false,
          margin: 0
        });
      } catch (err) {
        console.error('JsBarcode error:', err);
      }
    }
  }, [text, height, barWidth]);

  return <svg ref={svgRef} className="block mx-auto max-w-full" />;
}

// Zebra Programming Language (ZPL II) Generator for 50x20 mm (203 DPI, 400x160 dots)
function generateZpl50x20(labels: PrintableLabel[]): string {
  let zpl = '';
  labels.forEach(l => {
    for (let c = 0; c < l.copies; c++) {
      zpl += '^XA\n';
      zpl += '^PW400\n'; // Print Width: 400 dots (50mm at 8 dots/mm)
      zpl += '^LL160\n'; // Label Length: 160 dots (20mm at 8 dots/mm)
      zpl += '^LH0,0\n'; // Label Home: (0,0)
      
      // Header line
      zpl += `^FO16,10^A0N,18,18^FD${l.header}^FS\n`;
      zpl += `^FO240,10^A0N,16,16^FD${l.title.slice(0, 15)}^FS\n`;
      zpl += '^FO16,30^GB368,1,1^FS\n';
      
      // Code 128 Barcode: ^BCo,h,f,g,e,m (o=N, h=48, f=Y print interpretation, g=N, e=N, m=N)
      zpl += `^FO45,36^BCN,48,Y,N,N^FD>;${l.barcode}^FS\n`;
      
      // Footer line
      zpl += '^FO16,118^GB368,1,1^FS\n';
      zpl += `^FO16,124^A0N,15,15^FD${l.subInfo1}  ${l.subInfo2}^FS\n`;
      if (l.showOpenDateBlank) {
        zpl += '^FO275,124^A0N,15,15^FDOPEN: __/__^FS\n';
      }
      
      zpl += '^XZ\n\n';
    }
  });
  return zpl;
}

const EMPTY_STOCK: StripReagentItem[] = [];
const EMPTY_LOTS: QcLotConfig[] = [];
const EMPTY_MACHINES: DtxMachine[] = [];

export const BarcodePrinterModal: React.FC<BarcodePrinterModalProps> = ({
  isOpen,
  onClose,
  stockItems = EMPTY_STOCK,
  lotConfigs = EMPTY_LOTS,
  machines = EMPTY_MACHINES,
  initialSource = 'stock',
  initialItemCode,
  initialLotNumber
}) => {
  const [sourceType, setSourceType] = useState<'stock' | 'lot' | 'machines' | 'custom'>(initialSource);
  // Default to Zebra 50x20 mm as confirmed by user
  const [printMode, setPrintMode] = useState<'roll_50x20' | 'roll_50x25' | 'a4_grid'>('roll_50x20');
  const [orgHeader, setOrgHeader] = useState<string>('รพ.สังขะ • งานชันสูตร');
  const [showOpenDateBlank, setShowOpenDateBlank] = useState<boolean>(true);
  const [globalCopies, setGlobalCopies] = useState<number>(1);
  const [zoomPreview, setZoomPreview] = useState<boolean>(false);
  const [showZplPanel, setShowZplPanel] = useState<boolean>(false);
  const [copiedZpl, setCopiedZpl] = useState<boolean>(false);

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
    if (isOpen && stockItems && stockItems.length > 0) {
      if (initialItemCode) {
        const found = stockItems.filter(i => i.itemCode === initialItemCode).map(i => i.id);
        if (found.length > 0) setSelectedStockIds(found);
        else setSelectedStockIds(stockItems.slice(0, 8).map(i => i.id));
      } else {
        setSelectedStockIds(stockItems.slice(0, 8).map(i => i.id));
      }
    }
  }, [isOpen, stockItems, initialItemCode]);

  // Update lot details when lot selection changes
  useEffect(() => {
    if (isOpen) {
      const cfg = lotConfigs.find(c => c.lotNumber === selectedLot);
      if (cfg && cfg.expDate) {
        setLotExpDate(cfg.expDate);
      }
    }
  }, [isOpen, selectedLot, lotConfigs]);

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

  const handleCopyZpl = async () => {
    const zpl = generateZpl50x20(labelsToPrint);
    try {
      await navigator.clipboard.writeText(zpl);
      setCopiedZpl(true);
      setTimeout(() => setCopiedZpl(false), 2500);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = zpl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedZpl(true);
      setTimeout(() => setCopiedZpl(false), 2500);
    }
  };

  const handleDownloadZpl = () => {
    const zpl = generateZpl50x20(labelsToPrint);
    const blob = new Blob([zpl], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zebra_labels_50x20_${Date.now()}.zpl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const uniqueWards = Array.from(new Set(machines.map(m => m.ward).filter(Boolean)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/80 backdrop-blur-xs overflow-y-auto animate-fade-in" id="barcode-printer-modal">
      
      {/* Dynamic Print Styles for 50x20mm Zebra, 50x25mm, and A4 sheets */}
      <style>{`
        @media print {
          /* Hide main app interface containers on print */
          #app-root > *:not(#barcode-printer-modal) {
            display: none !important;
          }
          #app-header, #app-footer, .no-print, header, footer, aside, nav {
            display: none !important;
          }

          /* Reset modal container to act as a transparent wrapper */
          #barcode-printer-modal {
            background: transparent !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }
          #barcode-printer-modal > div:first-child {
            display: none !important; /* Hide UI interface card */
          }

          /* Display the print area as a direct visible block */
          #printable-barcode-area {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #printable-barcode-area * {
            visibility: visible !important;
          }
          .no-print {
            display: none !important;
          }

          ${printMode === 'roll_50x20' ? `
            @page {
              size: 50mm 20mm;
              margin: 0;
            }
            .label-item-print {
              width: 50mm !important;
              height: 20mm !important;
              min-width: 50mm !important;
              max-width: 50mm !important;
              min-height: 20mm !important;
              max-height: 20mm !important;
              page-break-after: always;
              page-break-inside: avoid;
              break-after: page;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              padding: 0.8mm 1.5mm 0.8mm 1.5mm !important;
              box-sizing: border-box !important;
              background: #ffffff !important;
              color: #000000 !important;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
            }
          ` : printMode === 'roll_50x25' ? `
            @page {
              size: 50mm 25mm;
              margin: 0;
            }
            .label-item-print {
              width: 50mm !important;
              height: 25mm !important;
              min-width: 50mm !important;
              max-width: 50mm !important;
              min-height: 25mm !important;
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
            .label-item-print {
              width: 48mm !important;
              height: 20mm !important;
              page-break-inside: avoid;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              padding: 1mm 1.5mm !important;
              box-sizing: border-box !important;
              border: 0.25mm dashed #888888 !important;
              border-radius: 1mm !important;
              background: #ffffff !important;
              color: #000000 !important;
            }
          `}
        }
      `}</style>

      {/* Main Interactive Dialog Modal */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-black shadow-lg shadow-sky-600/30">
              <Printer size={20} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  ศูนย์พิมพ์สติกเกอร์บาร์โค้ด Zebra (50x20 mm)
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800">
                  Code128 Standard
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ขนาดมาตรฐาน 50x20 มม. สำหรับเครื่องพิมพ์ความร้อน Zebra & บาร์โค้ดสแกนเนอร์แล็บยิงติด 100%
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Source Selector Tabs */}
        <div className="flex items-center space-x-2 p-3 bg-slate-100/70 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 overflow-x-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => setSourceType('stock')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
              sourceType === 'stock'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <Package size={14} />
            <span>จากคลังพัสดุ ({stockItems.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSourceType('lot')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
              sourceType === 'lot'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <Layers size={14} />
            <span>พิมพ์ยก LOT / ชุดกล่องใหม่</span>
          </button>

          <button
            type="button"
            onClick={() => setSourceType('machines')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
              sourceType === 'machines'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <Activity size={14} />
            <span>เครื่อง DTX ประจำตึก ({machines.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSourceType('custom')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
              sourceType === 'custom'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <Edit3 size={14} />
            <span>กำหนดเอง (Custom Label)</span>
          </button>
        </div>

        {/* Content Body: Two columns layout */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* LEFT COLUMN: Data Source Selection & Options (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* SOURCE 1: From Stock Items */}
            {sourceType === 'stock' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700 dark:text-slate-200">
                    เลือกรายการในคลัง ({selectedStockIds.length}/{stockItems.length}):
                  </span>
                  <button
                    type="button"
                    onClick={handleSelectAllStock}
                    className="text-sky-600 hover:underline cursor-pointer"
                  >
                    {selectedStockIds.length === stockItems.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                  </button>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {stockItems.length === 0 ? (
                    <div className="p-4 text-center text-slate-400">ยังไม่มีรายการพัสดุในคลัง</div>
                  ) : (
                    stockItems.map(item => {
                      const isSelected = selectedStockIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleToggleStock(item.id)}
                          className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200' 
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // handled by row click
                              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            />
                            <div>
                              <div className="font-mono font-bold">{item.itemCode}</div>
                              <div className="text-[10px] text-slate-500">
                                LOT: {item.lotNumber} | EXP: {item.expDate || '-'}
                              </div>
                            </div>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            item.status === 'in_stock' ? 'bg-emerald-100 text-emerald-800' :
                            item.status === 'in_use' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {item.status === 'in_stock' ? 'ยังไม่เปิด' : item.status === 'in_use' ? 'ใช้งานอยู่' : 'หมดแล้ว'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* SOURCE 2: By LOT Number */}
            {sourceType === 'lot' && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">เลือก LOT Number:</label>
                  <select
                    value={selectedLot}
                    onChange={(e) => setSelectedLot(e.target.value)}
                    className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold dark:text-white"
                  >
                    {lotConfigs.map(c => (
                      <option key={c.lotNumber} value={c.lotNumber}>
                        LOT: {c.lotNumber} (EXP: {c.expDate || '-'})
                      </option>
                    ))}
                    {lotConfigs.length === 0 && <option value="LOT2026-A">LOT2026-A (ตัวอย่าง)</option>}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-slate-500 block mb-1 font-medium">ประเภท:</label>
                    <select
                      value={lotItemType}
                      onChange={(e) => setLotItemType(e.target.value as any)}
                      className="w-full text-xs p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                    >
                      <option value="strip">แผ่นตรวจ (ST)</option>
                      <option value="control_solution">น้ำยาควบคุม (QC)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-500 block mb-1 font-medium">วันหมดอายุ:</label>
                    <input
                      type="date"
                      value={lotExpDate}
                      onChange={(e) => setLotExpDate(e.target.value)}
                      className="w-full text-xs p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">จำนวนดวงที่ต้องการพิมพ์ (กล่องที่ 1 ถึง N):</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={lotPrintQty}
                    onChange={(e) => setLotPrintQty(Math.max(1, Number(e.target.value)))}
                    className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold dark:text-white"
                  />
                </div>
              </div>
            )}

            {/* SOURCE 3: Machines */}
            {sourceType === 'machines' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <select
                    value={machineWardFilter}
                    onChange={(e) => setMachineWardFilter(e.target.value)}
                    className="text-xs p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold dark:text-white"
                  >
                    <option value="all">ทุกตึก/หน่วยงาน ({machines.length})</option>
                    {uniqueWards.map(w => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleSelectAllMachines}
                    className="text-sky-600 font-bold hover:underline cursor-pointer"
                  >
                    เลือกทั้งหมด
                  </button>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {machines.map(m => {
                    const isSelected = selectedMachineSerials.includes(m.serialNumber);
                    return (
                      <div
                        key={m.serialNumber}
                        onClick={() => handleToggleMachine(m.serialNumber)}
                        className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200' 
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                          <div>
                            <div className="font-mono font-bold">{m.serialNumber}</div>
                            <div className="text-[10px] text-slate-500">{m.ward || 'ไม่ระบุตึก'} • {m.model || 'VivaChek'}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SOURCE 4: Custom */}
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
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
              <span className="text-xs font-black text-slate-700 dark:text-slate-200 block">
                การตั้งค่าหน้าพิมพ์ (Print Configuration):
              </span>

              {/* Print Format Mode */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">ขนาดสติกเกอร์ / เครื่องพิมพ์:</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPrintMode('roll_50x20')}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center cursor-pointer ${
                      printMode === 'roll_50x20'
                        ? 'bg-sky-50 dark:bg-sky-950 border-sky-500 text-sky-700 dark:text-sky-300 shadow-xs'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="text-[11px]">️ Zebra 50x20</span>
                    <span className="text-[9px] font-normal text-slate-400">(แนะนำ)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrintMode('roll_50x25')}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center cursor-pointer ${
                      printMode === 'roll_50x25'
                        ? 'bg-sky-50 dark:bg-sky-950 border-sky-500 text-sky-700 dark:text-sky-300 shadow-xs'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="text-[11px]">ม้วน 50x25</span>
                    <span className="text-[9px] font-normal text-slate-400">Roll 25mm</span>
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
                    <span className="text-[11px]">แผ่น A4</span>
                    <span className="text-[9px] font-normal text-slate-400">Grid Sheet</span>
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
                <span>แสดงช่องวันที่เปิด (เปิด: ___/___)</span>
              </label>
            </div>

          </div>

          {/* RIGHT COLUMN: LIVE STICKER PREVIEW & PRINT TRIGGER (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                    ตัวอย่างสติกเกอร์ {printMode === 'roll_50x20' ? '50x20 mm' : printMode === 'roll_50x25' ? '50x25 mm' : 'A4 Grid'} ({totalStickers} ดวง)
                  </h3>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowZplPanel(!showZplPanel)}
                    className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center space-x-1 cursor-pointer bg-sky-50 dark:bg-sky-950 px-2 py-1 rounded-lg border border-sky-200 dark:border-sky-800"
                  >
                    <FileCode size={13} />
                    <span>คำสั่ง Zebra ZPL</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setZoomPreview(!zoomPreview)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center space-x-1 cursor-pointer"
                  >
                    <Maximize2 size={13} />
                    <span>{zoomPreview ? 'ย่อ' : 'ขยาย'}</span>
                  </button>
                </div>
              </div>

              {/* ZPL Code Inspector Panel */}
              {showZplPanel && (
                <div className="p-3 bg-slate-900 text-slate-100 rounded-2xl border border-slate-700 space-y-2 animate-fade-in text-xs font-mono">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                    <span className="font-bold text-sky-400">Zebra ZPL II Code (50x20 mm, 203 DPI)</span>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={handleCopyZpl}
                        className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-sans text-[11px] font-bold flex items-center space-x-1 cursor-pointer"
                      >
                        {copiedZpl ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedZpl ? 'คัดลอกแล้ว!' : 'คัดลอก ZPL'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadZpl}
                        className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white font-sans text-[11px] font-bold flex items-center space-x-1 cursor-pointer"
                      >
                        <Download size={12} />
                        <span>ดาวน์โหลด .zpl</span>
                      </button>
                    </div>
                  </div>
                  <pre className="text-[10px] max-h-32 overflow-y-auto p-2 bg-black/50 rounded leading-relaxed text-slate-300">
                    {generateZpl50x20(labelsToPrint)}
                  </pre>
                  <p className="text-[10px] text-slate-400 font-sans">
                     สามารถนำโค้ดนี้ส่งไปยัง Zebra Setup Utilities หรือส่งตรงไปยัง Raw Port 9100 ของเครื่องพิมพ์ Zebra ได้โดยตรง 100%
                  </p>
                </div>
              )}

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
                        height: printMode === 'roll_50x20' ? '20mm' : '25mm',
                        minWidth: '50mm',
                        maxWidth: '50mm',
                        minHeight: printMode === 'roll_50x20' ? '20mm' : '25mm',
                        maxHeight: printMode === 'roll_50x20' ? '20mm' : '25mm'
                      }}
                      className="bg-white text-black px-1.5 py-1 rounded shadow-sm border border-slate-300 flex flex-col justify-between select-none overflow-hidden"
                    >
                      {/* Line 1: Header Org & Title */}
                      <div className="flex items-center justify-between leading-none text-[7.5px] font-black border-b border-black/25 pb-0.5">
                        <span className="truncate max-w-[27mm]">{label.header}</span>
                        <span className="truncate max-w-[19mm] text-slate-700 font-bold">{label.title}</span>
                      </div>

                      {/* Line 2: Barcode SVG & Display Code */}
                      <div className="flex flex-col items-center justify-center my-auto py-0.2">
                        <BarcodeSvg text={label.barcode} height={16} barWidth={1.05} />
                        <span className="font-mono text-[7.5px] font-black tracking-wider leading-none mt-0.5">
                          {label.displayCode}
                        </span>
                      </div>

                      {/* Line 3: LOT, EXP & Open Date Blank */}
                      <div className="leading-none text-[7px] font-mono font-bold flex items-center justify-between border-t border-black/25 pt-0.5">
                        <div className="flex space-x-1 truncate max-w-[27mm]">
                          <span>{label.subInfo1}</span>
                          <span>{label.subInfo2}</span>
                        </div>
                        {label.showOpenDateBlank && (
                          <span className="text-[6.5px] font-sans font-black bg-slate-100 px-1 rounded shrink-0">
                            เปิด: ___/___
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
                  <span>พร้อมสั่งพิมพ์สติกเกอร์ {printMode === 'roll_50x20' ? '50x20 mm' : '50x25 mm'} ทั้งหมด {totalStickers} ดวง</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  โหมด: {printMode === 'roll_50x20' ? 'ม้วนความร้อน Zebra (50x20 mm Continuous Roll)' : printMode === 'roll_50x25' ? 'ม้วนความร้อน (50x25 mm)' : 'แผ่นสติกเกอร์ A4'}
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
                  id="btn-print-barcode-50x20"
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
        {printMode === 'a4_grid' ? (
          <div className="a4-grid-container">
            {labelsToPrint.map((label, idx) => (
              <div 
                key={idx} 
                className="label-item-print"
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px', fontWeight: 'bold', borderBottom: '0.2mm solid #000', paddingBottom: '0.3mm' }}>
                  <span>{label.header}</span>
                  <span>{label.title}</span>
                </div>

                {/* Barcode & Alphanumeric Code */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: 'auto 0' }}>
                  <BarcodeSvg text={label.barcode} height={16} barWidth={1.05} />
                  <span style={{ fontFamily: 'monospace', fontSize: '7.5px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                    {label.displayCode}
                  </span>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '6.5px', fontFamily: 'monospace', fontWeight: 'bold', borderTop: '0.2mm solid #000', paddingTop: '0.3mm' }}>
                  <div>
                    <span>{label.subInfo1} </span>
                    <span>{label.subInfo2}</span>
                  </div>
                  {label.showOpenDateBlank && (
                    <span>
                      เปิด: ___/___
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {labelsToPrint.map((label, idx) => (
              <div 
                key={idx} 
                className="label-item-print"
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7.5px', fontWeight: 'bold', borderBottom: '0.2mm solid #000', paddingBottom: '0.3mm' }}>
                  <span>{label.header}</span>
                  <span>{label.title}</span>
                </div>

                {/* Visual Barcode & Alphanumeric Code */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: 'auto 0' }}>
                  <BarcodeSvg text={label.barcode} height={17} barWidth={1.05} />
                  <span style={{ fontFamily: 'monospace', fontSize: '7.5px', fontWeight: 'bold', letterSpacing: '0.5px', marginTop: '0.3mm' }}>
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
                      เปิด: ___/___
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
