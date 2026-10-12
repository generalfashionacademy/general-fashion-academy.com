// Firebase Configuration
const firebaseConfig = {
    databaseURL: "https://gfa-admission-portal-default-rtdb.firebaseio.com/",
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// State
let currentUser = null;
let activeDraftId = null;
let currentViewedStudentId = null; // Added for student details view
// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Nav & Sections
    const sections = document.querySelectorAll('.page-section');
    const navItems = document.querySelectorAll('.nav-item');
    const navLinks = document.querySelector('.nav-links');
    const mobileMenuBtn = document.querySelector('.mobile-menu');

    // 2. Navigation Logic
    window.navigateTo = function (sectionId) {
        // Hide all sections
        sections.forEach(sec => sec.classList.remove('active'));

        // Show target section
        const targetSec = document.getElementById(sectionId);
        if (targetSec) {
            targetSec.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Toggle Footer Visibility
        const footer = document.getElementById('main-footer');
        const isPortal = sectionId.includes('portal') || sectionId.includes('admin') || sectionId.includes('student') || sectionId.includes('classrep');
        if (footer) {
            footer.style.display = isPortal ? 'none' : 'block';
        }

        // Update Nav Menu active state
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-target') === sectionId) {
                item.classList.add('active');
            }
        });

        // Trigger Data Loaders
        if (sectionId === 'classrep-section') loadClassrepData();

        // Close Mobile Menu
        if (navLinks) navLinks.classList.remove('active');
    };

    // Nav Item Clicks
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.getAttribute('data-target');
            navigateTo(target);
        });
    });

    // Mobile Menu Toggle
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }

    // 3. Tab Logic (Generic for all tab systems)
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-btn')) {
            const container = e.target.closest('.login-container');
            const targetId = e.target.getAttribute('data-tab');

            // Switch tabs
            container.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');

            // Switch forms
            container.querySelectorAll('.login-form').forEach(form => form.classList.remove('active'));
            const targetForm = document.getElementById(targetId);
            if (targetForm) targetForm.classList.add('active');
        }

        // Portal Sidebar Nav
        const portalNavItem = e.target.closest('li[data-admin-tab], li[data-student-tab], li[data-classrep-tab]');
        if (portalNavItem) {
            const type = portalNavItem.hasAttribute('data-admin-tab') ? 'admin' : (portalNavItem.hasAttribute('data-student-tab') ? 'student' : 'classrep');
            const tabName = portalNavItem.getAttribute(`data-${type}-tab`);

            // UI Toggle
            portalNavItem.parentElement.querySelectorAll('li').forEach(li => li.classList.remove('active'));
            portalNavItem.classList.add('active');

            document.querySelectorAll(`.${type}-tab-content`).forEach(content => content.classList.remove('active'));
            const targetTab = document.getElementById(`${type}-${tabName}-tab`);
            if (targetTab) targetTab.classList.add('active');
        }
    });

    // 4. Lightbox Logic
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('gallery-item') || e.target.classList.contains('admission-row-img')) {
            const modal = document.getElementById('lightbox-modal');
            const img = document.getElementById('lightbox-img');
            if (modal && img) {
                img.src = e.target.src;
                modal.classList.add('active');
            }
        }
    });

    // 5. Auth Handlers
    // Class Rep: Send Info to Admin
    const classrepAdminForm = document.getElementById('form-classrep-to-admin');
    if (classrepAdminForm) {
        classrepAdminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUser || currentUser.type !== 'classrep') return;

            const subject = document.getElementById('cr-admin-subject').value;
            const message = document.getElementById('cr-admin-message').value;

            const reportData = {
                level: currentUser.level,
                subject,
                message,
                createdAt: new Date().toISOString()
            };

            try {
                await db.ref('classrep_reports').push(reportData);
                alert('Information has been successfully sent to the Admin.');
                e.target.reset();
            } catch (err) {
                alert('Failed to send information. Please check your connection.');
            }
        });
    }

    loadGallery();
    startHeroSlideshow();
});

function startHeroSlideshow() {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    const images = [
        "IMG-20260429-WA0039.jpg",
        "IMG-20260429-WA0045.jpg",
        "IMG-20260429-WA0020.jpg",
        "IMG-20260429-WA0030.jpg",
        "IMG-20260429-WA0051.jpg"
    ];
    let currentIndex = 0;

    const changeBg = () => {
        hero.style.background = `linear-gradient(rgba(10, 37, 64, 0.7), rgba(10, 37, 64, 0.7)), url('${images[currentIndex]}') center top/cover no-repeat`;
        currentIndex = (currentIndex + 1) % images.length;
    };

    setInterval(changeBg, 7000);
}

// Helper Functions
function loadGallery() {
    const galleryContainer = document.getElementById('gallery-container');
    if (!galleryContainer) return;

    galleryContainer.innerHTML = '';
    // Load images from 19 to 51
    for (let i = 19; i <= 51; i++) {
        const img = document.createElement('img');
        img.src = `IMG-20260429-WA00${i}.jpg`;
        img.className = 'gallery-item';
        img.onerror = () => img.remove();
        galleryContainer.appendChild(img);
    }
}

window.logout = () => { currentUser = null; navigateTo('home-section'); };
window.openModal = id => document.getElementById(id).classList.add('active');
window.closeModal = id => document.getElementById(id).classList.remove('active');
window.resetClassAttendance = async () => {
    if (!currentUser || currentUser.type !== 'classrep') return;
    if (confirm(`Are you sure you want to delete the semester's register and reset all attendance to 0 for Level ${currentUser.level}?`)) {
        const snap = await db.ref('students').once('value');
        const data = snap.val();
        if (data) {
            const updates = {};
            for (let id in data) {
                if (data[id].level === currentUser.level) {
                    updates[id + '/attendance'] = 0;
                    updates[id + '/attendanceLogs'] = null;
                }
            }
            await db.ref('students').update(updates);
            alert(`Level ${currentUser.level} student attendance registers have been reset.`);
        }
    }
}

function switchClassrepTab(tabId) {
    document.querySelectorAll('.classrep-tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('[data-classrep-tab]').forEach(t => t.classList.remove('active'));

    const targetTab = document.getElementById(`classrep-${tabId}-tab`);
    const targetLink = document.querySelector(`[data-classrep-tab="${tabId}"]`);

    if (targetTab) targetTab.classList.add('active');
    if (targetLink) targetLink.classList.add('active');
}

// Class Rep Portal Functions
window.showClassrepLogin = (level) => {
    document.getElementById('classrep-login-form').style.display = 'block';
    document.getElementById('classrep-level-title').textContent = `Level ${level} Login`;
    document.getElementById('classrep-level-input').value = level;
    document.getElementById('classrep-error').textContent = '';
};

window.loginClassrep = () => {
    const level = document.getElementById('classrep-level-input').value;
    const pwd = document.getElementById('classrep-password').value;
    const errorMsg = document.getElementById('classrep-error');

    if ((level === '100' && pwd === 'Classrep100') || (level === '200' && pwd === 'Classrep200')) {
        currentUser = { type: 'classrep', level: level };
        closeModal('classrep-modal');
        document.getElementById('classrep-password').value = '';
        navigateTo('classrep-section');
    } else {
        errorMsg.textContent = 'Invalid Password';
    }
};

window.markAttendance = async (studentId, status) => {
    if (!currentUser || currentUser.type !== 'classrep') return;

    const today = new Date().toISOString().split('T')[0];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const day = days[new Date().getDay()];

    try {
        const ref = db.ref('students/' + studentId);
        const snap = await ref.once('value');
        const data = snap.val();
        if (data) {
            const logs = data.attendanceLogs || {};
            let newAttendance = data.attendance || 0;
            const previousStatus = logs[today]?.status;

            if (previousStatus !== 'Present' && status === 'Present') {
                newAttendance += 1;
            } else if (previousStatus === 'Present' && status === 'Absent') {
                newAttendance = Math.max(0, newAttendance - 1);
            }

            logs[today] = {
                status: status,
                day: day,
                timestamp: new Date().toISOString()
            };
            await ref.update({ attendance: newAttendance, attendanceLogs: logs });
        }
    } catch (e) {
        console.error(e);
        alert('Error marking attendance');
    }
};

window.saveProgress = async () => {
    if (!currentUser || currentUser.type !== 'classrep') return;

    const todayISO = new Date().toISOString().split('T')[0];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[new Date().getDay()];

    try {
        const snap = await db.ref('students').once('value');
        const students = snap.val();
        const records = [];

        if (students) {
            for (let id in students) {
                if (students[id].level === currentUser.level) {
                    const logs = students[id].attendanceLogs || {};
                    records.push({
                        studentId: id,
                        status: logs[todayISO]?.status || 'Not Marked'
                    });
                }
            }
        }

        const draftData = {
            level: currentUser.level,
            date: todayISO,
            day: dayName,
            timestamp: new Date().toISOString(),
            records: records
        };

        await db.ref('attendance_drafts').push(draftData);
        alert("Progress saved as a DRAFT. You can find it in the 'Drafts & Progress' tab to resume later.");
        loadAttendanceDrafts();
    } catch (e) {
        alert("Failed to save progress.");
    }
};

window.loadAttendanceDrafts = async () => {
    if (!currentUser || currentUser.type !== 'classrep') return;
    const list = document.getElementById('classrep-drafts-list');
    if (!list) return;

    db.ref('attendance_drafts').orderByChild('level').equalTo(currentUser.level).on('value', snap => {
        const drafts = snap.val();
        list.innerHTML = '';

        if (drafts) {
            const sorted = Object.entries(drafts).sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));
            sorted.forEach(([id, d]) => {
                const card = document.createElement('div');
                card.className = 'course-category-card glass-card';
                card.style.padding = '1.5rem';

                card.innerHTML = `
                    <div style="font-size: 0.8rem; color: #666; margin-bottom: 5px;">${d.day} â€¢ Draft</div>
                    <h3 style="margin-bottom: 10px; color: var(--primary-blue);"><i class="fas fa-edit"></i> ${new Date(d.date).toLocaleDateString()}</h3>
                    <div style="font-size: 0.85rem; margin-bottom: 15px;">
                        <span style="background:var(--primary-blue-light); color:white; padding:3px 10px; border-radius:12px;">${d.records.length} Students marked</span>
                    </div>
                    <button class="small-btn primary-btn" style="width:100%;" onclick="resumeDraft('${id}')">Resume Marking</button>
                    <button class="small-btn" style="width:100%; margin-top:5px; background:#eee; color:#666; border:none;" onclick="deleteDraft('${id}')">Discard</button>
                `;
                list.appendChild(card);
            });
        } else {
            list.innerHTML = '<p class="text-muted">No active drafts found.</p>';
        }
    });
};

window.resumeDraft = async (id) => {
    const snap = await db.ref('attendance_drafts/' + id).once('value');
    const d = snap.val();
    if (!d) return;

    if (confirm("Resume this draft? This will overwrite any current markings on your register for today.")) {
        const updates = {};
        const todayISO = new Date().toISOString().split('T')[0];
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const day = days[new Date().getDay()];

        d.records.forEach(rec => {
            updates[`students/${rec.studentId}/attendanceLogs/${todayISO}`] = {
                status: rec.status,
                day: day,
                timestamp: new Date().toISOString()
            };
        });

        await db.ref().update(updates);
        activeDraftId = id; // Store the ID of the resumed draft

        alert("Draft loaded into register! Switch to the 'Register' tab to finish marking.");

        // Visual indicator
        const badge = document.getElementById('register-status-badge');
        if (badge) badge.style.display = 'inline-block';

        // Navigate back to register
        switchClassrepTab('dashboard');
    }
};

window.deleteDraft = async (id) => {
    if (confirm("Are you sure you want to discard this draft?")) {
        await db.ref('attendance_drafts/' + id).remove();
        alert("Draft discarded.");
    }
};

window.saveDayAttendance = async () => {
    if (!currentUser || currentUser.type !== 'classrep') return;

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[new Date().getDay()];
    const todayISO = new Date().toISOString().split('T')[0];

    if (!confirm(`FINAL SUBMISSION: Are you sure you want to PERMANENTLY save and close this register? \n\nOnce submitted, this session CANNOT be edited, and it will be sent directly to the Admin for review.`)) {
        return;
    }

    try {
        const snap = await db.ref('students').once('value');
        const students = snap.val();
        const attendanceRecord = [];
        const updates = {};

        if (students) {
            for (let id in students) {
                if (students[id].level === currentUser.level) {
                    const logs = students[id].attendanceLogs || {};
                    const statusToday = logs[todayISO]?.status || 'Not Marked';

                    attendanceRecord.push({
                        studentId: id,
                        name: students[id].name,
                        studentNumber: students[id].studentNumber,
                        status: statusToday
                    });

                    // Clear today's log for the "clean sheet"
                    updates[`students/${id}/attendanceLogs/${todayISO}`] = null;
                }
            }
        }

        if (attendanceRecord.length === 0) {
            alert('No students found to save.');
            return;
        }

        // 1. Store the snapshot in a dedicated history table
        const snapshotData = {
            level: currentUser.level,
            day: dayName,
            date: todayISO,
            timestamp: new Date().toISOString(),
            savedBy: `Level ${currentUser.level} Rep`,
            records: attendanceRecord
        };
        await db.ref('attendance_snapshots').push(snapshotData);

        // 2. Clear the current register (Clean Sheet)
        await db.ref().update(updates);

        // 3. Clear the draft if one was active
        if (activeDraftId) {
            await db.ref('attendance_drafts/' + activeDraftId).remove();
            activeDraftId = null;
            const badge = document.getElementById('register-status-badge');
            if (badge) badge.style.display = 'none';
        }

        alert(`SUCCESS!\nAttendance for ${dayName} has been stored.\nA clean sheet is now ready.`);
        loadClassrepData();
    } catch (e) {
        console.error(e);
        alert('Failed to save and clear attendance.');
    }
};

window.loadAttendanceHistory = async () => {
    if (!currentUser || currentUser.type !== 'classrep') return;
    const grid = document.getElementById('history-sessions-grid');
    if (!grid) return;

    grid.innerHTML = '<p class="text-muted">Loading logs...</p>';

    try {
        const snap = await db.ref('attendance_snapshots').orderByChild('level').equalTo(currentUser.level).once('value');
        const snapshots = snap.val();
        grid.innerHTML = '';

        if (!snapshots) {
            grid.innerHTML = '<p class="text-muted">No saved registers found.</p>';
            return;
        }

        // Sort by date/timestamp descending
        const sorted = Object.entries(snapshots).sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));

        sorted.forEach(([id, s]) => {
            const card = document.createElement('div');
            card.className = 'course-category-card glass-card';
            card.style.padding = '1.5rem';
            card.style.cursor = 'pointer';
            card.onclick = () => viewSnapshotDetails(id, s);

            card.innerHTML = `
                <div style="font-size: 0.8rem; color: #666; margin-bottom: 5px;">${s.day}</div>
                <h3 style="margin-bottom: 10px; color: var(--primary-blue);"><i class="fas fa-calendar-check"></i> ${new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</h3>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 0.85rem; background: #eee; padding: 3px 10px; border-radius: 12px;">${s.records.length} Students</span>
                    <span style="font-size: 0.8rem; color: var(--accent-gold);">View List <i class="fas fa-chevron-right"></i></span>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (e) {
        console.error(e);
        grid.innerHTML = '<p class="text-danger">Failed to load logs.</p>';
    }
};

window.viewSnapshotDetails = (id, s) => {
    document.getElementById('history-list-view').style.display = 'none';
    const detailView = document.getElementById('history-detail-view');
    detailView.style.display = 'block';

    document.getElementById('snapshot-title').textContent = `${s.day}, ${new Date(s.date).toLocaleDateString()}`;
    document.getElementById('snapshot-meta').textContent = `Saved at ${new Date(s.timestamp).toLocaleTimeString()} â€¢ ${s.records.length} Students`;

    const list = document.getElementById('classrep-history-detail-list');
    list.innerHTML = '';

    s.records.forEach(rec => {
        let statusHtml = '<span class="status-pill" style="color:#888;">Not Marked</span>';
        if (rec.status === 'Present') statusHtml = '<span class="status-pill present"><i class="fas fa-check-circle"></i> Present</span>';
        else if (rec.status === 'Absent') statusHtml = '<span class="status-pill absent"><i class="fas fa-times-circle"></i> Absent</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${rec.studentNumber || 'N/A'}</strong></td>
            <td>${rec.name}</td>
            <td>${statusHtml}</td>
        `;
        list.appendChild(tr);
    });
};

window.deleteAttendanceSnapshot = async (id) => {
    if (confirm("DANGER: Are you sure you want to PERMANENTLY delete this attendance register? This cannot be undone.")) {
        await db.ref('attendance_snapshots/' + id).remove();
        alert("Session register deleted.");
    }
};

window.loadClassrepData = async () => {
    if (!currentUser || currentUser.type !== 'classrep') return;
    document.getElementById('classrep-portal-name').textContent = `Level ${currentUser.level} Rep`;

    // Set Date Display
    const dateEl = document.getElementById('cr-date-display');
    if (dateEl) {
        const today = new Date();
        dateEl.textContent = today.toLocaleDateString('en-GB', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    const today = new Date().toISOString().split('T')[0];

    loadAttendanceHistory();
    loadAttendanceDrafts();

    db.ref('students').on('value', snap => {
        const list = document.getElementById('classrep-students-list');
        if (!list) return;
        list.innerHTML = '';
        const data = snap.val();
        let found = false;
        for (let id in data) {
            if (data[id].level === currentUser.level) {
                found = true;
                const logs = data[id].attendanceLogs || {};
                const statusToday = logs[today]?.status;

                const tr = document.createElement('tr');

                // Create buttons with active states
                let presentBtnClass = statusToday === 'Present' ? 'attendance-btn present active' : 'attendance-btn present';
                let absentBtnClass = statusToday === 'Absent' ? 'attendance-btn absent active' : 'attendance-btn absent';

                tr.innerHTML = `
                    <td><strong>${data[id].studentNumber || 'N/A'}</strong></td>
                    <td>${data[id].name}</td>
                    <td>Level ${data[id].level}</td>
                    <td>
                        <div class="attendance-actions">
                            <button class="${presentBtnClass}" onclick="markAttendance('${id}', 'Present')">
                                <i class="fas fa-check"></i> Present
                            </button>
                            <button class="${absentBtnClass}" onclick="markAttendance('${id}', 'Absent')">
                                <i class="fas fa-times"></i> Absent
                            </button>
                        </div>
                    </td>
                `;
                list.appendChild(tr);
            }
        }
        if (!found) {
            list.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No students found in this level.</td></tr>';
        }
    });
};

