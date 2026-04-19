import { useCallback, useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/**
 * Drag-and-drop or click to upload an image; calls onUpload(file) which should return a URL.
 */
export default function ImageDropzone({
  value,
  onChange,
  onUpload,
  disabled,
  className,
}) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const handleFile = useCallback(
    async (file) => {
      if (!file || !file.type.startsWith('image/')) {
        setError('Please choose an image file.')
        return
      }
      setError(null)
      setUploading(true)
      try {
        const url = await onUpload(file)
        onChange(url)
      } catch (e) {
        setError(e?.message || 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [onChange, onUpload],
  )

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled || uploading) return
    const file = e.dataTransfer?.files?.[0]
    if (file) handleFile(file)
  }

  const onInputChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) handleFile(file)
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        className={cn(
          'relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/30',
          (disabled || uploading) && 'pointer-events-none opacity-60',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={disabled || uploading}
          onChange={onInputChange}
        />
        {uploading ? (
          <Loader2 className="size-10 animate-spin text-muted-foreground" />
        ) : (
          <ImagePlus className="size-10 text-muted-foreground" />
        )}
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {uploading ? 'Uploading…' : 'Drop an image here, or click to browse'}
        </p>
        <p className="text-xs text-muted-foreground">PNG, JPG, WebP up to 8MB</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {value ? (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-2">
          <img src={value} alt="Product" className="h-20 w-20 rounded-md object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">Image URL</p>
            <p className="break-all text-xs text-foreground">{value}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 h-7 px-2"
              disabled={disabled || uploading}
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
              }}
            >
              <X className="mr-1 size-3.5" />
              Remove
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
