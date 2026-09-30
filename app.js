let currentTicket = [];
let allMatches = [];
let aiHistory = [];
let authMode = 'register';

document.addEventListener('DOMContentLoaded', () => {
  fetchMatches();
  fetchComments();
  fetchStats();
  fetchReviews();
  loadAccount();
  restoreSession();
});

// Fetch Matches from Backend API
async function fetchMatches() {
  try {
    const res = await fetch('/api/matches');
    const payload = await res.json();
    const matches = Array.isArray(payload) ? payload : payload.matches;
    allMatches = matches || [];
    renderMatches(allMatches);
  } catch (err) {
    console.error("Failed to load matches", err);
    allMatches = [];
    document.getElementById('matches-container').innerHTML = '<div class="empty-matches"><i class="fa-solid fa-triangle-exclamation"></i><strong>მატჩების ჩატვირთვა ვერ მოხერხდა</strong><span>სცადე გვერდის განახლება.</span></div>';
  }
}

async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    const stats = await res.json();
    document.getElementById('stat-matches').textContent = stats.matchesToday;
    document.getElementById('stat-leagues').textContent = stats.leagues;
  } catch (err) {
    console.error('Failed to load stats', err);
    document.getElementById('stat-matches').textContent = '—';
    document.getElementById('stat-leagues').textContent = '—';
  }
}

async function fetchReviews() {
  try {
    const response = await fetch('/api/reviews');
    const reviews = await response.json();
    const container = document.getElementById('reviews-container');
    container.innerHTML = reviews.map(review => `
      <article class="review-card">
        <div class="review-head"><span class="review-avatar">${review.avatar}</span><div><strong>${review.name}</strong><span>${review.role}</span></div><span class="stars">${'★'.repeat(review.rating)}</span></div>
        <p>“${review.text}”</p>
      </article>
    `).join('');
  } catch (err) {
    console.error('Failed to load reviews', err);
  }
}

function filterMatches() {
  const search = document.getElementById('match-search').value.toLowerCase().trim();
  const league = document.getElementById('league-filter').value;
  const sort = document.getElementById('sort-filter').value;
  const filtered = allMatches.filter(match => {
    const matchesSearch = `${match.homeTeam} ${match.awayTeam}`.toLowerCase().includes(search);
    const matchesLeague = league === 'all' || (league === 'champions' && match.league.includes('CHAMPIONS')) || (league === 'premier' && match.league.includes('PREMIER'));
    return matchesSearch && matchesLeague;
  });
  filtered.sort((first, second) => {
    if (sort === 'league') return first.league.localeCompare(second.league);
    if (sort === 'odds') return (first.odds ?? Number.POSITIVE_INFINITY) - (second.odds ?? Number.POSITIVE_INFINITY);
    if (sort === 'risk') return (first.risk === 'safe' ? 0 : 1) - (second.risk === 'safe' ? 0 : 1);
    return first.time.localeCompare(second.time);
  });
  renderMatches(filtered);
}

// Render Matches List
function renderMatches(matches) {
  const container = document.getElementById('matches-container');
  container.innerHTML = '';
  document.getElementById('match-total').textContent = matches.length;

  if (!matches.length) {
    container.innerHTML = '<div class="empty-matches"><i class="fa-solid fa-futbol"></i><strong>მატჩი ვერ მოიძებნა</strong><span>შეცვალე ძიება ან ლიგის ფილტრი.</span></div>';
    return;
  }

  matches.forEach(m => {
    const row = document.createElement('div');
    const oddsText = m.odds ? `<span class="text-accent-emerald font-mono font-bold ml-1">${m.odds}</span>` : '<span class="text-gray-500 ml-1">LIVE DATA</span>';
    const ticketButton = m.odds
      ? `<button onclick="addToTicket('${m.homeTeam} vs ${m.awayTeam}', '${m.aiPrediction}', ${m.odds})" class="text-xs font-bold text-black bg-accent-emerald px-2.5 py-1 rounded hover:bg-emerald-400 transition">+ ბილეთში</button>`
      : '<button class="text-xs font-bold text-gray-500 bg-surface-700 px-2.5 py-1 rounded cursor-not-allowed" disabled>კოეფიციენტი არ არის</button>';
    row.className = 'p-4 hover:bg-surface-800/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4';
    row.innerHTML = `
      <div class="flex items-center gap-4 flex-1">
        <div class="match-time"><span class="font-mono text-xs text-accent-emerald font-bold">${m.time}</span><small>${m.league}</small></div>
        <div class="teams-row flex items-center gap-3 flex-1">
          <div class="flex items-center gap-2 w-5/12 justify-end text-right">
            <span class="font-bold text-xs text-white truncate">${m.homeTeam}</span>
            <img src="${m.homeLogo}" class="w-5 h-5 object-contain">
          </div>
          <span class="text-[10px] text-gray-500 font-bold">VS</span>
          <div class="flex items-center gap-2 w-5/12 justify-start">
            <img src="${m.awayLogo}" class="w-5 h-5 object-contain">
            <span class="font-bold text-xs text-white truncate">${m.awayTeam}</span>
          </div>
        </div>
      </div>
      <div class="match-actions flex items-center justify-between sm:justify-end gap-3">
        <div class="text-[11px] text-gray-400 bg-surface-700/60 px-2.5 py-1 rounded">
          <strong class="text-white">${m.aiPrediction}</strong> ${oddsText}
        </div>
        ${ticketButton}
      </div>
    `;
    container.appendChild(row);
  });
}

// Fetch AI Generated Express Ticket from API
async function requestAiTicket(mode) {
  try {
    const res = await fetch(`/api/ticket/generate?mode=${mode}`);
    const items = await res.json();
    if (!res.ok || !Array.isArray(items)) throw new Error(items.error || 'Ticket request failed');
    currentTicket = items.map(i => ({
      match: `${i.homeTeam} vs ${i.awayTeam}`,
      pick: i.aiPrediction,
      odds: i.odds
    }));
    renderTicket();
  } catch (err) {
    console.error("Failed to generate ticket", err);
  }
}

// Manual Ticket Controls
function addToTicket(match, pick, odds) {
  if (!currentTicket.some(i => i.match === match)) {
    currentTicket.push({ match, pick, odds });
    renderTicket();
  }
}

function removeMatch(index) {
  currentTicket.splice(index, 1);
  renderTicket();
}

function renderTicket() {
  const container = document.getElementById('ticket-slip');
  const emptyState = document.getElementById('empty-state');
  const summary = document.getElementById('ticket-summary');
  const countLabel = document.getElementById('ticket-count');
  const oddsLabel = document.getElementById('total-odds');

  container.innerHTML = '';

  if (currentTicket.length === 0) {
    container.appendChild(emptyState);
    emptyState.classList.remove('hidden');
    summary.classList.add('hidden');
    countLabel.innerText = '0 თამაში';
    return;
  }

  let totalOdds = 1.0;

  currentTicket.forEach((item, index) => {
    totalOdds *= parseFloat(item.odds);

    const card = document.createElement('div');
    card.className = 'sub-panel p-2.5 rounded-lg flex justify-between items-center text-xs';
    card.innerHTML = `
      <div>
        <div class="font-bold text-white text-[11px]">${item.match}</div>
        <div class="text-[10px] text-accent-emerald font-semibold">${item.pick}</div>
      </div>
      <div class="flex items-center gap-2">
        <span class="font-mono font-bold text-white bg-surface-700 px-1.5 py-0.5 rounded text-[10px]">${item.odds}</span>
        <button onclick="removeMatch(${index})" class="text-gray-500 hover:text-accent-red">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `;
    container.appendChild(card);
  });

  countLabel.innerText = `${currentTicket.length} თამაში`;
  oddsLabel.innerText = totalOdds.toFixed(2);
  summary.classList.remove('hidden');
}

async function copyTicket() {
  let text = "⚽ footlab AI Express:\n";
  currentTicket.forEach(item => {
    text += `• ${item.match} — ${item.pick} (${item.odds})\n`;
  });
  text += `\nჯამური კოეფიციენტი: ${document.getElementById('total-odds').innerText}`;

  try {
    await navigator.clipboard.writeText(text);
    alert('ბილეთი დაკოპირებულია!');
  } catch (error) {
    alert('კოპირება ვერ მოხერხდა.');
  }
}

// Fetch Comments
async function fetchComments() {
  try {
    const res = await fetch('/api/comments');
    if (!res.ok) throw new Error('Comments request failed');
    const comments = await res.json();
    const container = document.getElementById('comments-container');
    container.innerHTML = '';
    comments.forEach(c => {
      const el = document.createElement('div');
      el.className = 'sub-panel p-3 rounded-lg space-y-1';
      el.innerHTML = `
        <div class="flex justify-between text-[11px]"><span class="font-bold text-white">${c.user}</span><span class="text-[10px] text-gray-500">${c.time}</span></div>
        <p class="text-xs text-gray-300">${c.text}</p>
      `;
      container.appendChild(el);
    });
  } catch (error) {
    document.getElementById('comments-container').innerHTML = '<p class="text-xs text-gray-500">დისკუსიის ჩატვირთვა ვერ მოხერხდა.</p>';
  }
}

// Post Comment
async function postComment() {
  const input = document.getElementById('comment-input');
  if (!input.value.trim()) return;

  try {
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: getAccount().name, text: input.value.trim() })
    });
    if (!response.ok) throw new Error('Comment request failed');
    input.value = '';
    fetchComments();
  } catch (error) {
    alert('კომენტარის გაგზავნა ვერ მოხერხდა.');
  }
}

function getAccount() {
  try {
    return JSON.parse(localStorage.getItem('footballhub-account') || '{"name":"სტუმარი","team":"ფეხბურთის გულშემატკივარი"}');
  } catch (error) {
    localStorage.removeItem('footballhub-account');
    return { name: 'სტუმარი', team: 'ფეხბურთის გულშემატკივარი' };
  }
}

function loadAccount() {
  const account = { name: 'სტუმარი', team: 'ფეხბურთის გულშემატკივარი', ...getAccount() };
  const initials = account.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
  document.getElementById('nav-avatar').textContent = initials;
  document.getElementById('mobile-avatar').textContent = initials;
  document.getElementById('nav-name').textContent = account.name;
  document.getElementById('card-avatar').textContent = initials;
  document.getElementById('card-name').textContent = account.name;
  document.getElementById('card-team').textContent = account.team || 'ფეხბურთის გულშემატკივარი';
}

async function restoreSession() {
  try {
    const response = await fetch('/api/auth/me');
    const data = await response.json();
    if (data.user) {
      localStorage.setItem('footballhub-account', JSON.stringify(data.user));
      loadAccount();
    }
  } catch (error) {
    console.error('Failed to restore session', error);
  }
}

function openAccount() {
  const account = getAccount();
  authMode = account.id ? 'login' : 'register';
  document.getElementById('account-name').value = account.id ? account.name : '';
  document.getElementById('account-email').value = account.email || '';
  document.getElementById('account-team').value = account.team || '';
  document.getElementById('account-password').value = '';
  updateAuthMode();
  document.getElementById('account-modal').classList.remove('hidden');
}

function closeAccount(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('account-modal').classList.add('hidden');
}

async function submitAuth(event) {
  event.preventDefault();
  const error = document.getElementById('auth-error');
  error.textContent = '';
  const payload = {
    name: document.getElementById('account-name').value.trim(),
    email: document.getElementById('account-email').value.trim(),
    password: document.getElementById('account-password').value,
    team: document.getElementById('account-team').value.trim()
  };
  try {
    const endpoint = authMode === 'login' ? 'login' : 'register';
    const response = await fetch(`/api/auth/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'ავტორიზაცია ვერ შესრულდა');
    localStorage.setItem('footballhub-account', JSON.stringify(data.user));
    loadAccount();
    closeAccount();
  } catch (requestError) {
    error.textContent = requestError.message;
  }
}

function toggleAuthMode() {
  authMode = authMode === 'login' ? 'register' : 'login';
  updateAuthMode();
}

function updateAuthMode() {
  const isLogin = authMode === 'login';
  document.getElementById('account-title').textContent = isLogin ? 'შესვლა' : 'შექმენი ანგარიში';
  document.getElementById('account-name-field').classList.toggle('hidden', isLogin);
  document.getElementById('account-team-field').classList.toggle('hidden', isLogin);
  document.getElementById('account-name').required = !isLogin;
  document.getElementById('auth-submit-label').textContent = isLogin ? 'შესვლა' : 'რეგისტრაცია';
  document.getElementById('auth-switch').textContent = isLogin ? 'არ გაქვს ანგარიში? რეგისტრაცია' : 'უკვე გაქვს ანგარიში? შესვლა';
}

function openAiChat() {
  document.getElementById('ai-modal').classList.remove('hidden');
  document.getElementById('ai-input').focus();
}

function closeAiChat(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('ai-modal').classList.add('hidden');
}

function usePrompt(prompt) {
  document.getElementById('ai-input').value = prompt;
  document.getElementById('ai-input').focus();
}

function appendAiMessage(content, role) {
  const container = document.getElementById('ai-messages');
  const message = document.createElement('div');
  message.className = `ai-message ${role}`;
  message.textContent = content;
  container.appendChild(message);
  container.scrollTop = container.scrollHeight;
  return message;
}

async function sendAiMessage(event) {
  event.preventDefault();
  const input = document.getElementById('ai-input');
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  appendAiMessage(message, 'user');
  const loading = appendAiMessage('ანალიზს ვამზადებ...', 'assistant loading');

  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: aiHistory })
    });
    const data = await response.json();
    loading.remove();
    if (!response.ok) throw new Error(data.error || 'AI request failed');
    appendAiMessage(data.reply, 'assistant');
    aiHistory.push({ role: 'user', content: message }, { role: 'assistant', content: data.reply });
  } catch (error) {
    loading.remove();
    appendAiMessage('კავშირის შეცდომა. გადაამოწმე სერვერი და სცადე თავიდან.', 'assistant error');
  }
}