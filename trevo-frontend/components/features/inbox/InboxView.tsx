"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Textarea } from "@/components/shadcn/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/shadcn/dialog";
import {
  Mail,
  MailOpen,
  Send,
  Trash2,
  RefreshCw,
  Loader2,
  Search,
  Reply,
  Forward,
  Archive,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface EmailDoc {
  name: string;
  subject: string;
  sender: string;
  sender_full_name?: string;
  recipients?: string;
  communication_date: string;
  content?: string;
  seen: number;
  status: string;
  in_reply_to?: string;
  _attachments?: number;
}

interface InboxViewProps {
  doctype?: string;
  docname?: string;
}

export function InboxView({ doctype, docname }: InboxViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<EmailDoc | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<EmailDoc | null>(null);

  const { data: emails = [], isLoading, refetch } = useQuery({
    queryKey: ["inbox", doctype, docname],
    queryFn: async () => {
      const filters: Record<string, unknown> = {
        communication_type: "Communication",
        communication_medium: "Email",
      };
      if (doctype && docname) {
        filters.reference_doctype = doctype;
        filters.reference_name = docname;
      }
      const res = await fetch(`/api/frappe/frappe.client.get_list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctype: "Communication",
          filters,
          fields: ["name", "subject", "sender", "sender_full_name", "recipients", "communication_date", "content", "seen", "status", "in_reply_to"],
          order_by: "communication_date desc",
          limit: 200,
        }),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.message ?? []) as EmailDoc[];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const threads = useMemo(() => {
    const threadMap = new Map<string, EmailDoc[]>();

    emails.forEach((email) => {
      const threadId = email.in_reply_to || email.name;
      if (!threadMap.has(threadId)) {
        threadMap.set(threadId, []);
      }
      threadMap.get(threadId)!.push(email);
    });

    return Array.from(threadMap.entries()).map(([threadId, msgs]) => ({
      threadId,
      messages: msgs.sort((a, b) => new Date(a.communication_date).getTime() - new Date(b.communication_date).getTime()),
      latest: msgs.reduce((a, b) => new Date(a.communication_date) > new Date(b.communication_date) ? a : b),
    })).sort((a, b) => new Date(b.latest.communication_date).getTime() - new Date(a.latest.communication_date).getTime());
  }, [emails]);

  const markAsRead = useMutation({
    mutationFn: async (emailName: string) => {
      return fetch(`/api/frappe/frappe.client.set_value`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctype: "Communication",
          name: emailName,
          fieldname: "seen",
          value: 1,
        }),
      });
    },
  });

  const filteredThreads = searchQuery
    ? threads.filter((t) =>
        t.latest.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.latest.sender?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.latest.content?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : threads;

  const unreadCount = emails.filter((e) => !e.seen).length;

  const handleSelectThread = useCallback((thread: typeof threads[0]) => {
    setSelectedEmail(thread.latest);
    if (!thread.latest.seen) {
      markAsRead.mutate(thread.latest.name);
    }
  }, [markAsRead]);

  const handleCompose = useCallback(() => {
    setReplyTo(null);
    setComposeOpen(true);
  }, []);

  const handleReply = useCallback((email: EmailDoc) => {
    setReplyTo(email);
    setComposeOpen(true);
  }, []);

  return (
    <div className="flex h-full gap-4">
      {/* Email list */}
      <div className="w-96 shrink-0 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search emails..."
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button size="sm" onClick={handleCompose}>
            <Send className="h-3 w-3 mr-1" />
            Compose
          </Button>
        </div>

        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-zinc-500">{filteredThreads.length} threads</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {unreadCount} unread
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-8 text-center">
              <Mail className="mx-auto h-6 w-6 text-zinc-300" />
              <p className="mt-2 text-sm text-zinc-500">No emails found</p>
            </div>
          ) : (
            filteredThreads.map((thread) => (
              <button
                key={thread.threadId}
                onClick={() => handleSelectThread(thread)}
                className={`w-full rounded-lg p-3 text-left transition-colors ${
                  selectedEmail?.name === thread.latest.name
                    ? "bg-zinc-100 dark:bg-zinc-700"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {!thread.latest.seen && <div className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                      <p className={`truncate text-sm ${!thread.latest.seen ? "font-semibold" : "font-medium"} text-zinc-900 dark:text-zinc-100`}>
                        {thread.latest.sender_full_name || thread.latest.sender || "Unknown"}
                      </p>
                      {thread.messages.length > 1 && (
                        <span className="shrink-0 rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                          {thread.messages.length}
                        </span>
                      )}
                    </div>
                    <p className={`mt-0.5 truncate text-xs ${!thread.latest.seen ? "font-medium" : ""} text-zinc-600 dark:text-zinc-400`}>
                      {thread.latest.subject || "(No subject)"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-zinc-400">
                    {formatDistanceToNow(new Date(thread.latest.communication_date), { addSuffix: true })}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Email detail */}
      <div className="flex-1">
        {selectedEmail ? (
          <Card className="h-full overflow-hidden">
            <div className="border-b border-zinc-200 p-4 dark:border-zinc-700">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {selectedEmail.subject || "(No subject)"}
              </h2>
              <div className="mt-2 flex items-center gap-3 text-sm text-zinc-500">
                <span><strong>From:</strong> {selectedEmail.sender_full_name || selectedEmail.sender}</span>
                <span><strong>Date:</strong> {new Date(selectedEmail.communication_date).toLocaleString()}</span>
              </div>
              {selectedEmail.recipients && (
                <p className="mt-1 text-xs text-zinc-500"><strong>To:</strong> {selectedEmail.recipients}</p>
              )}
              <div className="mt-3 flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => handleReply(selectedEmail)}>
                  <Reply className="h-3 w-3 mr-1" />
                  Reply
                </Button>
                <Button variant="ghost" size="sm">
                  <Forward className="h-3 w-3 mr-1" />
                  Forward
                </Button>
                <Button variant="ghost" size="sm">
                  <Archive className="h-3 w-3 mr-1" />
                  Archive
                </Button>
                <Button variant="ghost" size="sm" className="text-red-500">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="p-4 overflow-auto">
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: selectedEmail.content || "<p>No content</p>" }}
              />
            </div>
          </Card>
        ) : (
          <Card className="h-full flex items-center justify-center">
            <div className="text-center p-8">
              <MailOpen className="mx-auto h-8 w-8 text-zinc-300" />
              <p className="mt-2 text-sm text-zinc-500">Select an email to view</p>
            </div>
          </Card>
        )}
      </div>

      {/* Compose/Reply dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{replyTo ? "Reply" : "Compose Email"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">To</label>
              <Input
                defaultValue={replyTo?.sender ?? ""}
                placeholder="recipient@example.com"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Subject</label>
              <Input
                defaultValue={replyTo ? `Re: ${replyTo.subject}` : ""}
                placeholder="Subject"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Message</label>
              <Textarea
                placeholder="Write your message..."
                className="mt-1 h-48"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Attachments</label>
              <input
                type="file"
                multiple
                className="mt-1 block w-full text-sm text-zinc-600 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800 dark:file:bg-zinc-100 dark:file:text-zinc-900 dark:hover:file:bg-zinc-200"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
            <Button>
              <Send className="h-4 w-4 mr-1" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
