/* database.js - Live Google Firebase Unified Database Manager for ExtraPay */

const firebaseConfig = {
  apiKey: "AIzaSyBdQAQFq9IBbNX4bIcP0GuS9HO8wt-njRo",
  authDomain: "extra-pay.firebaseapp.com",
  projectId: "extra-pay",
  storageBucket: "extra-pay.firebasestorage.app",
  messagingSenderId: "220959979823",
  appId: "1:220959979823:web:efe32b75ee7993dbd789da",
  measurementId: "G-MZ4JJPJLG2"
};

class ExtraPayDB {
    constructor() {
        this.initializeLocalFallback();
        this.initFirebase();
    }

    initializeLocalFallback() {
        // Safe defaults to load instantly while Firestore synchronizes
        if (!localStorage.getItem('ep_users')) {
            const initialUsers = {
                'dangi2shivraj@gmail.com': {
                    uid: 'ADMIN_UID',
                    name: 'ExtraPay Admin',
                    email: 'dangi2shivraj@gmail.com',
                    password: 'admin123',
                    wallet_balance: 99999,
                    referred_by: null,
                    level: 1,
                    tasks_completed_today: 0,
                    total_tasks_completed: 0,
                    created_at: Date.now() - 30 * 86400000,
                    isAdmin: true,
                    consecutiveDays: 7,
                    lastTaskDayString: "",
                    first_task_bonus_received: true
                }
            };
            localStorage.setItem('ep_users', JSON.stringify(initialUsers));
        }

        if (!localStorage.getItem('ep_transactions')) {
            localStorage.setItem('ep_transactions', JSON.stringify([]));
        }

        if (!localStorage.getItem('ep_settings')) {
            const defaultSettings = {
                upiId: 'shivlal-d@ptyes',
                qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=0c0f17&data=upi://pay?pa=shivlal-d@ptyes%26pn=ExtraPay%26am=100%26cu=INR',
                usdtRate: 112,
                usdtAddress: '0x71e7edd284200a067b8e549af6f397e0396796e2'
            };
            localStorage.setItem('ep_settings', JSON.stringify(defaultSettings));
        }

        if (!localStorage.getItem('ep_active_tasks')) {
            localStorage.setItem('ep_active_tasks', JSON.stringify({}));
        }
    }

    initFirebase() {
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            this.auth = firebase.auth();
            this.db = firebase.firestore();

            // Enable persistent offline cache capabilities for Firestore
            this.db.enablePersistence().catch(err => {
                console.warn("Firestore offline persistence failed:", err.code);
            });

            // 1. Real-time Synced Listener: Users
            this.db.collection('users').onSnapshot(snapshot => {
                const users = {};
                snapshot.forEach(doc => {
                    users[doc.id] = doc.data();
                });
                localStorage.setItem('ep_users', JSON.stringify(users));
                
                // Real-time reactive UI update triggers
                if (typeof window.renderDashboard === 'function') {
                    window.renderDashboard();
                }
                if (typeof window.renderTeamDashboard === 'function') {
                    window.renderTeamDashboard();
                }
            }, err => {
                console.error("Users listener error:", err);
            });

            // 2. Real-time Synced Listener: Transactions
            this.db.collection('transactions').onSnapshot(snapshot => {
                const txs = [];
                snapshot.forEach(doc => {
                    txs.push(doc.data());
                });
                // Sort descending by timestamp
                txs.sort((a, b) => b.timestamp - a.timestamp);
                localStorage.setItem('ep_transactions', JSON.stringify(txs));
                
                if (typeof window.renderTxsAndActivity === 'function') {
                    window.renderTxsAndActivity();
                }
                if (typeof window.renderAdminStats === 'function') {
                    window.renderAdminStats();
                }
            }, err => {
                console.error("Transactions listener error:", err);
            });

            // 3. Real-time Synced Listener: Settings
            this.db.collection('settings').doc('global').onSnapshot(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    // Self-healing check: Automatically migrate any old default UPI ID to the new one
                    if (data.upiId === 'ram-5784@ptyes') {
                        data.upiId = 'shivlal-d@ptyes';
                        data.qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=0c0f17&data=upi://pay?pa=shivlal-d@ptyes%26pn=ExtraPay%26am=100%26cu=INR';
                        this.db.collection('settings').doc('global').set(data).catch(() => {});
                    }
                    localStorage.setItem('ep_settings', JSON.stringify(data));
                    if (typeof window.updateSettingsUI === 'function') {
                        window.updateSettingsUI();
                    }
                } else {
                    // Seed initial global settings to Firestore if missing
                    const defaultSettings = {
                        upiId: 'shivlal-d@ptyes',
                        qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=0c0f17&data=upi://pay?pa=shivlal-d@ptyes%26pn=ExtraPay%26am=100%26cu=INR',
                        usdtRate: 112,
                        usdtAddress: '0x71e7edd284200a067b8e549af6f397e0396796e2'
                    };
                    this.db.collection('settings').doc('global').set(defaultSettings);
                }
            }, err => {
                console.error("Settings listener error:", err);
            });

            // 4. Real-time Synced Listener: Active Tasks
            this.db.collection('active_tasks').onSnapshot(snapshot => {
                const tasks = {};
                snapshot.forEach(doc => {
                    tasks[doc.id] = doc.data();
                });
                localStorage.setItem('ep_active_tasks', JSON.stringify(tasks));
            }, err => {
                console.error("Active tasks listener error:", err);
            });

            // Initialize default admin document on startup
            this.db.collection('users').doc('dangi2shivraj@gmail.com').get().then(doc => {
                if (!doc.exists) {
                    this.db.collection('users').doc('dangi2shivraj@gmail.com').set({
                        uid: 'ADMIN_UID',
                        name: 'ExtraPay Admin',
                        email: 'dangi2shivraj@gmail.com',
                        password: 'admin123',
                        wallet_balance: 99999,
                        referred_by: null,
                        level: 1,
                        tasks_completed_today: 0,
                        total_tasks_completed: 0,
                        created_at: Date.now() - 30 * 86400000,
                        isAdmin: true,
                        consecutiveDays: 7,
                        lastTaskDayString: "",
                        first_task_bonus_received: true,
                        balance: 99999,
                        referrer: null,
                        activeLevel: 1,
                        completedTasksToday: 0
                    });
                }
            });

        } catch (error) {
            console.error("Firebase Initialization Exception:", error);
        }
    }

    getUsers() {
        const users = JSON.parse(localStorage.getItem('ep_users')) || {};
        for (const k in users) {
            const u = users[k];
            if (u.wallet_balance === undefined) u.wallet_balance = u.balance || 0;
            if (u.referred_by === undefined) u.referred_by = u.referrer || null;
            if (u.level === undefined) u.level = u.activeLevel || 1;
            if (u.tasks_completed_today === undefined) u.tasks_completed_today = u.completedTasksToday || 0;
            if (u.total_tasks_completed === undefined) u.total_tasks_completed = u.total_tasks || 0;
            if (u.created_at === undefined) u.created_at = u.joinedAt || Date.now();
        }
        return users;
    }

    saveUsers(users) {
        localStorage.setItem('ep_users', JSON.stringify(users));
        // Push every user object up to Firestore asynchronously to keep Firestore in sync
        for (const email in users) {
            const userDocId = email.trim().toLowerCase();
            this.db.collection('users').doc(userDocId).set(users[email]).catch(err => {
                console.error(`Error saving user doc ${userDocId} to Firestore:`, err);
            });
        }
    }

    getCurrentUser() {
        const loggedInEmail = sessionStorage.getItem('ep_logged_in_user');
        if (!loggedInEmail) return null;
        const users = this.getUsers();
        const user = users[loggedInEmail.trim().toLowerCase()] || null;
        if (user) {
            user.balance = user.wallet_balance;
            user.referrer = user.referred_by;
            user.activeLevel = user.level;
            user.completedTasksToday = user.tasks_completed_today;
        }
        return user;
    }

    setCurrentUser(email) {
        sessionStorage.setItem('ep_logged_in_user', email.trim().toLowerCase());
    }

    logout() {
        if (this.auth) {
            this.auth.signOut().catch(e => console.error("Firebase signout error:", e));
        }
        sessionStorage.removeItem('ep_logged_in_user');
    }

    async register(name, email, password, referralCode) {
        const users = this.getUsers();
        const emailKey = email.trim().toLowerCase();
        if (users[emailKey]) {
            throw new Error('User with this email already exists.');
        }

        let referrerUid = null;
        if (referralCode) {
            const trimmedCode = referralCode.trim();
            for (const key in users) {
                if (users[key].uid === trimmedCode) {
                    referrerUid = users[key].uid;
                    break;
                }
            }
            if (!referrerUid) {
                throw new Error('Invalid Referral Code.');
            }
        }

        // Generate custom ExtraPay short referral UID
        const uid = 'EP_' + Math.random().toString(36).substr(2, 6).toUpperCase();
        const newUser = {
            uid: uid,
            fbUid: 'FB_PENDING_' + Date.now(),
            name: name,
            email: emailKey,
            password: password, 
            wallet_balance: 180, // Signup Reward: ₹180 signup bonus
            referred_by: referrerUid,
            level: 1,
            tasks_completed_today: 0,
            total_tasks_completed: 0,
            created_at: Date.now(),
            isAdmin: emailKey === 'dangi2shivraj@gmail.com',
            consecutiveDays: 0,
            lastTaskDayString: "",
            first_task_bonus_received: false,
            
            // Backward compatibility properties
            balance: 180,
            referrer: referrerUid,
            activeLevel: 1,
            completedTasksToday: 0
        };

        // 1. Immediately write to local state so user NEVER gets stuck or delayed in UI
        users[emailKey] = newUser;
        localStorage.setItem('ep_users', JSON.stringify(users));
        this.setCurrentUser(emailKey);

        // 2. Perform background Firebase Authentication registration (fail-safe)
        if (this.auth) {
            this.auth.createUserWithEmailAndPassword(emailKey, password).then(userCredential => {
                newUser.fbUid = userCredential.user.uid;
                if (this.db) {
                    this.db.collection('users').doc(emailKey).update({ fbUid: newUser.fbUid }).catch(() => {});
                }
            }).catch(fbErr => {
                console.warn("Background Firebase Auth Registration bypassed/failed:", fbErr);
            });
        }

        // 3. Save User Profile doc in Firestore in background
        if (this.db) {
            this.db.collection('users').doc(emailKey).set(newUser).catch(err => {
                console.warn("Background Firestore User save bypassed/failed:", err);
            });
        }

        // 4. Record signup transaction reward
        this.addTransaction(newUser.uid, 'SIGNUP_REWARD', 180, 'APPROVED', 'Signup Bonus of ₹180 credited.');

        return newUser;
    }

    async login(email, password) {
        const emailKey = email.trim().toLowerCase();
        
        // 1. Instant check against local/synced state first
        const localUsers = this.getUsers();
        const localUser = localUsers[emailKey];

        if (localUser) {
            if (localUser.password && localUser.password !== password) {
                throw new Error('Incorrect Password. Please check your inputs and try again.');
            }
            this.setCurrentUser(emailKey);

            // Attempt background authentication to keep session alive or sync without blocking user dashboard access
            if (this.auth) {
                this.auth.signInWithEmailAndPassword(emailKey, password).catch(fbErr => {
                    console.warn("Background Firebase Auth login bypassed/failed (sign-in provider might be disabled):", fbErr);
                });
            }
            return localUser;
        }

        // 2. Fallback to Cloud check if user is not in local memory yet (e.g. fresh installation or admin change)
        if (this.auth) {
            try {
                // Try to authenticate with Firebase Auth
                await this.auth.signInWithEmailAndPassword(emailKey, password);
                
                // Fetch document from Firestore
                if (this.db) {
                    const doc = await this.db.collection('users').doc(emailKey).get();
                    if (doc.exists) {
                        const cloudUser = doc.data();
                        localUsers[emailKey] = cloudUser;
                        localStorage.setItem('ep_users', JSON.stringify(localUsers));
                        this.setCurrentUser(emailKey);
                        return cloudUser;
                    }
                }
            } catch (err) {
                console.warn("Cloud Auth flow bypassed or failed:", err);
                
                // Self-healing Bootstrap for primary admin account on fresh installation or if provider disabled
                if (emailKey === 'dangi2shivraj@gmail.com' && password === 'admin123') {
                    const newUser = {
                        uid: 'EP_ADMIN',
                        name: 'ExtraPay Admin',
                        email: emailKey,
                        password: password,
                        wallet_balance: 99999,
                        referred_by: null,
                        level: 1,
                        tasks_completed_today: 0,
                        total_tasks_completed: 0,
                        created_at: Date.now(),
                        isAdmin: true,
                        consecutiveDays: 7,
                        lastTaskDayString: "",
                        first_task_bonus_received: true,
                        balance: 99999,
                        referrer: null,
                        activeLevel: 1,
                        completedTasksToday: 0
                    };
                    
                    localUsers[emailKey] = newUser;
                    localStorage.setItem('ep_users', JSON.stringify(localUsers));
                    this.setCurrentUser(emailKey);

                    if (this.db) {
                        this.db.collection('users').doc(emailKey).set(newUser).catch(() => {});
                    }
                    return newUser;
                }
                
                throw new Error('Incorrect credentials or connection error. If you are a new user, please register first.');
            }
        }

        // Direct bootstrap for admin credentials if all else is absent
        if (emailKey === 'dangi2shivraj@gmail.com' && password === 'admin123') {
            const newUser = {
                uid: 'EP_ADMIN',
                name: 'ExtraPay Admin',
                email: emailKey,
                password: password,
                wallet_balance: 99999,
                referred_by: null,
                level: 1,
                tasks_completed_today: 0,
                total_tasks_completed: 0,
                created_at: Date.now(),
                isAdmin: true,
                consecutiveDays: 7,
                lastTaskDayString: "",
                first_task_bonus_received: true,
                balance: 99999,
                referrer: null,
                activeLevel: 1,
                completedTasksToday: 0
            };
            localUsers[emailKey] = newUser;
            localStorage.setItem('ep_users', JSON.stringify(localUsers));
            this.setCurrentUser(emailKey);
            if (this.db) {
                this.db.collection('users').doc(emailKey).set(newUser).catch(() => {});
            }
            return newUser;
        }

        throw new Error('User account not found. Please Register a new account first.');
    }

    getTransactions() {
        return JSON.parse(localStorage.getItem('ep_transactions')) || [];
    }

    saveTransactions(txs) {
        localStorage.setItem('ep_transactions', JSON.stringify(txs));
        // Push transactions to Firestore asynchronously
        txs.forEach(tx => {
            const txId = tx.tx_id || tx.id;
            if (txId) {
                this.db.collection('transactions').doc(txId).set(tx).catch(err => {
                    console.error("Firestore transaction write error:", err);
                });
            }
        });
    }

    addTransaction(uid, type, amount, status, details, extra = {}) {
        const txs = this.getTransactions();
        const users = this.getUsers();
        
        let userName = 'Unknown';
        for (const key in users) {
            if (users[key].uid === uid) {
                userName = users[key].name;
                break;
            }
        }

        const txId = 'TX_' + Math.random().toString(36).substr(2, 9).toUpperCase();
        const newTx = {
            tx_id: txId,
            uid: uid,
            userName: userName,
            type: type, 
            amount_inr: extra.amount_inr !== undefined ? extra.amount_inr : amount,
            amount_usdt: extra.amount_usdt || 0,
            utr_or_txid: extra.utr_or_txid || '',
            proof_image_url: extra.proof_image_url || '',
            status: status.toUpperCase(), 
            timestamp: Date.now(),
            details: details,
            // Compatibility property
            id: txId,
            amount: amount,
            commission: extra.commission || 0
        };

        txs.unshift(newTx);
        this.saveTransactions(txs);
        return newTx;
    }

    getLevelForBalance(balance) {
        if (balance >= 10000) {
            return { level: 7, name: "VIP Level 7", min: 10000, max: Infinity, commission: 0.12 };
        } else if (balance >= 8001) {
            return { level: 6, name: "Level 6", min: 8001, max: 10000, commission: 0.11 };
        } else if (balance >= 5001) {
            return { level: 5, name: "Level 5", min: 5001, max: 8000, commission: 0.10 };
        } else if (balance >= 3001) {
            return { level: 4, name: "Level 4", min: 3001, max: 5000, commission: 0.09 };
        } else if (balance >= 1001) {
            return { level: 3, name: "Level 3", min: 1001, max: 3000, commission: 0.08 };
        } else if (balance >= 301) {
            return { level: 2, name: "Level 2", min: 301, max: 1000, commission: 0.07 };
        } else if (balance >= 100) {
            return { level: 1, name: "Level 1", min: 100, max: 300, commission: 0.06 };
        }
        return null; 
    }

    getLevelDetails(level) {
        const levels = {
            1: { cost: 100, dailyPayout: 18, commission: 0.06, name: "Bronze Starter (Level 1)" },
            2: { cost: 301, dailyPayout: 50, commission: 0.07, name: "Gold Arbitrageur (Level 2)" },
            3: { cost: 1001, dailyPayout: 180, commission: 0.08, name: "Platinum Trader (Level 3)" },
            4: { cost: 3001, dailyPayout: 450, commission: 0.09, name: "Diamond Merchant (Level 4)" },
            5: { cost: 5001, dailyPayout: 800, commission: 0.10, name: "VIP Executive (Level 5)" },
            6: { cost: 8001, dailyPayout: 1300, commission: 0.11, name: "Crown Ambassador (Level 6)" },
            7: { cost: 10000, dailyPayout: 2000, commission: 0.12, name: "ExtraPay Elite (Level 7)" }
        };
        return levels[level];
    }

    getActiveTasks() {
        return JSON.parse(localStorage.getItem('ep_active_tasks')) || {};
    }

    saveActiveTasks(tasks) {
        localStorage.setItem('ep_active_tasks', JSON.stringify(tasks));
        for (const uid in tasks) {
            this.db.collection('active_tasks').doc(uid).set(tasks[uid]).catch(err => {
                console.error("Firestore active tasks save error:", err);
            });
        }
    }

    receiveTask(email, specificAmount = null) {
        const users = this.getUsers();
        const user = users[email.trim().toLowerCase()];
        if (!user) throw new Error('User not found.');

        const balance = user.wallet_balance;
        if (balance < 100) {
            throw new Error('Minimum ₹100 balance required to receive task. Please deposit funds or complete check-in first.');
        }

        const levelInfo = this.getLevelForBalance(balance);
        if (!levelInfo) {
            throw new Error('Error determining VIP Level based on your balance.');
        }

        const orderId = 'ORD_' + Math.random().toString(36).substr(2, 6).toUpperCase();
        let taskAmt = specificAmount ? parseFloat(specificAmount) : Math.min(balance, levelInfo.max === Infinity ? balance : levelInfo.max);
        
        if (taskAmt > balance) {
            throw new Error(`Insufficient balance. Selected order requires ₹${taskAmt.toFixed(2)}, but you only have ₹${balance.toFixed(2)}.`);
        }

        const commissionAmt = parseFloat((taskAmt * levelInfo.commission).toFixed(2));
        const activeTasks = this.getActiveTasks();
        const newTask = {
            uid: user.uid,
            orderId: orderId,
            level: levelInfo.level,
            levelName: levelInfo.name,
            amount: parseFloat(taskAmt.toFixed(2)),
            commission: commissionAmt,
            timestamp: Date.now(),
            expiresAt: Date.now() + 10 * 60 * 1000, 
            status: 'ACTIVE'
        };

        activeTasks[user.uid] = newTask;
        this.saveActiveTasks(activeTasks);

        return newTask;
    }

    submitGatewayPayment(email, utrCode, simulatedScreenshot) {
        const users = this.getUsers();
        const user = users[email.trim().toLowerCase()];
        if (!user) throw new Error('User not found.');

        const activeTasks = this.getActiveTasks();
        const activeTask = activeTasks[user.uid];
        if (!activeTask || activeTask.status !== 'ACTIVE') {
            throw new Error('No active task/gateway session found.');
        }

        if (Date.now() > activeTask.expiresAt) {
            activeTask.status = 'EXPIRED';
            this.saveActiveTasks(activeTasks);
            throw new Error('Task gateway expired (10 minutes limit exceeded). Please grab another task.');
        }

        if (!utrCode || utrCode.trim().length < 6) {
            throw new Error('Please enter a valid 12-digit UTR Transaction number.');
        }

        this.addTransaction(
            user.uid, 
            'INR_DEPOSIT', 
            activeTask.amount, 
            'PENDING', 
            `USDT/INR Grabbed Order ${activeTask.orderId}. Commission earned: ₹${activeTask.commission}`,
            {
                utr_or_txid: utrCode.trim(),
                proof_image_url: simulatedScreenshot || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=120',
                amount_inr: activeTask.amount,
                commission: activeTask.commission
            }
        );

        activeTask.status = 'SUBMITTED';
        this.saveActiveTasks(activeTasks);

        return true;
    }

    cancelActiveTask(email) {
        const users = this.getUsers();
        const user = users[email.trim().toLowerCase()];
        if (!user) return;
        const activeTasks = this.getActiveTasks();
        delete activeTasks[user.uid];
        localStorage.setItem('ep_active_tasks', JSON.stringify(activeTasks));
        
        this.db.collection('active_tasks').doc(user.uid).delete().catch(err => {
            console.error("Firestore error deleting active task:", err);
        });
    }

    submitDeposit(email, amount, utr) {
        const users = this.getUsers();
        const user = users[email.trim().toLowerCase()];
        if (!user) throw new Error('User not found.');

        const depositAmt = parseFloat(amount);
        if (isNaN(depositAmt) || depositAmt <= 0) {
            throw new Error('Please enter a valid deposit amount.');
        }
        if (!utr || utr.trim().length < 6) {
            throw new Error('Please enter a valid 12-digit UTR reference code.');
        }

        this.addTransaction(user.uid, 'INR_DEPOSIT', depositAmt, 'PENDING', `INR Manual Wallet Deposit.`, {
            utr_or_txid: utr.trim(),
            proof_image_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=120',
            amount_inr: depositAmt
        });
        return true;
    }

    submitWithdrawal(email, amount, upiId, accName) {
        const users = this.getUsers();
        const user = users[email.trim().toLowerCase()];
        if (!user) throw new Error('User not found.');

        const withdrawAmt = parseFloat(amount);
        if (isNaN(withdrawAmt) || withdrawAmt < 300) {
            throw new Error('Minimum withdrawal limit is ₹300.');
        }
        if (user.wallet_balance < withdrawAmt) {
            throw new Error('Insufficient wallet balance to perform withdrawal.');
        }
        if (!upiId || !upiId.includes('@')) {
            throw new Error('Please enter a valid UPI address (e.g., user@paytm).');
        }

        user.wallet_balance -= withdrawAmt;
        user.balance = user.wallet_balance;
        this.saveUsers(users);

        this.addTransaction(
            user.uid, 
            'WITHDRAWAL', 
            -withdrawAmt, 
            'PENDING', 
            `UPI Withdrawal to ${upiId} (${accName || 'Self'})`, 
            {
                utr_or_txid: upiId,
                amount_inr: -withdrawAmt
            }
        );
        return true;
    }

    submitUsdtSell(email, usdtAmount, txId, simulatedScreenshot) {
        const users = this.getUsers();
        const user = users[email.trim().toLowerCase()];
        if (!user) throw new Error('User not found.');

        const usdtAmt = parseFloat(usdtAmount);
        if (isNaN(usdtAmt) || usdtAmt <= 0) {
            throw new Error('Please enter a valid USDT amount.');
        }
        if (!txId || txId.trim().length < 8) {
            throw new Error('Please enter a valid blockchain transaction ID (TxID).');
        }

        const settings = this.getSettings();
        const finalPayout = parseFloat((usdtAmt * settings.usdtRate).toFixed(2));

        this.addTransaction(
            user.uid, 
            'USDT_SELL', 
            finalPayout, 
            'PENDING', 
            `Sold ${usdtAmt} USDT via BEP20 Network @ ₹${settings.usdtRate}/USDT`, 
            {
                utr_or_txid: txId.trim(),
                amount_usdt: usdtAmt,
                amount_inr: finalPayout,
                proof_image_url: simulatedScreenshot || 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=120'
            }
        );
        return true;
    }

    approveTransaction(txId) {
        const txs = this.getTransactions();
        const users = this.getUsers();
        const txIndex = txs.findIndex(t => t.tx_id === txId || t.id === txId);

        if (txIndex === -1) throw new Error('Transaction not found.');
        const tx = txs[txIndex];
        if (tx.status !== 'PENDING') throw new Error('Transaction is already processed.');

        let userProfile = null;
        let userEmail = null;
        for (const email in users) {
            if (users[email].uid === tx.uid) {
                userProfile = users[email];
                userEmail = email;
                break;
            }
        }

        if (!userProfile) throw new Error('User profile not found.');

        tx.status = 'APPROVED';

        if (tx.type === 'INR_DEPOSIT') {
            const detailsText = tx.details || '';
            const isTaskPayment = detailsText.includes('Grabbed Order');
            
            userProfile.wallet_balance += parseFloat(tx.amount_inr);
            
            if (isTaskPayment) {
                const commission = parseFloat(tx.commission) || parseFloat((tx.amount_inr * 0.06).toFixed(2));
                userProfile.wallet_balance += commission;
                
                userProfile.tasks_completed_today = (userProfile.tasks_completed_today || 0) + 1;
                userProfile.total_tasks_completed = (userProfile.total_tasks_completed || 0) + 1;

                if (userProfile.total_tasks_completed === 1 && !userProfile.first_task_bonus_received) {
                    userProfile.wallet_balance += 50;
                    userProfile.first_task_bonus_received = true;
                    setTimeout(() => {
                        this.addTransaction(
                            userProfile.uid,
                            'FIRST_TASK_BONUS',
                            50,
                            'APPROVED',
                            'First Task Completion Bonus of ₹50 credited successfully!'
                        );
                    }, 100);
                }

                if (userProfile.tasks_completed_today === 10) {
                    userProfile.wallet_balance += 100;
                    setTimeout(() => {
                        this.addTransaction(
                            userProfile.uid,
                            'CONSISTENCY_REWARD',
                            100,
                            'APPROVED',
                            'Daily 10 Tasks Consistency Reward of ₹100 credited successfully!'
                        );
                    }, 150);
                }

                if (userProfile.total_tasks_completed === 10 && userProfile.referred_by) {
                    const referrerProfile = this.findUserByUid(users, userProfile.referred_by);
                    if (referrerProfile) {
                        referrerProfile.wallet_balance += 150;
                        setTimeout(() => {
                            this.addTransaction(
                                referrerProfile.uid,
                                'REFERRAL_REWARD',
                                150,
                                'APPROVED',
                                `Direct Referral Reward of ₹150 credited because your referral ${userProfile.name} completed 10 tasks!`
                            );
                        }, 200);
                    }
                }

                this.distribute3LevelCommission(users, userProfile, commission);
            }
        } else if (tx.type === 'USDT_SELL') {
            userProfile.wallet_balance += parseFloat(tx.amount_inr);
            
            if (userProfile.total_tasks_completed === 0 && !userProfile.first_task_bonus_received) {
                userProfile.wallet_balance += 50;
                userProfile.first_task_bonus_received = true;
                setTimeout(() => {
                    this.addTransaction(
                        userProfile.uid,
                        'FIRST_TASK_BONUS',
                        50,
                        'APPROVED',
                        'First Deposit/Task Bonus of ₹50 credited successfully!'
                    );
                }, 100);
            }
        }

        const updatedLevelInfo = this.getLevelForBalance(userProfile.wallet_balance);
        if (updatedLevelInfo) {
            userProfile.level = updatedLevelInfo.level;
        }

        userProfile.balance = userProfile.wallet_balance;
        userProfile.activeLevel = userProfile.level;
        userProfile.completedTasksToday = userProfile.tasks_completed_today;

        this.saveTransactions(txs);
        this.saveUsers(users);
        return true;
    }

    rejectTransaction(txId) {
        const txs = this.getTransactions();
        const users = this.getUsers();
        const txIndex = txs.findIndex(t => t.tx_id === txId || t.id === txId);

        if (txIndex === -1) throw new Error('Transaction not found.');
        const tx = txs[txIndex];
        if (tx.status !== 'PENDING') throw new Error('Transaction is already processed.');

        let userProfile = null;
        for (const email in users) {
            if (users[email].uid === tx.uid) {
                userProfile = users[email];
                break;
            }
        }

        tx.status = 'REJECTED';

        if (tx.type === 'WITHDRAWAL' && userProfile) {
            userProfile.wallet_balance += Math.abs(tx.amount_inr);
            userProfile.balance = userProfile.wallet_balance;
        }

        this.saveTransactions(txs);
        this.saveUsers(users);
        return true;
    }

    findUserByUid(users, uid) {
        for (const k in users) {
            if (users[k].uid === uid) return users[k];
        }
        return null;
    }

    distribute3LevelCommission(users, childUser, childCommission) {
        if (!childUser.referred_by) return;

        const parentL1 = this.findUserByUid(users, childUser.referred_by);
        if (parentL1) {
            const commL1 = parseFloat((childCommission * 0.02).toFixed(2));
            if (commL1 > 0) {
                parentL1.wallet_balance += commL1;
                parentL1.balance = parentL1.wallet_balance;
                this.addTransaction(
                    parentL1.uid,
                    'REFERRAL_REWARD',
                    commL1,
                    'APPROVED',
                    `Level 1 Team Commission (2%) from task by ${childUser.name}`
                );
            }

            if (parentL1.referred_by) {
                const parentL2 = this.findUserByUid(users, parentL1.referred_by);
                if (parentL2) {
                    const commL2 = parseFloat((childCommission * 0.01).toFixed(2));
                    if (commL2 > 0) {
                        parentL2.wallet_balance += commL2;
                        parentL2.balance = parentL2.wallet_balance;
                        this.addTransaction(
                            parentL2.uid,
                            'REFERRAL_REWARD',
                            commL2,
                            'APPROVED',
                            `Level 2 Team Commission (1%) from task by ${childUser.name}`
                        );
                    }

                    if (parentL2.referred_by) {
                        const parentL3 = this.findUserByUid(users, parentL2.referred_by);
                        if (parentL3) {
                            const commL3 = parseFloat((childCommission * 0.005).toFixed(2));
                            if (commL3 > 0) {
                                parentL3.wallet_balance += commL3;
                                parentL3.balance = parentL3.wallet_balance;
                                this.addTransaction(
                                    parentL3.uid,
                                    'REFERRAL_REWARD',
                                    commL3,
                                    'APPROVED',
                                    `Level 3 Team Commission (0.5%) from task by ${childUser.name}`
                                );
                            }
                        }
                    }
                }
            }
        }
    }

    getReferralTeamStats(userUid) {
        const users = this.getUsers();
        const stats = {
            level1: [],
            level2: [],
            level3: []
        };

        for (const k in users) {
            if (users[k].referred_by === userUid) {
                stats.level1.push(users[k]);
            }
        }

        stats.level1.forEach(l1 => {
            for (const k in users) {
                if (users[k].referred_by === l1.uid) {
                    stats.level2.push(users[k]);
                }
            }
        });

        stats.level2.forEach(l2 => {
            for (const k in users) {
                if (users[k].referred_by === l2.uid) {
                    stats.level3.push(users[k]);
                }
            }
        });

        return {
            l1Count: stats.level1.length,
            l2Count: stats.level2.length,
            l3Count: stats.level3.length,
            l1Users: stats.level1.map(u => ({ name: u.name, joined: u.created_at, total_tasks: u.total_tasks_completed || 0 })),
            l2Users: stats.level2.map(u => ({ name: u.name, joined: u.created_at, total_tasks: u.total_tasks_completed || 0 })),
            l3Users: stats.level3.map(u => ({ name: u.name, joined: u.created_at, total_tasks: u.total_tasks_completed || 0 }))
        };
    }

    getSettings() {
        let settings = null;
        try {
            settings = JSON.parse(localStorage.getItem('ep_settings'));
        } catch (e) {}

        if (!settings || settings.upiId === 'ram-5784@ptyes') {
            settings = {
                upiId: 'shivlal-d@ptyes',
                qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=0c0f17&data=upi://pay?pa=shivlal-d@ptyes%26pn=ExtraPay%26am=100%26cu=INR',
                usdtRate: 112,
                usdtAddress: '0x71e7edd284200a067b8e549af6f397e0396796e2'
            };
            localStorage.setItem('ep_settings', JSON.stringify(settings));
            if (this.db) {
                this.db.collection('settings').doc('global').set(settings).catch(() => {});
            }
        }
        return settings;
    }

    updateSettings(upiId, usdtRate, usdtAddress) {
        const settings = this.getSettings();
        settings.upiId = upiId;
        settings.qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=0c0f17&data=upi://pay?pa=${encodeURIComponent(upiId)}%26pn=ExtraPay%26cu=INR`;
        settings.usdtRate = parseFloat(usdtRate) || 112;
        if (usdtAddress) settings.usdtAddress = usdtAddress;
        
        localStorage.setItem('ep_settings', JSON.stringify(settings));
        
        this.db.collection('settings').doc('global').set(settings).catch(err => {
            console.error("Firestore settings update error:", err);
        });
        return settings;
    }
}

window.epDb = new ExtraPayDB();
