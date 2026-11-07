import { Navigate, Route, Routes } from 'react-router-dom'
import { CaseDetailPage } from './routes/CaseDetailPage'
import { DataHealthPage } from './routes/DataHealthPage'
import { HistoryPage } from './routes/HistoryPage'
import { PerformancePage } from './routes/PerformancePage'
import { WorklistPage } from './routes/WorklistPage'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<WorklistPage />} />
      <Route path="/cases/:orderId" element={<CaseDetailPage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/history/:episodeId" element={<HistoryPage />} />
      <Route path="/data-health" element={<DataHealthPage />} />
      <Route path="/performance" element={<PerformancePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
