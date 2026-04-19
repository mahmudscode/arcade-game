// Main application logic

document.addEventListener('DOMContentLoaded', () => {
    const gamesGrid = document.getElementById('gamesGrid');
    const gameModal = document.getElementById('gameModal');
    const closeModal = document.getElementById('closeModal');
    const gameTitle = document.getElementById('gameTitle');
    const gameContainer = document.getElementById('gameContainer');
    const gameControls = document.getElementById('gameControls');
    const navBtns = document.querySelectorAll('.nav-btn');
    
    let currentGameInstance = null; // Track current game instance
    
    // Render games
    function renderGames(filter = 'all') {
        gamesGrid.innerHTML = '';
        games.forEach(game => {
            if (filter !== 'all' && game.category !== filter) return;
            const card = document.createElement('div');
            card.className = 'game-card';
            card.innerHTML = `
                <div class="icon">${game.icon}</div>
                <h3>${game.name}</h3>
                <div class="category">${game.category}</div>
            `;
            card.onclick = () => openGame(game); 
            gamesGrid.appendChild(card);
        });
    }
    
    // Close game properly
    function closeGame() {
        if (currentGameInstance && typeof currentGameInstance.stop === 'function') {
            currentGameInstance.stop();
        }
        gameContainer.innerHTML = '';
        gameControls.innerHTML = '';
        currentGameInstance = null;
    }
    
    // Open game modal
    function openGame(game) {
        // Close previous game if still open
        closeGame();

        gameTitle.textContent = game.icon + ' ' + game.name;
        gameContainer.innerHTML = '';
        gameControls.innerHTML = '';
        currentGameInstance = game.init(gameContainer, gameControls);
        gameModal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Focus the game canvas for keyboard input
        setTimeout(() => {
            const canvas = gameContainer.querySelector('canvas');
            if (canvas) {
                canvas.focus();
            }
        }, 50);
    }
    
    // Close modal
    closeModal.onclick = () => {
        gameModal.classList.remove('active');
        document.body.style.overflow = 'auto';
        closeGame();
    };
    
    gameModal.onclick = (e) => {
        if (e.target === gameModal) {
            gameModal.classList.remove('active');
            document.body.style.overflow = 'auto';
            closeGame();
        }
    };
    
    // Filter games
    navBtns.forEach(btn => {
        btn.onclick = () => {
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderGames(btn.dataset.category);
        };
    });
    
    // Initial render
    renderGames();
});
