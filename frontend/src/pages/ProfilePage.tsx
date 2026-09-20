import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ChevronRight, Crown, Headphones, HelpCircle, Image, MapPin, NotebookText, Package, Pencil, Ruler, Settings, ShieldCheck, Shirt, Sparkles, Truck, WalletCards } from 'lucide-react'

import { apiProfileSummary, type ProfileSummary } from '@/api/xieshang'
import { AppShell } from '@/components/AppShell'
import { useAppStore } from '@/store'

const A = '/assets/xieshang'

const benefits = [
  { label: '会员专属', desc: '尊享多项特权', icon: ShieldCheck },
  { label: '无限试穿', desc: '每日AI试穿次数', icon: Sparkles },
  { label: '高清导出', desc: '高清图导出特权', icon: Image },
  { label: '专属客服', desc: '优先解答问题', icon: Headphones },
]

const orders = [
  { label: '待付款', icon: WalletCards },
  { label: '待发货', icon: Package },
  { label: '待收货', icon: Truck },
  { label: '待评价', icon: NotebookText },
  { label: '退换/售后', icon: HelpCircle },
]

const activities = [
  { label: '我的收藏', icon: '♡' },
  { label: '浏览记录', icon: '◷' },
  { label: '我的笔记', icon: '▤' },
  { label: '优惠券', icon: '♢' },
  { label: '地址管理', icon: MapPin },
]

const services = [
  { label: 'AI偏好设置', icon: 'AI' },
  { label: '尺码管理', icon: Ruler },
  { label: '帮助中心', icon: HelpCircle },
  { label: '意见反馈', icon: Pencil },
  { label: '关于我们', icon: 'i' },
]

function ShortcutIcon({ icon, purple = false }: { icon: string | React.ComponentType<{ className?: string }>; purple?: boolean }) {
  if (typeof icon === 'string') {
    return <span className={`grid h-7 w-7 place-items-center text-xl ${purple ? 'text-[#8b5cf6]' : 'text-[#9ca3af]'}`}>{icon}</span>
  }
  const Icon = icon
  return <Icon className={`h-6 w-6 ${purple ? 'text-[#8b5cf6]' : 'text-[#9ca3af]'}`} />
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { userId, nickname, setError } = useAppStore()
  const [summary, setSummary] = useState<ProfileSummary | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    let cancelled = false
    apiProfileSummary(userId)
      .then((data) => {
        if (!cancelled) setSummary(data)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : '个人信息加载失败'
          setError(message)
        }
      })
    return () => {
      cancelled = true
    }
  }, [setError, userId])

  const stats = summary?.stats || { tryon_count: 28, outfit_count: 56, favorite_count: 128, wardrobe_count: 256 }

  const clickStatic = (label: string) => {
    setToast(`${label}为演示入口`)
    window.setTimeout(() => setToast(''), 1600)
  }

  return (
    <AppShell>
      <section className="pt-4">
        <header className="mb-4 flex justify-end gap-2.5 pr-1">
          <button className="grid h-7 w-7 place-items-center rounded-full bg-white" type="button" onClick={() => clickStatic('个人设置')}><Settings className="h-4.5 w-4.5" /></button>
          <button className="relative grid h-7 w-7 place-items-center rounded-full bg-white" type="button" onClick={() => clickStatic('消息通知')}>
            <Bell className="h-4.5 w-4.5" />
            <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-[#ff6565]" />
          </button>
        </header>

        <div className="relative mb-5 flex items-center gap-5">
          <img src={summary?.user.avatar_url || `${A}/model_avatar_01.svg`} alt="头像" className="h-20 w-20 rounded-full border-4 border-white object-cover shadow-[0_8px_24px_rgba(124,58,237,0.14)]" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[24px] font-bold leading-8">{summary?.user.nickname || nickname || '小鹿酱'}</h1>
              <span className="text-xl text-[#8b5cf6]">♀</span>
            </div>
            <p className="mt-1.5 text-[13px] font-medium text-[#6b7280]">用AI发现更美的自己 ✨</p>
            <button className="mt-2.5 flex h-8 items-center gap-1 rounded-full bg-white px-3 text-xs font-semibold text-[#8b5cf6] shadow-sm" type="button" onClick={() => clickStatic('编辑资料')}>
              编辑资料 <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <button className="absolute bottom-0 right-0 flex h-8 items-center gap-1 rounded-full bg-[#a879f7] px-2.5 text-[11px] font-semibold text-white shadow-[0_8px_18px_rgba(124,58,237,0.35)]" type="button" onClick={() => clickStatic('会员中心')}>
            <Crown className="h-3 w-3 fill-white" />会员中心
          </button>
        </div>

        <div className="mb-3 grid h-[62px] grid-cols-4 rounded-[18px] bg-white shadow-[0_4px_12px_rgba(124,58,237,0.08)]">
          {[
            ['我的试穿', stats.tryon_count || 28, '/tryons'],
            ['我的穿搭', stats.outfit_count || 56, '/profile/outfits'],
            ['我的收藏', stats.favorite_count || 128, '/profile/favorites'],
            ['关注店铺', 12, '/profile/shops'],
          ].map(([label, count, path]) => (
            <button className="flex flex-col items-center justify-center border-r border-[#f0edf5] transition-colors active:bg-[#f5efff] last:border-r-0" key={label} type="button" onClick={() => navigate(String(path))}>
              <div className="text-[20px] font-bold leading-6">{count}</div>
              <div className="mt-0.5 text-xs font-medium text-[#6b7280]">{label}</div>
            </button>
          ))}
        </div>

        {toast ? <div className="mb-3 rounded-full bg-[#111] px-4 py-2 text-center text-xs text-white">{toast}</div> : null}

        <div className="space-y-3">
          <section className="rounded-[20px] bg-white p-4 shadow-[0_4px_12px_rgba(124,58,237,0.08)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[16px] font-bold leading-5">我的权益</h2>
              <button className="flex items-center text-xs font-medium text-[#8a8d96]" type="button" onClick={() => clickStatic('全部权益')}>查看全部权益 <ChevronRight className="h-3.5 w-3.5" /></button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {benefits.map(({ label, desc, icon: Icon }) => (
                <button key={label} className="text-center active:scale-95" type="button" onClick={() => clickStatic(label)}>
                  <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#f1eafe] text-[#8b5cf6]"><Icon className="h-5 w-5" /></span>
                  <div className="mt-1.5 text-xs font-bold leading-4">{label}</div>
                  <div className="mt-0.5 text-[11px] leading-4 text-[#9ca3af]">{desc}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[20px] bg-white p-4 shadow-[0_4px_12px_rgba(124,58,237,0.08)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[16px] font-bold leading-5">我的订单</h2>
              <button className="flex items-center text-xs font-medium text-[#8a8d96]" type="button" onClick={() => clickStatic('全部订单')}>查看全部订单 <ChevronRight className="h-3.5 w-3.5" /></button>
            </div>
            <div className="grid grid-cols-5">
              {orders.map(({ label, icon }) => (
                <button key={label} className="flex flex-col items-center gap-1.5 active:scale-95" type="button" onClick={() => clickStatic(label)}>
                  <ShortcutIcon icon={icon} />
                  <span className="text-xs font-medium text-[#6b7280]">{label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[20px] bg-white p-4 shadow-[0_4px_12px_rgba(124,58,237,0.08)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[16px] font-bold leading-5">我的衣橱</h2>
              <button className="flex items-center text-xs font-medium text-[#8a8d96]" type="button" onClick={() => navigate('/closet')}>进入衣橱 <ChevronRight className="h-3.5 w-3.5" /></button>
            </div>
            <div className="grid grid-cols-[136px_1fr] gap-3">
              <button className="relative h-[82px] overflow-hidden rounded-xl bg-[#eee2ff] p-3 text-left active:scale-[0.98]" type="button" onClick={() => navigate('/closet')}>
                <div className="text-xs font-bold">衣橱总览</div>
                <div className="mt-1.5 text-[26px] font-black leading-7">{stats.wardrobe_count || 256}<span className="ml-1 text-xs">件</span></div>
                <div className="text-xs text-[#6b7280]">全部服饰</div>
                <Shirt className="absolute right-3 top-5 h-12 w-12 text-[#c7b2ff]" />
              </button>
              <button className="h-[82px] rounded-xl bg-[#fbfaff] p-3 text-left active:scale-[0.98]" type="button" onClick={() => navigate('/calendar')}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold">搭配日历</div>
                    <div className="mt-0.5 text-xs text-[#6b7280]">本月已搭配 <span className="font-bold text-[#8b5cf6]">18</span> 天</div>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-[#8b5cf6] shadow-sm">日历</span>
                </div>
                <div className="mt-2.5 grid grid-cols-7 text-center text-[11px]">
                  {['20', '21', '22', '23', '24', '25', '26'].map((day) => (
                    <span key={day} className={`rounded-md py-1 ${day === '23' ? 'bg-[#8b5cf6] text-white' : 'bg-[#f6f4f9]'}`}>{day}</span>
                  ))}
                </div>
              </button>
            </div>
          </section>

          <section className="rounded-[20px] bg-white p-4 shadow-[0_4px_12px_rgba(124,58,237,0.08)]">
            <h2 className="mb-3 text-[16px] font-bold leading-5">我的活动</h2>
            <div className="grid grid-cols-5">
              {activities.map(({ label, icon }) => (
                <button key={label} className="flex flex-col items-center gap-1.5 active:scale-95" type="button" onClick={() => label === '我的收藏' ? navigate('/profile/favorites') : clickStatic(label)}>
                  <ShortcutIcon icon={icon} />
                  <span className="text-xs font-medium text-[#6b7280]">{label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[20px] bg-white p-4 shadow-[0_4px_12px_rgba(124,58,237,0.08)]">
            <h2 className="mb-3 text-[16px] font-bold leading-5">更多服务</h2>
            <div className="grid grid-cols-5">
              {services.map(({ label, icon }) => (
                <button key={label} className="flex flex-col items-center gap-1.5 active:scale-95" type="button" onClick={() => clickStatic(label)}>
                  <ShortcutIcon icon={icon} />
                  <span className="text-xs font-medium text-[#6b7280]">{label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  )
}
