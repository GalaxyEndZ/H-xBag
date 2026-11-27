import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AppRuntimeBoundary from './components/AppRuntimeBoundary.tsx'
import { initializeHaxbagMobile } from './mobile/runtime'
import './mobile/MobileV306.css'

initializeHaxbagMobile()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRuntimeBoundary>
      <App />
    </AppRuntimeBoundary>
  </StrictMode>,
)
