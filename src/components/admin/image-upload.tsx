"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Upload, X, Loader2 } from "lucide-react"

interface ImageUploadProps {
  value: string
  onChange: (url: string) => void
  onRemove: () => void
}

export function ImageUpload({ value, onChange, onRemove }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    formData.append("folder", "Hembox.io/portfolio")

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()
      if (data.url) {
        onChange(data.url)
      }
    } catch (error) {
      console.error("Upload error:", error)
    } finally {
      setIsUploading(false)
    }
  }

  if (value) {
    return (
      <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-black/5">
        <img src={value} alt="Upload" className="w-full h-full object-cover" />
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 p-1.5 bg-navy/80 text-white rounded-full hover:bg-navy transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="aspect-[4/3] rounded-2xl border-2 border-dashed border-black/10 flex flex-col items-center justify-center gap-3 bg-gray-50/50 hover:bg-gray-100/50 transition relative cursor-pointer group">
      <input
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="absolute inset-0 opacity-0 cursor-pointer"
        disabled={isUploading}
      />
      {isUploading ? (
        <Loader2 className="w-8 h-8 text-teal animate-spin" />
      ) : (
        <>
          <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition">
            <Upload className="w-6 h-6 text-gray-400" />
          </div>
          <div className="text-center">
            <p className="text-[14px] font-bold text-navy">Click to upload image</p>
            <p className="text-[12px] text-gray-500">JPG, PNG or WebP</p>
          </div>
        </>
      )}
    </div>
  )
}
