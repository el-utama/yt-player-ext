import { chromeExtension } from 'rollup-plugin-chrome-extension';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';

const isProduction = process.env.NODE_ENV === 'production';

const chromeExtensionPlugin = chromeExtension({
  manifest: {
    transform: (manifest) => ({
      ...manifest,
      version: process.env.npm_package_version || '3.3.0',
    }),
  },
});

// Polyfill chrome during build to avoid "chrome is not defined" errors
const chromePolyfill = {
  name: 'chrome-polyfill',
  resolveId(source) {
    if (source === 'chrome') return { id: 'chrome', external: true };
    return null;
  },
  load(id) {
    if (id === 'chrome') return 'export default {};';
    return null;
  },
};

export default [
  // Background Script (Service Worker)
  {
    input: 'src/background/bootstrap.js',
    output: {
      file: 'background.js',
      format: 'iife',
      name: 'background',
      sourcemap: true,
      intro: '/* YT Music Custom Player - Background Service Worker */\nvar chrome = chrome || {};',
      globals: { chrome: 'chrome' },
    },
    treeshake: false,
    plugins: [
      chromePolyfill,
      replace({
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
        preventAssignment: true,
      }),
      resolve({ browser: true }),
      commonjs(),
      chromeExtensionPlugin,
      isProduction && terser({
        compress: { passes: 2 },
        mangle: true,
        format: { comments: false },
      }),
    ].filter(Boolean),
    external: ['chrome'],
  },

  // Content Script
  {
    input: 'src/content/index.js',
    output: {
      file: 'content.js',
      format: 'iife',
      name: 'content',
      sourcemap: true,
      intro: '/* YT Music Custom Player - Content Script */\nvar chrome = chrome || {};',
      globals: { chrome: 'chrome' },
    },
    treeshake: false,
    plugins: [
      chromePolyfill,
      replace({
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
        preventAssignment: true,
      }),
      resolve({ browser: true }),
      commonjs(),
      chromeExtensionPlugin,
      isProduction && terser({
        compress: { passes: 2 },
        mangle: true,
        format: { comments: false },
      }),
    ].filter(Boolean),
    external: ['chrome'],
  },

  // Popup Script
  {
    input: 'src/popup/index.js',
    output: {
      file: 'popup.js',
      format: 'iife',
      name: 'popup',
      sourcemap: true,
      intro: '/* YT Music Custom Player - Popup */\nvar chrome = chrome || {};',
      globals: { chrome: 'chrome' },
    },
    treeshake: false,
    plugins: [
      chromePolyfill,
      replace({
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
        preventAssignment: true,
      }),
      resolve({ browser: true }),
      commonjs(),
      chromeExtensionPlugin,
      isProduction && terser({
        compress: { passes: 2 },
        mangle: true,
        format: { comments: false },
      }),
    ].filter(Boolean),
    external: ['chrome'],
  },
];