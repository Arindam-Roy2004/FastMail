import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router';
import { AppShell } from '@/components/site/app-shell';
import { ErrorBoundary } from '@/components/site/error-boundary';
import { ProtectedRoute } from '@/components/site/protected-route';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LoginPage } from '@/features/auth/login-page';
import { AuthProvider } from '@/features/auth/use-auth';
import { ComposePage } from '@/features/compose/compose-page';
import { EmailDetailPage } from '@/features/emails/email-detail-page';
import { MailboxPage } from '@/features/emails/mailbox-page';

function Protected() {
  return (
    <ProtectedRoute>
      <Outlet />
    </ProtectedRoute>
  );
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <Protected />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/scheduled', element: <MailboxPage tab="scheduled" /> },
          { path: '/sent', element: <MailboxPage tab="sent" /> },
        ],
      },
      { path: '/compose', element: <ComposePage /> },
      { path: '/emails/:id', element: <EmailDetailPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/scheduled" replace /> },
]);

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
