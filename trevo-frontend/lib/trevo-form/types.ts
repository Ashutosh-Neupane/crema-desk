/**
 * Trevo Form System — Type Definitions
 * A modern, production-quality form system that surpasses Frappe Desk UX.
 */

// ---------------------------------------------------------------------------
// Core field type — extends Frappe's DocField with our enhancements
// ---------------------------------------------------------------------------

export interface TrevoField {
  fieldname: string;
  label: string;
  fieldtype: string;
  required?: boolean;
  readOnly?: boolean;
  hidden?: boolean;
  collapsed?: boolean;
  description?: string;
  placeholder?: string;
  options?: string | null;
  /** Frappe conditional visibility/behavior expressions */
  depends_on?: string | null;
  mandatory_depends_on?: string | null;
  read_only_depends_on?: string | null;
  /** Frappe DocField.default is string|null|undefined; keep compatible to avoid TS assignability issues */
  default?: string | null;
  length?: number;
  precision?: number;
  inListView?: boolean;
  allowInQuickEntry?: boolean;
  columns?: number;
  searchIndex?: number;
  regex?: string;
  /** Additional validation beyond Frappe's built-in */
  validation?: string;
  /** Custom CSS classes for the field wrapper */
  cssClass?: string;
  /** Whether this field should be rendered in a compact mode */
  compact?: boolean;
  /** Whether this field spans full width in the form layout */
  fullWidth?: boolean;
  /** Order/priority for field rendering */
  sortOrder?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Document state — much richer than Frappe's simple doc dict
// ---------------------------------------------------------------------------

export type DocumentStatus = "draft" | "submitted" | "cancelled" | "unknown";

export interface TrevoDocument {
  doctype: string;
  name: string;
  docstatus: number; // 0=draft, 1=submitted, 2=cancelled
  status: DocumentStatus;
  owner: string;
  creation: string;
  modified: string;
  modifiedBy: string;
  /** The current form values */
  values: Record<string, unknown>;
  /** Original values from server (for change detection) */
  originalValues: Record<string, unknown>;
  /** Whether the document has unsaved changes */
  dirty: boolean;
  /** Whether the document is currently being saved */
  saving: boolean;
  /** Validation errors keyed by fieldname */
  errors: Record<string, string[]>;
  /** Whether the document is loading */
  loading: boolean;
  /** Error message if load failed */
  loadError: string | null;
  /** Child table data keyed by fieldname */
  childTables: Record<string, ChildTableData[]>;
  /** Version history */
  versions: DocumentVersion[];
  /** Comments */
  comments: DocumentComment[];
  /** Attachments */
  attachments: DocumentAttachment[];
  /** Workflow state */
  workflowState?: string;
}

export interface ChildTableData {
  name: string;
  idx: number;
  parent: string;
  parentfield: string;
  parenttype: string;
  values: Record<string, unknown>;
  dirty: boolean;
  isNew: boolean;
  /** Whether this row is marked for deletion */
  toDelete: boolean;
}

export interface DocumentVersion {
  name: string;
  creation: string;
  owner: string;
  data?: string;
  /** Human-readable diff from previous version */
  diff?: string;
}

export interface DocumentComment {
  name: string;
  commentEmail: string;
  commentBy?: string;
  content: string;
  creation: string;
}

export interface DocumentAttachment {
  name: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  creation: string;
}

// ---------------------------------------------------------------------------
// Form state management
// ---------------------------------------------------------------------------

export interface FormState {
  /** Current document state */
  document: TrevoDocument | null;
  /** Whether the form is in edit mode */
  editable: boolean;
  /** Whether the form is read-only (submitted/cancelled) */
  readOnly: boolean;
  /** Active tab for tab breaks */
  activeTab: string | null;
  /** Collapsed sections */
  collapsedSections: Set<string>;
  /** Auto-save interval ID */
  autoSaveTimer: ReturnType<typeof setInterval> | null;
  /** Whether auto-save is enabled */
  autoSaveEnabled: boolean;
  /** Auto-save interval in ms (default 30s) */
  autoSaveInterval: number;
  /** Last save timestamp */
  lastSaved: Date | null;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Keyboard shortcuts enabled */
  keyboardShortcutsEnabled: boolean;
  /** Whether the form has been initialized */
  initialized: boolean;
}

// ---------------------------------------------------------------------------
// Form actions
// ---------------------------------------------------------------------------

export type FormAction =
  | { type: "SAVE"; action?: "Save" | "Submit" | "Update" }
  | { type: "CANCEL" }
  | { type: "DISCARD" }
  | { type: "DELETE" }
  | { type: "DUPLICATE" }
  | { type: "RELOAD" }
  | { type: "SET_VALUE"; fieldname: string; value: unknown }
  | { type: "SET_VALUES"; values: Record<string, unknown> }
  | { type: "SET_ERRORS"; errors: Record<string, string[]> }
  | { type: "CLEAR_ERRORS"; fieldname?: string }
  | { type: "SET_EDITABLE"; editable: boolean }
  | { type: "SET_ACTIVE_TAB"; tab: string | null }
  | { type: "TOGGLE_SECTION"; section: string }
  | { type: "RESET" }
  | { type: "INITIALIZE"; doc: TrevoDocument };

// ---------------------------------------------------------------------------
// Form layout
// ---------------------------------------------------------------------------

export interface FormLayout {
  /** Layout mode */
  mode: "standard" | "compact" | "sidebar";
  /** Number of columns */
  columns: 1 | 2 | 3;
  /** Section breaks that define form sections */
  sections: FormSection[];
  /** Whether to show field descriptions */
  showDescriptions: boolean;
  /** Whether to show field labels */
  showLabels: boolean;
  /** Label position: "top" | "left" | "inside" */
  labelPosition: "top" | "left" | "inside";
}

export interface FormSection {
  /** Section label (from Section Break) */
  label: string;
  /** Section fieldname */
  fieldname: string;
  /** Whether section is collapsed */
  collapsed: boolean;
  /** Columns within this section */
  columns: number;
  /** Fields in this section */
  fields: TrevoField[];
  /** Child tables in this section */
  childTables: TrevoField[];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Errors keyed by fieldname */
  errors: Record<string, string[]>;
  /** Global errors (not tied to a specific field) */
  globalErrors: string[];
}

// ---------------------------------------------------------------------------
// Filter & sort (for list view)
// ---------------------------------------------------------------------------

export interface TrevoFilter {
  fieldname: string;
  label: string;
  fieldtype: string;
  operator: string;
  value: unknown;
  options?: string[];
}

export interface TrevoSort {
  fieldname: string;
  direction: "asc" | "desc";
  label?: string;
}

// ---------------------------------------------------------------------------
// Bulk actions
// ---------------------------------------------------------------------------

export interface BulkAction {
  id: string;
  label: string;
  icon?: string;
  variant?: "default" | "destructive" | "secondary";
  /** Whether this action requires confirmation */
  confirm?: boolean;
  /** Confirmation message */
  confirmMessage?: string;
  /** Execute the action */
  execute: (docs: TrevoDocument[]) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export interface TrevoNotification {
  name: string;
  subject: string;
  /** Notification type for styling */
  type: "info" | "success" | "warning" | "error";
  /** Whether this has been seen */
  seen: boolean;
  /** The document this notification is about */
  documentType?: string;
  documentName?: string;
  /** When this notification was created */
  creation: string;
  /** Who sent this notification */
  fromUser?: string;
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

export interface TrevoWorkspace {
  name: string;
  title: string;
  icon?: string;
  color?: string;
  /** Quick shortcuts */
  shortcuts: TrevoShortcut[];
  /** Navigation links */
  links: TrevoLink[];
  /** Number cards */
  numberCards: TrevoNumberCard[];
  /** Charts */
  charts: TrevoChart[];
  /** Custom content */
  content?: string;
}

export interface TrevoShortcut {
  label: string;
  /** What this shortcut links to */
  linkTo: string;
  /** Type: "DocType", "Report", "URL", etc. */
  type: string;
  /** Icon name (Lucide) */
  icon?: string;
  /** Color theme */
  color?: string;
}

export interface TrevoLink {
  label: string;
  linkTo: string;
  linkType: string;
  type: string;
  icon?: string;
  description?: string;
  hidden?: boolean;
}

export interface TrevoNumberCard {
  /** Label for the card */
  label: string;
  /** The doctype to count */
  doctype: string;
  /** Filter to apply */
  filters: Record<string, unknown>;
  /** Color theme */
  color: string;
  /** Whether to show as progress towards a goal */
  isProgress?: boolean;
  /** Goal value for progress */
  goal?: number;
}

export interface TrevoChart {
  /** Chart name */
  name: string;
  /** Chart type */
  type: string;
  /** Reference doctype */
  doctype: string;
  /** Source for the chart data */
  source: string;
  /** Filters applied */
  filters: Record<string, unknown>;
  /** Time range for timeseries */
  timespan?: string;
  /** Period for aggregation */
  period?: string;
}

// ---------------------------------------------------------------------------
// Command palette
// ---------------------------------------------------------------------------

export interface CommandAction {
  /** Unique ID */
  id: string;
  /** Display label */
  label: string;
  /** Description */
  description?: string;
  /** Icon name (Lucide) */
  icon?: string;
  /** Keywords for search */
  keywords?: string[];
  /** Category for grouping */
  category: "navigation" | "action" | "create" | "settings";
  /** Whether this is a destructive action */
  destructive?: boolean;
  /** Execute the action */
  execute: () => void;
}

// ---------------------------------------------------------------------------
// UI State
// ---------------------------------------------------------------------------

export type Theme = "light" | "dark" | "system";

export interface TrevoUIState {
  /** Current theme */
  theme: Theme;
  /** Whether sidebar is open (desktop) */
  sidebarOpen: boolean;
  /** Whether mobile menu is open */
  mobileMenuOpen: boolean;
  /** Whether command palette is open */
  commandPaletteOpen: boolean;
  /** Whether notification panel is open */
  notificationPanelOpen: boolean;
  /** Active workspace */
  activeWorkspace: string | null;
  /** Recent documents */
  recentDocs: TrevoDocument[];
  /** Maximum recent docs to keep */
  maxRecentDocs: number;
  /** Whether to show breadcrumbs */
  showBreadcrumbs: boolean;
  /** Density: "comfortable" | "compact" */
  density: "comfortable" | "compact";
}
