// server.js
require('dotenv').config(); // Lädt Umgebungsvariablen aus der .env-Datei
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg'); // PostgreSQL-Client

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(express.static('frontend')); // Ordner für statische Dateien

// PostgreSQL Pool konfigurieren
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Testverbindung zur Datenbank
pool.connect((err, client, release) => {
    if (err) {
        return console.error('Fehler beim Verbinden zur Datenbank:', err.stack);
    }
    console.log('Erfolgreich mit der Datenbank verbunden');
    release();
});

// Endpoint zum Empfangen der Daten
app.post('/submit', async (req, res) => {
    const { participantID, gender, experience, satisfaction } = req.body;

    // Validierung der Eingabedaten
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

// Server starten
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
