import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import CodexGate from './components/CodexGate'
import './styles.css'

// Codex 를 쓸 수 없으면 앱을 열지 않는다. 편집기만 띄워 봐야
// 이 도구로 할 수 있는 일이 없다.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CodexGate>
      <App />
    </CodexGate>
  </React.StrictMode>,
)
