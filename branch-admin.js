document.addEventListener('DOMContentLoaded', async () => {
    const loggedInUser = JSON.parse(sessionStorage.getItem('loggedInUser'));
        if (!loggedInUser || loggedInUser.role !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    const branchNameDisplay = document.getElementById('branch-name-display');
    const branches = await DataAPI.getBranches();
    const branchName = branches[loggedInUser.branch]?.name || 'Branch';
    branchNameDisplay.textContent = `${branchName} Admin`;

    // Initial render of transactions
    renderTransactions();
});

// --- Transaction Management ---
async function renderTransactions() {
    const sortDropdown = document.getElementById('transaction-sort-dropdown');
    const sortOrderDropdown = document.getElementById('transaction-sort-order');
    const transactionsTableBody = document.getElementById('branch-transactions-table-body');
    const searchInput = document.getElementById('transaction-search-input');
    if (!sortDropdown || !sortOrderDropdown || !transactionsTableBody) return;
    // Default to date/desc if not set
    if (!sortDropdown.value) sortDropdown.value = 'date';
    if (!sortOrderDropdown.value) sortOrderDropdown.value = 'desc';
    const sortKey = sortDropdown.value;
    const sortOrder = sortOrderDropdown.value;
    const purchases = await DataAPI.getPurchases();
    // Filter by search
    let filtered = purchases;
    if (searchInput && searchInput.value.trim() !== '') {
        const q = searchInput.value.trim().toLowerCase();
        filtered = purchases.filter(p =>
            Object.values(p).some(val =>
                (val + '').toLowerCase().startsWith(q)
            )
        );
    }
    const grouped = {};
    filtered.forEach((p) => {
        const branchId = p.branchId || p.shopName || 'Unknown';
        if (!grouped[branchId]) grouped[branchId] = [];
        grouped[branchId].push(p);
        });
    transactionsTableBody.innerHTML = '';
    if (!filtered || filtered.length === 0) {
        const row = transactionsTableBody.insertRow();
        row.innerHTML = `<td colspan="11" class="text-center text-gray-500">No transactions found.</td>`;
        return;
    }
    let branchIds = Object.keys(grouped);
    if (sortKey === 'branch') {
        branchIds = branchIds.sort((a, b) => sortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a));
    }
    branchIds.forEach(branchId => {
        const table = document.querySelector('#transactions-section table');
        const thCount = table ? table.querySelectorAll('thead th').length : 13;
        const branchRow = transactionsTableBody.insertRow();
        branchRow.innerHTML = `<td colspan="${thCount}" class="bg-gray-100 font-bold text-lg p-2">${branchId}</td>`;
        let branchTxs = grouped[branchId];
        // Sort by selected field and order
        if (sortKey === 'date') {
            branchTxs = branchTxs.slice().sort((a, b) => {
                const aTime = new Date(a.dateTime || a.date || 0).getTime();
                const bTime = new Date(b.dateTime || b.date || 0).getTime();
                return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
            });
        } else if (sortKey === 'alpha') {
            branchTxs = branchTxs.slice().sort((a, b) => {
                return sortOrder === 'asc' ? (a.clientName || '').localeCompare(b.clientName || '') : (b.clientName || '').localeCompare(a.clientName || '');
            });
        }

        branchTxs.forEach((p) => {
        // Handle multiple purchases
        let purchaseItems = '';
            let variants = '';
            let amounts = '';
        let quantities = '';
        let moneys = '';
        if (Array.isArray(p.purchases)) {
            purchaseItems = p.purchases.map(item => item.purchasedItem).join('<br>');
            variants = p.purchases.map(item => (item.variant && item.variant.trim()) ? item.variant : '<span style="color:gray">No type</span>').join('<br>');
            amounts = p.purchases.map(item => item.variant2 ? item.variant2 : (item.units || item.weight || '')).join('<br>');
            quantities = p.purchases.map(item => (item.amount !== undefined ? item.amount : '')).join('<br>');
            moneys = p.purchases.map(item => (item.money !== undefined ? item.money : '')).join('<br>');
        } else {
            purchaseItems = p.purchasedItem || '';
            variants = (p.variant && p.variant.trim()) ? p.variant : '<span style="color:gray">No type</span>';
            amounts = p.variant2 ? p.variant2 : (p.units || p.weight || '');
            quantities = (p.amount !== undefined ? p.amount : '');
            moneys = (p.money !== undefined ? p.money : '');
        }

        // Create invoice cell with both View and Download options
        let invoiceCell = '<span class="text-gray-400">No Invoice</span>';
        if (p.invoiceFileData) {
            const fileName = p.invoiceFileName || 'invoice';
            const fileData = p.invoiceFileData;
            
            // Determine MIME type from file extension
            let mimeType = 'application/octet-stream';
            if (fileName.toLowerCase().endsWith('.pdf')) {
                mimeType = 'application/pdf';
            } else if (fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/)) {
                mimeType = `image/${fileName.split('.').pop().toLowerCase()}`;
            }
            
            invoiceCell = `
                <div class="flex items-center gap-2">
                    <a href="#" class="text-blue-500 hover:text-blue-700 flex items-center invoice-action" data-action="view" data-file="${fileName}" data-mime="${mimeType}" data-content="${fileData}">
                        <i class="ri-eye-line mr-1"></i> View
                    </a>
                    <span class="text-gray-300">|</span>
                    <a href="#" class="text-blue-500 hover:text-blue-700 flex items-center invoice-action" data-action="download" data-file="${fileName}" data-mime="${mimeType}" data-content="${fileData}">
                        <i class="ri-download-line mr-1"></i> Download
                    </a>
                </div>`;
        }

        // Product Purchased Invoice
        let purchasedInvoiceCell = '<span class="text-gray-400">No Invoice</span>';
        if (p.purchasedInvoiceFileData) {
            const fileName = p.purchasedInvoiceFileName || 'purchased-invoice';
            const fileData = p.purchasedInvoiceFileData;
            
            // Determine MIME type from file extension
            let mimeType = 'application/octet-stream';
            if (fileName.toLowerCase().endsWith('.pdf')) {
                mimeType = 'application/pdf';
            } else if (fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/)) {
                mimeType = `image/${fileName.split('.').pop().toLowerCase()}`;
            }
            
            purchasedInvoiceCell = `
                <div class="flex items-center gap-2">
                    <a href="#" class="text-blue-500 hover:text-blue-700 flex items-center purchased-invoice-action" data-action="view" data-file="${fileName}" data-mime="${mimeType}" data-content="${fileData}">
                        <i class="ri-eye-line mr-1"></i> View
                    </a>
                    <span class="text-gray-300">|</span>
                    <a href="#" class="text-blue-500 hover:text-blue-700 flex items-center purchased-invoice-action" data-action="download" data-file="${fileName}" data-mime="${mimeType}" data-content="${fileData}">
                        <i class="ri-download-line mr-1"></i> Download
                    </a>
                </div>`;
        }

        const row = transactionsTableBody.insertRow();
        row.innerHTML = `
            <td class="p-3">${p.clientName || ''}</td>
            <td class="p-3">${p.phoneNumber || ''}</td>
            <td class="p-3">${purchaseItems}</td>
            <td class="p-3">${variants}</td>
            <td class="p-3">${amounts}</td>
            <td class="p-3">${quantities}</td>
            <td class="p-3">${moneys}</td>
            <td class="p-3">${p.dateTime || ''}</td>
            <td class="p-3">${invoiceCell}</td>
            <td class="p-3">${purchasedInvoiceCell}</td>
            <td class="p-3">${p.invoiceNumber || ''}</td>
            <td class="p-3">${p.comment || ''}</td>
        `;
    });

    // Update invoice link handlers to handle both view and download
    document.querySelectorAll('.invoice-action').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const action = this.getAttribute('data-action');
            const fileName = this.getAttribute('data-file');
            const mimeType = this.getAttribute('data-mime');
            const fileContent = this.getAttribute('data-content');
            
            if (fileContent) {
                const byteCharacters = atob(fileContent.split(',')[1]);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: mimeType });
                
                if (action === 'view') {
                    // Open in new tab for viewing
                    const url = URL.createObjectURL(blob);
                    window.open(url, '_blank');
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                } else if (action === 'download') {
                    // Create download link
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }, 1000);
                }
            }
        });
    });

    // Add purchased invoice link handlers
    document.querySelectorAll('.purchased-invoice-action').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const action = this.getAttribute('data-action');
            const fileName = this.getAttribute('data-file');
            const mimeType = this.getAttribute('data-mime');
            const fileContent = this.getAttribute('data-content');
            
            if (fileContent) {
                const byteCharacters = atob(fileContent.split(',')[1]);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: mimeType });
                
                if (action === 'view') {
                    // Open in new tab for viewing
                    const url = URL.createObjectURL(blob);
                    window.open(url, '_blank');
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                } else if (action === 'download') {
                    // Create download link
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }, 1000);
                }
            }
            });
        });
    });
}

const transactionSortDropdown = document.getElementById('transaction-sort-dropdown');
if (transactionSortDropdown) transactionSortDropdown.onchange = renderTransactions;
const transactionSortOrder = document.getElementById('transaction-sort-order');
if (transactionSortOrder) transactionSortOrder.onchange = renderTransactions;
const transactionSearchInput = document.getElementById('transaction-search-input');
if (transactionSearchInput) transactionSearchInput.removeEventListener('input', renderTransactions);
if (transactionSearchInput) transactionSearchInput.addEventListener('input', renderTransactions);

function logout() {
    sessionStorage.removeItem('loggedInUser');
    sessionStorage.setItem('logoutMessage', 'Logging out...');
    window.location.href = 'loading.html';
}