"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/frappe/auth";
import { useMemo } from "react";
import { ErrorDetailsHost } from "@/components/desk/ErrorDetails";

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(() => {
    return new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30000,
          retry: 1,
          refetchOnWindowFocus: false,
        },
      },
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        {/* phones: clear the form's bottom action bar */}
        <Toaster position="bottom-right" richColors mobileOffset={{ bottom: "4.5rem" }} />
        <ErrorDetailsHost />
      </AuthProvider>
    </QueryClientProvider>
  );
}
