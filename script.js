// =====================================================================
// 1. KONSTRUKTOR & SUPABASE CONFIG
// =====================================================================
const { createClient } = supabase;
const _supabase = createClient('https://ldkefnlnpgwgxznemzol.supabase.co', 'sb_publishable_VG1TQwsg40s9ngumFAy-CQ_ORaBQKHG');
// =====================================================================
// 1. KONSTRUKTOR & VARIABEL GLOBAL
// =====================================================================
let debounceTimer;
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
    // Menggunakan .cells untuk performa akses DOM maksimal
    const c = row.cells;
    
    // 1. Ambil nilai dasar dari kolom-kolom terkait
    const pagu      = getVal(c[3].textContent); // Index 3: Pagu
    const blokir    = getVal(c[4].textContent); // Index 4: Blokir
    const realisasi = getVal(c[6].textContent); // Index 6: Realisasi

    // 2. LOGIKA BARU: Sisa = Pagu - Blokir - Realisasi
    const sisa = pagu - realisasi;

    // 3. Render kembali ke tabel
    c[7].textContent = toRp(realisasi); // Kolom Total = Realisasi
    c[8].textContent = toRp(sisa);      // Kolom Sisa = Hasil hitung baru

    // 4. Feedback visual jika sisa negatif (Over Budget)
    if (sisa < 0) {
        c[8].style.color = "#ff0000";
        c[8].style.fontWeight = "bold";
    } else {
        c[8].style.color = "#000000";
        c[8].style.fontWeight = "normal";
    }
}
/**
 * Mengupdate akumulasi nilai hirarki dari bawah ke atas.
 * Optimasi: Menggunakan caching koleksi baris dan meminimalkan query DOM.
 */
function updateMondas() {
    const rows = Array.from(tableBody.rows);
    const rowCount = rows.length;
    if (rowCount === 0) return;

    // Loop Bottom-Up: Penting agar nilai anak naik ke cucu, lalu ke induk
    for (let i = rowCount - 1; i >= 0; i--) {
        const row = rows[i];
        const level = parseInt(row.getAttribute('data-level')) || 0;
        const cells = row.cells; 

        // Optimasi: Cek apakah baris ini memiliki anak
        const nextRow = rows[i + 1];
        const hasChild = (nextRow && (parseInt(nextRow.getAttribute('data-level')) || 0) > level);

        if (hasChild) {
            let sums = { pagu: 0, blokir: 0, rpd: 0, real: 0 };
            let monthlyRPD = new Array(12).fill(0);
            let monthlyReal = new Array(12).fill(0);

            // Scan anak-anak langsung (Level + 1)
            for (let j = i + 1; j < rowCount; j++) {
                const child = rows[j];
                const childLv = parseInt(child.getAttribute('data-level')) || 0;

                if (childLv <= level) break; // Keluar dari grup jika level kembali setara/kecil

                if (childLv === level + 1) {
                    const c = child.cells;
                    
                    // Akumulasi Total
                    sums.pagu   += getVal(c[3].textContent);
                    sums.blokir += getVal(c[4].textContent);
                    sums.rpd    += getVal(c[5].textContent);
                    sums.real   += getVal(c[6].textContent);

                    // Akumulasi Bulanan (Dataset)
                    const cRPDArr = (child.dataset.rpdBulanan || "").split('|');
                    const cRealArr = (child.dataset.realisasiBulanan || "").split('|');

                    for (let m = 0; m < 12; m++) {
                        monthlyRPD[m] += Number(cRPDArr[m]) || 0;
                        monthlyReal[m] += Number(cRealArr[m]) || 0;
                    }
                }
            }

            // Update UI Induk
            cells[3].textContent = toRp(sums.pagu);
            cells[4].textContent = toRp(sums.blokir);
            cells[5].textContent = toRp(sums.rpd);
            cells[6].textContent = toRp(sums.real);

            // Simpan hasil akumulasi ke dataset induk
            row.dataset.rpdBulanan = monthlyRPD.join('|');
            row.dataset.realisasiBulanan = monthlyReal.join('|');
            row.classList.add('is-parent');
        } else {
            row.classList.remove('is-parent');
        }

        // Jalankan kalkulasi sisa/total (Pagu - Realisasi)
        calculateRowTotal(row);
    }

    // Update Dashboard Monitor
    if (typeof updateDashboardTotal === 'function') {
        updateDashboardTotal();
    }
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
        // 1. Gunakan .cells (lebih cepat daripada querySelectorAll)
        const c = currentRowForEdit.cells;
        const level = parseInt(currentRowForEdit.getAttribute('data-level')) || 0;
        const symbol = level > 0 ? '' : '';

        // 2. Update Kode (Gunakan innerHTML karena ada struktur div/span)
        const kodeVal = document.getElementById('editKode').value;
        c[1].innerHTML = `
            <div style="display:flex; align-items:center;">
                <span style="color:#808080; margin-right:5px">${symbol}</span>
                <span>${kodeVal}</span>
            </div>`;

        // 3. Update Nama (Gunakan textContent untuk keamanan)
        c[2].textContent = document.getElementById('editNama').value;
        
        // 4. Update Nilai (Hanya jika Level 4 / Bukan Induk)
        if (level === 4) {
            // Pastikan nilai yang masuk ke tabel tetap terformat (misal: 1.000.000)
            // agar getVal() nanti bisa memprosesnya dengan benar
            c[3].textContent = document.getElementById('editPagu').value || "0";
            c[4].textContent = document.getElementById('editBlokir').value || "0";
        }

        // 5. Finalisasi
        closeAllModals();
        
        // PENTING: Jalankan updateMondas agar perubahan di Level 4 
        // langsung naik ke induk Level 3, 2, 1, dan 0
        updateMondas();
        
        // Opsional: Tandai data telah berubah (jika menggunakan fitur dirty state)
        if (typeof markDirty === 'function') markDirty();
    }
};

// --- B. MODAL RPD ---
document.getElementById('btnRPD').addEventListener('click', () => {
    const selected = tableBody.querySelector('.row-checkbox:checked');
    if (!selected) return alert("Pilih baris!");
    
    targetRowRPD = selected.closest('tr');

    const isParent = targetRowRPD.classList.contains('is-parent');
    const btnSimpan = document.getElementById('btnUpdateRPD');
    const c = targetRowRPD.cells; 
    const inputs = rpdModal.querySelectorAll('.input-bulan');
    
    // 1. Ambil nilai Pagu murni (Tanpa dikurangi blokir)
    // Sesuai instruksi: RPD menyesuaikan nilai Pagu murni (Kolom index 3)
    const valPaguMurni = getVal(c[3].textContent);

    // 2. Fungsi Internal untuk Update Tampilan Info Bar & Total Input
    const updateRPDInfoBar = () => {
        let totalRPD = 0;
        inputs.forEach(i => totalRPD += getVal(i.value));
        
        // Sisa dihitung dari Pagu Murni - Total RPD yang diinput
        const sisa = valPaguMurni - totalRPD;
        const infoSpans = document.querySelectorAll('#infoBarRPD span');
        
        if (infoSpans.length >= 3) {
            infoSpans[0].textContent = `PAGU: ${toRp(valPaguMurni)}`; 
            infoSpans[1].textContent = `RPD: ${toRp(totalRPD)}`;
            infoSpans[2].textContent = `SISA: ${toRp(sisa)}`; // Menggunakan istilah Selisih/Sisa RPD
            infoSpans[2].style.color = sisa < 0 ? "#ff4d4d" : "#ffffff";
            infoSpans[2].style.fontWeight = sisa < 0 ? "bold" : "normal";
        }
        
        const totalInput = document.getElementById('totalRPDInput');
        if (totalInput) totalInput.value = toRp(totalRPD);
    };

    // 3. Load data & Pasang Event Listener ke Input
    const savedData = (targetRowRPD.dataset.rpdBulanan || "0|0|0|0|0|0|0|0|0|0|0|0").split('|');
    
    inputs.forEach((inp, idx) => {
        let valMurni = savedData[idx] || "0";
        inp.value = (valMurni === "0" || valMurni === "") ? "" : formatRibuan(valMurni);
        
        // Proteksi Input (Readonly jika baris induk)
        inp.readOnly = isParent;
        inp.style.backgroundColor = isParent ? "#2d2d2d" : "#ffffff"; 
        inp.style.cursor = isParent ? "not-allowed" : "text";

        // Logic Input Real-time
        inp.oninput = function() {
            // A. Feedback Visual Langsung
            this.value = formatRibuan(this.value);
            updateRPDInfoBar(); 

            if (isParent) return;

            // B. Debounce: Update Tabel Utama & Hirarki
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                // 1. Simpan angka murni ke dataset
                const murniArr = Array.from(inputs).map(i => i.value.replace(/\D/g, "") || "0");
                targetRowRPD.dataset.rpdBulanan = murniArr.join('|');
                
                // 2. Update kolom RPD di tabel (Kolom index 5)
                const totalBaru = murniArr.reduce((acc, curr) => acc + parseInt(curr), 0);
                c[5].textContent = toRp(totalBaru);
                
                // 3. Jalankan Rekalkulasi Hirarki (Update level di atasnya & Sisa Anggaran)
                updateMondas(); 
            }, 500);
        };
    });

    // 4. Kontrol Tombol Simpan
    if (btnSimpan) {
        btnSimpan.style.display = isParent ? "none" : "block";
        btnSimpan.onclick = () => {
            closeAllModals();
            updateMondas();
        };
    }

    // 5. Inisialisasi tampilan awal modal
    updateRPDInfoBar();
    rpdModal.style.display = 'flex';
});
// --- C. MODAL REALISASI ---
document.getElementById('btnRealisasi').addEventListener('click', () => {
    const selected = tableBody.querySelector('.row-checkbox:checked');
    if (!selected) return alert("Pilih baris!");
    
    targetRowRealisasi = selected.closest('tr');

    const isParent = targetRowRealisasi.classList.contains('is-parent');
    const btnSimpan = document.getElementById('btnUpdateRealisasi');
    const c = targetRowRealisasi.cells; // Menggunakan properti .cells (Performa Tinggi)
    const inputs = realisasiModal.querySelectorAll('.input-realisasi');
    
    // 1. Ambil nilai RPD sebagai acuan plafon realisasi (Kolom index 5)
    const valRPD = getVal(c[5].textContent);

    // 2. Load Data Dataset
    const dataRPD = (targetRowRealisasi.dataset.rpdBulanan || "0|0|0|0|0|0|0|0|0|0|0|0").split('|');
    const savedReal = (targetRowRealisasi.dataset.realisasiBulanan || "0|0|0|0|0|0|0|0|0|0|0|0").split('|');

    // 3. Fungsi Update Info Bar Modal
    const updateRealInfoBar = () => {
        let totalReal = 0;
        inputs.forEach(i => totalReal += getVal(i.value));
        
        const sisa = valRPD - totalReal;
        const infoSpans = document.querySelectorAll('#infoBarRealisasi span');
        
        if (infoSpans.length >= 3) {
            infoSpans[0].textContent = `RPD: ${toRp(valRPD)}`; 
            infoSpans[1].textContent = `REALISASI: ${toRp(totalReal)}`;
            infoSpans[2].textContent = `SISA: ${toRp(sisa)}`;
            infoSpans[2].style.color = sisa < 0 ? "#ff4d4d" : "#ffffff";
            infoSpans[2].style.fontWeight = sisa < 0 ? "bold" : "normal";
        }
        
        const totalInput = document.getElementById('totalRealisasiInput');
        if (totalInput) totalInput.value = toRp(totalReal);
    };

    // 4. Inisialisasi Input & Event Listener
    inputs.forEach((inp, idx) => {
        // Placeholder dari RPD bulan tersebut
        let valPlaceholder = dataRPD[idx] || "0";
        inp.placeholder = valPlaceholder !== "0" ? formatRibuan(valPlaceholder) : "0";
        
        // Nilai awal dari dataset Realisasi
        let valAwal = savedReal[idx] || "0";
        inp.value = (valAwal !== "0" && valAwal !== "") ? formatRibuan(valAwal) : "";
        
        // Proteksi jika baris induk
        inp.readOnly = isParent;
        inp.style.backgroundColor = isParent ? "#f0f0f0" : "#ffffff";
        inp.style.cursor = isParent ? "not-allowed" : "text";

        // Logic Input Real-time (Debounce)
        inp.oninput = function() {
            // Feedback instan di modal
            this.value = formatRibuan(this.value);
            updateRealInfoBar(); 

            if (isParent) return;

            // Debounce untuk kalkulasi berat di tabel utama
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                // A. Simpan angka murni ke dataset
                const murniArr = Array.from(inputs).map(i => i.value.replace(/\D/g, "") || "0");
                targetRowRealisasi.dataset.realisasiBulanan = murniArr.join('|');
                
                // B. Update kolom Realisasi di tabel (Kolom index 6)
                const totalBaru = murniArr.reduce((acc, curr) => acc + parseInt(curr), 0);
                c[6].textContent = toRp(totalBaru);
                
                // C. Jalankan Update Hirarki & Dashboard
                updateMondas(); 
            }, 500);
        };
    });

    // 5. Kontrol Tombol Simpan
    if (btnSimpan) {
        btnSimpan.style.display = isParent ? "none" : "block";
        btnSimpan.onclick = function() {
            // Karena sudah tersimpan via oninput, cukup tutup modal
            closeAllModals();
            updateMondas(); // Pastikan sinkronisasi final
        };
    }

    // Tampilkan modal
    updateRealInfoBar();
    realisasiModal.style.display = 'flex';
});
// =====================================================================
// 6. PENYIMPANAN & INITIALIZATION
// =====================================================================
document.getElementById('btnSave').addEventListener('click', async () => {
    const btn = document.getElementById('btnSave');
    const originalText = btn.innerText;
    
    // 1. UI Feedback & Validasi
    btn.innerText = "SAVING...";
    btn.disabled = true;

    try {
        // 2. Ekstraksi Data (Sangat Efisien)
        const rowsToSave = Array.from(tableBody.rows).map((row, index) => {
            const c = row.cells;
            return {
                sort_order: index,
                level: parseInt(row.getAttribute('data-level')) || 0,
                rpd_bulanan: row.dataset.rpdBulanan || "0|0|0|0|0|0|0|0|0|0|0|0",
                real_bulanan: row.dataset.realisasiBulanan || "0|0|0|0|0|0|0|0|0|0|0|0",
                kode: c[1].textContent.trim(),
                nama: c[2].textContent.trim(),
                pagu: getVal(c[3].textContent),
                blokir: getVal(c[4].textContent),
                rpd_total: getVal(c[5].textContent),
                real_total: getVal(c[6].textContent)
            };
        });

        if (rowsToSave.length === 0) throw new Error("Tidak ada data untuk disimpan.");

        // 3. Eksekusi Supabase
        // Strategi: Hapus semua data berdasarkan range sort_order agar lebih universal
        const { error: deleteError } = await _supabase
            .from('anggaran')
            .delete()
            .gt('sort_order', -1); // Menghapus semua yang indexnya >= 0

        if (deleteError) throw deleteError;

        // Insert Bulk (Supabase otomatis menangani batching jika data besar)
        const { error: insertError } = await _supabase
            .from('anggaran')
            .insert(rowsToSave);

        if (insertError) throw insertError;

        // 4. Sukses
        alert("✅ Data Berhasil Disinkronkan ke Cloud.");

    } catch (err) {
        console.error("Save Error:", err);
        alert(`❌ Gagal menyimpan: ${err.message || "Terjadi kesalahan koneksi"}`);
    } finally {
        // 5. Kembalikan State UI
        btn.innerText = originalText;
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
    // 1. Gunakan selektor spesifik untuk hanya mengambil baris Level 0
    // Ini jauh lebih cepat daripada meloop SEMUA baris
    const topLevelRows = tableBody.querySelectorAll('tr[data-level="0"]');
    
    let totals = { pagu: 0, blokir: 0, rpd: 0, real: 0 };

    // 2. Kalkulasi Batch
    topLevelRows.forEach(row => {
        const c = row.cells; // Menggunakan .cells jauh lebih cepat dari querySelectorAll('td')
        
        if (c.length > 6) {
            totals.pagu   += getVal(c[3].textContent);
            totals.blokir += getVal(c[4].textContent);
            totals.rpd    += getVal(c[5].textContent);
            totals.real   += getVal(c[6].textContent);
        }
    });

    // 3. Render Batch (Cek elemen sekaligus)
    // Gunakan textContent untuk performa render yang lebih ringan
    const elements = {
        'statTotalPagu': totals.pagu,
        'statTotalBlokir': totals.blokir,
        'statTotalRPD': totals.rpd,
        'statTotalRealisasi': totals.real
    };

    for (const [id, value] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) {
            const formatted = toRp(value);
            // Hanya update DOM jika nilainya berubah (mencegah flickering)
            if (el.textContent !== formatted) {
                el.textContent = formatted;
            }
        }
    }
}

// Inisialisasi yang lebih bersih
document.addEventListener('DOMContentLoaded', () => {
    // Jalankan fungsi load data
    if (typeof loadDataFromSupabase === 'function') {
        loadDataFromSupabase();
    }
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
window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
        e.preventDefault();
        e.returnValue = 'Anda memiliki perubahan yang belum disimpan. Yakin ingin keluar?';
    }
});

// Reset status dirty saat berhasil save
// (Tambahkan ini di dalam blok 'try' pada fungsi btnSave setelah alert sukses)
isDirty = false;
btn.style.backgroundColor = ""; // Reset warna tombol

