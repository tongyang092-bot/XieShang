import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Bookmark, Check, Store, Users } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import { apiDiscoverPosts, apiOutfits, type DiscoverPost, type Outfit } from '@/api/xieshang'
import { AppShell } from '@/components/AppShell'
import { ImageLightbox } from '@/components/ImageLightbox'
import { useAppStore } from '@/store'

const A = '/assets/xieshang'
const shopNames = ['温柔研究所', '通勤衣橱', '法式日记', '轻盈旅行家']
const demoOutfits = [
  { id: -1, user_id: 'demo', name: '温柔约会穿搭', scene: '约会', cover_url: `${A}/tryon_effect_01.png`, items: [] },
  { id: -2, user_id: 'demo', name: '职场通勤穿搭', scene: '职场', cover_url: `${A}/tryon_effect_02.png`, items: [] },
  { id: -3, user_id: 'demo', name: '周末休闲穿搭', scene: '休闲', cover_url: `${A}/tryon_effect_03.png`, items: [] },
] as Outfit[]
const demoFavorites = [
  { id: -1, title: '紫色开衫春日约会灵感', description: '柔和配色与轻盈材质', image_url: `${A}/discover_model_01.png`, author_name: '泡泡', scene: '约会', channel: '推荐', tags: ['约会'], like_count: 632, favorite_count: 128, is_liked: false, is_favorited: true },
  { id: -2, title: '气质职场通勤搭配', description: '简约干练的日常通勤方案', image_url: `${A}/discover_model_04.png`, author_name: '职场穿搭小助手', scene: '职场', channel: '品牌', tags: ['职场'], like_count: 731, favorite_count: 96, is_liked: false, is_favorited: true },
] as DiscoverPost[]

export default function ProfileDetailPage() {
  const { section = 'outfits' } = useParams()
  const navigate = useNavigate()
  const { userId } = useAppStore()
  const [outfits, setOutfits] = useState<Outfit[]>([])
  const [posts, setPosts] = useState<DiscoverPost[]>([])
  const [preview, setPreview] = useState<{ src: string; title: string } | null>(null)
  const [followed, setFollowed] = useState<string[]>(shopNames.slice(0, 2))

  useEffect(() => {
    if (section === 'outfits') apiOutfits(userId).then((data) => setOutfits(data.length ? data : demoOutfits)).catch(() => setOutfits(demoOutfits))
    if (section === 'favorites') apiDiscoverPosts(userId).then((data) => {
      const favorites = data.filter((item) => item.is_favorited)
      setPosts(favorites.length ? favorites : demoFavorites)
    }).catch(() => setPosts(demoFavorites))
  }, [section, userId])

  const title = useMemo(() => ({ outfits: '我的穿搭', favorites: '我的收藏', shops: '关注店铺' })[section] || '个人内容', [section])

  return (
    <AppShell>
      <section className="pt-4">
        <header className="mb-5 flex items-center gap-3">
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm" type="button" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></button>
          <div><h1 className="text-2xl font-black">{title}</h1><p className="mt-1 text-xs text-[#6b7280]">查看和管理已保存内容</p></div>
        </header>

        {section === 'outfits' ? (
          <div className="grid grid-cols-2 gap-3">
            {outfits.map((outfit, index) => {
              const cover = outfit.cover_url && !outfit.cover_url.startsWith('/mock/') ? outfit.cover_url : `${A}/tryon_effect_${String((index % 5) + 1).padStart(2, '0')}.png`
              return <button className="overflow-hidden rounded-2xl bg-white text-left shadow-sm" type="button" key={outfit.id} onClick={() => setPreview({ src: cover, title: outfit.name })}><img src={cover} alt={outfit.name} className="aspect-[4/5] w-full object-cover object-top" /><div className="p-3"><div className="font-bold">{outfit.name}</div><div className="mt-1 text-xs text-[#8a8d96]">{outfit.items.length} 件单品 · {outfit.scene || '自定义搭配'}</div></div></button>
            })}
            <button className="flex min-h-40 flex-col items-center justify-center rounded-2xl bg-[#efe7ff] font-bold text-[#8b5cf6]" type="button" onClick={() => navigate('/closet')}><Bookmark className="mb-2 h-7 w-7" />去衣橱新建穿搭</button>
          </div>
        ) : null}

        {section === 'favorites' ? (
          posts.length ? <div className="grid grid-cols-2 gap-3">{posts.map((post, index) => {
            const image = post.image_url && !post.image_url.startsWith('/mock') ? post.image_url : `${A}/discover_model_${String((index % 9) + 1).padStart(2, '0')}.png`
            return <button className="overflow-hidden rounded-2xl bg-white text-left shadow-sm" type="button" key={post.id} onClick={() => setPreview({ src: image, title: post.title })}><img src={image} alt={post.title} className="aspect-[4/5] w-full object-cover" /><div className="p-3 text-sm font-bold">{post.title}</div></button>
          })}</div>
          : <div className="rounded-2xl bg-white px-4 py-12 text-center shadow-sm"><Bookmark className="mx-auto h-8 w-8 text-[#c4b5fd]" /><div className="mt-3 font-bold">还没有收藏内容</div><button className="mt-4 rounded-full bg-[#8b5cf6] px-4 py-2 text-sm font-bold text-white" type="button" onClick={() => navigate('/discover')}>去发现页收藏</button></div>
        ) : null}

        {section === 'shops' ? <div className="space-y-3">{shopNames.map((shop, index) => {
          const active = followed.includes(shop)
          return <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm" key={shop}><img src={`${A}/discover_model_${String(index + 1).padStart(2, '0')}.png`} alt={shop} className="h-16 w-16 rounded-xl object-cover" /><div className="min-w-0 flex-1"><div className="font-bold">{shop}</div><div className="mt-1 flex items-center gap-1 text-xs text-[#8a8d96]"><Users className="h-3.5 w-3.5" />{1.2 + index * 0.7} 万关注</div></div><button className={`flex items-center gap-1 rounded-full px-3 py-2 text-xs font-bold ${active ? 'bg-[#f3f1f6] text-[#777]' : 'bg-[#8b5cf6] text-white'}`} type="button" onClick={() => setFollowed((prev) => active ? prev.filter((item) => item !== shop) : [...prev, shop])}>{active ? <Check className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}{active ? '已关注' : '关注'}</button></div>
        })}</div> : null}
      </section>
      <ImageLightbox open={Boolean(preview)} src={preview?.src} title={preview?.title} onClose={() => setPreview(null)} />
    </AppShell>
  )
}
