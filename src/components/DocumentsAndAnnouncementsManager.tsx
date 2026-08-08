import React, { useState } from 'react';
import CustomSelect from "./CustomSelect";
import { UserManual, Announcement } from '../types';
import { dbService } from '../lib/supabase';
import { FileText, Plus, Trash2, Link as LinkIcon, Megaphone, Bell, Calendar, User, CheckCircle, AlertCircle, FileCheck, Download, ExternalLink, AlertTriangle, QrCode, Upload, Image as ImageIcon, RotateCcw, Check } from 'lucide-react';

interface DocumentsAndAnnouncementsManagerProps {
  manuals: UserManual[];
  setManuals: React.Dispatch<React.SetStateAction<UserManual[]>>;
  announcements: Announcement[];
  setAnnouncements: React.Dispatch<React.SetStateAction<Announcement[]>>;
  showToast: (msg: string) => void;
}

export default function DocumentsAndAnnouncementsManager({
  manuals,
  setManuals,
  announcements,
  setAnnouncements,
  showToast
}: DocumentsAndAnnouncementsManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'manuals' | 'announcements' | 'print_qr'>('manuals');

  // Print QR Code State
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

  // Manual Form State
  const [manualTitle, setManualTitle] = useState('');
  const [manualCategory, setManualCategory] = useState<'guide' | 'video' | 'form'>('guide');
  const [manualDescription, setManualDescription] = useState('');
  const [manualFileName, setManualFileName] = useState('');
  const [manualDownloadUrl, setManualDownloadUrl] = useState('');

  // Announcement Form State
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annCategory, setAnnCategory] = useState<'news' | 'alert' | 'event'>('news');
  const [annAuthor, setAnnAuthor] = useState('กลุ่มงานเทคนิคการแพทย์ รพ.สังขะ');
  const [annPinned, setAnnPinned] = useState(false);
  const [annAttachmentName, setAnnAttachmentName] = useState('');
  const [annAttachmentUrl, setAnnAttachmentUrl] = useState('');

  // Delete Confirmation State (Custom Modal instead of window.confirm)
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'manual' | 'announcement';
    id: string;
    title: string;
  } | null>(null);

  // QR Code Image Upload Handler
  const handleQrImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      showToast('ไฟล์ภาพมีขนาดใหญ่เกินไป (กรุณาใช้ไฟล์ขนาดไม่เกิน 3MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setQrCodeImage(base64);
    };
    reader.readAsDataURL(file);
  };

  // Save QR Settings
  const handleSaveQrSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (qrCodeImage) {
      localStorage.setItem('dtx_print_qr_code', qrCodeImage);
    } else {
      localStorage.removeItem('dtx_print_qr_code');
    }
    localStorage.setItem('dtx_print_qr_label', qrCodeLabel);
    localStorage.setItem('dtx_print_qr_sublabel', qrCodeSublabel);
    localStorage.setItem('dtx_print_qr_note', qrCodeNote);
    showToast('บันทึกการตั้งค่า QR Code ในใบรายงานซ่อมเรียบร้อยแล้ว');
  };

  // Reset QR Settings
  const handleResetQrSettings = () => {
    setQrCodeImage('');
    setQrCodeLabel('แบบฟอร์มและคู่มือ');
    setQrCodeSublabel('แจ้งซ่อมออนไลน์');
    setQrCodeNote('<--- scan me');
    localStorage.removeItem('dtx_print_qr_code');
    localStorage.setItem('dtx_print_qr_label', 'แบบฟอร์มและคู่มือ');
    localStorage.setItem('dtx_print_qr_sublabel', 'แจ้งซ่อมออนไลน์');
    localStorage.setItem('dtx_print_qr_note', '<--- scan me');
    showToast('รีเซ็ตการตั้งค่า QR Code เป็นค่าเริ่มต้นแล้ว');
  };

  // Add Manual
  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim()) {
      showToast('กรุณากรอกชื่อเอกสารคู่มือ');
      return;
    }

    const newManual: UserManual = {
      id: `manual-${Date.now()}`,
      title: manualTitle.trim(),
      category: manualCategory,
      description: manualDescription.trim() || 'เอกสารคู่มือสำหรับเจ้าหน้าที่โรงพยาบาล',
      fileName: manualFileName.trim() || (manualDownloadUrl ? 'ลิงก์เอกสารออนไลน์' : undefined),
      downloadUrl: manualDownloadUrl.trim() || undefined,
      uploadDate: new Date().toISOString().split('T')[0]
    };

    const updated = [newManual, ...manuals];
    setManuals(updated);
    localStorage.setItem('dtx_manuals', JSON.stringify(updated));

    try {
      await dbService.insertManual(newManual);
    } catch (err) {
      console.warn('Backend sync warning:', err);
    }

    // Reset Form
    setManualTitle('');
    setManualDescription('');
    setManualFileName('');
    setManualDownloadUrl('');
    showToast('เพิ่มเอกสารคู่มือสำเร็จ');
  };

  // Add Announcement
  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) {
      showToast('กรุณากรอกหัวข้อและเนื้อหาประกาศ');
      return;
    }

    const newAnn: Announcement = {
      id: `ann-${Date.now()}`,
      title: annTitle.trim(),
      content: annContent.trim(),
      category: annCategory,
      date: new Date().toISOString().split('T')[0],
      author: annAuthor.trim() || 'กลุ่มงานเทคนิคการแพทย์',
      pinned: annPinned,
      attachmentName: annAttachmentName.trim() || (annAttachmentUrl ? 'ลิงก์เอกสารแนบ' : undefined),
      attachmentUrl: annAttachmentUrl.trim() || undefined
    };

    const updated = [newAnn, ...announcements];
    setAnnouncements(updated);
    localStorage.setItem('dtx_announcements', JSON.stringify(updated));

    try {
      await dbService.insertAnnouncement(newAnn);
    } catch (err) {
      console.warn('Backend sync warning:', err);
    }

    // Reset Form
    setAnnTitle('');
    setAnnContent('');
    setAnnPinned(false);
    setAnnAttachmentName('');
    setAnnAttachmentUrl('');
    showToast('เผยแพร่ข่าวประชาสัมพันธ์สำเร็จ');
  };

  // Visible active items (Soft Delete support)
  const visibleManuals = manuals.filter(m => !m.isDeleted);
  const visibleAnnouncements = announcements.filter(a => !a.isDeleted);

  // Perform Delete after Modal Confirmation
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'manual') {
      const updated = manuals.filter(m => m.id !== deleteTarget.id);
      setManuals(updated);
      localStorage.setItem('dtx_manuals', JSON.stringify(updated));

      try {
        let deletedManualIds: string[] = [];
        try {
          deletedManualIds = JSON.parse(localStorage.getItem('dtx_deleted_manual_ids') || '[]');
        } catch (e) {}
        if (!deletedManualIds.includes(deleteTarget.id)) {
          deletedManualIds.push(deleteTarget.id);
          localStorage.setItem('dtx_deleted_manual_ids', JSON.stringify(deletedManualIds));
        }
      } catch (e) {}

      try {
        await dbService.deleteManual(deleteTarget.id);
      } catch (err) {
        console.warn('Backend delete warning:', err);
      }
      showToast('ลบเอกสารคู่มือเรียบร้อยแล้ว');
    } else {
      const updated = announcements.filter(a => a.id !== deleteTarget.id);
      setAnnouncements(updated);
      localStorage.setItem('dtx_announcements', JSON.stringify(updated));

      try {
        let deletedAnnIds: string[] = [];
        try {
          deletedAnnIds = JSON.parse(localStorage.getItem('dtx_deleted_ann_ids') || '[]');
        } catch (e) {}
        if (!deletedAnnIds.includes(deleteTarget.id)) {
          deletedAnnIds.push(deleteTarget.id);
          localStorage.setItem('dtx_deleted_ann_ids', JSON.stringify(deletedAnnIds));
        }
      } catch (e) {}

      try {
        await dbService.deleteAnnouncement(deleteTarget.id);
      } catch (err) {
        console.warn('Backend delete warning:', err);
      }
      showToast('ลบข่าวประชาสัมพันธ์เรียบร้อยแล้ว');
    }

    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
            <LinkIcon className="text-sky-600" size={22} />
            <span>จัดการเอกสารคู่มือ และข่าวประชาสัมพันธ์ (Admin Link)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            เพิ่มลิงก์เอกสารคู่มือ (Google Drive, OneDrive, URL ฯลฯ) และประกาศข่าวสารสำคัญเพื่อให้บุคลากรในโรงพยาบาลเข้าถึง
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('manuals')}
            className={`px-3.5 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer ${activeSubTab === 'manuals' ? 'bg-white text-sky-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            เอกสารคู่มือ ({visibleManuals.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('announcements')}
            className={`px-3.5 py-2 rounded-lg transition-all whitespace-nowrap cursor-pointer ${activeSubTab === 'announcements' ? 'bg-white text-sky-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            ข่าวประชาสัมพันธ์ ({visibleAnnouncements.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('print_qr')}
            className={`px-3.5 py-2 rounded-lg transition-all whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${activeSubTab === 'print_qr' ? 'bg-white text-sky-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <QrCode size={14} />
            <span>ภาพ QR Code ในใบซ่อม</span>
          </button>
        </div>
      </div>

      {/* Sub-Tab 1: Manuals Manager */}
      {activeSubTab === 'manuals' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 lg:col-span-1">
            <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Plus size={16} className="text-sky-600" />
              <span>เพิ่มลิงก์คู่มือ / เอกสารใหม่</span>
            </h3>

            <form onSubmit={handleAddManual} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">ชื่อเอกสาร / หัวข้อคู่มือ *</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น คู่มือการใช้งานเครื่อง VivaChek Fad v2"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">หมวดหมู่</label>
                <CustomSelect
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value as any)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white font-medium"
                >
                  <option value="guide">เอกสารคู่มือ PDF / แนวปฏิบัติ</option>
                  <option value="video">วิดีโอสาธิตการใช้งาน</option>
                  <option value="form">แบบฟอร์มบันทึก / ใบขอเบิก</option>
                </CustomSelect>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">รายละเอียดสังเขป</label>
                <textarea
                  rows={3}
                  placeholder="อธิบายสั้น ๆ เกี่ยวกับเอกสารฉบับนี้..."
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ลิงก์ URL เอกสาร (เช่น Google Drive, PDF Link)</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/file/d/..."
                  value={manualDownloadUrl}
                  onChange={(e) => setManualDownloadUrl(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ชื่อปุ่มหรือชื่อไฟล์แสดงผล (ไม่บังคับ)</label>
                <input
                  type="text"
                  placeholder="เช่น ดาวน์โหลดคู่มือ PDF (รพ.สังขะ)"
                  value={manualFileName}
                  onChange={(e) => setManualFileName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2"
              >
                <Plus size={16} />
                <span>บันทึกเพิ่มคู่มือ</span>
              </button>
            </form>
          </div>

          {/* Manuals List */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 lg:col-span-2">
            <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2 border-b border-slate-100 pb-3">
              <FileText size={16} className="text-sky-600" />
              <span>รายการเอกสารคู่มือทั้งหมด ({visibleManuals.length})</span>
            </h3>

            {visibleManuals.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                ยังไม่มีเอกสารคู่มือในระบบ กรุณาเพิ่มลิงก์ทางด้านซ้าย
              </div>
            ) : (
              <div className="space-y-3">
                {visibleManuals.map((manual) => (
                  <div key={manual.id} className="border border-slate-100 p-4 rounded-xl hover:border-sky-200 transition-all flex items-start justify-between gap-4 bg-white shadow-2xs">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-sky-50 text-sky-700">
                          {manual.category === 'guide' ? 'เอกสาร PDF' : manual.category === 'video' ? 'วิดีโอ' : 'แบบฟอร์ม'}
                        </span>
                        {manual.uploadDate && (
                          <span className="text-[10px] text-slate-400 flex items-center space-x-1">
                            <Calendar size={11} />
                            <span>{manual.uploadDate}</span>
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-800">{manual.title}</h4>
                      <p className="text-[11px] text-slate-500">{manual.description}</p>
                      
                      {manual.downloadUrl && (
                        <div className="pt-1">
                          <a
                            href={manual.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-sky-600 hover:underline inline-flex items-center space-x-1 bg-sky-50 px-2.5 py-1 rounded-lg"
                          >
                            <ExternalLink size={12} />
                            <span>{manual.fileName || 'เปิดลิงก์เอกสารออนไลน์'}</span>
                          </a>
                        </div>
                      )}
                      {manual.fileData && (
                        <div className="pt-1">
                          <a
                            href={manual.fileData}
                            download={manual.fileName || 'document.pdf'}
                            className="text-[11px] font-bold text-emerald-700 hover:underline inline-flex items-center space-x-1 bg-emerald-50 px-2.5 py-1 rounded-lg"
                          >
                            <Download size={12} />
                            <span>ดาวน์โหลดไฟล์แนบ ({manual.fileName || 'ไฟล์'})</span>
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ type: 'manual', id: manual.id, title: manual.title })}
                        className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-all cursor-pointer"
                        title="ลบเอกสาร"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Announcements Manager */}
      {activeSubTab === 'announcements' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Announcement Form */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 lg:col-span-1">
            <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Megaphone size={16} className="text-sky-600" />
              <span>สร้างข่าวประชาสัมพันธ์ใหม่</span>
            </h3>

            <form onSubmit={handleAddAnnouncement} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">หัวข้อประกาศ *</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ประกาศกำหนดการตรวจเช็คเครื่อง POCT"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">หมวดหมู่ประกาศ</label>
                <CustomSelect
                  value={annCategory}
                  onChange={(e) => setAnnCategory(e.target.value as any)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white font-medium"
                >
                  <option value="news">ข่าวสารทั่วไป</option>
                  <option value="alert">ประกาศด่วน / แจ้งเตือน</option>
                  <option value="event">กิจกรรม / ออบรม</option>
                </CustomSelect>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">เนื้อหาประกาศ *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="รายละเอียดเนื้อหาประกาศ..."
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">หน่วยงาน / ผู้ประกาศ</label>
                <input
                  type="text"
                  value={annAuthor}
                  onChange={(e) => setAnnAuthor(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="pin-ann"
                  checked={annPinned}
                  onChange={(e) => setAnnPinned(e.target.checked)}
                  className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                />
                <label htmlFor="pin-ann" className="font-bold text-slate-700 cursor-pointer">
                  ปักหมุดประกาศนี้ไว้ด้านบนสุด
                </label>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ลิงก์ URL แนบประกาศ (ไม่บังคับ)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={annAttachmentUrl}
                  onChange={(e) => setAnnAttachmentUrl(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ชื่อปุ่มลิงก์แนบ (ไม่บังคับ)</label>
                <input
                  type="text"
                  placeholder="เช่น เอกสารแนบประกาศ (PDF)"
                  value={annAttachmentName}
                  onChange={(e) => setAnnAttachmentName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-500 bg-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2"
              >
                <Megaphone size={16} />
                <span>เผยแพร่ประกาศ</span>
              </button>
            </form>
          </div>

          {/* Announcements List */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 lg:col-span-2">
            <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Bell size={16} className="text-sky-600" />
              <span>รายการข่าวประชาสัมพันธ์ทั้งหมด ({visibleAnnouncements.length})</span>
            </h3>

            {visibleAnnouncements.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                ยังไม่มีข่าวประชาสัมพันธ์ในระบบ
              </div>
            ) : (
              <div className="space-y-3">
                {visibleAnnouncements.map((ann) => (
                  <div key={ann.id} className={`border p-4.5 rounded-xl space-y-2 bg-white shadow-2xs ${ann.pinned ? 'border-sky-300 bg-sky-50/15' : 'border-slate-100'}`}>
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${ann.category === 'alert' ? 'bg-rose-50 text-rose-700' : ann.category === 'event' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}`}>
                        {ann.category === 'alert' ? 'ประกาศด่วน' : ann.category === 'event' ? 'กิจกรรม' : 'ข่าวสาร'}
                      </span>
                      {ann.pinned && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-white">
                          ปักหมุด
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 flex items-center space-x-1">
                        <Calendar size={11} />
                        <span>{ann.date}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center space-x-1">
                        <User size={11} />
                        <span>{ann.author}</span>
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">{ann.title}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{ann.content}</p>
                    
                    {ann.attachmentUrl && (
                      <div className="pt-2">
                        <a
                          href={ann.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-sky-600 hover:underline inline-flex items-center space-x-1 bg-sky-50 px-3 py-1.5 rounded-lg"
                        >
                          <ExternalLink size={13} />
                          <span>{ann.attachmentName || 'เปิดลิงก์เอกสารแนบ'}</span>
                        </a>
                      </div>
                    )}

                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ type: 'announcement', id: ann.id, title: ann.title })}
                        className="px-2.5 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-[10px] font-bold transition-all flex items-center space-x-1 cursor-pointer"
                      >
                        <Trash2 size={12} />
                        <span>ลบประกาศ</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Print QR Code Manager */}
      {activeSubTab === 'print_qr' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-bold text-slate-800 text-base flex items-center space-x-2">
              <QrCode size={20} className="text-sky-600" />
              <span>ตั้งค่ารูปภาพ QR Code สำหรับใบรายงานการซ่อมบำรุงที่พิมพ์ออกกระดาษ</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              อัปโหลดรูปภาพ QR Code (เช่น QR Code ลิงก์แจ้งซ่อมออนไลน์, ลิงก์คู่มือ, หรือ QR Code ประจำหน่วยงาน) เพื่อให้แสดงผลมุมขวาล่างของใบรายงานซ่อมเมื่อกดพิมพ์
            </p>
          </div>

          <form onSubmit={handleSaveQrSettings} className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column: Form Controls */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  เลือกไฟล์ภาพ QR Code
                </label>
                <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label className="inline-flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer transition-all shadow-xs">
                    <Upload size={15} />
                    <span>อัปโหลดภาพ QR Code</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleQrImageUpload}
                      className="hidden"
                    />
                  </label>
                  {qrCodeImage && (
                    <button
                      type="button"
                      onClick={() => setQrCodeImage('')}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
                    >
                      ลบรูปภาพ
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  รองรับไฟล์ PNG, JPG, WEBP, SVG ขนาดไม่เกิน 3MB
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ข้อความบรรทัดที่ 1 (หัวข้อ)
                </label>
                <input
                  type="text"
                  value={qrCodeLabel}
                  onChange={(e) => setQrCodeLabel(e.target.value)}
                  placeholder="เช่น แบบฟอร์มและคู่มือ"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ข้อความบรรทัดที่ 2 (คำอธิบาย)
                </label>
                <input
                  type="text"
                  value={qrCodeSublabel}
                  onChange={(e) => setQrCodeSublabel(e.target.value)}
                  placeholder="เช่น แจ้งซ่อมออนไลน์"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ข้อความกำกับล่างสุด (คำบอกสแกน)
                </label>
                <input
                  type="text"
                  value={qrCodeNote}
                  onChange={(e) => setQrCodeNote(e.target.value)}
                  placeholder="เช่น <--- scan me"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <Check size={16} />
                  <span>บันทึกการตั้งค่า QR Code</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetQrSettings}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <RotateCcw size={14} />
                  <span>รีเซ็ตเป็นค่าเริ่มต้น</span>
                </button>
              </div>
            </div>

            {/* Right Column: Live Print Preview */}
            <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <ImageIcon size={16} className="text-sky-600" />
                <span>ตัวอย่างการแสดงผลบนใบรายงานซ่อม (Live Preview)</span>
              </h4>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 font-sans">
                <div className="border-b border-dashed border-slate-200 pb-3 text-[11px] text-slate-400 italic">
                  ... (ส่วนเนื้อหารายงานซ่อมบำรุง) ...
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-[10px] text-slate-400 space-y-1">
                    <p>ผู้ดำเนินการ: ...........................</p>
                    <p>วันที่: .......................................</p>
                  </div>

                  {/* QR Code Preview Block */}
                  <div className="flex items-center space-x-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200 shrink-0">
                    <div className="bg-white p-1 rounded border border-slate-300 w-18 h-18 flex items-center justify-center overflow-hidden">
                      {qrCodeImage ? (
                        <img src={qrCodeImage} alt="QR Code" className="w-16 h-16 object-contain" />
                      ) : (
                        <svg className="w-16 h-16 text-slate-900" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M3 3h6v6H3V3zm2 2v2h2V5H5zm8-2h6v6h-6V3zm2 2v2h2V5h-2zM3 13h6v6H3v-6zm2 2v2h2v-2H5zm13-2h3v2h-3v-2zm-2 2h2v2-2h-2zm2 2h3v3h-3v-3zm-2 2h2v1-2v-1zm-2-4h2v2-2h-2zm4-2h2v2h-2v-2zm-6 6h2v2h-2v-2zm2-2h2v2h-2v-2zm-6-2h2v2H7v-2zm2-2h2v2H9v-2zm2-2h2v2h-2v-2zm2 4h2v2h-2v-2z" />
                        </svg>
                      )}
                    </div>
                    <div className="text-[10px] font-bold text-slate-800 space-y-0.5 leading-tight">
                      <p>{qrCodeLabel || 'แบบฟอร์มและคู่มือ'}</p>
                      <p>{qrCodeSublabel || 'แจ้งซ่อมออนไลน์'}</p>
                      <p className="text-slate-500 font-normal mt-1">{qrCodeNote || '<--- scan me'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 bg-sky-50/70 p-3 rounded-xl border border-sky-100 flex items-start space-x-2">
                <CheckCircle size={16} className="text-sky-600 shrink-0 mt-0.5" />
                <span>
                  รูปภาพและข้อความนี้จะถูกบันทึกและแสดงผลโดยอัตโนมัติทุกครั้งที่เจ้าหน้าที่กดพิมพ์ใบรายงานซ่อมในระบบ
                </span>
              </div>
            </div>
          </form>
        </div>
      )}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">ยืนยันการลบรายการ</h4>
                <p className="text-[11px] text-slate-500">การดำเนินการนี้จะไม่สามารถย้อนกลับได้</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
              <span className="text-slate-500 block mb-0.5 font-medium">
                {deleteTarget.type === 'manual' ? 'เอกสารคู่มือที่จะลบ:' : 'ข่าวประชาสัมพันธ์ที่จะลบ:'}
              </span>
              <span className="font-bold text-slate-800 block truncate">{deleteTarget.title}</span>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 text-white hover:bg-rose-700 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
              >
                <Trash2 size={14} />
                <span>ยืนยันการลบ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
