'use client'

import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants'

export default function StatusBadge({ status, className }: { status: string; className?: string }) {
  const label = STATUS_LABELS[status] || status
  const color = STATUS_COLORS[status] || 'bg-gray-100 text-gray-700 border-gray-200'

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${color} ${className || ''}`}>
      {label}
    </span>
  )
}
