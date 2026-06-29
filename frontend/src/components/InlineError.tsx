import { AlertCircle, RefreshCw } from 'lucide-react';

interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

/** 内联错误提示 — 用于页面级数据加载失败时展示 */
export function InlineError({ message, onRetry, className = '' }: InlineErrorProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 gap-3 ${className}`}>
      <AlertCircle className="w-8 h-8 text-[#DC2626] opacity-60" />
      <p className="text-xs text-muted-foreground text-center max-w-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1.5 text-xs border border-foreground hover:bg-hover cursor-pointer inline-flex items-center gap-1.5"
        >
          <RefreshCw className="w-3 h-3" /> 重试
        </button>
      )}
    </div>
  );
}
