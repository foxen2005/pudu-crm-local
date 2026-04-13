require('dotenv').config();
const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const ORG_ID = process.env.ORG_ID;

let qrDataUrl = null;
let isReady = false;
let clientPhone = null;

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--disable-gpu'],
    },
});

client.on('qr', async (qr) => {
    console.log('[WA] QR generado');
    qrDataUrl = await qrcode.toDataURL(qr);
    isReady = false;
});
client.on('authenticated', () => { console.log('[WA] Autenticado ✓'); qrDataUrl = null; });
client.on('ready', () => { isReady = true; qrDataUrl = null; clientPhone = client.info?.wid?.user ?? null; console.log(`[WA] Listo ✓ — ${clientPhone}`); });
client.on('auth_failure', (msg) => { console.error('[WA] Auth error:', msg); isReady = false; });
client.on('disconnected', (reason) => { console.warn('[WA] Desconectado:', reason); isReady = false; clientPhone = null; });

client.on('message', async (msg) => {
    if (msg.from === 'status@broadcast' || msg.from.includes('@g.us') || msg.fromMe) return;
    const fromPhone = msg.from.replace('@c.us', '');
    const body = msg.body;
    const notifyName = msg._data?.notifyName ?? fromPhone;
    try {
        const { data: existing } = await supabase.from('whatsapp_conversations').select('id').eq('org_id', ORG_ID).eq('contact_phone', fromPhone).order('created_at', { ascending: false }).limit(1).maybeSingle();
        let conversationId = existing?.id;
        if (!conversationId) {
            const { data: newConv, error: convErr } = await supabase.from('whatsapp_conversations').insert({ org_id: ORG_ID, contact_phone: fromPhone, contact_nombre: notifyName, status: 'open' }).select('id').single();
            if (convErr) { console.error('[WA] Error conv:', convErr.message); return; }
            conversationId = newConv.id;
        }
        await supabase.from('whatsapp_messages').insert({ org_id: ORG_ID, conversation_id: conversationId, wamid: msg.id.id, direction: 'inbound', body, status: 'received', sent_by_nombre: null });
        await supabase.from('whatsapp_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId);
    } catch (err) { console.error('[WA] Error:', err.message); }
});

const app = express();
app.use(cors());
app.use(express.json());

app.get('/status', (req, res) => res.json({ connected: isReady, phone: clientPhone, qrPending: !!qrDataUrl }));
app.get('/qr', (req, res) => { if (!qrDataUrl) return res.status(404).json({ error: isReady ? 'Ya conectado' : 'QR no disponible aún' }); res.json({ qr: qrDataUrl }); });
app.post('/send', async (req, res) => {
    const { conversationId, phone, body, orgId, senderNombre } = req.body;
    if (!isReady) return res.status(503).json({ error: 'WhatsApp no conectado' });
    if (!phone || !body) return res.status(400).json({ error: 'phone y body requeridos' });
    try {
        const chatId = `${phone.replace(/[^0-9]/g, '')}@c.us`;
        await client.sendMessage(chatId, body);
        const { data: msgRow, error: dbErr } = await supabase.from('whatsapp_messages').insert({ org_id: orgId ?? ORG_ID, conversation_id: conversationId, wamid: null, direction: 'outbound', body, status: 'sent', sent_by_nombre: senderNombre ?? 'Agente' }).select().single();
        if (dbErr) return res.status(500).json({ error: dbErr.message });
        await supabase.from('whatsapp_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId);
        res.json({ ok: true, data: msgRow });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => { console.log(`\n🟢 Pudu WA Server en http://localhost:${PORT}`); client.initialize(); });
