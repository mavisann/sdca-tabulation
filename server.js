require('dotenv').config();

const express = require('express');
const path = require('path');

const app = express();
const publicDirectory = path.join(__dirname, 'public');

app.get('/api/config', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL || null,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null
    });
});

app.use(express.static(publicDirectory));

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(publicDirectory, 'mr_ms_sdca_tabulation.html'));
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
    console.log(`SDCA Tabulation server listening on port ${port}`);
});
