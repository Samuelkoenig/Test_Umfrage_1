// server.js
const express = require('express');
//const fetch = require('node-fetch');
const WebSocket = require('ws');
const cors = require('cors');

// Lade Umgebungsvariablen (DIRECT_LINE_SECRET)
require('dotenv').config();

const DIRECT_LINE_SECRET = process.env.DIRECT_LINE_SECRET;
if (!DIRECT_LINE_SECRET) {
    console.error("Bitte DIRECT_LINE_SECRET in der .env-Datei setzen.");
    process.exit(1);
}

const app = express();
app.use(express.json());
app.use(express.static('public')); // Stellt index.html, chatbot.js, chatbot.css bereit
app.use(cors());

// In-Memory Speicherung der Konversationsdaten
// Struktur: conversationStore[conversationId] = { socket, messages: [], resolveNextMessage: null }
const conversationStore = {};

// Hilfsfunktion: Erstellt eine neue Konversation über die Direct Line API
async function startConversation() {
    const response = await fetch('https://directline.botframework.com/v3/directline/conversations', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${DIRECT_LINE_SECRET}`
        }
    });
    if (!response.ok) {
        throw new Error(`Fehler beim Starten der Konversation: ${response.status}`);
    }
    const data = await response.json();
    //console.log('Antwort der API:', data);
    return data; // Enthält conversationId, streamUrl, expires_in, etc.
}

// Hilfsfunktion: Öffnet einen WebSocket zum streamUrl und hört auf neue Aktivitäten
function connectWebSocket(conversationId, streamUrl) {
    const ws = new WebSocket(streamUrl);

    ws.on('open', () => {
        console.log(`WebSocket für Konversation ${conversationId} geöffnet.`);
    });

    ws.on('message', (data) => {
        const activitySet = JSON.parse(data);
        if (activitySet && activitySet.activities) {
            for (const activity of activitySet.activities) {
                // Wir interessieren uns für Nachrichten vom Bot
                if (activity.from && activity.from.role === 'bot') {
                    conversationStore[conversationId].messages.push(activity);

                    // Falls jemand gerade auf die nächste Bot-Nachricht wartet, löse das Promise auf
                    if (conversationStore[conversationId].resolveNextMessage) {
                        const resolve = conversationStore[conversationId].resolveNextMessage;
                        conversationStore[conversationId].resolveNextMessage = null;
                        resolve(activity);
                    }
                }
            }
        }
    });

    ws.on('error', (err) => {
        console.error(`WebSocket-Fehler für Konversation ${conversationId}:`, err);
    });

    ws.on('close', () => {
        console.log(`WebSocket für Konversation ${conversationId} geschlossen.`);
    });

    return ws;
}

// Hilfsfunktion: Sendet eine Nachricht an den Bot
async function sendUserMessage(conversationId, text) {
    const url = `https://directline.botframework.com/v3/directline/conversations/${conversationId}/activities`;
    const activity = {
        type: 'message',
        from: { id: 'user' },
        text: text
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${DIRECT_LINE_SECRET}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(activity)
    });

    if (!response.ok) {
        throw new Error(`Fehler beim Senden der Nachricht: ${response.status}`);
    }
    const data = await response.json();
    return data; // Enthält id der gesendeten Aktivität
}

// Hilfsfunktion: Wartet auf die nächste Bot-Nachricht nach einer gesendeten Nachricht
function waitForNextBotMessage(conversationId) {
    return new Promise((resolve) => {
        // Wenn es schon ungelesene Bot-Nachrichten gibt, nimm die nächste
        const store = conversationStore[conversationId];
        //console.log('Test conversation start 1b')
        //console.log(`Store: ${store.messages.length}`);
        if (store.messages.length > 0) {
            const msg = store.messages.shift();
            return resolve(msg);
        }
        // Sonst warte auf die nächste eingehende Nachricht
        store.resolveNextMessage = resolve;
    });
}

// Route zum Starten einer Konversation und Abrufen der Willkommensnachricht
app.get('/api/startConversation', async (req, res) => {
    try {
        const data = await startConversation();
        const { conversationId, streamUrl } = data;

        // WebSocket-Verbindung aufbauen und in der Konversation speichern
        conversationStore[conversationId] = {
            socket: connectWebSocket(conversationId, streamUrl),
            messages: [],
            resolveNextMessage: null
        };

        //console.log('Test conversation start 1')

        // Warte auf die erste Bot-Nachricht (Willkommensnachricht)
        const welcomeMessage = await waitForNextBotMessage(conversationId);

        //console.log('Test conversation start 2')

        res.json({
            conversationId,
            welcomeMessage: welcomeMessage.text || "Willkommen beim Chatbot!"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fehler beim Starten der Konversation' });
    }
});

// Route zum Senden einer Nutzernachricht und Empfangen der nächsten Bot-Antwort
app.post('/api/sendMessage', async (req, res) => {
    const { conversationId, text } = req.body;
    if (!conversationId || !text) {
        return res.status(400).json({ error: 'conversationId und text erforderlich' });
    }

    try {
        // Nachricht an den Bot senden
        await sendUserMessage(conversationId, text);

        // Auf nächste Bot-Nachricht warten
        const botMessage = await waitForNextBotMessage(conversationId);

        res.json({ botMessage: botMessage.text });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fehler beim Senden der Nachricht oder Empfangen der Antwort' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
