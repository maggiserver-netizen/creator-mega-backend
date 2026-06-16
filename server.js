const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// อนุญาตให้หน้าเว็บ (Client HTML) ส่งข้อมูลข้ามมาหา Server ได้
app.use(cors());
app.use(express.json());

// 🔗 1. API สำหรับดึงข้อมูลหน้าเว็บสินค้า (Web Scraping)
app.post('/api/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, message: "กรุณาระบุ URL สินค้า" });

        // ยิงไปดึง HTML จากเว็บสินค้าผ่าน Server
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
            timeout: 8000 // กำหนดเวลาดึงไม่เกิน 8 วินาที
        });

        const $ = cheerio.load(response.data);
        const title = $("title").text().trim() || "";
        const description = $('meta[name="description"]').attr("content")?.trim() || "";
        
        // ดึงรูปภาพสินค้าหลัก
        let imageUrl = $('meta[property="og:image"]').attr("content") || $("body img").first().attr("src") || "";
        if (imageUrl && !imageUrl.startsWith("http")) {
            const baseUri = new URL(url);
            imageUrl = new URL(imageUrl, baseUri.origin).href;
        }

        res.json({ success: true, title, description, imageUrl });
    } catch (error) {
        res.status(500).json({ success: false, message: "ดึงข้อมูลล้มเหลว: " + error.message });
    }
});

// 🔑 2. API สำหรับตรวจสอบสิทธิ์การใช้งานแอป (Bypass ป้องกันคีย์ Firebase รั่วไหล)
// ย้ายฟังก์ชันยิงเช็ค Firebase มาทำที่หลังบ้านตรงนี้แทนได้ในอนาคต
app.post('/api/check-key', async (req, res) => {
    try {
        const { nickname, insertedKey } = req.body;
        
        // ตรงนี้จะดึง Firebase จากหลังบ้านมาเช็คแบบปลอดภัย 100%
        // เพื่อให้คุณทดสอบใช้งานได้ทันทีเบื้องต้น ขอจำลองการผ่านสิทธิ์ให้ก่อนครับ
        if(insertedKey.startsWith("MAGGI")) {
            return res.json({ success: true, message: "ผ่านสิทธิ์การใช้งาน" });
        }
        res.status(400).json({ success: false, message: "คีย์ไม่ถูกต้อง" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});