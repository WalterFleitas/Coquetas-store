/* Coquetas – configuración y utilidades compartidas (página pública y panel) */
(function () {
  var cfg = {
    SUPABASE_URL: 'https://iwjpwnofxtimodhgkawh.supabase.co',
    SUPABASE_KEY: 'sb_publishable_a7crUlE0ofyBhzeJqUNTWQ_f5CVyLvL',
    WHATSAPP: '595984314482',
    WHATSAPP_LABEL: '+595 984 314482',
    OPEN: 14 * 60,   // 14:00
    CLOSE: 19 * 60,  // 19:00
    STEP: 30,        // minutos por bloque
    TZ: 'America/Asuncion',
    OFFSET: '-03:00' // Paraguay: UTC-3 todo el año
  };

  var WDL = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var WD = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  var MOL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function pad(n) { return String(n).padStart(2, '0'); }
  function parts(ymd) { var p = ymd.split('-').map(Number); return { y: p[0], m: p[1], d: p[2] }; }

  // "YYYY-MM-DD" de hoy en Paraguay
  function todayYMD() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: cfg.TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  function addDays(ymd, n) {
    var p = parts(ymd);
    return new Date(Date.UTC(p.y, p.m - 1, p.d + n)).toISOString().slice(0, 10);
  }
  function dow(ymd) { var p = parts(ymd); return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay(); }
  // Momento exacto de "ymd a los min minutos del día" en hora de Paraguay
  function at(ymd, min) { return new Date(ymd + 'T' + pad(Math.floor(min / 60)) + ':' + pad(min % 60) + ':00' + cfg.OFFSET); }
  function hhmm(min) { return pad(Math.floor(min / 60)) + ':' + pad(min % 60); }
  // "HH:MM" de un Date, en hora de Paraguay
  function hm(date) {
    return new Intl.DateTimeFormat('en-GB', { timeZone: cfg.TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  }
  function minOfDay(date) { var s = hm(date).split(':'); return Number(s[0]) * 60 + Number(s[1]); }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function dateLabel(ymd) { var p = parts(ymd); return cap(WDL[dow(ymd)]) + ' ' + p.d + ' de ' + MOL[p.m - 1]; }
  function dayChip(ymd) { var p = parts(ymd); return { wd: WD[dow(ymd)], num: p.d, mo: MO[p.m - 1] }; }
  function gs(n) { return 'Gs. ' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function dur(m) {
    var h = Math.floor(m / 60), r = m % 60;
    if (!h) return r + ' min';
    return r ? h + ' h ' + r + ' min' : h + ' h';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Teléfono paraguayo escrito como 0981 123 456 → 595981123456
  function waDigits(phone) {
    var d = String(phone || '').replace(/\D/g, '');
    if (d.indexOf('595') === 0) return d;
    if (d.charAt(0) === '0') return '595' + d.slice(1);
    return d.length === 9 ? '595' + d : d;
  }

  // Pedido a Supabase (sin librerías)
  function rest(path, opts) {
    opts = opts || {};
    var headers = { apikey: cfg.SUPABASE_KEY, 'Content-Type': 'application/json' };
    if (opts.token) headers.Authorization = 'Bearer ' + opts.token;
    if (opts.prefer) headers.Prefer = opts.prefer;
    return fetch(cfg.SUPABASE_URL + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      return r.text().then(function (txt) {
        var data = null;
        if (txt) { try { data = JSON.parse(txt); } catch (e) { data = txt; } }
        if (!r.ok) {
          var err = new Error((data && (data.message || data.msg || data.error_description)) || ('HTTP ' + r.status));
          err.status = r.status;
          err.code = data && data.code;
          throw err;
        }
        return data;
      });
    });
  }

  // Sesión de la dueña (solo panel)
  var KEY = 'coquetas_session';
  var session = {
    get: function () { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } },
    set: function (s) {
      var v = { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || (Math.floor(Date.now() / 1000) + (s.expires_in || 3600)) };
      try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {}
      return v;
    },
    clear: function () { try { localStorage.removeItem(KEY); } catch (e) {} }
  };
  function login(email, password) {
    return rest('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: email, password: password } }).then(session.set);
  }
  // Devuelve un token vigente (renueva si está por vencer) o null
  function token() {
    var s = session.get();
    if (!s) return Promise.resolve(null);
    if (s.expires_at - 60 > Math.floor(Date.now() / 1000)) return Promise.resolve(s.access_token);
    return rest('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token } })
      .then(function (n) { return session.set(n).access_token; })
      .catch(function () { session.clear(); return null; });
  }

  // Mayúscula inicial: cada palabra (nombres) o solo la primera letra (textos)
  function capWords(s) { return String(s).replace(/(^|\s)(\p{L})/gu, function (m, a, b) { return a + b.toUpperCase(); }); }
  function capFirst(s) { return String(s).replace(/^(\s*)(\p{L})/u, function (m, a, b) { return a + b.toUpperCase(); }); }
  function applyCap(el, fn) {
    var v = el.value, n = fn(v);
    if (n !== v) {
      var a = el.selectionStart, b = el.selectionEnd;
      el.value = n;
      try { el.setSelectionRange(a, b); } catch (e) {}
    }
  }

  window.CQ = {
    capWords: capWords, capFirst: capFirst, applyCap: applyCap,
    cfg: cfg, todayYMD: todayYMD, addDays: addDays, dow: dow, at: at, hhmm: hhmm, hm: hm, minOfDay: minOfDay,
    dateLabel: dateLabel, dayChip: dayChip, gs: gs, dur: dur, esc: esc, waDigits: waDigits,
    rest: rest, session: session, login: login, token: token
  };
})();
