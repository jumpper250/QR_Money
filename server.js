require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(cors());

// ตั้งค่าเชื่อมต่อ Database จาก Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ทดสอบหน้าแรกของ Server
app.get('/', (req, res) => {
  res.send('JumpBear Shop Backend is running!');
});

// API สำหรับตรวจสอบสลิปและบันทึกออร์เดอร์
app.post('/api/checkout', async (req, res) => {
  try {
    const { customer_name, amount, image_base64 } = req.body;

    // 1. ส่งข้อมูลสลิปไปตรวจสอบที่ SlipOK API
    const slipokResponse = await fetch(`https://api.slipok.com/api/line/apikey/${process.env.SLIPOK_BRANCH_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.SLIPOK_API_KEY
      },
      body: JSON.stringify({
        image: image_base64,
        amount: amount
      })
    });

    const slipResult = await slipokResponse.json();

    // ตรวจสอบว่าสลิปถูกต้องตามเงื่อนไขของ SlipOK หรือไม่
    if (!slipResult.success) {
      return res.status(400).json({ success: false, message: 'สลิปไม่ถูกต้อง หรือตรวจสอบไม่ผ่าน', detail: slipResult });
    }

    // 2. ถ้าสลิปผ่าน บันทึกข้อมูลลงฐานข้อมูล Supabase (ตัวอย่างการinsert)
    const query = 'INSERT INTO orders (customer_name, amount, status) VALUES ($1, $2, $3) RETURNING *';
    const values = [customer_name, amount, 'PAID'];
    const dbResult = await pool.query(query, values);

    res.status(200).json({ 
      success: true, 
      message: 'ตรวจสอบสลิปและบันทึกคำสั่งซื้อสำเร็จ',
      slipData: slipResult.data,
      order: dbResult.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});