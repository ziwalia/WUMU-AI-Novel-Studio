/**
 * Extract JSON string from LLM raw output.
 * Handles: full ```json...``` blocks, opening-only ```, and raw JSON strings.
 */
export function extractJsonFromRaw(raw: string): string | null {
  // 1. Full code block with opening and closing ```
  const fullMatch = raw.match(/```(?:json|JSON)?\s*([\s\S]*?)\s*```/)
  if (fullMatch?.[1]) return fullMatch[1].trim()

  // 2. Opening ``` only (LLM sometimes omits closing ```)
  const openOnly = raw.match(/```(?:json|JSON)?\s*\n?([\s\S]+)/)
  if (openOnly?.[1]) {
    const candidate = openOnly[1].trim()
    if (candidate.startsWith('{') || candidate.startsWith('[')) return candidate
  }

  // 3. Raw string starts with JSON
  const trimmed = raw.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return trimmed

  return null
}

/**
 * Sanitize LLM JSON output by fixing common mistakes:
 * - Single quotes used as string delimiters → double quotes
 * - Trailing commas before } or ]
 * - Handles single-quoted strings that contain internal single quotes (e.g. '灯塔'text)
 */
function sanitizeJson(raw: string): string {
  // Remove trailing commas before } or ]
  let result = raw.replace(/,\s*([}\]])/g, '$1')

  // State machine: replace single-quoted JSON delimiters with double quotes
  // Key insight: when we see ' while inside a single-quoted string, check if
  // the next non-whitespace char is a JSON terminator (, } ] or end-of-input).
  // If not, the ' is content (e.g. '灯塔' inside a value), not a string boundary.
  let inDouble = false
  let inSingle = false
  let out = ''
  let i = 0

  while (i < result.length) {
    const ch = result[i]

    // Handle escape sequences
    if (ch === '\\' && i + 1 < result.length) {
      if (inSingle) {
        const next = result[i + 1]
        if (next === "'") {
          out += "'"
          i += 2
          continue
        }
        if (next === '"') {
          out += '\\"'
          i += 2
          continue
        }
      }
      out += ch + result[i + 1]
      i += 2
      continue
    }

    if (inDouble) {
      if (ch === '"') inDouble = false
      out += ch
    } else if (inSingle) {
      if (ch === "'") {
        // Look ahead: is this really the end of the string?
        // Only close if next non-whitespace is a JSON structural character
        const rest = result.slice(i + 1)
        if (/^\s*[,\]}"\]]/.test(rest) || /^\s*$/.test(rest)) {
          // This ' is a string delimiter → close the string
          inSingle = false
          out += '"'
        } else {
          // This ' is content inside the string (e.g. '灯塔' used as Chinese quotes)
          out += "'"
        }
      } else {
        out += ch
      }
    } else {
      if (ch === '"') {
        inDouble = true
        out += ch
      } else if (ch === "'") {
        inSingle = true
        out += '"'
      } else {
        out += ch
      }
    }

    i++
  }

  return out
}

/**
 * Parse JSON from LLM output with automatic extraction and sanitization.
 * Tries standard parse first, then falls back to sanitized parse.
 */
export function parseJsonFromLLM<T = unknown>(raw: string): T | null {
  const extracted = extractJsonFromRaw(raw)
  if (!extracted) return null

  // Try standard JSON.parse first
  try {
    return JSON.parse(extracted) as T
  } catch {
    // Try sanitized version
    try {
      return JSON.parse(sanitizeJson(extracted)) as T
    } catch {
      return null
    }
  }
}
