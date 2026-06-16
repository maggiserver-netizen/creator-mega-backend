const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
        });
        console.log("🎯 เชื่อมต่อ Firebase Admin SDK สำเร็จแล้ว!");
    } else {
        console.warn("⚠️ ไม่พบระบบ FIREBASE_SERVICE_ACCOUNT ใน Environment");
    }
} catch (error) {
    console.error("❌ เกิดข้อผิดพลาดในการตั้งค่า Firebase:", error);
}

const db = admin.apps.length ? admin.database() : null;

app.post('/api/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, message: "กรุณาส่งลิงก์ URL มาด้วยครับ" });

        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 8000
        });

        const $ = cheerio.load(response.data);
        const title = $("title").text().trim() || "";
        const description = $('meta[name="description"]').attr('content') || "";
        let imageUrl = $('meta[property="og:image"]').attr('content') || "";

        if (imageUrl && !imageUrl.startsWith("http")) {
            const baseUri = new URL(url);
            imageUrl = new URL(imageUrl, baseUri.origin).href;
        }

        res.json({ success: true, title, description, imageUrl });
    } catch (error) {
        res.status(500).json({ success: false, message: "ไม่สามารถดึงข้อมูลจากลิงก์นี้ได้อัตโนมัติ" });
    }
});

app.post('/api/check-key', async (req, res) => {
    try {
        const { nickname, insertedKey } = req.body;

        if (!db) {
            return res.status(500).json({ success: false, message: "ระบบฐานข้อมูลหลังบ้านยังไม่เปิดใช้งาน" });
        }

        const keySnapshot = await db.ref(`active_keys/${insertedKey}`).once("value");
        
        if (!keySnapshot.exists()) {
            return res.status(400).json({ success: false, message: "ไม่พบคีย์นี้ในระบบ กรุณาตรวจสอบอีกครั้งครับ" });
        }

        const keyData = keySnapshot.val();

        if (keyData.isActive !== true) {
            return res.status(400).json({ success: false, message: "คีย์นี้ถูกระงับการใช้งานชั่วคราว" });
        }

        return res.json({ success: true, message: "ผ่านสิทธิ์การใช้งานสำเร็จ", data: keyData });

    } catch (error) {
        console.error("Firebase Error:", error);
        res.status(500).json({ success: false, message: "เซิร์ฟเวอร์ขัดข้องในการเชื่อมต่อฐานข้อมูล" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
