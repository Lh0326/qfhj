/**
 * ChineseBridge AI Proxy Server
 * 解决前端直接调用 DeepSeek API 的 CORS 问题
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const apiData = require('../data/key.json');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS 配置
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json());

// DeepSeek API 配置
const DEEPSEEK_BASE_URL = apiData.deepseekBaseUrl || 'https://api.deepseek.com';
const DEEPSEEK_API_KEY = apiData.deepseekApiKey;

// AI 聊天接口代理
app.post('/api/chat', async (req, res) => {
  const { messages, temperature = 0.7, max_tokens = 2000 } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    console.log('[Proxy] Received chat request, messages:', messages.length);

    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        temperature,
        max_tokens,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Proxy] API Error:', response.status, errorData);
      return res.status(response.status).json(errorData);
    }

    const data = await response.json();
    console.log('[Proxy] Response received, choices:', data.choices?.length || 0);

    res.json(data);
  } catch (error) {
    console.error('[Proxy] Request failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    apiConfigured: !!DEEPSEEK_API_KEY,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║           ChineseBridge AI Proxy Server               ║
╠═══════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}              ║
║  API Key configured: ${DEEPSEEK_API_KEY ? 'Yes' : 'No '}                            ║
║  Target API: ${DEEPSEEK_BASE_URL}           ║
╚═══════════════════════════════════════════════════════╝
  `);
});
