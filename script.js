// ============================================
// SIGN LANGUAGE TRANSLATOR with TensorFlow.js
// ============================================

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
let lastControlGesture = '';
let controlGestureTime = 0;

// Gesture tracking
let lastGesture = '';
let gestureStartTime = 0;
let lastTwoHandGesture = '';
let twoHandGestureStartTime = 0;

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
        console.error('❌ Error connecting to API:', error);
        console.warn('⚠️ Please start the API server first:');
        console.info('💡 How to start:');
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

function initializeMediaPipe() {
    hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
    });

    hands.onResults(onHandsResults);
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

        initializeMediaPipe();
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
        console.log('▶️ Translation mode: AUTO-STARTED');
        console.log('⏸️ Translation mode: PAUSED');
        console.log('Use gestures to control: ✋ Open Palm = START | ✊ Fist = STOP');

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

        // Control gestures DISABLED - Always in recording mode
        // const controlGesture = checkControlGesture(results.multiHandLandmarks[0], results.multiHandedness[0]);
        // if (controlGesture) {
        //     handleControlGesture(controlGesture);
        // }

        // Always process translation gestures (no pause mode)
        processTranslationGestures(results);

        } else {
            if (handCount) handCount.textContent = '0';
            if (handCountText) handCountText.textContent = '0 hands';
            if (currentGesture) currentGesture.textContent = '-';
            if (confidence) confidence.textContent = '0%';
        }

    canvasCtx.restore();
}

// ============================================
// CONTROL GESTURE DETECTION (START/STOP)
// ============================================

function checkControlGesture(landmarks, handedness) {
    if (!landmarks || landmarks.length < 21) return null;

    const fingers = {
        thumb: isFingerExtended(landmarks, 4, 3, 2),
        index: isFingerExtended(landmarks, 8, 6, 5),
        middle: isFingerExtended(landmarks, 12, 10, 9),
        ring: isFingerExtended(landmarks, 16, 14, 13),
        pinky: isFingerExtended(landmarks, 20, 18, 17)
    };

    const extendedCount = Object.values(fingers).filter(v => v).length;

    // PAUSE gesture: Closed fist (recording gesture - all fingers closed)
    if (extendedCount === 0) {
        // All fingers closed = fist
        // Check if it's a proper fist (fingertips close to palm)
        const wrist = landmarks[0];
        const middleFingerTip = landmarks[12];
        const indexFingerTip = landmarks[8];
        
        // Calculate average distance of fingertips from wrist
        const avgDistance = (
            Math.abs(middleFingerTip.y - wrist.y) + 
            Math.abs(indexFingerTip.y - wrist.y)
        ) / 2;
        
        // If fingers are close to wrist (fist is closed), it's PAUSE
        if (avgDistance < 0.15) {
            return 'STOP'; // Keep 'STOP' internally but it means PAUSE
        }
    }

    // RESUME gesture: Open palm (all fingers extended) with palm facing camera
    if (extendedCount === 5) {
        // Check if palm is facing camera (not sideways)
        const wrist = landmarks[0];
        const middleFinger = landmarks[9];
        const palmDirection = Math.abs(middleFinger.x - wrist.x);
        
        if (palmDirection < 0.15) { // Palm facing camera
            return 'START'; // Keep 'START' internally but it means RESUME
        }
    }

    return null;
}

function handleControlGesture(gesture) {
    const now = Date.now();
    
    if (gesture === lastControlGesture) {
        const holdTime = now - controlGestureTime;
        
        if (holdTime > 1000 && holdTime < 1200) { // Execute once after 1 second hold
            if (gesture === 'START' && !isTranslationActive) {
                startTranslationMode();
            } else if (gesture === 'STOP' && isTranslationActive) {
                stopTranslationMode();
            }
        }
    } else {
        lastControlGesture = gesture;
        controlGestureTime = now;
    }
}

function startTranslationMode() {
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
    
    console.log('▶️ Translation mode: RECORDING');
}

function stopTranslationMode() {
    isTranslationActive = false;
    if (modeIndicator) {
        modeIndicator.classList.remove('recording');
        modeIndicator.classList.add('paused');
    }
    if (modeIcon) modeIcon.textContent = '⏸️';
    if (modeText) modeText.textContent = 'PAUSED';
    if (translationModeStatus) {
        translationModeStatus.textContent = 'PAUSED';
        translationModeStatus.style.color = '#000000';
    }
    if (statusText) statusText.textContent = 'Kamera Aktif - Translation PAUSED';
    
    console.log('⏸️ Translation mode: PAUSED');
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

    // Single hand gestures - Try API/TensorFlow first
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

    // Track gesture for translation
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
        console.log(`⏳ Holding gesture "${gesture.name}" for ${holdTime}ms (need 1500ms)`);
        if (holdTime > 1500) {
            console.log(`✅ Adding translation: "${gesture.translation}"`);
            addTranslation(gesture.translation);
            if (isTwoHand) {
                twoHandGestureStartTime = now + 2000;
            } else {
                gestureStartTime = now + 2000;
            }
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
    }

    // Draw on canvas
    // Draw label in black on white background
    canvasCtx.fillStyle = '#FFFFFF';
    canvasCtx.fillRect(6, 10, 220, 36);
    canvasCtx.fillStyle = '#000000';
    canvasCtx.font = 'bold 20px Arial';
    canvasCtx.fillText(' ' + gesture.name, 10, 34);
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
    // Two-hand gestures disabled - only use API
    return null;
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
        const translationText = translationHistory.join(' ');
        outputBox.innerHTML = `<p class="translation-text">${translationText}</p>`;
    }
}

function clearOutput() {
    translationHistory = [];
    updateOutput();
}

// ============================================
// TEXT-TO-SPEECH
// ============================================

function speakTranslation() {
    if (translationHistory.length === 0) {
        alert('Tidak ada teks untuk diucapkan');
        return;
    }

    const text = translationHistory.join(' ');
    
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;

        utterance.onstart = () => {
            speakBtn.disabled = true;
            speakBtn.innerHTML = '<span>🔊</span> Berbicara...';
        };

        utterance.onend = () => {
            speakBtn.disabled = false;
            speakBtn.innerHTML = '<span>🔊</span> Ucapkan';
        };

        window.speechSynthesis.speak(utterance);
    } else {
        alert('Browser tidak mendukung text-to-speech');
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

speakBtn.addEventListener('click', speakTranslation);
clearBtn.addEventListener('click', clearOutput);

// Auto-start camera on page load
window.addEventListener('load', async () => {
    console.log('=== Sign Language Translator with TensorFlow.js ===');
    console.log('🚀 Auto-starting camera...');
    
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

// ============================================
// UI ENHANCEMENTS FOR NEW DESIGN
// ============================================

// Update UI elements for new design
function updateUIElements() {
    // Update hand count display
    const handCountTextEl = document.getElementById('handCountText');
    if (handCountTextEl && handCount) {
        const count = parseInt(handCount.textContent) || 0;
        handCountTextEl.textContent = `${count} hand${count !== 1 ? 's' : ''}`;
    }
    
    // Update model status badge
    const modelStatusTextEl = document.getElementById('modelStatusText');
    const statusDotEl = document.getElementById('statusDot');
    if (modelStatusTextEl && statusDotEl && modelStatus) {
        modelStatusTextEl.textContent = modelStatus.textContent;
        if (modelStatus.textContent.includes('Loaded') || modelStatus.textContent.includes('Connected')) {
            statusDotEl.classList.add('active');
        } else {
            statusDotEl.classList.remove('active');
        }
    }
}

// Call update UI periodically
setInterval(updateUIElements, 100);

// Copy button functionality
const copyBtn = document.getElementById('copyBtn');
if (copyBtn) {
    copyBtn.addEventListener('click', () => {
        const text = outputBox.textContent;
        navigator.clipboard.writeText(text).then(() => {
            console.log('Text copied to clipboard');
            copyBtn.style.background = 'var(--success)';
            setTimeout(() => {
                copyBtn.style.background = '';
            }, 1000);
        });
    });
}

