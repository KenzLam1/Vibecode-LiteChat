import type { AttachmentData } from "@/server/db/schema";

export type AttachmentInput = {
  filename: string;
  mediaType: string;
  data: Uint8Array;
};

export class AttachmentError extends Error {}

export const ATTACHMENT_TEXT_MAX_CHARS = 50_000;
const ALLOWED_EXTENSIONS = new Set([".pdf", ".txt", ".md", ".csv", ".json"]);

function extension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot < 0 ? "" : filename.slice(dot).toLowerCase();
}

export async function extractAttachments(
  attachments: AttachmentInput[],
): Promise<AttachmentData[]> {
  if (attachments.length > 5) {
    throw new AttachmentError("You can attach up to 5 documents per message.");
  }
  return Promise.all(
    attachments.map(async (attachment) => {
      const kind = extension(attachment.filename);
      if (!ALLOWED_EXTENSIONS.has(kind)) {
        throw new AttachmentError(
          `${attachment.filename} isn't a supported document type.`,
        );
      }
      let text: string;
      if (kind === ".pdf") {
        try {
          const { extractText } = await import("unpdf");
          const extracted = await extractText(attachment.data, {
            mergePages: true,
          });
          text = extracted.text;
        } catch {
          throw new AttachmentError(`Couldn't read ${attachment.filename}.`);
        }
      } else {
        text = new TextDecoder().decode(attachment.data);
      }
      if (!text.trim()) {
        throw new AttachmentError(
          kind === ".pdf"
            ? `No text found in ${attachment.filename}. Scanned PDFs aren't supported.`
            : `No text found in ${attachment.filename}.`,
        );
      }
      return {
        filename: attachment.filename,
        size: attachment.data.byteLength,
        text: text.slice(0, ATTACHMENT_TEXT_MAX_CHARS),
        truncated: text.length > ATTACHMENT_TEXT_MAX_CHARS,
      };
    }),
  );
}
