/** 8×8 average hash — must match scripts/home-receipt-image-hash.mjs (sharp greyscale resize). */

function luminanceAt(data: Uint8ClampedArray, index: number): number {
  return 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
}

function hashFrom8x8Pixels(data: Uint8ClampedArray): string {
  const samples: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    samples.push(luminanceAt(data, i));
  }
  const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  return samples.map((value) => (value >= avg ? '1' : '0')).join('');
}

function resizeTo8x8(source: CanvasImageSource, width: number, height: number): ImageData | null {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.drawImage(source, 0, 0, width, height, 0, 0, 8, 8);
  return ctx.getImageData(0, 0, 8, 8);
}

export function computeImageAHash(imageData: ImageData): string {
  const src = document.createElement('canvas');
  src.width = imageData.width;
  src.height = imageData.height;
  const srcCtx = src.getContext('2d');
  if (!srcCtx) {
    return '';
  }
  srcCtx.putImageData(imageData, 0, 0);
  const small = resizeTo8x8(src, imageData.width, imageData.height);
  return small ? hashFrom8x8Pixels(small.data) : '';
}

export function imageDataFromSource(
  source: CanvasImageSource,
  width: number,
  height: number
): ImageData | null {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.drawImage(source, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

export async function computeAHashFromDataUrl(dataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const small = resizeTo8x8(image, image.width, image.height);
      resolve(small ? hashFrom8x8Pixels(small.data) : null);
    };
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}
