// ============================================
// API Backend Configuration
// ============================================

const API_URL = 'http://localhost:5000';
const CAPTURE_INTERVAL = 300; // Faster predictions: every 300ms (was 1000ms)

// ============================================
// REAL-TIME PREDICTION ENHANCEMENT
// ============================================

// Temporal smoothing - Store recent predictions for averaging
const PREDICTION_HISTORY_SIZE = 5; // Keep last 5 predictions
let predictionHistory = [];

// Confidence threshold
const MIN_CONFIDENCE = 0.60; // Only accept predictions with >60% confidence

// Gesture stability detection
let lastLandmarks = null;
const STABILITY_THRESHOLD = 0.02; // Max landmark movement to be considered "stable"

// Multi-frame consensus
function addPredictionToHistory(prediction, confidence) {
    predictionHistory.push({ prediction, confidence, timestamp: Date.now() });
    
    // Keep only recent predictions (last 5)
    if (predictionHistory.length > PREDICTION_HISTORY_SIZE) {
        predictionHistory.shift();
    }
}

function getConsensusPrediction() {
    if (predictionHistory.length === 0) return null;
    
    // Remove old predictions (older than 2 seconds)
    const now = Date.now();
    predictionHistory = predictionHistory.filter(p => now - p.timestamp < 2000);
    
    if (predictionHistory.length === 0) return null;
    
    // Count votes for each prediction
    const votes = {};
    let totalConfidence = {};
    
    for (const item of predictionHistory) {
        if (!votes[item.prediction]) {
            votes[item.prediction] = 0;
            totalConfidence[item.prediction] = 0;
        }
        votes[item.prediction]++;
        totalConfidence[item.prediction] += item.confidence;
    }
    
    // Find prediction with most votes
    let bestPrediction = null;
    let maxVotes = 0;
    let bestAvgConfidence = 0;
    
    for (const [prediction, voteCount] of Object.entries(votes)) {
        const avgConfidence = totalConfidence[prediction] / voteCount;
        
        // Prefer predictions with more votes, or higher confidence if tied
        if (voteCount > maxVotes || (voteCount === maxVotes && avgConfidence > bestAvgConfidence)) {
            bestPrediction = prediction;
            maxVotes = voteCount;
            bestAvgConfidence = avgConfidence;
        }
    }
    
    // Require at least 60% agreement (3 out of 5)
    const agreementRatio = maxVotes / predictionHistory.length;
    if (agreementRatio < 0.6) {
        console.log(`⚠️ Low agreement: ${(agreementRatio*100).toFixed(0)}% (${maxVotes}/${predictionHistory.length})`);
        return null;
    }
    
    console.log(`✅ Consensus: ${bestPrediction} (${(agreementRatio*100).toFixed(0)}% agreement, ${bestAvgConfidence.toFixed(2)} confidence)`);
    
    return {
        prediction: bestPrediction,
        confidence: bestAvgConfidence,
        agreement: agreementRatio,
        votes: maxVotes,
        total: predictionHistory.length
    };
}

function calculateLandmarkStability(landmarks) {
    if (!lastLandmarks) {
        lastLandmarks = landmarks;
        return 0; // First frame, assume stable
    }
    
    // Calculate average movement of all landmarks
    let totalMovement = 0;
    for (let i = 0; i < landmarks.length; i++) {
        const dx = landmarks[i].x - lastLandmarks[i].x;
        const dy = landmarks[i].y - lastLandmarks[i].y;
        const dz = landmarks[i].z - lastLandmarks[i].z;
        totalMovement += Math.sqrt(dx*dx + dy*dy + dz*dz);
    }
    
    const avgMovement = totalMovement / landmarks.length;
    lastLandmarks = landmarks;
    
    return avgMovement;
}

// ============================================
// Capture and Send Frame to API
// ============================================

let lastCaptureTime = 0;
let isProcessing = false;
let lastPrediction = null; // Store last successful prediction

async function captureAndPredict(landmarks = null, handedness = 'Right') {
    const now = Date.now();
    
    // Throttle predictions to avoid overwhelming the API
    if (now - lastCaptureTime < CAPTURE_INTERVAL || isProcessing) {
        return null;
    }
    
    lastCaptureTime = now;
    isProcessing = true;
    
    try {
        let requestBody;
        
        // If landmarks provided, send them (PREFERRED - more efficient)
        if (landmarks && landmarks.length > 0) {
            // Flatten landmarks to array of 63 values (21 points × 3 coords)
            const flatLandmarks = [];
            for (const lm of landmarks) {
                flatLandmarks.push(lm.x, lm.y, lm.z);
            }
            
            console.log(`📤 Sending landmarks prediction request... ${flatLandmarks.length} values, Handedness: ${handedness}`);
            requestBody = { 
                landmarks: flatLandmarks,
                handedness: handedness  // Add handedness to request
            };
        } else {
            // Otherwise send image (for image-based model)
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = videoElement.videoWidth;
            tempCanvas.height = videoElement.videoHeight;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Draw current video frame
            tempCtx.drawImage(videoElement, 0, 0);
            
            // Convert to base64
            const imageData = tempCanvas.toDataURL('image/jpeg', 0.8);
            
            console.log('📤 Sending image prediction request...');
            requestBody = { image: imageData };
        }
        
        // Send to API
        const response = await fetch(`${API_URL}/predict`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('📥 Response status:', response.status, response.statusText);
        
        if (!response.ok) {
            console.error('❌ API error:', response.status, response.statusText);
            throw new Error(`API error: ${response.status}`);
        }
        
        const responseText = await response.text();
        console.log('📄 Raw response:', responseText);
        
        const result = JSON.parse(responseText);
        console.log('✅ Parsed result:', result);
        
        isProcessing = false;
        lastPrediction = result; // Store successful prediction
        return result;
        
    } catch (error) {
        console.error('❌ Prediction error:', error);
        isProcessing = false;
        return null;
    }
}

// ============================================
// Update Recognition Function
// ============================================

async function recognizeWithAPI(landmarks, handedness = 'Right') {
    // Only predict when translation is active
    if (!isTranslationActive) {
        console.log('⏸️ Translation not active');
        return null;
    }
    
    // Check if we have valid hand detection
    if (!landmarks || landmarks.length === 0) {
        console.log('👋 No hand detected');
        return null;
    }
    
    // Capture and predict (throttled to 1 per second)
    // Pass landmarks and handedness for dual hand models
    const result = await captureAndPredict(landmarks, handedness);
    
    // Use new result if available, otherwise use last prediction
    const currentResult = result || lastPrediction;
    
    console.log('📡 API Result:', currentResult);
    
    if (currentResult && currentResult.prediction) {
        console.log(`✅ Predicted: ${currentResult.prediction} (${currentResult.confidence.toFixed(3)}) [${currentResult.model_used}]`);
        return {
            gesture: currentResult.prediction,
            confidence: currentResult.confidence,
            top3: currentResult.top3,
            handedness: currentResult.handedness,
            model_used: currentResult.model_used
        };
    }
    
    console.log('❌ No prediction from API');
    return null;
}

// ============================================
// Health Check
// ============================================

async function checkAPIHealth() {
    try {
        const response = await fetch(`${API_URL}/health`, {
            method: 'GET',
            mode: 'cors'
        });
        if (response.ok) {
            const data = await response.json();
            console.log('✓ API Server connected:', data);
            return true;
        }
    } catch (error) {
        console.error('❌ API Server not responding:', error);
        console.warn('💡 Make sure API server is running:');
        console.info('   Terminal: python3 api_server.py');
        console.info('   Or: ./START_API.sh');
        return false;
    }
    return false;
}

// Export for use in main script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { recognizeWithAPI, checkAPIHealth, API_URL };
}
