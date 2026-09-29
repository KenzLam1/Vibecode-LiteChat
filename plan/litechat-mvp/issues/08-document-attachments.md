# 08 — Document attachments

**What to build:** Users can bring documents into a conversation. Files can be added with the 📎 button, drag-and-drop or paste, and appear as removable pills above the composer before sending. Allowed types are `.pdf .txt .md .csv .json`, up to 5 per message. The server extracts each document's text (PDFs via a PDF text library); the original file is never stored. Text longer than 50,000 characters is cut, and the user sees a note naming the file. A PDF with no extractable text (a scan) is rejected before sending. Sent messages show named attachment pills. The model receives each attachment as `[Attached file: <name>]` followed by its text, on this turn and every later one.

See spec: User Stories 39–47; `CONTEXT.md` → Attachment; Implementation Decisions → Attachment extractor, Context builder.

**Blocked by:** 03 — Persisted conversations

**Status:** implemented

- [x] 📎, drag-and-drop and paste all stage files as removable pills
- [x] A real PDF gets a correct summary on all three models
- [x] Seam-1 tests (through send): text over 50k is truncated with the flag set; an empty-text PDF is rejected with "No text found in X. Scanned PDFs aren't supported."; a disallowed type is rejected; more than 5 files is rejected
- [x] Seam-1 test: the context passed to the mock model contains the attachment as labelled text on the sending turn and on a later turn
- [x] The truncation note and rejection messages are visible to the user
- [x] Sent messages show attachment pills with file names after a refresh
- [x] Image upload is not offered (catalog `images` flag is false)

## Comments

**2026-09-29 — implemented.** Findings:

- `unpdf` extracts PDFs on the server. The browser sends each staged document
  for that request, then only `{filename, size, text, truncated}` is stored.
  The original bytes never enter the database or later model calls.
- Rejections happen before the user message is saved. Unsupported types, more
  than five documents and empty PDFs are covered through the Conversation
  service seam, along with truncation and labeled text on later turns.
- A generated text-bearing PDF produced the exact code name and target through
  ChatGPT, Claude and Gemini in a live proxy run. Chrome exposed the attachment
  control, but its extension permission blocked automated file-chooser access;
  chooser, drop and paste staging are covered by component tests instead.
- The catalog's `images: false` capability keeps image attachment controls out
  of the UI. No schema change was needed.
