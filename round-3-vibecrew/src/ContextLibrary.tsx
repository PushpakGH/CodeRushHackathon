import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Document = { kind: string; title: string; body: string; version: number };
type ContextState = {
  projectId: string;
  documents: Document[];
  canPublish: boolean;
};
declare global {
  interface Window {
    vibecrewPublishDocument: (document: Document) => Promise<void>;
  }
}

export function ContextLibrary() {
  const [target, setTarget] = useState<Element | null>(null);
  const [context, setContext] = useState<ContextState | null>(null);
  const [draft, setDraft] = useState<Document>({
    kind: "plan",
    title: "",
    body: "",
    version: 0,
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setDraft({ kind: "plan", title: "", body: "", version: 0 });
    setMessage("");
  }, [context?.projectId]);
  useEffect(() => {
    setTarget(document.querySelector('[data-view="discovery"]'));
    const onContext = (event: Event) =>
      setContext((event as CustomEvent<ContextState>).detail);
    window.addEventListener("vibecrew:context", onContext);
    return () => window.removeEventListener("vibecrew:context", onContext);
  }, []);
  function choose(kind: string) {
    setDraft(
      context?.documents.find((doc) => doc.kind === kind) || {
        kind,
        title: "",
        body: "",
        version: 0,
      },
    );
    setMessage("");
  }
  if (!target || !context) return null;
  return createPortal(
    <section className="panel context-library">
      <h2>Shared project context</h2>
      <p>
        Publish the plan, system design and agent instructions. Every member and
        connected IDE can fetch the latest published revision.
      </p>
      {context.documents.length === 0 && (
        <p>
          No documents published yet. The owner or lead can add the first
          project plan below.
        </p>
      )}
      {context.documents.map((doc) => (
        <details key={doc.kind}>
          <summary>
            {doc.title} · {doc.kind} · v{doc.version}
          </summary>
          <pre>{doc.body}</pre>
          {context.canPublish && (
            <button
              className="button button-outline"
              onClick={() => choose(doc.kind)}
            >
              Edit {doc.kind}
            </button>
          )}
        </details>
      ))}
      {context.canPublish && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            setMessage("");
            try {
              await window.vibecrewPublishDocument(draft);
              setDraft({ ...draft, version: draft.version + 1 });
              setMessage(
                "Published. Members and IDEs can fetch the new revision.",
              );
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : String(
                      (error as { message?: string })?.message ||
                        "Could not publish. Check your connection and retry.",
                    ),
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          <label className="field-label" htmlFor="context-kind">
            Document type
          </label>
          <select
            id="context-kind"
            className="form-control"
            value={draft.kind}
            onChange={(event) => choose(event.target.value)}
          >
            <option value="plan">Product plan</option>
            <option value="architecture">System architecture</option>
            <option value="frontend">Frontend design</option>
            <option value="backend">Backend design</option>
            <option value="instructions">Agent instructions</option>
          </select>
          <label className="field-label" htmlFor="context-title-input">
            Title
          </label>
          <input
            id="context-title-input"
            className="form-control"
            required
            maxLength={120}
            value={draft.title}
            onChange={(event) =>
              setDraft({ ...draft, title: event.target.value })
            }
          />
          <label className="field-label" htmlFor="context-file">
            Import Markdown or text
          </label>
          <input
            id="context-file"
            type="file"
            accept=".md,.txt,text/plain,text/markdown"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > 200000) {
                setMessage("Choose a text file smaller than 200 KB.");
                return;
              }
              const body = await file.text();
              if (body.length > 50000) {
                setMessage("Limit the document to 50,000 characters.");
                return;
              }
              setDraft({ ...draft, body });
            }}
          />
          <label className="field-label" htmlFor="context-body">
            Markdown content
          </label>
          <textarea
            id="context-body"
            className="form-control"
            required
            rows={14}
            maxLength={50000}
            value={draft.body}
            onChange={(event) =>
              setDraft({ ...draft, body: event.target.value })
            }
          />
          <button className="button button-primary" disabled={saving}>
            {saving ? "Publishing…" : "Publish shared context"}
          </button>
        </form>
      )}
      <p role="status">{message}</p>
    </section>,
    target,
  );
}
