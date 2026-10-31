(() => {
  'use strict';

  const STORAGE_KEY = 'coderush-round2-auctions-v2';
  const LEGACY_STORAGE_KEY = 'coderush-round2-auction-v1';
  const THEME_KEY = 'coderush-round2-theme-v1';
  const DEFAULT_DURATION_MS = 5 * 60 * 1000;
  const DEFAULT_PRICE = 120000; // integer paise: ₹1,200.00
  const MAX_AUCTIONS = 25;
  const MAX_BIDS_PER_AUCTION = 500;
  const MAX_TITLE_LENGTH = 60;
  const MAX_DESCRIPTION_LENGTH = 500;
  const MAX_DURATION_MINUTES = 24 * 60;
  const $ = (selector) => document.querySelector(selector);
  const els = {
    status: $('#auction-status'), countdown: $('#countdown'), progress: $('#timer-progress'),
    currentBid: $('#current-bid'), highestBidder: $('#highest-bidder'), minimumBid: $('#minimum-bid'),
    form: $('#bid-form'), name: $('#bidder-name'), amount: $('#bid-amount'), message: $('#form-message'),
    place: $('#place-bid'), note: $('#bid-note'), ended: $('#ended-message'), winner: $('#winner-message'),
    history: $('#bid-history'), empty: $('#history-empty'), count: $('#bid-count'), reset: $('#reset-auction'),
    toast: $('#toast'), theme: $('#theme-toggle'), metaTheme: $('meta[name="theme-color"]'),
    list: $('#auction-list'), auctionCount: $('#auction-count'), createTrigger: $('#create-auction-trigger'),
    managerNote: $('#manager-note'), artNumber: $('#art-lot-number'), itemTitle: $('#item-title'),
    itemDescription: $('#item-description'), lotDetails: $('#lot-details'), dialog: $('#auction-dialog'),
    createForm: $('#auction-form'), dialogClose: $('#dialog-close'), dialogCancel: $('#dialog-cancel'),
    newTitle: $('#new-title'), newDescription: $('#new-description'), newPrice: $('#new-price'),
    newDuration: $('#new-duration'), createMessage: $('#create-message'),
  };
  const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
  let state;
  let storageAvailable = true;
  let toastTimer;
  let corruptData = false;
  let closedSnapshot = new Map();

  function newId() {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function makeDefaultAuction(now = Date.now()) {
    return {
      id: 'starter-creator-kit', title: 'CodeRush Creator Kit',
      description: 'A field-ready bundle for your next big idea. Made for curious people who like to build things that matter.',
      details: 'Instant film camera · Field notes · CodeRush maker essentials',
      startingPrice: DEFAULT_PRICE, durationMs: DEFAULT_DURATION_MS,
      startedAt: now, endsAt: now + DEFAULT_DURATION_MS, bids: [],
    };
  }

  function freshState(now = Date.now()) {
    const first = makeDefaultAuction(now);
    return { version: 2, selectedAuctionId: first.id, auctions: [first] };
  }

  function validBid(bid, startingPrice) {
    return bid && typeof bid.id === 'string' && typeof bid.name === 'string' &&
      bid.name.trim().length > 0 && bid.name.length <= 32 && Number.isSafeInteger(bid.amount) &&
      bid.amount > startingPrice && Number.isFinite(bid.placedAt);
  }

  function validAuction(auction) {
    return auction && typeof auction.id === 'string' && auction.id.length > 0 && auction.id.length <= 100 &&
      typeof auction.title === 'string' && auction.title.trim().length > 0 && auction.title.length <= MAX_TITLE_LENGTH &&
      typeof auction.description === 'string' && auction.description.length <= MAX_DESCRIPTION_LENGTH &&
      typeof auction.details === 'string' && Number.isSafeInteger(auction.startingPrice) && auction.startingPrice > 0 &&
      Number.isSafeInteger(auction.durationMs) && auction.durationMs >= 60_000 && auction.durationMs <= MAX_DURATION_MINUTES * 60_000 &&
      Number.isFinite(auction.startedAt) && Number.isFinite(auction.endsAt) && auction.endsAt > auction.startedAt &&
      Array.isArray(auction.bids) && auction.bids.length <= MAX_BIDS_PER_AUCTION &&
      auction.bids.every((bid) => validBid(bid, auction.startingPrice));
  }

  function validState(value) {
    if (!value || value.version !== 2 || !Array.isArray(value.auctions) ||
      value.auctions.length < 1 || value.auctions.length > MAX_AUCTIONS ||
      !value.auctions.every(validAuction)) return false;
    const ids = new Set(value.auctions.map((auction) => auction.id));
    return ids.size === value.auctions.length && ids.has(value.selectedAuctionId);
  }

  function migrateLegacy(value) {
    if (!value || value.version !== 1 || !Number.isFinite(value.startedAt) ||
      !Number.isFinite(value.endsAt) || value.endsAt <= value.startedAt ||
      !Array.isArray(value.bids) || value.bids.length > MAX_BIDS_PER_AUCTION ||
      !value.bids.every((bid) => validBid(bid, DEFAULT_PRICE))) return null;
    const auction = makeDefaultAuction(value.startedAt);
    auction.endsAt = value.endsAt;
    auction.durationMs = value.endsAt - value.startedAt;
    auction.bids = value.bids;
    const migrated = { version: 2, selectedAuctionId: auction.id, auctions: [auction] };
    return validState(migrated) ? migrated : null;
  }

  function readState() {
    let current = null;
    let legacy = null;
    try {
      current = localStorage.getItem(STORAGE_KEY);
      legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    } catch (error) {
      storageAvailable = false;
    }
    if (current) {
      try {
        const parsed = JSON.parse(current);
        if (validState(parsed)) return parsed;
      } catch (error) { /* Fall back to the last legacy snapshot if present. */ }
      corruptData = true;
    }
    if (legacy) {
      try {
        const migrated = migrateLegacy(JSON.parse(legacy));
        if (migrated) return migrated;
      } catch (error) { /* Start with the synthetic default when saved data is malformed. */ }
      corruptData = true;
    }
    return freshState();
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

  function selectedAuction() {
    return state.auctions.find((auction) => auction.id === state.selectedAuctionId) || state.auctions[0];
  }

  function leadingBid(auction = selectedAuction()) {
    return auction.bids.reduce((highest, bid) => !highest || bid.amount > highest.amount ? bid : highest, null);
  }

  function isClosed(auction = selectedAuction(), now = Date.now()) { return now >= auction.endsAt; }

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
    setTheme(chosen === 'dark' || chosen === 'light' ? chosen :
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
    els.theme.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      setTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (error) { showToast('Theme changed for this visit; browser storage is unavailable.'); }
    });
  }

  function renderAuctions() {
    const selected = selectedAuction();
    els.list.replaceChildren();
    els.auctionCount.textContent = `${state.auctions.length} ${state.auctions.length === 1 ? 'auction' : 'auctions'}`;
    els.createTrigger.disabled = state.auctions.length >= MAX_AUCTIONS;
    els.createTrigger.title = els.createTrigger.disabled ? `The limit of ${MAX_AUCTIONS} auctions has been reached.` : 'Create an auction for your item';
    els.managerNote.textContent = state.auctions.length >= MAX_AUCTIONS
      ? `Auction limit reached (${MAX_AUCTIONS}).` : 'Each auction has its own bid history and countdown.';

    state.auctions.forEach((auction, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `auction-option${auction.id === selected.id ? ' selected' : ''}`;
      button.setAttribute('aria-pressed', String(auction.id === selected.id));
      button.setAttribute('aria-label', `${auction.title}, ${isClosed(auction) ? 'ended' : 'live'}, ${money.format((leadingBid(auction)?.amount ?? auction.startingPrice) / 100)}${auction.id === selected.id ? ', selected' : ''}`);
      button.addEventListener('click', () => {
        if (state.selectedAuctionId === auction.id) return;
        state.selectedAuctionId = auction.id;
        saveState();
        els.form.reset();
        els.message.textContent = '';
        render();
      });

      const top = document.createElement('span');
      top.className = 'lot-option-top';
      const dot = document.createElement('i');
      dot.className = `lot-state-dot${isClosed(auction) ? ' closed' : ''}`;
      const stateText = document.createElement('span');
      stateText.textContent = isClosed(auction) ? 'ENDED' : 'LIVE';
      const lotNum = document.createElement('span');
      lotNum.className = 'lot-number';
      lotNum.textContent = `LOT ${String(index + 1).padStart(2, '0')}`;
      top.append(dot, stateText, lotNum);

      const title = document.createElement('span');
      title.className = 'lot-option-title';
      title.textContent = auction.title;
      const price = document.createElement('span');
      price.className = 'lot-option-price';
      price.textContent = money.format((leadingBid(auction)?.amount ?? auction.startingPrice) / 100);
      const priceLabel = document.createElement('span');
      priceLabel.className = 'lot-option-subtitle';
      priceLabel.textContent = leadingBid(auction) ? 'Current highest bid' : 'Starting price';
      button.append(top, title, price, priceLabel);
      els.list.append(button);
    });
  }

  function renderHistory(auction) {
    const sorted = [...auction.bids].sort((a, b) => b.placedAt - a.placedAt || b.id.localeCompare(a.id));
    const leader = leadingBid(auction);
    const closed = isClosed(auction);
    els.history.replaceChildren();
    els.empty.hidden = sorted.length > 0;
    els.count.textContent = `${auction.bids.length} ${auction.bids.length === 1 ? 'bid' : 'bids'}`;
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
    const auction = selectedAuction();
    const now = Date.now();
    const closed = isClosed(auction, now);
    const leader = leadingBid(auction);
    const lotIndex = state.auctions.findIndex((item) => item.id === auction.id) + 1;

    els.artNumber.textContent = `${String(lotIndex).padStart(2, '0')} / ${String(state.auctions.length).padStart(2, '0')}`;
    els.itemTitle.textContent = auction.title;
    els.itemDescription.textContent = auction.description || 'A special item, ready for its next owner.';
    const durationMins = Math.round(auction.durationMs / 60_000);
    els.lotDetails.textContent = `Opening bid ${money.format(auction.startingPrice / 100)} · ${durationMins} ${durationMins === 1 ? 'minute' : 'minutes'}`;
    els.currentBid.textContent = money.format((leader?.amount ?? auction.startingPrice) / 100);
    els.minimumBid.textContent = money.format(((leader?.amount ?? auction.startingPrice) + 1) / 100);
    els.amount.min = ((leader?.amount ?? auction.startingPrice) + 1) / 100;
    els.highestBidder.textContent = leader ? `Leading bid by ${leader.name}` : 'Starting price · no bids yet';
    els.status.classList.toggle('closed', closed);
    els.status.innerHTML = `<i></i> ${closed ? 'AUCTION CLOSED' : 'LIVE AUCTION'}`;
    els.place.disabled = closed || auction.bids.length >= MAX_BIDS_PER_AUCTION;
    els.name.disabled = closed;
    els.amount.disabled = closed;
    els.note.textContent = auction.bids.length >= MAX_BIDS_PER_AUCTION ? 'This lot reached its bid limit.' : closed ? 'Bidding is closed. The result is shown below.' : 'Bids are final. The highest valid bid when the timer ends wins.';
    els.ended.hidden = !closed;
    if (closed) els.winner.textContent = leader ? `${leader.name} wins with ${money.format(leader.amount / 100)}.` : 'No bids were placed. The item remains unsold.';
    renderAuctions();
    renderHistory(auction);
    closedSnapshot = new Map(state.auctions.map((item) => [item.id, isClosed(item, now)]));
    renderTimer();
  }

  function renderTimer(now = Date.now()) {
    const auction = selectedAuction();
    const remaining = Math.max(0, auction.endsAt - now);
    const seconds = Math.ceil(remaining / 1000);
    const minsText = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secsText = String(seconds % 60).padStart(2, '0');
    const closed = isClosed(auction, now);
    els.countdown.textContent = `${minsText}:${secsText}`;
    els.countdown.setAttribute('aria-label', closed ? 'Auction ended' : `${minsText} minutes and ${secsText} seconds remaining`);
    els.progress.style.width = `${Math.max(0, Math.min(100, remaining / auction.durationMs * 100))}%`;
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
    const auction = selectedAuction();
    els.message.textContent = '';
    els.message.classList.remove('success');
    if (isClosed(auction)) {
      render();
      els.message.textContent = 'This auction has ended. Bids are no longer accepted.';
      return;
    }
    if (auction.bids.length >= MAX_BIDS_PER_AUCTION) {
      els.message.textContent = 'This lot reached its bid limit.';
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
    const minimum = leaderAmount(auction) + 1;
    if (amount === null || amount < minimum) {
      els.message.textContent = `Your bid must be a valid amount of at least ${money.format(minimum / 100)}.`;
      els.amount.focus();
      return;
    }
    auction.bids.push({ id: newId(), name, amount, placedAt: Date.now() });
    saveState();
    render();
    els.form.reset();
    els.message.classList.add('success');
    els.message.textContent = storageAvailable ? 'Bid placed and saved.' : 'Bid placed for this visit, but browser storage is unavailable.';
    if (!storageAvailable) showToast('This bid may not survive a refresh because storage is unavailable.');
  }

  function leaderAmount(auction = selectedAuction()) {
    return leadingBid(auction)?.amount ?? auction.startingPrice;
  }

  function openCreateDialog() {
    if (state.auctions.length >= MAX_AUCTIONS) {
      showToast(`You can create up to ${MAX_AUCTIONS} auctions in this browser.`);
      return;
    }
    els.createMessage.textContent = '';
    els.createMessage.classList.remove('success');
    els.createForm.reset();
    els.newDuration.value = '5';
    els.dialog.showModal();
    els.newTitle.focus();
  }

  function createAuction(event) {
    event.preventDefault();
    els.createMessage.textContent = '';
    els.createMessage.classList.remove('success');
    if (state.auctions.length >= MAX_AUCTIONS) {
      els.createMessage.textContent = `The limit of ${MAX_AUCTIONS} auctions has been reached.`;
      return;
    }
    const title = els.newTitle.value.trim().replace(/\s+/g, ' ');
    const description = els.newDescription.value.trim();
    const startingPrice = parseAmount(els.newPrice.value);
    const duration = Number(els.newDuration.value);
    if (!title || title.length > MAX_TITLE_LENGTH) {
      els.createMessage.textContent = `Enter an item name between 1 and ${MAX_TITLE_LENGTH} characters.`;
      els.newTitle.focus();
      return;
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      els.createMessage.textContent = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`;
      els.newDescription.focus();
      return;
    }
    if (startingPrice === null || startingPrice < 1) {
      els.createMessage.textContent = 'Enter a positive starting price with no more than two decimal places.';
      els.newPrice.focus();
      return;
    }
    if (!Number.isInteger(duration) || duration < 1 || duration > MAX_DURATION_MINUTES) {
      els.createMessage.textContent = 'Choose a whole number of minutes from 1 to 1,440.';
      els.newDuration.focus();
      return;
    }

    const now = Date.now();
    const auction = {
      id: newId(), title, description, details: description || 'One item · One winner',
      startingPrice, durationMs: duration * 60_000, startedAt: now,
      endsAt: now + duration * 60_000, bids: [],
    };
    state.auctions.push(auction);
    state.selectedAuctionId = auction.id;
    const saved = saveState();
    render();
    els.form.reset();
    els.dialog.close();
    showToast(saved ? `“${title}” is live. The timer has started.` : `“${title}” is live for this visit, but browser storage is unavailable.`);
  }

  function restartSelectedAuction() {
    const auction = selectedAuction();
    if (!window.confirm(`Restart “${auction.title}”? This clears its bids and starts its ${Math.round(auction.durationMs / 60_000)}-minute timer again.`)) return;
    auction.bids = [];
    auction.startedAt = Date.now();
    auction.endsAt = auction.startedAt + auction.durationMs;
    const saved = saveState();
    els.form.reset();
    els.message.textContent = '';
    render();
    showToast(saved ? 'This lot was restarted.' : 'This lot was restarted for this visit; storage is unavailable.');
  }

  function start() {
    initTheme();
    state = readState();
    if (corruptData) showToast('Saved auction data was invalid; a fresh auction was started.');
    if (!storageAvailable) showToast('Browser storage is unavailable; changes may not survive refresh.');
    saveState(); // Also persists a one-time, data-preserving v1 migration.
    els.form.addEventListener('submit', submitBid);
    els.reset.addEventListener('click', restartSelectedAuction);
    els.createTrigger.addEventListener('click', openCreateDialog);
    els.createForm.addEventListener('submit', createAuction);
    els.dialogClose.addEventListener('click', () => els.dialog.close());
    els.dialogCancel.addEventListener('click', () => els.dialog.close());
    els.dialog.addEventListener('click', (event) => {
      if (event.target === els.dialog) els.dialog.close();
    });
    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const remote = JSON.parse(event.newValue);
        if (validState(remote)) { state = remote; render(); showToast('Auctions updated in another tab.'); }
      } catch (error) { /* Ignore invalid cross-tab data and retain the current valid state. */ }
    });
    render();
    window.setInterval(() => {
      const now = Date.now();
      if (state.auctions.some((auction) => closedSnapshot.get(auction.id) !== isClosed(auction, now))) render();
      else renderTimer(now);
    }, 1000);
  }

  start();
})();
