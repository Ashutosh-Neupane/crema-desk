/**
 * Frappe API types — based on the LIVE backend at localhost:8080.
 * These reflect the empirically-verified contract, NOT the master prompt.
 *
 * Key corrections vs. the master prompt:
 *  - Workspace sidebar returns { message: { pages: [...] } } (NOT `workspaces`)
 *  - Workspace links carry `link_type` (DocType/Report/…) AND `type`
 *  - Fieldtype "Text Editor" exists (the prompt called it "HTML Editor")
 *  - `savedocs(doc, action)` is the save path
 */

// ---------------------------------------------------------------------------
// Generic API envelope
// ---------------------------------------------------------------------------

/** Frappe wraps most /api/method responses in { message: ... }. REST /api/resource uses { data: ... }. */
export type FrappeAPIResponse<T = unknown> = {
  message?: T;
  data?: T;
  exc?: string | object | null;
  exc_type?: string;
  _server_messages?: string; // JSON string array of message objects
  docs?: unknown;
};

// ---------------------------------------------------------------------------
// Auth / User
// ---------------------------------------------------------------------------

export interface FrappeLoginResponse {
  message: string; // "Logged In"
  home_page: string;
  full_name: string;
  /** Frappe sometimes returns the user email directly */
  user?: string;
}

export interface FrappeUser {
  name: string; // email is the "name"
  email: string;
  full_name: string;
  user_image: string | null;
  first_name?: string;
  last_name?: string;
  username?: string;
  roles?: string[];
  language?: string;
  /** Frappe stores role-ish defaults here */
  defaults?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Boot info — assembled by our BFF (get_bootinfo is NOT whitelisted on :8080)
// ---------------------------------------------------------------------------

export interface InstalledApp {
  app_name: string;
  app_title: string;
  app_version: string;
  app_route?: string;
  icon?: string;
  url?: string;
  has_permission?: boolean;
}

export interface BootInfo {
  user: FrappeUser;
  installed_apps: InstalledApp[];
  sysdefaults: Record<string, string>;
  lang: string;
  desk_theme?: "Light" | "Dark" | "System";
  notification_count: number;
  backend_version?: string;
  frappe_version?: string;
}

// ---------------------------------------------------------------------------
// Workspaces — REAL shape from get_workspace_sidebar_items / resource/Workspace/:name
// ---------------------------------------------------------------------------

export interface WorkspaceSidebarItem {
  name: string;
  title: string;
  icon?: string | null;
  /** hex / css color or named indicator */
  indicator_color?: string;
  /** parent workspace name for nested entries */
  parent_page?: string | null;
  /** Frappe sends public as 0/1 or boolean */
  public: boolean | 0 | 1;
  is_hidden: boolean | 0 | 1;
  label?: string;
  /** Frappe workspace fields vary; keep loose */
  [key: string]: unknown;
}

/** Response envelope of get_workspace_sidebar_items */
export interface WorkspaceSidebarResponse {
  pages: WorkspaceSidebarItem[];
}

export type WorkspaceShortcutType =
  | "DocType"
  | "Page"
  | "Report"
  | "URL"
  | "Dashboard"
  | "Help";

export interface WorkspaceShortcut {
  label: string;
  link_to: string;
  type: WorkspaceShortcutType;
  icon?: string | null;
  color?: string;
  url?: string;
  [key: string]: unknown;
}

export type WorkspaceLinkType = "DocType" | "Page" | "Report" | "Dashboard" | "Help";

export interface WorkspaceLink {
  label: string;
  link_to: string;
  type?: WorkspaceLinkType | null;
  link_type?: WorkspaceLinkType | null;
  icon?: string | null;
  color?: string;
  dependencies?: string;
  hidden: boolean | 0 | 1;
  link_count?: number;
  is_query_report?: boolean;
  onboard?: boolean | 0 | 1;
  only_for?: string;
  [key: string]: unknown;
}

export interface WorkspaceChart {
  chart_name: string;
  label?: string;
  [key: string]: unknown;
}

export interface WorkspaceNumberCard {
  number_card_name: string;
  label?: string;
  [key: string]: unknown;
}

export interface WorkspaceData {
  name: string;
  title: string;
  icon?: string | null;
  module?: string;
  is_standard?: boolean | 0 | 1;
  public?: boolean | 0 | 1;
  is_default?: boolean | 0 | 1;
  for_user?: string | null;
  parent_page?: string | null;
  /** JSON-stringified block list (Frappe blocks builder) */
  content?: string | null;
  shortcuts?: WorkspaceShortcut[];
  links?: WorkspaceLink[];
  charts?: WorkspaceChart[];
  number_cards?: WorkspaceNumberCard[];
}

// ---------------------------------------------------------------------------
// DocType meta
// ---------------------------------------------------------------------------

export type FieldType =
  | "Data"
  | "Text"
  | "Long Text"
  | "Small Text"
  | "Text Editor"
  | "Check"
  | "Int"
  | "Float"
  | "Currency"
  | "Percent"
  | "Date"
  | "Datetime"
  | "Time"
  | "Select"
  | "Link"
  | "Dynamic Link"
  | "Table"
  | "Table MultiSelect"
  | "Attach"
  | "Attach Image"
  | "HTML"
  | "Code"
  | "Color"
  | "Password"
  | "Rating"
  | "Signature"
  | "Read Only"
  | "Section Break"
  | "Column Break"
  | "Tab Break"
  | "Fold"
  | "Heading"
  | "Image"
  | "Autocomplete"
  | "Barcode"
  | "Button"
  | "Geolocation"
  | "Duration"
  | "JSON"
  | "Icon"
  // fallback for unknown / future types
  | (string & {});

export interface DocField {
  fieldname: string;
  fieldtype: FieldType;
  label?: string | null;
  reqd?: boolean | 0 | 1;
  hidden?: boolean | 0 | 1;
  read_only?: boolean | 0 | 1;
  /** For Select: newline-separated options. For Link: target DocType. For Table: child DocType. */
  options?: string | null;
  default?: string | null;
  depends_on?: string | null;
  mandatory_depends_on?: string | null;
  read_only_depends_on?: string | null;
  description?: string | null;
  in_list_view?: boolean | 0 | 1;
  in_standard_filter?: boolean | 0 | 1;
  in_filter?: boolean | 0 | 1;
  bold?: boolean | 0 | 1;
  collapsible?: boolean | 0 | 1;
  collapsible_depends_on?: string | null;
  columns?: number;
  fetch_from?: string | null;
  fetch_if_empty?: boolean | 0 | 1;
  precision?: string | number | null;
  permlevel?: number;
  length?: number | null;
  no_copy?: boolean | 0 | 1;
  set_only_once?: boolean | 0 | 1;
  allow_in_quick_entry?: boolean | 0 | 1;
  ignore_user_permissions?: boolean | 0 | 1;
  print_hide?: boolean | 0 | 1;
  translatable?: boolean | 0 | 1;
  unique?: boolean | 0 | 1;
  hide_border?: boolean | 0 | 1;
  hide_days?: boolean | 0 | 1;
  hide_seconds?: boolean | 0 | 1;
  remember_last_selected_value?: boolean | 0 | 1;
  [key: string]: unknown;
}

export interface DocPermission {
  role: string;
  read?: boolean | 0 | 1;
  write?: boolean | 0 | 1;
  create?: boolean | 0 | 1;
  delete?: boolean | 0 | 1;
  submit?: boolean | 0 | 1;
  cancel?: boolean | 0 | 1;
  amend?: boolean | 0 | 1;
  permlevel?: number;
  [key: string]: unknown;
}

export interface DocAction {
  label?: string;
  action_type?: string;
  action?: string;
  condition?: string;
  [key: string]: unknown;
}

export interface DocLinkMeta {
  link_doctype?: string;
  link_fieldname?: string;
  label?: string;
  group?: string;
  is_child_table?: boolean | 0 | 1;
  [key: string]: unknown;
}

export interface DocTypeMeta {
  name: string;
  module?: string;
  issingle?: boolean | 0 | 1;
  istable?: boolean | 0 | 1;
  is_submittable?: boolean | 0 | 1;
  track_changes?: boolean | 0 | 1;
  track_views?: boolean | 0 | 1;
  autoname?: string | null;
  description?: string | null;
  documentation?: string | null;
  naming_rule?: string;
  default_view?: string;
  force_re_route_to_default_view?: boolean | 0 | 1;
  fields: DocField[];
  permissions: DocPermission[];
  actions?: DocAction[];
  links?: DocLinkMeta[];
  /** additional views /kanban, /calendar, /tree, /report etc. */
  allow_import?: boolean | 0 | 1;
  allow_copy?: boolean | 0 | 1;
  allow_rename?: boolean | 0 | 1;
  allow_auto_repeat?: boolean | 0 | 1;
  in_create?: boolean | 0 | 1;
  quick_entry?: boolean | 0 | 1;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export type DocStatus = 0 | 1 | 2; // 0=Draft, 1=Submitted, 2=Cancelled

export interface FrappeDocument {
  name: string;
  doctype: string;
  owner?: string;
  creation?: string;
  modified?: string;
  modified_by?: string;
  parent?: string;
  parenttype?: string;
  parentfield?: string;
  idx?: number;
  docstatus: DocStatus;
  __islocal?: boolean;
  __unsaved?: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// List / filters
// ---------------------------------------------------------------------------

export type FilterOperator =
  | "="
  | "!="
  | "like"
  | "not like"
  | ">"
  | "<"
  | ">="
  | "<="
  | "in"
  | "not in"
  | "is"
  | "Between";

/** Frappe filter tuple: [doctype, fieldname, operator, value] (doctype often omitted) */
export type FilterCondition =
  | [string, string, FilterOperator, unknown]
  | [string, string, FilterOperator];

export interface ListParams {
  fields?: string[];
  filters?: FilterCondition[];
  order_by?: string;
  limit?: number; // maps to limit_page_length
  limit_start?: number;
}

export interface ListResult<T = FrappeDocument> {
  data: T[];
  /** total count (we fetch separately via get_count) */
  count?: number;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchLinkResult {
  value: string;
  label: string;
  description?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export interface NotificationLog {
  name: string;
  subject: string | null;
  type: string | null;
  for_user: string | null;
  seen: boolean | 0 | 1;
  creation: string;
  document_type?: string;
  document_name?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Timeline / doc info (from get_doc_info)
// ---------------------------------------------------------------------------

export interface CommentItem {
  name: string;
  comment_type: string; // Comment | Updated | Assigned | etc.
  content: string;
  comment_email?: string;
  comment_by?: string;
  creation?: string;
  [key: string]: unknown;
}

export interface AttachmentItem {
  name: string;
  file_name: string;
  file_url: string;
  file_type?: string;
  is_private?: boolean | 0 | 1;
  file_size?: number;
  owner?: string;
  creation?: string;
  [key: string]: unknown;
}

export interface AssignmentItem {
  name: string;
  owner?: string;
  description?: string;
  status?: string;
  date?: string;
  allocated_to?: string;
  [key: string]: unknown;
}

export interface VersionItem {
  name: string;
  creation: string;
  owner: string;
  data: string; // JSON describing field changes
  [key: string]: unknown;
}

export interface DocInfo {
  comments?: CommentItem[];
  attachments?: AttachmentItem[];
  assignments?: AssignmentItem[];
  versions?: VersionItem[];
  shared?: unknown[];
  views?: unknown[];
  tags?: string[];
  workflow_state?: string | null;
  attachment_logs?: unknown[];
  energy_point_logs?: unknown[];
  additional_notifications?: unknown[];
}

export interface BackendVersion {
  frappe_version: string;
  version: string;
  installed_apps: string[];
}

export interface VersionCompatibility {
  is_v17: boolean;
  is_v16: boolean;
  socket_io_protocol: "v4" | "v5";
  use_legacy_api_paths: boolean;
}
