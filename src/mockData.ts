/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DtxMachine, RepairRequest, SupplyRequest, QcRecord, QcLotConfig, EqaRecord, UserManual, TroubleshootingStep } from './types';

export const INITIAL_WARDS = [
  'LAB',
  'SX',
  'PED',
  'OPD1',
  'OPD2',
  'LR',
  'COHORT',
  'ER',
  'MED-F',
  'ICU',
  'MED-M',
  'NCD',
  'OR',
  'VIP6',
  'GYN'
];

export const INITIAL_MACHINES: DtxMachine[] = [
  { id: 'm0', serialNumber: 'BGM-000', machineSerial: '103A2002FB7', brand: 'VivaChek', model: 'Fad', ward: 'LAB', status: 'active', receiveDate: '2025-03-11', lotNumber: '235080', remark: '' },
  { id: 'm2', serialNumber: 'BGM-002', machineSerial: '311A0012BBD', brand: 'VivaChek', model: 'Fad', ward: 'SX', status: 'active', receiveDate: '2025-01-16', lotNumber: '235080', remark: '' },
  { id: 'm3', serialNumber: 'BGM-003', machineSerial: '311A0012BBB', brand: 'VivaChek', model: 'Fad', ward: 'PED', status: 'active', receiveDate: '2025-01-16', lotNumber: '235080', remark: '' },
  { id: 'm4', serialNumber: 'BGM-004', machineSerial: '311A0012721', brand: 'VivaChek', model: 'Fad', ward: 'PED', status: 'active', receiveDate: '2025-01-16', lotNumber: '235080', remark: '' },
  { id: 'm5', serialNumber: 'BGM-005', machineSerial: '311A001271D', brand: 'VivaChek', model: 'Fad', ward: 'OPD2', status: 'active', receiveDate: '2025-06-06', lotNumber: '235080', remark: '' },
  { id: 'm6', serialNumber: 'BGM-006', machineSerial: '311A0012859', brand: 'VivaChek', model: 'Fad', ward: 'LR', status: 'active', receiveDate: '2025-01-16', lotNumber: '235080', remark: '' },
  { id: 'm7', serialNumber: 'BGM-007', machineSerial: '311A0012858', brand: 'VivaChek', model: 'Fad', ward: 'LR', status: 'active', receiveDate: '2025-01-16', lotNumber: '235080', remark: '' },
  { id: 'm9', serialNumber: 'BGM-009', machineSerial: '311A001285F', brand: 'VivaChek', model: 'Fad', ward: 'COHORT', status: 'active', receiveDate: '2025-03-14', lotNumber: '235080', remark: '' },
  { id: 'm10', serialNumber: 'BGM-010', machineSerial: '311A00126A0', brand: 'VivaChek', model: 'Fad', ward: 'OPD1', status: 'active', receiveDate: '2025-03-12', lotNumber: '235080', remark: '' },
  { id: 'm15', serialNumber: 'BGM-015', machineSerial: '311A00126BF', brand: 'VivaChek', model: 'Fad', ward: 'ER', status: 'inactive', receiveDate: '2025-05-23', lotNumber: '235080', remark: 'เรียกเก็บคืนแล้ว' },
  { id: 'm22', serialNumber: 'BGM-022', machineSerial: '311A0012BBE', brand: 'VivaChek', model: 'Fad', ward: 'OPD1', status: 'active', receiveDate: '2025-03-12', lotNumber: '235080', remark: '' },
  { id: 'm24', serialNumber: 'BGM-024', machineSerial: '311A0012722', brand: 'VivaChek', model: 'Fad', ward: 'MED-F', status: 'active', receiveDate: '2025-01-31', lotNumber: '235080', remark: '' },
  { id: 'm25', serialNumber: 'BGM-025', machineSerial: '311A00126E6', brand: 'VivaChek', model: 'Fad', ward: 'MED-F', status: 'active', receiveDate: '2025-01-31', lotNumber: '235080', remark: '' },
  { id: 'm27', serialNumber: 'BGM-027', machineSerial: '311A0012705', brand: 'VivaChek', model: 'Fad', ward: 'ICU', status: 'active', receiveDate: '2025-03-11', lotNumber: '235080', remark: '' },
  { id: 'm29', serialNumber: 'BGM-029', machineSerial: '311A001272A', brand: 'VivaChek', model: 'Fad', ward: 'ICU', status: 'inactive', receiveDate: '2025-07-08', lotNumber: '235080', remark: '' },
  { id: 'm36', serialNumber: 'BGM-036', machineSerial: '311A00126B0', brand: 'VivaChek', model: 'Fad', ward: 'MED-M', status: 'inactive', receiveDate: '2025-07-19', lotNumber: '235080', remark: '' },
  { id: 'm38', serialNumber: 'BGM-038', machineSerial: '311A0012BDA', brand: 'VivaChek', model: 'Fad', ward: 'NCD', status: 'active', receiveDate: '2025-03-12', lotNumber: '235080', remark: '' },
  { id: 'm40', serialNumber: 'BGM-040', machineSerial: '311A0012720', brand: 'VivaChek', model: 'Fad', ward: 'NCD', status: 'active', receiveDate: '2025-03-12', lotNumber: '235080', remark: '' },
  { id: 'm43', serialNumber: 'BGM-043', machineSerial: '311A001285B', brand: 'VivaChek', model: 'Fad', ward: 'NCD', status: 'active', receiveDate: '2025-03-12', lotNumber: '235080', remark: '' },
  { id: 'm45', serialNumber: 'BGM-045', machineSerial: '311A0012862', brand: 'VivaChek', model: 'Fad', ward: 'OR', status: 'active', receiveDate: '2025-01-17', lotNumber: '235080', remark: '' },
  { id: 'm46', serialNumber: 'BGM-046', machineSerial: '311A001285A', brand: 'VivaChek', model: 'Fad', ward: 'OR', status: 'active', receiveDate: '2025-01-17', lotNumber: '235080', remark: '' },
  { id: 'm48', serialNumber: 'BGM-048', machineSerial: '311A0012BEA', brand: 'VivaChek', model: 'Fad', ward: 'OPD1', status: 'active', receiveDate: '2025-03-12', lotNumber: '235080', remark: '' },
  { id: 'm73', serialNumber: 'BGM-073', machineSerial: '311A0013C85', brand: 'VivaChek', model: 'Fad', ward: 'OPD1', status: 'active', receiveDate: '2025-03-12', lotNumber: '233755', remark: '' },
  { id: 'm74', serialNumber: 'BGM-074', machineSerial: '311A001802E', brand: 'VivaChek', model: 'Fad', ward: 'OPD1', status: 'active', receiveDate: '2025-03-12', lotNumber: '234737', remark: '' },
  { id: 'm79', serialNumber: 'BGM-079', machineSerial: '103A2002FC2', brand: 'VivaChek', model: 'Fad', ward: 'MED-M', status: 'inactive', receiveDate: '2025-01-31', lotNumber: '235080', remark: '' },
  { id: 'm80', serialNumber: 'BGM-080', machineSerial: '103A2003201', brand: 'VivaChek', model: 'Fad', ward: 'MED-M', status: 'inactive', receiveDate: '2025-01-31', lotNumber: '235080', remark: '' },
  { id: 'm95', serialNumber: 'BGM-095', machineSerial: '311A0017FA3', brand: 'VivaChek', model: 'Fad', ward: 'VIP6', status: 'active', receiveDate: '2025-01-15', lotNumber: '234737', remark: '' },
  { id: 'm97', serialNumber: 'BGM-097', machineSerial: '311A0017FAD', brand: 'VivaChek', model: 'Fad', ward: 'SX', status: 'active', receiveDate: '2025-01-16', lotNumber: '234737', remark: '' },
  { id: 'm98', serialNumber: 'BGM-098', machineSerial: '311A0012BE6', brand: 'VivaChek', model: 'Fad', ward: 'OR', status: 'active', receiveDate: '2025-01-17', lotNumber: '235080', remark: '' },
  { id: 'm99', serialNumber: 'BGM-099', machineSerial: '311A0013C3A', brand: 'VivaChek', model: 'Fad', ward: 'OR', status: 'active', receiveDate: '2025-03-12', lotNumber: '233755', remark: '' },
  { id: 'm100', serialNumber: 'BGM-100', machineSerial: '311A0012864', brand: 'VivaChek', model: 'Fad', ward: 'OR', status: 'active', receiveDate: '2025-03-12', lotNumber: '235080', remark: '' },
  { id: 'm101', serialNumber: 'BGM-101', machineSerial: '103A20030F4', brand: 'VivaChek', model: 'Fad', ward: 'NCD', status: 'active', receiveDate: '2025-03-12', lotNumber: '235080', remark: '' },
  { id: 'm102', serialNumber: 'BGM-102', machineSerial: '103A2003178', brand: 'VivaChek', model: 'Fad', ward: 'ER', status: 'inactive', receiveDate: '2025-05-23', lotNumber: '235080', remark: 'เรียกเก็บคืนแล้ว' },
  { id: 'm103', serialNumber: 'BGM-103', machineSerial: '103A2001733', brand: 'VivaChek', model: 'Fad', ward: 'ER', status: 'inactive', receiveDate: '2025-05-23', lotNumber: '235080', remark: 'เรียกเก็บคืนแล้ว' },
  { id: 'm104', serialNumber: 'BGM-104', machineSerial: '103A200181D', brand: 'VivaChek', model: 'Fad', ward: 'ICU', status: 'active', receiveDate: '2025-03-11', lotNumber: '235080', remark: '' },
  { id: 'm105', serialNumber: 'BGM-105', machineSerial: '311A0012724', brand: 'VivaChek', model: 'Fad', ward: 'GYN', status: 'active', receiveDate: '2025-01-16', lotNumber: '235080', remark: '' },
  { id: 'm106', serialNumber: 'BGM-106', machineSerial: '311A0012729', brand: 'VivaChek', model: 'Fad', ward: 'GYN', status: 'active', receiveDate: '2025-03-11', lotNumber: '235080', remark: '' },
  { id: 'm107', serialNumber: 'BGM-107', machineSerial: '103A20016FF', brand: 'VivaChek', model: 'Fad', ward: 'COHORT', status: 'inactive', receiveDate: '2025-02-21', lotNumber: '235080', remark: '' },
  { id: 'm109', serialNumber: 'BGM-109', machineSerial: '311A0017FA8', brand: 'VivaChek', model: 'Fad', ward: 'MED-M', status: 'active', receiveDate: '2025-01-31', lotNumber: '234737', remark: '' }
];

export const INITIAL_LOT_CONFIGS: QcLotConfig[] = [
  {
    lotNumber: '235080',
    level1Target: 45, level1Min: 35, level1Max: 55, level1SD: 3.3,
    level2Target: 120, level2Min: 100, level2Max: 140, level2SD: 6.7,
    level3Target: 310, level3Min: 270, level3Max: 350, level3SD: 13.3
  },
  {
    lotNumber: '233755',
    level1Target: 48, level1Min: 38, level1Max: 58, level1SD: 3.0,
    level2Target: 125, level2Min: 105, level2Max: 145, level2SD: 6.0,
    level3Target: 320, level3Min: 280, level3Max: 360, level3SD: 12.0
  },
  {
    lotNumber: '234737',
    level1Target: 50, level1Min: 40, level1Max: 60, level1SD: 3.5,
    level2Target: 130, level2Min: 110, level2Max: 150, level2SD: 7.0,
    level3Target: 330, level3Min: 290, level3Max: 370, level3SD: 14.0
  }
];

export const INITIAL_QC_RECORDS: QcRecord[] = [
  {
    id: 'q1',
    date: '2026-07-10',
    receiveDate: '2026-07-09',
    returnDate: '2026-07-10',
    ward: 'PED',
    serialNumber: 'BGM-003',
    operator: 'ทนพ.หญิง รัตนากร สมบูรณ์',
    lotNumber: '235080',
    level1: 44,
    level2: 118,
    level3: 305,
    level1Status: 'normal',
    level2Status: 'normal',
    level3Status: 'normal'
  },
  {
    id: 'q2',
    date: '2026-07-11',
    receiveDate: '2026-07-10',
    returnDate: '2026-07-11',
    ward: 'PED',
    serialNumber: 'BGM-004',
    operator: 'ทนพ. สมชาย ดีเลิศ',
    lotNumber: '235080',
    level1: 49,
    level2: 126,
    level3: 318,
    level1Status: 'normal',
    level2Status: 'normal',
    level3Status: 'normal'
  },
  {
    id: 'q3',
    date: '2026-07-12',
    receiveDate: '2026-07-11',
    returnDate: '2026-07-12',
    ward: 'COHORT',
    serialNumber: 'BGM-009',
    operator: 'ทนพ. สมชาย ดีเลิศ',
    lotNumber: '235080',
    level1: 45,
    level2: 121,
    level3: 312,
    level1Status: 'normal',
    level2Status: 'normal',
    level3Status: 'normal'
  },
  {
    id: 'q4',
    date: '2026-07-13',
    receiveDate: '2026-07-13',
    returnDate: '2026-07-13',
    ward: 'SX',
    serialNumber: 'BGM-002',
    operator: 'ทนพ.หญิง รัตนากร สมบูรณ์',
    lotNumber: '235080',
    level1: 43,
    level2: 120,
    level3: 301,
    level1Status: 'normal',
    level2Status: 'normal',
    level3Status: 'normal'
  },
  {
    id: 'q5',
    date: '2026-07-14',
    receiveDate: '2026-07-14',
    returnDate: '2026-07-14',
    ward: 'MED-M',
    serialNumber: 'BGM-109',
    operator: 'ทนพ. สมชาย ดีเลิศ',
    lotNumber: '234737',
    level1: 45,
    level2: 120,
    level3: 308,
    level1Status: 'normal',
    level2Status: 'normal',
    level3Status: 'normal'
  }
];

export const INITIAL_REPAIRS: RepairRequest[] = [
  {
    id: 'REP-748',
    serialNumber: 'BGM-009',
    ward: 'ตึกติดเชื้อ',
    reporterName: 'พว. มณีวรรณ แก้วดี',
    reporterPhone: '081-234-5678',
    reportedProblem: 'เปิดหน้าจอติดบ้างไม่ติดบ้าง ตรวจวัดค่าแล้วเหมือนมีปัญหาถ่านเสื่อม',
    requestDate: '2026-07-14',
    status: 'completed',
    diagnosedProblem: 'ถ่านหมด/เสื่อมสภาพ และช่องใส่ถ่านมีคราบแป้งจากแบตเตอรี่เดิม',
    actionTaken: 'change_battery',
    operatorName: 'ทนพ. สมชาย ดีเลิศ',
    receiverName: 'พว. มณีวรรณ แก้วดี',
    completionDate: '2026-07-14',
    needsBackup: false,
    checklist: {
      cleanliness: 'pass',
      buttons: 'pass',
      stripSlot: 'pass',
      batterySlot: 'fail', // Fail initially but resolved
      battery: 'fail',
      screen: 'pass',
      measurement: 'pass',
      iqc: 'pass',
      intercomparison: 'pending',
      others: 'ขัดทำความสะอาดขั้วถ่านที่เปื้อนคราบกรดเรียบร้อยและใส่แบตเตอรี่ก้อนใหม่'
    }
  },
  {
    id: 'REP-992',
    serialNumber: 'BGM-011',
    ward: 'ห้องคลอด (LR)',
    reporterName: 'พว. วิสาขา สว่างใจ',
    reporterPhone: '089-876-5432',
    reportedProblem: 'หน้าจอแสดงสัญลักษณ์ Error ตลอดเวลาหลังเสียบแผ่นตรวจ',
    requestDate: '2026-07-12',
    status: 'waiting_claim',
    diagnosedProblem: 'บอร์ดเซ็นเซอร์ประมวลผลภายในขัดข้อง ไม่สามารถตรวจจับแผ่นตรวจได้',
    needsBackup: true,
    checklist: {
      cleanliness: 'pass',
      buttons: 'pass',
      stripSlot: 'fail',
      batterySlot: 'pass',
      battery: 'pass',
      screen: 'pass',
      measurement: 'fail',
      iqc: 'fail',
      intercomparison: 'fail',
      others: 'ลองทำความสะอาดช่องเสียบแผ่นตรวจและพ่นสเปรย์ไล่ความชื้นแล้ว แต่อาการไม่ดีขึ้น'
    }
  },
  {
    id: 'REP-104',
    serialNumber: 'BGM-003',
    ward: 'ตึกติดเชื้อ',
    reporterName: 'พว. ยุพาพรรณ ทองขาว',
    reporterPhone: '085-555-1234',
    reportedProblem: 'เครื่องไม่อ่านแผ่นตรวจ ตรวจแลปไม่ได้',
    requestDate: '2026-07-15',
    status: 'pending',
    needsBackup: true,
    checklist: {
      cleanliness: 'pending',
      buttons: 'pending',
      stripSlot: 'pending',
      batterySlot: 'pending',
      battery: 'pending',
      screen: 'pending',
      measurement: 'pending',
      iqc: 'pending',
      intercomparison: 'pending',
      others: ''
    }
  }
];

export const INITIAL_SUPPLIES: SupplyRequest[] = [
  {
    id: 'SUP-401',
    ward: 'กุมารเวชกรรม',
    requesterName: 'พว. กมลวรรณ ใยบัว',
    itemType: 'machine',
    quantity: 1,
    reason: 'เครื่องเดิม (BGM-007) สูญหาย ระหว่างการเคลื่อนย้ายผู้ป่วย',
    requestDate: '2026-07-11',
    status: 'pending'
  },
  {
    id: 'SUP-402',
    ward: 'ห้องฉุกเฉิน (ER)',
    requesterName: 'พว. สมร ดีจริง',
    itemType: 'strip',
    quantity: 10,
    reason: 'สำหรับรองรับผู้ป่วยช่วงเทศกาลที่เพิ่มจำนวนขึ้น',
    requestDate: '2026-07-13',
    status: 'approved'
  }
];

export const INITIAL_EQA_RECORDS: EqaRecord[] = [
  {
    id: 'eqa1',
    round: 'EQA 1/2026',
    testDate: '2026-03-15',
    level1Value: 46, level1Target: 45,
    level2Value: 122, level2Target: 120,
    level3Value: 312, level3Target: 310,
    score: 98.2,
    status: 'excellent',
    feedback: 'ผลการเปรียบเทียบกับค่ากลางอยู่ในเกณฑ์ดีเยี่ยมผ่านเกณฑ์ระดับชาติ'
  },
  {
    id: 'eqa2',
    round: 'EQA 2/2026',
    testDate: '2026-06-20',
    level1Value: 48, level1Target: 45,
    level2Value: 114, level2Target: 120,
    level3Value: 322, level3Target: 310,
    score: 94.5,
    status: 'pass',
    feedback: 'ผ่านเกณฑ์มาตรฐาน ค่าคลาดเคลื่อนอยู่ในระดับที่ยอมรับได้สำหรับ POCT'
  }
];

export const TROUBLESHOOTING_GUIDE: TroubleshootingStep[] = [
  {
    id: 'ts1',
    problem: 'เครื่องเปิดไม่ติด / หน้าจอดับสนิท',
    symptoms: [
      'กดปุ่ม Power ค้างไว้แล้วไม่มีอะไรเกิดขึ้น',
      'ไม่มีสัญญาณเสียงหรือไฟหน้าจอสัมผัสเลย'
    ],
    solution: '1. ตรวจสอบแผ่นขั้วถ่านโลหะในฝาปิดแบตเตอรี่ว่าบิดเบี้ยวหรือไม่\n2. ทำความสะอาดคราบกรดหรือฝุ่นเกาะขั้วแบตเตอรี่ด้วยแอลกอฮอล์แห้ง\n3. ทดลองเปลี่ยนถ่านใหม่ยกชุด (ใช้ถ่านคุณภาพสูง CR2032 หรือ AAA ตามรุ่น)\n4. สังเกตหากใส่ถ่านกลับด้าน เครื่องจะไม่ทำงานเด็ดขาด'
  },
  {
    id: 'ts2',
    problem: 'เสียบแถบตรวจ (Strip) แล้วเครื่องไม่อ่าน',
    symptoms: [
      'ขึ้นรูปแผ่นตรวจกระพริบแต่ไม่มีการอ่านค่า',
      'เสียบแผ่นตรวจเข้าไปแล้วหน้าจอยังว่างเปล่าเหมือนไม่ได้เสียบ'
    ],
    solution: '1. ตรวจสอบชนิดแผ่นตรวจให้ตรงกับยี่ห้อและรุ่นของเครื่อง DTX (เช่น แผ่น VivaChek Fad ต้องใช้กับเครื่อง Fad เท่านั้น)\n2. เสียบแผ่นตรวจให้สุดและถูกทิศทาง (ด้านที่มีขั้วโลหะสีทองเสียบเข้าตัวเครื่อง)\n3. บ่อยครั้งผู้ใช้เสียบแผ่นตรวจไม่ตรงช่องล็อค ส่งผลให้ขาคอนแทกต์ข้างในอ่านค่าไม่ได้ ให้ดึงออกและเสียบเข้าไปใหม่เบา ๆ โดยไม่ต้องออกแรงกดมาก\n4. ตรวจเช็คว่าไม่มีฝุ่น คราบเลือด หรือเศษแป้งในช่องเสียบแผ่นตรวจ หากมีให้นำคอตตอนบัดชุบแอลกอฮอล์หมาด ๆ ทำความสะอาดอย่างระมัดระวัง'
  },
  {
    id: 'ts3',
    problem: 'ค่าผลการตรวจวัด (Glucose) คลาดเคลื่อนสูง หรือขึ้นโค้ด Error บ่อย',
    symptoms: [
      'ค่าตรวจขึ้นกระโดดสูง หรือต่ำเกินจริงเมื่อเทียบกับอาการผู้ป่วย',
      'ขึ้นโค้ด Error E-3, E-4 บนหน้าจอ'
    ],
    solution: '1. ตรวจสอบวันหมดอายุบนขวดแผ่นตรวจ แผ่นตรวจที่เปิดขวดแล้วนานเกิน 6 เดือนหรือเสื่อมสภาพจะให้ค่าสูง/ต่ำผิดปกติ\n2. ล้างมือผู้ป่วยและเช็ดแอลกอฮอล์ให้แห้งสนิทก่อนเจาะเลือด (แอลกอฮอล์ที่ยังไม่แห้งหรือคราบอาหารที่ปลายนิ้วจะทำให้ผลคลาดเคลื่อนอย่างมาก)\n3. เช็ดหยดเลือดหยดแรกออก แล้วใช้หยดเลือดหยดที่สองในการหยดลงแผ่นตรวจ\n4. ทำ IQC ด่วนโดยใช้น้ำยาควบคุมคุณภาพ 3 ระดับเพื่อยืนยันความถูกต้องของเครื่องและแผ่นตรวจชุดนั้น ๆ'
  }
];

export const MANUALS_LIST: UserManual[] = [
  {
    id: 'man1',
    title: 'คู่มือการใช้งานเครื่องตรวจวัดน้ำตาลปลายนิ้วแบบย่อ POCT (โรงพยาบาลสังขะ)',
    category: 'guide',
    description: 'เอกสาร PDF แสดงลำดับขั้นตอนการเจาะ ตรวจวัดค่า และบันทึกข้อมูลอย่างเป็นระบบเพื่อลด Error'
  },
  {
    id: 'man2',
    title: 'แนวทางการควบคุมคุณภาพภายใน (IQC) และการแปลผลลัพธ์ Levey-Jennings',
    category: 'guide',
    description: 'คู่มือการเตรียมและรันน้ำยาควบคุมคุณภาพ 3 ระดับ พร้อมแนวปฏิบัติเมื่อเจอ Out of Control'
  },
  {
    id: 'man3',
    title: 'วิดีโอสาธิตการทำความสะอาดและบำรุงรักษาเชิงป้องกันเครื่อง DTX ประจำสัปดาห์',
    category: 'video',
    description: 'คลิปสาธิตขั้นตอนการเช็ดทำความสะอาดพอร์ตเสียบและฝาช่องถ่านเพื่อยืดอายุการใช้งาน'
  }
];

export interface DtxMaintenanceGuideline {
  id: string;
  title: string;
  description: string;
  tip?: string;
  iconName: string;
}

export interface DtxErrorCode {
  code: string;
  meaning: string;
  solution: string;
  severity: 'warning' | 'error' | 'critical';
}

export const DTX_MAINTENANCE_GUIDELINES: DtxMaintenanceGuideline[] = [
  {
    id: 'm1',
    title: 'ห้ามโยนหรือวางเครื่องกระแทกพื้น',
    description: 'หลีกเลี่ยงการกระแทกรุนแรง เพื่อป้องกันวงจรเซ็นเซอร์และการแสดงผลภายในเสียหายชำรุด',
    tip: 'หลีกเลี่ยงการกระแทกรุนแรง เพื่อป้องกันวงจรภายในเสียหาย',
    iconName: 'ban'
  },
  {
    id: 'm2',
    title: 'ระวังไม่ให้เลือดเข้าช่องเสียบ Strip',
    description: 'ระมัดระวังเป็นพิเศษขณะเจาะและตรวจวัดเลือด หากมีคราบเลือดไหลเยิ้มเข้าช่องเสียบต้องรีบทำความสะอาดทันที เพื่อป้องกันบอร์ดชำรุด',
    tip: 'หากมีเลือดเข้าต้องรีบทำความสะอาดทันที เพื่อป้องกันเครื่องชำรุด',
    iconName: 'droplet'
  },
  {
    id: 'm3',
    title: 'เช็ดทำความสะอาดทุกครั้งหลังใช้งาน',
    description: 'ทำความสะอาดตัวเครื่องอย่างระมัดระวังด้วยผ้าหรือสำลีชุบแอลกอฮอล์หมาด ๆ เพื่อสุขอนามัยที่ดีและขจัดคราบสะสม',
    tip: 'ทำความสะอาดและระมัดระวัง ไม่ให้เลือดเข้าไปในตัวเครื่อง',
    iconName: 'sparkles'
  },
  {
    id: 'm4',
    title: 'ตรวจสอบเมื่อหน้าจอไม่แสดงผล',
    description: 'หากเสียบ Strip เข้าเครื่องแล้วเครื่องเงียบหรือไม่ขึ้นผล ให้ทำการเช็คว่าแผ่นตรวจเสียบหลวม ขั้วถ่านหลวม หรือหมดอายุหรือไม่',
    tip: 'หากเสียบ Strip แล้วไม่ขึ้นผล ให้เช็คว่าแผ่นเสียบหลวมหรือไม่',
    iconName: 'monitor'
  },
  {
    id: 'm5',
    title: 'การส่งซ่อมเพื่อขอเครื่องใหม่',
    description: 'ในกรณีที่บอร์ดขัดข้องหรือเสียหายจนซ่อมแซมไม่ได้ และอยู่ในประกัน ให้ทำเรื่องส่งเคลมเพื่อขอเปลี่ยนตัวเครื่องใหม่ทดแทน',
    tip: 'ต้องส่งคืนเครื่องเดิมที่ชำรุดทุกครั้ง ก่อนรับเครื่องใหม่เพื่อดำเนินการเคลม',
    iconName: 'refresh'
  }
];

export const DTX_ERROR_CODES: DtxErrorCode[] = [
  {
    code: 'E 1',
    meaning: 'ใส่เลือดหรือสารควบคุมคุณภาพลงบนแผ่นทดสอบ ก่อนที่จะมีสัญลักษณ์กะพริบรูปหยดเลือดแนะนำบนหน้าจอ',
    solution: 'ทิ้งแผ่นทดสอบและทำการทดสอบซ้ำอีกครั้งด้วยแผ่นทดสอบใหม่ รอจนกว่าจะเห็นภาพกระพริบหยดเลือดหรือหยดควบคุมแสดงผลก่อนที่จะทดสอบอีกครั้ง',
    severity: 'error'
  },
  {
    code: 'E 2',
    meaning: 'แผ่นทดสอบมีการปนเปื้อนหรือผ่านการใช้งานมาแล้ว',
    solution: 'ทิ้งแผ่นทดสอบและทำการทดสอบซ้ำอีกครั้งด้วยแผ่นทดสอบใหม่ รอจนกว่าจะเห็นภาพกระพริบหยดเลือดแสดงผลก่อนจึงทดสอบอีกครั้ง',
    severity: 'error'
  },
  {
    code: 'E 3',
    meaning: 'แผ่นทดสอบไม่ถูกต้อง',
    solution: 'ทิ้งแผ่นทดสอบและทำการทดสอบซ้ำอีกครั้งด้วยแผ่นทดสอบใหม่ ตรวจสอบให้แน่ใจว่าใช้แผ่นทดสอบของ VivaChek™ Fad จาก VivaChek Laboratories, Inc.',
    severity: 'critical'
  },
  {
    code: 'E 4',
    meaning: 'ตัวอย่างไม่ถูกต้อง',
    solution: 'ทิ้งแผ่นทดสอบและทำการทดสอบซ้ำอีกครั้งด้วยแผ่นทดสอบใหม่ ตรวจสอบให้แน่ใจว่าใช้แผ่นทดสอบ VivaChek™ Fad จาก VivaChek Laboratories, Inc. และให้ความเข้มข้นของตัวอย่างเลือดหรือสารควบคุมคุณภาพของ VivaChek™ Fad เพื่อทดสอบเท่านั้น',
    severity: 'critical'
  },
  {
    code: 'E 5',
    meaning: 'อุณหภูมิอยู่นอกช่วงที่กำหนด',
    solution: 'ไปทดสอบยังพื้นที่ที่อยู่ในช่วงการทำงานของเครื่องตรวจ ปล่อยให้เครื่องตรวจปรับอุณหภูมิเป็นเวลา 20 นาที ก่อนทำการทดสอบ',
    severity: 'warning'
  },
  {
    code: 'E 6 / E 7 / E 8 / E 9',
    meaning: 'ปัญหาซอฟต์แวร์หรือฮาร์ดแวร์เกิดขึ้น',
    solution: 'ถอดแบตเตอรี่ออกและใส่กลับเพื่อเริ่มเครื่องตรวจ หากปัญหายังคงอยู่ให้ติดต่อตัวแทนจำหน่าย',
    severity: 'critical'
  },
  {
    code: 'E 10',
    meaning: 'ตัวอย่างเลือดไม่เพียงพอ',
    solution: 'ทำการทดสอบซ้ำและให้ตัวอย่างให้เพียงพอต่อช่องของตัวอย่างบนแผ่นทดสอบ',
    severity: 'warning'
  },
  {
    code: 'HI',
    meaning: 'ผลการทดสอบสูงกว่า 600 มก./ดล. (33.3 mmol/L)',
    solution: 'ล้างและเช็ดมือให้สะอาดในบริเวณทำการทดสอบ แล้วทำการทดสอบซ้ำอีกครั้งโดยใช้แผ่นทดสอบใหม่ หากผลการทดสอบยังกระพริบ "HI" อยู่ให้ติดต่อแพทย์ผู้ดูแลสุขภาพของคุณโดยเร็วที่สุด',
    severity: 'critical'
  },
  {
    code: 'LO',
    meaning: 'ผลการทดสอบต่ำกว่า 10 มก./ดล. (0.6 mmol/L)',
    solution: 'ล้างและเช็ดมือให้สะอาดในบริเวณทำการทดสอบ แล้วทำการทดสอบซ้ำอีกครั้งโดยใช้แผ่นทดสอบใหม่ หากผลการทดสอบยังกระพริบ "LO" อยู่ให้ติดต่อแพทย์ผู้ดูแลสุขภาพของคุณโดยเร็วที่สุด',
    severity: 'critical'
  }
];
