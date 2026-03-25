/**
 * RPD_REPORT_SYSTEM_V1.0
 * Fokus: Hanya data Rencana Penarikan Dana (RPD)
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
        // 1. Ambil data Level 3 dari database (Kategori 51, 52, 53)
        const { data, error } = await _supabase
            .from('anggaran')
            .select('kode, nama, pagu, blokir, rpd_bulanan, level')
            .eq('level', 3);

        if (error) throw error;
        if (!data || data.length === 0) return;

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
            let prefix = "";
            
            if (label.includes("PEGAWAI")) prefix = "51";
            else if (label.includes("BARANG")) prefix = "52";
            else if (label.includes("MODAL")) prefix = "53";

            // Filter item berdasarkan prefix kode baris
            const categoryData = data.filter(item => String(item.kode).startsWith(prefix));

            let totalPagu = 0;
            let totalBlokir = 0;
            let rowRM = Array(12).fill(0);
            let rowPNBP = Array(12).fill(0);

            categoryData.forEach(item => {
                const kode = String(item.kode).toUpperCase();
                let rpd = item.rpd_bulanan;
                
                // Pastikan RPD dibaca sebagai array
                if (typeof rpd === 'string') {
                    try { rpd = JSON.parse(rpd); } catch(e) { rpd = []; }
                }
                if (!Array.isArray(rpd)) rpd = new Array(12).fill(0);

                totalPagu += parseFloat(item.pagu) || 0;
                totalBlokir += parseFloat(item.blokir) || 0;

                // Pisahkan RM dan PNBP hanya dari data RPD
                for (let i = 0; i < 12; i++) {
                    const nilaiRPD = parseFloat(rpd[i]) || 0;
                    if (kode.endsWith('R')) {
                        rowRM[i] += nilaiRPD;
                        grandTotals.monthsRM[i] += nilaiRPD;
                    } else if (kode.endsWith('P')) {
                        rowPNBP[i] += nilaiRPD;
                        grandTotals.monthsPNBP[i] += nilaiRPD;
                    }
                }
            });

            const totalNeto = totalPagu - totalBlokir;
            row.cells[1].innerText = toRp(totalPagu);
            row.cells[2].innerText = toRp(totalBlokir);
            row.cells[3].innerText = toRp(totalNeto);

            // Perhitungan Akumulasi Progres RPD per Baris
            let akumulasiRPDBaris = 0;

            for (let i = 0; i < 12; i++) {
                const startCol = 4 + (i * 4);
                const rpdBulanIni = rowRM[i] + rowPNBP[i];
                akumulasiRPDBaris += rpdBulanIni;
                
                const persenProgres = totalNeto > 0 
                    ? ((akumulasiRPDBaris / totalNeto) * 100).toFixed(2) + '%' 
                    : '0.00%';

                row.cells[startCol].innerText = toRp(rowRM[i]);
                row.cells[startCol + 1].innerText = toRp(rowPNBP[i]);
                row.cells[startCol + 2].innerText = toRp(rpdBulanIni);
                row.cells[startCol + 3].innerText = persenProgres; 

                grandTotals.monthsTotal[i] += rpdBulanIni;
            }

            grandTotals.pagu += totalPagu;
            grandTotals.blokir += totalBlokir;
            grandTotals.neto += totalNeto;
        });

        updateFooter(grandTotals);

    } catch (err) {
        console.error("RPD Load Error:", err.message);
    }
}

function updateFooter(totals) {
    const footer = document.querySelector('.row-total-90s');
    if (!footer) return;

    footer.cells[1].innerText = toRp(totals.pagu);
    footer.cells[2].innerText = toRp(totals.blokir);
    footer.cells[3].innerText = toRp(totals.neto);

    let akumulasiRPDFooter = 0;

    for (let i = 0; i < 12; i++) {
        const colIdx = 4 + (i * 4);
        const totalBulanIni = totals.monthsTotal[i];
        akumulasiRPDFooter += totalBulanIni;

        const persenProgresTotal = totals.neto > 0 
            ? ((akumulasiRPDFooter / totals.neto) * 100).toFixed(2) + '%' 
            : '0.00%';

        footer.cells[colIdx].innerText = toRp(totals.monthsRM[i]);
        footer.cells[colIdx + 1].innerText = toRp(totals.monthsPNBP[i]);
        footer.cells[colIdx + 2].innerText = toRp(totalBulanIni);
        footer.cells[colIdx + 3].innerText = persenProgresTotal;
    }
}