import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});
const $app = document.getElementById('app');
window.__appReady = true;

// ---------------------------------------------------------------- 공통 도우미
const ERR = {
  INVALID_LINK: '링크가 맞지 않아요. 대표에게 새 링크를 받아주세요.',
  NOT_HOST: '대표만 할 수 있어요.',
  HOST_NAME_REQUIRED: '내 이름을 적어주세요.',
  ROOM_NAME_REQUIRED: '방 이름을 적어주세요.',
  DUPLICATE_NAME: '같은 이름이 있어요. 구분할 수 있게 바꿔주세요. 예) 김민수(마케팅)',
  NAME_TOO_LONG: '이름은 20자까지예요.',
  MIN_3: '나를 포함해 3명 이상이어야 해요.',
  MAX_30: '한 방은 30명까지예요.',
  BAD_DATES: '날짜를 확인해주세요.',
  BAD_MISSION_COUNT: '미션은 1~10회까지예요.',
  MIN_3_JOINED: '참여한 사람이 3명 이상이어야 시작할 수 있어요.',
  ALREADY_STARTED: '이미 시작된 방이에요.',
  NOT_EDITABLE: '지금은 수정할 수 없어요.',
  NOT_ACTIVE: '진행 중일 때만 할 수 있어요.',
  MISSION_LOCKED: '아직 열리지 않은 미션이에요.',
  NOT_GUESSING: '지금은 예상 제출 기간이 아니에요.',
  BAD_GUESS: '다른 사람을 골라주세요.',
  NOT_REVEALABLE: '지금은 공개할 수 없어요.',
  ROOM_STARTED: '이미 매칭이 시작돼서 이 방에는 참여할 수 없어요. 대표에게 문의해주세요.',
  PAST_DATE: '지난 날짜는 고를 수 없어요.',
  MISSION_COUNT_OVER_DAYS: '미션 횟수는 기간 일수보다 많을 수 없어요.',
  PERIOD_OVER: '기간이 이미 지나서 시작할 수 없어요. 새 방을 만들어주세요.',
  BAD_MEMBER: '대상을 찾을 수 없어요.',
  NETWORK: '서버에 연결할 수 없어요. 인터넷 연결을 확인하고 잠시 후 다시 시도해주세요.'
};
const isNet = (msg) => /fetch|network|load failed|timeout|ECONN|abort/i.test(msg || '');
async function rpc(fn, args) {
  let res;
  try { res = await sb.rpc(fn, args); } catch (err) { res = { error: { message: String(err && err.message || err) } }; }
  const { data, error } = res;
  if (error) {
    let code = Object.keys(ERR).find((k) => (error.message || '').includes(k));
    if (!code && isNet(error.message)) code = 'NETWORK';
    const e = new Error(code ? ERR[code] : '잠시 후 다시 시도해주세요.');
    e.code = code || 'UNKNOWN';
    throw e;
  }
  return data;
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
    ta.remove(); return ok;
  }
}
function showCopyBox(text) {
  const old = document.getElementById('copybox'); if (old) old.remove();
  const box = document.createElement('div');
  box.id = 'copybox'; box.className = 'copybox';
  box.innerHTML = `<div class="copycard"><b>아래 내용을 길게 눌러 복사해주세요</b><textarea readonly rows="6"></textarea><button class="btn sm" type="button">닫기</button></div>`;
  box.querySelector('textarea').value = text;
  box.querySelector('button').onclick = () => box.remove();
  document.body.appendChild(box);
  box.querySelector('textarea').select();
}
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
async function shareOrCopy(text, label) {
  if (isMobile && navigator.share) {
    try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  if (await copyText(text)) toast(`${label} 복사했어요. 카톡에 붙여넣으세요 📋`);
  else showCopyBox(text);
}
const linkFor = (token) => location.origin + location.pathname + '#/r/' + token;
const inviteText = (room, name, token) =>
  `🎄 [${room}] 마니또에 초대합니다!\n${name}님 전용 링크예요. 다른 사람에게 보내지 마세요 🤫\n${linkFor(token)}`;

// 날짜
const d = (s) => { const [y, m, dd] = s.split('-').map(Number); return Date.UTC(y, m - 1, dd); };
const diffDays = (a, b) => Math.round((d(a) - d(b)) / 86400000);
const mmdd = (s) => s ? s.slice(5).replace('-', '/') : '';
const longDate = (s) => {
  if (!s) return '';
  const [y, m, dd] = s.split('-').map(Number);
  const w = '일월화수목금토'[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()];
  return `${m}월 ${dd}일 (${w})`;
};
const dday = (target, today) => { const n = diffDays(target, today); return n === 0 ? 'D-day' : n > 0 ? 'D-' + n : 'D+' + (-n); };
const todayKST = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const addDays = (s, n) => new Date(d(s) + n * 86400000).toISOString().slice(0, 10);

// 저장된 방 목록 (이 기기)
const KEY = 'manito_rooms_v1';
const loadRooms = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (_) { return []; } };
const saveRooms = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (_) {} };
function rememberRoom(token, v) {
  const list = loadRooms().filter((x) => x.token !== token && x.roomId !== v.room.id);
  list.unshift({ token, roomId: v.room.id, name: v.room.name, mode: v.room.mode });
  saveRooms(list);
}
const normName = (s) => s.replace(/\s/g, '').toLowerCase();
function forgetRoom(token) { saveRooms(loadRooms().filter((x) => x.token !== token)); }

// ---------------------------------------------------------------- 화면 틀
const COLORS = ['#1E5B3F', '#B3261E', '#2F5D8A', '#8A5A12', '#5B3F8C', '#1F6E6A'];
const initial = (n) => (n.length >= 3 ? n[1] : n[0]) || '?';
function avatar(name, i, lg) {
  const hat = i % 2 === 0 ? '#B3261E' : '#1E5B3F';
  return `<div class="ava${lg ? ' lg' : ''}"><svg viewBox="0 0 26 18" aria-hidden="true"><path d="M2 16 L13 2 L24 16 Z" fill="${hat}"/><rect x="0" y="14" width="26" height="4" rx="2" fill="#fff" stroke="#D5DCD6"/><circle cx="13" cy="2" r="2.5" fill="#fff" stroke="#D5DCD6"/></svg><div class="face" style="background:${COLORS[i % COLORS.length]}">${esc(initial(name))}</div></div>`;
}
const lights = () => {
  const cols = ['#E5483F', '#F2C230', '#3DAA6D', '#4C8FD6'];
  let s = '<div class="lights" aria-hidden="true">';
  for (let i = 0; i < 16; i++) s += `<span class="bulb" style="margin-top:${i % 2 ? 2 : 5}px;background:${cols[i % 4]};box-shadow:0 0 6px ${cols[i % 4]};animation-delay:${(i % 4) * 0.4}s"></span>`;
  return s + '</div>';
};
const backIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
function shell({ title, badge, badgeMono, back, cell, fx, body, tabs }) {
  const head = back
    ? `<a class="back" href="#/" aria-label="내 방 목록으로">${backIcon}</a><span class="title">${esc(title)}</span>`
    : `<span class="brand">⭐ 마니또.xlsx</span>`;
  return `<header class="top">${head}${badge ? `<span class="badge${badgeMono ? ' mono' : ''}">${esc(badge)}</span>` : ''}</header>
    ${lights()}
    <div class="fx"><div class="cell">${esc(cell || 'A1')}</div><div class="f"><i>fx</i>&nbsp; ${esc(fx || '')}</div></div>
    <main>${body}</main>${tabs || ''}`;
}
function fall(kind) {
  let s = '<div class="fall" aria-hidden="true">';
  if (kind === 'snow') {
    for (let i = 0; i < 26; i++) {
      const size = [3, 4, 4, 5, 6][i % 5];
      s += `<span class="flake" style="left:${(i * 37) % 100}%;width:${size}px;height:${size}px;opacity:${[0.35, 0.45, 0.55][i % 3]};animation-duration:${12 + (i * 7) % 10}s;animation-delay:-${(i * 5) % 22}s"></span>`;
    }
  } else {
    const cols = ['#B3261E', '#1E5B3F', '#D4A017', '#2F5D8A', '#E07A5F'];
    for (let i = 0; i < 22; i++) s += `<span class="confetti" style="left:${(i * 29) % 100}%;background:${cols[i % 5]};animation-duration:${4 + (i * 3) % 5}s;animation-delay:-${(i * 2) % 8}s"></span>`;
  }
  return s + '</div>';
}

// ---------------------------------------------------------------- 상태
const S = { route: null, token: null, tab: null, view: null, host: null, form: null, confirm: null, busy: false, homeInfo: {} };
const actions = {};
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  ev.preventDefault();
  const fn = actions[el.dataset.act];
  if (fn) fn(el, ev);
});
document.addEventListener('input', (ev) => {
  const el = ev.target.closest('[data-in]');
  if (el && actions[el.dataset.in]) actions[el.dataset.in](el, ev);
});
// 두 번 눌러야 실행되는 버튼
function twoStep(id, label, confirmLabel) {
  return S.confirm === id ? confirmLabel : label;
}
function armed(id) {
  if (S.confirm === id) { S.confirm = null; return true; }
  S.confirm = id; render();
  setTimeout(() => { if (S.confirm === id) { S.confirm = null; render(); } }, 4000);
  return false;
}
async function busy(fn) {
  if (S.busy) return;
  S.busy = true;
  try { await fn(); } catch (e) { toast(e.message); } finally { S.busy = false; }
}

// ---------------------------------------------------------------- 라우터
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const parts = h.split('/');
  if (parts[0] === 'new') return { name: 'new' };
  if (parts[0] === 'r' && parts[1]) return { name: 'room', token: parts[1], tab: parts[2] || null };
  return { name: 'home' };
}
async function route() {
  const r = parseHash();
  S.route = r.name; S.confirm = null;
  if (r.name !== 'new') S.form = null;
  if (r.name === 'home') { render(); refreshHome(); return; }
  if (r.name === 'new') { if (!S.form) S.form = newForm(); render(); return; }
  if (r.name === 'room') {
    const changed = S.token !== r.token;
    S.token = r.token;
    if (r.tab) S.tab = r.tab; else if (changed) S.tab = null;
    if (changed) { S.view = null; S.host = null; $app.innerHTML = '<div class="loading">🎄 불러오는 중…</div>'; }
    await loadRoom();
  }
}
window.addEventListener('hashchange', route);

async function loadRoom(silent) {
  const token = S.token;
  try {
    const v = await rpc('my_view', { p_token: token });
    if (token !== S.token) return;
    S.view = v;
    if (v.me.joined) rememberRoom(token, v);
    if (v.me.is_host) S.host = await rpc('host_overview', { p_token: token });
    if (!S.tab || !tabsFor(v).some((t) => t.id === S.tab)) S.tab = defaultTab(v);
    if (v.me.joined) history.replaceState(null, '', '#/r/' + token + '/' + S.tab);
    S.error = null;
  } catch (e) {
    if (token !== S.token) return;
    if (silent) return;
    S.view = null; S.error = e;
    if (e.code === 'INVALID_LINK' || e.code === 'ROOM_STARTED') forgetRoom(token);
  }
  if (silent && isTyping()) return;
  render();
}
const isTyping = () => { const a = document.activeElement; return a && /INPUT|TEXTAREA|SELECT/.test(a.tagName); };
setInterval(() => {
  if (S.route === 'room' && S.view && document.visibilityState === 'visible' && !S.busy) loadRoom(true);
}, 30000);

let lastScreen = '';
function render() {
  const key = S.route + '|' + S.token + '|' + S.tab;
  if (S.route === 'home') $app.innerHTML = viewHome();
  else if (S.route === 'new') $app.innerHTML = viewCreate();
  else if (S.route === 'room') $app.innerHTML = S.error ? viewError() : S.view ? (S.view.me.joined ? viewRoom() : viewJoin()) : '<div class="loading">🎄 불러오는 중…</div>';
  if (key !== lastScreen) { lastScreen = key; window.scrollTo(0, 0); }
}

// ---------------------------------------------------------------- 홈: 내 방 목록
function statusOf(v) {
  const r = v.room, t = v.today;
  if (r.status === 'waiting') return { label: '시작 전', cls: 'r', when: '대기' };
  if (r.mode === 'gift') return { label: '진행중', cls: 'g', when: dday(r.gift_date, t) };
  if (r.status === 'active') return { label: '진행중', cls: 'g', when: dday(r.end_date, t) };
  if (r.status === 'guessing') return { label: '정답 맞히기', cls: 'r', when: '~' + mmdd(r.guess_deadline) };
  return { label: '종료', cls: 'n', when: '공개됨' };
}
async function refreshHome() {
  const list = loadRooms();
  await Promise.all(list.map(async (x) => {
    try { S.homeInfo[x.token] = await rpc('my_view', { p_token: x.token }); }
    catch (e) { S.homeInfo[x.token] = { error: e.code || 'ERR' }; }
  }));
  if (S.route === 'home') render();
}
function viewHome() {
  const list = loadRooms();
  const rows = list.map((x) => {
    const v = S.homeInfo[x.token];
    if (v && (v.error === 'INVALID_LINK' || v.error === 'ROOM_STARTED')) {
      return `<div class="tr" style="grid-template-columns:minmax(0,1fr) 88px"><div class="col"><b>${esc(x.name)}</b><span class="small">링크가 만료됐어요</span></div><div><button class="mini warn" data-act="forget" data-token="${esc(x.token)}">목록에서 빼기</button></div></div>`;
    }
    const st = v && v.room ? statusOf(v) : { label: '…', cls: 'n', when: '' };
    const kind = x.mode === 'gift' ? '🎁 선물교환형' : '🎯 미션형';
    const meta = v && v.room ? `${v.members.length}명 · ${kind}${v.me.is_host ? ' · 내가 방장' : ''}` : kind;
    return `<a class="tr" href="#/r/${esc(x.token)}" style="grid-template-columns:minmax(0,1fr) 86px 70px"><div class="col"><b>${esc(v && v.room ? v.room.name : x.name)}</b><span class="small">${esc(meta)}</span></div><div><span class="pill ${st.cls}">${st.label}</span></div><div style="font-family:var(--mono);font-weight:600;font-size:13px">${esc(st.when)}</div></a>`;
  }).join('');
  const body = `
    <div class="stack" style="gap:4px"><h1><span class="bob">🎄</span> 참여 중인 마니또 방</h1><p class="sub">여러 방에 동시에 참여할 수 있어요</p></div>
    ${list.length ? `<div class="sheet"><div class="tr th" style="grid-template-columns:minmax(0,1fr) 86px 70px"><div>방 이름</div><div>상태</div><div>일정</div></div>${rows}</div>`
      : `<div class="empty">아직 참여한 방이 없어요.<br>카톡으로 받은 <b>개인 링크</b>를 열면 여기에 방이 생겨요.</div>`}
    <a class="btn red" href="#/new">＋ 새 마니또 방 만들기 🎁</a>
    <div class="box"><span class="small" style="font-family:var(--mono)">B7 · 🔑 안내</span><p style="font-size:13px;line-height:1.6">카톡으로 받은 <b>개인 링크</b>를 누르면 자동으로 로그인돼요. 링크는 나만 쓰는 열쇠이니 다른 사람에게 보내지 마세요. 방 목록은 이 기기에만 저장돼요.</p></div>`;
  return shell({ cell: 'A1', fx: '=내_방_목록()', body });
}
actions.forget = (el) => { forgetRoom(el.dataset.token); render(); };

// ---------------------------------------------------------------- 방 만들기
function newForm() {
  const t = todayKST();
  return { mode: 'mission', name: '', host: '', start: t, end: addDays(t, 14), count: 4, style: '대면', gift: addDays(t, 14), budget: '2만 원', custom: '', names: ['', '', '', ''] };
}
const daysOf = (f) => (f.start && f.end && f.end >= f.start ? diffDays(f.end, f.start) + 1 : 1);
const maxCount = (f) => Math.min(10, daysOf(f));
function viewCreate() {
  const f = S.form;
  const today = todayKST();
  if (f.count > maxCount(f)) f.count = maxCount(f);
  const isGift = f.mode === 'gift';
  const budgets = ['상한 없음', '1만 원', '2만 원', '3만 원', '5만 원', '직접 입력'];
  const total = f.names.filter((n) => n.trim()).length + (f.host.trim() ? 1 : 0);
  const body = `
    <div class="field"><label for="f-name">방 이름</label><input id="f-name" class="input" maxlength="40" placeholder="예) 우리팀 연말 마니또" value="${esc(f.name)}" data-in="fset" data-k="name"></div>
    <div class="field"><label for="f-host">내 이름 (대표)</label><input id="f-host" class="input" maxlength="20" placeholder="예) 김민제" value="${esc(f.host)}" data-in="fset" data-k="host"></div>
    <div class="field"><span class="label">방 종류</span>
      <div class="modes">
        <button type="button" class="mode${!isGift ? ' on' : ''}" data-act="fmode" data-v="mission"><b>🎯 미션형</b><span>기간 동안 미션·위시리스트, 마지막에 정답 맞히기</span></button>
        <button type="button" class="mode gift${isGift ? ' on' : ''}" data-act="fmode" data-v="gift"><b>🎁 선물교환형</b><span>마니또 지정만. 만나는 날 선물 교환</span></button>
      </div></div>
    ${isGift ? `
      <div class="field"><label for="f-gift">선물 교환하는 날</label><input id="f-gift" type="date" class="input" min="${today}" value="${esc(f.gift)}" data-in="fset" data-k="gift"><span class="small">매칭하면 바로 각자 선물할 사람이 보여요. 미션·위시리스트·정답 맞히기는 없어요.</span></div>
      <div class="field"><span class="label">💰 선물 금액 상한</span>
        <div class="pills">${budgets.map((b) => `<button type="button" class="${f.budget === b ? 'on' : ''}" data-act="fbudget" data-v="${b}">${b}</button>`).join('')}</div>
        ${f.budget === '직접 입력' ? `<div class="row"><label for="f-custom" class="small">직접 입력</label><input id="f-custom" class="input" style="width:150px;font-family:var(--mono)" inputmode="numeric" placeholder="15000" value="${esc(f.custom)}" data-in="fset" data-k="custom"><span>원 이하</span></div>` : ''}
        <span class="small">참여자 모두의 화면에 "선물은 OO 이하"로 표시돼요.</span></div>`
    : `
      <div class="grid2">
        <div class="field"><label for="f-start">시작일</label><input id="f-start" type="date" class="input" min="${today}" value="${esc(f.start)}" data-in="fset" data-k="start"></div>
        <div class="field"><label for="f-end">종료일</label><input id="f-end" type="date" class="input" min="${esc(f.start || today)}" value="${esc(f.end)}" data-in="fset" data-k="end"></div>
      </div>
      <div class="field"><span class="label">미션 횟수</span>
        <div class="step"><button type="button" aria-label="미션 횟수 줄이기" data-act="fcount" data-v="-1">−</button><b>${f.count}</b><button type="button" aria-label="미션 횟수 늘리기" data-act="fcount" data-v="1">+</button><span class="small" style="flex:1">기간을 ${f.count}등분해 자동으로 열려요 (최대 ${maxCount(f)}회)</span></div></div>
      <div class="field"><span class="label">미션 방식</span>
        <div class="pills green">${['대면', '비대면'].map((s) => `<button type="button" class="${f.style === s ? 'on' : ''}" data-act="fstyle" data-v="${s}">${s === '대면' ? '🏢 대면 (자주 만나요)' : '📱 비대면 (단톡·SNS)'}</button>`).join('')}</div></div>`}
    <div class="field">
      <div class="between"><span class="label">함께할 사람 (나 빼고)</span><span class="small" style="font-family:var(--mono)">${total} / 30명</span></div>
      <div class="sheet names">
        <div class="tr th"><div></div><div>A 이름</div><div></div></div>
        ${f.names.map((n, i) => `<div class="tr"><div class="num">${i + 1}</div><div style="padding:2px 6px"><input aria-label="${i + 1}번째 이름" maxlength="20" value="${esc(n)}" data-in="fname" data-i="${i}" placeholder="${i === 0 ? '이름 (엑셀에서 붙여넣기 OK)' : ''}"></div><div style="padding:0"><button type="button" class="x" aria-label="${i + 1}번째 행 삭제" data-act="fdel" data-i="${i}">×</button></div></div>`).join('')}
      </div>
      <button type="button" class="btn line sm" data-act="fadd">+ 행 추가</button>
      <span class="small">이름만 적으면 사람마다 개인 링크가 만들어져요. 시작 후에는 명단을 바꿀 수 없어요. 같은 이름은 '김민수(마케팅)'처럼 구분해주세요.</span>
    </div>
    <button type="button" class="btn red" data-act="fsubmit">🔗 방 만들고 개인 링크 받기</button>`;
  return shell({ back: true, title: '🎄 새 마니또 방 만들기', cell: '설정', fx: '=방_만들기(이름, 기간, 명단)', body });
}
actions.fset = (el) => {
  S.form[el.dataset.k] = el.value;
  if (['start', 'end'].includes(el.dataset.k)) { if (S.form.count > maxCount(S.form)) S.form.count = maxCount(S.form); const s = document.querySelector('.step b'); if (s) s.textContent = S.form.count; const h = document.querySelector('.step .small'); if (h) h.textContent = `기간을 ${S.form.count}등분해 자동으로 열려요 (최대 ${maxCount(S.form)}회)`; const e = document.getElementById('f-end'); if (e && S.form.start) e.min = S.form.start; }
  if (el.dataset.k === 'host') { const tot = document.querySelector('.between .small'); if (tot) tot.textContent = `${S.form.names.filter((n) => n.trim()).length + (S.form.host.trim() ? 1 : 0)} / 30명`; }
};
actions.fmode = (el) => { S.form.mode = el.dataset.v; render(); };
actions.fbudget = (el) => { S.form.budget = el.dataset.v; render(); };
actions.fstyle = (el) => { S.form.style = el.dataset.v; render(); };
actions.fcount = (el) => { S.form.count = Math.min(maxCount(S.form), Math.max(1, S.form.count + Number(el.dataset.v))); render(); };
actions.fadd = () => { if (S.form.names.length < 29) { S.form.names.push(''); render(); focusName(S.form.names.length - 1); } };
actions.fdel = (el) => { S.form.names.splice(Number(el.dataset.i), 1); if (!S.form.names.length) S.form.names.push(''); render(); };
actions.fname = (el) => {
  const i = Number(el.dataset.i);
  const v = el.value;
  if (/[\n\t]/.test(v)) {
    const parts = v.split(/[\n\t]+/).map((x) => x.trim()).filter(Boolean);
    S.form.names.splice(i, 1, ...parts);
    S.form.names = S.form.names.slice(0, 29);
    render();
  } else {
    S.form.names[i] = v;
    const tot = document.querySelector('.between .small');
    if (tot) tot.textContent = `${S.form.names.filter((n) => n.trim()).length + (S.form.host.trim() ? 1 : 0)} / 30명`;
  }
};
function focusName(i) { const el = document.querySelector(`[data-in="fname"][data-i="${i}"]`); if (el) el.focus(); }
// 엑셀 여러 줄 붙여넣기
document.addEventListener('paste', (ev) => {
  const el = ev.target.closest && ev.target.closest('[data-in="fname"]');
  if (!el) return;
  const text = (ev.clipboardData || window.clipboardData).getData('text');
  if (!/[\n\t]/.test(text)) return;
  ev.preventDefault();
  const i = Number(el.dataset.i);
  const parts = text.split(/[\r\n\t]+/).map((x) => x.trim()).filter(Boolean);
  S.form.names.splice(i, 1, ...parts);
  S.form.names = S.form.names.slice(0, 29);
  render();
});
actions.fsubmit = () => busy(async () => {
  const f = S.form;
  const names = f.names.map((n) => n.trim()).filter(Boolean);
  if (!f.name.trim()) throw new Error(ERR.ROOM_NAME_REQUIRED);
  if (!f.host.trim()) throw new Error(ERR.HOST_NAME_REQUIRED);
  const all = [f.host.trim(), ...names.filter((n) => normName(n) !== normName(f.host.trim()))];
  if (new Set(all.map(normName)).size !== all.length) throw new Error(ERR.DUPLICATE_NAME);
  const today = todayKST();
  if (all.length < 3) throw new Error(ERR.MIN_3);
  if (all.length > 30) throw new Error(ERR.MAX_30);
  const p = { name: f.name.trim(), host_name: f.host.trim(), mode: f.mode, names };
  if (f.mode === 'mission') {
    if (!f.start || !f.end || f.end < f.start) throw new Error('종료일이 시작일보다 빨라요.');
    if (f.start < today) throw new Error(ERR.PAST_DATE);
    if (f.count > maxCount(f)) throw new Error(ERR.MISSION_COUNT_OVER_DAYS);
    Object.assign(p, { start_date: f.start, end_date: f.end, mission_count: f.count, mission_style: f.style });
  } else {
    if (!f.gift) throw new Error('선물 교환하는 날을 골라주세요.');
    if (f.gift < today) throw new Error(ERR.PAST_DATE);
    let budget = f.budget === '상한 없음' ? '' : f.budget;
    if (f.budget === '직접 입력') {
      const n = Number(String(f.custom).replace(/[^0-9]/g, ''));
      if (!n) throw new Error('금액을 숫자로 적어주세요.');
      budget = n.toLocaleString('ko-KR') + '원';
    }
    Object.assign(p, { gift_date: f.gift, budget });
  }
  const res = await rpc('create_room', { p });
  S.form = null;
  toast('방이 만들어졌어요! 이제 개인 링크를 보내주세요 🎁');
  location.hash = '#/r/' + res.token + '/admin';
});

// ---------------------------------------------------------------- 초대 / 오류
function viewJoin() {
  const v = S.view, r = v.room;
  const rows = r.mode === 'gift'
    ? `<div>교환일</div><div>${esc(longDate(r.gift_date))}</div><div>선물 금액</div><div>${esc(r.budget ? r.budget + ' 이하' : '상한 없음')}</div>`
    : `<div>기간</div><div style="font-family:var(--mono)">${mmdd(r.start_date)} ~ ${mmdd(r.end_date)}</div><div>미션</div><div>기간 중 ${r.mission_count}회 (${esc(r.mission_style)})</div>`;
  return `${fall('snow')}<header class="top"><span class="brand">⭐ 마니또.xlsx</span></header>
    <div class="join">
      <div class="stack" style="gap:8px"><span style="font-family:var(--mono);font-size:12px;color:#CFE3D6">=초대장("${esc(v.me.name)}")</span>
        <h1 style="color:#fff;font-size:28px"><span class="bob">💌</span> ${esc(v.me.name)}님,<br>마니또 방에<br>초대받았어요 🎄</h1></div>
      <div class="card"><div class="kv"><div>방 이름</div><div><b>${esc(r.name)}</b></div><div>방장</div><div>${esc(r.host_name)}</div><div>방 종류</div><div>${r.mode === 'gift' ? '🎁 선물교환형' : '🎯 미션형'}</div>${rows}<div>인원</div><div>${v.members.length}명 초대 · ${v.members.filter((m) => m.joined).length}명 참여</div></div></div>
      <button class="btn red" style="min-height:56px;font-size:17px" data-act="join">🎅 이 링크로 참여하기</button>
      <p>비밀번호는 필요 없어요. 이 링크가 ${esc(v.me.name)}님 전용 로그인 열쇠예요. 다음에도 같은 링크로 들어오면 돼요.</p>
    </div>`;
}
actions.join = () => busy(async () => { await rpc('join_room', { p_token: S.token }); await loadRoom(); toast('참여했어요! 🎄'); });
actions.retry = () => { S.error = null; $app.innerHTML = '<div class="loading">🎄 불러오는 중…</div>'; loadRoom(); };
function viewError() {
  const retry = ['NETWORK', 'UNKNOWN'].includes(S.error.code) ? '<button class="btn" data-act="retry">🔄 다시 시도</button>' : '';
  const body = `<div class="empty" style="font-size:15px">😢 ${esc(S.error.message)}</div>${retry}<a class="btn line" href="#/">내 방 목록으로</a>`;
  return shell({ cell: 'A1', fx: '=IFERROR(링크, "다시 받기")', body });
}

// ---------------------------------------------------------------- 방 화면
function tabsFor(v) {
  const t = v.room.mode === 'gift'
    ? [{ id: 'manito', label: '🎁 마니또' }, { id: 'lobby', label: '🎄 로비' }]
    : [{ id: 'lobby', label: '🎄 로비' }, { id: 'manito', label: '🎅 마니또' }, { id: 'wish', label: '🎁 위시' }, { id: 'answer', label: '⭐ 정답' }];
  if (v.me.is_host) t.push({ id: 'admin', label: '📋 관리' });
  return t;
}
function defaultTab(v) {
  const r = v.room;
  if (r.status === 'waiting') return v.me.is_host ? 'admin' : 'lobby';
  if (r.mode === 'gift') return 'manito';
  if (r.status === 'active') return 'manito';
  return 'answer';
}
function setTab(id) {
  S.tab = id; S.confirm = null;
  history.replaceState(null, '', '#/r/' + S.token + '/' + id);
  render();
}
actions.tab = (el) => { setTab(el.dataset.tab); loadRoom(true); };
function viewRoom() {
  const v = S.view, r = v.room;
  const tabs = `<nav class="tabs">${tabsFor(v).map((t) => `<a href="#/r/${esc(S.token)}/${t.id}" data-act="tab" data-tab="${t.id}" class="${S.tab === t.id ? 'on' : ''}">${t.label}</a>`).join('')}</nav>`;
  const st = statusOf(v);
  const badge = r.status === 'waiting' ? '시작 전' : r.status === 'guessing' ? '기간 종료' : r.status === 'revealed' ? '정답 공개' : st.when;
  const map = { lobby: tabLobby, manito: r.mode === 'gift' ? tabGift : tabManito, wish: tabWish, answer: tabAnswer, admin: tabAdmin };
  const { cell, fx, body } = (map[S.tab] || tabLobby)();
  return (S.tab === 'answer' && r.status === 'revealed' ? fall('confetti') : '') +
    shell({ back: true, title: r.name, badge, badgeMono: /^D/.test(badge), cell, fx, body, tabs });
}

function tabLobby() {
  const v = S.view, r = v.room;
  const joined = v.members.filter((m) => m.joined).length;
  let stats;
  if (r.mode === 'gift') {
    stats = `<div><span>교환일</span><b>${mmdd(r.gift_date)}</b></div><div><span>남은 날</span><b>${dday(r.gift_date, v.today)}</b></div><div><span>선물 금액</span><b style="font-family:inherit;font-size:14px">${esc(r.budget || '상한 없음')}</b></div>`;
  } else {
    const opened = v.missions.filter((m) => m.opened).length;
    const next = v.missions.find((m) => !m.opened);
    stats = `<div><span>진행</span><b>${mmdd(r.start_date)}~${mmdd(r.end_date)}</b></div><div><span>미션 오픈</span><b>${r.status === 'waiting' ? '-' : opened + ' / ' + v.missions.length}</b></div><div><span>다음 미션</span><b>${next ? mmdd(next.open_date) : '-'}</b></div>`;
  }
  const seats = v.members.map((m, i) => `<div class="seat${m.joined ? '' : ' off'}${m.id === v.me.id ? ' me' : ''}">${avatar(m.name, i)}<span>${esc(m.name)}</span></div>`).join('');
  let cta = '';
  if (r.status === 'waiting') {
    cta = `<div class="note gray">⏳ 대표가 매칭을 시작하면 마니또가 공개돼요. 지금 ${joined}명 참여, ${v.members.length - joined}명 대기 중이에요.</div>`;
  } else if (r.mode === 'mission' && r.status === 'active') {
    const todo = v.missions.filter((m) => m.opened && !m.done).length;
    cta = `<a href="#/r/${esc(S.token)}/manito" data-act="tab" data-tab="manito" class="box" style="border-color:var(--red);background:#fff;border-radius:8px;text-decoration:none;color:var(--ink);flex-direction:row;align-items:center"><span style="font-size:26px">🔔</span><div class="stack" style="gap:2px;flex:1"><span style="font-size:12px;font-weight:700;color:var(--red)">${todo ? `안 한 미션 ${todo}개` : '열린 미션 모두 완료!'}</span><b>내 마니또 확인하고 미션 하러 가기</b></div><span aria-hidden="true">›</span></a>`;
  } else if (r.mode === 'mission') {
    cta = `<a href="#/r/${esc(S.token)}/answer" data-act="tab" data-tab="answer" class="btn red">⭐ ${r.status === 'revealed' ? '정답 보러 가기' : '예상 마니또 제출하러 가기'}</a>`;
  }
  const body = `<div class="stats">${stats}</div>
    <div class="between"><h2><span class="bob">☃️</span> 크리스마스 라운지</h2><span class="small">셀 하나 = 한 명</span></div>
    <div class="lounge">${seats}</div>
    <div class="row small" style="gap:14px;flex-wrap:wrap"><span>진한 셀: 참여</span><span>흐린 셀: 링크 미확인</span><span>초록 테두리: 나</span></div>
    ${cta}`;
  return { cell: 'A1', fx: `=로비(참여 ${joined}/${v.members.length})`, body };
}

function lockedTarget() {
  return `<div class="hero"><span style="font-size:40px">🔒</span><b>아직 매칭 전이에요</b><span class="small">대표가 매칭을 시작하면 여기에 내가 챙겨줄 사람이 나와요.</span></div>`;
}
function targetHero(label, red, emoji) {
  const v = S.view;
  const idx = v.members.findIndex((m) => m.name === v.target.name);
  return `<section class="hero${red ? ' red' : ''}"><span style="font-size:13px;font-weight:700;color:var(--muted)">🤫 ${label}</span>${avatar(v.target.name, idx < 0 ? 0 : idx, true)}<span class="who">${esc(v.target.name)} <span class="bob">${emoji}</span></span><span class="secret">다른 사람에게 이 화면을 보여주지 마세요</span></section>`;
}
function tabManito() {
  const v = S.view, r = v.room;
  if (!v.target) return { cell: 'B2', fx: '=내가_챙길_사람()', body: lockedTarget() };
  const wishes = v.target.wishes || [];
  const wl = wishes.length
    ? `<div class="sheet">${wishes.map((w, i) => `<div class="tr" style="grid-template-columns:36px minmax(0,1fr)"><div class="num">${i + 1}</div><div>${esc(w)}</div></div>`).join('')}</div>`
    : `<div class="empty" style="padding:16px">아직 위시리스트를 안 썼어요</div>`;
  const ms = v.missions.map((m) => {
    const locked = !m.opened;
    const canToggle = m.opened && r.status === 'active';
    return `<div class="tr" style="grid-template-columns:36px minmax(0,1fr) 80px;background:${locked ? '#F7F7F5' : m.done ? 'var(--green-l)' : '#fff'}">
      <div class="num">${m.seq}</div>
      <div class="col"><span style="font-weight:${locked ? 400 : 700};color:${locked ? '#5E6A63' : 'var(--ink)'}">${locked ? '🔒 잠김 · ' + mmdd(m.open_date) + '에 공개돼요' : esc(m.text)}</span><span class="small" style="font-family:var(--mono)">${mmdd(m.open_date)} 오픈${m.open_date === v.today ? ' · 오늘' : ''}</span></div>
      <div style="justify-content:center;padding:4px">${canToggle ? `<button class="mini${m.done ? ' on' : ''}" data-act="mdone" data-seq="${m.seq}" data-done="${m.done ? 0 : 1}">${m.done ? '완료됨 ✅' : '완료'}</button>` : `<span class="small ${m.done ? 'ok' : ''}">${m.done ? '완료' : locked ? '잠김' : '-'}</span>`}</div></div>`;
  }).join('');
  const body = `${targetHero('내가 몰래 챙겨줄 사람', false, '✨')}
    <section class="stack"><h2>🎁 ${esc(v.target.name)}님의 위시리스트</h2>${wl}</section>
    <section class="stack"><div class="between"><h2>🎯 미션</h2><span class="small">방 전체 공통 · ${v.missions.length}회</span></div><div class="sheet">${ms}</div>
    <span class="small">미션은 모두 같은 내용이에요. 들키지 않게 몰래 해보세요!</span></section>`;
  return { cell: 'B2', fx: '=내가_챙길_사람()', body };
}
actions.mdone = (el) => busy(async () => {
  await rpc('set_mission_done', { p_token: S.token, p_seq: Number(el.dataset.seq), p_done: el.dataset.done === '1' });
  await loadRoom(true); render();
  if (el.dataset.done === '1') toast('미션 완료! 🎉');
});

function tabGift() {
  const v = S.view, r = v.room;
  if (!v.target) return { cell: 'B2', fx: '=선물할_사람()', body: lockedTarget() };
  const budget = r.budget ? r.budget + ' 이하' : '상한 없음';
  const body = `${targetHero('내가 선물할 사람', true, '🎁')}
    <div class="kv"><div>교환하는 날</div><div class="between" style="align-items:center"><b>${esc(longDate(r.gift_date))}</b><span class="badge mono">${dday(r.gift_date, v.today)}</span></div>
      <div>선물 금액</div><div><b style="color:var(--red)">💰 ${esc(budget)}</b></div>
      <div>참여</div><div>${v.members.length}명 · 방장 ${esc(r.host_name)}</div></div>
    <div class="box"><b>🎄 이렇게 진행돼요</b><p style="font-size:13px;line-height:1.8;color:#3A453F">1. 위 사람을 위한 선물을 ${esc(r.budget ? r.budget + ' 이하로 ' : '')}준비해요<br>2. 교환하는 날 만나서 선물을 건네요<br>3. 건네면서 "내가 네 마니또였어!" 하고 정체를 밝혀요</p></div>`;
  return { cell: 'B2', fx: '=선물할_사람()', body };
}

function tabWish() {
  const v = S.view, r = v.room;
  const editable = ['waiting', 'active'].includes(r.status);
  const w = v.me.wishes || [];
  const ph = ['예) 아침에 커피 한 잔 같이 마시기', '예) 응원 쪽지 남겨주기', '예) 점심 메뉴 대신 골라주기'];
  const rows = [0, 1, 2].map((i) => `<div class="tr" style="grid-template-columns:36px minmax(0,1fr)"><div class="num">${i + 1}</div><div class="col" style="gap:4px"><label for="wish${i}" class="small" style="font-weight:700">바라는 것 ${i + 1}</label><input id="wish${i}" class="input" maxlength="60" placeholder="${ph[i]}" value="${esc(w[i] || '')}" ${editable ? '' : 'disabled'}></div></div>`).join('');
  const body = `<div class="stack" style="gap:4px"><h1><span class="bob">🎁</span> 내 마니또에게 바라는 것</h1><p class="sub">내 마니또만 볼 수 있어요. 최대 3개까지 적을 수 있어요.</p></div>
    <div class="note red" role="note"><span aria-hidden="true">🚫</span><p><b>금품은 적을 수 없어요.</b> 현금, 상품권, 기프티콘, 특정 금액의 선물은 안 돼요. 마니또가 직접 해줄 수 있는 <b>행동</b>을 적어주세요.</p></div>
    <div class="sheet">${rows}</div>
    ${editable ? `<button class="btn" data-act="wsave">저장하기 🎀</button><p class="small">마니또 기간이 끝나기 전까지 언제든 고칠 수 있어요.</p>` : `<p class="small">마니또 기간이 끝나서 더 이상 고칠 수 없어요.</p>`}`;
  return { cell: 'C1', fx: '=위시리스트(최대 3)', body };
}
actions.wsave = () => busy(async () => {
  const wishes = [0, 1, 2].map((i) => document.getElementById('wish' + i).value);
  const bad = wishes.find((x) => /(현금|상품권|기프티콘|\d+\s*(만\s*)?원)/.test(x));
  if (bad) throw new Error('금품이나 금액은 적을 수 없어요 🙏');
  await rpc('save_wishes', { p_token: S.token, p_wishes: wishes });
  await loadRoom(true); render();
  toast('저장했어요 ✅');
});

function tabAnswer() {
  const v = S.view, r = v.room;
  if (r.status === 'waiting' || r.status === 'active') {
    const body = `<div class="hero"><span style="font-size:40px">⏳</span><b>아직 마니또 기간이에요</b><span class="small">${mmdd(r.end_date)} 기간이 끝나면 다음 날부터 3일 동안<br>"내 마니또는 누구?" 예상을 제출할 수 있어요.</span></div>`;
    return { cell: 'D1', fx: '=IF(기간종료, 예상제출, 대기)', body };
  }
  if (r.status === 'guessing') {
    const g = v.guess, pct = Math.round((g.submitted / g.total) * 100);
    const opts = v.members.filter((m) => m.id !== v.me.id)
      .map((m) => `<option value="${m.id}" ${v.me.guess_id === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
    const body = `<div class="stack" style="gap:4px"><h1><span class="bob">🕵️</span> 나를 챙겨준 마니또는<br>누구였을까요?</h1><p class="sub">모두 제출하면 바로 정답이 공개돼요. 마감: ${esc(longDate(r.guess_deadline))}</p></div>
      <div class="field"><label for="guess">예상 마니또</label><select id="guess" class="input">${v.me.guess_id ? '' : '<option value="">골라주세요</option>'}${opts}</select></div>
      <button class="btn" data-act="gsubmit">${v.me.guess_id ? '✅ 제출 완료 · 다시 제출하기' : '🎯 제출하기'}</button>
      <section class="sheet"><div class="tr th" style="grid-template-columns:minmax(0,1fr) 96px"><div>제출 현황</div><div style="justify-content:flex-end;font-family:var(--mono)">${g.submitted} / ${g.total}</div></div>
        <div style="padding:12px;display:flex;flex-direction:column;gap:8px"><div class="bar"><div style="width:${pct}%"></div></div><span class="small">누가 누구를 골랐는지는 공개 전까지 아무도 볼 수 없어요.</span></div></section>
      ${v.me.is_host ? `<section class="box red"><div class="row"><span class="tag">대표 전용</span><b>미제출 ${g.total - g.submitted}명이 남았어요</b></div><p class="small" style="color:#3A453F">연락이 안 되는 사람이 있으면 지금 바로 정답을 공개할 수 있어요. 미제출자는 '예상 없음'으로 처리돼요.</p><button class="btn line red sm" data-act="reveal">${twoStep('reveal', '🔓 강제로 정답 공개하기', '한 번 더 누르면 공개돼요')}</button></section>` : ''}`;
    return { cell: 'D1', fx: `=IF(제출=${g.total}, 정답공개, 대기)`, body };
  }
  const rv = v.reveal || { rows: [] };
  const hit = rv.my_guess && rv.my_guess === rv.my_manito;
  const hits = rv.rows.filter((x) => x.hit).length;
  const rows = rv.rows.map((x, i) => `<div class="tr" style="grid-template-columns:30px minmax(0,1fr) minmax(0,1fr) 54px;background:${x.receiver === v.me.name ? 'var(--green-l)' : '#fff'}"><div class="num">${i + 1}</div><div><b>${esc(x.giver)}</b></div><div>${esc(x.receiver)}</div><div style="justify-content:center">${x.hit ? '⭕' : '❌'}</div></div>`).join('');
  const body = `<section class="reveal"><span style="font-size:13px;color:#CFE3D6">나를 챙겨준 마니또는</span><span class="big">🎉 ${esc(rv.my_manito || '?')} 🎉</span>
      <div class="row" style="font-size:14px"><span class="pill" style="background:#fff;color:var(--green)">${hit ? '🎯 맞혔어요' : rv.my_guess ? '😅 아쉬워요' : '예상 없음'}</span>${rv.my_guess ? `<span>내 예상: ${esc(rv.my_guess)}</span>` : ''}</div></section>
    <section class="stack"><h2>🏆 전체 결과</h2><div class="sheet"><div class="tr th" style="grid-template-columns:30px minmax(0,1fr) minmax(0,1fr) 54px"><div></div><div>🎅 마니또</div><div>🎁 받은 사람</div><div style="justify-content:center">맞힘</div></div>${rows}</div></section>`;
  return { cell: 'E1', fx: `=COUNTIF(맞힘,"O") → ${hits} / ${rv.rows.length}`, body };
}
actions.gsubmit = () => busy(async () => {
  const id = document.getElementById('guess').value;
  if (!id) throw new Error('예상 마니또를 골라주세요.');
  await rpc('submit_guess', { p_token: S.token, p_guess: id });
  await loadRoom(true); render();
  toast(S.view.room.status === 'revealed' ? '모두 제출해서 정답이 공개됐어요! 🎉' : '제출했어요 🎯');
});
actions.reveal = () => { if (!armed('reveal')) return; busy(async () => { await rpc('force_reveal', { p_token: S.token }); S.tab = 'answer'; await loadRoom(); toast('정답이 공개됐어요 🎉'); }); };

function tabAdmin() {
  const v = S.view, r = v.room, h = S.host || { members: [] };
  const joined = h.members.filter((m) => m.joined).length;
  const isMission = r.mode === 'mission';
  const cols = `grid-template-columns:30px minmax(0,1fr) ${isMission ? '52px ' : ''}120px`;
  const rows = h.members.map((m, i) => {
    let state = m.joined ? '<span class="ok">참여</span>' : '<span class="no">대기</span>';
    if (r.status === 'guessing') state = m.guessed ? '<span class="ok">제출</span>' : '<span class="no">미제출</span>';
    return `<div class="tr" style="${cols}"><div class="num">${i + 1}</div>
      <div class="col"><b>${esc(m.name)}${m.is_host ? ' 👑' : ''}</b><span class="small">${state}</span></div>
      ${isMission ? `<div style="font-size:12px;justify-content:center">${m.wish_done ? '<span class="ok">위시✓</span>' : '<span class="small">위시-</span>'}</div>` : ''}
      <div style="gap:4px;padding:4px;justify-content:flex-end">${m.is_host ? '<button class="mini" data-act="copyme">내 링크</button>' : `${m.token ? `<button class="mini" data-act="share" data-id="${m.id}" aria-label="${esc(m.name)}님 링크 보내기">보내기</button>` : '<span class="small ok" style="padding:0 4px">전달됨</span>'}<button class="mini warn${S.confirm === 're' + m.id ? ' on' : ''}" data-act="reissue" data-id="${m.id}" aria-label="${esc(m.name)}님 링크 재발급" style="min-width:44px">${S.confirm === 're' + m.id ? '확인' : '↻'}</button>`}</div></div>`;
  }).join('');
  let action = '';
  if (r.status === 'waiting') {
    action = `<section class="box"><b>참여 ${joined}명 · 대기 ${h.members.length - joined}명</b>
      <p class="small" style="color:#3A453F">지금 시작하면 <b>참여한 ${joined}명만</b> 랜덤으로 매칭돼요. 대기 중인 사람은 이 방에 들어올 수 없게 돼요.${joined < 3 ? '<br><b class="no">3명 이상 참여해야 시작할 수 있어요.</b>' : ''}</p>
      <button class="btn red" data-act="start" ${joined < 3 ? 'disabled' : ''}>${twoStep('start', '🎲 매칭 시작하기', '한 번 더 누르면 매칭돼요')}</button></section>`;
  } else if (isMission && r.status === 'active') {
    action = `<section class="box"><b>📣 단톡방 공지</b><p class="small" style="color:#3A453F">미션이 열린 날 단톡방에 붙여넣으세요.</p><button class="btn sm" data-act="notice">카톡 공지 문구 복사</button>
      <button class="btn line red sm" data-act="finish">${twoStep('finish', '⏹ 마니또 기간 지금 끝내기', '한 번 더 누르면 정답 맞히기로 넘어가요')}</button></section>`;
  } else if (isMission && r.status === 'guessing') {
    action = `<section class="box red"><b>예상 제출 ${v.guess.submitted}/${v.guess.total}</b><button class="btn line red sm" data-act="reveal">${twoStep('reveal', '🔓 강제로 정답 공개하기', '한 번 더 누르면 공개돼요')}</button></section>`;
  }
  const body = `<div class="stack" style="gap:4px"><h1>🔗 개인 링크 관리</h1><p class="sub">사람마다 링크가 달라요. '보내기'를 눌러 각자에게 카톡으로 보내주세요.</p></div>
    <div class="note red" role="note"><span aria-hidden="true">👑</span><div class="stack" style="gap:6px"><p><b>대표 링크는 다시 발급할 수 없어요.</b> 잃어버리면 방을 관리할 수 없으니 '내 링크'를 눌러 카톡 나와의 채팅 등에 꼭 저장해두세요.</p></div></div>
    ${action}
    <div class="sheet"><div class="tr th" style="${cols}"><div></div><div>이름 · 상태</div>${isMission ? '<div>위시</div>' : ''}<div style="justify-content:flex-end">링크</div></div>${rows}</div>
    <p class="small">참여를 마친 사람의 링크는 비밀 유지를 위해 대표에게도 보이지 않아요('전달됨'). ↻ 재발급: 링크를 잃어버렸거나 잘못 보냈을 때 새 링크를 만들어요. 이전 링크는 바로 막혀요.</p>
    <div class="note gray" role="note"><span aria-hidden="true">🔒</span><p>매칭 결과는 대표도 볼 수 없어요. ${isMission ? '정답 공개 때 모두 함께 확인해요.' : '교환하는 날 서로 확인해요.'} 명단을 바꾸려면 새 방을 만들어 주세요.</p></div>`;
  return { cell: '관리', fx: `=참여_현황(${joined}/${h.members.length})`, body };
}
actions.share = (el) => {
  const m = S.host.members.find((x) => x.id === el.dataset.id);
  if (!m || !m.token) return;
  shareOrCopy(inviteText(S.view.room.name, m.name, m.token), `${m.name}님 링크를`);
};
actions.copyme = () => {
  const text = `👑 [${S.view.room.name}] 마니또 대표 링크 (나만 보관)\n${linkFor(S.token)}`;
  copyText(text).then((ok) => ok ? toast('대표 링크를 복사했어요. 나와의 채팅에 저장해두세요 📌') : showCopyBox(text));
};
actions.reissue = (el) => {
  const id = el.dataset.id;
  if (!armed('re' + id)) return;
  busy(async () => {
    await rpc('reissue_link', { p_token: S.token, p_member: id });
    S.host = await rpc('host_overview', { p_token: S.token });
    render(); toast('새 링크를 만들었어요. 보내기를 눌러 다시 보내주세요 🔗');
  });
};
actions.start = () => { if (!armed('start')) return; busy(async () => { await rpc('start_room', { p_token: S.token }); S.tab = null; await loadRoom(); toast('매칭 완료! 🎲 각자 마니또가 공개됐어요'); }); };
actions.finish = () => { if (!armed('finish')) return; busy(async () => { await rpc('finish_now', { p_token: S.token }); S.tab = 'answer'; await loadRoom(); toast('정답 맞히기 단계로 넘어갔어요 🕵️'); }); };
actions.notice = () => {
  const v = S.view;
  const opened = v.missions.filter((m) => m.opened).length;
  const text = `🔔 [${v.room.name}] 미션 ${opened}번이 열렸어요!\n각자 받은 개인 링크로 들어가서 확인해주세요 🎅\n(들키지 않게 몰래! 🤫)`;
  copyText(text).then((ok) => ok ? toast('공지 문구를 복사했어요 📋') : showCopyBox(text));
};

route();
