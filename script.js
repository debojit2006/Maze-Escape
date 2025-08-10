// --- Game Constants and Settings ---
const CELL_SIZE = 30;
const PLAYER_SIZE = 20;
const DIFFICULTY_SETTINGS = {
    easy: { size: 9, label: 'Easy (9×9)' },
    medium: { size: 15, label: 'Medium (15×15)' },
    hard: { size: 21, label: 'Hard (21×21)' },
};
const app = document.getElementById('app');
let animationFrameId;

// --- Maze Generator Class ---
class MazeGenerator {
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }

    generate() {
        this._initializeCells();
        const stack = [];
        const startCell = this.cells[0][0];
        startCell.visited = true;
        stack.push(startCell);

        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            const neighbors = this._getUnvisitedNeighbors(current);

            if (neighbors.length > 0) {
                const next = neighbors[Math.floor(Math.random() * neighbors.length)];
                this._removeWall(current, next);
                next.visited = true;
                stack.push(next);
            } else {
                stack.pop();
            }
        }

        return {
            cells: this.cells,
            width: this.width,
            height: this.height,
            start: { x: 0, y: 0 },
            end: { x: this.width - 1, y: this.height - 1 },
            collectibles: this._generateCollectibles(),
        };
    }

    _initializeCells() {
        this.cells = [];
        for (let y = 0; y < this.height; y++) {
            this.cells[y] = [];
            for (let x = 0; x < this.width; x++) {
                this.cells[y][x] = {
                    x, y, visited: false,
                    walls: { top: true, right: true, bottom: true, left: true },
                };
            }
        }
    }

    _getCell(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
        return this.cells[y][x];
    }

    _getUnvisitedNeighbors(cell) {
        const neighbors = [];
        const { x, y } = cell;
        const potentialNeighbors = [
            this._getCell(x, y - 1), // top
            this._getCell(x + 1, y), // right
            this._getCell(x, y + 1), // bottom
            this._getCell(x - 1, y), // left
        ];
        potentialNeighbors.forEach(n => {
            if (n && !n.visited) neighbors.push(n);
        });
        return neighbors;
    }

    _removeWall(current, next) {
        if (current.x - next.x === 1) { // next is left
            current.walls.left = false;
            next.walls.right = false;
        } else if (current.x - next.x === -1) { // next is right
            current.walls.right = false;
            next.walls.left = false;
        } else if (current.y - next.y === 1) { // next is top
            current.walls.top = false;
            next.walls.bottom = false;
        } else if (current.y - next.y === -1) { // next is bottom
            current.walls.bottom = false;
            next.walls.top = false;
        }
    }

    _generateCollectibles() {
        const messages = [
            "You're amazing! 💕", "Your smile brightens my day ☀️",
            "You inspire me every day 🌟", "You're one of a kind 🦄",
            "Your kindness touches hearts 💖", "You make everything better ✨",
        ];
        const collectibles = [];
        const usedPositions = new Set([`0,0`, `${this.width - 1},${this.height - 1}`]);
        const numCollectibles = Math.min(messages.length, Math.floor(this.width * this.height * 0.1));

        for (let i = 0; i < numCollectibles; i++) {
            let x, y, posKey;
            do {
                x = Math.floor(Math.random() * this.width);
                y = Math.floor(Math.random() * this.height);
                posKey = `${x},${y}`;
            } while (usedPositions.has(posKey));

            usedPositions.add(posKey);
            collectibles.push({ x, y, message: messages[i], collected: false });
        }
        return collectibles;
    }
}

// --- Game State Manager Class ---
class GameStateManager {
    constructor() {
        this.resetGame();
        this.loadBestTimes();
    }

    getState() { return this.state; }

    resetGame() {
        this.state = {
            screen: 'start', // 'start', 'playing', 'win', 'pause'
            difficulty: 'medium',
            maze: null,
            player: { x: 0, y: 0 },
            stats: { startTime: 0, moves: 0, heartsCollected: 0, totalHearts: 0 },
            collectedMessages: [],
            bestTimes: {},
        };
    }
    
    loadBestTimes() {
        try {
            const saved = localStorage.getItem('maze-escape-best-times');
            this.state.bestTimes = saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.warn('Failed to load best times:', e);
            this.state.bestTimes = {};
        }
    }

    saveBestTimes() {
        try {
            localStorage.setItem('maze-escape-best-times', JSON.stringify(this.state.bestTimes));
        } catch (e) { console.warn('Failed to save best times:', e); }
    }

    startGame(difficulty) {
        this.state.difficulty = difficulty;
        const size = DIFFICULTY_SETTINGS[difficulty].size;
        const generator = new MazeGenerator(size, size);
        this.state.maze = generator.generate();

        this.state.player = { x: this.state.maze.start.x, y: this.state.maze.start.y };
        this.state.stats = {
            startTime: Date.now(),
            moves: 0,
            heartsCollected: 0,
            totalHearts: this.state.maze.collectibles.length,
        };
        this.state.collectedMessages = [];
        this.state.screen = 'playing';
        renderGameScreen(this);
    }

    movePlayer(direction) {
        if (!this.state.maze || this.state.screen !== 'playing') return;

        const { player, maze } = this.state;
        const currentCell = maze.cells[player.y][player.x];
        let newX = player.x;
        let newY = player.y;

        if (direction === 'up' && !currentCell.walls.top) newY--;
        if (direction === 'down' && !currentCell.walls.bottom) newY++;
        if (direction === 'left' && !currentCell.walls.left) newX--;
        if (direction === 'right' && !currentCell.walls.right) newX++;

        if (newX !== player.x || newY !== player.y) {
            this.state.player.x = newX;
            this.state.player.y = newY;
            this.state.stats.moves++;
            document.getElementById('moves-count').innerText = this.state.stats.moves;

            // NEW: Add haptic feedback on successful move
            if (navigator.vibrate) {
                navigator.vibrate(20);
            }

            const collectible = maze.collectibles.find(c => c.x === newX && c.y === newY && !c.collected);
            if (collectible) {
                collectible.collected = true;
                this.state.stats.heartsCollected++;
                this.state.collectedMessages.push(collectible.message);
                document.getElementById('hearts-count').innerText = `${this.state.stats.heartsCollected}/${this.state.stats.totalHearts}`;
            }

            if (newX === maze.end.x && newY === maze.end.y) {
                this.winGame();
            }
        }
    }

    winGame() {
        this.state.screen = 'win';
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        
        const gameTime = Date.now() - this.state.stats.startTime;
        const difficultyKey = this.state.difficulty;
        const oldBestTime = this.state.bestTimes[difficultyKey];
        const isNewRecord = !oldBestTime || gameTime < oldBestTime;

        if (isNewRecord) {
            this.state.bestTimes[difficultyKey] = gameTime;
            this.saveBestTimes();
        }
        
        renderWinScreen(this, isNewRecord);
    }

    pauseGame() {
        if (this.state.screen === 'playing') {
            this.state.screen = 'pause';
            renderPauseScreen(this);
        }
    }

    resumeGame() {
        if (this.state.screen === 'pause') {
            this.state.screen = 'playing';
            const pauseModal = document.getElementById('pause-modal');
            if (pauseModal) pauseModal.remove();
            // Resume the game loop
            gameLoop(this);
        }
    }
}

// --- Rendering Functions ---

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function renderStartScreen(manager) {
    const { bestTimes } = manager.getState();
    const difficulties = Object.entries(DIFFICULTY_SETTINGS).map(([key, config]) => `
        <div class="space-y-2">
            <button class="button button-primary" data-difficulty="${key}">
                <span>${config.label}</span>
                ${bestTimes[key] ? `<span class="badge">🏆 ${formatTime(bestTimes[key])}</span>` : ''}
            </button>
        </div>
    `).join('');

    app.innerHTML = `
        <div class="card start-screen-container">
            <div class="card-header text-center space-y-4">
                <h1 class="card-title">Maze Escape</h1>
                <p class="text-muted-foreground">Guide your character and collect hearts with special messages! 💕</p>
            </div>
            <div class="card-content space-y-4">
                ${difficulties}
                <div class="how-to-play">
                    <h4>How to Play:</h4>
                    <ul>
                        <li>• Use arrow keys or WASD to move</li>
                        <li>• On mobile, swipe on the maze to move</li>
                        <li>• Reach the bottom-right corner to win!</li>
                    </ul>
                </div>
            </div>
        </div>
    `;

    document.querySelectorAll('[data-difficulty]').forEach(button => {
        button.addEventListener('click', (e) => {
            manager.startGame(e.currentTarget.dataset.difficulty);
        });
    });
}

function renderGameScreen(manager) {
    const state = manager.getState();
    const { maze, stats } = state;
    app.innerHTML = `
        <div class="game-container space-y-4">
            <div class="card">
                <div class="card-content p-4">
                    <div class="game-stats">
                        <div class="game-stats-left">
                            <span class="badge">Moves: <span id="moves-count">${stats.moves}</span></span>
                            <span class="badge">💖 <span id="hearts-count">${stats.heartsCollected}/${stats.totalHearts}</span></span>
                            <span class="badge">Time: <span id="timer">0:00</span></span>
                        </div>
                        <div class="game-stats-right">
                            <button id="pause-btn" class="button button-outline" style="width: auto; padding: 0.5rem 1rem;">Pause</button>
                            <button id="reset-btn" class="button button-outline" style="width: auto; padding: 0.5rem 1rem;">Reset</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-content p-4">
                     <canvas id="maze-canvas" class="game-canvas" width="${maze.width * CELL_SIZE}" height="${maze.height * CELL_SIZE}"></canvas>
                </div>
            </div>
            <div class="card mobile-controls md-hidden">
                <div></div>
                <button class="button button-outline" data-move="up">↑</button>
                <div></div>
                <button class="button button-outline" data-move="left">←</button>
                <div></div>
                <button class="button button-outline" data-move="right">→</button>
                <div></div>
                <button class="button button-outline" data-move="down">↓</button>
                <div></div>
            </div>
            <p class="text-center text-muted-foreground desktop-only">Use Arrow Keys or WASD to move • Press P or ESC to pause</p>
            <p class="text-center text-muted-foreground md-hidden">Swipe on the maze or use the controls to move.</p>
        </div>
    `;

    addGameEventListeners(manager);
    gameLoop(manager); // Start the rendering loop
}

function renderPauseScreen(manager) {
    const pauseModal = document.createElement('div');
    pauseModal.id = 'pause-modal';
    pauseModal.className = 'modal-overlay';
    pauseModal.innerHTML = `
        <div class="card modal-card">
            <div class="card-header text-center">
                <h2 class="card-title" style="font-size: 1.5rem;">Game Paused</h2>
            </div>
            <div class="card-content space-y-4">
                <button id="resume-btn" class="button button-primary">Resume Game</button>
                <button id="restart-level-btn" class="button button-outline">Restart Level</button>
                <button id="back-to-menu-btn" class="button button-outline">Back to Menu</button>
            </div>
        </div>
    `;
    document.body.appendChild(pauseModal);

    document.getElementById('resume-btn').onclick = () => manager.resumeGame();
    document.getElementById('restart-level-btn').onclick = () => manager.startGame(manager.getState().difficulty);
    document.getElementById('back-to-menu-btn').onclick = () => {
        manager.resetGame();
        manager.loadBestTimes();
        renderStartScreen(manager);
        pauseModal.remove();
    };
}

function renderWinScreen(manager, isNewRecord) {
    const { stats, collectedMessages, difficulty } = manager.getState();
    const gameTime = Date.now() - stats.startTime;
    const allHeartsCollected = stats.heartsCollected === stats.totalHearts;

    const messagesHTML = collectedMessages.map(msg => `<div class="message">${msg}</div>`).join('');

    app.innerHTML = `
        <div class="card win-screen-container">
            <div class="card-header text-center space-y-4">
                <div class="spin-animation" style="font-size: 3rem;">🏆</div>
                <h1 class="card-title">Congratulations! 🎉</h1>
                ${isNewRecord ? `<div class="badge pop-in-animation" style="background-color: #f59e0b; color: white;">🌟 New Personal Best!</div>` : ''}
            </div>
            <div class="card-content space-y-6">
                <div class="win-stats-grid">
                    <div class="text-center win-stat-item stat-time"><div>Time</div><div>${formatTime(gameTime)}</div></div>
                    <div class="text-center win-stat-item stat-moves"><div>Moves</div><div>${stats.moves}</div></div>
                    <div class="text-center win-stat-item stat-hearts"><div>Hearts</div><div>${stats.heartsCollected}/${stats.totalHearts}</div></div>
                </div>
                ${messagesHTML ? `
                <div class="collected-messages space-y-2">
                    <h3 class="text-center font-semibold" style="color: var(--secondary-text);">Messages You Found</h3>
                    ${messagesHTML}
                    ${allHeartsCollected ? `
                    <div class="all-hearts-banner">
                        <p>🌟 Amazing! You found all the hearts!</p>
                        <p>You're truly special and these messages are just for you! 💕</p>
                    </div>` : ''}
                </div>` : ''}
                <div class="space-y-3">
                    <button id="play-again-btn" class="button button-primary">Play Again</button>
                    <button id="win-back-to-menu-btn" class="button button-outline">Back to Menu</button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('play-again-btn').onclick = () => manager.startGame(difficulty);
    document.getElementById('win-back-to-menu-btn').onclick = () => {
        manager.resetGame();
        manager.loadBestTimes();
        renderStartScreen(manager);
    };
}


// --- Canvas Drawing and Game Loop ---
let lastPlayerPos = { x: 0, y: 0 };

function gameLoop(manager) {
    const state = manager.getState();
    if (state.screen !== 'playing') {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        return;
    }

    const canvas = document.getElementById('maze-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { maze, player } = state;

    // Interpolate player position for smooth movement
    lastPlayerPos.x += (player.x * CELL_SIZE - lastPlayerPos.x) * 0.2;
    lastPlayerPos.y += (player.y * CELL_SIZE - lastPlayerPos.y) * 0.2;

    draw(ctx, maze, lastPlayerPos);
    
    // Update timer
    const timerEl = document.getElementById('timer');
    if (timerEl) {
        timerEl.innerText = formatTime(Date.now() - state.stats.startTime);
    }

    animationFrameId = requestAnimationFrame(() => gameLoop(manager));
}

function draw(ctx, maze, playerPos) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Draw maze walls
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let y = 0; y < maze.height; y++) {
        for (let x = 0; x < maze.width; x++) {
            const cell = maze.cells[y][x];
            const cellX = x * CELL_SIZE;
            const cellY = y * CELL_SIZE;
            ctx.beginPath();
            if (cell.walls.top) { ctx.moveTo(cellX, cellY); ctx.lineTo(cellX + CELL_SIZE, cellY); }
            if (cell.walls.right) { ctx.moveTo(cellX + CELL_SIZE, cellY); ctx.lineTo(cellX + CELL_SIZE, cellY + CELL_SIZE); }
            if (cell.walls.bottom) { ctx.moveTo(cellX + CELL_SIZE, cellY + CELL_SIZE); ctx.lineTo(cellX, cellY + CELL_SIZE); }
            if (cell.walls.left) { ctx.moveTo(cellX, cellY); ctx.lineTo(cellX, cellY + CELL_SIZE); }
            ctx.stroke();
        }
    }

    // Draw end position
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(maze.end.x * CELL_SIZE + 2, maze.end.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    ctx.fillStyle = 'white';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎯', maze.end.x * CELL_SIZE + CELL_SIZE / 2, maze.end.y * CELL_SIZE + CELL_SIZE / 2);

    // Draw collectibles
    maze.collectibles.forEach(c => {
        if (!c.collected) {
            ctx.fillText('💖', c.x * CELL_SIZE + CELL_SIZE / 2, c.y * CELL_SIZE + CELL_SIZE / 2);
        }
    });

    // Draw player
    const playerRenderX = playerPos.x + CELL_SIZE / 2;
    const playerRenderY = playerPos.y + CELL_SIZE / 2;
    ctx.fillStyle = '#8b5cf6';
    ctx.beginPath();
    ctx.arc(playerRenderX, playerRenderY, PLAYER_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText('🐱', playerRenderX, playerRenderY);
}


// --- Event Listeners ---
function handleKeyPress(e, manager) {
    if (manager.getState().screen !== 'playing') return;
    
    let moved = false;
    switch (e.key.toLowerCase()) {
        case 'arrowup': case 'w': manager.movePlayer('up'); moved = true; break;
        case 'arrowdown': case 's': manager.movePlayer('down'); moved = true; break;
        case 'arrowleft': case 'a': manager.movePlayer('left'); moved = true; break;
        case 'arrowright': case 'd': manager.movePlayer('right'); moved = true; break;
        case 'escape': case 'p': manager.pauseGame(); moved = true; break;
    }
    if(moved) e.preventDefault();
}

function addGameEventListeners(manager) {
    const state = manager.getState();
    lastPlayerPos = { x: state.player.x * CELL_SIZE, y: state.player.y * CELL_SIZE };
    
    // Keyboard controls
    window.onkeydown = (e) => handleKeyPress(e, manager);

    // Button controls
    document.getElementById('pause-btn').onclick = () => manager.pauseGame();
    document.getElementById('reset-btn').onclick = () => manager.startGame(state.difficulty);
    
    // Mobile D-pad
    document.querySelectorAll('[data-move]').forEach(button => {
        button.onclick = (e) => manager.movePlayer(e.currentTarget.dataset.move);
    });

    // NEW: Swipe controls
    const canvas = document.getElementById('maze-canvas');
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    
    canvas.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, false);

    canvas.addEventListener('touchend', function(e) {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
    }, false); 

    function handleSwipe() {
        const dx = touchEndX - touchStartX;
        const dy = touchEndY - touchStartY;
        const swipeThreshold = 50; // Min distance for a swipe

        if (Math.abs(dx) > Math.abs(dy)) { // Horizontal swipe
            if (Math.abs(dx) > swipeThreshold) {
                manager.movePlayer(dx > 0 ? 'right' : 'left');
            }
        } else { // Vertical swipe
            if (Math.abs(dy) > swipeThreshold) {
                manager.movePlayer(dy > 0 ? 'down' : 'up');
            }
        }
    }
}


// --- Initialize Game ---
const gameManager = new GameStateManager();
renderStartScreen(gameManager);
