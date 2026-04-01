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

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
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

export default function Okeo() {
  const [visible, setVisible] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [username, setUsername] = useState("");
  const [onlineCount, setOnlineCount] = useState(0);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionId = getSessionId();

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

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
    } catch {
      return undefined;
    }
  }, []);

  const fetchOnline = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}?action=online`);
      if (!res.ok) return;
      const data = await res.json();
      setOnlineCount(data.count);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchMessages().then((msgs) => {
      if (msgs) {
        setMessages(msgs);
        if (msgs.length > 0) setLastSeen(msgs[msgs.length - 1].created_at);
        setTimeout(scrollToBottom, 50);
      }
    });
    fetchOnline();
  }, [user, fetchMessages, fetchOnline]);

  useEffect(() => {
    if (!user) return;
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
  }, [user, lastSeen, fetchMessages, fetchOnline]);

  useEffect(() => {
    if (user) setTimeout(() => inputRef.current?.focus(), 100);
  }, [user]);

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
    } catch {
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

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white font-ibm overflow-x-hidden">
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-gold/8 blur-[140px] animate-glow-pulse" />
        <div className="absolute bottom-[20%] right-[-5%] w-[400px] h-[400px] rounded-full bg-gold/5 blur-[100px] animate-glow-pulse" style={{ animationDelay: "1.5s" }} />
        <div className="absolute top-[40%] left-[-5%] w-[300px] h-[300px] rounded-full bg-blue-500/5 blur-[100px]" />
      </div>

      {/* NAV */}
      <header
        className="relative z-20 flex items-center justify-between px-8 py-5 border-b border-white/5"
        style={{ opacity: visible ? 1 : 0, transition: "opacity 0.6s ease" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gold/15 border border-gold/30 flex items-center justify-center">
            <Icon name="MessageSquare" size={15} color="#C9A84C" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">
            ОКЕО<span className="text-gold">.</span>
          </span>
          <span className="hidden sm:block text-white/20 text-xs tracking-widest uppercase font-light">Мессенджер</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-white/40 tracking-wide">
          <a href="#features" className="hover:text-gold transition-colors duration-300">Возможности</a>
          <a href="#team" className="hover:text-gold transition-colors duration-300">Команда</a>
          <a href="#messenger" className="hover:text-gold transition-colors duration-300">Чат</a>
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
            className="px-4 py-2 border border-gold/40 text-gold text-xs tracking-widest uppercase hover:bg-gold/10 transition-all duration-300 rounded-sm"
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
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gold/25 bg-gold/5 mb-8 text-xs text-gold/70 tracking-widest uppercase"
            style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(12px)", transition: "all 0.6s ease 0.1s" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse inline-block" />
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
                background: "linear-gradient(90deg, #C9A84C 0%, #F0D88A 40%, #C9A84C 70%, #8A6E2F 100%)",
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
            ОКЕО — защищённая платформа для командной работы. Мгновенный обмен сообщениями, голосовые каналы и интеграции в одном месте.
          </p>

          <div
            className="mt-10 flex flex-wrap gap-3"
            style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(16px)", transition: "all 0.9s ease 0.55s" }}
          >
            <a
              href="#messenger"
              className="group relative px-7 py-3.5 bg-gold text-[#0A0A0B] font-medium text-sm tracking-widest uppercase rounded-sm overflow-hidden hover:scale-105 transition-transform duration-300 inline-flex items-center gap-2"
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
                <div className="text-gold font-cormorant text-2xl font-semibold">{a.num}</div>
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
            style={{ background: "rgba(14,14,16,0.9)", backdropFilter: "blur(20px)", boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,168,76,0.08)" }}
          >
            {/* Mock window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/6">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
              <span className="ml-3 text-white/20 text-xs tracking-wide">ОКЕО — Общий канал</span>
            </div>
            <div className="flex h-56">
              {/* Sidebar mock */}
              <div className="w-44 border-r border-white/6 p-3 flex flex-col gap-1">
                <div className="text-white/20 text-xs px-2 py-1 tracking-widest uppercase mb-1">Каналы</div>
                {["# общий", "# разработка", "# дизайн", "# маркетинг"].map((ch, i) => (
                  <div key={ch} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${i === 0 ? "bg-gold/10 text-gold/80" : "text-white/30 hover:text-white/50"}`}>
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
            <div className="px-4 py-3 border-t border-white/6 flex items-center gap-2">
              <div className="flex-1 bg-white/5 rounded px-3 py-2 text-xs text-white/20">Напишите сообщение...</div>
              <div className="w-7 h-7 rounded bg-gold/20 flex items-center justify-center">
                <Icon name="Send" size={12} color="#C9A84C" />
              </div>
            </div>
          </div>

          {/* Floating badge */}
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
              <div className="absolute inset-0 bg-gradient-to-br from-gold/0 via-gold/0 to-gold/0 group-hover:from-gold/3 transition-all duration-700" />
              <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center mb-5 group-hover:bg-gold/15 transition-colors duration-300">
                <Icon name={f.icon} size={18} color="#C9A84C" />
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
            Команда <em className="text-gold not-italic">ОКЕО</em>
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
        <div className="grid lg:grid-cols-5 gap-8 items-start">
          {/* Left: description */}
          <div className="lg:col-span-2 lg:sticky lg:top-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gold/20 bg-gold/5 mb-6 text-xs text-gold/60 tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse inline-block" />
              Real-time
            </div>
            <h2 className="font-cormorant text-[clamp(2rem,4vw,3rem)] font-light text-white/90 leading-tight mb-4">
              Общайтесь<br />
              <em className="text-gold not-italic">прямо сейчас</em>
            </h2>
            <p className="text-white/35 text-sm leading-relaxed mb-8">
              Попробуйте мессенджер ОКЕО вживую. Присоединяйтесь к общему каналу, представьтесь и начните общение с другими участниками.
            </p>
            <div className="space-y-4">
              {[
                { icon: "MessageCircle", text: "Мгновенная доставка сообщений" },
                { icon: "Users", text: "Видите кто онлайн прямо сейчас" },
                { icon: "Shield", text: "Сессия сохраняется автоматически" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3 text-white/40 text-sm">
                  <div className="w-6 h-6 rounded-md bg-gold/10 flex items-center justify-center flex-shrink-0">
                    <Icon name={item.icon} size={12} color="#C9A84C" />
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
          </div>

          {/* Right: actual messenger */}
          <div className="lg:col-span-3">
            <div
              className="rounded-2xl border border-white/8 overflow-hidden flex flex-col"
              style={{
                background: "rgba(14,14,16,0.95)",
                backdropFilter: "blur(20px)",
                boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,168,76,0.06)",
                height: "560px",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/6 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gold/15 border border-gold/20 flex items-center justify-center">
                    <Icon name="Hash" size={14} color="#C9A84C" />
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

              {/* Join form */}
              {!user ? (
                <div className="flex flex-col items-center justify-center flex-1 px-8 gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-2">
                    <Icon name="MessageSquare" size={28} color="#C9A84C" />
                  </div>
                  <div className="text-center">
                    <div className="text-white/80 font-cormorant text-2xl mb-1.5">Войти в канал</div>
                    <div className="text-white/30 text-sm">Введите имя или оставьте поле пустым</div>
                  </div>
                  <div className="w-full max-w-xs space-y-3">
                    <input
                      className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-white/80 text-sm placeholder:text-white/20 outline-none focus:border-gold/40 focus:bg-white/8 transition-all duration-200"
                      placeholder="Ваше имя..."
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                    />
                    <button
                      onClick={handleJoin}
                      disabled={joining}
                      className="w-full py-3 bg-gold text-[#0A0A0B] font-medium text-sm tracking-widest uppercase rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {joining ? (
                        <Icon name="Loader2" size={16} className="animate-spin" />
                      ) : (
                        <Icon name="ArrowRight" size={16} />
                      )}
                      {joining ? "Подключение..." : "Присоединиться"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Messages list */}
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 scrollbar-thin scrollbar-thumb-white/10">
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-white/20 text-sm gap-2">
                        <Icon name="MessageCircle" size={32} />
                        <span>Начните общение первым</span>
                      </div>
                    ) : (
                      messages.map((m, i) => {
                        const isOwn = m.username === user.username;
                        const prevMsg = messages[i - 1];
                        const sameUser = prevMsg && prevMsg.username === m.username;
                        return (
                          <div key={m.id} className={`flex items-end gap-2.5 ${isOwn ? "flex-row-reverse" : ""} ${sameUser ? "mt-0.5" : "mt-3"}`}>
                            {!isOwn && !sameUser && (
                              <div
                                className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-[#0A0A0B]"
                                style={{ background: m.color }}
                              >
                                {m.username.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            {!isOwn && sameUser && <div className="w-7 flex-shrink-0" />}
                            <div className={`max-w-[70%] ${sameUser ? "" : ""}`}>
                              {!isOwn && !sameUser && (
                                <div className="text-xs font-medium mb-1 ml-1" style={{ color: m.color }}>
                                  {m.username}
                                </div>
                              )}
                              <div
                                className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                                  isOwn
                                    ? "bg-gold/20 text-white/85 rounded-br-sm"
                                    : "bg-white/6 text-white/75 rounded-bl-sm"
                                }`}
                              >
                                {m.text}
                              </div>
                              <div className={`text-[10px] text-white/20 mt-1 ${isOwn ? "text-right mr-1" : "ml-1"}`}>
                                {formatTime(m.created_at)}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="flex-shrink-0 px-4 py-4 border-t border-white/6">
                    <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl px-4 py-2.5 focus-within:border-gold/30 transition-colors duration-200">
                      <div
                        className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-[#0A0A0B]"
                        style={{ background: user.color }}
                      >
                        {user.username.slice(0, 2).toUpperCase()}
                      </div>
                      <input
                        ref={inputRef}
                        className="flex-1 bg-transparent text-white/80 text-sm placeholder:text-white/20 outline-none"
                        placeholder="Напишите сообщение..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={loading}
                      />
                      <button
                        onClick={handleSend}
                        disabled={!input.trim() || loading}
                        className="w-7 h-7 rounded-lg bg-gold/20 hover:bg-gold/30 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200 flex-shrink-0"
                      >
                        {loading ? (
                          <Icon name="Loader2" size={13} color="#C9A84C" className="animate-spin" />
                        ) : (
                          <Icon name="Send" size={13} color="#C9A84C" />
                        )}
                      </button>
                    </div>
                    <div className="mt-2 text-center text-white/15 text-[10px] tracking-wide">
                      {user.username} · Enter для отправки
                    </div>
                  </div>
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
            <div className="w-6 h-6 rounded-md bg-gold/15 border border-gold/25 flex items-center justify-center">
              <Icon name="MessageSquare" size={11} color="#C9A84C" />
            </div>
            <span className="text-white/50 text-sm font-medium">ОКЕО</span>
          </div>
          <div className="text-white/20 text-xs tracking-wide">
            © 2025 ОКЕО · Корпоративный мессенджер
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