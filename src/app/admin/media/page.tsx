"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Upload, Image, Trash2, Loader2 } from "lucide-react"

export default function MediaPage() {
  const [isUploading, setIsUploading] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const { toast } = useToast()

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", "Hembox.io/projects")

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) throw new Error(data.error)

      setImages((prev) => [...prev, data.url])

      toast({
        title: "Upload successful!",
        description: "Image has been uploaded to Cloudinary.",
        variant: "success",
      })
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Could not upload image",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }, [toast])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Media Library</h1>
        <p className="text-gray-600 mt-1">Manage your project images and assets</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Images</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-teal/50 transition">
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
              id="image-upload"
            />
            <label htmlFor="image-upload" className="cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-teal/10 grid place-items-center mx-auto mb-4">
                {isUploading ? (
                  <Loader2 className="w-6 h-6 text-teal animate-spin" />
                ) : (
                  <Upload className="w-6 h-6 text-teal" />
                )}
              </div>
              <p className="text-sm font-medium">Click to upload</p>
              <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 10MB</p>
            </label>
          </div>
        </CardContent>
      </Card>

      {images.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Images</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((url, index) => (
                <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200">
                  <img src={url} alt={`Upload ${index + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-navy/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                    <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                      <Image className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}