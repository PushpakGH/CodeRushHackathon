(() => {
  'use strict';

  const supabaseConfig = window.VIBECREW_SUPABASE;
  let db = null;
  try {
    if (window.supabase?.createClient && supabaseConfig?.url && supabaseConfig?.publishableKey) {
      db = window.supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    }
  } catch (error) {
    console.error('VibeCrew could not initialize Supabase.', error);
  }
  let liveMode = false;
  let currentUser = null;
  let currentRole = 'member';
  let currentMembership = null;
  let activeWorkspace = null;
  let activeProject = null;
  let activeMembers = [];
  let pollTimer = null;
  let pollInFlight = false;

  const projectRevision = { value: 7 };
  let tasks = [
    { id: 'VBC-014', title: 'Implement first-run environment check', description: 'Detect required variables and return a readable setup result before the app starts.', status: 'IN_PROGRESS', priority: 'P0', owner: 'Mina Patel', scope: ['src/setup/checks.ts'], dependencies: ['VBC-011'], acceptance: 'Missing configuration is listed by name; valid setup passes without printing secret values.', testPlan: 'Unit tests for missing, blank, and valid values; verify values are never included in errors.', branch: 'feat/VBC-014-env-check', contextRevisionSeen: 6 },
    { id: 'VBC-015', title: 'Define the setup configuration contract', description: 'Agree the validated environment shape shared by the CLI and setup screen.', status: 'READY', priority: 'P0', owner: 'Unassigned', scope: ['src/contracts/setup-config.ts'], dependencies: ['VBC-014'], acceptance: 'One versioned schema is referenced by both entry points.', testPlan: 'Type check and reject unknown/malformed fields.', branch: 'feat/VBC-015-setup-contract', contextRevisionSeen: 7 },
    { id: 'VBC-016', title: 'Add retryable setup guidance', description: 'Replace raw bootstrap errors with a short recovery action and next step.', status: 'IN_REVIEW', priority: 'P1', owner: 'Theo Park', scope: ['src/setup/'], dependencies: ['VBC-012'], acceptance: 'Transient network errors offer a retry and preserve the entered non-secret choices.', testPlan: 'Manual timeout/retry check; confirm passwords and tokens are not echoed.', branch: 'feat/VBC-016-retry-guidance', contextRevisionSeen: 7 },
    { id: 'VBC-017', title: 'Map the first-run onboarding journey', description: 'Document the happy path plus offline, missing-variable, and permission-denied states.', status: 'READY', priority: 'P1', owner: 'Jordan Reyes', scope: ['docs/onboarding/first-run.md'], dependencies: [], acceptance: 'New contributors can reach a green setup check from the README alone.', testPlan: 'Follow the guide in a clean clone and record unclear steps.', branch: 'docs/VBC-017-first-run', contextRevisionSeen: 7 },
    { id: 'VBC-018', title: 'Explain missing variable hints', description: 'Show where each required setting comes from without exposing its value.', status: 'BLOCKED', priority: 'P1', owner: 'Casey Wu', scope: ['src/setup/'], dependencies: ['VBC-014'], acceptance: 'Each missing key has a safe source hint and a link to local setup docs.', testPlan: 'Review rendered errors with empty, malformed, and correctly configured values.', branch: 'feat/VBC-018-env-hints', contextRevisionSeen: 6 },
    { id: 'VBC-019', title: 'Add a clean-clone handoff checklist', description: 'Summarize the verified local setup and the first contribution path.', status: 'DONE', priority: 'P2', owner: 'Theo Park', scope: ['docs/contributing/hand-off.md'], dependencies: ['VBC-017'], acceptance: 'Checklist names the actual checks and their result.', testPlan: 'Review against the repository scripts before marking done.', branch: 'docs/VBC-019-handoff', contextRevisionSeen: 7 }
  ];

  let decisions = [
    { id: 'ADR-001', status: 'ACCEPTED', title: 'Supabase is the shared source of truth', context: 'Contributors work in separate clones, so a browser-local store cannot coordinate task ownership or context revisions.', decision: 'Use one hosted Postgres project with Supabase Auth and row-level security. All workspace-owned queries must prove membership in policy or an authorized server function.', consequence: 'The public client key is usable only with RLS enabled. Never ship service-role credentials to the browser. Realtime is optional; begin with bounded polling.', author: 'Jordan Reyes', version: 2 },
    { id: 'ADR-002', status: 'ACCEPTED', title: 'GitHub remains the code source of truth', context: 'The team needs to track PR state without confusing a coordination record for repository authority.', decision: 'Record branch and PR metadata in VibeCrew; review, CI, commits, merge, and history continue in GitHub unless a separately authorized and verified integration is added.', consequence: 'No automatic merge or GitHub write integration is implied by this MVP.', author: 'Jordan Reyes', version: 1 },
    { id: 'ADR-003', status: 'PROPOSED', title: 'Claim tasks with a conditional database update', context: 'Two contributors may attempt to claim the same ready task at almost the same time.', decision: 'Claim only when the task remains unassigned and in a claimable state; return a conflict to the losing request. Enforce membership and role in the same trusted boundary.', consequence: 'Atomicity and the two-session claim race must be verified against the chosen database before this is marked accepted.', author: 'Mina Patel', version: 1 }
  ];

  let people = [
    { name: 'Jordan Reyes', initials: 'JR', role: 'OWNER', focus: 'Product scope & release', agent: 'Codex · local', tone: 1, lastSeen: 'Preview identity' },
    { name: 'Mina Patel', initials: 'MP', role: 'LEAD', focus: 'Setup architecture', agent: 'Cursor · local', tone: 2, lastSeen: 'Preview identity' },
    { name: 'Theo Park', initials: 'TP', role: 'REVIEWER', focus: 'Recovery & review', agent: 'Claude Code · local', tone: 3, lastSeen: 'Preview identity' },
    { name: 'Casey Wu', initials: 'CW', role: 'MEMBER', focus: 'Configuration checks', agent: 'Codex · local', tone: 4, lastSeen: 'Preview identity' }
  ];

  let activities = [
    { icon: '↗', actor: 'Mina Patel', action: 'started work on', target: 'VBC-014 · Environment check', time: '6m ago' },
    { icon: '⌘', actor: 'Jordan Reyes', action: 'accepted', target: 'ADR-002 · GitHub is code source of truth', time: '22m ago' },
    { icon: '▤', actor: 'Theo Park', action: 'moved', target: 'VBC-016 · Retryable setup guidance to review', time: '48m ago' }
  ];

  let releaseChecks = [
    { id: 'build', title: 'Production build succeeds', detail: 'Capture command and output', status: 'NOT_TESTED' },
    { id: 'journey', title: 'Critical user journey works', detail: 'Workspace → task → context → progress', status: 'NOT_TESTED' },
    { id: 'isolation', title: 'Workspace access is isolated', detail: 'Verify a different member cannot read this workspace', status: 'NOT_TESTED' },
    { id: 'claim', title: 'Concurrent task claim is safe', detail: 'Only one simultaneous claim can win', status: 'NOT_TESTED' },
    { id: 'mobile', title: 'Phone layout is usable', detail: 'Check navigation, board, and context export', status: 'NOT_TESTED' },
    { id: 'deploy', title: 'Preview deployment is smoke-tested', detail: 'URL loads and the primary flow is checked', status: 'NOT_TESTED' },
    { id: 'handoff', title: 'Limitations and demo handoff are clear', detail: 'Name unverified capabilities and next steps', status: 'NOT_TESTED' }
  ];

  const statusGroups = [
    { key: 'READY', label: 'Ready', className: '' },
    { key: 'IN_PROGRESS', label: 'In progress', className: 'doing', matches: ['CLAIMED', 'IN_PROGRESS', 'BLOCKED'] },
    { key: 'IN_REVIEW', label: 'In review', className: 'review' },
    { key: 'DONE', label: 'Done', className: 'done' }
  ];
  const statusOptions = [
    ['READY', 'Ready'], ['CLAIMED', 'Claimed'], ['IN_PROGRESS', 'In progress'], ['BLOCKED', 'Blocked'], ['IN_REVIEW', 'In review'], ['DONE', 'Done']
  ];

  const previewSeed = JSON.parse(JSON.stringify({ tasks, decisions, people, activities, releaseChecks }));
  const taskSortPriority = { P0: 0, P1: 1, P2: 2 };
  const humanizeRole = role => String(role || 'member').toUpperCase();
  function sessionGet(key) { try { return sessionStorage.getItem(key) || ''; } catch { return ''; } }
  function sessionSet(key, value) { try { sessionStorage.setItem(key, value); return true; } catch { return false; } }
  function sessionRemove(key) { try { sessionStorage.removeItem(key); } catch { /* Continue without session storage. */ } }
  const currentName = () => currentMembership?.display_name || sessionGet('vibecrew_pending_name') || currentUser?.user_metadata?.display_name || currentUser?.email?.split('@')[0] || 'Teammate';
  const initialsFor = name => {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : (parts[0]?.slice(0, 2) || '?').toUpperCase();
  };
  const friendlyError = error => {
    const message = String(error?.message || '').replace(/\s+/g, ' ').trim();
    const details = `${error?.code || ''} ${error?.name || ''} ${message}`.toLowerCase();
    if (details.includes('over_email_send_rate_limit') || details.includes('email rate limit exceeded')) {
      return 'Supabase has reached its built-in email limit (2 emails per hour for the whole project). Stop retrying and wait for the quota to recover. To let all teammates sign in, the project owner needs to configure a custom SMTP provider in Supabase Authentication settings, then set a suitable email limit.';
    }
    if (details.includes('email_address_not_authorized')) {
      return 'Supabase’s built-in email sender only delivers to authorized organization members. The project owner needs to configure custom SMTP before teammates can receive sign-in links.';
    }
    if (details.includes('over_request_rate_limit')) {
      return 'Supabase temporarily rate-limited sign-in requests from this network. Pause for a few minutes, then request one link. If it continues, ask the project owner to inspect Auth logs; do not keep retrying.';
    }
    return message ? message.slice(0, 220) : 'The request could not be completed. Check your connection and try again.';
  };

  function inviteErrorGuidance(error) {
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('vc_can_manage_workspace') && message.includes('does not exist')) {
      return 'The invite service was out of sync with the database. Its repair is deployed; refresh this page and try again. If it repeats, share this message with the project owner.';
    }
    if (message.includes('workspace manager access required') || error?.code === '42501') {
      return 'Only a workspace Owner or Lead can create invitations. Choose a workspace you manage, or ask its Owner/Lead to create the link.';
    }
    if (message.includes('invalid invitation request')) {
      return 'Choose Member or Reviewer, then try again. If the role selector is already set, refresh the page and retry.';
    }
    if (/fetch|network|timeout|offline/.test(message)) {
      return 'Check your internet connection, keep this page open, then try again. No link was created until the success message appears.';
    }
    return `${friendlyError(error)} Next: confirm you are an Owner or Lead in the intended workspace, refresh the page, and retry. If it still fails, copy this full message to the workspace owner.`;
  }

  function setAuthMessage(target, message, isError = false) {
    const node = $(target);
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('is-error', isError);
  }

  function showSignIn(message = '') {
    $('#app-shell').hidden = true;
    $('#auth-screen').hidden = false;
    $('#signin-panel').hidden = false;
    $('#workspace-panel').hidden = true;
    setAuthMessage('#auth-message', message);
  }

  function showWorkspaceSetup(message = '') {
    $('#app-shell').hidden = true;
    $('#auth-screen').hidden = false;
    $('#signin-panel').hidden = true;
    $('#workspace-panel').hidden = false;
    const name = currentName();
    $('#workspace-display-name').value = name;
    $('#join-display-name').value = name;
    const token = sessionGet('vibecrew_pending_invite');
    if (token) $('#join-token-input').value = token;
    setAuthMessage('#workspace-message', message);
  }

  function updateConnectedIdentity() {
    if (!liveMode || !activeWorkspace || !activeProject) return;
    $('#workspace-name-label').textContent = activeWorkspace.name;
    $('#project-name-label').textContent = activeProject.name;
    $('#project-stage-label').textContent = activeProject.lifecycle_stage;
    $('#breadcrumb-workspace').textContent = activeWorkspace.name;
    $('#breadcrumb-project').textContent = activeProject.name;
    $('#project-data-label').textContent = 'LIVE TEAM DATA';
    $('#project-objective-label').textContent = activeProject.objective || `A shared engineering workspace for ${activeProject.name}. Add the next clear outcome with your team.`;
    $('#connection-chip').innerHTML = '<span></span> LIVE SYNC';
    $('#connection-chip').classList.add('is-connected');
    $('#connection-notice').classList.add('is-connected');
    $('#connection-notice-copy').innerHTML = '<strong>Shared workspace.</strong> Tasks, decisions, team members, and release checks are stored remotely. Updates refresh every five seconds.';
    $('#connection-dialog-copy').textContent = 'This workspace is connected to Supabase. Every read and write is scoped to signed-in workspace membership; the database rejects unauthorized operations.';
    $('#profile-name').textContent = currentMembership?.display_name || currentName();
    $('#profile-role').textContent = `${humanizeRole(currentRole)} · SIGNED IN`;
    $$('.avatar-user').forEach(node => { node.textContent = initialsFor(currentMembership?.display_name || currentName()); });
    $('.top-avatar').setAttribute('aria-label', `Sign out ${currentMembership?.display_name || currentName()}`);
    $('#connection-notice .notice-action').textContent = 'Access details';
    $('#connection-notice .notice-action').insertAdjacentHTML('beforeend', ' <span aria-hidden="true">↗</span>');
    $('#task-modal-subtitle').textContent = 'Create a shared task with an owner, acceptance criteria, and declared paths.';
    $('#task-form button[type="submit"]').textContent = 'Save task';
  }

  function updateTaskOwnerOptions() {
    const select = $('#task-owner-input');
    const previous = select.value;
    select.replaceChildren();
    const unassigned = document.createElement('option');
    unassigned.value = '';
    unassigned.textContent = 'Unassigned';
    select.append(unassigned);
    people.forEach(person => {
      const option = document.createElement('option');
      option.value = liveMode ? person.user_id : person.name;
      option.textContent = person.name;
      select.append(option);
    });
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  }

  async function hashInviteToken(token) {
    if (!window.crypto?.subtle) throw new Error('Invitation links require a secure browser context (HTTPS or localhost).');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function captureInviteToken() {
    const url = new URL(location.href);
    const token = url.searchParams.get('invite');
    if (token && /^[a-f0-9]{64}$/i.test(token)) {
      sessionSet('vibecrew_pending_invite', token.toLowerCase());
      url.searchParams.delete('invite');
      history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }

  function enterPreview() {
    liveMode = false;
    currentUser = null;
    currentRole = 'member';
    currentMembership = null;
    activeWorkspace = null;
    activeProject = null;
    tasks = JSON.parse(JSON.stringify(previewSeed.tasks));
    decisions = JSON.parse(JSON.stringify(previewSeed.decisions));
    people = JSON.parse(JSON.stringify(previewSeed.people));
    activities = JSON.parse(JSON.stringify(previewSeed.activities));
    releaseChecks = JSON.parse(JSON.stringify(previewSeed.releaseChecks));
    projectRevision.value = 7;
    $('#workspace-name-label').textContent = 'Morrow Studio';
    $('#project-name-label').textContent = 'Orbit onboarding';
    $('#project-stage-label').textContent = 'Implementation';
    $('#breadcrumb-workspace').textContent = 'Morrow Studio';
    $('#breadcrumb-project').textContent = 'Orbit onboarding';
    $('#project-data-label').textContent = 'SYNTHETIC DEMO';
    $('#project-objective-label').textContent = 'One accepted plan for the people and agents building Orbit together.';
    $('#connection-chip').innerHTML = '<span></span> PREVIEW DATA';
    $('#connection-chip').classList.remove('is-connected');
    $('#connection-notice').classList.remove('is-connected');
    $('#connection-notice-copy').innerHTML = '<strong>Preview session.</strong> Sample workspace data is synthetic; edits reset when you reload. Shared accounts and sync use the connected Supabase project.';
    $('#profile-name').textContent = 'Jordan Reyes';
    $('#profile-role').textContent = 'OWNER · PREVIEW USER';
    $$('.avatar-user').forEach(node => { node.textContent = 'JR'; });
    $('.top-avatar').setAttribute('aria-label', 'Preview user Jordan Reyes');
    $('#connection-notice .notice-action').textContent = 'Setup details';
    $('#connection-notice .notice-action').insertAdjacentHTML('beforeend', ' <span aria-hidden="true">↗</span>');
    $('#task-modal-subtitle').textContent = 'Preview changes stay in this browser session and reset on reload.';
    $('#task-form button[type="submit"]').textContent = 'Add to preview';
    $('#agent-connect-status').innerHTML = '<span></span> SIGN IN REQUIRED';
    $('#agent-connect-status').classList.remove('is-connected');
    $('#agent-token-form button[type="submit"]').disabled = true;
    $('#agent-token-label').disabled = true;
    $('#agent-token-expiry').disabled = true;
    $('#agent-mcp-project-id').value = 'Sign in to reveal the project ID';
    $('[data-action="copy-agent-project-id"]').disabled = true;
    $('#agent-mcp-endpoint').value = 'Sign in to reveal this workspace endpoint';
    $$('[data-action="new-decision"]').forEach(button => { button.hidden = true; });
    $('#auth-screen').hidden = true;
    $('#app-shell').hidden = false;
    updateTaskOwnerOptions();
    renderAll();
    renderActivity($('#team-activity-list'));
    const initialRoute = location.hash.slice(1);
    navigate($(`[data-view="${initialRoute}"]`) ? initialRoute : 'overview');
  }

  async function listWorkspaceMemberships() {
    const { data, error } = await db.from('workspace_members')
      .select('workspace_id, user_id, display_name, role')
      .eq('user_id', currentUser.id);
    if (error) throw error;
    return data || [];
  }

  async function handleAuthenticatedSession(session) {
    currentUser = session?.user || null;
    if (!currentUser) {
      currentMembership = null;
      activeWorkspace = null;
      activeProject = null;
      showSignIn('You are signed out. Enter your email to get a fresh sign-in link.');
      return;
    }
    setAuthMessage('#auth-message', 'Checking workspace access…');
    const pendingInvite = sessionGet('vibecrew_pending_invite');
    if (pendingInvite) {
      showWorkspaceSetup('Accept the invitation by choosing a display name, then select Join workspace.');
      return;
    }
    try {
      const memberships = await listWorkspaceMemberships();
      if (!memberships.length) {
        showWorkspaceSetup('Create a shared workspace or join your team with an invitation link.');
        return;
      }
      const workspaceRows = await db.from('workspaces').select('id, name').in('id', memberships.map(row => row.workspace_id));
      if (workspaceRows.error) throw workspaceRows.error;
      const entries = (workspaceRows.data || []).map(workspace => ({
        ...workspace,
        membership: memberships.find(item => item.workspace_id === workspace.id)
      }));
      if (entries.length === 1) {
        await loadWorkspace(entries[0].id, null, entries[0].membership);
        return;
      }
      showWorkspaceSetup('Choose a workspace, or create another one.');
      renderWorkspaceOptions(entries);
    } catch (error) {
      showSignIn(`Could not check workspace access: ${friendlyError(error)}`);
    }
  }

  function renderWorkspaceOptions(entries) {
    const container = $('#existing-workspaces');
    container.replaceChildren();
    if (!entries.length) { container.hidden = true; return; }
    container.hidden = false;
    const label = document.createElement('strong');
    label.textContent = 'Your workspaces';
    container.append(label);
    entries.forEach(entry => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button button-outline';
      button.dataset.workspaceSelect = entry.id;
      button.textContent = `${entry.name} · ${humanizeRole(entry.membership?.role)}`;
      button.addEventListener('click', () => loadWorkspace(entry.id, null, entry.membership));
      container.append(button);
    });
  }

  async function loadWorkspace(workspaceId, preferredProjectId = null, membership = null, silent = false) {
    if (!db || !currentUser) return;
    if (!silent) showWorkspaceSetup('Loading shared project data…');
    try {
      const [workspaceResult, projectResult, memberResult] = await Promise.all([
        db.from('workspaces').select('*').eq('id', workspaceId).single(),
        db.from('projects').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: true }),
        db.from('workspace_members').select('*').eq('workspace_id', workspaceId).order('joined_at', { ascending: true })
      ]);
      if (workspaceResult.error) throw workspaceResult.error;
      if (projectResult.error) throw projectResult.error;
      if (memberResult.error) throw memberResult.error;
      activeWorkspace = workspaceResult.data;
      activeMembers = memberResult.data || [];
      currentMembership = membership || activeMembers.find(member => member.user_id === currentUser.id);
      if (!currentMembership) throw new Error('Your workspace membership could not be confirmed.');
      currentRole = currentMembership.role;
      const projectRows = projectResult.data || [];
      activeProject = projectRows.find(project => project.id === preferredProjectId) || projectRows[0];
      if (!activeProject) throw new Error('This workspace has no active project.');
      const projectId = activeProject.id;
      const [taskResult, decisionResult, activityResult, checkResult] = await Promise.all([
        db.from('tasks').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
        db.from('architecture_decisions').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
        db.from('activity_events').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(50),
        // release_checks has updated_at (not created_at) in the deployed schema.
        db.from('release_checks').select('*').eq('project_id', projectId).order('updated_at', { ascending: true })
      ]);
      for (const result of [taskResult, decisionResult, activityResult, checkResult]) if (result.error) throw result.error;

      const memberById = new Map(activeMembers.map(member => [member.user_id, member]));
      people = activeMembers.map((member, index) => ({
        user_id: member.user_id,
        name: member.display_name,
        initials: initialsFor(member.display_name),
        role: humanizeRole(member.role),
        focus: 'Workspace member',
        agent: 'Local environment',
        tone: index % 5,
        lastSeen: member.user_id === currentUser.id ? 'Signed in now' : 'Workspace member'
      }));
      tasks = (taskResult.data || []).map(row => ({
        databaseId: row.id,
        version: row.version,
        id: row.task_key,
        title: row.title,
        description: row.description,
        status: row.status,
        priority: row.priority,
        ownerId: row.owner_id,
        owner: row.owner_id ? (memberById.get(row.owner_id)?.display_name || 'Former member') : 'Unassigned',
        scope: row.scope || [],
        dependencies: row.dependencies || [],
        acceptance: row.acceptance,
        testPlan: row.test_plan,
        branch: row.branch,
        prUrl: row.pr_url,
        contextRevisionSeen: row.context_revision_seen,
        createdAt: row.created_at
      }));
      decisions = (decisionResult.data || []).map(row => ({
        databaseId: row.id,
        version: row.version,
        id: row.decision_key,
        title: row.title,
        context: row.context,
        decision: row.decision,
        consequence: row.consequence,
        status: row.status,
        author: memberById.get(row.author_id)?.display_name || 'Former member',
        authorId: row.author_id
      }));
      activities = (activityResult.data || []).map(row => ({
        actor: memberById.get(row.actor_id)?.display_name || 'Team member',
        action: '',
        target: row.summary,
        summary: row.summary,
        icon: row.event_type === 'decision_accepted' ? '⌘' : row.event_type === 'task_created' ? '＋' : '↗',
        time: relativeTime(row.created_at)
      }));
      releaseChecks = (checkResult.data || []).map(row => ({
        databaseId: row.id,
        id: row.check_key,
        title: row.title,
        detail: row.detail,
        status: row.status,
        evidence: row.evidence,
        updatedBy: row.updated_by
      }));
      projectRevision.value = activeProject.context_revision;
      generatedTaskId = tasks.some(task => task.id === generatedTaskId) ? generatedTaskId : (tasks[0]?.id || '');
      dismissOverlap = false;
      liveMode = true;
      updateConnectedIdentity();
      updateTaskOwnerOptions();
      $('#auth-screen').hidden = true;
      $('#app-shell').hidden = false;
      renderAll();
      renderActivity($('#team-activity-list'));
      updateWorkspaceSummary();
      if (!silent) loadAgentTokens();
      if (!silent) {
        startPolling();
        const initialRoute = location.hash.slice(1);
        navigate($(`[data-view="${initialRoute}"]`) ? initialRoute : 'overview');
      }
    } catch (error) {
      if (silent) {
        $('#connection-notice-copy').innerHTML = '<strong>Sync needs attention.</strong> The last loaded data remains visible. Check the connection before making changes.';
        showToast(`Sync paused: ${friendlyError(error)}`);
      } else showWorkspaceSetup(`Could not load this workspace: ${friendlyError(error)}`);
    }
  }

  function relativeTime(value) {
    if (!value) return 'recently';
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function updateWorkspaceSummary() {
    const teamCount = activeMembers.length;
    const teamBand = $('.team-header-band');
    if (teamBand) {
      teamBand.querySelector('strong').innerHTML = `${teamCount.toString().padStart(2, '0')} <small>signed-in members</small>`;
      teamBand.querySelector('p').textContent = 'Each member uses their own local editor and coding agent. VibeCrew stores only shared project coordination data.';
      teamBand.querySelector('.preview-chip').innerHTML = '<span></span> MEMBERSHIP CHECKED';
    }
    const decisionCount = $('.decision-count');
    if (decisionCount) decisionCount.textContent = String(decisions.length).padStart(2, '0');
    const decisionSummary = $('.decision-summary p');
    if (decisionSummary) {
      decisionSummary.querySelector('strong').textContent = `${decisions.length} decision${decisions.length === 1 ? '' : 's'} recorded`;
      decisionSummary.querySelector('span').textContent = `${decisions.filter(item => item.status === 'ACCEPTED').length} accepted · ${decisions.filter(item => item.status === 'PROPOSED').length} proposed · shared workspace data`;
    }
    const notice = $('.notice-inline p');
    if (notice) notice.textContent = 'Only workspace owners and leads can accept decisions. The database checks permission and advances the shared context revision.';
    const contextNote = $('.context-control-note');
    if (contextNote) contextNote.textContent = 'Generated from the current shared project state. Refresh to include newly accepted decisions.';
    const footer = $('.app-footer span:last-child');
    if (footer) footer.textContent = 'SUPABASE · MEMBER-SCOPED DATA · 5-SECOND REFRESH';
    const teamActivityNote = $('.team-activity .activity-note');
    if (teamActivityNote) teamActivityNote.textContent = 'Shared activity · refreshes every 5s';
    const teamActivityEyebrow = $('.team-activity .eyebrow-small');
    if (teamActivityEyebrow) teamActivityEyebrow.textContent = 'AUDIT TRAIL · SHARED EVENTS';
    const teamEyebrow = $('[data-view="team"] .page-head .eyebrow');
    if (teamEyebrow) teamEyebrow.innerHTML = '<span class="eyebrow-line"></span> COLLABORATION · VERIFIED MEMBERS';
    const roleNoteEyebrow = $('.role-note .eyebrow-small');
    if (roleNoteEyebrow) roleNoteEyebrow.textContent = 'ROLE BOUNDARIES — SERVER ENFORCED';
    const agentStatus = $('#agent-connect-status');
    if (agentStatus) {
      agentStatus.innerHTML = '<span></span> WORKSPACE SCOPED';
      agentStatus.classList.add('is-connected');
    }
    $('#agent-token-form button[type="submit"]').disabled = !liveMode;
    $('#agent-token-label').disabled = !liveMode;
    $('#agent-token-expiry').disabled = !liveMode;
    $('#agent-mcp-endpoint').value = supabaseConfig?.url ? `${supabaseConfig.url.replace(/\/$/, '')}/functions/v1/vibecrew-mcp` : 'MCP endpoint is not configured';
    $('#agent-mcp-project-id').value = activeProject?.id || 'No project selected';
    $('[data-action="copy-agent-project-id"]').disabled = !activeProject?.id;
    const teamAction = $('[data-view="team"] .page-head [data-action]');
    if (teamAction) {
      teamAction.textContent = currentRole === 'owner' || currentRole === 'lead' ? 'Invite teammate' : 'Request an invite from a lead';
      teamAction.dataset.action = currentRole === 'owner' || currentRole === 'lead' ? 'create-invite' : 'show-connection';
    }
    const canManage = ['owner', 'lead'].includes(currentRole);
    $$('[data-action="new-task"], [data-action="new-decision"]').forEach(button => { button.hidden = !canManage; });
    $('#release-items').dataset.editable = canManage ? 'true' : 'false';
    updateTaskOwnerOptions();
  }

  async function bootBackend() {
    try { captureInviteToken(); } catch { /* session storage may be blocked */ }
    if (!db) {
      enterPreview();
      return;
    }
    $('#auth-screen').hidden = false;
    $('#app-shell').hidden = true;
    $('#auth-message').textContent = 'Checking your sign-in…';
    db.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      window.setTimeout(() => {
        if (!session) {
          stopPolling();
          showSignIn('You are signed out. Enter your email to continue.');
        } else {
          handleAuthenticatedSession(session);
        }
      }, 0);
    });
    const { data, error } = await db.auth.getSession();
    if (error) {
      showSignIn(`Could not check sign-in: ${friendlyError(error)}`);
      return;
    }
    if (data?.session) await handleAuthenticatedSession(data.session);
    else showSignIn('');
  }

  function startPolling() {
    stopPolling();
    pollTimer = window.setInterval(refreshWorkspace, 5000);
  }

  async function refreshWorkspace() {
    if (!liveMode || !activeWorkspace || !activeProject || pollInFlight || document.visibilityState === 'hidden') return;
    pollInFlight = true;
    try { await loadWorkspace(activeWorkspace.id, activeProject.id, currentMembership, true); }
    finally { pollInFlight = false; }
  }

  function stopPolling() {
    if (pollTimer) window.clearInterval(pollTimer);
    pollTimer = null;
  }

  window.addEventListener('online', refreshWorkspace);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshWorkspace();
  });

  let filter = 'all';
  let searchTerm = '';
  let generatedTaskId = 'VBC-014';
  let toastTimer;
  let dismissOverlap = false;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const personTone = name => Math.max(0, people.findIndex(person => person.name === name)) % 5;
  const isActive = task => ['CLAIMED', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW'].includes(task.status);
  const isStale = task => task.contextRevisionSeen < projectRevision.value;
  const canManageProject = () => ['owner', 'lead'].includes(currentRole);
  const canReviewTasks = () => ['owner', 'lead', 'reviewer'].includes(currentRole);
  const canEditTask = task => !liveMode || canReviewTasks() || task.ownerId === currentUser?.id;
  const statusLabel = status => ({ BACKLOG: 'Backlog', READY: 'Ready', CLAIMED: 'Claimed', IN_PROGRESS: 'In progress', BLOCKED: 'Blocked', IN_REVIEW: 'In review', DONE: 'Done' }[status] || status);
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function normalizePath(path) {
    return path.trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\.\//, '').replace(/\/$/, '').toLowerCase();
  }

  function getOverlaps() {
    const entries = [];
    tasks.filter(isActive).forEach(task => task.scope.forEach(path => entries.push({ path: normalizePath(path), display: path, task })));
    const overlaps = [];
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const a = entries[i];
        const b = entries[j];
        if (a.task.id === b.task.id || !a.path || !b.path) continue;
        const sameOrChild = a.path === b.path || a.path.startsWith(`${b.path}/`) || b.path.startsWith(`${a.path}/`);
        if (sameOrChild) overlaps.push({ a, b });
      }
    }
    return overlaps;
  }

  function renderRevision() {
    $$('[data-project-revision]').forEach(node => { node.textContent = `r${String(projectRevision.value).padStart(2, '0')}`; });
    const selected = tasks.find(task => task.id === generatedTaskId);
    $('#context-stale-banner').hidden = !selected || !isStale(selected);
    $('.context-preview-foot b').textContent = `r${String(projectRevision.value).padStart(2, '0')}`;
  }

  function avatar(initials, tone, extraClass = '') {
    const span = document.createElement('span');
    span.className = `tiny-avatar tone-${tone} ${extraClass}`.trim();
    span.textContent = initials;
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  function createTaskRow(task) {
    const row = document.createElement('article');
    row.className = `task-row ${task.status === 'DONE' ? 'is-done' : ''}`;
    const check = document.createElement('button');
    check.className = 'task-check';
    check.type = 'button';
    check.dataset.action = 'complete-task';
    check.dataset.taskId = task.id;
    check.setAttribute('aria-label', task.status === 'DONE' ? `Mark ${task.title} ready` : `Mark ${task.title} complete`);
    check.disabled = liveMode && !canEditTask(task);
    check.textContent = task.status === 'DONE' ? '✓' : '';
    row.append(check);

    const copy = document.createElement('div');
    copy.className = 'task-row-copy';
    const title = document.createElement('span');
    title.className = 'task-row-title';
    title.textContent = task.title;
    copy.append(title);
    const meta = document.createElement('span');
    meta.className = 'task-row-meta';
    const id = document.createElement('span');
    id.className = 'task-id'; id.textContent = task.id;
    const priority = document.createElement('span');
    priority.className = `priority priority-${task.priority.toLowerCase()}`; priority.textContent = task.priority;
    const status = document.createElement('span'); status.textContent = statusLabel(task.status);
    meta.append(id, priority, status);
    if (isStale(task)) { const stale = document.createElement('span'); stale.className = 'stale-tag'; stale.textContent = 'STALE CONTEXT'; meta.append(stale); }
    copy.append(meta); row.append(copy);

    const owner = document.createElement('span'); owner.className = 'task-owner';
    const person = people.find(member => member.name === task.owner);
    if (person) owner.append(avatar(person.initials, person.tone));
    else owner.append(avatar('—', 0));
    const ownerLabel = document.createElement('span'); ownerLabel.textContent = task.owner === 'Unassigned' ? 'Unassigned' : task.owner.split(' ')[0]; owner.append(ownerLabel);
    row.append(owner);
    return row;
  }

  function renderOverview() {
    const list = $('#overview-task-list');
    list.replaceChildren();
    const chosen = tasks.filter(task => task.status !== 'DONE').slice(0, 4);
    chosen.forEach(task => list.append(createTaskRow(task)));
    if (!chosen.length) list.append(emptyMessage('Nothing in motion yet. Create a task to start the queue.'));
    const active = tasks.filter(isActive).length;
    $('#signal-active').innerHTML = `${String(active).padStart(2, '0')} <small>/ ${String(tasks.length).padStart(2, '0')}</small>`;
    $('#signal-overlaps').textContent = String(getOverlaps().length).padStart(2, '0');
    $('#nav-task-count').textContent = String(tasks.length);
    renderContextSync();
    renderActivity($('#overview-activity-list'), 3);
    renderRevision();
  }

  function renderContextSync() {
    const container = $('#context-sync-list');
    container.replaceChildren();
    const byOwner = new Map();
    tasks.filter(task => task.owner !== 'Unassigned' && isActive(task)).forEach(task => {
      if (!byOwner.has(task.owner)) byOwner.set(task.owner, task);
    });
    tasks.filter(task => task.owner !== 'Unassigned' && !isActive(task) && task.status !== 'DONE').forEach(task => {
      if (!byOwner.has(task.owner)) byOwner.set(task.owner, task);
    });
    people.forEach(person => {
      const task = byOwner.get(person.name);
      const row = document.createElement('div'); row.className = 'sync-row';
      row.append(avatar(person.initials, person.tone));
      const label = document.createElement('span'); label.className = 'sync-person';
      const strong = document.createElement('strong'); strong.textContent = person.name;
      const small = document.createElement('small'); small.textContent = task ? `${task.id} · ${statusLabel(task.status)}` : 'No active assignment';
      label.append(strong, small); row.append(label);
      const state = document.createElement('span');
      state.className = `sync-state ${task && isStale(task) ? 'is-stale' : ''}`;
      state.textContent = task && isStale(task) ? 'STALE' : 'CURRENT'; row.append(state);
      container.append(row);
    });
  }

  function renderActivity(container, limit = Infinity) {
    container.replaceChildren();
    activities.slice(0, limit).forEach(item => {
      const row = document.createElement('div'); row.className = 'activity-row';
      const icon = document.createElement('span'); icon.className = 'activity-icon'; icon.textContent = item.icon; icon.setAttribute('aria-hidden', 'true');
      const copy = document.createElement('span'); copy.className = 'activity-copy';
      if (item.summary) copy.textContent = `${item.actor} · ${item.summary}`;
      else {
        const actor = document.createElement('strong'); actor.textContent = item.actor;
        const target = document.createElement('strong'); target.textContent = item.target;
        copy.append(actor, document.createTextNode(` ${item.action} `), target);
      }
      const time = document.createElement('span'); time.className = 'activity-time'; time.textContent = item.time;
      row.append(icon, copy, time); container.append(row);
    });
  }

  function emptyMessage(message) {
    const p = document.createElement('p'); p.className = 'empty-column'; p.textContent = message; return p;
  }

  function taskMatchesSearch(task) {
    if (!searchTerm) return true;
    const haystack = [task.id, task.title, task.description, task.owner, ...task.scope].join(' ').toLowerCase();
    return haystack.includes(searchTerm);
  }

  function taskNeedsAttention(task, overlaps) {
    return task.status === 'BLOCKED' || isStale(task) || overlaps.some(pair => pair.a.task.id === task.id || pair.b.task.id === task.id);
  }

  function renderTaskBoard() {
    const board = $('#task-board');
    board.replaceChildren();
    const overlaps = getOverlaps();
    const filtered = tasks.filter(task => taskMatchesSearch(task) && (filter === 'all' || taskNeedsAttention(task, overlaps)));
    $('#filter-count-all').textContent = String(tasks.length);
    $('#filter-count-attention').textContent = String(tasks.filter(task => taskNeedsAttention(task, overlaps)).length);
    $('#scope-warning').hidden = dismissOverlap || overlaps.length === 0;
    if (overlaps.length) {
      const pair = overlaps[0];
      const remaining = overlaps.length - 1;
      const suffix = remaining ? ` + ${remaining} more overlapping pair${remaining === 1 ? '' : 's'}.` : '';
      $('#scope-warning-title').textContent = `${overlaps.length} advisory path overlap${overlaps.length === 1 ? '' : 's'}`;
      $('#scope-warning-detail').textContent = `${pair.a.task.id} (${pair.a.task.owner}) declares ${pair.a.display}; ${pair.b.task.id} (${pair.b.task.owner}) declares ${pair.b.display}.${suffix} Coordinate before editing; this is not proof of a Git conflict.`;
    }

    statusGroups.forEach(group => {
      const matches = group.matches || [group.key];
      const groupTasks = filtered.filter(task => matches.includes(task.status)).sort((a, b) => (taskSortPriority[a.priority] ?? 9) - (taskSortPriority[b.priority] ?? 9) || a.id.localeCompare(b.id));
      const section = document.createElement('section'); section.className = 'board-column';
      section.setAttribute('aria-label', `${group.label}, ${groupTasks.length} tasks`);
      const heading = document.createElement('div'); heading.className = 'column-heading';
      const label = document.createElement('span');
      const marker = document.createElement('span'); marker.className = `column-marker ${group.className}`; marker.setAttribute('aria-hidden', 'true');
      label.append(marker, document.createTextNode(group.label));
      const count = document.createElement('span'); count.className = 'column-count'; count.textContent = String(groupTasks.length);
      heading.append(label, count); section.append(heading);
      if (!groupTasks.length) section.append(emptyMessage(searchTerm ? 'No tasks match this search.' : 'Nothing here yet.'));
      groupTasks.forEach(task => section.append(createBoardCard(task, overlaps)));
      board.append(section);
    });
    renderOverview();
  }

  function createBoardCard(task, overlaps) {
    const card = document.createElement('article'); card.className = `board-card ${task.status === 'DONE' ? 'is-done' : ''}`;
    const head = document.createElement('div'); head.className = 'board-card-head';
    const id = document.createElement('span'); id.className = 'task-id'; id.textContent = task.id;
    const priority = document.createElement('span'); priority.className = `priority priority-${task.priority.toLowerCase()}`; priority.textContent = task.priority;
    head.append(id, priority); card.append(head);
    const title = document.createElement('h3'); title.textContent = task.title; card.append(title);
    const description = document.createElement('p'); description.textContent = task.description; card.append(description);
    const path = task.scope[0] || 'No path declared';
    const scope = document.createElement('span');
    const isOverlap = overlaps.some(pair => pair.a.task.id === task.id || pair.b.task.id === task.id);
    scope.className = `scope-chip ${isOverlap ? 'overlap' : ''}`; scope.textContent = path; scope.title = task.scope.join('\n') || 'No file scope declared';
    card.append(scope);
    const foot = document.createElement('div'); foot.className = 'board-card-foot';
    const owner = document.createElement('span'); owner.className = 'owner-mini';
    const person = people.find(member => member.name === task.owner);
    owner.append(avatar(person?.initials || '—', person?.tone ?? 0));
    const ownerText = document.createElement('span'); ownerText.textContent = task.owner === 'Unassigned' ? 'Unassigned' : task.owner.split(' ')[0]; owner.append(ownerText);
    foot.append(owner);
    const select = document.createElement('select'); select.className = 'status-select'; select.dataset.taskStatus = task.id; select.setAttribute('aria-label', `Set status for ${task.title}`);
    statusOptions.forEach(([value, labelText]) => {
      const option = document.createElement('option'); option.value = value; option.textContent = labelText; option.selected = value === task.status;
      if (liveMode && !canReviewTasks() && task.ownerId !== currentUser?.id && !(task.ownerId === null && value === 'CLAIMED')) option.disabled = true;
      select.append(option);
    });
    foot.append(select); card.append(foot);
    if (isStale(task)) { const stale = document.createElement('span'); stale.className = 'stale-tag'; stale.textContent = 'CONTEXT STALE'; card.append(stale); }
    return card;
  }

  function renderDecisions() {
    const list = $('#decision-list'); list.replaceChildren();
    decisions.forEach(decision => {
      const card = document.createElement('article'); card.className = 'decision-card';
      const id = document.createElement('span'); id.className = 'adr-number'; id.textContent = decision.id;
      const body = document.createElement('div');
      const title = document.createElement('h2'); title.textContent = decision.title;
      const context = document.createElement('p'); context.className = 'decision-context'; context.textContent = decision.context;
      const detail = document.createElement('div'); detail.className = 'decision-body'; detail.textContent = decision.decision;
      const consequence = document.createElement('p'); consequence.className = 'decision-implications'; consequence.textContent = `Consequence · ${decision.consequence}`;
      const meta = document.createElement('p'); meta.className = 'decision-implications'; meta.textContent = `Proposed by ${decision.author} · version ${decision.version}`;
      body.append(title, context, detail, consequence, meta);
      if (decision.status === 'PROPOSED') {
        const actions = document.createElement('div'); actions.className = 'decision-actions';
        const accept = document.createElement('button'); accept.className = 'button button-primary'; accept.type = 'button'; accept.dataset.action = 'accept-decision'; accept.dataset.decisionId = decision.id; accept.textContent = liveMode ? 'Accept decision' : 'Accept in preview'; accept.disabled = liveMode && !canManageProject();
        actions.append(accept); body.append(actions);
      }
      const status = document.createElement('span'); status.className = `decision-status ${decision.status.toLowerCase()}`; status.textContent = decision.status;
      card.append(id, body, status); list.append(card);
    });
    if (!decisions.length) list.append(emptyMessage('No architecture decisions yet. Record the first trade-off your team needs to share.'));
  }

  function renderPeople() {
    const container = $('#member-list'); container.replaceChildren();
    const header = document.createElement('div'); header.className = 'member-head';
    ['MEMBER', 'ROLE', 'CURRENT FOCUS', liveMode ? 'LOCAL AGENT (NOT SHARED)' : 'LOCAL AGENT (EXAMPLE)'].forEach(label => { const span = document.createElement('span'); span.textContent = label; header.append(span); });
    container.append(header);
    people.forEach(person => {
      const row = document.createElement('div'); row.className = 'member-row';
      const identity = document.createElement('span'); identity.className = 'member-identity';
      identity.append(avatar(person.initials, person.tone));
      const names = document.createElement('span'); const strong = document.createElement('strong'); strong.textContent = person.name; const small = document.createElement('small'); small.textContent = person.lastSeen; names.append(strong, small); identity.append(names);
      const role = document.createElement('span'); const rolePill = document.createElement('span'); rolePill.className = 'role-pill'; rolePill.textContent = person.role; role.append(rolePill);
      const focus = document.createElement('span'); focus.textContent = person.focus;
      const agent = document.createElement('span'); agent.textContent = person.agent;
      row.append(identity, role, focus, agent); container.append(row);
    });
  }

  function renderRelease() {
    const container = $('#release-items'); container.replaceChildren();
    releaseChecks.forEach(check => {
      const row = document.createElement('div'); row.className = `release-row ${check.status === 'VERIFIED' ? 'is-verified' : check.status === 'FAILED' ? 'is-failed' : ''}`;
      const icon = document.createElement('span'); icon.className = 'release-state-icon'; icon.textContent = check.status === 'VERIFIED' ? '✓' : check.status === 'FAILED' ? '!' : '·';
      const copy = document.createElement('span'); const title = document.createElement('strong'); title.textContent = check.title; const detail = document.createElement('small'); detail.textContent = check.detail; copy.append(title, detail);
      const select = document.createElement('select'); select.className = 'release-select'; select.dataset.releaseCheck = check.id; select.setAttribute('aria-label', `Set release status for ${check.title}`);
      ['NOT_TESTED', 'VERIFIED', 'FAILED'].forEach(value => { const option = document.createElement('option'); option.value = value; option.textContent = value.replace('_', ' '); option.selected = value === check.status; select.append(option); });
      select.disabled = liveMode && !canManageProject();
      row.append(icon, copy, select); container.append(row);
    });
  }

  function buildContext(task) {
    const revision = `r${String(projectRevision.value).padStart(2, '0')}`;
    const accepted = decisions.filter(decision => decision.status === 'ACCEPTED');
    const overlapPairs = getOverlaps().filter(pair => pair.a.task.id === task.id || pair.b.task.id === task.id);
    const objective = activeProject?.objective || `Coordinate the next engineering milestone for ${activeProject?.name || 'this project'}. Add a project objective to make every task pack more specific.`;
    const lifecycleStage = activeProject?.lifecycle_stage || 'Implementation';
    const sourceLabel = liveMode ? 'Shared workspace snapshot' : 'Synthetic preview snapshot';
    const lifecycleNote = liveMode ? `${lifecycleStage} · use the accepted decisions below as the current team agreement.` : 'Sample workspace state. This context is not shared.';
    const dependencyText = task.dependencies?.length ? task.dependencies.join(', ') : 'None';
    return `# VibeCrew Agent Context Pack\n\n> ${sourceLabel} · ${revision} · generated ${new Date().toLocaleString()}. Refresh when accepted context changes.\n\n## Project objective\n\n${objective}\n\n## Current lifecycle stage\n\n${lifecycleNote}\n\n## Accepted engineering decisions\n\n${accepted.map(decision => `### ${decision.id} (v${decision.version}) — ${decision.title}\n\n${decision.decision}`).join('\n\n') || 'No accepted decisions recorded yet.'}\n\n## Assignment\n\n- **Task:** ${task.id} — ${task.title}\n- **Status:** ${statusLabel(task.status)}\n- **Owner:** ${task.owner}\n- **Priority:** ${task.priority}\n- **Dependencies:** ${dependencyText}\n- **Suggested branch:** \`${task.branch || 'Not set'}\`\n- **Declared paths:** ${task.scope.length ? task.scope.map(path => `\`${path}\``).join(', ') : 'None'}\n\n## Acceptance criteria\n\n${task.acceptance || 'Not specified yet.'}\n\n## Expected checks\n\n${task.testPlan || 'Not specified yet.'}\n\n## Coordination notes\n\n${overlapPairs.length ? overlapPairs.map(pair => `- Advisory path overlap with ${pair.a.task.id === task.id ? pair.b.task.id : pair.a.task.id}: ${pair.a.display} ↔ ${pair.b.display}. Coordinate first; this does not prove a Git conflict.`).join('\n') : '- No current active path overlap was detected by the exact/parent-child matcher.'}\n\n## Agent workflow\n\n1. Read repository instructions and inspect Git status; preserve existing work.\n2. Confirm task ownership, dependencies, and current context revision before editing.\n3. Stay within declared paths unless the team agrees to coordinate a scope change.\n4. Implement a small vertical slice and run the expected checks.\n5. Review the diff, commit a coherent change, and open a normal pull request for human review. Never force-push, auto-merge, expose secrets, or bypass review.\n6. Report exact commands and evidence; update task progress and regenerate this pack if it becomes stale.\n\n> VibeCrew shares the coordination snapshot. Repository code, local agent conversations, and coding-agent execution remain on each contributor's machine.\n`;
  }

  function renderContext() {
    const select = $('#context-task-select');
    const current = tasks.some(task => task.id === generatedTaskId) ? generatedTaskId : (tasks[0]?.id || '');
    select.replaceChildren();
    tasks.forEach(task => { const option = document.createElement('option'); option.value = task.id; option.textContent = `${task.id} · ${task.title}`; option.selected = task.id === current; select.append(option); });
    generatedTaskId = current;
    const task = tasks.find(item => item.id === generatedTaskId);
    $('#context-preview').textContent = task ? buildContext(task) : '# No task selected\n\nCreate a task to generate a task context pack.';
    renderRevision();
  }

  function renderAll() {
    renderOverview();
    renderTaskBoard();
    renderDecisions();
    renderPeople();
    renderRelease();
    renderContext();
  }

  function navigate(route) {
    if (!$$(`[data-view="${route}"]`).length) return;
    $$('.view').forEach(view => { const active = view.dataset.view === route; view.hidden = !active; view.classList.toggle('is-visible', active); });
    $$('.nav-item').forEach(button => { const active = button.dataset.route === route; button.classList.toggle('is-active', active); if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
    const title = $(`[data-view="${route}"] h1`)?.textContent?.replace(/\s+/g, ' ').trim() || 'VibeCrew';
    document.title = `${title} — VibeCrew`;
    history.replaceState(null, '', `#${route}`);
    if (route === 'tasks') renderTaskBoard();
    if (route === 'context') renderContext();
    if (route === 'team' && liveMode) loadAgentTokens();
    $('#main-content').focus({ preventScroll: true });
  }

  function showToast(message) {
    const toast = $('#toast'); toast.textContent = message; toast.classList.add('is-visible');
    window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
  }

  function openTaskDialog() {
    if (liveMode && !canManageProject()) { showToast('Only workspace owners and leads can add tasks.'); return; }
    $('#task-form').reset(); $('#task-form-error').hidden = true;
    updateTaskOwnerOptions();
    $('#task-dialog-title').textContent = 'Create a task';
    $('#task-dialog').showModal(); window.setTimeout(() => $('#task-title-input').focus(), 0);
  }

  function addActivity(actor, action, target, icon = '↗') {
    activities.unshift({ actor, action, target, icon, time: 'just now' });
    renderActivity($('#overview-activity-list'), 3);
    renderActivity($('#team-activity-list'));
  }

  async function createTask(formData) {
    const title = String(formData.get('title') || '').trim();
    const error = $('#task-form-error');
    if (!title) { error.textContent = 'Add a task title before saving.'; error.hidden = false; $('#task-title-input').focus(); return false; }
    if (title.length > 90) { error.textContent = 'Keep the task title under 90 characters.'; error.hidden = false; $('#task-title-input').focus(); return false; }
    const selectedOwner = String(formData.get('owner') || '');
    const ownerPerson = people.find(person => (liveMode ? person.user_id : person.name) === selectedOwner);
    const owner = ownerPerson?.name || 'Unassigned';
    const scopeInput = String(formData.get('scope') || '').trim();
    const scope = scopeInput ? [...new Set(scopeInput.split(/\r?\n/).map(path => path.trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\.\//, '').replace(/\/$/, '')).filter(Boolean))].slice(0, 10) : [];
    const priority = ['P0', 'P1', 'P2'].includes(formData.get('priority')) ? formData.get('priority') : 'P1';
    const description = String(formData.get('description') || '').trim().slice(0, 1000);
    const acceptance = String(formData.get('acceptance') || '').trim().slice(0, 2000);
    const testPlan = String(formData.get('test_plan') || '').trim().slice(0, 2000);
    if (liveMode) {
      if (!canManageProject()) { error.textContent = 'Only workspace owners and leads can add tasks.'; error.hidden = false; return false; }
      try {
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
        const { data: created, error: insertError } = await db.from('tasks').insert({
          project_id: activeProject.id,
          title,
          description,
          status: selectedOwner ? 'CLAIMED' : 'READY',
          priority,
          owner_id: selectedOwner || null,
          scope,
          dependencies: [],
          acceptance,
          test_plan: testPlan,
          branch: `feat/${slug || 'task'}-${Date.now().toString(36)}`,
          context_revision_seen: projectRevision.value,
          created_by: currentUser.id
        }).select('*').single();
        if (insertError) throw insertError;
        $('#task-dialog').close();
        dismissOverlap = false;
        await loadWorkspace(activeWorkspace.id, activeProject.id, currentMembership, true);
        navigate('tasks');
        showToast(`${created.task_key} saved to the shared workspace.`);
        return true;
      } catch (creationError) {
        error.textContent = friendlyError(creationError);
        error.hidden = false;
        return false;
      }
    }
    const numericIds = tasks.map(task => Number(task.id.split('-')[1])).filter(Number.isFinite);
    const nextId = Math.max(19, ...numericIds) + 1;
    const task = {
      id: `VBC-${String(nextId).padStart(3, '0')}`,
      title,
      description: description.slice(0, 320) || 'No objective added yet.',
      status: 'READY',
      priority,
      owner,
      scope,
      dependencies: [],
      acceptance: acceptance || 'Add observable acceptance criteria before implementation.',
      testPlan: testPlan || 'Add the checks a reviewer should run.',
      branch: `feat/${`VBC-${String(nextId).padStart(3, '0')}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36)}`}`,
      contextRevisionSeen: projectRevision.value
    };
    tasks.unshift(task);
    $('#task-dialog').close();
    dismissOverlap = false;
    renderAll();
    addActivity(owner === 'Unassigned' ? 'Jordan Reyes' : owner, 'created', `${task.id} · ${task.title}`, '＋');
    navigate('tasks');
    showToast(`${task.id} added to this preview. Reloading will clear it.`);
    return true;
  }

  async function setTaskStatus(taskId, status) {
    const task = tasks.find(item => item.id === taskId);
    if (!task || !statusOptions.some(([value]) => value === status)) return;
    if (liveMode) {
      try {
        const { error } = await db.rpc('update_task_status', {
          p_task_id: task.databaseId,
          p_status: status,
          p_expected_version: task.version
        });
        if (error) throw error;
        dismissOverlap = false;
        await loadWorkspace(activeWorkspace.id, activeProject.id, currentMembership, true);
        showToast(`${task.id} moved to ${statusLabel(status)} in the shared workspace.`);
      } catch (updateError) {
        await loadWorkspace(activeWorkspace.id, activeProject.id, currentMembership, true);
        showToast(friendlyError(updateError));
      }
      return;
    }
    const previous = task.status;
    task.status = status;
    dismissOverlap = false;
    renderTaskBoard();
    addActivity(task.owner === 'Unassigned' ? 'Jordan Reyes' : task.owner, 'moved', `${task.id} from ${statusLabel(previous)} to ${statusLabel(status)}`, '↗');
    showToast(`${task.id} moved to ${statusLabel(status)} in this preview.`);
  }

  async function refreshContext() {
    const task = tasks.find(item => item.id === generatedTaskId);
    if (liveMode && task?.databaseId) {
      try {
        const { error } = await db.rpc('refresh_task_context', {
          p_task_id: task.databaseId,
          p_expected_version: task.version
        });
        if (error) throw error;
        await loadWorkspace(activeWorkspace.id, activeProject.id, currentMembership, true);
        showToast('Context pack refreshed from the shared project revision.');
      } catch (refreshError) {
        await loadWorkspace(activeWorkspace.id, activeProject.id, currentMembership, true);
        showToast(friendlyError(refreshError));
      }
      return;
    }
    if (task) task.contextRevisionSeen = projectRevision.value;
    renderContext(); renderTaskBoard(); renderContextSync();
    showToast('Context snapshot refreshed for this preview task.');
  }

  function copyContext() {
    const text = $('#context-preview').textContent;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast('Context Markdown copied.')).catch(() => fallbackCopy(text));
    } else fallbackCopy(text);
  }

  function fallbackCopy(text) {
    const area = document.createElement('textarea'); area.value = text; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0'; document.body.append(area); area.select();
    const success = document.execCommand('copy'); area.remove();
    showToast(success ? 'Context Markdown copied.' : 'Copy was blocked by the browser. Select the preview and copy it manually.');
  }

  function downloadContext() {
    const blob = new Blob([$('#context-preview').textContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${generatedTaskId.toLowerCase()}-context.md`; document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    showToast('Markdown context downloaded.');
  }

  function setBusy(form, busy, buttonText = 'Working…') {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    if (busy) {
      button.dataset.idleText = button.textContent;
      button.disabled = true;
      button.textContent = buttonText;
    } else {
      button.disabled = false;
      button.textContent = button.dataset.idleText || button.textContent;
      delete button.dataset.idleText;
    }
  }

  function readInviteToken(input) {
    const value = String(input || '').trim();
    if (/^[a-f0-9]{64}$/i.test(value)) return value.toLowerCase();
    try {
      const url = new URL(value);
      const token = url.searchParams.get('invite') || '';
      if (/^[a-f0-9]{64}$/i.test(token)) return token.toLowerCase();
    } catch { /* Treat malformed URLs as invalid invite codes. */ }
    return '';
  }

  $('#email-auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!db) { setAuthMessage('#auth-message', 'Hosted sign-in is unavailable. Use the local preview or check the project configuration.', true); return; }
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const displayName = String(formData.get('display_name') || '').trim().slice(0, 48);
    if (!email || !displayName) { setAuthMessage('#auth-message', 'Enter your name and a valid email address.', true); return; }
    setBusy(form, true, 'Sending link…');
    setAuthMessage('#auth-message', 'Requesting a one-time sign-in link…');
    try {
      sessionSet('vibecrew_pending_name', displayName);
      const redirect = new URL(location.pathname, location.origin);
      const invite = sessionGet('vibecrew_pending_invite');
      if (invite) redirect.searchParams.set('invite', invite);
      const { error } = await db.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirect.toString(), data: { display_name: displayName } }
      });
      if (error) throw error;
      setAuthMessage('#auth-message', 'Check your inbox for the sign-in link. It may take a minute to arrive.');
    } catch (error) {
      setAuthMessage('#auth-message', `Could not send the link: ${friendlyError(error)}`, true);
    } finally { setBusy(form, false); }
  });

  $('#create-workspace-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const workspaceName = String(values.get('workspace_name') || '').trim();
    const projectName = String(values.get('project_name') || '').trim();
    const displayName = String(values.get('display_name') || '').trim();
    const objective = String(values.get('objective') || '').trim();
    if (!workspaceName || !projectName || !displayName) { setAuthMessage('#workspace-message', 'Complete the required workspace, project, and display-name fields.', true); return; }
    setBusy(form, true, 'Creating…');
    setAuthMessage('#workspace-message', 'Creating your shared workspace…');
    try {
      const { data, error } = await db.rpc('create_workspace', {
        p_workspace_name: workspaceName,
        p_project_name: projectName,
        p_objective: objective,
        p_display_name: displayName
      });
      if (error) throw error;
      sessionRemove('vibecrew_pending_name');
      await loadWorkspace(data.workspace_id, data.project_id);
    } catch (error) {
      setAuthMessage('#workspace-message', `Could not create the workspace: ${friendlyError(error)}`, true);
    } finally { setBusy(form, false); }
  });

  $('#join-workspace-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const token = readInviteToken(values.get('invite_token'));
    const displayName = String(values.get('display_name') || '').trim();
    if (!token) { setAuthMessage('#workspace-message', 'Paste a valid 64-character invite code or the complete invitation link.', true); return; }
    if (!displayName) { setAuthMessage('#workspace-message', 'Add a display name before joining.', true); return; }
    setBusy(form, true, 'Joining…');
    setAuthMessage('#workspace-message', 'Validating the invitation…');
    try {
      const { data, error } = await db.rpc('join_workspace', {
        p_token_hash: await hashInviteToken(token),
        p_display_name: displayName
      });
      if (error) throw error;
      sessionRemove('vibecrew_pending_invite');
      sessionRemove('vibecrew_pending_name');
      await loadWorkspace(data.workspace_id, data.project_id);
      showToast(data.already_member ? 'You already belong to this workspace.' : 'You joined the shared workspace.');
    } catch (error) {
      setAuthMessage('#workspace-message', `Could not join: ${friendlyError(error)}`, true);
    } finally { setBusy(form, false); }
  });

  $('#decision-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const title = String(values.get('title') || '').trim();
    const decisionText = String(values.get('decision') || '').trim();
    const errorNode = $('#decision-form-error');
    if (!title || !decisionText) { errorNode.textContent = 'Add a title and the decision before saving.'; errorNode.hidden = false; return; }
    if (!liveMode || !canManageProject()) { errorNode.textContent = 'Only workspace owners and leads can propose shared decisions.'; errorNode.hidden = false; return; }
    setBusy(form, true, 'Saving…');
    errorNode.hidden = true;
    try {
      const decisionKey = `ADR-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await db.from('architecture_decisions').insert({
        project_id: activeProject.id,
        decision_key: decisionKey,
        title,
        context: String(values.get('context') || '').trim(),
        decision: decisionText,
        consequence: String(values.get('consequence') || '').trim(),
        author_id: currentUser.id
      });
      if (error) throw error;
      $('#decision-dialog').close();
      form.reset();
      await loadWorkspace(activeWorkspace.id, activeProject.id, currentMembership, true);
      showToast(`${decisionKey} shared with the workspace.`);
    } catch (error) {
      errorNode.textContent = friendlyError(error);
      errorNode.hidden = false;
    } finally { setBusy(form, false); }
  });

  async function createInvite() {
    if (!liveMode || !canManageProject()) { showToast('Only workspace owners and leads can create invitation links.'); return; }
    const output = $('#invite-url-output');
    const button = $('[data-action="generate-invite"]');
    const role = $('#invite-role-input').value;
    if (!['member', 'reviewer'].includes(role)) { setAuthMessage('#invite-message', 'Select a supported invitation role.', true); return; }
    button.disabled = true;
    setAuthMessage('#invite-message', 'Creating a seven-day invitation…');
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const token = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
      const { data, error } = await db.rpc('create_workspace_invite', {
        p_workspace_id: activeWorkspace.id,
        p_token_hash: await hashInviteToken(token),
        p_role: role
      });
      if (error) throw error;
      const url = new URL(location.href);
      url.hash = '';
      url.search = '';
      url.searchParams.set('invite', token);
      output.value = url.toString();
      $('#invite-copy-button').disabled = false;
      const expires = data?.expires_at ? new Date(data.expires_at).toLocaleDateString() : 'in seven days';
      setAuthMessage('#invite-message', `Link created; expires ${expires}, with up to ${data?.max_uses || 10} uses. Copy and share it now. The raw token is only shown here.`);
      output.focus(); output.select();
    } catch (error) {
      setAuthMessage('#invite-message', `Could not create invitation. ${inviteErrorGuidance(error)}`, true);
    } finally { button.disabled = false; }
  }

  async function loadAgentTokens() {
    const list = $('#agent-token-list');
    if (!list) return;
    if (!liveMode || !activeWorkspace || !currentUser) {
      list.replaceChildren(emptyMessage('Sign in to create and manage personal agent tokens.'));
      return;
    }
    list.replaceChildren(emptyMessage('Loading workspace tokens…'));
    try {
      const { data, error } = await db.from('agent_access_tokens')
        .select('id, label, created_at, expires_at, revoked_at')
        .eq('workspace_id', activeWorkspace.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      list.replaceChildren();
      if (!data?.length) { list.append(emptyMessage('No agent tokens yet. Create one for this IDE.')); return; }
      for (const token of data) {
        const row = document.createElement('div'); row.className = 'agent-token-row';
        const copy = document.createElement('div'); copy.className = 'agent-token-copy';
        const name = document.createElement('strong'); name.textContent = token.label;
        const active = !token.revoked_at && new Date(token.expires_at).getTime() > Date.now();
        const detail = document.createElement('small');
        detail.textContent = active ? `Expires ${new Date(token.expires_at).toLocaleDateString()}` : token.revoked_at ? 'Revoked' : 'Expired';
        copy.append(name, detail);
        const state = document.createElement('span'); state.className = `agent-token-state ${active ? 'is-active' : ''}`; state.textContent = active ? 'ACTIVE' : 'INACTIVE';
        row.append(copy, state);
        if (active) {
          const revoke = document.createElement('button'); revoke.type = 'button'; revoke.className = 'button button-quiet button-small';
          revoke.dataset.action = 'revoke-agent-token'; revoke.dataset.tokenId = token.id; revoke.textContent = 'Revoke';
          revoke.setAttribute('aria-label', `Revoke ${token.label} agent token`); row.append(revoke);
        }
        list.append(row);
      }
    } catch (error) {
      list.replaceChildren(emptyMessage(`Could not load agent tokens: ${friendlyError(error)}`));
    }
  }

  async function createAgentToken(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const errorNode = $('#agent-token-error');
    const label = String($('#agent-token-label').value || '').trim();
    const days = Number($('#agent-token-expiry').value);
    if (!liveMode || !activeWorkspace || !currentUser) { errorNode.textContent = 'Sign in and join a workspace first.'; errorNode.hidden = false; return; }
    if (!label || label.length > 60) { errorNode.textContent = 'Enter a token name between 1 and 60 characters.'; errorNode.hidden = false; $('#agent-token-label').focus(); return; }
    if (![7, 30, 90].includes(days)) { errorNode.textContent = 'Choose an expiry of 7, 30, or 90 days.'; errorNode.hidden = false; return; }
    errorNode.hidden = true;
    const button = form.querySelector('button[type="submit"]'); button.disabled = true;
    button.textContent = 'Creating…';
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const rawToken = `vbc_live_${btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')}`;
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawToken));
      const tokenHash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000 - 60_000).toISOString();
      const { error } = await db.from('agent_access_tokens').insert({
        workspace_id: activeWorkspace.id,
        label,
        token_hash: tokenHash,
        expires_at: expiresAt
      });
      if (error) throw error;
      $('#agent-token-output').value = rawToken;
      $('#agent-token-expiry-note').textContent = `Read-only access to ${activeWorkspace.name} · expires ${new Date(expiresAt).toLocaleString()}. Copy it now; it cannot be retrieved later.`;
      $('#agent-token-dialog').showModal();
      await loadAgentTokens();
      form.reset();
      showToast('Personal read-only agent token created.');
    } catch (error) {
      errorNode.textContent = `Could not create the token: ${friendlyError(error)}`; errorNode.hidden = false;
    } finally {
      button.disabled = !liveMode;
      button.textContent = 'Create read-only token';
    }
  }

  function clearAgentToken() {
    $('#agent-token-output').value = '';
    $('#agent-token-expiry-note').textContent = '';
  }

  async function revokeAgentToken(tokenId) {
    if (!liveMode || !activeWorkspace || !tokenId) return;
    try {
      const { error } = await db.from('agent_access_tokens').update({ revoked_at: new Date(Date.now() - 60_000).toISOString() })
        .eq('id', tokenId).eq('workspace_id', activeWorkspace.id).is('revoked_at', null);
      if (error) throw error;
      await loadAgentTokens();
      showToast('Agent token revoked. Future MCP calls will be denied.');
    } catch (error) {
      showToast(`Could not revoke token: ${friendlyError(error)}`);
    }
  }

  async function saveReleaseStatus(item, status) {
    if (!item || !['NOT_TESTED', 'VERIFIED', 'FAILED'].includes(status)) return;
    if (!liveMode) {
      item.status = status;
      renderRelease();
      showToast('Checklist status changed in this local preview; no evidence was attached.');
      return;
    }
    if (!canManageProject()) { showToast('Only workspace owners and leads can update release checks.'); await loadWorkspace(activeWorkspace.id, activeProject.id, currentMembership, true); return; }
    const { error } = await db.from('release_checks').update({ status }).eq('id', item.databaseId).eq('project_id', activeProject.id);
    if (error) { showToast(`Could not update check: ${friendlyError(error)}`); await loadWorkspace(activeWorkspace.id, activeProject.id, currentMembership, true); return; }
    item.status = status;
    renderRelease();
    showToast(`${item.title} set to ${status.replace('_', ' ')}. Add supporting evidence in the release notes before submission.`);
  }

  document.addEventListener('click', event => {
    const routeControl = event.target.closest('[data-route]');
    if (routeControl) { event.preventDefault(); navigate(routeControl.dataset.route); return; }
    const action = event.target.closest('[data-action]');
    if (!action) return;
    switch (action.dataset.action) {
      case 'new-task': openTaskDialog(); break;
      case 'close-task': $('#task-dialog').close(); break;
      case 'show-connection': $('#connection-dialog').showModal(); break;
      case 'enter-preview': stopPolling(); enterPreview(); break;
      case 'sign-out':
        if (db) db.auth.signOut().then(({ error }) => { if (error) showToast(`Could not sign out: ${friendlyError(error)}`); });
        else showSignIn('');
        break;
      case 'create-invite':
        $('#invite-url-output').value = '';
        $('#invite-copy-button').disabled = true;
        setAuthMessage('#invite-message', '');
        $('#invite-dialog').showModal();
        break;
      case 'generate-invite': createInvite(); break;
      case 'copy-invite': {
        const output = $('#invite-url-output');
        if (!output.value) { setAuthMessage('#invite-message', 'Create an invitation link first.', true); break; }
        output.focus(); output.select();
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(output.value).then(() => setAuthMessage('#invite-message', 'Invitation link copied. Share it only with the intended teammate.')).catch(() => setAuthMessage('#invite-message', document.execCommand('copy') ? 'Invitation link copied.' : 'Copy was blocked; the selected link is ready to copy manually.'));
        else setAuthMessage('#invite-message', document.execCommand('copy') ? 'Invitation link copied.' : 'Copy was blocked; the selected link is ready to copy manually.');
        break;
      }
      case 'revoke-agent-token': revokeAgentToken(action.dataset.tokenId); break;
      case 'copy-agent-project-id': {
        const projectId = $('#agent-mcp-project-id').value;
        if (!projectId || projectId === 'No project selected' || projectId === 'Sign in to reveal the project ID') { showToast('Sign in and select a project first.'); break; }
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(projectId).then(() => showToast('Project ID copied.')).catch(() => showToast('Copy was blocked; select the project ID manually.'));
        else showToast('Copy is unavailable here; select the project ID manually.');
        break;
      }
      case 'copy-agent-token': {
        const output = $('#agent-token-output');
        if (!output.value) { showToast('This token is no longer available. Create a new one.'); break; }
        output.focus(); output.select();
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(output.value).then(() => showToast('Personal agent token copied.')).catch(() => showToast(document.execCommand('copy') ? 'Personal agent token copied.' : 'Copy was blocked; the token is selected.'));
        else showToast(document.execCommand('copy') ? 'Personal agent token copied.' : 'Copy was blocked; the token is selected.');
        break;
      }
      case 'new-decision':
        if (!liveMode || !canManageProject()) { showToast('Shared decisions require a workspace owner or lead.'); break; }
        $('#decision-form').reset(); $('#decision-form-error').hidden = true; $('#decision-dialog').showModal();
        window.setTimeout(() => $('#decision-title-input').focus(), 0);
        break;
      case 'complete-task': {
        const task = tasks.find(item => item.id === action.dataset.taskId);
        if (task) setTaskStatus(task.id, task.status === 'DONE' ? 'READY' : 'DONE');
        break;
      }
      case 'accept-decision': {
        const decision = decisions.find(item => item.id === action.dataset.decisionId);
        if (decision?.status === 'PROPOSED') {
          if (liveMode) {
            if (!canManageProject()) { showToast('Only workspace owners and leads can accept decisions.'); break; }
            db.rpc('accept_decision', { p_decision_id: decision.databaseId, p_expected_version: decision.version }).then(async ({ error }) => {
              if (error) throw error;
              await loadWorkspace(activeWorkspace.id, activeProject.id, currentMembership, true);
              showToast(`${decision.id} accepted. Shared context is now r${String(projectRevision.value).padStart(2, '0')}.`);
            }).catch(async error => { await loadWorkspace(activeWorkspace.id, activeProject.id, currentMembership, true); showToast(`Could not accept decision: ${friendlyError(error)}`); });
          } else {
            decision.status = 'ACCEPTED'; decision.version += 1; projectRevision.value += 1;
            addActivity('Jordan Reyes', 'accepted', `${decision.id} · ${decision.title}`, '⌘');
            renderDecisions(); renderContext(); renderOverview(); renderTaskBoard();
            showToast(`Decision accepted in preview. Context is now r${String(projectRevision.value).padStart(2, '0')}.`);
          }
        }
        break;
      }
      case 'generate-context': refreshContext(); break;
      case 'copy-context': copyContext(); break;
      case 'download-context': downloadContext(); break;
      default: break;
    }
  });

  let taskSubmitting = false;
  $('#task-form').addEventListener('submit', event => {
    event.preventDefault();
    if (taskSubmitting) return;
    taskSubmitting = true;
    const button = $('#task-form button[type="submit"]'); button.disabled = true;
    createTask(new FormData(event.currentTarget)).finally(() => { taskSubmitting = false; button.disabled = false; });
  });
  $('#agent-token-form').addEventListener('submit', createAgentToken);
  $$('.agent-token-close').forEach(button => button.addEventListener('click', () => $('#agent-token-dialog').close()));
  $('#agent-token-dialog').addEventListener('close', clearAgentToken);
  $('.modal-close').addEventListener('click', () => $('#task-dialog').close());
  $$('.connection-close').forEach(button => button.addEventListener('click', () => $('#connection-dialog').close()));
  $$('.invite-close').forEach(button => button.addEventListener('click', () => { $('#invite-dialog').close(); $('#invite-url-output').value = ''; }));
  $$('.decision-close').forEach(button => button.addEventListener('click', () => $('#decision-dialog').close()));
  $('#task-search').addEventListener('input', event => { searchTerm = event.currentTarget.value.trim().toLowerCase(); renderTaskBoard(); });
  $$('.filter-button').forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.filter;
    $$('.filter-button').forEach(item => item.classList.toggle('is-selected', item === button));
    renderTaskBoard();
  }));
  $('#task-board').addEventListener('change', event => {
    const taskId = event.target.dataset.taskStatus;
    if (taskId) setTaskStatus(taskId, event.target.value);
  });
  $('#release-items').addEventListener('change', event => {
    const item = releaseChecks.find(check => check.id === event.target.dataset.releaseCheck);
    if (item) saveReleaseStatus(item, event.target.value);
  });
  $('#context-task-select').addEventListener('change', event => { generatedTaskId = event.currentTarget.value; renderContext(); });
  $('.warning-close').addEventListener('click', () => { dismissOverlap = true; $('#scope-warning').hidden = true; });

  const themeToggle = $('.theme-toggle');
  function setTheme(theme, persist) {
    document.documentElement.dataset.theme = theme;
    themeToggle.innerHTML = theme === 'dark' ? '<span aria-hidden="true">☼</span>' : '<span aria-hidden="true">◐</span>';
    themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    const meta = $('meta[name="theme-color"]'); if (meta) meta.content = theme === 'dark' ? '#111716' : '#f0f2ee';
    if (persist) { try { localStorage.setItem('vibecrew-preview-theme', theme); } catch { /* Theme is a non-sensitive preference; keep it for this session if storage is blocked. */ } }
  }
  try { const saved = localStorage.getItem('vibecrew-preview-theme'); if (saved === 'light' || saved === 'dark') setTheme(saved, false); } catch { /* Default to the designed dark theme if storage is unavailable. */ }
  themeToggle.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true));

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { if ($('#task-dialog').open) $('#task-dialog').close(); if ($('#connection-dialog').open) $('#connection-dialog').close(); if ($('#invite-dialog').open) { $('#invite-dialog').close(); $('#invite-url-output').value = ''; } if ($('#decision-dialog').open) $('#decision-dialog').close(); if ($('#agent-token-dialog').open) $('#agent-token-dialog').close(); }
    if (!event.altKey && !event.ctrlKey && !event.metaKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && event.key === '1') navigate('overview');
  });

  bootBackend().catch(error => showSignIn(`Could not start VibeCrew: ${friendlyError(error)}`));
})();
