import { createBrowserRouter } from 'react-router-dom';
import { RedirectIfAuthenticated, RequireAuth } from '@/features/auth/require-auth';
import { AuthLayout } from '@/layouts/auth-layout';
import { RootLayout } from '@/layouts/root-layout';
import { ForgotPasswordPage } from '@/pages/auth/forgot-password-page';
import { LoginPage } from '@/pages/auth/login-page';
import { MagicLinkCallbackPage } from '@/pages/auth/magic-link-callback-page';
import { MagicLinkPage } from '@/pages/auth/magic-link-page';
import { RegisterPage } from '@/pages/auth/register-page';
import { ResetPasswordPage } from '@/pages/auth/reset-password-page';
import { VerifyEmailPage } from '@/pages/auth/verify-email-page';
import { HomePage } from '@/pages/home-page';
import { NotFoundPage } from '@/pages/not-found-page';

/**
 * Three groups of routes:
 *
 *  - signed-out only  a signed-in user is bounced to the home page
 *  - callback         reachable in either state, because a link from an email
 *                     may be opened by someone already signed in
 *  - protected        everything real, behind RequireAuth
 *
 * The /auth/* paths must match exactly what the API puts in its emails
 * (see AuthService.buildUrl).
 */
export const router = createBrowserRouter([
  {
    element: <RedirectIfAuthenticated />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
          { path: '/magic-link', element: <MagicLinkPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: '/auth/magic-link', element: <MagicLinkCallbackPage /> },
      { path: '/auth/reset-password', element: <ResetPasswordPage /> },
      { path: '/auth/verify-email', element: <VerifyEmailPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <RootLayout />,
        children: [{ index: true, element: <HomePage /> }],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);