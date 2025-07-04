import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');

  const handleAsk = async () => {
    const res = await window.electronAPI.askGemini(prompt);
    setResponse(res);
  };

  return (
    <div style={{ padding: 20, background: '#111', color: '#fff', height: '100%' }}>
      <input
        style={{ width: '100%', padding: 10, fontSize: 16 }}
        placeholder="Ask Gemini anything..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
      />
      <div style={{ marginTop: 20, whiteSpace: 'pre-wrap' }}>{response}</div>
    </div>
  );
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
