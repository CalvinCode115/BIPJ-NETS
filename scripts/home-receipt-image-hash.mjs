/** 8×8 average hash for Tab 1 receipt matching (keep in sync with src/app/utils/receipt-image-hash.ts). */
export async function computePngAHash(sharp, input) {
  const { data, info } = await sharp(input)
    .greyscale()
    .resize(8, 8, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = data.slice(0, info.width * info.height);
  const avg = pixels.reduce((sum, value) => sum + value, 0) / pixels.length;
  return Array.from(pixels)
    .map((value) => (value >= avg ? '1' : '0'))
    .join('');
}

async function simulateViewfinderCapture(sharp, pngPath, { canvasW, canvasH, scale, background }) {
  const meta = await sharp(pngPath).metadata();
  const w = meta.width ?? 328;
  const h = meta.height ?? 420;
  const rw = Math.max(8, Math.round(w * scale));
  const rh = Math.max(8, Math.round(h * scale));
  const resized = await sharp(pngPath).resize(rw, rh).png().toBuffer();
  const left = Math.max(0, Math.round((canvasW - rw) / 2));
  const top = Math.max(0, Math.round((canvasH - rh) / 2));

  return sharp({
    create: { width: canvasW, height: canvasH, channels: 3, background },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer();
}

/** Simulates gallery pick, bright phone screen, blurred webcam shots, and viewfinder crops. */
export async function computeAlternateScanHashes(sharp, pngPath) {
  const hashes = new Set();
  const source = sharp(pngPath);
  const meta = await source.metadata();
  const width = meta.width ?? 360;

  const viewfinderShots = await Promise.all([
    simulateViewfinderCapture(sharp, pngPath, {
      canvasW: 640,
      canvasH: 480,
      scale: 0.42,
      background: '#1a1a2e',
    }),
    simulateViewfinderCapture(sharp, pngPath, {
      canvasW: 640,
      canvasH: 480,
      scale: 0.55,
      background: '#1a1a2e',
    }),
    simulateViewfinderCapture(sharp, pngPath, {
      canvasW: 1280,
      canvasH: 720,
      scale: 0.38,
      background: '#252530',
    }),
    simulateViewfinderCapture(sharp, pngPath, {
      canvasW: 800,
      canvasH: 600,
      scale: 0.48,
      background: '#b0b0b0',
    }),
  ]);

  const variants = [
    pngPath,
    source.clone().modulate({ brightness: 1.28, saturation: 0.85 }),
    source.clone().modulate({ brightness: 0.8, saturation: 0.92 }),
    source.clone().modulate({ brightness: 1.45, saturation: 0.7 }),
    source.clone().greyscale().normalize(),
    source.clone().greyscale().linear(1.35, -28),
    source.clone().greyscale().sharpen({ sigma: 0.8 }),
    source.clone().greyscale().blur(1.1),
    source.clone().threshold(145),
    source.clone().blur(0.7),
    source.clone().blur(1.2),
    source.clone().resize({ width: Math.round(width * 0.94) }),
    source.clone().resize({ width: Math.round(width * 1.06) }),
    source.clone().linear(1.15, -18),
    source.clone().linear(0.88, 12),
    ...viewfinderShots,
  ];

  for (const variant of variants) {
    let input;
    if (typeof variant === 'string') {
      input = variant;
    } else if (Buffer.isBuffer(variant)) {
      input = variant;
    } else {
      input = await variant.png().toBuffer();
    }
    hashes.add(await computePngAHash(sharp, input));
  }

  return [...hashes];
}

export function hammingDistance(a, b) {
  if (!a || !b || a.length !== b.length) {
    return Infinity;
  }
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      distance += 1;
    }
  }
  return distance;
}

export function minHashDistance(candidate, references) {
  let best = Infinity;
  for (const reference of references) {
    best = Math.min(best, hammingDistance(candidate, reference));
  }
  return best;
}
