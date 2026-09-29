# 08 — Document attachments

**What to build:** Users can bring documents into a conversation. Files can be added with the 📎 button, drag-and-drop or paste, and appear as removable pills above the composer before sending. Allowed types are `.pdf .txt .md .csv .json`, up to 5 per message. The server extracts each document's text (PDFs via a PDF text library); the original file is never stored. Text longer than 50,000 characters is cut, and the user sees a note naming the file. A PDF with no extractable text (a scan) is rejected before sending. Sent messages show named attachment pills. The model receives each attachment as `[Attached file: <name>]` followed by its text, on this turn and every later one.

See spec: User Stories 39–47; `CONTEXT.md` → Attachment; Implementation Decisions → Attachment extractor, Context builder.

**Blocked by:** 03 — Persisted conversations

**Status:** ready-for-agent

- [ ] 📎, drag-and-drop and paste all stage files as removable pills
- [ ] A real PDF gets a correct summary on all three models
- [ ] Seam-1 tests (through send): text over 50k is truncated with the flag set; an empty-text PDF is rejected with "No text found in X. Scanned PDFs aren't supported."; a disallowed type is rejected; more than 5 files is rejected
- [ ] Seam-1 test: the context passed to the mock model contains the attachment as labelled text on the sending turn and on a later turn
- [ ] The truncation note and rejection messages are visible to the user
- [ ] Sent messages show attachment pills with file names after a refresh
- [ ] Image upload is not offered (catalog `images` flag is false)
