/**
 * RoleContext — 当前演示角色状态 + localStorage 持久化 + RBAC 查询
 * 登录页与 Header 角色切换共用（design.md §10）
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AccessLevel, ModuleKey, RoleInfo, RoleKey } from '@/data/roles';
import { ROLES, RBAC_MATRIX } from '@/data/roles';

const STORAGE_KEY = 'apms.role';

export interface RoleContextValue {
  role: RoleKey;
  roleInfo: RoleInfo;
  /** 是否已选择角色（即"已登录"演示态） */
  isAuthenticated: boolean;
  setRole: (role: RoleKey) => void;
  clearRole: () => void;
  /** 查询当前角色对某模块的访问级别 */
  access: (module: ModuleKey) => AccessLevel;
  /** 当前角色是否可访问某模块（none → false） */
  canAccess: (module: ModuleKey) => boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

function readStoredRole(): RoleKey | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && v in ROLES) return v as RoleKey;
  } catch {
    // localStorage 不可用时忽略
  }
  return null;
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<RoleKey | null>(() => readStoredRole());

  const setRole = useCallback((r: RoleKey) => {
    setRoleState(r);
    try {
      localStorage.setItem(STORAGE_KEY, r);
    } catch {
      // ignore
    }
  }, []);

  const clearRole = useCallback(() => {
    setRoleState(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const access = useCallback(
    (module: ModuleKey): AccessLevel => (role ? RBAC_MATRIX[module][role] : 'none'),
    [role],
  );

  const canAccess = useCallback(
    (module: ModuleKey): boolean => access(module) !== 'none',
    [access],
  );

  const value = useMemo<RoleContextValue>(
    () => ({
      role: role ?? 'coach',
      roleInfo: ROLES[role ?? 'coach'],
      isAuthenticated: role !== null,
      setRole,
      clearRole,
      access,
      canAccess,
    }),
    [role, setRole, clearRole, access, canAccess],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole 必须在 <RoleProvider> 内使用');
  return ctx;
}

export { ROLES, ROLE_LIST, RBAC_MATRIX, MODULES, ACCESS_LABEL, ACCESS_SYMBOL } from '@/data/roles';
export type { RoleKey, RoleInfo, ModuleKey, AccessLevel } from '@/data/roles';
