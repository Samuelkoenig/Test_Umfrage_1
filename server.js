require('dotenv').config(); 
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const crypto = require('crypto');
const path = require('path');
const axios = require('axios');

const app = express();

app.use(bodyParser.json());
app.use(express.static('public'));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.connect((err, client, release) => {
    if (err) {
        return console.error('Fehler beim Verbinden zur Datenbank:', err.stack);
    }
    console.log('Erfolgreich mit der Datenbank verbunden');
    release();
});

// Funktion zur Generierung einer eindeutigen ParticipantId
async function generateUniqueParticipantId() {
    while (true) {
        const id = createParticipantId();
        const result = await pool.query('SELECT participant_id FROM survey_responses WHERE participant_id = $1', [id]);
        if (result.rows.length === 0) {
            return id;
        }
    }
}

function createParticipantId() {
    const prefix = 'ID-';
    const randomBytes = crypto.randomBytes(8);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomStr = '';
    for (let i = 0; i < 15; i++) {
        const randomIndex = randomBytes[i % randomBytes.length] % chars.length;
        randomStr += chars.charAt(randomIndex);
    }

    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');

    const timestamp = `${month}${day}${hour}${minute}${second}${ms}`;
    return prefix + randomStr + timestamp;
}

function assignGroup() {
  const treatment = Math.random() < 0.5 ? 0 : 1;
  return treatment;
}

app.get('/generateSurveyData', async (req, res) => {
    try {
        const participantId = await generateUniqueParticipantId();
        const treatmentGroup = assignGroup();
        res.json({ 
          participantId: participantId, 
          treatmentGroup: treatmentGroup
         });
    } catch (error) {
        console.error('Fehler beim Generieren der participantId oder treatmentGroup:', error);
        res.status(500).json({ error: 'Interner Serverfehler.' });
    }
});

app.post('/submit', async (req, res) => {
    const { participantId, treatmentGroup, conversationLog, ...responseData } = req.body;
    if (!participantId || !treatmentGroup || !conversationLog) {
      return res.status(400).json({ error: 'Alle Felder sind erforderlich.' });
    }

    try {
      const query = `
      INSERT INTO survey_responses (participant_id, treatment_group, response_data, conversation_log)
      VALUES ($1, $2, $3, $4)
    `;
    const values = [participantId, treatmentGroup, JSON.stringify(responseData), conversationLog];
    await pool.query(query, values);
    res.sendStatus(200);
    } catch (error) {
        console.error('Fehler beim Einfügen der Daten:', error);
        res.status(500).json({ error: 'Interner Serverfehler.' });
    }
});

// Chatbot-spezifische Endpunkte integrieren
const DIRECT_LINE_SECRET = process.env.DIRECT_LINE_SECRET;
if (!DIRECT_LINE_SECRET) {
    console.error("DIRECT_LINE_SECRET not set in environment variables");
    process.exit(1);
}
const DIRECT_LINE_BASE = "https://europe.directline.botframework.com/v3/directline";

app.post('/startconversation', async (req, res) => {
  const { treatmentGroup } = req.body; 
  try {
    const response = await axios.post(`${DIRECT_LINE_BASE}/conversations`, {}, {
      headers: {
        'Authorization': `Bearer ${DIRECT_LINE_SECRET}`,
        'Content-Type': 'application/json'
      }
    });
    const data = response.data;
    const activity = {
      type: "conversationUpdate",
      membersAdded: [{ id: "user1" }],
      from: { id: "Test_Chatbot_1" },
      channelData: { treatmentGroup: treatmentGroup }
    };
    await axios.post(`${DIRECT_LINE_BASE}/conversations/${data.conversationId}/activities`, activity, {
      headers: {
        'Authorization': `Bearer ${DIRECT_LINE_SECRET}`,
        'Content-Type': 'application/json'
      }
    });
    res.json(data);
  } catch (err) {
    console.error("Error when starting the conversation:", err);
    res.status(500).send("Fehler beim Starten der Konversation");
  }
});

app.post('/getactivities', async (req, res) => {
  const { conversationId, watermark, treatmentGroup } = req.body;
  let url = `${DIRECT_LINE_BASE}/conversations/${conversationId}/activities`;
  if (watermark) {
    url += `?watermark=${watermark}`;
  }
  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${DIRECT_LINE_SECRET}`
      }
    });
    const data = response.data;
    data.treatmentGroup = treatmentGroup;
    res.json(response.data);
  } catch (err) {
    console.error("Error when retrieving the activities:", err);
    res.status(500).send("Fehler beim Abrufen der Aktivitäten");
  }
});

app.post('/sendmessage', async (req, res) => {
  const { conversationId, text, treatmentGroup } = req.body;
  const activity = {
    type: "message",
    from: { id: "user1" },
    text,
    channelData: { treatmentGroup: treatmentGroup }
  };
  try {
    const response = await axios.post(`${DIRECT_LINE_BASE}/conversations/${conversationId}/activities`, activity, {
      headers: {
        'Authorization': `Bearer ${DIRECT_LINE_SECRET}`,
        'Content-Type': 'application/json'
      }
    });
    res.json(response.data);
  } catch (err) {
    console.error("Error when sending the message:", err);
    res.status(500).send("Fehler beim Senden der Nachricht");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
