import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { TryonRecord, UserProfile } from '@/api/xieshang'

type PendingTask =
  | {
      type: 'onboarding'
      payload: {
        height: string
        weight: string
        file: File
        nextTryon?: {
          file?: File
          fileUrl?: string
          scene?: string
          itemName?: string
          category?: string
          saveToWardrobe?: boolean
        }
      }
    }
  | {
      type: 'recommendation'
      payload: {
        query: string
        scene?: string
      }
    }
  | {
      type: 'directTryon'
      payload: {
        file?: File
        fileUrl?: string
        scene?: string
        itemName?: string
        category?: string
        saveToWardrobe?: boolean
      }
    }

type LastResult =
  | {
      type: 'onboarding'
      avatarUrl: string
      recordId?: number
    }
  | {
      type: 'recommendation'
      stylingSuggestion: string
      generatedProductUrl: string
      finalTryonUrl: string
      scene?: string
      recordId?: number
    }
  | {
      type: 'directTryon'
      finalTryonUrl: string
      productUrl?: string
      scene?: string
      recordId?: number
    }

interface AppState {
  userId: string
  nickname: string
  userProfile: UserProfile | null
  setSession: (profile: UserProfile) => void
  setUserId: (id: string) => void
  setNickname: (name: string) => void

  baseAvatarUrl: string | null
  setBaseAvatarUrl: (url: string | null) => void
  height: string
  setHeight: (h: string) => void
  weight: string
  setWeight: (w: string) => void

  pendingTask: PendingTask | null
  setPendingTask: (task: PendingTask | null) => void

  isLoading: boolean
  setIsLoading: (v: boolean) => void
  loadingStage: number
  setLoadingStage: (idx: number) => void

  error: string | null
  setError: (msg: string | null) => void

  lastResult: LastResult | null
  setLastResult: (r: LastResult | null) => void

  recentRecords: TryonRecord[]
  setRecentRecords: (records: TryonRecord[]) => void
  addRecentRecord: (item: TryonRecord) => void
  clearRecentRecords: () => void
}

const defaultUserId = `demo_${Math.random().toString(16).slice(2, 8)}`

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      userId: defaultUserId,
      nickname: '小鹿',
      userProfile: null,
      setSession: (profile) =>
        set({
          userProfile: profile,
          userId: profile.user_id,
          nickname: profile.nickname || '小鹿',
          baseAvatarUrl: profile.base_avatar_url || null,
          height: profile.height ? String(profile.height) : '',
          weight: profile.weight ? String(profile.weight) : '',
        }),
      setUserId: (id) => set({ userId: id }),
      setNickname: (name) => set({ nickname: name }),

      baseAvatarUrl: null,
      setBaseAvatarUrl: (url) => set({ baseAvatarUrl: url }),
      height: '',
      setHeight: (h) => set({ height: h }),
      weight: '',
      setWeight: (w) => set({ weight: w }),

      pendingTask: null,
      setPendingTask: (task) => set({ pendingTask: task }),

      isLoading: false,
      setIsLoading: (v) => set({ isLoading: v }),
      loadingStage: 0,
      setLoadingStage: (idx) => set({ loadingStage: idx }),

      error: null,
      setError: (msg) => set({ error: msg }),

      lastResult: null,
      setLastResult: (r) => set({ lastResult: r }),

      recentRecords: [],
      setRecentRecords: (records) => set({ recentRecords: records }),
      addRecentRecord: (item) => set((state) => ({ recentRecords: [item, ...state.recentRecords].slice(0, 12) })),
      clearRecentRecords: () => set({ recentRecords: [] }),
    }),
    {
      name: 'xieshang-app-state',
      partialize: (state) => ({
        userId: state.userId,
        nickname: state.nickname,
        userProfile: state.userProfile,
        baseAvatarUrl: state.baseAvatarUrl,
        height: state.height,
        weight: state.weight,
        recentRecords: state.recentRecords,
      }),
    }
  )
)

export type { LastResult, PendingTask }
