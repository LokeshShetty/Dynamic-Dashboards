/**
 * A deliberately tiny markdown subset, parsed to tokens that a component turns into React
 * elements. There is no HTML path and no link support: text on a dashboard comes from a
 * configuration file that anyone can hand a colleague, so it is treated as hostile input.
 * Bold, italic, inline code and bullet lists cover what a dashboard note needs; anything
 * that could carry a URL or a script is simply not part of the grammar.
 */
export type InlineToken =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'italic'; value: string }
  | { kind: 'code'; value: string }

export type MarkdownBlock =
  { kind: 'paragraph'; content: InlineToken[] } | { kind: 'list'; items: InlineToken[][] }

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g

export function parseMarkdown(body: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  const paragraphs = body.split(/\n{2,}/)

  for (const paragraph of paragraphs) {
    const lines = paragraph.split('\n').filter((line) => line.trim() !== '')
    if (lines.length === 0) continue

    const isList = lines.every((line) => /^\s*-\s+/.test(line))

    if (isList) {
      blocks.push({
        kind: 'list',
        items: lines.map((line) => parseInline(line.replace(/^\s*-\s+/, ''))),
      })
      continue
    }

    blocks.push({ kind: 'paragraph', content: parseInline(lines.join(' ')) })
  }

  return blocks
}

function parseInline(text: string): InlineToken[] {
  return text
    .split(INLINE_PATTERN)
    .filter((part) => part !== '')
    .map((part) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return { kind: 'bold', value: part.slice(2, -2) }
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return { kind: 'italic', value: part.slice(1, -1) }
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return { kind: 'code', value: part.slice(1, -1) }
      }
      return { kind: 'text', value: part }
    })
}
