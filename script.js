window.addEventListener('load', async function () {
    const canvas = document.getElementById('matrix');
    const ctx = canvas.getContext('2d');
    const letters = 'EPENEX';
    const fontSize = 32;
    const ratio = window.devicePixelRatio || 1;

    function resize() {
        canvas.width = Math.floor(window.innerWidth * ratio);
        canvas.height = Math.floor(window.innerHeight * ratio);
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.textBaseline = 'top';
    }

    resize();
    window.addEventListener('resize', resize);

    await document.fonts.load(`${fontSize}px "Temple", sans-serif`);
    ctx.font = `${fontSize}px "Temple", sans-serif`;

    let columns = Math.floor(canvas.width / fontSize);
    let drops = new Array(columns).fill(1);
    let offsets = new Array(columns).fill(0).map((_, i) => i % letters.length);

    function draw() {
        ctx.font = `${fontSize}px "Temple", sans-serif`;
        ctx.fillStyle = 'rgba(0,0,0,.1)';
        ctx.fillRect(0, 0, canvas.width / ratio, canvas.height / ratio);
        ctx.fillStyle = '#0f0';
        for (let i = 0; i < drops.length; i++) {
            const idx = (drops[i] - 1 + offsets[i]) % letters.length;
            const ch = letters.charAt(idx);
            ctx.fillText(ch, i * fontSize, drops[i] * fontSize);
            drops[i]++;
            if (drops[i] * fontSize > canvas.height / ratio && Math.random() > 0.95) drops[i] = 0;
        }
    }

    draw();
    canvas.style.visibility = 'visible';
    setInterval(draw, 80);
});
