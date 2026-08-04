function maskNamePart(part, visible = 3) {
  if (!part) {
    return '';
  }
  if (part.length <= 2) {
    return `${part[0]}*`;
  }
  const shown = Math.min(visible, part.length - 1);
  return `${part.slice(0, shown)}*`;
}

function maskDisplayName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) {
    return '***';
  }

  if (parts.length === 1) {
    return maskNamePart(parts[0], 3);
  }

  if (parts.length === 2) {
    const first = parts[0].length <= 3 ? `${parts[0].slice(0, 1)}**` : `${parts[0].slice(0, 3)}**`;
    const last = parts[1].length <= 2 ? `${parts[1].slice(0, 1)}*` : `${parts[1].slice(0, 2)}*`;
    return `${first} ${last}`;
  }

  const first = parts[0].length <= 3 ? `${parts[0].slice(0, 1)}**` : `${parts[0].slice(0, 3)}**`;
  const middle = parts
    .slice(1, -1)
    .map((part) => maskNamePart(part, 2))
    .join(' ');
  const last =
    parts[parts.length - 1].length <= 2
      ? `${parts[parts.length - 1].slice(0, 1)}*`
      : `${parts[parts.length - 1].slice(0, 2)}*`;

  return `${first} ${middle} ${last}`;
}

function shortReceiveLabel(label) {
  if (!label) {
    return null;
  }

  const match = String(label).match(/^(.+?)\s·\s(.+)$/);
  if (!match) {
    return label;
  }

  const bankPart = match[1].trim();
  const cardPart = match[2].replace(/\s/g, '');
  const last4 = cardPart.slice(-4);
  return `${bankPart} · ****${last4}`;
}

module.exports = {
  maskDisplayName,
  shortReceiveLabel,
};
