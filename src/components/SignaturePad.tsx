'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Eraser, Check, X } from 'lucide-react'

interface SignaturePadProps {
  onSave: (signatureData: string) => void
  onCancel: () => void
}

export default function SignaturePad({ onSave, onCancel }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastX = useRef(0)
  const lastY = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas dimensions
    const resizeCanvas = () => {
      const parent = canvas.parentElement
      if (parent) {
        // Keep it responsive but a decent size
        canvas.width = parent.clientWidth
        canvas.height = 300
        
        ctx.strokeStyle = '#000000'
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.lineWidth = 2
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    return () => window.removeEventListener('resize', resizeCanvas)
  }, [])

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawing.current = true
    const pos = getPos(e)
    lastX.current = pos.x
    lastY.current = pos.y
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return
    
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const pos = getPos(e)
    
    ctx.beginPath()
    ctx.moveTo(lastX.current, lastY.current)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    
    lastX.current = pos.x
    lastY.current = pos.y

    // Prevent scrolling when drawing on touch devices
    if (e.cancelable) e.preventDefault()
  }

  const stopDrawing = () => {
    isDrawing.current = false
  }

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    
    const rect = canvas.getBoundingClientRect()
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      }
    } else {
      return {
        x: (e as React.MouseEvent).clientX - rect.left,
        y: (e as React.MouseEvent).clientY - rect.top
      }
    }
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    // Check if canvas is empty (optional but good)
    const signatureData = canvas.toDataURL('image/png')
    onSave(signatureData)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl overflow-hidden cursor-crosshair shadow-inner relative">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full touch-none"
        />
        <div className="absolute top-2 left-2 flex gap-2">
            <div className="bg-gray-100/50 backdrop-blur px-2 py-1 rounded text-[10px] font-bold text-gray-400 uppercase">SIGN HERE</div>
        </div>
      </div>
      
      <div className="flex justify-between gap-3">
        <button
          onClick={clearCanvas}
          className="px-4 py-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all flex items-center gap-2 text-sm font-semibold"
        >
          <Eraser size={18} />
          ล้างจอ
        </button>
        
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all text-sm font-semibold flex items-center gap-2"
          >
            <X size={18} />
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-black text-white rounded-lg shadow-md hover:bg-gray-800 transition-all text-sm font-bold flex items-center gap-2"
          >
            <Check size={18} />
            ใช้ลายเซ็นนี้
          </button>
        </div>
      </div>
    </div>
  )
}
