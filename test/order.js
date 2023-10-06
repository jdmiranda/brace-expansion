import test from 'node:test';
import assert from 'assert';
import expand from '../index.js';

test('order', function() {
  assert.deepStrictEqual(expand('a{d,c,b}e'), [
    'ade', 'ace', 'abe'
  ]);
});

