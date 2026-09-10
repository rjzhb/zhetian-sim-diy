/* ============================================================
 * 遮天模拟器 · UI 逻辑（手机优先，兼容电脑）
 * 开局选词条 · 觉醒体质 · 自动逐年修炼 · 本地+B站排行榜
 * 证道成帝 · 天心/以力证道/合道花 三途证道 · 音效 · 暂停
 * ============================================================ */
(function () {
  /* ---------- 工具 ---------- */
  function $(id) { return document.getElementById(id); }
  function physiqueName(g) { return (g && g.physiqueName) || DATA.talentOf(g ? g.aptitude : 1); }
  function physiqueData(g) { return DATA.physiqueById && g ? DATA.physiqueById(g.physiqueId) : null; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) {
    n = Math.floor(n);
    if (n >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, '') + '亿';
    if (n >= 1e4) return (n / 1e4).toFixed(1).replace(/\.0$/, '') + '万';
    return String(n);
  }
  function pad2(x) { return (x < 10 ? '0' : '') + x; }
  function fmtTime(ts) {
    var d = new Date(ts), now = new Date();
    var hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    if (d.toDateString() === now.toDateString()) return '今天 ' + hm;
    if (d.getFullYear() === now.getFullYear()) return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + hm;
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + hm;
  }
  /* B站实力榜：对数编码，防止大数溢出 */
  function encodeScore(v) { if (v <= 1000) return Math.round(v); return Math.round(Math.log10(v) * 100000); }
  function decodeScore(s) { if (s <= 1000) return Math.round(s); return Math.round(Math.pow(10, s / 100000)); }

  /* ---------- 音效（WebAudio） ---------- */
  var SOUND = true;
  var KEY_SOUND = 'zt_sound';
  /* ---------- 金色命格模式（纯本地，不联网、不影响任何榜单） ---------- */
  var GOLD_MODE = 'none';
  var FORCE_XIANTI = false;
  function clearPersistedCheats() {
    try {
      localStorage.removeItem('zt_gold_mode');
      localStorage.removeItem('zt_force_xianti');
    } catch (e) {}
  }
  function syncAdminUI() {
    var random = $('gold-random-toggle'), free = $('gold-free-toggle');
    if (random) random.checked = GOLD_MODE === 'random';
    if (free) free.checked = GOLD_MODE === 'free';
    var xianti = $('force-xianti-toggle'); if (xianti) xianti.checked = FORCE_XIANTI;
    var badge = $('admin-badge');
    if (badge) {
      badge.hidden = GOLD_MODE === 'none' && !FORCE_XIANTI;
      badge.textContent = FORCE_XIANTI ? '🛠 强制混沌体 / 先天圣体道胎已开启' : '🛠 金色命格模式已开启';
    }
  }
  var KEY_SPEED = 'zt_speed';
  var audioCtx = null;
  function ensureAudio() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
  }
  function blip(freq, dur, type, vol) {
    if (!SOUND) return;
    try {
      ensureAudio();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.1, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  }
  function loadSound() { try { SOUND = localStorage.getItem(KEY_SOUND) !== '0'; } catch (e) {} }
  function saveSound() { try { localStorage.setItem(KEY_SOUND, SOUND ? '1' : '0'); } catch (e) {} }
  function syncSoundUI() {
    var hs = $('home-sound'); if (hs) hs.checked = SOUND;
  }

  /* ---------- B站 SDK（三条铁律：只判 file://，本地不加载不阻塞） ---------- */
  var sdkLoading = false, sdkPending = null;
  function sdkReady() {
    return typeof window !== 'undefined' && window.toy &&
      typeof window.toy.getRankList === 'function' &&
      typeof window.toy.submitScore === 'function';
  }
  function loadSDK() {
    if (sdkReady() || sdkLoading) return;
    if (typeof document === 'undefined' || location.protocol === 'file:') return;
    ensureSdk(function () {});
  }
  function ensureSdk(cb) {
    if (sdkReady()) { if (cb) cb(); return; }
    if (typeof document === 'undefined' || location.protocol === 'file:') { if (cb) cb(); return; }
    if (sdkLoading) { if (cb) (sdkPending = sdkPending || []).push(cb); return; }
    sdkLoading = true;
    var s = document.createElement('script');
    s.src = 'https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js';
    s.async = true;
    s.onload = function () {
      sdkLoading = false;
      if (cb) cb();
      if (sdkPending) { var q = sdkPending; sdkPending = null; for (var i = 0; i < q.length; i++) q[i](); }
    };
    s.onerror = function () { sdkLoading = false; sdkPending = null; };
    document.head.appendChild(s);
  }

  /* ---------- 登录检测（写排行榜前用） ---------- */
  var loggedIn = null;
  function checkLogin(cb) {
    if (loggedIn !== null) { if (cb) cb(loggedIn); return; }
    ensureSdk(function () {
      if (!window.toy || typeof window.toy.getCloudStorage !== 'function') { loggedIn = false; if (cb) cb(false); return; }
      window.toy.getCloudStorage([]).then(function () {
        loggedIn = true;
        if (cb) cb(true);
      }).catch(function (e) {
        var code = (e && (e.code !== undefined ? e.code : e.errCode)) || (e && e.data && e.data.code);
        loggedIn = (code !== -101);
        if (cb) cb(loggedIn);
      });
    });
  }

  /* ---------- 榜单/排行读缓存 ---------- */
  var _sdkCache = {};
  function cachedCall(key, ttlMs, fetcher) {
    var hit = _sdkCache[key];
    if (hit && (Date.now() - hit.t) < ttlMs) return Promise.resolve(hit.v);
    return fetcher().then(function (v) { _sdkCache[key] = { t: Date.now(), v: v }; return v; });
  }

  /* ---------- 成帝累计（每证道一次 +1；排行榜编码存储；超 1000w 后每 +1=1000 人、仅 1/k 概率回写） ---------- */
  function loadChengdiTotal() { try { return parseInt(localStorage.getItem('zt_chengdi_total') || '0', 10) || 0; } catch (e) { return 0; } }
  function encodePlayCount(n) { if (n <= 10000000) return n; return 10000000 + Math.floor((n - 10000000) / 1000); }
  function decodePlayCount(score) { if (score <= 10000000) return score; return 10000000 + (score - 10000000) * 1000; }
  function fmtPlayCount(n) { if (n >= 10000000) return (n / 10000).toFixed(1) + '万'; return String(n); }
  function addPlayCountBili() {
    checkLogin(function (ok) {
      if (!ok) return;
      if (!window.toy || !window.toy.getRankList || !window.toy.submitScore) return;
      window.toy.getRankList({ board: 3, period: 'all', limit: 1 }).then(function (list) {
        var cur = (list && list.length && list[0].score) ? list[0].score : 0;
        if (cur >= 10000000) {
          if (Math.random() >= 1 / 1000) return;
          window.toy.submitScore({ board: 3, score: cur + 1 }).catch(function () {});
        } else {
          /* 随机取 k∈[5,15]，1/k 概率 +k（平均每局 +1，写请求降 ~10 倍） */
          var k = 5 + Math.floor(Math.random() * 11);
          if (Math.random() >= 1 / k) return;
          window.toy.submitScore({ board: 3, score: Math.min(10000000, cur + k) }).catch(function () {});
        }
      }).catch(function () {});
    });
  }
  function loadBiliPlayCount() {
    ensureSdk(function () {
      if (!window.toy || !window.toy.getRankList) return;
      cachedCall('playcount', 60000, function () {
        return window.toy.getRankList({ board: 3, period: 'all', limit: 1 });
      }).then(function (list) {
        var s = (list && list.length && list[0].score) ? list[0].score : 0;
        $('home-count').textContent = fmtPlayCount(decodePlayCount(s));
      }).catch(function () {});
    });
  }
  /* 当日成帝次数：读成帝榜（board1）日榜 top100，score 总和 */
  function loadBiliChengdiCount() {
    ensureSdk(function () {
      if (!window.toy || !window.toy.getRankList) return;
      cachedCall('chengdi_day', 60000, function () {
        return window.toy.getRankList({ board: 1, period: 'day', limit: 100 });
      }).then(function (list) {
        var el = $('home-chengdi-count'); if (!el) return;
        if (!list || !list.length) { el.textContent = '0'; return; }
        var KK = 0, i;
        for (i = 0; i < list.length; i++) KK += list[i].score;
        el.textContent = KK;
      }).catch(function () {});
    });
  }

  /* ---------- 玩家等级（经验升级 + K-V 云同步，等级/经验高者胜） ---------- */
  var PLAYER_KEY = 'zt_player';
  var player = { lv: 0, exp: 0 };
  function loadPlayer() {
    try {
      var o = JSON.parse(localStorage.getItem(PLAYER_KEY) || '{"lv":0,"exp":0}');
      player = (o && typeof o.lv === 'number') ? o : { lv: 0, exp: 0 };
    } catch (e) { player = { lv: 0, exp: 0 }; }
  }
  function savePlayer() { try { localStorage.setItem(PLAYER_KEY, JSON.stringify(player)); } catch (e) {} }
  function needExp() { return DATA.PLAYER_LV_BASE * (player.lv + 1); }
  function addExp(amount) {
    player.exp += amount;
    var need = needExp();
    while (player.exp >= need) { player.exp -= need; player.lv++; need = needExp(); }
    savePlayer();
    renderPlayerUI();
    syncPlayerCloud();
  }
  function renderPlayerUI() {
    if (!$('home-lv')) return;
    var need = needExp();
    $('home-lv').textContent = '[Lv.' + player.lv + ']';
    $('home-lv-bonus').textContent = '[高阶体质概率+' + (player.lv * 0.1).toFixed(1) + '%]';
    $('home-lv-exp').textContent = player.exp + '/' + need;
    $('home-lv-fill').style.width = Math.min(100, (player.exp / need) * 100) + '%';
  }
  var playerSyncLock = false;
  function syncPlayerCloud() {
    ensureSdk(function () {
      if (!window.toy || !window.toy.getCloudStorage || !window.toy.setCloudStorage) return;
      if (playerSyncLock) return;
      playerSyncLock = true;
      window.toy.getCloudStorage([PLAYER_KEY]).then(function (data) {
        var cloud = null;
        try {
          var v = data && data[PLAYER_KEY] ? JSON.parse(data[PLAYER_KEY]) : null;
          if (v && typeof v.lv === 'number') cloud = v;
        } catch (e) {}
        if (cloud && (cloud.lv > player.lv || (cloud.lv === player.lv && cloud.exp > player.exp))) {
          player = cloud; savePlayer(); renderPlayerUI();
        }
        if (window.toy.setCloudStorage) {
          var obj = {}; obj[PLAYER_KEY] = JSON.stringify(player);
          window.toy.setCloudStorage(obj).catch(function () {});
        }
        playerSyncLock = false;
      }).catch(function () { playerSyncLock = false; });
    });
  }

  /* ---------- 本地排行榜 ---------- */
  var LOCAL_BOARDS = {
    cult: { key: 'zt_local_cult', name: '实力' },
    age:  { key: 'zt_local_life', name: '寿元' },
    lvl:  { key: 'zt_local_lvl',  name: '境界' }
  };
  function loadLocalList(key) {
    try { var a = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function saveLocalList(key, list) { try { localStorage.setItem(key, JSON.stringify(list.slice(0, 100))); } catch (e) {} }
  function insertLocal(key, score) {
    var list = loadLocalList(key);
    var ts = Date.now();
    list.push({ score: score, ts: ts });
    list.sort(function (a, b) { return b.score - a.score || a.ts - b.ts; });
    if (list.length > 100) list = list.slice(0, 100);
    saveLocalList(key, list);
    var rank = list.length + 1;
    for (var i = 0; i < list.length; i++) { if (list[i].score === score && list[i].ts === ts) { rank = i + 1; break; } }
    return { rank: rank, total: list.length };
  }

  /* ---------- B站排行榜：board1 成帝次数（累计） board2 最高实力（对数编码） board3 游玩人次 ---------- */
  function submitBili(board, score) {
    checkLogin(function (ok) {
      if (!ok) return;
      if (!window.toy || !window.toy.submitScore) return;
      try { window.toy.submitScore({ board: board, score: score }).catch(function () {}); } catch (e) {}
    });
  }

  /* ---------- 全局状态 ---------- */
  var G = null;
  var timer = null;
  var TICK_MS = 300;
  var FAST_MS = 60;
  var settleReason = '';
  var fullLog = [];
  var pendingLogs = [];
  var selectedTraits = [];

  /* ---------- 视图切换 ---------- */
  function show(v) {
    var views = document.querySelectorAll('.view'), i;
    for (i = 0; i < views.length; i++) views[i].hidden = views[i].id !== 'view-' + v;
    if (v === 'home') { loadBiliPlayCount(); loadBiliChengdiCount(); }
  }
  var settingsReturn = 'home';
  function openSettings(from) {
    settingsReturn = from;
    $('pause-mask').hidden = true;
    show('settings');
  }
  function closeSettings() {
    if (settingsReturn === 'pause') { show('game'); $('pause-mask').hidden = false; }
    else show('home');
  }
  function hideMask() { $('pause-mask').hidden = true; }

  /* ---------- 首页 ---------- */
  function refreshHome() {
    $('home-count').textContent = '--';
    renderPlayerUI();
    syncSoundUI();
    loadBiliPlayCount();
  }

  /* ---------- 开局：抽取 5 个词条，玩家选 2 → 觉醒体质 → 进入修炼 ---------- */
  function startGame() {
    ensureAudio(); blip(660, 0.08, 'triangle', 0.1);
    if (GOLD_MODE === 'random' || GOLD_MODE === 'free') {
      $('pause-mask').hidden = true;
      show('home');
      if (GOLD_MODE === 'random') adminPickRandomGold();
      else adminPickFreeGold();
      return;
    }
    selectedTraits = [];
    var cands = Sim.drawTraits(5);
    renderTraitPick(cands, false);
    $('trait-tip').textContent = '从 5 种命格中挑选 2 种，成就你的大帝路';
    renderTraitConfirm();
    $('pause-mask').hidden = true;
    show('home');
    $('trait-mask').hidden = false;
  }
  /* ---------- 金色命格开局 ---------- */
  function goldPool() {
    var out = [];
    for (var i = 0; i < DATA.TRAITS.length; i++) if (DATA.TRAITS[i].color === 'o') out.push(DATA.TRAITS[i]);
    return out;
  }
  function drawRandomGold(count) {
    var pool = goldPool().slice();
    /* 洗牌后取前 count 个，保证 5 个互不重复且全是金色 */
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    return pool.slice(0, Math.min(count, pool.length));
  }
  function openTraitPickWith(cands, tip, searchable) {
    selectedTraits = [];
    renderTraitPick(cands, searchable);
    $('trait-tip').textContent = tip;
    renderTraitConfirm();
    $('trait-mask').hidden = false;
  }
  function adminPickRandomGold() {
    blip(600, 0.06, 'triangle', 0.08);
    openTraitPickWith(drawRandomGold(5), '🎲 只刷金色：从 5 种金色命格中挑选 2 种', false);
  }
  function adminPickFreeGold() {
    blip(600, 0.06, 'triangle', 0.08);
    openTraitPickWith(goldPool(), '🔍 金色任选：从全部金色命格中自由挑选 2 种', true);
  }
  function traitPathMeta(trait) {
    return trait && DATA.TRAIT_PATHS ? DATA.TRAIT_PATHS[trait.path] : null;
  }
  function renderTraitPick(cands, searchable) {
    var searchWrap = $('trait-search-wrap'), searchInput = $('trait-search');
    searchWrap.hidden = !searchable;
    if (searchInput) searchInput.value = '';
    var box = $('trait-list'); box.innerHTML = '';
    var frag = document.createDocumentFragment();
    for (var i = 0; i < cands.length; i++) {
      (function (t) {
        var d = document.createElement('button');
        d.className = 'trait-opt color-' + t.color;
        d.setAttribute('data-id', t.id);
        var nm = document.createElement('span'); nm.className = 'trait-opt-name'; nm.textContent = t.name;
        var tg = document.createElement('span'); tg.className = 'trait-opt-tag'; tg.textContent = DATA.TRAIT_COLOR_NAME[t.color];
        var pathMeta = traitPathMeta(t);
        var pathBadge = document.createElement('span'); pathBadge.className = 'trait-path-badge';
        pathBadge.textContent = pathMeta ? pathMeta.icon + ' ' + pathMeta.name : '';
        var ds = document.createElement('span'); ds.className = 'trait-opt-desc'; ds.textContent = DATA.traitDesc(t);
        var resonance = document.createElement('span'); resonance.className = 'trait-resonance-hint'; resonance.hidden = true;
        var top = document.createElement('span'); top.className = 'trait-opt-top';
        top.appendChild(nm); top.appendChild(tg); top.appendChild(pathBadge);
        d.setAttribute('data-path', t.path);
        d.appendChild(top); d.appendChild(ds); d.appendChild(resonance);
        d.addEventListener('click', function () {
          blip(600, 0.05, 'triangle', 0.08);
          var k = selectedTraits.indexOf(t.id);
          if (k >= 0) selectedTraits.splice(k, 1);
          else if (selectedTraits.length < 2) selectedTraits.push(t.id);
          updateTraitPickUI();
          renderTraitConfirm();
        });
        frag.appendChild(d);
      })(cands[i]);
    }
    box.appendChild(frag);
  }
  function filterTraitList() {
    var q = ($('trait-search').value || '').trim();
    var opts = document.querySelectorAll('.trait-opt');
    for (var i = 0; i < opts.length; i++) {
      var name = opts[i].querySelector('.trait-opt-name');
      var desc = opts[i].querySelector('.trait-opt-desc');
      var text = (name ? name.textContent : '') + (desc ? desc.textContent : '');
      opts[i].style.display = (!q || text.indexOf(q) >= 0) ? '' : 'none';
    }
  }
  function updateTraitPickUI() {
    var opts = document.querySelectorAll('.trait-opt');
    var firstTrait = selectedTraits.length ? DATA.traitById(selectedTraits[0]) : null;
    var secondTrait = selectedTraits.length > 1 ? DATA.traitById(selectedTraits[1]) : null;
    var firstPath = firstTrait ? firstTrait.path : '';
    var resonancePath = firstTrait && secondTrait && firstTrait.path === secondTrait.path ? firstTrait.path : '';
    for (var i = 0; i < opts.length; i++) {
      var on = selectedTraits.indexOf(opts[i].getAttribute('data-id')) >= 0;
      if (on) opts[i].classList.add('sel'); else opts[i].classList.remove('sel');
      var optionPath = opts[i].getAttribute('data-path');
      var hint = opts[i].querySelector('.trait-resonance-hint');
      opts[i].classList.remove('resonance-candidate');
      opts[i].classList.remove('resonance-active');
      if (hint) hint.hidden = true;
      if (resonancePath && on && optionPath === resonancePath) {
        var activeMeta = DATA.TRAIT_PATHS[resonancePath];
        opts[i].classList.add('resonance-active');
        if (hint) { hint.textContent = '✦ 已激活共鸣「' + activeMeta.resonance + '」'; hint.hidden = false; }
      } else if (selectedTraits.length === 1 && !on && optionPath === firstPath) {
        var candidateMeta = DATA.TRAIT_PATHS[firstPath];
        opts[i].classList.add('resonance-candidate');
        if (hint) { hint.textContent = '选择后激活「' + candidateMeta.resonance + '」'; hint.hidden = false; }
      }
    }
  }
  function renderTraitConfirm() {
    var btn = $('trait-confirm');
    btn.disabled = selectedTraits.length !== 2;
    var resonance = '';
    if (selectedTraits.length === 2) {
      var a = DATA.traitById(selectedTraits[0]), b = DATA.traitById(selectedTraits[1]);
      if (a && b && a.path === b.path) resonance = ' · ' + DATA.TRAIT_PATHS[a.path].resonance;
    }
    btn.textContent = selectedTraits.length === 2 ? '命格已成' + resonance + '，开始证道' : '请先选择 2 种命格（' + selectedTraits.length + '/2）';
  }
  function confirmTrait() {
    if (selectedTraits.length !== 2) return;
    $('trait-mask').hidden = true;
    beginGame(selectedTraits.slice());
  }
  function closeTraitPick() {
    selectedTraits = [];
    $('trait-mask').hidden = true;
  }

  /* ---------- 正式开局 ---------- */
  function beginGame(traitIds) {
    ensureAudio(); blip(880, 0.1, 'triangle', 0.1);
    G = Sim.createGame(player.lv, traitIds);
    if (FORCE_XIANTI) {
      var peakId = Math.random() < 0.5 ? 'chaos' : 'innate_sacred_dao';
      Sim.setPhysique(G, DATA.physiqueById(peakId));
      G.aptitude = 10;
      G.cult = Math.max(G.cult, 10);
    }
    $('game-title').textContent = physiqueName(G);
    $('selfslash-mask').hidden = true;
    $('darkturmoil-mask').hidden = true;
    $('immortalpath-mask').hidden = true;
    $('strangeworld-mask').hidden = true;
    renderAttrs();
    $('log-box').innerHTML = '';
    pendingLogs = [];
    var first = [];
    if (G.innate >= 8) first.push({ cls: 'rare', text: '第6岁，天生异禀！觉醒『' + physiqueName(G) + '』' });
    first.push({ cls: 'brk', text: '第6岁，觉醒体质，为『' + physiqueName(G) + '』！修行根基第 ' + G.aptitude + ' 档，实力 ' + G.cult });
    first.push({ cls: G.era && G.era.id === 'golden' ? 'rainbow' : 'rare', text: '此世天时：' + (G.era ? G.era.name : '平常时代') + '；初始道蕴 ' + Math.round(G.daoyun) + '/' + Math.round(G.daoyunCap) });
    var pd = physiqueData(G);
    if (pd && pd.desc) first.push({ cls: 'rare', text: '体质特性：' + pd.desc });
    if (G.daoSuppressed) first.push({ cls: 'ev4', text: '这一世已有当世大帝镇压万道；无论何种体质，实际战力未达90万都无法在有帝之世证道' });
    /* 词条亮相 */
    var ti, names = [];
    for (ti = 0; ti < G.traits.length; ti++) { var td = DATA.traitById(G.traits[ti]); if (td) names.push('『' + td.name + '』'); }
    if (names.length) first.push({ cls: 'god', text: '你生而背负命格：' + names.join('、') + '，冥冥中大道已为你留有一线' });
    if (G.resonance && DATA.TRAIT_PATHS[G.resonance]) {
      var resonance = DATA.TRAIT_PATHS[G.resonance];
      first.push({ cls: 'rainbow', text: resonance.icon + ' 同源命格交相呼应，激活「' + resonance.resonance + '」：' + resonance.desc });
    }
    fullLog = [];
    for (var fi = 0; fi < first.length; fi++) fullLog.push(first[fi]);
    renderLog(first);
    show('game');
    startPlay();
    addPlayCountBili();
  }
  function startPlay() { stopPlay(); playTick(); }
  function stopPlay() { if (timer) { clearTimeout(timer); timer = null; } }
  function playTick() {
    var gap = pendingLogs.length ? FAST_MS : TICK_MS;
    timer = setTimeout(function () {
      if (!timer) return;
      tick();
      if (timer) playTick();
    }, gap);
  }
  function setSpeed() {
    var r = $('speed-range'); if (!r) return;
    var v = parseFloat(r.value);
    $('speed-val').textContent = v.toFixed(1) + 's';
    TICK_MS = Math.round(v * 1000);
    try { localStorage.setItem(KEY_SPEED, String(v)); } catch (e) {}
    if (timer) { stopPlay(); startPlay(); }
  }
  function loadSpeed() {
    try {
      var v = parseFloat(localStorage.getItem(KEY_SPEED));
      if (isFinite(v) && v >= 0.1 && v <= 1) {
        TICK_MS = Math.round(v * 1000);
        var r = $('speed-range'); if (r) r.value = v;
        var s = $('speed-val'); if (s) s.textContent = v.toFixed(1) + 's';
      }
    } catch (e) {}
  }

  function tick() {
    if (pendingLogs.length) {
      renderLog([pendingLogs.shift()]);
      renderAttrs();
      if (!pendingLogs.length && openPendingChoiceIfNeeded()) return;
      if (!pendingLogs.length && (G.dead || G.ascended)) { stopPlay(); finishGame(G.dead ? 'dead' : 'god'); }
      return;
    }
    var log = [], guard = 0;
    do {
      log = Sim.rollYear(G);
      guard++;
    } while (log.length === 0 && !G.dead && !G.ascended && guard < 100000);
    for (var i = 0; i < log.length; i++) fullLog.push(log[i]);
    renderAttrs();
    var brkCount = 0, j;
    for (j = 0; j < log.length; j++) if (log[j].cls === 'brk') brkCount++;
    if (brkCount > 1) {
      pendingLogs = log.slice();
      if (pendingLogs.length) renderLog([pendingLogs.shift()]);
    } else {
      renderLog(log);
    }
    if (!pendingLogs.length && openPendingChoiceIfNeeded()) return;
    if (!pendingLogs.length && (G.dead || G.ascended)) { stopPlay(); finishGame(G.dead ? 'dead' : 'god'); }
  }

  function openPendingChoiceIfNeeded() {
    if (!G) return false;
    if (G.awaitingStrangeWorldChoice) return openStrangeWorldChoice();
    if (G.awaitingDarkTurmoil) return openDarkTurmoilChoice();
    if (G.awaitingImmortalPath) return openImmortalPathChoice();
    return openSelfSlashChoiceIfNeeded();
  }
  function openDarkTurmoilChoice() {
    stopPlay();
    var hasEmperor = !!G.worldEmperor;
    var purge = Sim.forbiddenPurgeChance ? Math.round(Sim.forbiddenPurgeChance(G.forbiddenKarma, hasEmperor) * 100) : 0;
    $('darkturmoil-info').textContent = '当前实力 ' + fmt(G.cult) + ' · 生命本源 ' + G.forbiddenEssence +
      ' · 已负血债 ' + G.forbiddenKarma + ' · ' + (hasEmperor ?
        '当世有帝：发动后极可能立即帝战，当前苏醒清算概率 ' + purge + '%' :
        '当世无帝：眼下无人正面清算，但血债会被未来新帝追溯');
    $('darkturmoil-mask').hidden = false;
    return true;
  }
  function resolveDarkTurmoil(start) {
    if (!G || !G.awaitingDarkTurmoil) return;
    ensureAudio(); blip(start ? 125 : 600, 0.15, start ? 'sawtooth' : 'triangle', 0.12);
    var log = [];
    if (!Sim.chooseDarkTurmoil(G, start, log)) return;
    $('darkturmoil-mask').hidden = true;
    for (var i = 0; i < log.length; i++) fullLog.push(log[i]);
    renderLog(log); renderAttrs();
    if (G.dead || G.ascended) { stopPlay(); finishGame(G.dead ? 'dead' : 'god'); }
    else startPlay();
  }
  function openImmortalPathChoice() {
    stopPlay();
    $('immortalpath-info').textContent = '当前实力 ' + fmt(G.cult) + ' · 道蕴 ' + Math.round(G.daoyun) + '/' + Math.round(G.daoyunCap) + '。你只能确认坐标与界壁强度，无法感知另一侧存在什么。';
    $('immortalpath-mask').hidden = false;
    return true;
  }
  function resolveImmortalPath(path) {
    if (!G || !G.awaitingImmortalPath) return;
    ensureAudio(); blip(path === 'strange' ? 780 : 480, 0.15, path === 'strange' ? 'sawtooth' : 'triangle', 0.12);
    var log = [];
    if (!Sim.chooseImmortalPath(G, path, log)) return;
    $('immortalpath-mask').hidden = true;
    for (var i = 0; i < log.length; i++) fullLog.push(log[i]);
    renderLog(log); renderAttrs();
    if (G.dead || G.ascended) { stopPlay(); finishGame(G.dead ? 'dead' : 'god'); }
    else startPlay();
  }
  function openStrangeWorldChoice() {
    stopPlay();
    var enemyStage = G.undeadImmortal ? '已成红尘仙' : '活出第' + G.undeadLives + '世';
    $('strangeworld-info').textContent = '你发现无始大帝正与一位' + enemyStage + '、驾驭五色天刀的恐怖强者相持。你尚未被双方锁定。';
    $('strangeworld-mask').hidden = false;
    return true;
  }
  function resolveStrangeWorldChoice(choice) {
    if (!G || !G.awaitingStrangeWorldChoice) return;
    ensureAudio(); blip(choice === 'wushi' ? 780 : 420, 0.15, choice === 'wushi' ? 'sawtooth' : 'triangle', 0.12);
    var log = [];
    if (!Sim.chooseStrangeWorldAlliance(G, choice, log)) return;
    $('strangeworld-mask').hidden = true;
    for (var i = 0; i < log.length; i++) fullLog.push(log[i]);
    renderLog(log); renderAttrs(); startPlay();
  }
  function openSelfSlashChoiceIfNeeded() {
    if (!G || !G.awaitingSelfSlash) return false;
    stopPlay();
    var info = G.knowsStrangeWorld ? '已掌握奇异世界坐标' : '尚未获得奇异世界坐标';
    var seal = G.xianSource && G.primordialStone ? '仙源＋太初命石' : (G.xianSource ? '仙源' : (G.primordialStone ? '太初命石' : '未获得封存材料'));
    $('selfslash-info').textContent = '当前实力 ' + fmt(G.cult) + ' · ' + info + ' · 封存材料：' + seal;
    var accept = $('btn-selfslash-accept');
    accept.disabled = !G.xianSource && !G.primordialStone;
    accept.textContent = accept.disabled ? '未得仙源或太初命石，无法自斩' : '自斩一刀，入主禁区';
    $('selfslash-mask').hidden = false;
    return true;
  }
  function resolveSelfSlash(slash) {
    if (!G || !G.awaitingSelfSlash) return;
    ensureAudio(); blip(slash ? 150 : 620, 0.15, slash ? 'sawtooth' : 'triangle', 0.12);
    var log = [];
    if (!Sim.chooseSelfSlash(G, slash, log)) return;
    $('selfslash-mask').hidden = true;
    for (var i = 0; i < log.length; i++) fullLog.push(log[i]);
    renderLog(log); renderAttrs();
    startPlay();
  }

  /* ---------- 渲染 ---------- */
  function renderAttrs() {
    if (!G) return;
    $('attr-title').textContent = G.redDustImmortal ? '红尘仙' : (G.inStrangeWorld ? '奇异世界·帝者' : (G.forbiddenLord ? '禁区至尊' : (G.emperor ? '大帝·第' + G.lifeNo + '世' : DATA.titleOf(G.lvl))));
    if (G.inStrangeWorld) {
      var strangeRoute = G.strangeWorldAlliance === 'wushi' ? '与无始并肩' : (G.strangeWorldAlliance === 'hide' ? '隐世蛰伏' : '探索未知');
      $('attr-stage-sub').textContent = '入界 ' + fmt(G.strangeWorldYears) + ' 年 · 长生感悟 ' + Math.round(G.strangeWorldInsight) + ' · ' + strangeRoute;
    }
    else if (G.forbiddenLord) {
      $('attr-stage-sub').textContent = (G.forbiddenSleepLeft > 0 ?
        '沉睡中 · 尚余' + fmt(G.forbiddenSleepLeft) + '年' :
        '苏醒于禁区') + ' · 本源 ' + G.forbiddenEssence + ' · 血债 ' + G.forbiddenKarma;
    }
    else if (G.emperor) $('attr-stage-sub').textContent = G.immortalMode === 'strange_world' ? '奇异世界 · 红尘为仙' :
      (G.immortalMode === 'immortal_road' ? '成仙路 · 红尘为仙' :
      (G.redDustPath === 'reverse' ? '红尘印 ' + G.redDustMarks + '/' + (DATA.RED_DUST_LIVES - 1) +
        ' · 下世逆活约' + Math.round(Sim.reverseLifeChance(G) * 100) + '%' : '帝命第一世 · 长生路未定'));
    else $('attr-stage-sub').innerHTML = G.lvl >= 99 ? '准帝九重天 · 闭关参悟帝关' :
      ('第 <b id="attr-lvl">' + G.lvl + '</b> 层 · 共 100 层');
    $('attr-apt').textContent = physiqueName(G);
    if (G.swallowingArt && G.physiqueId !== 'chaos' && Sim.swallowProgress) {
      var swallow = Sim.swallowProgress(G);
      $('attr-apt-sub').textContent = '修行根基第 ' + G.aptitude + ' 档 · 吞天 ' + swallow.have + '/' + swallow.need;
    } else {
      $('attr-apt-sub').textContent = '修行根基第 ' + G.aptitude + ' 档';
    }
    $('attr-life').textContent = G.inStrangeWorld ? '入界 ' + fmt(G.strangeWorldYears) + '年' :
      (G.forbiddenLord ? (G.forbiddenSleepLeft > 0 ? '沉睡余 ' + fmt(G.forbiddenSleepLeft) : '封源 ' + G.forbiddenEssence) : (G.emperor ? (G.age - G.emperorLifeStart) + '/' + (G.emperorLifeEnd - G.emperorLifeStart) : G.age + '/' + G.lifespan));
    $('attr-cult').textContent = fmt(G.cult);
    $('attr-daoyun').textContent = Math.round(G.daoyun) + '/' + Math.round(G.daoyunCap);
    $('attr-era').textContent = G.inStrangeWorld ? '奇异世界' : (G.era ? G.era.name : '--');
    $('attr-world-year').textContent = '第 ' + fmt(Math.round(G.worldYear || 0)) + ' 年';
    $('attr-world-emperor').textContent = G.playerEmperorActive ? '你正镇压当世万道' :
      (G.worldEmperor ? G.worldEmperor.name + '在世' :
      (G.daoSuppressed ? '帝痕未散 · 无人能证道' : '天心无主 · 帝路可争'));
    /* 同步体质 */
    var gt = $('game-title'); if (gt) gt.textContent = physiqueName(G);
    renderTraitLine();
  }
  function renderTraitLine() {
    var box = $('trait-line'); if (!box) return;
    box.innerHTML = '';
    var frag = document.createDocumentFragment();
    for (var i = 0; i < G.traits.length; i++) {
      var t = DATA.traitById(G.traits[i]);
      if (!t) continue;
      var c = document.createElement('span');
      c.className = 'chip color-' + t.color;
      c.textContent = t.name;
      frag.appendChild(c);
    }
    if (G.xintian) {   /* 获得天心后，命格栏末尾追加七彩"天心"标识 */
      var x = document.createElement('span');
      x.className = 'chip chip-tianxin';
      x.textContent = '天心';
      frag.appendChild(x);
    }
    if (G.becameEmperor && G.knowsStrangeWorld) {
      var sw = document.createElement('span');
      sw.className = 'chip color-p';
      sw.textContent = '奇异世界坐标';
      frag.appendChild(sw);
    }
    if (G.becameEmperor && (G.xianSource || G.primordialStone)) {
      var sealChip = document.createElement('span');
      sealChip.className = 'chip color-o';
      sealChip.textContent = G.xianSource ? (G.primordialStone ? '仙源·太初命石' : '仙源') : '太初命石';
      frag.appendChild(sealChip);
    }
    if (G.era) {
      var era = document.createElement('span');
      era.className = 'chip ' + (G.era.id === 'golden' ? 'color-o' : (G.era.id === 'prosperous' ? 'color-p' : 'color-w'));
      era.textContent = G.era.name;
      frag.appendChild(era);
    }
    if (G.emperor) {
      var e = document.createElement('span');
      e.className = 'chip chip-tianxin';
      e.textContent = G.redDustImmortal ? (G.immortalMode === 'strange_world' ? '奇异世界成仙' : (G.immortalMode === 'immortal_road' ? '成仙路成仙' : '九世红尘仙')) : '帝者第' + G.lifeNo + '世';
      frag.appendChild(e);
      if (!G.redDustImmortal && G.redDustRoots) {
        var rd = document.createElement('span');
        rd.className = 'chip color-p';
        rd.textContent = '长生根基：体' + G.redDustRoots.body + '·神' + G.redDustRoots.soul + '·道' + G.redDustRoots.dao;
        frag.appendChild(rd);
      }
      if (G.forbiddenLord) {
        var fl = document.createElement('span');
        fl.className = 'chip color-o'; fl.textContent = '禁区至尊'; frag.appendChild(fl);
      }
    }
    box.appendChild(frag);
  }
  function renderLog(logs) {
    var box = $('log-box');
    var frag = document.createDocumentFragment();
    for (var i = 0; i < logs.length; i++) {
      var d = document.createElement('div');
      d.className = 'log-item' + (logs[i].cls ? ' ' + logs[i].cls : '');
      d.textContent = logs[i].text;
      frag.appendChild(d);
    }
    box.insertBefore(frag, box.firstChild);
  }

  /* ---------- 暂停 ---------- */
  function pauseGame() {
    if (!G || !timer) return;
    stopPlay();
    $('pause-info').textContent = '体质 ' + physiqueName(G) + ' · ' + G.age + ' 岁 · ' + (G.forbiddenLord ? '禁区至尊' : (G.emperor ? '帝者第' + G.lifeNo + '世' : DATA.titleOf(G.lvl)));
    $('pause-mask').hidden = false;
  }
  function resumeGame() {
    if (!G) return;
    hideMask();
    ensureAudio();
    startPlay();
  }
  function exitGame() {
    stopPlay();
    hideMask();
    G = null;
    show('home');
  }

  /* ---------- 结算 ---------- */
  function finishGame(reason) {
    if (!G) return;
    stopPlay(); hideMask();
    pendingLogs = [];
    settleReason = reason;

    var rC = insertLocal('zt_local_cult', G.cult);
    var rA = insertLocal('zt_local_life', G.lifespan);
    var rL = insertLocal('zt_local_lvl', G.lvl);

    if (G.becameEmperor) {
      var total = loadChengdiTotal() + 1;
      try { localStorage.setItem('zt_chengdi_total', total); } catch (e) {}
      submitBili(1, total);
    }
    submitBili(2, encodeScore(G.cult));

    var expGain = G.redDustImmortal ? DATA.RED_DUST_EXP : (G.becameEmperor ? DATA.CHENGDI_EXP : Math.round(G.lvl * (reason === 'pause' ? DATA.EXP_PER_LVL_EARLY : DATA.EXP_PER_LVL)));
    addExp(expGain);

    var t = $('settle-title');
    if (reason === 'god') {
      t.textContent = G.immortalMode === 'strange_world' ? '✨ 奇异世界 · 红尘成仙' :
        (G.immortalMode === 'immortal_road' ? '✨ 横渡成仙路 · 红尘为仙' : '✨ 九世蜕变 · 红尘为仙'); blip(1200, 0.5, 'triangle', 0.16);
      t.className = 'settle-title god';
    }
    else if (reason === 'dead') {
      if (G.deadCause === 'zhengdao') { t.textContent = '💀 冲击帝关失败'; blip(120, 0.4, 'sawtooth', 0.14); }
      else if (G.deadCause === 'reverse') { t.textContent = '💀 逆活失败 · 帝路成空'; blip(120, 0.4, 'sawtooth', 0.14); }
      else if (G.deadCause === 'undead_emperor') { t.textContent = '💀 奇异世界 · 天皇截杀'; blip(120, 0.5, 'sawtooth', 0.15); }
      else if (G.deadCause === 'strange_world_tribulation') { t.textContent = '💀 奇异世界 · 成仙劫灭'; blip(120, 0.5, 'sawtooth', 0.15); }
      else if (G.deadCause === 'strange_world_accident') { t.textContent = '💀 奇异世界 · 仙道横祸'; blip(110, 0.5, 'sawtooth', 0.15); }
      else if (G.deadCause === 'immortal_road') { t.textContent = '💀 成仙路崩裂'; blip(120, 0.5, 'sawtooth', 0.15); }
      else if (G.deadCause === 'waited_immortal_road') { t.textContent = '💀 空候仙路 · 帝命坐化'; blip(140, 0.4, 'sawtooth', 0.13); }
      else if (G.deadCause === 'no_strange_world_info') { t.textContent = '💀 不知仙路 · 帝命坐化'; blip(140, 0.4, 'sawtooth', 0.12); }
      else if (G.deadCause === 'cannot_break_world') { t.textContent = '💀 战力不足 · 无法破界'; blip(130, 0.4, 'sawtooth', 0.13); }
      else if (G.deadCause === 'forbidden_exhausted') { t.textContent = '💀 神源枯竭 · 禁区落幕'; blip(120, 0.4, 'sawtooth', 0.14); }
      else if (G.deadCause === 'forbidden_battle') { t.textContent = '💀 当世大帝 · 平定禁区'; blip(110, 0.5, 'sawtooth', 0.15); }
      else if (G.deadCause === 'world_emperor_suppression' || G.deadCause === 'overwhelm_failed') { t.textContent = '💀 有帝之世 · 万道压制'; blip(110, 0.5, 'sawtooth', 0.15); }
      else if (G.deadCause === 'missed_emperor_path') { t.textContent = '💀 错过黄金帝路'; blip(140, 0.4, 'sawtooth', 0.12); }
      else if (G.deadCause === 'accident') { t.textContent = '💀 不幸身陨'; blip(160, 0.4, 'sawtooth', 0.12); }
      else if (G.deadCause === 'event') { t.textContent = '💀 身死道消'; blip(160, 0.4, 'sawtooth', 0.12); }
      else { t.textContent = '💀 与世长辞'; blip(160, 0.4, 'sawtooth', 0.12); }
      t.className = 'settle-title';
    }
    else { t.textContent = '⏸ 提前结算'; t.className = 'settle-title'; blip(400, 0.2, 'triangle', 0.1); }

    $('settle-wuhun').innerHTML = '体质 <b>' + esc(physiqueName(G)) + '</b> · 修行根基第 ' + G.aptitude + ' 档' +
      (G.aptitude > G.innate ? ' · <b>经命格/奇遇提升</b>' : '') +
      (G.xintian ? ' · <b>已悟天心</b>' : '') +
      (G.becameEmperor && G.knowsStrangeWorld ? ' · <b>已知奇异世界坐标</b>' : '') +
      (G.sealingMaterial ? ' · <b>曾以' + esc(G.sealingMaterial) + '自封</b>' : '') +
      (G.deathless && !G.deathlessUsed ? ' · <b>怀有不死药</b>' : '');
    $('settle-lvl').textContent = G.redDustImmortal ? '红尘仙' : (G.forbiddenLord ? '禁区至尊' : (G.emperor ? '大帝·第' + G.lifeNo + '世' : DATA.titleOf(G.lvl)));
    $('settle-cult').textContent = fmt(G.cult);
    $('settle-age-label').textContent = G.redDustImmortal ? '历时' : '享年';
    $('settle-age').textContent = G.redDustImmortal ? (G.age - 6) + ' 年' : G.age + ' 岁';

    var gd = $('settle-god');
    if (G.redDustImmortal) {
      if (G.immortalMode === 'strange_world') {
        var defeatedStage = G.undeadImmortal ? '已成红尘仙的' : ('第' + G.undeadLives + '世');
        gd.textContent = G.defeatedUndead ?
          ('🌌 于奇异世界修炼' + G.strangeWorldYears + '年后红尘成仙，' +
            (G.strangeWorldAlliance === 'wushi' ? '并与无始大帝联手' : '独自') + '击败' + defeatedStage + '不死天皇 🌌') :
          ('🌌 于奇异世界修炼' + G.strangeWorldYears + '年，避开未知大战，红尘成仙 🌌');
      } else {
        gd.textContent = G.immortalMode === 'immortal_road' ?
          '🌌 横渡成仙路，万法归一，红尘为仙 🌌' : '🌌 九世道果合一，红尘为仙，岁月不加身 🌌';
      }
      gd.hidden = false;
    } else if (G.becameEmperor) {
      if (G.deadCause === 'undead_emperor') gd.textContent = '你曾证道成帝，却在打入奇异世界时遭不死天皇截杀';
      else if (G.deadCause === 'strange_world_tribulation') gd.textContent = '你在奇异世界积累了' + G.strangeWorldInsight + '点长生感悟，却最终倒在第二次红尘仙蜕变中';
      else if (G.deadCause === 'strange_world_accident') gd.textContent = '你在奇异世界遭逢毫无预兆的仙道横祸，漫长积累毁于一旦';
      else if (G.deadCause === 'immortal_road') gd.textContent = '你选择等待成仙路，却在仙路崩裂时未能跨过天堑';
      else if (G.deadCause === 'waited_immortal_road') gd.textContent = '成仙路需近一纪元才会显现，你放弃奇异世界之门后，终其一世也未等到';
      else if (G.deadCause === 'forbidden_exhausted') gd.textContent = '你曾自斩入主禁区，却在漫长沉睡后耗尽了最后一缕生命本源';
      else if (G.deadCause === 'forbidden_battle') gd.textContent = '你曾自斩化为禁区至尊，最终被当世大帝平定';
      else if (G.deadCause === 'no_strange_world_info') gd.textContent = '你曾证道成帝，却始终未能获得奇异世界的信息';
      else if (G.deadCause === 'cannot_break_world') gd.textContent = '你已获得奇异世界坐标，但未达到轰穿界壁所需的150万战力';
      else gd.textContent = '你曾证道成帝，并逆活至第 ' + G.lifeNo + ' 世，凝成 ' + G.redDustMarks + ' 枚红尘印';
      gd.hidden = false;
    } else gd.hidden = true;

    $('settle-exp').textContent = '+' + expGain;
    checkAch();

    var settleRank = $('settle-rank');
    settleRank.hidden = true; settleRank.textContent = '';
    ensureSdk(function () {
      if (!window.toy || !window.toy.getMyRank) return;
      cachedCall('myrank_2_all', 30000, function () {
        return window.toy.getMyRank({ board: 2, period: 'all' });
      }).then(function (me) {
        if (me && me.ranked) { settleRank.textContent = 'B站实力榜第 ' + me.rank + ' 名'; settleRank.hidden = false; }
      }).catch(function () {});
    });
    loadQr('qr-img-settle', 'qr-area-settle');
    show('settle');
  }

  /* ---------- 排行榜（三层 tab：来源 / 具体项 / 周期） ---------- */
  var curSrc = 'local', curBoard = 'cult', curPeriod = 'all';
  var BILI_BOARDS = { chengdi: 1, cult: 2 };
  function openRank() {
    curSrc = 'local'; curBoard = 'cult'; curPeriod = 'all';
    setRankUI();
    show('rank');
    loadRank();
  }
  function makeTab(parent, active, label, cb) {
    var b = document.createElement('button');
    b.className = 'tab' + (active ? ' active' : '');
    b.textContent = label;
    b.addEventListener('click', function () { cb(); });
    parent.appendChild(b);
  }
  function setRankUI() {
    var src = $('rank-src'); src.innerHTML = '';
    makeTab(src, curSrc === 'local', '本地', function () { curSrc = 'local'; curBoard = 'cult'; curPeriod = 'all'; setRankUI(); loadRank(); blip(500, 0.06, 'triangle', 0.08); });
    makeTab(src, curSrc === 'bili', 'B站', function () { curSrc = 'bili'; curBoard = 'chengdi'; curPeriod = 'all'; setRankUI(); loadRank(); blip(500, 0.06, 'triangle', 0.08); });

    var board = $('rank-board'); board.innerHTML = '';
    var boards = curSrc === 'local'
      ? [['cult', '最高实力'], ['age', '寿元'], ['lvl', '最高境界']]
      : [['chengdi', '成帝次数'], ['cult', '最高实力']];
    boards.forEach(function (p) {
      makeTab(board, curBoard === p[0], p[1], function () { curBoard = p[0]; setRankUI(); loadRank(); });
    });

    var per = $('rank-period');
    per.hidden = curSrc !== 'bili';
    per.innerHTML = '';
    if (curSrc === 'bili') {
      [['all', '总榜'], ['month', '月榜'], ['week', '周榜'], ['day', '日榜']].forEach(function (p) {
        makeTab(per, curPeriod === p[0], p[1], function () { curPeriod = p[0]; setRankUI(); loadRank(); });
      });
    }
  }
  function loadRank() { if (curSrc === 'local') loadLocalRank(); else loadBiliRank(); }
  function loadLocalRank() {
    var note = $('rank-note'), body = $('rank-body');
    var b = LOCAL_BOARDS[curBoard];
    var list = loadLocalList(b.key);
    if (!list.length) { note.textContent = '暂无成绩 · 快去证道试试吧'; body.innerHTML = '<div class="lb-tip">暂无成绩</div>'; return; }
    var best = 0, bi = 0, i;
    for (i = 0; i < list.length; i++) if (list[i].score > best) { best = list[i].score; bi = i; }
    note.textContent = '我的最佳：' + fmt(best) + ' · 第 ' + (bi + 1) + ' 名';
    var h = '';
    for (i = 0; i < list.length; i++) {
      var it = list[i], rk = i + 1;
      var cls = 'lb-rank' + (rk <= 3 ? ' top r' + rk : '');
      var scoreTxt = fmt(it.score);
      if (curBoard === 'lvl') scoreTxt = DATA.titleOf(it.score);
      h += '<div class="lb-row' + (i === bi ? ' me' : '') + '"><span class="' + cls + '">' + rk + '</span>' +
        '<span class="lb-user"><span class="lb-name">我的成绩</span></span>' +
        '<span class="lb-time">' + fmtTime(it.ts) + '</span>' +
        '<span class="lb-score">' + scoreTxt + '</span></div>';
    }
    body.innerHTML = h;
  }
  function loadBiliRank() {
    var note = $('rank-note'), body = $('rank-body');
    note.textContent = '加载中…'; body.innerHTML = '<div class="lb-tip">加载中…</div>';
    ensureSdk(function () {
      if (!window.toy || !window.toy.getRankList) {
        note.textContent = '排行榜暂不可用';
        body.innerHTML = '<div class="lb-tip">排行榜加载失败，请稍后重试</div>';
        return;
      }
      var board = BILI_BOARDS[curBoard];
      cachedCall('rank_' + board + '_' + curPeriod, 30000, function () {
        return window.toy.getRankList({ board: board, period: curPeriod, limit: 100 });
      }).then(function (list) {
        if (!list || !list.length) { note.textContent = '暂无上榜数据'; body.innerHTML = '<div class="lb-tip">暂无上榜数据</div>'; return; }
        var h = '';
        list.forEach(function (it) {
          var rk = it.rank;
          var cls = 'lb-rank' + (rk <= 3 ? ' top r' + rk : '');
          var val = curBoard === 'cult' ? fmt(decodeScore(it.score)) : fmt(it.score);
          h += '<div class="lb-row"><span class="' + cls + '">' + rk + '</span>' +
            '<span class="lb-user"><img class="lb-avatar" src="' + esc(it.avatar) + '" alt="" onerror="this.style.visibility=\'hidden\'">' +
            '<span class="lb-name">' + esc(it.nickname) + '</span></span>' +
            '<span class="lb-score">' + val + '</span></div>';
        });
        body.innerHTML = h;
      }).catch(function () {
        body.innerHTML = '<div class="lb-tip">加载失败，请稍后重试</div>';
      });
      if (window.toy.getMyRank) {
        cachedCall('myrank_' + board + '_' + curPeriod, 30000, function () {
          return window.toy.getMyRank({ board: board, period: curPeriod });
        }).then(function (me) {
          if (me && me.ranked) note.textContent = '我的排名：第 ' + me.rank + ' 名';
          else note.textContent = '暂无我的排名';
        }).catch(function () {});
      }
    });
  }

  /* ---------- 点赞/收藏/投币/关注 · 高阶体质增益（两条引导视频） ----------
   * 每条视频 点赞0.2+收藏0.3+投币0.5 = 三连合计 +1.0%，两条最高 +2%；关注 +1.5%；作者本人全享受合计 +3.5% */
  var AUTHOR_UID = '13450091';
  var VIDEOS = [
    { key: 'a', bvid: 'BV1aztf6ZE9a', label: '视频①' },
    { key: 'b', bvid: 'BV1qSt26YEC9', label: '视频②' }
  ];
  var fb = { a_like: false, a_favorite: false, a_coin: false, b_like: false, b_favorite: false, b_coin: false, follow: false, author: false, checked: false };
  var FB_RATE = { like: 0.2, favorite: 0.3, coin: 0.5, follow: 1.5 };
  var FB_ACTS = ['a_like', 'a_favorite', 'a_coin', 'b_like', 'b_favorite', 'b_coin', 'follow'];
  function canShowFollowBonus() {
    if (typeof location === 'undefined' || location.protocol === 'file:') return false;
    if (typeof navigator === 'undefined' || !navigator.userAgent) return false;
    var ua = (navigator.userAgent || '').toLowerCase();
    var isApp = /bili|bilibili/.test(ua);
    var isMobile = /mobi|android|iphone|ipad|ipod/.test(ua);
    return isApp || !isMobile;
  }
  function checkFollowBonus(force) {
    if (!canShowFollowBonus()) {
      var b0 = $('btn-follow-bonus'); if (b0) b0.hidden = true;
      return;
    }
    ensureSdk(function () {
      var btn = $('btn-follow-bonus');
      if (!window.toy) { if (btn) btn.hidden = true; return; }
      if (btn) btn.hidden = false;
      if (fb.checked && !force) return;
      fb.checked = true;
      var pending = 2, fin = function () { if (--pending <= 0) refreshFollowBonus(); };
      /* 视频互动：两条视频分别统计 点赞/收藏/投币 */
      if (typeof window.toy.getVideoUserActions === 'function') {
        var vids = VIDEOS.map(function (v) { return { bvid: v.bvid }; });
        window.toy.getVideoUserActions({ videos: vids }).then(function (r) {
          var items = (r && r.items) || [];
          for (var i = 0; i < items.length && i < VIDEOS.length; i++) {
            var it = items[i], vk = VIDEOS[i].key;
            if (!it) continue;
            if (it.liked === true) fb[vk + '_like'] = true;
            if (it.favorited === true) fb[vk + '_favorite'] = true;
            if (it.coinCount > 0) fb[vk + '_coin'] = true;
          }
          fin();
        }).catch(function () { fin(); });
      } else fin();
      /* 作者互动：关注状态 + 是否作者本人 */
      if (typeof window.toy.getAuthorRelation === 'function') {
        window.toy.getAuthorRelation().then(function (r) {
          var d = r && r.data;
          if (d) {
            if (d.isFollowing) fb.follow = true;
            if (d.isAuthor) fb.author = true;
          }
          fin();
        }).catch(function () { fin(); });
      } else fin();
    });
  }
  /* 三连收益：每条视频 点赞0.2+收藏0.3+投币0.5=1.0%，两条最高 2%；关注 1.5%；作者本人全享受 3.5% */
  function fbPct() {
    if (fb.author) return 2.0 + FB_RATE.follow;
    var p = 0, i;
    for (i = 0; i < VIDEOS.length; i++) {
      var vk = VIDEOS[i].key;
      if (fb[vk + '_like']) p += FB_RATE.like;
      if (fb[vk + '_favorite']) p += FB_RATE.favorite;
      if (fb[vk + '_coin']) p += FB_RATE.coin;
    }
    if (fb.follow) p += FB_RATE.follow;
    return Math.round(p * 100) / 100;
  }
  function refreshFollowBonus() {
    var pct = fbPct();
    Sim.setFollowBonus(pct);
    var btn = $('btn-follow-bonus');
    if (btn) btn.textContent = '👍 三连+关注，享高阶体质增益 [当前：' + pct + '%]';
    var t = $('fb-total'); if (t) t.textContent = '当前增益：' + pct + ' / 3.5%';
    for (var i = 0; i < FB_ACTS.length; i++) {
      var k = FB_ACTS[i], el = $('fb-' + k);
      if (!el) continue;
      var done = !!fb[k];
      el.textContent = done ? '✓ 已完成' : '未完成';
      el.className = 'fb-state ' + (done ? 'done' : 'todo');
    }
  }
  function openFollowBonus() {
    blip(500, 0.06, 'triangle', 0.08);
    checkFollowBonus(true);
    $('follow-mask').hidden = false;
    refreshFollowBonus();
  }
  function closeFollowBonus() { $('follow-mask').hidden = true; }
  function followAction(type) {
    blip(660, 0.08, 'triangle', 0.1);
    if (type === 'follow') {
      if (window.toy && typeof window.toy.navigate === 'function') window.toy.navigate({ type: 'space', id: AUTHOR_UID }).catch(function () { goUrl('https://space.bilibili.com/' + AUTHOR_UID); });
      else goUrl('https://space.bilibili.com/' + AUTHOR_UID);
      return;
    }
    var v = null, i;
    for (i = 0; i < VIDEOS.length; i++) if (type.indexOf(VIDEOS[i].key + '_') === 0) v = VIDEOS[i];
    if (!v) return;
    var bv = v.bvid;
    if (window.toy && typeof window.toy.navigate === 'function') window.toy.navigate({ type: 'video', id: bv }).catch(function () { goUrl('https://www.bilibili.com/video/' + bv); });
    else goUrl('https://www.bilibili.com/video/' + bv);
  }

  /* ---------- 成就系统（K-V 云同步） ---------- */
  var KEY_ACH = 'zt_ach';
  var ach = {};
  function achBonus() {
    var sum = 0, i;
    for (i = 0; i < DATA.ACHIEVEMENTS.length; i++) if (ach[DATA.ACHIEVEMENTS[i].id]) sum += DATA.ACHIEVEMENTS[i].bonus;
    return Math.round(sum * 100) / 100;
  }
  function loadAchLocal() {
    try { var o = JSON.parse(localStorage.getItem(KEY_ACH) || '{}'); ach = (o && typeof o === 'object') ? o : {}; } catch (e) { ach = {}; }
  }
  function saveAchLocal() { try { localStorage.setItem(KEY_ACH, JSON.stringify(ach)); } catch (e) {} }
  function markAch(id) {
    if (ach[id]) return;
    ach[id] = true; saveAchLocal();
    var nm = id;
    for (var i = 0; i < DATA.ACHIEVEMENTS.length; i++) if (DATA.ACHIEVEMENTS[i].id === id) { nm = DATA.ACHIEVEMENTS[i].name; break; }
    showAchToast(nm);
    achQueuePush();   /* 云同步：先拉云端合并成并集再回写，绝不整表覆盖丢历史成就 */
    applyAch();
  }
  var achToastQueue = [], achToastBusy = false;
  function showAchToast(name) {
    achToastQueue.push(name);
    if (!achToastBusy) achToastNext();
  }
  function achToastNext() {
    if (!achToastQueue.length) { achToastBusy = false; return; }
    achToastBusy = true;
    var name = achToastQueue.shift();
    var el = $('ach-toast');
    if (el) {
      el.textContent = '⭐ 成就达成：' + name;
      el.hidden = false;
      el.classList.remove('show');
      void el.offsetWidth;
      el.classList.add('show');
    }
    setTimeout(function () {
      var el2 = $('ach-toast');
      if (el2) { el2.classList.remove('show'); setTimeout(function () { el2.hidden = true; }, 300); }
      achToastBusy = false;
      achToastNext();
    }, 2200);
  }
  /* 成就并集（供云同步合并） */
  function achMerge(localAch, remoteAch) {
    if (!remoteAch || typeof remoteAch !== 'object') return localAch;
    for (var k in remoteAch) if (remoteAch[k] && !localAch[k]) localAch[k] = true;
    return localAch;
  }
  /* 云成就回写：先拉云端 → 与本地并集 → 整表回写；串行锁防并发覆盖 */
  var achPushBusy = false, achPushAgain = false;
  function achQueuePush() {
    if (achPushBusy) { achPushAgain = true; return; }
    achPushBusy = true;
    ensureSdk(function () {
      function done() { achPushBusy = false; if (achPushAgain) { achPushAgain = false; achQueuePush(); } }
      if (!window.toy || typeof window.toy.getCloudStorage !== 'function' || typeof window.toy.setCloudStorage !== 'function') { done(); return; }
      window.toy.getCloudStorage([KEY_ACH]).then(function (data) {
        var changed = false;
        try {
          if (data && data[KEY_ACH]) {
            var remote = JSON.parse(data[KEY_ACH]);
            var before = JSON.stringify(ach);
            achMerge(ach, remote);
            if (JSON.stringify(ach) !== before) changed = true;
          }
        } catch (e) {}
        if (changed) { saveAchLocal(); applyAch(); }
        var obj = {}; obj[KEY_ACH] = JSON.stringify(ach);
        window.toy.setCloudStorage(obj).catch(function () {});
        done();
      }).catch(function () { done(); });
    });
  }
  function loadAchCloud() {
    ensureSdk(function () {
      if (!window.toy || typeof window.toy.getCloudStorage !== 'function') { applyAch(); return; }
      window.toy.getCloudStorage([KEY_ACH]).then(function (data) {
        var changed = false;
        try {
          if (data && data[KEY_ACH]) {
            var remote = JSON.parse(data[KEY_ACH]);
            var before = JSON.stringify(ach);
            achMerge(ach, remote);
            if (JSON.stringify(ach) !== before) changed = true;
          }
        } catch (e) {}
        if (changed) { saveAchLocal(); achQueuePush(); }
        applyAch();
      }).catch(function () { applyAch(); });
    });
  }
  function applyAch() {
    Sim.setAchBonus(achBonus());
    var tip = $('ach-tip'); if (tip) tip.textContent = '成就增加高阶体质概率：' + achBonus() + '%';
    var total = $('ach-total'); if (total) total.textContent = '成就加成：+' + achBonus() + '%';
    renderAchList();
  }
  function checkAch() {
    if (!G) return;
    if (G.innate === 10) markAch('innate10');
    if (G.gotYibian) markAch('yibian');
    if (G.lvl >= 41) markAch('hunsheng');
    if (G.lvl >= 51) markAch('hundou');
    if (G.lvl >= 91) markAch('feng91');
    if (G.lvl >= 97) markAch('chaoji');
    if (G.lvl >= 100) markAch('lim99');
    if (G.cult >= 100000) markAch('shiwan');
    if (G.cult >= 300000) markAch('sanshiwan');
    if (G.cult >= 1000000) markAch('million');
    if (G.xintian) markAch('xintian');
    if (G.deathless) markAch('busiy');
    if (G.becameEmperor) {
      markAch('god');
      if (G.ascendMode === 'force') markAch('dujie');
      if (G.ascendMode === 'tianxin') markAch('tianxin');
      if (G.ascendMode === 'jidao') markAch('jidao');
      if (G.ascendMode === 'hedao') markAch('hedao');
    }
    if (G.redDustMarks >= 3) markAch('reverse3');
    if (G.redDustImmortal) markAch('reddust');
    if (G.gotDazhuan) markAch('dazhuan');
    if (G.gotYetian) markAch('yetian');
    checkAchFromRank();
  }
  function markChengdiCount(n) {
    if (n >= 3) markAch('god3');
    if (n >= 10) markAch('god10');
    if (n >= 30) markAch('god30');
    if (n >= 50) markAch('god50');
    if (n >= 100) markAch('god100');
  }
  function checkAchFromRank() {
    var localN = loadChengdiTotal();
    markChengdiCount(localN);
    ensureSdk(function () {
      if (!window.toy || typeof window.toy.getMyRank !== 'function') return;
      cachedCall('myrank_1_all', 30000, function () {
        return window.toy.getMyRank({ board: 1, period: 'all' });
      }).then(function (me) {
        var n = (me && me.score) ? me.score : 0;
        markChengdiCount(Math.max(n, loadChengdiTotal()));
      }).catch(function () {});
    });
  }
  function renderAchList() {
    var box = $('ach-list'); if (!box) return;
    box.innerHTML = '';
    var frag = document.createDocumentFragment();
    for (var i = 0; i < DATA.ACHIEVEMENTS.length; i++) {
      var a = DATA.ACHIEVEMENTS[i], done = !!ach[a.id];
      var d = document.createElement('div');
      d.className = 'ach-item ' + (done ? 'done' : 'todo');
      var nm = document.createElement('span'); nm.className = 'ach-name'; nm.textContent = a.name;
      var b = document.createElement('span'); b.className = 'ach-bonus'; b.textContent = (done ? '✓ 已达成' : '未达成') + ' +' + a.bonus + '%';
      d.appendChild(nm); d.appendChild(b);
      frag.appendChild(d);
    }
    box.appendChild(frag);
  }
  function openAch() {
    blip(500, 0.06, 'triangle', 0.08);
    loadAchCloud();
    applyAch();
    show('ach');
  }
  function closeAch() { show('home'); }

  /* ---------- 关注作者 / 回顾人生 / 二维码 ---------- */
  function goUrl(url) { try { location.href = url; } catch (e) {} }
  function followAuthor() {
    if (window.toy && typeof window.toy.navigate === 'function') {
      window.toy.navigate({ type: 'space', id: AUTHOR_UID }).catch(function () { goUrl('https://space.bilibili.com/' + AUTHOR_UID); });
    } else {
      goUrl('https://space.bilibili.com/' + AUTHOR_UID);
    }
  }
  function openReview() {
    var box = $('review-log'); box.innerHTML = '';
    var frag = document.createDocumentFragment();
    for (var i = 0; i < fullLog.length; i++) {
      var d = document.createElement('div');
      d.className = 'rv-' + (fullLog[i].cls || 'year');
      d.textContent = fullLog[i].text;
      frag.appendChild(d);
    }
    box.appendChild(frag);
    $('review-mask').hidden = false;
  }
  function closeReview() { $('review-mask').hidden = true; }
  function loadQr(imgId, areaId) {
    ensureSdk(function () {
      var area = $(areaId); if (!area) return;
      if (!window.toy || !window.toy.getQrCode) { area.hidden = true; return; }
      window.toy.getQrCode({ size: 220 }).then(function (r) {
        if (r && r.base64) { $(imgId).src = r.base64; area.hidden = false; }
        else area.hidden = true;
      }).catch(function () { area.hidden = true; });
    });
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    $('btn-start').addEventListener('click', startGame);
    $('trait-confirm').addEventListener('click', confirmTrait);
    $('trait-cancel').addEventListener('click', function () { blip(400, 0.06, 'triangle', 0.08); closeTraitPick(); });
    $('btn-rank').addEventListener('click', function () { blip(500, 0.06, 'triangle', 0.08); openRank(); });
    $('btn-close-rank').addEventListener('click', function () { show('home'); });
    $('btn-ach').addEventListener('click', openAch);
    $('btn-close-ach').addEventListener('click', function () { blip(400, 0.06, 'triangle', 0.08); closeAch(); });
    $('btn-pause').addEventListener('click', function () { blip(400, 0.06, 'triangle', 0.08); pauseGame(); });
    $('btn-pause-resume').addEventListener('click', function () { blip(600, 0.06, 'triangle', 0.08); resumeGame(); });
    $('btn-selfslash-decline').addEventListener('click', function () { resolveSelfSlash(false); });
    $('btn-selfslash-accept').addEventListener('click', function () { resolveSelfSlash(true); });
    $('btn-darkturmoil-refuse').addEventListener('click', function () { resolveDarkTurmoil(false); });
    $('btn-darkturmoil-start').addEventListener('click', function () { resolveDarkTurmoil(true); });
    $('btn-immortalpath-strange').addEventListener('click', function () { resolveImmortalPath('strange'); });
    $('btn-immortalpath-wait').addEventListener('click', function () { resolveImmortalPath('wait'); });
    $('btn-strangeworld-wushi').addEventListener('click', function () { resolveStrangeWorldChoice('wushi'); });
    $('btn-strangeworld-hide').addEventListener('click', function () { resolveStrangeWorldChoice('hide'); });
    $('btn-pause-settle').addEventListener('click', function () { blip(500, 0.08, 'triangle', 0.1); finishGame('pause'); });
    $('btn-pause-exit').addEventListener('click', function () { exitGame(); });
    $('btn-settle-again').addEventListener('click', startGame);
    $('btn-settle-review').addEventListener('click', function () { blip(500, 0.06, 'triangle', 0.08); openReview(); });
    $('btn-review-close').addEventListener('click', function () { blip(400, 0.06, 'triangle', 0.08); closeReview(); });
    $('btn-settle-follow').addEventListener('click', function () { blip(660, 0.08, 'triangle', 0.1); followAuthor(); });
    $('btn-settle-home').addEventListener('click', function () { show('home'); });
    $('home-sound').addEventListener('change', function () { SOUND = this.checked; saveSound(); syncSoundUI(); });
    $('gold-random-toggle').addEventListener('change', function () { GOLD_MODE = this.checked ? 'random' : 'none'; syncAdminUI(); });
    $('gold-free-toggle').addEventListener('change', function () { GOLD_MODE = this.checked ? 'free' : 'none'; syncAdminUI(); });
    $('force-xianti-toggle').addEventListener('change', function () { FORCE_XIANTI = this.checked; syncAdminUI(); });
    $('trait-search').addEventListener('input', filterTraitList);
    $('speed-range').addEventListener('input', setSpeed);
    $('speed-range').addEventListener('change', setSpeed);
    $('btn-settings').addEventListener('click', function () { blip(500, 0.06, 'triangle', 0.08); openSettings('home'); });
    $('btn-about').addEventListener('click', function () { blip(500, 0.06, 'triangle', 0.08); show('about'); });
    $('btn-close-settings').addEventListener('click', function () { blip(400, 0.06, 'triangle', 0.08); closeSettings(); });
    $('btn-close-about').addEventListener('click', function () { blip(400, 0.06, 'triangle', 0.08); show('home'); });
    $('btn-pause-settings').addEventListener('click', function () { blip(500, 0.06, 'triangle', 0.08); openSettings('pause'); });
    $('btn-follow-bonus').addEventListener('click', openFollowBonus);
    $('btn-follow-close').addEventListener('click', function () { blip(400, 0.06, 'triangle', 0.08); closeFollowBonus(); });
    var fa = document.querySelectorAll('.follow-action');
    for (var fai = 0; fai < fa.length; fai++) {
      fa[fai].addEventListener('click', function () { followAction(this.getAttribute('data-act')); });
    }
  }

  /* ---------- 启动 ---------- */
  loadSound();
  loadSpeed();
  clearPersistedCheats();
  loadPlayer();
  loadAchLocal();
  refreshHome();
  syncAdminUI();
  bindEvents();
  show('home');
  setTimeout(loadSDK, 1200);
  setTimeout(function () { loadAchCloud(); }, 1600);
  setTimeout(function () { syncPlayerCloud(); }, 1600);
  setTimeout(function () { loadQr('qr-img', 'qr-area'); }, 1500);
  setTimeout(function () { loadBiliChengdiCount(); }, 1500);
  setTimeout(function () { checkFollowBonus(); }, 1600);
})();
