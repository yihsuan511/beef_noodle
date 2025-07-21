require('dotenv').config();
console.log('讀取環境變數：');
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '有密碼' : '沒有密碼');
console.log('DB_HOST:', process.env.DB_HOST);

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors({
  // origin: 'http://localhost:5500', // 你的前端 live server port
  // credentials: true
}));
app.use(express.json());

// 建立連線池
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: { rejectUnauthorized: false }
}).promise(); // promise 版

// 健康檢查
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'Member API', timestamp: new Date().toISOString() });
});

// 註冊會員
app.post('/api/member/register', async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ error: '姓名、電話、密碼為必填' });
    }

    const [exists] = await pool.query('SELECT phone FROM member_table WHERE phone = ?', [phone]);
    if (exists.length > 0) {
      return res.status(409).json({ error: '此電話號碼已註冊' });
    }

    const [result] = await pool.query('INSERT INTO member_table (name, phone, password) VALUES (?, ?, ?)', [name, phone, password]);
    res.status(201).json({
      message: '註冊成功',
      member: {
        phone: phone,
        name: name
      }
    });
  } catch (err) {
    console.error('註冊錯誤:', err);
    res.status(500).json({ error: '註冊失敗', details: err.message });
  }
});

// 會員登入
app.post('/api/member/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: '電話和密碼為必填' });
    }

    const [rows] = await pool.query('SELECT * FROM member_table WHERE phone = ? AND password = ?', [phone, password]);
    if (rows.length === 0) {
      return res.status(401).json({ error: '帳號或密碼錯誤' });
    }

    const member = rows[0];
    res.json({
      message: '登入成功',
      member: {
        phone: member.phone,
        name: member.name
      }
    });
  } catch (err) {
    console.error('登入失敗:', err);
    res.status(500).json({ error: '登入失敗' });  
  }
});

// 取得會員資料（用 電話號碼）
app.get('/api/member/:phone', async (req, res) => {
  try {
    const memberPhone = req.params.phone;
    const [results] = await pool.query('SELECT * FROM member_table WHERE phone = ?', [memberPhone]);
    if (results.length === 0) {
      return res.status(404).json({ error: '找不到會員' });
    }
    res.json(results[0]);
  } catch (err) {
    console.error('查詢會員錯誤:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
});

// 更新會員資料
app.put('/api/member/:phone', async (req, res) => {
  try {
    const memberPhone = req.params.phone;
    const { name, phone, password } = req.body;

    const fields = [];
    const values = [];
    if (name) { fields.push('name = ?'); values.push(name); }
    if (phone) { fields.push('phone = ?'); values.push(phone); }
    if (password) { fields.push('password = ?'); values.push(password); }

    if (fields.length === 0) {
      return res.status(400).json({ error: '沒有要更新的資料' });
    }

    values.push(memberPhone);
    const sql = `UPDATE member_table SET ${fields.join(', ')} WHERE phone = ?`;
    await pool.query(sql, values);

    res.json({ message: '會員資料已更新' });
  } catch (err) {
    console.error('更新會員錯誤:', err);
    res.status(500).json({ error: '更新失敗' });
  }
});

// 驗證 token middleware (用jsonwebtoken 套件)
const jwt = require('jsonwebtoken');
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;  // user 物件中有 phone 等資料
    next();
  });
}

// 取得會員資料 API
app.get('/api/member/profile', authenticateToken, async (req, res) => {
  try {
    const phone = req.user.phone;
    const [results] = await pool.query('SELECT phone, name FROM member_table WHERE phone = ?', [phone]);
    if (results.length === 0) return res.status(404).json({ error: '找不到會員' });
    res.json(results[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// 啟動伺服器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 會員系統伺服器運行於 http://localhost:${PORT}`);
});

app.use(express.static(path.join(__dirname, 'public')));