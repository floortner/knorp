import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/app/AppLayout';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { CodeScreen } from '@/features/auth/CodeScreen';
import { RequireStaff } from '@/features/auth/RequireStaff';
import { ApiErrorBridge } from '@/features/auth/ApiErrorBridge';
import { QueueScreen } from '@/features/queue/QueueScreen';
import { ReviewScreen } from '@/features/review/ReviewScreen';

export function App() {
  return (
    <>
      <ApiErrorBridge />
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/login/code" element={<CodeScreen />} />

        <Route
          element={
            <RequireStaff>
              <AppLayout />
            </RequireStaff>
          }
        >
          <Route path="/queue" element={<QueueScreen />} />
          <Route path="/review/:uploadId" element={<ReviewScreen />} />
        </Route>

        <Route path="*" element={<Navigate to="/queue" replace />} />
      </Routes>
    </>
  );
}
