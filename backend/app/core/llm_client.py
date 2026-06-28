"""
LLM 客户端封装
支持 OpenAI 兼容格式的 API（DeepSeek / 通义千问 / 智谱 等）
"""

import json
import logging
from typing import AsyncGenerator, Dict, List, Optional, Any

import httpx

logger = logging.getLogger("fanqie_novel.llm")


class LLMClient:
    """LLM HTTP 客户端"""

    def __init__(
        self,
        base_url: str = "https://api.deepseek.com",
        api_key: str = "",
        model: str = "deepseek-v4-flash",
        temperature: float = 0.7,
        max_tokens: int = 4000,
        timeout: float = 120.0,
    ):
        url = base_url.rstrip("/")
        if not url.endswith("/v1"):
            url = f"{url}/v1"
        self.base_url = url
        self.api_key = api_key
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.timeout = timeout

        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json; charset=utf-8",
            "Accept": "application/json; charset=utf-8",
        }

    def _build_payload(
        self, messages: List[Dict[str, str]], stream: bool = False,
        temperature: Optional[float] = None, max_tokens: Optional[int] = None, **extra,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "stream": stream,
        }
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
        elif self.max_tokens:
            payload["max_tokens"] = self.max_tokens
        if temperature is not None:
            payload["temperature"] = temperature
        elif self.temperature is not None:
            payload["temperature"] = self.temperature
        payload.update(extra)
        return payload

    async def chat(
        self, messages: List[Dict[str, str]], stream: bool = False,
        temperature: Optional[float] = None, max_tokens: Optional[int] = None, **extra,
    ) -> Dict[str, Any]:
        """非流式聊天调用"""
        payload = self._build_payload(messages=messages, stream=stream,
                                       temperature=temperature, max_tokens=max_tokens, **extra)
        logger.info("LLM 请求: model=%s, messages=%d", self.model, len(messages))

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self.headers, json=payload,
                )
                response.raise_for_status()
                result = response.json()
                logger.info("LLM 响应成功: tokens=%s", result.get("usage", {}))
                return result
            except httpx.HTTPStatusError as e:
                status_code = e.response.status_code
                error_body = e.response.text[:500]
                logger.error("LLM API 错误: status=%d, body=%s", status_code, error_body)
                if status_code == 401:
                    raise ValueError("API 认证失败 (401): 请检查 API Key 是否正确。")
                elif status_code == 429:
                    raise ValueError("API 请求过于频繁 (429): 请稍后再试。")
                else:
                    raise ValueError(f"API 请求失败 ({status_code}): {error_body}")
            except httpx.TimeoutException:
                raise ValueError(f"API 请求超时: 请求超过 {self.timeout} 秒未响应。")
            except httpx.ConnectError:
                raise ValueError(f"API 连接失败: 无法连接到 {self.base_url}，请检查网络。")

    async def chat_stream(
        self, messages: List[Dict[str, str]],
        temperature: Optional[float] = None, max_tokens: Optional[int] = None, **extra,
    ) -> AsyncGenerator[str, None]:
        """流式聊天调用"""
        payload = self._build_payload(messages=messages, stream=True,
                                       temperature=temperature, max_tokens=max_tokens, **extra)
        logger.info("LLM 流式请求: model=%s, messages=%d", self.model, len(messages))

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream("POST", f"{self.base_url}/chat/completions",
                                      headers=self.headers, json=payload) as response:
                try:
                    response.raise_for_status()
                except httpx.HTTPStatusError as e:
                    raise ValueError(f"API 请求失败 ({e.response.status_code})")

                async for line in response.aiter_lines():
                    line = line.strip()
                    if not line or not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        continue


class LLMService:
    """LLM 服务层"""

    def __init__(self, client: Optional[LLMClient] = None):
        self.client = client

    @classmethod
    def from_config(cls, base_url: str, api_key: str, model: str,
                     temperature: float = 0.7, max_tokens: int = 4000) -> "LLMService":
        client = LLMClient(base_url=base_url, api_key=api_key, model=model,
                           temperature=temperature, max_tokens=max_tokens)
        return cls(client=client)

    async def generate(self, system_prompt: str, user_prompt: str,
                        stream: bool = False, **kwargs) -> Any:
        if not self.client:
            raise ValueError("LLMClient 未初始化")
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        if stream:
            return self.client.chat_stream(messages, **kwargs)
        return await self.client.chat(messages, stream=False, **kwargs)
