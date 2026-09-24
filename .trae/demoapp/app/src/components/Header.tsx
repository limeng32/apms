/**
 * Header — 顶部 64px（design.md §6.2）
 * 面包屑 / ⌘K Command Palette 演示 / 通知铃铛 / 日期 / 角色徽标切换
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ChevronDown, Search, FileText, Users, ClipboardList } from 'lucide-react';
import { useRole, ROLE_LIST } from '@/context/RoleContext';
import { MODULES, type ModuleKey } from '@/data/roles';
import { NOTIFICATIONS, type NotificationLevel } from '@/data/notifications';
import { ATHLETES } from '@/data/athletes';
import { TEST_TASKS } from '@/data/testTasks';
import { REPORTS } from '@/data/reports';
import { DEMO_TODAY } from '@/data';
import { cn } from '@/lib/utils';

const LEVEL_COLOR: Record<NotificationLevel, string> = {
  red: '#DC2626',
  amber: '#D97706',
  green: '#16A34A',
  blue: '#2563EB',
};

/** 路由 → 面包屑 */
function breadcrumb(pathname: string): string[] {
  const first = '/' + (pathname.split('/')[1] ?? '');
  const mod = (Object.values(MODULES) as { key: ModuleKey; path: string; label: string }[]).find(
    (m) => m.path === first,
  );
  if (!mod) return ['数据驾驶舱'];
  if (mod.path === '/') return ['总览', mod.label];
  if (mod.path === '/athletes' && pathname.split('/')[2]) return ['运动员', '花名册', '运动员档案'];
  const group: Record<string, string> = {
    '/athletes': '运动员', '/development': '运动员', '/trends': '运动员',
    '/testing': '测试', '/combo': '测试', '/health': '健康', '/medical': '健康',
    '/reports': '分析', '/rbac': '系统',
  };
  return [group[mod.path] ?? '', mod.label].filter(Boolean);
}

export default function Header() {
  const { roleInfo, setRole } = useRole();
  const location = useLocation();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);

  const crumbs = breadcrumb(location.pathname);
  const unread = NOTIFICATIONS.filter((n) => !n.read).length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        setBellOpen(false);
        setRoleOpen(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) setRoleOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, []);

  // 路由变化时关闭弹层
  useEffect(() => {
    setPaletteOpen(false);
    setBellOpen(false);
    setRoleOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-line bg-white/85 px-6 backdrop-blur">
      {/* 面包屑 */}
      <nav className="hidden min-w-0 items-center gap-1.5 text-sm md:flex">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-text-3">/</span>}
            <span className={i === crumbs.length - 1 ? 'font-semibold text-text-1' : 'text-text-3'}>{c}</span>
          </span>
        ))}
      </nav>

      {/* 全局搜索 */}
      <button
        onClick={() => setPaletteOpen(true)}
        className="mx-auto flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-line bg-canvas px-3 text-sm text-text-3 transition-colors hover:border-brand-500/50 hover:bg-white"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">搜索运动员 / 任务 / 报告…</span>
        <kbd className="rounded border border-line bg-white px-1.5 py-0.5 font-mono-data text-[10px] text-text-3">⌘K</kbd>
      </button>

      {/* 日期 */}
      <span className="hidden font-mono-data text-xs text-text-3 lg:block">{DEMO_TODAY} 周一</span>

      {/* 通知铃铛 */}
      <div className="relative" ref={bellRef}>
        <button
          onClick={() => setBellOpen((v) => !v)}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-2 transition-colors hover:bg-canvas"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
              <span className="absolute h-full w-full animate-ping rounded-full bg-risk opacity-60 motion-reduce:hidden" />
              <span className="relative h-2 w-2 rounded-full bg-risk" />
            </span>
          )}
        </button>
        <AnimatePresence>
          {bellOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.16 }}
              className="absolute right-0 top-11 w-80 overflow-hidden rounded-xl border border-line bg-white shadow-lift"
            >
              <p className="border-b border-line px-4 py-2.5 text-xs font-semibold text-text-2">预警通知</p>
              {NOTIFICATIONS.slice(0, 4).map((n) => (
                <button
                  key={n.id}
                  onClick={() => n.link && navigate(n.link)}
                  className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-[#F8FAFF]"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: LEVEL_COLOR[n.level] }} />
                  <span className="min-w-0">
                    <span className={cn('block truncate text-[13px]', n.read ? 'text-text-2' : 'font-medium text-text-1')}>{n.title}</span>
                    <span className="text-[11px] text-text-3">{n.time}</span>
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 角色徽标 + 切换 */}
      <div className="relative" ref={roleRef}>
        <button
          onClick={() => setRoleOpen((v) => !v)}
          className="flex h-9 items-center gap-2 rounded-full border py-1 pl-1 pr-2.5 transition-colors hover:bg-canvas"
          style={{ borderColor: `${roleInfo.color}55`, background: `${roleInfo.color}0D` }}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: roleInfo.color }}>
            {roleInfo.person.charAt(0)}
          </span>
          <span className="hidden text-[13px] font-medium text-text-1 sm:block">{roleInfo.person}</span>
          <ChevronDown className="h-3.5 w-3.5 text-text-3" />
        </button>
        <AnimatePresence>
          {roleOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.16 }}
              className="absolute right-0 top-11 w-64 overflow-hidden rounded-xl border border-line bg-white p-1.5 shadow-lift"
            >
              <p className="px-2.5 py-1.5 text-[11px] font-semibold text-text-3">切换演示角色</p>
              {ROLE_LIST.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRole(r.key)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-canvas',
                    r.key === roleInfo.key && 'bg-brand-50',
                  )}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: r.color }}>
                    {r.person.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-text-1">{r.name}</span>
                    <span className="block truncate text-[11px] text-text-3">{r.person} · {r.title}</span>
                  </span>
                  {r.key === roleInfo.key && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-600" />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </header>
  );
}

// ---------- ⌘K Command Palette（演示） ----------

interface PaletteEntry {
  group: '运动员' | '测试任务' | '报告';
  label: string;
  sub?: string;
  link: string;
}

const ENTRIES: PaletteEntry[] = [
  ...ATHLETES.map((a) => ({ group: '运动员' as const, label: a.name, sub: `${a.id} · ${a.group} · ${a.position}`, link: `/athletes/${a.id}` })),
  ...TEST_TASKS.map((t) => ({ group: '测试任务' as const, label: t.title, sub: `${t.id} · ${t.status} · ${t.tested}/${t.target}`, link: '/testing' })),
  ...REPORTS.map((r) => ({ group: '报告' as const, label: r.title, sub: `${r.id} · ${r.status} · ${r.date}`, link: '/reports' })),
];

const GROUP_ICON = { 运动员: Users, 测试任务: ClipboardList, 报告: FileText } as const;

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ENTRIES.slice(0, 10);
    return ENTRIES.filter((e) => `${e.label}${e.sub ?? ''}`.toLowerCase().includes(q)).slice(0, 12);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => setCursor(0), [query]);

  const pick = (e: PaletteEntry) => {
    navigate(e.link);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-lg overflow-hidden rounded-xl border border-line bg-white shadow-lift"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
              if (e.key === 'Enter' && results[cursor]) pick(results[cursor]);
            }}
          >
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search className="h-4 w-4 text-text-3" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索运动员 / 任务 / 报告…"
                className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-text-3"
              />
              <kbd className="rounded border border-line bg-canvas px-1.5 py-0.5 font-mono-data text-[10px] text-text-3">ESC</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-1.5">
              {results.length === 0 && <p className="px-3 py-6 text-center text-sm text-text-3">未找到匹配结果（演示数据）</p>}
              {results.map((e, i) => {
                const Icon = GROUP_ICON[e.group];
                const showGroup = i === 0 || results[i - 1].group !== e.group;
                return (
                  <div key={`${e.group}-${e.label}-${i}`}>
                    {showGroup && <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold text-text-3">{e.group}</p>}
                    <button
                      onClick={() => pick(e)}
                      onMouseEnter={() => setCursor(i)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left',
                        i === cursor ? 'bg-brand-50' : '',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-text-3" />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] text-text-1">{e.label}</span>
                        {e.sub && <span className="block truncate font-mono-data text-[11px] text-text-3">{e.sub}</span>}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
