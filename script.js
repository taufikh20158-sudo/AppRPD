
// =====================================================================
// 1. KONSTRUKTOR & KONFIGURASI SUPABASE (Hanya satu kali saja!)
// =====================================================================
const { createClient } = supabase;
const _supabase = createClient('https://ldkefnlnpgwgxznemzol.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxka2VmbmxucGd3Z3h6bmVtem9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODE5NDYsImV4cCI6MjA4NzY1Nzk0Nn0.aRvd4POq_HdTdYVAU-Nl-RFNjeqgPjbNteRYyDdUIvE');

// =====================================================================
// 2. VARIABEL GLOBAL & DOM ELEMENTS
// =====================================================================
let debounceTimer;
const tableBody = document.getElementById('tableBody');
const btnAddRow = document.getElementById('btnAddRow');
const editModal = document.getElementById('editModal');
const rpdModal = document.getElementById('rpdModal');
const realisasiModal = document.getElementById('realisasiModal');

// Tambahkan ini agar tidak error saat dipanggil di fungsi-fungsi bawah
const checkAllMaster = document.getElementById('checkAllMaster'); 

let currentRowForEdit = null;
let targetRowRPD = null;
let targetRowRealisasi = null;

// Simpan nilai acuan global
let targetPaguTotal = 0;
let targetBlokirTotal = 0;

// =====================================================================
// 2. HELPER UTAMA (FORMATTER & PARSER)
// =====================================================================
const getVal = (str) => {
    if (!str) return 0;
    let clean = str.toString().replace(/[^0-9]/g, ""); 
    return parseInt(clean, 10) || 0;
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

function initMoneyInputs() {
    const mainInputs = ['editPagu', 'editBlokir', 'inputPagu', 'inputBlokir'];
    const monthlySelectors = ['.input-bulan', '.input-realisasi'];

    mainInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', function() {
                this.value = formatRibuan(this.value);
            });
        }
    });

    document.querySelectorAll(monthlySelectors.join(',')).forEach(el => {
        el.addEventListener('input', function() {
            this.value = formatRibuan(this.value);
        });
    });
}
// =====================================================================
// 3. LOGIKA MANIPULASI TABEL (ADD, DELETE, MOVE)
// =====================================================================

function createNewRow(level, afterElement = null) {
    const row = document.createElement('tr');
    row.setAttribute('data-level', level);
    row.dataset.rpdBulanan = JSON.stringify(new Array(12).fill(0));
    row.dataset.realisasiBulanan = JSON.stringify(new Array(12).fill(0));
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
    const c = row.cells;
    
    // Ambil nilai dari masing-masing kolom (asumsi indeks kolom tetap)
    const pagu      = getVal(c[3].textContent); // Kolom PAGU
    const blokir    = getVal(c[4].textContent); // Kolom BLOKIR
    const rpd       = getVal(c[5].textContent); // Kolom RPD
    const realisasi = getVal(c[6].textContent); // Kolom REALISASI

    // 1. LOGIKA SISA: Dana riil yang masih ada (setelah potong blokir & pakai)
    const sisa = pagu - blokir - realisasi;

    // 2. LOGIKA KEKURANGAN: Selisih antara target Pagu dengan Rencana (RPD)
    const kekurangan = pagu - rpd;

    // Tampilkan hasil ke kolom masing-masing
    c[7].textContent = toRp(sisa);       // Kolom SISA
    c[8].textContent = toRp(kekurangan); // Kolom KEKURANGAN (PAGU - RPD)

    // --- FEEDBACK VISUAL ---

    // Warna Merah jika Sisa Minus (Overbudget)
    if (sisa < 0) {
        c[7].style.color = "#ff0000";
        c[7].style.fontWeight = "bold";
    } else {
        c[7].style.color = ""; 
        c[7].style.fontWeight = "normal";
    }

    // Highlight Kuning jika RPD belum sinkron dengan PAGU (Kekurangan != 0)
    if (kekurangan !== 0) {
        row.style.backgroundColor = "rgba(255, 255, 0, 0.2)";
        c[8].style.color = "#856404"; // Warna teks coklat tua agar kontras dengan kuning
    } else {
        row.style.backgroundColor = "";
        c[8].style.color = "#28a745"; // Warna hijau jika sudah pas 0
    }
}
function updateMondas() {
    const rows = Array.from(tableBody.rows);
    if (rows.length === 0) return;

    // --- STEP 1: AKUMULASI HIRARKI (Bottom-Up) ---
    for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        const level = parseInt(row.getAttribute('data-level')) || 0;
        const cells = row.cells;
        
        const nextRow = rows[i + 1];
        const hasChild = (nextRow && (parseInt(nextRow.getAttribute('data-level')) || 0) > level);

        if (hasChild) {
            let sums = { pagu: 0, blokir: 0, rpd: 0, real: 0 };
            
            // Penampung untuk akumulasi array bulanan (Jan-Des)
            let sumRPDBulanan = new Array(12).fill(0);
            let sumRealBulanan = new Array(12).fill(0);
            
            for (let j = i + 1; j < rows.length; j++) {
                const child = rows[j];
                const childLv = parseInt(child.getAttribute('data-level')) || 0;
                
                if (childLv <= level) break; 
                
                if (childLv === level + 1) {
                    sums.pagu   += getVal(child.cells[3].textContent);
                    sums.blokir += getVal(child.cells[4].textContent);
                    sums.rpd    += getVal(child.cells[5].textContent);
                    sums.real   += getVal(child.cells[6].textContent);

                    // --- LOGIKA TAMBAHAN: Akumulasi Array Bulanan ---
                    try {
                        const cRPD = JSON.parse(child.dataset.rpdBulanan || "[]");
                        const cReal = JSON.parse(child.dataset.realisasiBulanan || "[]");
                        
                        for (let k = 0; k < 12; k++) {
                            sumRPDBulanan[k] += (Number(cRPD[k]) || 0);
                            sumRealBulanan[k] += (Number(cReal[k]) || 0);
                        }
                    } catch (e) { console.error("Error parse dataset di row:", child); }
                }
            }
            
            // Update teks pada sel induk
            cells[3].textContent = toRp(sums.pagu);
            cells[4].textContent = toRp(sums.blokir);
            cells[5].textContent = toRp(sums.rpd);
            cells[6].textContent = toRp(sums.real);

            // --- SIMPAN HASIL AKUMULASI KE DATASET INDUK ---
            // Ini yang membuat Level 3, 2, 1, 0 memiliki data bulanan
            row.dataset.rpdBulanan = JSON.stringify(sumRPDBulanan);
            row.dataset.realisasiBulanan = JSON.stringify(sumRealBulanan);
        }
        
        calculateRowTotal(row);
    }

    // --- STEP 2: UPDATE DASHBOARD ---
    if (typeof updateDashboardTotal === 'function') {
        updateDashboardTotal();
    }

    // --- STEP 3: LOGIKA WARNA ---
    const elPaguAll = document.getElementById('statTotalPaguAll');
    const elBlokir = document.getElementById('statTotalBlokir');

    let totalPaguTabel = 0;
    let totalBlokirTabel = 0;
    tableBody.querySelectorAll('tr[data-level="0"]').forEach(r => {
        totalPaguTabel += getVal(r.cells[3].textContent);
        totalBlokirTabel += getVal(r.cells[4].textContent);
    });

    const tPagu = getVal(targetPaguTotal);
    const tBlokir = getVal(targetBlokirTotal);

    if (elPaguAll) elPaguAll.style.color = (totalPaguTabel === tPagu && tPagu > 0) ? "#00ff00" : "#ff0000";
    if (elBlokir) elBlokir.style.color = (totalBlokirTabel === tBlokir && tPagu > 0) ? "#00ff00" : "#ff0000";
}
// =====================================================================
// 5. OPERASIONAL MODAL (EDIT, RPD, REALISASI)
// =====================================================================

function closeAllModals() {
    editModal.style.display = 'none';
    rpdModal.style.display = 'none';
    realisasiModal.style.display = 'none';
}

// Pasang listener tutup ke semua tombol batal
document.querySelectorAll('.btn-close, .btn-batal, #btnCancelEdit, #btnCancelRPD, #btnCancelRealisasi').forEach(btn => {
    btn.onclick = closeAllModals;
});

// =====================================================================
// 6. MODAL EDIT DATA
// =====================================================================
document.getElementById('btnEdit').addEventListener('click', function() {
    const selectedCbs = tableBody.querySelectorAll('.row-checkbox:checked');

    if (selectedCbs.length === 0) {
        return alert("Pilih satu baris!");
    }
    if (selectedCbs.length > 1) {
        return alert("Gagal: Anda memilih " + selectedCbs.length + " baris. Silakan pilih satu baris saja untuk fitur ini.");
    }

    const selected = selectedCbs[0];
    currentRowForEdit = selected.closest('tr');
    const c = currentRowForEdit.cells;
    const level = parseInt(currentRowForEdit.getAttribute('data-level')) || 0;

    document.getElementById('editKode').value = c[1].innerText.trim();
    document.getElementById('editNama').value = c[2].innerText;
    document.getElementById('editPagu').value = c[3].innerText;
    document.getElementById('editBlokir').value = c[4].innerText;

    const inputPagu = document.getElementById('editPagu');
    const inputBlokir = document.getElementById('editBlokir');
    const isParent = level < 4;

    inputPagu.readOnly = isParent;
    inputBlokir.readOnly = isParent;
    inputPagu.style.backgroundColor = isParent ? "#f0f0f0" : "#ffffff";
    inputBlokir.style.backgroundColor = isParent ? "#f0f0f0" : "#ffffff";

    editModal.style.display = 'flex';
});

document.getElementById('btnUpdateData').onclick = function() {
    // 1. Amankan currentRowForEdit
    if (!currentRowForEdit) return;

    const c = currentRowForEdit.cells;
    const level = parseInt(currentRowForEdit.getAttribute('data-level')) || 0;
    
    // 2. Ambil nilai dari input modal
    const kodeVal = document.getElementById('editKode').value.trim();
    const namaVal = document.getElementById('editNama').value.trim();
    // Gunakan getVal untuk memastikan kita mendapat angka murni sebelum diformat ulang
    const paguMurni = getVal(document.getElementById('editPagu').value);
    const blokirMurni = getVal(document.getElementById('editBlokir').value);

    // 3. Update Kolom Kode (Level 0-4)
    // Mencari span terakhir di dalam sel kode agar indentasi (padding) tidak hilang
    const containerKode = c[1].querySelector('div') || c[1];
    const spans = containerKode.querySelectorAll('span');
    
    if (spans.length > 0) {
        // Update span yang berisi teks kode (biasanya yang terakhir)
        spans[spans.length - 1].textContent = kodeVal;
    } else {
        c[1].textContent = kodeVal;
    }

    // 4. Update Kolom Nama
    c[2].textContent = namaVal;
    
    // 5. Update Angka (KHUSUS Level 4 / Detail)
    if (level === 4) {
        c[3].textContent = toRp(paguMurni);
        c[4].textContent = toRp(blokirMurni);
        
        // Reset RPD & Realisasi jika Pagu menjadi 0 (Opsional, tapi aman)
        if (paguMurni === 0) {
            c[5].textContent = "0";
            c[6].textContent = "0";
            currentRowForEdit.dataset.rpdBulanan = JSON.stringify(new Array(12).fill(0));
            currentRowForEdit.dataset.realisasiBulanan = JSON.stringify(new Array(12).fill(0));
        }
    }

    // 6. Finalisasi
    closeAllModals();
    
    // Hitung ulang semua total (Induk akan otomatis terupdate)
    updateMondas();
    
    // Reset variabel global edit agar tidak 'nyangkut' ke baris berikutnya
    currentRowForEdit = null;

    if (typeof markDirty === 'function') markDirty();
};
// =====================================================================
// 7. MODAL RPD
// =====================================================================
document.getElementById('btnRPD').addEventListener('click', () => {
    const selectedCbs = tableBody.querySelectorAll('.row-checkbox:checked');
    
    if (selectedCbs.length === 0) {
        return alert("Pilih satu baris untuk mengisi RPD!");
    }
    
    if (selectedCbs.length > 1) {
        return alert("Maaf, input RPD hanya bisa dilakukan satu per satu. Anda memilih " + selectedCbs.length + " baris.");
    }

    const selected = selectedCbs[0];
    targetRowRPD = selected.closest('tr');

    const level = parseInt(targetRowRPD.getAttribute('data-level')) || 0;
    const isParent = level < 4;
    const btnSimpan = document.getElementById('btnUpdateRPD');
    const c = targetRowRPD.cells; 
    const inputs = rpdModal.querySelectorAll('.input-bulan');
    const valPaguMurni = getVal(c[3].textContent);

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

    let savedRaw = targetRowRPD.dataset.rpdBulanan;
    let savedData = [];
    
    try {
        if (savedRaw && savedRaw.startsWith('[')) {
            savedData = JSON.parse(savedRaw);
        } else if (savedRaw && savedRaw.includes('|')) {
            savedData = savedRaw.split('|').map(Number);
        } else {
            savedData = new Array(12).fill(0);
        }
    } catch (e) {
        savedData = new Array(12).fill(0);
    }
    
    inputs.forEach((inp, idx) => {
        let valMurni = savedData[idx] || 0;
        inp.value = valMurni === 0 ? "" : formatRibuan(valMurni);
        
        inp.readOnly = isParent;
        inp.style.backgroundColor = isParent ? "#f0f0f0" : "#ffffff"; 
        inp.style.cursor = isParent ? "not-allowed" : "text";

        inp.oninput = function() {
            this.value = formatRibuan(this.value);
            updateRPDInfoBar(); 
        };
    });

   if (btnSimpan) {
        // 1. Atur visibilitas tombol (Hanya muncul di Level 4)
        btnSimpan.style.display = isParent ? "none" : "block";
        
        // 2. BERSIHKAN listener lama (Penting untuk mencegah data tertukar antar baris)
        btnSimpan.onclick = null; 
       
        // 3. Pasang listener baru
        btnSimpan.onclick = () => {
            // Ambil angka murni dari semua input bulan (Jan-Des)
            const murniArr = Array.from(inputs).map(i => getVal(i.value));
            
            // Hitung total RPD
            const totalRPD = murniArr.reduce((acc, curr) => acc + curr, 0);

            // Simpan data ke dalam dataset baris dalam format JSON string
            // Ini akan dibaca oleh fungsi btnSave saat simpan permanen ke Supabase
            targetRowRPD.dataset.rpdBulanan = JSON.stringify(murniArr);
            
            // Update tampilan di kolom RPD (Index 5)
            targetRowRPD.cells[5].textContent = toRp(totalRPD);
            
            // Jalankan kalkulasi hierarki agar nilai Induk (Level 0-3) ikut update
            updateMondas(); 
            
            // Tutup modal
            closeAllModals();
        };
    }

    updateRPDInfoBar();
    rpdModal.style.display = 'flex';
});
// =====================================================================
// 8. MODAL REALISASI
// =====================================================================
document.getElementById('btnRealisasi').addEventListener('click', () => {
    const selectedCbs = tableBody.querySelectorAll('.row-checkbox:checked');
    
    if (selectedCbs.length === 0) return alert("Pilih satu baris!");
    if (selectedCbs.length > 1) return alert(`Pilih hanya satu baris (Anda memilih ${selectedCbs.length})`);
    
    const targetRowRealisasi = selectedCbs[0].closest('tr');
    const level = parseInt(targetRowRealisasi.getAttribute('data-level')) || 0;
    const isParent = level < 4;
    const btnSimpan = document.getElementById('btnUpdateRealisasi');
    const c = targetRowRealisasi.cells; 
    const inputs = realisasiModal.querySelectorAll('.input-realisasi');
    const valRPD = getVal(c[5].textContent);

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

    const getSafeData = (row, key) => {
        let d = row.dataset[key];
        if (!d) return new Array(12).fill(0);
        try {
            if (typeof d === 'string') {
                if (d.startsWith('[')) return JSON.parse(d);
                if (d.includes('|')) return d.split('|').map(Number);
            }
            return Array.isArray(d) ? d : new Array(12).fill(0);
        } catch (e) { return new Array(12).fill(0); }
    };

    const dataRPD = getSafeData(targetRowRealisasi, 'rpdBulanan');
    const savedReal = getSafeData(targetRowRealisasi, 'realisasiBulanan');

    inputs.forEach((inp, idx) => {
        let valPlaceholder = dataRPD[idx] || 0;
        inp.placeholder = valPlaceholder !== 0 ? formatRibuan(valPlaceholder) : "0";
        
        let valAwal = savedReal[idx] || 0;
        inp.value = valAwal !== 0 ? formatRibuan(valAwal) : "";
        
        inp.readOnly = isParent;
        inp.style.backgroundColor = isParent ? "#f0f0f0" : "#ffffff";
        inp.style.cursor = isParent ? "not-allowed" : "text";

        inp.oninput = function() {
            this.value = formatRibuan(this.value);
            updateRealInfoBar(); 
        };
    });

if (btnSimpan) {
        btnSimpan.style.display = isParent ? "none" : "block";
        
        // 1. PENTING: Hapus listener lama agar tidak terjadi penumpukan (leak)
        btnSimpan.onclick = null; 

        // 2. Pasang listener baru
        btnSimpan.onclick = function() {
            // Ambil nilai murni dari setiap input bulan
            const murniArr = Array.from(inputs).map(i => getVal(i.value));
            
            // Hitung total menggunakan reduce
            const totalReal = murniArr.reduce((acc, curr) => acc + curr, 0);

            // Simpan data array ke dataset dalam bentuk string JSON
            targetRowRealisasi.dataset.realisasiBulanan = JSON.stringify(murniArr);
            
            // Update teks di sel tabel (Kolom Realisasi biasanya index 6)
            targetRowRealisasi.cells[6].textContent = toRp(totalReal);
            
            // Update perhitungan hierarki (mondas) agar induknya ikut berubah
            updateMondas(); 
            
            // Tutup semua modal
            closeAllModals();
            
            // Opsional: Tandai bahwa ada perubahan yang belum disimpan ke database
            if (typeof markDirty === 'function') markDirty();
        };
    }

    updateRealInfoBar();
    realisasiModal.style.display = 'flex';
});
// =====================================================================
// 6. PENYIMPANAN & INITIALIZATION
// =====================================================================
document.getElementById('btnSave').addEventListener('click', async () => {
    const btn = document.getElementById('btnSave');
    const originalText = btn.innerText;
    btn.innerText = "SAVING...";
    btn.disabled = true;

    try {
        const rowsToSave = Array.from(tableBody.rows).map((row, index) => {
            const c = row.cells;
            
            const getArr = (key) => {
                let d = row.dataset[key];
                if (!d) return new Array(12).fill(0);
                try {
                    if (typeof d === 'string' && d.startsWith('[')) return JSON.parse(d).map(Number);
                    if (typeof d === 'string' && d.includes('|')) return d.split('|').map(Number);
                    return Array.isArray(d) ? d.map(Number) : new Array(12).fill(0);
                } catch (e) { return new Array(12).fill(0); }
            };

            return {
                sort_order: index,
                level: parseInt(row.getAttribute('data-level')) || 0,
                kode: c[1].innerText.trim(),
                nama: c[2].innerText.trim(),
                pagu: getVal(c[3].textContent),
                blokir: getVal(c[4].textContent),
                rpd_total: getVal(c[5].textContent),
                real_total: getVal(c[6].textContent),
                rpd_bulanan: getArr('rpdBulanan'),
                real_bulanan: getArr('realisasiBulanan')
            };
        });

        if (rowsToSave.length === 0) throw new Error("Tabel kosong!");

        // 1. HAPUS SEMUA DATA (Menggunakan kriteria yang pasti mencakup semua baris)
        // .gt('sort_order', -1) memastikan semua data dengan urutan 0, 1, 2... terhapus
        const { error: delError } = await _supabase
            .from('anggaran')
            .delete()
            .gt('sort_order', -1); 

        if (delError) throw delError;

        // 2. JEDA SEDIKIT (Penting agar Database tuntas melakukan penghapusan)
        await new Promise(resolve => setTimeout(resolve, 300));

        // 3. MASUKKAN DATA BARU
        const { error: insError } = await _supabase
            .from('anggaran')
            .insert(rowsToSave);

        if (insError) throw insError;

        alert("✅ Data Berhasil Disimpan Permanen!");
    } catch (err) {
        console.error("Detail Error:", err);
        alert("❌ Gagal Simpan: " + err.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
});
async function loadDataFromSupabase() {
    // 1. Amankan tableBody: Segera kosongkan dan beri indikator loading
    tableBody.innerHTML = "<tr><td colspan='9' class='text-center'>⏳ Memuat data...</td></tr>";

    try {
        // 2. Ambil data secara paralel (lebih cepat daripada satu per satu)
        const [configRes, anggaranRes] = await Promise.all([
            _supabase.from('config').select('pagu_target, blokir_target').eq('id', 'global_target').maybeSingle(),
            _supabase.from('anggaran').select('*').order('sort_order', { ascending: true })
        ]);

        // 3. Tangani Config
        if (configRes.data) {
            targetPaguTotal = configRes.data.pagu_target || 0;
            targetBlokirTotal = configRes.data.blokir_target || 0;
        }

        // 4. Tangani Error Anggaran
        if (anggaranRes.error) throw anggaranRes.error;

        // 5. Bersihkan tableBody lagi sebelum mengisi (Double check anti-double)
        tableBody.innerHTML = ""; 

        const data = anggaranRes.data;
        if (!data || data.length === 0) {
            tableBody.innerHTML = "<tr><td colspan='9' class='text-center'>Data kosong.</td></tr>";
            return;
        }

       data.forEach(item => {
    const row = document.createElement('tr');
    row.setAttribute('data-level', item.level);
    
    row.dataset.rpdBulanan = Array.isArray(item.rpd_bulanan) ? JSON.stringify(item.rpd_bulanan) : JSON.stringify(new Array(12).fill(0));
    row.dataset.realisasiBulanan = Array.isArray(item.real_bulanan) ? JSON.stringify(item.real_bulanan) : JSON.stringify(new Array(12).fill(0));
    
    const pagu      = item.pagu || 0;
    const blokir    = item.blokir || 0;
    const rpd       = item.rpd_total || 0;
    const realisasi = item.real_total || 0;
    const sisa      = pagu - realisasi;

    row.innerHTML = `
        <td class="col-cb text-center"><input type="checkbox" class="row-checkbox"></td>
        <td class="col-kd" style="padding-left:${item.level * 15}px !important">
            <div style="display: flex; align-items: center;">
                <span>${item.kode || ''}</span>
            </div>
        </td>
        <td class="col-nm">${item.nama || ''}</td>
        <td class="col-idr text-right">${toRp(pagu)}</td>
        <td class="col-idr text-right">${toRp(blokir)}</td>
        <td class="col-idr text-right">${toRp(rpd)}</td>
        <td class="col-idr text-right">${toRp(realisasi)}</td>
        <td class="col-idr text-right">${toRp(realisasi)}</td>
        <td class="col-idr text-right" style="${sisa < 0 ? 'color:red;font-weight:bold;' : ''}">${toRp(sisa)}</td>
    `;
    tableBody.appendChild(row);
});

        // 7. Finalisasi UI
        updateMondas(); 
        
        // Gunakan requestAnimationFrame daripada setTimeout untuk performa rendering yang lebih mulus
        requestAnimationFrame(() => {
            updateDashboardTotal();
        });

    } catch (err) {
        console.error("Error loading data:", err);
        tableBody.innerHTML = `<tr><td colspan='9' class='text-center text-danger'>❌ Gagal memuat: ${err.message}</td></tr>`;
    }
}
// =====================================================================
// 7. HAPUS BARIS
// =====================================================================
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
            if (!row) return;

            const level = parseInt(row.getAttribute('data-level')) || 0;
            
            let nextRow = row.nextElementSibling;
            while (nextRow && (parseInt(nextRow.getAttribute('data-level')) || 0) > level) {
                let toDelete = nextRow;
                nextRow = nextRow.nextElementSibling;
                toDelete.remove();
            }
            row.remove();
        });

        const masterCb = document.getElementById('checkAllMaster');
        if (masterCb) masterCb.checked = false;

        if (typeof updateMondas === 'function') {
            updateMondas(); 
        }
        if (typeof updateDashboardTotal === 'function') {
            updateDashboardTotal();
        }
    }
});
// =====================================================================
// 8. CEKLIST ALL
// =====================================================================
// GANTI SEMUA KODE DI POIN 8 DENGAN INI:
checkAllMaster.addEventListener('change', function() {
    const checkboxes = tableBody.querySelectorAll('.row-checkbox');
    checkboxes.forEach(cb => {
        const row = cb.closest('tr');
        if (row.style.display !== 'none') {
            cb.checked = this.checked;
            // Langsung update warna baris
            if (this.checked) row.classList.add('row-selected');
            else row.classList.remove('row-selected');
        }
    });
});
// =====================================================================
// 9. UPDATE DASHBOARD (DIPERBAIKI)
// =====================================================================
function updateDashboardTotal() {
    const topRows = tableBody.querySelectorAll('tr[data-level="0"]');
    let totals = { pagu: 0, blokir: 0, rpd: 0, real: 0 };

    topRows.forEach(row => {
        const c = row.cells;
        if (c.length >= 7) {
            totals.pagu   += getVal(c[3].textContent);
            totals.blokir += getVal(c[4].textContent);
            totals.rpd    += getVal(c[5].textContent); 
            totals.real   += getVal(c[6].textContent);
        }
    });

    const paguNetto = totals.pagu - totals.blokir;

    // Gunakan fungsi bantuan agar jika ID tidak ada di HTML, script tidak mati
    const safeSetText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    safeSetText('statTotalPagu', toRp(paguNetto));
    safeSetText('statTotalRPD', toRp(totals.rpd));
    safeSetText('statTotalBlokir', toRp(totals.blokir));
    safeSetText('statTotalRealisasi', toRp(totals.real));
    safeSetText('statTotalPaguAll', toRp(totals.pagu));
}
// =====================================================================
// 10. DASBOARD
// =====================================================================
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

function updateDashboardStats(period) {
    const rows = document.querySelectorAll('#tableBody tr');
    let stats = {
        peg: { rpd: 0, real: 0 }, 
        bar: { rpd: 0, real: 0 }, 
        mod: { rpd: 0, real: 0 },
        rm:  { rpd: 0, real: 0 }, 
        pnp: { rpd: 0, real: 0 },
        // Khusus Belanja Barang (52)
        bbrm: { rpd: 0, real: 0 }, 
        bbpnpb: { rpd: 0, real: 0 }
    };

    rows.forEach((row) => {
        if (row.getAttribute('data-level') !== "3") return;

        const kodeFull = row.cells[1].innerText.trim().toUpperCase();
        let vRPD = 0, vReal = 0;

        if (period === "TAHUNAN") {
            vRPD = getVal(row.cells[5].innerText);
            vReal = getVal(row.cells[6].innerText);
        } else {
            const pIdx = parseInt(period);
            const arrRPD = JSON.parse(row.dataset.rpdBulanan || "[]");
            const arrReal = JSON.parse(row.dataset.realisasiBulanan || "[]");
            vRPD = arrRPD[pIdx] || 0;
            vReal = arrReal[pIdx] || 0;
        }

        const kodeStr = String(kodeFull);

        // 1. Klasifikasi Jenis Belanja
        if (kodeStr.startsWith("51")) { 
            stats.peg.rpd += vRPD; 
            stats.peg.real += vReal; 
        } 
        else if (kodeStr.startsWith("52")) { 
            stats.bar.rpd += vRPD; 
            stats.bar.real += vReal; 
            
            // Filter Khusus BBRM & BBPNBP (Hanya untuk akun 52)
            if (kodeStr.endsWith("R")) {
                stats.bbrm.rpd += vRPD;
                stats.bbrm.real += vReal;
            } else if (kodeStr.endsWith("P")) {
                stats.bbpnpb.rpd += vRPD;
                stats.bbpnpb.real += vReal;
            }
        } 
        else if (kodeStr.startsWith("53")) { 
            stats.mod.rpd += vRPD; 
            stats.mod.real += vReal; 
        }

        // 2. Klasifikasi Sumber Dana (Total Keseluruhan)
        if (kodeStr.endsWith("R")) { 
            stats.rm.rpd += vRPD; 
            stats.rm.real += vReal; 
        } else if (kodeStr.endsWith("P")) { 
            stats.pnp.rpd += vRPD; 
            stats.pnp.real += vReal; 
        }
    });

    renderDashboardUI(stats);
}

function renderDashboardUI(stats) {
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
        if (elPersen) elPersen.innerText = prs.toFixed(2) + "%";
    };

    // Render baris sesuai ID di HTML Bapak
    renderRow("dashPeg", stats.peg);
    renderRow("dashBar", stats.bar);
    renderRow("dashMod", stats.mod);
    renderRow("dashRM", stats.rm);
    renderRow("dashPNBP", stats.pnp);
    
    // Baris tambahan yang baru Bapak masukkan
    renderRow("dashBBRM", stats.bbrm);
    renderRow("dashBBPNBP", stats.bbpnpb);

    // Update Monitor Utama Atas
    const tTotalRPD = stats.peg.rpd + stats.bar.rpd + stats.mod.rpd;
    const tTotalReal = stats.peg.real + stats.bar.real + stats.mod.real;
    
    const mRPD = document.getElementById("dashRPD");
    const mReal = document.getElementById("dashReal");
    const mPersen = document.getElementById("dashPersen");

    if (mRPD) mRPD.innerText = toRp(tTotalRPD);
    if (mReal) mReal.innerText = toRp(tTotalReal);
    if (mPersen) {
        const totalPrs = tTotalRPD > 0 ? (tTotalReal / tTotalRPD * 100) : 0;
        mPersen.innerText = totalPrs.toFixed(2) + "%";
        mPersen.style.color = totalPrs > 105 ? "#ff4d4d" : (totalPrs > 0 ? "#0f0" : "#fff");
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
// isDirty = false;
// btn.style.backgroundColor = ""; // Reset warna tombol

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
// =====================================================================
// LOGIKA MODAL INPUT (SINKRON DENGAN HTML MODAL)
// =====================================================================
const inputModal = document.getElementById('inputModal');

document.getElementById('btnInput').addEventListener('click', () => {
    document.getElementById('inputPagu').value = targetPaguTotal > 0 ? formatRibuan(targetPaguTotal.toString()) : "";
    document.getElementById('inputBlokir').value = targetBlokirTotal > 0 ? formatRibuan(targetBlokirTotal.toString()) : "";
    
    inputModal.style.display = 'flex';
    setTimeout(() => { document.getElementById('inputPagu').focus(); }, 100);
});

document.getElementById('btnCancelInput').onclick = () => inputModal.style.display = 'none';
document.getElementById('btnCloseInput').onclick = () => inputModal.style.display = 'none';

['inputPagu', 'inputBlokir'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', function() { 
            this.value = formatRibuan(this.value.replace(/[^0-9]/g, '')); 
        });
    }
});

document.getElementById('btnSubmitInput').onclick = async function() {
    const btn = this;
    const originalText = btn.innerText;
    
    const newPagu = getVal(document.getElementById('inputPagu').value);
    const newBlokir = getVal(document.getElementById('inputBlokir').value);

    btn.disabled = true;
    btn.innerText = "SAVING...";

    try {
        const { error } = await _supabase
            .from('config')
            .update({ pagu_target: newPagu, blokir_target: newBlokir })
            .eq('id', 'global_target');

        if (error) throw error;

        targetPaguTotal = newPagu;
        targetBlokirTotal = newBlokir;

        updateMondas(); 
        document.getElementById('inputModal').style.display = 'none';
        // alert("✅ Target berhasil diperbarui!");
    } catch (err) {
        // alert("❌ Gagal simpan: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
};
// Letakkan di paling bawah file script.js
document.addEventListener('DOMContentLoaded', () => {
    console.log("Sistem Anggaran Klasik Ready...");
    
    // Inisialisasi format input uang
    if (typeof initMoneyInputs === 'function') initMoneyInputs();
    
    // Ambil data dari database
    if (typeof loadDataFromSupabase === 'function') {
        loadDataFromSupabase();
    }
});
async function logoutAplikasi() {
    if (confirm("Apakah Anda yakin ingin keluar?")) {
        await _supabase.auth.signOut();
        window.location.replace('login.html');
    }
}
