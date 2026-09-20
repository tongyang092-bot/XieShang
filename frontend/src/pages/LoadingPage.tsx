import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Loader2, Sparkles } from 'lucide-react'

import { apiUpload, type TryonRecord } from '@/api/xieshang'
import { Button } from '@/components/ui/button'
import { apiBaseUrl } from '@/api/client'
import { useAppStore } from '@/store'

interface WsResult {
  status: 'success' | 'error' | 'progress'
  message?: string
  node?: string
  record_id?: number
  avatar_url?: string
  styling_suggestion?: string
  generated_product_url?: string
  final_tryon_url?: string
}

const nodeLabels: Record<string, string> = {
  profiling: '识别体型与风格特征',
  styling: '生成穿搭建议',
  product_generation: '生成商品图',
  tryon: '合成试穿效果',
}

export default function LoadingPage() {
  const navigate = useNavigate()
  const wsRef = useRef<WebSocket | null>(null)
  const {
    userId,
    pendingTask,
    setPendingTask,
    setIsLoading,
    isLoading,
    loadingStage,
    setLoadingStage,
    setError,
    error,
    setBaseAvatarUrl,
    setLastResult,
    addRecentRecord,
  } = useAppStore()
  const [done, setDone] = useState<number[]>([])

  const steps = useMemo(() => {
    if (!pendingTask) return ['准备任务']
    if (pendingTask.type === 'onboarding') return ['上传人物照片', '识别体型特征', '固化专属形象']
    if (pendingTask.type === 'recommendation') return ['读取专属形象', '生成穿搭建议', '合成试穿效果']
    return ['准备商品图', '解析商品特征', '合成试穿效果']
  }, [pendingTask])

  useEffect(() => {
    if (!pendingTask) {
      navigate('/')
      return
    }

    let cancelled = false
    setError(null)
    setIsLoading(true)
    setLoadingStage(0)
    setDone([])

    const mark = (index: number) => {
      setDone((prev) => (prev.includes(index) ? prev : [...prev, index]))
      setLoadingStage(Math.min(index + 1, steps.length - 1))
    }

    const run = async () => {
      try {
        let fileUrl = pendingTask.type === 'directTryon' ? pendingTask.payload.fileUrl || '' : ''
        if ('file' in pendingTask.payload && pendingTask.payload.file) {
          const upload = await apiUpload(pendingTask.payload.file)
          if (cancelled) return
          fileUrl = upload.url
          mark(0)
        } else if (fileUrl) {
          mark(0)
        } else if (pendingTask.type === 'recommendation') {
          mark(0)
        }

        const ws = new WebSocket(`${apiBaseUrl.replace(/^http/, 'ws')}/ws/process`)
        wsRef.current = ws

        ws.onopen = () => {
          if (pendingTask.type === 'onboarding') {
            ws.send(
              JSON.stringify({
                type: 'onboarding',
                user_id: userId,
                height: pendingTask.payload.height,
                weight: pendingTask.payload.weight,
                file_url: fileUrl,
              })
            )
          } else if (pendingTask.type === 'recommendation') {
            ws.send(
              JSON.stringify({
                type: 'recommendation',
                user_id: userId,
                query: pendingTask.payload.query,
                scene: pendingTask.payload.scene,
              })
            )
          } else {
            ws.send(
              JSON.stringify({
                type: 'direct-tryon',
                user_id: userId,
                file_url: fileUrl,
                scene: pendingTask.payload.scene,
                item_name: pendingTask.payload.itemName,
                category: pendingTask.payload.category,
                save_to_wardrobe: pendingTask.payload.saveToWardrobe,
              })
            )
          }
        }

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data) as WsResult
          if (data.status === 'error') {
            setError(data.message || 'AI 处理失败')
            setIsLoading(false)
            ws.close()
            return
          }

          if (data.status === 'progress') {
            const label = data.node ? nodeLabels[data.node] : undefined
            if (label) {
              if (pendingTask.type === 'onboarding') mark(1)
              if (pendingTask.type === 'recommendation' || pendingTask.type === 'directTryon') {
                mark(data.node === 'tryon' ? 2 : 1)
              }
            }
            return
          }

          if (data.status === 'success') {
            setDone(steps.map((_, index) => index))
            window.setTimeout(() => {
              if (cancelled) return
              if (pendingTask.type === 'onboarding') {
                const avatarUrl = data.avatar_url || ''
                setBaseAvatarUrl(avatarUrl)
                if (pendingTask.payload.nextTryon) {
                  setPendingTask({ type: 'directTryon', payload: pendingTask.payload.nextTryon })
                  return
                }
                setLastResult({ type: 'onboarding', avatarUrl, recordId: data.record_id })
              } else if (pendingTask.type === 'recommendation') {
                const record: TryonRecord = {
                  id: data.record_id || Date.now(),
                  user_id: userId,
                  type: 'recommendation',
                  scene: pendingTask.payload.scene,
                  product_url: data.generated_product_url,
                  styling_suggestion: data.styling_suggestion,
                  generated_product_url: data.generated_product_url,
                  final_tryon_url: data.final_tryon_url,
                  created_at: new Date().toISOString(),
                }
                addRecentRecord(record)
                setLastResult({
                  type: 'recommendation',
                  stylingSuggestion: data.styling_suggestion || '已生成专属穿搭建议。',
                  generatedProductUrl: data.generated_product_url || '',
                  finalTryonUrl: data.final_tryon_url || '',
                  scene: pendingTask.payload.scene,
                  recordId: data.record_id,
                })
              } else {
                const record: TryonRecord = {
                  id: data.record_id || Date.now(),
                  user_id: userId,
                  type: 'direct_tryon',
                  scene: pendingTask.payload.scene,
                  product_url: fileUrl || data.generated_product_url,
                  final_tryon_url: data.final_tryon_url,
                  created_at: new Date().toISOString(),
                }
                addRecentRecord(record)
                setLastResult({
                  type: 'directTryon',
                  finalTryonUrl: data.final_tryon_url || '',
                  productUrl: fileUrl || undefined,
                  scene: pendingTask.payload.scene,
                  recordId: data.record_id,
                })
              }
              setPendingTask(null)
              navigate('/result')
            }, 450)
          }
        }

        ws.onerror = () => {
          if (!cancelled) {
            setError('WebSocket 连接失败，请确认后端服务正在运行')
            setIsLoading(false)
          }
        }

        ws.onclose = () => {
          if (!cancelled) setIsLoading(false)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '请求失败'
          setError(message)
          setIsLoading(false)
        }
      }
    }

    run()

    return () => {
      cancelled = true
      wsRef.current?.close()
    }
  }, [
    addRecentRecord,
    navigate,
    pendingTask,
    setBaseAvatarUrl,
    setError,
    setIsLoading,
    setLastResult,
    setLoadingStage,
    setPendingTask,
    steps,
    userId,
  ])

  return (
    <div className="min-h-dvh bg-[#f4f0ff] text-slate-900">
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-[linear-gradient(180deg,#ece4ff_0%,#ffffff_100%)] px-4 py-5">
        <button
          className="mb-8 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm"
          onClick={() => {
            setPendingTask(null)
            navigate('/')
          }}
          type="button"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="relative mb-8 grid h-32 w-32 place-items-center rounded-full bg-white shadow-[0_20px_60px_rgba(109,87,217,0.22)]">
            <div className="absolute inset-3 rounded-full border-2 border-dashed border-[#9b8cf0]" />
            <Sparkles className="h-12 w-12 text-[#6d57d9]" />
            {isLoading ? <Loader2 className="absolute -right-1 top-2 h-8 w-8 animate-spin text-[#3f9db9]" /> : null}
          </div>

          <h1 className="text-2xl font-semibold text-slate-950">AI 正在为你搭配</h1>
          <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">正在处理图片与场景信息，生成结果后会自动跳转。</p>

          <div className="mt-8 w-full space-y-3">
            {steps.map((step, index) => {
              const active = loadingStage === index
              const completed = done.includes(index)
              return (
                <div
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm shadow-sm ${
                    active ? 'bg-[#6d57d9] text-white' : 'bg-white text-slate-600'
                  }`}
                  key={step}
                >
                  <div className={`grid h-7 w-7 place-items-center rounded-full ${completed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {completed ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                  <span className="min-w-0 flex-1">{step}</span>
                </div>
              )
            })}
          </div>

          {error ? <div className="mt-6 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        </div>

        <Button
          className="mb-3 w-full rounded-full bg-slate-950 text-white hover:bg-slate-800"
          disabled={isLoading && !error}
          onClick={() => {
            setPendingTask(null)
            navigate('/')
          }}
        >
          返回首页
        </Button>
      </main>
    </div>
  )
}
