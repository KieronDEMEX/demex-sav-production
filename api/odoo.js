// API Serverless Vercel pour Demex SAV
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const ODOO = {
        url: process.env.ODOO_URL,
        db: process.env.ODOO_DB,
        user: process.env.ODOO_USERNAME,
        pass: process.env.ODOO_PASSWORD
    };

    let cache = global.odooSession || { uid: null, sid: null, time: null };

    async function auth() {
        if (cache.uid && cache.time && (Date.now() - cache.time) < 3600000) return cache;
        
        const r = await fetch(`${ODOO.url}/web/session/authenticate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', params: { db: ODOO.db, login: ODOO.user, password: ODOO.pass }})
        });
        const d = await r.json();
        if (d.result?.uid) {
            cache = { uid: d.result.uid, sid: d.result.session_id, time: Date.now() };
            global.odooSession = cache;
            return cache;
        }
        throw new Error('Auth failed');
    }

    async function call(model, method, args = [], kwargs = {}) {
        const s = await auth();
        const r = await fetch(`${ODOO.url}/web/dataset/call_kw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': `session_id=${s.sid}` },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'call',
                params: { model, method, args, kwargs: { ...kwargs, context: { lang: 'fr_FR', ...kwargs.context }}}
            })
        });
        const d = await r.json();
        if (d.error) throw new Error(d.error.data?.message || 'Odoo error');
        return d.result;
    }

    try {
        const { action } = req.query;
        const body = req.method === 'POST' ? req.body : {};

        if (action === 'health') {
            return res.json({ status: 'OK', timestamp: new Date().toISOString(), odoo_connected: !!cache.uid });
        }

        if (action === 'getTickets') {
            const tickets = await call('helpdesk.ticket', 'search_read', [body.filters || []], {
                fields: ['id', 'name', 'partner_id', 'stage_id', 'priority', 'create_date'],
                limit: body.limit || 50,
                order: 'create_date DESC'
            });
            return res.json({ success: true, data: tickets });
        }

        if (action === 'getStats') {
            const tickets = await call('helpdesk.ticket', 'search_read', [[]], {
                fields: ['id', 'stage_id']
            });
            return res.json({
                success: true,
                data: {
                    total: tickets.length,
                    nouveau: tickets.filter(t => t.stage_id?.[1]?.toLowerCase().includes('nouveau')).length,
                    en_cours: tickets.filter(t => t.stage_id?.[1]?.toLowerCase().includes('cours')).length,
                    resolu: tickets.filter(t => t.stage_id?.[1]?.toLowerCase().includes('résolu')).length
                }
            });
        }

        return res.status(400).json({ success: false, message: 'Action inconnue' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}
