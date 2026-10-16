import { createLazyRoute } from '@tanstack/react-router'
import { FavoritesRoute } from './phase-three-pages'

export const Route = createLazyRoute('/_account/favorites')({
  component: FavoritesRoute,
})
