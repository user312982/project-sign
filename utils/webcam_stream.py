"""
WebcamStream - Multi-threaded webcam capture for better FPS
Adapted from ASLGame/ASL-ML repository
"""

import cv2
import time
from threading import Thread


class WebcamStream:
    """
    Multi-threaded webcam capture class for improved performance
    
    This class runs frame capture in a separate thread to avoid blocking
    the main processing loop, resulting in higher FPS.
    """
    
    def __init__(self, stream_id=0, width=640, height=480):
        """
        Initialize webcam stream
        
        Args:
            stream_id: Camera device ID (default 0 for primary camera)
            width: Frame width
            height: Frame height
        """
        self.stream_id = stream_id
        
        # Opening video capture stream
        self.vcap = cv2.VideoCapture(self.stream_id)
        
        if self.vcap.isOpened() is False:
            print("[ERROR] Cannot access webcam stream.")
            raise IOError("Cannot access webcam")
        
        # Set resolution
        self.vcap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        self.vcap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        
        fps_input_stream = int(self.vcap.get(cv2.CAP_PROP_FPS))
        print(f"[INFO] Webcam FPS: {fps_input_stream}")
        
        # Reading first frame
        self.grabbed, self.frame = self.vcap.read()
        
        if self.grabbed is False:
            print('[ERROR] No frames to read')
            raise IOError("Cannot read frame")
        
        # Stream status
        self.stopped = True
        
        # Thread for capturing frames
        self.t = Thread(target=self.update, args=())
        self.t.daemon = True  # Daemon threads run in background
    
    def start(self):
        """Start the thread for frame capture"""
        self.stopped = False
        self.t.start()
        return self
    
    def update(self):
        """
        Keep capturing frames in background
        This runs in a separate thread
        """
        while True:
            if self.stopped is True:
                break
            
            self.grabbed, self.frame = self.vcap.read()
            
            if self.grabbed is False:
                print('[INFO] No more frames to read')
                self.stopped = True
                break
        
        self.vcap.release()
    
    def read(self):
        """Return the latest frame"""
        return self.frame
    
    def stop(self):
        """Stop the capture thread"""
        self.stopped = True
        # Wait for thread to finish
        if self.t.is_alive():
            self.t.join(timeout=1.0)
    
    def __del__(self):
        """Cleanup when object is destroyed"""
        self.stop()


# Example usage
if __name__ == "__main__":
    print("Testing WebcamStream...")
    
    # Initialize stream
    webcam_stream = WebcamStream(stream_id=0, width=640, height=480)
    webcam_stream.start()
    
    # FPS calculation
    num_frames = 0
    start_time = time.time()
    
    print("Press 'q' to quit")
    
    while True:
        if webcam_stream.stopped is True:
            break
        
        # Read frame (non-blocking!)
        frame = webcam_stream.read()
        num_frames += 1
        
        # Calculate FPS
        elapsed = time.time() - start_time
        fps = num_frames / elapsed if elapsed > 0 else 0
        
        # Display
        cv2.putText(frame, f'FPS: {fps:.1f}', (10, 30), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        cv2.imshow('WebcamStream Test', frame)
        
        # Quit on 'q'
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    # Cleanup
    end_time = time.time()
    webcam_stream.stop()
    cv2.destroyAllWindows()
    
    # Statistics
    total_time = end_time - start_time
    avg_fps = num_frames / total_time
    print(f"\n[STATS]")
    print(f"  Total frames: {num_frames}")
    print(f"  Total time: {total_time:.2f}s")
    print(f"  Average FPS: {avg_fps:.1f}")
