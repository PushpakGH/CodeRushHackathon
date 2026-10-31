(() => {
  const STORAGE_KEY = "coderush.round1.kanban.v1";
  const THEME_KEY = "coderush.theme";
  const statuses = ["todo", "progress", "done"];
  const statusLabels = { todo: "To do", progress: "In progress", done: "Completed" };
  const priorityLabels = { high: "High", medium: "Medium", low: "Low" };
  const sampleTasks = [
    { title: "Map the first-run experience", description: "Sketch the steps from signup to the first useful moment.", priority: "high", dueOffset: 1, status: "todo" },
    { title: "Review the launch checklist", description: "Check the final details with the product team.", priority: "medium", dueOffset: 3, status: "todo" },
    { title: "Write release notes", description: "Keep the update short, useful, and easy to scan.", priority: "low", dueOffset: 5, status: "todo" },
    { title: "Polish empty states", description: "Give each quiet screen a helpful next step.", priority: "high", dueOffset: 0, status: "progress" },
    { title: "Set up the project board", description: "Create a clear home for the team's work.", priority: "medium", dueOffset: -1, status: "done" }
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const dialog = $("#task-dialog");
  const form = $("#task-form");
  const titleInput = $("#task-title");
  const searchInput = $("#task-search");
  const priorityFilter = $("#priority-filter");
  const toast = $("#toast");
  const themeToggle = $("#theme-toggle");
  let tasks = loadTasks();
  let editingId = null;
  let draggedId = null;
  let toastTimer;

  function setTheme(theme, persist = false) {
    const nextTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    const dark = nextTheme === "dark";
    const label = dark ? "Switch to light mode" : "Switch to dark mode";
    themeToggle.setAttribute("aria-label", label);
    themeToggle.setAttribute("title", label);
    themeToggle.setAttribute("aria-pressed", String(dark));
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#141b17" : "#f4f5f2");
    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, nextTheme);
      } catch (error) {
        console.warn("Could not save the theme preference.", error);
        showToast("Theme changed for this visit; browser storage is unavailable.", true);
      }
    }
  }

  setTheme(document.documentElement.dataset.theme || "light");

  function isoDay(offset) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function makeId() {
    return globalThis.crypto?.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function createSampleTasks() {
    const now = new Date().toISOString();
    return sampleTasks.map((task) => ({
      id: makeId(), title: task.title, description: task.description,
      priority: task.priority, dueDate: isoDay(task.dueOffset), status: task.status,
      createdAt: now, updatedAt: now, sample: true
    }));
  }

  function isValidTask(task) {
    return task && typeof task.id === "string" && typeof task.title === "string" && task.title.trim().length > 0 &&
      typeof task.description === "string" && Object.hasOwn(priorityLabels, task.priority) &&
      statuses.includes(task.status) && (task.dueDate === "" || (typeof task.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)));
  }

  function loadTasks() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === null) {
        const seeded = createSampleTasks();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
        return seeded;
      }
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed) || !parsed.every(isValidTask)) throw new Error("Saved board data is invalid.");
      return parsed;
    } catch (error) {
      console.warn("Could not load the saved task board.", error);
      return createSampleTasks();
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      $(".updated-label").innerHTML = '<span class="pulse-dot"></span> Saved on this device';
      return true;
    } catch (error) {
      console.error("Could not save the task board.", error);
      $(".updated-label").textContent = "Not saved — browser storage unavailable";
      showToast("This browser couldn't save your changes. Check its storage settings.", true);
      return false;
    }
  }

  function formatDueDate(value) {
    if (!value) return "No due date";
    const date = new Date(`${value}T00:00:00`);
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
  }

  function dateState(value) {
    if (!value) return "";
    const today = isoDay(0);
    if (value < today) return "is-overdue";
    if (value === today) return "is-today";
    return "";
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function visibleTasks() {
    const query = searchInput.value.trim().toLowerCase();
    const priority = priorityFilter.value;
    return tasks.filter((task) => {
      const matchesText = !query || `${task.title} ${task.description}`.toLowerCase().includes(query);
      return matchesText && (priority === "all" || task.priority === priority);
    });
  }

  function renderCard(task, isFirstUp = false) {
    const dueState = task.status === "done" ? "" : dateState(task.dueDate);
    const overdueLabel = dueState === "is-overdue" ? "Overdue · " : dueState === "is-today" ? "Due today · " : "";
    const description = task.description ? `<p class="card-description">${escapeHtml(task.description)}</p>` : "";
    const sample = task.sample ? '<span class="sample-tag">Starter</span>' : "";
    const firstUp = isFirstUp ? '<span class="spotlight-tag">First up</span>' : "";
    const due = task.dueDate
      ? `<span class="due-date ${dueState}"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="10" rx="2"/><path d="M5 2v3M11 2v3M2.5 6.5h11"/></svg>${overdueLabel}${formatDueDate(task.dueDate)}</span>`
      : `<span class="due-date"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="10" rx="2"/><path d="M5 2v3M11 2v3M2.5 6.5h11"/></svg>No due date</span>`;

    return `<article class="task-card" draggable="true" tabindex="0" data-task-id="${escapeHtml(task.id)}" data-status="${task.status}" aria-label="Task: ${escapeHtml(task.title)}. ${priorityLabels[task.priority]} priority. ${statusLabels[task.status]}${isFirstUp ? ". First up in this column" : ""}.">
      <div class="task-topline"><span class="priority-cluster"><span class="priority priority-${task.priority}">${priorityLabels[task.priority]}</span>${firstUp}</span>
        <div class="card-menu"><button type="button" aria-label="Actions for ${escapeHtml(task.title)}" aria-expanded="false">···</button>
          <div class="card-actions" hidden><button type="button" data-action="edit">Edit task</button><button type="button" data-action="move">Move task</button><button type="button" data-action="delete" class="delete-action">Delete task</button></div>
        </div>
      </div>
      <h4 class="card-title">${escapeHtml(task.title)}</h4>${description}
      <div class="card-footer">${due}<span class="card-owner" aria-label="Product team">PT</span>${sample}</div>
    </article>`;
  }

  function render() {
    const shown = visibleTasks();
    for (const status of statuses) {
      const list = $(`[data-list="${status}"]`);
      const group = shown.filter((task) => task.status === status)
        .sort((a, b) => Number(b.priority === "high") - Number(a.priority === "high"));
      const firstHighIndex = group.findIndex((task) => task.priority === "high");
      list.innerHTML = group.length
        ? group.map((task, index) => renderCard(task, index === firstHighIndex)).join("")
        : `<div class="empty-state ${searchInput.value || priorityFilter.value !== "all" ? "filtered" : ""}"><strong>${searchInput.value || priorityFilter.value !== "all" ? "No matching tasks" : "A clear space to start"}</strong><span>${searchInput.value || priorityFilter.value !== "all" ? "Try a different search or filter." : "Add a task when you're ready."}</span></div>`;
      $(`[data-count="${status}"]`).textContent = tasks.filter((task) => task.status === status).length;
    }
    $("#total-count").textContent = tasks.length;
    $("#done-count").textContent = tasks.filter((task) => task.status === "done").length;
    const open = tasks.filter((task) => task.status !== "done").length;
    $("#board-summary").textContent = tasks.length ? `${open} ${open === 1 ? "task is" : "tasks are"} still in motion. Keep the momentum going.` : "Your work, at a glance.";
  }

  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle("is-error", isError);
    toast.classList.add("is-visible");
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function openDialog(task = null, initialStatus = "todo") {
    editingId = task?.id ?? null;
    $("#dialog-title").textContent = task ? "Edit task" : "Add a task";
    $("#save-task").textContent = task ? "Save changes" : "Save task";
    $("#title-error").textContent = "";
    $("#storage-error").textContent = "";
    form.elements.title.value = task?.title ?? "";
    form.elements.description.value = task?.description ?? "";
    form.elements.priority.value = task?.priority ?? "medium";
    form.elements.dueDate.value = task?.dueDate ?? "";
    form.elements.status.value = task?.status ?? (statuses.includes(initialStatus) ? initialStatus : "todo");
    dialog.showModal();
    requestAnimationFrame(() => titleInput.focus());
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  function moveTask(id) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    const next = statuses[(statuses.indexOf(task.status) + 1) % statuses.length];
    task.status = next;
    task.sample = false;
    task.updatedAt = new Date().toISOString();
    saveTasks();
    render();
    showToast(`Moved to ${statusLabels[next]}.`);
  }

  function onSubmit(event) {
    event.preventDefault();
    const title = form.elements.title.value.trim();
    if (!title) {
      $("#title-error").textContent = "Add a short title so your team knows what to do.";
      titleInput.focus();
      return;
    }
    $("#title-error").textContent = "";
    const now = new Date().toISOString();
    const existing = tasks.find((task) => task.id === editingId);
    const task = {
      id: existing?.id ?? makeId(),
      title,
      description: form.elements.description.value.trim(),
      priority: Object.hasOwn(priorityLabels, form.elements.priority.value) ? form.elements.priority.value : "medium",
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(form.elements.dueDate.value) ? form.elements.dueDate.value : "",
      status: statuses.includes(form.elements.status.value) ? form.elements.status.value : "todo",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    if (existing) tasks = tasks.map((item) => item.id === editingId ? task : item);
    else tasks = [task, ...tasks];
    saveTasks();
    closeDialog();
    render();
    showToast(existing ? "Task updated." : "Task added to the board.");
  }

  function handleCardClick(event) {
    const card = event.target.closest(".task-card");
    if (!card) return;
    const id = card.dataset.taskId;
    const actionButton = event.target.closest("[data-action]");
    if (actionButton) {
      const task = tasks.find((item) => item.id === id);
      if (actionButton.dataset.action === "edit") openDialog(task);
      if (actionButton.dataset.action === "move") moveTask(id);
      if (actionButton.dataset.action === "delete") {
        tasks = tasks.filter((item) => item.id !== id);
        saveTasks();
        render();
        showToast("Task deleted.");
      }
      return;
    }
    const menuButton = event.target.closest(".card-menu > button");
    if (menuButton) {
      const menu = $(".card-actions", menuButton.parentElement);
      const expanded = menuButton.getAttribute("aria-expanded") === "true";
      $$(".card-actions").forEach((other) => { other.hidden = true; other.parentElement.querySelector("button").setAttribute("aria-expanded", "false"); });
      menu.hidden = expanded;
      menuButton.setAttribute("aria-expanded", String(!expanded));
    }
  }

  function handleCardKeydown(event) {
    const card = event.target.closest(".task-card");
    if (!card || event.target !== card) return;
    if (event.key.toLowerCase() === "e") {
      event.preventDefault();
      openDialog(tasks.find((task) => task.id === card.dataset.taskId));
    }
    if (event.key.toLowerCase() === "m") {
      event.preventDefault();
      moveTask(card.dataset.taskId);
    }
  }

  function setupDragDrop() {
    document.addEventListener("dragstart", (event) => {
      const card = event.target.closest(".task-card");
      if (!card) return;
      draggedId = card.dataset.taskId;
      card.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggedId);
    });
    document.addEventListener("dragend", (event) => {
      event.target.closest(".task-card")?.classList.remove("is-dragging");
      $$(".column.is-over").forEach((column) => column.classList.remove("is-over"));
      draggedId = null;
    });
    $$(".column").forEach((column) => {
      column.addEventListener("dragover", (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; column.classList.add("is-over"); });
      column.addEventListener("dragleave", (event) => { if (!column.contains(event.relatedTarget)) column.classList.remove("is-over"); });
      column.addEventListener("drop", (event) => {
        event.preventDefault();
        column.classList.remove("is-over");
        const id = event.dataTransfer.getData("text/plain") || draggedId;
        const task = tasks.find((item) => item.id === id);
        if (!task || !statuses.includes(column.dataset.status)) return;
        task.status = column.dataset.status;
        task.sample = false;
        task.updatedAt = new Date().toISOString();
        saveTasks();
        render();
        showToast(`Moved to ${statusLabels[task.status]}.`);
      });
    });
  }

  $("#add-task").addEventListener("click", () => openDialog());
  themeToggle.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true));
  $$(".quick-add, .add-column-task").forEach((button) => button.addEventListener("click", () => openDialog(null, button.dataset.status)));
  $$(".close-dialog").forEach((button) => button.addEventListener("click", closeDialog));
  dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(); });
  dialog.addEventListener("close", () => { $("#add-task").focus(); });
  form.addEventListener("submit", onSubmit);
  form.elements.title.addEventListener("input", () => { if (form.elements.title.value.trim()) $("#title-error").textContent = ""; });
  searchInput.addEventListener("input", render);
  priorityFilter.addEventListener("change", render);
  document.addEventListener("click", (event) => {
    handleCardClick(event);
    if (!event.target.closest(".card-menu")) $$(".card-actions").forEach((menu) => { menu.hidden = true; menu.parentElement.querySelector("button").setAttribute("aria-expanded", "false"); });
  });
  document.addEventListener("keydown", handleCardKeydown);
  document.addEventListener("keydown", (event) => {
    if (dialog.open || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.toLowerCase() === "n" && !["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) { event.preventDefault(); openDialog(); }
    if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) { event.preventDefault(); searchInput.focus(); }
  });
  setupDragDrop();
  render();
})();
