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
    // KODE BARU (Cek jumlah yang dicentang)
    const selectedCbs = tableBody.querySelectorAll('.row-checkbox:checked');

    if (selectedCbs.length === 0) {
        return alert("Pilih satu baris!");
    }
    if (selectedCbs.length > 1) {
        return alert("Gagal: Anda memilih " + selectedCbs.length + " baris. Silakan pilih satu baris saja untuk fitur ini.");
    }
    // Jika lolos validasi, definisikan 'selected' untuk dipakai kode di bawahnya
    const selected = selectedCbs[0];
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

// --- B. MODAL RPD (FIXED VALIDASI SINGLE SELECT) ---
document.getElementById('btnRPD').addEventListener('click', () => {
    // 1. Ambil SEMUA checkbox yang dicentang
    const selectedCbs = tableBody.querySelectorAll('.row-checkbox:checked');
    
    // 2. Validasi: Harus ada yang dipilih
    if (selectedCbs.length === 0) {
        return alert("Pilih satu baris untuk mengisi RPD!");
    }
    
    // 3. Validasi: Tidak boleh lebih dari satu
    if (selectedCbs.length > 1) {
        return alert("Maaf, input RPD hanya bisa dilakukan satu per satu. Anda memilih " + selectedCbs.length + " baris.");
    }

    // 4. Jika lolos, ambil baris pertama (index 0)
    const selected = selectedCbs[0];
    targetRowRPD = selected.closest('tr');

    // ... sisa kode RPD Anda ke bawah (isParent, valPaguMurni, dll) tetap sama ...
    targetRowRPD = selected.closest('tr');

    const isParent = targetRowRPD.classList.contains('is-parent');
    const btnSimpan = document.getElementById('btnUpdateRPD');
    const c = targetRowRPD.cells; 
    const inputs = rpdModal.querySelectorAll('.input-bulan');
    const valPaguMurni = getVal(c[3].textContent);

    // 1. Fungsi Update Info Bar (Hanya merubah tampilan modal, bukan tabel utama)
    const updateRPDInfoBar = () => {
        let totalRPD = 0;
        inputs.forEach(i => totalRPD += getVal(i.value));
        
        const sisa = valPaguMurni - totalRPD;
        const infoSpans = document.querySelectorAll('#infoBarRPD span');
        
        if (infoSpans.length >= 3) {
            infoSpans[0].textContent = `PAGU: ${toRp(valPaguMurni)}`; 
            infoSpans[1].textContent = `RPD: ${toRp(totalRPD)}`;
            infoSpans[2].textContent = `SISA: ${toRp(sisa)}`;
            infoSpans[2].style.color = sisa < 0 ? "#ff4d4d" : "#ffffff";
            infoSpans[2].style.fontWeight = sisa < 0 ? "bold" : "normal";
        }
        
        const totalInput = document.getElementById('totalRPDInput');
        if (totalInput) totalInput.value = toRp(totalRPD);
    };

    // 2. Load Data Awal ke Input Modal
    const savedData = (targetRowRPD.dataset.rpdBulanan || "0|0|0|0|0|0|0|0|0|0|0|0").split('|');
    
    inputs.forEach((inp, idx) => {
        let valMurni = savedData[idx] || "0";
        inp.value = (valMurni === "0" || valMurni === "") ? "" : formatRibuan(valMurni);
        
        inp.readOnly = isParent;
        inp.style.backgroundColor = isParent ? "#2d2d2d" : "#ffffff"; 
        inp.style.cursor = isParent ? "not-allowed" : "text";

        // Logic Input: Hanya update visual modal
        inp.oninput = function() {
            this.value = formatRibuan(this.value);
            updateRPDInfoBar(); 
            // DEBOUNCE AUTO-SAVE DIHAPUS AGAR TIDAK TERUPDATE KE TABEL SEBELUM DISIMPAN
        };
    });

    // 3. Kontrol Tombol Simpan (Proses Penulisan ke Tabel dilakukan di sini)
    if (btnSimpan) {
        btnSimpan.style.display = isParent ? "none" : "block";
        
        // Gunakan onclick eksplisit untuk memastikan data lama tidak terbawa
        btnSimpan.onclick = () => {
            // A. Ambil data dari input modal
            const murniArr = Array.from(inputs).map(i => i.value.replace(/\D/g, "") || "0");
            const totalBaru = murniArr.reduce((acc, curr) => acc + parseInt(curr), 0);

            // B. Simpan ke dataset baris tabel
            targetRowRPD.dataset.rpdBulanan = murniArr.join('|');
            
            // C. Update tampilan kolom RPD di tabel utama (Index 5)
            c[5].textContent = toRp(totalBaru);
            
            // D. Jalankan rekalkulasi hirarki
            updateMondas(); 
            updateDashboardTotal();
            
            closeAllModals();
        };
    }

    // 4. Inisialisasi tampilan modal
    updateRPDInfoBar();
    rpdModal.style.display = 'flex';
});
// --- C. MODAL REALISASI (FIXED: NO AUTO-SAVE ON CANCEL) ---
document.getElementById('btnRealisasi').addEventListener('click', () => {
  // Cek semua baris yang tercentang
    const selectedCbs = tableBody.querySelectorAll('.row-checkbox:checked');
    
    // Validasi: Harus ada dan hanya boleh satu
    if (selectedCbs.length === 0) return alert("Pilih satu baris!");
    if (selectedCbs.length > 1) return alert(`Pilih hanya satu baris (Anda memilih ${selectedCbs.length})`);
    
    // Jika valid, ambil baris tersebut
    const targetRowRealisasi = selectedCbs[0].closest('tr');
    
    const isParent = targetRowRealisasi.classList.contains('is-parent');
    const btnSimpan = document.getElementById('btnUpdateRealisasi');
    const c = targetRowRealisasi.cells; 
    const inputs = realisasiModal.querySelectorAll('.input-realisasi');
    // 1. Ambil nilai RPD sebagai acuan plafon realisasi (Kolom index 5)
    const valRPD = getVal(c[5].textContent);

    // 2. Load Data Dataset
    const dataRPD = (targetRowRealisasi.dataset.rpdBulanan || "0|0|0|0|0|0|0|0|0|0|0|0").split('|');
    const savedReal = (targetRowRealisasi.dataset.realisasiBulanan || "0|0|0|0|0|0|0|0|0|0|0|0").split('|');

    // 3. Fungsi Update Info Bar Modal (Hanya Visual Modal)
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

        // Logic Input: Hanya update visual modal
        inp.oninput = function() {
            this.value = formatRibuan(this.value);
            updateRealInfoBar(); 
            // AUTO-SAVE (DEBOUNCE) DIHAPUS AGAR DATA TIDAK MASUK SAAT CANCEL
        };
    });

    // 5. Kontrol Tombol Simpan (Penyimpanan dilakukan HANYA di sini)
    if (btnSimpan) {
        btnSimpan.style.display = isParent ? "none" : "block";
        btnSimpan.onclick = function() {
            // A. Ambil angka murni dari input modal
            const murniArr = Array.from(inputs).map(i => i.value.replace(/\D/g, "") || "0");
            const totalBaru = murniArr.reduce((acc, curr) => acc + parseInt(curr), 0);

            // B. Simpan ke dataset baris tabel
            targetRowRealisasi.dataset.realisasiBulanan = murniArr.join('|');
            
            // C. Update kolom Realisasi di tabel utama (Index 6)
            c[6].textContent = toRp(totalBaru);
            
            // D. Jalankan Rekalkulasi Hirarki & Dashboard
            updateMondas(); 
            updateDashboardTotal();
            
            closeAllModals();
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
    // 1. Ambil baris Level 0 (Grand Total)
    const topLevelRows = tableBody.querySelectorAll('tr[data-level="0"]');
    
    let totals = { pagu: 0, blokir: 0, rpd: 0, real: 0 };

    // 2. Kalkulasi Batch
    topLevelRows.forEach(row => {
        const c = row.cells; 
        if (c.length > 6) {
            totals.pagu   += getVal(c[3].textContent);
            totals.blokir += getVal(c[4].textContent);
            totals.rpd    += getVal(c[5].textContent);
            totals.real   += getVal(c[6].textContent);
        }
    });

    // --- HITUNG PERSENTASE (Tambahan agar tidak 0) ---
    // Rumus: Realisasi / RPD * 100
    const prsTotal = totals.rpd > 0 ? (totals.real / totals.rpd * 100) : 0;

    // 3. Render Batch (Ditambah target dashPersen)
    const elements = {
        'statTotalPagu': toRp(totals.pagu),
        'statTotalBlokir': toRp(totals.blokir),
        'statTotalRPD': toRp(totals.rpd),
        'statTotalRealisasi': toRp(totals.real),
        'dashPersen': prsTotal.toFixed(2) + "%" // Sesuai ID HTML Anda
    };

    for (const [id, value] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) {
            // Hanya update DOM jika nilainya berubah
            if (el.textContent !== value) {
                el.textContent = value;

                // Tambahan: Warna hijau neon untuk teks persentase
                if (id === 'dashPersen') {
                    el.style.color = (prsTotal > 0) ? "#0f0" : "#fff";
                }
            }
        }
    }
}
document.addEventListener('DOMContentLoaded', () => {
    // 1. Inisialisasi Load Data
    if (typeof loadDataFromSupabase === 'function') {
        loadDataFromSupabase();
    }

    // 2. Pencarian Ringan dengan Debounce
    const searchInput = document.getElementById('tableSearch');
    let searchTimer; // Variabel untuk menampung jeda waktu

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const filter = this.value.toUpperCase().trim();
            
            // Hapus timer sebelumnya (mencegah proses bertumpuk saat mengetik cepat)
            clearTimeout(searchTimer);

            // Jalankan pencarian HANYA setelah berhenti mengetik selama 300ms
            searchTimer = setTimeout(() => {
                const rows = document.querySelectorAll('#tableBody tr');
                
                // Gunakan requestAnimationFrame agar render lebih smooth bagi browser
                window.requestAnimationFrame(() => {
                    rows.forEach(row => {
                        const cellKode = row.cells[1] ? row.cells[1].innerText.toUpperCase() : "";
                        const cellNama = row.cells[2] ? row.cells[2].innerText.toUpperCase() : "";

                        if (filter === "" || cellKode.includes(filter) || cellNama.includes(filter)) {
                            row.style.display = ""; 
                        } else {
                            row.style.display = "none"; 
                        }
                    });
                });
                console.log("Pencarian dijalankan untuk: " + filter);
            }, 300); 
        });
    }
});

// =========== DASBOARD ===============
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
        // Hanya memproses Level 3 (Detail Kategori)
        if (level !== "3") return;

        // Ambil Kode Murni (Menangani struktur span di dalam cell)
        const cellKode = row.cells[1].querySelectorAll('span');
        let kodeFull = (cellKode.length > 1 ? cellKode[1].innerText : row.cells[1].innerText).trim().toUpperCase();

        let vRPD = 0;
        let vReal = 0;

        // Penentuan Nilai berdasarkan Periode (Tahunan vs Bulanan)
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

        // Filter Jenis Belanja (Berdasarkan 2 angka depan kode)
        if (kodeFull.startsWith("51")) { 
            stats.peg.rpd += vRPD; stats.peg.real += vReal; 
        } else if (kodeFull.startsWith("52")) { 
            stats.bar.rpd += vRPD; stats.bar.real += vReal; 
        } else if (kodeFull.startsWith("53")) { 
            stats.mod.rpd += vRPD; stats.mod.real += vReal; 
        }

        // Filter Sumber Dana (Berdasarkan huruf terakhir kode)
        if (kodeFull.endsWith("R")) { 
            stats.rm.rpd += vRPD; stats.rm.real += vReal; 
        } else if (kodeFull.endsWith("P")) { 
            stats.pnp.rpd += vRPD; stats.pnp.real += vReal; 
        }
    });

    // RENDERER UNTUK BARIS DETAIL DASHBOARD
    const renderRow = (idPrefix, data) => {
        const sisa = data.rpd - data.real;
        const prs = data.rpd > 0 ? (data.real / data.rpd * 100) : 0;
        
        const elRPD = document.getElementById(idPrefix + "_RPD");
        const elReal = document.getElementById(idPrefix + "_Real");
        const elSisa = document.getElementById(idPrefix + "_Sisa");
        const elPersen = document.getElementById(idPrefix + "_Persen");

        if (elRPD) elRPD.innerText = toRp(data.rpd);
        if (elReal) elReal.innerText = toRp(data.real);
        if (elSisa) elSisa.innerText = toRp(sisa);
        
        if (elPersen) {
            elPersen.innerText = (prs === 0 ? "0" : prs.toFixed(2)) + "%";
            // Feedback warna baris detail
            if (prs > 105) elPersen.style.color = "#ff4d4d";
            else if (prs > 0) elPersen.style.color = "#0f100f";
            else elPersen.style.color = "";
        }
    };

    // Render baris kategori bawah
    renderRow("dashPeg", stats.peg);
    renderRow("dashBar", stats.bar);
    renderRow("dashMod", stats.mod);
    renderRow("dashRM", stats.rm);
    renderRow("dashPNBP", stats.pnp);

    // --- UPDATE MONITOR UTAMA (ATAS) ---
    const tTotalRPD = stats.peg.rpd + stats.bar.rpd + stats.mod.rpd;
    const tTotalReal = stats.peg.real + stats.bar.real + stats.mod.real;

    const mRPD = document.getElementById("dashRPD");
    const mReal = document.getElementById("dashReal");
    // ID DI BAWAH INI HARUS 'dashPersen' AGAR COCOK DENGAN HTML ANDA
    const mPersen = document.getElementById("dashPersen"); 

    if (mRPD) mRPD.innerText = toRp(tTotalRPD);
    if (mReal) mReal.innerText = toRp(tTotalReal);
    
    if (mPersen) {
        const totalPrs = tTotalRPD > 0 ? (tTotalReal / tTotalRPD * 100) : 0;
        mPersen.innerText = totalPrs.toFixed(2) + "%";
        
        // Warna Neon Green di Monitor Hitam
        if (totalPrs > 105) mPersen.style.color = "#ff4d4d"; // Merah jika over
        else if (totalPrs > 0) mPersen.style.color = "#0f0"; // Hijau neon
        else mPersen.style.color = "#fff"; // Putih jika 0
    }
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

// ======= KOLOM PENCARIAN ===========
document.getElementById('tableSearch').addEventListener('input', function() {
    const filter = this.value.toUpperCase();
    const rows = document.querySelectorAll('#tableBody tr');

    rows.forEach(row => {
        // Kita cek kolom Kode (index 1) dan Nama (index 2)
        const cellKode = row.cells[1] ? row.cells[1].textContent.toUpperCase() : "";
        const cellNama = row.cells[2] ? row.cells[2].textContent.toUpperCase() : "";

        if (cellKode.indexOf(filter) > -1 || cellNama.indexOf(filter) > -1) {
            row.style.display = ""; // Munculkan
        } else {
            row.style.display = "none"; // Sembunyikan
        }
    });
});
