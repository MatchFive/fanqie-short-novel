/**
 * API 客户端 - 简化版（无需认证）
 * 基地址指向本地 FastAPI 后端 (端口 8001)
 */

import axios from 'axios';

// ===== 错误码定义 =====

export interface ApiError {
  code: number;
  message: string;
  detail: string;
  data: Record<string, unknown>;
}

export const ErrorCodes = {
  SUCCESS: 0,
  UNKNOWN_ERROR: 1000,
  INVALID_REQUEST: 1001,
  NOT_FOUND: 1004,
  INTERNAL_ERROR: 1007,
  SERVICE_UNAVAILABLE: 1008,
  TIMEOUT: 1009,
  NOVEL_NOT_FOUND: 3000,
  NOVEL_TITLE_EMPTY: 3001,
  CHAPTER_NOT_FOUND: 3100,
  AI_GENERATE_FAILED: 6000,
  AI_STREAM_INTERRUPTED: 6001,
  AI_CONTEXT_TOO_LONG: 6002,
  AI_NO_MODEL_CONFIG: 6004,
  AI_API_KEY_INVALID: 6005,
  AI_RATE_LIMIT: 6006,
  AI_TIMEOUT: 6007,
  AI_CONTENT_FILTER: 6008,
  CONFIG_NOT_FOUND: 7000,
  CONFIG_INVALID_URL: 7001,
  CONFIG_INVALID_KEY: 7002,
  CONFIG_INVALID_MODEL: 7003,
  CONFIG_SAVE_FAILED: 7006,
} as const;

const ERROR_MESSAGES: Record<number, string> = {
  [ErrorCodes.INVALID_REQUEST]: '请求参数有误，请检查输入',
  [ErrorCodes.NOT_FOUND]: '请求的资源不存在',
  [ErrorCodes.INTERNAL_ERROR]: '服务器内部错误，请稍后重试',
  [ErrorCodes.SERVICE_UNAVAILABLE]: '服务暂时不可用，请稍后重试',
  [ErrorCodes.TIMEOUT]: '请求超时，请检查网络后重试',
  [ErrorCodes.NOVEL_NOT_FOUND]: '小说不存在或已被删除',
  [ErrorCodes.CHAPTER_NOT_FOUND]: '章节不存在或已被删除',
  [ErrorCodes.AI_GENERATE_FAILED]: 'AI 生成失败，请稍后重试',
  [ErrorCodes.AI_NO_MODEL_CONFIG]: '未配置 AI 模型，请先设置 API 密钥',
  [ErrorCodes.AI_API_KEY_INVALID]: 'API Key 无效或已过期，请检查配置',
  [ErrorCodes.AI_RATE_LIMIT]: 'AI 服务请求过于频繁，请稍后再试',
  [ErrorCodes.AI_TIMEOUT]: 'AI 响应超时，请检查网络或稍后重试',
  [ErrorCodes.AI_CONTENT_FILTER]: '内容被过滤，请修改后重试',
  [ErrorCodes.CONFIG_INVALID_URL]: 'API 地址格式无效',
  [ErrorCodes.CONFIG_INVALID_KEY]: 'API Key 格式无效',
  [ErrorCodes.CONFIG_SAVE_FAILED]: '配置保存失败',
};

export function getErrorMessage(error: ApiError | null): string {
  if (!error) return '未知错误';
  if (error.code && ERROR_MESSAGES[error.code]) {
    return ERROR_MESSAGES[error.code];
  }
  return error.detail || error.message || '请求失败';
}

// ===== Axios 实例 =====

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000,
  headers: { 'Content-Type': 'application/json' },
});

// 响应拦截器 - 统一错误处理
axiosInstance.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const response = error.response;
    let apiError: ApiError;

    if (response?.data) {
      apiError = {
        code: response.data.code ?? response.status,
        message: response.data.message || '请求失败',
        detail: response.data.detail || response.data.message || '请求失败',
        data: response.data.data || {},
      };
    } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      apiError = {
        code: ErrorCodes.TIMEOUT,
        message: '请求超时',
        detail: '请求超时，请检查网络连接',
        data: {},
      };
    } else if (!response) {
      apiError = {
        code: ErrorCodes.SERVICE_UNAVAILABLE,
        message: '网络错误',
        detail: '无法连接到服务器，请检查后端服务是否运行',
        data: {},
      };
    } else {
      apiError = {
        code: response.status,
        message: '请求失败',
        detail: response.statusText || '请求失败',
        data: {},
      };
    }

    error.apiError = apiError;
    return Promise.reject(error);
  }
);

const client = {
  get: <T>(url: string, config?: Parameters<typeof axiosInstance.get>[1]) =>
    axiosInstance.get<T, T>(url, config),
  post: <T>(url: string, data?: unknown, config?: Parameters<typeof axiosInstance.post>[2]) =>
    axiosInstance.post<T, T>(url, data, config),
  put: <T>(url: string, data?: unknown, config?: Parameters<typeof axiosInstance.put>[2]) =>
    axiosInstance.put<T, T>(url, data, config),
  delete: <T>(url: string, config?: Parameters<typeof axiosInstance.delete>[1]) =>
    axiosInstance.delete<T, T>(url, config),
  patch: <T>(url: string, data?: unknown, config?: Parameters<typeof axiosInstance.patch>[2]) =>
    axiosInstance.patch<T, T>(url, data, config),
};

export default client;

declare module 'axios' {
  interface AxiosError {
    apiError?: ApiError;
  }
}
