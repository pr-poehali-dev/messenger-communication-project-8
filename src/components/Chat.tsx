import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";

const API_URL = "https://functions.poehali.dev/976ea6e4-83e5-4156-8174-055bce907e79";
const POLL_INTERVAL = 2500;

interface Message {
  id: string;
  username: string;
  color: string;
  text: string;
  created_at: string;
}

interface User {
  id: string;
  username: string;
  color: string;
  session_id: string;
}

function getSessionId(): string {
  let sid = localStorage.getItem("chat_session_id");
  if (!sid) {
    sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("chat_session_id", sid);
  }
  return sid;
}

function getSavedUser(): User | null {
  try {
    const raw = localStorage.getItem("chat_user");
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function saveUser(user: User) {
  localStorage.setItem("chat_user", JSON.stringify(user));
}

function clearUser() {
  localStorage.removeItem("chat_user");
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export default function Chat() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(getSavedUser);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [username, setUsername] = useState("");
  const [onlineCount, setOnlineCount] = useState(0);
  const [unread, setUnread] = useState(0);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionId = getSessionId();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = useCallback(async (since?: string) => {
    try {
      const url = since
        ? `${API_URL}?action=messages&since=${encodeURIComponent(since)}&limit=50`
        : `${API_URL}?action=messages&limit=50`;
      const res = await fetch(url);
      if (!res.ok) return undefined;
      const data = await res.json();
      return data.messages as Message[];
    } catch (_) {
      return undefined;
    }
  }, []);

  const fetchOnline = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}?action=online`);
      if (!res.ok) return;
      const data = await res.json();
      setOnlineCount(data.count);
    } catch (_) {
      // ignore
    }
  }, []);

  // Первоначальная загрузка
  useEffect(() => {
    if (!open || !user) return;
    fetchMessages().then((msgs) => {
      if (msgs) {
        setMessages(msgs);
        if (msgs.length > 0) {
          setLastSeen(msgs[msgs.length - 1].created_at);
        }
        setTimeout(scrollToBottom, 50);
      }
    });
    fetchOnline();
  }, [open, user, fetchMessages, fetchOnline]);

  // Polling
  useEffect(() => {
    if (!open || !user) return;
    const interval = setInterval(async () => {
      const msgs = await fetchMessages(lastSeen || undefined);
      if (msgs && msgs.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMsgs = msgs.filter((m) => !existingIds.has(m.id));
          if (newMsgs.length === 0) return prev;
          setLastSeen(newMsgs[newMsgs.length - 1].created_at);
          setTimeout(scrollToBottom, 50);
          return [...prev, ...newMsgs];
        });
      }
      fetchOnline();
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [open, user, lastSeen, fetchMessages, fetchOnline]);

  // Scroll when new messages
  useEffect(() => {
    if (open) scrollToBottom();
  }, [messages, open]);

  // Reset unread on open
  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  // Focus input on open
  useEffect(() => {
    if (open && user) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open, user]);

  const handleJoin = async () => {
    const name = username.trim() || undefined;
    setJoining(true);
    try {
      const res = await fetch(`${API_URL}?action=join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Id": sessionId },
        body: JSON.stringify({ username: name }),
      });
      if (!res.ok) throw new Error("Join failed");
      const data = await res.json();
      setUser(data.user);
      saveUser(data.user);
    } catch (_) {
      // ignore
    } finally {
      setJoining(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !user || loading) return;
    setInput("");
    setLoading(true);

    const optimistic: Message = {
      id: `opt_${Date.now()}`,
      username: user.username,
      color: user.color,
      text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(scrollToBottom, 50);

    try {
      const res = await fetch(`${API_URL}?action=send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Id": sessionId },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? data.message : m))
        );
        setLastSeen(data.message.created_at);
      }
    } catch (_) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gold flex items-center justify-center shadow-lg hover:scale-110 transition-all duration-300 hover:bg-gold-light"
        style={{ boxShadow: "0 0 24px rgba(201,168,76,0.4)" }}
        aria-label="Открыть чат"
      >
        {open ? (
          <Icon name="X" size={22} color="#0A0A0B" />
        ) : (
          <Icon name="MessageCircle" size={22} color="#0A0A0B" />
        )}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 flex flex-col rounded-xl overflow-hidden border border-white/10"
          style={{
            background: "rgba(14,14,16,0.97)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,168,76,0.1)",
            height: "480px",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white/80 text-sm font-medium tracking-wide">Общий чат</span>
              {onlineCount > 0 && (
                <span className="text-white/30 text-xs">{onlineCount} онлайн</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <button
                  onClick={() => { clearUser(); setUser(null); setMessages([]); setLastSeen(null); }}
                  className="text-white/25 hover:text-white/60 transition-colors text-xs"
                  title="Выйти из чата"
                >
                  <Icon name="LogOut" size={14} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-white/30 hover:text-white/70 transition-colors"
              >
                <Icon name="X" size={16} />
              </button>
            </div>
          </div>

          {/* Join form */}
          {!user ? (
            <div className="flex flex-col items-center justify-center flex-1 px-6 gap-4">
              <div className="text-center">
                <div className="text-gold font-cormorant text-2xl mb-1">Войти в чат</div>
                <div className="text-white/40 text-xs">Введите имя или оставьте пустым</div>
              </div>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white/80 text-sm placeholder:text-white/25 outline-none focus:border-gold/50 transition-colors"
                placeholder="Ваше имя..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                maxLength={30}
              />
              <button
                onClick={handleJoin}
                disabled={joining}
                className="w-full py-2.5 bg-gold text-[#0A0A0B] rounded-lg text-sm font-medium tracking-wide hover:bg-gold/90 transition-colors disabled:opacity-50"
              >
                {joining ? "Входим..." : "Войти"}
              </button>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-white/20 text-sm gap-2">
                    <Icon name="MessageCircle" size={32} />
                    <span>Пока нет сообщений</span>
                    <span className="text-xs">Будьте первым!</span>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.username === user.username && msg.color === user.color;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                      >
                        {!isMe && (
                          <span className="text-xs mb-0.5 ml-1" style={{ color: msg.color }}>
                            {msg.username}
                          </span>
                        )}
                        <div
                          className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                            isMe ? "rounded-br-sm text-[#0A0A0B] font-medium" : "rounded-bl-sm text-white/85"
                          }`}
                          style={
                            isMe
                              ? { background: user.color }
                              : { background: "rgba(255,255,255,0.07)" }
                          }
                        >
                          {msg.text}
                        </div>
                        <span className="text-white/20 text-[10px] mt-0.5 mx-1">
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="flex items-center gap-2 px-3 py-3 border-t border-white/8 flex-shrink-0">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: user.color }}
                />
                <input
                  ref={inputRef}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/80 text-sm placeholder:text-white/25 outline-none focus:border-gold/40 transition-colors min-w-0"
                  placeholder="Написать сообщение..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={1000}
                  disabled={loading}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 disabled:opacity-30"
                  style={{ background: input.trim() ? "#C9A84C" : "rgba(255,255,255,0.05)" }}
                >
                  <Icon
                    name="Send"
                    size={15}
                    color={input.trim() ? "#0A0A0B" : "#ffffff"}
                  />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}