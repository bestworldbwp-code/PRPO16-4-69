// Roles
export const ROLES = {
  Admin: 'Admin',
  Requester: 'Requester',
  Manager: 'Manager',
  Purchasing: 'Purchasing',
  PurchasingManager: 'PurchasingManager',
  Executive: 'Executive',
  Accounting: 'Accounting',
} as const

export const ROLE_LABELS: Record<string, string> = {
  Admin: 'ผู้ดูแลระบบ',
  Requester: 'ผู้ขอซื้อ',
  Manager: 'ผจก.แผนก',
  Purchasing: 'จัดซื้อ',
  PurchasingManager: 'ผจก.จัดซื้อ',
  Executive: 'ผู้บริหาร',
  Accounting: 'บัญชี/การเงิน',
}

// Statuses
export const STATUS_LABELS: Record<string, string> = {
  Draft: 'แบบร่าง',
  Pending: 'รออนุมัติ',
  Approved: 'อนุมัติแล้ว',
  Rejected: 'ไม่อนุมัติ',
}

export const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700 border-gray-200',
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Rejected: 'bg-red-50 text-red-700 border-red-200',
}

// Role descriptions for admin UI
export const ROLE_DESCRIPTIONS: Record<string, string> = {
  Admin: 'ผู้ดูแลระบบทั้งหมด (ข้ามแผนก)',
  Requester: 'ผู้ขอซื้อ — ต้องสังกัดแผนก เพื่อผูกเอกสารกับแผนก',
  Manager: 'ผจก.แผนก — อนุมัติเอกสารเฉพาะแผนกตัวเอง',
  Purchasing: 'เจ้าหน้าที่จัดซื้อ — เห็น PR ที่ผ่านอนุมัติทุกแผนก, สร้าง PO',
  PurchasingManager: 'ผจก.จัดซื้อ — อนุมัติ PO ทุกแผนก',
  Executive: 'ผู้บริหาร — อนุมัติเอกสารทุกประเภท ข้ามแผนก',
  Accounting: 'ฝ่ายบัญชี/การเงิน — ตรวจสอบและจ่ายเงินสดย่อย ข้ามแผนก',
}

// Auto-suggested department name for each role (null = user must pick)
export const ROLE_AUTO_DEPT: Record<string, string | null> = {
  Admin: null,
  Requester: null,
  Manager: null,
  Purchasing: 'จัดซื้อ',
  PurchasingManager: 'จัดซื้อ',
  Executive: null,
  Accounting: 'บัญชี',
}

// Roles that work cross-department (department is optional)
export const CROSS_DEPT_ROLES = ['Admin', 'Purchasing', 'PurchasingManager', 'Executive', 'Accounting']
