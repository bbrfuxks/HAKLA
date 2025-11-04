// Simple Flappy clone — ready to paste & run with your folder structure
// assets/ -> images; sounds/ -> audio

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const startScreen = document.getElementById('startScreen');
  const endScreen = document.getElementById('endScreen');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const scoreEl = document.getElementById('score');
  const endImg = document.getElementById('endImg');

  // design resolution
  const W = 480, H = 640;
  canvas.width = W;
  canvas.height = H;

  let lastTime = 0;
  let gameState = 'start'; // 'start' | 'playing' | 'dead'
  let score = 0;

  // physics
  const GRAV = 0.45;
  const FLAP = -8.5;

  // bird
  let bird = { x: 90, y: 200, vy: 0, w: 48, h: 48 };

  // pipes
  const pipes = [];
  const PIPE_GAP = 150;
  const PIPE_SPEED = 2.2;
  let pipeTimer = 0;
  const PIPE_INTERVAL = 1400; // ms

  // images to load (must match your filenames)
  const images = {};
  const imageFiles = {
    bg: 'assets/bg.png',
    startBg: 'assets/start_bg.png',
    ground: 'assets/ground.png',
    bird: 'assets/bird.png',
    pipeTop: 'assets/pipe_top.png',
    pipeBottom: 'assets/pipe_bottom.png',
    logo: 'assets/logo.png',
    winImg: 'assets/win_img.png',
    loseImg: 'assets/lose_img.png'
  };

  // sounds to load
  const sounds = {};
  const soundFiles = {
    bgMusic: 'sounds/bg_music.mp3',
    jump: 'sounds/jump.mp3',
    point: 'sounds/point.mp3',
    die: 'sounds/die.mp3',
    hit: 'sounds/hit.mp3',
    lose: 'sounds/lose.mp3',
    win: 'sounds/win.mp3'
  };

  // preload images & audio
  function preloadAll() {
    const imgPromises = Object.keys(imageFiles).map(key => {
      return new Promise((res, rej) => {
        const img = new Image();
        img.src = imageFiles[key];
        img.onload = () => { images[key] = img; res(); };
        img.onerror = () => { console.warn('Image load failed', imageFiles[key]); images[key] = null; res(); };
      });
    });

    const audPromises = Object.keys(soundFiles).map(key => {
      return new Promise((res) => {
        const a = new Audio();
        a.src = soundFiles[key];
        a.preload = 'auto';
        // for mobile autoplay lock — mark loaded when canplaythrough or error
        a.addEventListener('canplaythrough', () => { sounds[key] = a; res(); }, { once: true });
        a.addEventListener('error', () => { console.warn('Audio load failed', soundFiles[key]); sounds[key] = a; res(); }, { once: true });
      });
    });

    return Promise.all([...imgPromises, ...audPromises]);
  }

  // Ensure background music is played only after user gesture (unlock)
  function unlockAudio() {
    // call play then pause to unlock in mobile browsers
    try {
      const m = sounds.bgMusic;
      if (m) {
        m.loop = true;
        m.volume = 0.5;
        m.play().then(() => { m.pause(); m.currentTime = 0; }).catch(()=>{/*ignore*/});
      }
    } catch (e) {}
  }

  // reset game
  function resetGame() {
    score = 0;
    bird = { x: 90, y: H/2 - 30, vy: 0, w: 48, h: 48 };
    pipes.length = 0;
    pipeTimer = 0;
    gameState = 'playing';
    scoreEl.textContent = '0';
    startScreen.classList.add('hidden');
    endScreen.classList.add('hidden');
    // start bg music
    if (sounds.bgMusic) {
      sounds.bgMusic.currentTime = 0;
      sounds.bgMusic.play().catch(()=>{});
    }
  }

  function spawnPipe() {
    const minTop = 60;
    const maxTop = H - 200 - PIPE_GAP;
    const topY = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;
    pipes.push({
      x: W + 30,
      topY,
      passed: false
    });
  }

  // input: flap
  function flap() {
    if (gameState === 'start') {
      // unlock audio with first gesture
      unlockAudio();
      resetGame();
      return;
    }
    if (gameState === 'dead') return;
    bird.vy = FLAP;
    if (sounds.jump) {
      sounds.jump.currentTime = 0; sounds.jump.play().catch(()=>{});
    }
  }

  // collisions
  function checkCollision() {
    // ground collision (ground image height unknown; assume 56 px at bottom)
    const groundY = H - 60; // safe estimate
    if (bird.y + bird.h/2 >= groundY) return true;
    if (bird.y - bird.h/2 <= 0) return true; // ceiling collision

    for (let p of pipes) {
      const pipeW = images.pipeTop ? images.pipeTop.width : 52;
      // top pipe rect
      const topRect = { x: p.x, y: 0, w: pipeW, h: p.topY };
      const bottomRect = { x: p.x, y: p.topY + PIPE_GAP, w: pipeW, h: H - (p.topY + PIPE_GAP) - 60 };

      const birdRect = { x: bird.x - bird.w/2, y: bird.y - bird.h/2, w: bird.w, h: bird.h };

      if (rectOverlap(birdRect, topRect) || rectOverlap(birdRect, bottomRect)) return true;
    }
    return false;
  }

  function rectOverlap(a, b) {
    return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
  }

  // main loop
  function update(dt) {
    if (gameState === 'playing') {
      // physics
      bird.vy += GRAV;
      bird.y += bird.vy;

      // spawn pipes on interval
      pipeTimer += dt;
      if (pipeTimer >= PIPE_INTERVAL) {
        spawnPipe();
        pipeTimer = 0;
      }

      // move pipes, handle scoring & removal
      for (let i = pipes.length - 1; i >= 0; i--) {
        const p = pipes[i];
        p.x -= PIPE_SPEED;
        // score when pipe passes bird
        if (!p.passed && p.x + 30 < bird.x) {
          p.passed = true;
          score++;
          scoreEl.textContent = score;
          if (sounds.point) { sounds.point.currentTime = 0; sounds.point.play().catch(()=>{}); }
        }
        if (p.x < -120) pipes.splice(i,1);
      }

      // check collision
      if (checkCollision()) {
        gameOver();
      }
    }
  }

  function gameOver() {
    gameState = 'dead';
    // stop bg music
    if (sounds.bgMusic) { try { sounds.bgMusic.pause(); } catch(e){} }
    // play die/hit/lose
    if (sounds.die) { sounds.die.currentTime = 0; sounds.die.play().catch(()=>{}); }
    if (sounds.lose) { setTimeout(()=> { sounds.lose.currentTime = 0; sounds.lose.play().catch(()=>{}); }, 200); }
    // show end screen with image (win vs lose) — use lose here
    endImg.src = images.loseImg ? images.loseImg.src : 'assets/lose_img.png';
    endScreen.classList.remove('hidden');
  }

  // drawing
  function draw() {
    // draw background
    if (images.bg) {
      // tile background to fill width
      ctx.drawImage(images.bg, 0, 0, W, H);
    } else {
      ctx.fillStyle = '#87CEEB'; ctx.fillRect(0,0,W,H);
    }

    // pipes
    for (let p of pipes) {
      const topImg = images.pipeTop;
      const bottomImg = images.pipeBottom;
      const pW = topImg ? topImg.width : 52;
      // top pipe
      if (topImg) {
        // scale top image to desired height
        ctx.drawImage(topImg, p.x, p.topY - (topImg.height), pW, topImg.height);
      } else {
        ctx.fillStyle = '#1a8a1a';
        ctx.fillRect(p.x, 0, 52, p.topY);
      }
      // bottom pipe
      if (bottomImg) {
        ctx.drawImage(bottomImg, p.x, p.topY + PIPE_GAP, pW, bottomImg.height);
      } else {
        ctx.fillStyle = '#1a8a1a';
        ctx.fillRect(p.x, p.topY + PIPE_GAP, 52, H - (p.topY + PIPE_GAP) - 60);
      }
    }

    // ground
    if (images.ground) {
      const gh = images.ground.height;
      ctx.drawImage(images.ground, 0, H - gh, W, gh);
    } else {
      ctx.fillStyle = '#7b5a2a';
      ctx.fillRect(0, H - 60, W, 60);
    }

    // bird (centered on bird.x, bird.y)
    if (images.bird) {
      const bw = bird.w, bh = bird.h;
      ctx.save();
      // rotate slightly based on vy
      const angle = Math.max(-0.6, Math.min(0.8, bird.vy / 12));
      ctx.translate(bird.x, bird.y);
      ctx.rotate(angle);
      ctx.drawImage(images.bird, -bw/2, -bh/2, bw, bh);
      ctx.restore();
    } else {
      ctx.fillStyle = '#ff0';
      ctx.fillRect(bird.x - 20, bird.y - 20, 40, 40);
    }
  }

  function loop(ts) {
    if (!lastTime) lastTime = ts;
    const dt = ts - lastTime;
    lastTime = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // controls
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); flap(); }
  });
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); flap(); }, {passive:false});
  canvas.addEventListener('mousedown', (e) => { e.preventDefault(); flap(); });

  startBtn.addEventListener('click', (e) => { e.preventDefault(); unlockAudio(); resetGame(); });
  restartBtn.addEventListener('click', (e) => { e.preventDefault(); resetGame(); });

  // Show start overlay logo image if available
  function showStartUI() {
    startScreen.classList.remove('hidden');
    endScreen.classList.add('hidden');
    scoreEl.textContent = '0';
  }

  // start preloading then start animation
  preloadAll().then(() => {
    // small fallback: if an image/asset failed but game should still run
    if (images.winImg) endImg.src = images.winImg.src;
    showStartUI();
    // start rendering loop
    requestAnimationFrame(loop);
  }).catch((err)=> {
    console.error(err);
    showStartUI();
    requestAnimationFrame(loop);
  });

  // helpful: pause/resume on page hide
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (sounds.bgMusic) try { sounds.bgMusic.pause(); } catch(e){}
    } else {
      if (gameState === 'playing' && sounds.bgMusic) try { sounds.bgMusic.play().catch(()=>{}); } catch(e){}
    }
  });

})();