/**
 * monitoring.js - Penyesuaian Grid dengan Switcher RPD/REAL
 */

const { createClient } = window.supabase; 
const _supabase = createClient('https://ldkefnlnpgwgxznemzol.supabase.co', 'sb_publishable_VG1TQwsg40s9ngumFAy-CQ_ORaBQKHG');

const containerData = document.getElementById('CON2');
let currentMode = 'RPD'; // State untuk melacak mode aktif

// =====================================================================
// HELPER UTAMA
// =====================================================================
const toRp = (num) => {
    if (num === null || num === undefined) return "0";
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

/**
 * Parser Fleksibel: Mengubah data mentah (String/Array) menjadi Array 12 Bulan
 */
const parseBulanan = (data) => {
    if (!data) return new Array(12).fill(0);
    
    // Jika data sudah berupa Array (JSON dari Supabase)
    if (Array.isArray(data)) return data;

    // Jika data berupa string JSON "[0,0,100...]"
    if (typeof data === 'string' && data.startsWith('[')) {
        try { return JSON.parse(data); } catch (e) { return new Array(12).fill(0); }
    }

    // Jika data berupa string dengan pemisah pipa "0|0|100..."
    if (typeof data === 'string' && data.includes('|')) {
        return data.split('|').map(Number);
    }

    return new Array(12).fill(0);
};

// =====================================================================
// CORE FUNCTION: LOAD & RENDER
// =====================================================================
async function loadMonitoringData(mode = 'RPD') {
    if (!containerData) return console.error("Elemen CON2 tidak ditemukan di HTML!");
    currentMode = mode; 

    containerData.innerHTML = `<div style='padding:20px; color:#4ade80; text-align:center;'>MEMUAT DATA ${mode}...</div>`;

    try {
        const { data, error } = await _supabase
            .from('anggaran')
            .select('*')
            .order('sort_order', { ascending: true });

        if (error) throw error;
        if (!data || data.length === 0) {
            containerData.innerHTML = "<div style='text-align:center; padding:20px; color:orange;'>Data kosong di database Cloud.</div>";
            return;
        }

        containerData.innerHTML = ""; 

        data.forEach(item => {
            const rawData = mode === 'RPD' ? item.rpd_bulanan : item.real_bulanan;
            const bulananArr = parseBulanan(rawData);
            
            const row = document.createElement('div');
            row.className = `grid-row lvl-${item.level}`;
            
            let bulanHTML = `<div class="col-bulan-inputs">`; 
            bulananArr.forEach(val => {
                bulanHTML += `<span class="input-bulan-cell">${toRp(val)}</span>`;
            });
            bulanHTML += `</div>`;

            // 1. Tentukan Total yang tampil di kolom TOTAL (sesuai mode RPD/REAL)
            const totalTampil = mode === 'RPD' ? (item.rpd_total || 0) : (item.real_total || 0);

            // 2. LOGIKA BARU SISA: Pagu - Blokir - Realisasi
            // Catatan: Kita selalu menggunakan item.real_total sebagai pengurang Realisasi
            const pagu      = item.pagu || 0;
            const blokir    = item.blokir || 0;
            const realisasi = item.real_total || 0; 
            
            const sisa = pagu - blokir - realisasi;

            row.innerHTML = `
                <div class="col-kode lvl-${item.level}">${item.kode || ''}</div>
                <div class="col-nama">${item.nama || ''}</div>
                <div class="col-pagu">${toRp(pagu)}</div>
                ${bulanHTML}
                <div class="col-total">${toRp(totalTampil)}</div>
                <div class="col-blokir">${toRp(blokir)}</div>
                <div class="col-sisa" style="color: ${sisa < 0 ? '#ff4d4d' : 'inherit'}; font-weight: ${sisa < 0 ? 'bold' : 'normal'};">
                    ${toRp(sisa)}
                </div>
            `;
            containerData.appendChild(row);
        });
        
    } catch (err) {
        console.error("Supabase Error:", err);
        containerData.innerHTML = `<div style='text-align:center; color:red; padding:20px;'>Error: ${err.message}</div>`;
    }
}
// =====================================================================
// EVENT LISTENERS
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
    loadMonitoringData('RPD');

    document.addEventListener('click', (e) => {
        const target = e.target;

        if (target.tagName === 'A' && target.closest('.dropdown-items')) {
            const text = target.innerText.toUpperCase();
            if (text.includes('RPD')) {
                e.preventDefault();
                loadMonitoringData('RPD');
            } else if (text.includes('REAL')) {
                e.preventDefault();
                loadMonitoringData('REAL');
            }
        }

        if (target.id === 'btnPDF' || target.closest('#btnPDF')) {
            e.preventDefault();
            exportToPDF();
        }
    });
});
async function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a2'); 

    // 1. Tentukan Judul Berdasarkan Konteks (Gunakan variabel global atau cek state data)
    // Asumsi: Anda memiliki variabel global 'currentMode' atau cek dari teks UI
    const reportTitle = (typeof currentMode !== 'undefined' && currentMode === 'REAL')
        ? "REALISASI PENARIKAN DANA BULANAN" 
        : "RENCANA PENARIKAN DANA ( RPD ) BULANAN";

    const headers = [["KODE", "NAMA KEGIATAN", "PAGU", "JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGS", "SEP", "OKT", "NOV", "DES", "TOTAL", "BLOKIR", "SISA DANA"]];
    const tableData = [];
    const rows = document.querySelectorAll('#CON2 .grid-row');

    rows.forEach(row => {
        const rowData = [];
        rowData.push(row.querySelector('.col-kode')?.innerText || "");
        rowData.push(row.querySelector('.col-nama')?.innerText || "");
        rowData.push(row.querySelector('.col-pagu')?.innerText || "");
        row.querySelectorAll('.input-bulan-cell').forEach(cell => rowData.push(cell.innerText || "0"));
        rowData.push(row.querySelector('.col-total')?.innerText || "0");
        rowData.push(row.querySelector('.col-blokir')?.innerText || "0");
        rowData.push(row.querySelector('.col-sisa')?.innerText || "0");
        tableData.push(rowData);
    });

    // 2. Render Tabel dengan Header di Setiap Halaman
    doc.autoTable({
        head: headers,
        body: tableData,
        startY: 40,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [225, 29, 72] },
        columnStyles: {
            1: { cellWidth: 'auto' },
            2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' },
            5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' },
            8: { halign: 'right' }, 9: { halign: 'right' }, 10: { halign: 'right' },
            11: { halign: 'right' }, 12: { halign: 'right' }, 13: { halign: 'right' },
            14: { halign: 'right' }, 15: { halign: 'right' }, 16: { halign: 'right' },
            17: { halign: 'right' }
        },
        // Fungsi ini dipanggil setiap kali halaman baru dibuat
        didDrawPage: (data) => {
            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.text(reportTitle, data.settings.margin.left, 20);
            
            doc.setFontSize(11);
            doc.setFont("helvetica", "normal");
            doc.text("Laporan Anggaran Tahun 2026", data.settings.margin.left, 28);
            doc.text(`Halaman ${doc.internal.getNumberOfPages()}`, doc.internal.pageSize.getWidth() - 40, 20);
        },
        margin: { top: 40 }
    });

    // 3. Logika Footer (Tanda Tangan) - Muncul di Halaman Terakhir
    const finalY = doc.lastAutoTable.finalY;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const signX = pageWidth - 120; // Posisi horizontal tanda tangan

    // Jika sisa ruang di bawah tabel tidak cukup untuk tanda tangan (butuh sekitar 60mm)
    // maka pindah ke halaman baru
    if (finalY + 60 > pageHeight) {
        doc.addPage();
        var currentY = 40; // Mulai dari atas di halaman baru
    } else {
        var currentY = finalY + 20;
    }

    const opsiTanggal = { day: 'numeric', month: 'long', year: 'numeric' };
    const tanggalCetak = new Intl.DateTimeFormat('id-ID', opsiTanggal).format(new Date());

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Palangka Raya, ${tanggalCetak}`, signX, currentY);
    doc.text("Analis Anggaran Ahli Pertama", signX, currentY + 8);
    
    doc.setFont("helvetica", "bold");
    doc.text("Taufik Hidayat", signX, currentY + 38);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("199604092025041002", signX, currentY + 45);

    doc.save(`Laporan_Monitoring.pdf`);
}
