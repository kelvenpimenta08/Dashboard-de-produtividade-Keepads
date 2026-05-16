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
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: 'Retorne apenas este JSON sem texto adicional: {"pend":{"Marcos Coelho":5,"Pedro Augusto":3},"done":{"Marcos Coelho":2,"Pedro Augusto":1}}',
    messages: [{ role: 'user', content: 'JSON agora.' }]
  };

  try {
    var r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    var data = await r.json();

    if (!r.ok) return res.status(500).json({ error: 'Erro Anthropic', status: r.status, detail: data });

    var text = (data.content || []).filter(function(b) { return b.type === 'text'; }).map(function(b) { return b.text; }).join('');
    var match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'JSON invalido', raw: text });

    return res.status(200).json(JSON.parse(match[0]));
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
