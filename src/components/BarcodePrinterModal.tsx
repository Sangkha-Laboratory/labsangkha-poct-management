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
  Check,
  FileText
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
  subInfo1: string; // e.g. LOT: 2026-A
  subInfo2: string; // e.g. EXP: 2026-12-31
  showOpenDateBlank: boolean;
  copies: number;
}

// Standard Highly Compliant Code128 Vector/Canvas Generator for UI Display with 100% Crisp Edges
function BarcodeSvg({ 
  text, 
  height = 28, 
  barWidth = 2,
  quietZone = 12 
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
          format: "CODE128", // Standard Code128 auto mode
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

// Generates high-contrast pixel-perfect 1:1 PNG Data URL for Code 128 (matches online barcode generators)
function createBarcodeDataUrl(text: string, height = 50, barWidth = 2, quietZone = 14): string {
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, text, {
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
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error('createBarcodeDataUrl error:', e);
    return '';
  }
}

// Helper to serialize barcode into exact SVG string as fallback
function createBarcodeSvgString(text: string, height = 28, barWidth = 1.25, quietZone = 8): string {
  try {
    const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svgNode, text, {
      format: "CODE128",
      lineColor: "#000000",
      background: "#ffffff",
      width: barWidth,
      height: height,
      displayValue: false,
      margin: 0,
      marginLeft: quietZone,
      marginRight: quietZone,
      marginTop: 1,
      marginBottom: 1
    });
    svgNode.setAttribute('shape-rendering', 'crispEdges');
    svgNode.style.shapeRendering = 'crispEdges';
    const rects = svgNode.querySelectorAll('rect');
    rects.forEach(r => r.setAttribute('shape-rendering', 'crispEdges'));
    return new XMLSerializer().serializeToString(svgNode);
  } catch (e) {
    console.error('createBarcodeSvgString error:', e);
    return `<div style="font-family: monospace; font-size: 8px; font-weight: bold; text-align: center;">${text}</div>`;
  }
}

// Generates a high-resolution 300 DPI canvas blob for 55x22mm label to paste cleanly into Microsoft Word
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

      // Crisp White Background
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

      // Line 2: Barcode via JsBarcode on offscreen canvas
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

      // Draw barcode centered
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

// Zebra Programming Language (ZPL II) Generator (55x22 mm, 50x20 mm or 76x51 mm, 203 DPI)
function generateZpl50x20(labels: PrintableLabel[], mode: 'roll_55x22' | 'roll_50x20' | 'roll_76x51' | 'roll_50x25' | 'a4_grid' = 'roll_55x22'): string {
  let zpl = '';
  const is76x51 = mode === 'roll_76x51';
  const is55x22 = mode === 'roll_55x22';

  labels.forEach(l => {
    for (let c = 0; c < l.copies; c++) {
      zpl += '^XA\n';
      if (is55x22) {
        zpl += '^PW440\n'; // Print Width: 440 dots (55mm at 8 dots/mm)
        zpl += '^LL176\n'; // Label Length: 176 dots (22mm at 8 dots/mm)
        zpl += '^LH16,16\n'; // Margins: 0.2cm (2mm) = 16 dots
        zpl += `^FO8,4^A0N,18,18^FD${l.header}^FS\n`;
        zpl += `^FO250,4^A0N,16,16^FD${l.title.slice(0, 16)}^FS\n`;
        zpl += '^FO8,26^GB392,1,1^FS\n';
        zpl += '^FO24,32^BY2,3,56^BCN,56,Y,N,N^FD>;' + l.barcode + '^FS\n';
        zpl += '^FO8,124^GB392,1,1^FS\n';
        zpl += `^FO8,128^A0N,15,15^FD${l.subInfo1}  ${l.subInfo2}^FS\n`;
        if (l.showOpenDateBlank) {
          zpl += '^FO295,128^A0N,15,15^FDOPEN: __/__^FS\n';
        }
      } else if (is76x51) {
        zpl += '^PW610\n'; // Print Width: 610 dots (76.2mm at 8 dots/mm)
        zpl += '^LL406\n'; // Label Length: 406 dots (50.8mm at 8 dots/mm)
        zpl += '^LH0,0\n';
        zpl += `^FO40,24^A0N,28,28^FD${l.header}^FS\n`;
        zpl += `^FO380,24^A0N,24,24^FD${l.title.slice(0, 18)}^FS\n`;
        zpl += '^FO40,58^GB530,2,2^FS\n';
        zpl += `^FO60,78^BY3,3,150^BCN,150,Y,N,N^FD>;${l.barcode}^FS\n`;
        zpl += '^FO40,285^GB530,2,2^FS\n';
        zpl += `^FO40,300^A0N,24,24^FD${l.subInfo1}   ${l.subInfo2}^FS\n`;
        if (l.showOpenDateBlank) {
          zpl += '^FO410,300^A0N,24,24^FDOPEN: __/__^FS\n';
        }
      } else {
        zpl += '^PW400\n'; // Print Width: 400 dots (50mm at 8 dots/mm)
        zpl += '^LL160\n'; // Label Length: 160 dots (20mm at 8 dots/mm)
        zpl += '^LH0,0\n';
        zpl += `^FO16,8^A0N,18,18^FD${l.header}^FS\n`;
        zpl += `^FO240,8^A0N,16,16^FD${l.title.slice(0, 15)}^FS\n`;
        zpl += '^FO16,28^GB368,1,1^FS\n';
        zpl += '^FO36,34^BY2,3,52^BCN,52,Y,N,N^FD>;' + l.barcode + '^FS\n';
        zpl += '^FO16,120^GB368,1,1^FS\n';
        zpl += `^FO16,126^A0N,15,15^FD${l.subInfo1}  ${l.subInfo2}^FS\n`;
        if (l.showOpenDateBlank) {
          zpl += '^FO275,126^A0N,15,15^FDOPEN: __/__^FS\n';
        }
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
  // Default to exact hospital Word setup: 5.5 x 2.2 cm (55x22 mm) with 2mm margins
  const [printMode, setPrintMode] = useState<'roll_55x22' | 'roll_50x20' | 'roll_76x51' | 'roll_50x25' | 'a4_grid'>('roll_55x22');
  const [barcodeStyle, setBarcodeStyle] = useState<'standard' | 'large_barcode'>('standard');
  const [orgHeader, setOrgHeader] = useState<string>('รพ.สังขะ • งานชันสูตร');
  const [showOpenDateBlank, setShowOpenDateBlank] = useState<boolean>(true);
  const [globalCopies, setGlobalCopies] = useState<number>(1);
  const [zoomPreview, setZoomPreview] = useState<boolean>(false);
  const [showZplPanel, setShowZplPanel] = useState<boolean>(false);
  const [copiedZpl, setCopiedZpl] = useState<boolean>(false);
  const [copiedImageIdx, setCopiedImageIdx] = useState<number | null>(null);
  const [copyNotification, setCopyNotification] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isExportingWord, setIsExportingWord] = useState<boolean>(false);
  const [barcodeDensity, setBarcodeDensity] = useState<'high_contrast' | 'standard'>('high_contrast');
  const [rotate180, setRotate180] = useState<boolean>(false);
  const [verticalOffset, setVerticalOffset] = useState<number>(0); // in mm (-2 to +2)

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

  // 100% Reliable In-DOM Printing Method (Guarantees Browser Print Preview Displays Clearly)
  const handlePrint = () => {
    if (labelsToPrint.length === 0) return;
    setIsPrinting(true);

    const is55x22 = printMode === 'roll_55x22';
    const is76x51 = printMode === 'roll_76x51';
    const is50x20 = printMode === 'roll_50x20';
    const is50x25 = printMode === 'roll_50x25';
    const isLarge = barcodeStyle === 'large_barcode';
    
    // Page dimension: 55x22mm in hospital Word setup, 76.2x50.8mm, or 50x20mm
    const labelPageWidth = is55x22 ? '55mm' : is76x51 ? '76.2mm' : '50mm';
    const labelPageHeight = is55x22 ? '22mm' : is76x51 ? '50.8mm' : is50x25 ? '25mm' : '20mm';
    // Word Margin: 0.2cm (2mm) all sides -> Printable width: 55-4=51mm, height: 22-4=18mm
    const sheetHeight = is55x22 ? '18mm' : is76x51 ? '46mm' : is50x20 ? '18mm' : is50x25 ? '22.5mm' : '18mm';
    const sheetWidth = is55x22 ? '51mm' : is76x51 ? '72mm' : is50x20 ? '47.5mm' : is50x25 ? '47.5mm' : '48mm';
    
    // High-resolution Canvas pixel dimensions (matches online Code 128 generators)
    const canvasHeight = is76x51 ? 80 : is55x22 ? 56 : isLarge ? 64 : 50;
    const canvasBarWidth = is76x51 ? 2.5 : 2;
    const canvasQuietZone = is76x51 ? 20 : 14;

    // Generate HTML for each label with pre-serialized vector SVG / Canvas PNG with crispEdges and quiet zone
    const labelsHtml = labelsToPrint.map(label => {
      const barcodeDataUrl = createBarcodeDataUrl(label.barcode, canvasHeight, canvasBarWidth, canvasQuietZone);
      const barcodeSvgStr = createBarcodeSvgString(label.barcode, is76x51 ? 48 : is55x22 ? 30 : 28, is76x51 ? 1.6 : 1.25, 8);
      const barcodeElement = barcodeDataUrl 
        ? `<img src="${barcodeDataUrl}" class="barcode-img" alt="${label.displayCode}" />`
        : barcodeSvgStr;

      let output = '';
      for (let c = 0; c < label.copies; c++) {
        output += `
          <div class="label-sheet ${is76x51 ? 'is-76x51' : ''} ${isLarge ? 'is-large' : ''}">
            <div class="label-header">
              <span class="label-org">${label.header}</span>
              <span class="label-title">${label.title}</span>
            </div>
            <div class="barcode-wrapper ${isLarge ? 'is-large' : ''}">
              ${barcodeElement}
              <div class="barcode-label">${label.displayCode}</div>
            </div>
            <div class="label-footer">
              <div class="label-info">
                <span>${label.subInfo1}</span>
                <span>${label.subInfo2}</span>
              </div>
              ${label.showOpenDateBlank ? '<span class="label-open">เปิด: ___/___</span>' : ''}
            </div>
          </div>
        `;
      }
      return output;
    }).join('\n');

    // 1. Clean up any existing print area and dynamic print style tag
    const oldArea = document.getElementById('zebra-print-area');
    if (oldArea) oldArea.remove();
    const oldStyle = document.getElementById('zebra-dynamic-print-style');
    if (oldStyle) oldStyle.remove();

    // 2. Inject Dynamic Print Stylesheet for exact label size, hiding the main app during print
    const styleEl = document.createElement('style');
    styleEl.id = 'zebra-dynamic-print-style';
    styleEl.innerHTML = `
      @media screen {
        #zebra-print-area {
          display: none !important;
        }
      }
      @media print {
        @page {
          size: ${printMode === 'a4_grid' ? 'A4 portrait' : `${labelPageWidth} ${labelPageHeight}`};
          margin: 0mm !important;
        }
        * {
          box-sizing: border-box !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: auto !important;
          background: #ffffff !important;
          color: #000000 !important;
          overflow: visible !important;
        }
        /* Completely hide screen app, nav, background glows, and dialog modal */
        #root > *:not(#zebra-print-area),
        #app-root,
        #app-header,
        #app-footer,
        #barcode-printer-modal,
        .no-print {
          display: none !important;
          visibility: hidden !important;
        }
        /* Show ONLY the zebra print area with full visibility at (0,0) */
        #zebra-print-area {
          display: block !important;
          visibility: visible !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: ${labelPageWidth} !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000 !important;
          z-index: 9999999 !important;
        }
        #zebra-print-area * {
          visibility: visible !important;
        }
        ${printMode === 'a4_grid' ? `
          .print-container {
            display: grid !important;
            grid-template-columns: repeat(4, 48mm) !important;
            gap: 2mm 3mm !important;
            justify-content: center !important;
            width: 100% !important;
            padding: 0 !important;
          }
          .label-sheet {
            width: 48mm !important;
            height: 20mm !important;
            max-width: 48mm !important;
            max-height: 20mm !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            padding: 1mm 1.5mm !important;
            border: 0.25mm dashed #888888 !important;
            border-radius: 1mm !important;
            overflow: hidden !important;
            background: #ffffff !important;
          }
        ` : `
          .print-container {
            width: ${labelPageWidth} !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .label-sheet {
            width: ${labelPageWidth} !important;
            height: ${labelPageHeight} !important;
            min-width: ${labelPageWidth} !important;
            max-width: ${labelPageWidth} !important;
            min-height: ${labelPageHeight} !important;
            max-height: ${labelPageHeight} !important;
            margin: 0 !important;
            padding: ${is55x22 ? '1mm 2.2mm' : is76x51 ? '2mm 3mm' : '0.8mm 1.5mm'} !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            background: #ffffff !important;
            border: none !important;
            ${rotate180 ? 'transform: rotate(180deg); transform-origin: center center;' : ''}
          }
          .label-sheet:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        `}
        .label-header {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          font-size: ${is76x51 ? '11px' : is55x22 ? '7px' : '7.2px'} !important;
          font-weight: 900 !important;
          border-bottom: ${is76x51 ? '0.3mm solid #000000' : '0.2mm solid #000000'} !important;
          padding-bottom: ${is76x51 ? '0.3mm' : '0.12mm'} !important;
          line-height: 1 !important;
          height: ${is76x51 ? '4.5mm' : is55x22 ? '2.1mm' : '2.3mm'} !important;
          margin-bottom: ${is76x51 ? '0.3mm' : '0.12mm'} !important;
        }
        .label-org {
          max-width: ${is76x51 ? '45mm' : is55x22 ? '28mm' : '26mm'} !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }
        .label-title {
          max-width: ${is76x51 ? '26mm' : is55x22 ? '21mm' : '19mm'} !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          font-weight: bold !important;
        }
        .barcode-wrapper {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          margin: 0 auto !important;
          padding: 0 !important;
          height: ${is76x51 ? '27mm' : is55x22 ? '9.8mm' : isLarge ? '11.8mm' : '10.5mm'} !important;
        }
        .barcode-img {
          display: block !important;
          max-width: ${is76x51 ? '68mm' : is55x22 ? '46mm' : '45mm'} !important;
          height: ${is76x51 ? '21mm' : is55x22 ? '7.5mm' : isLarge ? '9.8mm' : '8.2mm'} !important;
          margin: 0 auto !important;
          image-rendering: pixelated !important;
          image-rendering: -moz-crisp-edges !important;
          image-rendering: crisp-edges !important;
        }
        .barcode-wrapper svg {
          display: block !important;
          max-width: ${is76x51 ? '68mm' : is55x22 ? '46mm' : '45mm'} !important;
          height: ${is76x51 ? '21mm' : is55x22 ? '7.5mm' : isLarge ? '9.8mm' : '8.2mm'} !important;
          margin: 0 auto !important;
          shape-rendering: crispEdges !important;
          image-rendering: pixelated !important;
          image-rendering: -moz-crisp-edges !important;
          image-rendering: crisp-edges !important;
        }
        .barcode-wrapper svg rect,
        .barcode-wrapper svg path {
          shape-rendering: crispEdges !important;
        }
        .barcode-label {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
          font-size: ${is76x51 ? '11px' : is55x22 ? '6.8px' : '7px'} !important;
          font-weight: 900 !important;
          letter-spacing: ${is76x51 ? '0.6px' : '0.4px'} !important;
          line-height: 1 !important;
          margin-top: ${is76x51 ? '0.6mm' : '0.15mm'} !important;
          text-align: center !important;
        }
        .label-footer {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          font-size: ${is76x51 ? '10px' : is55x22 ? '6.2px' : '6.4px'} !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
          font-weight: 700 !important;
          border-top: ${is76x51 ? '0.3mm solid #000000' : '0.2mm solid #000000'} !important;
          padding-top: ${is76x51 ? '0.3mm' : '0.12mm'} !important;
          line-height: 1 !important;
          height: ${is76x51 ? '4.5mm' : is55x22 ? '2.1mm' : '2.2mm'} !important;
          margin-top: ${is76x51 ? '0.3mm' : '0.12mm'} !important;
        }
        .label-info {
          display: flex !important;
          gap: ${is76x51 ? '3mm' : '1.2mm'} !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          max-width: ${is76x51 ? '50mm' : is55x22 ? '33mm' : '30mm'} !important;
        }
        .label-open {
          font-size: ${is76x51 ? '9.5px' : '5.8px'} !important;
          font-family: sans-serif !important;
          font-weight: 900 !important;
          background: #f1f5f9 !important;
          padding: ${is76x51 ? '0.3mm 1mm' : '0.1mm 0.5mm'} !important;
          border-radius: ${is76x51 ? '0.5mm' : '0.3mm'} !important;
          white-space: nowrap !important;
        }
      }
    `;
    document.head.appendChild(styleEl);

    // 3. Mount #zebra-print-area into document.body
    const printArea = document.createElement('div');
    printArea.id = 'zebra-print-area';
    printArea.innerHTML = `<div class="print-container">${labelsHtml}</div>`;
    document.body.appendChild(printArea);

    // 4. Trigger window.print() after a brief tick to allow browser DOM repaint
    const cleanup = () => {
      setIsPrinting(false);
      window.removeEventListener('afterprint', cleanup);
      setTimeout(() => {
        const area = document.getElementById('zebra-print-area');
        if (area) area.remove();
        const dynStyle = document.getElementById('zebra-dynamic-print-style');
        if (dynStyle) dynStyle.remove();
      }, 500);
    };

    window.addEventListener('afterprint', cleanup);

    setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        console.error('window.print error:', err);
      } finally {
        // Fallback cleanup if afterprint doesn't fire (e.g. print dialog cancelled quickly)
        setTimeout(cleanup, 2500);
      }
    }, 120);
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
          setCopyNotification(`คัดลอกรูปสติกเกอร์ ${label.displayCode} แล้ว! สามารถกด Ctrl + V วางใน Word ได้ทันที`);
          setTimeout(() => {
            setCopiedImageIdx(null);
            setCopyNotification(null);
          }, 4000);
          return;
        } catch (e) {
          console.warn('Clipboard writeImage failed, falling back to file download:', e);
        }
      }

      // Fallback: download PNG file
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

  const handleDownloadStickerImage = async (label: PrintableLabel) => {
    const blob = await renderLabelToCanvasBlob(label);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sticker-${label.displayCode}-55x22mm.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setCopyNotification(`ดาวน์โหลดรูป ${label.displayCode} เรียบร้อยแล้ว`);
    setTimeout(() => setCopyNotification(null), 3000);
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
      setCopyNotification('ดาวน์โหลดไฟล์ Word (.docx) ขนาด 5.5 x 2.2 ซม. สำเร็จแล้ว! เปิดไฟล์แล้วกดสั่งพิมพ์ใน Word ได้ทันที');
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
                  ศูนย์พิมพ์สติกเกอร์บาร์โค้ด Zebra (50x20 mm)
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                  Direct Print Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ขนาดมาตรฐาน 50x20 มม. สำหรับเครื่องพิมพ์ Zebra และสแกนเนอร์บาร์โค้ดแล็บยิงติด 100%
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
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">ขนาดสติกเกอร์ / เครื่องพิมพ์:</label>
                  {printMode === 'roll_55x22' && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                      ตรงกับค่า Word ของ รพ. (5.5 x 2.2 ซม. ขอบ 0.2 ซม.)
                    </span>
                  )}
                  {printMode === 'roll_50x20' && (
                    <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.5 rounded">
                      สติกเกอร์ 5x2 ซม.
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPrintMode('roll_55x22')}
                    className={`col-span-2 p-2.5 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center cursor-pointer ${
                      printMode === 'roll_55x22'
                        ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-500 text-emerald-900 dark:text-emerald-200 shadow-sm ring-2 ring-emerald-500'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[11.5px] font-black text-emerald-700 dark:text-emerald-300">★ สูตร Word ของ รพ. (5.5 x 2.2 ซม.)</span>
                      <span className="text-[9px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.2 rounded font-bold">แนะนำ</span>
                    </div>
                    <span className="text-[9.5px] font-medium text-slate-500 dark:text-slate-400">
                      กว้าง 5.5 ซม. x สูง 2.2 ซม. (ขอบ 0.2 ซม. ทุกด้าน พิมพ์ไม่ตกขอบตามที่แล็บตั้ง)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrintMode('roll_50x20')}
                    className={`p-2.5 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center cursor-pointer ${
                      printMode === 'roll_50x20'
                        ? 'bg-sky-50 dark:bg-sky-950 border-sky-500 text-sky-800 dark:text-sky-300 shadow-sm ring-1 ring-sky-400'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="text-[11px] font-bold">ม้วน 50x20 mm</span>
                    <span className="text-[9px] font-medium text-slate-400">สติกเกอร์ 5x2 ซม.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrintMode('roll_76x51')}
                    className={`p-2.5 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center cursor-pointer ${
                      printMode === 'roll_76x51'
                        ? 'bg-sky-50 dark:bg-sky-950 border-sky-500 text-sky-800 dark:text-sky-300 shadow-sm ring-1 ring-sky-400'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="text-[11px] font-bold">แล็บ 7.62x5.08 cm</span>
                    <span className="text-[9px] font-normal text-slate-400">ขนาด 3x2" ตามไดรเวอร์</span>
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
                    <span className="text-[11px]">ม้วน 50x25 mm</span>
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
                    <span className="text-[11px]">แผ่น A4 Grid</span>
                    <span className="text-[9px] font-normal text-slate-400">A4 สำหรับลอกแปะ</span>
                  </button>
                </div>
              </div>

              {/* Barcode Style / Scanner Readability Toggle */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">รูปแบบการแสดงบาร์โค้ด:</label>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">1:1 Pixel-Perfect Code 128</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBarcodeStyle('standard')}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center cursor-pointer ${
                      barcodeStyle === 'standard'
                        ? 'bg-sky-50 dark:bg-sky-950 border-sky-500 text-sky-800 dark:text-sky-300 shadow-xs ring-1 ring-sky-400'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="text-[11px] font-bold">มาตรฐาน (ครบถ้วน)</span>
                    <span className="text-[9px] font-normal text-slate-400">มีหัว รพ. + บาร์โค้ด + LOT/EXP</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBarcodeStyle('large_barcode')}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center cursor-pointer ${
                      barcodeStyle === 'large_barcode'
                        ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-500 text-emerald-800 dark:text-emerald-300 shadow-xs ring-1 ring-emerald-400'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-300">บาร์โค้ดใหญ่พิเศษ (Easy Scan)</span>
                    <span className="text-[9px] font-normal text-emerald-600 dark:text-emerald-400">แท่งบาร์โค้ดสูงเต็มที่ ยิงติด 100%</span>
                  </button>
                </div>
              </div>

              {/* Driver Configuration Notice */}
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-1 text-[10.5px] leading-tight text-amber-950 dark:text-amber-200">
                <div className="font-bold flex items-center space-x-1 text-amber-900 dark:text-amber-300">
                  <span>⚠️ สาเหตุที่รูปพิมพ์ก่อนหน้านี้ตกขอบและยิงไม่ติด:</span>
                </div>
                <div className="text-[10px] space-y-1">
                  <p>
                    1. <strong>สเกลใหญ่เกินกระดาษ:</strong> สติกเกอร์จริงคือขนาด <strong>5x2 ซม.</strong> แต่เครื่องถูกสั่งพิมพ์ที่ <strong>7.62x5.08 ซม.</strong> สเกลจึงใหญ่เกินกระดาษถึง 2.5 เท่า ทำให้บาร์โค้ดตกขอบเหลือแต่ขอบบนนิดเดียว ปืนเลยยิงไม่ติด
                  </p>
                  <p>
                    2. <strong>แก้ไขแล้ว:</strong> ระบบตั้งขนาดเป็น <strong>ม้วน 50x20 mm</strong> พอดีดวง 100% และเรนเดอร์บาร์โค้ดเป็น PNG Pixel-Perfect แบบเดียวกับเว็บสร้างโค้ดออนไลน์
                  </p>
                  <p>
                    3. <strong>ในหน้าต่างไดรเวอร์ Zebra ZD230:</strong> ให้เข้าไปเปลี่ยน Width เป็น <strong>5.00</strong>, Height เป็น <strong>2.00</strong> และเปลี่ยน Left เป็น <strong>0.00</strong> cm (เดิมตั้ง 0.70 cm ทำให้คำว่า 'รพ.สังขะ' ถูกตัดขอบซ้าย)
                  </p>
                </div>
              </div>

              {/* Barcode Density / Scanner Readability Setting */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                    ความคมชัดบาร์โค้ด (Scanner Readability):
                  </label>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Code 128 + Quiet Zone</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBarcodeDensity('high_contrast')}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center cursor-pointer ${
                      barcodeDensity === 'high_contrast'
                        ? 'bg-sky-50 dark:bg-sky-950 border-sky-500 text-sky-700 dark:text-sky-300 shadow-xs'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="text-[11px] font-bold">หนาคมชัด (1.25px)</span>
                    <span className="text-[9px] font-normal text-emerald-600 dark:text-emerald-400">ยิงติดง่าย แนะนำสำหรับปืนสแกน</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBarcodeDensity('standard')}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center cursor-pointer ${
                      barcodeDensity === 'standard'
                        ? 'bg-sky-50 dark:bg-sky-950 border-sky-500 text-sky-700 dark:text-sky-300 shadow-xs'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="text-[11px]">มาตรฐาน (1.15px)</span>
                    <span className="text-[9px] font-normal text-slate-400">สำหรับรหัสยาวพิเศษ</span>
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

              {/* Orientation & Vertical Offset Calibration */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-slate-700 dark:text-slate-300 font-bold">
                    การจัดวาง & หมุนทิศทาง:
                  </label>
                  <button
                    type="button"
                    onClick={() => setRotate180(!rotate180)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer border ${
                      rotate180
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {rotate180 ? 'หมุนกลับหัว 180° (เปิด)' : 'หมุนกลับหัว 180°'}
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">ชดเชยตำแหน่งบน-ล่าง:</span>
                  <div className="flex items-center space-x-1">
                    {[-2, -1, 0, 1, 2].map((offset) => (
                      <button
                        key={offset}
                        type="button"
                        onClick={() => setVerticalOffset(offset)}
                        className={`px-2 py-0.5 rounded-lg font-mono font-bold text-[10px] cursor-pointer transition-all border ${
                          verticalOffset === offset
                            ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {offset === 0 ? '0' : offset > 0 ? `+${offset}` : `${offset}`}mm
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Crucial Browser Print Notice Banner */}
              <div className="p-2.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-xl space-y-1 text-[10.5px] leading-tight text-sky-950 dark:text-sky-200">
                <div className="font-bold flex items-center space-x-1 text-sky-900 dark:text-sky-300">
                  <span>💡 การตั้งค่าสั่งพิมพ์ในบราวเซอร์เพื่อไม่ให้ตกขอบ:</span>
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-[10px]">
                  <li><strong>ระยะขอบ (Margins):</strong> เลือก <strong>"ไม่มี" (None)</strong> เท่านั้น (ห้ามเลือกค่าเริ่มต้น)</li>
                  <li><strong>การวางแนว (Layout):</strong> <strong>"แนวตั้ง" (Portrait)</strong> ตามที่ตั้งใน Word</li>
                  <li><strong>มาตราส่วน (Scale):</strong> เลือก <strong>100%</strong> หรือ "พอดีกับหน้ากระดาษ"</li>
                  <li><strong>ส่วนหัวและส่วนท้าย:</strong> ติ๊กออก (Uncheck Headers & Footers)</li>
                </ul>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: LIVE STICKER PREVIEW & PRINT TRIGGER (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
            
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                    ตัวอย่างสติกเกอร์ {printMode === 'roll_55x22' ? 'สูตร Word รพ. (5.5x2.2 cm)' : printMode === 'roll_76x51' ? 'แล็บ 7.62x5.08 cm' : printMode === 'roll_50x20' ? '50x20 mm' : printMode === 'roll_50x25' ? '50x25 mm' : 'A4 Grid'} ({totalStickers} ดวง)
                  </h3>
                </div>
                <div className="flex items-center space-x-1.5">
                  {labelsToPrint.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={handleExportWord}
                        disabled={isExportingWord}
                        className="text-xs font-black text-white bg-blue-600 hover:bg-blue-700 active:scale-98 flex items-center space-x-1.5 px-3 py-1.5 rounded-xl shadow-xs cursor-pointer transition-all disabled:opacity-50"
                        title="ดาวน์โหลดไฟล์ Microsoft Word (.docx) สำเร็จรูป ตั้งค่าหน้า 5.5 x 2.2 ซม. ขอบ 0.2 ซม. ให้เรียบร้อย สั่งพิมพ์ได้ทันที"
                      >
                        <FileText size={13} />
                        <span>{isExportingWord ? 'กำลังสร้าง Word...' : 'Export เป็น Word (.docx)'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyStickerImage(labelsToPrint[0], 0)}
                        className="text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 flex items-center space-x-1 px-3 py-1.5 rounded-xl shadow-xs cursor-pointer transition-all"
                        title="คัดลอกภาพสติกเกอร์ขนาด 5.5 x 2.2 ซม. เข้าคลิปบอร์ด เปิด Word แล้วกด Ctrl+V วางได้ทันที"
                      >
                        {copiedImageIdx === 0 ? <Check size={13} /> : <Copy size={13} />}
                        <span>{copiedImageIdx === 0 ? 'คัดลอกแล้ว!' : 'คัดลอกรูป (Ctrl+V)'}</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowZplPanel(!showZplPanel)}
                    className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center space-x-1 cursor-pointer bg-sky-50 dark:bg-sky-950 px-2 py-1.5 rounded-xl border border-sky-200 dark:border-sky-800"
                  >
                    <FileCode size={13} />
                    <span>ZPL</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setZoomPreview(!zoomPreview)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center space-x-1 cursor-pointer p-1.5"
                  >
                    <Maximize2 size={13} />
                  </button>
                </div>
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

              {/* ZPL Code Inspector Panel */}
              {showZplPanel && (
                <div className="p-3 bg-slate-900 text-slate-100 rounded-2xl border border-slate-700 space-y-2 animate-fade-in text-xs font-mono">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                    <span className="font-bold text-sky-400">Zebra ZPL II Code (55x22 mm, 203 DPI)</span>
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
                    {generateZpl50x20(labelsToPrint, printMode)}
                  </pre>
                  <p className="text-[10px] text-slate-400 font-sans">
                    💡 สามารถนำโค้ดนี้ส่งไปยัง Zebra Setup Utilities หรือส่งตรงไปยัง Raw Port 9100 ของเครื่องพิมพ์ Zebra ได้โดยตรง 100%
                  </p>
                </div>
              )}

              {/* PREVIEW CONTAINER */}
              <div 
                className={`p-4 bg-slate-200/70 dark:bg-slate-950/70 rounded-3xl border border-slate-300 dark:border-slate-800 overflow-y-auto max-h-[460px] flex flex-wrap gap-4 items-start justify-center transition-all ${
                  zoomPreview ? 'scale-110 origin-top' : ''
                }`}
              >
                {labelsToPrint.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    กรุณาเลือกรายการที่ต้องการพิมพ์สติกเกอร์
                  </div>
                ) : (
                  labelsToPrint.slice(0, 16).map((label, idx) => {
                    const is55x22 = printMode === 'roll_55x22';
                    const is76x51 = printMode === 'roll_76x51';
                    const is50x20 = printMode === 'roll_50x20';
                    const cardW = is55x22 ? '55mm' : is76x51 ? '76.2mm' : '50mm';
                    const cardH = is55x22 ? '22mm' : is76x51 ? '50.8mm' : is50x20 ? '20mm' : '25mm';

                    return (
                      <div key={idx} className="flex flex-col items-center space-y-1">
                        <div
                          style={{
                            width: cardW,
                            height: cardH,
                            minWidth: cardW,
                            maxWidth: cardW,
                            minHeight: cardH,
                            maxHeight: cardH,
                            transform: rotate180 ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s ease'
                          }}
                          className={`bg-white text-black rounded shadow-sm border border-slate-300 flex flex-col justify-between select-none overflow-hidden ${
                            is76x51 ? 'p-2.5' : is55x22 ? 'p-1' : 'px-1.5 py-1'
                          }`}
                        >
                          {/* Line 1: Header Org & Title */}
                          <div className={`flex items-center justify-between leading-none font-black border-b border-black/25 ${
                            is76x51 ? 'text-[11px] pb-1' : is55x22 ? 'text-[7.5px] pb-0.5' : 'text-[7.5px] pb-0.5'
                          }`}>
                            <span className={`truncate ${is76x51 ? 'max-w-[46mm]' : is55x22 ? 'max-w-[30mm]' : 'max-w-[27mm]'}`}>{label.header}</span>
                            <span className={`truncate text-slate-700 font-bold ${is76x51 ? 'max-w-[24mm]' : is55x22 ? 'max-w-[21mm]' : 'max-w-[19mm]'}`}>{label.title}</span>
                          </div>

                          {/* Line 2: Barcode SVG & Display Code */}
                          <div className="flex flex-col items-center justify-center my-auto py-0.2">
                            <BarcodeSvg 
                              text={label.barcode} 
                              height={is76x51 ? 38 : is55x22 ? 24 : barcodeStyle === 'large_barcode' ? 26 : 20} 
                              barWidth={is76x51 ? 2.2 : 2} 
                              quietZone={is76x51 ? 16 : 14} 
                            />
                            <span className={`font-mono font-black tracking-wider leading-none ${
                              is76x51 ? 'text-[11px] mt-1' : is55x22 ? 'text-[7.5px] mt-0.5' : 'text-[7.5px] mt-0.5'
                            }`}>
                              {label.displayCode}
                            </span>
                          </div>

                          {/* Line 3: LOT, EXP & Open Date Blank */}
                          <div className={`leading-none font-mono font-bold flex items-center justify-between border-t border-black/25 ${
                            is76x51 ? 'text-[10px] pt-1' : is55x22 ? 'text-[7px] pt-0.5' : 'text-[7px] pt-0.5'
                          }`}>
                            <div className={`flex space-x-1.5 truncate ${is76x51 ? 'max-w-[48mm]' : is55x22 ? 'max-w-[32mm]' : 'max-w-[27mm]'}`}>
                              <span>{label.subInfo1}</span>
                              <span>{label.subInfo2}</span>
                            </div>
                            {label.showOpenDateBlank && (
                              <span className={`font-sans font-black bg-slate-100 rounded shrink-0 ${
                                is76x51 ? 'text-[9.5px] px-1.5 py-0.5' : 'text-[6.5px] px-1'
                              }`}>
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
                            className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-300 font-bold border border-slate-200 dark:border-slate-700 flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                            title="คัดลอกภาพสติกเกอร์ไปวางใน Word (Ctrl+V)"
                          >
                            {copiedImageIdx === idx ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                            <span>{copiedImageIdx === idx ? 'คัดลอกแล้ว' : 'วาง Word'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadStickerImage(label)}
                            className="p-1 rounded-md bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs"
                            title="ดาวน์โหลดรูปสติกเกอร์ (PNG 5.5 x 2.2 ซม.)"
                          >
                            <Download size={10} />
                          </button>
                        </div>
                      </div>
                    );
                  })
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
                  <span>พร้อมสั่งพิมพ์สติกเกอร์ {printMode === 'roll_55x22' ? 'สูตร Word รพ. (5.5 x 2.2 ซม.)' : printMode === 'roll_50x20' ? 'ม้วน 50x20 mm (5x2 ซม.)' : printMode === 'roll_76x51' ? '7.62x5.08 cm (3x2 นิ้ว)' : printMode === 'roll_50x25' ? '50x25 mm' : 'A4 Grid'} ทั้งหมด {totalStickers} ดวง</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  โหมด: {printMode === 'roll_55x22' ? 'สูตร Word รพ. (กว้าง 5.5 x สูง 2.2 ซม. ขอบ 0.2 ซม. ทุกด้าน พิมพ์ไม่ตกขอบ 100%)' : printMode === 'roll_50x20' ? 'ม้วนความร้อน Zebra 50x20 mm' : printMode === 'roll_76x51' ? 'สติกเกอร์แล็บ Zebra 7.62 x 5.08 cm' : printMode === 'roll_50x25' ? 'ม้วนความร้อน (50x25 mm)' : 'แผ่นสติกเกอร์ A4'}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  ปิด
                </button>

                {labelsToPrint.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={handleExportWord}
                      disabled={isExportingWord}
                      className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-black flex items-center space-x-1.5 cursor-pointer shadow-md shadow-blue-600/30 transition-all disabled:opacity-50"
                      title="ดาวน์โหลดไฟล์ Microsoft Word (.docx) สำเร็จรูป พร้อมสั่งพิมพ์ได้ทันที"
                    >
                      <FileText size={15} />
                      <span>{isExportingWord ? 'กำลังสร้าง Word...' : 'Export เป็น Word (.docx)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyStickerImage(labelsToPrint[0], 0)}
                      className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-black flex items-center space-x-1.5 cursor-pointer shadow-md shadow-emerald-600/30 transition-all"
                      title="คัดลอกภาพสติกเกอร์ขนาด 5.5 x 2.2 ซม. ไปวางใน Microsoft Word (Ctrl+V) ได้ทันที"
                    >
                      <Copy size={15} />
                      <span>คัดลอกไปวาง Word</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={totalStickers === 0 || isPrinting}
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-98 text-white text-xs font-black flex items-center space-x-2 cursor-pointer shadow-lg shadow-sky-600/30 transition-all disabled:opacity-50"
                  id="btn-print-barcode-50x20"
                >
                  <Printer size={16} />
                  <span>{isPrinting ? 'กำลังเตรียมพิมพ์...' : 'สั่งพิมพ์ทันที'}</span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
