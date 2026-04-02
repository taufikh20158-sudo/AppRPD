/**
 * RPD_REPORT_SYSTEM_V1.2 - HYBRID LOGIC
 * Logika: 
 * - Bulan Lewat & Berjalan: Pakai REALISASI
 * - Bulan Belum Berjalan: Pakai RPD
 */

const { createClient } = window.supabase;
const _supabase = createClient('https://ldkefnlnpgwgxznemzol.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxka2VmbmxucGd3Z3h6bmVtem9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODE5NDYsImV4cCI6MjA4NzY1Nzk0Nn0.aRvd4POq_HdTdYVAU-Nl-RFNjeqgPjbNteRYyDdUIvE');

const toRp = (num) => {
    if (!num || isNaN(num)) return "0";
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

document.addEventListener('DOMContentLoaded', async () => {
    await loadAndFillReport();
});

async function loadAndFillReport() {
    try {
        // Ambil data dari Supabase
        const { data, error } = await _supabase
            .from('anggaran')
            .select('kode, nama, pagu, blokir, rpd_bulanan, real_bulanan, level')
            .eq('level', 3);

        if (error) throw error;
        if (!data || data.length === 0) return;

        // Mendapatkan bulan saat ini (0 = Jan, 3 = April, dst)
        const currentMonth = new Date().getMonth(); 

        const tbody = document.getElementById('reportTableBody');
        const rows = tbody.querySelectorAll('tr[data-level="3"]');
        
        let grandTotals = { 
            pagu: 0, 
            blokir: 0, 
            neto: 0, 
            monthsRM: Array(12).fill(0), 
            monthsPNBP: Array(12).fill(0),
            monthsTotal: Array(12).fill(0) 
        };

        rows.forEach(row => {
            const label = row.cells[0].innerText.trim().toUpperCase();
            let prefix = label.includes("PEGAWAI") ? "51" : label.includes("BARANG") ? "52" : "53";

            const categoryData = data.filter(item => String(item.kode).startsWith(prefix));

            let totalPagu = 0, totalBlokir = 0;
            let rowRM = Array(12).fill(0), rowPNBP = Array(12).fill(0);

            categoryData.forEach(item => {
                const kode = String(item.kode).toUpperCase();
                const rpdArr = Array.isArray(item.rpd_bulanan) ? item.rpd_bulanan : new Array(12).fill(0);
                const realArr = Array.isArray(item.real_bulanan) ? item.real_bulanan : new Array(12).fill(0);

                totalPagu += parseFloat(item.pagu) || 0;
                totalBlokir += parseFloat(item.blokir) || 0;

                for (let i = 0; i < 12; i++) {
                    const vRPD = parseFloat(rpdArr[i]) || 0;
                    const vReal = parseFloat(realArr[i]) || 0;

                    /**
                     * PENERAPAN LOGIKA BARU:
                     * i <= currentMonth: Bulan lewat atau sedang berjalan -> Pakai Realisasi
                     * i > currentMonth: Bulan belum berjalan -> Pakai RPD
                     */
                    const nilaiFinal = (i <= currentMonth) ? vReal : vRPD;

                    if (kode.endsWith('R')) {
                        rowRM[i] += nilaiFinal;
                        grandTotals.monthsRM[i] += nilaiFinal;
                    } else if (kode.endsWith('P')) {
                        rowPNBP[i] += nilaiFinal;
                        grandTotals.monthsPNBP[i] += nilaiFinal;
                    }
                }
            });

            const totalNeto = totalPagu - totalBlokir;
            row.cells[1].innerText = toRp(totalPagu);
            row.cells[2].innerText = toRp(totalBlokir);
            row.cells[3].innerText = toRp(totalNeto);

            let akumulasiHybridBaris = 0;
            for (let i = 0; i < 12; i++) {
                const startCol = 4 + (i * 4);
                const totalBulanIni = rowRM[i] + rowPNBP[i];
                akumulasiHybridBaris += totalBulanIni;
                
                const persenProgres = totalNeto > 0 
                    ? ((akumulasiHybridBaris / totalNeto) * 100).toFixed(2) + '%' 
                    : '0.00%';

                // Tampilkan nilai di tabel
                row.cells[startCol].innerText = toRp(rowRM[i]);
                row.cells[startCol + 1].innerText = toRp(rowPNBP[i]);
                row.cells[startCol + 2].innerText = toRp(totalBulanIni);
                row.cells[startCol + 3].innerText = persenProgres; 

                grandTotals.monthsTotal[i] += totalBulanIni;
            }

            grandTotals.pagu += totalPagu;
            grandTotals.blokir += totalBlokir;
            grandTotals.neto += totalNeto;
        });

        updateFooter(grandTotals);

    } catch (err) {
        console.error("RPD Hybrid Load Error:", err.message);
    }
}

function updateFooter(totals) {
    const footer = document.querySelector('.row-total-90s');
    if (!footer) return;

    footer.cells[1].innerText = toRp(totals.pagu);
    footer.cells[2].innerText = toRp(totals.blokir);
    footer.cells[3].innerText = toRp(totals.neto);

    let akumulasiHybridFooter = 0;
    for (let i = 0; i < 12; i++) {
        const colIdx = 4 + (i * 4);
        const totalBulanIni = totals.monthsTotal[i];
        akumulasiHybridFooter += totalBulanIni;

        const persenProgresTotal = totals.neto > 0 
            ? ((akumulasiHybridFooter / totals.neto) * 100).toFixed(2) + '%' 
            : '0.00%';

        footer.cells[colIdx].innerText = toRp(totals.monthsRM[i]);
        footer.cells[colIdx + 1].innerText = toRp(totals.monthsPNBP[i]);
        footer.cells[colIdx + 2].innerText = toRp(totalBulanIni);
        footer.cells[colIdx + 3].innerText = persenProgresTotal;
    }
}
