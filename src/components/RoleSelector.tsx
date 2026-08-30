import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  Microscope, 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft,
  Wrench, 
  Package, 
  Search, 
  BookOpen, 
  Zap, 
  BarChart3, 
  Layers, 
  Settings,
  Sparkles,
  Lock,
  ShieldAlert,
  Clock,
  Hammer,
  UserCheck,
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Check
} from 'lucide-react';
import { getSupabaseClient, getPublicSupabaseClient } from '../lib/supabase';

interface RoleSelectorProps {
  onSelectRole: (role: 'user' | 'staff' | 'admin', staffInfo?: { id: string; full_name: string }) => void;
  currentRole?: 'user' | 'staff' | 'admin';
  isAdminLoggedIn?: boolean;
  onClose?: () => void;
  isModal?: boolean;
  initialAuthMode?: 'selector' | 'staff_quick_login' | 'staff_full_login' | 'admin_login';
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({
  onSelectRole,
  currentRole,
  isAdminLoggedIn = false,
  onClose,
  isModal = false,
  initialAuthMode = 'selector'
}) => {
  const [authMode, setAuthMode] = useState<'selector' | 'staff_quick_login' | 'staff_full_login' | 'admin_login'>(initialAuthMode);
  
  useEffect(() => {
    setAuthMode(initialAuthMode);
  }, [initialAuthMode]);
  
  // Staff Quick Login States
  const [userList, setUserList] = useState<Array<{ id: string; full_name: string; role?: string; position?: string }>>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [isStaffDropdownOpen, setIsStaffDropdownOpen] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const staffDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (staffDropdownRef.current && !staffDropdownRef.current.contains(event.target as Node)) {
        setIsStaffDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Staff Full Login States
  const [fullUsername, setFullUsername] = useState('');
  const [fullPassword, setFullPassword] = useState('');
  const [loadingFullLogin, setLoadingFullLogin] = useState(false);
  const [fullLoginError, setFullLoginError] = useState('');

  // Rate Limiting / Bot Protection state
  const [lastSubmitTime, setLastSubmitTime] = useState<number>(0);
  const [submitCount, setSubmitCount] = useState<number>(0);
  const [rateLimitLockoutUntil, setRateLimitLockoutUntil] = useState<number>(0);

  // Load active staff from Supabase using dtx_system_users view or dtx_system.users table
  useEffect(() => {
    async function loadStaffUsers() {
      try {
        let data: any[] = [];

        // 1. Try backend API proxy FIRST (just like wards do) for maximum security and ease of setup
        try {
          const apiRes = await fetch('/api/dtx-system-users');
          if (apiRes.ok) {
            const apiData = await apiRes.json();
            if (Array.isArray(apiData) && apiData.length > 0) {
              data = apiData;
            }
          }
        } catch (apiErr) {
          console.warn('Backend API /api/dtx-system-users fetch skipped or failed, trying direct client-side query:', apiErr);
        }

        // 2. Fallback to direct client-side Supabase queries if backend API did not return data
        if (data.length === 0) {
          const client = getSupabaseClient() || getPublicSupabaseClient();
          if (client) {
            // A. Try public view dtx_system_users
            const res1 = await client.from('dtx_system_users').select('*').eq('is_active', true);
            if (res1.data && res1.data.length > 0) {
              data = res1.data;
            } else {
              // B. Try dtx_system schema users table
              const res2 = await client.schema('dtx_system').from('users').select('*').eq('is_active', true);
              if (res2.data && res2.data.length > 0) {
                data = res2.data;
              } else {
                // C. Try public users table
                const res3 = await client.from('users').select('*').eq('is_active', true);
                if (res3.data && res3.data.length > 0) {
                  data = res3.data;
                }
              }
            }
          }
        }

        if (data && Array.isArray(data) && data.length > 0) {
          // Filter staff: exclude Admin and AMT / เจ้าพนักงาน
          const filteredStaff = data.filter((u: any) => {
            if (u.is_active === false) return false;

            const role = (u.role || '').toString().toLowerCase().trim();
            const name = (u.full_name || u.name || '').toString().toLowerCase();
            const email = (u.email || u.username || '').toString().toLowerCase();
            if (role === 'admin' || name.includes('admin') || email.includes('admin')) {
              return false;
            }

            // Clean position string (strip quotes, newlines \r\n, and whitespace)
            const posClean = (u.position || u.pos || '').toString().replace(/[\r\n"']/g, '').trim();
            const posUpper = posClean.toUpperCase();

            // Exclude AMT or เจ้าพนักงาน explicitly
            if (posUpper.includes('AMT') || posClean.includes('เจ้าพนักงาน')) {
              return false;
            }

            return true;
          }).map(u => ({
            ...u,
            full_name: u.full_name || u.name || u.fullname || u.username || 'เจ้าหน้าที่',
            position: (u.position || u.pos || '').toString().replace(/[\r\n"']/g, '').trim()
          }));

          if (filteredStaff.length > 0) {
            setUserList(filteredStaff);
            return;
          }
        }
      } catch (err) {
        console.warn('Could not load users from database:', err);
      }

      // Default fallback staff list if DB returns no users yet or permissions restricted
      setUserList([
        { id: 'mt-01', full_name: 'คุณอัมพร', position: 'MT', role: 'staff' },
        { id: 'mt-02', full_name: 'คุณวิชุดา', position: 'MT', role: 'staff' },
        { id: 'mt-03', full_name: 'คุณชลรัตดา', position: 'MT', role: 'staff' },
        { id: 'mta-01', full_name: 'คุณอุดมศรี', position: 'MTA', role: 'staff' },
        { id: 'mt-04', full_name: 'คุณสมิตา', position: 'MT', role: 'staff' },
      ]);
    }
    loadStaffUsers();
  }, []);

  // Rate limit check for bot protection
  const checkRateLimit = (): boolean => {
    const now = Date.now();
    if (now < rateLimitLockoutUntil) {
      const remainingSecs = Math.ceil((rateLimitLockoutUntil - now) / 1000);
      setStaffError(`ระบบตรวจพบการกดส่งถี่เกินไป (Bot Protection). กรุณารอสักครู่ (${remainingSecs} วินาที)`);
      return false;
    }

    if (now - lastSubmitTime > 30000) {
      setSubmitCount(1);
      setLastSubmitTime(now);
      return true;
    }

    const newCount = submitCount + 1;
    setSubmitCount(newCount);
    setLastSubmitTime(now);

    if (newCount > 5) {
      setRateLimitLockoutUntil(now + 15000);
      setStaffError('คำขอมากเกินไป (Rate Limit Exceeded). ล็อคชั่วคราว 15 วินาทีเพื่อป้องกันบอท');
      return false;
    }

    return true;
  };

  // Quick Win Submission (Public selection, no password required)
  const handleStaffQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) {
      setStaffError('กรุณาเลือกชื่อ-นามสกุลเจ้าหน้าที่');
      return;
    }

    if (!checkRateLimit()) {
      return;
    }

    setLoadingStaff(true);
    setStaffError('');

    try {
      const selectedUser = userList.find(u => u.id === selectedStaffId);
      if (!selectedUser) {
        throw new Error('ไม่พบข้อมูลผู้ใช้งานที่เลือก');
      }

      // Quick Win Mode: Select user directly without requiring password
      localStorage.setItem('dtx_current_staff', JSON.stringify(selectedUser));
      if (selectedUser.full_name) {
        localStorage.setItem('dtx_qc_operator', selectedUser.full_name);
      }
      onSelectRole('staff', selectedUser);
    } catch (err: any) {
      setStaffError(err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    } finally {
      setLoadingStaff(false);
    }
  };

  // Full Login Submission (Backend verification with username & password)
  const handleStaffFullSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullUsername || !fullPassword) {
      setFullLoginError('กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน');
      return;
    }

    setLoadingFullLogin(true);
    setFullLoginError('');

    try {
      const verifyRes = await fetch('/api/auth/verify-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: fullUsername, password: fullPassword }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.success || !verifyData.user) {
        throw new Error(verifyData.error || 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
      }

      const verifiedUser = verifyData.user;
      localStorage.setItem('dtx_current_staff', JSON.stringify(verifiedUser));
      onSelectRole('staff', verifiedUser);
    } catch (err: any) {
      setFullLoginError(err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    } finally {
      setLoadingFullLogin(false);
    }
  };

  return (
    <div className={`w-full ${isModal ? 'p-0' : 'max-w-5xl mx-auto py-8 px-4 sm:px-6'}`} id="role-selector-root">
      
      {/* Top Back Navigation Bar for Sub-forms */}
      {authMode !== 'selector' && (
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <button
            type="button"
            onClick={() => setAuthMode('selector')}
            className="inline-flex items-center space-x-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all cursor-pointer shadow-xs"
            id="btn-back-to-role-selector"
          >
            <ArrowLeft size={16} className="text-emerald-600 dark:text-emerald-400" />
            <span>ย้อนกลับ</span>
          </button>
        </div>
      )}

      {/* Header section */}
      {authMode !== 'staff_quick_login' && (
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-8 sm:mb-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/80 rounded-full text-xs font-bold text-sky-700 dark:text-sky-300">
            <Sparkles size={13} className="text-sky-600" />
            <span>ระบบบริหารจัดการเครื่องตรวจน้ำตาลในเลือดปลายนิ้ว (DTX)</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {authMode === 'staff_full_login'
              ? 'เข้าสู่ระบบ Staff Portal'
              : 'เลือกประเภทผู้ใช้งาน'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            {authMode === 'staff_full_login'
              ? 'ระบบยืนยันตัวสำหรับเจ้าหน้าที่'
              : 'กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลสังขะ • กรุณาเลือกบทบาทเพื่อเข้าสู่ฟังก์ชันที่ตรงกับงานของคุณ'}
          </p>
        </div>
      )}

      {/* STAFF QUICK LOGIN VIEW (QUICK WIN) */}
      {authMode === 'staff_quick_login' ? (
        <div className="max-w-md mx-auto relative mt-2 sm:mt-4">
          {/* Subtle Ambient Glow behind the card */}
          <div className="absolute -inset-1.5 bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-sky-500/20 rounded-3xl blur-xl opacity-70 pointer-events-none"></div>

          <div className="relative bg-white dark:bg-slate-900 rounded-3xl border border-emerald-100 dark:border-emerald-900/60 p-5 sm:p-8 shadow-xl shadow-slate-900/5 space-y-5 sm:space-y-6 animate-fade-in">
            {/* Header / Brand Anchor */}
            <div className="flex flex-col items-center justify-center text-center space-y-3 pt-1">
              {/* Institution Pill Badge */}
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-50/80 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/60 rounded-full text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                <Building2 size={12} className="text-emerald-600 dark:text-emerald-400" />
                <span>กลุ่มงานเทคนิคการแพทย์ • รพ.สังขะ</span>
              </div>

              {/* Glowing Icon Hub */}
              <div className="relative group">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 ring-4 ring-emerald-50 dark:ring-emerald-950/80 transition-transform group-hover:scale-105 duration-300">
                  <Zap size={28} className="fill-white/20 sm:hidden" />
                  <Zap size={30} className="fill-white/20 hidden sm:block" />
                </div>
                <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-100 dark:bg-emerald-900 border-2 border-white dark:border-slate-900 rounded-full flex items-center justify-center">
                  <Activity size={10} className="text-emerald-700 dark:text-emerald-300" />
                </span>
              </div>

              {/* Typography Hierarchy */}
              <div className="space-y-1">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Quick Win Portal
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-xs mx-auto">
                  ระบบบันทึกผลควบคุมคุณภาพ (QC) และการจัดการเครื่องตรวจ DTX ประจำวัน
                </p>
              </div>
            </div>

            {staffError && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 text-rose-800 dark:text-rose-200 rounded-2xl text-xs font-bold flex items-center space-x-2.5">
                <ShieldAlert size={16} className="shrink-0 text-rose-600" />
                <span>{staffError}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleStaffQuickSubmit} className="space-y-4 pt-1">
              <div className="space-y-2" ref={staffDropdownRef}>
                <label className="flex items-center justify-center gap-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-200 text-center">
                  <UserCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
                  <span>เจ้าหน้าที่ผู้ปฏิบัติงาน</span>
                </label>
                
                <div className="relative">
                  {/* Dropdown Trigger Button */}
                  <button
                    type="button"
                    onClick={() => setIsStaffDropdownOpen(!isStaffDropdownOpen)}
                    className="w-full min-h-[46px] pl-3.5 pr-9 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 hover:bg-slate-100/60 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-xs transition-all cursor-pointer shadow-2xs flex items-center justify-between focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    id="btn-staff-dropdown-trigger"
                  >
                    {selectedStaffId ? (
                      (() => {
                        const staff = userList.find(u => u.id === selectedStaffId);
                        return (
                          <span className="font-bold text-slate-900 dark:text-white text-left truncate w-full pr-2">
                            {staff?.full_name || selectedStaffId}
                          </span>
                        );
                      })()
                    ) : (
                      <span className="w-full text-center text-slate-400 dark:text-slate-500 font-medium">
                        -- กรุณาเลือกชื่อ-นามสกุลของคุณ --
                      </span>
                    )}
                  </button>

                  {/* Dropdown Arrow Indicator */}
                  <div 
                    onClick={() => setIsStaffDropdownOpen(!isStaffDropdownOpen)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400 dark:text-slate-500"
                  >
                    {isStaffDropdownOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>

                  {/* Scrollable Dropdown Menu Popover */}
                  {isStaffDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-900/10 z-50 overflow-hidden animate-fade-in">
                      {/* Search Filter */}
                      {userList.length > 4 && (
                        <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60">
                          <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              value={staffSearchQuery}
                              onChange={(e) => setStaffSearchQuery(e.target.value)}
                              placeholder="ค้นหาชื่อเจ้าหน้าที่..."
                              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-left"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                      )}

                      {/* Scrollable list with max height */}
                      <div className="max-h-56 overflow-y-auto overscroll-contain py-1 divide-y divide-slate-50 dark:divide-slate-800/40">
                        {userList
                          .filter(u => 
                            !staffSearchQuery.trim() || 
                            u.full_name.toLowerCase().includes(staffSearchQuery.toLowerCase())
                          )
                          .map((u) => {
                            const isSelected = selectedStaffId === u.id;
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => {
                                  setSelectedStaffId(u.id);
                                  setIsStaffDropdownOpen(false);
                                  setStaffSearchQuery('');
                                }}
                                className={`w-full px-3.5 py-2.5 flex items-center justify-between text-left transition-colors cursor-pointer hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 ${
                                  isSelected
                                    ? 'bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 font-extrabold'
                                    : 'text-slate-700 dark:text-slate-200 font-semibold'
                                }`}
                              >
                                <div className="text-left flex-1 pr-2">
                                  <div className="text-xs">{u.full_name}</div>
                                </div>
                                <div className="shrink-0 text-emerald-600 dark:text-emerald-400">
                                  {isSelected ? <Check size={15} className="stroke-[2.5]" /> : <div className="w-3.5" />}
                                </div>
                              </button>
                            );
                          })}

                        {userList.filter(u => 
                          !staffSearchQuery.trim() || 
                          u.full_name.toLowerCase().includes(staffSearchQuery.toLowerCase())
                        ).length === 0 && (
                          <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
                            ไม่พบรายชื่อที่ค้นหา
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loadingStaff || !selectedStaffId}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md shadow-emerald-600/20 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  <span>{loadingStaff ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบปฏิบัติงาน Quick Win'}</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </form>

          </div>
        </div>
      ) : authMode === 'staff_full_login' ? (
        /* STAFF FULL LOGIN VIEW (AUTHENTICATED LOGIN WITH PASSWORD) */
        <div className="max-w-md mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-sky-200 dark:border-sky-900 p-6 sm:p-8 shadow-sm space-y-6 animate-fade-in">
          <div className="flex items-center space-x-3.5 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950 text-sky-600 flex items-center justify-center font-bold">
              <Lock size={24} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Staff Portal (เข้าสู่ระบบเต็มรูปแบบ)</h3>
              <p className="text-xs text-slate-500">ยืนยันตัวตนด้วยชื่อผู้ใช้และรหัสผ่านเพื่อความปลอดภัยสูงสุด</p>
            </div>
          </div>

          {fullLoginError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 text-rose-800 dark:text-rose-200 rounded-xl text-xs font-bold flex items-center space-x-2">
              <ShieldAlert size={16} className="shrink-0 text-rose-600" />
              <span>{fullLoginError}</span>
            </div>
          )}

          <form onSubmit={handleStaffFullSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                ชื่อผู้ใช้งาน หรือ อีเมล (Username / Email)
              </label>
              <input
                type="text"
                value={fullUsername}
                onChange={(e) => setFullUsername(e.target.value)}
                placeholder="เช่น user01@medlab.local"
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                รหัสผ่าน (Password)
              </label>
              <input
                type="password"
                value={fullPassword}
                onChange={(e) => setFullPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="p-3 bg-sky-50/60 dark:bg-sky-950/40 rounded-xl border border-sky-100 dark:border-sky-900 text-[11px] text-sky-800 dark:text-sky-300 space-y-1">
              <p className="font-bold flex items-center gap-1">
                <ShieldCheck size={13} className="text-sky-600" />
                <span>การตรวจสอบความปลอดภัย:</span>
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                • รหัสผ่านถูกยืนยันผ่านเซิร์ฟเวอร์หลังบ้าน (Backend Server) ด้วย bcrypt ไม่เปิดเผยรหัสผ่านต่อเบราว์เซอร์
              </p>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAuthMode('selector')}
                className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                <ArrowLeft size={14} className="text-slate-500" />
                <span>ย้อนกลับ</span>
              </button>
              <button
                type="submit"
                disabled={loadingFullLogin}
                className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-sm disabled:opacity-50"
              >
                <span>{loadingFullLogin ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* 3 Role Selection Cards */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* ROLE 1: WARD USER */}
          <div 
            onClick={() => {
              if (isAdminLoggedIn) {
                onSelectRole('user');
              } else {
                window.location.href = 'https://labsangkha.my.canva.site/dtx-management';
              }
            }}
            className={`group bg-white dark:bg-slate-900 rounded-2xl border p-6 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-1 relative overflow-hidden ${
              currentRole === 'user'
                ? 'border-sky-500 ring-2 ring-sky-500/20'
                : 'border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700'
            }`}
            id="role-card-ward"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/80 border border-sky-100 dark:border-sky-900/60 flex items-center justify-center text-sky-600 dark:text-sky-400 group-hover:scale-105 transition-transform">
                  <Building2 size={24} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded-md animate-pulse">
                    Coming soon...
                  </span>
                  <span className="text-[11px] font-extrabold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg">
                    สำหรับ ward
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white group-hover:text-sky-600 transition-colors">
                  ผู้ใช้งานทั่วไป / ward
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  พยาบาลและบุคลากรประจำหอผู้ป่วยหรือแผนกต่างๆ ทั่วโรงพยาบาล
                </p>
                <div className="mt-2.5 p-2.5 bg-amber-50/80 dark:bg-amber-950/30 rounded-xl border border-amber-200/80 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1.5">
                  <Clock size={13} className="shrink-0 text-amber-600" />
                  <span>ระบบใหม่สำหรับ Ward กำลังอยู่ระหว่างการพัฒนา (Coming soon...)</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                <div className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-300">
                  <Wrench size={13} className="text-sky-500 shrink-0" />
                  <span>แจ้งส่งซ่อมเครื่อง DTX ชำรุด</span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-300">
                  <Package size={13} className="text-sky-500 shrink-0" />
                  <span>ส่งคำขอเบิกเครื่องทดแทน / อุปกรณ์</span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-300">
                  <Search size={13} className="text-sky-500 shrink-0" />
                  <span>ติดตามสถานะงานซ่อมแบบ real time</span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-300">
                  <BookOpen size={13} className="text-sky-500 shrink-0" />
                  <span>คู่มือการใช้งาน & วิธีแก้ปัญหาเบื้องต้น</span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-4 space-y-2">
              <a
                href="https://labsangkha.my.canva.site/dtx-management"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs"
                id="btn-ward-legacy-system"
              >
                <span>🌐 ใช้ระบบเดิม (Canva Site)</span>
                <ArrowRight size={14} />
              </a>

              {isAdminLoggedIn ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectRole('user');
                  }}
                  className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-2 px-3 rounded-xl text-[11px] flex items-center justify-center space-x-1.5 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  <Lock size={12} className="text-indigo-500" />
                  <span>เข้าสู่หน้า Ward (สำหรับ Admin ทดสอบ/พัฒนา)</span>
                </button>
              ) : (
                <div className="text-center text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                  * กรุณาใช้ระบบเดิม หรือเข้าสู่ระบบแอดมินเพื่อดูหน้าพัฒนา
                </div>
              )}
            </div>
          </div>

          {/* ROLE 2: LAB STAFF (QUICK WIN + FULL PORTAL OPTION) */}
          <div 
            className={`group bg-white dark:bg-slate-900 rounded-2xl border p-6 flex flex-col justify-between transition-all duration-200 shadow-xs hover:shadow-md hover:-translate-y-1 relative overflow-hidden ${
              currentRole === 'staff'
                ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                : 'border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-700'
            }`}
            id="role-card-lab-staff"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-100 dark:border-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Microscope size={24} />
                </div>
                <span className="text-[11px] font-extrabold px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-lg">
                  งานชันสูตร
                </span>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  เจ้าหน้าที่งานชันสูตร (Lab Staff)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  บันทึกผล QC ทั้งหมด, กราฟ Levey-Jennings, ดูประวัติ IQC/EQA และจัดการเครื่องตรวจน้ำตาล
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                <div className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-300">
                  <Zap size={13} className="text-emerald-500 shrink-0" />
                  <span>Quick Win: เลือกชื่อเข้าใช้ทันที</span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-300">
                  <BarChart3 size={13} className="text-emerald-500 shrink-0" />
                  <span>ดูกราฟและประวัติ IQC</span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-4 space-y-2">
              <button
                type="button"
                onClick={() => setAuthMode('staff_quick_login')}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs"
                id="btn-staff-quick-win"
              >
                <Zap size={14} className="text-amber-300" />
                <span>Quick Win </span>
              </button>

              <button
                type="button"
                disabled
                className="w-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-1.5 border border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-60"
                id="btn-staff-full-portal"
              >
                <Lock size={12} className="text-slate-400" />
                <span>Staff Portal (ยังไม่เปิดใช้งาน)</span>
              </button>
            </div>
          </div>

          {/* ROLE 3: LAB SUPERVISOR / ADMIN */}
          <div 
            onClick={() => onSelectRole('admin')}
            className={`group bg-white dark:bg-slate-900 rounded-2xl border p-6 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-1 relative overflow-hidden ${
              currentRole === 'admin'
                ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-700'
            }`}
            id="role-card-admin"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                  <ShieldCheck size={24} />
                </div>
                <span className="text-[11px] font-extrabold px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-lg flex items-center gap-1">
                  <Lock size={10} />
                  <span>Admin</span>
                </span>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                  ผู้ดูแลระบบ &amp; หัวหน้างาน
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  หัวหน้ากลุ่มงานเทคนิคการแพทย์ และผู้ดูแลระบบ
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                <div className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-300">
                  <BarChart3 size={13} className="text-indigo-500 shrink-0" />
                  <span>ภาพรวมสถิติ &amp; แดชบอร์ด</span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-300">
                  <Layers size={13} className="text-indigo-500 shrink-0" />
                  <span>จัดการคลัง &amp; และประวัติซ่อมบำรุงเครื่อง</span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-300">
                  <Settings size={13} className="text-indigo-500 shrink-0" />
                  <span>ตั้งค่าระบบ</span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-4">
              <button
                type="button"
                className="w-full bg-indigo-50 dark:bg-indigo-950/60 group-hover:bg-indigo-600 text-indigo-800 dark:text-indigo-200 group-hover:text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer border border-indigo-200 dark:border-indigo-800 group-hover:border-indigo-600"
              >
                <span>{isAdminLoggedIn ? 'เข้าสู่ระบบผู้ดูแล (Admin Panel)' : 'เข้าสู่ระบบผู้ดูแล'}</span>
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

        </div>
      )}

      {/* Optional Cancel/Close Button */}
      {onClose && (
        <div className="text-center mt-8">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-600 font-bold transition-colors cursor-pointer"
          >
            ปิดหน้าต่างนี้
          </button>
        </div>
      )}
    </div>
  );
};
