import expand, { clearCache } from '../index.js'

// Test cases with varying complexity
const testCases = [
  // Simple patterns (should benefit from caching)
  'test-{a,b,c}.js',
  'file-{1..10}.txt',
  '{a,b,c}-{1,2,3}',

  // Medium complexity
  'path/to/{src,test}/{lib,utils}/*.{js,ts}',
  '{a..z}-{1..20}.{txt,md,js}',

  // Complex nested patterns
  '{{{a,b},{c,d}},{{e,f},{g,h}}}',
  '{a,b,{c,d,{e,f,{g,h}}}}',

  // Sequences
  'file-{01..100}.txt',
  'backup-{2024..2025}-{01..12}-{01..31}.log',

  // Real-world patterns
  'node_modules/{@types,@babel}/{core,preset-env,plugin-*}/{lib,dist}/**/*.{js,d.ts}'
]

// Warmup and cache test
console.log('Warmup run (builds cache)...')
let start = performance.now()
for (let i = 0; i < 1000; i++) {
  testCases.forEach(pattern => expand(pattern))
}
let elapsed = performance.now() - start
console.log(`Warmup: ${elapsed.toFixed(2)}ms (${(1000 * testCases.length / elapsed * 1000).toFixed(0)} ops/sec)\n`)

// Cached performance
console.log('Cached performance test...')
start = performance.now()
for (let i = 0; i < 10000; i++) {
  testCases.forEach(pattern => expand(pattern))
}
elapsed = performance.now() - start
console.log(`Cached: ${elapsed.toFixed(2)}ms (${(10000 * testCases.length / elapsed * 1000).toFixed(0)} ops/sec)\n`)

// Clear cache and test cold performance
console.log('Cold performance test (no cache)...')
clearCache()
start = performance.now()
for (let i = 0; i < 1000; i++) {
  testCases.forEach(pattern => {
    clearCache() // Clear between each to simulate cold runs
    expand(pattern)
  })
}
elapsed = performance.now() - start
console.log(`Cold: ${elapsed.toFixed(2)}ms (${(1000 * testCases.length / elapsed * 1000).toFixed(0)} ops/sec)\n`)

// Mixed scenario (50% cache hits)
console.log('Mixed performance test (50% cache hits)...')
clearCache()
const mixedCases = [...testCases, ...testCases.map(c => c + '-variant')]
start = performance.now()
for (let i = 0; i < 5000; i++) {
  const pattern = mixedCases[i % mixedCases.length]
  expand(pattern)
  if (i % 100 === 0) clearCache() // Periodic cache clears
}
elapsed = performance.now() - start
console.log(`Mixed: ${elapsed.toFixed(2)}ms (${(5000 / elapsed * 1000).toFixed(0)} ops/sec)\n`)
