"use client";

import {
  useEffect,
  useState,
  useRef,
  FormEvent,
  ChangeEvent,
  KeyboardEvent,
} from "react";
import { SessionProvider, signIn, useSession } from "next-auth/react";

type ViewMode = "home" | "connect";

type OutgoingRequest = {
  id: string;
  status: string;
  categories: string[];
  message?: string | null;
  createdAt: string;
  toUser: {
    id: string;
    handle: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
};

type ChatMessage = {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
};

type IncomingRequest = {
  id: string;
  status: string;
  categories: string[];
  message?: string | null;
  createdAt: string;
  fromUser: {
    id: string;
    handle: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
};

type FoundUser = {
  id: string;
  handle: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export default function Home() {
  return (
    <SessionProvider>
      <HomeInner />
    </SessionProvider>
  );
}

function HomeInner() {
  const { data: session, status } = useSession();
  const [mode, setMode] = useState<ViewMode>("home");

  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([]);
  const [isLoadingOutgoing, setIsLoadingOutgoing] = useState(false);

  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [isLoadingIncoming, setIsLoadingIncoming] = useState(false);
  const [incomingError, setIncomingError] = useState<string | null>(null);

  const [activePeerHandle, setActivePeerHandle] = useState<string | null>(null);
  const [chatRoomId, setChatRoomId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [isChatFull, setIsChatFull] = useState(false);

  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

  const [currentHandle, setCurrentHandle] = useState<string | null>(null);
  const [editingHandle, setEditingHandle] = useState(false);
  const [handleDraft, setHandleDraft] = useState("");
  const [handleError, setHandleError] = useState<string | null>(null);
  const [handleSaving, setHandleSaving] = useState(false);

  const [friendIdInput, setFriendIdInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);

  const allCategories = [
    "Co-Founder",
    "Brother",
    "C.E.O",
    "Founder",
    "Millionaire",
    "Billionaire",
  ];

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Authenticated: load outgoing & incoming requests once on auth
  useEffect(() => {
    if (status !== "authenticated") return;

    const loadOutgoingAndIncoming = async () => {
      try {
        setIsLoadingOutgoing(true);
        setIsLoadingIncoming(true);
        setIncomingError(null);

        const res = await fetch("/api/friends/outgoing");
        if (!res.ok) return;
        const data = await res.json();
        setOutgoing((data.requests || []) as OutgoingRequest[]);
      } catch {
        // ignore for now
      } finally {
        setIsLoadingOutgoing(false);
      }

      try {
        const res = await fetch("/api/friends/incoming");
        if (!res.ok) {
          setIncomingError("Unable to load incoming requests.");
          return;
        }
        const data = await res.json();
        setIncoming((data.requests || []) as IncomingRequest[]);
      } catch {
        setIncomingError("Unable to load incoming requests.");
      } finally {
        setIsLoadingIncoming(false);
      }
    };

    loadOutgoingAndIncoming();
  }, [status]);

  // Light polling so incoming/outgoing stay in sync across devices
  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    const refresh = async () => {
      try {
        const outRes = await fetch("/api/friends/outgoing");
        if (outRes.ok) {
          const outData = await outRes.json();
          if (!cancelled) {
            setOutgoing((outData.requests || []) as OutgoingRequest[]);
          }
        }
      } catch {
        // ignore
      }

      try {
        const inRes = await fetch("/api/friends/incoming");
        if (inRes.ok) {
          const inData = await inRes.json();
          if (!cancelled) {
            setIncoming((inData.requests || []) as IncomingRequest[]);
          }
        }
      } catch {
        // ignore
      }
    };

    refresh();
    const id = setInterval(refresh, 5000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [status]);

  // Lightweight "realtime" polling: keep conversation in sync
  useEffect(() => {
    if (!activePeerHandle) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/chat/history?peerHandle=${encodeURIComponent(activePeerHandle)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setChatRoomId((data.roomId as string) || null);
        setChatMessages(((data.messages as ChatMessage[]) || []).map((m) => ({
          ...m,
          createdAt: m.createdAt,
        })));
      } catch {
        // ignore; next poll will try again
      }
    };

    // Initial fetch and interval
    poll();
    const id = setInterval(poll, 3000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activePeerHandle]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const raw = (session.user as any)?.handle as string | undefined;
    if (raw && !currentHandle) {
      setCurrentHandle(raw);
    }
  }, [status, session, currentHandle]);

  // While auth is loading, keep users on a neutral loading state
  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
        <div className="glass-panel neon-border relative w-full max-w-md overflow-hidden px-6 py-7 sm:px-8 sm:py-9">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-cyan-400/0 via-cyan-400/70 to-fuchsia-500/0" />
          <div className="space-y-4 text-center text-sm text-slate-300/85">
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-slate-400">
              Checking access • Synchronizing quantum keys
            </p>
            <p className="text-slate-200">
              Preparing your secure channel • please wait…
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Unauthenticated: Google access gate
  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
        <div className="glass-panel neon-border relative w-full max-w-md overflow-hidden px-6 py-7 sm:px-8 sm:py-9">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-cyan-400/0 via-cyan-400/70 to-fuchsia-500/0" />

          <div className="space-y-5">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-cyan-100/80">
                <span className="relative flex h-2 w-2 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400/70 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-300" />
                </span>
                Access handshake
              </p>

              <h1 className="text-balance text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
                Link your Google identity
              </h1>
              <p className="text-sm text-slate-300/85">
                We use your Google account only to recognize you across devices
                and keep your quantum IDs and conversations in sync.
              </p>
            </div>

            <div className="space-y-3 text-xs text-slate-400">
              <p className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Email and basic profile to identify you
              </p>
              <p className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                Used to secure access to your chats and quantum IDs
              </p>
            </div>

            <button
              type="button"
              onClick={() => signIn("google")}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-slate-900/90 px-4 py-2.5 text-sm font-medium text-slate-50 ring-1 ring-slate-500/70 transition hover:bg-slate-900 hover:ring-cyan-400/80"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition group-hover:translate-x-full group-hover:opacity-100" />
              <span className="relative flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold">
                  <span className="bg-[conic-gradient(from_45deg,_#4285F4_0deg,_#4285F4_90deg,_#34A853_90deg,_#34A853_180deg,_#FBBC05_180deg,_#FBBC05_270deg,_#EA4335_270deg,_#EA4335_360deg)] bg-clip-text text-transparent">
                    G
                  </span>
                </span>
                Continue with Google
              </span>
            </button>

            <p className="pt-1 text-[10px] text-slate-500">
              After sign-in you’ll see your quantum ID and can connect with
              anyone globally.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const handleSearch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!friendIdInput.trim()) return;

    setSearching(true);
    setSearchError(null);
    setFoundUser(null);
    setSelectedCategories([]);
    setComment("");
    setRequestError(null);
    setRequestSuccess(null);

    try {
      const res = await fetch("/api/friends/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: friendIdInput.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSearchError(data.error || "Quantum ID not found.");
        return;
      }

      const data = await res.json();
      setFoundUser(data.user as FoundUser);
    } catch {
      setSearchError("Unable to reach quantum directory. Try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleChatKeyDown = async (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      if (!activePeerHandle || !chatInput.trim()) return;
      e.preventDefault();
      await actuallySendChat();
    }
  };

  const toggleCategory = (cat: string) => {
    setRequestError(null);
    setRequestSuccess(null);
    setSelectedCategories((prev) => {
      if (prev.includes(cat)) {
        return prev.filter((c) => c !== cat);
      }
      if (prev.length >= 2) {
        return prev; // enforce max 2
      }
      return [...prev, cat];
    });
  };

  const handleSendRequest = async () => {
    if (!foundUser) return;
    if (selectedCategories.length === 0) {
      setRequestError("Select at least one relationship category.");
      return;
    }

    setSendingRequest(true);
    setRequestError(null);
    setRequestSuccess(null);

    try {
      const res = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toHandle: foundUser.handle,
          categories: selectedCategories,
          message: comment,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setRequestError(data.error || "Failed to send request.");
        return;
      }

      setRequestSuccess("Request sent successfully.");
      setComment("");
      setSelectedCategories([]);
      setFoundUser(null);
      setFriendIdInput("");

      // Refresh outgoing list
      const outRes = await fetch("/api/friends/outgoing");
      if (outRes.ok) {
        const outData = await outRes.json();
        setOutgoing((outData.requests || []) as OutgoingRequest[]);
      }

      // Return to home view
      setMode("home");
    } catch {
      setRequestError("Something went wrong. Try again.");
    } finally {
      setSendingRequest(false);
    }
  };

  const openChatWithPeer = async (peerHandle: string) => {
    setActivePeerHandle(peerHandle);
    setChatLoading(true);
    setChatError(null);

    try {
      const res = await fetch(
        `/api/chat/history?peerHandle=${encodeURIComponent(peerHandle)}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setChatError(data.error || "Unable to load conversation.");
        setChatMessages([]);
        setChatRoomId(null);
        return;
      }

      const data = await res.json();
      setChatRoomId((data.roomId as string) || null);
      setChatMessages(((data.messages as ChatMessage[]) || []).map((m) => ({
        ...m,
        createdAt: m.createdAt,
      })));
    } catch {
      setChatError("Unable to load conversation.");
      setChatMessages([]);
      setChatRoomId(null);
    } finally {
      setChatLoading(false);
    }
  };

  const handleIncomingDecision = async (
    requestId: string,
    action: "ACCEPT" | "REJECT",
    peerHandle: string
  ) => {
    setIncomingError(null);
    try {
      const res = await fetch("/api/friends/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setIncomingError(
          data.error || "Unable to update request. Please try again."
        );
        return;
      }

      const data = await res.json();
      const updated = data.request as IncomingRequest;

      setIncoming((prev) =>
        prev.map((r) => (r.id === updated.id ? { ...r, status: updated.status } : r))
      );

      if (action === "ACCEPT") {
        await openChatWithPeer(peerHandle);
      }
    } catch {
      setIncomingError("Unable to update request. Please try again.");
    }
  };

  const actuallySendChat = async () => {
    if (!activePeerHandle || !chatInput.trim()) return;

    const text = chatInput.trim();
    setChatError(null);

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toHandle: activePeerHandle, content: text }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setChatError(data.error || "Unable to send message.");
        return;
      }

      const data = await res.json();
      const message = data.message as ChatMessage;
      setChatMessages((prev) => [...prev, message]);
      setChatInput("");
    } catch {
      setChatError("Unable to send message.");
    }
  };

  const handleChatSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await actuallySendChat();
  };

  const handleChatInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setChatInput(e.target.value);
    if (chatInputRef.current) {
      chatInputRef.current.style.height = "auto";
      chatInputRef.current.style.height = `${chatInputRef.current.scrollHeight}px`;
    }
  };

  const quantumId = currentHandle || (session.user as any)?.handle || "your-id";
  const meId = (session.user as any)?.id as string | undefined;

  const validateHandleDraft = (value: string): string | null => {
    const trimmed = value.trim();
    const digitCount = (trimmed.match(/\d/g) || []).length;
    if (!trimmed) return null;
    if (trimmed.length < 6 || digitCount < 4) {
      return "Your quantum ID must be at least 6 characters and include at least 4 numbers.";
    }
    return null;
  };

  const startEditingHandle = () => {
    setHandleDraft(quantumId.replace(/^@/, ""));
    setHandleError(null);
    setEditingHandle(true);
  };

  const cancelEditingHandle = () => {
    setEditingHandle(false);
    setHandleDraft("");
    setHandleError(null);
  };

  const onHandleDraftChange = (value: string) => {
    setHandleDraft(value);
    const msg = validateHandleDraft(value);
    setHandleError(msg);
  };

  const saveHandle = async () => {
    const trimmed = handleDraft.trim();
    const msg = validateHandleDraft(trimmed);
    if (msg) {
      setHandleError(msg);
      return;
    }

    if (!trimmed) return;

    setHandleSaving(true);
    setHandleError(null);

    try {
      const res = await fetch("/api/user/handle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: trimmed }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setHandleError(
          data.error ||
            "We couldn't update your quantum ID. Please review the rules above and try again.",
        );
        return;
      }

      const updatedHandle = (data.user?.handle as string | undefined) || trimmed;
      setCurrentHandle(updatedHandle);
      setEditingHandle(false);
      setHandleDraft("");
      setHandleError(null);
    } catch {
      setHandleError(
        "We couldn't reach the quantum directory. Please check your connection and try again.",
      );
    } finally {
      setHandleSaving(false);
    }
  };

  return (
    <main
      className={
        isChatFull
          ? "h-screen w-full flex items-stretch justify-stretch p-0 overflow-hidden"
          : "min-h-screen w-full flex items-center justify-center px-3 py-8 sm:px-6 lg:px-10"
      }
    >
      <div
        className={
          "glass-panel neon-border relative w-full overflow-hidden " +
          (isChatFull
            ? "h-full max-h-full rounded-none p-0"
            : "max-w-5xl px-6 py-7 sm:px-12 sm:py-10")
        }
      >
        <div
          className={
            "pointer-events-none absolute top-0 h-px bg-gradient-to-r from-cyan-400/0 via-cyan-400/70 to-fuchsia-500/0 " +
            (isChatFull ? "inset-x-0" : "inset-x-6")
          }
        />

        <div
          className={
            isChatFull
              ? "relative grid h-full min-h-0 gap-8"
              : "relative grid gap-8 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1.15fr)] sm:items-start"
          }
        >
          {/* LEFT: HOME / STATUS */}
          <section
            className={
              isChatFull ? "hidden" : "space-y-4 sm:space-y-6"
            }
          >
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-cyan-100/80">
              <span className="relative flex h-2 w-2 items-center justify-center">
                <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400/70 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-300" />
              </span>
              Quantum Link Console
            </p>

            <div className="space-y-3 sm:space-y-4">
              <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl md:text-5xl">
                Talk to anyone on Earth
                <span className="block bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-indigo-300 bg-clip-text text-transparent">
                  with a single ID.
                </span>
              </h1>
              <p className="max-w-md text-sm text-slate-300/80 sm:text-base">
                Share your quantum chat ID, send a relationship request, and
                open a secure, near-instant channel to your co-founders,
                family, investors and more.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400/90 sm:text-xs">
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/40 bg-slate-900/50 px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Live presence
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/40 bg-slate-900/50 px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                Encrypted DMs
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/40 bg-slate-900/50 px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" />
                Global handles
              </span>
            </div>

            {/* Your Quantum ID + outgoing requests */}
            <div className="mt-4 space-y-3 rounded-2xl border border-slate-600/60 bg-slate-900/70 p-3 text-xs text-slate-300">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[11px] text-slate-400">
                    Your Quantum ID
                  </span>
                  {handleError && (
                    <span className="flex items-center gap-1 text-[10px] text-amber-300">
                      <span>⚠</span>
                      <span>{handleError}</span>
                    </span>
                  )}
                </div>
                {editingHandle ? (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-[11px] text-slate-500">
                        @
                      </span>
                      <input
                        value={handleDraft}
                        onChange={(e) => onHandleDraftChange(e.target.value)}
                        className="w-36 rounded-full border border-slate-600/70 bg-slate-900/80 py-1 pl-5 pr-2 text-[11px] text-slate-100 outline-none ring-0 transition focus:border-cyan-400 focus:bg-slate-900"
                        placeholder="new-id"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={saveHandle}
                      disabled={handleSaving}
                      className="rounded-full border border-emerald-400/70 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-60"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditingHandle}
                      className="rounded-full border border-slate-600/70 bg-slate-900/60 px-2 py-0.5 text-[10px] font-medium text-slate-300 hover:bg-slate-800/80"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-cyan-300">
                      @{quantumId}
                    </span>
                    <button
                      type="button"
                      onClick={startEditingHandle}
                      className="rounded-full border border-slate-500/70 bg-slate-900/70 px-2 py-0.5 text-[10px] font-medium text-slate-200 hover:border-cyan-400/70 hover:text-cyan-200"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-400">
                  Outgoing connection requests
                </p>
                <button
                  type="button"
                  onClick={() => setMode("connect")}
                  className="rounded-full border border-cyan-400/70 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/20"
                >
                  + Connect to a friend
                </button>
              </div>

              <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {isLoadingOutgoing && (
                  <p className="text-[11px] text-slate-500">
                    Loading your outgoing links…
                  </p>
                )}
                {!isLoadingOutgoing && outgoing.length === 0 && (
                  <p className="text-[11px] text-slate-500">
                    No outgoing requests yet. Use "Connect to a friend" to
                    start.
                  </p>
                )}
                {outgoing.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-slate-900/90 px-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[11px] text-slate-200">
                        @{req.toUser?.handle || "unknown"}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">
                        {(req.categories || []).join(" · ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          req.status === "ACCEPTED"
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/40"
                            : req.status === "REJECTED"
                            ? "bg-rose-500/15 text-rose-300 border border-rose-400/40"
                            : "bg-amber-500/10 text-amber-200 border border-amber-400/40"
                        }`}
                      >
                        {req.status}
                      </span>
                      {req.status === "ACCEPTED" && req.toUser?.handle && (
                        <button
                          type="button"
                          onClick={() => openChatWithPeer(req.toUser.handle)}
                          className="inline-flex items-center rounded-full border border-cyan-400/70 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-200 hover:bg-cyan-500/20"
                        >
                          Chat
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Incoming requests */}
              <div className="mt-4 border-t border-slate-700/60 pt-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-400">
                    Incoming connection requests
                  </p>
                </div>
                {isLoadingIncoming && (
                  <p className="text-[11px] text-slate-500">
                    Loading incoming requests…
                  </p>
                )}
                {incomingError && (
                  <p className="text-[11px] text-rose-300">{incomingError}</p>
                )}
                {!isLoadingIncoming && !incomingError && incoming.length === 0 && (
                  <p className="text-[11px] text-slate-500">
                    No one has requested to connect yet.
                  </p>
                )}
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {incoming.map((req) => (
                    <div
                      key={req.id}
                      className="flex flex-col gap-1 rounded-xl bg-slate-900/90 px-2 py-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] text-slate-200">
                            @{req.fromUser?.handle || "unknown"}
                          </p>
                          <p className="truncate text-[10px] text-slate-500">
                            {(req.categories || []).join(" · ")}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            req.status === "ACCEPTED"
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/40"
                              : req.status === "REJECTED"
                              ? "bg-rose-500/15 text-rose-300 border border-rose-400/40"
                              : "bg-amber-500/10 text-amber-200 border border-amber-400/40"
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>
                      {req.message && (
                        <p className="text-[10px] text-slate-400 line-clamp-2">
                          {req.message}
                        </p>
                      )}
                      {req.status === "PENDING" && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleIncomingDecision(
                                req.id,
                                "ACCEPT",
                                req.fromUser?.handle || ""
                              )
                            }
                            className="rounded-full border border-emerald-400/70 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-200 hover:bg-emerald-500/20"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleIncomingDecision(
                                req.id,
                                "REJECT",
                                req.fromUser?.handle || ""
                              )
                            }
                            className="rounded-full border border-rose-400/70 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-medium text-rose-200 hover:bg-rose-500/20"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {req.status === "ACCEPTED" && req.fromUser?.handle && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              openChatWithPeer(req.fromUser?.handle || "")
                            }
                            className="inline-flex items-center rounded-full border border-cyan-400/70 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-medium text-cyan-200 hover:bg-cyan-500/20"
                          >
                            Chat
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT: CONNECT FLOW / CHAT */}
          <section
            className={
              isChatFull
                ? "relative flex h-full min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
                : "relative"
            }
          >
            <div className="glow-ping pointer-events-none absolute inset-0 rounded-2xl" />

            <div
              className={
                "glass-panel relative z-10 rounded-2xl border border-slate-500/60 bg-slate-900/80 shadow-xl " +
                (isChatFull
                  ? "flex-1 flex min-h-0 flex-col space-y-3 p-3"
                  : "space-y-5 p-5")
              }
            >
              {!isChatFull && (
                <>
                  <header className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
                        Session Key
                      </p>
                      <p className="mt-1 text-xs font-mono text-slate-300">
                        x-link://channel
                        <span className="text-cyan-300">/alpha</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end text-right">
                      <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                        Status
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {mode === "home" ? "Idle" : "Connecting"}
                      </span>
                    </div>
                  </header>

                  {/* Friend search form */}
                  <form onSubmit={handleSearch} className="space-y-4">
                    <label className="space-y-2 text-xs font-medium text-slate-200">
                      <span className="flex items-center justify-between gap-2">
                        <span>
                          {mode === "home"
                            ? "Search a friend by quantum ID"
                            : "Enter quantum chat ID"}
                        </span>
                        <span className="text-[10px] font-normal text-slate-400">
                          Example: @orion-9x or @yourname
                        </span>
                      </span>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">
                          @
                        </div>
                        <input
                          value={friendIdInput}
                          onChange={(e) => setFriendIdInput(e.target.value)}
                          placeholder="friend-id"
                          className="w-full rounded-xl border border-slate-600/70 bg-slate-900/80 py-2.5 pl-7 pr-24 text-sm text-slate-100 outline-none ring-0 transition focus:border-cyan-400 focus:bg-slate-900 focus:shadow-[0_0_0_1px_rgba(34,211,238,0.6)]"
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] font-mono text-slate-500">
                          x.chat
                        </span>
                      </div>
                    </label>

                    <button
                      type="submit"
                      disabled={!friendIdInput.trim() || searching}
                      className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-fuchsia-400 px-4 py-2.5 text-sm font-medium text-slate-950 shadow-[0_0_25px_rgba(56,189,248,0.65)] transition hover:shadow-[0_0_40px_rgba(56,189,248,0.85)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition group-hover:translate-x-full group-hover:opacity-100" />
                      <span className="relative flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />
                        {searching
                          ? "Scanning quantum directory…"
                          : "Connect via quantum ID"}
                      </span>
                    </button>
                  </form>

                  <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
                    <span>
                      {mode === "home"
                        ? "Next: choose relationship & send a note"
                        : "Next: username reservation & secure pairing"}
                    </span>
                    {mode === "connect" && (
                      <button
                        type="button"
                        onClick={() => setMode("home")}
                        className="text-[10px] font-medium text-cyan-300 hover:text-cyan-200"
                      >
                        Back to console
                      </button>
                    )}
                  </div>

                  {/* Messages & request state */}
                  {searchError && (
                    <p className="mt-2 text-[11px] text-rose-300">{searchError}</p>
                  )}
                  {requestSuccess && (
                    <p className="mt-2 text-[11px] text-emerald-300">
                      {requestSuccess}
                    </p>
                  )}
                  {requestError && (
                    <p className="mt-2 text-[11px] text-rose-300">{requestError}</p>
                  )}

                  {/* Found user + categories + note */}
                  {foundUser && (
                    <div className="mt-3 space-y-3 rounded-2xl border border-slate-600/70 bg-slate-900/90 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-50">
                            {foundUser.name ||
                              foundUser.email ||
                              "Unknown user"}
                          </p>
                          <p className="truncate text-xs text-cyan-300">
                            @{foundUser.handle}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                          Quantum match
                        </span>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                          Relationship categories
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {allCategories.map((cat) => {
                            const active = selectedCategories.includes(cat);
                            return (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => toggleCategory(cat)}
                                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                                  active
                                    ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-200"
                                    : "border-slate-600/70 bg-slate-900/70 text-slate-300 hover:border-cyan-400/60 hover:text-cyan-200"
                                }`}
                              >
                                {cat}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-slate-500">
                          You can select up to two categories.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                          Send a note
                        </p>
                        <textarea
                          className="min-h-[60px] w-full resize-none rounded-xl border border-slate-600/70 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none ring-0 transition focus:border-cyan-400 focus:bg-slate-950 focus:shadow-[0_0_0_1px_rgba(34,211,238,0.6)]"
                          placeholder="Tell them why you want to connect…"
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSendRequest}
                        disabled={sendingRequest}
                        className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-fuchsia-400 px-4 py-2.5 text-sm font-medium text-slate-950 shadow-[0_0_25px_rgba(56,189,248,0.65)] transition hover:shadow-[0_0_40px_rgba(56,189,248,0.85)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition group-hover:translate-x-full group-hover:opacity-100" />
                        <span className="relative flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />
                          {sendingRequest
                            ? "Sending request…"
                            : "Send quantum request"}
                        </span>
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Chat view */}
              {!foundUser && (
                <div
                  className={
                    "glass-panel flex flex-col gap-3 rounded-2xl border border-slate-600/70 bg-slate-900/80 p-4 text-xs text-slate-300 " +
                    (isChatFull ? "flex-1 mt-2" : "mt-4")
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      {activePeerHandle
                        ? `Chat with @${activePeerHandle}`
                        : "Quantum tunnel preview"}
                    </p>
                    <div className="flex items-center gap-2">
                      {chatRoomId && (
                        <span className="text-[10px] text-slate-500 hidden sm:inline">
                          room: {chatRoomId.slice(0, 8)}…
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsChatFull((v) => !v)}
                        className="rounded-full border border-slate-600/70 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-200 hover:border-cyan-400/70 hover:text-cyan-200"
                      >
                        {isChatFull ? "×" : "Full chat"}
                      </button>
                    </div>
                  </div>

                  {chatError && (
                    <p className="text-[11px] text-rose-300">{chatError}</p>
                  )}

                  <div
                    className={
                      "space-y-2 pr-1 " +
                      (isChatFull ? "" : "overflow-y-auto flex-1 max-h-60")
                    }
                  >
                    {chatLoading && (
                      <p className="text-[11px] text-slate-500">
                        Loading conversation…
                      </p>
                    )}

                    {!chatLoading && chatMessages.length === 0 && !activePeerHandle && (
                      <div className="space-y-2">
                        <div className="flex justify-start">
                          <div className="rounded-2xl rounded-bl-sm bg-slate-800/90 px-3 py-2 text-slate-100 shadow-sm">
                            <p>
                              Welcome to X-Link. Once your request is accepted,
                              this panel becomes your live chat.
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <div className="rounded-2xl rounded-br-sm bg-gradient-to-r from-cyan-400/90 to-sky-500/90 px-3 py-2 text-slate-950 shadow-[0_0_18px_rgba(56,189,248,0.7)]">
                            <p>
                              For now, start by sending a connection request
                              with your chosen categories.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {!chatLoading && chatMessages.length === 0 && activePeerHandle && (
                      <p className="text-[11px] text-slate-500">
                        No messages yet. Say hi to @{activePeerHandle}.
                      </p>
                    )}

                    {chatMessages.map((m) => {
                      const isMe = meId && m.senderId === meId;
                      return (
                        <div
                          key={m.id}
                          className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={
                              isMe
                                ? "rounded-2xl rounded-br-sm bg-gradient-to-r from-cyan-400/90 to-sky-500/90 px-3 py-2 text-slate-950 shadow-[0_0_18px_rgba(56,189,248,0.7)]"
                                : "rounded-2xl rounded-bl-sm bg-slate-800/90 px-3 py-2 text-slate-100 shadow-sm"
                            }
                          >
                            <p>{m.content}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <form
                    onSubmit={handleChatSubmit}
                    className={
                      "flex items-center gap-2 pt-1 " +
                      (isChatFull ? "sticky bottom-0 pt-2" : "")
                    }
                  >
                    <div className="relative flex-1">
                      <textarea
                        rows={1}
                        value={chatInput}
                        onChange={handleChatInputChange}
                        onKeyDown={handleChatKeyDown}
                        ref={chatInputRef}
                        disabled={!activePeerHandle}
                        className="min-h-[36px] max-h-32 w-full resize-none rounded-xl border border-slate-600/70 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-100 outline-none ring-0 transition focus:border-cyan-400 focus:bg-slate-950 focus:shadow-[0_0_0_1px_rgba(34,211,238,0.6)] sm:text-sm disabled:opacity-50"
                        placeholder={
                          activePeerHandle
                            ? `Type a message to @${activePeerHandle}…`
                            : "Accept a request to start chatting…"
                        }
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!activePeerHandle || !chatInput.trim()}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/80 bg-gradient-to-tr from-cyan-400 via-sky-400 to-fuchsia-400 text-xs font-medium text-slate-950 shadow-[0_0_14px_rgba(34,211,238,0.8)] transition hover:brightness-110 sm:h-10 sm:w-10 disabled:opacity-50"
                    >
                      <span className="send-arrow text-base leading-none text-slate-950">
                        ↑
                      </span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}