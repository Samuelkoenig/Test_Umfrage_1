// server.js
require('dotenv').config(); 
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const crypto = require('crypto');

const app = express();

app.use(bodyParser.json());
app.use(express.static('frontend'));

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

app.get('/generateParticipantId', async (req, res) => {
    try {
        const participantID = await generateUniqueParticipantId();
        res.json({ participantID: participantID });
    } catch (error) {
        console.error('Fehler beim Generieren der ParticipantID:', error);
        res.status(500).json({ error: 'Interner Serverfehler.' });
    }
});

app.post('/submit', async (req, res) => {
    const { participantID, gender, experience, satisfaction } = req.body;
    if (!participantID || !gender || !experience || !satisfaction) {
        return res.status(400).json({ error: 'Alle Felder sind erforderlich.' });
    }

    try {
        const query = `
            INSERT INTO survey_responses (participant_id, gender, experience, satisfaction)
            VALUES ($1, $2, $3, $4)
        `;
        const values = [participantID, gender, experience, satisfaction];
        await pool.query(query, values);
        res.sendStatus(200);
    } catch (error) {
        console.error('Fehler beim Einfügen der Daten:', error);
        res.status(500).json({ error: 'Interner Serverfehler.' });
    }
});

app.get('/config', (req, res) => {
    const secret = process.env.CHATBOT_SECRET || '';
    res.json({ secret: secret });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
