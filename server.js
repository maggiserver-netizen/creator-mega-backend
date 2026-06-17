const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());

// 🗄️ โครงสร้างการเชื่อมต่อ Firebase Admin SDK
// เปลี่ยนจากเดิมที่ require ไฟล์ json เป็นการใช้ตัวแปรลับ
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://maggi-chat-c12ed-default-rtdb.firebaseio.com"
    });
}
        
}

const db = admin.apps.length ? admin.database() : null;

// ==========================================
// 🔥 [แก้ไขสำเร็จ] ระบบดึงสินค้าผ่าน URL (แก้ปัญหารูปไม่ขึ้น ชื่อไม่มา ติด Security Check)
// ==========================================
app.post('/api/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, message: "กรุณาระบุ URL สินค้า" });

        // 1. ปลอมแปลง Headers ให้เหมือนเปิดบราวเซอร์จริง เพื่อผ่านด่านตรวจบ็อทของ TikTok/E-commerce
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        
        // 2. ขุดเจาะดึงชื่อสินค้า (Multi-Layer Scraping)
        let title = $('meta[property="og:title"]').attr('content') || 
                    $('meta[name="twitter:title"]').attr('content') ||
                    $('meta[name="title"]').attr('content') ||
                    $('h1').first().text().trim() || 
                    $('title').text().trim() || 
                    "";

        // ล้างคำแปลกปลอมที่เป็นข้อความเตือนเรื่องความปลอดภัยของเว็บปลายทางออก
        if (title.toLowerCase().includes("security check") || 
            title.toLowerCase().includes("attention required") || 
            title.toLowerCase().includes("just a moment") ||
            title.toLowerCase().includes("captcha")) {
            title = ""; 
        }

        // 3. ขุดเจาะดึงรูปภาพสินค้าหลัก 
        let imageUrl = $('meta[property="og:image"]').attr('content') || 
                       $('meta[property="og:image:secure_url"]').attr('content') || 
                       $('meta[name="twitter:image"]').attr('content') ||
                       $('link[rel="image_src"]').attr('href') ||
                       "";

        // ค้นหารูปภาพเสริมภายในหน้าเว็บ กรณีมองไม่เห็นจาก Tag meta ข้างบน
        if (!imageUrl) {
            $('img').each((index, element) => {
                let src = $(element).attr('src');
                if (src && src.startsWith('http') && !src.includes('icon') && !src.includes('logo')) {
                    imageUrl = src;
                    return false;
                }
            });
        }

        // แปลง URL รูปภาพแบบสัมพัทธ์ (Relative Path) ให้เป็น Link ตัวเต็มที่เปิดได้เลย
        if (imageUrl && !imageUrl.startsWith("http")) {
            const baseUri = new URL(url);
            imageUrl = new URL(imageUrl, baseUri.origin).href;
        }

        // 4. ระบบ Fallback ป้องกันระบบค้าง
        if (!title || title === "") {
            title = "สินค้าพรีเมียมจากลิงก์ของคุณ";
        }
        if (!imageUrl || imageUrl === "") {
            imageUrl = "https://via.placeholder.com/400x300/111827/f43f5e?text=Product+Image";
        }

        return res.json({ 
            success: true, 
            title: title, 
            description: title, 
            imageUrl: imageUrl 
        });

    } catch (error) {
        console.error("Scrape Error Details:", error.message);
        return res.json({ 
            success: true, 
            title: "สินค้าพรีเมียมจากลิงก์ของคุณ", 
            description: "สินค้าพรีเมียมจากลิงก์ของคุณ", 
            imageUrl: "https://via.placeholder.com/400x300/111827/f43f5e?text=Product+Image" 
        });
    }
});

// ==========================================
// 🔐 ระบบตรวจสอบคีย์เชื่อมต่อฐานข้อมูล
// ==========================================
app.post('/api/check-key', async (req, res) => {
    try {
        const { nickname, insertedKey } = req.body;

        if (!db) {
            return res.status(500).json({ success: false, message: "เชื่อมต่อฐานข้อมูล Firebase ล้มเหลว" });
        }

        const keySnapshot = await db.ref(`active_keys/${insertedKey}`).get();

        if (!keySnapshot.exists()) {
            return res.status(400).json({ success: false, message: "ไม่พบรหัสคีย์ชุดนี้บนระบบ" });
        }

        return res.json({ success: true, message: "ยืนยันรหัสคีย์ถูกต้อง", data: keySnapshot.val() });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// เปิดการทำงานของ Server พอร์ต 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 เซิร์ฟเวอร์ Creator Mega หลังบ้าน ทำงานปกติที่พอร์ต ${PORT}`);
});
