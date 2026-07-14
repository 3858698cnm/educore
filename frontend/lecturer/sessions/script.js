const token = localStorage.getItem('token');
const role = localStorage.getItem('role');

if (!token || role !== 'lecturer') {
  window.location.href = '/login';
}

document.getElementById('logoutBtn').addEventListener('click', function() {
  localStorage.clear();
  window.location.href = '/login';
});

let myUnits = [];

// Load units into filter dropdown
async function loadUnits() {
  try {
    const res = await fetch('/api/my-units', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    myUnits = await res.json();

    const select = document.getElementById('unitFilter');
    select.innerHTML = '<option value="">All Units</option>';
    myUnits.forEach(unit => {
      const opt = document.createElement('option');
      opt.value = unit._id;
      opt.textContent = unit.name + ' (' + unit.code + ')';
      select.appendChild(opt);
    });
  } catch (err) {
    console.log('Error loading units:', err);
  }
}

// Load past sessions
async function loadSessions() {
  try {
    const unitId = document.getElementById('unitFilter').value;

    let url = '/api/my-sessions-full';
    if (unitId) url += '?unitId=' + unitId;

    const res = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();

    renderSessions(data);
    updateStats(data);
  } catch (err) {
    console.log('Error loading sessions:', err);
  }
}

function updateStats(data) {
  const sessions = data.sessions || [];
  const attendance = data.attendance || [];

  document.getElementById('totalSessions').textContent = sessions.length;

  const uniqueStudents = [...new Set(attendance.map(a => a.studentId))];
  document.getElementById('totalStudentsSeen').textContent = uniqueStudents.length;

  if (attendance.length > 0) {
    const totalPercent = attendance.reduce((sum, a) => sum + a.attendancePercent, 0);
    const avg = Math.round(totalPercent / attendance.length);
    document.getElementById('avgAttendance').textContent = avg + '%';
  } else {
    document.getElementById('avgAttendance').textContent = '0%';
  }
}

function renderSessions(data) {
  const listEl = document.getElementById('sessionsList');
  const sessions = data.sessions || [];
  const attendance = data.attendance || [];

  if (sessions.length === 0) {
    listEl.innerHTML = '<p class="empty-text">No sessions found. Start your first live class!</p>';
    return;
  }

  listEl.innerHTML = '';

  sessions.forEach(session => {
    const unit = myUnits.find(u => u._id === session.unitId);
    const unitName = unit
      ? unit.name + ' (' + unit.code + ')'
      : 'General Class';

    const date = new Date(session.startTime).toLocaleDateString();
    const time = new Date(session.startTime).toLocaleTimeString();

    const endTime = session.endTime
      ? new Date(session.endTime).toLocaleTimeString()
      : 'N/A';

    const records = attendance.filter(
      a => a.sessionId === session._id.toString()
    );

    const presentCount = records.filter(r => r.finalStatus === 'present').length;
    const partialCount = records.filter(r => r.finalStatus === 'partial').length;
    const absentCount = records.filter(r => r.finalStatus === 'absent').length;

    const card = document.createElement('div');
    card.className = 'session-card';
    card.innerHTML = `
      <div class="session-header">
        <div>
          <h3>${session.className}</h3>
          <p>
            📚 ${unitName} &nbsp;|&nbsp;
            📅 ${date} &nbsp;|&nbsp;
            🕐 ${time} — ${endTime}
          </p>
        </div>
        <div class="session-stats">
          <span class="stat-badge present">✓ ${presentCount}</span>
          <span class="stat-badge partial">~ ${partialCount}</span>
          <span class="stat-badge absent">✗ ${absentCount}</span>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Student Name</th>
            <th>Checks Sent</th>
            <th>Responded</th>
            <th>Attendance %</th>
            <th>Status</th>
            <th>Score (/10)</th>
          </tr>
        </thead>
        <tbody>
          ${records.length === 0
            ? `<tr>
                 <td colspan="6" class="no-records">
                   No students attended this session
                 </td>
               </tr>`
            : records.map(r => {
                const score = parseFloat(
                  ((r.attendancePercent / 100) * 10).toFixed(1)
                );
                return `
                  <tr>
                    <td>${r.studentName}</td>
                    <td>${r.checksSent}</td>
                    <td>${r.responses}</td>
                    <td>${r.attendancePercent}%</td>
                    <td>
                      <span class="badge ${r.finalStatus}">
                        ${r.finalStatus}
                      </span>
                    </td>
                    <td>${score}/10</td>
                  </tr>
                `;
              }).join('')
          }
        </tbody>
      </table>
    `;
    listEl.appendChild(card);
  });
}

// Filter button
document.getElementById('filterBtn').addEventListener('click', loadSessions);

async function init() {
  await loadUnits();
  await loadSessions();
}

init();