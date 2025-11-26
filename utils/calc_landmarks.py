"""
Landmark calculation and preprocessing utilities
Adapted from ASLGame/ASL-ML repository
"""

import numpy as np
import itertools
import copy


def calc_landmark_list(image, landmarks):
    """
    Calculate landmark list from MediaPipe hand landmarks
    
    Args:
        image: Input image (numpy array)
        landmarks: MediaPipe hand landmarks object
    
    Returns:
        List of [x, y] coordinates for 21 landmarks
    """
    image_width, image_height = image.shape[1], image.shape[0]
    
    landmark_point = []
    
    for _, landmark in enumerate(landmarks.landmark):
        landmark_x = min(int(landmark.x * image_width), image_width - 1)
        landmark_y = min(int(landmark.y * image_height), image_height - 1)
        landmark_point.append([landmark_x, landmark_y])
    
    return landmark_point


def pre_process_landmark(landmark_list):
    """
    Normalize landmarks for model input
    
    Process:
    1. Convert to relative coordinates (based on wrist position)
    2. Flatten to 1D array
    3. Normalize by max value
    
    Args:
        landmark_list: List of [x, y] coordinates (21 points)
    
    Returns:
        Normalized flattened array of 42 values
    """
    temp_landmark_list = copy.deepcopy(landmark_list)
    
    # Convert to relative coordinates (wrist as base)
    base_x, base_y = 0, 0
    for index, landmark_point in enumerate(temp_landmark_list):
        if index == 0:
            base_x, base_y = landmark_point[0], landmark_point[1]
        
        temp_landmark_list[index][0] = temp_landmark_list[index][0] - base_x
        temp_landmark_list[index][1] = temp_landmark_list[index][1] - base_y
    
    # Flatten to 1D array
    temp_landmark_list = list(
        itertools.chain.from_iterable(temp_landmark_list))
    
    # Normalize by max value
    max_value = max(list(map(abs, temp_landmark_list)))
    
    def normalize_(n):
        return n / max_value if max_value != 0 else 0
    
    temp_landmark_list = list(map(normalize_, temp_landmark_list))
    
    return temp_landmark_list


def pre_process_landmark_3d(landmark_list):
    """
    Normalize 3D landmarks (x, y, z) for model input
    
    Args:
        landmark_list: List of [x, y, z] coordinates (21 points)
    
    Returns:
        Normalized flattened array of 63 values
    """
    temp_landmark_list = copy.deepcopy(landmark_list)
    
    # Convert to relative coordinates (wrist as base)
    base_x, base_y, base_z = 0, 0, 0
    for index, landmark_point in enumerate(temp_landmark_list):
        if index == 0:
            base_x = landmark_point[0]
            base_y = landmark_point[1]
            base_z = landmark_point[2]
        
        temp_landmark_list[index][0] = temp_landmark_list[index][0] - base_x
        temp_landmark_list[index][1] = temp_landmark_list[index][1] - base_y
        temp_landmark_list[index][2] = temp_landmark_list[index][2] - base_z
    
    # Flatten to 1D array
    temp_landmark_list = list(
        itertools.chain.from_iterable(temp_landmark_list))
    
    # Normalize by max value
    max_value = max(list(map(abs, temp_landmark_list)))
    
    def normalize_(n):
        return n / max_value if max_value != 0 else 0
    
    temp_landmark_list = list(map(normalize_, temp_landmark_list))
    
    return temp_landmark_list


def extract_landmarks_from_mediapipe(results):
    """
    Extract and preprocess landmarks from MediaPipe results
    
    Args:
        results: MediaPipe Hands processing results
    
    Returns:
        dict with:
            - landmarks: normalized landmark array
            - handedness: 'Left' or 'Right'
            - confidence: detection confidence
    """
    if not results.multi_hand_landmarks:
        return None
    
    # Get first hand detected
    hand_landmarks = results.multi_hand_landmarks[0]
    handedness = results.multi_handedness[0].classification[0].label
    confidence = results.multi_handedness[0].classification[0].score
    
    # Extract landmark coordinates
    landmark_list = []
    for landmark in hand_landmarks.landmark:
        landmark_list.append([landmark.x, landmark.y, landmark.z])
    
    # Preprocess
    normalized_landmarks = pre_process_landmark_3d(landmark_list)
    
    return {
        'landmarks': normalized_landmarks,
        'handedness': handedness,
        'confidence': confidence
    }


# Export main functions
__all__ = [
    'calc_landmark_list',
    'pre_process_landmark',
    'pre_process_landmark_3d',
    'extract_landmarks_from_mediapipe'
]
