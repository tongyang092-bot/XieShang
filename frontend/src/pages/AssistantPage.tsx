import { useMemo, useState } from 'react'
import { ArrowLeft, Bot, Send, Sparkles, UserRound } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

import { AppShell } from '@/components/AppShell'
import { useAppStore } from '@/store'

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
}

function adviceFor(query: string) {
  const text = query.toLowerCase()
  if (text.includes('生日') || text.includes('party') || text.includes('派对')) {
    return '生日 Party 建议选择有亮点但不过度抢镜的造型：柔和紫色针织上衣或缎面衬衫，搭配高腰直筒裤/半身裙和小体积金属配饰。鞋包保持同一色系，既适合拍照，也方便活动。'
  }
  if (text.includes('职场') || text.includes('面试') || text.includes('通勤')) {
    return '建议采用低饱和同色系通勤搭配：利落西装外套、简洁内搭和高腰直筒下装。控制配饰数量，用结构感包袋提升专业度。'
  }
  if (text.includes('婚礼')) {
    return '婚礼宾客穿搭可以选择柔和、正式且不抢新人的颜色，例如雾蓝、浅紫或香槟色。搭配简洁高跟鞋与小型手包，避免大面积纯白。'
  }
  if (text.includes('旅行') || text.includes('度假')) {
    return '旅行场景优先考虑舒适和上镜：轻盈上衣搭配高腰下装，加入一件有层次感的外搭；鞋子选择适合步行的款式，再用亮色包袋形成视觉重点。'
  }
  if (text.includes('约会')) {
    return '约会穿搭可以用柔和色彩和轻盈材质营造亲和感。建议突出腰线，搭配精致但体积较小的鞋包与首饰，整体保持两到三种主色。'
  }
  return '建议先确定场合正式度，再选择一个视觉重点。整体控制在两到三种主色，用高腰线优化比例，并让鞋包与主服装在颜色或材质上呼应。'
}

export default function AssistantPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const initialQuery = ((location.state as { query?: string } | null)?.query || '').trim()
  const { baseAvatarUrl, setPendingTask, setError } = useAppStore()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialQuery
    ? [
        { id: 1, role: 'user', content: initialQuery },
        { id: 2, role: 'assistant', content: adviceFor(initialQuery) },
      ]
    : [{ id: 1, role: 'assistant', content: '告诉我你要参加的场合、喜欢的风格或想改善的身材比例，我会先给建议，也可以继续生成试穿效果。' }])

  const lastQuery = useMemo(() => [...messages].reverse().find((item) => item.role === 'user')?.content || '', [messages])

  const send = (value = input) => {
    const query = value.trim()
    if (!query) return
    const stamp = Date.now()
    setMessages((prev) => [...prev, { id: stamp, role: 'user', content: query }, { id: stamp + 1, role: 'assistant', content: adviceFor(query) }])
    setInput('')
  }

  const generate = () => {
    if (!lastQuery) return
    if (!baseAvatarUrl) {
      setError('请先在首页上传人物照片并建立基础形象')
      navigate('/')
      return
    }
    setPendingTask({ type: 'recommendation', payload: { query: lastQuery, scene: lastQuery } })
    navigate('/loading')
  }

  return (
    <AppShell withInputPadding>
      <section className="pt-4">
        <header className="mb-4 flex items-center gap-3">
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm" type="button" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></button>
          <div>
            <h1 className="text-2xl font-black">AI 穿搭助手</h1>
            <p className="mt-1 text-xs text-[#6b7280]">先给建议，再一键生成试穿</p>
          </div>
        </header>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {['生日 Party 怎么穿', '职场面试穿搭', '周末约会穿搭', '海边旅行穿搭'].map((item) => (
            <button className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#8b5cf6] shadow-sm" type="button" key={item} onClick={() => send(item)}>{item}</button>
          ))}
        </div>

        <div className="space-y-3">
          {messages.map((message) => (
            <div className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`} key={message.id}>
              {message.role === 'assistant' ? <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#8b5cf6] text-white"><Bot className="h-5 w-5" /></span> : null}
              <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${message.role === 'user' ? 'bg-[#8b5cf6] text-white' : 'bg-white text-[#444]'}`}>{message.content}</div>
              {message.role === 'user' ? <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#8b5cf6]"><UserRound className="h-5 w-5" /></span> : null}
            </div>
          ))}
        </div>

        {lastQuery ? (
          <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#a855f7] to-[#7c3aed] px-4 py-3 text-sm font-bold text-white shadow-lg" type="button" onClick={generate}>
            <Sparkles className="h-5 w-5" />根据这条建议生成试穿
          </button>
        ) : null}

        <div className="fixed bottom-[88px] left-1/2 z-40 flex h-14 w-[361px] -translate-x-1/2 items-center gap-3 rounded-[20px] bg-white px-3 shadow-[0_8px_24px_rgba(124,58,237,0.14)]">
          <Bot className="h-6 w-6 shrink-0 text-[#8b5cf6]" />
          <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && send()} className="min-w-0 flex-1 text-sm outline-none" placeholder="描述你的场合和穿搭需求" />
          <button className="grid h-10 w-10 place-items-center rounded-full bg-[#8b5cf6] text-white" type="button" onClick={() => send()}><Send className="h-5 w-5" /></button>
        </div>
      </section>
    </AppShell>
  )
}
