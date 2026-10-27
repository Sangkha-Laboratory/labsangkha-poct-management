/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import CustomSelect from './CustomSelect';
import { DtxMachine, QcRecord, QcLotConfig, MasterWard } from '../types';
import { formatThaiDateOnly, getThaiTodayDateOnly } from '../lib/dateUtils';
import { 
  TrendingUp, BarChart3, Activity, Filter, Layers, 
  CheckCircle2, AlertTriangle, AlertOctagon, Info, 
  Search, ArrowUpDown, ChevronLeft, ChevronRight, Sparkles, RefreshCw,
  Calendar, Building2, SlidersVertical, ExternalLink,
  Clock, ShieldAlert, Check, Eye
} from 'lucide-react';

interface QCComparisonChartProps {
  machines: DtxMachine[];
  qcRecords: QcRecord[];
  lotConfigs: QcLotConfig[];
  wards?: MasterWard[];
  machineDisplayMode?: 'code' | 'sn' | 'both';
  onSelectMachineForLJ?: (serialNumber: string) => void;
}

export interface MachineLotStats {
  serialNumber: string;
  displayLabel: string;
  ward: string;
  machineSerial: string;
  brand: string;
  model: string;
  testsCount: number;
  hasTestedInLot: boolean;
  level1Mean: number;
  level1SD: number;
  level1Min: number;
  level1Max: number;
  level1Values: number[];
  level2Mean: number;
  level2SD: number;
  level2Min: number;
  level2Max: number;
  level2Values: number[];
  level3Mean: number;
  level3SD: number;
  level3Min: number;
  level3Max: number;
  level3Values: number[];
  lastTestedDate?: string;
  lastOperator?: string;
}

export interface DailyComparisonPoint {
  date: string;
  displayDate: string;
  machinesCount: number;
  dailyGroupMean: number;
  dailyGroupSD: number;
  dailyMin: number;
  dailyMax: number;
  machineValue?: number;
  machineRecordId?: string;
  operator?: string;
  diffFromGroup?: number;
  biasPercent?: number;
  sdi?: number;
  status?: 'normal' | 'warning' | 'outlier' | 'not_tested';
}

export default function QCComparisonChart({
  machines,
  qcRecords,
  lotConfigs,
  wards = [],
  machineDisplayMode = 'code',
  onSelectMachineForLJ
}: QCComparisonChartProps) {
  // Helper to format machine display text
  const formatMachineLabel = (codeOrId: string) => {
    if (!codeOrId) return '-';
    const cleanKey = codeOrId.trim().toUpperCase();
    const machine = machines.find(m => 
      (m.serialNumber && m.serialNumber.trim().toUpperCase() === cleanKey) ||
      (m.id && m.id === codeOrId)
    );
    const code = machine?.serialNumber || codeOrId;
    const sn = (machine?.machineSerial && machine.machineSerial !== '-') ? machine.machineSerial.trim() : '';

    if (machineDisplayMode === 'sn') return sn || code;
    if (machineDisplayMode === 'both') return sn ? `${code} (${sn})` : code;
    return code;
  };

  // 1. Available LOT numbers
  const availableLots = useMemo(() => {
    const lotMap = new Map<string, { count: number; lastDate: string }>();

    qcRecords.forEach(r => {
      const lot = r.lotNumber ? String(r.lotNumber).trim() : '';
      if (!lot) return;
      const existing = lotMap.get(lot) || { count: 0, lastDate: r.date || '' };
      lotMap.set(lot, {
        count: existing.count + 1,
        lastDate: (r.date && r.date > existing.lastDate) ? r.date : existing.lastDate
      });
    });

    lotConfigs.forEach(cfg => {
      const lot = cfg.lotNumber ? String(cfg.lotNumber).trim() : '';
      if (lot && !lotMap.has(lot)) {
        lotMap.set(lot, { count: 0, lastDate: cfg.receivedDate || '' });
      }
    });

    return Array.from(lotMap.entries())
      .sort((a, b) => b[1].count - a[1].count || b[1].lastDate.localeCompare(a[1].lastDate))
      .map(([lot, info]) => ({
        lotNumber: lot,
        testCount: info.count,
        lastDate: info.lastDate
      }));
  }, [qcRecords, lotConfigs]);

  // Selected LOT State
  const [selectedLot, setSelectedLot] = useState<string>(() => {
    if (lotConfigs.length > 0) return lotConfigs[0].lotNumber;
    return availableLots[0]?.lotNumber || '';
  });

  // Ensure selectedLot stays valid
  React.useEffect(() => {
    if (!selectedLot && availableLots.length > 0) {
      setSelectedLot(availableLots[0].lotNumber);
    }
  }, [availableLots, selectedLot]);

  // 2. Scope Filter: 'same_lot' vs 'all_machines'
  const [scope, setScope] = useState<'same_lot' | 'all_machines'>('same_lot');

  // 3. Level Filter: 1, 2, 3 or 'all'
  const [selectedLevel, setSelectedLevel] = useState<1 | 2 | 3 | 'all'>('all');

  // 4. Time Range Filter
  const [timeRange, setTimeRange] = useState<'all' | '7days' | '15days' | '30days' | 'this_month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // 5. Ward Filter
  const [selectedWard, setSelectedWard] = useState<string>('all');

  // 6. Focused / Highlighted Machine (Default to first machine in LOT)
  const [focusedSerial, setFocusedSerial] = useState<string | null>(null);

  // 7. Table Search and Sort
  const [tableSearch, setTableSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<'serial' | 'ward' | 'diff' | 'sdi' | 'count'>('diff');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Visual Chart Mode:
  // - 'daily_timeline': ติดตามรายวันเปรียบเทียบกลุ่ม (Day-by-day timeline to see which day it started to drift/fail)
  // - 'fleet_summary': สรุปภาพรวมเครื่องทั้งหมด (Inter-instrument overview & SDI ranking)
  const [chartSubView, setChartSubView] = useState<'daily_timeline' | 'fleet_summary'>('daily_timeline');

  // Secondary toggle for fleet summary (mean vs sdi)
  const [fleetMetricMode, setFleetMetricMode] = useState<'mean' | 'sdi'>('sdi');

  // Overlay all machines in timeline mode
  const [showAllMachinesOverlay, setShowAllMachinesOverlay] = useState<boolean>(true);

  // Active tooltip state for timeline chart points
  const [activeTimelineTooltip, setActiveTimelineTooltip] = useState<{ pt: DailyComparisonPoint; x: number; y: number } | null>(null);

  // Daily comparison table pagination state
  const [dailyTablePage, setDailyTablePage] = useState<number>(1);
  const dailyTablePageSize = 10;

  React.useEffect(() => {
    setDailyTablePage(1);
  }, [focusedSerial, selectedLot, selectedLevel]);

  // Filter records by Date Range and LOT
  const filteredLotRecords = useMemo(() => {
    if (!selectedLot) return [];

    let start: Date | null = null;
    let end: Date | null = null;
    const now = new Date();

    if (timeRange === '7days') {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeRange === '15days') {
      start = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    } else if (timeRange === '30days') {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (timeRange === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (timeRange === 'custom') {
      if (customStartDate) start = new Date(customStartDate);
      if (customEndDate) {
        end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
      }
    }

    return qcRecords.filter(r => {
      if (r.lotNumber !== selectedLot) return false;
      if (selectedWard !== 'all' && r.ward !== selectedWard) return false;
      if (start) {
        const d = new Date(r.date);
        if (d < start) return false;
      }
      if (end) {
        const d = new Date(r.date);
        if (d > end) return false;
      }
      return true;
    });
  }, [qcRecords, selectedLot, timeRange, customStartDate, customEndDate, selectedWard]);

  // Active LOT configuration (Target, SD, Min, Max from QcLotConfig)
  const activeLotConfig = useMemo(() => {
    return lotConfigs.find(c => c.lotNumber === selectedLot);
  }, [lotConfigs, selectedLot]);

  // Compute machine aggregate stats for this LOT
  const machinesStats = useMemo<MachineLotStats[]>(() => {
    const machineRecordsMap = new Map<string, QcRecord[]>();
    filteredLotRecords.forEach(r => {
      const serial = r.serialNumber ? r.serialNumber.trim().toUpperCase() : '';
      if (!serial) return;
      const list = machineRecordsMap.get(serial) || [];
      list.push(r);
      machineRecordsMap.set(serial, list);
    });

    let targetMachines: { serial: string; ward: string; machineSerial: string; brand: string; model: string }[] = [];

    if (scope === 'same_lot') {
      machineRecordsMap.forEach((_, serial) => {
        const m = machines.find(item => item.serialNumber?.trim().toUpperCase() === serial);
        targetMachines.push({
          serial,
          ward: m?.ward || machineRecordsMap.get(serial)?.[0]?.ward || 'ไม่ระบุ',
          machineSerial: m?.machineSerial || '',
          brand: m?.brand || 'Accu-Chek',
          model: m?.model || 'Active/Instant'
        });
      });
    } else {
      machines.forEach(m => {
        const serial = m.serialNumber ? m.serialNumber.trim().toUpperCase() : '';
        if (!serial) return;
        if (selectedWard !== 'all' && m.ward !== selectedWard) return;
        targetMachines.push({
          serial,
          ward: m.ward || 'ไม่ระบุ',
          machineSerial: m.machineSerial || '',
          brand: m.brand || 'Accu-Chek',
          model: m.model || 'Active/Instant'
        });
      });
    }

    const uniqueSerials = new Map<string, typeof targetMachines[0]>();
    targetMachines.forEach(tm => {
      if (!uniqueSerials.has(tm.serial)) uniqueSerials.set(tm.serial, tm);
    });

    const results: MachineLotStats[] = [];

    uniqueSerials.forEach((tm, serial) => {
      const recs = machineRecordsMap.get(serial) || [];
      const hasTested = recs.length > 0;

      const l1Vals = recs.map(r => Number(r.level1)).filter(v => !isNaN(v) && v > 0);
      const l1Mean = l1Vals.length > 0 ? l1Vals.reduce((a, b) => a + b, 0) / l1Vals.length : 0;
      const l1SD = l1Vals.length > 1
        ? Math.sqrt(l1Vals.reduce((acc, v) => acc + Math.pow(v - l1Mean, 2), 0) / (l1Vals.length - 1))
        : 0;

      const l2Vals = recs.map(r => Number(r.level2)).filter(v => !isNaN(v) && v > 0);
      const l2Mean = l2Vals.length > 0 ? l2Vals.reduce((a, b) => a + b, 0) / l2Vals.length : 0;
      const l2SD = l2Vals.length > 1
        ? Math.sqrt(l2Vals.reduce((acc, v) => acc + Math.pow(v - l2Mean, 2), 0) / (l2Vals.length - 1))
        : 0;

      const l3Vals = recs.map(r => Number(r.level3)).filter(v => !isNaN(v) && v > 0);
      const l3Mean = l3Vals.length > 0 ? l3Vals.reduce((a, b) => a + b, 0) / l3Vals.length : 0;
      const l3SD = l3Vals.length > 1
        ? Math.sqrt(l3Vals.reduce((acc, v) => acc + Math.pow(v - l3Mean, 2), 0) / (l3Vals.length - 1))
        : 0;

      const lastRecord = recs.length > 0 ? recs[recs.length - 1] : undefined;

      results.push({
        serialNumber: serial,
        displayLabel: formatMachineLabel(serial),
        ward: tm.ward,
        machineSerial: tm.machineSerial,
        brand: tm.brand,
        model: tm.model,
        testsCount: recs.length,
        hasTestedInLot: hasTested,
        level1Mean: Number(l1Mean.toFixed(1)),
        level1SD: Number(l1SD.toFixed(2)),
        level1Min: l1Vals.length > 0 ? Math.min(...l1Vals) : 0,
        level1Max: l1Vals.length > 0 ? Math.max(...l1Vals) : 0,
        level1Values: l1Vals,
        level2Mean: Number(l2Mean.toFixed(1)),
        level2SD: Number(l2SD.toFixed(2)),
        level2Min: l2Vals.length > 0 ? Math.min(...l2Vals) : 0,
        level2Max: l2Vals.length > 0 ? Math.max(...l2Vals) : 0,
        level2Values: l2Vals,
        level3Mean: Number(l3Mean.toFixed(1)),
        level3SD: Number(l3SD.toFixed(2)),
        level3Min: l3Vals.length > 0 ? Math.min(...l3Vals) : 0,
        level3Max: l3Vals.length > 0 ? Math.max(...l3Vals) : 0,
        level3Values: l3Vals,
        lastTestedDate: lastRecord?.date,
        lastOperator: lastRecord?.operator
      });
    });

    return results;
  }, [filteredLotRecords, machines, scope, selectedWard, machineDisplayMode]);

  // Set default focused machine if not set
  React.useEffect(() => {
    if (!focusedSerial && machinesStats.length > 0) {
      const firstActive = machinesStats.find(m => m.hasTestedInLot);
      if (firstActive) setFocusedSerial(firstActive.serialNumber);
    }
  }, [machinesStats, focusedSerial]);

  // Overall Group Statistics for this LOT across all machines
  const groupStats = useMemo(() => {
    const activeMachines = machinesStats.filter(m => m.hasTestedInLot);
    const totalMachines = activeMachines.length;
    const totalTests = filteredLotRecords.length;

    const calcLevelGroup = (key: 'level1' | 'level2' | 'level3', target?: number, targetSD?: number) => {
      const allValues = filteredLotRecords
        .map(r => Number(r[key]))
        .filter(v => !isNaN(v) && v > 0);

      const n = allValues.length;
      if (n === 0) {
        return {
          n: 0,
          mean: target || 0,
          sd: targetSD || 1,
          cv: 0,
          min: 0,
          max: 0,
          target: target || 0,
          targetSD: targetSD || 1
        };
      }

      const mean = allValues.reduce((a, b) => a + b, 0) / n;
      const sd = n > 1
        ? Math.sqrt(allValues.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n - 1))
        : 1;
      const cv = mean > 0 ? (sd / mean) * 100 : 0;

      return {
        n,
        mean: Number(mean.toFixed(1)),
        sd: Number(sd.toFixed(2)),
        cv: Number(cv.toFixed(2)),
        min: Math.min(...allValues),
        max: Math.max(...allValues),
        target: target || Number(mean.toFixed(1)),
        targetSD: targetSD || Number(sd.toFixed(2))
      };
    };

    return {
      totalMachinesInLot: totalMachines,
      totalHospitalMachines: machines.length,
      totalTests,
      level1: calcLevelGroup('level1', activeLotConfig?.level1Target, activeLotConfig?.level1SD),
      level2: calcLevelGroup('level2', activeLotConfig?.level2Target, activeLotConfig?.level2SD),
      level3: calcLevelGroup('level3', activeLotConfig?.level3Target, activeLotConfig?.level3SD)
    };
  }, [machinesStats, filteredLotRecords, machines.length, activeLotConfig]);

  // Active level calculation key
  const currentActiveLevel = selectedLevel === 'all' ? 2 : selectedLevel;

  const currentLevelGroup = useMemo(() => {
    if (currentActiveLevel === 1) return { ...groupStats.level1, title: 'Level 1 (Low)', color: '#10b981', badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    if (currentActiveLevel === 3) return { ...groupStats.level3, title: 'Level 3 (High)', color: '#9333ea', badgeBg: 'bg-purple-50 text-purple-800 border-purple-200' };
    return { ...groupStats.level2, title: 'Level 2 (Normal)', color: '#0284c7', badgeBg: 'bg-sky-50 text-sky-800 border-sky-200' };
  }, [currentActiveLevel, groupStats]);

  // Machine Comparison Rows for Overall Fleet View
  const machineComparisonRows = useMemo(() => {
    const meanKey = currentActiveLevel === 1 ? 'level1Mean' : currentActiveLevel === 3 ? 'level3Mean' : 'level2Mean';
    const sdKey = currentActiveLevel === 1 ? 'level1SD' : currentActiveLevel === 3 ? 'level3SD' : 'level2SD';
    const minKey = currentActiveLevel === 1 ? 'level1Min' : currentActiveLevel === 3 ? 'level3Min' : 'level2Min';
    const maxKey = currentActiveLevel === 1 ? 'level1Max' : currentActiveLevel === 3 ? 'level3Max' : 'level2Max';
    const groupMean = currentLevelGroup.mean;
    const groupSD = currentLevelGroup.sd > 0 ? currentLevelGroup.sd : 1;

    return machinesStats.map(m => {
      const machineMean = m[meanKey];
      const machineSD = m[sdKey];
      const machineMin = m[minKey];
      const machineMax = m[maxKey];

      if (!m.hasTestedInLot || machineMean === 0) {
        return {
          ...m,
          machineMean: 0,
          machineSD: 0,
          machineMin: 0,
          machineMax: 0,
          diffFromGroup: 0,
          biasPercent: 0,
          sdi: 0,
          status: 'no_data' as const,
          statusLabel: 'ยังไม่ได้ตรวจ LOT นี้',
          statusColor: 'text-slate-400 bg-slate-100 border-slate-200'
        };
      }

      const diff = machineMean - groupMean;
      const biasPercent = groupMean > 0 ? (diff / groupMean) * 100 : 0;
      const sdi = diff / groupSD;
      const absSdi = Math.abs(sdi);

      let status: 'normal' | 'warning' | 'outlier' = 'normal';
      let statusLabel = 'สอดคล้องกับกลุ่มปกติ';
      let statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';

      if (absSdi >= 2.0) {
        status = 'outlier';
        statusLabel = 'แตกต่างจากกลุ่ม (|SDI| ≥ 2.0)';
        statusColor = 'text-rose-700 bg-rose-50 border-rose-300 animate-pulse';
      } else if (absSdi >= 1.5) {
        status = 'warning';
        statusLabel = 'เริ่มเบี่ยงเบน (1.5 ≤ |SDI| < 2.0)';
        statusColor = 'text-amber-700 bg-amber-50 border-amber-200';
      }

      return {
        ...m,
        machineMean,
        machineSD,
        machineMin,
        machineMax,
        diffFromGroup: Number(diff.toFixed(1)),
        biasPercent: Number(biasPercent.toFixed(1)),
        sdi: Number(sdi.toFixed(2)),
        status,
        statusLabel,
        statusColor
      };
    });
  }, [machinesStats, currentActiveLevel, currentLevelGroup]);

  // =========================================================================
  // --- DAILY TIME-SERIES COMPARISON & OUTLIER DATE DETECTION LOGIC ---
  // =========================================================================
  // Groups records by day, calculates Daily Group Mean & SD, and maps focused machine's runs
  const dailyTimelineData = useMemo(() => {
    const dataKey = currentActiveLevel === 1 ? 'level1' : currentActiveLevel === 3 ? 'level3' : 'level2';
    const statusKey = currentActiveLevel === 1 ? 'level1Status' : currentActiveLevel === 3 ? 'level3Status' : 'level2Status';

    // 1. Group all records in this lot by date
    const dateMap = new Map<string, QcRecord[]>();
    filteredLotRecords.forEach(r => {
      if (!r.date) return;
      const dStr = r.date.includes('T') ? r.date.split('T')[0] : r.date.trim();
      const list = dateMap.get(dStr) || [];
      list.push(r);
      dateMap.set(dStr, list);
    });

    // Sort dates chronologically (oldest to newest)
    const sortedDates = Array.from(dateMap.keys()).sort();

    // 2. Compute timeline points
    const points: DailyComparisonPoint[] = [];

    // All machines records mapped by serial for multi-line cloud
    const allMachinesDateMap = new Map<string, Map<string, number>>();

    sortedDates.forEach(dateStr => {
      const recs = dateMap.get(dateStr) || [];
      const values = recs
        .map(r => Number(r[dataKey]))
        .filter(v => !isNaN(v) && v > 0);

      const n = values.length;
      const dailyGroupMean = n > 0 ? Number((values.reduce((a, b) => a + b, 0) / n).toFixed(1)) : 0;
      const dailyGroupSD = n > 1
        ? Number(Math.sqrt(values.reduce((acc, v) => acc + Math.pow(v - dailyGroupMean, 2), 0) / (n - 1)).toFixed(2))
        : (currentLevelGroup.sd > 0 ? currentLevelGroup.sd : 1);

      // Record values for all machines on this date
      recs.forEach(r => {
        const serial = r.serialNumber?.trim().toUpperCase();
        if (serial) {
          if (!allMachinesDateMap.has(serial)) allMachinesDateMap.set(serial, new Map());
          allMachinesDateMap.get(serial)!.set(dateStr, Number(r[dataKey]));
        }
      });

      // Find focused machine record on this date
      let machineVal: number | undefined = undefined;
      let machineRecId: string | undefined = undefined;
      let op: string | undefined = undefined;

      if (focusedSerial) {
        const targetClean = focusedSerial.trim().toUpperCase();
        const fRec = recs.find(r => r.serialNumber?.trim().toUpperCase() === targetClean);
        if (fRec) {
          machineVal = Number(fRec[dataKey]);
          machineRecId = fRec.id;
          op = fRec.operator;
        }
      }

      let diff: number | undefined = undefined;
      let biasPct: number | undefined = undefined;
      let sdi: number | undefined = undefined;
      let status: 'normal' | 'warning' | 'outlier' | 'not_tested' = 'not_tested';

      if (machineVal !== undefined && !isNaN(machineVal) && machineVal > 0) {
        diff = Number((machineVal - dailyGroupMean).toFixed(1));
        biasPct = dailyGroupMean > 0 ? Number(((diff / dailyGroupMean) * 100).toFixed(1)) : 0;
        const sdToUse = dailyGroupSD > 0 ? dailyGroupSD : 1;
        sdi = Number((diff / sdToUse).toFixed(2));

        const absSdi = Math.abs(sdi);
        if (absSdi >= 2.0) status = 'outlier';
        else if (absSdi >= 1.5) status = 'warning';
        else status = 'normal';
      }

      points.push({
        date: dateStr,
        displayDate: formatThaiDateOnly(dateStr),
        machinesCount: n,
        dailyGroupMean,
        dailyGroupSD,
        dailyMin: values.length > 0 ? Math.min(...values) : 0,
        dailyMax: values.length > 0 ? Math.max(...values) : 0,
        machineValue: machineVal,
        machineRecordId: machineRecId,
        operator: op,
        diffFromGroup: diff,
        biasPercent: biasPct,
        sdi,
        status
      });
    });

    // 3. Detect Outlier Starting Date & Shift Analysis for the focused machine
    let firstOutlierDate: string | null = null;
    let firstOutlierValue: number | null = null;
    let firstOutlierGroupMean: number | null = null;
    let firstOutlierSdi: number | null = null;
    let consecutiveHighDays = 0;
    let consecutiveLowDays = 0;
    let driftWarning: string | null = null;

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      if (pt.status === 'outlier' && !firstOutlierDate) {
        firstOutlierDate = pt.displayDate;
        firstOutlierValue = pt.machineValue || null;
        firstOutlierGroupMean = pt.dailyGroupMean;
        firstOutlierSdi = pt.sdi || null;
      }

      // Check shift/drift (4+ consecutive days with bias in same direction)
      if (pt.diffFromGroup !== undefined) {
        if (pt.diffFromGroup > 0) {
          consecutiveHighDays++;
          consecutiveLowDays = 0;
        } else if (pt.diffFromGroup < 0) {
          consecutiveLowDays++;
          consecutiveHighDays = 0;
        } else {
          consecutiveHighDays = 0;
          consecutiveLowDays = 0;
        }

        if (consecutiveHighDays >= 4 && !driftWarning) {
          driftWarning = `พบแนวโน้ม (Shift/Trend): ค่าสูงกว่ากลุ่มเฉลี่ยต่อเนื่อง ${consecutiveHighDays} วันติดต่อกัน (เริ่มตั้งแต่วันที่ ${points[i - consecutiveHighDays + 1]?.displayDate})`;
        } else if (consecutiveLowDays >= 4 && !driftWarning) {
          driftWarning = `พบแนวโน้ม (Shift/Trend): ค่าต่ำกว่ากลุ่มเฉลี่ยต่อเนื่อง ${consecutiveLowDays} วันติดต่อกัน (เริ่มตั้งแต่วันที่ ${points[i - consecutiveLowDays + 1]?.displayDate})`;
        }
      }
    }

    return {
      points,
      sortedDates,
      allMachinesDateMap,
      firstOutlierDate,
      firstOutlierValue,
      firstOutlierGroupMean,
      firstOutlierSdi,
      driftWarning
    };
  }, [filteredLotRecords, currentActiveLevel, focusedSerial, currentLevelGroup.sd]);

  const validDailyRows = useMemo(() => {
    return dailyTimelineData.points.filter(p => p.machineValue !== undefined && p.machineValue > 0);
  }, [dailyTimelineData.points]);

  const totalDailyPages = Math.ceil(validDailyRows.length / dailyTablePageSize);
  const paginatedDailyRows = useMemo(() => {
    const start = (dailyTablePage - 1) * dailyTablePageSize;
    return validDailyRows.slice(start, start + dailyTablePageSize);
  }, [validDailyRows, dailyTablePage]);

  // Displayed rows for table (filtered and sorted)
  const displayedRows = useMemo(() => {
    let list = [...machineComparisonRows];

    if (tableSearch.trim()) {
      const q = tableSearch.trim().toLowerCase();
      list = list.filter(r => 
        r.serialNumber.toLowerCase().includes(q) ||
        r.displayLabel.toLowerCase().includes(q) ||
        r.ward.toLowerCase().includes(q) ||
        r.machineSerial.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      if (sortBy === 'serial') {
        valA = a.serialNumber;
        valB = b.serialNumber;
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (sortBy === 'ward') {
        valA = a.ward;
        valB = b.ward;
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (sortBy === 'count') {
        valA = a.testsCount;
        valB = b.testsCount;
      }
      if (sortBy === 'diff') {
        valA = Math.abs(a.diffFromGroup);
        valB = Math.abs(b.diffFromGroup);
      }
      if (sortBy === 'sdi') {
        valA = Math.abs(a.sdi);
        valB = Math.abs(b.sdi);
      }

      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [machineComparisonRows, tableSearch, sortBy, sortOrder]);

  const focusedMachineData = useMemo(() => {
    if (!focusedSerial) return null;
    return machineComparisonRows.find(r => r.serialNumber === focusedSerial) || null;
  }, [focusedSerial, machineComparisonRows]);

  const concordanceSummary = useMemo(() => {
    const tested = machineComparisonRows.filter(r => r.hasTestedInLot);
    const normalCount = tested.filter(r => r.status === 'normal').length;
    const warningCount = tested.filter(r => r.status === 'warning').length;
    const outlierCount = tested.filter(r => r.status === 'outlier').length;
    return {
      testedTotal: tested.length,
      normalCount,
      warningCount,
      outlierCount,
      normalPct: tested.length > 0 ? Math.round((normalCount / tested.length) * 100) : 0
    };
  }, [machineComparisonRows]);

  return (
    <div className="space-y-5 animate-fade-in" id="qc-comparison-dashboard">
      
      {/* 1. Clean Top Header Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center justify-center font-black shrink-0 shadow-2xs">
            <TrendingUp size={20} className="text-sky-600 dark:text-sky-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                เปรียบเทียบระหว่างเครื่องตรวจใน LOT เดียวกัน (Peer Group Comparison)
              </h3>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                LOT BENCHMARK & TIMELINE
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              ติดตามผลตรวจแต่ละครั้งเทียบกับกลุ่มในวันเดียวกัน เพื่อวิเคราะห์แนวโน้มและระบุได้ชัดเจนว่าเริ่มหลุดวันไหน
            </p>
          </div>
        </div>

        {/* View Mode Segmented Switcher (Consolidated to 2 crisp modes) */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold shrink-0 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => setChartSubView('daily_timeline')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              chartSubView === 'daily_timeline'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="ดูกราฟแนวโน้มรายวัน เปรียบเทียบกับค่าเฉลี่ยกลุ่มในแต่ละวัน เพื่อดูว่าเริ่มหลุดวันไหน"
          >
            <Clock size={14} />
            <span>ติดตามรายวัน (Day-by-Day)</span>
          </button>
          <button
            type="button"
            onClick={() => setChartSubView('fleet_summary')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              chartSubView === 'fleet_summary'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs ring-1 ring-slate-200 dark:ring-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="สรุปภาพรวมค่าเฉลี่ยและดัชนี SDI ของเครื่องทั้งหมดใน LOT"
          >
            <BarChart3 size={14} />
            <span>ภาพรวมทุกเครื่อง (Fleet)</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Filter & Settings Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          
          {/* Filter 1: LOT Selection */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers size={13} className="text-sky-600" />
                <span>1. เลือก LOT แถบตรวจ (Strip LOT) *</span>
              </span>
              <span className="text-[10px] text-sky-600 font-mono font-bold">
                {availableLots.length} LOTs
              </span>
            </label>
            <CustomSelect
              value={selectedLot}
              onChange={(e) => {
                setSelectedLot(e.target.value);
              }}
              className="w-full text-xs p-2.5 rounded-xl border border-sky-300 dark:border-sky-800 bg-sky-50/60 dark:bg-sky-950/40 font-bold text-sky-950 dark:text-sky-200 focus:ring-2 focus:ring-sky-500 shadow-2xs"
            >
              {availableLots.map(lot => (
                <option key={lot.lotNumber} value={lot.lotNumber}>
                  LOT {lot.lotNumber} ({lot.testCount} ผลทดสอบ)
                </option>
              ))}
            </CustomSelect>
          </div>

          {/* Filter 2: Scope Selector: 'same_lot' vs 'all_machines' */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Filter size={13} className="text-sky-600" />
              <span>2. ขอบเขตเครื่องเปรียบเทียบ</span>
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setScope('same_lot')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold text-center transition-all cursor-pointer truncate ${
                  scope === 'same_lot'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
                title="แสดงเฉพาะเครื่องที่มีการบันทึกตรวจใน LOT นี้"
              >
                เฉพาะ LOT นี้ ({groupStats.totalMachinesInLot})
              </button>
              <button
                type="button"
                onClick={() => setScope('all_machines')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold text-center transition-all cursor-pointer truncate ${
                  scope === 'all_machines'
                ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
                title="แสดงเครื่องทั้งหมดในโรงพยาบาล"
              >
                ทุกเครื่อง ({groupStats.totalHospitalMachines})
              </button>
            </div>
          </div>

          {/* Filter 3: Ward Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Building2 size={13} className="text-sky-600" />
              <span>3. หน่วยงาน / วอร์ด</span>
            </label>
            <CustomSelect
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 shadow-2xs"
            >
              <option value="all">-- ทุกหน่วยงาน ({wards.length > 0 ? wards.length : 'ทั้งหมด'}) --</option>
              {wards.map((w, idx) => (
                <option key={idx} value={w.thai_name}>{w.thai_name}</option>
              ))}
            </CustomSelect>
          </div>

          {/* Filter 4: Focus Machine Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Search size={13} className="text-sky-600" />
                <span>4. เครื่องที่ต้องการติดตาม *</span>
              </span>
              {focusedSerial && (
                <span className="text-[10px] text-sky-600 font-bold font-mono">
                  {formatMachineLabel(focusedSerial)}
                </span>
              )}
            </label>
            <CustomSelect
              value={focusedSerial || ''}
              onChange={(e) => setFocusedSerial(e.target.value || null)}
              className="w-full text-xs p-2.5 rounded-xl border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-800 font-bold text-sky-950 dark:text-sky-200 focus:ring-2 focus:ring-sky-500 shadow-2xs"
            >
              {machineComparisonRows
                .filter(m => m.hasTestedInLot)
                .map(m => (
                  <option key={m.serialNumber} value={m.serialNumber}>
                    {m.displayLabel} — {m.ward} ({m.testsCount} วัน) {m.status === 'outlier' ? ' หลุดเกณฑ์' : ''}
                  </option>
                ))}
            </CustomSelect>
          </div>

        </div>

        {/* Secondary Row: Level Selection & Date Range */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Level Switcher */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <SlidersVertical size={13} className="text-sky-600" />
              <span>ระดับ Control:</span>
            </span>
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSelectedLevel('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedLevel === 'all'
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/50'
                }`}
              >
                สรุปภาพรวม (L2)
              </button>
              <button
                type="button"
                onClick={() => setSelectedLevel(1)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                  selectedLevel === 1
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Level 1 (Low)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedLevel(2)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                  selectedLevel === 2
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                <span>Level 2 (Normal)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedLevel(3)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                  selectedLevel === 3
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span>Level 3 (High)</span>
              </button>
            </div>
          </div>

          {/* Date Range Presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Calendar size={13} className="text-slate-400" />
              <span>ช่วงเวลา:</span>
            </span>
            {[
              { id: 'all', label: 'ทั้งหมดของ LOT' },
              { id: '7days', label: '7 วัน' },
              { id: '15days', label: '15 วัน' },
              { id: '30days', label: '30 วัน' },
              { id: 'this_month', label: 'เดือนนี้' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setTimeRange(p.id as any)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  timeRange === p.id
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* 3. Drift & Outlier Early Warning Banner ("เริ่มหลุดวันไหน") */}
      {chartSubView === 'daily_timeline' && focusedMachineData && (
        <div className={`p-4 rounded-2xl border transition-all shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
          dailyTimelineData.firstOutlierDate
            ? 'bg-gradient-to-r from-rose-50 via-rose-100/70 to-rose-50 dark:from-rose-950/40 dark:to-rose-900/30 border-rose-300 dark:border-rose-800'
            : dailyTimelineData.driftWarning
              ? 'bg-gradient-to-r from-amber-50 via-amber-100/70 to-amber-50 dark:from-amber-950/40 dark:to-amber-900/30 border-amber-300 dark:border-amber-800'
              : 'bg-gradient-to-r from-emerald-50 via-emerald-100/70 to-emerald-50 dark:from-emerald-950/40 dark:to-emerald-900/30 border-emerald-300 dark:border-emerald-800'
        }`}>
          <div className="flex items-start space-x-3.5">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
              dailyTimelineData.firstOutlierDate
                ? 'bg-rose-600 text-white'
                : dailyTimelineData.driftWarning
                  ? 'bg-amber-600 text-white'
                  : 'bg-emerald-600 text-white'
            }`}>
              {dailyTimelineData.firstOutlierDate ? (
                <ShieldAlert size={22} className="animate-bounce" />
              ) : dailyTimelineData.driftWarning ? (
                <AlertTriangle size={22} />
              ) : (
                <CheckCircle2 size={22} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                  เครื่อง {focusedMachineData.displayLabel} ({focusedMachineData.ward})
                </span>
                {dailyTimelineData.firstOutlierDate ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-100">
                     ตรวจพบวันที่เริ่มหลุดกลุ่ม: {dailyTimelineData.firstOutlierDate}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">
                    ผลตรวจสอดคล้องกับกลุ่มปกติ
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 font-medium">
                {dailyTimelineData.firstOutlierDate ? (
                  <>
                    เครื่องนี้เริ่มมีค่าแตกต่างจากค่าเฉลี่ยกลุ่มในวันเดียวกันอย่างมีนัยสำคัญ (|SDI| ≥ 2.0) ตั้งแต่วันที่{' '}
                    <strong className="text-rose-700 dark:text-rose-300 underline font-mono text-xs">
                      {dailyTimelineData.firstOutlierDate}
                    </strong>{' '}
                    (วัดได้ {dailyTimelineData.firstOutlierValue} mg/dL เทียบกับค่าเฉลี่ยกลุ่มในวันนั้น {dailyTimelineData.firstOutlierGroupMean} mg/dL, SDI: {dailyTimelineData.firstOutlierSdi})
                  </>
                ) : dailyTimelineData.driftWarning ? (
                  dailyTimelineData.driftWarning
                ) : (
                  `ไม่มีวันที่หลุดกลุ่ม ค่าผลตรวจของเครื่องนี้สอดคล้องกับค่าเฉลี่ยกลุ่มเครื่องที่ตรวจใน LOT ${selectedLot} ทุกวัน (|SDI| < 1.5)`
                )}
              </p>
            </div>
          </div>

          {/* Quick LJ jump button */}
          {onSelectMachineForLJ && (
            <button
              type="button"
              onClick={() => onSelectMachineForLJ(focusedMachineData.serialNumber)}
              className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 font-bold text-xs shadow-xs flex items-center space-x-1.5 cursor-pointer shrink-0 transition-all self-end md:self-center"
            >
              <span>เปิดดูกราฟเดี่ยว LJ</span>
              <ExternalLink size={13} />
            </button>
          )}
        </div>
      )}

      {/* 4. Main Visualization Area */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
        
        {/* Chart Header & Subtitle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              <span>
                {chartSubView === 'daily_timeline'
                  ? `กราฟเปรียบเทียบแนวโน้มรายวัน (Day-by-Day Peer Comparison) — ${currentLevelGroup.title}`
                  : `กราฟเปรียบเทียบภาพรวมเครื่องทั้งหมด (Fleet Inter-instrument) — ${currentLevelGroup.title}`}
              </span>
            </h4>
            <p className="text-[11px] text-slate-400 font-medium">
              LOT {selectedLot} • {chartSubView === 'daily_timeline' ? `ติดตามทั้งหมด ${dailyTimelineData.points.length} วันตรวจ` : `รวม ${displayedRows.filter(r => r.hasTestedInLot).length} เครื่อง`}
            </p>
          </div>

          {/* Color Legend & Sub-Controls */}
          <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex-wrap">
            {chartSubView === 'daily_timeline' ? (
              <>
                <div className="flex items-center space-x-1.5">
                  <span className="w-4 h-1 bg-indigo-600 rounded-full" />
                  <span className="text-indigo-700 dark:text-indigo-300 font-extrabold">
                    {focusedMachineData ? focusedMachineData.displayLabel : 'เครื่องที่เลือก'}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-3.5 h-3.5 bg-sky-400/20 border border-sky-400 rounded" />
                  <span className="text-sky-600 dark:text-sky-300">Daily Group Mean Band (±1SD)</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-rose-600">จุดที่เริ่มหลุดกลุ่ม</span>
                </div>
                <div className="border-l border-slate-200 dark:border-slate-700 pl-2">
                  <button
                    type="button"
                    onClick={() => setShowAllMachinesOverlay(!showAllMachinesOverlay)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                      showAllMachinesOverlay
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                    title="เปิด/ปิดการแสดงเส้นบางๆ ของเครื่องอื่นๆ ใน LOT เดียวกัน"
                  >
                    {showAllMachinesOverlay ? 'ซ่อนเส้นเครื่องอื่น' : 'แสดงทุกเครื่องในกลุ่ม'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 mr-2">
                  <button
                    type="button"
                    onClick={() => setFleetMetricMode('sdi')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      fleetMetricMode === 'sdi'
                        ? 'bg-sky-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    ดัชนี SDI
                  </button>
                  <button
                    type="button"
                    onClick={() => setFleetMetricMode('mean')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      fleetMetricMode === 'mean'
                        ? 'bg-sky-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    ค่าเฉลี่ย mg/dL
                  </button>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>ปกติ (|SDI| &lt; 1.5)</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>เฝ้าระวัง</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>ต่างจากกลุ่ม (|SDI| ≥ 2.0)</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* CHART RENDER: MODE 1 - DAILY RUN TIMELINE (WHAT USER ASKED FOR) */}
        {/* ------------------------------------------------------------- */}
        {chartSubView === 'daily_timeline' ? (
          dailyTimelineData.points.length === 0 ? (
            <div className="text-center py-16 bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <Calendar size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                ยังไม่มีข้อมูลบันทึกผลตรวจรายวันใน LOT {selectedLot}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto pb-2">
              {(() => {
                const points = dailyTimelineData.points;
                const width = Math.max(860, points.length * 75 + 140);
                const height = 380;
                const paddingLeft = 70;
                const paddingRight = 45;
                const paddingTop = 35;
                const paddingBottom = 75;
                const plotWidth = width - paddingLeft - paddingRight;
                const plotHeight = height - paddingTop - paddingBottom;

                // Determine Y min & max across all daily group means, machine values, and targets
                const allDailyValues: number[] = [];
                points.forEach(p => {
                  if (p.dailyGroupMean > 0) allDailyValues.push(p.dailyGroupMean);
                  if (p.dailyMin > 0) allDailyValues.push(p.dailyMin);
                  if (p.dailyMax > 0) allDailyValues.push(p.dailyMax);
                  if (p.machineValue && p.machineValue > 0) allDailyValues.push(p.machineValue);
                });

                if (currentLevelGroup.target > 0) allDailyValues.push(currentLevelGroup.target);

                const dataMin = allDailyValues.length > 0 ? Math.min(...allDailyValues) : 70;
                const dataMax = allDailyValues.length > 0 ? Math.max(...allDailyValues) : 150;
                const yMargin = Math.max((dataMax - dataMin) * 0.15, 15);
                const yMin = Math.floor(dataMin - yMargin);
                const yMax = Math.ceil(dataMax + yMargin);
                const ySpan = Math.max(yMax - yMin, 20);

                const getY = (val: number) => {
                  return paddingTop + plotHeight - ((val - yMin) / ySpan) * plotHeight;
                };

                const getX = (idx: number) => {
                  if (points.length === 1) return paddingLeft + plotWidth / 2;
                  return paddingLeft + (idx / (points.length - 1)) * plotWidth;
                };

                // Generate Group Mean Area Polygon Points (±1 SD Corridor)
                const topPoints = points.map((p, idx) => `${getX(idx)},${getY(p.dailyGroupMean + p.dailyGroupSD)}`).join(' ');
                const bottomPoints = [...points].reverse().map((p, idx) => `${getX(points.length - 1 - idx)},${getY(p.dailyGroupMean - p.dailyGroupSD)}`).join(' ');
                const corridorPolygon = `${topPoints} ${bottomPoints}`;

                // Lines connecting Group Mean
                const groupMeanPolyline = points.map((p, idx) => `${getX(idx)},${getY(p.dailyGroupMean)}`).join(' ');

                // Lines connecting Focused Machine
                const focusedMachinePoints = points
                  .map((p, idx) => (p.machineValue && p.machineValue > 0 ? { x: getX(idx), y: getY(p.machineValue), pt: p, idx } : null))
                  .filter(Boolean) as { x: number; y: number; pt: DailyComparisonPoint; idx: number }[];

                const machinePolyline = focusedMachinePoints.map(p => `${p.x},${p.y}`).join(' ');

                return (
                  <div className="space-y-3">
                    <svg
                      viewBox={`0 0 ${width} ${height}`}
                      className="w-full h-auto min-w-[750px] select-none text-[10px] font-mono"
                    >
                    {/* Background */}
                    <rect x="0" y="0" width={width} height={height} fill="transparent" />

                    {/* Shaded Daily Group Mean ± 1 SD Corridor */}
                    <polygon
                      points={corridorPolygon}
                      fill="#0284c7"
                      fillOpacity="0.10"
                    />

                    {/* Overall Target Line (if configured) */}
                    {currentLevelGroup.target > 0 && (
                      <g>
                        <line
                          x1={paddingLeft}
                          y1={getY(currentLevelGroup.target)}
                          x2={paddingLeft + plotWidth}
                          y2={getY(currentLevelGroup.target)}
                          stroke="#94a3b8"
                          strokeDasharray="4 4"
                          strokeWidth={1.2}
                        />
                        <text
                          x={paddingLeft + plotWidth + 4}
                          y={getY(currentLevelGroup.target) + 3}
                          fill="#94a3b8"
                          fontSize="8"
                        >
                          Target: {currentLevelGroup.target}
                        </text>
                      </g>
                    )}

                    {/* Horizontal Y Grid lines (every 20 mg/dL approx) */}
                    {Array.from({ length: 5 }).map((_, i) => {
                      const val = Math.round(yMin + (i * ySpan) / 4);
                      const yPos = getY(val);
                      return (
                        <g key={i}>
                          <line
                            x1={paddingLeft}
                            y1={yPos}
                            x2={paddingLeft + plotWidth}
                            y2={yPos}
                            stroke="#e2e8f0"
                            strokeDasharray="2 2"
                            strokeWidth={0.8}
                          />
                          <text
                            x={paddingLeft - 8}
                            y={yPos + 3}
                            textAnchor="end"
                            fill="#94a3b8"
                            fontSize="9"
                          >
                            {val}
                          </text>
                        </g>
                      );
                    })}

                    {/* Other Machines Overlay (Cloud lines) */}
                    {showAllMachinesOverlay && dailyTimelineData.allMachinesDateMap.size > 0 && (
                      Array.from(dailyTimelineData.allMachinesDateMap.entries()).map(([serial, dateVals]) => {
                        if (serial === focusedSerial?.trim().toUpperCase()) return null; // handled separately
                        const otherPoints = points
                          .map((p, idx) => {
                            const val = dateVals.get(p.date);
                            return val ? `${getX(idx)},${getY(val)}` : null;
                          })
                          .filter(Boolean);

                        if (otherPoints.length < 2) return null;

                        return (
                          <polyline
                            key={serial}
                            points={otherPoints.join(' ')}
                            fill="none"
                            stroke="#cbd5e1"
                            strokeWidth={1}
                            opacity={0.45}
                          />
                        );
                      })
                    )}

                    {/* Daily Group Mean Line */}
                    <polyline
                      points={groupMeanPolyline}
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Daily Group Mean Dots */}
                    {points.map((p, idx) => {
                      const cx = getX(idx);
                      const cy = getY(p.dailyGroupMean);
                      return (
                        <circle
                          key={p.date}
                          cx={cx}
                          cy={cy}
                          r={3.5}
                          fill="#0284c7"
                          stroke="#ffffff"
                          strokeWidth={1}
                        />
                      );
                    })}

                    {/* Focused Machine Connecting Polyline */}
                    {machinePolyline && (
                      <polyline
                        points={machinePolyline}
                        fill="none"
                        stroke="#4f46e5"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Focused Machine Daily Points with interactive callouts */}
                    {focusedMachinePoints.map(({ x, y, pt, idx }) => {
                      const isOutlier = pt.status === 'outlier';
                      const isWarning = pt.status === 'warning';
                      const isFirstOutlier = pt.displayDate === dailyTimelineData.firstOutlierDate;
                      const pointColor = isOutlier ? '#e11d48' : isWarning ? '#f59e0b' : '#10b981';

                      return (
                        <g 
                          key={pt.date} 
                          className="cursor-pointer group"
                          onMouseEnter={() => setActiveTimelineTooltip({ pt, x, y })}
                          onMouseLeave={() => setActiveTimelineTooltip(null)}
                        >
                          {/* Vertical guide from point to date axis */}
                          <line
                            x1={x}
                            y1={paddingTop}
                            x2={x}
                            y2={paddingTop + plotHeight}
                            stroke={isOutlier ? '#f43f5e' : '#cbd5e1'}
                            strokeWidth={isOutlier ? 1.5 : 0.8}
                            strokeDasharray={isOutlier ? 'none' : '2 2'}
                            opacity={isOutlier ? 0.7 : 0.3}
                          />

                          {/* Pulsing ring for outlier */}
                          {isOutlier && (
                            <circle
                              cx={x}
                              cy={y}
                              r={13}
                              fill="#f43f5e"
                              fillOpacity="0.25"
                              className="animate-pulse"
                            />
                          )}

                          {/* Main Dot */}
                          <circle
                            cx={x}
                            cy={y}
                            r={isOutlier ? 7 : 5.5}
                            fill={pointColor}
                            stroke="#ffffff"
                            strokeWidth={2}
                            className=""
                          />

                          {/* Value label */}
                          <text
                            x={x}
                            y={y - 9}
                            textAnchor="middle"
                            fill={pointColor}
                            fontWeight="bold"
                            fontSize="9"
                          >
                            {pt.machineValue}
                          </text>

                          {/* First Outlier Flag Callout */}
                          {isFirstOutlier && (
                            <g>
                              <rect
                                x={x - 42}
                                y={y - 32}
                                width={84}
                                height={18}
                                rx={5}
                                fill="#e11d48"
                                className="shadow-lg"
                              />
                              <text
                                x={x}
                                y={y - 20}
                                textAnchor="middle"
                                fill="#ffffff"
                                fontWeight="bold"
                                fontSize="8"
                              >
                                 เริ่มหลุดวันแรก
                              </text>
                            </g>
                          )}

                          {/* Date Label on X Axis */}
                          <text
                            x={x}
                            y={paddingTop + plotHeight + 18}
                            textAnchor="end"
                            transform={`rotate(-40, ${x}, ${paddingTop + plotHeight + 18})`}
                            fill={isOutlier ? '#e11d48' : '#64748b'}
                            fontWeight={isOutlier ? 'bold' : 'normal'}
                            fontSize="9"
                          >
                            {pt.displayDate}
                          </text>
                        </g>
                      );
                    })}

                    {/* Left Y Axis Label */}
                    <text
                      x={15}
                      y={height / 2}
                      textAnchor="middle"
                      transform={`rotate(-90, 15, ${height / 2})`}
                      fill="#64748b"
                      fontSize="9"
                      fontWeight="bold"
                    >
                      น้ำตาล (mg/dL)
                    </text>

                    {/* Native SVG Compact Tooltip */}
                    {activeTimelineTooltip && (
                      <g transform={`translate(${activeTimelineTooltip.x}, ${Math.max(activeTimelineTooltip.y - 48, 25)})`} className="pointer-events-none">
                        <rect
                          x="-60"
                          y="-32"
                          width="120"
                          height="40"
                          rx="6"
                          fill="#0f172a"
                          fillOpacity="0.95"
                          stroke="#334155"
                          strokeWidth="1"
                        />
                        <text x="0" y="-18" textAnchor="middle" fill="#38bdf8" fontSize="9" fontWeight="bold">
                          {activeTimelineTooltip.pt.displayDate} ({activeTimelineTooltip.pt.machineValue} mg/dL)
                        </text>
                        <text x="0" y="-6" textAnchor="middle" fill="#e2e8f0" fontSize="8">
                          กลุ่ม: {activeTimelineTooltip.pt.dailyGroupMean.toFixed(1)} | SDI: {activeTimelineTooltip.pt.sdi !== undefined ? activeTimelineTooltip.pt.sdi.toFixed(2) : '-'}
                        </text>
                      </g>
                    )}
                  </svg>
                </div>
              );
            })()}
            </div>
          )
        ) : fleetMetricMode === 'mean' ? (
          // -------------------------------------------------------------
          // CHART RENDER: MODE 2 - FLEET PEER SCATTER (AGGREGATE)
          // -------------------------------------------------------------
          (() => {
            const activeMachines = displayedRows.filter(r => r.hasTestedInLot);
            const groupMean = currentLevelGroup.mean;
            const groupSD = currentLevelGroup.sd;

            const allMeans = activeMachines.map(m => m.machineMean);
            const yMin = Math.min(groupMean - 3.2 * groupSD, ...allMeans) - 5;
            const yMax = Math.max(groupMean + 3.2 * groupSD, ...allMeans) + 5;
            const ySpan = Math.max(yMax - yMin, 20);

            const width = Math.max(860, activeMachines.length * 60 + 120);
            const height = 360;
            const paddingLeft = 70;
            const paddingRight = 40;
            const paddingTop = 30;
            const paddingBottom = 75;
            const plotWidth = width - paddingLeft - paddingRight;
            const plotHeight = height - paddingTop - paddingBottom;

            const getY = (val: number) => {
              return paddingTop + plotHeight - ((val - yMin) / ySpan) * plotHeight;
            };

            const getX = (idx: number) => {
              if (activeMachines.length === 1) return paddingLeft + plotWidth / 2;
              return paddingLeft + (idx / (activeMachines.length - 1)) * plotWidth;
            };

            const groupMeanY = getY(groupMean);
            const plus1SdY = getY(groupMean + groupSD);
            const minus1SdY = getY(groupMean - groupSD);
            const plus2SdY = getY(groupMean + 2 * groupSD);
            const minus2SdY = getY(groupMean - 2 * groupSD);

            return (
              <div className="overflow-x-auto pb-2">
                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  className="w-full h-auto min-w-[700px] select-none text-[10px] font-mono"
                >
                  <rect x="0" y="0" width={width} height={height} fill="transparent" />

                  {/* ±1 SD Shaded Band */}
                  <rect
                    x={paddingLeft}
                    y={Math.min(plus1SdY, minus1SdY)}
                    width={plotWidth}
                    height={Math.abs(minus1SdY - plus1SdY)}
                    fill="#10b981"
                    fillOpacity="0.08"
                  />

                  {/* Lines */}
                  {[
                    { y: plus2SdY, label: `+2SD (${(groupMean + 2 * groupSD).toFixed(1)})`, color: '#f59e0b', dash: '4 4' },
                    { y: plus1SdY, label: `+1SD (${(groupMean + groupSD).toFixed(1)})`, color: '#10b981', dash: '3 3' },
                    { y: groupMeanY, label: `Group Mean: ${groupMean.toFixed(1)} mg/dL`, color: '#0284c7', dash: 'none', strokeWidth: 2 },
                    { y: minus1SdY, label: `-1SD (${(groupMean - groupSD).toFixed(1)})`, color: '#10b981', dash: '3 3' },
                    { y: minus2SdY, label: `-2SD (${(groupMean - 2 * groupSD).toFixed(1)})`, color: '#f59e0b', dash: '4 4' },
                  ].map((line, idx) => (
                    <g key={idx}>
                      <line
                        x1={paddingLeft}
                        y1={line.y}
                        x2={paddingLeft + plotWidth}
                        y2={line.y}
                        stroke={line.color}
                        strokeWidth={line.strokeWidth || 1}
                        strokeDasharray={line.dash}
                        strokeOpacity={0.7}
                      />
                      <text
                        x={paddingLeft - 8}
                        y={line.y + 3}
                        textAnchor="end"
                        fill={line.color}
                        fontWeight="bold"
                        fontSize="9"
                      >
                        {line.label}
                      </text>
                    </g>
                  ))}

                  {/* Points */}
                  {activeMachines.map((m, idx) => {
                    const cx = getX(idx);
                    const cy = getY(m.machineMean);
                    const isFocused = m.serialNumber === focusedSerial;
                    const pointColor = m.status === 'outlier' ? '#e11d48' : m.status === 'warning' ? '#f59e0b' : '#059669';

                    return (
                      <g 
                        key={m.serialNumber} 
                        className="cursor-pointer group"
                        onClick={() => setFocusedSerial(m.serialNumber)}
                      >
                        <line
                          x1={cx}
                          y1={paddingTop}
                          x2={cx}
                          y2={paddingTop + plotHeight}
                          stroke={isFocused ? '#38bdf8' : '#e2e8f0'}
                          strokeWidth={isFocused ? 2 : 1}
                          strokeDasharray={isFocused ? 'none' : '2 2'}
                          opacity={isFocused ? 1 : 0.4}
                        />

                        {m.machineMin !== m.machineMax && (
                          <line
                            x1={cx}
                            y1={getY(m.machineMin)}
                            x2={cx}
                            y2={getY(m.machineMax)}
                            stroke={pointColor}
                            strokeWidth={2}
                            opacity={0.6}
                          />
                        )}

                        {isFocused && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={14}
                            fill="#38bdf8"
                            fillOpacity="0.25"
                            className="animate-pulse"
                          />
                        )}

                        <circle
                          cx={cx}
                          cy={cy}
                          r={isFocused ? 8 : 6}
                          fill={pointColor}
                          stroke="#ffffff"
                          strokeWidth={isFocused ? 2.5 : 1.5}
                          className=""
                        />

                        <text
                          x={cx}
                          y={cy - 10}
                          textAnchor="middle"
                          fill={isFocused ? '#0369a1' : '#334155'}
                          fontWeight="bold"
                          fontSize={isFocused ? '10' : '9'}
                        >
                          {m.machineMean}
                        </text>

                        <text
                          x={cx}
                          y={paddingTop + plotHeight + 18}
                          textAnchor="end"
                          transform={`rotate(-40, ${cx}, ${paddingTop + plotHeight + 18})`}
                          fill={isFocused ? '#0284c7' : '#64748b'}
                          fontWeight={isFocused ? 'bold' : 'normal'}
                          fontSize="9"
                        >
                          {m.displayLabel}
                        </text>

                        <text
                          x={cx}
                          y={paddingTop + plotHeight + 42}
                          textAnchor="end"
                          transform={`rotate(-40, ${cx}, ${paddingTop + plotHeight + 42})`}
                          fill="#94a3b8"
                          fontSize="8"
                        >
                          {m.ward}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            );
          })()
        ) : (
          // -------------------------------------------------------------
          // CHART RENDER: MODE 3 - DIVERGENT SDI BAR
          // -------------------------------------------------------------
          (() => {
            const activeMachines = displayedRows.filter(r => r.hasTestedInLot);
            const width = Math.max(860, activeMachines.length * 60 + 120);
            const height = 340;
            const paddingLeft = 70;
            const paddingRight = 40;
            const paddingTop = 30;
            const paddingBottom = 75;
            const plotWidth = width - paddingLeft - paddingRight;
            const plotHeight = height - paddingTop - paddingBottom;

            const maxSdi = Math.max(2.5, ...activeMachines.map(m => Math.abs(m.sdi)));
            const sdiRange = maxSdi * 1.2;

            const getY = (sdiVal: number) => {
              return paddingTop + plotHeight / 2 - (sdiVal / sdiRange) * (plotHeight / 2);
            };

            const zeroY = getY(0);
            const plus2Y = getY(2.0);
            const minus2Y = getY(-2.0);

            const getX = (idx: number) => {
              if (activeMachines.length === 1) return paddingLeft + plotWidth / 2;
              return paddingLeft + (idx / (activeMachines.length - 1)) * plotWidth;
            };

            return (
              <div className="overflow-x-auto pb-2">
                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  className="w-full h-auto min-w-[700px] select-none text-[10px] font-mono"
                >
                  <rect x="0" y="0" width={width} height={height} fill="transparent" />

                  {/* Acceptable Zone (|SDI| < 1.0) */}
                  <rect
                    x={paddingLeft}
                    y={getY(1.0)}
                    width={plotWidth}
                    height={getY(-1.0) - getY(1.0)}
                    fill="#10b981"
                    fillOpacity="0.08"
                  />

                  {/* Boundaries */}
                  <line x1={paddingLeft} y1={plus2Y} x2={paddingLeft + plotWidth} y2={plus2Y} stroke="#f43f5e" strokeDasharray="3 3" opacity={0.6} />
                  <line x1={paddingLeft} y1={minus2Y} x2={paddingLeft + plotWidth} y2={minus2Y} stroke="#f43f5e" strokeDasharray="3 3" opacity={0.6} />
                  
                  <text x={paddingLeft - 8} y={plus2Y + 3} textAnchor="end" fill="#f43f5e" fontWeight="bold" fontSize="9">+2.0 SDI (Critical)</text>
                  <text x={paddingLeft - 8} y={minus2Y + 3} textAnchor="end" fill="#f43f5e" fontWeight="bold" fontSize="9">-2.0 SDI (Critical)</text>

                  {/* Zero Line */}
                  <line x1={paddingLeft} y1={zeroY} x2={paddingLeft + plotWidth} y2={zeroY} stroke="#0284c7" strokeWidth={2} />
                  <text x={paddingLeft - 8} y={zeroY + 3} textAnchor="end" fill="#0284c7" fontWeight="bold" fontSize="9">
                    0.0 SDI (Group Mean)
                  </text>

                  {/* Bars */}
                  {activeMachines.map((m, idx) => {
                    const cx = getX(idx);
                    const barWidth = 14;
                    const barHeight = Math.abs(getY(m.sdi) - zeroY);
                    const barY = m.sdi >= 0 ? getY(m.sdi) : zeroY;
                    const isFocused = m.serialNumber === focusedSerial;
                    const barColor = m.status === 'outlier' ? '#e11d48' : m.status === 'warning' ? '#f59e0b' : '#059669';

                    return (
                      <g 
                        key={m.serialNumber} 
                        className="cursor-pointer group"
                        onClick={() => setFocusedSerial(m.serialNumber)}
                      >
                        <rect
                          x={cx - barWidth / 2}
                          y={barY}
                          width={barWidth}
                          height={Math.max(barHeight, 2)}
                          fill={barColor}
                          rx={2}
                          opacity={isFocused ? 1 : 0.85}
                          stroke={isFocused ? '#0284c7' : 'none'}
                          strokeWidth={isFocused ? 2 : 0}
                        />

                        <text
                          x={cx}
                          y={m.sdi >= 0 ? barY - 5 : barY + barHeight + 11}
                          textAnchor="middle"
                          fill={isFocused ? '#0284c7' : '#334155'}
                          fontWeight="bold"
                          fontSize="8"
                        >
                          {m.sdi > 0 ? `+${m.sdi}` : m.sdi}
                        </text>

                        <text
                          x={cx}
                          y={paddingTop + plotHeight + 18}
                          textAnchor="end"
                          transform={`rotate(-40, ${cx}, ${paddingTop + plotHeight + 18})`}
                          fill={isFocused ? '#0284c7' : '#64748b'}
                          fontWeight={isFocused ? 'bold' : 'normal'}
                          fontSize="9"
                        >
                          {m.displayLabel}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            );
          })()
        )}

      </div>

      {/* 6. Daily Run-by-Run Comparison Table (เฉพาะใน Timeline Mode) */}
      {chartSubView === 'daily_timeline' && focusedMachineData && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                <Calendar size={16} className="text-sky-600" />
                <span>
                  บันทึกผลตรวจรายวันของเครื่อง {focusedMachineData.displayLabel} ({focusedMachineData.ward}) เทียบกับค่าเฉลี่ยกลุ่ม
                </span>
              </h4>
              <p className="text-xs text-slate-400">
                เปรียบเทียบค่าที่วัดได้จริงในแต่ละวันกับค่าเฉลี่ยของเครื่องทั้งหมดที่ทำ Control ในวันเดียวกัน
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-extrabold border-b border-slate-200 dark:border-slate-700">
                  <th className="py-3 px-3.5 text-center w-12">#</th>
                  <th className="py-3 px-3.5">วันที่ตรวจ</th>
                  <th className="py-3 px-3.5 text-center">ค่าที่เครื่องวัดได้ ({currentLevelGroup.title})</th>
                  <th className="py-3 px-3.5 text-center bg-sky-50/40 dark:bg-sky-950/20">
                    ค่าเฉลี่ยกลุ่มในวันนั้น (Daily Group Mean)
                  </th>
                  <th className="py-3 px-3.5 text-center">ส่วนต่างจากกลุ่ม (Bias %)</th>
                  <th className="py-3 px-3.5 text-center">SDI ในวันนั้น</th>
                  <th className="py-3 px-3.5 text-center">การประเมินวันนั้น</th>
                  <th className="py-3 px-3.5 text-center">ผู้ตรวจบันทึก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {paginatedDailyRows.map((row, idx) => {
                    const isOutlier = row.status === 'outlier';
                    const isWarning = row.status === 'warning';
                    const isFirstOutlier = row.displayDate === dailyTimelineData.firstOutlierDate;
                    const globalIdx = ((dailyTablePage - 1) * dailyTablePageSize) + idx + 1;

                    return (
                      <tr 
                        key={row.date}
                        className={`transition-colors ${
                          isOutlier 
                            ? 'bg-rose-50/80 dark:bg-rose-950/30' 
                            : isWarning 
                              ? 'bg-amber-50/50 dark:bg-amber-950/20' 
                              : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-2.5 px-3.5 text-center font-mono text-slate-400 text-[11px]">
                          {globalIdx}
                        </td>
                        <td className="py-2.5 px-3.5 font-bold text-slate-800 dark:text-slate-200">
                          <div className="flex items-center space-x-2">
                            <span>{row.displayDate}</span>
                            {isFirstOutlier && (
                              <span className="text-[9px] bg-rose-600 text-white font-black px-1.5 py-0.2 rounded-full">
                                เริ่มหลุดวันแรก
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 text-center font-mono font-black text-sm">
                          <span className={isOutlier ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-slate-800 dark:text-slate-200'}>
                            {row.machineValue}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-center font-mono font-bold text-sky-800 dark:text-sky-300 bg-sky-50/30 dark:bg-sky-950/10">
                          {row.dailyGroupMean} <span className="text-[10px] text-slate-400 font-normal">(N={row.machinesCount})</span>
                        </td>
                        <td className="py-2.5 px-3.5 text-center font-mono">
                          <span className={isOutlier ? 'text-rose-600 font-bold' : isWarning ? 'text-amber-600 font-bold' : 'text-slate-600 dark:text-slate-300'}>
                            {row.diffFromGroup! > 0 ? `+${row.diffFromGroup}` : row.diffFromGroup} ({row.biasPercent! > 0 ? `+${row.biasPercent}%` : `${row.biasPercent}%`})
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-center font-mono">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                            isOutlier 
                              ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                              : isWarning 
                                ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}>
                            {row.sdi! > 0 ? `+${row.sdi}` : row.sdi}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isOutlier
                              ? 'text-rose-700 bg-rose-100 border-rose-300'
                              : isWarning
                                ? 'text-amber-700 bg-amber-100 border-amber-300'
                                : 'text-emerald-700 bg-emerald-100 border-emerald-300'
                          }`}>
                            {isOutlier && <AlertOctagon size={11} />}
                            {isWarning && <AlertTriangle size={11} />}
                            {!isOutlier && !isWarning && <CheckCircle2 size={11} />}
                            <span>{isOutlier ? 'หลุดกลุ่ม (|SDI| ≥ 2.0)' : isWarning ? 'เฝ้าระวัง' : 'ปกติ'}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-center text-slate-500 font-medium">
                          {row.operator || '-'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Daily Table Pagination Footer */}
          {totalDailyPages > 1 && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">
                แสดงผลวันที่ <strong className="text-slate-800 dark:text-slate-200">{((dailyTablePage - 1) * dailyTablePageSize) + 1} - {Math.min(dailyTablePage * dailyTablePageSize, validDailyRows.length)}</strong> จากทั้งหมด <strong className="text-slate-800 dark:text-slate-200">{validDailyRows.length}</strong> วัน (หน้า {dailyTablePage} / {totalDailyPages})
              </span>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  disabled={dailyTablePage <= 1}
                  onClick={() => setDailyTablePage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 cursor-pointer transition-all"
                  title="หน้าก่อนหน้า"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-xs text-slate-700 dark:text-slate-200 font-mono">
                  {dailyTablePage} / {totalDailyPages}
                </span>
                <button
                  type="button"
                  disabled={dailyTablePage >= totalDailyPages}
                  onClick={() => setDailyTablePage(p => Math.min(totalDailyPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 cursor-pointer transition-all"
                  title="หน้าถัดไป"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Detailed Fleet Comparison Scorecard Table (All Machines) */}
      {chartSubView === 'fleet_summary' && (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
        
        {/* Table Header & Search Tools */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
              <Building2 size={16} className="text-sky-600" />
              <span>ตารางเปรียบเทียบภาพรวมเครื่องทั้งหมดใน LOT {selectedLot}</span>
            </h4>
            <p className="text-xs text-slate-400">
              พบเครื่องทั้งหมด {displayedRows.length} เครื่อง • คลิกเลือกแถวเพื่อแสดงกราฟแนวโน้มรายวันของเครื่องนั้น
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="ค้นหารหัสเครื่อง, วอร์ด..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 w-48 sm:w-60"
              />
            </div>
          </div>
        </div>

        {/* The Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-extrabold border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-3.5 text-center w-12">#</th>
                <th 
                  className="py-3 px-3.5 cursor-pointer hover:text-sky-600 transition-colors"
                  onClick={() => {
                    if (sortBy === 'serial') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortBy('serial'); setSortOrder('asc'); }
                  }}
                >
                  <div className="flex items-center space-x-1">
                    <span>รหัสเครื่อง DTX</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th 
                  className="py-3 px-3.5 cursor-pointer hover:text-sky-600 transition-colors"
                  onClick={() => {
                    if (sortBy === 'ward') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortBy('ward'); setSortOrder('asc'); }
                  }}
                >
                  <div className="flex items-center space-x-1">
                    <span>หน่วยงาน / วอร์ด</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th 
                  className="py-3 px-3.5 text-center cursor-pointer hover:text-sky-600 transition-colors"
                  onClick={() => {
                    if (sortBy === 'count') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortBy('count'); setSortOrder('desc'); }
                  }}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>จำนวนวันที่ตรวจ (N)</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="py-3 px-3.5 text-center">
                  <span>ค่าเฉลี่ยเครื่อง ({currentLevelGroup.title})</span>
                </th>
                <th className="py-3 px-3.5 text-center bg-sky-50/40 dark:bg-sky-950/20">
                  <span>Group Mean</span>
                </th>
                <th 
                  className="py-3 px-3.5 text-center cursor-pointer hover:text-sky-600 transition-colors"
                  onClick={() => {
                    if (sortBy === 'diff') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortBy('diff'); setSortOrder('desc'); }
                  }}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>ส่วนต่าง (Bias %)</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th 
                  className="py-3 px-3.5 text-center cursor-pointer hover:text-sky-600 transition-colors"
                  onClick={() => {
                    if (sortBy === 'sdi') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortBy('sdi'); setSortOrder('desc'); }
                  }}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>SDI รวม</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="py-3 px-3.5 text-center">การประเมินภาพรวม</th>
                <th className="py-3 px-3.5 text-center">เลือกติดตาม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {displayedRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-slate-400">
                    ไม่พบข้อมูลเครื่องตรวจ DTX ตามเงื่อนไขค้นหา
                  </td>
                </tr>
              ) : (
                displayedRows.map((row, idx) => {
                  const isFocused = row.serialNumber === focusedSerial;

                  return (
                    <tr 
                      key={row.serialNumber}
                      onClick={() => setFocusedSerial(row.serialNumber)}
                      className={`transition-colors cursor-pointer ${
                        isFocused 
                          ? 'bg-sky-50 dark:bg-sky-950/50 font-bold' 
                          : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="py-3 px-3.5 text-center font-mono text-slate-400 text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center space-x-2">
                          <span className={isFocused ? "text-sky-600" : ""}>{row.displayLabel}</span>
                          {isFocused && (
                            <span className="text-[9px] bg-sky-600 text-white font-bold px-1.5 py-0.2 rounded-full">
                              ACTIVE
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-slate-700 dark:text-slate-300 font-bold">
                        {row.ward}
                      </td>
                      <td className="py-3 px-3.5 text-center font-mono">
                        {row.hasTestedInLot ? (
                          <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-bold text-slate-700 dark:text-slate-300">
                            {row.testsCount}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center font-mono font-bold">
                        {row.hasTestedInLot ? (
                          <span>
                            {row.machineMean} <span className="text-[10px] text-slate-400 font-normal">± {row.machineSD}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-normal">ยังไม่ได้ตรวจ</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center font-mono font-bold text-sky-800 dark:text-sky-300 bg-sky-50/30 dark:bg-sky-950/10">
                        {currentLevelGroup.mean}
                      </td>
                      <td className="py-3 px-3.5 text-center font-mono">
                        {row.hasTestedInLot ? (
                          <span className={
                            Math.abs(row.diffFromGroup) > currentLevelGroup.sd * 1.5 
                              ? row.diffFromGroup > 0 ? "text-rose-600 font-bold" : "text-blue-600 font-bold"
                              : "text-slate-700 dark:text-slate-300"
                          }>
                            {row.diffFromGroup > 0 ? `+${row.diffFromGroup}` : row.diffFromGroup} ({row.biasPercent > 0 ? `+${row.biasPercent}%` : `${row.biasPercent}%`})
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center font-mono">
                        {row.hasTestedInLot ? (
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                            row.status === 'outlier' 
                              ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                              : row.status === 'warning'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}>
                            {row.sdi > 0 ? `+${row.sdi}` : row.sdi}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${row.statusColor}`}>
                          {row.status === 'normal' && <CheckCircle2 size={12} />}
                          {row.status === 'warning' && <AlertTriangle size={12} />}
                          {row.status === 'outlier' && <AlertOctagon size={12} />}
                          <span>{row.statusLabel}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              setFocusedSerial(row.serialNumber);
                              setChartSubView('daily_timeline');
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                              isFocused
                                ? 'bg-sky-600 text-white shadow-2xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-sky-50 hover:text-sky-700'
                            }`}
                            title="ดูกราฟแนวโน้มรายวันของเครื่องนี้"
                          >
                            <Clock size={11} />
                            <span>ดู Timeline</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

    </div>
  );
}
