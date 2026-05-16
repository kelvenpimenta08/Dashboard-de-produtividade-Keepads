module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido' });

  var body = req.body;
  var from = body.from;
  var to = body.to;

  if (!from || !to) return res.status(400).json({ error: 'from e to obrigatorios' });

  var apiKey = process.env.ANTHROPIC_API_KEY;
  var cuKey = process.env.CLICKUP_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'Sem ANTHROPIC_API_KEY' });
  if (!cuKey) return res.status(500).json({ error: 'Sem CLICKUP_API_KEY' });

  var payload = {
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    system: 'Analise produtividade Keepads via ClickUp. Lista 901320419867.\nExecute:\n1) clickup_filter_tasks list_ids=["901320419867"] statuses=["FAZER - ROTINA JÁ"] page=0\n2) clickup_filter_tasks list_ids=["901320419867"] statuses=["FEITO"] include_closed=true date_done_from="' + from + '" date_done_to="' + to + '" page=0\n\nSome +1 por assignee. Mapeamento: "Marcos"→"Marcos Coelho" | "Pedro"→"Pedro Augusto" | "Tiago"→"Tiago Ciribeli" | "Alexandre"→"Alexandre Pires" | "Kelven"→"Kelven Pimenta" | "Ana"→"Ana Clara Rayol".\n\nRetorne APENAS este JSON puro:\n{"pend":{"Marcos Coelho":0,"Pedro Augusto":0,"Tiago Ciribeli":0,"Alexandre Pires":0,"Kelven Pimenta":0,"Ana Clara Rayol":0},"done":{"Marcos Coelho":0,"Pedro Augusto":0,"Tiago Ciribeli":0,"Alexandre Pires":0,"Kelven Pimenta":0,"Ana Clara Rayol":0}}',
    messages: [{ role: 'user', content: 'JSON agora.' }],
    mcp_servers: [{
      type: 'url',
      url: 'https://mcp.clickup.com/mcp',
      name: 'clickup',
      authorization_token: cuKey
    }]
  };

  try {
    var r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'mcp-client-2025-04-04'
      },
      body: JSON.stringify(payload)
    });

    var data = await r.json();

    if (!r.ok) return res.status(200).json({ error: 'Erro Anthropic', status: r.status, detail: data });

    // Retorna resposta bruta completa para debug
    return res.status(200).json({
      stop_reason: data.stop_reason,
      content_types: (data.content || []).map(function(b) { return b.type; }),
      content_raw: JSON.stringify(data.content).substring(0, 2000)
    });

  } catch(e) {
    return res.status(200).json({ error: e.message });
  }
};
