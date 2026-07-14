const token = localStorage.getItem('token');
const role = localStorage.getItem('role');
const name = localStorage.getItem('name');
const lecturerId = localStorage.getItem('userId');

if (!token || role !== 'lecturer') {
  window.location.href = '/login';
}

document.getElementById('lecturerName').textContent = name;

document.getElementById('logoutBtn').addEventListener('click', function() {
  localStorage.clear();
  window.location.href = '/login';
});

// Load lecturer profile and units
async function loadLecturerInfo() {
  try {
    const res = await fetch('/api/lecturer-profile', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();

    // Show department and faculty
    if (data.department && data.faculty) {
      document.getElementById('lecturerDept').textContent =
        '🏫 ' + data.department.name + ' | ' + data.faculty.name;
    } else {
      document.getElementById('lecturerDept').textContent =
        'Profile incomplete — please update your department';
    }

    // Show assigned units
    const unitsList = document.getElementById('unitsList');
    if (data.units && data.units.length > 0) {
      unitsList.innerHTML = '';
      data.units.forEach(unit => {
        const card = document.createElement('div');
        card.className = 'unit-card';
        card.innerHTML = `
          <div class="code">${unit.code}</div>
          <h3>${unit.name}</h3>
          <div class="course">📖 ${unit.courseName || 'N/A'}</div>
        `;
        unitsList.appendChild(card);
      });
      document.getElementById('totalUnits').textContent = data.units.length;
    } else {
      unitsList.innerHTML = '<p class="empty-text">No units assigned to you yet. Contact admin.</p>';
    }

  } catch (err) {
    console.log('Error loading lecturer info:', err);
  }
}

async function loadActiveClass() {
  try {
    const res = await fetch('/api/my-active-session', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();

    const box = document.getElementById('activeClassBox');

    if (data.session) {
      box.innerHTML = `
        <div class="active-class-card">
          <div>
            <h3>${data.session.className}</h3>
            <p>🔴 LIVE NOW</p>
            <small style="color:#94a3b8;">
              Session ID: ${data.session._id}
            </small>
          </div>
          <a href="/lecturer/live-class?rejoin=${data.session._id}&className=${encodeURIComponent(data.session.className)}&unitId=${data.session.unitId}" 
             class="rejoin-btn">
            Rejoin Class
          </a>
        </div>
      `;
    } else {
      box.innerHTML = '<p class="empty-text">No active class right now.</p>';
    }
  } catch (err) {
    console.log('Error loading active class:', err);
  }
}
// Load total sessions conducted
async function loadSessionStats() {
  try {
    const res = await fetch('/api/my-sessions', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const sessions = await res.json();
    document.getElementById('totalSessions').textContent = sessions.length;
  } catch (err) {
    console.log('Error loading sessions:', err);
  }
}

// Load total students in lecturer's units
async function loadStudentCount() {
  try {
    const res = await fetch('/api/my-students-count', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    document.getElementById('totalStudents').textContent = data.count || 0;
  } catch (err) {
    console.log('Error loading student count:', err);
  }
}

async function init() {
  await loadLecturerInfo();
  await loadActiveClass();
  await loadSessionStats();
  await loadStudentCount();
}

init();