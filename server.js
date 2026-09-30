const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  });
}

const app = express();
const PORT = process.env.PORT || 3000;
const usersPath = path.join(__dirname, 'users.json');
const sessions = new Map();

app.use(cors());
app.use(express.json());
const siteFiles = new Set(['/', '/index.html', '/app.js', '/styles.css', '/tailwind.css']);
const serveSiteFiles = express.static(__dirname);
app.use((req, res, next) => {
  if (siteFiles.has(req.path)) return serveSiteFiles(req, res, next);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: 'footlab', time: new Date().toISOString() });
});

function readUsers() {
  if (!fs.existsSync(usersPath)) return [];
  try { return JSON.parse(fs.readFileSync(usersPath, 'utf8')); } catch { return []; }
}

function writeUsers(users) {
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (error, derivedKey) => {
    if (error) reject(error); else resolve({ salt, hash: derivedKey.toString('hex') });
  }));
}

async function passwordsMatch(password, user) {
  const storedHash = user.passwordHash || user.hash;
  if (!user.salt || !storedHash || typeof storedHash !== 'string') return false;
  const result = await hashPassword(password, user.salt);
  const expected = Buffer.from(result.hash, 'hex');
  const actual = Buffer.from(storedHash, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, team: user.team || '', role: user.role || 'user', createdAt: user.createdAt };
}

function getSessionUser(req) {
  const token = req.headers.cookie?.match(/footballhub_session=([^;]+)/)?.[1];
  const userId = token && sessions.get(token);
  return readUsers().find(user => user.id === userId);
}

async function ensureAdminAccount() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const users = readUsers();
  const normalizedEmail = email.trim().toLowerCase();
  let admin = users.find(user => user.email === normalizedEmail);
  if (!admin) {
    const credentials = await hashPassword(password);
    admin = { id: crypto.randomUUID(), name: 'footlab Admin', email: normalizedEmail, team: '', role: 'admin', ...credentials, createdAt: new Date().toISOString() };
    users.push(admin);
  } else if (admin.role !== 'admin') {
    admin.role = 'admin';
  }
  writeUsers(users);
}

function requireAdmin(req, res, next) {
  const user = getSessionUser(req);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  req.user = user;
  next();
}

// Database (Mock Data)
const matchesData = [
  {
    id: "m1",
    league: "UEFA CHAMPIONS LEAGUE — მე-8 ტური",
    time: "23:00",
    homeTeam: "რეალ მადრიდი",
    homeLogo: "https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg",
    awayTeam: "მან. სიტი",
    awayLogo: "https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg",
    aiPrediction: "BTTS & >2.5",
    odds: 1.85,
    risk: "risk"
  },
  {
    id: "m2",
    league: "UEFA CHAMPIONS LEAGUE — მე-8 ტური",
    time: "23:00",
    homeTeam: "არსენალი",
    homeLogo: "https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg",
    awayTeam: "ბაიერნი",
    awayLogo: "https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg",
    aiPrediction: "არსენალი (1X)",
    odds: 1.38,
    risk: "safe"
  },
  {
    id: "m3",
    league: "UEFA CHAMPIONS LEAGUE — მე-8 ტური",
    time: "23:00",
    homeTeam: "პსჟ",
    homeLogo: "https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg",
    awayTeam: "ბარსელონა",
    awayLogo: "https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg",
    aiPrediction: "პსჟ > 1.5 გოლი",
    odds: 1.62,
    risk: "safe"
  },
  {
    id: "m4",
    league: "ENGLAND PREMIER LEAGUE",
    time: "16:30",
    homeTeam: "ლივერპული",
    homeLogo: "https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg",
    awayTeam: "ევერტონი",
    awayLogo: "https://upload.wikimedia.org/wikipedia/en/7/7c/Everton_FC_logo.svg",
    aiPrediction: "ლივერპულის მოგება",
    odds: 1.45,
    risk: "safe"
  },
  {
    id: "m5",
    league: "ITALY SERIE A",
    time: "19:00",
    homeTeam: "ინტერი",
    homeLogo: "https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg",
    awayTeam: "მილანი",
    awayLogo: "https://upload.wikimedia.org/wikipedia/commons/d/d0/Logo_of_AC_Milan.svg",
    aiPrediction: "ინტერი (1X)",
    odds: 1.52,
    risk: "safe"
  },
  {
    id: "m6",
    league: "GERMANY BUNDESLIGA",
    time: "21:30",
    homeTeam: "დორტმუნდი",
    homeLogo: "https://upload.wikimedia.org/wikipedia/commons/6/67/Borussia_Dortmund_logo.svg",
    awayTeam: "ლევერკუზენი",
    awayLogo: "https://upload.wikimedia.org/wikipedia/en/5/59/Bayer_04_Leverkusen_logo.svg",
    aiPrediction: "ორივე გაიტანს",
    odds: 1.72,
    risk: "risk"
  },
  {
    id: "m7",
    league: "SPAIN LA LIGA",
    time: "22:00",
    homeTeam: "ატლეტიკო",
    homeLogo: "https://upload.wikimedia.org/wikipedia/en/f/f4/Atletico_Madrid_2017_logo.svg",
    awayTeam: "სევილია",
    awayLogo: "https://upload.wikimedia.org/wikipedia/en/3/3b/Sevilla_FC_logo.svg",
    aiPrediction: "ატლეტიკო (1X)",
    odds: 1.44,
    risk: "safe"
  },
  {
    id: "m8",
    league: "FRANCE LIGUE 1",
    time: "22:45",
    homeTeam: "ლიონი",
    homeLogo: "https://upload.wikimedia.org/wikipedia/en/c/c6/Olympique_Lyonnais.svg",
    awayTeam: "მარსელი",
    awayLogo: "https://upload.wikimedia.org/wikipedia/en/4/43/Olympique_Marseille_logo.svg",
    aiPrediction: "2.5-ზე მეტი გოლი",
    odds: 1.68,
    risk: "risk"
  }
];

let commentsData = [
  { id: 1, user: "გიორგი_89", text: "ვინიციუსის სიჩქარე კონტრშეტევებზე გადაწყვეტს ამ თამაშს. «ბერნაბეუზე» სიტის გაუჭირდება.", time: "12m" },
  { id: 2, user: "Luka_Tactics", text: "ცენტრალური მცველის არყოფნა სერიოზული პრობლემაა. სიტი ბურთის კონტროლით დაღლის მეტოქეს.", time: "28m" }
];

const reviewsData = [
  { name: "Nika Tactics", role: "Verified analyst", avatar: "NT", rating: 5, text: "მისი ანალიზი გასაგებია და ემოციების ნაცვლად ფაქტებს ეყრდნობა. ბოლო ტურის მატჩები ზუსტად დამილაგა." },
  { name: "Mariam Football", role: "Community member", avatar: "MF", rating: 5, text: "ყველაზე მეტად მომწონს რისკის ახსნა. აქ არავინ გპირდება გარანტირებულ შედეგს." },
  { name: "Dato Pro", role: "Top contributor", avatar: "DP", rating: 4, text: "footlab-ის ფორმატი სწრაფია: ვხედავ ყველა თამაშს, ვადარებ კოეფიციენტებს და მერე ვწყვეტ." }
];

// API Endpoints
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, team = '' } = req.body || {};
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'სახელი, სწორი email და მინიმუმ 8 სიმბოლოიანი პაროლი აუცილებელია' });
  }

  const users = readUsers();
  const normalizedEmail = email.trim().toLowerCase();
  if (users.some(user => user.email === normalizedEmail)) return res.status(409).json({ error: 'ეს email უკვე რეგისტრირებულია' });
  const credentials = await hashPassword(password);
  const user = { id: crypto.randomUUID(), name: name.trim(), email: normalizedEmail, team: team.trim(), ...credentials, createdAt: new Date().toISOString() };
  users.push(user);
  writeUsers(users);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, user.id);
  res.setHeader('Set-Cookie', `footballhub_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
  res.status(201).json({ user: publicUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = readUsers().find(item => item.email === String(email || '').trim().toLowerCase());
  if (!user || !(await passwordsMatch(password || '', user))) return res.status(401).json({ error: 'Email ან პაროლი არასწორია' });
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, user.id);
  res.setHeader('Set-Cookie', `footballhub_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
  res.json({ user: publicUser(user) });
});

app.get('/api/auth/me', (req, res) => {
  const user = getSessionUser(req);
  res.json({ user: user ? publicUser(user) : null });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.cookie?.match(/footballhub_session=([^;]+)/)?.[1];
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', 'footballhub_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/admin/overview', requireAdmin, (req, res) => {
  res.json({
    user: publicUser(req.user),
    users: readUsers().length,
    comments: commentsData.length,
    reviews: reviewsData.length,
    matches: matchesData.length
  });
});

function mapLiveMatch(fixture) {
  return {
    id: String(fixture.fixture.id),
    league: fixture.league.name.toUpperCase(),
    time: new Date(fixture.fixture.date).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' }),
    homeTeam: fixture.teams.home.name,
    homeLogo: fixture.teams.home.logo,
    awayTeam: fixture.teams.away.name,
    awayLogo: fixture.teams.away.logo,
    aiPrediction: 'ანალიზი მზადდება',
    odds: null,
    risk: 'unknown'
  };
}

async function getMatches() {
  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) return { matches: matchesData, source: 'demo', updatedAt: new Date().toISOString() };
  try {
    const date = new Date().toISOString().slice(0, 10);
    const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}`, { headers: { 'x-apisports-key': apiKey } });
    if (!response.ok) throw new Error('Football data provider error');
    const data = await response.json();
    return { matches: (data.response || []).map(mapLiveMatch), source: 'api-football', updatedAt: new Date().toISOString() };
  } catch (error) {
    return { matches: matchesData, source: 'fallback', updatedAt: new Date().toISOString() };
  }
}

app.get('/api/matches', async (req, res) => {
  try {
    const result = await getMatches();
    res.json(result);
  } catch (error) {
    res.status(502).json({ error: 'მატჩების მონაცემების მიღება ვერ მოხერხდა' });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const result = await getMatches();
    res.json({ matchesToday: result.matches.length, leagues: new Set(result.matches.map(match => match.league)).size, source: result.source, updatedAt: result.updatedAt });
  } catch (error) {
    res.status(502).json({ error: 'სტატისტიკის მიღება ვერ მოხერხდა' });
  }
});

app.get('/api/reviews', (req, res) => {
  res.json(reviewsData);
});

app.post('/api/ai/chat', async (req, res) => {
  const { message, history = [] } = req.body || {};
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.json({
      mode: 'demo',
      reply: 'AI გასააქტიურებლად დაამატე OPENAI_API_KEY server-ის გაშვების გარემოში. ამჟამად დემო-რეჟიმში ვარ: შემიძლია დაგეხმარო მატჩების შედარებაში, რისკის შეფასებასა და ექსპრესის აწყობაში.'
    });
  }

  const safeHistory = Array.isArray(history)
    ? history.slice(-8).filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
    : [];

  try {
    const aiResponse = await fetch(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'footlab AI'
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL || 'openai/gpt-4o-mini',
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content: `შენ ხარ footlab-ის სპორტული ანალიტიკოსი. უპასუხე ქართულად, მოკლედ და პრაქტიკულად. გამოიყენე მხოლოდ ეს მატჩები: ${JSON.stringify(matchesData)}. არ წარმოადგინო პროგნოზი გარანტირებულ შედეგად, არ ურჩიო მომხმარებელს ფსონის დადება და ყოველთვის ახსენე რისკი.`
          },
          ...safeHistory,
          { role: 'user', content: message.trim() }
        ]
      })
    });

    const data = await aiResponse.json();
    if (!aiResponse.ok) {
      return res.status(502).json({ error: data.error?.message || 'AI provider error' });
    }

    res.json({ mode: 'live', reply: data.choices?.[0]?.message?.content || 'AI-მ პასუხი ვერ დააბრუნა.' });
  } catch (error) {
    res.status(502).json({ error: 'AI სერვისთან დაკავშირება ვერ მოხერხდა' });
  }
});

app.get('/api/comments', (req, res) => {
  res.json(commentsData);
});

app.post('/api/comments', (req, res) => {
  const { user, text } = req.body;
  if (!text) return res.status(400).json({ error: "Comment text is required" });
  
  const newComment = {
    id: Date.now(),
    user: user || "Guest",
    text,
    time: "Just now"
  };
  commentsData.unshift(newComment);
  res.status(201).json(newComment);
});

app.get('/api/ticket/generate', async (req, res) => {
  const { mode } = req.query; // 'safe' or 'risk'
  try {
    const { matches } = await getMatches();
    const pricedMatches = matches.filter(match => typeof match.odds === 'number');
    const ticket = mode === 'risk'
      ? pricedMatches.filter(match => match.risk === 'risk' || match.odds >= 1.6)
      : pricedMatches.filter(match => match.risk === 'safe');
    res.json(ticket);
  } catch (error) {
    res.status(502).json({ error: 'ბილეთის მონაცემების მიღება ვერ მოხერხდა' });
  }
});

ensureAdminAccount().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 footlab Server running at http://localhost:${PORT}`);
  });
}).catch(error => {
  console.error('Failed to initialize admin account', error);
  process.exit(1);
});