/**
 * Jigsaw Handspace - Main Application Script
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // State Variables
  // ==========================================================================
  let activeScreen = 'setup'; // 'setup', 'game', 'victory'
  let difficulty = 3; // N x N grid (3, 4, or 5)
  let capturedImageSrc = null; // Data URL of the captured/uploaded image
  let pieces = []; // Array of puzzle piece objects
  let isPlaying = false;
  let startTime = null;
  let timerInterval = null;
  
  // Hand tracking state
  let handsModel = null;
  let cameraHelper = null;
  let trackingActive = false;
  let lastHandDetectedTime = 0;
  let activeHandVideoTrack = null;
  
  // Setup screen tracking state
  let setupCameraHelper = null;
  let localStream = null;
  const setupCanvas = document.getElementById('setup-canvas');
  const setupCanvasCtx = setupCanvas.getContext('2d');
  let setupCaptureTimerStart = null;
  let currentCropBox = null;
  
  // Custom cursor smoothing
  let cursorX = 0;
  let cursorY = 0;
  let targetCursorX = 0;
  let targetCursorY = 0;
  const cursorSmoothFactor = 0.45; // 0-1, lower is smoother but slower
  
  // Drag and drop state
  let isPinching = false;
  let draggedPiece = null;
  let dragOffset = { x: 0, y: 0 };
  let isMouseDragging = false;
  let wasPinchingForClick = false;
  
  // Constants
  const BOARD_SIZE = 500; // Fixed board size in pixels
  
  // Web Audio Context for synthesized sound effects
  let audioCtx = null;

  // ==========================================================================
  // DOM Elements
  // ==========================================================================
  const virtualCursor = document.getElementById('virtual-cursor');
  const setupScreen = document.getElementById('setup-screen');
  const gameScreen = document.getElementById('game-screen');
  const victoryScreen = document.getElementById('victory-screen');
  
  // Setup Elements
  const setupVideo = document.getElementById('setup-video');
  const btnCapture = document.getElementById('btn-capture');
  const fileUpload = document.getElementById('file-upload');
  const countdownOverlay = document.getElementById('countdown-overlay');
  const cameraLoading = document.getElementById('camera-loading');
  const difficultyBtns = document.querySelectorAll('.difficulty-btn');
  
  // Game Board Elements
  const gameVideo = document.getElementById('game-video');
  const handCanvas = document.getElementById('hand-canvas');
  const handCanvasCtx = handCanvas.getContext('2d');
  const handStatus = document.getElementById('hand-status');
  const pinchStatus = document.getElementById('pinch-status');
  const gestureVisualizer = document.querySelector('.visualizer-circle');
  const gestureName = document.getElementById('gesture-name');
  const statTime = document.getElementById('stat-time');
  const statProgress = document.getElementById('stat-progress');
  const puzzleBoard = document.getElementById('puzzle-board');
  const puzzleAreaContainer = document.getElementById('puzzle-area-container');
  
  // Actions Buttons
  const btnToggleGuide = document.getElementById('btn-toggle-guide');
  const btnReset = document.getElementById('btn-reset');
  const btnBackToSetup = document.getElementById('btn-back-to-setup');
  
  // Victory Elements
  const victoryConfettiCanvas = document.getElementById('victory-confetti');
  const victoryPhotoPreview = document.getElementById('victory-photo-preview');
  const victoryTime = document.getElementById('victory-time');
  const victoryDifficulty = document.getElementById('victory-difficulty');
  const btnPlayAgain = document.getElementById('btn-play-again');
  const btnNewPhoto = document.getElementById('btn-new-photo');

  // ==========================================================================
  // Initialization
  // ==========================================================================
  switchScreen('setup');
  initCamera();
  initDifficultySelector();
  setupEventListeners();
  startCursorAnimationLoop();

  // Initialize Audio Context on user interaction to satisfy browser policies
  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  // ==========================================================================
  // Sound Effects Generator (Web Audio API)
  // ==========================================================================
  function playSound(type) {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    const now = audioCtx.currentTime;
    
    if (type === 'grab') {
      // Mystical sweep up
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.15);
      
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === 'release') {
      // Wind-down/fade spell
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.12);
      
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      
      osc.start(now);
      osc.stop(now + 0.13);
    } else if (type === 'snap') {
      // Magic crystal chime/ping
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(987.77, now); // B5 Note (pure crystal tone)
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1479.98, now); // F#6 (perfect fifth harmonic)
      
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.36);
      osc2.stop(now + 0.36);
    } else if (type === 'victory') {
      // Heavenly arpeggio of magic spells
      const wizardScale = [523.25, 659.25, 783.99, 987.77, 1046.50, 1318.51, 1567.98]; // C5, E5, G5, B5, C6, E6, G6
      wizardScale.forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.07);
        
        gain.gain.setValueAtTime(0.12, now + index * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.07 + 0.4);
        
        osc.start(now + index * 0.07);
        osc.stop(now + index * 0.07 + 0.42);
      });
    }
  }

  // ==========================================================================
  // Camera Setup (Setup Screen)
  // ==========================================================================
  async function initCamera() {
    try {
      cameraLoading.classList.remove('hidden');
      
      // Clear any prior stream
      stopCamera();
      
      // Register multiple event listeners BEFORE starting the stream to avoid race conditions
      const hideLoading = () => {
        cameraLoading.classList.add('hidden');
      };
      setupVideo.onloadedmetadata = hideLoading;
      setupVideo.onloadeddata = hideLoading;
      setupVideo.onplaying = hideLoading;
      setupVideo.oncanplay = hideLoading;
      
      await startSetupTracking();
    } catch (err) {
      console.error("Error accessing camera: ", err);
      cameraLoading.innerHTML = `
        <div style="color: var(--danger-color); text-align: center; padding: 20px;">
          <p>⚠️ คาถาเปิดมิติกล้องล้มเหลว (ไม่สามารถเข้าถึงกล้องได้)</p>
          <p style="font-size: 0.8rem; margin-top: 10px; color: var(--text-secondary);">โปรดตรวจสอบสิทธิ์การอนุญาตให้กระจกวิเศษเข้าถึงกล้องในเบราว์เซอร์</p>
        </div>
      `;
    }
  }

  function stopCamera() {
    if (setupVideo.srcObject) {
      setupVideo.srcObject.getTracks().forEach(track => track.stop());
      setupVideo.srcObject = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }
  }

  // Setup screen hand tracking (two-hand framing mode)
  async function startSetupTracking() {
    trackingActive = true;
    
    if (!handsModel) {
      handsModel = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      handsModel.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
      });

      handsModel.onResults(onHandResults);
    } else {
      handsModel.setOptions({ maxNumHands: 2 });
    }

    setupCanvas.width = 640;
    setupCanvas.height = 480;

    // Explicitly request video stream to handle camera blocked/missing errors correctly
    const constraints = {
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false
    };
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    setupVideo.srcObject = localStream;

    setupCameraHelper = new Camera(setupVideo, {
      onFrame: async () => {
        if (trackingActive && activeScreen === 'setup') {
          await handsModel.send({ image: setupVideo });
        }
      },
      width: 640,
      height: 480
    });
    
    setupCameraHelper.start();
  }

  function stopSetupTracking() {
    if (setupCameraHelper) {
      setupCameraHelper.stop();
      setupCameraHelper = null;
    }
    setupCanvasCtx.clearRect(0, 0, setupCanvas.width, setupCanvas.height);
  }

  function handleSetupHandResults(results) {
    setupCanvasCtx.clearRect(0, 0, setupCanvas.width, setupCanvas.height);
    const landmarks = results.multiHandLandmarks;

    if (landmarks && landmarks.length >= 1) {
      landmarks.forEach(hand => {
        drawHandSkeletonsOnCtx(setupCanvasCtx, hand);
      });

      // Track cursor position and pinch click with single hand (or first hand)
      const hand = landmarks[0];
      const indexTip = hand[8];
      const thumbTip = hand[4];
      
      // Coordinate Mapping:
      const mappedX = (1 - indexTip.x) * window.innerWidth;
      const mappedY = indexTip.y * window.innerHeight;
      
      // Update target cursor coordinates
      targetCursorX = mappedX;
      targetCursorY = mappedY;
      
      // Calculate Pinch Distance in 2D space
      const dx = indexTip.x - thumbTip.x;
      const dy = indexTip.y - thumbTip.y;
      const pinchDist = Math.sqrt(dx*dx + dy*dy);
      
      const handScale = getHandScale(hand);
      const normalizedPinch = pinchDist / handScale;
      
      handlePinchClick(normalizedPinch);
    } else {
      isPinching = false;
      wasPinchingForClick = false;
      virtualCursor.classList.remove('grabbing');
    }

    // Two-hand framing detection
    if (landmarks && landmarks.length === 2) {
      const hand1 = landmarks[0];
      const hand2 = landmarks[1];

      const isPinch1 = checkSingleHandPinch(hand1);
      const isPinch2 = checkSingleHandPinch(hand2);

      if (isPinch1 && isPinch2) {
        initAudio(); // Satisfy browser autoplay constraints
        
        // Coordinates in 640x480 canvas space
        const x1 = hand1[8].x * setupCanvas.width;
        const y1 = hand1[8].y * setupCanvas.height;
        const x2 = hand2[8].x * setupCanvas.width;
        const y2 = hand2[8].y * setupCanvas.height;

        // Midpoint and size (distance between hands)
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx*dx + dy*dy);

        // Crop box dimensions (square constraints)
        const minSize = 120;
        const maxSize = Math.min(setupCanvas.width, setupCanvas.height) - 40;
        const size = Math.max(minSize, Math.min(maxSize, distance));

        const left = midX - size / 2;
        const top = midY - size / 2;

        currentCropBox = { left, top, size };

        // Draw crop frame guide (Magic gold and purple glows)
        setupCanvasCtx.strokeStyle = '#e5b323';
        setupCanvasCtx.lineWidth = 4;
        setupCanvasCtx.shadowColor = '#9d50ff';
        setupCanvasCtx.shadowBlur = 15;
        setupCanvasCtx.strokeRect(left, top, size, size);

        // Draw corner brackets
        setupCanvasCtx.fillStyle = '#e5b323';
        const len = 20;
        setupCanvasCtx.fillRect(left - 2, top - 2, len, 4);
        setupCanvasCtx.fillRect(left - 2, top - 2, 4, len);
        setupCanvasCtx.fillRect(left + size - len + 2, top - 2, len, 4);
        setupCanvasCtx.fillRect(left + size + 2 - 4, top - 2, 4, len);
        setupCanvasCtx.fillRect(left - 2, top + size + 2 - 4, len, 4);
        setupCanvasCtx.fillRect(left - 2, top + size - len + 2, 4, len);
        setupCanvasCtx.fillRect(left + size - len + 2, top + size + 2 - 4, len, 4);
        setupCanvasCtx.fillRect(left + size + 2 - 4, top + size - len + 2, 4, len);

        setupCanvasCtx.shadowBlur = 0; // Reset canvas shadow

        // Count down handling
        if (!setupCaptureTimerStart) {
          setupCaptureTimerStart = Date.now();
        }

        const elapsed = Date.now() - setupCaptureTimerStart;
        const remaining = Math.ceil((3000 - elapsed) / 1000);

        if (remaining > 0) {
          countdownOverlay.classList.remove('hidden');
          countdownOverlay.textContent = remaining;
        } else {
          countdownOverlay.textContent = '📸';
          countdownOverlay.classList.remove('hidden');
          captureFramedPhoto();
        }
        return;
      }
    }

    // Reset if gestures or conditions are lost
    setupCaptureTimerStart = null;
    currentCropBox = null;
    countdownOverlay.classList.add('hidden');
  }

  function checkSingleHandPinch(hand) {
    const thumbTip = hand[4];
    const indexTip = hand[8];
    const dx = indexTip.x - thumbTip.x;
    const dy = indexTip.y - thumbTip.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    const handScale = getHandScale(hand);
    return (dist / handScale) < 0.25;
  }

  function captureFramedPhoto() {
    if (!currentCropBox) return;

    setupCaptureTimerStart = null;
    countdownOverlay.classList.add('hidden');

    const { left, top, size } = currentCropBox;

    // Create offscreen canvas to scale and mirror the captured crop
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = BOARD_SIZE;
    cropCanvas.height = BOARD_SIZE;
    const cropCtx = cropCanvas.getContext('2d');

    // Mirror to matching user orientation
    cropCtx.translate(BOARD_SIZE, 0);
    cropCtx.scale(-1, 1);

    // Map setupCanvas coordinates back to setupVideo's true resolution
    const scaleX = setupVideo.videoWidth / setupCanvas.width;
    const scaleY = setupVideo.videoHeight / setupCanvas.height;

    // Crop box boundary scaling
    const videoLeft = left * scaleX;
    const videoTop = top * scaleY;
    const videoSize = size * scaleX;

    cropCtx.drawImage(
      setupVideo,
      videoLeft,
      videoTop,
      videoSize,
      videoSize,
      0,
      0,
      BOARD_SIZE,
      BOARD_SIZE
    );

    capturedImageSrc = cropCanvas.toDataURL('image/jpeg', 0.9);
    playSound('snap');

    stopSetupTracking();
    stopCamera();
    switchScreen('game');
    startGame(capturedImageSrc);
  }

  // ==========================================================================
  // Difficulty Config
  // ==========================================================================
  function initDifficultySelector() {
    difficultyBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        difficultyBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        difficulty = parseInt(btn.dataset.grid, 10);
      });
    });
  }

  // ==========================================================================
  // Event Listeners Setup
  // ==========================================================================
  function setupEventListeners() {
    btnCapture.addEventListener('click', () => {
      initAudio();
      // Ensure the camera is ready and displaying valid video frames
      if (setupVideo.readyState < 2 || setupVideo.videoWidth === 0) {
        alert("กรุณารอกล้องเปิดใช้งาน หรือเลือกรูปภาพจากเครื่องคอมพิวเตอร์");
        return;
      }
      triggerCaptureFlow();
    });
    
    fileUpload.addEventListener('change', handleFileUpload);
    
    btnBackToSetup.addEventListener('click', () => {
      stopGame();
      switchScreen('setup');
      initCamera();
    });
    
    btnReset.addEventListener('click', () => {
      scramblePieces();
      resetTimer();
      startTimer();
    });

    let guideVisible = true;
    btnToggleGuide.addEventListener('click', () => {
      const guideImg = document.querySelector('.board-guide-image');
      if (guideImg) {
        guideVisible = !guideVisible;
        if (guideVisible) {
          guideImg.classList.remove('hidden');
          btnToggleGuide.classList.remove('btn-secondary');
          btnToggleGuide.classList.add('btn-primary');
        } else {
          guideImg.classList.add('hidden');
          btnToggleGuide.classList.remove('btn-primary');
          btnToggleGuide.classList.add('btn-secondary');
        }
      }
    });

    btnPlayAgain.addEventListener('click', () => {
      switchScreen('game');
      startGame(capturedImageSrc);
    });

    btnNewPhoto.addEventListener('click', () => {
      switchScreen('setup');
      initCamera();
    });
  }

  // ==========================================================================
  // Capture Image Flow
  // ==========================================================================
  function triggerCaptureFlow() {
    btnCapture.disabled = true;
    countdownOverlay.classList.remove('hidden');
    let count = 3;
    countdownOverlay.textContent = count;
    playSound('grab');
    
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownOverlay.textContent = count;
        playSound('grab');
      } else if (count === 0) {
        countdownOverlay.textContent = '📸';
        playSound('snap');
        captureSnapshot();
      } else {
        clearInterval(interval);
        countdownOverlay.classList.add('hidden');
        btnCapture.disabled = false;
        
        // Go to game screen with the captured image
        if (capturedImageSrc) {
          stopCamera();
          switchScreen('game');
          startGame(capturedImageSrc);
        }
      }
    }, 800);
  }

  function captureSnapshot() {
    const canvas = document.createElement('canvas');
    // Maintain standard 4:3 or use square mapping
    const minSize = Math.min(setupVideo.videoWidth, setupVideo.videoHeight);
    canvas.width = BOARD_SIZE;
    canvas.height = BOARD_SIZE;
    
    const ctx = canvas.getContext('2d');
    // Mirror the capture to match the mirrored display
    ctx.translate(BOARD_SIZE, 0);
    ctx.scale(-1, 1);
    
    // Draw centered square crop of the video
    const sx = (setupVideo.videoWidth - minSize) / 2;
    const sy = (setupVideo.videoHeight - minSize) / 2;
    ctx.drawImage(setupVideo, sx, sy, minSize, minSize, 0, 0, BOARD_SIZE, BOARD_SIZE);
    
    capturedImageSrc = canvas.toDataURL('image/jpeg', 0.9);
  }

  function handleFileUpload(e) {
    initAudio();
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Draw to square canvas to force BOARD_SIZE square aspect ratio
        const canvas = document.createElement('canvas');
        canvas.width = BOARD_SIZE;
        canvas.height = BOARD_SIZE;
        const ctx = canvas.getContext('2d');
        
        const minSize = Math.min(img.width, img.height);
        const sx = (img.width - minSize) / 2;
        const sy = (img.height - minSize) / 2;
        ctx.drawImage(img, sx, sy, minSize, minSize, 0, 0, BOARD_SIZE, BOARD_SIZE);
        
        capturedImageSrc = canvas.toDataURL('image/jpeg', 0.9);
        stopCamera();
        switchScreen('game');
        startGame(capturedImageSrc);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ==========================================================================
  // Screen Router
  // ==========================================================================
  function switchScreen(screenName) {
    activeScreen = screenName;
    
    setupScreen.classList.remove('active');
    gameScreen.classList.remove('active');
    victoryScreen.classList.remove('active');
    
    // Always display the custom virtual cursor since hand tracking is active everywhere!
    virtualCursor.style.display = 'block';
    
    if (screenName === 'setup') {
      setupScreen.classList.add('active');
      // On setup screen, tracking is handled by setupCameraHelper, so stop game hand tracking
      stopHandTracking();
    } else if (screenName === 'game') {
      gameScreen.classList.add('active');
      startHandTracking();
    } else if (screenName === 'victory') {
      victoryScreen.classList.add('active');
      startHandTracking();
    }
  }

  // ==========================================================================
  // Game Setup & Logic
  // ==========================================================================
  function startGame(imgSrc) {
    isPlaying = true;
    
    // Set progress label
    statProgress.textContent = `0 / ${difficulty * difficulty}`;
    
    // Set board layout and target grid
    puzzleBoard.style.width = `${BOARD_SIZE}px`;
    puzzleBoard.style.height = `${BOARD_SIZE}px`;
    puzzleBoard.innerHTML = '';
    
    // Draw guide image inside board (initially shown)
    const guideImg = document.createElement('img');
    guideImg.src = imgSrc;
    guideImg.className = 'board-guide-image';
    puzzleBoard.appendChild(guideImg);
    
    btnToggleGuide.classList.remove('btn-secondary');
    btnToggleGuide.classList.add('btn-primary');

    // Create target grids (slots)
    const pieceSize = BOARD_SIZE / difficulty;
    for (let r = 0; r < difficulty; r++) {
      for (let c = 0; c < difficulty; c++) {
        const slot = document.createElement('div');
        slot.className = 'puzzle-grid-slot';
        slot.style.width = `${pieceSize}px`;
        slot.style.height = `${pieceSize}px`;
        slot.style.left = `${c * pieceSize}px`;
        slot.style.top = `${r * pieceSize}px`;
        // Text guide inside slot (optional)
        slot.innerHTML = `<span style="opacity: 0.15">${r * difficulty + c + 1}</span>`;
        puzzleBoard.appendChild(slot);
      }
    }

    // Build pieces elements inside the container but not strictly inside board
    pieces = [];
    const container = puzzleAreaContainer;
    
    // Remove existing pieces from container
    const existingPieces = container.querySelectorAll('.puzzle-piece');
    existingPieces.forEach(p => p.remove());

    for (let r = 0; r < difficulty; r++) {
      for (let c = 0; c < difficulty; c++) {
        const el = document.createElement('div');
        el.className = 'puzzle-piece';
        el.style.width = `${pieceSize}px`;
        el.style.height = `${pieceSize}px`;
        el.style.backgroundImage = `url(${imgSrc})`;
        el.style.backgroundSize = `${BOARD_SIZE}px ${BOARD_SIZE}px`;
        el.style.backgroundPosition = `-${c * pieceSize}px -${r * pieceSize}px`;
        
        // Save matching data
        const pieceObj = {
          element: el,
          correctRow: r,
          correctCol: c,
          currentX: 0,
          currentY: 0,
          isLocked: false,
          pieceSize: pieceSize
        };
        
        // Double-click/click listener fallback for mouse players
        setupMouseFallback(pieceObj);
        
        container.appendChild(el);
        pieces.push(pieceObj);
      }
    }

    scramblePieces();
    resetTimer();
    startTimer();
  }

  function scramblePieces() {
    const container = puzzleAreaContainer;
    const rect = container.getBoundingClientRect();
    const boardRect = puzzleBoard.getBoundingClientRect();
    
    // Offset relative to the container using getBoundingClientRect()
    const boardLeft = boardRect.left - rect.left;
    const boardTop = boardRect.top - rect.top;
    
    const containerWidth = rect.width || 800;
    const containerHeight = rect.height || 550;
    const pieceSize = BOARD_SIZE / difficulty;

    pieces.forEach(p => {
      p.isLocked = false;
      p.element.className = 'puzzle-piece';
      
      // We want to place pieces randomly in the container, but preferably NOT right on top of the puzzle board
      let x, y;
      let validPos = false;
      let attempts = 0;

      while (!validPos && attempts < 100) {
        attempts++;
        // Generate random coordinates inside container bounds
        x = Math.random() * (containerWidth - pieceSize);
        y = Math.random() * (containerHeight - pieceSize);
        
        // Check if overlaps too much with puzzle board
        const overlapsBoard = (
          x + pieceSize > boardLeft - 20 &&
          x < boardLeft + BOARD_SIZE + 20 &&
          y + pieceSize > boardTop - 20 &&
          y < boardTop + BOARD_SIZE + 20
        );

        if (!overlapsBoard) {
          validPos = true;
        }
      }

      // If attempts exceeded, just place on the sides
      if (!validPos) {
        const placeOnLeft = Math.random() > 0.5;
        if (placeOnLeft) {
          x = Math.random() * Math.max(20, boardLeft - pieceSize - 20);
        } else {
          const minX = boardLeft + BOARD_SIZE + 20;
          x = minX + Math.random() * Math.max(20, containerWidth - minX - pieceSize);
        }
        y = Math.random() * (containerHeight - pieceSize);
      }

      p.currentX = x;
      p.currentY = y;
      p.element.style.left = `${x}px`;
      p.element.style.top = `${y}px`;
    });

    updateProgress();
  }

  function setupMouseFallback(pieceObj) {
    const el = pieceObj.element;
    
    el.addEventListener('mousedown', (e) => {
      if (pieceObj.isLocked) return;
      
      // Handle standard mouse drag
      initAudio();
      draggedPiece = pieceObj;
      isMouseDragging = true;
      el.classList.add('dragging');
      playSound('grab');
      
      const containerRect = puzzleAreaContainer.getBoundingClientRect();
      const clickX = e.clientX - containerRect.left;
      const clickY = e.clientY - containerRect.top;
      
      dragOffset.x = clickX - pieceObj.currentX;
      dragOffset.y = clickY - pieceObj.currentY;
      
      e.preventDefault();
    });
  }

  // Handle global mouse dragging fallback
  document.addEventListener('mousemove', (e) => {
    if (!draggedPiece || !isMouseDragging) return;
    
    const containerRect = puzzleAreaContainer.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;
    
    moveDraggedPiece(mouseX, mouseY);
  });

  document.addEventListener('mouseup', () => {
    if (!draggedPiece || !isMouseDragging) return;
    
    isMouseDragging = false;
    dropDraggedPiece();
  });

  // Common move logic
  function moveDraggedPiece(x, y) {
    if (!draggedPiece) return;
    
    let targetX = x - dragOffset.x;
    let targetY = y - dragOffset.y;
    
    // Constrain to container
    const containerRect = puzzleAreaContainer.getBoundingClientRect();
    const pSize = draggedPiece.pieceSize;
    
    targetX = Math.max(0, Math.min(containerRect.width - pSize, targetX));
    targetY = Math.max(0, Math.min(containerRect.height - pSize, targetY));
    
    draggedPiece.currentX = targetX;
    draggedPiece.currentY = targetY;
    draggedPiece.element.style.left = `${targetX}px`;
    draggedPiece.element.style.top = `${targetY}px`;
  }

  // Common drop/check snap logic
  function dropDraggedPiece() {
    if (!draggedPiece) return;
    
    const p = draggedPiece;
    const pSize = p.pieceSize;
    
    // Board coordinates relative to container using getBoundingClientRect()
    const containerRect = puzzleAreaContainer.getBoundingClientRect();
    const boardRect = puzzleBoard.getBoundingClientRect();
    const boardLeft = boardRect.left - containerRect.left;
    const boardTop = boardRect.top - containerRect.top;
    
    // Find the closest grid slot index based on the top-left of the piece relative to the board slots!
    const col = Math.round((p.currentX - boardLeft) / pSize);
    const row = Math.round((p.currentY - boardTop) / pSize);
    
    // Check if the closest slot is within the board boundaries (guidelines)
    if (col >= 0 && col < difficulty && row >= 0 && row < difficulty) {
      const snapX = boardLeft + col * pSize;
      const snapY = boardTop + row * pSize;
      
      // Check if this is the correct slot for this piece
      if (col === p.correctCol && row === p.correctRow) {
        // Snap and Lock in correct position
        p.currentX = snapX;
        p.currentY = snapY;
        p.element.style.left = `${snapX}px`;
        p.element.style.top = `${snapY}px`;
        p.element.classList.remove('dragging');
        p.element.classList.add('locked');
        p.isLocked = true;
        playSound('snap');
        
        // Check win state
        checkWinCondition();
      } else {
        // Snap to grid guidelines but DO NOT lock (remains draggable)
        p.currentX = snapX;
        p.currentY = snapY;
        p.element.style.left = `${snapX}px`;
        p.element.style.top = `${snapY}px`;
        p.element.classList.remove('dragging');
        playSound('snap');
      }
    } else {
      // Dropped outside the board, just release it where it is
      p.element.classList.remove('dragging');
      playSound('release');
    }
    
    draggedPiece = null;
    updateProgress();
  }

  function updateProgress() {
    const lockedCount = pieces.filter(p => p.isLocked).length;
    statProgress.textContent = `${lockedCount} / ${pieces.length}`;
  }

  function checkWinCondition() {
    const allLocked = pieces.every(p => p.isLocked);
    if (allLocked && isPlaying) {
      triggerVictory();
    }
  }

  // ==========================================================================
  // Timer Functions
  // ==========================================================================
  function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      statTime.textContent = formatTime(elapsed);
    }, 1000);
  }

  function resetTimer() {
    clearInterval(timerInterval);
    statTime.textContent = '00:00';
  }

  function stopGame() {
    isPlaying = false;
    clearInterval(timerInterval);
  }

  function formatTime(ms) {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const secs = (totalSecs % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  // ==========================================================================
  // Victory Screen Trigger
  // ==========================================================================
  function triggerVictory() {
    stopGame();
    playSound('victory');
    
    // Set victory details
    victoryPhotoPreview.src = capturedImageSrc;
    victoryTime.textContent = statTime.textContent;
    victoryDifficulty.textContent = `${difficulty} x ${difficulty}`;
    
    switchScreen('victory');
    startConfetti();
  }

  // Confetti Simulation
  let confettiInterval = null;
  function startConfetti() {
    const canvas = victoryConfettiCanvas;
    const ctx = canvas.getContext('2d');
    
    // Resize canvas
    const resizeCanvas = () => {
      canvas.width = canvas.parentElement.clientWidth || 600;
      canvas.height = canvas.parentElement.clientHeight || 500;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    const colors = ['#7000ff', '#00f0ff', '#00ff88', '#ff0055', '#ffaa00'];
    const confettiCount = 80;
    const confettiArray = [];
    
    for (let i = 0; i < confettiCount; i++) {
      confettiArray.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedX: Math.random() * 2 - 1,
        speedY: Math.random() * 3 + 2,
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 4 - 2
      });
    }
    
    function draw() {
      if (activeScreen !== 'victory') {
        cancelAnimationFrame(confettiInterval);
        return;
      }
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      confettiArray.forEach(p => {
        p.y += p.speedY;
        p.x += p.speedX;
        p.rotation += p.rotationSpeed;
        
        // Loop back to top
        if (p.y > canvas.height) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }
        
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });
      
      confettiInterval = requestAnimationFrame(draw);
    }
    
    draw();
  }

  // ==========================================================================
  // MediaPipe Hand Tracking Setup & Loops
  // ==========================================================================

  async function startHandTracking() {
    trackingActive = true;
    
    // Initialize MediaPipe Hands if not already done
    if (!handsModel) {
      handsModel = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      handsModel.onResults(onHandResults);
    }

    // Configure for single hand mode on game screen for better performance and precision
    handsModel.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });

    try {
      // Start camera feed for game screen
      const constraints = {
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      gameVideo.srcObject = stream;
      activeHandVideoTrack = stream;
      
      // Use MediaPipe Camera helper
      cameraHelper = new Camera(gameVideo, {
        onFrame: async () => {
          if (trackingActive) {
            await handsModel.send({ image: gameVideo });
          }
        },
        width: 320,
        height: 240
      });
      
      cameraHelper.start();
      
      handCanvas.width = 320;
      handCanvas.height = 240;
      
    } catch (err) {
      console.error("Error starting camera tracking: ", err);
      handStatus.textContent = "กล้องขัดข้อง";
      trackingActive = false;
      virtualCursor.style.display = 'none';
    }
  }

  function stopHandTracking() {
    trackingActive = false;
    if (cameraHelper) {
      cameraHelper.stop();
      cameraHelper = null;
    }
    if (activeHandVideoTrack) {
      activeHandVideoTrack.getTracks().forEach(track => track.stop());
      activeHandVideoTrack = null;
    }
    
    // Clear canvas
    handCanvasCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
  }

  // Unified callback to route hand tracking results based on screen state
  function onHandResults(results) {
    if (!trackingActive) return;
    
    if (activeScreen === 'setup') {
      handleSetupHandResults(results);
    } else if (activeScreen === 'game' || activeScreen === 'victory') {
      handleGameHandResults(results);
    }
  }

  // Process MediaPipe Hand Results on Game Screen
  function handleGameHandResults(results) {
    // Clear canvas first
    handCanvasCtx.save();
    handCanvasCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
    
    // Drawing the background video on canvas (mirrored)
    handCanvasCtx.translate(handCanvas.width, 0);
    handCanvasCtx.scale(-1, 1);
    handCanvasCtx.drawImage(results.image, 0, 0, handCanvas.width, handCanvas.height);
    handCanvasCtx.restore();

    const landmarks = results.multiHandLandmarks;
    
    if (landmarks && landmarks.length > 0) {
      lastHandDetectedTime = Date.now();
      handStatus.textContent = "เชื่อมต่อสื่อนำเวท";
      handStatus.className = "badge success-badge";
      
      const hand = landmarks[0];
      
      // Draw landmarks on the mirror canvas
      drawHandSkeletonsOnCtx(handCanvasCtx, hand);

      // Get index tip (8) and thumb tip (4)
      const indexTip = hand[8];
      const thumbTip = hand[4];
      
      // Coordinate Mapping:
      const mappedX = (1 - indexTip.x) * window.innerWidth;
      const mappedY = indexTip.y * window.innerHeight;
      
      // Update target cursor coordinates
      targetCursorX = mappedX;
      targetCursorY = mappedY;
      
      // Calculate Pinch Distance in 2D space
      const dx = indexTip.x - thumbTip.x;
      const dy = indexTip.y - thumbTip.y;
      const pinchDist = Math.sqrt(dx*dx + dy*dy);
      
      // Pinch Gesture Detection
      handlePinchGesture(pinchDist);
      
    } else {
      // Hand not found or lost
      const now = Date.now();
      if (now - lastHandDetectedTime > 1500) {
        handStatus.textContent = "ไม่พบสื่อนำเวท";
        handStatus.className = "badge danger-badge";
        pinchStatus.textContent = "คลายเวท (Open)";
        pinchStatus.className = "badge";
        gestureVisualizer.textContent = "🖐️";
        gestureVisualizer.classList.remove('active');
        gestureName.textContent = "กรุณายกสื่อนำเวท (มือ) ขึ้นส่องกระจก";
        
        // Auto-release if hand was lost while dragging
        if (isPinching) {
          isPinching = false;
          virtualCursor.classList.remove('grabbing');
          dropDraggedPiece();
        }
      }
    }
  }

  function getHandScale(hand) {
    const wrist = hand[0];
    const middleMcp = hand[9];
    const dx = middleMcp.x - wrist.x;
    const dy = middleMcp.y - wrist.y;
    return Math.sqrt(dx*dx + dy*dy) || 0.1;
  }

  // Reusable skeleton drawer for both screens
  function drawHandSkeletonsOnCtx(ctx, hand) {
    ctx.save();
    
    // Draw connections
    if (window.drawConnectors && window.HAND_CONNECTIONS) {
      window.drawConnectors(ctx, hand, window.HAND_CONNECTIONS, {
        color: '#9d50ff', // Wizard Purple
        lineWidth: 2
      });
    }
    
    // Draw landmarks
    if (window.drawLandmarks) {
      window.drawLandmarks(ctx, hand, {
        color: '#e5b323', // Magic Gold
        lineWidth: 1,
        radius: 3
      });
    }
    
    ctx.restore();
  }

  // Process Pinch Grab/Release logic
  function handlePinchGesture(dist) {
    const PINCH_CLOSE_THRESHOLD = 0.25; // Relative to hand scale
    const PINCH_OPEN_THRESHOLD = 0.38;  // Relative to hand scale

    // Current pointer coordinates relative to the interactive board container
    const containerRect = puzzleAreaContainer.getBoundingClientRect();
    const localCursorX = cursorX - containerRect.left;
    const localCursorY = cursorY - containerRect.top;

    if (!isPinching && dist < PINCH_CLOSE_THRESHOLD) {
      // Pinch Grab Started!
      isPinching = true;
      virtualCursor.classList.add('grabbing');
      pinchStatus.textContent = "ร่ายมนต์ยึดจับ (Grab)";
      pinchStatus.className = "badge success-badge";
      gestureVisualizer.textContent = "👌";
      gestureVisualizer.classList.add('active');
      gestureName.textContent = "ผนึกอัญเชิญสำแดงผล!";
      playSound('grab');

      // Attempt to pick up a piece
      const grabbed = checkAndGrabPiece(localCursorX, localCursorY);
      
      // If no piece was grabbed, try to click a button option
      if (!grabbed) {
        triggerClickAtCursor();
      }
    } 
    else if (isPinching && dist > PINCH_OPEN_THRESHOLD) {
      // Pinch Released!
      isPinching = false;
      virtualCursor.classList.remove('grabbing');
      pinchStatus.textContent = "คลายมนต์สะกด (Release)";
      pinchStatus.className = "badge";
      gestureVisualizer.textContent = "🖐️";
      gestureVisualizer.classList.remove('active');
      gestureName.textContent = "คลายมนต์ปล่อยชิ้นส่วน";
      
      dropDraggedPiece();
    }

    if (isPinching && draggedPiece) {
      // Update dragged piece position based on smoothed cursor
      moveDraggedPiece(localCursorX, localCursorY);
    }
  }

  function handlePinchClick(dist) {
    const PINCH_CLOSE_THRESHOLD = 0.25;
    const PINCH_OPEN_THRESHOLD = 0.38;
    
    if (!wasPinchingForClick && dist < PINCH_CLOSE_THRESHOLD) {
      wasPinchingForClick = true;
      virtualCursor.classList.add('grabbing');
      playSound('grab');
      
      // Perform click on the hovered element
      triggerClickAtCursor();
    } 
    else if (wasPinchingForClick && dist > PINCH_OPEN_THRESHOLD) {
      wasPinchingForClick = false;
      virtualCursor.classList.remove('grabbing');
      playSound('release');
    }
  }

  function triggerClickAtCursor() {
    // Find element under smoothed cursor position
    const el = document.elementFromPoint(cursorX, cursorY);
    if (!el) return;
    
    // Find closest button, label, input, or link
    const clickable = el.closest('button, label, a, input, .difficulty-btn, .btn');
    if (clickable) {
      // Highlight click animation
      clickable.classList.add('hand-clicked');
      setTimeout(() => clickable.classList.remove('hand-clicked'), 200);
      
      // Play sound
      playSound('snap');
      
      clickable.click();
    }
  }

  function checkAndGrabPiece(x, y) {
    // Find if coordinates are over any un-locked puzzle piece
    // Sort from highest z-index/last placed to ensure we pick the top one
    const hoverCandidates = pieces.filter(p => !p.isLocked && isCursorOverPiece(x, y, p));
    
    if (hoverCandidates.length > 0) {
      // Pick the last one (drawn on top)
      const targetPiece = hoverCandidates[hoverCandidates.length - 1];
      draggedPiece = targetPiece;
      targetPiece.element.classList.add('dragging');
      
      // Save offset from the piece top-left coordinate
      dragOffset.x = x - targetPiece.currentX;
      dragOffset.y = y - targetPiece.currentY;
      return true;
    }
    return false;
  }

  function isCursorOverPiece(cx, cy, pieceObj) {
    const px = pieceObj.currentX;
    const py = pieceObj.currentY;
    const pSize = pieceObj.pieceSize;
    
    return (cx >= px && cx <= px + pSize && cy >= py && cy <= py + pSize);
  }

  // ==========================================================================
  // Virtual Cursor Smoother, Magic Particles and Render Loop
  // ==========================================================================
  let lastParticleX = 0;
  let lastParticleY = 0;

  function createMagicParticle(x, y) {
    const particle = document.createElement('div');
    particle.className = 'magic-particle';
    
    const colors = ['#e5b323', '#9d50ff', '#ffffff', '#e188ff', '#00ffcc'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    particle.style.color = randomColor;
    particle.style.background = `radial-gradient(circle, #fff 10%, ${randomColor} 50%, transparent 100%)`;
    
    const size = Math.random() * 8 + 4;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    
    document.body.appendChild(particle);
    
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 40 + 10;
    const targetX = Math.cos(angle) * distance;
    const targetY = Math.sin(angle) * distance;
    
    requestAnimationFrame(() => {
      particle.style.transform = `translate(${targetX}px, ${targetY}px) scale(0)`;
      particle.style.opacity = '0';
    });
    
    setTimeout(() => {
      particle.remove();
    }, 850);
  }

  function startCursorAnimationLoop() {
    function animate() {
      if (trackingActive) {
        // Exponential smoothing (lerp)
        cursorX += (targetCursorX - cursorX) * cursorSmoothFactor;
        cursorY += (targetCursorY - cursorY) * cursorSmoothFactor;
        
        // Position the custom virtual cursor element
        virtualCursor.style.left = `${cursorX}px`;
        virtualCursor.style.top = `${cursorY}px`;

        // Spawn particles based on virtual cursor movement
        const dx = cursorX - lastParticleX;
        const dy = cursorY - lastParticleY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 4) {
          createMagicParticle(cursorX, cursorY);
          lastParticleX = cursorX;
          lastParticleY = cursorY;
        }
      }
      
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }

  // Mouse fallback particles trail
  document.addEventListener('mousemove', (e) => {
    if (!trackingActive) {
      const dx = e.clientX - lastParticleX;
      const dy = e.clientY - lastParticleY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 6) {
        createMagicParticle(e.clientX, e.clientY);
        lastParticleX = e.clientX;
        lastParticleY = e.clientY;
      }
    }
  });
});
