/** State behind the Server Error dialog (ErrorDetailsHost): the error being shown and who may see tracebacks. */
export interface ErrorDetailsInfo {
  message: string;
  traceback: string;
}

let current: ErrorDetailsInfo | null = null;
const listeners = new Set<() => void>();
// Desk shows tracebacks to System Managers only (the host keeps this in sync with the desk context roles)
let systemManager = false;

/** Whether the current user may see server tracebacks (Desk: System Manager) */
export function tracebacksAllowed(): boolean {
  return systemManager;
}

export function setTracebacksAllowed(on: boolean) {
  systemManager = on;
}

/** Open the error details dialog for an error with a server traceback */
export function showErrorDetails(info: ErrorDetailsInfo) {
  current = info;
  listeners.forEach((l) => l());
}

export function closeErrorDetails() {
  current = null;
  listeners.forEach((l) => l());
}

export function subscribeErrorDetails(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export const getErrorDetails = () => current;
