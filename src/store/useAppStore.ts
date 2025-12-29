import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

// Update window title (Electron only)
const updateWindowTitle = (fileName: string | null) => {
  const title = fileName ? `CygnusReader - ${fileName}` : 'CygnusReader';
  document.title = title;
  if ((window as any).electronAPI?.setTitle) {
    (window as any).electronAPI.setTitle(title);
  }
};

export type StyleTemplate =
  | 'default'
  | 'academic'
  | 'minimal'
  | 'dark'
  | 'streamline'
  | 'focus'
  | 'swiss'
  | 'paperback'
  | 'coral'
  | 'slate'
  | 'luxe'
  | 'geometric';

export type ViewMode = 'paginated' | 'scroll';

export interface TocItem {
  id: string;
  text: string;
  level: number;
  page?: number;
}

export interface RecentFile {
  path: string;
  name: string;
  openedAt: number;
}

// Tab state
export interface Tab {
  id: string;
  type: 'home' | 'document';
  title: string;
  filePath: string | null;
  markdown: string;
  contentType: 'markdown' | 'html';  // html for EPUB content
  currentPage: number;
  totalPages: number;
  scrollTarget: number | null;
  toc: TocItem[];
}

interface LoadingState {
  isLoading: boolean;
  message: string;
  progress?: number;
}

interface AppState {
  // Tabs
  tabs: Tab[];
  activeTabId: string;

  // Style (global)
  styleTemplate: StyleTemplate;
  viewMode: ViewMode;
  zoom: number;
  tocVisible: boolean;

  // Search
  searchQuery: string;
  searchMatchIndex: number;
  searchMatchCount: number;

  // Recent files
  recentFiles: RecentFile[];

  // Loading state
  loading: LoadingState;

  // Tab actions
  createTab: (type: 'home' | 'document', filePath?: string, fileName?: string, markdown?: string, contentType?: 'markdown' | 'html') => string;
  closeTab: (tabId: string) => void;
  switchTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<Tab>) => void;

  // Current tab helpers
  getCurrentTab: () => Tab | undefined;
  setMarkdown: (markdown: string, filePath: string, fileName: string, contentType?: 'markdown' | 'html') => void;
  setCurrentPage: (page: number) => void;
  setTotalPages: (total: number) => void;
  setToc: (toc: TocItem[]) => void;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  clearScrollTarget: () => void;

  // Global actions
  setStyleTemplate: (template: StyleTemplate) => void;
  toggleViewMode: () => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  toggleToc: () => void;
  addRecentFile: (file: RecentFile) => void;

  // Search actions
  setSearchQuery: (query: string) => void;
  setSearchMatchCount: (count: number) => void;
  nextMatch: () => void;
  prevMatch: () => void;
  clearSearch: () => void;

  // Loading actions
  showLoading: (message: string, progress?: number) => void;
  updateProgress: (progress: number) => void;
  hideLoading: () => void;
}

const MAX_RECENT_FILES = 10;

const createHomeTab = (): Tab => ({
  id: 'home',
  type: 'home',
  title: 'Home',
  filePath: null,
  markdown: '',
  contentType: 'markdown',
  currentPage: 1,
  totalPages: 1,
  scrollTarget: null,
  toc: [],
});

const generateTabId = () => `tab-${uuidv4()}`;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      tabs: [createHomeTab()],
      activeTabId: 'home',
      styleTemplate: 'default',
      viewMode: 'paginated',
      zoom: 1,
      tocVisible: true,
      searchQuery: '',
      searchMatchIndex: 0,
      searchMatchCount: 0,
      recentFiles: [],
      loading: { isLoading: false, message: '' },

      // Tab actions
      createTab: (type, filePath, fileName, markdown, contentType = 'markdown') => {
        const id = type === 'home' ? 'home' : generateTabId();
        const newTab: Tab = {
          id,
          type,
          title: type === 'home' ? 'Home' : (fileName || 'Untitled'),
          filePath: filePath || null,
          markdown: markdown || '',
          contentType,
          currentPage: 1,
          totalPages: 1,
          scrollTarget: null,
          toc: [],
        };

        set((state) => ({
          tabs: [...state.tabs, newTab],
          activeTabId: id,
        }));

        if (type === 'document' && fileName) {
          updateWindowTitle(fileName);
        }

        return id;
      },

      closeTab: (tabId) => {
        const state = get();
        // Can't close home tab
        if (tabId === 'home') return;

        const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
        const newTabs = state.tabs.filter((t) => t.id !== tabId);

        // If closing active tab, switch to previous tab or home
        let newActiveId = state.activeTabId;
        if (state.activeTabId === tabId) {
          if (tabIndex > 0) {
            newActiveId = newTabs[tabIndex - 1]?.id || 'home';
          } else {
            newActiveId = newTabs[0]?.id || 'home';
          }
        }

        set({ tabs: newTabs, activeTabId: newActiveId });

        // Update title
        const activeTab = newTabs.find((t) => t.id === newActiveId);
        updateWindowTitle(activeTab?.type === 'document' ? activeTab.title : null);
      },

      switchTab: (tabId) => {
        const tab = get().tabs.find((t) => t.id === tabId);
        if (tab) {
          set({ activeTabId: tabId });
          updateWindowTitle(tab.type === 'document' ? tab.title : null);
        }
      },

      updateTab: (tabId, updates) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId ? { ...tab, ...updates } : tab
          ),
        }));
      },

      getCurrentTab: () => {
        const state = get();
        return state.tabs.find((t) => t.id === state.activeTabId);
      },

      // Opens file in new tab
      setMarkdown: (markdown, filePath, fileName, contentType = 'markdown') => {
        const state = get();
        // Check if file already open
        const existingTab = state.tabs.find((t) => t.filePath === filePath);
        if (existingTab) {
          set({ activeTabId: existingTab.id });
          updateWindowTitle(fileName);
          return;
        }

        // Create new tab
        get().createTab('document', filePath, fileName, markdown, contentType);
        get().addRecentFile({ path: filePath, name: fileName, openedAt: Date.now() });
      },

      setCurrentPage: (page) => {
        const { activeTabId } = get();
        get().updateTab(activeTabId, { currentPage: page });
      },

      setTotalPages: (total) => {
        const { activeTabId } = get();
        get().updateTab(activeTabId, { totalPages: total });
      },

      setToc: (toc) => {
        const { activeTabId } = get();
        get().updateTab(activeTabId, { toc });
      },

      nextPage: () => {
        const tab = get().getCurrentTab();
        if (tab) {
          const newPage = Math.min(tab.currentPage + 1, tab.totalPages);
          get().updateTab(tab.id, { currentPage: newPage, scrollTarget: newPage });
        }
      },

      prevPage: () => {
        const tab = get().getCurrentTab();
        if (tab) {
          const newPage = Math.max(tab.currentPage - 1, 1);
          get().updateTab(tab.id, { currentPage: newPage, scrollTarget: newPage });
        }
      },

      goToPage: (page) => {
        const tab = get().getCurrentTab();
        if (tab) {
          const newPage = Math.max(1, Math.min(page, tab.totalPages));
          get().updateTab(tab.id, { currentPage: newPage, scrollTarget: newPage });
        }
      },

      clearScrollTarget: () => {
        const { activeTabId } = get();
        get().updateTab(activeTabId, { scrollTarget: null });
      },

      // Global actions
      setStyleTemplate: (template) => set({ styleTemplate: template }),

      toggleViewMode: () => set((state) => ({
        viewMode: state.viewMode === 'paginated' ? 'scroll' : 'paginated'
      })),

      setZoom: (zoom) => set({ zoom: Math.max(0.5, Math.min(2, zoom)) }),

      zoomIn: () => set((state) => ({ zoom: Math.min(2, state.zoom + 0.1) })),

      zoomOut: () => set((state) => ({ zoom: Math.max(0.5, state.zoom - 0.1) })),

      resetZoom: () => set({ zoom: 1 }),

      toggleToc: () => set((state) => ({ tocVisible: !state.tocVisible })),

      addRecentFile: (file) =>
        set((state) => {
          const filtered = state.recentFiles.filter((f) => f.path !== file.path);
          const updated = [file, ...filtered].slice(0, MAX_RECENT_FILES);
          return { recentFiles: updated };
        }),

      // Search actions
      setSearchQuery: (query) => set({ searchQuery: query, searchMatchIndex: 0 }),

      setSearchMatchCount: (count) => set({ searchMatchCount: count }),

      nextMatch: () =>
        set((state) => ({
          searchMatchIndex: state.searchMatchCount > 0
            ? (state.searchMatchIndex + 1) % state.searchMatchCount
            : 0,
        })),

      prevMatch: () =>
        set((state) => ({
          searchMatchIndex: state.searchMatchCount > 0
            ? (state.searchMatchIndex - 1 + state.searchMatchCount) % state.searchMatchCount
            : 0,
        })),

      clearSearch: () => set({ searchQuery: '', searchMatchIndex: 0, searchMatchCount: 0 }),

      // Loading actions
      showLoading: (message, progress) => set({ loading: { isLoading: true, message, progress } }),
      updateProgress: (progress) => set((state) => ({ loading: { ...state.loading, progress } })),
      hideLoading: () => set({ loading: { isLoading: false, message: '' } }),
    }),
    {
      name: 'cygnus-md-storage',
      partialize: (state) => ({
        styleTemplate: state.styleTemplate,
        viewMode: state.viewMode,
        recentFiles: state.recentFiles,
        tocVisible: state.tocVisible,
        zoom: state.zoom,
      }),
    }
  )
);
