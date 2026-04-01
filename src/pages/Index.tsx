import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

const features = [
  {
    icon: "Zap",
    title: "Молниеносная скорость",
    desc: "Сайт с нуля за несколько минут. Без очередей, без брифов, без ожидания.",
  },
  {
    icon: "Sparkles",
    title: "Дизайн под вас",
    desc: "ИИ подбирает стиль, цвета и типографику под вашу задачу и аудиторию.",
  },
  {
    icon: "Code2",
    title: "Живой код",
    desc: "Вы получаете настоящий рабочий код — не шаблон, а уникальный проект.",
  },
  {
    icon: "RefreshCw",
    title: "Итерации мгновенно",
    desc: "Хотите изменить цвет, текст или структуру? Один запрос — готово.",
  },
];

const steps = [
  { num: "01", label: "Опишите идею" },
  { num: "02", label: "ИИ строит сайт" },
  { num: "03", label: "Правьте за секунды" },
  { num: "04", label: "Публикуйте" },
];

export default function Index() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white font-ibm overflow-x-hidden">
      {/* ── Ambient glows ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-gold/10 blur-[120px] animate-glow-pulse" />
        <div className="absolute bottom-[10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-gold/6 blur-[100px] animate-glow-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* ── NAV ── */}
      <header
        className="relative z-20 flex items-center justify-between px-8 py-6 border-b border-white/5"
        style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.6s ease' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-gold font-cormorant font-bold text-2xl tracking-wider">ПОЕХАЛИ</span>
          <span className="text-white/20 text-xs tracking-[0.3em] uppercase font-light mt-1">.dev</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-white/50 tracking-wide">
          <a href="#" className="hover:text-gold transition-colors duration-300">Как работает</a>
          <a href="#" className="hover:text-gold transition-colors duration-300">Примеры</a>
          <a href="#" className="hover:text-gold transition-colors duration-300">Цены</a>
        </nav>
        <button className="px-5 py-2 border border-gold/50 text-gold text-sm tracking-wide hover:bg-gold/10 transition-all duration-300 rounded-sm">
          Начать →
        </button>
      </header>

      {/* ── HERO ── */}
      <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-28 pb-32">
        {/* Eyebrow badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gold/30 bg-gold/5 mb-10 text-xs text-gold/80 tracking-widest uppercase"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(16px)',
            transition: 'all 0.6s ease 0.1s',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse inline-block" />
          Ваш личный разработчик с ИИ
        </div>

        {/* Headline */}
        <h1
          className="font-cormorant font-semibold text-[clamp(3.2rem,9vw,8rem)] leading-[0.95] tracking-tight max-w-5xl"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(24px)',
            transition: 'all 0.9s ease 0.25s',
          }}
        >
          <span className="block text-white">Сайт за</span>
          <span
            className="block"
            style={{
              background: 'linear-gradient(90deg, #C9A84C 0%, #F0D88A 40%, #C9A84C 70%, #8A6E2F 100%)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'shimmer 3s linear infinite',
            }}
          >
            несколько минут
          </span>
        </h1>

        {/* Sub */}
        <p
          className="mt-8 text-white/45 text-[1.05rem] font-light leading-relaxed max-w-xl tracking-wide"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.9s ease 0.45s',
          }}
        >
          Описываете идею — ИИ строит, правит и публикует сайт.<br />
          В 30 раз быстрее обычной разработки.
        </p>

        {/* CTA row */}
        <div
          className="mt-12 flex flex-col sm:flex-row items-center gap-4"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.9s ease 0.6s',
          }}
        >
          <button className="group relative px-9 py-4 bg-gold text-[#0A0A0B] font-medium text-sm tracking-widest uppercase rounded-sm overflow-hidden hover:scale-105 transition-transform duration-300">
            <span className="relative z-10">Создать сайт бесплатно</span>
            <span className="absolute inset-0 bg-gold-light opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </button>
          <button className="flex items-center gap-2 text-white/40 text-sm hover:text-white/70 transition-colors duration-300">
            <Icon name="Play" size={14} />
            Посмотреть демо
          </button>
        </div>

        {/* Scroll hint */}
        <div
          className="mt-20 flex flex-col items-center gap-2 text-white/20 text-xs tracking-widest"
          style={{ opacity: visible ? 1 : 0, transition: 'opacity 1s ease 1s' }}
        >
          <div className="w-px h-8 bg-gradient-to-b from-transparent to-gold/40 animate-float" style={{ animationDelay: '0.5s' }} />
          <span className="uppercase tracking-[0.25em]">Scroll</span>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="relative z-10 flex items-center gap-6 px-8 max-w-6xl mx-auto mb-24">
        <div className="flex-1 h-px bg-white/5" />
        <span className="text-white/15 text-xs tracking-[0.3em] uppercase">Как это работает</span>
        <div className="flex-1 h-px bg-white/5" />
      </div>

      {/* ── STEPS ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-8 mb-32">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 rounded-sm overflow-hidden">
          {steps.map((s, i) => (
            <div
              key={s.num}
              className="bg-[#0A0A0B] p-8 hover:bg-white/[0.02] transition-colors duration-500 group"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(20px)',
                transition: `all 0.7s ease ${0.1 * i + 0.8}s`,
              }}
            >
              <div className="text-gold/30 font-cormorant text-5xl font-light mb-4 group-hover:text-gold/60 transition-colors duration-500">
                {s.num}
              </div>
              <div className="text-white/70 text-sm tracking-wide leading-snug">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="relative z-10 max-w-6xl mx-auto px-8 mb-32">
        <div className="flex items-end justify-between mb-14 flex-wrap gap-6">
          <h2 className="font-cormorant text-[clamp(2rem,5vw,3.8rem)] font-light text-white/90 leading-tight">
            Всё что нужно<br />
            <em className="text-gold not-italic">для запуска</em>
          </h2>
          <p className="text-white/35 text-sm max-w-xs leading-relaxed">
            Никаких технических знаний. Просто опишите — и получите готовый продукт.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-px bg-white/5">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="bg-[#0A0A0B] p-10 group hover:bg-white/[0.02] transition-all duration-500 relative overflow-hidden"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(24px)',
                transition: `all 0.8s ease ${0.15 * i + 1}s`,
              }}
            >
              {/* Corner accent */}
              <div className="absolute top-0 left-0 w-0 h-px bg-gold group-hover:w-full transition-all duration-700 ease-out" />

              <div className="w-10 h-10 rounded-sm border border-gold/20 flex items-center justify-center mb-6 group-hover:border-gold/50 transition-colors duration-500">
                <Icon name={f.icon} size={18} className="text-gold/60 group-hover:text-gold transition-colors duration-500" />
              </div>
              <h3 className="font-cormorant text-2xl text-white/90 mb-3 font-semibold">{f.title}</h3>
              <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="relative z-10 max-w-6xl mx-auto px-8 mb-24">
        <div className="relative border border-gold/15 rounded-sm overflow-hidden">
          {/* BG glow inside */}
          <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-transparent" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 px-12 py-14">
            <div>
              <p className="text-xs text-gold/60 tracking-[0.3em] uppercase mb-3">Начните прямо сейчас</p>
              <h2 className="font-cormorant text-[clamp(1.8rem,4vw,3.2rem)] font-light text-white leading-tight">
                Ваш первый сайт —<br />
                <strong className="font-semibold text-gold">бесплатно</strong>
              </h2>
            </div>
            <div className="flex flex-col gap-3 min-w-[220px]">
              <button className="w-full px-8 py-4 bg-gold text-[#0A0A0B] font-medium text-sm tracking-widest uppercase rounded-sm hover:bg-gold-light transition-colors duration-300">
                Попробовать →
              </button>
              <p className="text-center text-white/25 text-xs">Без карты. Без установок.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t border-white/5 px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-white/20 text-xs tracking-wide">
        <span className="font-cormorant text-base text-white/30 font-semibold">ПОЕХАЛИ.DEV</span>
        <span>© 2025 — Все права защищены</span>
        <div className="flex gap-6">
          <a href="#" className="hover:text-white/50 transition-colors">Политика</a>
          <a href="#" className="hover:text-white/50 transition-colors">Контакты</a>
        </div>
      </footer>
    </div>
  );
}