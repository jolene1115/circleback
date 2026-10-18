// Shared drawing primitives for the continuous-line interviewer.

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function samplePath(d, count) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  const length = path.getTotalLength();
  return Array.from({length: count}, (_, i) => path.getPointAtLength((i * length) / (count - 1)));
}

// The interviewer: one sampled curve (head, face and shoulders), in 1000x500 canvas units.
export const figure = samplePath(
  'M 225 425 C 270 389 325 382 368 373 C 392 368 400 353 391 335 C 357 323 337 296 333 262 C 329 228 327 201 343 171 C 362 131 405 104 453 110 C 509 116 539 146 537 190 C 537 211 529 220 514 221 C 492 224 475 209 451 209 C 427 208 410 224 390 224 C 376 224 368 215 375 206 C 382 195 402 200 405 212 C 408 226 393 233 380 224 C 402 240 426 224 449 222 C 468 222 480 224 488 213 C 499 196 521 200 519 214 C 517 228 497 229 488 218 C 477 233 481 248 486 262 C 492 278 474 282 461 276 C 453 272 462 262 467 270 C 474 284 470 297 455 301 C 442 305 427 300 420 306 C 430 320 456 321 473 311 C 493 301 510 281 518 261 C 521 290 509 321 488 337 C 477 345 477 362 491 370 C 533 386 589 386 638 425',
  520,
).map(p => ({x: p.x + 65, y: p.y - 12}));

// The waving hand drawn after the figure on the landing page.
export const greetingPoints = samplePath(
  'M 703 413 C 724 427 738 443 751 441 C 772 438 782 403 785 376 C 787 360 779 348 772 337 C 764 325 755 314 760 309 C 767 301 778 317 787 327 C 782 308 772 277 778 271 C 789 260 794 295 799 314 C 798 293 790 256 799 254 C 811 250 809 290 812 310 C 814 292 812 264 821 266 C 831 268 823 300 824 317 C 830 303 831 286 838 289 C 849 294 832 329 830 347 C 827 365 820 374 814 386 C 809 404 805 435 791 454',
  180,
);

// Glowing line: a soft wide pass, then the crisp line on top.
export function strokeMoonLine(c, color, opacity = 1) {
  c.save();
  const matrix = c.getTransform(),
    scale = Math.hypot(matrix.a, matrix.b);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = color;
  c.shadowColor = color;
  c.shadowBlur = 3 * scale;
  c.globalAlpha = 0.16 * opacity;
  c.lineWidth = 2.8;
  c.stroke();
  c.shadowBlur = 0;
  c.globalAlpha = opacity;
  c.lineWidth = 2.2;
  c.stroke();
  c.restore();
}

// The figure as drawn at rest (used by the ink editor and saved-interviewer thumbnails).
export function traceRestingFigure(c, flattenSmile = true) {
  c.beginPath();
  figure.forEach((p, i) => {
    const mouth = flattenSmile ? Math.exp(-Math.pow((p.x - 510) / 35, 2) - Math.pow((p.y - 297) / 17, 2)) : 0;
    const y = p.y - (p.y - 290) * mouth * 0.72;
    i ? c.lineTo(p.x, y) : c.moveTo(p.x, y);
  });
}
