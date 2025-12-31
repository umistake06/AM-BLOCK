const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');

let gridCount = 8;
let gap = 4;
let cellSize, isPaused = false, isGameOver = false;
let grid = Array(gridCount).fill().map(() => Array(gridCount).fill(0));
let hand = [], particles = [], score = 0, shake = 0;
let best = localStorage.getItem('best_score') || 0;
document.getElementById('best').innerText = best;

const audio = {
    ctx: null,
    play(freq, type, duration) {
        try {
            if(!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            if(this.ctx.state === 'suspended') this.ctx.resume();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + duration);
            gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.start(); osc.stop(this.ctx.currentTime + duration);
        } catch(e) {}
    }
};

let isDragging = false, draggedPiece = null;
let mouse = { x: 0, y: 0 };
let grabOffset = { x: 0, y: 0 }; 
const liftY = 110; // На сколько блок поднимается над пальцем

const SHAPES = [
    { m: [[1,1],[1,1]], c: '#FF4757' }, { m: [[1,1,1,1]], c: '#4E7DFA' },
    { m: [[1,1,1]], c: '#2ED573' }, { m: [[1,1,1],[0,1,0]], c: '#A29BFE' },
    { m: [[1,1,0],[0,1,1]], c: '#FFA502' }, { m: [[1]], c: '#ECCC68' },
    { m: [[1,0],[1,0],[1,1]], c: '#70A1FF' }
];

function init() {
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    const size = Math.min(ww - 20, 450, wh * 0.6);
    canvas.width = size;
    canvas.height = size + (size * 0.45); 
    cellSize = (size - (gap * (gridCount + 1))) / gridCount;
    spawnHand();
}

function spawnHand() {
    hand = [];
    for(let i=0; i<3; i++) {
        const shape = SHAPES[Math.floor(Math.random()*SHAPES.length)];
        const x = (canvas.width / 3) * i + (canvas.width / 6);
        const y = canvas.width + (canvas.height - canvas.width) / 1.8;
        hand.push({
            ...shape, x, y, curX: x, curY: y, placed: false, scale: 0.55
        });
    }
}

function startGame() {
    document.getElementById('menu').style.display = 'none';
    init(); requestAnimationFrame(loop);
}

function togglePause() {
    if(isGameOver) return;
    isPaused = !isPaused;
    document.getElementById('pause-screen').style.display = isPaused ? 'flex' : 'none';
}
document.getElementById('p-btn').onclick = togglePause;

function createParticles(x, y, color) {
    for(let i=0; i<6; i++) {
        particles.push({
            x, y, color, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10,
            life: 1.0, size: Math.random()*4 + 2
        });
    }
}

function clearLines() {
    let rows = [], cols = [];
    for(let i=0; i<gridCount; i++) {
        if(grid[i].every(v => v)) rows.push(i);
        let colFull = true;
        for(let j=0; j<gridCount; j++) if(!grid[j][i]) colFull = false;
        if(colFull) cols.push(i);
    }
    
    if(rows.length || cols.length) {
        shake = 12;
        audio.play(700, 'triangle', 0.3);
        rows.forEach(r => {
            grid[r].forEach((c, idx) => createParticles(idx*(cellSize+gap)+cellSize/2, r*(cellSize+gap)+cellSize/2, c));
            grid[r].fill(0);
        });
        cols.forEach(c => {
            grid.forEach((row, idx) => {
                createParticles(c*(cellSize+gap)+cellSize/2, idx*(cellSize+gap)+cellSize/2, row[c]);
                row[c] = 0;
            });
        });
        score += (rows.length + cols.length) * 100;
        updateScore();
    }
}

function updateScore() {
    scoreEl.innerText = score;
    if(score > best) {
        best = score; localStorage.setItem('best_score', best);
        document.getElementById('best').innerText = best;
    }
}

function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
}

canvas.addEventListener('pointerdown', e => {
    if(isPaused || isGameOver) return;
    const p = getPos(e);
    hand.forEach(piece => {
        if(!piece.placed && Math.abs(p.x - piece.curX) < 45 && Math.abs(p.y - piece.curY) < 45) {
            isDragging = true;
            draggedPiece = piece;
            mouse = p;
            // Рассчитываем оффсет, чтобы при клике блок не прыгал
            grabOffset.x = p.x - piece.curX;
            grabOffset.y = p.y - piece.curY;
            audio.play(400, 'sine', 0.05);
        }
    });
});

window.addEventListener('pointermove', e => {
    if(isDragging) mouse = getPos(e);
});

window.addEventListener('pointerup', () => {
    if(!isDragging) return;
    
    const tx = mouse.x - grabOffset.x;
    const ty = (mouse.y - liftY) - grabOffset.y;
    
    const gx = Math.round((tx - (draggedPiece.m[0].length * cellSize / 2)) / (cellSize + gap));
    const gy = Math.round((ty - (draggedPiece.m.length * cellSize / 2)) / (cellSize + gap));

    if(canPlace(draggedPiece.m, gx, gy)) {
        draggedPiece.m.forEach((row, y) => {
            row.forEach((v, x) => { if(v) grid[gy+y][gx+x] = draggedPiece.c; });
        });
        draggedPiece.placed = true;
        score += 10; updateScore();
        audio.play(500, 'sine', 0.1);
        clearLines();
        if(hand.every(p => p.placed)) spawnHand();
    } else {
        audio.play(100, 'sawtooth', 0.1);
    }
    isDragging = false; draggedPiece = null;
    checkGameOver();
});

function canPlace(matrix, gx, gy) {
    for(let y=0; y<matrix.length; y++) {
        for(let x=0; x<matrix[y].length; x++) {
            if(matrix[y][x]) {
                let ty = gy + y, tx = gx + x;
                if(ty < 0 || ty >= gridCount || tx < 0 || tx >= gridCount || grid[ty][tx]) return false;
            }
        }
    }
    return true;
}

function checkGameOver() {
    const alive = hand.some(p => {
        if(p.placed) return false;
        for(let r=0; r<gridCount; r++)
            for(let c=0; c<gridCount; c++)
                if(canPlace(p.m, c, r)) return true;
        return false;
    });
    if(!alive && hand.length > 0) {
        isGameOver = true;
        document.getElementById('game-over').style.display = 'flex';
        document.getElementById('final-score').innerText = "ИТОГ: " + score;
    }
}

function loop() {
    if(!isPaused) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.save();
        if(shake > 0) { ctx.translate(Math.random()*shake-shake/2, Math.random()*shake-shake/2); shake *= 0.85; }

        // Фон ячеек
        for(let r=0; r<gridCount; r++) {
            for(let c=0; c<gridCount; c++) {
                ctx.fillStyle = grid[r][c] || '#1c1c24';
                ctx.beginPath();
                ctx.roundRect(gap + c*(cellSize+gap), gap + r*(cellSize+gap), cellSize, cellSize, 6);
                ctx.fill();
            }
        }

        // Эффект призрака (куда встанет блок)
        if(isDragging && draggedPiece) {
            const tx = mouse.x - grabOffset.x;
            const ty = (mouse.y - liftY) - grabOffset.y;
            const gx = Math.round((tx - (draggedPiece.m[0].length * cellSize / 2)) / (cellSize + gap));
            const gy = Math.round((ty - (draggedPiece.m.length * cellSize / 2)) / (cellSize + gap));
            if(canPlace(draggedPiece.m, gx, gy)) {
                ctx.globalAlpha = 0.25;
                drawMatrix(draggedPiece.m, gap + gx*(cellSize+gap), gap + gy*(cellSize+gap), draggedPiece.c, cellSize);
                ctx.globalAlpha = 1.0;
            }
        }

        // Частицы
        particles.forEach((p, i) => {
            p.x += p.vx; p.y += p.vy; p.life -= 0.025;
            ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
            if(p.life <= 0) particles.splice(i, 1);
        });
        ctx.globalAlpha = 1.0;
        ctx.restore();

        // Фигуры в руке
        hand.forEach(p => {
            if(p.placed) return;
            let targetX, targetY, targetScale;
            
            if(isDragging && p === draggedPiece) {
                targetX = mouse.x - grabOffset.x - (p.m[0].length * cellSize)/2;
                targetY = (mouse.y - liftY) - grabOffset.y - (p.m.length * cellSize)/2;
                targetScale = 1.0;
            } else {
                targetX = p.x - (p.m[0].length * cellSize * 0.55)/2;
                targetY = p.y - (p.m.length * cellSize * 0.55)/2;
                targetScale = 0.55;
            }
            
            // Плавное следование (LERP) - 0.25 для еще большей отзывчивости
            p.curX += (targetX - p.curX) * 0.25;
            p.curY += (targetY - p.curY) * 0.25;
            p.scale += (targetScale - p.scale) * 0.25;
            drawMatrix(p.m, p.curX, p.curY, p.c, cellSize * p.scale);
        });
    }
    requestAnimationFrame(loop);
}

function drawMatrix(m, ox, oy, c, s) {
    ctx.fillStyle = c;
    const sGap = gap * (s / cellSize);
    m.forEach((row, y) => {
        row.forEach((v, x) => {
            if(v) {
                ctx.beginPath();
                ctx.roundRect(ox + x*(s+sGap), oy + y*(s+sGap), s, s, 5);
                ctx.fill();
                // Блик для объема
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.fillRect(ox + x*(s+sGap), oy + y*(s+sGap), s, s/3);
                ctx.fillStyle = c;
            }
        });
    });
}
