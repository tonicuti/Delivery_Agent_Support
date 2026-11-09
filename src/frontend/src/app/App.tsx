import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { AssistantPage } from './routes/AssistantPage'
import { CaseDetailPage } from './routes/CaseDetailPage'
import { DemoControlsPage } from './routes/DemoControlsPage'
import { HistoryPage } from './routes/HistoryPage'
import { HomePage } from './routes/HomePage'
import { PerformancePage } from './routes/PerformancePage'
import { PerformanceReportPage } from './routes/PerformanceReportPage'
import { WorklistPage } from './routes/WorklistPage'

function OpsLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export function App() {
  return (
    <Routes>
      <Route element={<OpsLayout />}>
        <Route index element={<HomePage />} />
        <Route path="dashboard" element={<WorklistPage />} />
        <Route path="cases/:orderId" element={<CaseDetailPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="history/:episodeId" element={<HistoryPage />} />
        <Route path="chat" element={<AssistantPage />} />
        <Route path="data-health" element={<Navigate to="/chat" replace />} />
        <Route path="performance" element={<PerformancePage />} />
        <Route path="performance/report" element={<PerformanceReportPage />} />
        <Route path="demo-controls" element={<DemoControlsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
