(function () {
  const canvas = document.querySelector('#welcomeScene');
  const context = canvas.getContext('2d');
  if (!context) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const start = performance.now();
  const outline = 'rgba(245, 187, 106, .32)';
  const muted = 'rgba(227, 177, 127, .24)';
  const accent = '#ffbd58';
  let frame = 0;
  let lastPaint = 0;

  function trace(points, color, width = 1) {
    context.beginPath();
    const [[firstX, firstY], ...rest] = points;
    context.moveTo(firstX, firstY);
    for (const [x, y] of rest) context.lineTo(x, y);
    context.lineWidth = width;
    context.strokeStyle = color;
    context.stroke();
  }

  function building(x, y, width, height, rise, floors) {
    const right = x + width;
    const ground = y + height;
    const depth = width * .23;
    context.fillStyle = 'rgba(17, 18, 22, .50)';
    context.fillRect(x, y, width, height);
    trace([[x, ground], [x, y], [right, y], [right, ground]], muted);
    trace([[x, y], [x + depth, y - rise], [right + depth, y - rise], [right, y]], outline);
    trace([[right + depth, y - rise], [right + depth, ground - rise]], muted);
    for (let floor = 1; floor <= floors; floor++) {
      const beamY = y + floor * height / (floors + 1);
      trace([[x, beamY], [right, beamY], [right + depth, beamY - rise]], muted);
    }
    trace([[x + width * .36, y], [x + width * .36, ground]], muted);
  }

  function fragments(width, height, seconds) {
    for (let index = 0; index < 30; index++) {
      const offset = index * 2.39996;
      const depth = (index * .211 + .13) % 1;
      const lane = (index * .377 + .09) % 1;
      const x = width * lane + Math.sin(offset + seconds * .58) * (8 + 14 * depth);
      const y = ((depth * height - seconds * (9 + depth * 7)) % height + height) % height;
      const alpha = .18 + .52 * (.5 + .5 * Math.sin(seconds * 1.7 + offset));
      context.globalAlpha = alpha * (lane > .22 && lane < .78 ? .61 : 1);
      context.fillStyle = accent;
      if (index % 7 === 0) {
        context.save();
        context.translate(x, y);
        context.rotate(seconds * .35 + offset);
        context.strokeStyle = accent;
        context.lineWidth = 1;
        context.strokeRect(-3, -3, 6, 6);
        context.restore();
      } else if (index % 4 === 0) {
        trace([[x - 11, y + 8], [x + 5, y - 3]], accent, 1.3);
      } else {
        context.beginPath();
        context.arc(x, y, index % 3 === 0 ? 2 : 1.25, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.globalAlpha = 1;
  }

  function draw(seconds) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    const pixelsWide = Math.round(width * ratio);
    const pixelsHigh = Math.round(height * ratio);
    if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
      canvas.width = pixelsWide;
      canvas.height = pixelsHigh;
    }
    context.setTransform(pixelsWide / width, 0, 0, pixelsHigh / height, 0, 0);
    context.clearRect(0, 0, width, height);
    context.lineJoin = 'round';
    context.lineCap = 'round';

    building(-width * .06, height * .75, width * .40, height * .30, height * .046, 3);
    building(width * .58, height * .66, width * .27, height * .39, height * .043, 4);
    building(width * .77, height * .78, width * .26, height * .27, height * .037, 2);
    fragments(width, height, seconds);
  }

  function animate(now) {
    if (now - lastPaint >= 30) {
      draw((now - start) / 1000);
      lastPaint = now;
    }
    frame = window.requestAnimationFrame(animate);
  }

  function sync() {
    window.cancelAnimationFrame(frame);
    if (document.hidden || !document.body.classList.contains('access-locked')) return;
    if (reducedMotion.matches || document.body.dataset.motion === 'off') {
      draw(0);
      return;
    }
    draw((performance.now() - start) / 1000);
    frame = window.requestAnimationFrame(animate);
  }

  const observer = new MutationObserver(sync);
  observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-motion'] });
  window.addEventListener('resize', sync);
  document.addEventListener('visibilitychange', sync);
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', sync);
  else reducedMotion.addListener(sync);
  sync();
})();
