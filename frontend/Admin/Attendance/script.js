const token = localStorage.getItem('token');
const role = localStorage.getItem('role');

if (!token || role !== 'admin') {
  window.location.href = '/login';
}

document.getElementById('logoutBtn').addEventListener('click', function() {
  localStorage.clear();
  window.location.href = '/login';
});

let allSessions = [];
let allUnits = [];

// Load units into filter dropdown
async function loadUnits() {
  try {
    const res = await fetch('/api/units', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    allUnits = await res.json();

    const select = document.getElementById('unitFilter');
    select.innerHTML = '<option value="">All Units</option>';
    allUnits.forEach(unit => {
      const opt = document.createElement('option');
      opt.value = unit._id;
      opt.textContent = unit.name + ' (' + unit.code + ')';
      select.appendChild(opt);
    });
  } catch (err) {
    console.log('Error loading units:', err);
  }
}

// Load all sessions with attendance
async function loadAttendance() {
  try {
    const unitId = document.getElementById('unitFilter').value;
    const status = document.getElementById('statusFilter').value;

    let url = '/api/admin/attendance';
    const params = [];
    if (unitId) params.push('unitId=' + unitId);
    if (status) params.push('status=' + status);
    if (params.length > 0) url += '?' + params.join('&');

    const res = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();

    renderSessions(data);
  } catch (err) {
    console.log('Error loading attendance:', err);
  }
}

function renderSessions(data) {
  const listEl = document.getElementById('sessionsList');

  if (!data.sessions || data.sessions.length === 0) {
    listEl.innerHTML = '<p class="empty-text">No sessions found.</p>';
    return;
  }

  listEl.innerHTML = '';

  data.sessions.forEach(session => {
    const unit = allUnits.find(u => u._id === session.unitId);
    const unitName = unit ? unit.name + ' (' + unit.code + ')' : 'General Class';
    const date = new Date(session.startTime).toLocaleDateString();
    const time = new Date(session.startTime).toLocaleTimeString();

    const records = data.attendance.filter(
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
          <p>📚 ${unitName} &nbsp;|&nbsp; 📅 ${date} at ${time}</p>
        </div>
        <div class="session-stats">
          <span class="stat-badge present">✓ ${presentCount} Present</span>
          <span class="stat-badge partial">~ ${partialCount} Partial</span>
          <span class="stat-badge absent">✗ ${absentCount} Absent</span>
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
            ? '<tr><td colspan="6" class="no-records">No students attended this session</td></tr>'
            : records.map(r => {
                const score = parseFloat(((r.attendancePercent / 100) * 10).toFixed(1));
                return `
                  <tr>
                    <td>${r.studentName}</td>
                    <td>${r.checksSent}</td>
                    <td>${r.responses}</td>
                    <td>${r.attendancePercent}%</td>
                    <td><span class="badge ${r.finalStatus}">${r.finalStatus}</span></td>
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
document.getElementById('filterBtn').addEventListener('click', loadAttendance);

async function init() {
  await loadUnits();
  await loadAttendance();
}

init();