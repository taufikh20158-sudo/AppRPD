// =====================================================================
// 1. KONSTRUKTOR & SUPABASE CONFIG
// =====================================================================
const { createClient } = supabase;
const _supabase = createClient('https://ldkefnlnpgwgxznemzol.supabase.co', 'sb_publishable_VG1TQwsg40s9ngumFAy-CQ_ORaBQKHG');
// =====================================================================
// 1. KONSTRUKTOR & VARIABEL GLOBAL
// =====================================================================
const tableBody = document.getElementById('tableBody');
const btnAddRow = document.getElementById('btnAddRow');
const editModal = document.getElementById('editModal');
const rpdModal = document.getElementById('rpdModal');
const realisasiModal = document.getElementById('realisasiModal');

let currentRowForEdit = null;
let targetRowRPD = null;
let targetRowRealisasi = null;

// =====================================================================
// 2. HELPER UTAMA (FORMATTER & PARSER)
// =====================================================================
const getVal = (str) => {
    if (!str) return 0;
    // Menggunakan regex \D untuk menghapus semua karakter selain angka
    // Ini jauh lebih aman untuk membersihkan format "1.500.000"
    let clean = str.toString().replace(/\D/g, "");
    return parseInt(clean) || 0;
};

const toRp = (num) => {
    if (num === null || num === undefined) return "0";
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

function formatRibuan(angka) {
    let nilai = angka.toString().replace(/[^0-9]/g, '');
    if (!nilai) return "";
    return nilai.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Pasang format otomatis ke semua input uang di modal
['editPagu', 'editBlokir', 'totalRPDInput', 'totalRealisasiInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', function() { this.value = formatRibuan(this.value); });
});

// =====================================================================
// 3. LOGIKA MANIPULASI TABEL (ADD, DELETE, MOVE)
// =====================================================================

function createNewRow(level, afterElement = null) {
    const row = document.createElement('tr');
    row.setAttribute('data-level', level);
    row.dataset.rpdBulanan = "0|0|0|0|0|0|0|0|0|0|0|0";
    row.dataset.realisasiBulanan = "0|0|0|0|0|0|0|0|0|0|0|0";
    
    const paddingLeft = level * 15; 
    const symbol = level > 0 ? '' : '';

    row.innerHTML = `
        <td class="col-cb text-center"><input type="checkbox" class="row-checkbox"></td>
        <td class="col-kd" style="padding-left: ${paddingLeft}px !important;">
            <div style="display: flex; align-items: center; overflow: hidden; white-space: nowrap;">
                <span class="symbol" style="color: #808080; font-family: monospace; flex-shrink: 0;">${symbol}</span>
                <span>000.00</span>
            </div>
        </td>
        <td class="col-nm">Item Level ${level}</td>
        <td class="col-idr text-right">0</td>
        <td class="col-idr text-right">0</td>
        <td class="col-idr text-right">0</td>
        <td class="col-idr text-right">0</td>
        <td class="col-idr text-right">0</td>
        <td class="col-idr text-right">0</td>
    `;

    if (afterElement) afterElement.insertAdjacentElement('afterend', row);
    else tableBody.appendChild(row);

    updateMondas();
}

btnAddRow.addEventListener('click', () => {
    const selected = tableBody.querySelector('.row-checkbox:checked');
    
    if (!selected) {
        // Jika tidak ada yang dicentang, tambah Level 0 di paling bawah tabel
        createNewRow(0);
    } else {
        const parentRow = selected.closest('tr');
        const parentLevel = parseInt(parentRow.getAttribute('data-level')) || 0;
        
        if (parentLevel >= 4) return alert("Batas maksimal adalah Level 4");

        // --- LOGIKA BARU: MENCARI BARIS TERBAWAH DARI GRUP ---
        let lastInGroup = parentRow;
        let nextScanner = parentRow.nextElementSibling;

        // Terus telusuri baris di bawahnya selama levelnya lebih besar (anak/cucu)
        while (nextScanner && (parseInt(nextScanner.getAttribute('data-level')) || 0) > parentLevel) {
            lastInGroup = nextScanner;
            nextScanner = nextScanner.nextElementSibling;
        }

        // Tambahkan baris baru tepat setelah anggota grup terakhir
        createNewRow(parentLevel + 1, lastInGroup);

        // Centang tetap ada (Manual)
        // selected.checked = false;
        // parentRow.classList.remove('row-selected');
    }
});

document.getElementById('btnMoveUp').addEventListener('click', () => {
    const selected = tableBody.querySelector('.row-checkbox:checked');
    if (!selected) return alert("Pilih baris!");

    const currentRow = selected.closest('tr');
    const currentLevel = parseInt(currentRow.getAttribute('data-level'));
    const rowsToMove = [currentRow];
    
    let nextScanner = currentRow.nextElementSibling;
    while (nextScanner && parseInt(nextScanner.getAttribute('data-level')) > currentLevel) {
        rowsToMove.push(nextScanner);
        nextScanner = nextScanner.nextElementSibling;
    }

    let targetRow = null;
    let prevScanner = currentRow.previousElementSibling;
    while (prevScanner) {
        let prevLevel = parseInt(prevScanner.getAttribute('data-level'));
        if (prevLevel === currentLevel) { targetRow = prevScanner; break; }
        if (prevLevel < currentLevel) break;
        prevScanner = prevScanner.previousElementSibling;
    }

    if (targetRow) {
        targetRow.before(...rowsToMove);
        currentRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
});

// =====================================================================
// 4. SISTEM PERHITUNGAN & HIERARKI (MONDAS)
// =====================================================================

function calculateRowTotal(row) {
    const cells = row.querySelectorAll('td');
    const pagu = getVal(cells[3].innerText);
    const blokir = getVal(cells[4].innerText);
    const realisasi = getVal(cells[6].innerText);

    const total = realisasi;
    const sisa = pagu - realisasi;

    cells[7].innerText = toRp(total);
    cells[8].innerText = toRp(sisa);
    cells[8].style.color = sisa < 0 ? "#ff0000" : "#000000";
}

function updateMondas() {
    const rows = Array.from(tableBody.querySelectorAll('tr'));
    
    // Loop dari bawah ke atas agar nilai level terdalam (Lv 4) 
    // terakumulasi ke Lv 3, lalu Lv 3 ke Lv 2, dst.
    for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        const level = parseInt(row.getAttribute('data-level')) || 0;
        const cells = row.querySelectorAll('td');

        // Cek apakah baris ini punya anak (baris di bawahnya level-nya lebih tinggi)
        let hasChild = (i + 1 < rows.length && parseInt(rows[i+1].getAttribute('data-level')) > level);

        if (hasChild) {
            let sumPagu = 0, sumBlokir = 0, sumRPD = 0, sumReal = 0;
            let monthlyRPD = new Array(12).fill(0);
            let monthlyReal = new Array(12).fill(0);

            for (let j = i + 1; j < rows.length; j++) {
                const child = rows[j];
                const childLv = parseInt(child.getAttribute('data-level'));
                
                // Berhenti jika ketemu baris yang levelnya sama atau lebih kecil (bukan anak lagi)
                if (childLv <= level) break;
                
                // --- PERBAIKAN DI SINI ---
                // Hanya jumlahkan baris yang levelnya tepat 1 tingkat di bawah induk (anak langsung)
                // Ini mencegah "double counting" karena anak langsung sudah membawa nilai cucu-cucunya.
                if (childLv === level + 1) {
                    const c = child.querySelectorAll('td');
                    sumPagu += getVal(c[3].innerText);
                    sumBlokir += getVal(c[4].innerText);
                    sumRPD += getVal(c[5].innerText);
                    sumReal += getVal(c[6].innerText);

                    const cRPDData = (child.dataset.rpdBulanan || "0|0|0|0|0|0|0|0|0|0|0|0").split('|');
                    const cRealData = (child.dataset.realisasiBulanan || "0|0|0|0|0|0|0|0|0|0|0|0").split('|');

                    for (let m = 0; m < 12; m++) {
                        monthlyRPD[m] += getVal(cRPDData[m]);
                        monthlyReal[m] += getVal(cRealData[m]);
                    }
                }
            }
            
            // Masukkan hasil jumlah ke sel induk
            cells[3].innerText = toRp(sumPagu);
            cells[4].innerText = toRp(sumBlokir);
            cells[5].innerText = toRp(sumRPD);
            cells[6].innerText = toRp(sumReal);

            row.dataset.rpdBulanan = monthlyRPD.join('|');
            row.dataset.realisasiBulanan = monthlyReal.join('|');
            row.classList.add('is-parent');
        } else {
            // Jika level 4 atau baris terbawah yang tidak punya anak
            row.classList.remove('is-parent');
        }
        
        calculateRowTotal(row);
    }
    updateDashboardTotal();
}

// =====================================================================
// 5. OPERASIONAL MODAL (EDIT, RPD, REALISASI)
// =====================================================================

// Helper Tutup Modal
function closeAllModals() {
    editModal.style.display = 'none';
    rpdModal.style.display = 'none';
    realisasiModal.style.display = 'none';
    // const selected = tableBody.querySelector('.row-checkbox:checked');
    // if (selected) {
    //     selected.checked = false;
    //     selected.closest('tr').classList.remove('row-selected');
    // }
}

// Pasang listener tutup ke semua tombol batal
document.querySelectorAll('.btn-close, .btn-batal, #btnCancelEdit, #btnCancelRPD, #btnCancelRealisasi').forEach(btn => {
    btn.onclick = closeAllModals;
});

// --- A. MODAL EDIT DATA ---
document.getElementById('btnEdit').addEventListener('click', function() {
    const selected = tableBody.querySelector('.row-checkbox:checked');
    if (!selected) return alert("Pilih baris!");

    currentRowForEdit = selected.closest('tr');
    const cells = currentRowForEdit.querySelectorAll('td');
    const level = parseInt(currentRowForEdit.getAttribute('data-level')) || 0;

    // Load Data
    document.getElementById('editKode').value = cells[1].innerText.replace('', '').trim();
    document.getElementById('editNama').value = cells[2].innerText;
    document.getElementById('editPagu').value = cells[3].innerText;
    document.getElementById('editBlokir').value = cells[4].innerText;

    // Proteksi: Level 0-3 (Induk) tidak bisa edit Pagu & Blokir
    const inputPagu = document.getElementById('editPagu');
    const inputBlokir = document.getElementById('editBlokir');
    const isParent = (level < 4);

    inputPagu.readOnly = isParent;
    inputBlokir.readOnly = isParent;
    inputPagu.style.backgroundColor = isParent ? "#f0f0f0" : "#ffffff";
    inputBlokir.style.backgroundColor = isParent ? "#f0f0f0" : "#ffffff";

    editModal.style.display = 'flex';
});

document.getElementById('btnUpdateData').onclick = function() {
    if (currentRowForEdit) {
        const cells = currentRowForEdit.querySelectorAll('td');
        const level = parseInt(currentRowForEdit.getAttribute('data-level')) || 0;
        const symbol = level > 0 ? '' : '';

        cells[1].innerHTML = `<div style="display:flex;align-items:center;"><span style="color:#808080;margin-right:5px">${symbol}</span><span>${document.getElementById('editKode').value}</span></div>`;
        cells[2].innerText = document.getElementById('editNama').value;
        
        if (level === 4) {
            cells[3].innerText = document.getElementById('editPagu').value;
            cells[4].innerText = document.getElementById('editBlokir').value;
        }

        closeAllModals();
        updateMondas();
    }
};

// --- B. MODAL RPD ---
// --- B. MODAL RPD (RENCANA PENARIKAN DANA) ---
// --- B. MODAL RPD (RENCANA PENARIKAN DANA) ---

// Pastikan variabel ini ada di lingkup global/atas
// let targetRowRPD = null; 

document.getElementById('btnRPD').addEventListener('click', () => {
    const selected = tableBody.querySelector('.row-checkbox:checked');
    if (!selected) return alert("Pilih baris!");
    
    targetRowRPD = selected.closest('tr');

    // --- LOGIKA BARU: CEK STATUS INDUK ---
    const isParent = targetRowRPD.classList.contains('is-parent');
    const btnSimpan = document.getElementById('btnUpdateRPD');
    const cells = targetRowRPD.querySelectorAll('td');
    const inputs = rpdModal.querySelectorAll('.input-bulan');
    
    // 1. Ambil nilai Pagu dan Blokir dari tabel
    const valPagu = getVal(cells[3].innerText);
    const valBlokir = getVal(cells[4].innerText);
    const valNeto = valPagu - valBlokir;

    // 2. Fungsi untuk Update Tampilan Info Bar
    const updateRPDInfoBar = () => {
        let totalRPD = 0;
        inputs.forEach(i => totalRPD += getVal(i.value));
        
        const sisa = valNeto - totalRPD;
        const infoSpans = document.querySelectorAll('#infoBarRPD span');
        
        if (infoSpans.length >= 3) {
            infoSpans[0].innerText = `PAGU: ${toRp(valNeto)}`; 
            infoSpans[1].innerText = `RPD: ${toRp(totalRPD)}`;
            infoSpans[2].innerText = `SISA: ${toRp(sisa)}`;
            infoSpans[2].style.color = sisa < 0 ? "#ff4d4d" : "#ffffff";
        }
        
        const totalInput = document.getElementById('totalRPDInput');
        if (totalInput) totalInput.value = toRp(totalRPD);
    };

    // 3. Load data & Proteksi Input
   const savedData = (targetRowRPD.dataset.rpdBulanan || "0|0|0|0|0|0|0|0|0|0|0|0").split('|');
    inputs.forEach((inp, idx) => {
        // Gunakan formatRibuan saat memasukkan nilai dari dataset ke input
        let valMurni = savedData[idx] || "0";
        inp.value = valMurni === "0" ? "" : formatRibuan(valMurni);
        
        inp.readOnly = isParent;
    inp.style.backgroundColor = isParent ? "#222" : "#fff"; // Sesuaikan tema gelap/terang
    inp.style.cursor = isParent ? "not-allowed" : "text";

    inp.oninput = function() {
        this.value = formatRibuan(this.value);
        
        // 1. Update info bar di dalam modal (Pagu & Sisa RPD)
        updateRPDInfoBar(); 
        
        // 2. Simpan sementara ke dataset baris RPD (Bukan Realisasi)
        const currentValues = Array.from(inputs).map(i => i.value || "0").join('|');
        targetRowRPD.dataset.rpdBulanan = currentValues;
        
        // 3. Masukkan total bulanan ke kolom RPD di tabel (Index 5)
        let totalBaru = Array.from(inputs).reduce((acc, curr) => acc + getVal(curr.value), 0);
        targetRowRPD.querySelectorAll('td')[5].innerText = toRp(totalBaru);
        
        // --- KUNCI REALTIME ---
        // 4. Update Hirarki (Agar Level 0 ikut berubah saat mengetik)
        updateMondas(); 
        
        // 5. Update Con1 (Monitor Screen)
        updateDashboardTotal(); 
    };
});
    // 4. KONTROL TOMBOL SIMPAN
    // Sembunyikan tombol simpan jika baris adalah induk
    if (btnSimpan) {
        btnSimpan.style.display = isParent ? "none" : "block";
    }

    // 5. Jalankan update pertama kali & tampilkan modal
    updateRPDInfoBar();
    rpdModal.style.display = 'flex';
});

// LOGIKA TOMBOL SIMPAN RPD
document.getElementById('btnUpdateRPD').onclick = function() {
    if (targetRowRPD) {
        // 1. Ambil semua input bulan di modal RPD
        const inputs = rpdModal.querySelectorAll('.input-bulan');
        
        let bulanValues = [];

        // 2. Loop tepat 12 bulan (Jan-Des)
        for (let i = 0; i < 12; i++) {
            if (inputs[i]) {
                // Ambil nilai dari kotak (misal: "1.500.000")
                // Bersihkan SEMUA karakter non-angka agar jadi murni (misal: "1500000")
                let valMurni = inputs[i].value.replace(/\D/g, "") || "0";
                
                // Masukkan ke array untuk disimpan
                bulanValues.push(valMurni);
                
                // OPSIONAL: Pastikan tampilan di kotak tetap terformat titik 
                // jika user lupa mengetik dengan benar
                if (valMurni !== "0") {
                    inputs[i].value = new Intl.NumberFormat('id-ID').format(valMurni);
                }
            } else {
                bulanValues.push("0");
            }
        }

        // 3. Simpan ke dataset sebagai string angka murni (misal: 1000000|2000000|...)
        targetRowRPD.dataset.rpdBulanan = bulanValues.join('|');
        
        // 4. Ambil Total RPD dari input total (yang biasanya sudah ada titiknya)
        const totalRPDStr = document.getElementById('totalRPDInput').value;
        
        // 5. Update tampilan kolom RPD di tabel utama (Index kolom ke-5)
        const cells = targetRowRPD.querySelectorAll('td');
        if (cells[5]) {
            cells[5].innerText = totalRPDStr; 
        }
        
        closeAllModals();
        updateMondas(); // Rekalkulasi ke baris Induk
        
        console.log("Data Berhasil Disimpan (Angka Murni):", targetRowRPD.dataset.rpdBulanan);
    }
};

// --- C. MODAL REALISASI ---
document.getElementById('btnRealisasi').addEventListener('click', () => {
    const selected = tableBody.querySelector('.row-checkbox:checked');
    if (!selected) return alert("Pilih baris!");
    
    targetRowRealisasi = selected.closest('tr');

    // --- LOGIKA STATUS INDUK ---
    const isParent = targetRowRealisasi.classList.contains('is-parent');
    const btnSimpan = document.getElementById('btnUpdateRealisasi');
    const cells = targetRowRealisasi.querySelectorAll('td');
    const inputs = realisasiModal.querySelectorAll('.input-realisasi');
    
    // 1. AMBIL NILAI RPD SEBAGAI ACUAN (PAGU)
    const valRPD = getVal(cells[5].innerText);

    // 2. AMBIL DATA UNTUK PLACEHOLDER & LOAD
    const dataRPD = (targetRowRealisasi.dataset.rpdBulanan || "0|0|0|0|0|0|0|0|0|0|0|0").split('|');
    const savedReal = (targetRowRealisasi.dataset.realisasiBulanan || "0|0|0|0|0|0|0|0|0|0|0|0").split('|');

    // 3. FUNGSI UPDATE INFO BAR (Didefinisikan di dalam agar bisa diakses oninput)
    const updateRealInfoBar = () => {
        let totalReal = 0;
        inputs.forEach(i => totalReal += getVal(i.value));
        
        const sisa = valRPD - totalReal;
        const infoSpans = document.querySelectorAll('#infoBarRealisasi span');
        
        if (infoSpans.length >= 3) {
            infoSpans[0].innerText = `RPD: ${toRp(valRPD)}`; 
            infoSpans[1].innerText = `REALISASI: ${toRp(totalReal)}`;
            infoSpans[2].innerText = `SISA: ${toRp(sisa)}`;
            infoSpans[2].style.color = sisa < 0 ? "#ff4d4d" : "#ffffff";
        }
        
        const totalInput = document.getElementById('totalRealisasiInput');
        if (totalInput) totalInput.value = toRp(totalReal);
    };

    // 4. PENGISIAN DATA & EVENT LISTENER (Hanya Satu Kali Loop)
    inputs.forEach((inp, idx) => {
        // Set Placeholder (Format Ribuan)
        let valPlaceholder = dataRPD[idx] || "0";
        inp.placeholder = valPlaceholder !== "0" ? formatRibuan(valPlaceholder) : "0";
        
        // Set Value Awal (Format Ribuan agar titik muncul saat dibuka)
        let valAwal = savedReal[idx] || "0";
        inp.value = (valAwal !== "0") ? formatRibuan(valAwal) : "";
        
        // Proteksi Input
        inp.readOnly = isParent;
        inp.style.backgroundColor = isParent ? "#f0f0f0" : "#ffffff";
        inp.style.cursor = isParent ? "not-allowed" : "text";

        // Event saat mengetik
        inp.oninput = function() {
            // A. Munculkan titik otomatis saat mengetik
            this.value = formatRibuan(this.value);
            
            // B. Update Info Bar di modal
            updateRealInfoBar(); 
            
            // C. Simpan angka murni ke dataset (REALTIME)
            const currentValues = Array.from(inputs).map(i => i.value.replace(/\D/g, "") || "0").join('|');
            targetRowRealisasi.dataset.realisasiBulanan = currentValues;
            
            // D. Update kolom Realisasi di Tabel Utama (Index 6)
            let totalBaru = Array.from(inputs).reduce((acc, curr) => acc + getVal(curr.value), 0);
            targetRowRealisasi.querySelectorAll('td')[6].innerText = toRp(totalBaru);
            
            // E. Jalankan Update Hirarki & Dashboard
            updateMondas(); 
            updateDashboardTotal(); 
        };
    });

    // 5. KONTROL TOMBOL SIMPAN
    if (btnSimpan) {
        btnSimpan.style.display = isParent ? "none" : "block";
    }

    // 6. Jalankan update info & tampilkan modal
    updateRealInfoBar();
    realisasiModal.style.display = 'flex';
});

// --- TOMBOL UPDATE/SIMPAN FINAL ---
document.getElementById('btnUpdateRealisasi').onclick = function() {
    if (targetRowRealisasi) {
        // Karena oninput sudah menyimpan ke dataset secara realtime, 
        // kita hanya perlu memastikan tampilan tabel utama sudah benar.
        const totalFinal = document.getElementById('totalRealisasiInput').value;
        targetRowRealisasi.querySelectorAll('td')[6].innerText = totalFinal;

        closeAllModals();
        updateMondas();
    }
};// =====================================================================
// 6. PENYIMPANAN & INITIALIZATION
// =====================================================================

document.getElementById('btnSave').addEventListener('click', async () => {
    const btn = document.getElementById('btnSave');
    btn.innerText = "SAVING...";
    btn.disabled = true;

    // 1. Ambil semua data dari baris tabel
    const rows = Array.from(tableBody.querySelectorAll('tr')).map((row, index) => {
        const cells = row.querySelectorAll('td');
        return {
            sort_order: index, // Penting agar urutan baris tidak berantakan
            level: parseInt(row.getAttribute('data-level')),
            rpd_bulanan: row.dataset.rpdBulanan,
            real_bulanan: row.dataset.realisasiBulanan,
            kode: cells[1].innerText.trim(),
            nama: cells[2].innerText,
            pagu: getVal(cells[3].innerText),
            blokir: getVal(cells[4].innerText),
            rpd_total: getVal(cells[5].innerText),
            real_total: getVal(cells[6].innerText)
        };
    });

    try {
        // 2. Hapus data lama di Supabase (Overwriting)
        // Note: Untuk aplikasi produksi, sebaiknya gunakan logic 'upsert'
        await _supabase.from('anggaran').delete().neq('id', 0); 

        // 3. Masukkan data baru
        const { error } = await _supabase.from('anggaran').insert(rows);
        
        if (error) throw error;
        alert("Data Berhasil Disinkronkan ke Cloud.");
    } catch (err) {
        console.error(err);
        alert("Gagal menyimpan ke Cloud: " + err.message);
    } finally {
        btn.innerText = "SAVE";
        btn.disabled = false;
    }
});
async function loadDataFromSupabase() {
    tableBody.innerHTML = "<tr><td colspan='9' class='text-center'>Memuat data dari server...</td></tr>";

    const { data, error } = await _supabase
        .from('anggaran')
        .select('*')
        .order('sort_order', { ascending: true });

    if (error) {
        alert("Gagal memuat data dari Cloud!");
        return;
    }

    tableBody.innerHTML = ""; 
    if (!data || data.length === 0) return;

    data.forEach(item => {
        const row = document.createElement('tr');
        row.setAttribute('data-level', item.level);
        row.dataset.rpdBulanan = item.rpd_bulanan;
        row.dataset.realisasiBulanan = item.real_bulanan;
        
        const padding = item.level * 15;
        
        row.innerHTML = `
            <td class="col-cb text-center"><input type="checkbox" class="row-checkbox"></td>
            <td class="col-kd" style="padding-left:${padding}px!important">
                <div style="display:flex;align-items:center;">
                    <span style="color:#808080;font-family:monospace;margin-right:5px"></span>
                    <span>${item.kode}</span>
                </div>
            </td>
            <td class="col-nm">${item.nama}</td>
            <td class="col-idr text-right">${toRp(item.pagu)}</td>
            <td class="col-idr text-right">${toRp(item.blokir)}</td>
            <td class="col-idr text-right">${toRp(item.rpd_total)}</td>
            <td class="col-idr text-right">${toRp(item.real_total)}</td>
            <td class="col-idr text-right">0</td>
            <td class="col-idr text-right">0</td>
        `;
        tableBody.appendChild(row);
    });

    updateMondas();
    updateDashboardTotal();
}
// ====================== HAPUS BARIS =========================
document.getElementById('btnDelete').addEventListener('click', () => {
    // Ambil semua baris yang tercentang
    const selectedCbs = tableBody.querySelectorAll('.row-checkbox:checked');
    
    if (selectedCbs.length === 0) return alert("Pilih baris yang ingin dihapus!");

    const confirmMsg = selectedCbs.length > 1 
        ? `Hapus ${selectedCbs.length} baris beserta cabangnya?` 
        : "Hapus baris ini beserta cabangnya?";

    if (confirm(confirmMsg)) {
        selectedCbs.forEach(cb => {
            const row = cb.closest('tr');
            if (!row) return; // Guard clause jika baris sudah terhapus oleh parent-nya

            const level = parseInt(row.getAttribute('data-level')) || 0;
            
            // Logika Hapus Cabang (Anak-anaknya):
            let nextRow = row.nextElementSibling;
            while (nextRow && (parseInt(nextRow.getAttribute('data-level')) || 0) > level) {
                let toDelete = nextRow;
                nextRow = nextRow.nextElementSibling;
                toDelete.remove();
            }

            // Hapus baris induk/dirinya sendiri
            row.remove();
        });

        // 1. Reset checkbox master (Sesuaikan ID-nya)
        const masterCb = document.getElementById('checkAllMaster');
        if (masterCb) masterCb.checked = false;

        // 2. KUNCI REALTIME: Jalankan urutan update
        // Hitung ulang hirarki dulu (Level 4 ke Level 0)
        if (typeof updateMondas === 'function') {
            updateMondas(); 
        }

        // 3. Update Dashboard Monitor (Con1) berdasarkan hasil Level 0 terbaru
        if (typeof updateDashboardTotal === 'function') {
            updateDashboardTotal();
        }
        
        // alert("Data berhasil dihapus dan dashboard diperbarui.");
    }
});
// ========== CEKLIST ALL ===========
// Menggunakan ID checkAllMaster sesuai HTML Anda
const checkAllMaster = document.getElementById('checkAllMaster');

checkAllMaster.addEventListener('change', function() {
    // Ambil semua checkbox baris yang ada di dalam tableBody
    // Pastikan checkbox di tiap baris memiliki class 'row-checkbox'
    const checkboxes = tableBody.querySelectorAll('.row-checkbox');
    
    checkboxes.forEach(cb => {
        const row = cb.closest('tr');
        // Hanya centang baris yang tidak disembunyikan (fitur search/filter)
        if (row.style.display !== 'none') {
            cb.checked = this.checked;
        }
    });
});

// Tambahan: Jika checklist baris diubah manual, sesuaikan checkbox master
// Pasang listener di tableBody agar efisien (Event Delegation)
tableBody.addEventListener('change', (e) => {
    if (e.target.classList.contains('row-checkbox')) {
        const row = e.target.closest('tr');
        if (e.target.checked) {
            row.classList.add('row-selected');
        } else {
            row.classList.remove('row-selected');
        }
    }
});

// Update juga fungsi master checkbox agar semua baris berubah warna
checkAllMaster.addEventListener('change', function() {
    const checkboxes = tableBody.querySelectorAll('.row-checkbox');
    checkboxes.forEach(cb => {
        const row = cb.closest('tr');
        if (row.style.display !== 'none') {
            cb.checked = this.checked;
            if (this.checked) row.classList.add('row-selected');
            else row.classList.remove('row-selected');
        }
    });
});
// =========== TOTAL DAS1 ===============
function updateDashboardTotal() {
    let totalPagu = 0;
    let totalBlokir = 0;
    let totalRPD = 0;
    let totalRealisasi = 0;

    // Ambil semua baris di tabel
    const rows = tableBody.querySelectorAll('tr');

    rows.forEach(row => {
        // Hanya ambil data dari baris Level 0 (Grand Total)
        if (row.getAttribute('data-level') === "0") {
            const cells = row.querySelectorAll('td');
            
            // Kolom: Pagu(3), Blokir(4), RPD(5), Realisasi(6)
            if (cells.length > 6) {
                totalPagu += getVal(cells[3].innerText);
                totalBlokir += getVal(cells[4].innerText);
                totalRPD += getVal(cells[5].innerText);
                totalRealisasi += getVal(cells[6].innerText);
            }
        }
    });

    // Render ke elemen Monitor Screen (Con1)
    const dPagu = document.getElementById('statTotalPagu');
    const dBlokir = document.getElementById('statTotalBlokir');
    const dRPD = document.getElementById('statTotalRPD');
    const dReal = document.getElementById('statTotalRealisasi');

    if (dPagu) dPagu.innerText = toRp(totalPagu);
    if (dBlokir) dBlokir.innerText = toRp(totalBlokir);
    if (dRPD) dRPD.innerText = toRp(totalRPD);
    if (dReal) dReal.innerText = toRp(totalRealisasi);
}

// Inisialisasi saat halaman siap
document.addEventListener('DOMContentLoaded', () => {
    // Muat dari Cloud, bukan localStorage
    loadDataFromSupabase();
});

// ==================== EXPORT & IMPORT ==========================
// --- FUNGSI EXPORT (JSON) ---
function handleExport() {
    const tableRows = document.querySelectorAll('#tableBody tr');
    
    // 1. Ambil data dari tabel
    const data = Array.from(tableRows).map(row => {
        const cells = row.querySelectorAll('td');
        return {
            level: row.getAttribute('data-level'),
            rpdBulanan: row.dataset.rpdBulanan || "",
            realisasiBulanan: row.dataset.realisasiBulanan || "",
            kode: cells[1].innerText.trim(),
            uraian: cells[2].innerText,
            pagu: cells[3].innerText,
            blokir: cells[4].innerText,
            rpd: cells[5].innerText,
            realisasi: cells[6].innerText
        };
    });

    if (data.length === 0) return alert("Tidak ada data untuk di-export!");

    try {
        // 2. Ubah menjadi JSON String
        const dataStr = JSON.stringify(data, null, 2);
        
        // 3. Gunakan Blob (Bukan Data URI)
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // 4. Proses Download
        const link = document.createElement('a');
        link.href = url;
        link.download = `MONDAS_DATA_${new Date().getTime()}.json`;
        
        document.body.appendChild(link);
        link.click();
        
        // 5. Bersihkan memori (Penting!)
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 150);

    } catch (error) {
        console.error("Export Gagal:", error);
        alert("Gagal mengekspor data. Ukuran data mungkin terlalu besar untuk aplikasi ini.");
    }
}
// --- FUNGSI IMPORT (JSON) ---
function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            const tableBody = document.getElementById('tableBody');
            tableBody.innerHTML = ''; // Bersihkan tabel sebelum import

            data.forEach(item => {
                const tr = document.createElement('tr');
                tr.setAttribute('data-level', item.level);
                if (item.isParent) tr.classList.add('is-parent');
                
                // Kembalikan dataset bulanan
                tr.dataset.rpdBulanan = item.rpdBulanan;
                tr.dataset.realisasiBulanan = item.realisasiBulanan;

                tr.innerHTML = `
                    <td class="col-cb"><input type="checkbox" class="row-checkbox"></td>
                    <td>${item.kode}</td>
                    <td style="padding-left: ${item.level * 20}px">${item.uraian}</td>
                    <td>${item.pagu}</td>
                    <td>${item.blokir}</td>
                    <td>${item.rpd}</td>
                    <td>${item.realisasi}</td>
                    <td>${item.sisa}</td>
                    <td>${item.persen}</td>
                `;
                tableBody.appendChild(tr);
            });

            // Update Con1 (Dashboard) & Hirarki setelah data masuk
            updateMondas();
            updateDashboardTotal();
            alert("Import Berhasil!");
        } catch (err) {
            alert("Gagal membaca file! Pastikan formatnya JSON yang benar.");
        }
    };
    reader.readAsText(file);
}

// --- EVENT LISTENERS ---
document.getElementById('btnExport').addEventListener('click', handleExport);

document.getElementById('btnImport').addEventListener('click', () => {
    // Membuat input file bayangan (hidden)
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'file';
    hiddenInput.accept = '.json';
    hiddenInput.onchange = handleImport;
    hiddenInput.click();
});
// =========== DASBOARD ===============
// Listener tetap dipertahankan (hanya isinya disesuaikan)
document.getElementById('btnDasboard').onclick = function() {
    document.getElementById('dashboardOverlay').style.display = 'flex';
    updateDashboardStats("TAHUNAN");
};

document.getElementById('btnCloseDashboard').onclick = function() {
    document.getElementById('dashboardOverlay').style.display = 'none';
};

document.getElementById('dashPeriodSelect').onchange = function() {
    updateDashboardStats(this.value);
};

// =========== DASHBOARD FIX VERSION (FINAL) ===============
function updateDashboardStats(period) {
    const rows = document.querySelectorAll('#tableBody tr');
    
    let stats = {
        peg: { rpd: 0, real: 0 },
        bar: { rpd: 0, real: 0 },
        mod: { rpd: 0, real: 0 },
        rm:  { rpd: 0, real: 0 },
        pnp: { rpd: 0, real: 0 }
    };

    rows.forEach((row) => {
        const level = row.getAttribute('data-level');
        // Tetap hanya memproses Level 3 sesuai struktur hirarki Anda
        if (level !== "3") return;

        // --- 1. AMBIL KODE MURNI & BERSIHKAN ---
        const cellKode = row.cells[1].querySelectorAll('span');
        // Mengambil teks kode, diubah ke Uppercase dan hapus spasi
        let kodeFull = (cellKode.length > 1 ? cellKode[1].innerText : row.cells[1].innerText).trim().toUpperCase();

        let vRPD = 0;
        let vReal = 0;

        // --- 2. AMBIL NILAI BERDASARKAN PERIODE ---
        if (period === "TAHUNAN") {
            vRPD = getVal(row.cells[5].innerText);
            vReal = getVal(row.cells[6].innerText);
        } else {
            const pIdx = parseInt(period);
            const strRPD = row.dataset.rpdBulanan || "0|0|0|0|0|0|0|0|0|0|0|0";
            const strReal = row.dataset.realisasiBulanan || "0|0|0|0|0|0|0|0|0|0|0|0";
            
            const arrRPD = strRPD.split('|');
            const arrReal = strReal.split('|');
            
            vRPD = getVal(arrRPD[pIdx]);
            vReal = getVal(arrReal[pIdx]);
        }

        // --- 3. FILTER JENIS BELANJA (Berdasarkan 2 Angka Depan Kode) ---
        if (kodeFull.startsWith("51")) { 
            stats.peg.rpd += vRPD; stats.peg.real += vReal; 
        } else if (kodeFull.startsWith("52")) { 
            stats.bar.rpd += vRPD; stats.bar.real += vReal; 
        } else if (kodeFull.startsWith("53")) { 
            stats.mod.rpd += vRPD; stats.mod.real += vReal; 
        }

        // --- 4. FILTER SUMBER DANA (Berdasarkan Huruf Belakang Kode: R atau P) ---
        if (kodeFull.endsWith("R")) { 
            // Contoh kode: 512345R
            stats.rm.rpd += vRPD; 
            stats.rm.real += vReal; 
        } 
        else if (kodeFull.endsWith("P")) { 
            // Contoh kode: 521111P
            stats.pnp.rpd += vRPD; 
            stats.pnp.real += vReal; 
        }
    });

    // --- 5. RENDER KE DASHBOARD ---
    const renderRow = (idPrefix, data) => {
        const sisa = data.rpd - data.real;
        const prs = data.rpd > 0 ? Math.round(data.real / data.rpd * 100) : "0";
        
        const elRPD = document.getElementById(idPrefix + "_RPD");
        const elReal = document.getElementById(idPrefix + "_Real");
        const elSisa = document.getElementById(idPrefix + "_Sisa");
        const elPersen = document.getElementById(idPrefix + "_Persen");

        if (elRPD) elRPD.innerText = toRp(data.rpd);
        if (elReal) elReal.innerText = toRp(data.real);
        if (elSisa) elSisa.innerText = toRp(sisa);
        if (elPersen) elPersen.innerText = prs + "%";
    };

    // Render baris demi baris
    renderRow("dashPeg", stats.peg);
    renderRow("dashBar", stats.bar);
    renderRow("dashMod", stats.mod);
    renderRow("dashRM", stats.rm);
    renderRow("dashPNBP", stats.pnp);

    // --- 6. HITUNG & RENDER SUB-TOTAL ---
    const tJenis = { 
        rpd: stats.peg.rpd + stats.bar.rpd + stats.mod.rpd, 
        real: stats.peg.real + stats.bar.real + stats.mod.real 
    };
    const tSumber = {
        rpd: stats.rm.rpd + stats.pnp.rpd,
        real: stats.rm.real + stats.pnp.real
    };

    renderRow("subTotalJenis", tJenis);
    renderRow("subTotalSumber", tSumber);

    // --- 7. UPDATE MONITOR UTAMA ---
    if (document.getElementById("dashRPD")) document.getElementById("dashRPD").innerText = toRp(tJenis.rpd);
    if (document.getElementById("dashReal")) document.getElementById("dashReal").innerText = toRp(tJenis.real);
}
// ====================

// Fitur: Klik di mana saja pada baris untuk centang
tableBody.addEventListener('click', function(e) {
    // 1. Cari elemen TR terdekat dari yang diklik
    const row = e.target.closest('tr');
    if (!row) return;

    // 2. Pengecualian: Jika yang diklik adalah input checkbox itu sendiri, 
    // biarkan fungsi asli checkbox yang bekerja (jangan di-toggle lagi)
    if (e.target.classList.contains('row-checkbox')) {
        return; 
    }

    // 3. Ambil checkbox di baris tersebut
    const cb = row.querySelector('.row-checkbox');
    if (cb) {
        // Toggle status centang (jika true jadi false, jika false jadi true)
        cb.checked = !cb.checked;

        // Pemicu event 'change' secara manual agar sistem warna (row-selected) 
        // dan proteksi tombol yang kita buat sebelumnya tetap jalan
        cb.dispatchEvent(new Event('change', { bubbles: true }));
    }
});

