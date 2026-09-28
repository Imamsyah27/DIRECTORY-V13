function getUTCDate() {
    return new Date().toISOString().split("T")[0];
}

async function copyTag(tagar) {
    try {
        await navigator.clipboard.writeText(tagar);
        showToast(`Tagar "${tagar}" disalin`, "success");
    } catch (err) {
        console.error(err);
        showToast("Gagal menyalin tagar", "danger");
    }
}

/**
 * Menyalin semua tagar yang sedang tampil di tabel (menghormati filter
 * pencarian yang aktif) sebagai satu blok teks, satu tagar per baris.
 */
async function copyAllTags() {
    const rows = Array.from(document.querySelectorAll("#tableBody tr"))
        .filter(row => row.style.display !== "none");

    const tags = rows
        .map(row => row.querySelector(".copy-tag")?.innerText.trim())
        .filter(Boolean);

    if (tags.length === 0) {
        showToast("Tidak ada tagar untuk disalin", "danger");
        return;
    }

    try {
        await navigator.clipboard.writeText(tags.join("\n"));
        showToast(`${tags.length} tagar berhasil disalin`, "success");
    } catch (err) {
        console.error(err);
        showToast("Gagal menyalin tagar", "danger");
    }
}

async function copyKeterangan(keterangan) {
    try {
        await navigator.clipboard.writeText(keterangan);
        showToast("Keterangan berhasil disalin", "success");
    } catch (err) {
        console.error(err);
        showToast("Gagal menyalin keterangan", "danger");
    }
}

function formatPaket(terkirim, total) {
    return `H${terkirim}/H${total}`;
}

function createKeterangan(tagar, terkirim, total, whatsapp) {
    const paket = formatPaket(terkirim, total);
    const wa = whatsapp ? `https://wa.me/${whatsapp.replace("+", "")}` : "";
    return `${tagar} | ${paket} | ${wa}`;
}

function validWhatsapp(nomor) {
    return /^\+\d+$/.test(nomor);
}

function filterTable() {
    const value = document.getElementById("searchInput").value.toLowerCase();
    const statusSelect = document.getElementById("statusFilterSelect");
    const statusValue = statusSelect ? statusSelect.value : "semua";

    const rows = document.querySelectorAll("#tableBody tr");
    let visibleCount = 0;

    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        const matchSearch = text.includes(value);
        const matchStatus = statusValue === "semua" || row.dataset.status === statusValue;
        const match = matchSearch && matchStatus;
        row.style.display = match ? "" : "none";
        if (match) visibleCount++;
    });

    const emptyState = document.getElementById("tableEmptyState");
    if (emptyState) {
        emptyState.style.display = (visibleCount === 0) ? "flex" : "none";
    }
}

/**
 * Dipanggil saat kartu statistik (Total/Proses/Mendekati Limit/Selesai)
 * diklik, supaya jadi jalan pintas filter tanpa perlu buka dropdown.
 * "selesai" di sini = langganan yang paket_terkirim-nya sudah mencapai
 * paket_total (Limit Tercapai).
 */
function applyStatusFilter(statusKey) {
    const select = document.getElementById("statusFilterSelect");
    if (select) select.value = statusKey;
    filterTable();

    document.querySelectorAll(".stat-card").forEach(c => c.classList.remove("stat-card-active"));
    const cardMap = { proses: ".stat-card.proses", mendekati: ".stat-card.limit", selesai: ".stat-card.selesai", semua: ".stat-card.total" };
    const activeCard = document.querySelector(cardMap[statusKey]);
    if (activeCard) activeCard.classList.add("stat-card-active");
}

/**
 * Menentukan status pesanan berdasarkan progress pengiriman.
 * Threshold "mendekati limit": >= 80% namun belum 100%.
 */
function getOrderStatus(terkirim, total) {
    if (total <= 0) return { key: "proses", label: "Proses", badgeClass: "badge-proses", icon: "⏳", barClass: "ok" };

    const ratio = terkirim / total;

    if (terkirim >= total) {
        return { key: "selesai", label: "Limit Tercapai", badgeClass: "badge-done", icon: "✅", barClass: "done" };
    }
    if (ratio >= 0.8) {
        return { key: "mendekati", label: "Mendekati Limit", badgeClass: "badge-warn", icon: "⚠️", barClass: "warn" };
    }
    return { key: "proses", label: "Proses", badgeClass: "badge-proses", icon: "⏳", barClass: "ok" };
}

function formatDateHuman(dateInput) {
    if (!dateInput) return "-";
    try {
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return "-";
        return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    } catch (e) {
        return "-";
    }
}

function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

/* ---------------- Toast ---------------- */
function showToast(message, type = "info") {
    const stack = document.getElementById("toastStack");
    if (!stack) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerText = message;
    stack.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transition = "opacity .2s ease";
        setTimeout(() => toast.remove(), 200);
    }, 2600);
}
