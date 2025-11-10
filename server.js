const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;
const { v4: uuidv4 } = require('uuid');

const cors = require('cors');
app.use(cors());

// Increase body-parser limit for base64 invoices
app.use(express.json({ limit: '50mb' }));

const DB_PATH = path.join(__dirname, 'database.json');

app.use(express.static(__dirname));

// Initialize default users if database doesn't exist
function initializeDefaultUsers() {
  if (!fs.existsSync(DB_PATH)) {
    const defaultData = {
      users: {
        'superadmin': {
          password: 'admin123',
          role: 'superadmin',
          createdAt: new Date().toISOString()
        },
        'masteradmin': {
          password: 'master123',
          role: 'master-admin',
          createdAt: new Date().toISOString()
        }
      },
      branches: {},
      clients: {}, // Initialize as empty object for branches to hold client arrays
      purchases: [],
      loginLogs: [] // NEW: Initialize login logs as an empty array
    };
    writeDB(defaultData);
    return defaultData;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

// Helper to read DB
function readDB() {
  let db = {};
  if (fs.existsSync(DB_PATH)) {
    db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } else {
    db = initializeDefaultUsers(); // Ensure it's initialized if not present
  }

  // Ensure db.purchases is an array and each purchase has an ID
  if (!Array.isArray(db.purchases)) {
    db.purchases = [];
  }
  db.purchases = db.purchases.map(p => ({ ...p, id: p.id || uuidv4() }));

  // Ensure db.clients is an object, with arrays for each branch
  if (!db.clients || typeof db.clients !== 'object') {
    db.clients = {};
  }
  for (const branchId in db.clients) {
    if (!Array.isArray(db.clients[branchId])) {
      // Convert old object format to array if necessary, and ensure IDs
      db.clients[branchId] = Object.values(db.clients[branchId]).map(c => ({ ...c, id: c.id || uuidv4() }));
    } else {
      // Ensure existing array clients have IDs
      db.clients[branchId] = db.clients[branchId].map(c => ({ ...c, id: c.id || uuidv4() }));
    }
  }

  // Ensure db.loginLogs is an array
  if (!Array.isArray(db.loginLogs)) {
      db.loginLogs = [];
  }

  return db;
}

// Helper to write DB
function writeDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

// Ensure database file exists on startup
let db = initializeDefaultUsers(); // Call once at the start

// Middleware for authorization
function authorize(roles = []) {
  return (req, res, next) => {
    const userRole = req.headers['x-user-role'];
    console.log(`Authorization check: User role '${userRole}', Required roles: [${roles.join(', ')}]`);

    if (!userRole) {
      return res.status(401).json({ success: false, error: 'Unauthorized: No role provided', details: 'The x-user-role header is missing.' });
    }

    if (roles.length && !roles.includes(userRole)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions', details: `Your role '${userRole}' is not authorized for this action.` });
    }
    next();
  };
}

// --- AUTHENTICATION ---
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  const user = db.users[username];

  if (user && user.password === password) {
    // On successful login, log the attempt
    db.loginLogs.push({
      id: uuidv4(),
      username: username,
      role: user.role,
      branch: user.branch || null, // Include branch if available
      timestamp: new Date().toISOString(),
      status: 'success'
    });
    writeDB(db);
    // Return a simplified user object for the client-side session
    return res.json({ success: true, user: { username: username, role: user.role, branch: user.branch } });
  } else {
    // On failed login, log the attempt
    db.loginLogs.push({
      id: uuidv4(),
      username: username,
      role: 'unknown', // Role is unknown if login failed
      branch: null,
      timestamp: new Date().toISOString(),
      status: 'failure'
    });
    writeDB(db);
    return res.status(401).json({ success: false, error: 'Invalid username or password' });
  }
});

// --- LOGIN ACTIVITY LOGS (NEW ENDPOINTS) ---
app.post('/api/login-logs', (req, res) => {
    const db = readDB();
    const logEntry = req.body;
    if (!logEntry.username || !logEntry.timestamp || !logEntry.status) {
        return res.status(400).json({ success: false, error: 'Missing required log fields' });
    }
    logEntry.id = uuidv4(); // Ensure unique ID for each log
    db.loginLogs.push(logEntry);
    writeDB(db);
    res.json({ success: true, id: logEntry.id });
});

app.get('/api/login-logs', authorize(['superadmin']), (req, res) => {
    const db = readDB();
    res.json(db.loginLogs);
});


// --- USERS ---
app.get('/api/users', authorize(['superadmin', 'master-admin']), (req, res) => {
  const db = readDB();
  res.json(db.users);
});

app.post('/api/users', authorize(['superadmin', 'master-admin']), (req, res) => {
  const db = readDB();
  const { username, password, role, branch, createdBy } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ success: false, error: 'Username, password, and role are required' });
  }
  if (db.users[username]) {
    return res.status(409).json({ success: false, error: 'User with this username already exists' });
  }
  // If creating a superadmin, set createdBy if provided (not for the original superadmin)
  if (role === 'superadmin' && username !== 'superadmin') {
    db.users[username] = { password, role, branch: branch || null, createdAt: new Date().toISOString(), createdBy: createdBy || null };
  } else {
  db.users[username] = { password, role, branch: branch || null, createdAt: new Date().toISOString() };
  }
  writeDB(db);
  res.status(201).json({ success: true, message: 'User created successfully' });
});

app.put('/api/users/:username', authorize(['superadmin', 'master-admin']), (req, res) => {
  const db = readDB();
  const { username } = req.params;
  const { password, role, branch } = req.body;
  const loggedInUsername = req.headers['x-username'];

  const currentUser = db.users[username];
  if (!currentUser) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
  // Restrict editing superadmins: only original superadmin or creator can edit
  if (currentUser.role === 'superadmin' && username !== 'superadmin') {
    if (loggedInUsername !== 'superadmin' && currentUser.createdBy !== loggedInUsername) {
      return res.status(403).json({ success: false, error: 'You are not allowed to edit this superadmin.' });
  }
  }
  if (currentUser.role === 'superadmin' && username === 'superadmin') {
    // Only allow original superadmin to edit themselves
    if (loggedInUsername !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'You are not allowed to edit the original superadmin.' });
    }
  }
  db.users[username].password = password || db.users[username].password;
  if (req.headers['x-user-role'] === 'superadmin' && role) {
      db.users[username].role = role;
  }
  if (branch !== undefined) {
      db.users[username].branch = branch || null;
  } else if (db.users[username].branch === undefined) {
      db.users[username].branch = null;
  }
  if (req.body.newUsername && req.body.newUsername !== username) {
      const newUsername = req.body.newUsername;
      if (db.users[newUsername]) {
          return res.status(409).json({ success: false, error: 'New username already exists.' });
      }
      db.users[newUsername] = { ...db.users[username], username: newUsername };
      delete db.users[username];
      writeDB(db);
      return res.json({ success: true, message: 'User updated and username changed successfully', user: db.users[newUsername] });
  }
  writeDB(db);
  res.json({ success: true, message: 'User updated successfully', user: db.users[username] });
});

app.delete('/api/users/:username', authorize(['superadmin']), (req, res) => {
  const db = readDB();
  const { username } = req.params;
  const loggedInUsername = req.headers['x-username'];
  if (username === 'superadmin' || username === 'masteradmin') {
      return res.status(403).json({ success: false, error: 'Protected system user account cannot be deleted.' });
  }
  const userToDelete = db.users[username];
  if (!userToDelete) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
  // Restrict deleting superadmins: only original superadmin or creator can delete
  if (userToDelete.role === 'superadmin' && username !== 'superadmin') {
    if (loggedInUsername !== 'superadmin' && userToDelete.createdBy !== loggedInUsername) {
      return res.status(403).json({ success: false, error: 'You are not allowed to delete this superadmin.' });
    }
  }
  if (userToDelete.role === 'superadmin' && username === 'superadmin') {
    // Only allow original superadmin to delete themselves (should not be allowed)
    return res.status(403).json({ success: false, error: 'The original superadmin cannot be deleted.' });
  }
  // --- ARCHIVE LOGIC ---
  if (!db.archivedUsers) db.archivedUsers = {};
  db.archivedUsers[username] = userToDelete;
  delete db.users[username];
  writeDB(db);
  res.json({ success: true, message: 'User archived and deleted successfully' });
});

// --- BRANCHES ---
app.get('/api/branches', authorize(['superadmin', 'master-admin', 'admin', 'branch']), (req, res) => {
  const db = readDB();
  res.json(db.branches);
});

// PUT for branches will create or update
app.put('/api/branches/:branchId', authorize(['superadmin', 'master-admin']), (req, res) => {
  const db = readDB();
  const { branchId } = req.params;
  const { name, location } = req.body;
  if (!name || !location) {
    return res.status(400).json({ success: false, error: 'Branch name and location are required' });
  }
  db.branches[branchId] = { name, location };
  writeDB(db);
  res.json({ success: true, message: 'Branch saved successfully', branch: db.branches[branchId] });
});

app.delete('/api/branches/:branchId', authorize(['superadmin', 'master-admin']), (req, res) => {
  const db = readDB();
  const { branchId } = req.params;
  if (!db.branches[branchId]) {
    return res.status(404).json({ success: false, error: 'Branch not found' });
  }
  // --- ARCHIVE LOGIC ---
  if (!db.archivedBranches) db.archivedBranches = {};
  db.archivedBranches[branchId] = db.branches[branchId];
  // Archive associated users
  if (!db.archivedUsers) db.archivedUsers = {};
  const usersToDelete = Object.keys(db.users).filter(username => db.users[username].branch === branchId || username === branchId);
  usersToDelete.forEach(username => {
      if (username !== 'superadmin' && username !== 'masteradmin') {
      db.archivedUsers[username] = db.users[username];
      delete db.users[username];
    }
  });
  // Archive associated clients
  if (!db.archivedClients) db.archivedClients = {};
  if (db.clients[branchId]) {
    db.archivedClients[branchId] = db.clients[branchId];
      delete db.clients[branchId];
  }
  // Archive associated purchases
  if (!db.archivedPurchases) db.archivedPurchases = [];
  const purchasesToArchive = db.purchases.filter(p => p.branchId === branchId || p.shopName === branchId);
  db.archivedPurchases = db.archivedPurchases.concat(purchasesToArchive);
  db.purchases = db.purchases.filter(p => p.branchId !== branchId && p.shopName !== branchId);
  // Remove the branch
  delete db.branches[branchId];
  writeDB(db);
  res.json({ success: true, message: 'Branch and associated data archived and deleted successfully' });
});


// --- CLIENTS ---
app.get('/api/clients', authorize(['superadmin', 'master-admin', 'admin', 'branch']), (req, res) => {
  const db = readDB();
  // Return clients grouped by branch
  res.json(db.clients);
});

// POST endpoint for clients: handles both single client addition and bulk updates/imports
app.post('/api/clients', authorize(['superadmin', 'master-admin', 'admin']), (req, res) => {
  const db = readDB();
  const { branchId, client, clients, replaceAll } = req.body; // Add replaceAll here

  console.log('POST /api/clients body:', req.body); // <-- Add this line
  console.log('replaceAll:', replaceAll); // <-- And this line

  if (!branchId) {
    return res.status(400).json({ success: false, error: 'Branch ID is required' });
  }

  // Ensure clients entry exists for the branch and is an array
  if (!db.clients[branchId]) {
    db.clients[branchId] = [];
  } else if (!Array.isArray(db.clients[branchId])) {
    // Convert old object format to array if necessary, and ensure IDs
    db.clients[branchId] = Object.values(db.clients[branchId]).map(c => ({ ...c, id: c.id || uuidv4() }));
  }

  // Handle single client addition (from add client form)
  if (client && typeof client === 'object') {
    const { name, phoneNumber } = client;
    if (!name || !phoneNumber) {
      return res.status(400).json({ success: false, error: 'Client name and phone number are required' });
    }
    const newClient = { id: uuidv4(), name, phoneNumber };
    db.clients[branchId].push(newClient); // Add new client to the array
    writeDB(db);
    return res.json({ success: true, client: newClient });
  } 
  // Handle bulk client addition (from Excel import, or updating a branch's whole client list)
  else if (Array.isArray(clients)) {
    // If a special flag is set, replace the array instead of appending
    if (replaceAll === true) {
      db.clients[branchId] = clients.map(c => ({ ...c, id: c.id || uuidv4() }));
      writeDB(db);
      return res.json({ success: true, replaced: true, count: clients.length });
    }
    // This assumes 'clients' is an array of { name, phoneNumber } or { id, name, phoneNumber }
    // For bulk, we overwrite the existing list for that branch for simplicity and data consistency.
    // It's assumed the frontend sends the *full* updated list for that branch, or
    // we append new unique ones. Let's make it append only new unique ones for Excel import.
    
    const existingClientNames = new Set(db.clients[branchId].map(c => c.name.toLowerCase()));
    const existingClientPhones = new Set(db.clients[branchId].map(c => c.phoneNumber));
    let addedCount = 0;

    clients.forEach(c => {
      const clientNameLower = (c.name || '').toLowerCase();
      const clientPhone = c.phoneNumber;

      // Check for duplicates before adding
      if (!existingClientNames.has(clientNameLower) && !existingClientPhones.has(clientPhone)) {
        db.clients[branchId].push({ id: uuidv4(), name: c.name, phoneNumber: c.phoneNumber });
        existingClientNames.add(clientNameLower);
        existingClientPhones.add(clientPhone);
        addedCount++;
      }
    });

    writeDB(db);
    return res.json({ success: true, addedCount: addedCount });
  }
  else {
    return res.status(400).json({ success: false, error: 'Invalid client data payload. Expected "client" object or "clients" array.' });
  }
});


app.delete('/api/clients/:branchId/:index', authorize(['superadmin', 'master-admin', 'admin']), (req, res) => {
  const db = readDB();
    const { branchId, index } = req.params;
    if (!db.clients[branchId]) {
        return res.status(404).json({ success: false, error: 'Branch not found or has no clients' });
    }
    if (!db.archivedClients) db.archivedClients = {};
    if (index === 'all') { // Custom string to delete all clients for a branch
        db.archivedClients[branchId] = db.clients[branchId];
        delete db.clients[branchId];
        writeDB(db);
        return res.json({ success: true, message: `All clients for branch ${branchId} archived and deleted.` });
    }
    const clientIndex = parseInt(index, 10);
    if (isNaN(clientIndex) || clientIndex < 0 || clientIndex >= db.clients[branchId].length) {
        return res.status(404).json({ success: false, error: 'Client index out of bounds or not found' });
    }
    // Archive the client
    if (!db.archivedClients[branchId]) db.archivedClients[branchId] = [];
    db.archivedClients[branchId].push(db.clients[branchId][clientIndex]);
    db.clients[branchId].splice(clientIndex, 1);
  writeDB(db);
  res.json({ success: true });
});


// --- PURCHASES ---
app.get('/api/purchases', authorize(['superadmin', 'master-admin', 'admin', 'branch']), (req, res) => {
  const db = readDB();
  res.json(db.purchases);
});

app.post('/api/purchases', authorize(['superadmin', 'master-admin', 'admin', 'branch']), (req, res) => {
  const db = readDB();
  const purchase = req.body;
  if (!purchase.id) {
    purchase.id = uuidv4();
  }
  db.purchases.push(purchase);
  writeDB(db);
  res.json({ success: true, id: purchase.id });
});

app.delete('/api/purchases/:purchaseId', authorize(['superadmin', 'master-admin', 'admin']), (req, res) => {
  const db = readDB();
  const { purchaseId } = req.params;
  if (!db.archivedPurchases) db.archivedPurchases = [];
  const idx = db.purchases.findIndex(p => p.id === purchaseId);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Purchase not found' });
  }
  // Archive the purchase
  db.archivedPurchases.push(db.purchases[idx]);
  db.purchases.splice(idx, 1);
  writeDB(db);
  res.json({ success: true, message: 'Purchase archived and deleted successfully' });
});

// --- ARCHIVE ENDPOINTS ---
// List archived items
app.get('/api/archived-branches', authorize(['superadmin']), (req, res) => {
  const db = readDB();
  res.json(db.archivedBranches || {});
});
app.get('/api/archived-users', authorize(['superadmin']), (req, res) => {
  const db = readDB();
  res.json(db.archivedUsers || {});
});
app.get('/api/archived-clients', authorize(['superadmin']), (req, res) => {
  const db = readDB();
  res.json(db.archivedClients || {});
});
app.get('/api/archived-purchases', authorize(['superadmin']), (req, res) => {
  const db = readDB();
  res.json(db.archivedPurchases || []);
});
// Restore endpoints
app.post('/api/restore/branch/:branchId', authorize(['superadmin']), (req, res) => {
  const db = readDB();
  const { branchId } = req.params;
  const withAll = req.query.withAll === 'true' || req.body?.withAll === true;
  if (!db.archivedBranches || !db.archivedBranches[branchId]) {
    return res.status(404).json({ success: false, error: 'Archived branch not found' });
  }
  db.branches[branchId] = db.archivedBranches[branchId];
  delete db.archivedBranches[branchId];
  // Always restore users for this branch
  if (db.archivedUsers) {
    const toRestoreUsers = Object.entries(db.archivedUsers).filter(([username, user]) => user.branch === branchId || username === branchId);
    for (const [username, user] of toRestoreUsers) {
      db.users[username] = user;
      delete db.archivedUsers[username];
    }
  }
  // Restore clients and purchases if requested
  if (withAll) {
    // Restore clients
    if (db.archivedClients && db.archivedClients[branchId]) {
      db.clients[branchId] = db.archivedClients[branchId];
      delete db.archivedClients[branchId];
    }
    // Restore purchases
    if (db.archivedPurchases) {
      const toRestorePurchases = db.archivedPurchases.filter(p => p.branchId === branchId || p.shopName === branchId);
      db.purchases = db.purchases.concat(toRestorePurchases);
      db.archivedPurchases = db.archivedPurchases.filter(p => p.branchId !== branchId && p.shopName !== branchId);
    }
  }
  writeDB(db);
  res.json({ success: true, message: withAll ? 'Branch, users, clients, and purchases restored successfully' : 'Branch and users restored successfully' });
});
app.post('/api/restore/user/:username', authorize(['superadmin']), (req, res) => {
  const db = readDB();
  const { username } = req.params;
  if (!db.archivedUsers || !db.archivedUsers[username]) {
    return res.status(404).json({ success: false, error: 'Archived user not found' });
  }
  db.users[username] = db.archivedUsers[username];
  delete db.archivedUsers[username];
  writeDB(db);
  res.json({ success: true, message: 'User restored successfully' });
});
app.post('/api/restore/client/:branchId/:index', authorize(['superadmin']), (req, res) => {
  const db = readDB();
  const { branchId, index } = req.params;
  if (!db.archivedClients || !db.archivedClients[branchId] || !db.archivedClients[branchId][index]) {
    return res.status(404).json({ success: false, error: 'Archived client not found' });
  }
  if (!db.clients[branchId]) db.clients[branchId] = [];
  db.clients[branchId].push(db.archivedClients[branchId][index]);
  db.archivedClients[branchId].splice(index, 1);
  if (db.archivedClients[branchId].length === 0) delete db.archivedClients[branchId];
  writeDB(db);
  res.json({ success: true, message: 'Client restored successfully' });
});
app.post('/api/restore/purchase/:purchaseId', authorize(['superadmin']), (req, res) => {
  const db = readDB();
  const { purchaseId } = req.params;
  if (!db.archivedPurchases) db.archivedPurchases = [];
  const idx = db.archivedPurchases.findIndex(p => p.id === purchaseId);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Archived purchase not found' });
  }
  db.purchases.push(db.archivedPurchases[idx]);
  db.archivedPurchases.splice(idx, 1);
  writeDB(db);
  res.json({ success: true, message: 'Purchase restored successfully' });
});
// Permanently delete endpoints
app.delete('/api/archived-branches/:branchId', authorize(['superadmin']), (req, res) => {
  const db = readDB();
  const { branchId } = req.params;
  const withAll = req.query.withAll === 'true' || req.body?.withAll === true;
  if (!db.archivedBranches || !db.archivedBranches[branchId]) {
    return res.status(404).json({ success: false, error: 'Archived shop not found' });
  }
  // Always delete associated users from archive
  if (db.archivedUsers) {
    for (const username of Object.keys(db.archivedUsers)) {
      const user = db.archivedUsers[username];
      if (user.branch === branchId || username === branchId) {
        delete db.archivedUsers[username];
      }
    }
  }
  // Optionally delete associated clients and purchases from archive
  if (withAll) {
    if (db.archivedClients && db.archivedClients[branchId]) {
      delete db.archivedClients[branchId];
    }
    if (db.archivedPurchases) {
      db.archivedPurchases = db.archivedPurchases.filter(p => p.branchId !== branchId && p.shopName !== branchId);
    }
  }
  delete db.archivedBranches[branchId];
  writeDB(db);
  res.json({ success: true, message: withAll ? 'Archived shop, users, clients, and purchases permanently deleted' : 'Archived shop and users permanently deleted' });
});
app.delete('/api/archived-users/:username', authorize(['superadmin']), (req, res) => {
  const db = readDB();
  const { username } = req.params;
  if (!db.archivedUsers || !db.archivedUsers[username]) {
    return res.status(404).json({ success: false, error: 'Archived user not found' });
  }
  delete db.archivedUsers[username];
  writeDB(db);
  res.json({ success: true, message: 'Archived user permanently deleted' });
});
app.delete('/api/archived-clients/:branchId/:index', authorize(['superadmin']), (req, res) => {
  const db = readDB();
  const { branchId, index } = req.params;
  if (!db.archivedClients || !db.archivedClients[branchId] || !db.archivedClients[branchId][index]) {
    return res.status(404).json({ success: false, error: 'Archived client not found' });
  }
  db.archivedClients[branchId].splice(index, 1);
  if (db.archivedClients[branchId].length === 0) delete db.archivedClients[branchId];
  writeDB(db);
  res.json({ success: true, message: 'Archived client permanently deleted' });
});
app.delete('/api/archived-purchases/:purchaseId', authorize(['superadmin']), (req, res) => {
  const db = readDB();
  const { purchaseId } = req.params;
  if (!db.archivedPurchases) db.archivedPurchases = [];
  const idx = db.archivedPurchases.findIndex(p => p.id === purchaseId);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Archived purchase not found' });
  }
  db.archivedPurchases.splice(idx, 1);
  writeDB(db);
  res.json({ success: true, message: 'Archived purchase permanently deleted' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 
