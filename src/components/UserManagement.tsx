/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import CustomSelect from './CustomSelect';
import { SystemUser, UserPermissions } from '../types';
import { dbService } from '../lib/supabase';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  ShieldAlert, 
  Search, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  Lock, 
  Unlock, 
  RefreshCw, 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  UserCheck, 
  Sliders, 
  Layers, 
  Activity, 
  Wrench, 
  Package, 
  FileSpreadsheet,
  Briefcase
} from 'lucide-react';

const DEFAULT_PERMISSIONS_BY_ROLE: Record<string, UserPermissions> = {
  admin: {
    can_manage_stock: true,
    can_manage_qc: true,
    can_manage_repairs: true,
    can_manage_supplies: true,
    can_manage_users: true,
    can_export_reports: true,
    can_manage_configs: true,
  },
  manager: {
    can_manage_stock: true,
    can_manage_qc: true,
    can_manage_repairs: true,
    can_manage_supplies: true,
    can_manage_users: false,
    can_export_reports: true,
    can_manage_configs: true,
  },
  staff: {
    can_manage_stock: true,
    can_manage_qc: true,
    can_manage_repairs: true,
    can_manage_supplies: true,
    can_manage_users: false,
    can_export_reports: true,
    can_manage_configs: false,
  },
  user: {
    can_manage_stock: false,
    can_manage_qc: false,
    can_manage_repairs: true,
    can_manage_supplies: true,
    can_manage_users: false,
    can_export_reports: false,
    can_manage_configs: false,
  },
  viewer: {
    can_manage_stock: false,
    can_manage_qc: false,
    can_manage_repairs: false,
    can_manage_supplies: false,
    can_manage_users: false,
    can_export_reports: true,
    can_manage_configs: false,
  }
};

export default function UserManagement() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form Fields
  const [formName, setFormName] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formPosition, setFormPosition] = useState<string>('MT');
  const [formRole, setFormRole] = useState<SystemUser['role']>('staff');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formPermissions, setFormPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS_BY_ROLE['staff']);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await dbService.getSystemUsers();
      setUsers(data);
    } catch (err: any) {
      console.error('Failed to load users:', err);
      showToast('ไม่สามารถดึงข้อมูลผู้ใช้งานได้: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // When role changes in form, suggest default permissions
  const handleRoleChange = (newRole: SystemUser['role']) => {
    setFormRole(newRole);
    setFormPermissions(DEFAULT_PERMISSIONS_BY_ROLE[newRole] || DEFAULT_PERMISSIONS_BY_ROLE['user']);
  };

  const openAddModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormPosition('MT');
    setFormRole('staff');
    setFormIsActive(true);
    setFormPermissions(DEFAULT_PERMISSIONS_BY_ROLE['staff']);
    setIsModalOpen(true);
  };

  const openEditModal = (user: SystemUser) => {
    setEditingUser(user);
    setFormName(user.full_name);
    setFormEmail(user.email || '');
    setFormPosition(user.position || 'MT');
    setFormRole(user.role);
    setFormIsActive(user.is_active);
    setFormPermissions(user.permissions || DEFAULT_PERMISSIONS_BY_ROLE[user.role] || DEFAULT_PERMISSIONS_BY_ROLE['user']);
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('กรุณาระบุชื่อ-นามสกุลของผู้ใช้งาน');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingUser) {
        // Update user
        const updated = await dbService.updateSystemUser(editingUser.id, {
          full_name: formName.trim(),
          email: formEmail.trim(),
          position: formPosition.trim(),
          role: formRole,
          is_active: formIsActive,
          permissions: formPermissions
        });
        setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...updated } : u));
        showToast(`อัปเดตข้อมูลผู้ใช้งาน ${formName} เรียบร้อยแล้ว`);
      } else {
        // Create user
        const newUser = await dbService.insertSystemUser({
          full_name: formName.trim(),
          email: formEmail.trim(),
          position: formPosition.trim(),
          role: formRole,
          is_active: formIsActive,
          permissions: formPermissions
        });
        setUsers(prev => [newUser, ...prev]);
        showToast(`เพิ่มผู้ใช้งาน ${formName} เข้าสู่ระบบเรียบร้อยแล้ว`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save user:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + (err?.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: SystemUser) => {
    try {
      const nextStatus = !user.is_active;
      await dbService.updateSystemUser(user.id, { is_active: nextStatus });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: nextStatus } : u));
      showToast(`${nextStatus ? 'เปิดใช้งาน' : 'ระงับการใช้งาน'} บัญชี ${user.full_name} แล้ว`);
    } catch (err: any) {
      console.error('Failed to toggle status:', err);
      alert('ไม่สามารถเปลี่ยนสถานะได้: ' + (err?.message || err));
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await dbService.deleteSystemUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      setDeleteConfirmId(null);
      showToast('ลบข้อมูลผู้ใช้งานเรียบร้อยแล้ว');
    } catch (err: any) {
      console.error('Failed to delete user:', err);
      alert('ไม่สามารถลบข้อมูลได้: ' + (err?.message || err));
    }
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch = !q || 
        user.full_name.toLowerCase().includes(q) || 
        (user.email && user.email.toLowerCase().includes(q)) ||
        (user.position && user.position.toLowerCase().includes(q));

      const matchRole = roleFilter === 'all' || user.role === roleFilter;
      const matchStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && user.is_active) || 
        (statusFilter === 'inactive' && !user.is_active);

      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  // Summary counts
  const totalCount = users.length;
  const activeCount = users.filter(u => u.is_active).length;
  const adminCount = users.filter(u => u.role === 'admin').length;
  const staffCount = users.filter(u => u.role === 'staff' || u.role === 'manager').length;

  const getRoleBadge = (role: SystemUser['role']) => {
    switch (role) {
      case 'admin':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200">Admin (ผู้ดูแลระบบ)</span>;
      case 'manager':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-50 text-purple-700 border border-purple-200">Manager (หัวหน้างาน)</span>;
      case 'staff':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black bg-sky-50 text-sky-700 border border-sky-200">Lab Staff (เจ้าหน้าที่ชันสูตร)</span>;
      case 'user':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-50 text-amber-700 border border-amber-200">Ward Staff (เจ้าหน้าที่ Ward)</span>;
      case 'viewer':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-600 border border-slate-200">Viewer (ดูข้อมูลอย่างเดียว)</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">{role}</span>;
    }
  };

  return (
    <div className="space-y-6" id="user-management-panel">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2.5 text-xs font-bold animate-fade-in border border-slate-700">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
            <Users size={22} className="text-sky-600" />
            <span>จัดการผู้ใช้งานและกำหนดสิทธิ์ระบบ (User & Permissions)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            กำหนดบทบาทเจ้าหน้าที่ห้องปฏิบัติการ, ผู้ดูแลระบบ, และสิทธิ์การเข้าถึงแต่ละโมดูลของระบบ DTX POCT
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 cursor-pointer transition-all"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-sky-600' : ''} />
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center space-x-2 cursor-pointer shadow-md shadow-sky-500/20 shrink-0 transition-all"
          >
            <UserPlus size={16} />
            <span>+ เพิ่มผู้ใช้งานใหม่</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">ผู้ใช้ทั้งหมด</span>
            <span className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Users size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">บัญชีที่ลงทะเบียนในระบบ</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700">เปิดใช้งาน (Active)</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <UserCheck size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">{activeCount}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">พร้อมเข้าสู่ระบบใช้งาน</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700">ผู้ดูแลระบบ (Admin)</span>
            <span className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <ShieldCheck size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-rose-700 mt-2">{adminCount}</div>
          <div className="text-[11px] text-rose-600 mt-0.5">สิทธิ์เต็มทุกฟังก์ชัน</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-sky-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-700">จนท.ชันสูตร (Lab Staff)</span>
            <span className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
              <Activity size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-sky-700 mt-2">{staffCount}</div>
          <div className="text-[11px] text-sky-600 mt-0.5">MT / AMT / MTA</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาตามชื่อ-สกุล, อีเมล, หรือตำแหน่ง..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="flex items-center space-x-1.5 flex-1 sm:flex-initial">
            <span className="text-slate-500 font-medium">บทบาท:</span>
            <CustomSelect
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-xs p-1.5 rounded-lg border border-slate-200 bg-slate-50 font-bold"
            >
              <option value="all">ทุกบทบาท</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="staff">Lab Staff</option>
              <option value="user">Ward Staff</option>
              <option value="viewer">Viewer</option>
            </CustomSelect>
          </div>

          <div className="flex items-center space-x-1.5 flex-1 sm:flex-initial">
            <span className="text-slate-500 font-medium">สถานะ:</span>
            <CustomSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs p-1.5 rounded-lg border border-slate-200 bg-slate-50 font-bold"
            >
              <option value="all">ทุกสถานะ</option>
              <option value="active">เปิดใช้งาน</option>
              <option value="inactive">ระงับการใช้งาน</option>
            </CustomSelect>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 text-slate-600 border-b border-slate-200 font-bold">
              <tr>
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">ชื่อ-นามสกุล</th>
                <th className="py-3 px-4">ตำแหน่งงาน</th>
                <th className="py-3 px-4">บทบาท (Role)</th>
                <th className="py-3 px-4">สิทธิ์การเข้าถึง (Permissions)</th>
                <th className="py-3 px-4 text-center">สถานะ</th>
                <th className="py-3 px-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RefreshCw size={20} className="animate-spin text-sky-600" />
                      <span>กำลังโหลดรายชื่อผู้ใช้งาน...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    ไม่พบข้อมูลผู้ใช้งานตามเงื่อนไขที่กำหนด
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, idx) => {
                  const p = user.permissions || DEFAULT_PERMISSIONS_BY_ROLE[user.role] || {};
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/70 transition-all">
                      <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{user.full_name}</div>
                        {user.email && (
                          <div className="text-[11px] text-slate-400 font-mono">{user.email}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                          {user.position || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {getRoleBadge(user.role)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {p.can_manage_stock && (
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-bold">คลัง DTX</span>
                          )}
                          {p.can_manage_qc && (
                            <span className="text-[10px] bg-emerald-50 text-emerald-800 px-1.5 py-0.2 rounded font-bold">IQC/EQA</span>
                          )}
                          {p.can_manage_repairs && (
                            <span className="text-[10px] bg-sky-50 text-sky-800 px-1.5 py-0.2 rounded font-bold">งานซ่อม</span>
                          )}
                          {p.can_manage_supplies && (
                            <span className="text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.2 rounded font-bold">เบิกวัสดุ</span>
                          )}
                          {p.can_manage_users && (
                            <span className="text-[10px] bg-rose-50 text-rose-800 px-1.5 py-0.2 rounded font-bold">จัดการสิทธิ์</span>
                          )}
                          {p.can_export_reports && (
                            <span className="text-[10px] bg-purple-50 text-purple-800 px-1.5 py-0.2 rounded font-bold">ส่งออกรายงาน</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(user)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold cursor-pointer transition-all ${
                            user.is_active
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                          }`}
                          title="คลิกเพื่อสลับสถานะเปิด/ระงับการใช้งาน"
                        >
                          {user.is_active ? ' ใช้งานอยู่' : ' ระงับใช้งาน'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(user)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-sky-600 cursor-pointer transition-all"
                            title="แก้ไขข้อมูล & สิทธิ์"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(user.id)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-600 hover:text-rose-600 cursor-pointer transition-all"
                            title="ลบผู้ใช้งาน"
                          >
                            <Trash2 size={14} />
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

        {/* Footer Summary */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
          <span>แสดง {filteredUsers.length} จากทั้งหมด {users.length} บัญชีผู้ใช้งาน</span>
          <span className="text-slate-400">ระบบเชื่อมโยงฐานข้อมูล Supabase อัตโนมัติ</span>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 border border-slate-100 space-y-4 animate-scale-up">
            <div className="flex items-center space-x-3 text-rose-600">
              <AlertCircle size={24} />
              <h3 className="font-bold text-sm">ยืนยันการลบผู้ใช้งาน</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลบัญชีผู้ใช้งานนี้ออกจากระบบ? การกระทำนี้ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-600 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => handleDeleteUser(deleteConfirmId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold cursor-pointer shadow-md shadow-rose-500/20"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit User Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto" id="user-modal">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden border border-slate-100 my-8 animate-scale-up">
            <div className="bg-slate-950 text-white p-4.5 flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm flex items-center space-x-2">
                  <Key size={16} className="text-sky-400" />
                  <span>{editingUser ? 'แก้ไขข้อมูลผู้ใช้งานและกำหนดสิทธิ์' : 'เพิ่มผู้ใช้งานใหม่และกำหนดสิทธิ์'}</span>
                </h3>
                <p className="text-[10px] text-slate-400">
                  {editingUser ? 'แก้ไขบทบาทและกำหนดสิทธิ์การเข้าถึงระบบ DTX' : 'สร้างบัญชีผู้ใช้งานพร้อมกำหนดสิทธิ์เข้าถึงระบบ DTX'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto text-xs">
              {/* Row 1: Full Name & Position */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">ชื่อ-นามสกุล *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="เช่น ทนพ. สมเกียรติ มั่นคง"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-bold"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">ตำแหน่งงาน (Position)</label>
                  <CustomSelect
                    value={formPosition}
                    onChange={(e) => setFormPosition(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-bold"
                  >
                    <option value="MT">นักเทคนิคการแพทย์ (MT)</option>
                    <option value="AMT">เจ้าพนักงานวิทยาศาสตร์การแพทย์ (AMT)</option>
                    <option value="MTA">ผู้ช่วยนักเทคนิคการแพทย์ (MTA)</option>
                    <option value="Nurse">พยาบาลวิชาชีพ (RN)</option>
                    <option value="NA">ผู้ช่วยพยาบาล (NA)</option>
                    <option value="Other">อื่นๆ</option>
                  </CustomSelect>
                </div>
              </div>

              {/* Row 2: Email & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">อีเมล / ชื่อผู้ใช้ (Email / Username)</label>
                  <input
                    type="text"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="เช่น somkiat@sangkha-hospital.com"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">บทบาทหลักในระบบ (Role) *</label>
                  <CustomSelect
                    value={formRole}
                    onChange={(e) => handleRoleChange(e.target.value as any)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white font-bold"
                    required
                  >
                    <option value="admin">Admin (ผู้ดูแลระบบสูงสุด)</option>
                    <option value="manager">Manager (หัวหน้ากลุ่มงาน / กรรมการ POCT)</option>
                    <option value="staff">Lab Staff (เจ้าหน้าที่ห้องปฏิบัติการ)</option>
                    <option value="user">Ward Staff (เจ้าหน้าที่หอผู้ป่วย)</option>
                    <option value="viewer">Viewer (ผู้ดูรายงานอย่างเดียว)</option>
                  </CustomSelect>
                </div>
              </div>

              {/* Permissions Checklist Section */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center space-x-1.5 text-slate-800 font-extrabold text-xs">
                    <Sliders size={15} className="text-sky-600" />
                    <span>กำหนดสิทธิ์การใช้งานรายโมดูล (Granular Permissions)</span>
                  </div>
                  <span className="text-[10px] text-slate-400">เลือกสิทธิ์ที่อนุญาต</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {[
                    { key: 'can_manage_stock', label: 'จัดการทะเบียนและคลังเครื่อง DTX' },
                    { key: 'can_manage_qc', label: 'บันทึกและจัดการงานควบคุมคุณภาพ (IQC/EQA)' },
                    { key: 'can_manage_repairs', label: 'รับเรื่องและจัดการงานซ่อมบำรุง' },
                    { key: 'can_manage_supplies', label: 'จัดการเบิกจ่ายแผ่นตรวจและวัสดุ' },
                    { key: 'can_manage_users', label: 'จัดการบัญชีผู้ใช้งานและกำหนดสิทธิ์' },
                    { key: 'can_export_reports', label: 'ดาวน์โหลดและส่งออกรายงาน Excel/PDF' },
                    { key: 'can_manage_configs', label: 'ตั้งค่าระบบและเกณฑ์มาตรฐาน (LOT Range)' },
                  ].map((perm) => {
                    const isChecked = Boolean((formPermissions as any)[perm.key]);
                    return (
                      <label
                        key={perm.key}
                        className={`p-2.5 rounded-xl border flex items-center space-x-2.5 cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-sky-50/70 border-sky-300 text-sky-900 font-bold'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            setFormPermissions(prev => ({
                              ...prev,
                              [perm.key]: e.target.checked
                            }));
                          }}
                          className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="text-xs">{perm.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Status Switch */}
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                <div>
                  <span className="font-bold text-slate-800 text-xs">สถานะการเปิดใช้งานบัญชี</span>
                  <p className="text-[10px] text-slate-400">เปิดหรือปิดการเข้าถึงระบบของผู้ใช้งานรายนี้</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Form Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-sky-600 hover:bg-sky-500 text-white font-extrabold px-6 py-2.5 rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-md shadow-sky-500/20 disabled:opacity-50 transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>{editingUser ? 'บันทึกการแก้ไข' : 'สร้างผู้ใช้งาน'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
