import balanced from 'balanced-match'

const escSlash = '\0SLASH' + Math.random() + '\0'
const escOpen = '\0OPEN' + Math.random() + '\0'
const escClose = '\0CLOSE' + Math.random() + '\0'
const escComma = '\0COMMA' + Math.random() + '\0'
const escPeriod = '\0PERIOD' + Math.random() + '\0'
const escSlashPattern = new RegExp(escSlash, 'g')
const escOpenPattern = new RegExp(escOpen, 'g')
const escClosePattern = new RegExp(escClose, 'g')
const escCommaPattern = new RegExp(escComma, 'g')
const escPeriodPattern = new RegExp(escPeriod, 'g')
const slashPattern = /\\\\/g
const openPattern = /\\{/g
const closePattern = /\\}/g
const commaPattern = /\\,/g
const periodPattern = /\\./g

// LRU Cache implementation for expansion results
class LRUCache {
  constructor (maxSize) {
    this.maxSize = maxSize
    this.cache = new Map()
  }

  get (key) {
    if (!this.cache.has(key)) return undefined
    // Move to end (most recently used)
    const value = this.cache.get(key)
    this.cache.delete(key)
    this.cache.set(key, value)
    return value
  }

  set (key, value) {
    // Delete if exists to update position
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      // Delete least recently used (first item)
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    this.cache.set(key, value)
  }

  clear () {
    this.cache.clear()
  }

  get size () {
    return this.cache.size
  }
}

// Memoization cache for expansion results (LRU with 500 entries for main cache)
const expansionCache = new LRUCache(500)

// Pattern parsing memoization (smaller cache as patterns repeat less)
const parseCache = new LRUCache(250)

// Recursion memoization cache (larger for deep recursion)
const recursionCache = new LRUCache(750)

// Fast path patterns (pre-compiled regex cache)
const hasBracesPattern = /[{}]/
const hasEscapedCharsPattern = /\\[\\{},.]|^{}/

/**
 * Clear all caches (useful for testing or memory management)
 */
export function clearCache () {
  expansionCache.clear()
  parseCache.clear()
  recursionCache.clear()
}

/**
 * @return {number}
 */
function numeric (str) {
  return !isNaN(str)
    ? parseInt(str, 10)
    : str.charCodeAt(0)
}

/**
 * @param {string} str
 */
function escapeBraces (str) {
  // Fast path: if no escaped characters, return as-is
  if (!hasEscapedCharsPattern.test(str)) {
    return str
  }
  return str.replace(slashPattern, escSlash)
    .replace(openPattern, escOpen)
    .replace(closePattern, escClose)
    .replace(commaPattern, escComma)
    .replace(periodPattern, escPeriod)
}

/**
 * @param {string} str
 */
function unescapeBraces (str) {
  return str.replace(escSlashPattern, '\\')
    .replace(escOpenPattern, '{')
    .replace(escClosePattern, '}')
    .replace(escCommaPattern, ',')
    .replace(escPeriodPattern, '.')
}

/**
 * Basically just str.split(","), but handling cases
 * where we have nested braced sections, which should be
 * treated as individual members, like {a,{b,c},d}
 * @param {string} str
 */
function parseCommaParts (str) {
  if (!str) { return [''] }

  // Check parse cache first
  const cached = parseCache.get(str)
  if (cached) {
    return cached
  }

  const m = balanced('{', '}', str)

  if (!m) {
    const result = str.split(',')
    parseCache.set(str, result)
    return result
  }

  const { pre, body, post } = m
  const p = pre.split(',')

  p[p.length - 1] += '{' + body + '}'

  if (post.length) {
    const postParts = parseCommaParts(post)
    p[p.length - 1] += postParts[0]
    // More efficient than shift() + push.apply()
    for (let i = 1; i < postParts.length; i++) {
      p.push(postParts[i])
    }
  }

  // Cache the result
  parseCache.set(str, p)
  return p
}

/**
 * @param {string} str
 */
export default function expandTop (str) {
  if (!str) { return [] }

  // Check cache first (LRU automatically manages size)
  const cached = expansionCache.get(str)
  if (cached) {
    return cached
  }

  // Fast path: if no braces at all, return as-is
  if (!hasBracesPattern.test(str)) {
    const result = [str]
    expansionCache.set(str, result)
    return result
  }

  // I don't know why Bash 4.3 does this, but it does.
  // Anything starting with {} will have the first two bytes preserved
  // but *only* at the top level, so {},a}b will not expand to anything,
  // but a{},b}c will be expanded to [a}c,abc].
  // One could argue that this is a bug in Bash, but since the goal of
  // this module is to match Bash's rules, we escape a leading {}
  if (str.slice(0, 2) === '{}') {
    str = '\\{\\}' + str.slice(2)
  }

  const result = expand(escapeBraces(str), true).map(unescapeBraces)

  // Cache the result (LRU automatically manages size)
  expansionCache.set(str, result)

  return result
}

/**
 * @param {string} str
 */
function embrace (str) {
  return '{' + str + '}'
}

/**
 * @param {string} el
 */
function isPadded (el) {
  return /^-?0\d/.test(el)
}

/**
 * @param {number} i
 * @param {number} y
 */
function lte (i, y) {
  return i <= y
}

/**
 * @param {number} i
 * @param {number} y
 */
function gte (i, y) {
  return i >= y
}

/**
 * @param {string} str
 * @param {boolean} [isTop]
 */
function expand (str, isTop) {
  // Check recursion cache for non-top level expansions
  if (!isTop) {
    const cached = recursionCache.get(str)
    if (cached) {
      return cached
    }
  }

  /** @type {string[]} */
  const expansions = []

  const m = balanced('{', '}', str)
  if (!m) {
    const result = [str]
    if (!isTop) {
      recursionCache.set(str, result)
    }
    return result
  }

  // no need to expand pre, since it is guaranteed to be free of brace-sets
  const pre = m.pre
  const post = m.post.length
    ? expand(m.post, false)
    : ['']

  if (/\$$/.test(m.pre)) {
    // Pre-compile string parts for better performance
    const prefix = pre + '{'
    const suffix = '}'
    for (let k = 0; k < post.length; k++) {
      const expansion = prefix + m.body + suffix + post[k]
      expansions.push(expansion)
    }
  } else {
    const isNumericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(m.body)
    const isAlphaSequence = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(m.body)
    const isSequence = isNumericSequence || isAlphaSequence
    const isOptions = m.body.indexOf(',') >= 0
    if (!isSequence && !isOptions) {
      // {a},b}
      if (m.post.match(/,(?!,).*\}/)) {
        str = m.pre + '{' + m.body + escClose + m.post
        return expand(str)
      }
      const result = [str]
      if (!isTop) {
        recursionCache.set(str, result)
      }
      return result
    }

    let n
    if (isSequence) {
      n = m.body.split(/\.\./)
    } else {
      n = parseCommaParts(m.body)
      if (n.length === 1) {
        // x{{a,b}}y ==> x{a}y x{b}y
        n = expand(n[0], false).map(embrace)
        if (n.length === 1) {
          const result = post.map(function (p) {
            return m.pre + n[0] + p
          })
          if (!isTop) {
            recursionCache.set(str, result)
          }
          return result
        }
      }
    }

    // at this point, n is the parts, and we know it's not a comma set
    // with a single entry.
    let N

    if (isSequence) {
      const x = numeric(n[0])
      const y = numeric(n[1])
      const width = Math.max(n[0].length, n[1].length)
      let incr = n.length === 3
        ? Math.abs(numeric(n[2]))
        : 1
      let test = lte
      const reverse = y < x
      if (reverse) {
        incr *= -1
        test = gte
      }
      const pad = n.some(isPadded)

      // Pre-calculate array size for better performance
      const seqLength = Math.floor(Math.abs((y - x) / incr)) + 1
      N = new Array(seqLength)
      let idx = 0

      for (let i = x; test(i, y); i += incr) {
        let c
        if (isAlphaSequence) {
          c = String.fromCharCode(i)
          if (c === '\\') { c = '' }
        } else {
          c = String(i)
          if (pad) {
            const need = width - c.length
            if (need > 0) {
              const z = new Array(need + 1).join('0')
              if (i < 0) { c = '-' + z + c.slice(1) } else { c = z + c }
            }
          }
        }
        N[idx++] = c
      }
      // Trim array if we overestimated (edge cases)
      if (idx < N.length) {
        N.length = idx
      }
    } else {
      N = []

      for (let j = 0; j < n.length; j++) {
        const expanded = expand(n[j], false)
        // More efficient than push.apply for large arrays
        for (let k = 0; k < expanded.length; k++) {
          N.push(expanded[k])
        }
      }
    }

    for (let j = 0; j < N.length; j++) {
      for (let k = 0; k < post.length; k++) {
        const expansion = pre + N[j] + post[k]
        if (!isTop || isSequence || expansion) { expansions.push(expansion) }
      }
    }
  }

  // Cache recursion results
  if (!isTop) {
    recursionCache.set(str, expansions)
  }

  return expansions
}
