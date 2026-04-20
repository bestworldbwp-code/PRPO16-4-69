'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { File, X, Upload, CheckCircle, AlertCircle, Loader2, FileText, Image as ImageIcon, Archive } from 'lucide-react'

interface Attachment {
  name: string
  url: string
  size: number
  type: string
}

interface FileUploadProps {
  value: Attachment[]
  onChange: (value: Attachment[]) => void
  bucket?: string
  maxFiles?: number
}

export default function FileUpload({ 
  value = [], 
  onChange, 
  bucket = 'attachments',
  maxFiles = 5 
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (value.length + files.length > maxFiles) {
      setError(`คุณสามารถแนบไฟล์ได้สูงสุด ${maxFiles} ไฟล์`)
      return
    }

    setUploading(true)
    setError(null)

    const newAttachments = [...value]

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      // Basic validation
      if (file.size > 5 * 1024 * 1024) {
        setError(`ไฟล์ ${file.name} มีขนาดใหญ่เกินไป (สูงสุด 5MB)`)
        continue
      }

      try {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
        const filePath = `${fileName}`

        const { data, error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath)

        newAttachments.push({
          name: file.name,
          url: publicUrl,
          size: file.size,
          type: file.type
        })
      } catch (err: any) {
        console.error('Upload error:', err)
        setError(`เกิดข้อผิดพลาดในการอัปโหลดไฟล์ ${file.name}: ${err.message}`)
      }
    }

    onChange(newAttachments)
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = async (index: number) => {
    const newAttachments = [...value]
    newAttachments.splice(index, 1)
    onChange(newAttachments)
  }

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return <ImageIcon size={20} className="text-blue-500" />
    if (type.includes('pdf')) return <FileText size={20} className="text-red-500" />
    if (type.includes('zip') || type.includes('archive')) return <Archive size={20} className="text-amber-500" />
    return <File size={20} className="text-gray-500" />
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-4 font-sans">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
          ไฟล์แนบประกอบ (สูงสุด {maxFiles} ไฟล์)
        </label>
      </div>

      {/* Attachment List */}
      {value.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {value.map((file, index) => (
            <div 
              key={index}
              className="group relative flex items-center gap-3 p-3 bg-white border border-slate-300 rounded-xl hover:shadow-md transition-all animate-in fade-in slide-in-from-left-4"
            >
              <div className="shrink-0">
                {getFileIcon(file.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate pr-6">{file.name}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase">{formatSize(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="absolute right-2 top-2 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {value.length < maxFiles && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative cursor-pointer border-2 border-dashed rounded-2xl p-6 text-center transition-all
            ${uploading ? 'bg-gray-50 border-slate-300 cursor-not-allowed' : 'bg-white border-slate-300 hover:border-blue-400 hover:bg-blue-50/30'}
          `}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            multiple
            accept="image/*,.pdf,.zip,.rar,.doc,.docx,.xls,.xlsx"
          />
          
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={24} className="text-blue-500 animate-spin" />
              <p className="text-xs font-bold text-gray-400 uppercase">กำลังอัปโหลดไฟล์...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 bg-gray-50 text-gray-400 rounded-xl flex items-center justify-center group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                <Upload size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-700">คลิกหรือลากไฟล์มาวางที่นี่</p>
                <p className="text-[10px] text-gray-400 font-medium uppercase mt-1">ไฟล์ PDF, รูปภาพ, Excel (สูงสุด 5MB)</p>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-500 bg-red-50 p-2.5 rounded-lg border border-red-100 animate-in shake duration-500">
          <AlertCircle size={14} />
          <p className="text-[11px] font-bold">{error}</p>
        </div>
      )}
    </div>
  )
}
