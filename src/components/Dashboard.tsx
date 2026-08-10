/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DtxMachine, RepairRequest } from '../types';
import { Activity, ShieldAlert, Wrench, Package, TrendingUp, AlertTriangle, HelpCircle, Lightbulb } from 'lucide-react';

interface DashboardProps {
  machines: DtxMachine[];
  repairs: RepairRequest[];
}

export default function Dashboard({ machines, repairs }: DashboardProps) {
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
    <div className="space-y-6" id="dashboard-tab">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" id="stats-overview">
        {/* Card 1: Total Machines */}
        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-2xs flex items-center justify-between" id="stat-card-total">
          <div className="space-y-1">
            <span className="text-sm font-semibold text-slate-600">จำนวนเครื่อง DTX ทั้งหมด</span>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-sky-600">{totalMachines}</span>
              <span className="text-xs font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded flex items-center border border-sky-100">
                <TrendingUp size={12} className="mr-0.5 text-sky-600" /> เครื่อง
              </span>
            </div>
            <p className="text-xs text-slate-400">คลังเครื่องตรวจน้ำตาลในระบบ</p>
          </div>
          <div className="p-3 bg-sky-50 text-sky-600 rounded-xl border border-sky-100 shrink-0">
            <Package size={24} />
          </div>
        </div>

        {/* Card 2: Active Count */}
        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-2xs flex items-center justify-between" id="stat-card-active">
          <div className="space-y-1">
            <span className="text-sm font-semibold text-slate-600">พร้อมใช้งานปกติ</span>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-sky-600">{activeCount}</span>
              <span className="text-xs text-slate-400">จากทั้งหมด</span>
            </div>
            <p className="text-xs text-slate-400">คิดเป็น {totalMachines ? Math.round((activeCount / totalMachines) * 100) : 0}% ของคลัง</p>
          </div>
          <div className="p-3 bg-sky-50 text-sky-600 rounded-xl border border-sky-100 shrink-0">
            <Activity size={24} />
          </div>
        </div>

        {/* Card 3: Repairing Count */}
        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-2xs flex items-center justify-between" id="stat-card-repairs">
          <div className="space-y-1">
            <span className="text-sm font-semibold text-slate-600">กำลังส่งซ่อม/แจ้งซ่อม</span>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-sky-700">{activeRepairs}</span>
              <span className="text-xs text-slate-400">รายการ</span>
            </div>
            <p className="text-xs text-slate-400">ซ่อมเสร็จแล้วคืนวอร์ด {completedRepairsCount} เครื่อง</p>
          </div>
          <div className="p-3 bg-sky-50 text-sky-600 rounded-xl border border-sky-100 shrink-0">
            <Wrench size={24} />
          </div>
        </div>

        {/* Card 4: Lost/Claim Counts */}
        <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-2xs flex items-center justify-between" id="stat-card-claims">
          <div className="space-y-1">
            <span className="text-sm font-semibold text-slate-600">ชำรุดรอเคลม/สูญหาย</span>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-sky-800">{(waitingClaimCount + claimedCount) + lostCount}</span>
              <span className="text-xs text-slate-400">เครื่อง</span>
            </div>
            <p className="text-xs text-slate-400">หาย: {lostCount} | รอเคลม: {waitingClaimCount} | เคลมแล้ว: {claimedCount}</p>
          </div>
          <div className="p-3 bg-sky-50 text-sky-600 rounded-xl border border-sky-100 shrink-0">
            <ShieldAlert size={24} />
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-charts">
        {/* Chart 1: Status Donut Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between" id="chart-status-card">
          <div>
            <h3 className="font-semibold text-slate-900 text-base mb-1">สัดส่วนสถานะเครื่อง DTX ทั้งหมด</h3>
            <p className="text-xs text-slate-400 mb-4">แสดงเปอร์เซ็นต์สถานะอุปกรณ์ตรวจวัดในโรงพยาบาล</p>
          </div>
          <div className="flex flex-col items-center justify-center py-4 relative">
            {totalStatusData === 0 ? (
              <div className="text-slate-400 text-sm">ไม่มีข้อมูลเพื่อแสดงผล</div>
            ) : (
              <>
                <svg width="200" height="200" className="transform -rotate-90">
                  {(() => {
                    let accumulatedPercent = 0;
                    return statusData.map((item, idx) => {
                      const percent = (item.count / totalStatusData) * 100;
                      const radius = 70;
                      const circumference = 2 * Math.PI * radius;
                      const strokeDasharray = circumference;
                      const strokeDashoffset = circumference - (percent / 100) * circumference;
                      const rotation = (accumulatedPercent / 100) * 360;
                      accumulatedPercent += percent;

                      return (
                        <circle
                          key={idx}
                          cx="100"
                          cy="100"
                          r={radius}
                          fill="transparent"
                          stroke={item.color}
                          strokeWidth="20"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          transform={`rotate(${rotation} 100 100)`}
                          className="transition-all duration-500 cursor-pointer hover:stroke-[24px]"
                          onMouseEnter={() => setHoveredIndex(idx)}
                          onMouseLeave={() => setHoveredIndex(null)}
                        />
                      );
                    });
                  })()}
                  <circle cx="100" cy="100" r="50" fill="white" />
                </svg>
                {/* Center Label */}
                <div className="absolute text-center">
                  <span className="text-2xl font-bold text-slate-800">
                    {hoveredIndex !== null ? statusData[hoveredIndex].count : totalMachines}
                  </span>
                  <p className="text-xs text-slate-400 font-medium">
                    {hoveredIndex !== null ? statusData[hoveredIndex].label : 'เครื่องทั้งหมด'}
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="space-y-1.5 mt-2" id="chart-status-legend">
            {statusData.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between p-1.5 rounded-lg text-xs transition-colors ${hoveredIndex === idx ? 'bg-slate-50' : ''}`}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="font-medium text-slate-600">{item.label}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-800">{item.count} เครื่อง</span>
                  <span className="text-slate-400">({Math.round((item.count / totalMachines) * 100)}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: Problems Diagnosed Statistics */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs lg:col-span-2 flex flex-col justify-between" id="chart-problems-card">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-slate-900 text-base">วิเคราะห์ปัญหาการซ่อม (Diagnostics Statistics)</h3>
              <span className="text-xs font-semibold text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full flex items-center">
                <AlertTriangle size={12} className="mr-1" /> รวบรวมจากประวัติการส่งซ่อม
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              วิเคราะห์สาเหตุปัญหาที่พบจริงจากการตรวจสอบเพื่อนำไปใช้วางแผนฝึกอบรมผู้ใช้หรือจัดหาแบตเตอรี่สำรอง
            </p>
          </div>

          <div className="space-y-4 py-2" id="diagnosed-problems-bars">
            {/* User Error */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1.5">
                  <span className="font-semibold text-slate-700">1. เครื่องไม่ได้เสีย / ผู้ใช้ใช้ไม่ถูกวิธี (เช่น เสียบ Strip ไม่ล็อก)</span>
                  <div className="group relative">
                    <HelpCircle size={13} className="text-slate-400 cursor-pointer" />
                    <span className="pointer-events-none absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] p-2 rounded shadow-lg w-48 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      พบบ่อยมาก! เกิดจากพนักงานเสียบแถบวัดเบี้ยวหรือไม่ลงล็อก ทำให้เครื่องแจ้ง Error แต่พอลองเสียบใหม่ก็ใช้ได้ปกติ
                    </span>
                  </div>
                </div>
                <span className="font-bold text-slate-900">{problemStats.userError} ครั้ง ({repairs.length ? Math.round((problemStats.userError / repairs.length) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-amber-400 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${repairs.length ? (problemStats.userError / repairs.length) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Battery Dead */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">2. ถ่านหมด / แบตเตอรี่เสื่อม</span>
                <span className="font-bold text-slate-900">{problemStats.batteryDead} ครั้ง ({repairs.length ? Math.round((problemStats.batteryDead / repairs.length) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-sky-500 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${repairs.length ? (problemStats.batteryDead / repairs.length) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Hardware Fault */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">3. ช่องเสียบแผ่นตรวจชำรุด / บอร์ดเสียหาย</span>
                <span className="font-bold text-slate-900">{problemStats.hardwareFault} ครั้ง ({repairs.length ? Math.round((problemStats.hardwareFault / repairs.length) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${repairs.length ? (problemStats.hardwareFault / repairs.length) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Screen Broken */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">4. จอภาพเสียหาย / แตก / ไม่แสดงผล</span>
                <span className="font-bold text-slate-900">{problemStats.screenBroken} ครั้ง ({repairs.length ? Math.round((problemStats.screenBroken / repairs.length) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-purple-500 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${repairs.length ? (problemStats.screenBroken / repairs.length) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Claimed */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">5. ชำรุดหนักส่งเครมบริษัทภายนอก / ประกัน</span>
                <span className="font-bold text-slate-900">{problemStats.sentClaim} ครั้ง ({repairs.length ? Math.round((problemStats.sentClaim / repairs.length) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-slate-600 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${repairs.length ? (problemStats.sentClaim / repairs.length) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-amber-50 border border-amber-100 text-amber-800 p-3 rounded-lg text-xs flex items-start space-x-2" id="insight-box">
            <Lightbulb className="text-amber-500 shrink-0 mt-0.5" size={16} />
            <div>
              <span className="font-semibold">ข้อเสนอแนะเชิงป้องกัน:</span>
              <p className="mt-0.5 text-amber-700 leading-relaxed">
                จากสถิติชี้ว่า ปัญหา <span className="font-semibold">"ผู้ใช้ใช้ผิดวิธี/เสียบไม่ล็อก" ({repairs.length ? Math.round((problemStats.userError / repairs.length) * 100) : 0}%)</span> และ <span className="font-semibold">"ถ่านหมด" ({repairs.length ? Math.round((problemStats.batteryDead / repairs.length) * 100) : 0}%)</span> เป็นสองสาเหตุหลักที่ทำให้อุปกรณ์ถูกส่งซ่อมมายังแลป ซึ่งจริง ๆ เครื่องสามารถทำงานได้ปกติ แนะนำให้จัดทำโปสเตอร์สอนการใช้งานเบื้องต้น หรือกระจายถ่านสำรอง CR2032 ไว้ที่ Ward เพื่อลดภาระการส่งซ่อม
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Repairs by Ward (Bottom Row) */}
      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs" id="ward-repairs-card">
        <h3 className="font-semibold text-slate-900 text-base mb-1">สถิติการส่งซ่อมจำแนกตามหน่วยงาน (5 อันดับแรก)</h3>
        <p className="text-xs text-slate-400 mb-5">ตึกหรือกลุ่มงานที่มีความถี่ในการส่งอุปกรณ์เข้ามาแจ้งซ่อมบำรุงสูงที่สุด</p>

        {sortedWardsData.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">ยังไม่มีข้อมูลแจ้งซ่อมที่ได้รับการบันทึก</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {sortedWardsData.map((item, idx) => {
              // Find max for scaling
              const maxCount = Math.max(...sortedWardsData.map(d => d.count));
              const heightPercent = maxCount ? (item.count / maxCount) * 100 : 0;
              return (
                <div key={idx} className="bg-slate-50/50 p-4 rounded-lg flex flex-col justify-between border border-slate-100 hover:border-sky-100 hover:bg-slate-50 transition-all">
                  <div className="text-xs text-slate-500 font-semibold">{item.ward}</div>
                  <div className="mt-4 flex items-baseline space-x-1">
                    <span className="text-2xl font-bold text-sky-600">{item.count}</span>
                    <span className="text-xs text-slate-400">ครั้ง</span>
                  </div>
                  {/* Miniature progress bar */}
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2.5 overflow-hidden">
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
