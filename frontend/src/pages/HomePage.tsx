import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Bot, ChevronRight, Crown, Heart, Link2, Plus, Send, Shirt, Sparkles } from 'lucide-react'

import { apiProfileSummary, apiTryonRecords } from '@/api/xieshang'
import { AppShell } from '@/components/AppShell'
import { ImageLightbox } from '@/components/ImageLightbox'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'

const A = '/assets/xieshang'

const scenes = [
  { name: '约会', image: `${A}/scene_date.png`, prompt: '约会穿搭，温柔显白，适合拍照' },
  { name: '职场', image: `${A}/scene_work.png`, prompt: '职场通勤穿搭，干练但不失温柔' },
  { name: '婚礼', image: `${A}/scene_wedding.png`, prompt: '婚礼宾客穿搭，优雅正式，有仪式感' },
  { name: '旅行', image: `${A}/scene_travel.png`, prompt: '旅行穿搭，清新轻盈，适合出片' },
  { name: '日常休闲', image: `${A}/scene_daily.png`, prompt: '日常休闲穿搭，舒适自在又显高' },
]

const previews = [
  { image: `${A}/tryon_effect_05.png`, label: '推荐' },
  { image: `${A}/tryon_effect_03.png`, label: '推荐' },
  { image: `${A}/tryon_effect_04.png`, label: '推荐' },
]

export default function HomePage() {
  const navigate = useNavigate()
  const {
    userId,
    height,
    weight,
    baseAvatarUrl,
    setPendingTask,
    error,
    setError,
    recentRecords,
    setRecentRecords,
  } = useAppStore()
  const [personFile, setPersonFile] = useState<File | null>(null)
  const [productFile, setProductFile] = useState<File | null>(null)
  const [personPreviewUrl, setPersonPreviewUrl] = useState('')
  const [productPreviewUrl, setProductPreviewUrl] = useState('')
  const [productUrl, setProductUrl] = useState('')
  const [chat, setChat] = useState('')
  const [stats, setStats] = useState({ wardrobe_count: 0, tryon_count: 0 })
  const [preview, setPreview] = useState<{ src: string; title: string } | null>(null)
  const [notice, setNotice] = useState('')
  const [favoritePreviews, setFavoritePreviews] = useState<number[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all([apiProfileSummary(userId), apiTryonRecords(userId)])
      .then(([summary, records]) => {
        if (cancelled) return
        setStats({ wardrobe_count: summary.stats.wardrobe_count, tryon_count: summary.stats.tryon_count })
        setRecentRecords(records)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [setRecentRecords, userId])

  useEffect(() => {
    if (!personFile) {
      setPersonPreviewUrl('')
      return
    }
    const previewUrl = URL.createObjectURL(personFile)
    setPersonPreviewUrl(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [personFile])

  useEffect(() => {
    if (!productFile) {
      setProductPreviewUrl('')
      return
    }
    const previewUrl = URL.createObjectURL(productFile)
    setProductPreviewUrl(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [productFile])

  const previewItems = useMemo(() => {
    const recent = recentRecords
      .filter((item) => item.final_tryon_url)
      .slice(0, 5)
      .map((item) => ({ image: item.final_tryon_url || '', label: '最近' }))
    return recent.length ? recent : previews
  }, [recentRecords])

  const startTryOn = () => {
    setError(null)
    if (!baseAvatarUrl && personFile) {
      const nextTryon = productFile || productUrl.trim()
        ? {
            file: productFile || undefined,
            fileUrl: productUrl.trim() || undefined,
            scene: chat.trim() || '指定商品试穿',
            itemName: '导入服装',
            category: '上衣',
            saveToWardrobe: true,
          }
        : undefined
      setPendingTask({
        type: 'onboarding',
        payload: { height: height || '165', weight: weight || '50', file: personFile, nextTryon },
      })
      navigate('/loading')
      return
    }
    if (!baseAvatarUrl && !personFile) {
      setError('请先上传人物照片，生成基础形象')
      return
    }
    if (!productFile && !productUrl.trim()) {
      setPendingTask({
        type: 'recommendation',
        payload: { query: chat.trim() || '请根据我的形象推荐一套温柔显白的日常穿搭', scene: chat.trim() || '日常推荐' },
      })
      navigate('/loading')
      return
    }
    setPendingTask({
      type: 'directTryon',
      payload: {
        file: productFile || undefined,
        fileUrl: productUrl.trim() || undefined,
        scene: chat.trim() || '指定商品试穿',
        itemName: '导入服装',
        category: '上衣',
        saveToWardrobe: true,
      },
    })
    navigate('/loading')
  }

  const runScene = (prompt: string) => {
    setError(null)
    if (!baseAvatarUrl) {
      setError('请先上传照片生成基础形象，再使用场景推荐')
      return
    }
    setPendingTask({ type: 'recommendation', payload: { query: prompt, scene: prompt } })
    navigate('/loading')
  }

  const openAssistant = () => {
    const query = chat.trim()
    if (!query) return
    navigate('/assistant', { state: { query } })
  }

  return (
    <AppShell withInputPadding>
      <section className="relative pt-4">
        <header className="flex h-[74px] items-start justify-between">
          <div>
            <div className="flex items-center gap-1 text-[30px] font-black leading-9">
              偕裳 <Sparkles className="h-6 w-6 fill-[#8b5cf6] text-[#8b5cf6]" />
            </div>
            <div className="mt-2 text-[15px] tracking-[0.18em] text-[#666]">AI · 让穿搭更懂你</div>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            <button className="flex h-7 items-center gap-1 rounded-full border border-[#f2d5a8] bg-[#fff4df] px-2 text-[11px] font-semibold text-[#b7791f] shadow-sm" type="button" onClick={() => navigate('/profile')}>
              <Crown className="h-3 w-3 fill-[#d18b25]" />
              会员中心
            </button>
            <button className="relative grid h-7 w-7 place-items-center rounded-full bg-white" type="button" onClick={() => setNotice('暂无新通知，试穿完成后会在这里提醒你。')}>
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-[#ff6565]" />
            </button>
          </div>
        </header>

        <div className="relative h-[132px] overflow-visible">
          <div
            className="pointer-events-none absolute -right-7 -top-16 h-[214px] w-[366px] opacity-95"
            style={{
              WebkitMaskImage: 'linear-gradient(to left, black 50%, transparent 100%)',
              maskImage: 'linear-gradient(to left, black 50%, transparent 100%)',
            }}
          >
            <img
              src={`${A}/home_hero_bg.png`}
              alt=""
              className="h-full w-full object-cover object-[74%_center]"
              style={{
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 14%, black 84%, transparent 100%)',
                maskImage: 'linear-gradient(to bottom, transparent 0%, black 14%, black 84%, transparent 100%)',
              }}
            />
          </div>
          <div className="absolute left-2 top-6 z-10">
            <h1 className="text-[27px] font-black leading-[34px]">
              <span className="text-[#8b5cf6]">AI</span>虚拟试穿
              <br />
              <span className="text-[#8b5cf6]">场景化</span>穿搭方案
            </h1>
            <p className="mt-1.5 text-[13px] font-medium text-[#666]">试穿 · 搭配 · 形象设计 · 一站式打造</p>
          </div>
        </div>

        {error ? <div className="mb-3 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div> : null}
        {notice ? <button className="mb-3 w-full rounded-2xl bg-[#f4edff] px-3 py-2 text-left text-xs text-[#7650d6]" type="button" onClick={() => setNotice('')}>{notice}<span className="float-right">关闭</span></button> : null}

        <div className="rounded-[20px] bg-white p-3 shadow-[0_8px_24px_rgba(124,58,237,0.14)]">
          <div className="grid grid-cols-2 gap-2">
            <div className="h-[190px] rounded-[18px] border border-[#f2ecff] bg-white p-2.5">
              <div className="text-[16px] font-bold leading-5">上传我的照片</div>
              <div className="mt-0.5 text-[12px] font-medium text-[#7b7f89]">生成3D全身形象</div>
              <div className="mt-2 grid grid-cols-[70px_minmax(0,1fr)] gap-1.5">
                <label className="flex h-[126px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d8c3ff] bg-[#fbf8ff] text-[#8b5cf6] active:scale-95">
                  <Plus className="h-7 w-7" />
                  <span className="mt-4 inline-flex h-7 min-w-[62px] items-center justify-center whitespace-nowrap rounded-[12px] bg-[#8b5cf6] px-2 text-[11px] font-semibold leading-none text-white shadow-[0_8px_18px_rgba(124,58,237,0.35)]">
                    {personFile ? '已选择照片' : '上传照片'}
                  </span>
                  <input className="hidden" type="file" accept="image/*" onChange={(event) => setPersonFile(event.target.files?.[0] || null)} />
                </label>
                <div className="h-[126px] overflow-hidden rounded-xl bg-[#faf8ff]">
                  <img
                    src={personPreviewUrl || baseAvatarUrl || `${A}/tryon_effect_02.png`}
                    alt="基础人体"
                    className={`h-full w-full ${personPreviewUrl || baseAvatarUrl ? 'object-contain object-bottom' : 'scale-[1.12] object-cover object-center'}`}
                    onError={(event) => {
                      event.currentTarget.onerror = null
                      event.currentTarget.src = `${A}/tryon_effect_02.png`
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="h-[190px] rounded-[18px] border border-[#f2ecff] bg-white p-3">
              <div className="text-[16px] font-bold leading-5">导入服装</div>
              <div className="mt-0.5 text-[12px] font-medium text-[#7b7f89]">支持图片或商品链接</div>
              <div className="mt-2.5 flex h-9 items-center gap-2 rounded-xl border border-[#e5e7eb] px-3 text-[#9ca3af]">
                <Link2 className="h-4 w-4" />
                <input value={productUrl} onChange={(event) => setProductUrl(event.target.value)} className="min-w-0 flex-1 text-xs outline-none" placeholder="粘贴商品链接" />
              </div>
              <div className="my-1.5 flex items-center gap-3 text-xs font-semibold text-[#555]">
                <span className="h-px flex-1 bg-[#ece8f5]" />或<span className="h-px flex-1 bg-[#ece8f5]" />
              </div>
              <label className="flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#d8c3ff] bg-[#fbf8ff] px-2 text-[13px] font-bold text-[#8b5cf6] active:scale-95">
                {productPreviewUrl ? (
                  <img src={productPreviewUrl} alt="已选择服装" className="h-8 w-8 shrink-0 rounded-md bg-white object-contain" />
                ) : (
                  <Shirt className="h-5 w-5 shrink-0" />
                )}
                <span className="max-w-[112px] truncate">{productFile ? productFile.name : '上传服装图片'}</span>
                <input className="hidden" type="file" accept="image/*" onChange={(event) => setProductFile(event.target.files?.[0] || null)} />
              </label>
            </div>
          </div>
          <Button className="mx-3 mt-2.5 h-11 w-[calc(100%-24px)] rounded-xl bg-gradient-to-r from-[#a855f7] to-[#7c3aed] text-white shadow-[0_8px_18px_rgba(124,58,237,0.35)] active:scale-[0.98]" onClick={startTryOn}>
            <span className="flex flex-col items-center justify-center leading-none">
              <span className="flex items-center gap-1.5 text-[14px] font-bold">
                <Sparkles className="h-3.5 w-3.5 fill-white" />
                开始AI试穿
              </span>
              <span className="mt-0.5 text-[11px] font-normal opacity-95">预计需要10-20秒</span>
            </span>
          </Button>
        </div>

        <div className="mt-2.5 rounded-[20px] bg-white p-3 shadow-[0_4px_12px_rgba(124,58,237,0.08)]">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-[16px] font-bold leading-5">试穿效果预览</h2>
            <button className="flex items-center text-xs font-medium text-[#8a8d96]" type="button" onClick={() => navigate('/tryons')}>
              查看更多 <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {previewItems.slice(0, 3).map((item, index) => (
              <div className="relative overflow-hidden rounded-xl bg-[#f5f1ee]" key={`${item.image}-${index}`}>
                <button className="block w-full" type="button" onClick={() => setPreview({ src: item.image, title: item.label === '最近' ? '最近试穿效果' : '试穿效果示例' })}>
                  <img
                    src={item.image}
                    alt="试穿预览"
                    className="aspect-[4/5] w-full object-cover object-top"
                    onError={(event) => {
                      event.currentTarget.onerror = null
                      event.currentTarget.src = previews[index % previews.length].image
                    }}
                  />
                </button>
                <span className="absolute left-2 top-2 rounded-md bg-[#ff9bcb] px-2 py-1 text-xs font-bold text-white">{item.label}</span>
                <button className={`absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90 ${favoritePreviews.includes(index) ? 'text-[#ff6b9d]' : 'text-[#8a8d96]'}`} type="button" onClick={() => setFavoritePreviews((value) => value.includes(index) ? value.filter((item) => item !== index) : [...value, index])} aria-label={favoritePreviews.includes(index) ? '取消收藏' : '收藏试穿效果'}>
                  <Heart className="h-5 w-5" fill={favoritePreviews.includes(index) ? 'currentColor' : 'none'} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-center gap-2">
            {[0, 1, 2, 3, 4, 5].map((dot) => (
              <span key={dot} className={`h-2 w-2 rounded-full ${dot === 0 ? 'bg-[#8b5cf6]' : 'bg-[#e5e1eb]'}`} />
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-5 gap-3">
          {scenes.map((scene) => (
            <button key={scene.name} className="text-center active:scale-95" type="button" onClick={() => runScene(scene.prompt)}>
              <img src={scene.image} alt={scene.name} className="h-16 w-16 rounded-xl object-cover" />
              <div className="mt-1 text-sm font-semibold">{scene.name}</div>
            </button>
          ))}
        </div>

        <div className="fixed bottom-[88px] left-1/2 z-40 flex h-14 w-[361px] -translate-x-1/2 items-center gap-3 rounded-[20px] bg-white px-3 shadow-[0_8px_24px_rgba(124,58,237,0.14)]">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[#8b5cf6] text-white">
            <Bot className="h-6 w-6" />
          </div>
          <input value={chat} onChange={(event) => setChat(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && openAssistant()} className="min-w-0 flex-1 text-base outline-none placeholder:text-[#9ca3af]" placeholder="有什么穿搭问题都可以问我哦~" />
          <button className="grid h-10 w-10 place-items-center rounded-full bg-[#8b5cf6] text-white shadow-[0_8px_18px_rgba(124,58,237,0.35)] active:scale-95" type="button" onClick={openAssistant}>
            <Send className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-2 text-center text-[11px] text-[#9ca3af]">{stats.wardrobe_count} 件衣橱单品 · {stats.tryon_count} 次试穿</div>
      </section>
      <ImageLightbox open={Boolean(preview)} src={preview?.src} title={preview?.title} onClose={() => setPreview(null)} />
    </AppShell>
  )
}
