/** Map object-fit:cover display coords → source video pixel rect. */
export function objectFitCoverTransform(
  videoWidth: number,
  videoHeight: number,
  displayWidth: number,
  displayHeight: number
): { scale: number; offsetX: number; offsetY: number } {
  const scale = Math.max(displayWidth / videoWidth, displayHeight / videoHeight);
  const scaledWidth = videoWidth * scale;
  const scaledHeight = videoHeight * scale;
  return {
    scale,
    offsetX: (displayWidth - scaledWidth) / 2,
    offsetY: (displayHeight - scaledHeight) / 2,
  };
}

/** Crop a region of the live video that aligns with an on-screen element (e.g. scan frame). */
export function captureRegionFromVideo(
  video: HTMLVideoElement,
  previewElement: HTMLElement,
  regionElement: HTMLElement,
  scale = 1
): ImageData | null {
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  if (!videoWidth || !videoHeight) {
    return null;
  }

  const previewRect = previewElement.getBoundingClientRect();
  const regionRect = regionElement.getBoundingClientRect();
  const { scale: coverScale, offsetX, offsetY } = objectFitCoverTransform(
    videoWidth,
    videoHeight,
    previewRect.width,
    previewRect.height
  );

  const cx = regionRect.left + regionRect.width / 2;
  const cy = regionRect.top + regionRect.height / 2;
  const width = regionRect.width * scale;
  const height = regionRect.height * scale;
  const left = cx - width / 2;
  const top = cy - height / 2;

  const sx = Math.max(0, Math.floor((left - previewRect.left - offsetX) / coverScale));
  const sy = Math.max(0, Math.floor((top - previewRect.top - offsetY) / coverScale));
  const sw = Math.max(8, Math.min(videoWidth - sx, Math.ceil(width / coverScale)));
  const sh = Math.max(8, Math.min(videoHeight - sy, Math.ceil(height / coverScale)));

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
  return ctx.getImageData(0, 0, sw, sh);
}

export function captureFullVideoFrame(video: HTMLVideoElement): ImageData | null {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx || !video.videoWidth || !video.videoHeight) {
    return null;
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
