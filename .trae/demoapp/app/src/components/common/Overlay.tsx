/**
 * Modal — 居中弹窗（scale .96→1 + fade，遮罩 fade 200ms）
 * Drawer — 右侧滑出详情抽屉（480–560px，spring）
 */

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: number;
}

export function Modal({ open, onClose, title, children, width = 520 }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
            className="relative max-h-[85dvh] w-full overflow-auto rounded-[14px] bg-white p-6 shadow-lift"
            style={{ maxWidth: width }}
          >
            {title && (
              <div className="mb-4 flex items-center justify-between">
                <h2>{title}</h2>
                <button onClick={onClose} className="rounded-md p-1 text-text-3 transition-colors hover:bg-canvas hover:text-text-1">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: number;
}

export function Drawer({ open, onClose, title, children, width = 520 }: DrawerProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <motion.aside
            initial={{ x: width }}
            animate={{ x: 0 }}
            exit={{ x: width }}
            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
            className="absolute right-0 top-0 flex h-full flex-col bg-white shadow-lift"
            style={{ width: `min(${width}px, 92vw)` }}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2>{title}</h2>
              <button onClick={onClose} className="rounded-md p-1 text-text-3 transition-colors hover:bg-canvas hover:text-text-1">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className={cn('flex-1 overflow-auto p-5')}>{children}</div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
