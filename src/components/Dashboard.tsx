/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DtxMachine, RepairRequest } from '../types';
import { Activity, ShieldAlert, Wrench, Package, TrendingUp, AlertTriangle, HelpCircle, Lightbulb, FileText, Megaphone, CheckCircle2, Clock, Users, ArrowUpRight } from 'lucide-react';

interface DashboardProps {
  machines: DtxMachine[];
  repairs: RepairRequest[];
  onNavigateTab?: (tab: string) => void;
}

export default function Dashboard({ machines, repairs, onNavigateTab }: DashboardProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Calculate status statistics
  const totalMachines = machines.length;
  const activeCount = machines.filter(m => m.status === 'active').length;
  const lostCount = machines.filter(m => m.status === 'lost').length;
  const unknownCount = machines.filter(m => m.status === 'unknown').length;
  const waitingClaimCount = machines.filter(m => m.status === 'waiting_claim').length;
  const claimedCount = machines.filter(m => m.status === 'claimed').length;

  const activeRepairs = repairs.filter(r => r.status !== 'completed').length;
  const completedRepairsCount = repairs.filter(r => r.status === 'completed').length;

  // Diagnostic problems statistics
  const problemStats = {
    userError: 0, // เสียบ strip ไม่ลงล็อก, ผู้ใช้ใช้งานไม่ถูกต้อง, เครื่องไม่ได้เป็นอะไร
    batteryDead: 0, // ถ่านหมด, เปลี่ยนถ่าน
    screenBroken: 0, // จอเสีย
    hardwareFault: 0, // บอร์ดเสีย, ช่องเสียบแถบวัดชำรุด
    sentClaim: 0, // ส่งเคลมบริษัท
    others: 0,
  };

  repairs.forEach(r => {
    if (r.status === 'completed' || r.diagnosedProblem) {
      const diag = (r.diagnosedProblem || '').toLowerCase();
      const reported = r.reportedProblem.toLowerCase();
      
      if (diag.includes('เสียบ') || diag.includes('ล็อก') || diag.includes('ผู้ใช้') || diag.includes('ไม่ได้เป็นอะไร') || diag.includes('ใช้งานไม่ถูกต้อง')) {
        problemStats.userError++;
      } else if (diag.includes('ถ่าน') || diag.includes('แบต') || diag.includes('battery')) {
        problemStats.batteryDead++;
      } else if (diag.includes('จอ') || diag.includes('screen') || diag.includes('แสดงผล')) {
        problemStats.screenBroken++;
      } else if (diag.includes('บอร์ด') || diag.includes('เซ็นเซอร์') || diag.includes('ช่องเสียบ') || diag.includes('strip')) {
        problemStats.hardwareFault++;
      } else if (diag.includes('เคลม') || r.status === 'claimed' || r.status === 'waiting_claim') {
        problemStats.sentClaim++;
      } else {
        problemStats.others++;
      }
    } else {
      // For pending repairs, count based on reported problem
      const rep = r.reportedProblem.toLowerCase();
      if (rep.includes('เสียบ') || rep.includes('ไม่อ่าน') || rep.includes('ไม่เข้า')) {
        problemStats.userError++;
      } else if (rep.includes('ถ่าน') || rep.includes('แบต') || rep.includes('เปิดไม่ติด')) {
        problemStats.batteryDead++;
      } else {
        problemStats.others++;
      }
    }
  });

  // Data for status donut chart
  const statusData = [
    { label: 'ใช้งานปกติ', count: activeCount, color: '#10b981' }, // green-500
    { label: 'หาย', count: lostCount, color: '#f43f5e' }, // rose-500
    { label: 'ไม่ทราบสถานะ', count: unknownCount, color: '#64748b' }, // slate-500
    { label: 'รอส่งเคลม', count: waitingClaimCount, color: '#f59e0b' }, // amber-500
    { label: 'ส่งเคลมแล้ว', count: claimedCount, color: '#3b82f6' } // blue-500
  ].filter(d => d.count > 0);

  const totalStatusData = statusData.reduce((acc, d) => acc + d.count, 0);

  // Group repairs by Ward
  const repairsByWard: { [key: string]: number } = {};
  repairs.forEach(r => {
    repairsByWard[r.ward] = (repairsByWard[r.ward] || 0) + 1;
  });

  const sortedWardsData = Object.entries(repairsByWard)
    .map(([ward, count]) => ({ ward, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="space-y-4" id="dashboard-tab">
      {/* Soft Welcome Banner (Compact & clean) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4" id="welcome-banner">
        {/* Background Soft Glow Illustration */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 pointer-events-none opacity-20 md:opacity-100 flex items-center justify-end pr-8">
          <div className="w-32 h-32 bg-sky-100/60 dark:bg-sky-900/30 rounded-full blur-2xl absolute -right-5 -top-5"></div>
          <div className="relative border-2 border-dashed border-sky-300/60 dark:border-sky-700/60 rounded-xl p-2.5 bg-sky-50/30 dark:bg-slate-800/40 backdrop-blur-xs flex items-center space-x-2 shadow-inner">
            <div className="w-8 h-8 rounded-lg bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
              <Activity size={16} className="animate-pulse" />
            </div>
            <div className="space-y-0.5">
              <div className="w-16 h-1.5 bg-sky-400/80 rounded-full"></div>
              <div className="w-10 h-1.5 bg-sky-200 dark:bg-sky-700 rounded-full"></div>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-slate-800"></div>
          </div>
        </div>

        {/* Banner Text Content */}
        <div className="space-y-1.5 max-w-xl z-10 text-left w-full">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Welcome back, ADMIN.
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            Everything is under your control. Let's keep the POCT lab running smoothly and safely.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('repair')}
              className="bg-sky-500 hover:bg-sky-600 active:scale-98 text-white font-bold px-3 py-1.5 rounded-xl text-[11px] flex items-center space-x-1.5 shadow-sm shadow-sky-500/15 transition-all cursor-pointer"
            >
              <Wrench size={13} />
              <span>จัดการข้อมูลส่งซ่อม</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab('documents')}
              className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-3 py-1.5 rounded-xl text-[11px] flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Megaphone size={13} />
              <span>ดูข่าวสาร / ประกาศ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Smooth Stat Overview Cards (Matching reference image) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="stats-overview">
        {/* Card 1: Total Machines */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs flex items-center justify-between hover:shadow-sm transition-shadow" id="stat-card-total">
          <div className="space-y-2 text-left">
            <div className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200 leading-none">
              จำนวนเครื่อง DTX ทั้งหมด
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-3xl sm:text-4xl font-extrabold text-sky-600 dark:text-sky-400">
                {totalMachines}
              </span>
              <div className="bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-100/80 dark:border-sky-900/50 rounded-lg px-2 py-0.5 flex items-center space-x-1 font-bold text-xs">
                <TrendingUp size={12} />
                <span>เครื่อง</span>
              </div>
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500 font-light">
              คลังเครื่องตรวจน้ำตาลในระบบ
            </div>
          </div>
          <div className="w-12 h-12 bg-sky-50 dark:bg-sky-950/60 text-sky-500 rounded-2xl flex items-center justify-center shrink-0">
            <Package size={22} />
          </div>
        </div>

        {/* Card 2: Active Count */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs flex items-center justify-between hover:shadow-sm transition-shadow" id="stat-card-active">
          <div className="space-y-2 text-left">
            <div className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200 leading-none">
              พร้อมใช้งานปกติ
            </div>
            <div className="flex items-baseline">
              <span className="text-3xl sm:text-4xl font-extrabold text-sky-600 dark:text-sky-400">
                {activeCount}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 ml-1.5 font-light">
                จากทั้งหมด
              </span>
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500 font-light">
              คิดเป็น {totalMachines ? Math.round((activeCount / totalMachines) * 100) : 0}% ของคลัง
            </div>
          </div>
          <div className="w-12 h-12 bg-sky-50 dark:bg-sky-950/60 text-sky-500 rounded-2xl flex items-center justify-center shrink-0">
            <Activity size={22} />
          </div>
        </div>

        {/* Card 3: Repairing Count */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs flex items-center justify-between hover:shadow-sm transition-shadow" id="stat-card-repairs">
          <div className="space-y-2 text-left">
            <div className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200 leading-none">
              กำลังส่งซ่อม/แจ้งซ่อม
            </div>
            <div className="flex items-baseline">
              <span className="text-3xl sm:text-4xl font-extrabold text-sky-600 dark:text-sky-400">
                {activeRepairs}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 ml-1.5 font-light">
                รายการ
              </span>
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500 font-light">
              ซ่อมเสร็จแล้วคืนวอร์ด {completedRepairsCount} เครื่อง
            </div>
          </div>
          <div className="w-12 h-12 bg-sky-50 dark:bg-sky-950/60 text-sky-500 rounded-2xl flex items-center justify-center shrink-0">
            <Wrench size={22} />
          </div>
        </div>

        {/* Card 4: Lost/Claim Counts */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs flex items-center justify-between hover:shadow-sm transition-shadow" id="stat-card-claims">
          <div className="space-y-2 text-left">
            <div className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200 leading-none">
              ชำรุดรอเคลม/สูญหาย
            </div>
            <div className="flex items-baseline">
              <span className="text-3xl sm:text-4xl font-extrabold text-sky-600 dark:text-sky-400">
                {waitingClaimCount + claimedCount + lostCount}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 ml-1.5 font-light">
                เครื่อง
              </span>
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500 font-light">
              หาย: {lostCount} | รอเคลม: {waitingClaimCount} | เคลมแล้ว: {claimedCount}
            </div>
          </div>
          <div className="w-12 h-12 bg-sky-50 dark:bg-sky-950/60 text-sky-500 rounded-2xl flex items-center justify-center shrink-0">
            <ShieldAlert size={22} />
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" id="dashboard-charts">
        {/* Chart 1: Status Donut Chart */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between" id="chart-status-card">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-0.5">สัดส่วนสถานะเครื่อง DTX ทั้งหมด</h3>
            <p className="text-[10px] text-slate-400 mb-2">แสดงเปอร์เซ็นต์สถานะอุปกรณ์ตรวจวัดในโรงพยาบาล</p>
          </div>
          <div className="flex flex-col items-center justify-center py-2 relative">
            {totalStatusData === 0 ? (
              <div className="text-slate-400 text-xs">ไม่มีข้อมูลเพื่อแสดงผล</div>
            ) : (
              <>
                <svg width="150" height="150" className="transform -rotate-90">
                  {(() => {
                    let accumulatedPercent = 0;
                    return statusData.map((item, idx) => {
                      const percent = (item.count / totalStatusData) * 100;
                      const radius = 50;
                      const circumference = 2 * Math.PI * radius;
                      const strokeDasharray = circumference;
                      const strokeDashoffset = circumference - (percent / 100) * circumference;
                      const rotation = (accumulatedPercent / 100) * 360;
                      accumulatedPercent += percent;

                      return (
                        <circle
                          key={idx}
                          cx="75"
                          cy="75"
                          r={radius}
                          fill="transparent"
                          stroke={item.color}
                          strokeWidth="15"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          transform={`rotate(${rotation} 75 75)`}
                          className="transition-all duration-500 cursor-pointer hover:stroke-[18px]"
                          onMouseEnter={() => setHoveredIndex(idx)}
                          onMouseLeave={() => setHoveredIndex(null)}
                        />
                      );
                    });
                  })()}
                  <circle cx="75" cy="75" r="35" fill="white" className="dark:fill-slate-900" />
                </svg>
                {/* Center Label */}
                <div className="absolute text-center">
                  <span className="text-lg font-bold text-slate-800 dark:text-white">
                    {hoveredIndex !== null ? statusData[hoveredIndex].count : totalMachines}
                  </span>
                  <p className="text-[9px] text-slate-400 font-medium">
                    {hoveredIndex !== null ? statusData[hoveredIndex].label : 'เครื่องทั้งหมด'}
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="space-y-1 mt-1" id="chart-status-legend">
            {statusData.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between p-1 rounded-lg text-[11px] transition-colors ${hoveredIndex === idx ? 'bg-slate-50 dark:bg-slate-800' : ''}`}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="flex items-center space-x-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="font-medium text-slate-600 dark:text-slate-300">{item.label}</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{item.count} เครื่อง</span>
                  <span className="text-slate-400 text-[10px]">({Math.round((item.count / totalMachines) * 100)}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: Problems Diagnosed Statistics */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs lg:col-span-2 flex flex-col justify-between" id="chart-problems-card">
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">วิเคราะห์ปัญหาการซ่อม (Diagnostics Statistics)</h3>
              <span className="text-[10px] font-semibold text-sky-600 bg-sky-50 dark:bg-sky-950 dark:text-sky-300 px-2 py-0.5 rounded-full flex items-center">
                <AlertTriangle size={10} className="mr-1" /> ประวัติการส่งซ่อม
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mb-2">
              วิเคราะห์สาเหตุปัญหาที่พบจากการตรวจสอบจริงเพื่อวางแผนบริหารอุปกรณ์และฝึกอบรม
            </p>
          </div>

          <div className="space-y-2 py-1" id="diagnosed-problems-bars">
            {/* User Error */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center space-x-1">
                  <span className="font-medium text-slate-700 dark:text-slate-300">1. เครื่องปกติ / ผู้ใช้ใช้ไม่ถูกวิธี (เช่น เสียบแถบไม่สนิท)</span>
                  <div className="group relative">
                    <HelpCircle size={11} className="text-slate-400 cursor-pointer" />
                    <span className="pointer-events-none absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] p-1.5 rounded shadow-lg w-40 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      พบบ่อยมาก! เกิดจากเสียบแถบตรวจเบี้ยวหรือไม่ลงล็อก เครื่องขึ้น Error แต่พอลองทำใหม่ก็ปกติ
                    </span>
                  </div>
                </div>
                <span className="font-bold text-slate-950 dark:text-white">{problemStats.userError} ครั้ง ({repairs.length ? Math.round((problemStats.userError / repairs.length) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-400 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${repairs.length ? (problemStats.userError / repairs.length) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Battery Dead */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-slate-700 dark:text-slate-300">2. แบตเตอรี่เสื่อม / ถ่านหมด</span>
                <span className="font-bold text-slate-950 dark:text-white">{problemStats.batteryDead} ครั้ง ({repairs.length ? Math.round((problemStats.batteryDead / repairs.length) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-sky-500 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${repairs.length ? (problemStats.batteryDead / repairs.length) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Hardware Fault */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-slate-700 dark:text-slate-300">3. ช่องเสียบแถบตรวจชำรุด / บอร์ดพัง</span>
                <span className="font-bold text-slate-950 dark:text-white">{problemStats.hardwareFault} ครั้ง ({repairs.length ? Math.round((problemStats.hardwareFault / repairs.length) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${repairs.length ? (problemStats.hardwareFault / repairs.length) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Screen Broken */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-slate-700 dark:text-slate-300">4. จอภาพเสียหาย / หน้าจอแตก / สีจาง</span>
                <span className="font-bold text-slate-950 dark:text-white">{problemStats.screenBroken} ครั้ง ({repairs.length ? Math.round((problemStats.screenBroken / repairs.length) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-purple-500 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${repairs.length ? (problemStats.screenBroken / repairs.length) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Claimed */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-slate-700 dark:text-slate-300">5. ชำรุดรุนแรง ส่งเคลมผู้จัดจำหน่าย</span>
                <span className="font-bold text-slate-950 dark:text-white">{problemStats.sentClaim} ครั้ง ({repairs.length ? Math.round((problemStats.sentClaim / repairs.length) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-slate-600 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${repairs.length ? (problemStats.sentClaim / repairs.length) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="mt-2.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100/60 dark:border-amber-900/30 text-amber-800 dark:text-amber-300 p-2 rounded-xl text-[10px] flex items-start space-x-1.5" id="insight-box">
            <Lightbulb className="text-amber-500 shrink-0 mt-0.5" size={13} />
            <div>
              <span className="font-bold">ข้อเสนอแนะเชิงป้องกัน:</span>
              <p className="mt-0.5 text-amber-700 dark:text-amber-400 leading-snug">
                ปัญหา <span className="font-semibold">"ผู้ใช้ใช้ผิดวิธี" ({repairs.length ? Math.round((problemStats.userError / repairs.length) * 100) : 0}%)</span> และ <span className="font-semibold">"ถ่านหมด" ({repairs.length ? Math.round((problemStats.batteryDead / repairs.length) * 100) : 0}%)</span> คือสาเหตุหลัก แนะนำแจกโปสเตอร์สาธิต และกระจายถ่านสำรอง CR2032 ไปที่ Ward เพื่อลดภาระการส่งซ่อม
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Repairs by Ward (Bottom Row - Ultra Compact list layout) */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs" id="ward-repairs-card">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-0.5">สถิติการส่งซ่อมจำแนกตามหน่วยงาน (5 อันดับแรก)</h3>
        <p className="text-[10px] text-slate-400 mb-3">ตึกหรือกลุ่มงานที่มีความถี่ในการส่งอุปกรณ์เข้ามาแจ้งซ่อมบำรุงสูงที่สุด</p>

        {sortedWardsData.length === 0 ? (
          <div className="text-center py-4 text-slate-400 text-xs">ยังไม่มีข้อมูลแจ้งซ่อมที่ได้รับการบันทึก</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {sortedWardsData.map((item, idx) => {
              const maxCount = Math.max(...sortedWardsData.map(d => d.count));
              const heightPercent = maxCount ? (item.count / maxCount) * 100 : 0;
              return (
                <div key={idx} className="bg-slate-50/50 dark:bg-slate-800/40 p-2.5 rounded-xl flex flex-col justify-between border border-slate-100/50 dark:border-slate-800/80 hover:border-sky-100 dark:hover:border-sky-900 transition-all">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold truncate">{item.ward}</div>
                  <div className="mt-1.5 flex items-baseline space-x-0.5">
                    <span className="text-lg font-black text-sky-600 dark:text-sky-400">{item.count}</span>
                    <span className="text-[10px] text-slate-400">ครั้ง</span>
                  </div>
                  {/* Miniature progress bar */}
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-sky-500 h-full" style={{ width: `${heightPercent}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
