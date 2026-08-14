/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { QcRecord, QcLotConfig, DtxMachine, EqaRecord } from '../types';
import QCManagement from './QCManagement';
import EQAManagement from './EQAManagement';
import { Award, ShieldCheck, Activity } from 'lucide-react';

interface QualityManagementProps {
  machines: DtxMachine[];
  qcRecords: QcRecord[];
  lotConfigs: QcLotConfig[];
  onAddQcRecord: (record: QcRecord) => void;
  onUpdateLotConfigs: (configs: QcLotConfig[]) => void;
  eqaRecords: EqaRecord[];
  onAddEqaRecord: (record: EqaRecord) => void;
  initialSubTab?: 'iqc' | 'eqa';
  role?: string;
}

export default function QualityManagement({
  machines,
  qcRecords,
  lotConfigs,
  onAddQcRecord,
  onUpdateLotConfigs,
  eqaRecords,
  onAddEqaRecord,
  initialSubTab = 'iqc',
  role = 'admin'
}: QualityManagementProps) {
  const [activeSubTab, setActiveSubTab] = useState<'iqc' | 'eqa'>(initialSubTab);

  return (
    <div className="space-y-6" id="quality-management-wrapper">
      {/* Top Banner / Navigation for Quality Management */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-sky-600 text-white rounded-2xl shadow-md shadow-sky-500/20">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
              <span>งานคุณภาพ (Quality Management System)</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              ศูนย์การบริหารการควบคุมคุณภาพภายใน (IQC) และการประเมินคุณภาพโดยองค์กรภายนอก (EQA)
            </p>
          </div>
        </div>

        {/* Sub-tab pills */}
        <div className="flex items-center p-1.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs w-full md:w-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('iqc')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              activeSubTab === 'iqc'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            id="quality-tab-iqc"
          >
            <Activity size={15} className={activeSubTab === 'iqc' ? 'text-sky-600' : 'text-slate-400'} />
            <span>IQC (ควบคุมคุณภาพภายใน)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('eqa')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              activeSubTab === 'eqa'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            id="quality-tab-eqa"
          >
            <Award size={15} className={activeSubTab === 'eqa' ? 'text-sky-600' : 'text-slate-400'} />
            <span>EQA (ประเมินคุณภาพภายนอก)</span>
          </button>
        </div>
      </div>

      {/* Dynamic View rendering */}
      {activeSubTab === 'iqc' ? (
        <QCManagement
          machines={machines}
          qcRecords={qcRecords}
          lotConfigs={lotConfigs}
          onAddQcRecord={onAddQcRecord}
          onUpdateLotConfigs={onUpdateLotConfigs}
          role={role}
        />
      ) : (
        <EQAManagement
          machines={machines}
          eqaRecords={eqaRecords}
          onAddEqaRecord={onAddEqaRecord}
          role={role}
        />
      )}
    </div>
  );
}
