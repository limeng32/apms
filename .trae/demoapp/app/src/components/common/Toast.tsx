/**
 * Toast — 轻量全局演示 Toast（右上堆叠，成功绿边/信息蓝边，3s 自动消失）
 * 用法：const { toast } = useToast(); toast('任务已下发（模拟）', 'success')
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, AlertTriangle } from 'lucide-react';

export type ToastKind = 'success' | 'info' | 'warning';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const KIND_STYLE: Record<ToastKind, { border: string; icon: ReactNode }> = {
  success: { border: '#16A34A', icon: <CheckCircle2 className="h-4 w-4 text-ok" /> },
  info: { border: '#2563EB', icon: <Info className="h-4 w-4 text-brand-600" /> },
  warning: { border: '#D97706', icon: <AlertTriangle className="h-4 w-4 text-warn" /> },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = ++idRef.current;
    setItems((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[90] flex w-80 flex-col gap-2">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 48 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 48 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-line border-l-4 bg-white px-3.5 py-2.5 text-sm text-text-1 shadow-lift"
              style={{ borderLeftColor: KIND_STYLE[t.kind].border }}
            >
              {KIND_STYLE[t.kind].icon}
              <span className="flex-1">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast 必须在 <ToastProvider> 内使用');
  return ctx;
}
