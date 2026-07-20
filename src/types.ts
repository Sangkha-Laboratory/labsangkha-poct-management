/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  actionTaken?: 'change_battery' | 'return_original' | 'provide_new' | 'none'; // การดำเนินการ
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
  requestDate: string;
  status: 'pending' | 'approved' | 'rejected';
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

export interface EqaRecord {
  id: string;
  round: string;
  testDate: string;
  level1Value: number;
  level1Target: number;
  level2Value: number;
  level2Target: number;
  level3Value: number;
  level3Target: number;
  score: number;
  status: 'excellent' | 'pass' | 'warning' | 'fail';
  feedback: string;
}

export interface UserManual {
  id: string;
  title: string;
  category: 'guide' | 'video' | 'form';
  description: string;
  downloadUrl?: string;
}

export interface TroubleshootingStep {
  id: string;
  problem: string;
  solution: string;
  symptoms: string[];
}
