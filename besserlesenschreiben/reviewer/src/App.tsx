import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/app/AppLayout';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { CodeScreen } from '@/features/auth/CodeScreen';
import { RequireStaff } from '@/features/auth/RequireStaff';
import { ApiErrorBridge } from '@/features/auth/ApiErrorBridge';
import { QueueScreen } from '@/features/queue/QueueScreen';
import { ReviewScreen } from '@/features/review/ReviewScreen';
import { HistoryScreen } from '@/features/review/HistoryScreen';
import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { UsersScreen } from '@/features/users/UsersScreen';

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
          <Route path="/history/:uploadId" element={<HistoryScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/users" element={<UsersScreen />} />
        </Route>

        <Route path="*" element={<Navigate to="/queue" replace />} />
      </Routes>
    </>
  );
}
