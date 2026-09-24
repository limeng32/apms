import { Routes, Route, Navigate } from 'react-router-dom';
import { RoleProvider } from '@/context/RoleContext';
import { ToastProvider } from '@/components/common';
import Layout from '@/components/Layout';
import RoleRoute from '@/components/RoleRoute';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Roster from '@/pages/Roster';
import AthleteProfile from '@/pages/AthleteProfile';
import Development from '@/pages/Development';
import Trends from '@/pages/Trends';
import Testing from '@/pages/Testing';
import ComboTesting from '@/pages/ComboTesting';
import Health from '@/pages/Health';
import Medical from '@/pages/Medical';
import Reports from '@/pages/Reports';
import Rbac from '@/pages/Rbac';

export default function App() {
  return (
    <RoleProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Layout 渲染 <Outlet/> —— 嵌套路由模式 */}
          <Route element={<Layout />}>
            <Route index element={<RoleRoute module="dashboard"><Dashboard /></RoleRoute>} />
            <Route path="athletes" element={<RoleRoute module="athletes"><Roster /></RoleRoute>} />
            <Route path="athletes/:id" element={<RoleRoute module="athletes"><AthleteProfile /></RoleRoute>} />
            <Route path="development" element={<RoleRoute module="development"><Development /></RoleRoute>} />
            <Route path="trends" element={<RoleRoute module="trends"><Trends /></RoleRoute>} />
            <Route path="testing" element={<RoleRoute module="testing"><Testing /></RoleRoute>} />
            <Route path="combo" element={<RoleRoute module="combo"><ComboTesting /></RoleRoute>} />
            <Route path="health" element={<RoleRoute module="health"><Health /></RoleRoute>} />
            <Route path="medical" element={<RoleRoute module="medical"><Medical /></RoleRoute>} />
            <Route path="reports" element={<RoleRoute module="reports"><Reports /></RoleRoute>} />
            <Route path="rbac" element={<RoleRoute module="rbac"><Rbac /></RoleRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ToastProvider>
    </RoleProvider>
  );
}
