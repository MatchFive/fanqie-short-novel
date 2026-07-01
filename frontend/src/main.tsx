import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './App';
import { useAppStore } from './stores/appStore';
import './index.css';

/** 监听 appStore 中的 theme 状态，同步到 document.documentElement */
function ThemeSync() {
  const theme = useAppStore((s) => s.theme);
  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);
  return null;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
    <ThemeSync />
  </React.StrictMode>,
);
