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
    let allContacts = [];
    const transactionCollection = db.collection('transactions');
    const contactsCollection = db.collection('contacts');
    const entityListBody = document.getElementById('entity-list-body');
    const transaksiForm = document.getElementById('transaksi-form');
    const paymentForm = document.getElementById('payment-form');
    let paymentMethodCounter = 0;

    // --- FUNGSI UTAMA APLIKASI ---
    function initApp() {
        setupEventListeners();
        loadAllTransactions();
        loadContacts();
    }
    
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
        document.getElementById('view-report-btn').addEventListener('click', viewReportOnWeb);
        document.getElementById('generate-pdf-btn').addEventListener('click', generatePdfReport);
        document.getElementById('export-excel-btn').addEventListener('click', exportToExcel);
        document.getElementById('import-excel-input').addEventListener('change', importFromExcel);
        document.getElementById('contact-form').addEventListener('submit', saveContact);
        document.getElementById('cancel-edit-contact-btn').addEventListener('click', () => {
            document.getElementById('contact-form').reset();
            document.getElementById('contact-id').value = '';
            document.getElementById('contact-form-title').textContent = 'Tambah Kontak Baru';
            document.getElementById('cancel-edit-contact-btn').style.display = 'none';
        });
    }

    function loadAllTransactions() {
        transactionCollection.orderBy('tanggal', 'asc').onSnapshot(snapshot => {
            allTransactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateDashboard();
            renderEntityList();
        }, err => console.error("Error loading transactions:", err));
    }

    function loadContacts() {
        contactsCollection.orderBy('name').onSnapshot(snapshot => {
            allContacts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const contactsTableBody = document.getElementById('contacts-table-body');
            const namaDropdown = document.getElementById('nama-dropdown');
            const reportContactFilter = document.getElementById('report-contact-filter');
            
            contactsTableBody.innerHTML = '';
            namaDropdown.innerHTML = '<option value="">-- Pilih Supplier/Customer --</option>';
            reportContactFilter.innerHTML = '<option value="">Semua Kontak</option>';

            allContacts.forEach(contact => {
                const row = `<tr><td>${contact.name}</td><td>${contact.type}</td><td>${contact.phone || '-'}</td><td><button class="btn btn-sm btn-warning" onclick="editContact('${contact.id}')">Edit</button> <button class="btn btn-sm btn-danger" onclick="deleteContact('${contact.id}')">Hapus</button></td></tr>`;
                contactsTableBody.innerHTML += row;
                const option = `<option value="${contact.name}">${contact.name} (${contact.type})</option>`;
                namaDropdown.innerHTML += option;
                reportContactFilter.innerHTML += option;
            });
        });
    }
    
    function updateListTitle() {
        document.getElementById('list-title').textContent = (currentDisplayMode === 'pembelian') ? 'Daftar Hutang Supplier' : 'Daftar Piutang Customer';
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
        Object.values(entities).filter(e => e.name.toLowerCase().includes(filterText) && e.balance > 0).sort((a, b) => a.name.localeCompare(b.name)).forEach(entity => {
            hasData = true;
            entityListBody.innerHTML += `<tr><td><span class="fw-bold">${entity.name}</span></td><td class="text-danger">Rp ${formatCurrency(entity.balance)}</td><td><button class="btn btn-sm btn-info" onclick="openDetailsModal('${entity.name}')">Detail</button></td></tr>`;
        });
        if (!hasData) entityListBody.innerHTML = `<tr><td colspan="3" class="text-center">Tidak ada data untuk ditampilkan.</td></tr>`;
    }

    function updateDashboard() {
        let totalPembelian = 0, totalPenjualan = 0, jatuhTempoCount = 0;
        allTransactions.forEach(tx => {
            if (tx.type !== 'faktur') return;
            const sisa = calculateSisaFaktur(tx.id);
            if (tx.mode === 'pembelian') totalPembelian += tx.jumlah || 0;
            else if (tx.mode === 'penjualan') totalPenjualan += tx.jumlah || 0;
            if (new Date(tx.jatuhTempo) < new Date() && sisa > 0) jatuhTempoCount++;
        });
        document.getElementById('total-pembelian').textContent = `Rp ${formatCurrency(totalPembelian)}`;
        document.getElementById('total-penjualan').textContent = `Rp ${formatCurrency(totalPenjualan)}`;
        document.getElementById('total-jatuh-tempo').textContent = `${jatuhTempoCount} Faktur`;
    }

    window.openDetailsModal = (entityName) => {
        const entityTransactions = allTransactions.filter(tx => tx.nama === entityName).sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal) || (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        const detailsTableBody = document.getElementById('details-table-body');
        detailsTableBody.innerHTML = '';
        document.getElementById('details-modal-label').textContent = `Detail Transaksi: ${entityName}`;
        let runningBalance = 0;
        entityTransactions.forEach(tx => {
            let debit = 0, kredit = 0, actions = '', keteranganText = tx.keterangan || '';
            if (tx.type === 'faktur') {
                debit = (tx.jumlah || 0);
                runningBalance += (tx.jumlah || 0) - (tx.retur || 0);
                if (tx.retur > 0) keteranganText += ` (Retur: ${formatCurrency(tx.retur)})`;
                if (calculateSisaFaktur(tx.id) > 0) actions += `<button class="btn btn-sm btn-success" onclick="openPaymentModal('${tx.id}', '${tx.noFaktur}')" title="Bayar"><i class="bi bi-cash-coin"></i></button> `;
                actions += `<button class="btn btn-sm btn-warning" onclick="editFaktur('${tx.id}')" title="Edit"><i class="bi bi-pencil-fill"></i></button> `;
            } else if (tx.type === 'payment') {
                kredit = tx.jumlah || 0;
                runningBalance -= kredit;
                keteranganText = `${tx.metode}`;
                if (tx.bank) keteranganText += ` - ${tx.bank}`;
                if (tx.giroNo) keteranganText += ` - No: ${tx.giroNo}`;
            }
            actions += `<button class="btn btn-sm btn-danger" onclick="deleteTransaksi('${tx.id}', '${tx.type}')" title="Hapus"><i class="bi bi-trash-fill"></i></button>`;
            detailsTableBody.innerHTML += `<tr><td>${tx.tanggal}</td><td>${tx.noFaktur || '-'}</td><td>${keteranganText}</td><td>${debit > 0 ? formatCurrency(debit) : '-'}</td><td>${kredit > 0 ? formatCurrency(kredit) : '-'}</td><td class="fw-bold">${formatCurrency(runningBalance)}</td><td>${actions}</td></tr>`;
        });
        document.getElementById('details-total-sisa').textContent = `Rp ${formatCurrency(runningBalance)}`;
        new bootstrap.Modal(document.getElementById('details-modal')).show();
    }

    window.openPaymentModal = (fakturId, noFaktur) => {
        paymentForm.reset();
        document.getElementById('payment-methods-container').innerHTML = '';
        paymentMethodCounter = 0;
        document.getElementById('payment-transaksi-id').value = fakturId;
        document.getElementById('payment-faktur-no').textContent = noFaktur;
        const sisa = calculateSisaFaktur(fakturId);
        document.getElementById('sisa-tagihan-payment').textContent = `Rp ${formatCurrency(sisa)}`;
        document.getElementById('payment-date').value = new Date().toISOString().slice(0, 10);
        addPaymentMethodRow(sisa);
        document.getElementById('add-payment-method-btn').onclick = () => addPaymentMethodRow();
        new bootstrap.Modal(document.getElementById('payment-modal')).show();
    }

    function addPaymentMethodRow(amount = 0) {
        paymentMethodCounter++;
        const container = document.getElementById('payment-methods-container');
        const newRow = document.createElement('div');
        newRow.className = 'payment-method-row card card-body mb-2';
        newRow.id = `payment-row-${paymentMethodCounter}`;
        newRow.innerHTML = `<div class="d-flex justify-content-end"><button type="button" class="btn-close" onclick="this.closest('.payment-method-row').remove(); updateTotalPaymentDisplay();"></button></div><div class="row g-2"><div class="col-md-6"><label class="form-label">Jumlah</label><input type="number" class="form-control payment-amount" value="${amount}" oninput="updateTotalPaymentDisplay()"></div><div class="col-md-6"><label class="form-label">Metode</label><select class="form-select payment-type" onchange="togglePaymentDetails(this)"><option value="Cash">Cash</option><option value="Transfer">Transfer</option><option value="Giro">Giro</option></select></div></div><div class="transfer-details mt-2" style="display: none;"><input type="text" class="form-control transfer-bank" placeholder="Contoh: BCA"></div><div class="giro-details mt-2" style="display: none;"><input type="text" class="form-control giro-no mb-2" placeholder="Nomor Giro"><input type="date" class="form-control giro-due-date"></div>`;
        container.appendChild(newRow);
        updateTotalPaymentDisplay();
    }

    window.togglePaymentDetails = (selectElement) => {
        const parentRow = selectElement.closest('.payment-method-row');
        parentRow.querySelector('.transfer-details').style.display = selectElement.value === 'Transfer' ? 'block' : 'none';
        parentRow.querySelector('.giro-details').style.display = selectElement.value === 'Giro' ? 'block' : 'none';
    }

    function updateTotalPaymentDisplay() {
        let total = 0;
        document.querySelectorAll('.payment-amount').forEach(input => total += parseFloat(input.value) || 0);
        document.getElementById('total-payment-display').textContent = `Rp ${formatCurrency(total)}`;
    }

    window.editFaktur = (id) => {
        const tx = allTransactions.find(t => t.id === id);
        if (!tx) return;
        document.getElementById('transaksi-id').value = id;
        document.getElementById('transaksi-modal-title').textContent = `Edit Faktur ${tx.noFaktur}`;
        document.getElementById('nama-dropdown').value = tx.nama;
        document.getElementById('tanggal').value = tx.tanggal;
        document.getElementById('no-faktur').value = tx.noFaktur;
        document.getElementById('keterangan').value = tx.keterangan;
        document.getElementById('jumlah').value = tx.jumlah;
        document.getElementById('jatuh-tempo').value = tx.jatuhTempo;
        document.getElementById('retur').value = tx.retur;
        new bootstrap.Modal(document.getElementById('transaksi-modal')).show();
    }

    function handleFakturSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('transaksi-id').value;
        const data = {
            mode: document.querySelector('input[name="appMode"]:checked').value, type: 'faktur',
            nama: document.getElementById('nama-dropdown').value, tanggal: document.getElementById('tanggal').value,
            noFaktur: document.getElementById('no-faktur').value, keterangan: document.getElementById('keterangan').value,
            jumlah: parseFloat(document.getElementById('jumlah').value), jatuhTempo: document.getElementById('jatuh-tempo').value,
            retur: parseFloat(document.getElementById('retur').value) || 0, 
            updatedAt: new Date()
        };
        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('transaksi-modal'));
        if (id) {
            transactionCollection.doc(id).update(data).then(() => modalInstance.hide()).catch(err => {
                console.error("Error updating transaction: ", err);
                alert("Gagal memperbarui transaksi.");
            });
        } else {
            data.createdAt = new Date();
            transactionCollection.add(data).then(() => modalInstance.hide()).catch(err => {
                console.error("Error adding transaction: ", err);
                alert("Gagal menyimpan transaksi baru.");
            });
        }
    }

    function handlePaymentSubmit(e) {
        e.preventDefault();
        const fakturId = document.getElementById('payment-transaksi-id').value;
        const fakturAsli = allTransactions.find(tx => tx.id === fakturId);
        if (!fakturAsli) return alert('Faktur asli tidak ditemukan!');
        const paymentRows = document.querySelectorAll('.payment-method-row');
        if (paymentRows.length === 0) return alert('Tambahkan minimal satu metode pembayaran.');
        const batch = db.batch();
        const paymentGroupId = `PAY-${Date.now()}`;
        paymentRows.forEach(row => {
            const paymentData = {
                mode: fakturAsli.mode, type: 'payment', linkedFakturId: fakturId, paymentGroupId,
                noFaktur: fakturAsli.noFaktur, nama: fakturAsli.nama,
                tanggal: document.getElementById('payment-date').value,
                jumlah: parseFloat(row.querySelector('.payment-amount').value) || 0,
                metode: row.querySelector('.payment-type').value,
                createdAt: new Date()
            };
            if (paymentData.jumlah <= 0) return;
            if (paymentData.metode === 'Transfer') paymentData.bank = row.querySelector('.transfer-bank').value;
            if (paymentData.metode === 'Giro') {
                paymentData.giroNo = row.querySelector('.giro-no').value;
                paymentData.giroDueDate = row.querySelector('.giro-due-date').value;
            }
            const newPaymentRef = transactionCollection.doc();
            batch.set(newPaymentRef, paymentData);
        });
        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('payment-modal'));
        batch.commit().then(() => {
            modalInstance.hide();
            const detailsModalInstance = bootstrap.Modal.getInstance(document.getElementById('details-modal'));
            if(detailsModalInstance) detailsModalInstance.hide();
        }).catch(err => {
            console.error("Error saving payment: ", err);
            alert('Gagal menyimpan pembayaran.');
        });
    }

    window.deleteTransaksi = (id, type) => {
        if (confirm('Yakin ingin menghapus? Aksi ini tidak bisa dibatalkan.')) {
            const detailsModalInstance = bootstrap.Modal.getInstance(document.getElementById('details-modal'));
            if (type === 'faktur') {
                const paymentsToDelete = allTransactions.filter(p => p.linkedFakturId === id);
                const batch = db.batch();
                paymentsToDelete.forEach(p => batch.delete(transactionCollection.doc(p.id)));
                batch.delete(transactionCollection.doc(id));
                batch.commit().then(() => detailsModalInstance ? detailsModalInstance.hide() : null).catch(err => alert("Gagal menghapus transaksi."));
            } else {
                transactionCollection.doc(id).delete().then(() => detailsModalInstance ? detailsModalInstance.hide() : null).catch(err => alert("Gagal menghapus pembayaran."));
            }
        }
    }

    function saveContact(e) {
        e.preventDefault();
        const contactName = document.getElementById('contact-name').value.trim();
        const contactType = document.getElementById('contact-type').value;
        if (!contactName) {
            alert('Nama kontak wajib diisi!');
            return;
        }
        if (!contactType) {
            alert('Jenis kontak wajib dipilih!');
            return;
        }
        const contactData = {
            name: contactName,
            type: contactType,
            phone: document.getElementById('contact-phone').value.trim() || null,
            email: document.getElementById('contact-email').value.trim() || null,
            address: document.getElementById('contact-address').value.trim() || null,
            contactPerson: document.getElementById('contact-person').value.trim() || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        const contactId = document.getElementById('contact-id').value;
        if (contactId) {
            contactsCollection.doc(contactId).update(contactData).then(() => {
                alert('Kontak berhasil diperbarui!');
                document.getElementById('cancel-edit-contact-btn').click();
            }).catch(err => {
                console.error("Error updating contact: ", err);
                alert("Gagal memperbarui kontak: " + err.message);
            });
        } else {
            contactData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            contactsCollection.add(contactData).then(() => {
                alert('Kontak baru berhasil disimpan!');
                document.getElementById('contact-form').reset();
            }).catch(err => {
                console.error("Error adding contact: ", err);
                alert("Gagal menyimpan kontak baru: " + err.message);
            });
        }
    }

    window.editContact = (id) => {
        const contact = allContacts.find(c => c.id === id);
        if (!contact) return;
        document.getElementById('contact-id').value = id;
        document.getElementById('contact-name').value = contact.name || '';
        document.getElementById('contact-type').value = contact.type || '';
        document.getElementById('contact-phone').value = contact.phone || '';
        document.getElementById('contact-email').value = contact.email || '';
        document.getElementById('contact-address').value = contact.address || '';
        document.getElementById('contact-person').value = contact.contactPerson || '';
        document.getElementById('contact-form-title').textContent = 'Edit Kontak';
          const id = document.getElementById('transaksi-id').value;
        const data = {
            mode: document.querySelector('input[name="appMode"]:checked').value, type: 'faktur',
            nama: document.getElementById('nama-dropdown').value, tanggal: document.getElementById('tanggal').value,
            noFaktur: document.getElementById('no-faktur').value, keterangan: document.getElementById('keterangan').value,
            jumlah: parseFloat(document.getElementById('jumlah').value), jatuhTempo: document.getElementById('jatuh-tempo').value,
            retur: parseFloat(document.getElementById('retur').value) || 0, 
            updatedAt: new Date()
        };
        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('transaksi-modal'));
        if (id) {
            transactionCollection.doc(id).update(data).then(() => modalInstance.hide()).catch(err => {
                console.error("Error updating transaction: ", err);
                alert("Gagal memperbarui transaksi.");
            });
        } else {
            data.createdAt = new Date();
            transactionCollection.add(data).then(() => modalInstance.hide()).catch(err => {
                console.error("Error adding transaction: ", err);
                alert("Gagal menyimpan transaksi baru.");
            });
        }
    }

    function handlePaymentSubmit(e) {
        e.preventDefault();
        const fakturId = document.getElementById('payment-transaksi-id').value;
        const fakturAsli = allTransactions.find(tx => tx.id === fakturId);
        if (!fakturAsli) return alert('Faktur asli tidak ditemukan!');
        const paymentRows = document.querySelectorAll('.payment-method-row');
        if (paymentRows.length === 0) return alert('Tambahkan minimal satu metode pembayaran.');
        const batch = db.batch();
        const paymentGroupId = `PAY-${Date.now()}`;
        paymentRows.forEach(row => {
            const paymentData = {
                mode: fakturAsli.mode, type: 'payment', linkedFakturId: fakturId, paymentGroupId,
                noFaktur: fakturAsli.noFaktur, nama: fakturAsli.nama,
                tanggal: document.getElementById('payment-date').value,
                jumlah: parseFloat(row.querySelector('.payment-amount').value) || 0,
                metode: row.querySelector('.payment-type').value,
                createdAt: new Date()
            };
            if (paymentData.jumlah <= 0) return;
            if (paymentData.metode === 'Transfer') paymentData.bank = row.querySelector('.transfer-bank').value;
            if (paymentData.metode === 'Giro') {
                paymentData.giroNo = row.querySelector('.giro-no').value;
                paymentData.giroDueDate = row.querySelector('.giro-due-date').value;
            }
            const newPaymentRef = transactionCollection.doc();
            batch.set(newPaymentRef, paymentData);
        });
        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('payment-modal'));
        batch.commit().then(() => {
            modalInstance.hide();
            const detailsModalInstance = bootstrap.Modal.getInstance(document.getElementById('details-modal'));
            if(detailsModalInstance) detailsModalInstance.hide();
        }).catch(err => {
            console.error("Error saving payment: ", err);
            alert('Gagal menyimpan pembayaran.');
        });
    }

    window.deleteTransaksi = (id, type) => {
        if (confirm('Yakin ingin menghapus? Aksi ini tidak bisa dibatalkan.')) {
            const detailsModalInstance = bootstrap.Modal.getInstance(document.getElementById('details-modal'));
            if (type === 'faktur') {
                const paymentsToDelete = allTransactions.filter(p => p.linkedFakturId === id);
                const batch = db.batch();
                paymentsToDelete.forEach(p => batch.delete(transactionCollection.doc(p.id)));
                batch.delete(transactionCollection.doc(id));
                batch.commit().then(() => detailsModalInstance ? detailsModalInstance.hide() : null).catch(err => alert("Gagal menghapus transaksi."));
            } else {
                transactionCollection.doc(id).delete().then(() => detailsModalInstance ? detailsModalInstance.hide() : null).catch(err => alert("Gagal menghapus pembayaran."));
            }
        }
    }

    // FUNGSI YANG DIPERBAIKI
    function saveContact(e) {
        e.preventDefault();
        const contactData = {
            name: document.getElementById('contact-name').value, 
            type: document.getElementById('contact-type').value,
            phone: document.getElementById('contact-phone').value, 
            email: document.getElementById('contact-email').value,
            address: document.getElementById('contact-address').value, 
            contactPerson: document.getElementById('contact-person').value,
            updatedAt: new Date() // Menggunakan new Date()
        };
        const contactId = document.getElementById('contact-id').value;
        if (contactId) {
            contactsCollection.doc(contactId).update(contactData).then(() => {
                document.getElementById('cancel-edit-contact-btn').click();
            }).catch(err => {
                console.error("Error updating contact: ", err);
                alert("Gagal memperbarui kontak.");
            });
        } else {
            contactData.createdAt = new Date(); // Menggunakan new Date()
            contactsCollection.add(contactData).then(() => {
                document.getElementById('contact-form').reset();
            }).catch(err => {
                console.error("Error adding contact: ", err);
                alert("Gagal menyimpan kontak baru.");
            });
        }
    }

    window.editContact = (id) => {
        const contact = allContacts.find(c => c.id === id);
        if (!contact) return;
        document.getElementById('contact-id').value = id;
        document.getElementById('contact-name').value = contact.name;
        document.getElementById('contact-type').value = contact.type;
        document.getElementById('contact-phone').value = contact.phone;
        document.getElementById('contact-email').value = contact.email;
        document.getElementById('contact-address').value = contact.address;
        document.getElementById('contact-person').value = contact.contactPerson;
        document.getElementById('contact-form-title').textContent = 'Edit Kontak';
        document.getElementById('cancel-edit-contact-btn').style.display = 'block';
    }

    window.deleteContact = (id) => {
        if (confirm('Yakin ingin menghapus kontak ini?')) {
            contactsCollection.doc(id).delete().catch(err => {
                console.error("Error deleting contact: ", err);
                alert("Gagal menghapus kontak.");
            });
        }
    }

    function formatCurrency(num) { return new Intl.NumberFormat('id-ID').format(num || 0); }

    function calculateSisaFaktur(fakturId) {
        const faktur = allTransactions.find(tx => tx.id === fakturId);
        if (!faktur) return 0;
        const totalPembayaran = allTransactions.filter(tx => tx.type === 'payment' && tx.linkedFakturId === fakturId).reduce((sum, p) => sum + (p.jumlah || 0), 0);
        return (faktur.jumlah || 0) - (faktur.retur || 0) - totalPembayaran;
    }

    function getFilteredReportData() {
        const tglMulai = document.getElementById('report-tgl-mulai').value;
        const tglAkhir = document.getElementById('report-tgl-akhir').value;
        const contactName = document.getElementById('report-contact-filter').value;
        
        return allTransactions.filter(tx => 
            (!tglMulai || tx.tanggal >= tglMulai) && 
            (!tglAkhir || tx.tanggal <= tglAkhir) &&
            (!contactName || tx.nama === contactName)
        );
    }

    function viewReportOnWeb() {
        const filtered = getFilteredReportData();
        if (filtered.length === 0) return alert('Tidak ada data yang cocok.');
        const tableHead = document.getElementById('view-report-head'), tableBody = document.getElementById('view-report-body');
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
        const filtered = getFilteredReportData();
        if (filtered.length === 0) return alert('Tidak ada data yang cocok.');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const contactName = document.getElementById('report-contact-filter').value;
        doc.text(`Laporan Transaksi ${contactName || 'Semua Kontak'}`, 14, 15);
        doc.setFontSize(10);
        const tglMulai = document.getElementById('report-tgl-mulai').value;
        const tglAkhir = document.getElementById('report-tgl-akhir').value;
        doc.text(`Periode: ${tglMulai || 'Awal'} - ${tglAkhir || 'Akhir'}`, 14, 20);
        const body = filtered.map(tx => [tx.tanggal, tx.nama, tx.mode.toUpperCase(), tx.noFaktur || '-', tx.type === 'faktur' ? formatCurrency((tx.jumlah || 0) - (tx.retur || 0)) : '-', tx.type === 'payment' ? formatCurrency(tx.jumlah) : '-']);
        doc.autoTable({ startY: 25, head: [['Tanggal', 'Nama', 'Jenis', 'No Faktur', 'Debit', 'Kredit']], body: body });
        doc.save(`Laporan-${contactName || 'Semua'}.pdf`);
    }

    function exportToExcel() {
        if (allTransactions.length === 0) return alert("Tidak ada data untuk diekspor.");
        const excelData = allTransactions.map(tx => {
            let sisaTagihan = tx.type === 'faktur' ? calculateSisaFaktur(tx.id) : null;
            return {
                ID_Transaksi: tx.id, Jenis_Transaksi: tx.type, Mode: tx.mode, Nama: tx.nama, Tanggal_Transaksi: tx.tanggal,
                No_Faktur: tx.noFaktur, Keterangan: tx.keterangan || '', Jumlah_Faktur: tx.type === 'faktur' ? tx.jumlah : '',
                Retur: tx.type === 'faktur' ? tx.retur : '', Sisa_Tagihan_Faktur: sisaTagihan, Jumlah_Pembayaran: tx.type === 'payment' ? tx.jumlah : '',
                Metode_Pembayaran: tx.type === 'payment' ? tx.metode : '', Bank_Transfer: tx.type === 'payment' ? tx.bank || '' : '',
                No_Giro: tx.type === 'payment' ? tx.giroNo || '' : '', Jatuh_Tempo_Faktur: tx.type === 'faktur' ? tx.jatuhTempo : '',
                Jatuh_Tempo_Giro: tx.type === 'payment' ? tx.giroDueDate || '' : '', ID_Faktur_Terkait: tx.type === 'payment' ? tx.linkedFakturId : ''
            };
        });
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Semua Transaksi");
        XLSX.writeFile(workbook, `Export_Nota_Keuangan.xlsx`);
    }

    function importFromExcel(e) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, {type: 'array', cellDates:true});
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                if (!confirm(`Impor ${jsonData.length} baris data?`)) { e.target.value = ''; return; }
                if (jsonData.length > 0 && (!jsonData[0].Jenis_Transaksi || !jsonData[0].Mode || !jsonData[0].Nama || !jsonData[0].Tanggal_Transaksi)) {
                    alert("Import Gagal! Kolom wajib: 'Jenis_Transaksi', 'Mode', 'Nama', 'Tanggal_Transaksi'.");
                    e.target.value = ''; return;
                }
                const batch = db.batch();
                jsonData.forEach(row => {
                    if (row.Jenis_Transaksi && row.Jenis_Transaksi.toLowerCase() === 'faktur') {
                        const newDocRef = transactionCollection.doc();
                        batch.set(newDocRef, {
                            type: 'faktur', mode: row.Mode.toLowerCase(), nama: row.Nama,
                            tanggal: row.Tanggal_Transaksi.toISOString().slice(0,10), noFaktur: row.No_Faktur || '',
                            keterangan: row.Keterangan || '', jumlah: parseFloat(row.Jumlah_Faktur) || 0,
                            retur: parseFloat(row.Retur) || 0,
                            jatuhTempo: row.Jatuh_Tempo_Faktur ? new Date(row.Jatuh_Tempo_Faktur).toISOString().slice(0,10) : '',
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: new Date()
                        });
                    }
                });
                batch.commit().then(() => {
                    alert('Impor data faktur berhasil!'); e.target.value = '';
                }).catch(err => {
                    alert('Terjadi kesalahan saat impor.'); console.error("Import error:", err); e.target.value = '';
                });
            } catch (error) {
                alert('Gagal memproses file Excel.'); console.error(error); e.target.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    }
    
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').then(reg => console.log('SW registered.')).catch(err => console.log('SW registration failed: ', err));
        });
    }
});
