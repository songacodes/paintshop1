// --- Global logout function ---
function logout() {
    sessionStorage.removeItem('loggedInUser');
    sessionStorage.setItem('logoutMessage', 'Logging out...');
    window.location.href = 'loading.html';
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Master admin JS loaded');
    const loggedInUser = JSON.parse(sessionStorage.getItem('loggedInUser'));
    console.log('Logged in user:', loggedInUser); // Debug log

    // Ensure proper authentication for Master Admin
    if (!loggedInUser || loggedInUser.role !== 'master-admin') {
        console.log('Invalid user role, redirecting to login'); // Debug log
        sessionStorage.removeItem('loggedInUser');
        window.location.href = 'login.html';
        return;
    }

    // Verify we can access the API (using a non-sensitive endpoint first)
    try {
        const testResponse = await fetch('http://localhost:3000/api/branches', {
            headers: {
                'Content-Type': 'application/json',
                'x-user-role': loggedInUser.role
            }
        });
        
        if (!testResponse.ok) {
            throw new Error(`API access failed: ${testResponse.status}`);
        }
        
        console.log('API access verified'); // Debug log
    } catch (error) {
        console.error('API access test failed:', error);
        alert('Failed to connect to the server. Please try logging in again.');
        sessionStorage.removeItem('loggedInUser');
        window.location.href = 'login.html';
        return;
    }

    // --- Branch Form Listener (mirroring Super Admin) ---
    const branchForm = document.getElementById('branch-form');
    if (branchForm) {
        branchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const branchName = document.getElementById('branch-name').value.trim();
            const branchId = branchName.toLowerCase().replace(/\s+/g, '');
            const branchLocation = document.getElementById('branch-location').value.trim();
            const branchUserPassword = document.getElementById('branch-user-password').value;
            const adminUsername = document.getElementById('branch-admin-username').value.trim().toLowerCase();
            const adminPassword = document.getElementById('branch-admin-password').value;

            if (!branchName || !branchLocation || !branchUserPassword || !adminUsername || !adminPassword) {
                alert('All branch fields are required.');
                return;
            }

            try {
                // Check if branch ID already exists
                const existingBranches = await DataAPI.getBranches();
                if (existingBranches[branchId]) {
                    alert('A branch with this name (ID) already exists. Please choose a different name.');
                    return;
                }
                // Check if branch user or admin user already exists
                const existingUsers = await DataAPI.getUsers();
                if (existingUsers[branchId]) {
                    alert(`The username "${branchId}" for the branch user already exists. Please choose a different branch name.`);
                    return;
                }
                if (existingUsers[adminUsername]) {
                    alert(`The admin username "${adminUsername}" already exists. Please choose a different admin username.`);
                    return;
                }
                // Save branch (will use PUT for creation/update as per server.js)
                await DataAPI.saveBranch(branchId, { name: branchName, location: branchLocation });
                const now = new Date().toISOString();
                // Save branch user
                try {
                    await DataAPI.saveUser(branchId, { password: branchUserPassword, role: 'branch', branch: branchId, createdAt: now });
                } catch (err) {
                    await DataAPI.deleteBranch(branchId);
                    alert('Failed to create branch user: ' + (err.message || 'Unknown error. Branch creation rolled back.'));
                    return;
                }
                // Save branch admin user
                try {
                    await DataAPI.saveUser(adminUsername, { password: adminPassword, role: 'admin', branch: branchId, createdAt: now });
                } catch (err) {
                    await DataAPI.deleteUser(branchId);
                    await DataAPI.deleteBranch(branchId);
                    alert('Failed to create branch admin user: ' + (err.message || 'Unknown error. Branch creation rolled back.'));
                    return;
                }
                alert('Branch and users added successfully! They can now log in.');
                branchForm.reset();
                await renderBranches();
                await renderClients();
                await renderUsers();
                await renderTransactions();
                await populateAllBranchSelects();
            } catch (error) {
                console.error('Error creating branch:', error);
                alert('Failed to create branch: ' + (error.message || 'Unknown error.'));
            }
        });
    }

    // --- Client Form Listener (mirroring Super Admin) ---
    const clientForm = document.getElementById('client-form');
    if (clientForm) {
        clientForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const branch = document.getElementById('client-branch').value;
            const clientName = document.getElementById('client-name').value;
            const phoneNumber = document.getElementById('client-phone').value;
            if (!branch) {
                alert('Please select a branch for the client.');
                return;
            }
            if (!clientName || !phoneNumber) {
                alert('Client name and phone number are required.');
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
                await DataAPI.saveClient(branch, { name: clientName, phoneNumber: phoneNumber });
                alert('Client added successfully!');
                clientForm.reset();
                await renderClients();
            } catch (error) {
                console.error('Error adding client:', error);
                alert('Failed to add client: ' + (error.message || 'Unknown error.'));
            }
        });
    }

    // --- Transaction Management (Copied from Super Admin, as functionality is similar) ---
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
            row.innerHTML = `<td colspan="13" class="text-center text-gray-500">No transactions found.</td>`;
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
                    const aTime = new Date(a.dateTimeISO || a.dateTime || a.date || 0).getTime();
                    const bTime = new Date(b.dateTimeISO || b.dateTime || b.date || 0).getTime();
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
                let units = ''; // Added for units
                if (Array.isArray(p.purchases)) {
                    purchaseItems = p.purchases.map(item => item.purchasedItem).join('<br>');
                    variants = p.purchases.map(item => (item.variant && item.variant.trim()) ? item.variant : '<span style="color:gray">No type</span>').join('<br>');
                    amounts = p.purchases.map(item => item.variant2 ? item.variant2 : (item.units || item.weight || '')).join('<br>');
                    quantities = p.purchases.map(item => (item.amount !== undefined ? item.amount : '')).join('<br>');
                    moneys = p.purchases.map(item => (item.money !== undefined ? item.money : '')).join('<br>');
                    units = p.purchases.map(item => (item.units !== undefined ? item.units : '')).join('<br>'); // Added for units
                } else {
                    purchaseItems = p.purchasedItem || '';
                    variants = (p.variant && p.variant.trim()) ? p.variant : '<span style="color:gray">No type</span>';
                    amounts = p.variant2 ? p.variant2 : (p.units || p.weight || '');
                    quantities = (p.amount !== undefined ? p.amount : '');
                    moneys = (p.money !== undefined ? p.money : '');
                    units = (p.units !== undefined ? p.units : ''); // Added for units
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
                `;
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
                        const byteCharacters = atob(fileContent.split(',')[1]);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        const blob = new Blob([byteArray], { type: mimeType });
                        if (action === 'view') {
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank');
                            setTimeout(() => URL.revokeObjectURL(url), 1000);
                        } else if (action === 'download') {
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
                        const byteCharacters = atob(fileContent.split(',')[1]);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        const blob = new Blob([byteArray], { type: mimeType });
                        if (action === 'view') {
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank');
                            setTimeout(() => URL.revokeObjectURL(url), 1000);
                        } else if (action === 'download') {
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
    if (transactionSearchInput) transactionSearchInput.addEventListener('input', renderTransactions);


    // --- Users Table (Modified for Master Admin) ---
    async function renderUsers() {
        const sortDropdown = document.getElementById('user-sort-dropdown');
        const sortOrderDropdown = document.getElementById('user-sort-order');
        const userTable = document.getElementById('users-table-body');
        if (!sortDropdown || !sortOrderDropdown || !userTable) return;
        const users = await DataAPI.getUsers(); // This gets all users, including superadmin

        let userList = Object.entries(users)
            .map(([username, u]) => ({ username, ...u })); // Map all users for sorting/display

        const sortKey = sortDropdown.value;
        const sortOrder = sortOrderDropdown.value;

        userList.sort((a, b) => {
        if (sortKey === 'username') {
                return sortOrder === 'asc'
                    ? a.username.localeCompare(b.username)
                    : b.username.localeCompare(a.username);
            } else if (sortKey === 'branch') {
                return sortOrder === 'asc'
                    ? (a.branch || '').localeCompare(b.branch || '')
                    : (b.branch || '').localeCompare(a.branch || '');
            } else if (sortKey === 'role') {
                return sortOrder === 'asc'
                    ? a.role.localeCompare(b.role)
                    : b.role.localeCompare(a.role);
            } else if (sortKey === 'createdAt') {
                return sortOrder === 'asc'
                    ? new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
                    : new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            }
            return 0;
        });

        userTable.innerHTML = '';
        if (userList.length === 0) {
            // Dynamically determine the number of columns in the table header
            const table = document.querySelector('#users-section table');
            const thCount = table ? table.querySelectorAll('thead th').length : 5;
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

            // Master admin cannot edit or view passwords.
            // Action column will simply show "View" for super/master, or nothing
            const actionContent = (u.role === 'superadmin' || u.role === 'master-admin') ? 
                                    '<span class="text-gray-400">System User</span>' : 
                                    '<span class="text-gray-400">No actions</span>'; // Master admin can't edit other users either via this UI


            userTable.insertRow().innerHTML = `
                <td class="p-2">${u.username}</td>
                <td class="p-2">${roleLabel}</td>
                <td class="p-2">${u.branch || ''}</td>
                <td class="p-2">${dateStr}</td>
                <td class="p-2 flex gap-2">${actionContent}</td>
            `;
        });
    }

    const userSortDropdown = document.getElementById('user-sort-dropdown');
    if (userSortDropdown) userSortDropdown.onchange = renderUsers;
    const userSortOrder = document.getElementById('user-sort-order');
    if (userSortOrder) userSortOrder.onchange = renderUsers;

    // --- Branches Table (Modified for Master Admin - No Delete Button) ---
    async function renderBranches() {
        const sortDropdown = document.getElementById('branch-sort-dropdown');
        const sortOrderDropdown = document.getElementById('branch-sort-order');
        const branchTable = document.getElementById('branches-table-body');
        if (!sortDropdown || !sortOrderDropdown || !branchTable) return;
        const sortKey = sortDropdown.value;
        const sortOrder = sortOrderDropdown.value;
        const branches = await DataAPI.getBranches();
        
        let branchList = Object.entries(branches).map(([id, b]) => ({ id, ...b }));
        if (sortKey === 'name') {
            branchList.sort((a, b) => sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
        }
        
        branchTable.innerHTML = '';
        if (branchList.length === 0) {
            const row = branchTable.insertRow();
            row.innerHTML = `<td colspan="4" class="text-center text-gray-500">No branches found.</td>`;
            return;
        }
        branchList.forEach(b => {
            const row = branchTable.insertRow();
            row.setAttribute('data-branch-id', b.id);
            row.innerHTML = `
                <td class="p-2">${b.name}</td>
                <td class="p-2">${b.location}</td>
                <td class="p-2">${b.id}</td>
                <td class="p-2">
                    <span class="text-gray-400">No actions</span> <!-- Master Admin cannot delete branches -->
                </td>
            `;
        });
    }

    const branchSortDropdown = document.getElementById('branch-sort-dropdown');
    if (branchSortDropdown) branchSortDropdown.onchange = renderBranches;
    const branchSortOrder = document.getElementById('branch-sort-order');
    if (branchSortOrder) branchSortOrder.onchange = renderBranches;

    // --- Clients Table (Copied from Super Admin, as functionality is similar but no 'Add Client' form) ---
    async function renderClients() {
        const sortDropdown = document.getElementById('client-sort-dropdown');
        const sortOrderDropdown = document.getElementById('client-sort-order');
        const clientTable = document.getElementById('clients-table-body');
        if (!sortDropdown || !sortOrderDropdown || !clientTable) return;
        const sortKey = sortDropdown.value;
        const sortOrder = sortOrderDropdown.value;
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
            `;
        });
    }

    const clientSortDropdown = document.getElementById('client-sort-dropdown');
    if (clientSortDropdown) clientSortDropdown.onchange = renderClients;
    const clientSortOrder = document.getElementById('client-sort-order');
    if (clientSortOrder) clientSortOrder.onchange = renderClients;

    // --- Delete Handler (Delegated listener for transactions, but disabled for branches/clients/users for Master Admin) ---
    async function handleDelete(type, id1, id2) {
        if (!confirm(`Are you sure you want to delete this ${type}? This action cannot be undone.`)) {
            return;
        }

        try {
            if (type === 'transaction') {
                await DataAPI.deletePurchase(id1);
            } 
            // For master admin, branch, client, user deletion is not allowed via UI.
            // The UI will not present the delete buttons for these.
            // However, the backend is still protected by authorize middleware.
            
            // Update all UI components to reflect changes
            await renderTransactions();
            await renderBranches();
            await renderClients();
            await renderUsers();
            await populateBranchDropdown(); // This populates branch dropdowns, helpful if clients form existed.
            
        } catch (e) {
            console.error('Delete error:', e);
            alert('Failed to delete: ' + (e.message || 'An unknown error occurred.'));
        }
    }

    // Event delegation for delete buttons (only applicable for transactions for Master Admin)
    document.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('[data-delete-type]');
        if (!deleteBtn) return;

        const type = deleteBtn.getAttribute('data-delete-type');
        const id1 = deleteBtn.getAttribute('data-id') || 
                   deleteBtn.getAttribute('data-branch'); 
        const id2 = deleteBtn.getAttribute('data-index'); 

        // Only allow handleDelete for 'transaction' type for Master Admin
        if (type === 'transaction') {
            await handleDelete(type, id1, id2);
        } else {
            alert(`Master Admin cannot delete ${type}s.`);
            console.warn(`Master Admin attempted to delete a ${type}. Action blocked by frontend.`);
        }
    });

    // --- Initial Render of All Sections ---
    await renderBranches();
    await populateAllBranchSelects();
    await renderClients();
    await renderUsers();
    await renderTransactions();
    initializeExcelExportEventListeners();

    // Attach logout event listener
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // --- Client Import Logic (Excel/CSV) ---
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
});

async function getFilteredData() {
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
    
    // Process multiple purchases
    filtered = filtered.map(p => {
        if (Array.isArray(p.purchases)) {
            // For multiple purchases, create a combined string for each field
            return {
                ...p,
                purchasedItem: p.purchases.map(item => item.purchasedItem).join(', '),
                quantity: p.purchases.map(item => item.quantity).join(', '),
                amount: p.purchases.map(item => item.amount).join(', ')
            };
        }
        return p;
    });
    
    // Sort by date (newest first) for better organization
    filtered.sort((a, b) => {
        const aTime = new Date(a.dateTime || a.date || 0).getTime();
        const bTime = new Date(b.dateTime || b.date || 0).getTime();
        return bTime - aTime; // Newest first
    });
    
    return filtered;
}

// --- Excel Export Logic for Master Admin ---
function initializeExcelExportEventListeners() {
    const previewBtn = document.getElementById('preview-export-btn');
    const downloadBtn = document.getElementById('download-excel-btn');
    const clearBtn = document.getElementById('clear-filters-btn');
    if (previewBtn) previewBtn.onclick = previewExport;
    if (downloadBtn) downloadBtn.onclick = downloadExcel;
    if (clearBtn) clearBtn.onclick = clearFilters;
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
        'shopName', 'branchId', 'clientName', 'phoneNumber', 'dateTime', 'invoiceFileName', 'purchasedInvoiceFileName', 'invoiceNumber', 'comment'
    ];
    // Build header
    previewHeader.innerHTML = '';
    selectedCols.forEach(col => {
        let label = col;
        if (col === 'shopName' || col === 'branchId') label = 'Shop';
        if (col === 'clientName') label = 'Client Name';
        if (col === 'phoneNumber') label = 'Phone Number';
        if (col === 'purchasedItem') label = 'Item';
        if (col === 'quantity') label = 'Quantity';
        if (col === 'amount' || col === 'units') label = 'Units';
        if (col === 'money') label = 'Money';
        if (col === 'dateTime') label = 'Date & Time';
        if (col === 'invoiceFileName') label = 'Product Invoice File Name';
        if (col === 'purchasedInvoiceFileName') label = 'Product Purchased Invoice File Name';
        if (col === 'invoiceNumber') label = 'Invoice No.';
        if (col === 'comment') label = 'Comment';
        if (col === 'variant/type') label = 'Variant/Type';
        previewHeader.innerHTML += `<th class="p-2 min-w-[120px]">${label}</th>`;
    });
    // Build body (first 10 transactions, but may be more rows due to products)
    // In previewExport, after building previewRows, sort by date descending before rendering
    let previewRows = [];
    for (let t = 0; t < filtered.length && previewRows.length < 10; t++) {
        const p = filtered[t];
        const products = Array.isArray(p.purchases) && p.purchases.length > 0 ? p.purchases : [{
            purchasedItem: p.purchasedItem,
            variant: p.variant,
            variant2: p.variant2,
            quantity: p.quantity,
            amount: p.amount,
            money: p.money,
            dateTime: p.dateTime,
            parentDateTime: p.dateTime || p.date
        }];
        const n = products.length;
        for (let i = 0; i < n && previewRows.length < 10; i++) {
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
    // Now render previewRows
    previewBody.innerHTML = '';
    for (let rowIdx = 0; rowIdx < previewRows.length; rowIdx++) {
        const rowObj = previewRows[rowIdx];
        const p = rowObj.p;
        const i = rowObj.i;
        const n = rowObj.n;
        let tr = '<tr>';
        selectedCols.forEach((col, colIdx) => {
            if (mergeCols.includes(col)) {
                if (i === 0) {
                    let value = '';
                    if (col === 'shopName' || col === 'branchId') value = p.shopName || p.branchId || '';
                    else if (col === 'dateTime') value = p.dateTime || p.date || '';
                    else if (col === 'invoiceFileName') value = p.invoiceFileName || '';
                    else if (col === 'purchasedInvoiceFileName') value = p.purchasedInvoiceFileName || '';
                    else value = p[col] !== undefined ? p[col] : '';
                    tr += `<td class="p-2"${n > 1 ? ` rowspan="${Math.min(n, 10-rowIdx)}"` : ''}>${value}</td>`;
                }
            } else if (col === 'purchasedItem') {
                tr += `<td class="p-2">${rowObj.purchasedItem || ''}</td>`;
            } else if (col === 'variant/type') {
                tr += `<td class="p-2">${rowObj.variant && rowObj.variant.trim() ? rowObj.variant : '<span style="color:gray">No type</span>'}</td>`;
            } else if (col === 'variant2') {
                tr += `<td class="p-2">${rowObj.variant2 || ''}</td>`;
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
            variant: p.variant,
            variant2: p.variant2,
            quantity: p.quantity,
            amount: p.amount,
            money: p.money
        }];
        totalRows += products.length;
    });
    previewCount.textContent = totalRows;
    // Enable download button
    const downloadBtn = document.getElementById('download-excel-btn');
    if (downloadBtn) {
        downloadBtn.disabled = false;
        downloadBtn.classList.remove('bg-gray-200', 'cursor-not-allowed', 'text-gray-700');
        downloadBtn.classList.add('bg-green-600', 'hover:bg-green-700', 'text-white');
    }
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
    // --- Prepare export rows and merges ---
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
            variant: p.variant,
            variant2: p.variant2,
            quantity: p.quantity,
            amount: p.amount,
            money: p.money
        }];
        const n = products.length;
        for (let i = 0; i < n; i++) {
            const row = {};
            selectedCols.forEach(col => {
                if (mergeCols.includes(col)) {
                    if (col === 'shopName' || col === 'branchId') row[col] = p.shopName || p.branchId || '';
                    else if (col === 'dateTime') row[col] = p.dateTime || p.date || '';
                    else if (col === 'invoiceFileName') row[col] = p.invoiceFileName || '';
                    else if (col === 'purchasedInvoiceFileName') row[col] = p.purchasedInvoiceFileName || '';
                    else row[col] = p[col] !== undefined ? p[col] : '';
                } else if (col === 'purchasedItem') {
                    row[col] = products[i]?.purchasedItem || '';
                } else if (col === 'variant/type') {
                    row[col] = (products[i]?.variant && products[i]?.variant.trim()) ? products[i].variant : 'No type';
                } else if (col === 'variant2') {
                    row[col] = products[i]?.variant2 || '';
                } else if (col === 'quantity') {
                    row[col] = products[i]?.amount !== undefined ? products[i].amount : (products[i]?.quantity !== undefined ? products[i].quantity : '');
                } else if (col === 'amount') {
                    row[col] = products[i]?.variant2 || products[i]?.amount || products[i]?.weight || products[i]?.units || '';
                } else if (col === 'money') {
                    row[col] = products[i]?.money !== undefined ? products[i].money : '';
                } else if (col === 'units') {
                    // Always map 'units' to variant2/unit/weight for Excel export
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
    // After building exportRows and merges, set column widths and row heights for better readability
    const ws = XLSX.utils.json_to_sheet(exportRows);
    // Set column widths for all columns, including 'units' and 'variant/type'
    const colWidths = selectedCols.map(col => {
        if (["shopName","branchId","clientName","invoiceFileName","purchasedInvoiceFileName","comment"].includes(col)) return { wch: 28 };
        if (["purchasedItem","variant/type","units"].includes(col)) return { wch: 20 };
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
    const downloadBtn = document.getElementById('download-excel-btn');
    if (downloadBtn) {
        downloadBtn.disabled = true;
        downloadBtn.classList.add('bg-gray-200', 'cursor-not-allowed', 'text-gray-700');
        downloadBtn.classList.remove('bg-green-600', 'hover:bg-green-700', 'text-white');
    }
    document.getElementById('preview-count').textContent = '0';
}

// --- Branch Dropdown Population ---
async function populateAllBranchSelects() {
    const branches = await DataAPI.getBranches();
    // For client form (if present)
    const clientBranchSelect = document.getElementById('client-branch');
    if (clientBranchSelect) {
        clientBranchSelect.innerHTML = '<option value="">Select a branch</option>';
        Object.entries(branches).forEach(([id, b]) => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = b.name;
            clientBranchSelect.appendChild(opt);
        });
    }
    // For Excel export filter
    const excelBranchFilter = document.getElementById('excel-branch-filter');
    if (excelBranchFilter) {
        excelBranchFilter.innerHTML = '<option value="">All Shops</option>';
        Object.entries(branches).forEach(([id, b]) => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = b.name;
            excelBranchFilter.appendChild(opt);
        });
    }
}

// After rendering branches, also call populateAllBranchSelects
