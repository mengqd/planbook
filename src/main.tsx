import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import StickyOverlay from './components/StickyOverlay.tsx'
import { isStickyWindow } from './lib/window'

// 桌面便签窗口需要整窗透明
if (isStickyWindow()) {
  document.body.classList.add('sticky')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isStickyWindow() ? <StickyOverlay /> : <App />}
  </StrictMode>,
)
