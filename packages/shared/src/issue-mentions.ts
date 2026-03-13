/**
 * Issue mention support for markdown
 * Allows linking to issues using #ISSUE-123 syntax
 */

export const ISSUE_MENTION_PATTERN = /#([A-Z]+-\d+)/g;

export interface ParsedIssueMention {
  issueIdentifier: string;
}

/**
 * Parse an issue mention from markdown text
 * Example: #ACK-123 -> { issueIdentifier: "ACK-123" }
 */
export function parseIssueMention(text: string): ParsedIssueMention | null {
  const match = /^#([A-Z]+-\d+)$/.exec(text);
  if (!match) return null;
  return { issueIdentifier: match[1] };
}

/**
 * Extract all issue identifiers from markdown text
 */
export function extractIssueMentions(markdown: string): string[] {
  const ids = new Set<string>();
  const re = new RegExp(ISSUE_MENTION_PATTERN);
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    ids.add(match[1]);
  }
  return Array.from(ids);
}
