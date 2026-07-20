/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { EqaRecord } from '../types';
import { Plus, CheckCircle, Shield, Award, AlertTriangle, MessageSquare } from 'lucide-react';

interface EQAManagementProps {
  eqaRecords: EqaRecord[];
  onAddEqaRecord: (record: EqaRecord) => void;
}

export default function EQAManagement({ eqaRecords, onAddEqaRecord }: EQAManagementProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form states
  const [round, setRound] = useState('');
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [l1Val, setL1Val] = useState('');
  const [l1Target, setL1Target] = useState('');
  const [l2Val, setL2Val] = useState('');
  const [l2Target, setL2Target] = useState('');
  const [l3Val, setL3Val] = useState('');
  const [l3Target, setL3Target] = useState('');
  const [feedback, setFeedback] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!round || !l1Val || !l1Target || !l2Val || !l2Target || !l3Val || !l3Target) {
      alert('กรุณากรอกข้อมูลและคะแนนเปรียบเทียบ EQA ให้ครบถ้วน');
      return;
    }

    const val1 = Number(l1Val);
    const tar1 = Number(l1Target);
    const val2 = Number(l2Val);
    const tar2 = Number(l2Target);
    const val3 = Number(l3Val);
    const tar3 = Number(l3Target);

    // Calculate approximate deviation score (max score 100, deduct based on deviations)
    const dev1 = Math.abs((val1 - tar1) / tar1);
    const dev2 = Math.abs((val2 - tar2) / tar2);
    const dev3 = Math.abs((val3 - tar3) / tar3);
    const avgDev = (dev1 + dev2 + dev3) / 3;

    const score = Math.max(0, Math.round((1 - avgDev) * 1000) / 10);
    
    let status: EqaRecord['status'] = 'pass';
    if (score >= 95) status = 'excellent';
    else if (score >= 90) status = 'pass';
    else if (score >= 80) status = 'warning';
    else status = 'fail';

    const newRecord: EqaRecord = {
      id: `EQA-${Date.now()}`,
      round,
      testDate,
      level1Value: val1,
      level1Target: tar1,
      level2Value: val2,
      level2Target: tar2,
      level3Value: val3,
      level3Target: tar3,
      score,
      status,
      feedback: feedback.trim() || 'ผลลัพธ์ผ่านเกณฑ์เปรียบเทียบใน POCT'
    };

    onAddEqaRecord(newRecord);
    setShowAddForm(false);
    
    // Clear form
    setRound('');
    setL1Val('');
    setL1Target('');
    setL2Val('');
    setL2Target('');
    setL3Val('');
    setL3Target('');
    setFeedback('');
  };

  const getStatusDisplay = (s: string) => {
    switch (s) {
      case 'excellent':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 flex items-center w-max"><Award size={12} className="mr-1" /> ผ่านเกณฑ์ดีเยี่ยม (Excellent)</span>;
      case 'pass':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 flex items-center w-max"><CheckCircle size={12} className="mr-1" /> ผ่านเกณฑ์มาตรฐาน (Pass)</span>;
      case 'warning':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 flex items-center w-max"><AlertTriangle size={12} className="mr-1" /> พึงเฝ้าระวัง (Warning)</span>;
      case 'fail':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 flex items-center w-max"><AlertTriangle size={12} className="mr-1" /> ต่ำกว่าเกณฑ์มาตรฐาน (Fail)</span>;
      default:
        return s;
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6" id="eqa-management-panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-1.5">
            <Shield size={20} className="text-sky-600" />
            <span>การทดสอบคุณภาพจากภายนอก (EQA POCT Tracking)</span>
          </h2>
          <p className="text-xs text-slate-400">
            บันทึกผลการประเมินและการส่งตรวจน้ำยาเปรียบเทียบกับองค์กรภายนอก (EQA) เพื่อรักษาระบบมาตรฐานห้องแลปโรงพยาบาลสังขะ
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center space-x-1.5 transition-all shrink-0"
        >
          <Plus size={14} />
          <span>เพิ่มผลประเมิน EQA รอบใหม่</span>
        </button>
      </div>

      {/* Add EQA Form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4 animate-scale-up" id="eqa-form">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-xs font-bold text-slate-700">บันทึกคะแนนรอบการประเมิน EQA 3 ระดับ</h3>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-400 text-xs hover:text-slate-600">ปิด</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700">ชื่อรอบการประเมิน EQA *</label>
              <input
                type="text"
                placeholder="เช่น EQA รอบที่ 3/2026 (กองควบคุมมาตรฐาน)"
                value={round}
                onChange={(e) => setRound(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700">วันที่ส่งตรวจวิเคราะห์ *</label>
              <input
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white"
                required
              />
            </div>
          </div>

          {/* EQA 3 Level Grid Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-slate-200/60 text-xs">
            {/* Level 1 */}
            <div className="space-y-2">
              <span className="font-bold text-slate-700 block text-xs border-b border-slate-100 pb-1">Level 1 (Low)</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500">ค่าวิเคราะห์ได้ *</label>
                  <input type="number" value={l1Val} onChange={(e) => setL1Val(e.target.value)} className="w-full p-2 border border-slate-200 rounded" required />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">ค่ากลางเป้าหมาย *</label>
                  <input type="number" value={l1Target} onChange={(e) => setL1Target(e.target.value)} className="w-full p-2 border border-slate-200 rounded" required />
                </div>
              </div>
            </div>

            {/* Level 2 */}
            <div className="space-y-2">
              <span className="font-bold text-slate-700 block text-xs border-b border-slate-100 pb-1">Level 2 (Normal)</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500">ค่าวิเคราะห์ได้ *</label>
                  <input type="number" value={l2Val} onChange={(e) => setL2Val(e.target.value)} className="w-full p-2 border border-slate-200 rounded" required />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">ค่ากลางเป้าหมาย *</label>
                  <input type="number" value={l2Target} onChange={(e) => setL2Target(e.target.value)} className="w-full p-2 border border-slate-200 rounded" required />
                </div>
              </div>
            </div>

            {/* Level 3 */}
            <div className="space-y-2">
              <span className="font-bold text-slate-700 block text-xs border-b border-slate-100 pb-1">Level 3 (High)</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500">ค่าวิเคราะห์ได้ *</label>
                  <input type="number" value={l3Val} onChange={(e) => setL3Val(e.target.value)} className="w-full p-2 border border-slate-200 rounded" required />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">ค่ากลางเป้าหมาย *</label>
                  <input type="number" value={l3Target} onChange={(e) => setL3Target(e.target.value)} className="w-full p-2 border border-slate-200 rounded" required />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700">ข้อคิดเห็นและข้อแนะนำพัฒนาการวิเคราะห์ (Feedback) *</label>
            <input
              type="text"
              placeholder="เช่น ผ่านเกณฑ์อย่างสมบูรณ์ หรือ มีความคลาดเคลื่อนระบบปานกลาง แนะนำให้คาลิเบรตช่องอ่านแผ่น"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white"
              required
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-colors flex items-center space-x-1"
            >
              <CheckCircle size={13} />
              <span>บันทึก EQA คาดคะเนคะแนน</span>
            </button>
          </div>
        </form>
      )}

      {/* EQA Records List */}
      <div className="space-y-4" id="eqa-cards-list">
        {eqaRecords.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-xs">ยังไม่มีบันทึกข้อมูลการทดสอบ EQA ในระบบ</p>
        ) : (
          eqaRecords.map((rec) => (
            <div key={rec.id} className="border border-slate-100 p-5 rounded-xl hover:border-sky-100 hover:bg-slate-50/20 transition-all space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-slate-800 text-sm">{rec.round}</h4>
                  <p className="text-[10px] text-slate-400">วันที่ส่งตรวจสอบเปรียบเทียบ: {rec.testDate}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-semibold">ผลการประเมินเบี่ยงเบน</span>
                    <span className="text-base font-extrabold text-sky-600 font-mono">{rec.score}%</span>
                  </div>
                  <div>{getStatusDisplay(rec.status)}</div>
                </div>
              </div>

              {/* Grid 3 Level Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {/* Level 1 Detail */}
                <div className="bg-slate-50 p-2.5 rounded-lg space-y-1">
                  <span className="text-[10px] text-slate-500 font-semibold block">Level 1 (Low)</span>
                  <p className="font-mono text-[11px] text-slate-700">ค่าวิเคราะห์: <span className="font-bold">{rec.level1Value}</span> | เป้าหมาย: <span className="font-bold">{rec.level1Target}</span></p>
                  <p className="text-[9px] text-slate-400">คลาดเคลื่อน: {Math.round(Math.abs((rec.level1Value - rec.level1Target) / rec.level1Target) * 1000) / 10}%</p>
                </div>

                {/* Level 2 Detail */}
                <div className="bg-slate-50 p-2.5 rounded-lg space-y-1">
                  <span className="text-[10px] text-slate-500 font-semibold block">Level 2 (Normal)</span>
                  <p className="font-mono text-[11px] text-slate-700">ค่าวิเคราะห์: <span className="font-bold">{rec.level2Value}</span> | เป้าหมาย: <span className="font-bold">{rec.level2Target}</span></p>
                  <p className="text-[9px] text-slate-400">คลาดเคลื่อน: {Math.round(Math.abs((rec.level2Value - rec.level2Target) / rec.level2Target) * 1000) / 10}%</p>
                </div>

                {/* Level 3 Detail */}
                <div className="bg-slate-50 p-2.5 rounded-lg space-y-1">
                  <span className="text-[10px] text-slate-500 font-semibold block">Level 3 (High)</span>
                  <p className="font-mono text-[11px] text-slate-700">ค่าวิเคราะห์: <span className="font-bold">{rec.level3Value}</span> | เป้าหมาย: <span className="font-bold">{rec.level3Target}</span></p>
                  <p className="text-[9px] text-slate-400">คลาดเคลื่อน: {Math.round(Math.abs((rec.level3Value - rec.level3Target) / rec.level3Target) * 1000) / 10}%</p>
                </div>
              </div>

              {/* Feedback and Notes */}
              {rec.feedback && (
                <div className="bg-sky-50/30 p-3 rounded-lg border border-sky-50 flex items-start space-x-2 text-xs">
                  <MessageSquare size={14} className="text-sky-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold text-sky-950 text-[10px] block">ข้อคิดเห็นคณะกรรมการและข้อเสนอแนะ:</span>
                    <p className="text-sky-900 font-medium mt-0.5 italic text-[11px]">"{rec.feedback}"</p>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
