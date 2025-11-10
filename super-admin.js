// Function to populate all branch-related select elements
async function populateAllBranchSelects() {
    const branches = await DataAPI.getBranches();
    
    // --- Populate client-branch dropdown (for "Add Client") ---
    const clientBranchSelect = document.getElementById('client-branch');
    if (clientBranchSelect) {
        const currentClientBranchSelected = clientBranchSelect.value; // Store current selection
        let clientOptionsHtml = ['<option value="">Select shop</option>']; 
        if (Object.keys(branches).length === 0) {
            clientOptionsHtml[0] = '<option value="">No Shops available</option>'; 
        } else {
            for (const id of Object.keys(branches)) {
                clientOptionsHtml.push(`<option value="${id}">${branches[id].name}</option>`);
            }
        }
        clientBranchSelect.innerHTML = clientOptionsHtml.join('');
        // Restore selection or set to default
        if (currentClientBranchSelected && clientBranchSelect.querySelector(`option[value="${currentClientBranchSelected}"]`)) {
            clientBranchSelect.value = currentClientBranchSelected;
        } else {
            clientBranchSelect.value = ''; 
        }
    }

    // --- Populate excel-branch-filter dropdown (for "Download Transaction Report") ---
    const excelBranchFilter = document.getElementById('excel-branch-filter');
    if (excelBranchFilter) {
        const currentExcelSelected = excelBranchFilter.value; // Store current selection
        let excelOptionsHtml = ['<option value="">📋 All Shops (Download everything)</option>'];
        if (Object.keys(branches).length > 0) {
             for (const id of Object.keys(branches)) {
                excelOptionsHtml.push(`<option value="${id}">${branches[id].name}</option>`);
            }
        }
        excelBranchFilter.innerHTML = excelOptionsHtml.join('');
        // Restore selection or set to default
        if (currentExcelSelected && excelBranchFilter.querySelector(`option[value="${currentExcelSelected}"]`)) {
            excelBranchFilter.value = currentExcelSelected;
        } else {
            excelBranchFilter.value = ''; 
        }
    }
}

// --- Clients Table ---
async function renderClients() {
    const sortDropdown = document.getElementById('client-sort-dropdown');
    const sortOrderDropdown = document.getElementById('client-sort-order');
    const clientTable = document.getElementById('clients-table-body');
    if (!sortDropdown || !sortOrderDropdown || !clientTable) return;
    const sortKey = sortDropdown.value;
    const sortOrder = sortOrderDropdown.value;
    const searchInput = document.getElementById('client-search-input');
    const searchValue = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const clients = await DataAPI.getClients();
    let clientList = [];
    for (const branch in clients) {
        const branchClients = Array.isArray(clients[branch]) ? 
            clients[branch] : 
            Object.values(clients[branch] || {});
        branchClients.forEach((c, i) => {
            if (c && c.name) {
                clientList.push({ ...c, branch, branchIndex: i });
            }
        });
    }
    // Filter by search
    if (searchValue) {
        clientList = clientList.filter(c =>
            c.name.toLowerCase().includes(searchValue) ||
            (c.phoneNumber || '').toLowerCase().includes(searchValue) ||
            (c.branch || '').toLowerCase().includes(searchValue)
        );
        console.log('[Clients] Filtered by search:', searchValue, clientList);
    }
    // Sort
    if (sortKey === 'name') {
        clientList.sort((a, b) => sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    } else if (sortKey === 'phone') {
        clientList.sort((a, b) => sortOrder === 'asc' ? (a.phoneNumber || '').localeCompare(b.phoneNumber || '') : (b.phoneNumber || '').localeCompare(a.phoneNumber || ''));
    } else if (sortKey === 'branch') {
        clientList.sort((a, b) => sortOrder === 'asc' ? a.branch.localeCompare(b.branch) : b.branch.localeCompare(a.branch));
    }
    clientTable.innerHTML = '';
    if (clientList.length === 0) {
        const row = clientTable.insertRow();
        row.innerHTML = `<td colspan="4" class="text-center text-gray-500">No clients found.</td>`;
        return;
    }
    clientList.forEach((c, idx) => {
        const row = clientTable.insertRow();
        row.setAttribute('data-branch', c.branch);
        row.setAttribute('data-branch-index', c.branchIndex);
        row.setAttribute('data-client-id', c.id);
        row.innerHTML = `
            <td class="p-2 client-name-cell">${c.name}</td>
            <td class="p-2 client-phone-cell">${c.phoneNumber || ''}</td>
            <td class="p-2">${c.branch}</td>
            <td class="p-2 flex gap-2">
                <button class="edit-client-btn text-blue-600 hover:text-blue-900"><i class="ri-pencil-line"></i></button>
                <button data-delete-type="client" data-branch="${c.branch}" data-index="${c.branchIndex}" class="delete-client-btn text-red-600 hover:text-red-900"><i class="ri-delete-bin-line"></i></button>
            </td>
        `;
    });
    // Attach event listeners after rendering
    attachClientSortAndSearchListeners();
}

function attachClientSortAndSearchListeners() {
    const sortDropdown = document.getElementById('client-sort-dropdown');
    const sortOrderDropdown = document.getElementById('client-sort-order');
    const searchInput = document.getElementById('client-search-input');
    if (sortDropdown) sortDropdown.onchange = () => { console.log('[Clients] Sort changed'); renderClients(); };
    if (sortOrderDropdown) sortOrderDropdown.onchange = () => { console.log('[Clients] Sort order changed'); renderClients(); };
    if (searchInput) searchInput.oninput = () => { console.log('[Clients] Search input'); renderClients(); };
}

// Add a search input to the client section if not present
if (document.getElementById('clients-section') && !document.getElementById('client-search-input')) {
    const section = document.getElementById('clients-section');
    const controlsDiv = section.querySelector('.flex.gap-2');
    if (controlsDiv) {
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.id = 'client-search-input';
        searchInput.placeholder = 'Search clients...';
        searchInput.className = 'border rounded px-2 py-1 text-sm';
        controlsDiv.insertBefore(searchInput, controlsDiv.firstChild);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Super admin JS loaded');
    const loggedInUser = JSON.parse(sessionStorage.getItem('loggedInUser'));
    if (!loggedInUser || loggedInUser.role !== 'superadmin') {
        window.location.href = 'login.html';
        return;
    }

    // Set sidebar heading immediately on page load
    const sidebarHeading = document.getElementById('sidebar-superadmin-heading');
    console.log('Sidebar heading element:', sidebarHeading);
    if (sidebarHeading && loggedInUser && loggedInUser.role === 'superadmin') {
        if (loggedInUser.username === 'superadmin') {
            sidebarHeading.textContent = 'Super Admin';
            sidebarHeading.className = 'text-lg font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-transparent bg-clip-text mb-6';
            console.log('Sidebar heading set to: Super Admin (rainbow)');
        } else {
            sidebarHeading.textContent = loggedInUser.username;
            sidebarHeading.className = 'text-lg font-bold text-gray-800 mb-6';
            console.log('Sidebar heading set to:', loggedInUser.username);
        }
    } else {
        console.log('Sidebar heading not set: missing element or user.');
    }

    // Reference the forms using their specific IDs now
    const branchForm = document.getElementById('branch-form-actual');
    const clientForm = document.getElementById('client-form-actual');

    // Initial render of all sections
    await renderTransactions();
    await renderUsers(); 
    await renderBranches();
    await renderClients();
    await populateAllBranchSelects(); // Call the unified function
        
    // --- Advanced Excel Export Logic ---
    // The branch filter population is now handled by populateAllBranchSelects,
    // so we just need to initialize event listeners for the export section.
    initializeExcelExportEventListeners(); 

    // --- Excel Import Clients Listener (REVISED: match master admin logic) ---
    const importBtn = document.getElementById('import-clients-btn');
    const importFileInput = document.getElementById('client-import-file');
    const importStatus = document.getElementById('import-status-message');
    const importSpinner = document.getElementById('import-loading-spinner');
    if (importBtn && importFileInput) {
        importBtn.onclick = async () => {
            importStatus.textContent = '';
            importSpinner.classList.remove('hidden');
            try {
                const file = importFileInput.files[0];
                if (!file) {
                    importStatus.textContent = 'Please select a file.';
                    importSpinner.classList.add('hidden');
                    return;
                }
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                if (!rows.length) {
                    importStatus.textContent = 'No data found in the file.';
                    importSpinner.classList.add('hidden');
                    return;
                }
                // Get branches for mapping
                const branches = await DataAPI.getBranches();
                // Build name->id map (normalize: trim, lowercase)
                const branchNameToId = {};
                Object.entries(branches).forEach(([id, b]) => {
                    branchNameToId[b.name.trim().toLowerCase()] = id;
                });
                // For error reporting
                const availableBranchNames = Object.keys(branchNameToId);
                // Validate and group clients by branchId
                const clientsByBranch = {};
                for (const row of rows) {
                    const name = row['Client Name']?.trim();
                    const phone = row['Phone Number']?.trim();
                    // Accept both 'BranchID' and 'Branch ID' (with or without space)
                    let branchId = row['BranchID']?.trim() || row['Branch ID']?.trim();
                    let branchNameRaw = row['Branch Name']?.trim();
                    if (!branchId && branchNameRaw) {
                        branchId = branchNameToId[branchNameRaw.toLowerCase()];
                    }
                    // Debug log for mapping
                    console.log('Import row:', row, 'Mapped branchId:', branchId, 'Available branches:', branchNameToId);
                    if (!name || !phone || !branchId) {
                        let errorMsg = 'Each row must have Client Name, Phone Number, and Branch Name/BranchID.';
                        if (!branchId && branchNameRaw) {
                            errorMsg = `Branch name "${branchNameRaw}" not found. Available branches: ['${availableBranchNames.join("', '") }']`;
                        }
                        importStatus.textContent = errorMsg;
                        importSpinner.classList.add('hidden');
                        return;
                    }
                    if (!clientsByBranch[branchId]) clientsByBranch[branchId] = [];
                    clientsByBranch[branchId].push({ name, phoneNumber: phone });
                }
                // Import clients for each branch
                let total = 0;
                for (const branchId in clientsByBranch) {
                    await DataAPI.saveClient(branchId, { clients: clientsByBranch[branchId] });
                    total += clientsByBranch[branchId].length;
                }
                importStatus.textContent = `Successfully imported ${total} clients.`;
                importSpinner.classList.add('hidden');
                await renderClients();
            } catch (err) {
                importStatus.textContent = 'Import failed: ' + (err.message || 'Unknown error.');
                importSpinner.classList.add('hidden');
            }
        };
    }


    // --- Transaction Management ---
    async function renderTransactions() {
        const sortDropdown = document.getElementById('transaction-sort-dropdown');
        const sortOrderDropdown = document.getElementById('transaction-sort-order');
        const transactionsTableBody = document.getElementById('transactions-table-body');
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
            // Changed colspan from 8 to 9 to account for the new 'Comment' column
            row.innerHTML = `<td colspan="9" class="text-center text-gray-500">No transactions found.</td>`;
            return;
        }
        let branchIds = Object.keys(grouped);
        if (sortKey === 'branch') {
            branchIds = branchIds.sort((a, b) => sortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a));
        }
        branchIds.forEach(branchId => {
            // Dynamically determine the number of columns in the table header
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
            } else if (sortKey === 'shop') {
                branchTxs = branchTxs.slice().sort((a, b) => {
                    return sortOrder === 'asc' ? (a.shopName || '').localeCompare(b.shopName || '') : (b.shopName || '').localeCompare(a.shopName || '');
                });
            }
            branchTxs.forEach((p) => {
                // --- Product Invoice (old) ---
                let invoiceCell = '<span class="text-gray-400">No Invoice</span>';
                if (p.invoiceFileData) {
                    const fileName = p.invoiceFileName || 'invoice';
                    const fileData = p.invoiceFileData;
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
                // --- Product Purchased Invoice (new) ---
                let purchasedInvoiceCell = '<span class="text-gray-400">No Invoice</span>';
                if (p.purchasedInvoiceFileData) {
                    const fileName = p.purchasedInvoiceFileName || 'purchased-invoice';
                    const fileData = p.purchasedInvoiceFileData;
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
                // --- Handle multiple purchases ---
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
                const row = transactionsTableBody.insertRow();
                row.innerHTML = `
                    <td class="p-3">${p.shopName}</td>
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
                    <td class="p-3">
                        <button data-delete-type="transaction" data-id="${p.id}" class="text-red-500 hover:text-red-700"><i class="ri-delete-bin-line"></i></button>
                    </td>
                `;
            });
        });
        
        // Add improved click handler to properly open invoice files
        const invoiceLinks = document.querySelectorAll('.invoice-action');
        invoiceLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const action = this.getAttribute('data-action');
                const fileName = this.getAttribute('data-file');
                const mimeType = this.getAttribute('data-mime');
                const fileContent = this.getAttribute('data-content');
                
                if (fileContent) {
                    // Create a blob from the base64 data
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
        // Add click handler for purchased invoice files
        const purchasedInvoiceLinks = document.querySelectorAll('.purchased-invoice-action');
        purchasedInvoiceLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const action = this.getAttribute('data-action');
                const fileName = this.getAttribute('data-file');
                const mimeType = this.getAttribute('data-mime');
                const fileContent = this.getAttribute('data-content');
                
                if (fileContent) {
                    // Create a blob from the base64 data
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
        // Attach sort/search listeners after rendering
        attachTransactionSortAndSearchListeners();
    }

    function attachTransactionSortAndSearchListeners() {
        const sortDropdown = document.getElementById('transaction-sort-dropdown');
        const sortOrderDropdown = document.getElementById('transaction-sort-order');
        const searchInput = document.getElementById('transaction-search-input');
        if (sortDropdown) sortDropdown.onchange = () => { console.log('[Transactions] Sort changed'); renderTransactions(); };
        if (sortOrderDropdown) sortOrderDropdown.onchange = () => { console.log('[Transactions] Sort order changed'); renderTransactions(); };
        if (searchInput) searchInput.oninput = () => { console.log('[Transactions] Search input'); renderTransactions(); };
    }

    const transactionSortDropdown = document.getElementById('transaction-sort-dropdown');
    if (transactionSortDropdown) transactionSortDropdown.onchange = renderTransactions;
    const transactionSortOrder = document.getElementById('transaction-sort-order');
    if (transactionSortOrder) transactionSortOrder.onchange = renderTransactions;

    const transactionSearchInput = document.getElementById('transaction-search-input');
    if (transactionSearchInput) transactionSearchInput.addEventListener('input', renderTransactions);

    // --- Branch Management ---
    if (branchForm) { 
    branchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        // Use correct input IDs from the HTML
        const branchName = document.getElementById('shop-name').value.trim();
        const branchId = branchName.toLowerCase().replace(/\s+/g, '');
        const branchLocation = document.getElementById('shop-location').value.trim();
        const branchUserPassword = document.getElementById('shop-user-password').value;
        const adminUsername = document.getElementById('shop-admin-username').value.trim().toLowerCase();
        const adminPassword = document.getElementById('shop-admin-password').value;

        if (!branchName || !branchLocation || !branchUserPassword || !adminUsername || !adminPassword) {
            alert('All shop fields are required.');
            return;
        }

        try {
            // Check if branch ID already exists
            const existingBranches = await DataAPI.getBranches();
            if (existingBranches[branchId]) {
                alert('A shop with this name (ID) already exists. Please choose a different name.');
                return;
            }

            // Check if shop user or admin user already exists
            const existingUsers = await DataAPI.getUsers();
            if (existingUsers[branchId]) {
                alert(`The username "${branchId}" for the shop user already exists. Please choose a different shop name.`);
                return;
            }
            if (existingUsers[adminUsername]) {
                alert(`The admin username "${adminUsername}" already exists. Please choose a different admin username.`);
                return;
            }

            // Save shop (will use PUT for creation/update as per server.js)
            await DataAPI.saveBranch(branchId, { name: branchName, location: branchLocation });

            const now = new Date().toISOString();
            // Save shop user
            try {
                await DataAPI.saveUser(branchId, { password: branchUserPassword, role: 'branch', branch: branchId, createdAt: now });
            } catch (err) {
                // Rollback shop creation if user creation fails
                await DataAPI.deleteBranch(branchId);
                alert('Failed to create shop user: ' + (err.message || 'Unknown error. Shop creation rolled back.'));
                return;
            }
            // Save shop admin user
            try {
                await DataAPI.saveUser(adminUsername, { password: adminPassword, role: 'admin', branch: branchId, createdAt: now });
            } catch (err) {
                // Rollback shop and shop user if admin creation fails
                await DataAPI.deleteUser(branchId);
                await DataAPI.deleteBranch(branchId);
                alert('Failed to create shop admin user: ' + (err.message || 'Unknown error. Shop creation rolled back.'));
                return;
            }

            alert('Shop and users added successfully! They can now log in.');
            branchForm.reset();
            await renderBranches();
            await renderClients();
            await renderUsers();
            await renderTransactions();
            await populateAllBranchSelects();
        } catch (error) {
            console.error('Error creating shop:', error);
            alert('Failed to create shop: ' + (error.message || 'Unknown error.'));
        }
    });
    }

    // --- Client Management ---
    if (clientForm) { 
        console.log("Client form found, attaching event listener."); // Debug log
    clientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
            console.log("Client form submitted."); // Debug log

            const branch = document.getElementById('client-branch').value; 
            const clientName = document.getElementById('client-name').value;
            const phoneNumber = document.getElementById('client-phone').value;
            
            console.log("Client data:", { branch, clientName, phoneNumber }); // Debug log

            if (!branch) {
                alert('Please select a branch for the client.');
                console.warn("Client creation aborted: No branch selected."); // Debug log
                return;
            }
            if (!clientName || !phoneNumber) {
                alert('Client name and phone number are required.');
                console.warn("Client creation aborted: Missing name or phone number."); // Debug log
                return;
            }

            // --- Duplicate phone number check ---
            const clients = await DataAPI.getClients();
            const branchClients = clients[branch] || [];
            const duplicate = branchClients.some(c => c.phoneNumber === phoneNumber);
            if (duplicate) {
                alert('A client with this phone number already exists in this branch.');
                return;
            }
            // --- End duplicate check ---

            try {
                // DataAPI.saveClient handles adding or updating based on name/phone
                // This will now send {name, phoneNumber} inside a 'client' object
                await DataAPI.saveClient(branch, { name: clientName, phoneNumber: phoneNumber });
                
        alert('Client added successfully!');
        clientForm.reset();
                await renderClients(); // Only need to re-render clients after adding a client
                console.log("Client successfully added and rendered."); // Debug log
            } catch (error) {
                console.error("Error adding client:", error); // Debug log for API errors
                alert("Failed to add client: " + (error.message || "Unknown error."));
            }
        });
    } else {
        console.warn("Client form (client-form-actual) not found!"); // Debug log
    }

    // --- Users Table ---
    async function renderUsers() {
        const sortDropdown = document.getElementById('user-sort-dropdown');
        const sortOrderDropdown = document.getElementById('user-sort-order');
        const userTable = document.getElementById('users-table-body');
        if (!sortDropdown || !sortOrderDropdown || !userTable) return;
        const users = await DataAPI.getUsers();
        const loggedInUser = JSON.parse(sessionStorage.getItem('loggedInUser'));
        let userList = Object.entries(users).map(([username, u]) => ({ username, ...u }));
        const sortKey = sortDropdown.value;
        const sortOrder = sortOrderDropdown.value;
        userList.sort((a, b) => {
            if (sortKey === 'username') {
                return sortOrder === 'asc' ? a.username.localeCompare(b.username) : b.username.localeCompare(a.username);
            } else if (sortKey === 'branch') {
                return sortOrder === 'asc' ? (a.branch || '').localeCompare(b.branch || '') : (b.branch || '').localeCompare(a.branch || '');
            } else if (sortKey === 'role') {
                return sortOrder === 'asc' ? a.role.localeCompare(b.role) : b.role.localeCompare(a.role);
            } else if (sortKey === 'createdAt') {
                return sortOrder === 'asc' ? new Date(a.createdAt || 0) - new Date(b.createdAt || 0) : new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            }
            return 0;
        });
        userTable.innerHTML = '';
        if (userList.length === 0) {
            const table = document.querySelector('#users-section table');
            const thCount = table ? table.querySelectorAll('thead th').length : 6;
            const row = userTable.insertRow();
            row.innerHTML = `<td colspan="${thCount}" class="text-center text-gray-500">No users found.</td>`;
            return;
        }
        userList.forEach(u => {
            const roleLabel =
              u.role === 'superadmin' ? 'Grandadmin' :
              u.role === 'master-admin' ? 'Admin' :
              u.role === 'admin' ? 'Shopmanager' :
              u.role === 'branch' ? 'Shop User' :
              u.role.charAt(0).toUpperCase() + u.role.slice(1);
            const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleString() : '';
            let passwordCell = '';
            let actionContent = '';
            // Only show edit/delete for superadmins if allowed
            if (u.role === 'superadmin') {
            if (u.username === 'superadmin') {
                passwordCell = '<span class="text-gray-400">Hidden</span>';
                actionContent = '<span class="text-gray-400">Protected</span>';
                } else if (loggedInUser.username === 'superadmin' || u.createdBy === loggedInUser.username) {
                    passwordCell = `
                      <span class="user-password-mask" data-password="${u.password || ''}">********</span>
                      <button type="button" class="toggle-password-btn ml-2 text-purple-600 hover:text-purple-800" data-username="${u.username}">
                        <i class="ri-eye-line"></i>
                      </button>`;
                    actionContent = `
                        <button class="edit-user-btn text-blue-600 hover:text-blue-800" data-username="${u.username}"><i class="ri-pencil-line"></i> Edit</button>
                        <span class="text-gray-400">Delete via Shop</span>
                    `;
                } else if (u.username === loggedInUser.username) {
                passwordCell = `
                  <span class="user-password-mask" data-password="${u.password || ''}">********</span>
                  <button type="button" class="toggle-password-btn ml-2 text-purple-600 hover:text-purple-800" data-username="${u.username}">
                    <i class="ri-eye-line"></i>
                  </button>`;
                actionContent = '<span class="text-gray-400">Self</span>';
                } else {
                passwordCell = `
                  <span class="user-password-mask" data-password="${u.password || ''}">********</span>
                  <button type="button" class="toggle-password-btn ml-2 text-purple-600 hover:text-purple-800" data-username="${u.username}">
                    <i class="ri-eye-line"></i>
                  </button>`;
                actionContent = '<span class="text-gray-400">Not your user</span>';
                }
            } else if (u.username === 'superadmin') {
                passwordCell = '<span class="text-gray-400">Hidden</span>';
                actionContent = '<span class="text-gray-400">Protected</span>';
            } else if ((u.role === 'branch' || u.role === 'admin') && u.branch) {
              // Branch-related users: only show edit, no delete
              passwordCell = `
                <span class="user-password-mask" data-password="${u.password || ''}">********</span>
                <button type="button" class="toggle-password-btn ml-2 text-purple-600 hover:text-purple-800" data-username="${u.username}">
                  <i class="ri-eye-line"></i>
                </button>`;
              actionContent = `
                  <button class="edit-user-btn text-blue-600 hover:text-blue-800" data-username="${u.username}"><i class="ri-pencil-line"></i> Edit</button>
                  <span class=\"text-gray-400\">Delete via Shop</span>
              `;
            } else {
                passwordCell = `
                  <span class="user-password-mask" data-password="${u.password || ''}">********</span>
                  <button type="button" class="toggle-password-btn ml-2 text-purple-600 hover:text-purple-800" data-username="${u.username}">
                    <i class="ri-eye-line"></i>
                  </button>`;
                actionContent = `
                    <button class="edit-user-btn text-blue-600 hover:text-blue-800" data-username="${u.username}"><i class="ri-pencil-line"></i> Edit</button>
                  <span class=\"text-gray-400\">Delete via Shop</span>
                `;
            }
            userTable.insertRow().innerHTML = `
                <td class="p-2 user-username-display">${u.username}</td>
                <td class="p-2 user-role-display">${roleLabel}</td>
                <td class="p-2 user-branch-display">${u.branch || ''}</td>
                <td class="p-2">${passwordCell}</td>
                <td class="p-2">${dateStr}</td>
                <td class="p-2 flex gap-2">${actionContent}</td>
            `;
        });
        // Update sidebar heading to show current superadmin's username or 'Super Admin' in rainbow for original
        const sidebarHeading = document.getElementById('sidebar-superadmin-heading');
        if (sidebarHeading && loggedInUser && loggedInUser.role === 'superadmin') {
            if (loggedInUser.username === 'superadmin') {
                sidebarHeading.textContent = 'Super Admin';
                sidebarHeading.className = 'text-lg font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-transparent bg-clip-text mb-6';
            } else {
            sidebarHeading.textContent = loggedInUser.username;
                sidebarHeading.className = 'text-lg font-bold text-gray-800 mb-6';
            }
        }
        // Attach show/hide password event listeners
        document.querySelectorAll('.toggle-password-btn').forEach(btn => {
            btn.onclick = function() {
                const row = this.closest('tr');
                const mask = row.querySelector('.user-password-mask');
                if (!mask) return;
                const isMasked = mask.textContent === '********';
                if (isMasked) {
                    mask.textContent = mask.getAttribute('data-password') || '';
                    this.innerHTML = '<i class="ri-eye-off-line"></i>';
                } else {
                    mask.textContent = '********';
                    this.innerHTML = '<i class="ri-eye-line"></i>';
                }
            };
        });
        // Attach edit/delete event listeners
        document.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.onclick = async function() {
                const username = this.getAttribute('data-username');
                if (username === loggedInUser.username) return; // Prevent editing self
                const row = this.closest('tr');
                const user = userList.find(u => u.username === username);
                if (!user) return;
                // Replace cells with editable fields
                row.innerHTML = `
                    <td class="p-2"><input type="text" class="edit-username border rounded p-1 text-sm w-28" value="${user.username}"></td>
                    <td class="p-2">
                        <select class="edit-role border rounded p-1 text-sm w-28">
                            <option value="superadmin" ${user.role === 'superadmin' ? 'selected' : ''}>Grandadmin</option>
                            <option value="master-admin" ${user.role === 'master-admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </td>
                    <td class="p-2 user-branch-display">${user.branch || ''}</td>
                    <td class="p-2"><input type="text" class="edit-password border rounded p-1 text-sm w-28" value="${user.password || ''}"></td>
                    <td class="p-2">${user.createdAt ? new Date(user.createdAt).toLocaleString() : ''}</td>
                    <td class="p-2 flex gap-2">
                        <button class="save-user-btn text-green-600 hover:text-green-900 ml-1" data-username="${user.username}"><i class="ri-check-line"></i> Save</button>
                        <button class="cancel-user-btn text-gray-500 hover:text-gray-700 ml-1"><i class="ri-close-line"></i> Cancel</button>
                    </td>
                `;
                // Cancel handler
                row.querySelector('.cancel-user-btn').onclick = async function() {
                    await renderUsers();
                };
            };
        });
        document.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.onclick = async function() {
                const username = this.getAttribute('data-username');
                if (!username || username === 'superadmin' || username === loggedInUser.username) return; // Prevent deleting self or original superadmin
                if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
                try {
                    await DataAPI.deleteUser(username);
                    alert('User deleted successfully!');
                    await renderUsers();
                } catch (error) {
                    alert(error.message || 'Failed to delete user.');
                }
            };
        });
    }

    const userSortDropdown = document.getElementById('user-sort-dropdown');
    if (userSortDropdown) userSortDropdown.onchange = renderUsers;
    const userSortOrder = document.getElementById('user-sort-order');
    if (userSortOrder) userSortOrder.onchange = renderUsers;

    // --- User Actions: Edit, Save, Cancel, Show/Hide Password, Delete ---
    document.addEventListener('click', async (e) => {
        // Edit user
        const editBtn = e.target.closest('.edit-user-btn');
        if (editBtn) {
            const row = editBtn.closest('tr');
            if (!row) return;
            const username = row.querySelector('.user-username-cell').getAttribute('data-username');
            const currentUser = (await DataAPI.getUsers())[username];
            if (!currentUser) return;
            const usernameCell = row.querySelector('.user-username-cell');
            const passwordCell = row.querySelector('.user-password-cell');
            const branchCell = row.querySelector('.user-branch-cell');
            // Username editable for branch/admin users, not for system users
            if (currentUser.role === 'superadmin' || currentUser.role === 'master-admin') {
                usernameCell.innerHTML = `<span>${username}</span>`;
            } else {
                usernameCell.innerHTML = `<input type="text" class="edit-username border rounded p-1 text-sm w-32" value="${username}">`;
            }
            // Password editable for all non-system users
            passwordCell.innerHTML = `<input type="text" class="edit-password border rounded p-1 text-sm w-32" value="${currentUser.password}">`;
            // Branch field becomes a dropdown for 'admin' and 'branch' roles. Not for master-admin.
            if (currentUser.role === 'admin' || currentUser.role === 'branch') {
                const branches = await DataAPI.getBranches();
                let branchSelectHtml = `<select class="edit-user-branch border rounded p-1 text-sm w-28">`;
                branchSelectHtml += `<option value="">-- No Branch --</option>`;
                for (const id in branches) {
                    const selected = (id === currentUser.branch) ? 'selected' : '';
                    branchSelectHtml += `<option value="${id}" ${selected}>${branches[id].name}</option>`;
                }
                branchSelectHtml += `</select>`;
                branchCell.innerHTML = branchSelectHtml;
            } else {
                branchCell.innerHTML = `<span class="user-branch-display">${currentUser.branch || ''}</span>`;
            }
            // Hide original action buttons
            const originalEditBtn = row.querySelector('.edit-user-btn');
            const originalToggleBtn = row.querySelector('.toggle-password-btn');
            const originalDeleteBtn = row.querySelector('.delete-user-btn');
            if(originalEditBtn) originalEditBtn.style.display = 'none';
            if(originalToggleBtn) originalToggleBtn.style.display = 'none';
            if(originalDeleteBtn) originalDeleteBtn.style.display = 'none';
            // Add Save/Cancel buttons
            const actionCell = row.querySelector('td:last-child');
            actionCell.innerHTML = '';
            const saveBtn = document.createElement('button');
            saveBtn.className = 'save-user-btn text-green-600 hover:text-green-900 ml-1';
            saveBtn.innerHTML = '<i class="ri-check-line"></i> Save';
            saveBtn.setAttribute('data-username', username);
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'cancel-user-btn text-gray-500 hover:text-gray-700 ml-1';
            cancelBtn.innerHTML = '<i class="ri-close-line"></i> Cancel';
            actionCell.appendChild(saveBtn);
            actionCell.appendChild(cancelBtn);
            return;
        }
        // Save user edits
        const saveBtn = e.target.closest('.save-user-btn');
        if (saveBtn) {
            const row = saveBtn.closest('tr');
            if (!row) return;
            const oldUsername = saveBtn.getAttribute('data-username');
            const users = await DataAPI.getUsers();
            const user = users[oldUsername];
            if (!user) return;
            let newUsername = oldUsername;
            if (user.role !== 'superadmin' && user.role !== 'master-admin') {
                const usernameInput = row.querySelector('.edit-username');
                if (usernameInput) {
                    newUsername = usernameInput.value.trim();
                    if (!newUsername) {
                        alert('Username cannot be empty.');
                        return;
                    }
                    // If username changed and already exists, block
                    if (newUsername !== oldUsername && users[newUsername]) {
                        alert('A user with this username already exists.');
                        return;
                    }
                }
            }
            const passwordInput = row.querySelector('.edit-password');
            const branchInput = row.querySelector('.edit-user-branch');
            const updatedUser = {
                ...user,
                password: passwordInput ? passwordInput.value : user.password,
                branch: branchInput ? branchInput.value : user.branch
            };
            // If username changed and user is a branch user, perform full branch rename cascade
            if (user.role === 'branch' && newUsername !== oldUsername) {
                // --- Begin branch rename cascade (logic from Branches section) ---
                const branches = await DataAPI.getBranches();
                const branchId = user.branch;
                const currentBranchData = branches[branchId];
                if (!currentBranchData) {
                    alert('Branch data not found for this user.');
                    return;
                }
                const newBranchId = newUsername;
                // Check if the new branch ID already exists
                if (branches[newBranchId]) {
                    alert(`A branch with the ID "${newBranchId}" already exists.`);
                    await renderUsers();
                    return;
                }
                // Save new branch data first
                await DataAPI.saveBranch(newBranchId, {
                    ...currentBranchData,
                    name: newBranchId,
                    location: currentBranchData.location
                });
                // Update branch user (create new, then delete old)
                await DataAPI.saveUser(newBranchId, {
                    password: updatedUser.password,
                    role: 'branch',
                    branch: newBranchId,
                    createdAt: updatedUser.createdAt || new Date().toISOString()
                });
                // Update admin user(s)
                const adminUsers = Object.entries(users).filter(([uname, u]) => u.role === 'admin' && u.branch === branchId);
                for (const [adminUsername, adminUser] of adminUsers) {
                    await DataAPI.saveUser(adminUsername, {
                        password: adminUser.password,
                        role: 'admin',
                        branch: newBranchId,
                        createdAt: adminUser.createdAt || new Date().toISOString()
                    });
                }
                // Update clients
                const clients = await DataAPI.getClients();
                if (clients[branchId]) {
                    const updatedClientsForBranch = clients[branchId].map(client => ({
                        ...client,
                        branch: newBranchId
                    }));
                    await DataAPI.saveClient(newBranchId, { clients: updatedClientsForBranch });
                    await DataAPI.deleteClient(branchId, 'all');
                }
                // Update purchases
                const purchases = await DataAPI.getPurchases();
                const updatedPurchases = purchases.map(p => {
                    if (p.branchId === branchId || p.shopName === branchId) {
                        return { ...p, branchId: newBranchId, shopName: newBranchId };
                    }
                    return p;
                });
                for (const p of updatedPurchases) {
                    await DataAPI.savePurchase(p);
                }
                // Delete old branch user and old branch
                await DataAPI.deleteUser(oldUsername);
                await DataAPI.deleteBranch(branchId);
                alert('Branch and user updated successfully!');
                await renderBranches();
                await renderUsers();
                await renderClients();
                await renderTransactions();
                await populateAllBranchSelects();
                return;
            } else {
                // If not a branch user rename, proceed as normal
                try {
                const { username, ...userPayload } = updatedUser;
                await DataAPI.saveUser(oldUsername, {
                    ...userPayload,
                    ...(newUsername !== oldUsername ? { newUsername } : {})
                });
                alert('User updated successfully!');
                await renderUsers();
            } catch (error) {
                console.error('Error updating user:', error);
                alert('Failed to update user: ' + (error.message || 'Unknown error.'));
            }
            return;
            }
        }
        // Cancel user edit
        const cancelBtn = e.target.closest('.cancel-user-btn');
        if (cancelBtn) {
            await renderUsers();
            return;
        }
        // Toggle password show/hide
        const toggleBtn = e.target.closest('.toggle-password-btn');
        if (toggleBtn) {
            const row = toggleBtn.closest('tr');
            if (!row) return;
            const passwordSpan = row.querySelector('.user-password-text');
            if (!passwordSpan) return;
            if (passwordSpan.textContent === '**********') {
                passwordSpan.textContent = passwordSpan.getAttribute('data-password');
                toggleBtn.innerHTML = '<i class="ri-eye-off-line"></i> Hide';
            } else {
                passwordSpan.textContent = '**********';
                toggleBtn.innerHTML = '<i class="ri-eye-line"></i> Show';
            }
            return;
        }
        // Delete user
        const deleteBtn = e.target.closest('.delete-user-btn');
        if (deleteBtn) {
            const username = deleteBtn.getAttribute('data-id');
            if (!username) return;
            if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
            try {
                await DataAPI.deleteUser(username);
                alert('User deleted successfully!');
                await renderUsers();
            } catch (error) {
                console.error('Delete user error:', error);
                alert('Failed to delete user: ' + (error.message || 'Unknown error.'));
            }
            return;
        }
    });


    // --- Branches Table ---
    async function renderBranches() {
        // Use the correct sort dropdowns for shops
        const sortDropdown = document.getElementById('shop-sort-dropdown');
        const sortOrderDropdown = document.getElementById('shop-sort-order');
        const branchTable = document.getElementById('branches-table-body');
        if (!sortDropdown || !sortOrderDropdown || !branchTable) return;
        const sortKey = sortDropdown.value;
        const sortOrder = sortOrderDropdown.value;
        const branches = await DataAPI.getBranches();
        let branchList = Object.entries(branches).map(([id, b]) => ({ id, ...b }));
        if (sortKey === 'name') {
            branchList.sort((a, b) => sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
        } else if (sortKey === 'id') { 
            branchList.sort((a, b) => sortOrder === 'asc' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id));
        }
        branchTable.innerHTML = '';
        if (branchList.length === 0) {
            const row = branchTable.insertRow();
            row.innerHTML = `<td colspan="4" class="text-center text-gray-500">No shops found.</td>`;
            return;
        }
        branchList.forEach(b => {
            const row = branchTable.insertRow();
            row.setAttribute('data-branch-id', b.id);
            row.innerHTML = `
                <td class="p-2 branch-name-cell">${b.name}</td>
                <td class="p-2 branch-location-cell">${b.location}</td>
                <td class="p-2">${b.id}</td>
                <td class="p-2 flex gap-2">
                    <button data-delete-type="branch" data-id="${b.id}" class="delete-branch-btn text-red-600 hover:text-red-800"><i class="ri-delete-bin-line"></i> Delete</button>
                </td>
            `;
        });
    }

    // Ensure event listeners for shop sort dropdowns
    const shopSortDropdown = document.getElementById('shop-sort-dropdown');
    if (shopSortDropdown) shopSortDropdown.onchange = renderBranches;
    const shopSortOrder = document.getElementById('shop-sort-order');
    if (shopSortOrder) shopSortOrder.onchange = renderBranches;

    // --- Inline Edit Handler for Branches ---
    document.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-branch-btn');
        if (editBtn) {
            const row = editBtn.closest('tr');
            if (!row) return;
            const branchId = row.getAttribute('data-branch-id');
            const nameCell = row.querySelector('.branch-name-cell');
            const locationCell = row.querySelector('.branch-location-cell');
            const oldName = nameCell.textContent;
            const oldLocation = locationCell.textContent;

            nameCell.innerHTML = `<input type="text" class="edit-branch-name border rounded p-1 text-sm w-28" value="${oldName}">`;
            locationCell.innerHTML = `<input type="text" class="edit-branch-location border rounded p-1 text-sm w-28" value="${oldLocation}">`;

            // Hide original action buttons, show delete button if it was hidden
            const originalDeleteBtn = row.querySelector('.delete-branch-btn');
            if (originalDeleteBtn) originalDeleteBtn.style.display = 'none'; // Hide delete during edit
            editBtn.style.display = 'none'; 

            // Add Save/Cancel buttons
            const actionCell = row.querySelector('td:last-child');
            const saveBtn = document.createElement('button');
            saveBtn.className = 'save-branch-btn text-green-600 hover:text-green-900 ml-1';
            saveBtn.innerHTML = '<i class="ri-check-line"></i> Save';
            saveBtn.setAttribute('data-id', branchId); // Store branchId for saving
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'cancel-branch-btn text-gray-500 hover:text-gray-700 ml-1';
            cancelBtn.innerHTML = '<i class="ri-close-line"></i> Cancel';
            actionCell.appendChild(saveBtn);
            actionCell.appendChild(cancelBtn);
        }

        const saveBtn = e.target.closest('.save-branch-btn');
        if (saveBtn) {
            const row = saveBtn.closest('tr');
            if (!row) return;
            const oldBranchId = saveBtn.getAttribute('data-id'); // Use oldBranchId as this is the current row's ID
            const newName = row.querySelector('.edit-branch-name').value.trim();
            const newLocation = row.querySelector('.edit-branch-location').value.trim();

            if (!newName || !newLocation) {
                alert('Branch name and location cannot be empty.');
                return;
            }

            try {
                // Fetch current branch data to retain existing properties like createdAt
                const branches = await DataAPI.getBranches();
                const currentBranchData = branches[oldBranchId]; // Use oldBranchId here

                // Construct the new branch ID based on the new name
                const newBranchId = newName.toLowerCase().replace(/\s+/g, '');

                // If the branch name (and thus ID) is changing
                if (newBranchId !== oldBranchId) {
                    // Check if the new branch ID already exists
                    if (branches[newBranchId]) {
                        alert(`A branch with the ID "${newBranchId}" (from new name) already exists.`);
                        await renderBranches(); // Revert UI
                        return;
                    }

                    // Handle renaming associated users (branch user and admin user)
                    const users = await DataAPI.getUsers();
                    // Find the branch user (username matching old branchId)
                    const oldBranchUser = users[oldBranchId];
                    if (oldBranchUser && oldBranchUser.role === 'branch' && oldBranchUser.branch === oldBranchId) {
                        // Create new branch user with new ID as username
                        // Ensure all required fields are present
                        await DataAPI.saveUser(newBranchId, { 
                            password: oldBranchUser.password,
                            role: 'branch',
                            branch: newBranchId,
                            createdAt: oldBranchUser.createdAt || new Date().toISOString()
                        });
                        // Delete old branch user
                        await DataAPI.deleteUser(oldBranchId);
                    }

                    // Find the admin user associated with this branch
                    const adminUsers = Object.entries(users).filter(([uname, u]) => u.role === 'admin' && u.branch === oldBranchId);
                    for (const [adminUsername, adminUser] of adminUsers) {
                        // Update admin user's branch property to the new ID
                        await DataAPI.saveUser(adminUsername, {
                            password: adminUser.password,
                            role: 'admin',
                            branch: newBranchId,
                            createdAt: adminUser.createdAt || new Date().toISOString()
                        });
                    }

                    // Update associated clients' branch property
                    const clients = await DataAPI.getClients();
                    if (clients[oldBranchId]) {
                        const updatedClientsForBranch = clients[oldBranchId].map(client => ({
                            ...client,
                            branch: newBranchId
                        }));
                        // Save updated clients for the new branch ID
                        await DataAPI.saveClient(newBranchId, { clients: updatedClientsForBranch });
                        // Delete old client entry
                        await DataAPI.deleteClient(oldBranchId, 'all'); 
                    }

                    // Update associated purchases' shopName/branchId
                    const purchases = await DataAPI.getPurchases();
                    const updatedPurchases = purchases.map(p => {
                        if (p.branchId === oldBranchId || p.shopName === oldBranchId) {
                            return { ...p, branchId: newBranchId, shopName: newBranchId };
                        }
                        return p;
                    });
                    // Re-save all affected purchases. This might be inefficient for very large datasets,
                    // but necessary given the current API structure.
                    for (const p of updatedPurchases) {
                        await DataAPI.savePurchase(p); 
                    }

                    // Delete the old branch entry
                    await DataAPI.deleteBranch(oldBranchId);

                    // Save the new branch data with the new ID
                    await DataAPI.saveBranch(newBranchId, {
                        ...currentBranchData, // Retain other properties like createdAt if present
                        name: newName,
                        location: newLocation
                    });
                } else {
                    // If only name/location is changing, but ID remains the same
                    const updatedBranchData = {
                        ...currentBranchData, 
                        name: newName,
                        location: newLocation
                    };
                    await DataAPI.saveBranch(oldBranchId, updatedBranchData); 
                }

                alert('Branch updated successfully!');
                await renderBranches(); 
                await renderUsers(); 
                await renderClients(); 
                await renderTransactions(); 
                await populateAllBranchSelects(); 
            } catch (error) {
                console.error('Error saving branch:', error);
                alert('Failed to update branch: ' + (error.message || 'Unknown error.'));
            }
        }

        const cancelBtn = e.target.closest('.cancel-branch-btn');
        if (cancelBtn) {
            await renderBranches(); 
        }
    });


    // --- Inline Edit Handler for Clients ---
    document.addEventListener('click', async (e) => {
        // Edit button
        const editBtn = e.target.closest('.edit-client-btn');
        if (editBtn) {
            console.log('Edit client button clicked');
            alert('Edit client button clicked');
            const row = editBtn.closest('tr');
            if (!row) return;
            const branch = row.getAttribute('data-branch');
            const branchIndex = parseInt(row.getAttribute('data-branch-index'), 10);
            const nameCell = row.querySelector('.client-name-cell');
            const phoneCell = row.querySelector('.client-phone-cell');
            const oldName = nameCell.textContent;
            const oldPhone = phoneCell.textContent;
            nameCell.innerHTML = `<input type="text" class="edit-client-name border rounded p-1 text-sm w-28" value="${oldName}">`;
            phoneCell.innerHTML = `<input type="text" class="edit-client-phone border rounded p-1 text-sm w-28" value="${oldPhone}">`;
            editBtn.style.display = 'none';
            // Add Save/Cancel
            const actionCell = row.querySelector('td:last-child');
            const saveBtn = document.createElement('button');
            saveBtn.className = 'save-client-btn text-green-600 hover:text-green-900 ml-1';
            saveBtn.innerHTML = '<i class="ri-check-line"></i>';
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'cancel-client-btn text-gray-500 hover:text-gray-700 ml-1';
            cancelBtn.innerHTML = '<i class="ri-close-line"></i>';
            actionCell.appendChild(saveBtn);
            actionCell.appendChild(cancelBtn);
        }
        // Save button
        if (e.target.closest('.save-client-btn')) {
            console.log('Save client button clicked');
            alert('Save client button clicked');
            const row = e.target.closest('tr');
            if (!row) return;
            const branch = row.getAttribute('data-branch');
            const clientId = row.getAttribute('data-client-id');
            const nameInput = row.querySelector('.edit-client-name');
            const phoneInput = row.querySelector('.edit-client-phone');
            const newName = nameInput.value.trim();
            const newPhone = phoneInput.value.trim();
            if (!newName || !newPhone) {
                alert('Client name and phone cannot be empty.');
                return;
            }
            // --- Duplicate phone number check on edit ---
            const clients = await DataAPI.getClients();
            const branchClients = clients[branch] || [];
            const duplicate = branchClients.some(c => c.phoneNumber === newPhone && c.id !== clientId);
            if (duplicate) {
                alert('A client with this phone number already exists in this branch.');
                return;
            }
            // --- End duplicate check ---
            // Fetch the latest array from the backend to avoid stale data
            if (!clients[branch] || !Array.isArray(clients[branch])) {
                alert('Client list for branch not found.');
                return;
            }
            // Find the client by ID
            const clientArr = clients[branch];
            const idList = clientArr.map(c => c.id);
            const clientIdx = clientArr.findIndex(c => c.id === clientId);
            console.log('Editing clientId:', clientId);
            console.log('Branch client IDs:', idList);
            console.log('clientIdx:', clientIdx);
            if (clientIdx === -1) {
                alert('Client not found. Aborting update.');
                return;
            }
            // Debug: Log before update
            console.log('Before update:', JSON.parse(JSON.stringify(clientArr)));
            console.log('clientIdx:', clientIdx, 'Old client:', clientArr[clientIdx]);
            // Update the client in place, preserving ID
            const updatedClient = {
                id: clientId,
                name: newName,
                phoneNumber: newPhone
            };
            clientArr[clientIdx] = updatedClient;
            // Debug: Log after update
            console.log('After update:', JSON.parse(JSON.stringify(clientArr)));
            console.log('Updated client:', updatedClient);
            // Debug: Log the array being sent to the backend
            console.log('Sending clients array for branch', branch, clientArr);
            // Send the full updated array for the branch with replaceAll: true
            await DataAPI.saveClient(branch, { clients: clientArr, replaceAll: true }); 
            alert('Client updated successfully!');
            await renderClients();
        }
        // Cancel button
        if (e.target.closest('.cancel-client-btn')) {
            await renderClients();
        }
    });

    // --- Delete Handler ---
    async function handleDelete(type, id1, id2) {
        if (!confirm(`Are you sure you want to delete this ${type}? This action cannot be undone.`)) {
            return;
        }

        try {
            if (type === 'transaction') {
                await DataAPI.deletePurchase(id1);
                await renderTransactions(); // Refresh transactions table after delete
            } 
            else if (type === 'branch') {
                await DataAPI.deleteBranch(id1);
                // After branch delete, also need to clean up related data (users, clients, purchases)
                // This logic is also on the backend for data integrity, but we re-render affected tables.
                alert('Branch and all associated users, clients, and purchases deleted. These users can no longer log in.');
                await renderBranches();
                await renderUsers();
                await renderClients();
                await renderTransactions();
                await populateAllBranchSelects();
            }
            else if (type === 'client') {
                await DataAPI.deleteClient(id1, id2);
                await renderClients();
            }
            else if (type === 'user') {
                await DataAPI.deleteUser(id1);
                await renderUsers();
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete: ' + (error.message || 'Unknown error.'));
        }
    }

    // Event delegation for delete buttons
    document.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('[data-delete-type]');
        if (!deleteBtn) return;

        const type = deleteBtn.getAttribute('data-delete-type');
        const id1 = deleteBtn.getAttribute('data-id') || 
                   deleteBtn.getAttribute('data-branch');
        const id2 = deleteBtn.getAttribute('data-index');

        await handleDelete(type, id1, id2);
    });

    // --- Create User Form Handler (NEW) ---
    const createUserForm = document.getElementById('create-user-form');
    if (createUserForm) {
        createUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('new-username').value.trim().toLowerCase();
            const password = document.getElementById('new-password').value;
            const role = document.getElementById('new-role').value;
            const statusEl = document.getElementById('create-user-status');
            statusEl.textContent = '';
            statusEl.className = 'text-sm mt-2';
            if (!username || !password || !role) {
                statusEl.textContent = 'All fields are required.';
                statusEl.classList.add('text-red-600');
                return;
            }
            try {
                const loggedInUser = JSON.parse(sessionStorage.getItem('loggedInUser'));
                const userPayload = { password, role };
                if (role === 'superadmin' && username !== 'superadmin') {
                    userPayload.createdBy = loggedInUser.username;
                }
                await DataAPI.saveUser(username, userPayload);
                statusEl.textContent = `User '${username}' (${role}) created successfully!`;
                statusEl.classList.add('text-green-600');
                createUserForm.reset();
                await renderUsers();
            } catch (err) {
                statusEl.textContent = err.message || 'Failed to create user.';
                statusEl.classList.add('text-red-600');
            }
        });
    }

    // ARCHIVE SIDEBAR LINK LOGIC
    const archiveSidebarLink = document.getElementById('archive-sidebar-link');
    const archiveSection = document.getElementById('archive-section');
    if (archiveSidebarLink && archiveSection) {
      archiveSidebarLink.addEventListener('click', function(e) {
        e.preventDefault();
        // Hide all other main sections
        document.querySelectorAll('main > section').forEach(sec => {
          if (sec !== archiveSection) sec.classList.add('hidden');
        });
        // Show archive section
        archiveSection.classList.remove('hidden');
        // Remove sidebar-active from all links, add to archive
        document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('sidebar-active'));
        archiveSidebarLink.classList.add('sidebar-active');
        renderArchiveSection(); // <--- Fetch and render archive data
      });
    }

    // ENHANCED: Hide archive and show all normal sections when any other sidebar link is clicked
    document.querySelectorAll('.sidebar-link').forEach(link => {
      if (link !== archiveSidebarLink) {
        link.addEventListener('click', function(e) {
          // Hide archive section
          if (archiveSection) archiveSection.classList.add('hidden');
          // Show all other main sections (normal page)
          document.querySelectorAll('main > section').forEach(sec => {
            if (sec !== archiveSection) sec.classList.remove('hidden');
          });
          // Remove sidebar-active from all links, add to this one
          document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('sidebar-active'));
          this.classList.add('sidebar-active');
          // Let browser handle anchor jump (default behavior)
        });
      }
    });

    // --- ARCHIVE SECTION RENDERING ---
    async function renderArchiveSection() {
      // Fetch all archived data
      const [branches, users, clients, purchases] = await Promise.all([
        fetch('/api/archived-branches', { headers: getHeaders() }).then(r => r.json()),
        fetch('/api/archived-users', { headers: getHeaders() }).then(r => r.json()),
        fetch('/api/archived-clients', { headers: getHeaders() }).then(r => r.json()),
        fetch('/api/archived-purchases', { headers: getHeaders() }).then(r => r.json()),
      ]);

      // --- Archived Branches ---
      const branchesBody = document.getElementById('archived-branches-table-body');
      branchesBody.innerHTML = '';
      if (Object.keys(branches).length === 0) {
        branchesBody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-400">No archived branches.</td></tr>';
      } else {
        Object.entries(branches).forEach(([id, b]) => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td class="p-2">${b.name || ''}</td>
            <td class="p-2">${b.location || ''}</td>
            <td class="p-2">${id}</td>
            <td class="p-2 flex gap-2">
              <button class="restore-branch-btn text-green-600 hover:text-green-800" data-id="${id}"><i class="ri-history-line"></i> Restore</button>
              <button class="delete-branch-archive-btn text-red-600 hover:text-red-800" data-id="${id}"><i class="ri-delete-bin-line"></i> Delete Permanently</button>
            </td>
          `;
          branchesBody.appendChild(row);
        });
      }

      // --- Archived Users ---
      const usersBody = document.getElementById('archived-users-table-body');
      usersBody.innerHTML = '';
      if (Object.keys(users).length === 0) {
        usersBody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-400">No archived users.</td></tr>';
      } else {
        Object.entries(users).forEach(([username, u]) => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td class="p-2">${username}</td>
            <td class="p-2">${u.role || ''}</td>
            <td class="p-2">${u.branch || ''}</td>
            <td class="p-2 text-gray-400">(Managed via Shop)</td>
          `;
          usersBody.appendChild(row);
        });
      }

      // --- Archived Clients ---
      const clientsBody = document.getElementById('archived-clients-table-body');
      clientsBody.innerHTML = '';
      let hasClients = false;
      Object.entries(clients).forEach(([branchId, arr]) => {
        arr.forEach((c, idx) => {
          hasClients = true;
          const row = document.createElement('tr');
          row.innerHTML = `
            <td class="p-2">${c.name || ''}</td>
            <td class="p-2">${c.phoneNumber || ''}</td>
            <td class="p-2">${branchId}</td>
            <td class="p-2 flex gap-2">
              <button class="restore-client-btn text-green-600 hover:text-green-800" data-branch="${branchId}" data-index="${idx}"><i class="ri-history-line"></i> Restore</button>
              <button class="delete-client-archive-btn text-red-600 hover:text-red-800" data-branch="${branchId}" data-index="${idx}"><i class="ri-delete-bin-line"></i> Delete Permanently</button>
            </td>
          `;
          clientsBody.appendChild(row);
        });
      });
      if (!hasClients) {
        clientsBody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-400">No archived clients.</td></tr>';
      }

      // --- Archived Purchases ---
      const purchasesBody = document.getElementById('archived-purchases-table-body');
      purchasesBody.innerHTML = '';
      if (!Array.isArray(purchases) || purchases.length === 0) {
        purchasesBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-400">No archived purchases.</td></tr>';
      } else {
        purchases.forEach(p => {
          let items = '';
          if (Array.isArray(p.purchases)) {
            items = p.purchases.map(i => i.purchasedItem).join(', ');
          } else {
            items = p.purchasedItem || '';
          }
          const row = document.createElement('tr');
          row.innerHTML = `
            <td class="p-2">${p.shopName || p.branchId || ''}</td>
            <td class="p-2">${p.clientName || ''}</td>
            <td class="p-2">${p.phoneNumber || ''}</td>
            <td class="p-2">${items}</td>
            <td class="p-2">${p.dateTime || p.date || ''}</td>
            <td class="p-2 flex gap-2">
              <button class="restore-purchase-btn text-green-600 hover:text-green-800" data-id="${p.id}"><i class="ri-history-line"></i> Restore</button>
              <button class="delete-purchase-archive-btn text-red-600 hover:text-red-800" data-id="${p.id}"><i class="ri-delete-bin-line"></i> Delete Permanently</button>
            </td>
          `;
          purchasesBody.appendChild(row);
        });
      }

      // --- Attach event listeners for actions ---
      // Branches
      let restoreBranchId = null;
      const restoreBranchModal = document.getElementById('restore-branch-modal');
      const restoreWithAllBtn = document.getElementById('restore-branch-with-all');
      const restoreOnlyBtn = document.getElementById('restore-branch-only');
      const restoreCancelBtn = document.getElementById('restore-branch-cancel');
      // Delete Shop Modal logic
      let deleteShopId = null;
      const deleteShopModal = document.getElementById('delete-shop-modal');
      const deleteShopWithAllBtn = document.getElementById('delete-shop-with-all');
      const deleteShopOnlyBtn = document.getElementById('delete-shop-only');
      const deleteShopCancelBtn = document.getElementById('delete-shop-cancel');

      branchesBody.querySelectorAll('.restore-branch-btn').forEach(btn => {
        btn.onclick = function() {
          restoreBranchId = btn.dataset.id;
          if (restoreBranchModal) restoreBranchModal.classList.remove('hidden');
        };
      });
      if (restoreWithAllBtn) {
        restoreWithAllBtn.onclick = async function() {
          if (!restoreBranchId) return;
          await fetch(`/api/restore/branch/${restoreBranchId}?withAll=true`, { method: 'POST', headers: getHeaders() });
          if (restoreBranchModal) restoreBranchModal.classList.add('hidden');
          restoreBranchId = null;
          await renderArchiveSection();
          // Refresh all main tables
          if (typeof renderBranches === 'function') await renderBranches();
          if (typeof renderUsers === 'function') await renderUsers();
          if (typeof renderClients === 'function') await renderClients();
          if (typeof renderTransactions === 'function') await renderTransactions();
          if (typeof populateAllBranchSelects === 'function') await populateAllBranchSelects();
          alert('Shop, users, clients, and purchases restored!');
        };
      }
      if (restoreOnlyBtn) {
        restoreOnlyBtn.onclick = async function() {
          if (!restoreBranchId) return;
          await fetch(`/api/restore/branch/${restoreBranchId}?withAll=false`, { method: 'POST', headers: getHeaders() });
          if (restoreBranchModal) restoreBranchModal.classList.add('hidden');
          restoreBranchId = null;
          await renderArchiveSection();
          // Refresh all main tables
          if (typeof renderBranches === 'function') await renderBranches();
          if (typeof renderUsers === 'function') await renderUsers();
          if (typeof renderClients === 'function') await renderClients();
          if (typeof renderTransactions === 'function') await renderTransactions();
          if (typeof populateAllBranchSelects === 'function') await populateAllBranchSelects();
          alert('Shop and users restored!');
        };
      }
      if (restoreCancelBtn) {
        restoreCancelBtn.onclick = function() {
          if (restoreBranchModal) restoreBranchModal.classList.add('hidden');
          restoreBranchId = null;
        };
      }
      branchesBody.querySelectorAll('.delete-branch-archive-btn').forEach(btn => {
        btn.onclick = function() {
          deleteShopId = btn.dataset.id;
          if (deleteShopModal) deleteShopModal.classList.remove('hidden');
        };
      });
      if (deleteShopWithAllBtn) {
        deleteShopWithAllBtn.onclick = async function() {
          if (!deleteShopId) return;
          await fetch(`/api/archived-branches/${deleteShopId}?withAll=true`, { method: 'DELETE', headers: getHeaders() });
          if (deleteShopModal) deleteShopModal.classList.add('hidden');
          deleteShopId = null;
          await renderArchiveSection();
          // Refresh all main tables
          if (typeof renderBranches === 'function') await renderBranches();
          if (typeof renderUsers === 'function') await renderUsers();
          if (typeof renderClients === 'function') await renderClients();
          if (typeof renderTransactions === 'function') await renderTransactions();
          if (typeof populateAllBranchSelects === 'function') await populateAllBranchSelects();
          alert('Shop, users, clients, and purchases permanently deleted!');
        };
      }
      if (deleteShopOnlyBtn) {
        deleteShopOnlyBtn.onclick = async function() {
          if (!deleteShopId) return;
          await fetch(`/api/archived-branches/${deleteShopId}?withAll=false`, { method: 'DELETE', headers: getHeaders() });
          if (deleteShopModal) deleteShopModal.classList.add('hidden');
          deleteShopId = null;
          await renderArchiveSection();
          // Refresh all main tables
          if (typeof renderBranches === 'function') await renderBranches();
          if (typeof renderUsers === 'function') await renderUsers();
          if (typeof renderClients === 'function') await renderClients();
          if (typeof renderTransactions === 'function') await renderTransactions();
          if (typeof populateAllBranchSelects === 'function') await populateAllBranchSelects();
          alert('Shop and users permanently deleted!');
        };
      }
      if (deleteShopCancelBtn) {
        deleteShopCancelBtn.onclick = function() {
          if (deleteShopModal) deleteShopModal.classList.add('hidden');
          deleteShopId = null;
        };
      }
      // Users
      usersBody.querySelectorAll('.restore-user-btn').forEach(btn => {
        btn.onclick = async function() {
          if (!confirm('Restore this user?')) return;
          await fetch(`/api/restore/user/${btn.dataset.id}`, { method: 'POST', headers: getHeaders() });
          await renderArchiveSection();
          alert('User restored!');
        };
      });
      usersBody.querySelectorAll('.delete-user-archive-btn').forEach(btn => {
        btn.onclick = async function() {
          if (!confirm('Permanently delete this user?')) return;
          await fetch(`/api/archived-users/${btn.dataset.id}`, { method: 'DELETE', headers: getHeaders() });
          await renderArchiveSection();
          alert('User permanently deleted!');
        };
      });
      // Clients
      clientsBody.querySelectorAll('.restore-client-btn').forEach(btn => {
        btn.onclick = async function() {
          if (!confirm('Restore this client?')) return;
          await fetch(`/api/restore/client/${btn.dataset.branch}/${btn.dataset.index}`, { method: 'POST', headers: getHeaders() });
          await renderArchiveSection();
          if (typeof renderClients === 'function') await renderClients(); // Refresh main clients table
          alert('Client restored!');
        };
      });
      clientsBody.querySelectorAll('.delete-client-archive-btn').forEach(btn => {
        btn.onclick = async function() {
          if (!confirm('Permanently delete this client?')) return;
          await fetch(`/api/archived-clients/${btn.dataset.branch}/${btn.dataset.index}`, { method: 'DELETE', headers: getHeaders() });
          await renderArchiveSection();
          alert('Client permanently deleted!');
        };
      });
      // Purchases
      purchasesBody.querySelectorAll('.restore-purchase-btn').forEach(btn => {
        btn.onclick = async function() {
          if (!confirm('Restore this purchase?')) return;
          await fetch(`/api/restore/purchase/${btn.dataset.id}`, { method: 'POST', headers: getHeaders() });
          await renderArchiveSection();
          if (typeof renderTransactions === 'function') await renderTransactions(); // Refresh main transactions table
          alert('Purchase restored!');
        };
      });
      purchasesBody.querySelectorAll('.delete-purchase-archive-btn').forEach(btn => {
        btn.onclick = async function() {
          if (!confirm('Permanently delete this purchase?')) return;
          await fetch(`/api/archived-purchases/${btn.dataset.id}`, { method: 'DELETE', headers: getHeaders() });
          await renderArchiveSection();
          alert('Purchase permanently deleted!');
        };
      });
    }

    // Helper to get headers with auth
    function getHeaders() {
      const loggedInUser = JSON.parse(sessionStorage.getItem('loggedInUser'));
      const role = loggedInUser?.role || '';
      return {
        'Content-Type': 'application/json',
        'x-user-role': role.trim()
      };
    }

    // Show archive section logic (ensure renderArchiveSection is called)
    if (archiveSidebarLink && archiveSection) {
      archiveSidebarLink.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelectorAll('main > section').forEach(sec => {
          if (sec !== archiveSection) sec.classList.add('hidden');
        });
        archiveSection.classList.remove('hidden');
        document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('sidebar-active'));
        archiveSidebarLink.classList.add('sidebar-active');
        renderArchiveSection(); // <--- Fetch and render archive data
      });
    }
});

// --- Excel Export Logic ---
async function getFilteredDataForExport() {
    const allPurchases = await DataAPI.getPurchases();
    let filtered = [...allPurchases];
    // Branch filter
    const branchFilter = document.getElementById('excel-branch-filter').value;
    if (branchFilter) {
        filtered = filtered.filter(p => 
            p.branchId === branchFilter || p.shopName === branchFilter
        );
    }
    // Date range filter
    const dateFrom = document.getElementById('excel-date-from').value;
    const dateTo = document.getElementById('excel-date-to').value;
    if (dateFrom) {
        filtered = filtered.filter(p => {
            const d = new Date(p.dateTime || p.date);
            return d >= new Date(dateFrom);
        });
    }
    if (dateTo) {
        filtered = filtered.filter(p => {
            const d = new Date(p.dateTime || p.date);
            return d <= new Date(dateTo + 'T23:59:59'); // Include whole day
        });
    }
    // Client filter
    const clientFilter = document.getElementById('excel-client-filter').value.trim().toLowerCase();
    if (clientFilter) {
        filtered = filtered.filter(p => 
            (p.clientName || '').toLowerCase().includes(clientFilter)
        );
    }
    // --- FLATTEN purchases ---
    // Each product in a transaction becomes a separate row
    let flatRows = [];
    filtered.forEach(p => {
        if (Array.isArray(p.purchases) && p.purchases.length > 0) {
            p.purchases.forEach(item => {
                let combinedVariant = '';
                if (item.variant && item.variant2) combinedVariant = item.variant + ', ' + item.variant2;
                else if (item.variant) combinedVariant = item.variant;
                else if (item.variant2) combinedVariant = item.variant2;
                flatRows.push({
                    ...p,
                    purchasedItem: item.purchasedItem,
                    variant: combinedVariant,
                    quantity: item.quantity,
                    amount: item.amount,
                    money: item.money
                });
            });
        } else {
            let combinedVariant = '';
            if (p.variant && p.variant2) combinedVariant = p.variant + ', ' + p.variant2;
            else if (p.variant) combinedVariant = p.variant;
            else if (p.variant2) combinedVariant = p.variant2;
            flatRows.push({ ...p, variant: combinedVariant });
        }
    });
    // Sort by date (newest first)
    flatRows.sort((a, b) => {
        const aTime = new Date(a.dateTime || a.date || 0).getTime();
        const bTime = new Date(b.dateTime || b.date || 0).getTime();
        return bTime - aTime;
    });
    return flatRows;
}

// --- Excel Export Event Listeners ---
function initializeExcelExportEventListeners() {
    const previewBtn = document.getElementById('preview-export-btn');
    const downloadBtn = document.getElementById('download-excel-btn');
    const clearBtn = document.getElementById('clear-filters-btn');
    previewBtn.onclick = previewExport;
    downloadBtn.onclick = downloadExcel;
    clearBtn.onclick = clearFilters;
}

async function previewExport() {
    const preview = document.getElementById('export-preview');
    const previewHeader = document.getElementById('preview-header');
    const previewBody = document.getElementById('preview-body');
    const previewCount = document.getElementById('preview-count');
    const selectedCols = Array.from(document.querySelectorAll('input[name="excel-columns"]:checked')).map(cb => cb.value);
    const allPurchases = await DataAPI.getPurchases();
    let filtered = [...allPurchases];
    // Branch filter
    const branchFilter = document.getElementById('excel-branch-filter').value;
    if (branchFilter) {
        filtered = filtered.filter(p => 
            p.branchId === branchFilter || p.shopName === branchFilter
        );
    }
    // Date range filter
    const dateFrom = document.getElementById('excel-date-from').value;
    const dateTo = document.getElementById('excel-date-to').value;
    if (dateFrom) {
        filtered = filtered.filter(p => {
            const d = new Date(p.dateTime || p.date);
            return d >= new Date(dateFrom);
        });
    }
    if (dateTo) {
        filtered = filtered.filter(p => {
            const d = new Date(p.dateTime || p.date);
            return d <= new Date(dateTo + 'T23:59:59'); // Include whole day
        });
    }
    // Client filter
    const clientFilter = document.getElementById('excel-client-filter').value.trim().toLowerCase();
    if (clientFilter) {
        filtered = filtered.filter(p => 
            (p.clientName || '').toLowerCase().includes(clientFilter)
        );
    }
    // Columns to merge (grouped):
    const mergeCols = [
        'shopName', 'clientName', 'phoneNumber', 'dateTime', 'invoiceFileName', 'purchasedInvoiceFileName', 'invoiceNumber', 'comment'
    ];
    // Build header
    previewHeader.innerHTML = '';
    selectedCols.forEach(col => {
        let label = col;
        if (col === 'shopName') label = 'Shop Name';
        if (col === 'branchId') label = 'Shop';
        if (col === 'clientName') label = 'Client Name';
        if (col === 'phoneNumber') label = 'Phone Number';
        if (col === 'purchasedItem') label = 'Item';
        if (col === 'quantity') label = 'Quantity';
        if (col === 'amount') label = 'Amount';
        if (col === 'money') label = 'Money';
        if (col === 'dateTime') label = 'Date & Time';
        if (col === 'invoiceFileName') label = 'Product Invoice File Name';
        if (col === 'purchasedInvoiceFileName') label = 'Product Purchased Invoice File Name';
        if (col === 'invoiceNumber') label = 'Invoice No.';
        if (col === 'comment') label = 'Comment';
        previewHeader.innerHTML += `<th class="p-2 min-w-[120px]">${label}</th>`;
    });
    // Build body (first 10 transactions, but may be more rows due to products)
    previewBody.innerHTML = '';
   // Build previewRows array
let previewRows = [];
for (let t = 0; t < filtered.length; t++) {
        const p = filtered[t];
        const products = Array.isArray(p.purchases) && p.purchases.length > 0 ? p.purchases : [{
            purchasedItem: p.purchasedItem,
            variant: (p.variant && p.variant2) ? p.variant + ', ' + p.variant2 : (p.variant || p.variant2 || ''),
            quantity: p.quantity,
            amount: p.amount,
            money: p.money,
            dateTime: p.dateTime,
            parentDateTime: p.dateTime || p.date
        }];
        const n = products.length;
    for (let i = 0; i < n; i++) {
        previewRows.push({
            ...products[i],
            parentDateTime: p.dateTime || p.date,
            p: p,
            i: i,
            n: n
        });
    }
}
// Sort previewRows by parentDateTime descending
previewRows.sort((a, b) => {
    const aTime = new Date(a.parentDateTime || a.dateTime || 0).getTime();
    const bTime = new Date(b.parentDateTime || b.dateTime || 0).getTime();
    return bTime - aTime;
});
// Render only the first 10 rows
previewBody.innerHTML = '';
for (let rowIdx = 0; rowIdx < Math.min(previewRows.length, 10); rowIdx++) {
    const rowObj = previewRows[rowIdx];
    const p = rowObj.p;
    const i = rowObj.i;
    const n = rowObj.n;
            let tr = '<tr>';
            selectedCols.forEach((col, colIdx) => {
                if (mergeCols.includes(col)) {
                    if (i === 0) {
                        let value = '';
                        if (col === 'dateTime') value = p.dateTime || p.date || '';
                        else if (col === 'invoiceFileName') value = p.invoiceFileName || '';
                        else if (col === 'purchasedInvoiceFileName') value = p.purchasedInvoiceFileName || '';
                        else value = p[col] !== undefined ? p[col] : '';
                tr += `<td class="p-2"${n > 1 ? ` rowspan="${Math.min(n, 10-rowIdx)}"` : ''}>${value}</td>`;
                    }
                } else if (col === 'purchasedItem') {
            tr += `<td class="p-2">${rowObj.purchasedItem || ''}</td>`;
        } else if (col === 'variant/type') {
            tr += `<td class="p-2">${rowObj.variant && rowObj.variant.trim() ? rowObj.variant : '<span style=\"color:gray\">No type</span>'}</td>`;
                } else if (col === 'quantity') {
            tr += `<td class="p-2">${rowObj.amount !== undefined ? rowObj.amount : (rowObj.quantity !== undefined ? rowObj.quantity : '')}</td>`;
                } else if (col === 'amount') {
            tr += `<td class="p-2">${rowObj.variant2 || rowObj.amount || rowObj.weight || rowObj.units || ''}</td>`;
                } else if (col === 'money') {
            tr += `<td class="p-2">${rowObj.money !== undefined ? rowObj.money : ''}</td>`;
                } else if (col === 'units') {
            tr += `<td class="p-2">${rowObj.variant2 || rowObj.amount || rowObj.weight || rowObj.units || ''}</td>`;
                } else {
                    tr += `<td class="p-2">${p[col] !== undefined ? p[col] : ''}</td>`;
                }
            });
            tr += '</tr>';
            previewBody.innerHTML += tr;
    }
    preview.classList.remove('hidden');
    // Count total rows (not just transactions)
    let totalRows = 0;
    filtered.forEach(p => {
        const products = Array.isArray(p.purchases) && p.purchases.length > 0 ? p.purchases : [{
            purchasedItem: p.purchasedItem,
            variant: (p.variant && p.variant2) ? p.variant + ', ' + p.variant2 : (p.variant || p.variant2 || ''),
            quantity: p.quantity,
            amount: p.amount,
            money: p.money
        }];
        totalRows += products.length;
    });
    previewCount.textContent = totalRows;
    // Enable download button
    document.getElementById('download-excel-btn').disabled = false;
    document.getElementById('download-excel-btn').classList.remove('bg-gray-200', 'cursor-not-allowed', 'text-gray-700');
    document.getElementById('download-excel-btn').classList.add('bg-green-600', 'hover:bg-green-700', 'text-white');
}

async function downloadExcel() {
    const selectedCols = Array.from(document.querySelectorAll('input[name="excel-columns"]:checked')).map(cb => cb.value);
    const allPurchases = await DataAPI.getPurchases();
    let filtered = [...allPurchases];
    // Branch filter
    const branchFilter = document.getElementById('excel-branch-filter').value;
    if (branchFilter) {
        filtered = filtered.filter(p => 
            p.branchId === branchFilter || p.shopName === branchFilter
        );
    }
    // Date range filter
    const dateFrom = document.getElementById('excel-date-from').value;
    const dateTo = document.getElementById('excel-date-to').value;
    if (dateFrom) {
        filtered = filtered.filter(p => {
            const d = new Date(p.dateTime || p.date);
            return d >= new Date(dateFrom);
        });
    }
    if (dateTo) {
        filtered = filtered.filter(p => {
            const d = new Date(p.dateTime || p.date);
            return d <= new Date(dateTo + 'T23:59:59'); // Include whole day
        });
    }
    // Client filter
    const clientFilter = document.getElementById('excel-client-filter').value.trim().toLowerCase();
    if (clientFilter) {
        filtered = filtered.filter(p => 
            (p.clientName || '').toLowerCase().includes(clientFilter)
        );
    }

    // --- CRITICAL: Sort transactions BEFORE flattening ---
    filtered.sort((a, b) => {
        const aTime = new Date(a.dateTime || a.date || 0).getTime();
        const bTime = new Date(b.dateTime || b.date || 0).getTime();
        return bTime - aTime;
    });

    // Columns to merge (grouped):
    const mergeCols = [
        'shopName', 'branchId', 'clientName', 'phoneNumber', 'dateTime', 'invoiceFileName', 'purchasedInvoiceFileName', 'invoiceNumber', 'comment'
    ];
    // Build export rows and track merges
    let exportRows = [];
    let merges = [];
    let rowIdx = 1; // 1-based for SheetJS merges (header is row 0)
    filtered.forEach(p => {
        const products = Array.isArray(p.purchases) && p.purchases.length > 0 ? p.purchases : [{
            purchasedItem: p.purchasedItem,
            variant: (p.variant && p.variant2) ? p.variant + ', ' + p.variant2 : (p.variant || p.variant2 || ''),
            quantity: p.quantity,
            amount: p.amount,
            money: p.money
        }];
        const n = products.length;
        for (let i = 0; i < n; i++) {
            const row = {};
            selectedCols.forEach(col => {
                if (mergeCols.includes(col)) {
                    if (i === 0) {
                        if (col === 'shopName' || col === 'branchId') row[col] = p.shopName || p.branchId || '';
                        else if (col === 'dateTime') row[col] = p.dateTime || p.date || '';
                        else if (col === 'invoiceFileName') row[col] = p.invoiceFileName || '';
                        else if (col === 'purchasedInvoiceFileName') row[col] = p.purchasedInvoiceFileName || '';
                        else row[col] = p[col] !== undefined ? p[col] : '';
                    } else {
                        row[col] = '';
                    }
                } else if (col === 'purchasedItem') {
                    row[col] = products[i]?.purchasedItem || '';
                } else if (col === 'variant/type') {
                    row[col] = (products[i]?.variant && products[i]?.variant.trim()) ? products[i].variant : 'No type';
                } else if (col === 'quantity') {
                    row[col] = products[i]?.amount !== undefined ? products[i].amount : (products[i]?.quantity !== undefined ? products[i].quantity : '');
                } else if (col === 'amount') {
                    row[col] = products[i]?.variant2 || products[i]?.amount || products[i]?.weight || products[i]?.units || '';
                } else if (col === 'money') {
                    row[col] = products[i]?.money !== undefined ? products[i].money : '';
                } else if (col === 'units') {
                    row[col] = products[i]?.variant2 || products[i]?.amount || products[i]?.weight || products[i]?.units || '';
                } else {
                    row[col] = p[col] !== undefined ? p[col] : '';
                }
            });
            exportRows.push(row);
        }
        // Add merges for each mergeCol if more than 1 product
        if (n > 1) {
            selectedCols.forEach((col, colIdx) => {
                if (mergeCols.includes(col)) {
                    merges.push({ s: { r: rowIdx, c: colIdx }, e: { r: rowIdx + n - 1, c: colIdx } });
                }
            });
        }
        rowIdx += n;
    });

    if (!exportRows.length) {
        alert('No data to export!');
        return;
    }

    // DO NOT sort exportRows after flattening! This keeps products and merged columns in sync.

    // After building exportRows and merges, set column widths and row heights for better readability
    const ws = XLSX.utils.json_to_sheet(exportRows);
    // Set column widths (wider for readability)
    const colWidths = selectedCols.map(col => {
        if (["shopName","branchId","clientName","invoiceFileName","purchasedInvoiceFileName","comment"].includes(col)) return { wch: 28 };
        if (["purchasedItem","variant"].includes(col)) return { wch: 20 };
        if (["amount","quantity","invoiceNumber","money"].includes(col)) return { wch: 16 };
        if (["dateTime"].includes(col)) return { wch: 26 };
        return { wch: 18 };
    });
    ws['!cols'] = colWidths;
    // Set row heights (taller for readability)
    ws['!rows'] = exportRows.map(() => ({ hpt: 28 }));
    // Apply merges for grouped columns
    if (merges.length) ws['!merges'] = merges;
    // Add table style (header bold, borders)
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
        if (cell) cell.s = { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } };
    }
    for (let R = 1; R <= exportRows.length; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
            if (cell) cell.s = { alignment: { vertical: 'center', horizontal: 'left', wrapText: true }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } };
        }
    }
    // Build workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, 'transactions_export.xlsx');
}

function clearFilters() {
    document.getElementById('excel-branch-filter').value = '';
    document.getElementById('excel-date-from').value = '';
    document.getElementById('excel-date-to').value = '';
    document.getElementById('excel-client-filter').value = '';
    document.querySelectorAll('input[name="excel-columns"]').forEach(cb => cb.checked = true);
    document.getElementById('export-preview').classList.add('hidden');
    document.getElementById('download-excel-btn').disabled = true;
    document.getElementById('download-excel-btn').classList.add('bg-gray-200', 'cursor-not-allowed', 'text-gray-700');
    document.getElementById('download-excel-btn').classList.remove('bg-green-600', 'hover:bg-green-700', 'text-white');
    document.getElementById('preview-count').textContent = '0';
}

function logout() {
    sessionStorage.removeItem('loggedInUser');
    sessionStorage.setItem('logoutMessage', 'Logging out...');
    window.location.href = 'loading.html';
}

// Add the same PRODUCT_VARIANTS mapping as in purchase-script.js
const PRODUCT_VARIANTS = {
  "WEATHER GUARD CLASSIC SEMI GLOSS": { amountLabel: "Buckets" },
  "MIXED WEATHER GUARD": { amountLabel: "Buckets" },
  "SILK CLASSIC SEMI GLOSS": { amountLabel: "Buckets" },
  "MIXED SILK": { amountLabel: "Buckets" },
  "IPOLY EMULSION ECONOMIC GRADE": { amountLabel: "Buckets" },
  "PREMIUM EMULSION MATT CLASSIC": { amountLabel: "Buckets" },
  "KIPAU DESIGN": { amountLabel: "Units" },
  "KIPAU PLASTER 25kg": { amountLabel: "Bags" },
  "KIPAU PLASTER 20kg": { amountLabel: "Bags" },
  "KIPAU 2 IN 1": { amountLabel: "Units" },
  "KIPAU T3": { amountLabel: "Units" },
  "FAST DRY": { amountLabel: "Buckets" },
  "GLOSS ENAMEL": { amountLabel: "Buckets" },
  "NITRO CELLALOSE": { amountLabel: "Buckets" },
  "THINNER": { amountLabel: "Cans" },
  "2K CRYL": { amountLabel: "Buckets" },
  "WOOD GLUE": { amountLabel: "Buckets" },
};
