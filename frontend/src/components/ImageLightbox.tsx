import { ExternalLink, X, ZoomIn } from 'lucide-react'

interface ImageLightboxProps {
  open: boolean
  src?: string
  title?: string
  description?: string
  onClose: () => void
}

export function ImageLightbox({ open, src, title, description, onClose }: ImageLightboxProps) {
  if (!open || !src) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true">
      <div className="relative flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-[#17131f] shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-bold"><ZoomIn className="h-4 w-4" />{title || '图片预览'}</div>
            {description ? <div className="mt-1 truncate text-xs text-white/60">{description}</div> : null}
          </div>
          <div className="flex shrink-0 gap-2">
            <button className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20" type="button" onClick={() => window.open(src, '_blank')} aria-label="在新窗口打开">
              <ExternalLink className="h-4 w-4" />
            </button>
            <button className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20" type="button" onClick={onClose} aria-label="关闭预览">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-black/35 p-3">
          <img src={src} alt={title || '放大预览'} className="mx-auto max-h-[82vh] max-w-full object-contain" />
        </div>
      </div>
    </div>
  )
}
