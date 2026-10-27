/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Printer, 
  Barcode as BarcodeIcon, 
  Package, 
  Activity, 
  Edit3, 
  Layers, 
  Copy, 
  Check, 
  FileText, 
  Download 
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { StripReagentItem, DtxMachine, QcLotConfig } from '../types';
import { exportLabelsToWordDocx } from '../utils/exportWord';

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
  subInfo1: string;
  subInfo2: string;
  showOpenDateBlank: boolean;
  copies: number;
}

// Code128 Vector/Canvas Generator for UI Display
function BarcodeSvg({ 
  text, 
  height = 24, 
  barWidth = 2,
  quietZone = 14 
}: { 
  text: string; 
  height?: number; 
  barWidth?: number; 
  quietZone?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current && text) {
      try {
        JsBarcode(canvasRef.current, text, {
          format: "CODE128",
          lineColor: "#000000",
          background: "#ffffff",
          width: barWidth,
          height: height,
          displayValue: false,
          margin: 0,
          marginLeft: quietZone,
          marginRight: quietZone,
          marginTop: 2,
          marginBottom: 2
        });
      } catch (err) {
        console.error('JsBarcode canvas error:', err);
      }
    }
  }, [text, height, barWidth, quietZone]);

  return (
    <canvas 
      ref={canvasRef} 
      className="block mx-auto max-w-full" 
      style={{ 
        imageRendering: 'pixelated', 
        shapeRendering: 'crispEdges',
        maxHeight: `${height}px` 
      }} 
    />
  );
}

// Generates high-contrast pixel-perfect 300 DPI canvas blob for 55x22mm label to paste into Microsoft Word
function renderLabelToCanvasBlob(label: PrintableLabel): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      // 55mm x 22mm at 300 DPI (650 x 260 px)
      canvas.width = 650;
      canvas.height = 260;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      // White Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 650, 260);

      // Line 1: Header (Hospital Org & Item Title)
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 22px "Sarabun", "TH Sarabun New", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(label.header, 25, 18);

      ctx.textAlign = 'right';
      ctx.font = 'bold 20px "Sarabun", "TH Sarabun New", sans-serif';
      ctx.fillText(label.title.slice(0, 22), 625, 18);

      // Divider Line 1
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(25, 48);
      ctx.lineTo(625, 48);
      ctx.stroke();

      // Line 2: Barcode via JsBarcode
      const bcCanvas = document.createElement('canvas');
      JsBarcode(bcCanvas, label.barcode, {
        format: "CODE128",
        lineColor: "#000000",
        background: "#ffffff",
        width: 2.7,
        height: 88,
        displayValue: false,
        margin: 0,
        marginLeft: 10,
        marginRight: 10,
        marginTop: 0,
        marginBottom: 0
      });

      const bcW = bcCanvas.width;
      const bcX = Math.max(25, (650 - bcW) / 2);
      ctx.drawImage(bcCanvas, bcX, 56, Math.min(bcW, 600), 90);

      // Barcode Code Text Below
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(label.displayCode, 325, 154);

      // Divider Line 2
      ctx.beginPath();
      ctx.moveTo(25, 182);
      ctx.lineTo(625, 182);
      ctx.stroke();

      // Line 3: Footer (LOT, EXP, Open Date)
      ctx.textAlign = 'left';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(`${label.subInfo1}   ${label.subInfo2}`, 25, 192);

      if (label.showOpenDateBlank) {
        ctx.textAlign = 'right';
        ctx.font = 'bold 18px "Sarabun", "TH Sarabun New", sans-serif';
        ctx.fillText('เปิด: ___/___', 625, 192);
      }

      canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch (e) {
      console.error('renderLabelToCanvasBlob error:', e);
      resolve(null);
    }
  });
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
  const [orgHeader, setOrgHeader] = useState<string>('รพ.สังขะ • งานชันสูตร');
  const [showOpenDateBlank, setShowOpenDateBlank] = useState<boolean>(true);
  const [globalCopies, setGlobalCopies] = useState<number>(1);
  const [copiedImageIdx, setCopiedImageIdx] = useState<number | null>(null);
  const [copyNotification, setCopyNotification] = useState<string | null>(null);
  const [isExportingWord, setIsExportingWord] = useState<boolean>(false);

  // Stock selection state
  const [selectedStockIds, setSelectedStockIds] = useState<string[]>([]);

  // LOT selection state
  const [selectedLot, setSelectedLot] = useState<string>(initialLotNumber || lotConfigs[0]?.lotNumber || '');
  const [lotItemType, setLotItemType] = useState<'strip' | 'control_solution'>('strip');
  const [lotExpDate, setLotExpDate] = useState<string>(() => lotConfigs[0]?.expDate || '');
  const [lotPrintQty, setLotPrintQty] = useState<number>(10);

  // Machine selection state
  const [selectedMachineSerials, setSelectedMachineSerials] = useState<string[]>([]);
  const [machineWardFilter, setMachineWardFilter] = useState<string>('all');

  // Custom label state
  const [customTitle, setCustomTitle] = useState<string>('VivaChek Test Strip');
  const [customBarcode, setCustomBarcode] = useState<string>(initialItemCode || '');
  const [customSub1, setCustomSub1] = useState<string>('');
  const [customSub2, setCustomSub2] = useState<string>('');
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

  // Build list of printable labels
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
      if (!selectedLot || lotConfigs.length === 0) return [];
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
      if (!customBarcode || !customBarcode.trim()) return [];
      labels.push({
        id: 'CUSTOM-1',
        header: orgHeader,
        title: customTitle || 'VivaChek Test Strip',
        barcode: customBarcode,
        displayCode: customBarcode,
        subInfo1: customSub1 ? (customSub1.startsWith('LOT') ? customSub1 : `LOT: ${customSub1}`) : 'LOT: -',
        subInfo2: customSub2 ? (customSub2.startsWith('EXP') ? customSub2 : `EXP: ${customSub2}`) : 'EXP: -',
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

  const handleCopyStickerImage = async (label: PrintableLabel, idx = 0) => {
    try {
      const blob = await renderLabelToCanvasBlob(label);
      if (!blob) return;

      if (navigator.clipboard && navigator.clipboard.write) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setCopiedImageIdx(idx);
          setCopyNotification(`คัดลอกรูปสติกเกอร์ ${label.displayCode} แล้ว สามารถกด Ctrl + V วางใน Word ได้ทันที`);
          setTimeout(() => {
            setCopiedImageIdx(null);
            setCopyNotification(null);
          }, 4000);
          return;
        } catch (e) {
          console.warn('Clipboard writeImage failed:', e);
        }
      }

      // Fallback
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sticker-${label.displayCode}-55x22mm.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setCopyNotification(`ดาวน์โหลดภาพสติกเกอร์ ${label.displayCode} แล้ว นำไปวางใน Word ได้ทันที`);
      setTimeout(() => setCopyNotification(null), 4000);
    } catch (err) {
      console.error('Copy sticker error:', err);
    }
  };

  const handleExportWord = async () => {
    if (labelsToPrint.length === 0) return;
    setIsExportingWord(true);
    try {
      await exportLabelsToWordDocx(
        labelsToPrint,
        renderLabelToCanvasBlob,
        `สติกเกอร์บาร์โค้ด-Word-55x22mm-${Date.now().toString().slice(-4)}.docx`
      );
      setCopyNotification('ดาวน์โหลดไฟล์ Word (.docx) ขนาด 5.5 x 2.2 ซม. สำเร็จแล้ว เปิดไฟล์แล้วกดสั่งพิมพ์ใน Word ได้ทันที');
      setTimeout(() => setCopyNotification(null), 5000);
    } catch (err) {
      console.error('Export Word error:', err);
      setCopyNotification('เกิดข้อผิดพลาดในการสร้างไฟล์ Word');
      setTimeout(() => setCopyNotification(null), 3500);
    } finally {
      setIsExportingWord(false);
    }
  };

  const uniqueWards = Array.from(new Set(machines.map(m => m.ward).filter(Boolean)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/80 backdrop-blur-xs overflow-y-auto animate-fade-in" id="barcode-printer-modal">
      
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
                  ศูนย์พิมพ์สติกเกอร์บาร์โค้ด
                </h2>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                  Export Word Only
                </span>
              </div>
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
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
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
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
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
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
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
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
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

                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-2 max-h-56 overflow-y-auto space-y-1 bg-slate-50 dark:bg-slate-800/50">
                  {stockItems.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      ไม่มีรายการพัสดุในคลัง
                    </div>
                  ) : (
                    stockItems.map(item => {
                      const isChecked = selectedStockIds.includes(item.id);
                      return (
                        <label
                          key={item.id}
                          className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                            isChecked 
                              ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-300 dark:border-sky-800 text-sky-950 dark:text-sky-200' 
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleStock(item.id)}
                              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            />
                            <div className="font-mono font-bold">{item.itemCode}</div>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            LOT: {item.lotNumber}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* SOURCE 2: By LOT Batch */}
            {sourceType === 'lot' && (
              <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-200">เลือก LOT Number:</label>
                  <select
                    value={selectedLot}
                    onChange={(e) => setSelectedLot(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-mono font-bold"
                  >
                    {lotConfigs.length === 0 ? (
                      <option value="">-- ยังไม่มี LOT ในระบบ (กรุณารับเข้าพัสดุก่อน) --</option>
                    ) : (
                      lotConfigs.map(cfg => (
                        <option key={cfg.lotNumber} value={cfg.lotNumber}>
                          {cfg.lotNumber} ({cfg.manufacturer || 'VivaChek'})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-200">ประเภท:</label>
                    <select
                      value={lotItemType}
                      onChange={(e) => setLotItemType(e.target.value as any)}
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-bold"
                    >
                      <option value="strip">แผ่นตรวจ (Strip)</option>
                      <option value="control_solution">น้ำยาควบคุม (QC)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-200">จำนวนดวง:</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={lotPrintQty}
                      onChange={(e) => setLotPrintQty(Number(e.target.value))}
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-200">วันหมดอายุข้างกล่อง (EXP Date):</label>
                  <input
                    type="date"
                    value={lotExpDate}
                    onChange={(e) => setLotExpDate(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-bold"
                  />
                </div>
              </div>
            )}

            {/* SOURCE 3: DTX Machines */}
            {sourceType === 'machines' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-700 dark:text-slate-200">
                      เลือกเครื่อง DTX ({selectedMachineSerials.length}):
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectAllMachines}
                    className="text-sky-600 hover:underline cursor-pointer"
                  >
                    เลือกทั้งหมด
                  </button>
                </div>

                {uniqueWards.length > 0 && (
                  <div className="space-y-1 text-xs">
                    <label className="font-bold text-slate-600 dark:text-slate-400">กรองตามตึก/หน่วยงาน:</label>
                    <select
                      value={machineWardFilter}
                      onChange={(e) => setMachineWardFilter(e.target.value)}
                      className="w-full p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                    >
                      <option value="all">ทุกตึก ({machines.length} เครื่อง)</option>
                      {uniqueWards.map(w => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-2 max-h-56 overflow-y-auto space-y-1 bg-slate-50 dark:bg-slate-800/50">
                  {machines.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      ไม่มีข้อมูลเครื่อง DTX
                    </div>
                  ) : (
                    machines
                      .filter(m => machineWardFilter === 'all' || m.ward === machineWardFilter)
                      .map(m => {
                        const isChecked = selectedMachineSerials.includes(m.serialNumber);
                        return (
                          <label
                            key={m.id || m.serialNumber}
                            className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                              isChecked 
                                ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-300 dark:border-sky-800 text-sky-950 dark:text-sky-200' 
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleMachine(m.serialNumber)}
                                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                              />
                              <div>
                                <div className="font-mono font-bold text-sky-700 dark:text-sky-300">{m.serialNumber}</div>
                                <div className="text-[10px] text-slate-400">{m.ward || 'ไม่ระบุตึก'}</div>
                              </div>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {m.model || 'Fad'}
                            </div>
                          </label>
                        );
                      })
                  )}
                </div>
              </div>
            )}

            {/* SOURCE 4: Custom Label */}
            {sourceType === 'custom' && (
              <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-200">ชื่อรายการ (Title):</label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-200">รหัสบาร์โค้ด (Barcode):</label>
                  <input
                    type="text"
                    value={customBarcode}
                    onChange={(e) => setCustomBarcode(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-mono font-bold text-sky-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-200">ข้อความย่อย 1 (LOT):</label>
                    <input
                      type="text"
                      value={customSub1}
                      onChange={(e) => setCustomSub1(e.target.value)}
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-bold text-[11px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-200">ข้อความย่อย 2 (EXP):</label>
                    <input
                      type="text"
                      value={customSub2}
                      onChange={(e) => setCustomSub2(e.target.value)}
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-bold text-[11px]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-200">จำนวนที่พิมพ์ (ดวง):</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={customCopies}
                    onChange={(e) => setCustomCopies(Number(e.target.value))}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-bold"
                  />
                </div>
              </div>
            )}

            {/* General Label Configuration Options */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-600 dark:text-slate-300 font-bold">หัวกระดาษสติกเกอร์ (Header):</label>
                <input
                  type="text"
                  value={orgHeader}
                  onChange={(e) => setOrgHeader(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-bold"
                />
              </div>

              {sourceType !== 'custom' && (
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-600 dark:text-slate-300 font-bold">จำนวนสำเนาต่อรายการ:</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={globalCopies}
                    onChange={(e) => setGlobalCopies(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white font-bold"
                  />
                </div>
              )}

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

          {/* RIGHT COLUMN: LIVE STICKER PREVIEW & WORD EXPORT ACTION (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                  ตัวอย่างสติกเกอร์ Word 5.5 x 2.2 ซม. ({totalStickers} ดวง)
                </h3>

                {labelsToPrint.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleCopyStickerImage(labelsToPrint[0], 0)}
                    className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100 flex items-center space-x-1 px-2.5 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 cursor-pointer transition-all"
                    title="คัดลอกภาพสติกเกอร์ไปวางใน Word (Ctrl+V)"
                  >
                    {copiedImageIdx === 0 ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedImageIdx === 0 ? 'คัดลอกแล้ว!' : 'คัดลอกรูป (Ctrl+V)'}</span>
                  </button>
                )}
              </div>

              {/* Toast Notification Banner */}
              {copyNotification && (
                <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-md flex items-center justify-between text-xs font-bold animate-fade-in">
                  <div className="flex items-center space-x-2">
                    <Check size={15} className="shrink-0" />
                    <span>{copyNotification}</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setCopyNotification(null)}
                    className="text-white/80 hover:text-white p-0.5 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* PREVIEW CONTAINER (Exact 5.5 x 2.2 cm aspect ratio) */}
              <div className="p-4 bg-slate-200/70 dark:bg-slate-950/70 rounded-3xl border border-slate-300 dark:border-slate-800 overflow-y-auto max-h-[460px] flex flex-wrap gap-4 items-start justify-center">
                {labelsToPrint.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    กรุณาเลือกรายการที่ต้องการพิมพ์สติกเกอร์
                  </div>
                ) : (
                  labelsToPrint.slice(0, 16).map((label, idx) => (
                    <div key={idx} className="flex flex-col items-center space-y-1">
                      <div
                        style={{
                          width: '55mm',
                          height: '22mm',
                          minWidth: '55mm',
                          maxWidth: '55mm',
                          minHeight: '22mm',
                          maxHeight: '22mm'
                        }}
                        className="bg-white text-black rounded shadow-sm border border-slate-300 flex flex-col justify-between select-none overflow-hidden p-1"
                      >
                        {/* Line 1: Header Org & Title */}
                        <div className="flex items-center justify-between leading-none font-black border-b border-black/25 text-[7.5px] pb-0.5">
                          <span className="truncate max-w-[30mm]">{label.header}</span>
                          <span className="truncate text-slate-700 font-bold max-w-[21mm]">{label.title}</span>
                        </div>

                        {/* Line 2: Barcode SVG & Display Code */}
                        <div className="flex flex-col items-center justify-center my-auto py-0.2">
                          <BarcodeSvg 
                            text={label.barcode} 
                            height={24} 
                            barWidth={2} 
                            quietZone={14} 
                          />
                          <span className="font-mono font-black tracking-wider leading-none text-[7.5px] mt-0.5">
                            {label.displayCode}
                          </span>
                        </div>

                        {/* Line 3: LOT, EXP & Open Date Blank */}
                        <div className="leading-none font-mono font-bold flex items-center justify-between border-t border-black/25 text-[7px] pt-0.5">
                          <div className="flex space-x-1.5 truncate max-w-[32mm]">
                            <span>{label.subInfo1}</span>
                            <span>{label.subInfo2}</span>
                          </div>
                          {label.showOpenDateBlank && (
                            <span className="font-sans font-black bg-slate-100 rounded shrink-0 text-[6.5px] px-1">
                              เปิด: ___/___
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quick card action buttons */}
                      <div className="flex items-center space-x-1 text-[9.5px]">
                        <button
                          type="button"
                          onClick={() => handleCopyStickerImage(label, idx)}
                          className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-slate-700 dark:text-slate-200 hover:text-emerald-700 font-bold border border-slate-200 dark:border-slate-700 flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                          title="คัดลอกภาพสติกเกอร์ไปวางใน Word (Ctrl+V)"
                        >
                          {copiedImageIdx === idx ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                          <span>{copiedImageIdx === idx ? 'คัดลอกแล้ว' : 'วาง Word'}</span>
                        </button>
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

            {/* PRINT ACTION FOOTER (WORD EXPORT ONLY) */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs space-y-0.5">
                <div className="font-black text-slate-900 dark:text-white flex items-center space-x-1.5">
                  <FileText size={16} className="text-blue-600" />
                  <span>สติกเกอร์พร้อมส่งออก Word (.docx) รวมทั้งหมด {totalStickers} ดวง</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  ตั้งค่าขนาดกระดาษ 5.5 x 2.2 ซม. ระยะขอบ 0.2 ซม. สั่งพิมพ์จาก Word ได้เลยโดยไม่ตกขอบ 100%
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  ปิด
                </button>

                {labelsToPrint.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleCopyStickerImage(labelsToPrint[0], 0)}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-black flex items-center space-x-1.5 cursor-pointer shadow-md shadow-emerald-600/30 transition-all"
                    title="คัดลอกภาพสติกเกอร์ไปวางใน Microsoft Word (Ctrl+V) ได้ทันที"
                  >
                    <Copy size={15} />
                    <span>คัดลอกรูปไปวาง Word</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleExportWord}
                  disabled={totalStickers === 0 || isExportingWord}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-black flex items-center space-x-2 cursor-pointer shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
                  id="btn-export-word-55x22"
                >
                  <FileText size={16} />
                  <span>{isExportingWord ? 'กำลังสร้างไฟล์ Word...' : 'ส่งออกไฟล์ Word (.docx) เพื่อพิมพ์'}</span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
