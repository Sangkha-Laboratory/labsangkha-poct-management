import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  FileText, 
  CheckCircle2, 
  Phone, 
  Mail, 
  MapPin, 
  Building2, 
  UserCheck, 
  AlertCircle, 
  Printer, 
  X, 
  Eye, 
  Database, 
  Clock, 
  Scale, 
  ChevronRight,
  Sparkles,
  Award
} from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PrivacyPolicyModal({ isOpen, onClose }: PrivacyPolicyModalProps) {
  const [activeSection, setActiveSection] = useState<string>('all');

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 animate-fade-in no-print-backdrop">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col overflow-hidden text-slate-800 dark:text-slate-100"
        id="privacy-policy-modal"
      >
        {/* Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-sky-600 to-indigo-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white shrink-0 border border-white/20">
              <ShieldCheck className="h-6 w-6 sm:h-7 sm:w-7 text-sky-100" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full text-sky-100">
                  PDPA Compliance
                </span>
                <span className="text-[10px] sm:text-xs text-sky-200">
                  ฉบับปรับปรุง 2026
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white mt-0.5">
                ประกาศความเป็นส่วนตัว (Privacy Notice)
              </h2>
              <p className="text-xs text-sky-100/90 font-light hidden sm:block">
                ระบบบริหารจัดการเครื่องตรวจวัดน้ำตาลในเลือด (POCT DTX Management System) • โรงพยาบาลสังขะ
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              type="button"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer text-xs flex items-center space-x-1.5 border border-white/10"
              title="พิมพ์เอกสารประกาศ"
            >
              <Printer size={16} />
              <span className="hidden sm:inline">พิมพ์</span>
            </button>
            <button
              onClick={onClose}
              type="button"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border border-white/10"
              title="ปิดหน้าต่าง"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Quick Nav / Badges */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs overflow-x-auto gap-2 shrink-0">
          <div className="flex items-center space-x-1 text-slate-500 dark:text-slate-400 shrink-0">
            <span className="font-semibold text-slate-700 dark:text-slate-300">ผู้ควบคุมข้อมูล:</span>
            <span>กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลสังขะ</span>
          </div>
          <div className="flex items-center space-x-2 shrink-0 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>คุ้มครองตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562</span>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 md:p-8 overflow-y-auto space-y-6 text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed" id="privacy-content-scroll">
          
          {/* Section 1: Overview */}
          <div className="bg-sky-50/60 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/40 rounded-2xl p-4 sm:p-5">
            <div className="flex items-start space-x-3">
              <Building2 className="text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" size={20} />
              <div className="space-y-1.5">
                <h3 className="text-sm sm:text-base font-bold text-sky-950 dark:text-sky-200">
                  1. บทนำและเจตนารมณ์
                </h3>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-xs sm:text-sm">
                  กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลสังขะ ตระหนักและให้ความสำคัญอย่างยิ่งต่อการคุ้มครองข้อมูลส่วนบุคคลและการรักษาความมั่นคงปลอดภัยสารสนเทศของผู้ใช้งานระบบ (บุคลากรทางการแพทย์ พยาบาล เจ้าหน้าที่ประจำหอผู้ป่วย/หน่วยงาน และผู้ดูแลระบบ) 
                  ประกาศความเป็นส่วนตัวฉบับนี้จัดทำขึ้นเพื่อชี้แจงรายละเอียดเกี่ยวกับการเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคล ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) และมาตรฐานการควบคุมคุณภาพการตรวจวิเคราะห์ ณ จุดดูแลผู้ป่วย (Point-of-Care Testing: POCT)
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Data Collected */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-slate-900 dark:text-slate-100 font-bold text-sm sm:text-base">
              <Database className="text-indigo-600 dark:text-indigo-400" size={18} />
              <h3>2. ข้อมูลส่วนบุคคลที่ระบบเก็บรวบรวม</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              ระบบจัดเก็บเฉพาะข้อมูลที่จำเป็นต่อการให้บริการ บริหารจัดการเครื่องมือแพทย์ และการควบคุมคุณภาพทางห้องปฏิบัติการเท่านั้น โดยจำแนกเป็น:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-2">
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5 text-xs sm:text-sm">
                  <UserCheck size={16} className="text-sky-600 dark:text-sky-400" />
                  <span>ข้อมูลระบุตัวตนและการติดต่อของผู้ปฏิบัติงาน</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 text-xs pl-1">
                  <li>ชื่อ-นามสกุล ของผู้แจ้งซ่อม หรือผู้ขอเบิกวัสดุ</li>
                  <li>หน่วยงาน / หอผู้ป่วย (Ward) ประจำการ</li>
                  <li>หมายเลขโทรศัพท์ติดต่อภายในหรือมือถือสำหรับประสานงาน</li>
                  <li>บันทึกรายละเอียดอาการเสียหรือปัญหาการใช้งาน</li>
                </ul>
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5 text-xs sm:text-sm">
                  <Award size={16} className="text-indigo-600 dark:text-indigo-400" />
                  <span>ข้อมูลเครื่องมือและบันทึกการควบคุมคุณภาพ (QC/EQA)</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 text-xs pl-1">
                  <li>รหัสประจำเครื่อง (CODE) และ Serial Number (S/N)</li>
                  <li>ผลการทดสอบ Internal Quality Control (IQC) และ EQA</li>
                  <li>ล็อตน้ำยาและแถบตรวจ (Reagent & Strip Lot Number)</li>
                  <li>ประวัติการบำรุงรักษาและการเปลี่ยนอะไหล่/แบตเตอรี่</li>
                </ul>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 flex items-center space-x-2 text-amber-900 dark:text-amber-300 text-xs">
              <AlertCircle size={16} className="text-amber-600 shrink-0" />
              <span>
                <strong>ข้อควรทราบ:</strong> ระบบนี้ไม่มีการเก็บรวบรวมข้อมูลส่วนบุคคลอ่อนไหว (Sensitive Data) หรือประวัติเวชระเบียนของผู้ป่วยโดยเด็ดขาด การบันทึกข้อมูลจะเน้นเฉพาะประสิทธิภาพของเครื่องตรวจและอุปกรณ์เท่านั้น
              </span>
            </div>
          </div>

          {/* Section 3: Purpose of Processing */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-slate-900 dark:text-slate-100 font-bold text-sm sm:text-base">
              <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={18} />
              <h3>3. วัตถุประสงค์ในการประมวลผลข้อมูล</h3>
            </div>
            <div className="space-y-2 text-xs sm:text-sm">
              <p>ระบบดำเนินการเก็บรวบรวม ใช้ และบันทึกข้อมูลเพื่อวัตถุประสงค์ดังต่อไปนี้:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="flex items-start space-x-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <ChevronRight size={15} className="text-sky-600 shrink-0 mt-0.5" />
                  <span>เพื่อบริหารจัดการคลัง จัดสรร และตรวจนับเครื่อง DTX ประจำหน่วยงาน</span>
                </div>
                <div className="flex items-start space-x-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <ChevronRight size={15} className="text-sky-600 shrink-0 mt-0.5" />
                  <span>เพื่อรับแจ้ง ติดตามสถานะการส่งซ่อม และส่งมอบเครื่องทดแทนระหว่างซ่อม</span>
                </div>
                <div className="flex items-start space-x-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <ChevronRight size={15} className="text-sky-600 shrink-0 mt-0.5" />
                  <span>เพื่อประเมินความถูกต้องแม่นยำทางสถิติของผลตรวจตามมาตรฐาน ISO 15189 / 22870</span>
                </div>
                <div className="flex items-start space-x-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <ChevronRight size={15} className="text-sky-600 shrink-0 mt-0.5" />
                  <span>เพื่อส่งข้อความแจ้งเตือนอัตโนมัติผ่าน LINE Notify ไปยังผู้รับผิดชอบงาน</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Security & Storage */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-slate-900 dark:text-slate-100 font-bold text-sm sm:text-base">
              <Lock className="text-sky-600 dark:text-sky-400" size={18} />
              <h3>4. มาตรการรักษาความมั่นคงปลอดภัยของข้อมูล</h3>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs sm:text-sm">
              <ul className="space-y-1.5">
                <li className="flex items-start space-x-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500 mt-2 shrink-0"></span>
                  <span><strong>การเข้ารหัสข้อมูล (Data Encryption):</strong> การรับส่งข้อมูลทั้งหมดทำงานผ่านโปรโตคอลความปลอดภัย HTTPS / TLS 1.3 เพื่อป้องกันการดักจับข้อมูล</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500 mt-2 shrink-0"></span>
                  <span><strong>การควบคุมสิทธิ์ (Role-Based Access Control):</strong> การเข้าถึงข้อมูลระดับการจัดการและตั้งค่าถูกจำกัดไว้เฉพาะผู้ดูแลระบบที่ผ่านการยืนยันตัวตนด้วยรหัสผ่านความปลอดภัยสูง</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500 mt-2 shrink-0"></span>
                  <span><strong>ระบบสำรองข้อมูลและฐานข้อมูลมาตรฐาน:</strong> ใช้ระบบจัดเก็บฐานข้อมูลคลาวด์ที่มีการแยก Schema ปลอดภัยและมีระบบสำรองข้อมูลอัตโนมัติ</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500 mt-2 shrink-0"></span>
                  <span><strong>การตัดเซสชันอัตโนมัติ (Session Timeout):</strong> เพื่อความปลอดภัยสูงสุดของผู้ดูแลระบบ ระบบจะตัดสิทธิ์การใช้งานอัตโนมัติเมื่อไม่มีการเคลื่อนไหวเกินระยะเวลาที่กำหนด</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Section 5: Data Retention & Rights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center space-x-2 font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
                <Clock size={16} className="text-amber-600 dark:text-amber-400" />
                <span>5. ระยะเวลาการเก็บรักษาข้อมูล</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                ระบบจะจัดเก็บประวัติการส่งซ่อม บันทึกการควบคุมคุณภาพ และประวัติเครื่องมือแพทย์ไว้ตลอดอายุการใช้งานของเครื่อง และต่อเนื่องอีกเป็นเวลาไม่น้อยกว่า 3-5 ปี ตามเกณฑ์มาตรฐานการรับรองคุณภาพโรงพยาบาล (HA) และมาตรฐานห้องปฏิบัติการเทคนิคการแพทย์
              </p>
            </div>

            <div className="space-y-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center space-x-2 font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
                <Scale size={16} className="text-emerald-600 dark:text-emerald-400" />
                <span>6. สิทธิของเจ้าของข้อมูล (PDPA Rights)</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                ท่านมีสิทธิในการขอตรวจสอบ ขอสำเนา ขอแก้ไขข้อมูลส่วนบุคคลให้ถูกต้องเป็นปัจจุบัน หรือขอลบข้อมูลประวัติการติดต่อของท่านได้ โดยสามารถยื่นคำร้องต่อผู้ควบคุมข้อมูลส่วนบุคคลตามช่องทางติดต่อด้านล่าง
              </p>
            </div>
          </div>

          {/* Section 6: Contact Information */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800/60 dark:to-slate-800/30 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center space-x-2 font-bold text-slate-900 dark:text-slate-100 text-sm">
              <Building2 className="text-sky-600 dark:text-sky-400" size={18} />
              <span>7. ช่องทางการติดต่อผู้ควบคุมข้อมูลส่วนบุคคล</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center space-x-2">
                <Building2 size={16} className="text-slate-400 shrink-0" />
                <span>กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลสังขะ</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone size={16} className="text-slate-400 shrink-0" />
                <span>044-571-028 ต่อ 115</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail size={16} className="text-slate-400 shrink-0" />
                <span>labsangkha@outlook.com</span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
            <Sparkles size={13} className="text-sky-500" />
            <span>ประกาศนี้มีผลบังคับใช้ตั้งแต่วันที่ 1 มกราคม 2569 เป็นต้นไป</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
          >
            รับทราบและปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
