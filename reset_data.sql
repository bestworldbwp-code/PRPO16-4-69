-- 1. เตรียมคอลัมน์ใหม่ในตารางใบสั่งซื้อ (กรณีที่ยังไม่มี)
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS requires_exec2 BOOLEAN DEFAULT FALSE;

-- 2. ล้างข้อมูลธุรกรรมทั้งหมด (Transaction Data)
-- ห้ามล้างตาราง 'departments' ตามคำขอ
TRUNCATE TABLE 
    public.approval_logs, 
    public.po_items, 
    public.pr_items, 
    public.purchase_orders, 
    public.purchase_requests 
RESTART IDENTITY CASCADE;

-- 3. รีเซ็ตสายการอนุมัติ PO ให้พร้อมใช้งานขั้นที่ 3 (สำหรับกรณีเลือกส่งต่อ)
UPDATE public.approval_chains 
SET is_active = true 
WHERE document_type = 'PO' AND step_order = 3;

-- 📋 ข้อมูลที่ยังคงอยู่:
-- - แผนก (Departments)
-- - รายชื่อผู้ใช้งาน (Users)
-- - การตั้งค่าสายการอนุมัติ (Approval Chains)
