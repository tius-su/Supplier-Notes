// --- app.js - Versi Final (dengan Perbaikan DOMContentLoaded & Service Worker Path) ---

window.addEventListener('DOMContentLoaded', () => {

    // --- KONFIGURASI FIREBASE & INISIALISASI ---
    const firebaseConfig = {
        apiKey: "AIzaSyB8Zoz-zogrRL6IF4R7uhQO16z56coWkxg",
        authDomain: "supplier-notes-36c99.firebaseapp.com",
        projectId: "supplier-notes-36c99",
        storageBucket: "supplier-notes-36c99.firebasestorage.app",
        messagingSenderId: "413744415542",
        appId: "1:413744415542:web:73cc9f800102ab26ca2997"
    };
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- OTENTIKASI ---
    // Kode ini tidak lagi mencoba login otomatis, tapi memeriksa status login
    auth.onAuthStateChanged(user => {
        if (user) {
            initApp(); // Jika sudah login, jalankan aplikasi
        } else {
            window.location.href = 'login.html'; // Jika belum, lempar ke halaman login
        }
    });

    // --- STATE & ELEMEN GLOBAL ---
    // ... (Sama seperti versi lengkap sebelumnya) ...

    // --- FUNGSI UTAMA APLIKASI ---
    function initApp() {
        setupEventListeners();
        loadAllTransactions();
    }
    
    // ... (SISA SEMUA FUNGSI LAINNYA SAMA PERSIS SEPERTI JAWABAN SAYA SEBELUMNYA) ...
    // ... (setupEventListeners, loadAllTransactions, renderEntityList, dll) ...

    // --- PENDAFTARAN SERVICE WORKER (PWA) ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(registration => console.log('Service Worker registered: ', registration))
                .catch(registrationError => console.log('Service Worker registration failed: ', registrationError));
        });
    }

}); // Penutup untuk event listener DOMContentLoaded
