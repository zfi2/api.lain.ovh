const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const app = express();
const port = 8100;

// Create DOMPurify instance
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// SQLite database setup
let db;
(async () => {
    db = await open({
        filename: './comments.db',
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS rate_limits (
            ip TEXT PRIMARY KEY,
            last_request TEXT NOT NULL
        );
    `);
})();

// Admin credentials
const ADMIN_CONFIG = {
    username: process.env.SERVER_USERNAME.toLowerCase(),
    passwordHash: process.env.SERVER_PASSWORD_HASH
};

// CORS configuration
const allowedOrigins = ['https://lain.ovh'];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('not allowed by CORS!'));
        }
    }
}));

app.set('trust proxy', true);
app.use(express.json());

// Sanitize function
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return purify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
}

// Rate limiter middleware
async function rateLimiter(req, res, next) {
    const ip = req.ip;
    const now = new Date().toISOString();
    const limitDuration = 24 * 60 * 60 * 1000; // 1 day
    const maxRequests = 1;

    try {
        const result = await db.get(`SELECT * FROM rate_limits WHERE ip = ?`, [ip]);

        if (result) {
            const lastRequestTime = new Date(result.last_request);
            const timeElapsed = new Date(now) - lastRequestTime;

            if (timeElapsed < limitDuration) {
                return res.status(429).json({ error: 'you can only post one comment per day!' });
            }
        }

        // Allow the comment, update last request time
        await db.run(`INSERT OR REPLACE INTO rate_limits (ip, last_request) VALUES (?, ?)`, [ip, now]);

        next();
    } catch (error) {
        console.error('Rate limiter error:', error);
        res.status(500).json({ error: 'internal server error' });
    }
}

// Get paginated comments
app.get('/comments', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;

    const comments = await db.all(`SELECT * FROM comments ORDER BY timestamp DESC LIMIT ? OFFSET ?`, [limit, offset]);
    const count = await db.get(`SELECT COUNT(*) as total FROM comments`);

    res.json({ comments, totalPages: Math.ceil(count.total / limit) });
});

// Post a comment
app.post('/comments', rateLimiter, async (req, res) => {
    const { content, username, password } = req.body;
    const sanitizedContent = sanitizeInput(content);
    const sanitizedUsername = sanitizeInput(username);

    if (sanitizedUsername.toLowerCase() === ADMIN_CONFIG.username) {
        if (!password || !(await bcrypt.compare(password, ADMIN_CONFIG.passwordHash))) {
            return res.status(403).json({ error: 'unauthorized use of reserved username!' });
        }
    }

    if (!sanitizedContent || sanitizedContent.length > 100) {
        return res.status(400).json({ error: 'comment must be between 1 and 100 characters!' });
    }
    if (!sanitizedUsername || sanitizedUsername.length > 25) {
        return res.status(400).json({ error: 'username must be between 1 and 25 characters!' });
    }

    await db.run(`INSERT INTO comments (username, content, timestamp) VALUES (?, ?, ?)`, [
        sanitizedUsername,
        sanitizedContent,
        new Date().toISOString()
    ]);

    res.status(201).json({ message: 'comment added!' });
});

app.listen(port, () => {
    console.log(`server running at http://localhost:${port}`);
});
