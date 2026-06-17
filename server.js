const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());

// 🛡️ เชื่อมต่อ Firebase อย่างปลอดภัยผ่าน Environment Variable
try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://maggi-chat-c12ed-default-rtdb.firebaseio.com"
        });
    }
} catch (error) {
    console.error("⚠️ Firebase initialization error: อาจจะยังไม่ได้ตั้งค่า FIREBASE_SERVICE_ACCOUNT ใน Render");
}

const db = admin.apps.length ? admin.database() : null;

// 🔗 API สำหรับสกัดข้อมูลสินค้า
app.post('/api/scrape', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, message: "กรุณาระบุ URL" });

    try {
        const response = await axios.get(url, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36" }
        });
        
        const $ = cheerio.load(response.data);
        
        // ตัวอย่างการดึงข้อมูล (ปรับแก้ให้เข้ากับโครงสร้างเว็บที่ต้องการ)
        const title = $('title').text() || "ไม่พบชื่อสินค้า";
        const image = $('meta[property="og:image"]').attr('content') || "";

        res.json({
            success: true,
            title: title,
            image: image,
            source: url
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "ดึงข้อมูลล้มเหลว: " + error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
