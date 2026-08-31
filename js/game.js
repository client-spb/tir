// Game Constants
const CANVAS = document.getElementById('gameCanvas');
const CTX = CANVAS.getContext('2d');
const SCORE_ELEMENT = document.getElementById('score');
const FINAL_SCORE_ELEMENT = document.getElementById('final-score');
const HEALTH_FILL = document.getElementById('health-fill');
const START_SCREEN = document.getElementById('start-screen');
const GAME_OVER_SCREEN = document.getElementById('game-over-screen');
const START_BTN = document.getElementById('start-btn');
const RESTART_BTN = document.getElementById('restart-btn');

// SVG Asset IDs
const SVG_ASSETS = {
    player: 'svg-player',
    alien1: 'svg-alien1',
    alien2: 'svg-alien2',
    asteroid: 'svg-asteroid',
    enemyShip: 'svg-enemy-ship',
    bonusShield: 'svg-bonus-shield',
    bonusPowerup: 'svg-bonus-powerup',
    bonusHealth: 'svg-bonus-health'
};

// Game State
let gameState = {
    isRunning: false,
    score: 0,
    health: 100,
    maxHealth: 100,
    lastTime: 0,
    spawnTimer: 0,
    bonusTimer: 0,
    difficulty: 1
};

// Player
let player = {
    x: 0,
    y: 0,
    width: 48,
    height: 48,
    speed: 0,
    fireRate: 300,
    lastFire: 0,
    powerLevel: 1,
    hasShield: false,
    shieldTime: 0
};

// Arrays for game objects
let bullets = [];
let enemies = [];
let particles = [];
let bonuses = [];
let stars = [];

// Resize canvas
function resizeCanvas() {
    CANVAS.width = window.innerWidth;
    CANVAS.height = window.innerHeight;
    player.y = CANVAS.height - 100;
}

// Initialize stars background
function initStars() {
    stars = [];
    for (let i = 0; i < 150; i++) {
        stars.push({
            x: Math.random() * CANVAS.width,
            y: Math.random() * CANVAS.height,
            size: Math.random() * 2 + 0.5,
            speed: Math.random() * 2 + 0.5,
            brightness: Math.random()
        });
    }
}

// Draw starfield background
function drawStars(deltaTime) {
    CTX.fillStyle = '#000000';
    CTX.fillRect(0, 0, CANVAS.width, CANVAS.height);
    
    stars.forEach(star => {
        star.y += star.speed * (deltaTime / 16);
        if (star.y > CANVAS.height) {
            star.y = 0;
            star.x = Math.random() * CANVAS.width;
        }
        
        const alpha = 0.5 + Math.sin(Date.now() * 0.005 * star.brightness) * 0.5;
        CTX.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        CTX.beginPath();
        CTX.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        CTX.fill();
    });
}

// Get SVG element as image
function getSVGElement(id) {
    const symbol = document.getElementById(id);
    if (!symbol) return null;
    
    const svgData = new XMLSerializer().serializeToString(symbol);
    const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(svgBlob);
    
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = url;
    });
}

// Cache SVG images
const svgImages = {};
async function loadSVGAssets() {
    for (const [key, id] of Object.entries(SVG_ASSETS)) {
        svgImages[key] = await getSVGElement(id);
    }
}

// Draw SVG sprite
function drawSVGSprite(ctx, key, x, y, size) {
    if (svgImages[key]) {
        ctx.drawImage(svgImages[key], x - size/2, y - size/2, size, size);
    }
}

// Spawn enemy
function spawnEnemy() {
    const types = ['alien1', 'alien2', 'asteroid', 'enemyShip'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let enemy = {
        x: Math.random() * (CANVAS.width - 60) + 30,
        y: -60,
        type: type,
        width: 48,
        height: 48,
        speed: (Math.random() * 2 + 1) * gameState.difficulty,
        health: type === 'asteroid' ? 3 : (type === 'enemyShip' ? 2 : 1),
        scoreValue: type === 'asteroid' ? 30 : (type === 'enemyShip' ? 50 : 20)
    };
    
    if (type === 'enemyShip') {
        enemy.fireRate = 2000;
        enemy.lastFire = Date.now();
    }
    
    enemies.push(enemy);
}

// Spawn bonus
function spawnBonus(x, y) {
    if (Math.random() > 0.15) return; // 15% chance
    
    const types = ['bonusShield', 'bonusPowerup', 'bonusHealth'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    bonuses.push({
        x: x,
        y: y,
        type: type,
        width: 32,
        height: 32,
        speed: 2
    });
}

// Create explosion particles
function createExplosion(x, y, color, count = 15) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 1,
            decay: Math.random() * 0.03 + 0.02,
            color: color,
            size: Math.random() * 4 + 2
        });
    }
}

// Update particles
function updateParticles(deltaTime) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * (deltaTime / 16);
        p.y += p.vy * (deltaTime / 16);
        p.life -= p.decay;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

// Draw particles
function drawParticles() {
    particles.forEach(p => {
        CTX.globalAlpha = p.life;
        CTX.fillStyle = p.color;
        CTX.beginPath();
        CTX.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        CTX.fill();
    });
    CTX.globalAlpha = 1;
}

// Fire bullet
function fireBullet() {
    const now = Date.now();
    if (now - player.lastFire < player.fireRate) return;
    
    player.lastFire = now;
    
    if (player.powerLevel === 1) {
        bullets.push({
            x: player.x,
            y: player.y - player.height/2,
            width: 4,
            height: 16,
            speed: 10,
            isEnemy: false
        });
    } else if (player.powerLevel === 2) {
        bullets.push(
            { x: player.x - 10, y: player.y - player.height/2, width: 4, height: 16, speed: 10, isEnemy: false },
            { x: player.x + 10, y: player.y - player.height/2, width: 4, height: 16, speed: 10, isEnemy: false }
        );
    } else {
        bullets.push(
            { x: player.x, y: player.y - player.height/2, width: 4, height: 16, speed: 10, isEnemy: false },
            { x: player.x - 15, y: player.y - player.height/2 + 10, width: 4, height: 16, speed: 9, isEnemy: false },
            { x: player.x + 15, y: player.y - player.height/2 + 10, width: 4, height: 16, speed: 9, isEnemy: false }
        );
    }
}

// Enemy fire
function enemyFire(enemy) {
    bullets.push({
        x: enemy.x,
        y: enemy.y + enemy.height/2,
        width: 6,
        height: 12,
        speed: 6,
        isEnemy: true,
        color: '#ff4500'
    });
}

// Update bullets
function updateBullets(deltaTime) {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.y += (b.isEnemy ? b.speed : -b.speed) * (deltaTime / 16);
        
        if (b.y < -20 || b.y > CANVAS.height + 20) {
            bullets.splice(i, 1);
        }
    }
}

// Draw bullets
function drawBullets() {
    bullets.forEach(b => {
        if (b.isEnemy) {
            CTX.fillStyle = b.color || '#ff4500';
            CTX.beginPath();
            CTX.arc(b.x, b.y, 5, 0, Math.PI * 2);
            CTX.fill();
        } else {
            CTX.fillStyle = '#00ffff';
            CTX.shadowBlur = 10;
            CTX.shadowColor = '#00ffff';
            CTX.fillRect(b.x - b.width/2, b.y - b.height/2, b.width, b.height);
            CTX.shadowBlur = 0;
        }
    });
}

// Update enemies
function updateEnemies(deltaTime) {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.y += e.speed * (deltaTime / 16);
        
        // Enemy ship shooting
        if (e.type === 'enemyShip') {
            if (Date.now() - e.lastFire > e.fireRate) {
                enemyFire(e);
                e.lastFire = Date.now();
            }
        }
        
        if (e.y > CANVAS.height + 60) {
            enemies.splice(i, 1);
        }
    }
}

// Draw enemies
function drawEnemies() {
    enemies.forEach(e => {
        let svgKey;
        switch(e.type) {
            case 'alien1': svgKey = 'alien1'; break;
            case 'alien2': svgKey = 'alien2'; break;
            case 'asteroid': svgKey = 'asteroid'; break;
            case 'enemyShip': svgKey = 'enemyShip'; break;
            default: svgKey = 'alien1';
        }
        drawSVGSprite(CTX, svgKey, e.x, e.y, e.width);
    });
}

// Update bonuses
function updateBonuses(deltaTime) {
    for (let i = bonuses.length - 1; i >= 0; i--) {
        const b = bonuses[i];
        b.y += b.speed * (deltaTime / 16);
        
        if (b.y > CANVAS.height + 40) {
            bonuses.splice(i, 1);
        }
    }
}

// Draw bonuses
function drawBonuses() {
    bonuses.forEach(b => {
        let svgKey;
        switch(b.type) {
            case 'bonusShield': svgKey = 'bonusShield'; break;
            case 'bonusPowerup': svgKey = 'bonusPowerup'; break;
            case 'bonusHealth': svgKey = 'bonusHealth'; break;
            default: svgKey = 'bonusPowerup';
        }
        drawSVGSprite(CTX, svgKey, b.x, b.y, b.width);
    });
}

// Check collisions
function checkCollisions() {
    // Bullets vs Enemies
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        if (b.isEnemy) continue;
        
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            const dx = b.x - e.x;
            const dy = b.y - e.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < e.width/2 + b.width) {
                e.health--;
                bullets.splice(i, 1);
                
                if (e.health <= 0) {
                    createExplosion(e.x, e.y, '#ffa500');
                    gameState.score += e.scoreValue;
                    SCORE_ELEMENT.textContent = gameState.score;
                    spawnBonus(e.x, e.y);
                    enemies.splice(j, 1);
                } else {
                    createExplosion(e.x, e.y, '#ffff00', 5);
                }
                break;
            }
        }
    }
    
    // Enemy bullets vs Player
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        if (!b.isEnemy) continue;
        
        const dx = b.x - player.x;
        const dy = b.y - player.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < player.width/2) {
            if (player.hasShield) {
                player.hasShield = false;
                bullets.splice(i, 1);
                createExplosion(player.x, player.y, '#00bfff', 20);
            } else {
                gameState.health -= 10;
                updateHealthBar();
                bullets.splice(i, 1);
                createExplosion(player.x, player.y, '#ff0000', 10);
                
                if (gameState.health <= 0) {
                    gameOver();
                }
            }
        }
    }
    
    // Enemies vs Player
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < (e.width + player.width) / 2) {
            if (player.hasShield) {
                player.hasShield = false;
                enemies.splice(i, 1);
                createExplosion(e.x, e.y, '#00bfff', 20);
                createExplosion(player.x, player.y, '#00bfff', 20);
            } else {
                gameState.health -= 20;
                updateHealthBar();
                enemies.splice(i, 1);
                createExplosion(e.x, e.y, '#ff0000', 15);
                createExplosion(player.x, player.y, '#ff0000', 10);
                
                if (gameState.health <= 0) {
                    gameOver();
                }
            }
        }
    }
    
    // Bonuses vs Player
    for (let i = bonuses.length - 1; i >= 0; i--) {
        const b = bonuses[i];
        const dx = b.x - player.x;
        const dy = b.y - player.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < (b.width + player.width) / 2) {
            applyBonus(b.type);
            bonuses.splice(i, 1);
        }
    }
}

// Apply bonus effect
function applyBonus(type) {
    switch(type) {
        case 'bonusShield':
            player.hasShield = true;
            player.shieldTime = Date.now() + 10000;
            break;
        case 'bonusPowerup':
            player.powerLevel = Math.min(player.powerLevel + 1, 3);
            break;
        case 'bonusHealth':
            gameState.health = Math.min(gameState.health + 25, gameState.maxHealth);
            updateHealthBar();
            break;
    }
    gameState.score += 10;
    SCORE_ELEMENT.textContent = gameState.score;
}

// Update health bar
function updateHealthBar() {
    const percent = (gameState.health / gameState.maxHealth) * 100;
    HEALTH_FILL.style.width = percent + '%';
    
    if (percent > 60) {
        HEALTH_FILL.style.background = 'linear-gradient(90deg, #00ff00, #00ff00)';
    } else if (percent > 30) {
        HEALTH_FILL.style.background = 'linear-gradient(90deg, #ffff00, #ffa500)';
    } else {
        HEALTH_FILL.style.background = 'linear-gradient(90deg, #ff0000, #ff0000)';
    }
}

// Draw player
function drawPlayer() {
    if (player.hasShield) {
        CTX.globalAlpha = 0.5 + Math.sin(Date.now() * 0.01) * 0.2;
        CTX.fillStyle = '#00bfff';
        CTX.beginPath();
        CTX.arc(player.x, player.y, player.width/2 + 10, 0, Math.PI * 2);
        CTX.fill();
        CTX.globalAlpha = 1;
    }
    
    drawSVGSprite(CTX, 'player', player.x, player.y, player.width);
}

// Touch/Mouse controls
function handleInput(x, y) {
    if (!gameState.isRunning) return;
    player.x = Math.max(player.width/2, Math.min(CANVAS.width - player.width/2, x));
    player.y = Math.max(player.height/2, Math.min(CANVAS.height - player.height/2, y));
}

// Touch events
CANVAS.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleInput(touch.clientX, touch.clientY);
}, { passive: false });

CANVAS.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleInput(touch.clientX, touch.clientY);
}, { passive: false });

// Mouse events for desktop testing
CANVAS.addEventListener('mousemove', (e) => {
    if (e.buttons === 1) {
        handleInput(e.clientX, e.clientY);
    }
});

CANVAS.addEventListener('click', (e) => {
    handleInput(e.clientX, e.clientY);
});

// Game loop
function gameLoop(currentTime) {
    if (!gameState.isRunning) return;
    
    const deltaTime = currentTime - gameState.lastTime;
    gameState.lastTime = currentTime;
    
    // Clear and draw background
    drawStars(deltaTime);
    
    // Auto-fire
    fireBullet();
    
    // Spawn enemies
    gameState.spawnTimer += deltaTime;
    if (gameState.spawnTimer > 1500 / gameState.difficulty) {
        spawnEnemy();
        gameState.spawnTimer = 0;
    }
    
    // Spawn bonuses occasionally
    gameState.bonusTimer += deltaTime;
    if (gameState.bonusTimer > 10000) {
        spawnBonus(Math.random() * (CANVAS.width - 40) + 20, -40);
        gameState.bonusTimer = 0;
    }
    
    // Increase difficulty
    gameState.difficulty = 1 + Math.floor(gameState.score / 500) * 0.2;
    
    // Update game objects
    updateBullets(deltaTime);
    updateEnemies(deltaTime);
    updateBonuses(deltaTime);
    updateParticles(deltaTime);
    
    // Check collisions
    checkCollisions();
    
    // Update shield timer
    if (player.hasShield && Date.now() > player.shieldTime) {
        player.hasShield = false;
    }
    
    // Draw everything
    drawBonuses();
    drawEnemies();
    drawBullets();
    drawParticles();
    drawPlayer();
    
    requestAnimationFrame(gameLoop);
}

// Start game
function startGame() {
    gameState = {
        isRunning: true,
        score: 0,
        health: 100,
        maxHealth: 100,
        lastTime: performance.now(),
        spawnTimer: 0,
        bonusTimer: 0,
        difficulty: 1
    };
    
    player = {
        x: CANVAS.width / 2,
        y: CANVAS.height - 100,
        width: 48,
        height: 48,
        speed: 0,
        fireRate: 300,
        lastFire: 0,
        powerLevel: 1,
        hasShield: false,
        shieldTime: 0
    };
    
    bullets = [];
    enemies = [];
    particles = [];
    bonuses = [];
    
    SCORE_ELEMENT.textContent = '0';
    updateHealthBar();
    
    START_SCREEN.classList.remove('active');
    GAME_OVER_SCREEN.classList.remove('active');
    
    gameState.lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

// Game over
function gameOver() {
    gameState.isRunning = false;
    FINAL_SCORE_ELEMENT.textContent = gameState.score;
    GAME_OVER_SCREEN.classList.add('active');
}

// Event listeners
START_BTN.addEventListener('click', startGame);
RESTART_BTN.addEventListener('click', startGame);

// Initialize
window.addEventListener('resize', () => {
    resizeCanvas();
    initStars();
});

async function init() {
    resizeCanvas();
    initStars();
    await loadSVGAssets();
    drawStars(16);
    drawPlayer();
}

init();
