import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/app/AppShell';
import { Lernen } from '@/app/tabs/Lernen';
import { Liga } from '@/app/tabs/Liga';
import { Chat } from '@/app/tabs/Chat';
import { Profil } from '@/app/tabs/Profil';
import { LessonScreen } from '@/features/lessons/LessonScreen';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { CodeScreen } from '@/features/auth/CodeScreen';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';

export function App() {
  return (
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
        <Route path="liga" element={<Liga />} />
        <Route path="chat" element={<Chat />} />
        <Route path="profil" element={<Profil />} />
      </Route>

      {/* Onboarding (milestone 2) and /parent (milestone 8) routes land here later. */}
      <Route path="*" element={<Navigate to="/app/lernen" replace />} />
    </Routes>
  );
}
