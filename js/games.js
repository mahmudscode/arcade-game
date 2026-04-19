// Arcade Games Implementation
// Classic Arcade Games with Modern Graphics (NEW) + Simple Games (Original)

const classicGames = [
    {
        id: 'space-invaders',
        name: "Space Invaders",
        category: "action",
        icon: "👾",
        description: "Neon aliens invade with particle explosions!",
        modern: true,
        init: (container, controls) => {
            const game = new SpaceInvaders(container);
            game.start();
            controls.innerHTML = '<p>Arrow Keys / WASD to move | SPACE to shoot | P to pause</p>';
            return game;
        }
    },
    {
        id: 'asteroids',
        name: "Asteroids",
        category: "action",
        icon: "☄️",
        description: "Geometric neon asteroids with physics!",
        modern: true,
        init: (container, controls) => {
            const game = new Asteroids(container);
            game.start();
            controls.innerHTML = '<p>Arrow Keys / WASD to rotate & thrust | SPACE to shoot | P to pause</p>';
            return game;
        }
    },
    {
        id: 'pacman',
        name: "Pac-Man",
        category: "classic",
        icon: "👻",
        description: "Neon maze with ghost AI and power-ups!",
        modern: true,
        init: (container, controls) => {
            const game = new PacMan(container);
            game.start();
            controls.innerHTML = '<p>Arrow Keys / WASD to move | Eat all dots to win!</p>';
            return game;
        }
    },
    {
        id: 'frogger',
        name: "Frogger",
        category: "action",
        icon: "🐸",
        description: "Cross the road and water with splash effects!",
        modern: true,
        init: (container, controls) => {
            const game = new Frogger(container);
            game.start();
            controls.innerHTML = '<p>Arrow Keys / WASD to jump | Reach all homes to win!</p>';
            return game;
        }
    },
    {
        id: 'galaga',
        name: "Galaga",
        category: "action",
        icon: "🚀",
        description: "Formation flying enemies with swoop attacks!",
        modern: true,
        init: (container, controls) => {
            const game = new Galaga(container);
            game.start();
            controls.innerHTML = '<p>Arrow Keys / WASD to move | SPACE to shoot | P to pause</p>';
            return game;
        }
    },
    {
        id: 'centipede',
        name: "Centipede",
        category: "action",
        icon: "🐛",
        description: "Organic movement with mushroom garden!",
        modern: true,
        init: (container, controls) => {
            const game = new Centipede(container);
            game.start();
            controls.innerHTML = '<p>Arrow Keys / WASD to move | SPACE to shoot | Destroy mushrooms!</p>';
            return game;
        }
    },
    {
        id: 'dig-dug',
        name: "Dig Dug",
        category: "action",
        icon: "⛏️",
        description: "Dig tunnels and inflate enemies!",
        modern: true,
        init: (container, controls) => {
            const game = new DigDug(container);
            game.start();
            controls.innerHTML = '<p>Arrow Keys / WASD to move | SPACE to pump | Inflate enemies!</p>';
            return game;
        }
    },
    {
        id: 'qbert',
        name: "Q*bert",
        category: "puzzle",
        icon: "🟧",
        description: "Isometric pyramid color matching!",
        modern: true,
        init: (container, controls) => {
            const game = new Qbert(container);
            game.start();
            controls.innerHTML = '<p>Arrow Keys / WASD to hop | Color all cubes!</p>';
            return game;
        }
    },
    {
        id: 'donkey-kong',
        name: "Donkey Kong",
        category: "action",
        icon: "🦍",
        description: "Climb platforms while avoiding barrels!",
        modern: true,
        init: (container, controls) => {
            const game = new DonkeyKong(container);
            game.start();
            controls.innerHTML = '<p>Arrow Keys / WASD to move | SPACE to jump | Climb ladders!</p>';
            return game;
        }
    },
    {
        id: 'bubble-bobble',
        name: "Bubble Bobble",
        category: "action",
        icon: "🫧",
        description: "Trap enemies in bubbles and pop them!",
        modern: true,
        init: (container, controls) => {
            const game = new BubbleBobble(container);
            game.start();
            controls.innerHTML = '<p>P1: WASD + F to shoot | P2: Arrows + Enter | Press T for 2-player!</p>';
            return game;
        }
    },
    {
        id: 'contra',
        name: "Contra",
        category: "action",
        icon: "🔫",
        description: "Run and gun with multiple weapons!",
        modern: true,
        init: (container, controls) => {
            const game = new Contra(container);
            game.start();
            controls.innerHTML = '<p>Arrow Keys / WASD to move | Z/Space to shoot | X to kick | C for special!</p>';
            return game;
        }
    },
    {
        id: 'double-dragon',
        name: "Double Dragon",
        category: "action",
        icon: "🥋",
        description: "Beat-em-up combat with combos!",
        modern: true,
        init: (container, controls) => {
            const game = new DoubleDragon(container);
            game.start();
            controls.innerHTML = '<p>Arrow Keys / WASD to move | Z to punch | X to kick | C for special!</p>';
            return game;
        }
    },
    {
        id: 'ghosts-n-goblins',
        name: "Ghosts \'n Goblins",
        category: "action",
        icon: "💀",
        description: "Challenging platformer with armor system!",
        modern: true,
        init: (container, controls) => {
            const game = new GhostsNGoblins(container);
            game.start();
            controls.innerHTML = '<p>Arrow Keys / WASD to move | Z/Space to throw lance | Survive!</p>';
            return game;
        }
    }
];

// Original simple games
const simpleGames = [
    {
        id: 1,
        name: "Snake",
        category: "classic",
        icon: "🐍",
        init: initSnake
    },
    {
        id: 2,
        name: "Tic Tac Toe",
        category: "strategy",
        icon: "⭕",
        init: initTicTacToe
    },
    {
        id: 3,
        name: "Memory Match",
        category: "puzzle",
        icon: "🎴",
        init: initMemory
    },
    {
        id: 4,
        name: "Breakout",
        category: "action",
        icon: "🧱",
        init: initBreakout
    },
    {
        id: 5,
        name: "Pong",
        category: "classic",
        icon: "🏓",
        init: initPong
    },
    {
        id: 6,
        name: "2048",
        category: "puzzle",
        icon: "🔢",
        init: init2048
    },
    {
        id: 7,
        name: "Minesweeper",
        category: "puzzle",
        icon: "💣",
        init: initMinesweeper
    },
    {
        id: 8,
        name: "Rock Paper Scissors",
        category: "classic",
        icon: "✊",
        init: initRPS
    },
    {
        id: 9,
        name: "Whack-a-Mole",
        category: "action",
        icon: "🔨",
        init: initWhack
    },
    {
        id: 10,
        name: "Simon Says",
        category: "memory",
        icon: "🎹",
        init: initSimon
    },
    {
        id: 11,
        name: "Hangman",
        category: "puzzle",
        icon: "🎯",
        init: initHangman
    },
    {
        id: 12,
        name: "Tetris",
        category: "classic",
        icon: "🧩",
        init: initTetris
    },
    {
        id: 13,
        name: "Pac-Man",
        category: "classic",
        icon: "👻",
        init: initPacman
    },
    {
        id: 14,
        name: "Space Invaders",
        category: "action",
        icon: "🚀",
        init: initSpaceInvaders
    },
    {
        id: 15,
        name: "Flappy Bird",
        category: "action",
        icon: "🐦",
        init: initFlappy
    },
    {
        id: 16,
        name: "Connect Four",
        category: "strategy",
        icon: "🔴",
        init: initConnectFour
    },
    {
        id: 17,
        name: "Checkers",
        category: "strategy",
        icon: "♟️",
        init: initCheckers
    },
    {
        id: 18,
        name: "Guess the Number",
        category: "puzzle",
        icon: "❓",
        init: initGuessNumber
    },
    {
        id: 19,
        name: "Reaction Time",
        category: "action",
        icon: "⚡",
        init: initReaction
    },
    {
        id: 20,
        name: "Click Speed Test",
        category: "action",
        icon: "🖱️",
        init: initClickSpeed
    }
];

// Combine all games - Classic Games first, then Simple Games
const games = [...classicGames, ...simpleGames];

// Game 1: Snake
function initSnake(container, controls) {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    
    let snake = [{x: 10, y: 10}];
    let food = {x: 15, y: 15};
    let dir = {x: 1, y: 0};
    let score = 0;
    let gameLoop;
    let gameEnded = false;
    
    function draw() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#0f0';
        snake.forEach(seg => ctx.fillRect(seg.x * 20, seg.y * 20, 18, 18));
        
        ctx.fillStyle = '#f00';
        ctx.fillRect(food.x * 20, food.y * 20, 18, 18);
        
        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.fillText('Score: ' + score, 10, 30);
    }
    
    function update() {
        const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
        
        if (head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 20 ||
            snake.some(s => s.x === head.x && s.y === head.y)) {
            clearInterval(gameLoop);
            gameEnded = true;
            alert('Game Over! Score: ' + score);
            return;
        }
        
        snake.unshift(head);
        
        if (head.x === food.x && head.y === food.y) {
            score += 10;
            food = {
                x: Math.floor(Math.random() * 20),
                y: Math.floor(Math.random() * 20)
            };
        } else {
            snake.pop();
        }
        
        draw();
    }
    
    const handleKeyDown = (e) => {
        switch(e.key) {
            case 'ArrowUp': if (dir.y !== 1) dir = {x: 0, y: -1}; break;
            case 'ArrowDown': if (dir.y !== -1) dir = {x: 0, y: 1}; break;
            case 'ArrowLeft': if (dir.x !== 1) dir = {x: -1, y: 0}; break;
            case 'ArrowRight': if (dir.x !== -1) dir = {x: 1, y: 0}; break;
        }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    controls.innerHTML = '<p>Use Arrow Keys to move</p>';
    gameLoop = setInterval(update, 150);
    draw();
    
    // Return game instance with stop method
    return {
        stop() {
            clearInterval(gameLoop);
            document.removeEventListener('keydown', handleKeyDown);
        }
    };
}

// Game 2: Tic Tac Toe
function initTicTacToe(container, controls) {
    container.innerHTML = '';
    const board = Array(9).fill(null);
    let player = 'X';
    let gameActive = true;
    
    const boardEl = document.createElement('div');
    boardEl.style.cssText = 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; max-width: 300px; margin: 0 auto;';
    
    function checkWin() {
        const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
        return wins.some(([a,b,c]) => board[a] && board[a] === board[b] && board[a] === board[c]);
    }
    
    const cellElements = [];
    board.forEach((cell, i) => {
        const cellEl = document.createElement('div');
        cellEl.style.cssText = 'width: 100px; height: 100px; background: #333; display: flex; align-items: center; justify-content: center; font-size: 3rem; cursor: pointer;';
        cellEl.onclick = () => {
            if (board[i] || !gameActive) return;
            board[i] = player;
            cellEl.textContent = player;
            if (checkWin()) {
                gameActive = false;
                setTimeout(() => alert(player + ' wins!'), 100);
            } else if (board.every(c => c)) {
                gameActive = false;
                setTimeout(() => alert('Draw!'), 100);
            } else {
                player = player === 'X' ? 'O' : 'X';
            }
        };
        cellElements.push(cellEl);
        boardEl.appendChild(cellEl);
    });
    
    container.appendChild(boardEl);
    controls.innerHTML = '<p>Click to place your mark</p>';
    
    return {
        stop() {
            // No event listeners to remove - onclick handlers are cleaned up with DOM
        }
    };
}

// Game 3: Memory Match
function initMemory(container, controls) {
    container.innerHTML = '';
    const emojis = ['🎮','🎲','🎯','🎪','🎨','🎭','🎬','🎵'];
    const cards = [...emojis, ...emojis].sort(() => Math.random() - 0.5);
    let flipped = [];
    let matched = [];
    
    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; max-width: 400px; margin: 0 auto;';
    
    let pendingTimeout = null;
    
    cards.forEach((emoji, i) => {
        const card = document.createElement('div');
        card.style.cssText = 'width: 80px; height: 80px; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; font-size: 2rem; cursor: pointer; border-radius: 10px;';
        card.dataset.index = i;
        card.onclick = () => {
            if (flipped.length >= 2 || flipped.includes(i) || matched.includes(i)) return;
            card.textContent = emoji;
            flipped.push(i);
            if (flipped.length === 2) {
                const [a, b] = flipped;
                if (cards[a] === cards[b]) {
                    matched.push(a, b);
                    flipped = [];
                    if (matched.length === 16) setTimeout(() => alert('You won!'), 100);
                } else {
                    pendingTimeout = setTimeout(() => {
                        cards.forEach((_, j) => {
                            if (flipped.includes(j)) {
                                grid.children[j].textContent = '';
                            }
                        });
                        flipped = [];
                    }, 1000);
                }
            }
        };
        grid.appendChild(card);
    });
    
    container.appendChild(grid);
    controls.innerHTML = '<p>Find matching pairs!</p>';
    
    return {
        stop() {
            if (pendingTimeout) clearTimeout(pendingTimeout);
        }
    };
}

// Game 4: Breakout
function initBreakout(container, controls) {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    
    let paddle = {x: 150, y: 380, w: 100, h: 10};
    let ball = {x: 200, y: 200, r: 8, dx: 4, dy: -4};
    let bricks = [];
    let score = 0;
    let gameActive = true;
    let animationFrameId = null;
    
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 8; c++) {
            bricks.push({x: c * 50, y: r * 20 + 30, w: 45, h: 15, active: true});
        }
    }
    
    let right = false, left = false;
    
    const handleKeyDown = (e) => {
        if (e.key === 'ArrowRight') right = true;
        if (e.key === 'ArrowLeft') left = true;
    };
    
    const handleKeyUp = (e) => {
        if (e.key === 'ArrowRight') right = false;
        if (e.key === 'ArrowLeft') left = false;
    };
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    function draw() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#0ff';
        ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
        
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx.fillStyle = '#f00';
        ctx.fill();
        
        bricks.forEach(b => {
            if (b.active) {
                ctx.fillStyle = '#0f0';
                ctx.fillRect(b.x, b.y, b.w, b.h);
            }
        });
        
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.fillText('Score: ' + score, 10, 20);
    }
    
    function update() {
        if (!gameActive) return;
        
        if (right) paddle.x += 5;
        if (left) paddle.x -= 5;
        paddle.x = Math.max(0, Math.min(canvas.width - paddle.w, paddle.x));
        
        ball.x += ball.dx;
        ball.y += ball.dy;
        
        if (ball.x < 0 || ball.x > canvas.width) ball.dx *= -1;
        if (ball.y < 0) ball.dy *= -1;
        if (ball.y > canvas.height) {
            gameActive = false;
            alert('Game Over! Score: ' + score);
            return;
        }
        
        if (ball.x > paddle.x && ball.x < paddle.x + paddle.w &&
            ball.y + ball.r > paddle.y) {
            ball.dy = -Math.abs(ball.dy);
        }
        
        bricks.forEach(b => {
            if (b.active && ball.x > b.x && ball.x < b.x + b.w &&
                ball.y > b.y && ball.y < b.y + b.h) {
                b.active = false;
                ball.dy *= -1;
                score += 10;
            }
        });
        
        if (bricks.every(b => !b.active)) {
            gameActive = false;
            alert('You Win! Score: ' + score);
            return;
        }
        
        draw();
        animationFrameId = requestAnimationFrame(update);
    }
    
    controls.innerHTML = '<p>Use Arrow Keys to move paddle</p>';
    update();
    
    return {
        stop() {
            gameActive = false;
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
        }
    };
}

// Game 5: Pong
function initPong(container, controls) {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    
    let p1 = {x: 10, y: 125, w: 10, h: 50};
    let p2 = {x: 380, y: 125, w: 10, h: 50};
    let ball = {x: 200, y: 150, r: 8, dx: 4, dy: 2};
    let s1 = 0, s2 = 0;
    let gameActive = true;
    let animationFrameId = null;
    
    let up1 = false, down1 = false;
    
    const handleKeyDown = (e) => {
        if (e.key === 'w') up1 = true;
        if (e.key === 's') down1 = true;
        if (e.key === 'ArrowUp') p2.y -= 20;
        if (e.key === 'ArrowDown') p2.y += 20;
    };
    
    const handleKeyUp = (e) => {
        if (e.key === 'w') up1 = false;
        if (e.key === 's') down1 = false;
    };
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    function draw() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#fff';
        ctx.fillRect(p1.x, p1.y, p1.w, p1.h);
        ctx.fillRect(p2.x, p2.y, p2.w, p2.h);
        
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.font = '24px Arial';
        ctx.fillText(s1, 100, 30);
        ctx.fillText(s2, 300, 30);
    }
    
    function update() {
        if (!gameActive) return;
        
        if (up1) p1.y -= 5;
        if (down1) p1.y += 5;
        p1.y = Math.max(0, Math.min(canvas.height - p1.h, p1.y));
        p2.y = Math.max(0, Math.min(canvas.height - p2.h, p2.y));
        
        ball.x += ball.dx;
        ball.y += ball.dy;
        
        if (ball.y < 0 || ball.y > canvas.height) ball.dy *= -1;
        
        if (ball.x < p1.x + p1.w && ball.y > p1.y && ball.y < p1.y + p1.h) {
            ball.dx = Math.abs(ball.dx);
        }
        if (ball.x > p2.x && ball.y > p2.y && ball.y < p2.y + p2.h) {
            ball.dx = -Math.abs(ball.dx);
        }
        
        if (ball.x < 0) { s2++; ball = {x: 200, y: 150, r: 8, dx: 4, dy: 2}; }
        if (ball.x > canvas.width) { s1++; ball = {x: 200, y: 150, r: 8, dx: -4, dy: 2 }; }
        
        draw();
        animationFrameId = requestAnimationFrame(update);
    }
    
    controls.innerHTML = '<p>W/S for Player 1, Arrow Keys for Player 2</p>';
    update();
    
    return {
        stop() {
            gameActive = false;
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
        }
    };
}

// Game 6: 2048
function init2048(container, controls) {
    container.innerHTML = '';
    let grid = Array(16).fill(0);
    
    function addTile() {
        let empty = grid.map((v, i) => v === 0 ? i : -1).filter(i => i >= 0);
        if (empty.length) grid[empty[Math.floor(Math.random() * empty.length)]] = 2;
    }
    
    function render() {
        container.innerHTML = '';
        const board = document.createElement('div');
        board.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; max-width: 300px; margin: 0 auto;';
        
        grid.forEach(v => {
            const cell = document.createElement('div');
            cell.style.cssText = 'width: 70px; height: 70px; background: ' + (v ? '#667eea' : '#333') + '; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; border-radius: 5px;';
            cell.textContent = v || '';
            board.appendChild(cell);
        });
        
        container.appendChild(board);
    }
    
    function move(dir) {
        let moved = false;
        const rotate = n => [n[3], n[7], n[11], n[15], n[2], n[6], n[10], n[14], n[1], n[5], n[9], n[13], n[0], n[4], n[8], n[12]];
        const compress = row => {
            let r = row.filter(v => v), merged = [];
            for (let i = 0; i < r.length; i++) {
                if (r[i] === r[i+1]) { merged.push(r[i]*2); i++; }
                else merged.push(r[i]);
            }
            while (merged.length < 4) merged.push(0);
            return merged;
        };
        
        let g = [...grid];
        for (let r = 0; r < 4; r++) {
            let row = [];
            for (let c = 0; c < 4; c++) row.push(grid[r*4+c]);
            if (dir === 'right') row.reverse(); 
            row = compress(row);
            if (dir === 'right') row.reverse();
            for (let c = 0; c < 4; c++) grid[r*4+c] = row[c];
        }
        
        if (grid.join(',') !== g.join(',')) { addTile(); render(); }
    }
    
    const handleKeyDown = (e) => {
        if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
            e.preventDefault();
            move({ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}[e.key]);
        }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    addTile(); addTile(); render();
    controls.innerHTML = '<p>Use Arrow Keys to move tiles</p>';
    
    return {
        stop() {
            document.removeEventListener('keydown', handleKeyDown);
        }
    };
}

// Game 7: Minesweeper
function initMinesweeper(container, controls) {
    container.innerHTML = '';
    const size = 9;
    const mines = 10;
    let board = Array(size*size).fill(0);
    let revealed = Array(size*size).fill(false);
    let flagged = Array(size*size).fill(false);
    let gameOver = false;
    
    let mineLocs = [];
    while (mineLocs.length < mines) {
        let loc = Math.floor(Math.random() * size*size);
        if (!mineLocs.includes(loc)) mineLocs.push(loc);
    }
    
    mineLocs.forEach(loc => {
        board[loc] = -1;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                let r = Math.floor(loc/size) + dr, c = loc%size + dc;
                if (r >= 0 && r < size && c >= 0 && c < size) {
                    let n = r*size + c;
                    if (board[n] !== -1) board[n]++;
                }
            }
        }
    });
    
    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(9, 1fr); gap: 2px; max-width: 300px; margin: 0 auto;';
    
    board.forEach((v, i) => {
        const cell = document.createElement('div');
        cell.style.cssText = 'width: 30px; height: 30px; background: #666; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.9rem;';
        cell.onclick = e => {
            if (gameOver || flagged[i] || revealed[i]) return;
            if (e.shiftKey || e.button === 2) {
                flagged[i] = !flagged[i];
                cell.textContent = flagged[i] ? '🚩' : '';
                return;
            }
            if (v === -1) {
                gameOver = true;
                alert('Game Over!');
                return;
            }
            reveal(i);
        };
        cell.oncontextmenu = e => { e.preventDefault(); };
        grid.appendChild(cell);
    });
    
    function reveal(i) {
        if (i < 0 || i >= size*size || revealed[i] || flagged[i]) return;
        revealed[i] = true;
        grid.children[i].style.background = '#aaa';
        grid.children[i].textContent = board[i] || '';
        if (board[i] === 0) {
            let r = Math.floor(i/size), c = i%size;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    reveal((r+dr)*size + (c+dc));
                }
            }
        }
        if (revealed.filter((v,i) => !flagged[i] && board[i] !== -1).length === size*size - mines) {
            gameOver = true;
            setTimeout(() => alert('You Win!'), 100);
        }
    }
    
    container.appendChild(grid);
    controls.innerHTML = '<p>Click to reveal, Shift+Click to flag</p>';
    
    return {
        stop() {
            // DOM elements cleaned on container clear
        }
    };
}

// Game 8: Rock Paper Scissors
function initRPS(container, controls) {
    container.innerHTML = '';
    const opts = ['✊','✋','✌️'];
    const names = ['Rock','Paper','Scissors'];
    let pScore = 0, cScore = 0;
    
    const area = document.createElement('div');
    area.style.cssText = 'text-align: center; padding: 2rem;';
    
    const result = document.createElement('div');
    result.style.cssText = 'font-size: 2rem; margin-bottom: 1rem; min-height: 50px;';
    
    const score = document.createElement('div');
    score.style.cssText = 'font-size: 1.2rem; margin-bottom: 1rem;';
    
    const btns = document.createElement('div');
    btns.style.cssText = 'display: flex; justify-content: center; gap: 1rem;';
    
    opts.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.style.cssText = 'font-size: 3rem; padding: 1rem; border: none; background: rgba(255,255,255,0.1); border-radius: 10px; cursor: pointer;';
        btn.textContent = opt;
        btn.onclick = () => {
            const c = opts[Math.floor(Math.random() * 3)];
            result.textContent = names[i] + ' vs ' + names[opts.indexOf(c)];
            if (i === opts.indexOf(c)) result.textContent += ' - Draw!';
            else if ((i === 0 && opts.indexOf(c) === 2) || (i === 1 && opts.indexOf(c) === 0) || (i === 2 && opts.indexOf(c) === 1)) {
                result.textContent += ' - You Win!';
                pScore++;
            } else {
                result.textContent += ' - You Lose!';
                cScore++;
            }
            score.textContent = 'You: ' + pScore + ' | CPU: ' + cScore;
        };
        btns.appendChild(btn);
    });
    
    area.appendChild(result);
    area.appendChild(score);
    area.appendChild(btns);
    container.appendChild(area);
    controls.innerHTML = '<p>Choose your weapon!</p>';
    
    return {
        stop() {
            // DOM elements cleaned on container clear
        }
    };
}

// Game 9: Whack-a-Mole
function initWhack(container, controls) {
    container.innerHTML = '';
    let score = 0, time = 30, active = null, gameActive = false;
    
    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; max-width: 300px; margin: 0 auto;';
    
    for (let i = 0; i < 9; i++) {
        const hole = document.createElement('div');
        hole.style.cssText = 'width: 80px; height: 80px; background: #333; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 2.5rem;';
        hole.onclick = () => {
            if (!gameActive || active !== i) return;
            score++;
            hole.textContent = '';
            active = null;
            document.getElementById('whackScore').textContent = 'Score: ' + score;
        };
        grid.appendChild(hole);
    }
    
    const info = document.createElement('div');
    info.style.cssText = 'text-align: center; margin-top: 1rem;';
    info.innerHTML = '<div id="whackScore" style="font-size: 1.5rem;">Score: 0</div><div id="whackTime" style="font-size: 1.5rem;">Time: 30</div>';
    
    const startBtn = document.createElement('button');
    startBtn.style.cssText = 'margin-top: 1rem; padding: 0.75rem 2rem; font-size: 1.2rem; border: none; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; border-radius: 25px; cursor: pointer;';
    startBtn.textContent = 'Start Game';
    startBtn.onclick = () => {
        if (gameActive) return;
        gameActive = true;
        score = 0;
        time = 30;
        let moleTimer = setInterval(() => {
            if (!gameActive) { clearInterval(moleTimer); return; }
            if (active !== null) grid.children[active].textContent = '';
            active = Math.floor(Math.random() * 9);
            grid.children[active].textContent = '🐹';
        }, 700);
        
        let timeTimer = setInterval(() => {
            time--;
            document.getElementById('whackTime').textContent = 'Time: ' + time;
            if (time <= 0) {
                gameActive = false;
                clearInterval(moleTimer);
                clearInterval(timeTimer);
                alert('Time\'s up! Score: ' + score);
            }
        }, 1000);
    };
    
    container.appendChild(grid);
    container.appendChild(info);
    container.appendChild(startBtn);
    controls.innerHTML = '<p>Click the moles quickly!</p>';
    
    return {
        stop() {
            gameActive = false;
        }
    };
}

// Game 10: Simon Says
function initSimon(container, controls) {
    container.innerHTML = '';
    const colors = ['#f00','#0f0','#00f','#ff0'];
    const seq = [];
    let playerSeq = [];
    let showing = false;
    
    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; max-width: 200px; margin: 0 auto;';
    
    colors.forEach((c, i) => {
        const btn = document.createElement('div');
        btn.style.cssText = 'width: 90px; height: 90px; background: ' + c + '; border-radius: 10px; cursor: pointer; opacity: 0.6;';
        btn.onclick = async () => {
            if (showing) return;
            btn.style.opacity = '1';
            setTimeout(() => btn.style.opacity = '0.6', 200);
            playerSeq.push(i);
            if (playerSeq[playerSeq.length-1] !== seq[playerSeq.length-1]) {
                alert('Game Over! Score: ' + (seq.length-1));
                seq.length = 0;
                playerSeq.length = 0;
                nextRound();
                return;
            }
            if (playerSeq.length === seq.length) {
                playerSeq.length = 0;
                setTimeout(nextRound, 1000);
            }
        };
        grid.appendChild(btn);
    });
    
    container.appendChild(grid);
    
    async function nextRound() {
        showing = true;
        seq.push(Math.floor(Math.random() * 4));
        for (let i = 0; i < seq.length; i++) {
            await new Promise(r => setTimeout(r, 500));
            const btn = grid.children[seq[i]];
            btn.style.opacity = '1';
            await new Promise(r => setTimeout(r, 300));
            btn.style.opacity = '0.6';
        }
        showing = false;
    }
    
    const startBtn = document.createElement('button');
    startBtn.style.cssText = 'margin-top: 1rem; padding: 0.75rem 2rem; font-size: 1.2rem; border: none; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; border-radius: 25px; cursor: pointer;';
    startBtn.textContent = 'Start';
    startBtn.onclick = nextRound;
    container.appendChild(startBtn);
    
    controls.innerHTML = '<p>Repeat the pattern!</p>';
}

// Game 11: Hangman
function initHangman(container, controls) {
    container.innerHTML = '';
    const words = ['JAVASCRIPT','PYTHON','COMPUTER','GRAPHICS','ARCADE','GAMING','BROWSER','CODING'];
    const word = words[Math.floor(Math.random() * words.length)];
    let guessed = Array(word.length).fill(false);
    let wrong = 0;
    const maxWrong = 6;
    
    const display = document.createElement('div');
    display.style.cssText = 'font-size: 2rem; letter-spacing: 0.5rem; margin: 1rem 0; text-align: center;';
    
    const letters = document.createElement('div');
    letters.style.cssText = 'display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem;';
    
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(l => {
        const btn = document.createElement('button');
        btn.style.cssText = 'width: 40px; height: 40px; font-size: 1rem; border: none; background: rgba(255,255,255,0.2); color: #fff; border-radius: 5px; cursor: pointer;';
        btn.textContent = l;
        btn.onclick = () => {
            btn.disabled = true;
            if (word.includes(l)) {
                word.split('').forEach((c, i) => { if (c === l) guessed[i] = true; });
            } else {
                wrong++;
            }
            render();
            if (guessed.every(g => g)) { alert('You Win!'); render(); }
            if (wrong >= maxWrong) { alert('Game Over! Word: ' + word); render(); }
        };
        letters.appendChild(btn);
    });
    
    function render() {
        display.textContent = word.split('').map((c, i) => guessed[i] ? c : '_').join(' ');
        container.insertBefore(display, letters);
    }
    
    container.appendChild(display);
    container.appendChild(letters);
    render();
    controls.innerHTML = '<p>Guess the word!</p>';
    
    return {
        stop() {}
    };
}

// Game 12: Tetris
function initTetris(container, controls) {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 400;
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    
    const board = Array(20).fill().map(() => Array(12).fill(0));
    const pieces = [
        [[1,1,1,1]],
        [[1,1],[1,1]],
        [[1,1,1],[0,1,0]],
        [[1,1,1],[1,0,0]],
        [[1,1,1],[0,0,1]],
        [[1,1,0],[0,1,1]],
        [[0,1,1],[1,1,0]]
    ];
    const colors = ['#f00','#0f0','#00f','#ff0','#f0f','#0ff','#f80'];
    
    let piece = {shape: pieces[Math.floor(Math.random()*7)], color: colors[Math.floor(Math.random()*7)], x: 4, y: 0};
    let score = 0;
    
    function draw() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        board.forEach((row, r) => row.forEach((v, c) => {
            if (v) { ctx.fillStyle = v; ctx.fillRect(c*20, r*20, 19, 19); }
        }));
        
        ctx.fillStyle = piece.color;
        piece.shape.forEach((row, r) => row.forEach((v, c) => {
            if (v) ctx.fillRect((piece.x+c)*20, (piece.y+r)*20, 19, 19);
        }));
        
        ctx.fillStyle = '#fff';
        ctx.font = '14px Arial';
        ctx.fillText('Score: ' + score, 10, 20);
    }
    
    function collide(p) {
        return p.shape.some((row, r) => row.some((v, c) => {
            if (!v) return false;
            let nx = p.x+c, ny = p.y+r;
            return nx < 0 || nx >= 12 || ny >= 20 || (ny >= 0 && board[ny][nx]);
        }));
    }
    
    function merge() {
        piece.shape.forEach((row, r) => row.forEach((v, c) => {
            if (v && piece.y+r >= 0) board[piece.y+r][piece.x+c] = piece.color;
        }));
        for (let r = 19; r >= 0; r--) {
            if (board[r].every(v => v)) {
                board.splice(r, 1);
                board.unshift(Array(12).fill(0));
                score += 100;
            }
        }
        piece = {shape: pieces[Math.floor(Math.random()*7)], color: colors[Math.floor(Math.random()*7)], x: 4, y: 0};
        if (collide(piece)) { alert('Game Over! Score: ' + score); board.forEach(r => r.fill(0)); score = 0; }
    }
    
    let dropCounter = 0, dropInterval = 1000, lastTime = 0;
    
    function update(time = 0) {
        const delta = time - lastTime;
        lastTime = time;
        dropCounter += delta;
        
        if (dropCounter > dropInterval) {
            piece.y++;
            if (collide(piece)) { piece.y--; merge(); }
            dropCounter = 0;
        }
        
        draw();
        requestAnimationFrame(update);
    }
    
    document.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft') { piece.x--; if (collide(piece)) piece.x++; }
        if (e.key === 'ArrowRight') { piece.x++; if (collide(piece)) piece.x--; }
        if (e.key === 'ArrowDown') { piece.y++; if (collide(piece)) piece.y--; }
        if (e.key === 'ArrowUp') {
            const rotated = piece.shape[0].map((_, c) => piece.shape.map(r => r[c]).reverse());
            const old = piece.shape; piece.shape = rotated;
            if (collide(piece)) piece.shape = old;
        }
    });
    
    controls.innerHTML = '<p>Arrows to move/rotate</p>';
    update();
}

// Game 13: Pac-Man (simplified)
function initPacman(container, controls) {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    
    let pacman = {x: 20, y: 20, dx: 0, dy: 0};
    let dots = [];
    for (let r = 0; r < 20; r++) {
        for (let c = 0; c < 20; c++) {
            if (Math.random() > 0.2) dots.push({x: c, y: r});
        }
    }
    let score = 0;
    
    function draw() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#ff0';
        dots.forEach(d => ctx.fillRect(d.x*20+10, d.y*20+10, 5, 5));
        
        ctx.beginPath();
        ctx.arc(pacman.x*20+10, pacman.y*20+10, 8, 0.2*Math.PI, 1.8*Math.PI);
        ctx.fillStyle = '#ff0';
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.fillText('Score: ' + score, 10, 20);
    }
    
    function update() {
        let nx = pacman.x + pacman.dx, ny = pacman.y + pacman.dy;
        if (nx >= 0 && nx < 20 && ny >= 0 && ny < 20) {
            pacman.x = nx; pacman.y = ny;
        }
        
        dots = dots.filter(d => {
            if (d.x === pacman.x && d.y === pacman.y) { score += 10; return false; }
            return true;
        });
        
        if (!dots.length) { alert('You Win! Score: ' + score); dots = []; score = 0; }
        
        draw();
        setTimeout(update, 150);
    }
    
    document.addEventListener('keydown', e => {
        if (e.key === 'ArrowUp') { pacman.dx = 0; pacman.dy = -1; }
        if (e.key === 'ArrowDown') { pacman.dx = 0; pacman.dy = 1; }
        if (e.key === 'ArrowLeft') { pacman.dx = -1; pacman.dy = 0; }
        if (e.key === 'ArrowRight') { pacman.dx = 1; pacman.dy = 0; }
    });
    
    controls.innerHTML = '<p>Use Arrow Keys to move</p>';
    update();
}

// Game 14: Space Invaders (simplified)
function initSpaceInvaders(container, controls) {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    
    let player = {x: 180, y: 370};
    let bullets = [];
    let aliens = [];
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 8; c++) {
            aliens.push({x: c*45+20, y: r*30+20});
        }
    }
    let score = 0;
    
    function draw() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#0f0';
        ctx.fillRect(player.x, player.y, 40, 20);
        
        ctx.fillStyle = '#fff';
        bullets.forEach(b => ctx.fillRect(b.x, b.y, 4, 10));
        
        ctx.fillStyle = '#f00';
        aliens.forEach(a => ctx.fillRect(a.x, a.y, 30, 20));
        
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.fillText('Score: ' + score, 10, 20);
    }
    
    function update() {
        bullets.forEach((b, i) => {
            b.y -= 5;
            aliens.forEach((a, j) => {
                if (b.x > a.x && b.x < a.x+30 && b.y > a.y && b.y < a.y+20) {
                    aliens.splice(j, 1);
                    bullets.splice(i, 1);
                    score += 100;
                }
            });
        });
        
        aliens.forEach(a => { a.x += 1; });
        if (aliens.some(a => a.x > 350 || a.x < 10)) {
            aliens.forEach(a => { a.y += 20; a.x = 360 - a.x; });
        }
        
        if (aliens.some(a => a.y > 350)) { alert('Game Over! Score: ' + score); aliens = []; score = 0; }
        if (!aliens.length) { alert('You Win!'); aliens = []; score = 0; }
        
        draw();
        requestAnimationFrame(update);
    }
    
    let left = false, right = false;
    document.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft') left = true;
        if (e.key === 'ArrowRight') right = true;
        if (e.key === ' ') bullets.push({x: player.x+18, y: player.y});
    });
    document.addEventListener('keyup', e => {
        if (e.key === 'ArrowLeft') left = false;
        if (e.key === 'ArrowRight') right = false;
    });
    
    function move() {
        if (left) player.x -= 5;
        if (right) player.x += 5;
        player.x = Math.max(0, Math.min(360, player.x));
        setTimeout(move, 16);
    }
    
    controls.innerHTML = '<p>Arrow Keys to move, Space to shoot</p>';
    move();
    update();
}

// Game 15: Flappy Bird (simplified)
function initFlappy(container, controls) {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 400;
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    
    let bird = {x: 50, y: 200, v: 0};
    let pipes = [];
    let score = 0;
    let gameActive = true;
    
    function draw() {
        ctx.fillStyle = '#87ceeb';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        ctx.arc(bird.x, bird.y, 15, 0, Math.PI*2);
        ctx.fill();
        
        ctx.fillStyle = '#0a0';
        pipes.forEach(p => {
            ctx.fillRect(p.x, 0, 50, p.h);
            ctx.fillRect(p.x, p.h+120, 50, canvas.height-p.h-120);
        });
        
        ctx.fillStyle = '#000';
        ctx.font = '20px Arial';
        ctx.fillText('Score: ' + score, 10, 30);
    }
    
    function update() {
        if (!gameActive) return;
        
        bird.v += 0.5;
        bird.y += bird.v;
        
        pipes.forEach(p => { p.x -= 3; });
        if (pipes.length && pipes[0].x < -50) pipes.shift();
        if (!pipes.length || pipes[pipes.length-1].x < 150) {
            pipes.push({x: 300, h: Math.random()*200+50});
        }
        
        if (bird.y > 385 || bird.y < 15) { gameOver(); return; }
        
        pipes.forEach(p => {
            if (bird.x+15 > p.x && bird.x-15 < p.x+50) {
                if (bird.y-15 < p.h || bird.y+15 > p.h+120) { gameOver(); return; }
            }
            if (p.x === 35) score++;
        });
        
        draw();
        requestAnimationFrame(update);
    }
    
    function gameOver() {
        gameActive = false;
        alert('Game Over! Score: ' + score);
        bird = {x: 50, y: 200, v: 0};
        pipes = [];
        score = 0;
        gameActive = true;
        update();
    }
    
    document.addEventListener('keydown', e => {
        if (e.key === ' ' || e.key === 'ArrowUp') bird.v = -8;
    });
    
    controls.innerHTML = '<p>Press Space or Up to flap</p>';
    update();
}

// Game 16: Connect Four
function initConnectFour(container, controls) {
    container.innerHTML = '';
    const rows = 6, cols = 7;
    let board = Array(rows).fill().map(() => Array(cols).fill(0));
    let player = 1;
    let gameOver = false;
    
    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; max-width: 350px; margin: 0 auto; background: #333; padding: 5px; border-radius: 10px;';
    
    function render() {
        grid.innerHTML = '';
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = document.createElement('div');
                cell.style.cssText = 'width: 45px; height: 45px; background: ' + (board[r][c] === 0 ? '#fff' : board[r][c] === 1 ? '#f00' : '#ff0') + '; border-radius: 50%; cursor: pointer;';
                cell.onclick = () => play(c);
                grid.appendChild(cell);
            }
        }
    }
    
    function play(col) {
        if (gameOver) return;
        for (let r = rows-1; r >= 0; r--) {
            if (board[r][col] === 0) {
                board[r][col] = player;
                if (checkWin()) {
                    render();
                    setTimeout(() => alert('Player ' + player + ' wins!'), 100);
                    gameOver = true;
                    return;
                }
                player = player === 1 ? 2 : 1;
                render();
                return;
            }
        }
    }
    
    function checkWin() {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!board[r][c]) continue;
                if (c+3 < cols && board[r][c] === board[r][c+1] && board[r][c] === board[r][c+2] && board[r][c] === board[r][c+3]) return true;
                if (r+3 < rows && board[r][c] === board[r+1][c] && board[r][c] === board[r+2][c] && board[r][c] === board[r+3][c]) return true;
                if (r+3 < rows && c+3 < cols && board[r][c] === board[r+1][c+1] && board[r][c] === board[r+2][c+2] && board[r][c] === board[r+3][c+3]) return true;
                if (r-3 >= 0 && c+3 < cols && board[r][c] === board[r-1][c+1] && board[r][c] === board[r-2][c+2] && board[r][c] === board[r-3][c+3]) return true;
            }
        }
        return false;
    }
    
    container.appendChild(grid);
    render();
    controls.innerHTML = '<p>Click column to drop piece</p>';
}

// Game 17: Checkers (simplified 2-player)
function initCheckers(container, controls) {
    container.innerHTML = '';
    const size = 8;
    let board = Array(size).fill().map(() => Array(size).fill(null));
    let turn = 'red';
    
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < size; c++) {
            if ((r+c)%2) board[r][c] = 'black';
        }
    }
    for (let r = 5; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if ((r+c)%2) board[r][c] = 'red';
        }
    }
    
    let selected = null;
    
    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(8, 1fr); gap: 1px; max-width: 400px; margin: 0 auto; background: #654321; padding: 2px;';
    
    function render() {
        grid.innerHTML = '';
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const cell = document.createElement('div');
                cell.style.cssText = 'width: 48px; height: 48px; background: ' + ((r+c)%2 ? '#deb887' : '#8b4513') + '; display: flex; align-items: center; justify-content: center; cursor: pointer;';
                if (selected && selected.r === r && selected.c === c) cell.style.border = '3px solid #0f0';
                if (board[r][c]) {
                    const piece = document.createElement('div');
                    piece.style.cssText = 'width: 36px; height: 36px; background: ' + (board[r][c] === 'red' ? '#f00' : '#000') + '; border-radius: 50%; border: 2px solid #fff;';
                    cell.appendChild(piece);
                }
                cell.onclick = () => click(r, c);
                grid.appendChild(cell);
            }
        }
        container.appendChild(grid);
        document.getElementById('checkersTurn').textContent = turn + '\'s turn';
    }
    
    function click(r, c) {
        if (!board[r][c] && selected) {
            let dr = r - selected.r, dc = c - selected.c;
            if (Math.abs(dc) === 1 && ((turn === 'red' && dr === -1) || (turn === 'black' && dr === 1))) {
                board[r][c] = board[selected.r][selected.c];
                board[selected.r][selected.c] = null;
                turn = turn === 'red' ? 'black' : 'red';
                selected = null;
                render();
            } else if (Math.abs(dc) === 2 && Math.abs(dr) === 2) {
                let mr = selected.r + dr/2, mc = selected.c + dc/2;
                if (board[mr][mc] && board[mr][mc] !== board[selected.r][selected.c]) {
                    board[r][c] = board[selected.r][selected.c];
                    board[selected.r][selected.c] = null;
                    board[mr][mc] = null;
                    turn = turn === 'red' ? 'black' : 'red';
                    selected = null;
                    render();
                }
            }
        } else if (board[r][c] === turn) {
            selected = {r, c};
            render();
        }
    }
    
    const info = document.createElement('div');
    info.id = 'checkersTurn';
    info.style.cssText = 'text-align: center; margin-top: 1rem; font-size: 1.2rem;';
    container.appendChild(info);
    render();
    controls.innerHTML = '<p>Click to move, jump to capture</p>';
}

// Game 18: Guess the Number
function initGuessNumber(container, controls) {
    container.innerHTML = '';
    const target = Math.floor(Math.random() * 100) + 1;
    let attempts = 0;
    
    const area = document.createElement('div');
    area.style.cssText = 'text-align: center; padding: 2rem;';
    
    const input = document.createElement('input');
    input.type = 'number';
    input.style.cssText = 'padding: 0.75rem; font-size: 1.2rem; width: 150px; border: 2px solid #667eea; border-radius: 5px;';
    
    const btn = document.createElement('button');
    btn.style.cssText = 'margin-left: 0.5rem; padding: 0.75rem 1.5rem; font-size: 1.2rem; border: none; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; border-radius: 5px; cursor: pointer;';
    btn.textContent = 'Guess';
    
    const result = document.createElement('div');
    result.style.cssText = 'margin-top: 1rem; font-size: 1.2rem;';
    
    btn.onclick = () => {
        const guess = parseInt(input.value);
        attempts++;
        if (guess === target) {
            result.textContent = '🎉 Correct! It took ' + attempts + ' attempts.';
            btn.disabled = true;
        } else if (guess < target) {
            result.textContent = '📈 Too low! Try again.';
        } else {
            result.textContent = '📉 Too high! Try again.';
        }
        input.value = '';
        input.focus();
    };
    
    input.addEventListener('keypress', e => { if (e.key === 'Enter') btn.click(); });
    
    area.innerHTML = '<p style="margin-bottom: 1rem;">I\'m thinking of a number between 1-100</p>';
    area.appendChild(input);
    area.appendChild(btn);
    area.appendChild(result);
    container.appendChild(area);
    controls.innerHTML = '<p>Enter your guess</p>';
}

// Game 19: Reaction Time
function initReaction(container, controls) {
    container.innerHTML = '';
    let startTime, waiting = true, clicked = false;
    
    const area = document.createElement('div');
    area.style.cssText = 'width: 100%; height: 300px; background: #f00; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; cursor: pointer; border-radius: 10px;';
    area.textContent = 'Click to Start';
    
    area.onclick = () => {
        if (!waiting && !clicked) {
            const rt = Date.now() - startTime;
            area.textContent = 'Reaction: ' + rt + 'ms! Click to try again.';
            area.style.background = '#f00';
            waiting = true;
            clicked = false;
            return;
        }
        if (clicked) return;
        
        waiting = false;
        area.style.background = '#f00';
        area.textContent = 'Wait for green...';
        
        setTimeout(() => {
            if (clicked) return;
            area.style.background = '#0f0';
            area.textContent = 'Click NOW!';
            startTime = Date.now();
        }, Math.random() * 3000 + 1000);
    };
    
    area.onmousedown = () => {
        if (!waiting && !clicked) {
            clicked = true;
        }
    };
    
    container.appendChild(area);
    controls.innerHTML = '<p>Click when green!</p>';
}

// Game 20: Click Speed Test
function initClickSpeed(container, controls) {
    container.innerHTML = '';
    let clicks = 0, active = false, timeLeft = 10;
    
    const area = document.createElement('div');
    area.style.cssText = 'text-align: center; padding: 2rem;';
    
    const btn = document.createElement('button');
    btn.style.cssText = 'width: 200px; height: 200px; font-size: 1.5rem; border: none; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; border-radius: 50%; cursor: pointer; margin: 1rem auto; display: block;';
    btn.textContent = 'Click!';
    
    const info = document.createElement('div');
    info.style.cssText = 'font-size: 1.5rem; margin-top: 1rem;';
    info.innerHTML = '<div>Clicks: <span id="csClicks">0</span></div><div>Time: <span id="csTime">10</span>s</div>';
    
    btn.onclick = () => {
        if (!active && timeLeft === 10) {
            active = true;
            clicks = 0;
            timeLeft = 10;
            let timer = setInterval(() => {
                timeLeft--;
                document.getElementById('csTime').textContent = timeLeft;
                if (timeLeft <= 0) {
                    active = false;
                    clearInterval(timer);
                    btn.textContent = (clicks/10).toFixed(1) + ' CPS! Click to retry';
                }
            }, 1000);
        }
        if (active) {
            clicks++;
            document.getElementById('csClicks').textContent = clicks;
            btn.textContent = clicks;
        }
    };
    
    area.appendChild(btn);
    area.appendChild(info);
    container.appendChild(area);
    controls.innerHTML = '<p>Click as fast as you can!</p>';
}
