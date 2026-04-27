import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { DEFAULT_GENRES } from '@/data/defaultGenres'
import { DEFAULT_WRITING_STYLES, type WritingStyleItem } from '@/data/defaultWritingStyles'

type ThemeMode = 'light' | 'dark' | 'system'

export interface FontConfig {
  fontFamily: string
  fontSize: number
  lineHeight: number
}

export interface GenreItem {
  name: string
  channel: 'male' | 'female'
  tagDescription: string
  definition: string
  suggestedElements: string
  notSuggestedElements: string
  popularSettings: string
}

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  x: number
  y: number
}

type RightPanelTab = 'context' | 'characters'

interface UIState {
  theme: ThemeMode
  sidebarCollapsed: boolean
  sidebarWidth: number
  rightPanelCollapsed: boolean
  rightPanelWidth: number
  rightPanelTab: RightPanelTab
  fontGlobal: FontConfig
  genres: GenreItem[]
  writingStyles: WritingStyleItem[]
  settingsOpen: boolean
  newProjectOpen: boolean
  toasts: Toast[]
  autoGenerating: boolean
  autoFullReviewPending: boolean
  autoProgress: { chapterIdx: number; phase: string } | null
  dedupStatus: string | null

  setTheme: (theme: ThemeMode) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setSidebarWidth: (w: number) => void
  toggleRightPanel: () => void
  setRightPanelWidth: (w: number) => void
  setRightPanelTab: (tab: RightPanelTab) => void
  setFontGlobal: (config: Partial<FontConfig>) => void
  setSettingsOpen: (open: boolean) => void
  setNewProjectOpen: (open: boolean) => void
  addGenre: (genre: GenreItem) => void
  updateGenre: (index: number, genre: GenreItem) => void
  removeGenre: (index: number) => void
  addWritingStyle: (style: WritingStyleItem) => void
  updateWritingStyle: (index: number, style: WritingStyleItem) => void
  removeWritingStyle: (index: number) => void
  addToast: (type: Toast['type'], message: string) => void
  removeToast: (id: string) => void
  setAutoGenerating: (v: boolean) => void
  setAutoFullReviewPending: (v: boolean) => void
  setAutoProgress: (progress: { chapterIdx: number; phase: string } | null) => void
  setDedupStatus: (status: string | null) => void
}

let toastCounter = 0

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'light' as ThemeMode,
      sidebarCollapsed: false,
      sidebarWidth: 240,
      rightPanelCollapsed: false,
      rightPanelWidth: 280,
      rightPanelTab: 'context' as RightPanelTab,
      fontGlobal: { fontFamily: 'SimSun', fontSize: 15, lineHeight: 1.8 },
      genres: DEFAULT_GENRES,
      writingStyles: DEFAULT_WRITING_STYLES,
      settingsOpen: false,
      newProjectOpen: false,
      toasts: [],
      autoGenerating: false,
      autoFullReviewPending: false,
      autoProgress: null,
      dedupStatus: null,

      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setSidebarWidth: (w) => set({ sidebarWidth: Math.min(400, Math.max(150, w)) }),
      toggleRightPanel: () => set((state) => ({ rightPanelCollapsed: !state.rightPanelCollapsed })),
      setRightPanelWidth: (w) => set({ rightPanelWidth: Math.min(500, Math.max(200, w)) }),      setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
      setFontGlobal: (config) => set((state) => ({ fontGlobal: { ...state.fontGlobal, ...config } })),
      setSettingsOpen: (open) => set({ settingsOpen: open }),
      setNewProjectOpen: (open) => set({ newProjectOpen: open }),

      addGenre: (genre) => set((state) => ({ genres: [...state.genres, genre] })),
      updateGenre: (index, genre) => set((state) => ({
        genres: state.genres.map((g, i) => i === index ? genre : g),
      })),
      removeGenre: (index) => set((state) => ({
        genres: state.genres.filter((_, i) => i !== index),
      })),

      addWritingStyle: (style) => set((state) => ({ writingStyles: [...state.writingStyles, style] })),
      updateWritingStyle: (index, style) => set((state) => ({
        writingStyles: state.writingStyles.map((s, i) => i === index ? style : s),
      })),
      removeWritingStyle: (index) => set((state) => ({
        writingStyles: state.writingStyles.filter((_, i) => i !== index),
      })),

      addToast: (type, message) => {
        const id = `toast-${++toastCounter}`
        const x = typeof window !== 'undefined' ? (window as unknown as Record<string, number>).__lastMouseX ?? window.innerWidth - 380 : 100
        const y = typeof window !== 'undefined' ? (window as unknown as Record<string, number>).__lastMouseY ?? window.innerHeight - 60 : 100
        set((state) => ({ toasts: [...state.toasts, { id, type, message, x, y }] }))
        setTimeout(() => {
          set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
        }, 3000)
      },

      removeToast: (id) =>
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

      setAutoGenerating: (v) => set({ autoGenerating: v }),

      setAutoFullReviewPending: (v) => set({ autoFullReviewPending: v }),

      setAutoProgress: (progress) => set({ autoProgress: progress }),
      setDedupStatus: (status) => set({ dedupStatus: status }),
    }),
    {
      name: 'abook-ui',
      storage: createJSONStorage(() => localStorage),
      version: 6,
      migrate: (persistedState: unknown, version: number) => {
        const p = persistedState as Record<string, unknown>
        if (version < 6) {
          const { genres: _oldGenres, ...rest } = p
          return {
            ...rest,
            fontGlobal: rest.fontGlobal || { fontFamily: 'SimSun', fontSize: 15, lineHeight: 1.8 },
            genres: DEFAULT_GENRES,
            writingStyles: DEFAULT_WRITING_STYLES,
            settingsOpen: false,
          }
        }
        return p
      },
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarWidth: state.sidebarWidth,
        rightPanelCollapsed: state.rightPanelCollapsed,
        rightPanelWidth: state.rightPanelWidth,
        rightPanelTab: state.rightPanelTab,
        fontGlobal: state.fontGlobal,
        genres: state.genres,
        writingStyles: state.writingStyles,
      }),
    }
  )
)
