// --- app.js - Versi Final (dengan Perbaikan Inisialisasi Modal) ---

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
    // Referensi ke elemen form, bukan ke modalnya
    const transaksiForm = document.getElementById('transaksi-form');
    const paymentForm = document.getElementById('payment-form');

    // --- FUNGSI UTAMA APLIKASI ---
    function initApp() {
        setupEventListeners();
        loadAllTransactions();
    }

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

    // --- FUNGSI RENDER & UPDATE UI ---
    function updateListTitle() {
        const title = document.getElementById('list-title');
        title.textContent = (currentDisplayMode === 'pembelian') ? 'Daftar Hutang Supplier' : 'Daftar Piutang Customer';
    }

    function renderEntityList() {
        const filterText = document.getElementById('filter-nama').value.toLowerCase();
        const filteredTransactions = allTransactions.filter(tx => tx.mode === currentDisplayMode);
        
        const entities = {};
        filteredTransactions.forEach(tx => {
            if (!entities[tx.nama]) entities[tx.nama] = { balance: 0, name: tx.nama };
            if (tx.type === 'faktur') entities[tx.nama].balance += (tx.jumlah || 0) - (tx.retur || 0);
            else if (tx.type === 'payment') entities[tx.nama].balance -= (tx.jumlah || 0);
        });

        entityListBody.innerHTML = '';
        let hasData = false;
        Object.values(entities)
            .filter(e => e.name.toLowerCase().includes(filterText) && e.balance > 0)
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(entity => {
                hasData = true;
                const row = `<tr><td><span class="fw-bold">${entity.name}</span></td><td class="text-danger">Rp ${formatCurrency(entity.balance)}</td><td><button class="btn btn-sm btn-info" onclick="openDetailsModal('${entity.name}')">Detail</button></td></tr>`;
                entityListBody.innerHTML += row;
            });
        
        if (!hasData) entityListBody.innerHTML = `<tr><td colspan="3" class="text-center">Tidak ada data untuk ditampilkan.</td></tr>`;
    }

    function updateDashboard() {
        let totalPembelian = 0, totalPenjualan = 0, jatuhTempoCount = 0;
        allTransactions.forEach(tx => {
            const sisa = calculateSisaFaktur(tx.id);
            if (tx.mode === 'pembelian' && tx.type === 'faktur') totalPembelian += tx.jumlah || 0;
            else if (tx.mode === 'penjualan' && tx.type === 'faktur') totalPenjualan += tx.jumlah || 0;
            if (tx.type === 'faktur' && new Date(tx.jatuhTempo) < new Date() && sisa > 0) jatuhTempoCount++;
        });
        document.getElementById('total-pembelian').textContent = `Rp ${formatCurrency(totalPembelian)}`;
        document.getElementById('total-penjualan').textContent = `Rp ${formatCurrency(totalPenjualan)}`;
        document.getElementById('total-jatuh-tempo').textContent = `${jatuhTempoCount} Faktur`;
    }

    function populateDatalist() {
        const uniqueNames = [...new Set(allTransactions.map(tx => tx.nama))];
        const datalist = document.getElementById('entity-names-list');
        datalist.innerHTML = '';
        uniqueNames.forEach(name => {
            datalist.innerHTML += `<option value="${name}">`;
        });
    }

    // --- FUNGSI MODAL (Diubah untuk menghindari error) ---
    window.openDetailsModal = (entityName) => {
        const entityTransactions = allTransactions
            .filter(tx => tx.nama === entityName)
            .sort((a, b) => {
                const dateA = new Date(a.tanggal);
                const dateB = new Date(b.tanggal);
                if (dateA.getTime() === dateB.getTime()) {
                    const timeA = a.createdAt && a.createdAt.seconds ? a.createdAt.seconds : 0;
                    const timeB = b.createdAt && b.createdAt.seconds ? b.createdAt.seconds : 0;
                    return timeA - timeB;
                }
                return dateA - dateB;
            });

        document.getElementById('details-table-body').innerHTML = '';
        document.getElementById('details-modal-label').textContent = `Detail Transaksi: ${entityName}`;

        let runningBalance = 0;
        entityTransactions.forEach(tx => {
            let debit = 0, kredit = 0, actions = '', keteranganText = tx.keterangan || '';
            if (tx.type === 'faktur') {
                debit = (tx.jumlah || 0);
                runningBalance += (tx.jumlah || 0) - (tx.retur || 0);
                if (tx.retur > 0) keteranganText += ` (Retur: ${formatCurrency(tx.retur)})`;
                if (calculateSisaFaktur(tx.id) > 0) actions += `<button class="btn btn-sm btn-success" onclick="openPaymentModal('${tx.id}', '${tx.noFaktur}')" title="Bayar Faktur Ini"><i class="bi bi-cash-coin"></i></button> `;
                actions += `<button class="btn btn-sm btn-warning" onclick="editFaktur('${tx.id}')" title="Edit Faktur"><i class="bi bi-pencil-fill"></i></button> `;
            } else if (tx.type === 'payment') {
                kredit = tx.jumlah || 0;
                keteranganText = tx.metode;
                if (tx.bank) keteranganText += ` - ${tx.bank}`;
                if (tx.giroNo) keteranganText += ` - No: ${tx.giroNo}`;
            }
            actions += `<button class="btn btn-sm btn-danger" onclick="deleteTransaksi('${tx.id}', '${tx.type}')" title="Hapus Transaksi"><i class="bi bi-trash-fill"></i></button>`;
            const row = `<tr><td>${tx.tanggal}</td><td>${tx.noFaktur || '-'}</td><td>${keteranganText}</td><td>${debit > 0 ? formatCurrency(debit) : '-'}</td><td>${kredit > 0 ? formatCurrency(kredit) : '-'}</td><td class="fw-bold">${formatCurrency(runningBalance)}</td><td>${actions}</td></tr>`;
            document.getElementById('details-table-body').innerHTML += row;
        });
        
        const totalSisaEntity = entityTransactions.reduce((acc, tx) => (tx.type === 'faktur' ? acc + (tx.jumlah || 0) - (tx.retur || 0) : acc - (tx.jumlah || 0)), 0);
        document.getElementById('details-total-sisa').textContent = `Rp ${formatCurrency(totalSisaEntity)}`;
        
        // Inisialisasi modal tepat sebelum ditampilkan
        new bootstrap.Modal(document.getElementById('details-modal')).show();
    }

    window.openPaymentModal = (fakturId, noFaktur) => {
        paymentForm.reset();
        document.getElementById('payment-transaksi-id').value = fakturId;
        document.getElementById('payment-faktur-no').textContent = noFaktur;
        const sisa = calculateSisaFaktur(fakturId);
        document.getElementById('sisa-tagihan-payment').textContent = `Rp ${formatCurrency(sisa)}`;
        document.getElementById('payment-amount').value = sisa;
        document.getElementById('payment-date').value = new Date().toISOString().slice(0, 10);
        new bootstrap.Modal(document.getElementById('payment-modal')).show();
    }

    window.editFaktur = (id) => {
        const tx = allTransactions.find(t => t.id === id);
        if (!tx) return;
        document.getElementById('transaksi-id').value = tx.id;
        document.getElementById('transaksi-modal-title').textContent = `Edit Faktur ${tx.noFaktur}`;
        document.getElementById('nama').value = tx.nama;
        document.getElementById('tanggal').value = tx.tanggal;
        document.getElementById('no-faktur').value = tx.noFaktur;
        document.getElementById('keterangan').value = tx.keterangan;
        document.getElementById('jumlah').value = tx.jumlah;
        document.getElementById('jatuh-tempo').value = tx.jatuhTempo;
        document.getElementById('retur').value = tx.retur;
        new bootstrap.Modal(document.getElementById('transaksi-modal')).show();
    }

    function togglePaymentDetails(e) {
        document.getElementById('transfer-details').style.display = e.target.value === 'Transfer' ? 'block' : 'none';
        document.getElementById('giro-details').style.display = e.target.value === 'Giro' ? 'block' : 'none';
    }

    // --- FUNGSI SUBMIT FORM ---
    function handleFakturSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('transaksi-id').value;
        const data = {
            mode: document.querySelector('input[name="appMode"]:checked').value,
            type: 'faktur',
            nama: document.getElementById('nama').value.trim(),
            tanggal: document.getElementById('tanggal').value,
            noFaktur: document.getElementById('no-faktur').value,
            keterangan: document.getElementById('keterangan').value,
            jumlah: parseFloat(document.getElementById('jumlah').value),
            jatuhTempo: document.getElementById('jatuh-tempo').value,
            retur: parseFloat(document.getElementById('retur').value) || 0,
            updatedAt: new Date()
        };
        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('transaksi-modal'));
        if (id) {
            transactionCollection.doc(id).update(data).then(() => modalInstance.hide());
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            transactionCollection.add(data).then(() => modalInstance.hide());
        }
    }

    function handlePaymentSubmit(e) {
        e.preventDefault();
        const fakturId = document.getElementById('payment-transaksi-id').value;
        const fakturAsli = allTransactions.find(tx => tx.id === fakturId);
        if (!fakturAsli) return alert('Faktur asli tidak ditemukan!');
        const paymentData = {
            mode: fakturAsli.mode, type: 'payment', linkedFakturId: fakturId,
            noFaktur: fakturAsli.noFaktur, nama: fakturAsli.nama,
            tanggal: document.getElementById('payment-date').value,
            jumlah: parseFloat(document.getElementById('payment-amount').value),
            metode: document.getElementById('payment-type').value,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (paymentData.metode === 'Transfer') paymentData.bank = document.getElementById('transfer-bank').value;
        if (paymentData.metode === 'Giro') {
            paymentData.giroNo = document.getElementById('giro-no').value;
            paymentData.giroDueDate = document.getElementById('giro-due-date').value;
        }
        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('payment-modal'));
        transactionCollection.add(paymentData).then(() => {
            modalInstance.hide();
            const detailsModalInstance = bootstrap.Modal.getInstance(document.getElementById('details-modal'));
            if(detailsModalInstance) detailsModalInstance.hide();
        });
    }

    // --- FUNGSI DELETE & HELPERS ---
    window.deleteTransaksi = (id, type) => {
        let confirmMsg = 'Apakah Anda yakin ingin menghapus transaksi ini?';
        if (type === 'faktur') confirmMsg = 'Menghapus faktur akan menghapus SEMUA pembayaran terkait. Yakin?';
        if (confirm(confirmMsg)) {
            const detailsModalInstance = bootstrap.Modal.getInstance(document.getElementById('details-modal'));
            if (type === 'faktur') {
                const paymentsToDelete = allTransactions.filter(p => p.linkedFakturId === id);
                const batch = db.batch();
                paymentsToDelete.forEach(p => batch.delete(transactionCollection.doc(p.id)));
                batch.delete(transactionCollection.doc(id));
                batch.commit().then(() => detailsModalInstance ? detailsModalInstance.hide() : null);
            } else {
                transactionCollection.doc(id).delete().then(() => detailsModalInstance ? detailsModalInstance.hide() : null);
            }
        }
    }

    function formatCurrency(num) {
        return new Intl.NumberFormat('id-ID').format(num || 0);
    }

    function calculateSisaFaktur(fakturId) {
        const faktur = allTransactions.find(tx => tx.id === fakturId);
        if (!faktur || faktur.type !== 'faktur') return 0;
        const totalPembayaran = allTransactions
            .filter(tx => tx.type === 'payment' && tx.linkedFakturId === fakturId)
            .reduce((sum, p) => sum + (p.jumlah || 0), 0);
        return (faktur.jumlah || 0) - (faktur.retur || 0) - totalPembayaran;
    }

    // --- FUNGSI LAPORAN, PDF, EXCEL ---
    function viewReportOnWeb() {
        const tglMulai = document.getElementById('report-tgl-mulai').value;
        const tglAkhir = document.getElementById('report-tgl-akhir').value;
        const filtered = allTransactions.filter(tx => (!tglMulai || tx.tanggal >= tglMulai) && (!tglAkhir || tx.tanggal <= tglAkhir));
        if (filtered.length === 0) return alert('Tidak ada data yang cocok untuk periode yang dipilih.');

        const tableHead = document.getElementById('view-report-head');
        const tableBody = document.getElementById('view-report-body');
        tableHead.innerHTML = `<tr><th>Tanggal</th><th>Nama</th><th>Jenis</th><th>No Faktur</th><th>Debit</th><th>Kredit</th></tr>`;
        let bodyHtml = '';
        filtered.forEach(tx => {
            const debit = tx.type === 'faktur' ? formatCurrency((tx.jumlah || 0) - (tx.retur || 0)) : '-';
            const kredit = tx.type === 'payment' ? formatCurrency(tx.jumlah) : '-';
            bodyHtml += `<tr><td>${tx.tanggal}</td><td>${tx.nama}</td><td>${tx.mode.toUpperCase()}</td><td>${tx.noFaktur || '-'}</td><td>${debit}</td><td>${kredit}</td></tr>`;
        });
        tableBody.innerHTML = bodyHtml;
        new bootstrap.Modal(document.getElementById('view-report-modal')).show();
    }

    function generatePdfReport() {
        // ... (fungsi ini tidak berubah)
    }
    function exportToExcel() {
        // ... (fungsi ini tidak berubah)
    }
    function importFromExcel(e) {
        // ... (fungsi ini tidak berubah)
    }

    // --- PENDAFTARAN SERVICE WORKER (PWA) ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(registration => console.log('Service Worker registered: ', registration))
                .catch(registrationError => console.log('Service Worker registration failed: ', registrationError));
        });
    }

}); // Penutup untuk event listener DOMContentLoaded
