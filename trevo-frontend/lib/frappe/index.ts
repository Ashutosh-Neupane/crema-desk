// Frappe lib barrel export
// Centralized exports for all Frappe-related modules.

export { AuthProvider, useAuth, AuthContext } from "./auth";

export {
  frappeClient,
  frappeGet,
  frappePost,
  frappePut,
  frappeDelete,
  clientLogin,
  clientLogout,
  clientWhoAmI,
  clientBoot,
  getFrappeBaseUrl,
} from "./client";

export {
  FRAPPE_BACKEND_URL,
  frappeServerFetch,
  getCookieHeader,
} from "./server";

export {
  assembleBootInfo,
} from "./boot";

export {
  getBackendVersion,
  getVersionCompatibility,
  getMajorVersion,
  isV17Compatible,
} from "./version";

export type {
  FrappeAPIResponse,
  FrappeLoginResponse,
  FrappeUser,
  BootInfo,
  InstalledApp,
  FrappeDocument,
  ListParams,
  ListResult,
  SearchLinkResult,
  DocInfo,
  CommentItem,
  AttachmentItem,
  NotificationLog,
  BackendVersion,
  VersionCompatibility,
} from "./types";
