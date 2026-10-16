/**
 * Form state management with Zustand.
 * Provides a centralized, persistent store for form state with undo/redo support.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TrevoDocument, FormLayout, TrevoNotification, ChildTableData } from "./types";
import { DocumentState } from "./docState";


const docState = new DocumentState();

export interface TrevoFormStore {
  // Document state
  document: TrevoDocument | null;
  isDirty: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;

  // Form layout
  layout: FormLayout;
  setLayout: (layout: Partial<FormLayout>) => void;

  // UI state
  activeTab: string | null;
  setActiveTab: (tab: string | null) => void;
  collapsedSections: Set<string>;
  toggleSection: (section: string) => void;
  density: "comfortable" | "compact";
  setDensity: (density: "comfortable" | "compact") => void;

  // Auto-save
  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (enabled: boolean) => void;
  autoSaveInterval: number;
  setAutoSaveInterval: (interval: number) => void;
  lastSaved: Date | null;
  setLastSaved: (date: Date | null) => void;

  // Keyboard shortcuts
  keyboardShortcutsEnabled: boolean;
  toggleKeyboardShortcuts: () => void;

  // Notifications
  notifications: TrevoNotification[];
  addNotification: (notification: TrevoNotification) => void;
  markNotificationRead: (name: string) => void;
  markAllNotificationsRead: () => void;

  // Recent documents
  recentDocs: Array<{ doctype: string; name: string; title?: string }>;
  addRecentDoc: (doc: { doctype: string; name: string; title?: string }) => void;

  // Document actions
  initializeDocument: (data: {
    doctype: string;
    name: string;
    docstatus: number;
    owner: string;
    creation: string;
    modified: string;
    modifiedBy: string;
    values: Record<string, unknown>;
    childTables?: Record<string, ChildTableData[]>;

  }) => void;

  initializeNewDocument: (doctype: string, defaults?: Record<string, unknown>) => void;
  setField: (fieldname: string, value: unknown) => void;
  setFields: (values: Record<string, unknown>) => void;
  setChildTable: (fieldname: string, data: unknown[]) => void;
  setErrors: (errors: Record<string, string[]>) => void;
  clearErrors: (fieldname?: string) => void;
  setSaving: (saving: boolean) => void;
  markSaved: () => void;
  revert: () => void;
  undo: () => boolean;
  redo: () => boolean;
  reset: () => void;
  getDocument: () => TrevoDocument | null;
  getValues: () => Record<string, unknown>;
}


const INITIAL_LAYOUT: FormLayout = {
  mode: "standard",
  columns: 1,
  sections: [],
  showDescriptions: true,
  showLabels: true,
  labelPosition: "top",
};

export const useTrevoFormStore = create<TrevoFormStore>()(
  persist(
    (set, _get) => ({
      // Document
      document: null,
      isDirty: false,
      isSaving: false,
      hasUnsavedChanges: false,

      // Layout
      layout: INITIAL_LAYOUT,
      setLayout: (layout) => set((state) => ({ layout: { ...state.layout, ...layout } })),

      // UI
      activeTab: null,
      setActiveTab: (tab) => set({ activeTab: tab }),
      collapsedSections: new Set<string>(),
      toggleSection: (section) =>
        set((state) => {
          const next = new Set(state.collapsedSections);
          if (next.has(section)) {
            next.delete(section);
          } else {
            next.add(section);
          }
          return { collapsedSections: next };
        }),
      density: "comfortable",
      setDensity: (density) => set({ density }),

      // Auto-save
      autoSaveEnabled: true,
      setAutoSaveEnabled: (enabled) => set({ autoSaveEnabled: enabled }),
      autoSaveInterval: 30000, // 30 seconds
      setAutoSaveInterval: (interval) => set({ autoSaveInterval: interval }),
      lastSaved: null,
      setLastSaved: (date) => set({ lastSaved: date }),

      // Keyboard shortcuts
      keyboardShortcutsEnabled: true,
      toggleKeyboardShortcuts: () => set((s) => ({ keyboardShortcutsEnabled: !s.keyboardShortcutsEnabled })),

      // Notifications
      notifications: [],
      addNotification: (notification) =>
        set((state) => ({
          notifications: [notification, ...state.notifications].slice(0, 50),
        })),
      markNotificationRead: (name) =>
        set((state) => ({
          notifications: state.notifications.map((n) => (n.name === name ? { ...n, seen: true } : n)),
        })),
      markAllNotificationsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, seen: true })),
        })),

      // Recent docs
      recentDocs: [],
      addRecentDoc: (doc) =>
        set((state) => {
          const filtered = state.recentDocs.filter(
            (r) => !(r.doctype === doc.doctype && r.name === doc.name),
          );
          return { recentDocs: [doc, ...filtered].slice(0, 20) };
        }),

      // Document actions
      initializeDocument: (data) => {
        const doc = docState.initialize(data);
        set({
          document: doc,
          isDirty: docState.isDirty(),
          hasUnsavedChanges: false,
        });
      },



      initializeNewDocument: (doctype, defaults) => {
        const doc = docState.initializeNew(doctype, defaults);
        set({
          document: doc,
          isDirty: true,
          hasUnsavedChanges: false,
        });
      },

      setField: (fieldname, value) => {
        docState.setField(fieldname, value);
        set({ isDirty: docState.isDirty(), hasUnsavedChanges: true });
      },

      setFields: (values) => {
        docState.setFields(values);
        set({ isDirty: docState.isDirty(), hasUnsavedChanges: true });
      },

      setChildTable: (fieldname, data) => {
        docState.setChildTable(fieldname, data as unknown as ChildTableData[]);
        set({ isDirty: docState.isDirty(), hasUnsavedChanges: true });
      },

      setErrors: (errors) => {
        docState.setErrors(errors);
        set({ document: docState.getDocument() });
      },

      clearErrors: (fieldname) => {
        docState.clearErrors(fieldname);
        set({ document: docState.getDocument() });
      },

      setSaving: (saving) => {
        docState.setSaving(saving);
        set({ isSaving: saving, document: docState.getDocument() });
      },

      markSaved: () => {
        docState.markSaved();
        set({
          isDirty: false,
          hasUnsavedChanges: false,
          isSaving: false,
          document: docState.getDocument(),
          lastSaved: new Date(),
        });
      },

      revert: () => {
        docState.revert();
        set({
          isDirty: false,
          hasUnsavedChanges: false,
          document: docState.getDocument(),
        });
      },

      undo: () => {
        const success = docState.undo();
        if (success) {
          set({
            document: docState.getDocument()!,
            isDirty: docState.isDirty(),
          });
        }
        return success;
      },

      redo: () => {
        const success = docState.redo();
        if (success) {
          set({
            document: docState.getDocument()!,
            isDirty: docState.isDirty(),
          });
        }
        return success;
      },

      reset: () => {
        docState.reset();
        set({
          document: null,
          isDirty: false,
          isSaving: false,
          hasUnsavedChanges: false,
          activeTab: null,
          collapsedSections: new Set<string>(),
          lastSaved: null,
        });
      },

      getDocument: () => docState.getDocument(),
      getValues: () => docState.getValues(),
    }),

    {
      name: "trevo-form-storage",
      partialize: (state) => ({
        // Only persist UI preferences, not document state
        density: state.density,
        autoSaveEnabled: state.autoSaveEnabled,
        autoSaveInterval: state.autoSaveInterval,
        keyboardShortcutsEnabled: state.keyboardShortcutsEnabled,
        recentDocs: state.recentDocs,
        collapsedSections: Array.from(state.collapsedSections),
      }),
      // Sets don't survive JSON: revive the persisted array, or every
      // collapsedSections.has() call crashes the form after a reload
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<TrevoFormStore> & { collapsedSections?: unknown };
        const saved = p.collapsedSections;
        return {
          ...current,
          ...p,
          collapsedSections: new Set<string>(Array.isArray(saved) ? (saved as string[]) : []),
        };
      },
    },
  ),
);
