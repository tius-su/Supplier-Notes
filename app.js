// --- app.js - Versi Final Lengkap (dengan PWA & View Report) ---

// ... (KONFIGURASI FIREBASE, OTENTIKASI, STATE & ELEMEN GLOBAL SAMA PERSIS SEPERTI SEBELUMNYA) ...
const viewReportModal = new bootstrap.Modal(document.getElementById('view-report-modal')); // Tambahkan ini di Elemen Global

// Menyiapkan semua event listener
function setupEventListeners() {
    // ... (Semua event listener lama SAMA PERSIS seperti sebelumnya) ...
    document.getElementById('logout-button').addEventListener('click', () => auth.signOut());
    // ...

    // Tambahkan event listener untuk tombol baru
    document.getElementById('view-report-btn').addEventListener('click', viewReportOnWeb);
}

// ... (Semua fungsi inti lainnya: loadAllTransactions, renderEntityList, updateDashboard, openDetailsModal, dll, SAMA PERSIS seperti sebelumnya) ...

// --- FUNGSI BARU UNTUK LAPORAN, PDF, EXCEL ---

// FUNGSI BARU UNTUK MENAMPILKAN LAPORAN DI WEB
function viewReportOnWeb() {
    const tglMulai = document.getElementById('report-tgl-mulai').value;
    const tglAkhir = document.getElementById('report-tgl-akhir').value;

    const filtered = allTransactions.filter(tx => 
        (!tglMulai || tx.tanggal >= tglMulai) && (!tglAkhir || tx.tanggal <= tglAkhir)
    );

    if (filtered.length === 0) {
        return alert('Tidak ada data yang cocok untuk periode yang dipilih.');
    }

    const tableHead = document.getElementById('view-report-head');
    const tableBody = document.getElementById('view-report-body');

    tableHead.innerHTML = `
        <tr>
            <th>Tanggal</th>
            <th>Nama</th>
            <th>Jenis</th>
            <th>No Faktur</th>
            <th>Debit</th>
            <th>Kredit</th>
        </tr>`;
    
    let bodyHtml = '';
    filtered.forEach(tx => {
        const debit = tx.type === 'faktur' ? formatCurrency((tx.jumlah || 0) - (tx.retur || 0)) : '-';
        const kredit = tx.type === 'payment' ? formatCurrency(tx.jumlah) : '-';
        bodyHtml += `
            <tr>
                <td>${tx.tanggal}</td>
                <td>${tx.nama}</td>
                <td>${tx.mode.toUpperCase()}</td>
                <td>${tx.noFaktur || '-'}</td>
                <td>${debit}</td>
                <td>${kredit}</td>
            </tr>`;
    });
    tableBody.innerHTML = bodyHtml;

    // Tampilkan modal pratinjau
    viewReportModal.show();
}

// ... (Fungsi generatePdfReport, exportToExcel, importFromExcel SAMA PERSIS seperti sebelumnya) ...

// --- KODE BARU UNTUK MENDAFTARKAN SERVICE WORKER PWA ---
// Letakkan kode ini di bagian paling bawah file app.js

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker registered: ', registration);
            })
            .catch(registrationError => {
                console.log('Service Worker registration failed: ', registrationError);
            });
    });
}
