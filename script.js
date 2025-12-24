// ============================================
// SIGN LANGUAGE TRANSLATOR with TensorFlow.js
// ============================================

// CONFIGURATION
const CONFIG = {
    // Gesture recognition settings
    GESTURE_HOLD_DELAY: 2000, // milliseconds to hold before adding to translation
    MIN_CONFIDENCE: 0.7,      // minimum confidence for gesture recognition

    // Text-to-speech settings
    TTS_RATE: 0.8,            // speech rate (0.1 to 2) - optimized for ASL clarity
    TTS_VOLUME: 0.9,          // speech volume (0 to 1)
    LETTER_PAUSE: false,       // DIMATIKAN: baca sebagai kalimat, bukan per huruf
    TTS_VOICE: 'en-US',       // default voice language
    TTS_PITCH: 1.0,           // speech pitch (0.5 to 2.0)
    ENHANCED_TTS: true,       // use enhanced TTS features

    // UI settings
    SHOW_NOTIFICATIONS: true, // show notification popups
    NOTIFICATION_DURATION: 3000, // milliseconds

    // MediaPipe settings
    MAX_NUM_HANDS: 2,
    MODEL_COMPLEXITY: 1,
    MIN_DETECTION_CONFIDENCE: 0.7,
    MIN_TRACKING_CONFIDENCE: 0.7
};

// MediaPipe Drawing Utils (must be imported from window object)
const drawConnectors = window.drawConnectors;
const drawLandmarks = window.drawLandmarks;
const HAND_CONNECTIONS = window.HAND_CONNECTIONS;

// Global Variables
let camera = null;
let hands = null;
let canvasCtx = null;
let isDetecting = false;
let translationHistory = [];

// TensorFlow Model
let tfModel = null;
let modelLoaded = false;

// Translation Mode Control
let isTranslationActive = true; // Always active - NO PAUSE (continuous recording mode)

// Gesture tracking with configurable delay
let lastGesture = '';
let gestureStartTime = 0;
let lastTwoHandGesture = '';
let twoHandGestureStartTime = 0;
let currentHoldProgress = 0;
let holdInterval = null;

// Hand presence tracking (untuk reset gesture saat tangan hilang)
let lastHandDetectedTime = 0;
let handWasDetected = false;
const HAND_ABSENCE_RESET_DELAY = 500; // Reset setelah 500ms tangan hilang

// ASL Alphabet Labels (A-Z)
const GESTURE_LABELS = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
    'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
    'U', 'V', 'W', 'X', 'Y', 'Z'
];

// Translation mapping - ASL letters
const GESTURE_TRANSLATIONS = {
    'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'E': 'E',
    'F': 'F', 'G': 'G', 'H': 'H', 'I': 'I', 'J': 'J',
    'K': 'K', 'L': 'L', 'M': 'M', 'N': 'N', 'O': 'O',
    'P': 'P', 'Q': 'Q', 'R': 'R', 'S': 'S', 'T': 'T',
    'U': 'U', 'V': 'V', 'W': 'W', 'X': 'X', 'Y': 'Y', 'Z': 'Z'
};

// DOM Elements
const videoElement = document.getElementById('videoElement');
const canvasElement = document.getElementById('canvasElement');
const speakBtn = document.getElementById('speakBtn');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const outputBox = document.getElementById('outputBox');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const handCount = document.getElementById('handCount');
const handCountText = document.getElementById('handCountText');
const currentGesture = document.getElementById('currentGesture');
const confidence = document.getElementById('confidence');
const modeIndicator = document.getElementById('modeIndicator');
const modeIcon = document.getElementById('modeIcon');
const modeText = document.getElementById('modeText');
const translationModeStatus = document.getElementById('translationModeStatus');
const modelStatus = document.getElementById('modelStatusText');

// Debug: Check if buttons are found
console.log('Button elements:', {
    speakBtn: !!speakBtn,
    clearBtn: !!clearBtn,
    copyBtn: !!copyBtn
});

// ============================================
// SIMPLE FREE TEXT-TO-SPEECH (SATU TOMBOL)
// ============================================

// Simple TTS function - just speak the text
function speakSimpleTTS(text) {
    console.log('=== DEBUG TTS DIMULAI ===');
    console.log('🔊 Text yang diterima:', text);
    console.log('📱 Browser info:', navigator.userAgent);
    console.log('🔧 SpeechSynthesis tersedia:', 'speechSynthesis' in window);

    try {
        // Check if browser supports speech synthesis
        if (!('speechSynthesis' in window)) {
            console.log('❌ Browser tidak mendukung text-to-speech');
            alert('Browser Anda tidak mendukung text-to-speech. Gunakan Chrome, Firefox, atau Edge.');
            showNotification('Browser tidak mendukung text-to-speech', 'error', 3000);
            return;
        }

        // Validate text
        if (!text || text.trim().length === 0) {
            console.log('❌ Tidak ada text untuk diucapkan');
            alert('Tidak ada text untuk diucapkan');
            showNotification('Tidak ada text untuk diucapkan', 'warning', 2000);
            return;
        }

        // Process text for TTS - BACA SEBAGAI KALIMAT UTUH
        let processedText = text.trim();

        // Gabungkan huruf-huruf menjadi kata (lowercase untuk natural speech)
        // Contoh: "H E L L O" -> "hello"
        processedText = processedText.replace(/\s+/g, '').toLowerCase();

        // Hilangkan kata "space" dari TTS (tidak perlu diucapkan)
        processedText = processedText.replace(/space/gi, ' ').trim();

        console.log('📝 Processed text:', processedText);
        console.log('📝 Original text:', text);
        console.log('📝 Mode: Membaca sebagai kalimat utuh (tanpa "space")');

        // Check available voices
        let voices = window.speechSynthesis.getVoices();
        console.log('🎤 Jumlah suara tersedia:', voices.length);
        console.log('🎤 Daftar suara:', voices.map(v => `${v.name} (${v.lang})`).slice(0, 5));

        // JIKA TIDAK ADA SUARA, coba force load voices
        if (voices.length === 0) {
            console.log('⚠️ Tidak ada suara, mencoba force load...');
            window.speechSynthesis.getVoices();

            // Tunggu sebentar lalu coba lagi
            setTimeout(() => {
                voices = window.speechSynthesis.getVoices();
                console.log('🔄 Suara setelah force load:', voices.length);

                if (voices.length === 0) {
                    console.log('❌ Masih tidak ada suara, coba install paket suara Linux');
                    alert('Tidak ada suara tersedia. Di Linux, install: sudo apt install espeak espeak-data');

                    // Coba dengan default voice tanpa spesifikasi
                    const utterance = new SpeechSynthesisUtterance(processedText);
                    utterance.rate = 0.8;
                    utterance.pitch = 1.0;
                    utterance.volume = 1.0;
                    utterance.lang = 'en-US';

                    // Event listeners
                    utterance.onstart = () => {
                        console.log('🔊 EVENT: onstart - Mulai berbicara...');
                        updateSpeakButton(true);
                        showNotification('🔊 Berbicara...', 'info', 1000);
                    };

                    utterance.onend = () => {
                        console.log('✅ EVENT: onend - Selesai berbicara');
                        updateSpeakButton(false);
                        showNotification('✅ Selesai', 'success', 2000);
                    };

                    utterance.onerror = (error) => {
                        console.error('❌ EVENT: onerror - Error TTS:', error);
                        updateSpeakButton(false);
                        showNotification(`❌ Error: ${error.error || 'No voices available'}`, 'error', 5000);
                    };

                    window.speechSynthesis.speak(utterance);
                    return;
                }
            }, 1000);
        }

        // Create speech utterance
        const utterance = new SpeechSynthesisUtterance(processedText);

        // Settings optimized for ASL
        utterance.rate = 0.8;       // Sedikit lebih lambat untuk kejelasan
        utterance.pitch = 1.0;      // Normal pitch
        utterance.volume = 1.0;     // Volume maksimum
        utterance.lang = 'en-US';   // Bahasa Inggris

        // Try to use the first available voice if no preferred voice found
        if (voices.length > 0) {
            utterance.voice = voices[0];
            console.log('🎤 Menggunakan suara pertama:', voices[0].name);
        }

        // Event listeners with detailed logging
        utterance.onstart = () => {
            console.log('🔊 EVENT: onstart - Mulai berbicara...');
            updateSpeakButton(true);
            showNotification('🔊 Berbicara...', 'info', 1000);
        };

        utterance.onend = () => {
            console.log('✅ EVENT: onend - Selesai berbicara');
            updateSpeakButton(false);
            showNotification('✅ Selesai', 'success', 2000);
        };

        utterance.onerror = (error) => {
            console.error('❌ EVENT: onerror - Error TTS:', error);
            console.error('❌ Error details:', {
                error: error.error,
                message: error.message,
                elapsedTime: error.elapsedTime,
                name: error.name
            });
            updateSpeakButton(false);
            showNotification(`❌ Error: ${error.error}`, 'error', 5000);
        };

        // Also add boundary events for debugging
        utterance.onboundary = (event) => {
            console.log('🔠 Word boundary at character:', event.charIndex, 'name:', event.name);
        };

        // Cancel any previous speech and start new one
        console.log('🔄 Canceling previous speech...');
        window.speechSynthesis.cancel();

        console.log('🚀 Starting speech synthesis...');
        window.speechSynthesis.speak(utterance);

        // Check if speech is actually speaking after a short delay
        setTimeout(() => {
            if (window.speechSynthesis.speaking) {
                console.log('✅ Speech synthesis is speaking');
            } else {
                console.log('⚠️ Speech synthesis is NOT speaking after 500ms');
                if (window.speechSynthesis.pending) {
                    console.log('⏳ Speech synthesis is pending');
                } else {
                    console.log('❌ Speech synthesis is not pending either');
                }
            }
        }, 500);

    } catch (error) {
        console.error('❌ TTS Exception:', error);
        console.error('❌ Stack trace:', error.stack);
        updateSpeakButton(false);
        showNotification(`❌ Error: ${error.message}`, 'error', 3000);
    }
    console.log('=== DEBUG TTS SELESAI ===');
}

// ============================================
// TENSORFLOW MODEL LOADING
// ============================================

async function loadTensorFlowModel() {
    try {
        console.log('Checking API server connection...');
        if (modelStatus) {
            modelStatus.textContent = 'Connecting...';
            modelStatus.style.color = '#000000';
        }

        // Check if API client is available
        if (typeof checkAPIHealth !== 'function') {
            throw new Error('API client not loaded');
        }

        // Retry API health check with timeout
        let isHealthy = false;
        let retries = 3;

        for (let i = 0; i < retries; i++) {
            console.log(`API connection attempt ${i + 1}/${retries}...`);
            isHealthy = await checkAPIHealth();

            if (isHealthy) {
                break;
            }

            // Wait 1 second before retry
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        if (isHealthy) {
            modelLoaded = true;
            if (modelStatus) {
                modelStatus.textContent = 'Connected ✓';
                modelStatus.style.color = '#000000';
            }
            console.log('✓ API Server connected successfully');

            // Update status dot
            const statusDotEl = document.getElementById('statusDot');
            if (statusDotEl) {
                statusDotEl.classList.add('active');
            }
        } else {
            throw new Error('API server not responding after 3 attempts');
        }

    } catch (error) {
        console.error(' Error connecting to API:', error);
        console.warn(' Please start the API server first:');
        console.info(' How to start:');
        console.info('   1. Open new terminal');
        console.info('   2. Run: ./START_API.sh');
        console.info('   3. Wait for "Running on http://localhost:5000"');
        console.info('   4. Refresh this page (Ctrl+Shift+R)');

        if (modelStatus) {
            modelStatus.textContent = 'API Offline';
            modelStatus.style.color = '#000000';
        }
        modelLoaded = false;
        tfModel = null;
    }
}

// ============================================
// MEDIAPIPE HANDS SETUP
// ============================================

let mediaPipeReady = false;

async function initializeMediaPipe() {
    console.log('🖐️ Initializing MediaPipe Hands...');

    hands = new Hands({
        locateFile: (file) => {
            console.log(`📦 Loading MediaPipe file: ${file}`);
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: CONFIG.MAX_NUM_HANDS,
        modelComplexity: CONFIG.MODEL_COMPLEXITY,
        minDetectionConfidence: CONFIG.MIN_DETECTION_CONFIDENCE,
        minTrackingConfidence: CONFIG.MIN_TRACKING_CONFIDENCE
    });

    hands.onResults((results) => {
        if (!mediaPipeReady) {
            console.log('✅ MediaPipe Hands initialized successfully!');
            mediaPipeReady = true;
        }
        onHandsResults(results);
    });

    console.log('✅ MediaPipe Hands configured. Will initialize on first frame.');
}

function initializeCanvas() {
    canvasCtx = canvasElement.getContext('2d');
}

// ============================================
// CAMERA CONTROL
// ============================================

async function startCamera() {
    try {
        statusText.textContent = 'Memulai kamera...';

        // Load TensorFlow model first
        await loadTensorFlowModel();

        // Request camera permission
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });

        videoElement.srcObject = stream;

        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                resolve();
            };
        });

        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;

        // Wait for MediaPipe to fully initialize before starting camera
        await initializeMediaPipe();
        initializeCanvas();

        camera = new Camera(videoElement, {
            onFrame: async () => {
                if (hands && isDetecting) {
                    await hands.send({ image: videoElement });
                }
            },
            width: 1280,
            height: 720
        });

        await camera.start();

        isDetecting = true;
        if (statusDot) {
            statusDot.classList.add('active');
        }

        // Auto-start translation mode
        isTranslationActive = true;
        if (modeIndicator) {
            modeIndicator.classList.remove('paused');
            modeIndicator.classList.add('recording');
        }
        if (modeIcon) modeIcon.textContent = '▶️';
        if (modeText) modeText.textContent = 'RECORDING';
        if (translationModeStatus) {
            translationModeStatus.textContent = 'RECORDING';
            translationModeStatus.style.color = '#000000';
        }
        if (statusText) statusText.textContent = 'Kamera Aktif - Translation RECORDING';
        if (speakBtn) speakBtn.disabled = false;

        console.log('✓ Camera started successfully');
        console.log('▶️ Translation mode: AUTO-STARTED (Continuous Recording)');

    } catch (error) {
        console.error('Error starting camera:', error);
        if (statusText) statusText.textContent = 'Error: Tidak dapat mengakses kamera';

        // Show error message to user
        const errorMsg = document.createElement('div');
        // Use black/white only
        errorMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #000000; color: #FFFFFF; padding: 20px 40px; border-radius: 10px; z-index: 9999; text-align: center;';
        errorMsg.innerHTML = `
            <h3 style="margin: 0 0 10px 0;">❌ Gagal Mengakses Kamera</h3>
            <p style="margin: 0;">${error.message}</p>
            <p style="margin: 10px 0 0 0; font-size: 0.9em;">Pastikan Anda memberikan izin akses kamera</p>
        `;
        document.body.appendChild(errorMsg);

        setTimeout(() => {
            document.body.removeChild(errorMsg);
        }, 5000);
    }
}

// Camera stays on - no stop function needed

// ============================================
// HAND DETECTION RESULTS PROCESSING
// ============================================

function onHandsResults(results) {
    if (!canvasCtx) return;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Flip camera horizontally (mirror mode)
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);

    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const numHands = results.multiHandLandmarks.length;
        if (handCount) handCount.textContent = numHands;
        if (handCountText) handCountText.textContent = `${numHands} hand${numHands > 1 ? 's' : ''}`;

        // Update hand detection tracking
        lastHandDetectedTime = Date.now();
        handWasDetected = true;

        // Draw all hands
        // MediaPipe default colors (green for connectors, red for landmarks)
        const handColors = ['#00FF00', '#FF0000'];      // Green and Red for connectors
        const landmarkColors = ['#FF0000', '#00FF00'];  // Red and Green for landmarks

        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const handedness = results.multiHandedness[i];

            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
                color: handColors[i % 2],
                lineWidth: 5
            });

            drawLandmarks(canvasCtx, landmarks, {
                color: landmarkColors[i % 2],
                lineWidth: 2,
                radius: 5
            });

            const label = handedness.label;
            const wrist = landmarks[0];
            canvasCtx.fillStyle = handColors[i % 2];
            canvasCtx.font = 'bold 20px Arial';
            canvasCtx.fillText(label, wrist.x * canvasElement.width, wrist.y * canvasElement.height - 10);
        }

        // Always process translation gestures (continuous recording mode)
        processTranslationGestures(results);

    } else {
        // NO HAND DETECTED - Reset gesture tracking setelah delay
        const now = Date.now();

        // Jika tangan hilang lebih dari HAND_ABSENCE_RESET_DELAY, reset gesture
        if (handWasDetected && (now - lastHandDetectedTime) > HAND_ABSENCE_RESET_DELAY) {
            console.log('🚫 Tangan hilang > 500ms, reset gesture tracking');
            resetGestureTracking();
            handWasDetected = false;
        }

        if (handCount) handCount.textContent = '0';
        if (handCountText) handCountText.textContent = '0 hands';
        if (currentGesture) currentGesture.textContent = '-';
        if (confidence) confidence.textContent = '0%';
    }

    canvasCtx.restore();
}

// ============================================
// TRANSLATION GESTURE PROCESSING
// ============================================

async function processTranslationGestures(results) {
    // Check for two-hand gestures first
    if (results.multiHandLandmarks.length === 2) {
        const twoHandGesture = recognizeTwoHandGesture(
            results.multiHandLandmarks[0],
            results.multiHandLandmarks[1],
            results.multiHandedness[0],
            results.multiHandedness[1]
        );

        if (twoHandGesture) {
            displayAndProcessGesture(twoHandGesture, true);
            return;
        }
    }

    // Single hand gestures - Let the trained model handle ALL gestures including SPACE
    // SPACE detection disabled because rule-based detection was interfering with B and C letters

    // If no SPACE gesture, process normal letters
    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i];
        const handedness = results.multiHandedness[i];

        const gesture = await recognizeGesture(landmarks, handedness);

        if (gesture) {
            displayAndProcessGesture(gesture, false);
            break; // Only process first detected gesture
        }
    }
}

function displayAndProcessGesture(gesture, isTwoHand) {
    const gestureKey = isTwoHand ? gesture.name : gesture.name;

    console.log('displayAndProcessGesture called:', {
        name: gesture.name,
        translation: gesture.translation,
        confidence: gesture.confidence,
        isTwoHand: isTwoHand
    });

    if (currentGesture) currentGesture.textContent = gesture.name + (isTwoHand ? ' (2 Tangan)' : '');
    if (confidence) confidence.textContent = Math.round(gesture.confidence * 100) + '%';

    // Track gesture for translation with visual progress
    const now = Date.now();
    const trackingVar = isTwoHand ? 'twoHand' : 'single';
    const lastGestureVar = isTwoHand ? lastTwoHandGesture : lastGesture;
    const gestureTimeVar = isTwoHand ? twoHandGestureStartTime : gestureStartTime;

    console.log('⏱️ Gesture tracking:', {
        currentGesture: gesture.name,
        lastGesture: lastGestureVar,
        timeSinceStart: gestureTimeVar ? (now - gestureTimeVar) : 0
    });

    if (gesture.name === lastGestureVar) {
        const holdTime = now - gestureTimeVar;
        const progress = Math.min(holdTime / CONFIG.GESTURE_HOLD_DELAY, 1);

        // Update visual progress
        updateHoldProgress(progress);

        console.log(`⏳ Holding gesture "${gesture.name}" for ${holdTime}ms (${Math.round(progress * 100)}%)`);

        if (holdTime >= CONFIG.GESTURE_HOLD_DELAY) {
            console.log(`✅ Adding translation: "${gesture.translation}"`);
            addTranslation(gesture.translation);

            // Reset timer to prevent immediate re-addition
            if (isTwoHand) {
                twoHandGestureStartTime = now + 1000;
            } else {
                gestureStartTime = now + 1000;
            }

            // Clear progress
            updateHoldProgress(0);
        }
    } else {
        console.log(`🔄 New gesture detected: "${gesture.name}" (was "${lastGestureVar}")`);
        if (isTwoHand) {
            lastTwoHandGesture = gesture.name;
            twoHandGestureStartTime = now;
        } else {
            lastGesture = gesture.name;
            gestureStartTime = now;
        }

        // Reset progress for new gesture
        updateHoldProgress(0);
    }

    // Draw on canvas with enhanced styling
    canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    canvasCtx.fillRect(6, 10, 250, 36);
    canvasCtx.fillStyle = '#FFFFFF';
    canvasCtx.font = 'bold 20px Arial';
    canvasCtx.fillText(' ' + gesture.name, 10, 34);

    // Draw progress bar if holding
    if (currentHoldProgress > 0 && gesture.name === (isTwoHand ? lastTwoHandGesture : lastGesture)) {
        canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        canvasCtx.fillRect(10, 40, 230 * currentHoldProgress, 4);
    }
}

// Update visual hold progress indicator
function updateHoldProgress(progress) {
    currentHoldProgress = progress;

    // Update UI progress bar if it exists
    const progressBar = document.getElementById('holdProgress');
    if (progressBar) {
        progressBar.style.width = `${progress * 100}%`;
    }

    // Show/hide progress container
    const progressContainer = document.querySelector('.hold-progress-container');
    if (progressContainer) {
        if (progress > 0) {
            progressContainer.classList.add('active');
        } else {
            progressContainer.classList.remove('active');
        }
    }

    // Add/remove holding class to current gesture display
    const gestureDisplay = document.getElementById('currentGesture');
    if (gestureDisplay) {
        if (progress > 0) {
            gestureDisplay.classList.add('holding');
        } else {
            gestureDisplay.classList.remove('holding');
        }
    }
}

// ============================================
// GESTURE RECOGNITION with API Backend
// ============================================

async function recognizeGestureWithTF(landmarks, handedness) {
    if (!modelLoaded) {
        return null; // API not available
    }

    try {
        // Use API client to get prediction
        if (typeof recognizeWithAPI === 'function') {
            // Extract handedness label (MediaPipe returns 'Left' or 'Right')
            const handLabel = handedness && handedness.label ? handedness.label : 'Right';
            const result = await recognizeWithAPI(landmarks, handLabel);

            if (result && result.gesture) {
                return {
                    name: result.gesture,
                    translation: GESTURE_TRANSLATIONS[result.gesture] || result.gesture,
                    confidence: result.confidence,
                    handedness: result.handedness,
                    model_used: result.model_used
                };
            }
        }

        return null;

    } catch (error) {
        console.error('API inference error:', error);
        return null;
    }
}

// ============================================
// FALLBACK: RULE-BASED GESTURE RECOGNITION (DISABLED)
// ============================================
// Note: Fallback gestures are disabled. Only API-based recognition is used.
// Control gestures (pause/resume) are handled separately in checkControlGesture()

async function recognizeGesture(landmarks, handedness) {
    // Try TensorFlow API first (PRIMARY METHOD)
    if (modelLoaded) {
        const tfResult = await recognizeGestureWithTF(landmarks, handedness);
        if (tfResult) {
            console.log('🤖 Using TensorFlow prediction:', tfResult.name);
            return tfResult;
        }
    }

    // No fallback gestures - only use API predictions
    // This prevents unwanted gestures like "Cinta", "Peace", etc when API is offline
    console.log('⚠️ API not available - no gesture recognition');
    return null;
}

function recognizeTwoHandGesture(landmarks1, landmarks2, handedness1, handedness2) {
    // Two-hand gestures disabled - only use API for single hand recognition
    return null;
}

// Fungsi untuk mendeteksi gerakan SPACE (5 jari terbuka)
function detectSpaceGesture(landmarks, handedness) {
    if (!landmarks || landmarks.length < 21) return false;

    // Indeks untuk setiap jari (tip dari setiap jari)
    const fingerTips = [4, 8, 12, 16, 20]; // Thumb, Index, Middle, Ring, Pinky
    const fingerPips = [3, 6, 10, 14, 18];  // PIP dari setiap jari

    // Deteksi apakah semua jari terbuka
    let openFingers = 0;
    let totalFingers = 0;

    for (let i = 0; i < fingerTips.length; i++) {
        const tip = landmarks[fingerTips[i]];
        const pip = landmarks[fingerPips[i]];

        // Untuk thumb, perbandingan yang berbeda (horizontal)
        if (i === 0) { // Thumb
            // Jika tip lebih horizontal dari pip, thumb terbuka
            if (tip.x < pip.x) {
                openFingers++;
            }
            totalFingers++;
        } else { // Other fingers
            // Jika tip lebih tinggi dari pip, jari terbuka
            if (tip.y < pip.y) {
                openFingers++;
            }
            totalFingers++;
        }
    }

    // Logika deteksi space
    const allFingersOpen = openFingers === totalFingers;
    const handOpenEnough = openFingers >= 4; // Minimal 4 jari terbuka

    console.log(`🖐️ Space detection: ${openFingers}/${totalFingers} fingers open`);

    return handOpenEnough;
}

function isFingerExtended(landmarks, tipIdx, pipIdx, mcpIdx) {
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];
    const mcp = landmarks[mcpIdx];
    return tip.y < pip.y && pip.y < mcp.y;
}

// ============================================
// TRANSLATION OUTPUT
// ============================================

function addTranslation(text) {
    if (!text || text === '') return;
    translationHistory.push(text);
    updateOutput();
    console.log('Translation added:', text);
}

function updateOutput() {
    if (translationHistory.length === 0) {
        outputBox.innerHTML = '<p class="placeholder">Hasil terjemahan akan muncul di sini...</p>';
    } else {
        // Gabungkan huruf menjadi kata dan pisahkan dengan spasi
        const translationText = processTranslation(translationHistory);
        outputBox.innerHTML = `<p class="translation-text">${translationText}</p>`;
    }
}

// Proses translation: gabungkan huruf jadi kata, pisahkan dengan SPACE gesture
function processTranslation(history) {
    // Satukan semua history
    let allText = history.join('');

    // Ganti SPACE gesture dengan spasi
    allText = allText.replace(/SPACE/g, ' ');

    // Pisahkan menjadi array kata-kata
    let words = allText.split(' ');

    // Proses setiap kata: gabungkan huruf yang berdekatan
    let processedWords = words.map(word => {
        if (!word.trim()) return ''; // Skip empty

        // Cek apakah ini sudah kata atau masih kumpulan huruf
        if (isLikelyAWord(word)) {
            return word; // Sudah kata, langsung pakai
        } else {
            return word.toUpperCase(); // Masih huruf, jadikan uppercase
        }
    });

    // Gabungkan kembali dengan spasi
    return processedWords.join(' ').trim();
}

// Cek apakah string kemungkinan adalah kata yang sudah lengkap
function isLikelyAWord(text) {
    if (!text || text.length < 2) return false;

    // Jika sudah mengandung huruf kecil, kemungkinan sudah kata
    if (/[a-z]/.test(text)) return true;

    // Jika panjang > 5 huruf uppercase, kemungkinan kata
    if (text.length > 5) return true;

    // Cek apakah mengandung pola umum kata (vowel patterns)
    const vowels = ['A', 'E', 'I', 'O', 'U'];
    let vowelCount = 0;
    for (let char of text) {
        if (vowels.includes(char)) vowelCount++;
    }

    // Jika memiliki cukup vowel untuk sebuah kata
    if (vowelCount >= 2 && text.length >= 3) return true;

    return false;
}

// Reset gesture tracking (dipanggil saat tangan hilang dari frame)
function resetGestureTracking() {
    console.log('🔄 Resetting gesture tracking...');
    lastGesture = '';
    lastTwoHandGesture = '';
    gestureStartTime = 0;
    twoHandGestureStartTime = 0;
    currentHoldProgress = 0;
    updateHoldProgress(0);

    // Clear hold interval jika ada
    if (holdInterval) {
        clearInterval(holdInterval);
        holdInterval = null;
    }
}

function clearOutput() {
    console.log('🗑️ Clear button clicked!');
    translationHistory = [];
    updateOutput();

    // Reset gesture tracking menggunakan fungsi yang sama
    resetGestureTracking();

    showNotification('Translation cleared', 'info', 2000);
    console.log('✓ Translation history cleared');
}

// ============================================
// ENHANCED TEXT-TO-SPEECH
// ============================================

// Text-to-Speech state management
let isSpeaking = false;
let speechQueue = [];
let currentUtterance = null;

function speakTranslation() {
    console.log('🔊 Tombol speak ditekan!');

    if (translationHistory.length === 0) {
        console.log('📝 Translation history kosong, coba dengan text test');
        // Test dengan text sederhana jika tidak ada translation
        speakSimpleTTS('Hello World');
        return;
    }

    // Get the translation text
    const text = translationHistory.join(' ');
    console.log('Text yang akan diucapkan:', text);

    // Gunakan TTS sederhana
    speakSimpleTTS(text);
}

// Test function - bisa dipanggil dari console
function testTTSNow() {
    console.log('🧪 Manual TTS Test');
    speakSimpleTTS('This is a test of the text to speech system');
}

// Tambahkan test ke window agar bisa dipanggil dari console
window.testTTSNow = testTTSNow;

// Test function for TTS debugging
function testTTSWithSampleText() {
    console.log('Testing TTS with sample text...');
    const sampleText = "H E L L O";
    speakWithEnhancedSettings(sampleText);
}

function speakWithEnhancedSettings(text) {
    if (!('speechSynthesis' in window)) {
        showNotification('Your browser does not support text-to-speech', 'error');
        return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Function to attempt speaking with retries
    const attemptSpeak = (attempt = 0) => {
        const voices = window.speechSynthesis.getVoices();
        console.log(`Attempt ${attempt + 1} - voices loaded:`, voices.length);

        if (voices.length > 0) {
            speakNow(text, voices);
        } else if (attempt < 3) {
            console.log(`No voices yet, retrying... (attempt ${attempt + 1})`);
            // Increase delay with each attempt
            const delay = 250 * (attempt + 1);
            setTimeout(() => attemptSpeak(attempt + 1), delay);
        } else {
            console.log('No voices loaded after 3 attempts, proceeding with default');
            speakNow(text, []);
        }
    };

    // Start the attempt process
    attemptSpeak();
}

function speakNow(text, voices) {
    try {
        // Create utterance with optimized settings for ASL letters
        currentUtterance = new SpeechSynthesisUtterance();
        currentUtterance.text = text;
        currentUtterance.rate = CONFIG.TTS_RATE; // Slower for letter clarity
        currentUtterance.pitch = 1.0;
        currentUtterance.volume = CONFIG.TTS_VOLUME;
        currentUtterance.lang = 'en-US';

        // Try to use a clear English voice
        const preferredVoices = [
            'Microsoft Zira Desktop',
            'Google US English',
            'Samantha',
            'Karen',
            'Microsoft David Desktop',
            'Alex',
            'Google US English Female',
            'English United States'
        ];

        // Find the best voice
        let selectedVoice = null;

        // Try exact matches first
        selectedVoice = voices.find(voice =>
            preferredVoices.some(name => voice.name.toLowerCase().includes(name.toLowerCase()))
        );

        // If no exact match, try to find any English voice
        if (!selectedVoice) {
            selectedVoice = voices.find(voice =>
                voice.lang && (voice.lang.includes('en-US') || voice.lang.includes('en-GB') || voice.lang.includes('en_'))
            );
        }

        // If still no voice, use the first available
        if (!selectedVoice && voices.length > 0) {
            selectedVoice = voices[0];
        }

        if (selectedVoice) {
            currentUtterance.voice = selectedVoice;
            console.log('Using voice:', selectedVoice.name, 'Lang:', selectedVoice.lang);
        } else {
            console.log('No voice selected, using browser default');
        }

        // DIMATIKAN: Tidak perlu pause antar huruf, baca sebagai kalimat utuh
        // Text sudah diproses di speakSimpleTTS() untuk menggabungkan huruf
        console.log('Text akan dibaca sebagai kalimat utuh:', currentUtterance.text);

        // Add event listeners for TTS
        currentUtterance.onstart = () => {
            console.log('🔊 Speech started successfully');
            isSpeaking = true;
            updateSpeakButton(true);
            showNotification('Speaking...', 'info', 1000);
        };

        currentUtterance.onend = () => {
            console.log('🔊 Speech ended naturally');
            isSpeaking = false;
            currentUtterance = null;
            updateSpeakButton(false);
            showNotification('Speech completed', 'success', 2000);
        };

        currentUtterance.onerror = (event) => {
            console.error('Speech error occurred:', event);
            console.error('Error details:', {
                error: event.error,
                message: event.message,
                elapsed: event.elapsedTime,
                name: event.name
            });
            isSpeaking = false;
            currentUtterance = null;
            updateSpeakButton(false);

            // User-friendly error messages
            let errorMsg = 'Speech error occurred';
            if (event.error === 'network') {
                errorMsg = 'Network error - check internet connection';
            } else if (event.error === 'synthesis-unavailable') {
                errorMsg = 'Speech synthesis unavailable in this browser';
            } else if (event.error === 'language-unavailable') {
                errorMsg = 'Language not available';
            } else if (event.error === 'voice-unavailable') {
                errorMsg = 'Voice not available';
            } else if (event.error) {
                errorMsg = `Speech error: ${event.error}`;
            }

            showNotification(errorMsg, 'error', 5000);
        };

        // Ensure Speech Synthesis is ready
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            setTimeout(() => {
                startSpeaking();
            }, 100);
        } else {
            startSpeaking();
        }

        function startSpeaking() {
            console.log('Starting speech with text:', currentUtterance.text);
            console.log('Speech settings:', {
                rate: currentUtterance.rate,
                pitch: currentUtterance.pitch,
                volume: currentUtterance.volume,
                lang: currentUtterance.lang,
                voice: currentUtterance.voice ? currentUtterance.voice.name : 'default'
            });

            try {
                window.speechSynthesis.speak(currentUtterance);
            } catch (error) {
                console.error('Failed to start speech:', error);
                isSpeaking = false;
                currentUtterance = null;
                updateSpeakButton(false);
                showNotification('Failed to start speech synthesis', 'error');
            }
        }

    } catch (error) {
        console.error('Error creating speech utterance:', error);
        showNotification('Failed to initialize speech', 'error');
    }
}

function stopSpeaking() {
    if (isSpeaking && window.speechSynthesis.speaking) {
        console.log('🔇 Stopping speech...');
        window.speechSynthesis.cancel();
        isSpeaking = false;
        currentUtterance = null;
        updateSpeakButton(false);
    }
}

function updateSpeakButton(speaking) {
    if (!speakBtn) return;

    if (speaking) {
        speakBtn.disabled = true;
        speakBtn.title = 'Stop speaking';
        speakBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
            </svg>
        `;
        speakBtn.style.animation = 'pulse 1.5s ease-in-out infinite';
    } else {
        speakBtn.disabled = false;
        speakBtn.title = 'Text to Speech';
        speakBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
        `;
        speakBtn.style.animation = 'none';
    }
}

// Load voices when they're available
window.speechSynthesis.onvoiceschanged = () => {
    const voices = window.speechSynthesis.getVoices();
    console.log('Voices loaded:', voices.length);

    // Log available voices for debugging
    voices.forEach((voice, index) => {
        if (voice.lang.includes('en') || index < 5) {
            console.log(`Voice ${index}: ${voice.name} (${voice.lang})`);
        }
    });
};

// Initial voice loading - force loading immediately
if (window.speechSynthesis) {
    // Create a dummy utterance to force voice loading in Chrome
    const dummy = new SpeechSynthesisUtterance();
    dummy.text = '';
    dummy.volume = 0;

    // Get voices multiple times to ensure loading
    window.speechSynthesis.getVoices();
    setTimeout(() => {
        window.speechSynthesis.getVoices();
    }, 100);
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================

function showNotification(message, type = 'info', duration = null) {
    // Check if notifications are enabled
    if (!CONFIG.SHOW_NOTIFICATIONS) {
        console.log(`[${type.toUpperCase()}] ${message}`);
        return;
    }

    // Use default duration if not provided
    duration = duration !== null ? duration : CONFIG.NOTIFICATION_DURATION;

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span class="notification-icon">${getNotificationIcon(type)}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // Auto remove after duration
    if (duration > 0) {
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }, duration);
    }
}

function getNotificationIcon(type) {
    const icons = {
        'success': '✓',
        'error': '✕',
        'warning': '⚠',
        'info': 'ℹ'
    };
    return icons[type] || icons.info;
}

// ============================================
// EVENT LISTENERS
// ============================================

if (speakBtn) {
    speakBtn.addEventListener('click', speakTranslation);
    console.log('✓ Speak button listener added');
} else {
    console.error('❌ speakBtn not found!');
}

if (clearBtn) {
    clearBtn.addEventListener('click', clearOutput);
    console.log('✓ Clear button listener added');
} else {
    console.error('❌ clearBtn not found!');
}

// Copy button functionality
if (copyBtn) {
    copyBtn.addEventListener('click', () => {
        const text = translationHistory.join(' ');
        if (text.length === 0) {
            showNotification('No text to copy', 'warning', 2000);
            return;
        }

        navigator.clipboard.writeText(text).then(() => {
            console.log('✓ Text copied to clipboard:', text);
            showNotification('Text copied to clipboard!', 'success', 2000);

            // Visual feedback - show checkmark
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
            }, 1000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            showNotification('Failed to copy text', 'error', 3000);
        });
    });
    console.log('✓ Copy button listener added');
} else {
    console.error('❌ copyBtn not found!');
}

// ============================================
// INISIALISASI SEDERHANA
// ============================================

// Initialize TTS on page load
function initializeSimpleTTS() {
    console.log('🔊 Menginisialisasi Text-to-Speech...');

    // Force load voices
    window.speechSynthesis.getVoices();

    // Log available voices
    setTimeout(() => {
        const voices = window.speechSynthesis.getVoices();
        console.log(`✅ ${voices.length} suara tersedia untuk TTS`);
    }, 1000);
}

// Auto-start camera on page load
window.addEventListener('load', async () => {
    console.log('=== Sign Language Translator with TensorFlow.js ===');
    console.log('🚀 Memulai kamera...');

    // Initialize simple TTS
    initializeSimpleTTS();

    // Show loading message
    statusText.textContent = 'Meminta izin kamera...';

    // Small delay to ensure DOM is ready
    setTimeout(async () => {
        await startCamera();
    }, 500);
});

window.addEventListener('beforeunload', () => {
    if (camera) {
        camera.stop();
    }
});

console.log('✓ Script loaded');

