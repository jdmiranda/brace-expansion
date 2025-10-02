import expand, { clearCache } from '../index.js'
import fs from 'fs'

const resfile = new URL('../test/cases.txt', import.meta.url)
const cases = fs.readFileSync(resfile, 'utf8').split('\n').filter(line => line && !line.startsWith('#'))

// Benchmark configuration
const ITERATIONS = 10000
const WARMUP_ITERATIONS = 1000

// Test patterns
const testPatterns = [
  // Simple patterns
  'a{b,c}d',
  '{1..10}',
  'test-{a,b,c}-file',

  // Medium complexity
  'http://example.com/{2020..2024}/file{1..5}.txt',
  'dir/{a,b,c}/{1..3}/file.{js,ts,jsx,tsx}',

  // Complex patterns
  'PRE-{a,b}{{a,b},a,b}-POST',
  '{a..z}{0..9}{A..Z}',

  // Patterns without braces (fast path)
  'simple-string-no-braces',
  '/path/to/file.txt',

  // Numeric sequences
  '{1..100}',
  '{01..50}',
  '{-10..10}',
  '{1..100..5}',

  // Alpha sequences
  '{a..z}',
  '{A..Z..2}'
]

function benchmark (name, fn, iterations = ITERATIONS) {
  // Warmup
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    fn()
  }

  // Actual benchmark
  const start = performance.now()
  for (let i = 0; i < iterations; i++) {
    fn()
  }
  const end = performance.now()
  const duration = end - start
  const opsPerSec = (iterations / duration) * 1000

  return {
    duration,
    opsPerSec,
    avgTime: duration / iterations
  }
}

console.log('Brace Expansion Benchmark')
console.log('='.repeat(70))
console.log()

// Benchmark 1: All test cases (cold cache)
console.log('Test 1: All test cases (cold cache)')
clearCache()
const result1 = benchmark('All cases', () => {
  cases.forEach(testcase => expand(testcase))
})
console.log(`  Duration: ${result1.duration.toFixed(2)}ms`)
console.log(`  Operations/sec: ${result1.opsPerSec.toFixed(0)}`)
console.log(`  Avg per iteration: ${result1.avgTime.toFixed(4)}ms`)
console.log()

// Benchmark 2: All test cases (with cache)
console.log('Test 2: All test cases (warm cache)')
const result2 = benchmark('All cases (cached)', () => {
  cases.forEach(testcase => expand(testcase))
})
console.log(`  Duration: ${result2.duration.toFixed(2)}ms`)
console.log(`  Operations/sec: ${result2.opsPerSec.toFixed(0)}`)
console.log(`  Avg per iteration: ${result2.avgTime.toFixed(4)}ms`)
console.log(`  Speedup: ${(result1.duration / result2.duration).toFixed(2)}x`)
console.log()

// Benchmark 3: Individual pattern types
console.log('Test 3: Individual pattern types')
console.log('-'.repeat(70))
testPatterns.forEach(pattern => {
  clearCache()
  const result = benchmark(`Pattern: ${pattern}`, () => expand(pattern), 50000)
  console.log(`  ${pattern}`)
  console.log(`    Ops/sec: ${result.opsPerSec.toFixed(0)}, Avg: ${(result.avgTime * 1000).toFixed(2)}μs`)
})
console.log()

// Benchmark 4: Cache effectiveness
console.log('Test 4: Cache effectiveness on repeated patterns')
const repeatedPattern = '{1..20}{a..e}'
clearCache()
const coldRun = benchmark('Cold', () => expand(repeatedPattern), 10000)
const warmRun = benchmark('Warm', () => expand(repeatedPattern), 10000)
console.log(`  Pattern: ${repeatedPattern}`)
console.log(`  Cold cache: ${coldRun.opsPerSec.toFixed(0)} ops/sec`)
console.log(`  Warm cache: ${warmRun.opsPerSec.toFixed(0)} ops/sec`)
console.log(`  Cache speedup: ${(warmRun.opsPerSec / coldRun.opsPerSec).toFixed(2)}x`)
console.log()

// Benchmark 5: Fast path effectiveness
console.log('Test 5: Fast path (no braces)')
const noBracesPattern = '/path/to/some/file.txt'
clearCache()
const noBracesResult = benchmark('No braces', () => expand(noBracesPattern), 100000)
console.log(`  Pattern: ${noBracesPattern}`)
console.log(`  Ops/sec: ${noBracesResult.opsPerSec.toFixed(0)}`)
console.log(`  Avg: ${(noBracesResult.avgTime * 1000).toFixed(2)}μs`)
console.log()

console.log('='.repeat(70))
console.log('Benchmark complete!')
