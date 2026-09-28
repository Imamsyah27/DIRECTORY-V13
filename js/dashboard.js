async function loadData() {
    const loadingState = document.getElementById("tableLoadingState");
    const emptyState = document.getElementById("tableEmptyState");
    const todayUTC = getUTCDate();

    loadingState.style.display = "flex";
    emptyState.style.display = "none";
    tbody.innerHTML = "";

    const { data, error } = await supabaseClient
        .from("orders")
        .select("*")
        .eq("dashboard", currentDashboard)
        .order("id", { ascending: true });

    loadingState.style.display = "none";

    if (error) {
        console.error(error);
        showToast("Gagal memuat data pesanan", "danger");
        return;
    }

    // Data arsip kini disimpan di tabel `archives` Supabase — pesanan yang
    // sudah diarsipkan sudah dihapus dari tabel `orders`, jadi tidak perlu
    // difilter lagi di sisi frontend.
    const activeData = data;

    const total = activeData.length;
    const selesai = activeData.filter(x => x.paket_terkirim >= x.paket_total).length;
    const mendekatiLimit = activeData.filter(x => {
        const s = getOrderStatus(x.paket_terkirim, x.paket_total);
        return s.key === "mendekati";
    }).length;
    const proses = total - selesai;

    document.getElementById("totalOrder").innerText = total;
    document.getElementById("prosesOrder").innerText = proses;
    document.getElementById("selesaiOrder").innerText = selesai;
    document.getElementById("limitOrder").innerText = mendekatiLimit;
    document.getElementById("archiveCountBadge").innerText = await getArchiveCount();

    if (activeData.length === 0) {
        emptyState.style.display = "flex";
        return;
    }

    for (let i = 0; i < activeData.length; i++) {
        const item = activeData[i];

        const sudahCheck = item.last_check_utc === todayUTC;
        const status = getOrderStatus(item.paket_terkirim, item.paket_total);
        const limitReached = item.paket_terkirim >= item.paket_total;
        const percent = Math.min(100, Math.round((item.paket_terkirim / item.paket_total) * 100));

        const wa = item.nomor_whatsapp || "-";
        const ket = item.keterangan || "";

        const tr = document.createElement("tr");
        tr.dataset.status = status.key;

        const actionsHtml = limitReached
            ? `
                <button class="btn btn-archive btn-wrap" style="padding:8px 12px; font-size:12px;" onclick="handleArchiveOrder(${item.id})">📥 Simpan ke Arsip</button>
                <button class="btn btn-ghost btn-icon" onclick="editOrder(${item.id})" title="Edit">✏️</button>
                <button class="btn btn-danger btn-icon" onclick="deleteOrder(${item.id})" title="Hapus">🗑</button>
            `
            : `
                <button class="btn btn-success btn-icon" onclick="checkDaily(${item.id})" ${sudahCheck ? "disabled" : ""} title="Centang kirim hari ini">✓</button>
                <button class="btn btn-ghost btn-icon" onclick="editOrder(${item.id})" title="Edit">✏️</button>
                <button class="btn btn-danger btn-icon" onclick="deleteOrder(${item.id})" title="Hapus">🗑</button>
            `;

        tr.innerHTML = `
            <td data-label="No">${i + 1}</td>

            <td data-label="Nama Pemesan"><span class="customer-order-num">${i + 1}</span><span class="customer-name">${escapeHtml(item.nomor_pesanan)}</span></td>

            <td data-label="Tagar">
                <span class="copy-tag" onclick="copyTag('${escapeHtml(item.tagar)}')">${escapeHtml(item.tagar)}</span>
            </td>

            <td data-label="WhatsApp">${escapeHtml(wa)}</td>

            <td data-label="Progress" class="progress-cell">
                <div class="progress-text">H${item.paket_terkirim}/H${item.paket_total}</div>
                <div class="progress-track">
                    <div class="progress-fill ${status.barClass}" style="width:${percent}%;"></div>
                </div>
            </td>

            <td data-label="Status">
                <span class="badge ${status.badgeClass}">${status.icon} ${status.label}</span>
            </td>

            <td data-label="Aksi">
                <div class="actions-cell">${actionsHtml}</div>
            </td>

            <td data-label="Keterangan">
                <span class="keterangan-text" data-copy="${escapeHtml(ket)}" onclick="copyKeterangan('${escapeHtml(ket)}')">${escapeHtml(ket)}</span>
            </td>
        `;

        tbody.appendChild(tr);
    }

    // terapkan ulang filter pencarian yang mungkin sedang aktif
    filterTable();
}

function handleArchiveOrder(id) {
    openConfirmModal({
        icon: "📥",
        iconClass: "archive",
        title: "Simpan ke Arsip?",
        body: "Pesanan ini sudah mencapai limit pengiriman dan akan dipindahkan ke <b>Data Arsip</b>. Data tidak akan hilang dan bisa dipulihkan kapan saja.",
        confirmText: "Simpan ke Arsip",
        confirmClass: "btn-archive",
        onConfirm: async () => {
            const { data, error } = await supabaseClient
                .from("orders")
                .select("*")
                .eq("id", id)
                .single();

            if (error || !data) {
                showToast("Gagal mengambil data pesanan", "danger");
                return;
            }

            const success = await archiveOrder(data);
            if (!success) return;

            loadData();
            showToast("Pesanan dipindahkan ke Data Arsip", "archive");
        }
    });
}

async function deleteOrder(id) {
    openConfirmModal({
        icon: "🗑",
        iconClass: "danger",
        title: "Hapus Pesanan?",
        body: "Tindakan ini akan menghapus data pesanan secara permanen dan tidak dapat dibatalkan.",
        confirmText: "Ya, Hapus",
        confirmClass: "btn-danger",
        onConfirm: async () => {
            await supabaseClient.from("orders").delete().eq("id", id);
            loadData();
            showToast("Pesanan berhasil dihapus", "danger");
        }
    });
}

async function editOrder(id) {
    const { data, error } = await supabaseClient
        .from("orders")
        .select("*")
        .eq("id", id)
        .single();

    if (error || !data) {
        showToast("Gagal memuat data pesanan", "danger");
        return;
    }

    openEditModal(data, async ({ nomor, tagar, wa, paket, terkirim }) => {
        const ket = createKeterangan(tagar, terkirim, paket, wa);

        const { error: updateError } = await supabaseClient
            .from("orders")
            .update({
                nomor_pesanan: nomor,
                tagar: tagar,
                nomor_whatsapp: wa,
                paket_total: paket,
                paket_terkirim: terkirim,
                keterangan: ket
            })
            .eq("id", id);

        if (updateError) {
            console.error(updateError);
            showToast("Gagal menyimpan perubahan pesanan", "danger");
            return;
        }

        loadData();
        showToast("Perubahan pesanan disimpan", "success");
    });
}
