// API Serverless Vercel pour Demex SAV - Support Token API
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const ODOO = {
        url: process.env.ODOO_URL || '',
        db: process.env.ODOO_DB || '',
        user: process.env.ODOO_USERNAME || '',
        // Utiliser le token API si disponible, sinon le mot de passe
        apiKey: process.env.ODOO_API_KEY || '',
        pass: process.env.ODOO_PASSWORD || ''
    };

    console.log('Config check:', {
        url: !!ODOO.url,
        db: !!ODOO.db,
        user: !!ODOO.user,
        hasApiKey: !!ODOO.apiKey,
        hasPassword: !!ODOO.pass
    });

    if (!ODOO.url || !ODOO.db || !ODOO.user || (!ODOO.apiKey && !ODOO.pass)) {
        return res.status(500).json({
            success: false,
            message: 'Variables manquantes. Vérifiez ODOO_URL, ODOO_DB, ODOO_USERNAME et (ODOO_API_KEY ou ODOO_PASSWORD)'
        });
    }

    let cache = global.odooSession || { uid: null, sid: null, time: null };

    async function auth() {
        if (cache.uid && cache.time && (Date.now() - cache.time) < 3600000) {
            console.log('Using cached session');
            return cache;
        }
        
        console.log('Authenticating with', ODOO.apiKey ? 'API Key' : 'Password');
        
        try {
            const authBody = {
                jsonrpc: '2.0',
                params: {
                    db: ODOO.db,
                    login: ODOO.user,
                    password: ODOO.apiKey || ODOO.pass  // Utiliser le token en priorité
                }
            };

            const r = await fetch(`${ODOO.url}/web/session/authenticate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(authBody)
            });
            
            const d = await r.json();
            
            if (d.result?.uid) {
                cache = { 
                    uid: d.result.uid, 
                    sid: d.result.session_id, 
                    time: Date.now() 
                };
                global.odooSession = cache;
                console.log('Auth successful, UID:', cache.uid);
                return cache;
            }
            
            console.error('Auth failed:', d);
            throw new Error(d.error?.data?.message || 'Authentication failed');
        } catch (error) {
            console.error('Auth error:', error);
            throw error;
        }
    }

    async function call(model, method, args = [], kwargs = {}) {
        const s = await auth();
        
        try {
            const r = await fetch(`${ODOO.url}/web/dataset/call_kw`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Cookie': `session_id=${s.sid}` 
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: { 
                        model, 
                        method, 
                        args, 
                        kwargs: { 
                            ...kwargs, 
                            context: { lang: 'fr_FR', tz: 'Europe/Paris', ...kwargs.context }
                        }
                    }
                })
            });
            
            const d = await r.json();
            
            if (d.error) {
                console.error('Call error:', d.error);
                throw new Error(d.error.data?.message || 'Odoo error');
            }
            
            return d.result;
        } catch (error) {
            console.error(`Error ${model}.${method}:`, error);
            throw error;
        }
    }

    try {
        const { action } = req.query;
        const body = req.method === 'POST' ? req.body : {};

        if (action === 'health') {
            let odooConnected = false;
            try {
                await auth();
                odooConnected = true;
            } catch (e) {
                console.error('Health check failed:', e.message);
            }
            
            return res.json({ 
                status: 'OK', 
                timestamp: new Date().toISOString(), 
                odoo_connected: odooConnected,
                auth_method: ODOO.apiKey ? 'api_key' : 'password'
            });
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
        console.error('Handler error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
}
