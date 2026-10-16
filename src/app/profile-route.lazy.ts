import { createLazyRoute } from '@tanstack/react-router'
import { ProfilePage } from '@/features/profile/profile-page'

export const Route = createLazyRoute('/_account/profile')({
  component: ProfilePage,
})
