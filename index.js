require('dotenv').config({ path: './apikey.env' });
const PORT = process.env.PORT || 24353;
const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');

const app = express();
app.use(express.json());

const openaiApiKey = process.env.OPENAI_API_KEY;
const originalDbPath = 'C:/Users/amaie/OneDrive/Documents/Official_legaldoc_database.txt';
const compiledDbDir = 'public'; // Directory to store compiled database
const compiledDbFilename = 'compiled_database_with_templates.json'; // File name for compiled database
const compiledDbPath = path.join(compiledDbDir, compiledDbFilename);
const maxRetries = 3; // Maximum retries for API requests

async function readOriginalDatabase(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading or parsing database:', error);
        throw error;
    }
}

async function generateTemplate(documentName, attempt = 0) {
    try {
        const response = await axios.post('https://api.openai.com/v1/engines/davinci-codex/completions', {
            prompt: `Create a professional template for ${documentName}`,
            max_tokens: 500
        }, {
            headers: { 'Authorization': `Bearer ${openaiApiKey}` }
        });
        return response.data.choices[0].text;
    } catch (error) {
        if (attempt < maxRetries) {
            return await generateTemplate(documentName, attempt + 1); // Retry
        } else {
            console.error('Error generating template after retries:', error);
            return `Failed to generate template for ${documentName}`; // Fallback response
        }
    }
}

async function compileDatabase(originalDb) {
    const newDb = {};
    for (const category in originalDb) {
        newDb[category] = {};
        for (const docType of Object.keys(originalDb[category])) {
            const template = await generateTemplate(docType);
            newDb[category][docType] = { template };
        }
    }
    await fs.writeFile(compiledDbPath, JSON.stringify(newDb, null, 2), 'utf8');
    return compiledDbPath;
}

app.get('/generate-database', async (req, res) => {
    try {
        const originalDb = await readOriginalDatabase(originalDbPath);
        const filePath = await compileDatabase(originalDb);
        res.json({ message: 'Database compiled successfully', downloadLink: `http://${os.hostname()}:${PORT}/${compiledDbFilename}` });
    } catch (error) {
        res.status(500).send(`Error in generating database: ${error.message}`);
    }
});
app.post('/executeScript', async (req, res) => {
    try {
        const originalDb = await readOriginalDatabase(originalDbPath);
        const filePath = await compileDatabase(originalDb);
        res.json({ 
            message: 'Script executed successfully with database', 
            downloadLink: `http://${os.hostname()}:${PORT}/${compiledDbFilename}` 
        });
    } catch (error) {
        console.error('Error in executing script:', error);
        res.status(500).send(`Error in executing script: ${error.message}`);
    }
});