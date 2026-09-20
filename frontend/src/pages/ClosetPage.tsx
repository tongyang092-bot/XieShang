import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, CalendarDays, Check, ChevronRight, Eye, Filter, MoreHorizontal, Plus, Search, Send, Settings, Sparkles } from 'lucide-react'

import { apiCreateOutfit, apiOutfits, apiWardrobeItems, type Outfit, type WardrobeItem } from '@/api/xieshang'
import { AppShell } from '@/components/AppShell'
import { ImageLightbox } from '@/components/ImageLightbox'
import { useAppStore } from '@/store'

const A = '/assets/xieshang'

const categoryTabs = [
  { label: '全部', icon: '•••' },
  { label: '上衣', image: `${A}/clothes_top_01.svg` },
  { label: '下装', image: `${A}/clothes_bottom_01.svg` },
  { label: '连衣裙', image: `${A}/clothes_dress_01.svg` },
  { label: '外套', image: `${A}/clothes_outer_01.svg` },
  { label: '鞋子', image: `${A}/clothes_shoes_01.svg` },
  { label: '配饰', image: `${A}/clothes_hat_01.svg` },
  { label: '包包', image: `${A}/clothes_bag_01.svg` },
]

const imageMap: Record<string, string> = {
  上衣: `${A}/wardrobe_knit_purple.png`,
  下装: `${A}/wardrobe_jeans_straight.png`,
  外套: `${A}/wardrobe_blazer_beige.png`,
  连衣裙: `${A}/wardrobe_dress_french.png`,
  鞋子: `${A}/wardrobe_shoes_white.png`,
  包包: `${A}/wardrobe_bag_beige.png`,
  配饰: `${A}/wardrobe_hat_beret.png`,
}

const imageByName: Record<string, string> = {
  紫色针织衫: `${A}/wardrobe_knit_purple.png`,
  白色衬衫: `${A}/wardrobe_shirt_white.png`,
  米色西装外套: `${A}/wardrobe_blazer_beige.png`,
  直筒牛仔裤: `${A}/wardrobe_jeans_straight.png`,
  法式连衣裙: `${A}/wardrobe_dress_french.png`,
  小白鞋: `${A}/wardrobe_shoes_white.png`,
  米色单肩包: `${A}/wardrobe_bag_beige.png`,
  贝雷帽: `${A}/wardrobe_hat_beret.png`,
}

const demoItems = [
  { id: 1, name: '紫色针织衫', category: '上衣', image_url: `${A}/wardrobe_knit_purple.png`, created_at: '2024-05-20' },
  { id: 2, name: '白色衬衫', category: '上衣', image_url: `${A}/wardrobe_shirt_white.png`, created_at: '2024-05-18' },
  { id: 3, name: '米色西装外套', category: '外套', image_url: `${A}/wardrobe_blazer_beige.png`, created_at: '2024-05-15' },
  { id: 4, name: '直筒牛仔裤', category: '下装', image_url: `${A}/wardrobe_jeans_straight.png`, created_at: '2024-05-12' },
  { id: 5, name: '法式连衣裙', category: '连衣裙', image_url: `${A}/wardrobe_dress_french.png`, created_at: '2024-05-10' },
  { id: 6, name: '小白鞋', category: '鞋子', image_url: `${A}/wardrobe_shoes_white.png`, created_at: '2024-05-08' },
  { id: 7, name: '米色单肩包', category: '包包', image_url: `${A}/wardrobe_bag_beige.png`, created_at: '2024-05-05' },
  { id: 8, name: '贝雷帽', category: '配饰', image_url: `${A}/wardrobe_hat_beret.png`, created_at: '2024-05-03' },
] as WardrobeItem[]

function imageFor(item: WardrobeItem) {
  if (item.image_url && !item.image_url.startsWith('/mock')) return item.image_url
  return imageByName[item.name] || imageMap[item.category] || `${A}/wardrobe_knit_purple.png`
}

function coverFor(outfit: Outfit, index: number) {
  if (outfit.cover_url && !outfit.cover_url.startsWith('/mock')) return outfit.cover_url
  return `${A}/tryon_effect_0${(index % 3) + 1}.png`
}

export default function ClosetPage() {
  const navigate = useNavigate()
  const { userId, setError } = useAppStore()
  const [items, setItems] = useState<WardrobeItem[]>([])
  const [outfits, setOutfits] = useState<Outfit[]>([])
  const [category, setCategory] = useState('全部')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [chat, setChat] = useState('')
  const [query, setQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [newestFirst, setNewestFirst] = useState(true)
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState<{ src: string; title: string; description?: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([apiWardrobeItems(userId), apiOutfits(userId)])
      .then(([nextItems, nextOutfits]) => {
        if (cancelled) return
        setItems(nextItems.length ? nextItems : demoItems)
        setOutfits(nextOutfits)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : '衣橱加载失败'
        setError(message)
        setNotice('当前展示本地演示衣橱，后端恢复后会自动同步。')
        setItems(demoItems)
      })
    return () => {
      cancelled = true
    }
  }, [setError, userId])

  const selectedItems = useMemo(() => {
    const source = items.length ? items : demoItems
    return source.filter((item) => selectedIds.includes(item.id))
  }, [items, selectedIds])

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return [...(items.length ? items : demoItems)]
      .filter((item) => category === '全部' || item.category === category)
      .filter((item) => !normalizedQuery || `${item.name} ${item.category}`.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        const value = String(b.created_at || '').localeCompare(String(a.created_at || ''))
        return newestFirst ? value : -value
      })
  }, [category, items, newestFirst, query])

  const stats = useMemo(() => {
    const source = items.length ? items : demoItems
    return {
      total: source.length,
      tops: source.filter((item) => item.category === '上衣').length,
      bottoms: source.filter((item) => item.category === '下装').length,
      accessories: source.filter((item) => ['配饰', '包包', '鞋子'].includes(item.category)).length,
    }
  }, [items])

  const createOutfit = async () => {
    if (!selectedIds.length) {
      setNotice('请先选择至少一件单品，再生成搭配。')
      return
    }

    const coverUrl = `${A}/tryon_effect_0${(outfits.length % 3) + 1}.png`
    const name = selectedItems.slice(0, 2).map((item) => item.name).join(' + ') || `新建穿搭 ${outfits.length + 1}`
    try {
      const outfit = await apiCreateOutfit(userId, {
        name,
        scene: '灵感搭配',
        cover_url: coverUrl,
        item_ids: selectedIds,
      })
      const saved = { ...outfit, cover_url: outfit.cover_url || coverUrl }
      setOutfits((prev) => [saved, ...prev])
      setSelectedIds([])
      setNotice('搭配已生成并保存到“我的穿搭”，点击卡片可放大查看。')
      setPreview({ src: coverFor(saved, 0), title: saved.name, description: `${saved.items?.length || selectedIds.length} 件单品 · AI 搭配效果` })
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存搭配失败'
      setNotice(`生成失败：${message}`)
    }
  }

  const askAssistant = () => {
    const value = chat.trim()
    if (!value) {
      setNotice('输入你的场景或穿搭问题，例如“生日 Party 怎么穿？”')
      return
    }
    navigate('/assistant', { state: { query: value } })
  }

  return (
    <AppShell withInputPadding>
      <section className="pt-4">
        <header className="mb-4 flex min-h-[74px] items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1 text-[28px] font-black">我的衣橱 <span className="text-[#8b5cf6]">✦</span></div>
            <div className="mt-2 text-[15px] text-[#6b7280]">选择单品，组合并保存你的专属搭配</div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button className="flex h-9 items-center gap-1 rounded-full bg-white px-3 text-sm font-bold text-[#8b5cf6] shadow-[0_4px_12px_rgba(124,58,237,0.08)]" type="button" onClick={() => navigate('/calendar')}><CalendarDays className="h-4 w-4" />穿搭日历</button>
            <button className="grid h-9 w-9 place-items-center rounded-full bg-white" type="button" onClick={() => setNotice('衣橱偏好设置：已启用智能分类与场景推荐。')}><Settings className="h-5 w-5" /></button>
          </div>
        </header>

        {notice ? <button className="mb-3 w-full rounded-xl border border-[#dfd0ff] bg-[#f6f0ff] px-3 py-2 text-left text-xs font-medium text-[#6d4ed4]" type="button" onClick={() => setNotice('')}>{notice} <span className="float-right text-[#9b82de]">关闭</span></button> : null}

        <div className="rounded-[18px] border border-[#eadffd] bg-[#f0e7ff] px-3 py-2.5 shadow-[0_4px_12px_rgba(124,58,237,0.08)]">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-[16px] font-bold leading-5">衣橱总览</h2>
            <button className="flex h-7 items-center rounded-full bg-white/70 px-2.5 text-xs font-semibold text-[#8b5cf6]" type="button" onClick={() => setNotice(`衣橱共有 ${stats.total} 件单品，已创建 ${outfits.length} 套穿搭。`)}>查看统计 <ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              ['👗', stats.total, '全部单品'],
              ['👚', stats.tops, '上衣'],
              ['👖', stats.bottoms, '下装'],
              ['👜', stats.accessories, '配饰/鞋包'],
            ].map(([icon, count, label]) => (
              <div className="flex h-[52px] items-center justify-center gap-1.5 rounded-lg bg-white px-1.5" key={label}>
                <div className="text-[18px] leading-none">{icon}</div>
                <div className="min-w-0"><div className="text-[17px] font-black leading-5">{count}</div><div className="truncate text-[10px] leading-3 text-[#7b7f89]">{label}</div></div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid h-16 grid-cols-8 rounded-[20px] bg-white p-1 shadow-[0_4px_12px_rgba(124,58,237,0.08)]">
          {categoryTabs.map((tab) => {
            const active = category === tab.label
            return (
              <button key={tab.label} className={`rounded-2xl text-center text-xs font-semibold active:scale-95 ${active ? 'bg-[#f1eafe] text-[#8b5cf6]' : 'text-[#8a8d96]'}`} type="button" onClick={() => setCategory(tab.label)}>
                {tab.image ? <img src={tab.image} alt="" className="mx-auto h-6 w-6 object-contain" /> : <span className="mx-auto block text-sm font-black leading-6">{tab.icon}</span>}
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-4 rounded-[20px] bg-white p-3 shadow-[0_4px_12px_rgba(124,58,237,0.08)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-bold leading-5">我的单品 <span className="text-[13px] font-medium text-[#8a8d96]">({visibleItems.length})</span></h2>
            <div className="flex gap-2">
              <button className={`flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold ${showSearch ? 'bg-[#eee5ff] text-[#7c3aed]' : 'bg-[#f6f5f8]'}`} type="button" onClick={() => setShowSearch((value) => !value)}><Search className="h-3.5 w-3.5" />搜索</button>
              <button className="flex h-8 items-center gap-1 rounded-full bg-[#f6f5f8] px-2.5 text-xs font-semibold" type="button" onClick={() => setNotice('使用上方分类标签，可以快速筛选上衣、下装、鞋包和配饰。')}><Filter className="h-3.5 w-3.5" />筛选</button>
              <button className="h-8 rounded-full bg-[#f6f5f8] px-2.5 text-xs font-semibold" type="button" onClick={() => setNewestFirst((value) => !value)}>{newestFirst ? '最新 ↓' : '最早 ↑'}</button>
            </div>
          </div>
          {showSearch ? <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="mb-3 h-10 w-full rounded-xl bg-[#f7f5fa] px-4 text-sm outline-none ring-[#b794f6] focus:ring-2" placeholder="搜索单品名称或分类" /> : null}
          <div className="grid grid-cols-4 gap-x-3 gap-y-5">
            {visibleItems.map((item) => {
              const selected = selectedIds.includes(item.id)
              return (
                <button key={item.id} className="relative text-left active:scale-95" type="button" onClick={() => setSelectedIds((prev) => (prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]))}>
                  <div className={`relative overflow-hidden rounded-xl border-2 ${selected ? 'border-[#8b5cf6]' : 'border-transparent'} bg-[#f8f6f3]`}>
                    <img src={imageFor(item)} alt={item.name} className="aspect-[4/5] w-full object-cover" />
                    <span className="absolute bottom-1 left-1 rounded-md bg-[#a879f7] px-2 py-0.5 text-[11px] font-bold text-white">{item.category}</span>
                    <span className={`absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full ${selected ? 'bg-[#8b5cf6] text-white' : 'bg-white/90 text-[#8a8d96]'}`}>{selected ? <Check className="h-4 w-4" /> : <MoreHorizontal className="h-4 w-4" />}</span>
                  </div>
                  <div className="mt-2 truncate text-sm font-bold">{item.name}</div>
                  <div className="text-xs text-[#8a8d96]">{item.created_at?.slice(0, 10) || '2024-05-20'}</div>
                </button>
              )
            })}
          </div>
          {!visibleItems.length ? <div className="py-8 text-center text-sm text-[#8a8d96]">没有找到匹配的单品</div> : null}
        </div>

        {selectedItems.length ? (
          <div className="mt-4 overflow-hidden rounded-[20px] border border-[#ddceff] bg-gradient-to-br from-[#f7f2ff] to-white p-3 shadow-[0_4px_12px_rgba(124,58,237,0.08)]">
            <div className="mb-3 flex items-center justify-between">
              <div><h2 className="flex items-center gap-1.5 text-[16px] font-bold"><Sparkles className="h-4 w-4 text-[#8b5cf6]" />搭配预览</h2><p className="mt-1 text-xs text-[#7b7f89]">已选择 {selectedItems.length} 件，确认后生成一张演示效果图</p></div>
              <button className="rounded-full bg-[#8b5cf6] px-4 py-2 text-xs font-bold text-white active:scale-95" type="button" onClick={createOutfit}>生成并保存搭配</button>
            </div>
            <div className="flex gap-2 overflow-x-auto">{selectedItems.map((item) => <img key={item.id} src={imageFor(item)} alt={item.name} className="h-24 w-20 shrink-0 rounded-xl bg-white object-cover" />)}</div>
          </div>
        ) : null}

        <div className="mt-4 rounded-[20px] bg-white p-3 shadow-[0_4px_12px_rgba(124,58,237,0.08)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-bold leading-5">我的穿搭 <span className="text-[13px] font-medium text-[#8a8d96]">({outfits.length})</span></h2>
            <button className="flex items-center text-sm font-medium text-[#8a8d96]" type="button" onClick={() => navigate('/profile/outfits')}>查看全部 <ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {outfits.map((outfit, index) => {
              const cover = coverFor(outfit, index)
              return (
                <button className="w-[104px] shrink-0 rounded-xl bg-[#f6f3fb] p-2 text-left active:scale-95" key={outfit.id} type="button" onClick={() => setPreview({ src: cover, title: outfit.name, description: `${outfit.items?.length || 0} 件单品 · ${outfit.scene || '日常搭配'}` })}>
                  <div className="relative"><img src={cover} alt={outfit.name} className="h-[76px] w-full rounded-lg object-cover" /><span className="absolute bottom-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-black/50 text-white"><Eye className="h-3.5 w-3.5" /></span></div>
                  <div className="mt-2 truncate text-xs font-bold">{outfit.name}</div><div className="text-[11px] text-[#8a8d96]">{outfit.items?.length || 0} 件单品</div>
                </button>
              )
            })}
            {!outfits.length ? <div className="flex h-[112px] min-w-[190px] items-center justify-center rounded-xl bg-[#f7f5fa] px-5 text-center text-xs text-[#8a8d96]">选择上方单品即可创建第一套穿搭</div> : null}
            <button className="flex h-[126px] w-[104px] shrink-0 flex-col items-center justify-center rounded-xl bg-[#f3eafe] text-[#8b5cf6] active:scale-95" type="button" onClick={createOutfit}><Plus className="h-8 w-8" /><span className="mt-2 text-sm font-bold">新建穿搭</span></button>
          </div>
        </div>

        <div className="fixed bottom-[88px] left-1/2 z-40 flex h-14 w-[361px] -translate-x-1/2 items-center gap-3 rounded-[20px] border border-[#e4d7ff] bg-white px-3 shadow-[0_8px_24px_rgba(124,58,237,0.14)]">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[#8b5cf6] text-white"><Bot className="h-6 w-6" /></div>
          <input value={chat} onChange={(event) => setChat(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') askAssistant() }} className="min-w-0 flex-1 text-base outline-none placeholder:text-[#9ca3af]" placeholder="问我生日 Party、约会或通勤怎么穿" />
          <button className="grid h-10 w-10 place-items-center rounded-full bg-[#8b5cf6] text-white" type="button" onClick={askAssistant}><Send className="h-5 w-5" /></button>
        </div>
      </section>

      <ImageLightbox open={Boolean(preview)} src={preview?.src} title={preview?.title} description={preview?.description} onClose={() => setPreview(null)} />
    </AppShell>
  )
}
