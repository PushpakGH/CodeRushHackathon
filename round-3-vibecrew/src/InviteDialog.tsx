export function InviteDialog() {
  return <dialog className="modal invite-modal" id="invite-dialog" aria-labelledby="invite-dialog-title">
    <div className="modal-head"><div><div className="eyebrow eyebrow-small">SHARE A TEAM WORKSPACE</div><h2 id="invite-dialog-title">Invite a teammate.</h2></div><button className="icon-button invite-close" type="button" aria-label="Close dialog">×</button></div>
    <p className="modal-subtitle">Invitation links are bearer links. Anyone with the link can join; it expires in seven days and allows up to ten uses.</p>
    <p className="modal-subtitle">Only a workspace Owner or Lead can create a link. Confirm the workspace at the top is the one your teammate should join. If creation fails, the message below will suggest what to check next.</p>
    <label className="field-label" htmlFor="invite-role-input">Join role</label><select className="form-control" id="invite-role-input"><option value="member">Member</option><option value="reviewer">Reviewer</option></select>
    <button className="button button-primary full-button" type="button" data-action="generate-invite">Create invitation link</button>
    <label className="field-label" htmlFor="invite-url-output">Invitation link <small>shown once</small></label><input className="form-control mono-input" id="invite-url-output" readOnly placeholder="Create a link to share" />
    <div className="modal-actions"><button className="button button-outline" id="invite-copy-button" type="button" data-action="copy-invite" disabled>Copy link</button><button className="button button-quiet invite-close" type="button">Done</button></div>
    <p id="invite-message" className="auth-message" role="status" aria-live="polite"></p>
  </dialog>;
}
