import { useEffect, useState } from 'react'
import { ArrowLeft, Clock3, Maximize2, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { apiTryonRecords, type TryonRecord } from '@/api/xieshang'
import { AppShell } from '@/components/AppShell'
import { ImageLightbox } from '@/components/ImageLightbox'
import { useAppStore } from '@/store'

const A = '/assets/xieshang'

const typeLabel: Record<TryonRecord['type'], string> = {
  onboarding: '基础形象',
  recommendation: 'AI 场景推荐',
  direct_tryon: '指定服装试穿',
}

function hasUsableResult(item: TryonRecord) {
  const url = item.final_tryon_url || ''
  return Boolean(url && !url.includes('mock-oss.com') && !url.startsWith('/mock/'))
}

export default function TryonHistoryPage() {
  const navigate = useNavigate()
  const { userId, recentRecords } = useAppStore()
  const [records, setRecords] = useState<TryonRecord[]>([])
  const [message, setMessage] = useState('正在加载试穿记录…')
  const [preview, setPreview] = useState<TryonRecord | null>(null)

  useEffect(() => {
    let cancelled = false
    apiTryonRecords(userId)
      .then((data) => {
        if (cancelled) return
        const merged = [...recentRecords, ...data].filter((item, index, source) => source.findIndex((candidate) => candidate.id === item.id) === index && hasUsableResult(item))
        setRecords(merged)
        setMessage(merged.length ? '' : '还没有可查看的试穿结果')
      })
      .catch(() => {
        if (cancelled) return
        const available = recentRecords.filter(hasUsableResult)
        setRecords(available)
        setMessage(available.length ? '' : '试穿记录加载失败，请确认后端服务正在运行')
      })
    return () => {
      cancelled = true
    }
  }, [recentRecords, userId])

  return (
    <AppShell>
      <section className="pt-4">
        <header className="mb-5 flex items-center gap-3">
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm" type="button" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></button>
          <div>
            <h1 className="text-2xl font-black">我的试穿</h1>
            <p className="mt-1 text-xs text-[#6b7280]">点击任意结果即可放大查看</p>
          </div>
        </header>

        {message ? <div className="rounded-2xl bg-white px-4 py-12 text-center text-sm text-[#8a8d96] shadow-sm">{message}</div> : null}

        <div className="grid grid-cols-2 gap-3">
          {records.map((record, index) => (
            <button className="overflow-hidden rounded-2xl bg-white text-left shadow-sm active:scale-[0.98]" key={record.id} type="button" onClick={() => setPreview(record)}>
              <div className="relative aspect-[4/5] overflow-hidden bg-[#f4f0f7]">
                <img src={record.final_tryon_url || `${A}/tryon_effect_${String((index % 5) + 1).padStart(2, '0')}.png`} alt="试穿结果" className="h-full w-full object-cover object-top" />
                <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[#8b5cf6]"><Maximize2 className="h-4 w-4" /></span>
              </div>
              <div className="p-3">
                <div className="flex items-center gap-1 text-xs font-bold text-[#8b5cf6]"><Sparkles className="h-3.5 w-3.5" />{typeLabel[record.type] || 'AI 试穿'}</div>
                <div className="mt-1 line-clamp-2 text-sm font-bold">{record.scene || '专属试穿效果'}</div>
                <div className="mt-2 flex items-center gap-1 text-[11px] text-[#9ca3af]"><Clock3 className="h-3 w-3" />{record.created_at?.slice(0, 10) || '刚刚'}</div>
              </div>
            </button>
          ))}
        </div>
      </section>
      <ImageLightbox open={Boolean(preview)} src={preview?.final_tryon_url} title={preview ? typeLabel[preview.type] : ''} description={preview?.scene} onClose={() => setPreview(null)} />
    </AppShell>
  )
}
