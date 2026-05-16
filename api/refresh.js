module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { from, to } = req.body;

  if (!from || !to) {
    return res.status(400).json({ error: 'Parâmetros from e to são obrigatórios' });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const CLICKUP_API_KEY   = process.env.CLICKUP_API_KEY;

  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada' });
  if (!CLICKUP_API_KEY)   return res.status(500).json({ error: 'CLICKUP_API_KEY não configurada' });

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
      return res.status(500).json({ error: 'Erro ao chamar Claude', status: response.status, detail: data });
    }

    console.log('Resposta Anthropic:', JSON.stringify(data).substring(0, 500));
    }

    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'Resposta inválida do Claude', raw: text });

    res.status(200).json(JSON.parse(match[0]));

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
