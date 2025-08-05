// --- app.js - Versi Final (dengan Perbaikan Urutan Fungsi) ---

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
    auth.onAuthStateChanged(user => user ? initApp() : window.location.href = 'login.html');

    // --- STATE & ELEMEN GLOBAL ---
    let currentDisplayMode = 'pembelian';
    let allTransactions = [];
    const transactionCollection = db.collection('transactions');
    const entityListBody = document.getElementById('entity-list-body');
    const transaksiForm = document.getElementById('transaksi-form');
    const paymentForm = document.getElementById('payment-form');

    // ==========================================================
    // BAGIAN FUNGSI-FUNGSI UTAMA (DEFINISI DI AWAL)
    // ==========================================================
    
    // Menyiapkan semua event listener
    function setupEventListeners() {
        document.getElementById('logout-button').addEventListener('click', () => auth.signOut());
        document.querySelectorAll('input[name="appMode"]').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                currentDisplayMode = e.target.value;
                renderEntityList();
                updateListTitle();
            });
        });
        document.getElementById('filter-nama').addEventListener('input', renderEntityList);
        transaksiForm.addEventListener('submit', handleFakturSubmit);
        paymentForm.addEventListener('submit', handlePaymentSubmit);
        document.getElementById('payment-type').addEventListener('change', togglePaymentDetails);
        document.getElementById('view-report-btn').addEventListener('click', viewReportOnWeb);
        document.getElementById('generate-pdf-btn').addEventListener('click', generatePdfReport);
        document.getElementById('export-excel-btn').addEventListener('click', exportToExcel);
        document.getElementById('import-excel-input').addEventListener('change', importFromExcel);
    }

    // Memuat data dari Firestore
    function loadAllTransactions() {
        transactionCollection.orderBy('tanggal', 'asc').onSnapshot(snapshot => {
            allTransactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateDashboard();
            renderEntityList();
            updateListTitle();
            populateDatalist();
        }, err => {
            console.error("Error loading transactions:", err);
            entityListBody.innerHTML = `<tr><td colspan="3" class="text-center text-danger"><strong>Gagal memuat data.</strong><br><small>Pastikan Indeks Firestore sudah dibuat (Cek F12 -> Console).</small></td></tr>`;
        });
    }

    // ==========================================================
    // FUNGSI INISIALISASI UTAMA (MEMANGGIL FUNGSI DI ATASNYA)
    // ==========================================================
    
    function initApp() {
        setupEventListeners();
        loadAllTransactions();
    }
    
    // --- (SISA SEMUA FUNGSI LAINNYA TIDAK BERUBAH) ---
    // (updateListTitle, renderEntityList, updateDashboard, populateDatalist, openDetailsModal, dll...)
    
    function updateListTitle() { /* ... kode sama ... */ }
    function renderEntityList() { /* ... kode sama ... */ }
    function updateDashboard() { /* ... kode sama ... */ }
    function populateDatalist() { /* ... kode sama ... */ }
    window.openDetailsModal = (entityName) => { /* ... kode sama ... */ }
    window.openPaymentModal = (fakturId, noFaktur) => { /* ... kode sama ... */ }
    window.editFaktur = (id) => { /* ... kode sama ... */ }
    function togglePaymentDetails(e) { /* ... kode sama ... */ }
    function handleFakturSubmit(e) { /* ... kode sama ... */ }
    function handlePaymentSubmit(e) { /* ... kode sama ... */ }
    window.deleteTransaksi = (id, type) => { /* ... kode sama ... */ }
    function formatCurrency(num) { /* ... kode sama ... */ }
    function calculateSisaFaktur(fakturId) { /* ... kode sama ... */ }
    function viewReportOnWeb() { /* ... kode sama ... */ }
    function generatePdfReport() { /* ... kode sama ... */ }
    function exportToExcel() { /* ... kode sama ... */ }
    function importFromExcel(e) { /* ... kode sama ... */ }


    // --- PENDAFTARAN SERVICE WORKER (PWA) ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(registration => console.log('Service Worker registered: ', registration))
                .catch(registrationError => console.log('Service Worker registration failed: ', registrationError));
        });
    }

}); // Penutup untuk event listener DOMContentLoaded
