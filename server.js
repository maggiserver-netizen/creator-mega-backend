const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());

const serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://maggi-chat-c12ed-default-rtdb.firebaseio.com"
    });
}

const db = admin.apps.length ? admin.database() : null;
