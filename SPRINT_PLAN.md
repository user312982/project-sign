# Lampiran 1 - Sprint Backlog

## SPRINT 1 - Inisialisasi Lingkungan Pengembangan

| Kode | Requirement | Fitur yang Dikembangkan | Prioritas | Status |
|------|-------------|-------------------------|-----------|--------|
| UC-01 | Inisialisasi Project | Setup repository, struktur folder, Python Flask API, dan frontend HTML/CSS/JS | Tinggi | Selesai |
| UC-01 | Implementasi Layout | Membuat layout frontend website dengan desain modern (Midnight Glass theme) | Tinggi | Selesai |
| UC-01 | Konfigurasi Dependencies | Setup `requirements.txt`, MediaPipe CDN, dan TensorFlow.js | Tinggi | Selesai |

---

## SPRINT 2 - Deteksi Tangan & Integrasi Kamera

| Kode | Requirement | Fitur yang Dikembangkan | Prioritas | Status |
|------|-------------|-------------------------|-----------|--------|
| UC-02 | Akses Kamera | Implementasi akses webcam dengan MediaPipe Camera Utils | Tinggi | Selesai |
| UC-02 | Deteksi Tangan | Integrasi MediaPipe Hands untuk tracking 21 landmark tangan | Tinggi | Selesai |
| UC-02 | Visualisasi Landmark | Menampilkan landmark dan koneksi tangan pada canvas overlay | Tinggi | Selesai |
| UC-02 | Deteksi Handedness | Implementasi deteksi tangan kiri/kanan untuk model selection | Sedang | Selesai |

---

## SPRINT 3 - Model AI & Prediksi

| Kode | Requirement | Fitur yang Dikembangkan | Prioritas | Status |
|------|-------------|-------------------------|-----------|--------|
| UC-03 | Preprocessing Landmarks | Implementasi normalisasi landmark (wrist-relative, scaling) | Tinggi | Selesai |
| UC-03 | Model TFLite | Konversi model dari H5 ke TFLite untuk deployment ringan (~110KB) | Tinggi | Selesai |
| UC-03 | API Prediksi | Membuat endpoint `/predict` untuk menerima landmark dan return prediksi huruf | Tinggi | Selesai |
| UC-03 | Real-time Recognition | Gesture recognition dengan confidence threshold dan temporal smoothing | Sedang | Selesai |
| UC-03 | Space Gesture | Deteksi gesture SPACE (5 jari terbuka) untuk pemisah kata | Sedang | Selesai |

---

## SPRINT 4 - Text-to-Speech & Deployment

| Kode | Requirement | Fitur yang Dikembangkan | Prioritas | Status |
|------|-------------|-------------------------|-----------|--------|
| UC-04 | Text-to-Speech | Implementasi Web Speech API untuk membaca teks hasil translasi | Tinggi | Selesai |
| UC-04 | Hold-to-Add | Fitur hold gesture 2 detik sebelum huruf ditambahkan ke output | Sedang | Selesai |
| UC-04 | Action Buttons | Tombol Speak, Clear, dan Copy untuk kontrol output | Tinggi | Selesai |
| UC-05 | Docker Setup | Konfigurasi `Dockerfile` dan `docker-compose.yml` untuk containerization | Tinggi | Selesai |
| UC-05 | Railway Deployment | Setup `railway.json` dan optimisasi untuk cloud deployment | Tinggi | Selesai |
| UC-05 | Dynamic API URL | Auto-detect API URL untuk development vs production | Sedang | Selesai |

---

## Ringkasan Progress

| Sprint | Fokus | Status |
|--------|-------|--------|
| Sprint 1 | Inisialisasi Lingkungan Pengembangan | ✅ Selesai |
| Sprint 2 | Deteksi Tangan & Integrasi Kamera | ✅ Selesai |
| Sprint 3 | Model AI & Prediksi | ✅ Selesai |
| Sprint 4 | Text-to-Speech & Deployment | ✅ Selesai |
