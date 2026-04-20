-- ============================
-- PR/PO System V2 - Database Schema
-- ============================

-- 0. ลบตารางเก่าทิ้งทั้งหมด (รวมของเดิมจากระบบเก่าที่ไม่ได้ใช้แล้ว)
DROP TABLE IF EXISTS public.approval_chains CASCADE;
DROP TABLE IF EXISTS public.approval_logs CASCADE;
DROP TABLE IF EXISTS public.approval_workflows CASCADE;
DROP TABLE IF EXISTS public.approvals CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;
DROP TABLE IF EXISTS public.document_approvals CASCADE;
DROP TABLE IF EXISTS public.memos CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.petty_cash CASCADE;
DROP TABLE IF EXISTS public.po_items CASCADE;
DROP TABLE IF EXISTS public.pr_items CASCADE;
DROP TABLE IF EXISTS public.purchase_orders CASCADE;
DROP TABLE IF EXISTS public.purchase_requests CASCADE;
DROP TABLE IF EXISTS public.system_settings CASCADE;
DROP TABLE IF EXISTS public.user_signatures CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.users_profile CASCADE;
DROP TABLE IF EXISTS public.vendors CASCADE;
DROP TABLE IF EXISTS public.workflow_steps CASCADE;

-- 1. แผนก
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. ผู้ใช้งาน
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    role TEXT NOT NULL DEFAULT 'Requester' CHECK (role IN ('Admin','Requester','Manager','Purchasing','PurchasingManager','Executive','Accounting')),
    line_user_id TEXT,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. สายอนุมัติ
CREATE TABLE IF NOT EXISTS public.approval_chains (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_type TEXT NOT NULL CHECK (document_type IN ('PR','PO','PC')),
    step_order INT NOT NULL,
    approver_role TEXT NOT NULL CHECK (approver_role IN ('Manager','PurchasingManager','Executive','Accounting')),
    step_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(document_type, step_order)
);

-- 4. ใบขอซื้อ
CREATE TABLE IF NOT EXISTS public.purchase_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pr_number TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    requester_id UUID NOT NULL REFERENCES public.users(id),
    department_id UUID NOT NULL REFERENCES public.departments(id),
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Pending','Approved','Rejected')),
    current_step INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. รายการสินค้า PR
CREATE TABLE IF NOT EXISTS public.pr_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pr_id UUID NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
    item_code TEXT,
    description TEXT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'ชิ้น',
    is_rejected BOOLEAN DEFAULT false,
    reject_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 6. ใบสั่งซื้อ
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    po_number TEXT NOT NULL UNIQUE,
    pr_id UUID REFERENCES public.purchase_requests(id),
    vendor_name TEXT NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES public.users(id),
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Pending','Approved','Rejected')),
    current_step INT DEFAULT 0,
    requires_exec2 BOOLEAN DEFAULT false,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 7. รายการสินค้า PO
CREATE TABLE IF NOT EXISTS public.po_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'ชิ้น',
    unit_price NUMERIC DEFAULT 0,
    is_rejected BOOLEAN DEFAULT false,
    reject_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 8. บันทึกการอนุมัติ
CREATE TABLE IF NOT EXISTS public.approval_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_type TEXT NOT NULL CHECK (document_type IN ('PR','PO','PC')),
    document_id UUID NOT NULL,
    step_order INT NOT NULL,
    approver_id UUID NOT NULL REFERENCES public.users(id),
    action TEXT NOT NULL CHECK (action IN ('approve','reject')),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(document_type, document_id, step_order)
);

-- 11. ตั้งค่าระบบ
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 9. เงินสดย่อย
CREATE TABLE IF NOT EXISTS public.petty_cash (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pc_number TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    requester_id UUID NOT NULL REFERENCES public.users(id),
    department_id UUID NOT NULL REFERENCES public.departments(id),
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Pending','Approved','Rejected')),
    current_step INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 10. รายการเงินสดย่อย
CREATE TABLE IF NOT EXISTS public.pc_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pc_id UUID NOT NULL REFERENCES public.petty_cash(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC DEFAULT 0,
    is_rejected BOOLEAN DEFAULT false,
    reject_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================
-- Disable RLS (cookie-based auth)
-- ============================
ALTER TABLE public.departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_chains DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pc_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_logs DISABLE ROW LEVEL SECURITY;

-- ============================
-- Seed: Departments
-- ============================
INSERT INTO public.departments (name) VALUES
('ขนส่ง'),
('QC'),
('ฝ่ายผลิต'),
('Safety'),
('คลังสินค้า'),
('ทรัพยากรบุคคล'),
('Printing'),
('วางแผน'),
('TEST'),
('การตลาด'),
('ซ่อมบำรุง'),
('บัญชี'),
('ขาย'),
('R&D'),
('จัดซื้อ')
ON CONFLICT (name) DO NOTHING;

-- ============================
-- Seed: Default Approval Chains
-- ============================
INSERT INTO public.approval_chains (document_type, step_order, approver_role, step_name, is_active) VALUES
('PR', 1, 'Manager', 'ผจก.แผนก อนุมัติ', true),
('PR', 2, 'Executive', 'ผู้บริหาร อนุมัติ', true),
('PO', 1, 'PurchasingManager', 'ผจก.จัดซื้อ อนุมัติ', true),
('PO', 2, 'Executive', 'ผู้บริหาร 1 อนุมัติ', true),
('PO', 3, 'Executive', 'ผู้บริหาร 2 อนุมัติ', true),
('PC', 1, 'Manager', 'ผจก.แผนก อนุมัติ', true),
('PC', 2, 'Executive', 'ผู้บริหาร อนุมัติ', true),
('PC', 3, 'Accounting', 'การเงิน/บัญชี ตรวจสอบและจ่ายเงิน', true)
ON CONFLICT DO NOTHING;

-- ============================
-- Seed: Default Admin User
-- ============================
INSERT INTO public.users (username, password, first_name, last_name, role, is_approved) VALUES
('admin', '1234', 'Admin', 'System', 'Admin', true)
ON CONFLICT (username) DO NOTHING;

-- ============================
-- Seed: Test Data (Simulation)
-- ============================

-- 1. สร้าง User ทดลองในแผนก 'ฝ่ายผลิต'
DO $$
DECLARE
    dept_id UUID;
    req_id UUID;
    mgr_id UUID;
    pur_id UUID;
    exec_id UUID;
BEGIN
    -- ดึงไอดีแผนก
    SELECT id INTO dept_id FROM public.departments WHERE name = 'ฝ่ายผลิต' LIMIT 1;
    
    -- สร้าง Requester (คนขอชื่อ test)
    INSERT INTO public.users (username, password, first_name, last_name, role, is_approved, department_id)
    VALUES ('test', '1234', 'สมชาย', 'สายทดสอบ', 'Requester', true, dept_id)
    ON CONFLICT (username) DO UPDATE SET id = users.id RETURNING id INTO req_id;

    -- สร้าง Manager (ผจก. แผนกเดียวกัน)
    INSERT INTO public.users (username, password, first_name, last_name, role, is_approved, department_id)
    VALUES ('manager_test', '1234', 'สมศรี', 'หัวหน้างาน', 'Manager', true, dept_id)
    ON CONFLICT (username) DO UPDATE SET id = users.id RETURNING id INTO mgr_id;

    -- สร้าง Purchasing (คนจัดซื้อ)
    INSERT INTO public.users (username, password, first_name, last_name, role, is_approved)
    VALUES ('pur_test', '1234', 'จัดซื้อ', 'มือโปร', 'Purchasing', true)
    ON CONFLICT (username) DO UPDATE SET id = users.id RETURNING id INTO pur_id;

    -- สร้าง Purchasing Manager (ผจก. จัดซื้อ)
    INSERT INTO public.users (username, password, first_name, last_name, role, is_approved)
    VALUES ('pur_mgr_test', '1234', 'ผจก.', 'จัดซื้อสุดเก๋า', 'PurchasingManager', true)
    ON CONFLICT (username) DO UPDATE SET id = users.id RETURNING id INTO pur_id;

    -- สร้าง Executive (ผู้บริหาร)
    INSERT INTO public.users (username, password, first_name, last_name, role, is_approved)
    VALUES ('exec_test', '1234', 'ท่านประธาน', 'ใหญ่มาก', 'Executive', true)
    ON CONFLICT (username) DO UPDATE SET id = users.id RETURNING id INTO exec_id;

    -- สร้าง Accounting (ฝ่ายบัญชี)
    INSERT INTO public.users (username, password, first_name, last_name, role, is_approved)
    VALUES ('acc_test', '1234', 'สุมณี', 'มีเงินมาก', 'Accounting', true)
    ON CONFLICT (username) DO NOTHING;

    -- 2. สร้าง PR จำลองที่รออนุมัติ
    INSERT INTO public.purchase_requests (id, pr_number, title, description, requester_id, department_id, status, current_step)
    VALUES ('00000000-0000-0000-0000-000000000001', 'PR-2026-0001', 'ขอซื้อโน้ตบุ๊กสำหรับทำงานกราฟิก', 'ต้องการสเปคแรงๆ สำหรับใช้งาน Adobe', req_id, dept_id, 'Pending', 1)
    ON CONFLICT (pr_number) DO NOTHING;

    -- 3. เพิ่มรายการสินค้าใน PR
    INSERT INTO public.pr_items (pr_id, description, quantity, unit)
    VALUES 
    ('00000000-0000-0000-0000-000000000001', 'MacBook Pro M3 Max 14-inch', 1, 'เครื่อง'),
    ('00000000-0000-0000-0000-000000000001', 'Mouse Logitech MX Master 3S', 1, 'อัน'),
    ('00000000-0000-0000-0000-000000000001', 'Dell UltraSharp 27 Monitor', 2, 'จอ')
    ON CONFLICT DO NOTHING;

    -- 4. ตั้งค่าระบุเริ่มต้น (System Settings)
    INSERT INTO public.system_settings (key, value, description)
    VALUES 
    ('line_access_token', '', 'LINE Messaging API Access Token'),
    ('line_target_id', '', 'ID ของกลุ่ม LINE หรือ User ที่ต้องการส่งข้อความไปหา')
    ON CONFLICT (key) DO NOTHING;
END $$;
