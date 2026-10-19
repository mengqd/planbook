import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import StickyOverlay from './components/StickyOverlay.tsx'
import { isStickyWindow } from './lib/window'

// 桌面便签窗口：macOS 整窗透明；Windows 用不透明窗口 + 深色面板
if (isStickyWindow()) {
  document.body.classList.add('sticky')
  if (navigator.userAgent.includes('Windows')) {
    document.body.classList.add('win')
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isStickyWindow() ? <StickyOverlay /> : <App />}
  </StrictMode>,
)
