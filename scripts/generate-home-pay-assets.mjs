
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import {
  RECEIPT_SPECS,
  receiptScanPayload,
  toReceiptRecord,
} from './home-receipts-data.mjs';
import { QR_MERCHANT_SPECS, toQrMerchantRecord } from './pay-qr-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const receiptDir = path.join(root, 'src', 'assets', 'demo-receipts');
const qrDir = path.join(root, 'src', 'assets', 'demo-qr');
const homeReceiptsJson = path.join(root, 'backend', 'data', 'home-receipts.json');
const payQrMerchantsJson = path.join(root, 'backend', 'data', 'pay-qr-merchants.json');

const WIDTH = 360;
const PAD = 28;
const RIGHT = WIDTH - PAD;
const FONT_MONO = 'Courier New, Courier, monospace';
const FONT_SANS = 'Arial, Helvetica, sans-serif';

const MODERN_THEME = {
  outer: '#f0f0f0',
  paper: '#ffffff',
  border: '#e0e0e0',
  text: '#111111',
  muted: '#666666',
  faint: '#999999',
  dash: '#cccccc',
  paymentBg: '#f4f5fa',
  paymentAccent: '#0052cc',
};

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatReceiptDate(dateStr) {
  const [datePart, timePart] = dateStr.split(/\s{2,}/);
  if (!timePart) return datePart;
  const [d, m, y] = datePart.split(' ');
  const [hh, mm] = timePart.split(':');
  const hour = parseInt(hh, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${d} ${m} ${y} ${hour12}:${mm} ${ampm}`;
}

function sansTxt(y, content, opts = {}) {
  const {
    x = WIDTH / 2,
    anchor = 'middle',
    size = 12,
    weight = 'normal',
    fill = MODERN_THEME.text,
  } = opts;
  return `<text x="${x}" y="${y}" font-family="${FONT_SANS}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escapeXml(content)}</text>`;
}

function monoTxt(y, content, opts = {}) {
  const {
    x = PAD,
    anchor = 'start',
    size = 11,
    weight = 'normal',
    fill = MODERN_THEME.text,
  } = opts;
  return `<text x="${x}" y="${y}" font-family="${FONT_MONO}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escapeXml(content)}</text>`;
}

function modernDash(y) {
  return `<line x1="${PAD}" y1="${y}" x2="${RIGHT}" y2="${y}" stroke="${MODERN_THEME.dash}" stroke-width="1" stroke-dasharray="6 4"/>`;
}

function modernSolid(y) {
  return `<line x1="${PAD}" y1="${y}" x2="${RIGHT}" y2="${y}" stroke="${MODERN_THEME.border}" stroke-width="1"/>`;
}

function buildModernCardReceiptSvg(spec) {
  const theme = MODERN_THEME;
  const paymentLabel = spec.paymentMethod || 'NETS Prepaid';
  const maskedCard = spec.cardMask || '**** **** **** 0001';
  const total = parseFloat(spec.total).toFixed(2);
  const dateFormatted = formatReceiptDate(spec.date);

  let y = 44;
  const parts = [];

  parts.push(sansTxt(y, spec.merchant, { size: 22, weight: 'bold' }));
  y += 26;
  parts.push(sansTxt(y, spec.address, { size: 11, fill: theme.muted }));
  y += 18;
  parts.push(sansTxt(y, dateFormatted, { size: 10, fill: theme.faint }));
  y += 22;
  parts.push(modernDash(y));
  y += 22;

  parts.push(sansTxt(y, 'ITEM', { x: PAD, anchor: 'start', size: 9, weight: 'bold', fill: theme.muted }));
  parts.push(sansTxt(y, 'AMT', { x: RIGHT, anchor: 'end', size: 9, weight: 'bold', fill: theme.muted }));
  y += 18;

  for (const [name, price] of spec.items) {
    parts.push(monoTxt(y, name, { size: 11 }));
    parts.push(monoTxt(y, `$${price}`, { x: RIGHT, anchor: 'end', size: 11 }));
    y += 18;
  }

  y += 6;
  parts.push(modernSolid(y));
  y += 26;
  parts.push(sansTxt(y, 'TOTAL', { x: PAD, anchor: 'start', size: 16, weight: 'bold' }));
  parts.push(sansTxt(y, `$${total}`, { x: RIGHT, anchor: 'end', size: 16, weight: 'bold' }));
  y += 28;

  const boxH = 72;
  parts.push(
    `<rect x="${PAD}" y="${y}" width="${WIDTH - PAD * 2}" height="${boxH}" rx="10" fill="${theme.paymentBg}"/>`
  );
  parts.push(sansTxt(y + 22, 'PAYMENT METHOD', { size: 9, weight: 'bold', fill: theme.muted }));
  parts.push(sansTxt(y + 40, paymentLabel, { size: 13, weight: 'bold', fill: theme.paymentAccent }));
  parts.push(monoTxt(y + 58, maskedCard, { x: WIDTH / 2, anchor: 'middle', size: 11, fill: theme.text }));
  y += boxH + 20;

  parts.push(sansTxt(y, 'Thank you for your purchase', { size: 10, fill: theme.faint }));
  y += 24;

  const cardPad = 12;
  const height = y + cardPad;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">
<rect width="${WIDTH}" height="${height}" fill="${theme.outer}"/>
<rect x="10" y="10" width="${WIDTH - 20}" height="${height - 20}" rx="14" fill="${theme.paper}" stroke="${theme.border}" stroke-width="1"/>
${parts.join('\n')}
</svg>`;
}

const THERMAL_THEME = {
  outer: '#d4d4d4',
  paper: '#fafafa',
  text: '#111111',
  muted: '#444444',
  dash: '#888888',
};

function thermalDash(y, width, pad) {
  const right = width - pad;
  return `<line x1="${pad}" y1="${y}" x2="${right}" y2="${y}" stroke="${THERMAL_THEME.dash}" stroke-width="1" stroke-dasharray="4 3"/>`;
}

const OUTER_PAD = 24;
const SLIP_PAD = 14;
/** Reserved blank zone at bottom of slip — scan code is composited here. */
const CODE_AREA_HEIGHT = 108;
const CODE_GAP_AFTER_DASH = 20;

function buildThermalReceiptSvg(spec) {
  const width = spec.slipWidth ?? 280;
  const pad = 18;
  const right = width - pad;
  const brandColor = spec.brandColor || '#111111';
  const outerColor = spec.outerColor || THERMAL_THEME.outer;
  const paymentLabel = spec.paymentMethod || 'NETS Prepaid';
  const maskedCard = spec.cardMask || '****0001';
  const total = parseFloat(spec.total).toFixed(2);
  const dateFormatted = formatReceiptDate(spec.date);
  const addressLines = Array.isArray(spec.address) ? spec.address : [spec.address];

  let y = 44;
  const parts = [];

  parts.push(`<rect x="0" y="0" width="${width}" height="10" fill="${brandColor}"/>`);

  parts.push(
    sansTxt(y, spec.merchant, {
      x: width / 2,
      size: 16,
      weight: 'bold',
      fill: brandColor,
    })
  );
  y += 20;
  for (const line of addressLines) {
    parts.push(monoTxt(y, line, { x: width / 2, anchor: 'middle', size: 9, fill: THERMAL_THEME.muted }));
    y += 14;
  }
  y += 8;
  parts.push(thermalDash(y, width, pad));
  y += 16;
  parts.push(monoTxt(y, dateFormatted, { x: width / 2, anchor: 'middle', size: 10, weight: 'bold' }));
  y += 14;
  parts.push(thermalDash(y, width, pad));
  y += 18;

  for (const [name, price] of spec.items) {
    parts.push(monoTxt(y, name, { size: 10 }));
    parts.push(monoTxt(y, price, { x: right, anchor: 'end', size: 10 }));
    y += 16;
  }

  y += 4;
  parts.push(thermalDash(y, width, pad));
  y += 18;
  parts.push(monoTxt(y, 'TOTAL', { size: 11, weight: 'bold' }));
  parts.push(monoTxt(y, `SGD ${total}`, { x: right, anchor: 'end', size: 11, weight: 'bold' }));
  y += 20;
  parts.push(thermalDash(y, width, pad));
  y += 18;
  parts.push(monoTxt(y, `Payment ${paymentLabel}`, { x: width / 2, anchor: 'middle', size: 10 }));
  y += 16;
  parts.push(
    monoTxt(y, `Auth ${maskedCard} APPROVED`, { x: width / 2, anchor: 'middle', size: 10, weight: 'bold' })
  );
  y += 22;
  parts.push(thermalDash(y, width, pad));
  y += CODE_GAP_AFTER_DASH + CODE_AREA_HEIGHT;

  const slipPad = SLIP_PAD;
  const slipW = width;
  const slipH = y + slipPad;
  const outerPad = 24;
  const canvasW = slipW + outerPad * 2;
  const canvasH = slipH + outerPad * 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">
<rect width="${canvasW}" height="${canvasH}" fill="${outerColor}"/>
<rect x="${outerPad}" y="${outerPad}" width="${slipW}" height="${slipH}" fill="${THERMAL_THEME.paper}"/>
<g transform="translate(${outerPad}, ${outerPad})">
${parts.join('\n')}
</g>
</svg>`;
}

function buildReceiptSvg(spec) {
  if (spec.template === 'thermal') {
    return buildThermalReceiptSvg(spec);
  }
  return buildModernCardReceiptSvg(spec);
}

async function buildScanCodeImage(sharp, bwipjs, spec) {
  const payload = receiptScanPayload(spec);

  if (spec.scanType === 'barcode') {
    return bwipjs.toBuffer({
      bcid: 'code128',
      text: payload,
      scale: 2,
      height: 8,
      includetext: false,
      paddingwidth: 4,
      paddingheight: 2,
    });
  }

  return QRCode.toBuffer(payload, {
    width: 96,
    margin: 1,
    color: { dark: '#111111', light: '#ffffff' },
  });
}

function scanCodePlacement(spec, imageWidth, imageHeight, drawWidth, drawHeight) {
  const slipWidth = spec.slipWidth ?? 280;
  const slipH = imageHeight - OUTER_PAD * 2;
  const codeAreaTop = OUTER_PAD + slipH - SLIP_PAD - CODE_AREA_HEIGHT + CODE_GAP_AFTER_DASH;
  const codeAreaHeight = CODE_AREA_HEIGHT - CODE_GAP_AFTER_DASH - 12;
  const left = OUTER_PAD + Math.round((slipWidth - drawWidth) / 2);
  const top = codeAreaTop + Math.max(0, Math.round((codeAreaHeight - drawHeight) / 2));
  return { left, top };
}

async function compositeScanCode(sharp, bwipjs, spec, pngPath) {
  const meta = await sharp(pngPath).metadata();
  const width = meta.width ?? 328;
  const height = meta.height ?? 480;
  const slipWidth = spec.slipWidth ?? 280;
  const codeBuffer = await buildScanCodeImage(sharp, bwipjs, spec);
  const codeMeta = await sharp(codeBuffer).metadata();
  const codeWidth = codeMeta.width ?? 96;
  const codeHeight = codeMeta.height ?? 48;
  const maxCodeWidth =
    spec.scanType === 'qr'
      ? Math.round(slipWidth * 0.34)
      : Math.round(slipWidth * 0.68);
  const scale = Math.min(1, maxCodeWidth / codeWidth);
  const drawWidth = Math.max(8, Math.round(codeWidth * scale));
  const drawHeight = Math.max(8, Math.round(codeHeight * scale));
  const { left, top } = scanCodePlacement(spec, width, height, drawWidth, drawHeight);

  const resized = await sharp(codeBuffer).resize(drawWidth, drawHeight).png().toBuffer();
  const tempPath = `${pngPath}.tmp.png`;
  await sharp(pngPath)
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(tempPath);
  fs.renameSync(tempPath, pngPath);
}

async function main() {
  fs.mkdirSync(receiptDir, { recursive: true });
  fs.mkdirSync(qrDir, { recursive: true });

  let sharp;
  let bwipjs;
  try {
    sharp = (await import('sharp')).default;
    bwipjs = (await import('bwip-js')).default;
  } catch {
    console.error('Missing sharp or bwip-js. Run: npm install sharp bwip-js --save-dev');
    process.exit(1);
  }

  const keepFiles = new Set(RECEIPT_SPECS.map((spec) => spec.filename));
  for (const file of fs.readdirSync(receiptDir)) {
    if (file.endsWith('.png') && !keepFiles.has(file)) {
      fs.unlinkSync(path.join(receiptDir, file));
      console.log('  removed old receipt', file);
    }
  }

  console.log(`Generating ${RECEIPT_SPECS.length} receipt images...`);
  const receiptRecords = [];
  for (const spec of RECEIPT_SPECS) {
    const svg = buildReceiptSvg(spec);
    const outPath = path.join(receiptDir, spec.filename);
    await sharp(Buffer.from(svg)).png().toFile(outPath);
    await compositeScanCode(sharp, bwipjs, spec, outPath);
    receiptRecords.push(toReceiptRecord(spec));
    console.log('  receipt', spec.filename, `(${spec.scanType})`);
  }

  console.log(`Generating ${QR_MERCHANT_SPECS.length} merchant QR images...`);
  for (const spec of QR_MERCHANT_SPECS) {
    const record = toQrMerchantRecord(spec);
    const outPath = path.join(qrDir, record.filename);
    await QRCode.toFile(outPath, record.payload, {
      width: 280,
      margin: 2,
      color: { dark: '#111111', light: '#ffffff' },
    });
    console.log('  qr', record.filename);
  }

  fs.writeFileSync(homeReceiptsJson, JSON.stringify({ receipts: receiptRecords }, null, 2));
  fs.writeFileSync(
    payQrMerchantsJson,
    JSON.stringify({ merchants: QR_MERCHANT_SPECS.map(toQrMerchantRecord) }, null, 2)
  );
  console.log('Wrote', homeReceiptsJson);
  console.log('Wrote', payQrMerchantsJson);
  console.log(`Done — ${RECEIPT_SPECS.length} receipts + ${QR_MERCHANT_SPECS.length} QR codes.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
