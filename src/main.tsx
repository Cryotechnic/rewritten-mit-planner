import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'

const isAdmin = window.location.pathname.startsWith('/admin');

// Lazy-load so admin code stays out of the main app bundle
const Root = lazy(() =>
  isAdmin
    ? import('./admin/AdminApp')
    : import('./App'),
);

if (!isAdmin) {
  // Only load main-app styles for non-admin routes
  await import('./index.css');
  await import('./styles.css');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Root />
    </Suspense>
  </StrictMode>,
)
