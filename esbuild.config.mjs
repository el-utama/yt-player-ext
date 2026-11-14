import esbuild from 'esbuild';

const isProduction = process.env.NODE_ENV === 'production';
const isWatch = process.argv.includes('--watch');

const commonConfig = {
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'chrome110',
  sourcemap: true,
  banner: { js: 'var chrome = chrome || {};' },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  external: ['chrome'],
  treeShaking: isProduction,
  minify: isProduction,
  logLevel: 'info',
};

async function buildAll() {
  const configs = [
    { ...commonConfig, entryPoints: ['src/background/bootstrap.js'], outfile: 'background.js', globalName: 'background' },
    { ...commonConfig, entryPoints: ['src/content/index.js'], outfile: 'content.js', globalName: 'content' },
    { ...commonConfig, entryPoints: ['src/popup/index.js'], outfile: 'popup.js', globalName: 'popup' },
    { ...commonConfig, entryPoints: ['src/options/index.js'], outfile: 'options.js', globalName: 'options' },
  ];

  if (isWatch) {
    // Watch mode
    for (const config of configs) {
      await esbuild.build({ ...config, watch: {
        onRebuild(error, result) {
          if (error) console.error('Watch build failed:', error);
          else console.log(`✓ ${config.outfile} rebuilt`);
        }
      }});
    }
    console.log('Watch mode started...');
  } else {
    // Production build
    for (const config of configs) {
      await esbuild.build(config);
      console.log(`✓ ${config.outfile} built`);
    }
    console.log('Build completed successfully!');
  }
}

buildAll().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});