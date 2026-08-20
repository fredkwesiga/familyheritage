import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RedirectIfAuthenticated, RequireAuth } from '@/features/auth/require-auth';
import { AuthLayout } from '@/layouts/auth-layout';
import { FamilyLayout } from '@/layouts/family-layout';
import { RootLayout } from '@/layouts/root-layout';
import { ForgotPasswordPage } from '@/pages/auth/forgot-password-page';
import { LoginPage } from '@/pages/auth/login-page';
import { MagicLinkCallbackPage } from '@/pages/auth/magic-link-callback-page';
import { MagicLinkPage } from '@/pages/auth/magic-link-page';
import { RegisterPage } from '@/pages/auth/register-page';
import { ResetPasswordPage } from '@/pages/auth/reset-password-page';
import { VerifyEmailPage } from '@/pages/auth/verify-email-page';
import { CreateFamilyPage } from '@/pages/families/create-family-page';
import { FamiliesPage } from '@/pages/families/families-page';
import { FamilyAccessPage } from '@/pages/family/family-access-page';
import { FamilyHomePage } from '@/pages/family/family-home-page';
import { FamilySettingsPage } from '@/pages/family/family-settings-page';
import { MemberEditPage } from '@/pages/family/member-edit-page';
import { MemberNewPage } from '@/pages/family/member-new-page';
import { MemberProfilePage } from '@/pages/family/member-profile-page';
import { MembersPage } from '@/pages/family/members-page';
import { OnboardingPage } from '@/pages/family/onboarding-page';
import { StoriesPage } from '@/pages/family/stories-page';
import { StoryEditPage } from '@/pages/family/story-edit-page';
import { StoryNewPage } from '@/pages/family/story-new-page';
import { StoryPage } from '@/pages/family/story-page';
import { TreePage } from '@/pages/family/tree-page';
import { InvitationAcceptPage } from '@/pages/invitation-accept-page';
import { NotFoundPage } from '@/pages/not-found-page';

/**
 * Five groups of routes:
 *
 *  - signed-out only  a signed-in user is bounced to their families
 *  - callback         reachable in either state, because a link from an email
 *                     may be opened by someone already signed in
 *  - invitation       reachable in either state, and by someone who has never
 *                     used the product at all
 *  - account-level    protected, chrome from RootLayout, no family in scope
 *  - family-level     protected, chrome from FamilyLayout, which loads the
 *                     family once and puts it in context for everything below
 *
 * The /auth/* paths must match exactly what the API puts in its emails
 * (see AuthService.buildUrl), and /invitations/accept must match
 * InvitationsService.invite.
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
        element: <RootLayout />,
        children: [
          { path: '/', element: <Navigate to="/families" replace /> },
          { path: '/families', element: <FamiliesPage /> },
          { path: '/families/new', element: <CreateFamilyPage /> },
        ],
      },
      {
        path: '/f/:familyId',
        element: <FamilyLayout />,
        children: [
          { index: true, element: <FamilyHomePage /> },
          { path: 'start', element: <OnboardingPage /> },
          { path: 'tree', element: <TreePage /> },
          { path: 'members', element: <MembersPage /> },
          { path: 'members/new', element: <MemberNewPage /> },
          { path: 'members/:memberId', element: <MemberProfilePage /> },
          { path: 'members/:memberId/edit', element: <MemberEditPage /> },
          { path: 'stories', element: <StoriesPage /> },
          { path: 'stories/new', element: <StoryNewPage /> },
          { path: 'stories/:storyId', element: <StoryPage /> },
          { path: 'stories/:storyId/edit', element: <StoryEditPage /> },
          { path: 'access', element: <FamilyAccessPage /> },
          { path: 'settings', element: <FamilySettingsPage /> },
        ],
      },
    ],
  },
  // Outside both guards: whoever opens an invitation may never have signed in,
  // and a signed-in person may still be opening one from their inbox.
  { path: '/invitations/accept', element: <InvitationAcceptPage /> },
  { path: '*', element: <NotFoundPage /> },
]);