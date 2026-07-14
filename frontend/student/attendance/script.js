const token = localStorage.getItem('token');
const role = localStorage.getItem('role');

if (!token || role !== 'student') {
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
    const res = await fetch('/api/student-units', {
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

// Load my attendance records
async function loadAttendance() {
  try {
    const unitId = document.getElementById('unitFilter').value;
    const status = document.getElementById('statusFilter').value;

    let url = '/api/my-attendance';
    const params = [];
    if (unitId) params.push('unitId=' + unitId);
    if (status) params.push('status=' + status);
    if (params.length > 0) url += '?' + params.join('&');

    const res = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();

    renderRecords(data);
    updateStats(data);
  } catch (err) {
    console.log('Error loading attendance:', err);
  }
}

function updateStats(data) {
  const records = data.attendance || [];

  document.getElementById('totalSessions').textContent = records.length;

  if (records.length > 0) {
    const totalPercent = records.reduce((sum, r) => sum + r.attendancePercent, 0);
    const avgPercent = Math.round(totalPercent / records.length);
    document.getElementById('avgAttendance').textContent = avgPercent + '%';

    const totalScore = records.reduce(
      (sum, r) => sum + (r.attendancePercent / 100) * 10, 0
    );
    const avgScore = (totalScore / records.length).toFixed(1);
    document.getElementById('avgScore').textContent = avgScore + '/10';
  } else {
    document.getElementById('avgAttendance').textContent = '0%';
    document.getElementById('avgScore').textContent = '0/10';
  }
}

function renderRecords(data) {
  const listEl = document.getElementById('recordsList');
  const records = data.attendance || [];
  const sessions = data.sessions || [];

  if (records.length === 0) {
    listEl.innerHTML = '<p class="empty-text">No attendance records found.</p>';
    return;
  }

  const rows = records.map(r => {
    const session = sessions.find(s => s._id.toString() === r.sessionId);
    const unit = myUnits.find(u => u._id === r.unitId);
    const unitName = unit ? unit.name + ' (' + unit.code + ')' : 'General Class';
    const className = session ? session.className : 'Class';
    const date = session ? new Date(session.startTime).toLocaleDateString() : '';
    const score = parseFloat(((r.attendancePercent / 100) * 10).toFixed(1));

    return `
      <tr>
        <td>${className}</td>
        <td>${unitName}</td>
        <td>${date}</td>
        <td>${r.responses}/${r.checksSent}</td>
        <td>${r.attendancePercent}%</td>
        <td><span class="badge ${r.finalStatus}">${r.finalStatus}</span></td>
        <td>${score}/10</td>
      </tr>
    `;
  }).join('');

  listEl.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Class</th>
          <th>Unit</th>
          <th>Date</th>
          <th>Checks Responded</th>
          <th>Attendance %</th>
          <th>Status</th>
          <th>Score (/10)</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

document.getElementById('filterBtn').addEventListener('click', loadAttendance);

async function init() {
  await loadUnits();
  await loadAttendance();
}

init();