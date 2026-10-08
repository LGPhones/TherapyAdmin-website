// ============================================================
// TherapyAdmin AI — app.js
// Central application logic wiring all pages together
// ============================================================

// ── AUTH LAYER ────────────────────────────────────────────────
const Auth = {
  _token: null,
  _mfaPending: false, // Track if MFA verification is pending

  async init() {
    // On every page load, try to refresh access token from httpOnly cookie
    try {
      const res = await fetch('/auth/refresh', { method:'POST', credentials:'include' });
      if (res.ok) {
        const { accessToken, user, mfaRequired } = await res.json();
        this._token = accessToken;
        App.user = user;
        
        if (mfaRequired) {
          this._mfaPending = true;
          window.location.href = '/mfa-verify.html';
          return false;
        }
        
        this.scheduleRefresh();
        return true;
      }
    } catch {}
    return false;
  },

  get token() { return this._token; },
  
  get mfaPending() { return this._mfaPending; },
  
  set mfaPending(val) { this._mfaPending = val; },

  clearMfaPending() {
    this._mfaPending = false;
  },

  scheduleRefresh() {
    // Access tokens expire in 15 min — refresh at 13 min
    setInterval(async () => {
      const res = await fetch('/auth/refresh', { method:'POST', credentials:'include' });
      if (res.ok) {
        const { accessToken } = await res.json();
        this._token = accessToken;
      } else {
        window.location.href = '/login.html';
      }
    }, 13 * 60 * 1000);
  },

  async logout() {
    await fetch('/auth/logout', { method:'POST', credentials:'include' });
    this._token = null;
    window.location.href = '/login.html';
  },

  redirectIfUnauthed() {
    if (!this._token) window.location.href = '/login.html';
  },
};

// ── MFA (TOTP) LAYER ──────────────────────────────────────────
const MFA = {
  // Generate a new TOTP secret for user setup
  generateSecret() {
    const secret = new Array(16).fill(0).map(() => 
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[Math.floor(Math.random() * 32)]
    ).join('');
    return secret;
  },

  // Generate otpauth:// URI for QR code scanning
  getOtpAuthUri(secret, email, issuer = 'TherapyAdmin AI') {
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  },

  // Verify a TOTP code (supports 30-second window)
  verifyCode(secret, code, window = 1) {
    // Simple implementation - in production use a proper TOTP library
    const now = Math.floor(Date.now() / 1000);
    const period = 30;
    
    for (let i = -window; i <= window; i++) {
      const time = Math.floor(now / period) + i;
      const expected = this.truncateHMAC(secret, time);
      if (expected === code) return true;
    }
    return false;
  },

  // Generate backup codes (one-time use)
  generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
    }
    return codes;
  },

  // Simple HMAC truncation (placeholder - use proper library in production)
  truncateHMAC(secret, counter) {
    // This is a simplified version - in production use 'otpauth' or 'speakeasy' library
    const key = this.base32ToBuf(secret);
    const data = new Array(8).fill(0);
    for (let i = 7; i >= 0; i--) {
      data[i] = counter & 0xff;
      counter = Math.floor(counter / 256);
    }
    // Simple hash for demo - replace with proper HMAC-SHA1
    let hash = 0;
    const str = secret + counter;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return String(hash).slice(-6).padStart(6, '0');
  },

  base32ToBuf(base32) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    for (const char of base32.toUpperCase()) {
      const val = alphabet.indexOf(char);
      if (val >= 0) bits += val.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }
    return new Uint8Array(bytes);
  },

  // API methods for MFA management
  async enable(code) {
    const res = await fetch('/api/mfa/enable', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    return res.json();
  },

  async disable(code) {
    const res = await fetch('/api/mfa/disable', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    return res.json();
  },

  async verify(code) {
    const res = await fetch('/api/mfa/verify', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    return res.json();
  },

  async getBackupCodes() {
    const res = await fetch('/api/mfa/backup-codes', { credentials: 'include' });
    return res.json();
  },

  async regenerateBackupCodes() {
    const res = await fetch('/api/mfa/backup-codes', {
      method: 'POST',
      credentials: 'include',
    });
    return res.json();
  },
};

// ── API CLIENT ────────────────────────────────────────────────
const API = {
  async request(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.token}`,
        ...options.headers,
      },
    });

    if (res.status === 401) {
      // Try refresh once
      const refreshed = await Auth.init();
      if (!refreshed) { window.location.href = '/login.html'; return; }
      return API.request(path, options); // Retry
    }

    return res.json();
  },

  async generateDocument(docType, context, voiceProfile) {
    return this.request('/api/generate', {
      method: 'POST',
      body: JSON.stringify({ docType, context, voiceProfile }),
    });
  },

  async saveDocument(doc) {
    return this.request('/api/documents', {
      method: 'POST',
      body: JSON.stringify(doc),
    });
  },

  async getDocuments(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request(`/api/documents?${params}`);
  },

  async deleteDocument(id) {
    return this.request(`/api/documents/${id}`, { method: 'DELETE' });
  },

  async updateVoiceProfile(profile) {
    return this.request('/api/voice-profile', {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
  },

  async getVoiceProfile() {
    return this.request('/api/voice-profile');
  },

  async createCheckout(plan, annual = false) {
    return this.request('/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan, annual }),
    });
  },

  async getBillingPortal() {
    return this.request('/api/billing/portal', { method: 'POST' });
  },
};

// ── DOCUMENT GENERATOR ───────────────────────────────────────
const Generator = {
  voiceProfile: null,

  async loadVoiceProfile() {
    // Try server first, fall back to localStorage (onboarding)
    try {
      const data = await API.getVoiceProfile();
      if (data?.voiceInstruction) { this.voiceProfile = data; return; }
    } catch {}
    try {
      const local = localStorage.getItem('ta_profile');
      if (local) { this.voiceProfile = JSON.parse(local); }
    } catch {}
  },

  buildPrompt(docType, context, voiceProfile) {
    const vp = voiceProfile || this.voiceProfile;
    const voiceInstr = vp?.voiceData?.voice_instruction || vp?.voice_instruction ||
      'Write professionally and warmly, using "my client" and centering functional impact.';

    const practiceInfo = vp ? `
Practitioner: ${vp.name || 'Dr. [Name]'}
Practice: ${vp.practice || '[Practice Name]'}
Insurance: ${vp.insurance || 'Various'}
Modalities: ${Array.isArray(vp.modalities) ? vp.modalities.join(', ') : vp.modalities || 'Integrative'}
Specialties: ${Array.isArray(vp.specialties) ? vp.specialties.join(', ') : vp.specialties || 'General MH'}` : '';

    const templates = {
      appeal: `You are replicating this practitioner's exact clinical voice.\nVOICE: ${voiceInstr}\n${practiceInfo}\n\nWrite a complete insurance appeal / medical necessity letter.\nCONTEXT:\n${context}\n\nInclude: date, proper salutation, clinical justification with DSM language, functional impairment, and professional close. Do not use bullet points.`,
      intake: `You are replicating this practitioner's exact clinical voice.\nVOICE: ${voiceInstr}\n${practiceInfo}\n\nWrite a warm, professional new client welcome letter.\nCONTEXT:\n${context}\n\nInclude: personal welcome, what to expect, logistics, and encouraging close.`,
      referral: `You are replicating this practitioner's exact clinical voice.\nVOICE: ${voiceInstr}\n${practiceInfo}\n\nWrite a professional referral letter to another provider.\nCONTEXT:\n${context}\n\nInclude: clinical summary, reason for referral, treatment history, coordination request.`,
      psychoed: `You are replicating this practitioner's exact clinical voice.\nVOICE: ${voiceInstr}\n${practiceInfo}\n\nCreate a psychoeducation handout for a therapy client.\nCONTEXT:\n${context}\n\nWrite in plain language matching the requested reading level. Include: what it is, why it happens, 3 practical coping skills.`,
      treatment: `You are replicating this practitioner's exact clinical voice.\nVOICE: ${voiceInstr}\n${practiceInfo}\n\nWrite 2-3 SMART treatment plan goals.\nCONTEXT:\n${context}\n\nFormat as numbered goals with measurable objectives, interventions, and review date. Use DSM-aligned language.`,
      comms: `You are replicating this practitioner's exact clinical voice.\nVOICE: ${voiceInstr}\n${practiceInfo}\n\nWrite the requested client communication.\nCONTEXT:\n${context}\n\nKeep it warm, concise, and professional.`,
    };

    return templates[docType] || templates.appeal;
  },

  // Streaming generation via Anthropic API
  async *generateStream(docType, context) {
    await this.loadVoiceProfile();
    const prompt = this.buildPrompt(docType, context, this.voiceProfile);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 700,
        stream: true,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          const text = parsed.delta?.text;
          if (text) yield text;
        } catch {}
      }
    }
  },

  // Non-streaming fallback
  async generate(docType, context) {
    await this.loadVoiceProfile();
    const prompt = this.buildPrompt(docType, context, this.voiceProfile);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 700,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    return data.content?.[0]?.text || '';
  },
};

// ── DOCUMENT MANAGER ─────────────────────────────────────────
const DocManager = {
  docs: [],

  async load() {
    try {
      const data = await API.getDocuments();
      this.docs = data.documents || [];
    } catch {
      // Fall back to localStorage for demo
      try {
        const local = localStorage.getItem('ta_docs');
        this.docs = local ? JSON.parse(local) : [];
      } catch { this.docs = []; }
    }
    return this.docs;
  },

  async save(doc) {
    const newDoc = {
      id: Date.now(),
      ...doc,
      createdAt: new Date().toISOString(),
      status: 'saved',
    };
    this.docs.unshift(newDoc);
    try {
      await API.saveDocument(newDoc);
    } catch {
      localStorage.setItem('ta_docs', JSON.stringify(this.docs.slice(0, 100)));
    }
    return newDoc;
  },

  async delete(id) {
    this.docs = this.docs.filter(d => d.id !== id);
    try { await API.deleteDocument(id); } catch {}
    localStorage.setItem('ta_docs', JSON.stringify(this.docs));
  },

  filter(type, query = '') {
    return this.docs.filter(d =>
      (type === 'all' || d.type === type) &&
      (d.name.toLowerCase().includes(query.toLowerCase()) ||
       d.content?.toLowerCase().includes(query.toLowerCase()))
    );
  },
};

// ── NOTIFICATIONS ─────────────────────────────────────────────
const Notifications = {
  _container: null,

  init() {
    this._container = document.createElement('div');
    this._container.id = 'notif-container';
    Object.assign(this._container.style, {
      position:'fixed', bottom:'24px', right:'24px',
      zIndex:'300', display:'flex', flexDirection:'column', gap:'10px',
      maxWidth:'340px',
    });
    document.body.appendChild(this._container);
  },

  show(msg, type = 'success', duration = 3000) {
    const el = document.createElement('div');
    const colors = {
      success: { bg:'#2a2a2a', text:'white' },
      error:   { bg:'#c0392b', text:'white' },
      warning: { bg:'#c4843a', text:'white' },
      info:    { bg:'#3a7fc1', text:'white' },
    };
    const { bg, text } = colors[type] || colors.success;
    Object.assign(el.style, {
      background: bg, color: text, padding:'12px 18px',
      borderRadius:'8px', fontSize:'13px', lineHeight:'1.5',
      boxShadow:'0 4px 16px rgba(0,0,0,.15)',
      transform:'translateY(8px)', opacity:'0',
      transition:'all .25s',
    });
    el.textContent = msg;
    this._container.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity='1'; el.style.transform='translateY(0)'; });
    setTimeout(() => {
      el.style.opacity='0'; el.style.transform='translateY(8px)';
      setTimeout(() => el.remove(), 300);
    }, duration);
  },

  success: (msg, d) => Notifications.show(msg, 'success', d),
  error:   (msg, d) => Notifications.show(msg, 'error', d),
  warning: (msg, d) => Notifications.show(msg, 'warning', d),
  info:    (msg, d) => Notifications.show(msg, 'info', d),
};

// ── DOCUMENT VIEWER MODAL ─────────────────────────────────────
const DocViewer = {
  _modal: null,

  init() {
    const modal = document.createElement('div');
    modal.id = 'doc-viewer-modal';
    modal.innerHTML = `
      <div id="dv-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:400;display:none;align-items:center;justify-content:center;padding:20px">
        <div style="background:white;border-radius:16px;max-width:680px;width:100%;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.2)">
          <div style="padding:18px 24px;border-bottom:1px solid rgba(0,0,0,.09);display:flex;align-items:center;gap:12px">
            <div id="dv-type-pill" style="font-size:10px;font-weight:500;letter-spacing:.07em;text-transform:uppercase;padding:3px 10px;border-radius:20px;background:#e8f0ec;color:#3d5a4a"></div>
            <div id="dv-title" style="font-size:15px;font-weight:500;flex:1"></div>
            <div id="dv-date" style="font-size:12px;color:#9a9088"></div>
            <button onclick="DocViewer.close()" style="background:none;border:none;font-size:22px;color:#9a9088;cursor:pointer;padding:0;line-height:1">×</button>
          </div>
          <div id="dv-content" style="padding:28px;overflow-y:auto;flex:1;font-size:14px;line-height:1.85;color:#2a2a2a;white-space:pre-wrap;word-break:break-word;font-family:'DM Sans',sans-serif"></div>
          <div style="padding:14px 24px;border-top:1px solid rgba(0,0,0,.09);display:flex;gap:10px">
            <button onclick="DocViewer.copy()" style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:6px;border:1px solid rgba(0,0,0,.12);background:white;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s" onmouseover="this.style.borderColor='#5a7a6a'" onmouseout="this.style.borderColor='rgba(0,0,0,.12)'">📋 Copy</button>
            <button onclick="DocViewer.download()" style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:6px;border:1px solid rgba(0,0,0,.12);background:white;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s" onmouseover="this.style.borderColor='#5a7a6a'" onmouseout="this.style.borderColor='rgba(0,0,0,.12)'">⬇ Download</button>
            <button onclick="DocViewer.deleteDoc()" style="margin-left:auto;display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:6px;border:1px solid rgba(0,0,0,.12);background:white;font-family:'DM Sans',sans-serif;font-size:13px;color:#c0392b;cursor:pointer">🗑 Delete</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    this._modal = modal;

    // Close on backdrop click
    document.getElementById('dv-backdrop').addEventListener('click', e => {
      if (e.target === e.currentTarget) this.close();
    });

    // Keyboard close
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.close(); });
  },

  _currentDoc: null,

  open(doc) {
    this._currentDoc = doc;
    document.getElementById('dv-type-pill').textContent = doc.type || 'Document';
    document.getElementById('dv-title').textContent = doc.name || 'Untitled';
    document.getElementById('dv-date').textContent = doc.date || doc.createdAt?.split('T')[0] || '';
    document.getElementById('dv-content').textContent = doc.content || 'No content available.';
    const backdrop = document.getElementById('dv-backdrop');
    backdrop.style.display = 'flex';
    requestAnimationFrame(() => backdrop.querySelector('div').style.animation = 'fadeUp .2s ease');
  },

  close() {
    document.getElementById('dv-backdrop').style.display = 'none';
    this._currentDoc = null;
  },

  copy() {
    if (!this._currentDoc?.content) return;
    navigator.clipboard.writeText(this._currentDoc.content);
    Notifications.success('Copied to clipboard ✓');
  },

  download() {
    if (!this._currentDoc?.content) return;
    const blob = new Blob([this._currentDoc.content], { type:'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${this._currentDoc.name || 'document'}.txt`;
    a.click();
    Notifications.success('Downloaded ✓');
  },

  async deleteDoc() {
    if (!this._currentDoc || !confirm('Delete this document? This cannot be undone.')) return;
    await DocManager.delete(this._currentDoc.id);
    this.close();
    Notifications.success('Document deleted');
    if (typeof renderDocs === 'function') renderDocs();
    if (typeof renderRecentDocs === 'function') renderRecentDocs();
  },
};

// ── USAGE TRACKER ─────────────────────────────────────────────
const Usage = {
  LIMITS: { trial:10, starter:60, professional:Infinity, group:Infinity },

  get() {
    try { return JSON.parse(localStorage.getItem('ta_usage') || '{}'); } catch { return {}; }
  },

  increment() {
    const u = this.get();
    const month = new Date().toISOString().slice(0,7);
    u[month] = (u[month] || 0) + 1;
    localStorage.setItem('ta_usage', JSON.stringify(u));
    return u[month];
  },

  thisMonth() {
    const month = new Date().toISOString().slice(0,7);
    return this.get()[month] || 0;
  },

  canGenerate(plan = 'trial') {
    const limit = this.LIMITS[plan] || 10;
    return this.thisMonth() < limit;
  },

  remaining(plan = 'trial') {
    const limit = this.LIMITS[plan] || 10;
    return Math.max(0, limit - this.thisMonth());
  },
};

// ── DOWNLOAD AS DOCX (plain text fallback) ────────────────────
// Real .docx generation requires a backend endpoint using docx npm package
// This client-side version downloads as .txt — upgrade to server-side for real Word docs
async function downloadAsDocx(content, filename) {
  // Call server endpoint if available
  try {
    const res = await API.request('/api/documents/export/docx', {
      method: 'POST',
      body: JSON.stringify({ content, filename }),
    });
    if (res.url) { window.location.href = res.url; return; }
  } catch {}

  // Fallback: download as .txt with .docx extension hint
  const blob = new Blob([content], { type:'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}.txt`;
  a.click();
  Notifications.info('Downloaded as text — connect the backend for real .docx export');
}

// ── PUSH NOTIFICATIONS ────────────────────────────────────────
const PushNotifs = {
  async request() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return false;
    const reg = await navigator.serviceWorker.ready;
    // Subscribe to push (requires VAPID keys on server)
    // const sub = await reg.pushManager.subscribe({...});
    // await API.request('/api/push/subscribe', {method:'POST', body: JSON.stringify(sub)});
    return true;
  },

  scheduleTrialReminder(daysLeft) {
    if (daysLeft <= 3 && Notification.permission === 'granted') {
      new Notification('TherapyAdmin AI', {
        body: `Your free trial ends in ${daysLeft} day${daysLeft===1?'':'s'}. Upgrade to keep your documents.`,
        icon: '/icon-192.png',
        data: { url: '/billing.html' },
      });
    }
  },
};

// ── APP INIT ──────────────────────────────────────────────────
const App = {
  user: null,
  plan: 'trial',

  async init() {
    // Initialize UI modules
    if (document.body) {
      Notifications.init();
      DocViewer.init();
    }

    // Check if user is onboarded
    const profile = (() => { try { return JSON.parse(localStorage.getItem('ta_profile')||'{}'); } catch { return {}; } })();
    if (!profile.onboarded && window.location.pathname !== '/onboarding.html' && window.location.pathname !== '/login.html') {
      // New users go to onboarding after login — handled by login redirect logic
    }

    // Update UI with user info
    if (this.user) {
      this.plan = this.user.plan || 'trial';
      this._updateUserUI();
    } else if (profile.name) {
      this._updateUserUIFromProfile(profile);
    }

    // Trial reminder
    const trialDays = this._trialDaysLeft();
    if (trialDays !== null) PushNotifs.scheduleTrialReminder(trialDays);
  },

  _updateUserUI() {
    const u = this.user;
    const nameEl = document.getElementById('user-name');
    const avatarEl = document.getElementById('user-avatar');
    if (nameEl) nameEl.textContent = u.name || u.email;
    if (avatarEl) avatarEl.textContent = (u.name||u.email||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  },

  _updateUserUIFromProfile(p) {
    const nameEl = document.getElementById('user-name');
    const avatarEl = document.getElementById('user-avatar');
    const greetEl = document.getElementById('greeting-text');
    if (nameEl) nameEl.textContent = p.name || 'Your Practice';
    if (avatarEl) {
      const initials = (p.name||'U').split(' ').map(w=>w[0]).join('').replace(/[^A-Z]/g,'').slice(0,2);
      avatarEl.textContent = initials || 'DR';
    }
    if (greetEl) {
      const firstName = (p.name||'').split(',')[0].replace(/^Dr\.\s*/,'').split(' ')[0];
      const h = new Date().getHours();
      const t = h<12?'morning':h<17?'afternoon':'evening';
      greetEl.textContent = `Good ${t}${firstName?', '+firstName:''}.`;
    }
  },

  _trialDaysLeft() {
    try {
      const profile = JSON.parse(localStorage.getItem('ta_profile')||'{}');
      if (this.user?.trialEndsAt) {
        return Math.ceil((new Date(this.user.trialEndsAt) - Date.now()) / (1000*60*60*24));
      }
    } catch {}
    return null;
  },
};

// ── AUTO-INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());

// Export for use in HTML files
window.App = App;
window.API = API;
window.Auth = Auth;
window.Generator = Generator;
window.DocManager = DocManager;
window.DocViewer = DocViewer;
window.Notifications = Notifications;
window.Usage = Usage;
window.downloadAsDocx = downloadAsDocx;
