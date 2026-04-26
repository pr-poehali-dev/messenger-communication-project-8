import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";

const API_URL = "https://functions.poehali.dev/976ea6e4-83e5-4156-8174-055bce907e79";
const POLL_INTERVAL = 800;
const POLL_INTERVAL_BG = 5000;

interface Message {
  id: string;
  username: string;
  color: string;
  text: string;
  created_at: string;
}

interface DmMessage {
  id: string;
  sender_id: string;
  sender_username: string;
  sender_color: string;
  text: string;
  created_at: string;
  read_at: string | null;
  is_mine: boolean;
}

interface User {
  id: string;
  username: string;
  color: string;
  session_id: string;
}

interface OnlineUser {
  id: string;
  username: string;
  color: string;
  last_seen: string;
}

interface Conversation {
  id: string;
  my_id: string;
  my_username: string;
  my_color: string;
  target_id: string;
  target_username: string;
  target_color: string;
  created_at: string;
}

function getSessionId(): string {
  return localStorage.getItem("chat_session_id") || "";
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

type SoundType = "pop" | "bell" | "chime" | "soft";

const SOUND_OPTIONS: { value: SoundType; label: string }[] = [
  { value: "pop", label: "Поп" },
  { value: "bell", label: "Колокол" },
  { value: "chime", label: "Перезвон" },
  { value: "soft", label: "Мягкий" },
];

function playNotificationSound(type: SoundType = "pop") {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "pop") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === "bell") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(1047, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } else if (type === "chime") {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(1320, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1760, ctx.currentTime + 0.15);
      gain2.gain.setValueAtTime(0.001, ctx.currentTime);
      gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.45);
    } else if (type === "soft") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    }
  } catch { /* ignore */ }
}

function sendPushNotification(title: string, body: string) {
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico", silent: true });
  }
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

const teamMembers = [
  { name: "Алексей Громов", role: "CEO & Co-founder", avatar: "AG", color: "#C9A84C" },
  { name: "Мария Волкова", role: "Head of Product", avatar: "МВ", color: "#7C9EF0" },
  { name: "Дмитрий Лебедев", role: "Lead Engineer", avatar: "ДЛ", color: "#6EE7B7" },
  { name: "Анна Соколова", role: "Design Director", avatar: "АС", color: "#F472B6" },
];

const achievements = [
  { num: "12K+", label: "Активных пользователей" },
  { num: "98%", label: "Удовлетворённость клиентов" },
  { num: "3.2M", label: "Сообщений в день" },
  { num: "99.9%", label: "Uptime" },
];

function getCachedUser(): User | null {
  try {
    const raw = localStorage.getItem("chat_cached_user");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setCachedUser(u: User | null) {
  if (u) localStorage.setItem("chat_cached_user", JSON.stringify(u));
  else localStorage.removeItem("chat_cached_user");
}

export default function Okeo() {
  const [visible, setVisible] = useState(false);
  const [user, setUser] = useState<User | null>(() => {
    const sid = localStorage.getItem("chat_session_id");
    if (!sid || !sid.startsWith("auth_")) return null;
    return getCachedUser();
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authError, setAuthError] = useState("");
  const [onlineCount, setOnlineCount] = useState(0);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  // Typing
  const [typingUsers, setTypingUsers] = useState<{username: string; color: string; room: string}[]>([]);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Личные чаты
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [dmMessages, setDmMessages] = useState<DmMessage[]>([]);
  const [dmInput, setDmInput] = useState("");
  const [dmLoading, setDmLoading] = useState(false);
  const [dmLastSeen, setDmLastSeen] = useState<string | null>(null);
  const [dmUnread, setDmUnread] = useState(0);
  const [openingDm, setOpeningDm] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("chat_sound") !== "off");
  const [soundType, setSoundType] = useState<SoundType>(() => (localStorage.getItem("chat_sound_type") as SoundType) || "pop");
  const [showSoundMenu, setShowSoundMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dmMessagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dmInputRef = useRef<HTMLInputElement>(null);
  const sessionId = getSessionId();

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!showSoundMenu) return;
    const handler = () => setShowSoundMenu(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showSoundMenu]);

  // Автовосстановление сессии — с прогревом и retry
  useEffect(() => {
    const sid = localStorage.getItem("chat_session_id");
    if (!sid || !sid.startsWith("auth_")) return;
    let cancelled = false;
    const restore = async () => {
      // Прогрев функции лёгким запросом
      try { await fetch(`${API_URL}?action=online`); } catch { /* ignore */ }
      const delays = [500, 1000, 2000, 3000, 5000];
      for (let i = 0; i < 10; i++) {
        if (cancelled) return;
        try {
          const res = await fetch(`${API_URL}?action=join&sid=${encodeURIComponent(sid)}`);
          if (cancelled) return;
          if (res.ok) {
            const data = await res.json();
            if (data.user) { setUser(data.user); setCachedUser(data.user); }
          } else {
            setCachedUser(null);
            setUser(null);
          }
          return;
        } catch {
          const delay = delays[Math.min(i, delays.length - 1)];
          if (i < 9) await new Promise((r) => setTimeout(r, delay));
        }
      }
    };
    restore();
    return () => { cancelled = true; };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollDmToBottom = () => {
    dmMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
    } catch {
      return undefined;
    }
  }, []);



  const fetchDmMessages = useCallback(async (convId: string, since?: string) => {
    try {
      const url = since
        ? `${API_URL}?action=dm_messages&conv_id=${encodeURIComponent(convId)}&since=${encodeURIComponent(since)}&limit=50&sid=${encodeURIComponent(sessionId)}`
        : `${API_URL}?action=dm_messages&conv_id=${encodeURIComponent(convId)}&limit=50&sid=${encodeURIComponent(sessionId)}`;
      const res = await fetch(url);
      if (!res.ok) return undefined;
      const data = await res.json();
      return data.messages as DmMessage[];
    } catch {
      return undefined;
    }
  }, [sessionId]);

  // Начальная загрузка публичных сообщений
  useEffect(() => {
    if (!user) return;
    fetchMessages().then((msgs) => {
      if (msgs) {
        setMessages(msgs);
        if (msgs.length > 0) setLastSeen(msgs[msgs.length - 1].created_at);
        setTimeout(scrollToBottom, 50);
      }
    });
  }, [user, fetchMessages]);

  // Единый поллинг — один запрос вместо 4-5
  useEffect(() => {
    if (!user) return;
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const doPoll = async () => {
      if (!active) return;
      try {
        const params = new URLSearchParams();
        params.set("action", "poll");
        if (lastSeen) params.set("since", lastSeen);
        if (activeConv) {
          params.set("conv_id", activeConv.id);
          if (dmLastSeen) params.set("dm_since", dmLastSeen);
        }
        if (sessionId) params.set("sid", sessionId);

        const res = await fetch(`${API_URL}?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();

        // Публичные сообщения
        if (data.messages?.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m: Message) => m.id));
            const newMsgs = data.messages.filter((m: Message) => !existingIds.has(m.id));
            if (newMsgs.length === 0) return prev;
            setLastSeen(newMsgs[newMsgs.length - 1].created_at);
            setTimeout(scrollToBottom, 50);
            if (document.hidden) {
              if (soundEnabled) playNotificationSound(soundType);
              const last = newMsgs[newMsgs.length - 1];
              sendPushNotification("Общий чат", `${last.username}: ${last.text}`);
            }
            return [...prev, ...newMsgs];
          });
        }

        // Онлайн
        if (data.users) setOnlineUsers(data.users);
        if (typeof data.online === "number") setOnlineCount(data.online);
        if (typeof data.dm_unread === "number") setDmUnread(data.dm_unread);
        if (data.typing_users) setTypingUsers(data.typing_users);

        // DM сообщения
        if (data.dm_messages?.length > 0) {
          setDmMessages((prev) => {
            const existingIds = new Set(prev.map((m: DmMessage) => m.id));
            const newMsgs = data.dm_messages.filter((m: DmMessage) => !existingIds.has(m.id));
            if (newMsgs.length === 0) return prev;
            setDmLastSeen(newMsgs[newMsgs.length - 1].created_at);
            setTimeout(scrollDmToBottom, 50);
            const incoming = newMsgs.filter((m: DmMessage) => !m.is_mine);
            if (incoming.length > 0 && document.hidden) {
              if (soundEnabled) playNotificationSound(soundType);
              const last = incoming[incoming.length - 1];
              sendPushNotification(`Личное сообщение от ${last.sender_username}`, last.text);
            }
            return [...prev, ...newMsgs];
          });
        }
      } catch { /* ignore */ }

      if (active) {
        const interval = document.hidden ? POLL_INTERVAL_BG : POLL_INTERVAL;
        timeoutId = setTimeout(doPoll, interval);
      }
    };

    timeoutId = setTimeout(doPoll, POLL_INTERVAL);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [user, lastSeen, activeConv, dmLastSeen, sessionId, soundEnabled, soundType]);

  // Загрузка DM при открытии диалога
  useEffect(() => {
    if (!activeConv) return;
    fetchDmMessages(activeConv.id).then((msgs) => {
      if (msgs) {
        setDmMessages(msgs);
        if (msgs.length > 0) setDmLastSeen(msgs[msgs.length - 1].created_at);
        setTimeout(scrollDmToBottom, 50);
      }
    });
    setTimeout(() => dmInputRef.current?.focus(), 100);
  }, [activeConv, fetchDmMessages]);

  useEffect(() => {
    if (user) setTimeout(() => inputRef.current?.focus(), 100);
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem("chat_session_id");
    localStorage.removeItem("chat_cached_user");
    setUser(null);
    setMessages([]);
    setUsername("");
    setPassword("");
    setAuthError("");
    setAuthMode("login");
  };

  const handleAuth = async () => {
    const name = username.trim();
    const pwd = password.trim();
    if (!name) { setAuthError("Введите имя пользователя"); return; }
    if (!pwd) { setAuthError("Введите пароль"); return; }
    setAuthError("");
    setJoining(true);

    // Прогрев функции перед входом
    try { await fetch(`${API_URL}?action=online`); } catch { /* ignore */ }

    const delays = [0, 800, 1500, 2500, 4000];
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) {
        setAuthError(`Подключаюсь... (попытка ${attempt + 1}/5)`);
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
      try {
        const params = new URLSearchParams({ action: authMode, username: name, password: pwd });
        const res = await fetch(`${API_URL}?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          setAuthError(data.error || "Ошибка входа");
          setJoining(false);
          return;
        }
        localStorage.setItem("chat_session_id", data.session_id);
        setCachedUser(data.user);
        setUser(data.user);
        requestNotificationPermission();
        setJoining(false);
        return;
      } catch {
        // продолжаем retry
      }
    }
    setAuthError("Не удалось подключиться. Проверьте интернет и попробуйте снова.");
    setJoining(false);
  };

  const sendTyping = (room: string) => {
    if (!sessionId) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    fetch(`${API_URL}?action=typing&sid=${encodeURIComponent(sessionId)}`, {
      method: "POST",
      body: new URLSearchParams({ room }),
    }).catch(() => {});
    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
    }, 3000);
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
      const res = await fetch(`${API_URL}?action=send&sid=${encodeURIComponent(sessionId)}`, {
        method: "POST",
        body: new URLSearchParams({ text }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? data.message : m))
        );
        setLastSeen(data.message.created_at);
      }
    } catch {
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

  const handleOpenDm = async (targetUser: OnlineUser) => {
    if (!user || openingDm) return;
    setOpeningDm(true);
    try {
      const res = await fetch(`${API_URL}?action=dm_open&sid=${encodeURIComponent(sessionId)}`, {
        method: "POST",
        body: new URLSearchParams({ target_user_id: targetUser.id }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setActiveConv(data.conversation);
      setDmMessages([]);
      setDmLastSeen(null);
    } catch {
      // ignore
    } finally {
      setOpeningDm(false);
    }
  };

  const handleDmSend = async () => {
    const text = dmInput.trim();
    if (!text || !activeConv || dmLoading) return;
    setDmInput("");
    setDmLoading(true);

    const optimistic: DmMessage = {
      id: `opt_${Date.now()}`,
      sender_id: user?.id || "",
      sender_username: user?.username || "",
      sender_color: user?.color || "",
      text,
      created_at: new Date().toISOString(),
      read_at: null,
      is_mine: true,
    };
    setDmMessages((prev) => [...prev, optimistic]);
    setTimeout(scrollDmToBottom, 50);

    try {
      const res = await fetch(`${API_URL}?action=dm_send&sid=${encodeURIComponent(sessionId)}`, {
        method: "POST",
        body: new URLSearchParams({ conv_id: activeConv.id, text }),
      });
      if (res.ok) {
        const data = await res.json();
        setDmMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? data.message : m))
        );
        setDmLastSeen(data.message.created_at);
      }
    } catch {
      // ignore
    } finally {
      setDmLoading(false);
    }
  };

  const handleDmKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleDmSend();
    }
  };

  const otherOnlineUsers = user
    ? onlineUsers.filter((u) => u.id !== user.id)
    : onlineUsers;

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white font-ibm overflow-x-hidden">
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-purple-600/8 blur-[140px] animate-glow-pulse" />
        <div className="absolute bottom-[20%] right-[-5%] w-[400px] h-[400px] rounded-full bg-purple-600/5 blur-[100px] animate-glow-pulse" style={{ animationDelay: "1.5s" }} />
        <div className="absolute top-[40%] left-[-5%] w-[300px] h-[300px] rounded-full bg-blue-500/5 blur-[100px]" />
      </div>

      {/* NAV */}
      <header
        className="relative z-20 flex items-center justify-between px-8 py-5 border-b border-white/5"
        style={{ opacity: visible ? 1 : 0, transition: "opacity 0.6s ease" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-400/30 flex items-center justify-center">
            <Icon name="MessageSquare" size={15} color="#a78bfa" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">
            Orbit<span className="text-purple-400">.</span>
          </span>
          <span className="hidden sm:block text-white/20 text-xs tracking-widest uppercase font-light">Мессенджер</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-white/40 tracking-wide">
          <a href="#features" className="hover:text-purple-400 transition-colors duration-300">Возможности</a>
          <a href="#team" className="hover:text-purple-400 transition-colors duration-300">Команда</a>
          <a href="#messenger" className="hover:text-purple-400 transition-colors duration-300">Чат</a>
        </nav>
        <div className="flex items-center gap-3">
          {onlineCount > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-white/35">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              {onlineCount} онлайн
            </div>
          )}
          <a
            href="#messenger"
            className="px-4 py-2 border border-purple-400/40 text-purple-400 text-xs tracking-widest uppercase hover:bg-purple-500/10 transition-all duration-300 rounded-sm"
          >
            Открыть чат
          </a>
        </div>
      </header>

      {/* HERO */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 pt-20 pb-16 grid lg:grid-cols-2 gap-16 items-center">
        {/* Left: text */}
        <div>
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-purple-400/25 bg-purple-500/5 mb-8 text-xs text-purple-400/70 tracking-widest uppercase"
            style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(12px)", transition: "all 0.6s ease 0.1s" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse inline-block" />
            Корпоративный мессенджер нового поколения
          </div>

          <h1
            className="font-cormorant font-semibold text-[clamp(2.8rem,6vw,5.5rem)] leading-[0.95] tracking-tight"
            style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transition: "all 0.9s ease 0.2s" }}
          >
            <span className="text-white">Общение</span>
            <br />
            <span
              style={{
                background: "linear-gradient(90deg, #a78bfa 0%, #c4b5fd 40%, #a78bfa 70%, #7c3aed 100%)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                animation: "shimmer 3s linear infinite",
              }}
            >
              без границ
            </span>
          </h1>

          <p
            className="mt-6 text-white/40 text-base font-light leading-relaxed max-w-md tracking-wide"
            style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(16px)", transition: "all 0.9s ease 0.4s" }}
          >
            Orbit — защищённая платформа для командной работы. Мгновенный обмен сообщениями, голосовые каналы и интеграции в одном месте.
          </p>

          <div
            className="mt-10 flex flex-wrap gap-3"
            style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(16px)", transition: "all 0.9s ease 0.55s" }}
          >
            <a
              href="#messenger"
              className="group relative px-7 py-3.5 bg-purple-500 text-white font-medium text-sm tracking-widest uppercase rounded-sm overflow-hidden hover:scale-105 transition-transform duration-300 inline-flex items-center gap-2"
            >
              <Icon name="MessageCircle" size={15} />
              Попробовать сейчас
            </a>
            <a
              href="#features"
              className="px-7 py-3.5 border border-white/10 text-white/50 text-sm hover:border-white/25 hover:text-white/80 transition-all duration-300 rounded-sm inline-flex items-center gap-2"
            >
              <Icon name="Play" size={14} />
              Узнать больше
            </a>
          </div>

          {/* Stats row */}
          <div
            className="mt-12 flex flex-wrap gap-8"
            style={{ opacity: visible ? 1 : 0, transition: "opacity 0.9s ease 0.75s" }}
          >
            {achievements.map((a) => (
              <div key={a.num}>
                <div className="text-purple-400 font-cormorant text-2xl font-semibold">{a.num}</div>
                <div className="text-white/30 text-xs mt-0.5 tracking-wide">{a.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: decorative preview */}
        <div
          className="hidden lg:block relative"
          style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0) scale(1)" : "translateY(30px) scale(0.97)", transition: "all 1s ease 0.5s" }}
        >
          <div
            className="rounded-2xl border border-white/8 overflow-hidden"
            style={{ background: "rgba(14,14,16,0.9)", backdropFilter: "blur(20px)", boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.12)" }}
          >
            {/* Mock window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
              <span className="ml-3 text-white/20 text-xs tracking-wide">Orbit — Общий канал</span>
            </div>
            <div className="flex h-56">
              {/* Sidebar mock */}
              <div className="w-44 border-r border-white/6 p-3 flex flex-col gap-1">
                <div className="text-white/20 text-xs px-2 py-1 tracking-widest uppercase mb-1">Каналы</div>
                {["# общий", "# разработка", "# дизайн", "# маркетинг"].map((ch, i) => (
                  <div key={ch} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${i === 0 ? "bg-purple-500/10 text-purple-400/80" : "text-white/30 hover:text-white/50"}`}>
                    <span>{ch}</span>
                  </div>
                ))}
                <div className="mt-2 text-white/20 text-xs px-2 py-1 tracking-widest uppercase">Личные</div>
                {teamMembers.slice(0, 2).map((m) => (
                  <div key={m.name} className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-white/30">
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                    <span>{m.name.split(" ")[0]}</span>
                  </div>
                ))}
              </div>
              {/* Messages mock */}
              <div className="flex-1 p-4 flex flex-col gap-3 overflow-hidden">
                {[
                  { u: "АГ", c: "#C9A84C", t: "Всем привет! Готовы к презентации?" },
                  { u: "МВ", c: "#7C9EF0", t: "Да, слайды готовы 🚀" },
                  { u: "ДЛ", c: "#6EE7B7", t: "Деплой прошёл успешно" },
                ].map((m, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-[#0A0A0B]" style={{ background: m.c }}>{m.u}</div>
                    <div className="bg-white/4 rounded px-2.5 py-1.5 text-xs text-white/60 max-w-[160px]">{m.t}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Input mock */}
            <div className="px-3 py-2.5 border-t border-white/6">
              <div className="flex items-center gap-2 bg-white/4 border border-white/8 rounded-lg px-3 py-1.5">
                <span className="text-white/20 text-xs flex-1">Написать сообщение...</span>
                <Icon name="Send" size={11} color="#a78bfa" />
              </div>
            </div>
          </div>
          {/* Online badge */}
          <div
            className="absolute -top-4 -right-4 flex items-center gap-2 px-3 py-2 rounded-full border border-green-500/20 bg-green-500/5"
            style={{ backdropFilter: "blur(10px)" }}
          >
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400/80 text-xs font-medium">{onlineCount > 0 ? `${onlineCount} в сети` : "Live"}</span>
          </div>
        </div>
      </section>

      {/* DIVIDER */}
      <div className="relative z-10 flex items-center gap-6 px-8 max-w-7xl mx-auto mb-20">
        <div className="flex-1 h-px bg-white/5" />
        <span className="text-white/15 text-xs tracking-[0.3em] uppercase">Возможности</span>
        <div className="flex-1 h-px bg-white/5" />
      </div>

      {/* FEATURES */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-8 mb-24">
        <div className="grid md:grid-cols-3 gap-px bg-white/5 rounded-sm overflow-hidden">
          {[
            { icon: "Shield", title: "Сквозное шифрование", desc: "Все сообщения защищены end-to-end шифрованием. Никто, кроме участников, не может прочитать переписку." },
            { icon: "Zap", title: "Мгновенная доставка", desc: "Сообщения доставляются за миллисекунды. Real-time синхронизация на всех устройствах." },
            { icon: "Users", title: "Командные каналы", desc: "Организуйте работу по проектам, отделам или задачам. Гибкая система ролей и прав доступа." },
            { icon: "Bell", title: "Умные уведомления", desc: "Настраивайте уведомления под свой ритм работы. Не пропустите важное, отфильтруйте лишнее." },
            { icon: "Paperclip", title: "Файлы и медиа", desc: "Отправляйте файлы любого формата до 2 ГБ. Предпросмотр прямо в чате без скачивания." },
            { icon: "Plug", title: "Интеграции", desc: "Подключите Jira, GitHub, Figma и 50+ сервисов. Все уведомления в одном месте." },
          ].map((f, i) => (
            <div
              key={f.title}
              className="bg-[#0A0A0B] p-8 group hover:bg-white/[0.02] transition-all duration-500 relative overflow-hidden"
              style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transition: `all 0.7s ease ${0.1 * i + 0.3}s` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 via-purple-500/0 to-purple-500/0 group-hover:from-purple-500/5 transition-all duration-700" />
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-400/20 flex items-center justify-center mb-5 group-hover:bg-purple-500/20 transition-colors duration-300">
                <Icon name={f.icon} size={18} color="#a78bfa" />
              </div>
              <h3 className="text-white/85 font-medium text-base mb-2 tracking-wide">{f.title}</h3>
              <p className="text-white/35 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TEAM */}
      <section id="team" className="relative z-10 max-w-7xl mx-auto px-8 mb-24">
        <div className="mb-12 text-center">
          <h2 className="font-cormorant text-[clamp(2rem,4vw,3.2rem)] font-light text-white/90">
            Команда <em className="text-purple-400 not-italic">ОКЕО</em>
          </h2>
          <p className="mt-3 text-white/35 text-sm max-w-md mx-auto">Опытные специалисты, создающие будущее корпоративных коммуникаций</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {teamMembers.map((m, i) => (
            <div
              key={m.name}
              className="relative p-6 rounded-xl border border-white/6 bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.04] transition-all duration-500 group"
              style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(16px)", transition: `all 0.6s ease ${0.1 * i + 0.2}s` }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-[#0A0A0B] font-bold text-lg mb-4 group-hover:scale-105 transition-transform duration-300"
                style={{ background: m.color }}
              >
                {m.avatar}
              </div>
              <div className="text-white/80 font-medium text-sm tracking-wide">{m.name}</div>
              <div className="text-white/30 text-xs mt-1">{m.role}</div>
              <div className="absolute top-4 right-4 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 opacity-60" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DIVIDER */}
      <div className="relative z-10 flex items-center gap-6 px-8 max-w-7xl mx-auto mb-12">
        <div className="flex-1 h-px bg-white/5" />
        <span className="text-white/15 text-xs tracking-[0.3em] uppercase">Живой чат</span>
        <div className="flex-1 h-px bg-white/5" />
      </div>

      {/* MESSENGER SECTION */}
      <section id="messenger" className="relative z-10 max-w-7xl mx-auto px-8 pb-24">
        <div className="grid lg:grid-cols-7 gap-8 items-start">
          {/* Left: description */}
          <div className="lg:col-span-2 lg:sticky lg:top-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-400/20 bg-purple-500/5 mb-6 text-xs text-purple-400/60 tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse inline-block" />
              Real-time
            </div>
            <h2 className="font-cormorant text-[clamp(2rem,4vw,3rem)] font-light text-white/90 leading-tight mb-4">
              Общайтесь<br />
              <em className="text-purple-400 not-italic">прямо сейчас</em>
            </h2>
            <p className="text-white/35 text-sm leading-relaxed mb-8">
              Попробуйте мессенджер Orbit вживую. Присоединяйтесь к общему каналу или напишите кому-нибудь лично.
            </p>
            <div className="space-y-4">
              {[
                { icon: "MessageCircle", text: "Мгновенная доставка сообщений" },
                { icon: "Lock", text: "Личные чаты один на один" },
                { icon: "Users", text: "Видите кто онлайн прямо сейчас" },
                { icon: "Shield", text: "Сессия сохраняется автоматически" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3 text-white/40 text-sm">
                  <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                    <Icon name={item.icon} size={12} color="#a78bfa" />
                  </div>
                  {item.text}
                </div>
              ))}
            </div>
            {onlineCount > 0 && (
              <div className="mt-8 inline-flex items-center gap-2 text-green-400/70 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                {onlineCount} {onlineCount === 1 ? "человек" : "человек"} онлайн
              </div>
            )}

            {/* Online users list (shown when logged in) */}
            {user && otherOnlineUsers.length > 0 && (
              <div className="mt-8">
                <div className="text-white/25 text-xs tracking-widest uppercase mb-3">Онлайн сейчас</div>
                <div className="space-y-2">
                  {otherOnlineUsers.slice(0, 8).map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleOpenDm(u)}
                      disabled={openingDm}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/6 bg-white/[0.02] hover:bg-purple-500/5 hover:border-purple-400/20 transition-all duration-200 group text-left"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-[#0A0A0B]"
                        style={{ background: u.color }}
                      >
                        {u.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white/70 text-xs font-medium truncate group-hover:text-white/90 transition-colors">{u.username}</div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        <Icon name="MessageSquare" size={11} color="#a78bfa" className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: actual messenger */}
          <div className="lg:col-span-5">
            <div
              className="rounded-2xl border border-white/8 overflow-hidden flex flex-col"
              style={{
                background: "rgba(14,14,16,0.95)",
                backdropFilter: "blur(20px)",
                boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.10)",
                height: "600px",
              }}
            >
              {/* Join form */}
              {!user ? (
                <>
                  {/* Header for join */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/6 flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gold/15 border border-gold/20 flex items-center justify-center">
                        <Icon name="Hash" size={14} color="#a78bfa" />
                      </div>
                      <div>
                        <div className="text-white/80 text-sm font-medium tracking-wide">общий</div>
                        <div className="text-white/25 text-xs">
                          {onlineCount > 0 ? `${onlineCount} участников онлайн` : "Публичный канал"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-white/25 text-xs ml-1">Live</span>
                    </div>
                  </div>
                  <div
                    className="flex flex-col items-center justify-center flex-1 px-8 gap-5 relative overflow-hidden"
                    style={{
                      backgroundImage: "url(https://cdn.poehali.dev/projects/d89b477e-65e2-4acd-811f-8c4871d901ea/bucket/a3de9951-0609-4cf5-a66d-e388039052c2.png)",
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="relative z-10 text-center">
                      <div className="flex items-center justify-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/30 border border-purple-400/40 flex items-center justify-center">
                          <Icon name="MessageSquare" size={15} color="#a78bfa" />
                        </div>
                        <span className="text-white font-bold text-2xl tracking-tight">
                          Orbit<span className="text-purple-400">.</span>
                        </span>
                      </div>
                      <div className="text-white/90 font-semibold text-lg mb-1">
                        {authMode === "login" ? "Вход в аккаунт" : "Регистрация"}
                      </div>
                      <div className="text-white/40 text-sm">
                        {authMode === "login" ? "Введите логин и пароль" : "Придумайте логин и пароль"}
                      </div>
                    </div>
                    <div className="relative z-10 w-full max-w-sm space-y-3">
                      {/* Поле логина */}
                      <div className="relative">
                        <input
                          className={`w-full border rounded-xl px-4 py-3 pr-10 text-white placeholder:text-white/30 text-sm outline-none transition-all duration-200 ${
                            username.length >= 2
                              ? "border-purple-400/60 bg-purple-500/20"
                              : username.length > 0
                              ? "border-white/20 bg-white/10"
                              : "border-white/10 bg-white/8"
                          }`}
                          placeholder="Имя пользователя"
                          value={username}
                          onChange={(e) => { setUsername(e.target.value); setAuthError(""); }}
                          onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                          maxLength={50}
                          autoComplete="username"
                        />
                        {username.length >= 2 && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Icon name="Check" size={14} color="#a78bfa" />
                          </div>
                        )}
                        {username.length > 0 && username.length < 2 && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-[10px]">
                            ещё {2 - username.length}
                          </div>
                        )}
                      </div>

                      {/* Поле пароля */}
                      <div className="relative">
                        <input
                          type="password"
                          className={`w-full border rounded-xl px-4 py-3 pr-10 text-white placeholder:text-white/30 text-sm outline-none transition-all duration-200 ${
                            password.length >= 4
                              ? "border-purple-400/60 bg-purple-500/20"
                              : password.length > 0
                              ? "border-white/20 bg-white/10"
                              : "border-white/10 bg-white/8"
                          }`}
                          placeholder="Пароль"
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setAuthError(""); }}
                          onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                          maxLength={100}
                          autoComplete={authMode === "login" ? "current-password" : "new-password"}
                        />
                        {password.length >= 4 && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Icon name="Check" size={14} color="#a78bfa" />
                          </div>
                        )}
                        {authMode === "register" && password.length > 0 && password.length < 4 && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-[10px]">
                            ещё {4 - password.length}
                          </div>
                        )}
                      </div>

                      {authError && (
                        <div className="text-red-300/90 text-xs text-center px-2">{authError}</div>
                      )}
                      <button
                        onClick={handleAuth}
                        disabled={joining || username.length < 2 || password.length < (authMode === "register" ? 4 : 1)}
                        className="w-full py-3 text-sm tracking-widest uppercase rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium"
                        style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9, #5b21b6)", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}
                      >
                        {joining ? (
                          <Icon name="Loader2" size={14} color="white" className="animate-spin" />
                        ) : (
                          <Icon name="LogIn" size={14} color="white" />
                        )}
                        {joining ? "Загрузка..." : authMode === "login" ? "Войти" : "Зарегистрироваться"}
                      </button>
                      <button
                        onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); }}
                        className="w-full text-purple-300/60 text-xs hover:text-purple-200 transition-colors py-1"
                      >
                        {authMode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Two-column layout: public | dm */}
                  <div className="flex flex-1 min-h-0">

                    {/* ── LEFT: PUBLIC CHAT ── */}
                    <div className="flex flex-col flex-1 min-w-0 border-r border-white/8">
                      {/* Public header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-white/6 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center">
                            <Icon name="Hash" size={12} color="#a78bfa" />
                          </div>
                          <span className="text-white/70 text-sm font-medium">Общий</span>
                          {onlineCount > 0 && (
                            <span className="text-white/25 text-xs">{onlineCount} онлайн</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="relative">
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowSoundMenu((v) => !v); }}
                              title="Настройки звука"
                              className="p-1.5 text-white/20 hover:text-white/60 transition-colors rounded-md"
                            >
                              <Icon name={soundEnabled ? "Volume2" : "VolumeX"} size={12} />
                            </button>
                            {showSoundMenu && (
                              <div
                                className="absolute right-0 top-7 z-50 rounded-lg border border-white/10 overflow-hidden"
                                style={{ background: "rgba(18,18,22,0.98)", backdropFilter: "blur(12px)", minWidth: 160 }}
                              >
                                <div className="px-3 py-2 border-b border-white/8">
                                  <button
                                    onClick={() => {
                                      const next = !soundEnabled;
                                      setSoundEnabled(next);
                                      localStorage.setItem("chat_sound", next ? "on" : "off");
                                    }}
                                    className="flex items-center gap-2 w-full text-left text-xs text-white/60 hover:text-white/90 transition-colors"
                                  >
                                    <Icon name={soundEnabled ? "Volume2" : "VolumeX"} size={12} />
                                    {soundEnabled ? "Выключить звук" : "Включить звук"}
                                  </button>
                                </div>
                                <div className="py-1">
                                  {SOUND_OPTIONS.map((opt) => (
                                    <button
                                      key={opt.value}
                                      onClick={() => {
                                        setSoundType(opt.value);
                                        localStorage.setItem("chat_sound_type", opt.value);
                                        setSoundEnabled(true);
                                        localStorage.setItem("chat_sound", "on");
                                        playNotificationSound(opt.value);
                                        setShowSoundMenu(false);
                                      }}
                                      className={`flex items-center justify-between w-full px-3 py-1.5 text-xs transition-colors ${
                                        soundType === opt.value
                                          ? "text-gold bg-gold/10"
                                          : "text-white/50 hover:text-white/80 hover:bg-white/5"
                                      }`}
                                    >
                                      {opt.label}
                                      {soundType === opt.value && <Icon name="Check" size={10} />}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={handleLogout}
                            title="Выйти"
                            className="p-1.5 text-white/20 hover:text-red-400/70 transition-colors rounded-md hover:bg-red-400/10"
                          >
                            <Icon name="LogOut" size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Public messages */}
                      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin">
                        {messages.length === 0 && (
                          <div className="flex flex-col items-center justify-center h-full text-white/20 text-sm gap-2">
                            <Icon name="MessageSquare" size={28} color="#ffffff20" />
                            <span>Пока нет сообщений</span>
                          </div>
                        )}
                        {messages.map((msg, i) => {
                          const isMe = msg.username === user.username;
                          const prevMsg = messages[i - 1];
                          const showAvatar = !prevMsg || prevMsg.username !== msg.username;
                          return (
                            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                              <div className={`flex-shrink-0 ${showAvatar ? "opacity-100" : "opacity-0"}`}>
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-[#0A0A0B]"
                                  style={{ background: msg.color }}
                                >
                                  {msg.username.slice(0, 2).toUpperCase()}
                                </div>
                              </div>
                              <div className={`flex flex-col gap-0.5 max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                                {showAvatar && (
                                  <div className={`flex items-center gap-2 px-1 ${isMe ? "flex-row-reverse" : ""}`}>
                                    <span className="text-[10px] font-medium" style={{ color: msg.color }}>{msg.username}</span>
                                    <span className="text-white/20 text-[9px]">{formatTime(msg.created_at)}</span>
                                  </div>
                                )}
                                <div
                                  className={`px-3 py-2 rounded-xl text-xs leading-relaxed break-words ${
                                    isMe
                                      ? "bg-purple-500/20 border border-purple-400/30 text-white/85 rounded-br-sm"
                                      : "bg-white/5 border border-white/6 text-white/70 rounded-bl-sm"
                                  }`}
                                >
                                  {msg.text}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>

                      {/* Typing indicator — public */}
                      {(() => {
                        const who = typingUsers.filter(t => t.room === "public" && t.username !== user.username);
                        if (!who.length) return null;
                        return (
                          <div className="flex-shrink-0 px-4 pb-1 flex items-center gap-1.5">
                            <div className="flex gap-0.5 items-center">
                              {[0,1,2].map(i => (
                                <span key={i} className="w-1 h-1 rounded-full bg-white/30 animate-bounce" style={{animationDelay: `${i*0.15}s`}} />
                              ))}
                            </div>
                            <span className="text-white/30 text-[10px]">
                              {who.map(u => u.username).join(", ")} печатает...
                            </span>
                          </div>
                        );
                      })()}

                      {/* Public input */}
                      <div className="flex-shrink-0 px-3 py-3 border-t border-white/6">
                        <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-3 py-2 focus-within:border-purple-400/40 transition-colors">
                          <div
                            className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[7px] font-bold text-[#0A0A0B]"
                            style={{ background: user.color }}
                          >
                            {user.username.slice(0, 2).toUpperCase()}
                          </div>
                          <input
                            ref={inputRef}
                            className="flex-1 bg-transparent text-white/80 text-xs placeholder:text-white/20 outline-none"
                            placeholder="Сообщение..."
                            value={input}
                            onChange={(e) => { setInput(e.target.value); if (e.target.value) sendTyping("public"); }}
                            onKeyDown={handleKeyDown}
                            disabled={loading}
                          />
                          <button
                            onClick={handleSend}
                            disabled={!input.trim() || loading}
                            className="w-6 h-6 rounded-lg bg-purple-500/25 hover:bg-purple-500/40 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all flex-shrink-0"
                          >
                            {loading ? (
                              <Icon name="Loader2" size={11} color="#a78bfa" className="animate-spin" />
                            ) : (
                              <Icon name="Send" size={11} color="#a78bfa" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ── RIGHT: DM CHAT ── */}
                    <div className="flex flex-col w-[45%] flex-shrink-0 min-w-0">
                      {!activeConv ? (
                        <>
                          {/* DM header */}
                          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6 flex-shrink-0">
                            <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center">
                              <Icon name="Lock" size={12} color="#a78bfa" />
                            </div>
                            <span className="text-white/70 text-sm font-medium">Личные</span>
                            {dmUnread > 0 && (
                              <span className="w-4 h-4 rounded-full bg-purple-500 text-white text-[9px] font-bold flex items-center justify-center">
                                {dmUnread > 9 ? "9+" : dmUnread}
                              </span>
                            )}
                          </div>
                          {/* User list */}
                          <div className="flex-1 overflow-y-auto px-3 py-3">
                            {otherOnlineUsers.length === 0 ? (
                              <div className="flex flex-col items-center justify-center h-full text-white/20 text-xs gap-2 text-center">
                                <Icon name="Users" size={24} color="#ffffff20" />
                                <span>Никого нет онлайн</span>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="text-white/20 text-[10px] tracking-widest uppercase px-1 mb-2">Онлайн</div>
                                {otherOnlineUsers.map((u) => (
                                  <button
                                    key={u.id}
                                    onClick={() => handleOpenDm(u)}
                                    disabled={openingDm}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-white/6 bg-white/[0.02] hover:bg-purple-500/5 hover:border-purple-400/20 transition-all group"
                                  >
                                    <div
                                      className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-[#0A0A0B]"
                                      style={{ background: u.color }}
                                    >
                                      {u.username.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                      <div className="text-white/70 text-xs truncate group-hover:text-white/90 transition-colors">{u.username}</div>
                                    </div>
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        /* Active DM conversation */
                        <>
                          {/* DM active header */}
                          <div className="flex items-center gap-2 px-3 py-3 border-b border-white/6 flex-shrink-0">
                            <button
                              onClick={() => { setActiveConv(null); setDmMessages([]); setDmLastSeen(null); }}
                              className="w-6 h-6 rounded-lg hover:bg-white/8 flex items-center justify-center transition-colors flex-shrink-0"
                            >
                              <Icon name="ArrowLeft" size={12} color="#ffffff60" />
                            </button>
                            <div
                              className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-[#0A0A0B]"
                              style={{ background: activeConv.target_color }}
                            >
                              {activeConv.target_username.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-white/80 text-xs font-medium truncate">{activeConv.target_username}</div>
                              <div className="text-white/25 text-[10px] flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-green-400" />
                                онлайн
                              </div>
                            </div>
                            <Icon name="Lock" size={11} color="#a78bfa60" />
                          </div>

                          {/* DM messages */}
                          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 scrollbar-thin">
                            {dmMessages.length === 0 && (
                              <div className="flex flex-col items-center justify-center h-full text-white/20 text-xs gap-2 text-center">
                                <Icon name="MessageSquare" size={24} color="#ffffff20" />
                                <span>Начните разговор</span>
                              </div>
                            )}
                            {dmMessages.map((msg, i) => {
                              const prevMsg = dmMessages[i - 1];
                              const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id;
                              return (
                                <div key={msg.id} className={`flex items-end gap-1.5 ${msg.is_mine ? "flex-row-reverse" : ""}`}>
                                  <div className={`flex-shrink-0 ${showAvatar ? "opacity-100" : "opacity-0"}`}>
                                    <div
                                      className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-[#0A0A0B]"
                                      style={{ background: msg.sender_color }}
                                    >
                                      {msg.sender_username.slice(0, 2).toUpperCase()}
                                    </div>
                                  </div>
                                  <div className={`flex flex-col gap-0.5 max-w-[78%] ${msg.is_mine ? "items-end" : "items-start"}`}>
                                    {showAvatar && (
                                      <div className={`flex items-center gap-1.5 px-1 ${msg.is_mine ? "flex-row-reverse" : ""}`}>
                                        <span className="text-[10px] font-medium" style={{ color: msg.sender_color }}>{msg.sender_username}</span>
                                        <span className="text-white/20 text-[9px]">{formatTime(msg.created_at)}</span>
                                        {msg.is_mine && msg.read_at && (
                                          <Icon name="CheckCheck" size={9} color="#a78bfa" />
                                        )}
                                      </div>
                                    )}
                                    <div
                                      className={`px-3 py-2 rounded-xl text-xs leading-relaxed break-words ${
                                        msg.is_mine
                                          ? "bg-purple-500/20 border border-purple-400/30 text-white/85 rounded-br-sm"
                                          : "bg-white/5 border border-white/6 text-white/70 rounded-bl-sm"
                                      }`}
                                    >
                                      {msg.text}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            <div ref={dmMessagesEndRef} />
                          </div>

                          {/* Typing indicator — DM */}
                          {(() => {
                            const dmRoom = `dm:${activeConv.id}`;
                            const who = typingUsers.filter(t => t.room === dmRoom && t.username !== user.username);
                            if (!who.length) return null;
                            return (
                              <div className="flex-shrink-0 px-3 pb-1 flex items-center gap-1.5">
                                <div className="flex gap-0.5 items-center">
                                  {[0,1,2].map(i => (
                                    <span key={i} className="w-1 h-1 rounded-full bg-purple-400/50 animate-bounce" style={{animationDelay: `${i*0.15}s`}} />
                                  ))}
                                </div>
                                <span className="text-white/30 text-[10px]">
                                  {who[0].username} печатает...
                                </span>
                              </div>
                            );
                          })()}

                          {/* DM input */}
                          <div className="flex-shrink-0 px-3 py-3 border-t border-white/6">
                            <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-3 py-2 focus-within:border-purple-400/40 transition-colors">
                              <input
                                ref={dmInputRef}
                                className="flex-1 bg-transparent text-white/80 text-xs placeholder:text-white/20 outline-none"
                                placeholder={`${activeConv.target_username}...`}
                                value={dmInput}
                                onChange={(e) => { setDmInput(e.target.value); if (e.target.value && activeConv) sendTyping(`dm:${activeConv.id}`); }}
                                onKeyDown={handleDmKeyDown}
                                disabled={dmLoading}
                              />
                              <button
                                onClick={handleDmSend}
                                disabled={!dmInput.trim() || dmLoading}
                                className="w-6 h-6 rounded-lg bg-purple-500/25 hover:bg-purple-500/40 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all flex-shrink-0"
                              >
                                {dmLoading ? (
                                  <Icon name="Loader2" size={11} color="#a78bfa" className="animate-spin" />
                                ) : (
                                  <Icon name="Send" size={11} color="#a78bfa" />
                                )}
                              </button>
                            </div>

                            {/* Online users switcher */}
                            {otherOnlineUsers.length > 0 && (
                              <div className="mt-2.5">
                                <div className="text-white/15 text-[9px] tracking-widest uppercase mb-1.5 px-0.5">Онлайн</div>
                                <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                                  {otherOnlineUsers.map((u) => (
                                    <button
                                      key={u.id}
                                      onClick={() => handleOpenDm(u)}
                                      disabled={openingDm}
                                      title={u.username}
                                      className={`flex-shrink-0 relative group transition-all duration-200 ${
                                        activeConv.target_id === u.id ? "scale-110" : "opacity-60 hover:opacity-100 hover:scale-105"
                                      }`}
                                    >
                                      <div
                                        className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-[#0A0A0B]"
                                        style={{ background: u.color }}
                                      >
                                        {u.username.slice(0, 2).toUpperCase()}
                                      </div>
                                      {activeConv.target_id === u.id && (
                                        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-purple-400" />
                                      )}
                                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 border border-[#0e0e10]" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    {/* end DM column */}

                  </div>
                  {/* end two-column flex */}
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/5 px-8 py-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-purple-500/15 border border-purple-400/25 flex items-center justify-center">
              <Icon name="MessageSquare" size={11} color="#a78bfa" />
            </div>
            <span className="text-white/50 text-sm font-medium">Orbit</span>
          </div>
          <div className="text-white/20 text-xs tracking-wide">
            © 2025 Orbit · Корпоративный мессенджер
          </div>
          <div className="flex items-center gap-5 text-white/25 text-xs">
            <a href="#" className="hover:text-white/50 transition-colors">Конфиденциальность</a>
            <a href="#" className="hover:text-white/50 transition-colors">Условия</a>
            <a href="#" className="hover:text-white/50 transition-colors">Поддержка</a>
          </div>
        </div>
      </footer>
    </div>
  );
}