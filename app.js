// --- app.js - Versi Tes Minimalis ---

window.addEventListener('DOMContentLoaded', () => {

    // Konfigurasi Firebase Anda
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

    // Coba login secara otomatis untuk tes
    auth.signInWithEmailAndPassword("email@anda.com", "passwordanda") // <-- GANTI DENGAN EMAIL & PASSWORD LOGIN ANDA
        .then((userCredential) => {
            console.log("Login BERHASIL sebagai:", userCredential.user.email);
            
            // Jika login berhasil, coba ambil data dari koleksi 'transactions'
            console.log("Mencoba mengambil data dari Firestore...");
            db.collection('transactions').get()
                .then(snapshot => {
                    if (snapshot.empty) {
                        console.warn("Koneksi Berhasil, tapi koleksi 'transactions' kosong.");
                        return;
                    }
                    console.log("KONEKSI & PENGAMBILAN DATA BERHASIL!");
                    const names = snapshot.docs.map(doc => doc.data().nama);
                    console.log("Nama-nama yang ditemukan:", [...new Set(names)]);
                })
                .catch(error => {
                    console.error("KONEKSI GAGAL! Tidak bisa mengambil data:", error);
                    alert("Koneksi ke database gagal. Cek Security Rules atau Indeks di Firebase.");
                });
        })
        .catch((error) => {
            console.error("Login GAGAL:", error.message);
            alert("Login Gagal! Pastikan email dan password di app.js sudah benar.");
        });
});
