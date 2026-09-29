/*
 * Bundles Remotion once and renders a representative set of stills from CaptionTypographyLab.
 * This is deliberately a still-only review tool — it never renders the 55-second video.
 *
 * Run from the Remotion project root:
 *   node scripts/render_caption_lab_stills.cjs
 *
 * Or regenerate selected names only (still one bundle):
 *   node scripts/render_caption_lab_stills.cjs 03-confidence 05-rejection-future
 */

const fs = require('fs');
const path = require('path');
const { bundle } = require('@remotion/bundler');
const { renderStill, selectComposition } = require('@remotion/renderer');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'caption-lab-stills');

// Frame is chosen after the entry animation settles but while the corresponding phrase is live.
const samples = [
  { frame: 42, name: '01-discipline-freedom' },
  { frame: 120, name: '02-courage-comfort' },
  { frame: 243, name: '03-confidence' },
  { frame: 375, name: '04-himmat-hinglish' },
  { frame: 465, name: '05-rejection-future' },
  { frame: 720, name: '06-decision-change' },
  { frame: 1250, name: '07-freedom-approval' },
  { frame: 1515, name: '08-purpose-sacrifice' },
];

const main = async () => {
  fs.mkdirSync(outputDir, { recursive: true });

  const requested = new Set(process.argv.slice(2));
  const selected = requested.size === 0
    ? samples
    : samples.filter((sample) => requested.has(sample.name));

  if (selected.length === 0) {
    throw new Error(`No matching samples. Choose from: ${samples.map((sample) => sample.name).join(', ')}`);
  }

  console.log('Bundling once...');
  const serveUrl = await bundle({
    entryPoint: path.join(root, 'src', 'index.ts'),
    onProgress: (progress) => {
      if (progress % 20 === 0) console.log(`bundle ${progress}%`);
    },
  });

  const composition = await selectComposition({
    serveUrl,
    id: 'CaptionTypographyLab',
  });

  for (const sample of selected) {
    const output = path.join(outputDir, `${sample.name}.png`);
    console.log(`Rendering frame ${sample.frame}: ${path.basename(output)}`);
    await renderStill({
      composition,
      serveUrl,
      frame: sample.frame,
      output,
      imageFormat: 'png',
    });
  }

  console.log(`Rendered ${selected.length} still(s) to ${outputDir}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
