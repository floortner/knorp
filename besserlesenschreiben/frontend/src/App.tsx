import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/app/AppShell';
import { Lernen } from '@/app/tabs/Lernen';
import { Erfolge } from '@/app/tabs/Erfolge';
import { Chat } from '@/app/tabs/Chat';
import { Profil } from '@/app/tabs/Profil';
import { LessonScreen } from '@/features/lessons/LessonScreen';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { CodeScreen } from '@/features/auth/CodeScreen';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { ApiErrorBridge } from '@/features/auth/ApiErrorBridge';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { ParentScreen } from '@/features/parent/ParentScreen';

export function App() {
  return (
    <>
      <ApiErrorBridge />
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/login/code" element={<CodeScreen />} />

        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <OnboardingScreen />
            </RequireAuth>
          }
        />

        <Route
          path="/parent"
          element={
            <RequireAuth>
              <ParentScreen />
            </RequireAuth>
          }
        />

        <Route
          path="/app"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="lernen" replace />} />
          <Route path="lernen" element={<Lernen />} />
          <Route path="lesson" element={<LessonScreen />} />
          <Route path="erfolge" element={<Erfolge />} />
          <Route path="chat" element={<Chat />} />
          <Route path="profil" element={<Profil />} />
        </Route>

        <Route path="*" element={<Navigate to="/app/lernen" replace />} />
      </Routes>
    </>
  );
}
