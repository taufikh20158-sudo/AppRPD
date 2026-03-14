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

document.addEventListener('DOMContentLoaded', initMoneyInputs);
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
    
    const pagu      = getVal(c[3].textContent);
    const rpd       = getVal(c[5].textContent);
    const realisasi = getVal(c[6].textContent);

    const sisa = pagu - realisasi;

    c[7].textContent = toRp(realisasi); 
    c[8].textContent = toRp(sisa);

    if (pagu !== rpd) {
        row.style.backgroundColor = "rgba(255, 255, 0, 0.2)";
    } else {
        row.style.backgroundColor = "";
    }

    if (sisa < 0) {
        c[8].style.color = "#ff0000";
        c[8].style.fontWeight = "bold";
    } else {
        c[8].style.color = ""; 
        c[8].style.fontWeight = "normal";
    }
}
function updateMondas() {
    const rows = Array.from(tableBody.rows);
    if (rows.length === 0) return;

    // --- STEP 1: AKUMULASI HIRARKI (Bottom-Up) ---
    // Loop dari bawah ke atas agar nilai anak terjumlah ke induk secara berantai
    for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        const level = parseInt(row.getAttribute('data-level')) || 0;
        const cells = row.cells;
        
        const nextRow = rows[i + 1];
        const hasChild = (nextRow && (parseInt(nextRow.getAttribute('data-level')) || 0) > level);

        if (hasChild) {
            let sums = { pagu: 0, blokir: 0, rpd: 0, real: 0 };
            
            // Cari semua baris di bawahnya yang merupakan Level + 1 (anak langsung)
            for (let j = i + 1; j < rows.length; j++) {
                const child = rows[j];
                const childLv = parseInt(child.getAttribute('data-level')) || 0;
                
                if (childLv <= level) break; // Berhenti jika bertemu baris dengan level sejajar atau lebih tinggi
                
                if (childLv === level + 1) {
                    sums.pagu   += getVal(child.cells[3].textContent);
                    sums.blokir += getVal(child.cells[4].textContent);
                    sums.rpd    += getVal(child.cells[5].textContent);
                    sums.real   += getVal(child.cells[6].textContent);
                }
            }
            
            // Update teks pada sel induk
            cells[3].textContent = toRp(sums.pagu);
            cells[4].textContent = toRp(sums.blokir);
            cells[5].textContent = toRp(sums.rpd);
            cells[6].textContent = toRp(sums.real);
        }
        
        // Hitung sisa pagu dan pewarnaan per baris
        calculateRowTotal(row);
    }

    // --- STEP 2: UPDATE DASHBOARD ---
    // Sangat penting memanggil ini DI SINI agar Dashboard sinkron dengan hasil akumulasi tabel
    if (typeof updateDashboardTotal === 'function') {
        updateDashboardTotal();
    }
    // --- STEP 3: LOGIKA WARNA (Bandingkan Tabel vs Target Cloud) ---
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
    if (currentRowForEdit) {
        const c = currentRowForEdit.cells;
        const level = parseInt(currentRowForEdit.getAttribute('data-level')) || 0;
        const kodeVal = document.getElementById('editKode').value;
        const namaVal = document.getElementById('editNama').value;

        c[1].innerHTML = `
            <div style="display:flex; align-items:center;">
                <span style="color:#808080; margin-right:5px"></span>
                <span>${kodeVal}</span>
            </div>`;

        c[2].textContent = namaVal;
        
        if (level === 4) {
            c[3].textContent = formatRibuan(document.getElementById('editPagu').value) || "0";
            c[4].textContent = formatRibuan(document.getElementById('editBlokir').value) || "0";
        }

        closeAllModals();
        updateMondas();
        
        if (typeof markDirty === 'function') markDirty();
    }
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
        btnSimpan.style.display = isParent ? "none" : "block";
        
       
            btnSimpan.onclick = () => {
            const murniArr = Array.from(inputs).map(i => getVal(i.value));
            const totalRPD = murniArr.reduce((acc, curr) => acc + curr, 0);

            // Simpan ke dataset
            targetRowRPD.dataset.rpdBulanan = JSON.stringify(murniArr);
            // Update teks kolom RPD (Index 5)
            targetRowRPD.cells[5].textContent = toRp(totalRPD);
            
            updateMondas(); // Ini akan memicu updateDashboardTotal()
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
        // Cari bagian btnSimpan.onclick di dalam btnRealisasi listener
        btnSimpan.onclick = function() {
            const murniArr = Array.from(inputs).map(i => getVal(i.value));
            const totalReal = murniArr.reduce((acc, curr) => acc + curr, 0);

            targetRowRealisasi.dataset.realisasiBulanan = JSON.stringify(murniArr);
            // Update teks kolom Realisasi (Index 6)
            targetRowRealisasi.cells[6].textContent = toRp(totalReal);
            
            updateMondas(); 
            closeAllModals();
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
                    // Jika data berupa string JSON (disarankan)
                    if (typeof d === 'string' && d.startsWith('[')) {
                        return JSON.parse(d).map(Number);
                    } 
                    // Jika data berupa format lama Pipe |
                    if (typeof d === 'string' && d.includes('|')) {
                        return d.split('|').map(Number);
                    }
                    // Jika data sudah berupa Array objek
                    if (Array.isArray(d)) return d.map(Number);
                    
                    return new Array(12).fill(0);
                } catch (e) {
                    return new Array(12).fill(0);
                }
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

        // Hapus data lama dan masukkan data baru
        await _supabase.from('anggaran').delete().neq('level', -1);
        const { error: insError } = await _supabase.from('anggaran').insert(rowsToSave);
        if (insError) throw insError;

        alert("✅ Data Berhasil Disimpan Permanen!");
    } catch (err) {
        console.error(err);
        alert("❌ Gagal Simpan: " + err.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
});
async function loadDataFromSupabase() {
    tableBody.innerHTML = "<tr><td colspan='9' class='text-center'>Memuat data...</td></tr>";

    try {
        // AMBIL DATA TARGET DARI CLOUD TERLEBIH DAHULU
        const { data: configData, error: configError } = await _supabase
            .from('config')
            .select('pagu_target, blokir_target')
            .eq('id', 'global_target')
            .single();

        if (!configError && configData) {
            targetPaguTotal = configData.pagu_target;
            targetBlokirTotal = configData.blokir_target;
        }

        // AMBIL DATA ANGGARAN
        const { data, error } = await _supabase.from('anggaran').select('*').order('sort_order', { ascending: true });
        if (error) throw error;

        tableBody.innerHTML = ""; 
        if (!data || data.length === 0) return;

        data.forEach(item => {
    const row = document.createElement('tr');
    row.setAttribute('data-level', item.level);
    
    // Dataset harus dalam format string JSON untuk operasional modal nanti
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
            <span>${item.kode || ''}</span>
        </td>
        <td class="col-nm">${item.nama || ''}</td>
        <td class="col-idr text-right">${toRp(pagu)}</td>      <td class="col-idr text-right">${toRp(blokir)}</td>    <td class="col-idr text-right">${toRp(rpd)}</td>       <td class="col-idr text-right">${toRp(realisasi)}</td> <td class="col-idr text-right">${toRp(realisasi)}</td> <td class="col-idr text-right" style="${sisa < 0 ? 'color:red;font-weight:bold;' : ''}">${toRp(sisa)}</td> `;
    tableBody.appendChild(row);
});

// ... (di dalam try block setelah loop tableBody.appendChild)
        
        // 1. Jalankan perhitungan hierarki
        updateMondas(); 

        // 2. Paksa update dashboard setelah sedikit jeda agar DOM selesai dirender
        setTimeout(() => {
            console.log("Memulai Update Dashboard dari Load Data...");
            updateDashboardTotal();
        }, 200);

    } catch (err) {
        console.error("Error loading data:", err);
        tableBody.innerHTML = "<tr><td colspan='9' class='text-center text-danger'>Gagal memuat: " + err.message + "</td></tr>";
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
const checkAllMaster = document.getElementById('checkAllMaster');

checkAllMaster.addEventListener('change', function() {
    const checkboxes = tableBody.querySelectorAll('.row-checkbox');
    
    checkboxes.forEach(cb => {
        const row = cb.closest('tr');
        if (row.style.display !== 'none') {
            cb.checked = this.checked;
        }
    });
});

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
// =====================================================================
// 9. TOTAL DAS1
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

    // 1. Hitung Pagu Tanpa Blokir
    const paguNetto = totals.pagu - totals.blokir;

    // 2. Mapping ID sesuai HTML Anda
    const elPaguNetto = document.getElementById('statTotalPagu'); // Box: PAGU TANPA BLOKIR
    const elRPD       = document.getElementById('statTotalRPD');  // Box: TOTAL RPD
    const elPaguAll   = document.getElementById('statTotalPaguAll'); // Box: TOTAL PAGU (Jika ada)
    const elBlokir    = document.getElementById('statTotalBlokir');
    const elReal      = document.getElementById('statTotalRealisasi');

    // 3. Update Tampilan
    if (elPaguNetto) elPaguNetto.textContent = toRp(paguNetto);
    if (elRPD)       elRPD.textContent = toRp(totals.rpd);
    if (elBlokir)    elBlokir.textContent = toRp(totals.blokir);
    if (elReal)      elReal.textContent = toRp(totals.real);
    if (elPaguAll)   elPaguAll.textContent = toRp(totals.pagu);
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

document.addEventListener('DOMContentLoaded', () => {
    initMoneyInputs();
    loadDataFromSupabase();
});
