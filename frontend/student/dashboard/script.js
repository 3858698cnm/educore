const token = localStorage.getItem('token');
const role = localStorage.getItem('role');
const name = localStorage.getItem('name');
const userId = localStorage.getItem('userId');

if (!token || role !== 'student') {
  window.location.href = '/login';
}

document.getElementById('studentName').textContent = name;

document.getElementById('logoutBtn').addEventListener('click', function() {
  localStorage.clear();
  window.location.href = '/login';
});

// Load student profile info (course, units)
async function loadStudentInfo() {
  try {
    const res = await fetch('/api/my-profile', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();

    // Show course name in header
    if (data.course) {
      document.getElementById('studentCourse').textContent =
        '📖 ' + data.course.name + ' — ' + (data.department ? data.department.name : '') +
        ' | ' + (data.faculty ? data.faculty.name : '');
    } else {
      document.getElementById('studentCourse').textContent = 'No course enrolled yet';
    }

    // Show units
    const unitsList = document.getElementById('unitsList');
    if (data.units && data.units.length > 0) {
      unitsList.innerHTML = '';
      data.units.forEach(unit => {
        const card = document.createElement('div');
        card.className = 'unit-card';
        card.innerHTML = `
          <div class="code">${unit.code}</div>
          <h3>${unit.name}</h3>
          <div class="lecturer">👨‍🏫 ${unit.lecturerName || 'No lecturer assigned'}</div>
        `;
        unitsList.appendChild(card);
      });
      document.getElementById('totalUnits').textContent = data.units.length;
    } else {
      unitsList.innerHTML = '<p class="empty-text">No units found for your course yet.</p>';
    }

  } catch (err) {
    console.log('Error loading student info:', err);
  }
}

// Load active live classes
async function loadActiveLiveClasses() {
  try {
    const res = await fetch('/api/active-sessions', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const sessions = await res.json();

    const listEl = document.getElementById('liveClassList');

    if (sessions.length === 0) {
      listEl.innerHTML = '<p class="empty-text">No live classes at the moment. Check back soon!</p>';
      return;
    }

    listEl.innerHTML = '';
    sessions.forEach(session => {
      const card = document.createElement('div');
      card.className = 'live-card';
      card.innerHTML = `
        <div>
          <h3>${session.className}</h3>
          <p>🔴 LIVE NOW</p>
          <small>Unit: ${session.unitName || 'General Class'}</small>
        </div>
        <a href="/student/live-class?session=${session._id}" class="join-btn">Join Class</a>
      `;
      listEl.appendChild(card);
    });

  } catch (err) {
    console.log('Error loading live classes:', err);
  }
}

// Load grades summary
async function loadGradesSummary() {
  try {
    const res = await fetch('/api/my-grades', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const grades = await res.json();
    document.getElementById('totalGrades').textContent = grades.length;
  } catch (err) {
    console.log('Error loading grades:', err);
  }
}

// Load attendance rate
async function loadAttendanceRate() {
  try {
    const res = await fetch('/api/my-attendance', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const records = await res.json();

    if (records.length === 0) {
      document.getElementById('attendanceRate').textContent = '0%';
      return;
    }

    const presentCount = records.filter(r =>
      r.finalStatus === 'present' || r.finalStatus === 'partial'
    ).length;

    const rate = Math.round((presentCount / records.length) * 100);
    document.getElementById('attendanceRate').textContent = rate + '%';
  } catch (err) {
    console.log('Error loading attendance:', err);
  }
}

// Initialize
async function init() {
  await loadStudentInfo();
  await loadActiveLiveClasses();
  await loadGradesSummary();
  await loadAttendanceRate();
}

init();

// Refresh live classes every 15 seconds
setInterval(loadActiveLiveClasses, 15000);