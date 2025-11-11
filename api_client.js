// ============================================
// API Backend Configuration
// ============================================

const API_URL = 'http://localhost:5000';
const CAPTURE_INTERVAL = 1000; // Capture and predict every 1 second

// ============================================
// Capture and Send Frame to API
// ============================================

let lastCaptureTime = 0;
let isProcessing = false;
let lastPrediction = null; // Store last successful prediction

async function captureAndPredict(landmarks = null) {
    const now = Date.now();
    
    // Throttle predictions to avoid overwhelming the API
    if (now - lastCaptureTime < CAPTURE_INTERVAL || isProcessing) {
        return null;
    }
    
    lastCaptureTime = now;
    isProcessing = true;
    
    try {
        let requestBody;
        
        // If landmarks provided, send them (for simple model)
        if (landmarks && landmarks.length > 0) {
            // Flatten landmarks to array of 63 values (21 points × 3 coords)
            const flatLandmarks = [];
            for (const lm of landmarks) {
                flatLandmarks.push(lm.x, lm.y, lm.z);
            }
            
            console.log('📤 Sending landmarks prediction request...', flatLandmarks.length, 'values');
            requestBody = { landmarks: flatLandmarks };
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

async function recognizeWithAPI(landmarks) {
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
    // Pass landmarks for simple model
    const result = await captureAndPredict(landmarks);
    
    // Use new result if available, otherwise use last prediction
    const currentResult = result || lastPrediction;
    
    console.log('📡 API Result:', currentResult);
    
    if (currentResult && currentResult.prediction) {
        console.log(`✅ Predicted: ${currentResult.prediction} (${currentResult.confidence.toFixed(3)})`);
        return {
            gesture: currentResult.prediction,
            confidence: currentResult.confidence,
            top3: currentResult.top3
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
