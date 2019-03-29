const rollup = require('rollup');
const commonjs = require('rollup-plugin-commonjs');
const resolve = require('rollup-plugin-node-resolve');
const cleanup = require('rollup-plugin-cleanup');
const babel = require('rollup-plugin-babel');

export default {
  input: 'src/index.js',
  external: ['three'],
  output: [{
    file: './build/three-ik.js',
    format: 'umd',
    name: 'IK',
  }, {
    file: './build/three-ik.module.js',
    format: 'es',
  }],
  globals: {
    'three': 'THREE',
  },
  watch: {
    include: 'src/**',
  },
  plugins: [
    babel({
      plugins: ['external-helpers'],
      exclude: 'node_modules/**',
    }),
    resolve(),
    commonjs(),
    cleanup(),
  ],
};
