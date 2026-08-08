/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { RepairRequest } from '../types';
import { Printer, X, CheckSquare, Square, QrCode, Upload, Image as ImageIcon, RotateCcw, Check } from 'lucide-react';
import { formatToThaiDate } from '../lib/dateUtils';

interface PrintFormProps {
  repair: RepairRequest;
  onClose: () => void;
}

export default function PrintForm({ repair, onClose }: PrintFormProps) {
  const formRef = useRef<HTMLDivElement>(null);

  // QR Code State
  const [qrCodeImage, setQrCodeImage] = useState<string>(() => {
    return localStorage.getItem('dtx_print_qr_code') || '';
  });
  const [qrCodeLabel, setQrCodeLabel] = useState<string>(() => {
    return localStorage.getItem('dtx_print_qr_label') || 'แบบฟอร์มและคู่มือ';
  });
  const [qrCodeSublabel, setQrCodeSublabel] = useState<string>(() => {
    return localStorage.getItem('dtx_print_qr_sublabel') || 'แจ้งซ่อมออนไลน์';
  });
  const [qrCodeNote, setQrCodeNote] = useState<string>(() => {
    return localStorage.getItem('dtx_print_qr_note') || '<--- scan me';
  });

  const [showQrModal, setShowQrModal] = useState(false);
  const [tempImage, setTempImage] = useState(qrCodeImage);
  const [tempLabel, setTempLabel] = useState(qrCodeLabel);
  const [tempSublabel, setTempSublabel] = useState(qrCodeSublabel);
  const [tempNote, setTempNote] = useState(qrCodeNote);

  const handleOpenQrModal = () => {
    setTempImage(qrCodeImage);
    setTempLabel(qrCodeLabel);
    setTempSublabel(qrCodeSublabel);
    setTempNote(qrCodeNote);
    setShowQrModal(true);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      alert('ไฟล์ภาพมีขนาดใหญ่เกินไป (กรุณาเลือกไฟล์ขนาดไม่เกิน 3MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setTempImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveQrSettings = () => {
    setQrCodeImage(tempImage);
    setQrCodeLabel(tempLabel);
    setQrCodeSublabel(tempSublabel);
    setQrCodeNote(tempNote);

    if (tempImage) {
      localStorage.setItem('dtx_print_qr_code', tempImage);
    } else {
      localStorage.removeItem('dtx_print_qr_code');
    }
    localStorage.setItem('dtx_print_qr_label', tempLabel);
    localStorage.setItem('dtx_print_qr_sublabel', tempSublabel);
    localStorage.setItem('dtx_print_qr_note', tempNote);

    setShowQrModal(false);
  };

  const handleResetQr = () => {
    setTempImage('');
    setTempLabel('แบบฟอร์มและคู่มือ');
    setTempSublabel('แจ้งซ่อมออนไลน์');
    setTempNote('<--- scan me');
  };

  const handlePrint = () => {
    // Elegant printing: create a temporary print style in head to hide everything except the print-container
    const style = document.createElement('style');
    style.id = 'print-style';
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden;
        }
        #print-container, #print-container * {
          visibility: visible;
        }
        #print-container {
          position: absolute;
          left: 0;
          top: 0;
          width: 210mm;
          height: 297mm;
          padding: 10mm;
          margin: 0;
          box-shadow: none;
          border: none;
          background: white;
          color: black;
          font-size: 13px;
        }
        .no-print {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
    window.print();
    // Cleanup style after print dialog closes
    setTimeout(() => {
      const el = document.getElementById('print-style');
      if (el) el.remove();
    }, 500);
  };

  const c = repair.checklist;

  // Render a tick mark (✓) or empty box matching the exact scanned form
  const renderCheckValue = (itemVal: 'pass' | 'fail' | 'pending' | undefined, statusToMatch: 'pass' | 'fail' | 'pending') => {
    if (itemVal === statusToMatch) {
      return (
        <span className="font-mono text-base font-bold text-slate-900 border border-slate-900 px-1 py-0.5 rounded leading-none bg-slate-100 flex items-center justify-center w-5 h-5">
          /
        </span>
      );
    }
    return (
      <span className="border border-slate-400 rounded w-5 h-5 inline-block"></span>
    );
  };

  const renderActionTick = (currentAction: string | undefined, actionToMatch: string) => {
    if (currentAction === actionToMatch) {
      return (
        <span className="font-mono text-base font-bold text-slate-900 border border-slate-900 px-1 py-0.5 rounded leading-none bg-slate-100 flex items-center justify-center w-5 h-5 mr-1">
          /
        </span>
      );
    }
    return (
      <span className="border border-slate-400 rounded w-5 h-5 inline-block mr-1"></span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex flex-col items-center justify-start overflow-y-auto p-4 sm:p-6" id="print-form-modal">
      {/* Control Actions bar */}
      <div className="w-full max-w-(--size-md) bg-slate-950 text-white p-3.5 rounded-t-xl flex items-center justify-between shadow-lg no-print">
        <div className="flex items-center space-x-2">
          <Printer size={18} className="text-emerald-400" />
          <span className="text-xs font-bold">ฟอร์มพิมพ์ใบรายงานการซ่อมบำรุงเครื่อง DTX</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleOpenQrModal}
            className="bg-sky-700 hover:bg-sky-600 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer"
            title="ตั้งค่า/อัปโหลดภาพ QR Code บนใบรายงานซ่อม"
          >
            <QrCode size={14} />
            <span>อัปโหลด / ตั้งค่า QR Code</span>
          </button>
          <button
            onClick={handlePrint}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center space-x-1 transition-all cursor-pointer"
          >
            <Printer size={13} />
            <span>พิมพ์รายงาน (Print PDF)</span>
          </button>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Printable Area styled precisely like the Thai Hospital Scanned Form */}
      <div
        ref={formRef}
        id="print-container"
        className="w-full max-w-(--size-md) bg-white text-slate-900 p-8 md:p-12 rounded-b-xl shadow-2xl border-x border-b border-slate-200 font-sans leading-relaxed text-xs overflow-y-auto"
        style={{ fontFamily: "'Inter', 'Sarabun', sans-serif" }}
      >
        {/* Form Title & Subtitle */}
        <div className="text-center space-y-2 pb-6 border-b-2 border-double border-slate-300">
          <h1 className="text-lg md:text-xl font-extrabold tracking-wide text-slate-900">
            รายงานการซ่อมบำรุงเครื่องตรวจวัดน้ำตาลปลายนิ้ว
          </h1>
          <p className="text-xs font-semibold text-slate-600">
            งานชันสูตรสาธารณสุข กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลสังขะ
          </p>
        </div>

        {/* Info Header Fields */}
        <div className="grid grid-cols-2 gap-4 pt-5 pb-3 font-medium text-slate-800 text-xs">
          <div className="flex items-baseline">
            <span>หน่วยงาน</span>
            <span className="flex-1 border-b border-dotted border-slate-600 px-3 py-0.5 font-bold text-slate-950 text-[13px]">
              {repair.ward}
            </span>
          </div>
          <div className="flex items-baseline">
            <span>รหัสเครื่อง</span>
            <span className="flex-1 border-b border-dotted border-slate-600 px-3 py-0.5 font-bold text-slate-950 font-mono text-[13px]">
              {repair.serialNumber}
            </span>
          </div>
        </div>

        {/* Backup Request Notice in print */}
        <div className="pb-4 text-[11px] text-slate-700 flex items-center space-x-2">
          <span>ความต้องการเครื่องสำรองใช้ชั่วคราว:</span>
          {repair.needsBackup ? (
            <span className="font-bold text-amber-850 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
              ✓ ต้องการขอเบิกเครื่องสำรองใช้ชั่วคราวระหว่างรอซ่อม
            </span>
          ) : (
            <span className="text-slate-400 font-medium">✗ ไม่ต้องการเครื่องสำรอง</span>
          )}
        </div>

        {/* Inspection Grid Table */}
        <div className="border border-slate-400 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-800 border-b border-slate-400 text-[11px] font-extrabold">
                <th className="p-3 border-r border-slate-400 w-3/5 text-center">รายการตรวจสอบ</th>
                <th className="p-3 w-2/5 text-center">ผลการตรวจสอบ</th>
              </tr>
            </thead>
            <tbody>
              {/* Header result sub-cols */}
              <tr className="border-b border-slate-300 text-[10px] text-slate-500 font-bold bg-slate-50/50">
                <td className="p-1 px-3 border-r border-slate-400"></td>
                <td className="p-1 text-center">
                  <div className="grid grid-cols-3">
                    <span>ผ่าน</span>
                    <span>ไม่ผ่าน</span>
                    <span>ยังไม่ดำเนินการ</span>
                  </div>
                </td>
              </tr>

              {/* Row 1: สภาพตัวเครื่อง */}
              <tr className="border-b border-slate-300">
                <td className="p-2.5 px-4 border-r border-slate-400 font-bold text-slate-900">
                  1. สภาพตัวเครื่อง
                </td>
                <td className="p-2.5"></td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-2 px-6 border-r border-slate-400 text-slate-600">
                  1.1. วัสดุตัวเครื่องและความสะอาด
                </td>
                <td className="p-2">
                  <div className="grid grid-cols-3 justify-items-center">
                    {renderCheckValue(c.cleanliness, 'pass')}
                    {renderCheckValue(c.cleanliness, 'fail')}
                    {renderCheckValue(c.cleanliness, 'pending')}
                  </div>
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-2 px-6 border-r border-slate-400 text-slate-600">
                  1.2. ปุ่มเปิด/ปิด
                </td>
                <td className="p-2">
                  <div className="grid grid-cols-3 justify-items-center">
                    {renderCheckValue(c.buttons, 'pass')}
                    {renderCheckValue(c.buttons, 'fail')}
                    {renderCheckValue(c.buttons, 'pending')}
                  </div>
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="p-2 px-6 border-r border-slate-400 text-slate-600">
                  1.3. ช่องเสียบ Strip
                </td>
                <td className="p-2">
                  <div className="grid grid-cols-3 justify-items-center">
                    {renderCheckValue(c.stripSlot, 'pass')}
                    {renderCheckValue(c.stripSlot, 'fail')}
                    {renderCheckValue(c.stripSlot, 'pending')}
                  </div>
                </td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="p-2 px-6 border-r border-slate-400 text-slate-600">
                  1.4. ช่องใส่ถ่าน
                </td>
                <td className="p-2">
                  <div className="grid grid-cols-3 justify-items-center">
                    {renderCheckValue(c.batterySlot, 'pass')}
                    {renderCheckValue(c.batterySlot, 'fail')}
                    {renderCheckValue(c.batterySlot, 'pending')}
                  </div>
                </td>
              </tr>

              {/* Row 2: ถ่าน */}
              <tr className="border-b border-slate-300">
                <td className="p-2.5 px-4 border-r border-slate-400 font-bold text-slate-900">
                  2. ถ่าน
                </td>
                <td className="p-2.5">
                  <div className="grid grid-cols-3 justify-items-center">
                    {renderCheckValue(c.battery, 'pass')}
                    {renderCheckValue(c.battery, 'fail')}
                    {renderCheckValue(c.battery, 'pending')}
                  </div>
                </td>
              </tr>

              {/* Row 3: การแสดงผลหน้าจอ */}
              <tr className="border-b border-slate-300">
                <td className="p-2.5 px-4 border-r border-slate-400 font-bold text-slate-900">
                  3. การแสดงผลหน้าจอ
                </td>
                <td className="p-2.5">
                  <div className="grid grid-cols-3 justify-items-center">
                    {renderCheckValue(c.screen, 'pass')}
                    {renderCheckValue(c.screen, 'fail')}
                    {renderCheckValue(c.screen, 'pending')}
                  </div>
                </td>
              </tr>

              {/* Row 4: การตรวจวัดค่าและแสดงผลการตรวจวัด */}
              <tr className="border-b border-slate-300">
                <td className="p-2.5 px-4 border-r border-slate-400 font-bold text-slate-900">
                  4. การตรวจวัดค่าและแสดงผลการตรวจวัด
                </td>
                <td className="p-2.5">
                  <div className="grid grid-cols-3 justify-items-center">
                    {renderCheckValue(c.measurement, 'pass')}
                    {renderCheckValue(c.measurement, 'fail')}
                    {renderCheckValue(c.measurement, 'pending')}
                  </div>
                </td>
              </tr>

              {/* Row 5: การควบคุมคุณภาพภายใน (IQC) ผ่านเกณฑ์ */}
              <tr className="border-b border-slate-300">
                <td className="p-2.5 px-4 border-r border-slate-400 font-bold text-slate-900">
                  5. การควบคุมคุณภาพภายใน (IQC) ผ่านเกณฑ์
                </td>
                <td className="p-2.5">
                  <div className="grid grid-cols-3 justify-items-center">
                    {renderCheckValue(c.iqc, 'pass')}
                    {renderCheckValue(c.iqc, 'fail')}
                    {renderCheckValue(c.iqc, 'pending')}
                  </div>
                </td>
              </tr>

              {/* Row 6: Intercomparison ผ่านเกณฑ์ที่กำหนด */}
              <tr className="border-b border-slate-300">
                <td className="p-2.5 px-4 border-r border-slate-400 font-bold text-slate-900">
                  6. Intercomparison ผ่านเกณฑ์ที่กำหนด
                </td>
                <td className="p-2.5">
                  <div className="grid grid-cols-3 justify-items-center">
                    {renderCheckValue(c.intercomparison, 'pass')}
                    {renderCheckValue(c.intercomparison, 'fail')}
                    {renderCheckValue(c.intercomparison, 'pending')}
                  </div>
                </td>
              </tr>

              {/* Row 7: อื่นๆ */}
              <tr>
                <td className="p-3 px-4 border-r border-slate-400 text-slate-800" colSpan={2}>
                  <div className="font-bold text-slate-900 mb-1">7. อื่น ๆ</div>
                  <div className="text-slate-600 pl-4 border-l border-slate-300 italic min-h-[40px] whitespace-pre-line">
                    {c.others || 'ไม่ระบุเพิ่มเติม'}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Actions Box */}
        <div className="mt-5 p-4 border border-slate-400 rounded-lg bg-slate-50/50">
          <div className="flex items-center space-x-6 text-slate-900 text-xs">
            <span className="font-bold">การดำเนินการ:</span>
            <label className="flex items-center cursor-pointer">
              {renderActionTick(repair.actionTaken, 'change_battery')}
              <span>เปลี่ยนถ่าน</span>
            </label>
            <label className="flex items-center cursor-pointer">
              {renderActionTick(repair.actionTaken, 'return_original')}
              <span>คืนเครื่องเดิม</span>
            </label>
            <label className="flex items-center cursor-pointer">
              {renderActionTick(repair.actionTaken, 'provide_new')}
              <span>จ่ายเครื่องใหม่</span>
            </label>
          </div>
          {repair.diagnosedProblem && (
            <div className="mt-2.5 pt-2 border-t border-slate-300 text-[11px]">
              <span className="font-bold">สรุปปัญหาหลังตรวจสอบ (Diagnosed Problem): </span>
              <span className="text-slate-700">{repair.diagnosedProblem}</span>
            </div>
          )}
          {repair.inspectionResult && (
            <div className="mt-1 pt-1 border-t border-slate-300 text-[11px]">
              <span className="font-bold">ผลการตรวจสอบ (Inspection Result): </span>
              <span className="text-slate-700">{repair.inspectionResult}</span>
            </div>
          )}
          {repair.actionDetails && (
            <div className="mt-1 pt-1 border-t border-slate-300 text-[11px]">
              <span className="font-bold">รายละเอียดการดำเนินการ (Action Details): </span>
              <span className="text-slate-700">{repair.actionDetails}</span>
            </div>
          )}
        </div>

        {/* Separator line */}
        <div className="my-8 border-b border-dashed border-slate-400"></div>

        {/* Signatures & QR Code Section */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-2">
          {/* Signatures */}
          <div className="space-y-4 flex-1 w-full text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="flex items-baseline">
                  <span>ผู้ดำเนินการ:</span>
                  <span className="flex-1 border-b border-dotted border-slate-600 pl-2 font-bold text-slate-800">
                    {repair.operatorName || '...........................................'}
                  </span>
                </p>
                <p className="flex items-baseline">
                  <span>วันที่:</span>
                  <span className="flex-1 border-b border-dotted border-slate-600 pl-2 text-slate-700">
                    {formatToThaiDate(repair.completionDate) || '...........................................'}
                  </span>
                </p>
              </div>

              <div className="space-y-1">
                <p className="flex items-baseline">
                  <span>ผู้รับ:</span>
                  <span className="flex-1 border-b border-dotted border-slate-600 pl-2 font-bold text-slate-800">
                    {repair.receiverName || '...........................................'}
                  </span>
                </p>
                <p className="flex items-baseline">
                  <span>วันที่:</span>
                  <span className="flex-1 border-b border-dotted border-slate-600 pl-2 text-slate-700">
                    {formatToThaiDate(repair.completionDate) || '...........................................'}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* QR Code Block */}
          <div
            onClick={handleOpenQrModal}
            title="คลิกเพื่ออัปโหลด/เปลี่ยนภาพ QR Code"
            className="flex items-center space-x-3 shrink-0 bg-slate-50 p-2 rounded-lg border border-slate-200 cursor-pointer hover:border-sky-400 hover:bg-sky-50/40 transition-all relative group"
          >
            <div className="bg-white p-1 rounded border border-slate-300 w-18 h-18 flex items-center justify-center overflow-hidden shrink-0">
              {qrCodeImage ? (
                <img src={qrCodeImage} alt="QR Code" className="w-16 h-16 object-contain" />
              ) : (
                <svg className="w-16 h-16 text-slate-900" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 3h6v6H3V3zm2 2v2h2V5H5zm8-2h6v6h-6V3zm2 2v2h2V5h-2zM3 13h6v6H3v-6zm2 2v2h2v-2H5zm13-2h3v2h-3v-2zm-2 2h2v2-2h-2zm2 2h3v3h-3v-3zm-2 2h2v1-2v-1zm-2-4h2v2-2h-2zm4-2h2v2h-2v-2zm-6 6h2v2h-2v-2zm2-2h2v2h-2v-2zm-6-2h2v2H7v-2zm2-2h2v2H9v-2zm2-2h2v2h-2v-2zm2 4h2v2h-2v-2z" />
                </svg>
              )}
            </div>
            <div className="text-[10px] font-bold text-slate-800 space-y-0.5 leading-tight">
              <p>{qrCodeLabel}</p>
              <p>{qrCodeSublabel}</p>
              <p className="text-slate-500 font-normal mt-1">{qrCodeNote}</p>
              <span className="inline-block text-[9px] text-sky-600 no-print underline mt-0.5 opacity-80 group-hover:opacity-100 font-normal">
                [คลิกเปลี่ยน QR Code]
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Setup Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in no-print">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden space-y-0">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <QrCode size={18} className="text-sky-400" />
                <h3 className="text-sm font-bold">ตั้งค่าภาพ QR Code ในใบรายงานซ่อม</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 text-slate-700 text-xs">
              {/* Image Preview & Upload */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-800">
                  รูปภาพ QR Code (PNG, JPG, WEBP, SVG)
                </label>
                <div className="flex items-center space-x-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="w-20 h-20 bg-white border border-slate-300 rounded-lg flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                    {tempImage ? (
                      <img src={tempImage} alt="QR Code Preview" className="w-full h-full object-contain p-1" />
                    ) : (
                      <div className="text-center p-1 text-slate-400">
                        <ImageIcon size={24} className="mx-auto text-slate-300 mb-1" />
                        <span className="text-[9px]">ไม่มีภาพ</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 flex-1">
                    <label className="inline-flex items-center space-x-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-3 py-2 rounded-lg cursor-pointer transition-all shadow-xs">
                      <Upload size={14} />
                      <span>เลือกไฟล์ภาพ QR Code</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] text-slate-500">
                      รองรับไฟล์ภาพไม่เกิน 3MB
                    </p>
                    {tempImage && (
                      <button
                        type="button"
                        onClick={() => setTempImage('')}
                        className="text-[11px] font-bold text-red-600 hover:text-red-700 underline block cursor-pointer"
                      >
                        ลบรูปภาพ (ใช้แบบมาตรฐาน)
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Text Fields */}
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    ข้อความบรรทัดที่ 1 (หัวข้อ)
                  </label>
                  <input
                    type="text"
                    value={tempLabel}
                    onChange={(e) => setTempLabel(e.target.value)}
                    placeholder="เช่น แบบฟอร์มและคู่มือ"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    ข้อความบรรทัดที่ 2 (คำอธิบาย)
                  </label>
                  <input
                    type="text"
                    value={tempSublabel}
                    onChange={(e) => setTempSublabel(e.target.value)}
                    placeholder="เช่น แจ้งซ่อมออนไลน์"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    ข้อความกำกับล่างสุด (สแกน)
                  </label>
                  <input
                    type="text"
                    value={tempNote}
                    onChange={(e) => setTempNote(e.target.value)}
                    placeholder="เช่น <--- scan me"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetQr}
                className="text-slate-600 hover:text-slate-900 font-bold text-xs flex items-center space-x-1 cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>รีเซ็ตเป็นค่าเริ่มต้น</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowQrModal(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveQrSettings}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center space-x-1 transition-all shadow-xs cursor-pointer"
                >
                  <Check size={14} />
                  <span>บันทึกการตั้งค่า</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
