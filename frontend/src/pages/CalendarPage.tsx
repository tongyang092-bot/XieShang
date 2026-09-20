import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { apiOutfits, type Outfit } from '@/api/xieshang'
import { AppShell } from '@/components/AppShell'
import { useAppStore } from '@/store'

const A = '/assets/xieshang'

const demoOutfits = [
  { id: -1, user_id: 'demo', name: '温柔约会穿搭', scene: '约会', cover_url: `${A}/tryon_effect_01.png`, items: [] },
  { id: -2, user_id: 'demo', name: '职场通勤穿搭', scene: '职场', cover_url: `${A}/tryon_effect_02.png`, items: [] },
  { id: -3, user_id: 'demo', name: '周末休闲穿搭', scene: '休闲', cover_url: `${A}/tryon_effect_03.png`, items: [] },
] as Outfit[]

function coverFor(outfit: Outfit, index: number) {
  if (outfit.cover_url && !outfit.cover_url.startsWith('/mock/')) return outfit.cover_url
  return `${A}/tryon_effect_${String((index % 5) + 1).padStart(2, '0')}.png`
}

function loadAssignments(userId: string, monthKey: string) {
  try {
    const saved = localStorage.getItem(`xieshang-calendar-${userId}-${monthKey}`)
    return saved ? JSON.parse(saved) as Record<number, number> : {}
  } catch {
    return {}
  }
}

export default function CalendarPage() {
  const navigate = useNavigate()
  const { userId } = useAppStore()
  const now = new Date()
  const [viewDate, setViewDate] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const [selectedDay, setSelectedDay] = useState(now.getDate())
  const [outfits, setOutfits] = useState<Outfit[]>([])
  const monthKey = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`
  const [assignments, setAssignments] = useState<Record<number, number>>(() => loadAssignments(userId, monthKey))

  useEffect(() => {
    apiOutfits(userId).then((data) => setOutfits(data.length ? data : demoOutfits)).catch(() => setOutfits(demoOutfits))
  }, [userId])

  useEffect(() => {
    setAssignments(loadAssignments(userId, monthKey))
    const isCurrentMonth = viewDate.getFullYear() === now.getFullYear() && viewDate.getMonth() === now.getMonth()
    setSelectedDay(isCurrentMonth ? now.getDate() : 1)
  }, [monthKey, userId])

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate()
  const firstWeekday = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay()
  const cells = useMemo(() => [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)], [daysInMonth, firstWeekday])
  const selectedOutfitId = assignments[selectedDay]

  const assign = (outfitId: number) => {
    const next = { ...assignments, [selectedDay]: outfitId }
    setAssignments(next)
    localStorage.setItem(`xieshang-calendar-${userId}-${monthKey}`, JSON.stringify(next))
  }

  const changeMonth = (offset: number) => setViewDate((value) => new Date(value.getFullYear(), value.getMonth() + offset, 1))

  return (
    <AppShell>
      <section className="pt-4">
        <header className="mb-4 flex items-center gap-3">
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm" type="button" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></button>
          <div><h1 className="text-2xl font-black">穿搭日历</h1><p className="mt-1 text-xs text-[#6b7280]">为每天安排一套已保存穿搭</p></div>
        </header>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <button className="grid h-8 w-8 place-items-center rounded-full bg-[#f5f1fb] text-[#8b5cf6]" type="button" onClick={() => changeMonth(-1)}><ChevronLeft className="h-4 w-4" /></button>
            <div className="flex items-center gap-2 font-bold"><CalendarDays className="h-5 w-5 text-[#8b5cf6]" />{viewDate.getFullYear()} 年 {viewDate.getMonth() + 1} 月</div>
            <button className="grid h-8 w-8 place-items-center rounded-full bg-[#f5f1fb] text-[#8b5cf6]" type="button" onClick={() => changeMonth(1)}><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-[#9ca3af]">{['日', '一', '二', '三', '四', '五', '六'].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {cells.map((day, index) => day ? (
              <button className={`relative aspect-square rounded-xl text-sm font-semibold ${selectedDay === day ? 'bg-[#8b5cf6] text-white' : assignments[day] ? 'bg-[#efe7ff] text-[#8b5cf6]' : 'bg-[#faf9fc]'}`} type="button" key={day} onClick={() => setSelectedDay(day)}>
                {day}{assignments[day] ? <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-current" /> : null}
              </button>
            ) : <span key={`empty-${index}`} />)}
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="font-bold">为 {viewDate.getMonth() + 1} 月 {selectedDay} 日选择穿搭</h2>
          <p className="mt-1 text-xs text-[#8a8d96]">点击穿搭卡片即可安排或替换</p>
          {outfits.length ? <div className="mt-3 grid grid-cols-3 gap-3">{outfits.map((outfit, index) => (
            <button className={`relative overflow-hidden rounded-xl border-2 text-left ${selectedOutfitId === outfit.id ? 'border-[#8b5cf6]' : 'border-transparent'} bg-[#f7f4fb]`} type="button" key={outfit.id} onClick={() => assign(outfit.id)}>
              <img src={coverFor(outfit, index)} alt={outfit.name} className="aspect-[4/5] w-full object-cover object-top" />
              <div className="p-2 text-xs font-bold">{outfit.name}</div>
              {selectedOutfitId === outfit.id ? <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[#8b5cf6] text-white"><Check className="h-4 w-4" /></span> : null}
            </button>
          ))}</div> : <div className="mt-4 rounded-xl bg-[#faf9fc] px-3 py-8 text-center text-sm text-[#8a8d96]">请先到衣橱中创建穿搭</div>}
        </div>
      </section>
    </AppShell>
  )
}
