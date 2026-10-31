(() => {
  'use strict';

  const STORAGE_KEY = 'coderush-round2-auction-v1';
  const THEME_KEY = 'coderush-round2-theme-v1';
  const DURATION_MS = 5 * 60 * 1000;
  const STARTING_PRICE = 120000; // integer paise: ₹1,200.00
  const MAX_BIDS = 500;
  const $ = (selector) => document.querySelector(selector);
  const els = {
    status: $('#auction-status'), countdown: $('#countdown'), progress: $('#timer-progress'),
    currentBid: $('#current-bid'), highestBidder: $('#highest-bidder'), minimumBid: $('#minimum-bid'),
    form: $('#bid-form'), name: $('#bidder-name'), amount: $('#bid-amount'), message: $('#form-message'),
    place: $('#place-bid'), note: $('#bid-note'), ended: $('#ended-message'), winner: $('#winner-message'),
    history: $('#bid-history'), empty: $('#history-empty'), count: $('#bid-count'), reset: $('#reset-auction'),
    toast: $('#toast'), theme: $('#theme-toggle'), metaTheme: $('meta[name="theme-color"]'),
  };
  const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
  let state;
  let storageAvailable = true;
  let toastTimer;
  let corruptData = false;

  function freshAuction(now = Date.now()) {
    return { version: 1, startedAt: now, endsAt: now + DURATION_MS, bids: [] };
  }

  function validBid(bid) {
    return bid && typeof bid.id === 'string' && typeof bid.name === 'string' &&
      bid.name.trim().length > 0 && bid.name.length <= 32 && Number.isSafeInteger(bid.amount) &&
      bid.amount > STARTING_PRICE && Number.isFinite(bid.placedAt);
  }

  function validState(value) {
    return value && value.version === 1 && Number.isFinite(value.startedAt) &&
      Number.isFinite(value.endsAt) && value.endsAt > value.startedAt &&
      Array.isArray(value.bids) && value.bids.length <= MAX_BIDS && value.bids.every(validBid);
  }

  function readState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return freshAuction();
      const parsed = JSON.parse(raw);
      if (validState(parsed)) return parsed;
      corruptData = true;
    } catch (error) {
      storageAvailable = false;
    }
    return freshAuction();
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageAvailable = true;
      return true;
    } catch (error) {
      storageAvailable = false;
      return false;
    }
  }

  function leadingBid() {
    return state.bids.reduce((highest, bid) => !highest || bid.amount > highest.amount ? bid : highest, null);
  }

  function isClosed(now = Date.now()) { return now >= state.endsAt; }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('visible'), 3200);
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    els.theme.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
    els.metaTheme.content = theme === 'dark' ? '#151713' : '#f5f6f2';
  }

  function initTheme() {
    let chosen = null;
    try { chosen = localStorage.getItem(THEME_KEY); } catch (error) { /* Theme remains usable without storage. */ }
    const initial = chosen === 'dark' || chosen === 'light' ? chosen :
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(initial);
    els.theme.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      setTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (error) { showToast('Theme changed for this visit; browser storage is unavailable.'); }
    });
  }

  function renderHistory() {
    const sorted = [...state.bids].sort((a, b) => b.placedAt - a.placedAt || b.id.localeCompare(a.id));
    const leader = leadingBid();
    const closed = isClosed();
    els.history.replaceChildren();
    els.empty.hidden = sorted.length > 0;
    els.count.textContent = `${state.bids.length} ${state.bids.length === 1 ? 'bid' : 'bids'}`;
    for (const bid of sorted) {
      const row = document.createElement('tr');
      const bidder = document.createElement('td');
      const bidderBox = document.createElement('div');
      bidderBox.className = 'bidder-cell';
      const avatar = document.createElement('span');
      avatar.className = 'avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = bid.name.trim().slice(0, 1).toLocaleUpperCase();
      const name = document.createElement('span');
      name.textContent = bid.name;
      bidderBox.append(avatar, name);
      bidder.append(bidderBox);

      const amount = document.createElement('td');
      amount.textContent = money.format(bid.amount / 100);
      const time = document.createElement('td');
      time.textContent = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(bid.placedAt);
      const status = document.createElement('td');
      if (closed && leader && bid.id === leader.id) {
        const badge = document.createElement('span');
        badge.className = 'winner-badge';
        badge.textContent = 'WINNER';
        status.append(badge);
      } else if (!closed && leader && bid.id === leader.id) {
        const badge = document.createElement('span');
        badge.className = 'leading-badge';
        badge.textContent = 'LEADING';
        status.append(badge);
      } else status.textContent = '—';
      row.append(bidder, amount, time, status);
      els.history.append(row);
    }
  }

  function render() {
    const now = Date.now();
    const closed = isClosed(now);
    const remaining = Math.max(0, state.endsAt - now);
    const seconds = Math.ceil(remaining / 1000);
    const minsText = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secsText = String(seconds % 60).padStart(2, '0');
    els.countdown.textContent = `${minsText}:${secsText}`;
    els.countdown.setAttribute('aria-label', closed ? 'Auction ended' : `${minsText} minutes and ${secsText} seconds remaining`);
    els.progress.style.width = `${Math.max(0, Math.min(100, remaining / (state.endsAt - state.startedAt) * 100))}%`;
    els.currentBid.textContent = money.format((leadingBid()?.amount ?? STARTING_PRICE) / 100);
    els.minimumBid.textContent = money.format(((leadingBid()?.amount ?? STARTING_PRICE) + 1) / 100);
    els.amount.min = ((leadingBid()?.amount ?? STARTING_PRICE) + 1) / 100;
    const leader = leadingBid();
    els.highestBidder.textContent = leader ? `Leading bid by ${leader.name}` : 'Starting price · no bids yet';
    els.status.classList.toggle('closed', closed);
    els.status.innerHTML = `<i></i> ${closed ? 'AUCTION CLOSED' : 'LIVE AUCTION'}`;
    els.place.disabled = closed || state.bids.length >= MAX_BIDS;
    els.name.disabled = closed;
    els.amount.disabled = closed;
    els.note.textContent = state.bids.length >= MAX_BIDS ? 'This demo has reached its bid limit.' : closed ? 'Bidding is closed. The winning bid is shown below.' : 'Bids are final. The highest valid bid when the timer ends wins.';
    els.ended.hidden = !closed;
    if (closed) {
      els.winner.textContent = leader ? `${leader.name} wins with ${money.format(leader.amount / 100)}.` : 'No bids were placed. The item remains unsold.';
    }
    renderHistory();
  }

  function parseAmount(raw) {
    const value = raw.trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
    const [whole, fraction = ''] = value.split('.');
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    return Number.isSafeInteger(cents) ? cents : null;
  }

  function submitBid(event) {
    event.preventDefault();
    els.message.textContent = '';
    els.message.classList.remove('success');
    if (isClosed()) {
      render();
      els.message.textContent = 'This auction has ended. Bids are no longer accepted.';
      return;
    }
    if (state.bids.length >= MAX_BIDS) {
      els.message.textContent = 'This demo has reached its bid limit.';
      render();
      return;
    }
    const name = els.name.value.trim().replace(/\s+/g, ' ');
    if (!name || name.length > 32) {
      els.message.textContent = 'Enter a display name between 1 and 32 characters.';
      els.name.focus();
      return;
    }
    const amount = parseAmount(els.amount.value);
    if (amount === null || amount <= STARTING_PRICE || amount <= (leadingBid()?.amount ?? STARTING_PRICE)) {
      els.message.textContent = `Your bid must be a valid amount above ${money.format((leadingBid()?.amount ?? STARTING_PRICE) / 100)}.`;
      els.amount.focus();
      return;
    }
    const bid = { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`, name, amount, placedAt: Date.now() };
    state.bids.push(bid);
    saveState();
    render();
    els.form.reset();
    els.message.classList.add('success');
    els.message.textContent = storageAvailable ? 'Bid placed and saved.' : 'Bid placed for this visit, but browser storage is unavailable.';
    if (!storageAvailable) showToast('This bid may not survive a refresh because storage is unavailable.');
  }

  function resetAuction() {
    if (!window.confirm('Reset the demo auction? This clears all bids and starts a fresh 5-minute timer in this browser.')) return;
    state = freshAuction();
    const saved = saveState();
    els.form.reset();
    els.message.textContent = '';
    render();
    showToast(saved ? 'Demo auction reset. The five-minute timer is live.' : 'Auction reset for this visit; browser storage is unavailable.');
  }

  function start() {
    initTheme();
    state = readState();
    if (corruptData) showToast('Saved auction data was invalid; a fresh demo auction was started.');
    if (!storageAvailable) showToast('Browser storage is unavailable; changes may not survive refresh.');
    saveState();
    els.form.addEventListener('submit', submitBid);
    els.reset.addEventListener('click', resetAuction);
    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY) return;
      try {
        const remote = event.newValue && JSON.parse(event.newValue);
        if (validState(remote)) { state = remote; render(); showToast('Auction updated in another tab.'); }
      } catch (error) { /* Ignore invalid cross-tab data and retain the valid local snapshot. */ }
    });
    render();
    window.setInterval(render, 1000);
  }

  start();
})();
