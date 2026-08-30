/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MasterWard {
  id?: string;
  thai_name: string;
  en_name?: string;
}

export interface MachineLocationLog {
  id: string;
  date: string; // YYYY-MM-DD or YYYY-MM-DD HH:mm
  fromWard?: string;
  toWard: string;
  actionType: 'transfer' | 'return_to_lab' | 'initial_deploy' | 'backup_loan' | 'edit';
  reason?: string;
  operator?: string;
}

export interface DtxMachine {
  id: string;
  serialNumber: string; // This acts as the CODE (e.g. BGM-000)
  machineSerial: string; // This is the actual manufacturer Serial Number (e.g. 103A2002FB7)
  brand: string;
  model: string;
  ward: string;
  status: 'active' | 'lost' | 'unknown' | 'claimed' | 'waiting_claim' | 'inactive';
  receiveDate: string; // Mfg Date / Receive Date
  lastQCDate?: string;
  lotNumber: string; // LOT of the machine
  remark?: string;
  locationHistory?: MachineLocationLog[];
}

export interface RepairChecklist {
  cleanliness: 'pass' | 'fail' | 'pending';
  buttons: 'pass' | 'fail' | 'pending';
  stripSlot: 'pass' | 'fail' | 'pending';
  batterySlot: 'pass' | 'fail' | 'pending';
  battery: 'pass' | 'fail' | 'pending';
  screen: 'pass' | 'fail' | 'pending';
  measurement: 'pass' | 'fail' | 'pending';
  iqc: 'pass' | 'fail' | 'pending';
  intercomparison: 'pass' | 'fail' | 'pending';
  others: string;
}

export interface RepairRequest {
  id: string;
  serialNumber: string;
  machineSerial?: string;
  ward: string;
  reporterName: string;
  reporterPhone: string;
  reportedProblem: string; // ปัญหาตามแจ้ง
  requestDate: string;
  status: 'pending' | 'repairing' | 'waiting_claim' | 'claimed' | 'completed';
  diagnosedProblem?: string; // ปัญหาที่พบหลังตรวจสอบ
  inspectionResult?: string; // ผลการตรวจสอบ
  actionTaken?: 'change_battery' | 'return_original' | 'provide_new' | 'none'; // การดำเนินการ
  actionDetails?: string; // รายละเอียดการดำเนินการ
  operatorName?: string;
  receiverName?: string;
  completionDate?: string;
  checklist: RepairChecklist;
  needsBackup?: boolean; // ต้องการขอเบิกเครื่องสำรองใช้ชั่วคราว
}

export interface SupplyRequest {
  id: string;
  ward: string;
  requesterName: string;
  itemType: 'machine' | 'strip' | 'lancet' | 'control_solution' | 'battery';
  quantity: number;
  reason: string;
  requestDate: string; // วันที่ทำรายการเบิก
  issueDate?: string; // วันที่เบิกใช้งานจริง
  status: 'pending' | 'approved' | 'rejected';
  details?: {
    barcode?: string;
    lotNumber?: string;
    expiryDate?: string;
    testsPerBox?: number;
    postOpenDays?: number;
    receivedDate?: string;
    level1Min?: string;
    level1Max?: string;
    level2Min?: string;
    level2Max?: string;
    level3Min?: string;
    level3Max?: string;
    openStabilityDays?: string;
  };
}

export interface QcRecord {
  id: string;
  date: string;
  receiveDate: string; // รับเครื่องมาวันไหน
  returnDate: string;  // ส่งคืนวันไหน
  ward: string;
  serialNumber: string;
  operator: string;
  lotNumber: string;
  level1: number;
  level2: number;
  level3: number;
  level1Status: 'normal' | 'out_of_control';
  level2Status: 'normal' | 'out_of_control';
  level3Status: 'normal' | 'out_of_control';
}

export interface QcLotConfig {
  lotNumber: string;
  barcode?: string; // บาร์โค้ดกล่อง (Box Barcode)
  testsPerBox?: number; // จำนวน Test ต่อกล่อง (default 50)
  receivedDate?: string; // วันที่รับเข้าคลัง (YYYY-MM-DD)
  expDate?: string; // วันหมดอายุตามฉลาก (YYYY-MM-DD)
  openDate?: string; // วันที่เปิดขวดใช้งาน (YYYY-MM-DD)
  openExpDays?: number; // อายุการใช้งานหลังเปิดขวด (วัน เช่น 90 วัน)
  manufacturer?: string; // บริษัท/ผู้ผลิต
  notes?: string;
  level1Target: number;
  level1Min: number;
  level1Max: number;
  level1SD: number;
  level2Target: number;
  level2Min: number;
  level2Max: number;
  level2SD: number;
  level3Target: number;
  level3Min: number;
  level3Max: number;
  level3SD: number;
}

export interface StripReagentItem {
  id: string;
  itemCode: string; // เช่น 'ST-LOT2026A-01' (Unique Code รายกล่อง)
  lotNumber: string;
  manufacturer?: string;
  itemType: 'strip' | 'control_solution';
  receivedDate: string;
  expDate: string;
  openDate?: string;
  openExpDate?: string;
  status: 'in_stock' | 'in_use' | 'depleted';
  openedBy?: string;
  notes?: string;
  boxIndex?: number;
  totalBoxes?: number;
}

export interface EqaAttachment {
  name: string;
  type: 'image' | 'pdf' | 'other';
  dataUrl?: string; // Base64 or Object URL for immediate web preview
}

export interface EqaRecord {
  id: string;
  organizer?: string; // หน่วยงานที่จัดโครงการ (เช่น ศูนย์ประเมินคุณภาพฯ รามาธิบดี, สภาเทคนิคการแพทย์)
  round: string; // รอบการประเมิน (เช่น รอบที่ 1/2569)
  actionStatus?: 'pending' | 'in_progress' | 'submitted' | 'completed'; // สถานะการดำเนินการ
  actionDate?: string; // วันที่ดำเนินการ
  testDate: string; // วันที่ส่งตรวจวิเคราะห์/ทดสอบ
  level1Value?: number;
  level1Target?: number;
  level2Value?: number;
  level2Target?: number;
  level3Value?: number;
  level3Target?: number;
  score?: number;
  status?: 'excellent' | 'pass' | 'warning' | 'fail' | 'pending';
  feedback?: string;
  documentUrl?: string; // ลิงก์เอกสารบน OneDrive / Cloud Storage
  attachmentFile?: EqaAttachment; // ไฟล์แนบสำหรับพรีวิวบนหน้าเว็บ (รูปภาพ/PDF)
  machineCount?: number; // จำนวนเครื่องที่ทำการประเมิน EQA
  testedSerials?: string[]; // รายการ Serial Number ของเครื่องที่ทำการประเมิน EQA
  testedMachines?: { 
    serialNumber: string; 
    ward: string;
    level1Value?: number;
    level1Target?: number;
    level2Value?: number;
    level2Target?: number;
    level3Value?: number;
    level3Target?: number;
  }[]; // รายการ Serial Number, Ward และผล 3 ระดับของเครื่องที่ทำการทดสอบ EQA
  dueDate?: string; // วันที่กำหนดส่งผล EQA (Submission Deadline)
  notifiedLineAt?: string; // วันเวลาที่กดส่ง LINE แจ้งเตือนเตือนความจำล่าสุด
}

export interface UserManual {
  id: string;
  title: string;
  category: 'guide' | 'video' | 'form';
  description: string;
  downloadUrl?: string;
  fileName?: string;
  fileData?: string;
  uploadDate?: string;
  isDeleted?: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: 'news' | 'alert' | 'event';
  date: string;
  author: string;
  attachmentName?: string;
  attachmentUrl?: string;
  pinned?: boolean;
  isDeleted?: boolean;
}

export interface TroubleshootingStep {
  id: string;
  title?: string;
  problem?: string;
  description?: string;
  tip?: string;
  iconName?: string;
  solution?: string;
  symptoms?: string[];
}

export interface DtxErrorCode {
  code: string;
  meaning: string;
  solution: string;
  severity: 'warning' | 'error' | 'critical';
}

export interface DailyChecklist {
  id: string;
  date: string;
  serialNumber: string;
  ward: string;
  chkBodyClean: boolean;      // 1.1. วัสดุตัวเครื่องและความสะอาด
  chkPowerButton: boolean;    // 1.2. ปุ่มเปิด/ปิด
  chkStripSlot: boolean;      // 1.3. ช่องเสียบ Strip
  chkBatterySlot: boolean;    // 1.4. ช่องใส่ถ่าน
  chkBattery: boolean;        // 2. ถ่าน
  chkScreenDisplay: boolean;  // 3. การแสดงผลหน้าจอ
  chkMeasurement: boolean;    // 4. การตรวจวัดค่าและแสดงผลการตรวจวัด
  chkIqcPassed: boolean;      // 5. การควบคุมภาพภายใน (IQC) ผ่านเกณฑ์
  status: 'normal' | 'issue';
  note: string;
  operator: string;
  createdAt?: string;
}

export interface MaintenanceLog {
  id: string;
  date: string;
  serialNumber: string;
  ward?: string;
  actionType: 'battery_change' | 'cleaning' | 'calibration' | 'repair';
  description: string;
  operator: string;
  createdAt?: string;
}
