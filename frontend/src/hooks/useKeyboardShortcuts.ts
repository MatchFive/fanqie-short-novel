import { useEffect, useCallback, useRef, useState } from 'react';

export interface ShortcutDef {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  description: string;
  handler: () => void;
  scope?: 'global' | 'write';
}

interface Options {
  enabled: boolean;
}

/**
 * 全局键盘快捷键 Hook
 *
 * 写作工作台快捷键:
 *  - Ctrl+S         保存当前章节
 *  - Ctrl+Enter     生成当前章节
 *  - Ctrl+→         下一章
 *  - Ctrl+←         上一章
 *  - ?              显示快捷键面板
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutDef[],
  options: Options = { enabled: true },
) {
  const [showShortcutPanel, setShowShortcutPanel] = useState(false);
  const savedRef = useRef(shortcuts);
  savedRef.current = shortcuts;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!options.enabled) return;

      // Ignore if user is typing in an input/textarea (except Ctrl+S)
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      for (const s of savedRef.current) {
        const ctrlMatch = s.ctrl ? (e.ctrlKey || e.metaKey) : true;
        const shiftMatch = s.shift ? e.shiftKey : true;
        const keyMatch = e.key.toLowerCase() === s.key.toLowerCase();

        if (ctrlMatch && shiftMatch && keyMatch) {
          // Ctrl+S should work even in inputs
          if (isInput && s.key !== 's') continue;
          e.preventDefault();
          s.handler();
          return;
        }
      }
    },
    [options.enabled],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { showShortcutPanel, setShowShortcutPanel };
}
