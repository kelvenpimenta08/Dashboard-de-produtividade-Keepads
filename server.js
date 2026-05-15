const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY;

// Rota de health check — só pra saber se o servidor está de pé
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Keepads Dashboard Backend' });
});

// Rota principal — recebe pedido do dashboard e chama Claude + ClickUp
app.post('/api/refresh', async (req, res) => {
  const { from, to } = req.body;

  if (!from || !to) {
    return res.status(400).json({ error: 'Parâmetros from e to são obrigatórios' });
  }

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada no servidor' });
  }

  if (!CLICKUP_API_KEY) {
    return res.status(500).json({ error: 'CLICKUP_API_KEY não configurada no servidor' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'mcp-client-1.0'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `Analise produtividade Keepads via ClickUp. Lista 901320419867.
Execute:
1) clickup_filter_tasks list_ids=["901320419867"] statuses=["FAZER - ROTINA JÁ"] page=0
2) clickup_filter_tasks list_ids=["901320419867"] statuses=["FEITO"] include_closed=true date_done_from="${from}" date_done_to="${to}" page=0

Some +1 por assignee. Mapeamento: "Marcos"→"Marcos Coelho" | "Pedro"→"Pedro Augusto" | "Tiago"→"Tiago Ciribeli" | "Alexandre"→"Alexandre Pires" | "Kelven"→"Kelven Pimenta" | "Ana"→"Ana Clara Rayol".

Retorne APENAS este JSON puro, sem texto adicional:
{"pend":{"Marcos Coelho":0,"Pedro Augusto":0,"Tiago Ciribeli":0,"Alexandre Pires":0,"Kelven Pimenta":0,"Ana Clara Rayol":0},"done":{"Marcos Coelho":0,"Pedro Augusto":0,"Tiago Ciribeli":0,"Alexandre Pires":0,"Kelven Pimenta":0,"Ana Clara Rayol":0}}`,
        messages: [{ role: 'user', content: 'JSON agora.' }],
        mcp_servers: [{
          type: 'url',
          url: 'https://mcp.clickup.com/mcp',
          name: 'clickup',
          authorization_token: CLICKUP_API_KEY
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro Anthropic:', data);
      return res.status(500).json({ error: 'Erro ao chamar Claude', detail: data });
    }

    // Extrai o texto da resposta
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // Tenta extrair o JSON da resposta
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(500).json({ error: 'Claude não retornou JSON válido', raw: text });
    }

    const parsed = JSON.parse(match[0]);
    res.json(parsed);

  } catch (err) {
    console.error('Erro interno:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Keepads Backend rodando na porta ${PORT}`);
});
