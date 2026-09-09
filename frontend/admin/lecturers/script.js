const token = localStorage.getItem('token');
const role = localStorage.getItem('role');

if (!token || role !== 'admin') {
  window.location.href = '/login';
}
document.getElementById('menuToggleBtn').addEventListener('click', function() {
  document.getElementById('sidebar').classList.toggle('open');
});
document.getElementById('logoutBtn').addEventListener('click', function() {
  localStorage.clear();
  window.location.href = '/login';
});

let allLecturersData = [];

// LOAD ALL LECTURERS
async function loadLecturers() {
  try {
    const response = await fetch('/api/lecturers', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    allLecturersData = await response.json();
    renderLecturers(allLecturersData);
  } catch (err) {
    console.log('Error loading lecturers:', err);
  }
}

function renderLecturers(lecturers) {
  const tbody = document.getElementById('lecturerTableBody');
  tbody.innerHTML = '';

  if (lecturers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">No matching lecturers found</td></tr>';
    return;
  }

  lecturers.forEach(lect => {
    const date = new Date(lect.createdAt).toLocaleDateString();
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${lect.name}</td>
      <td>${lect.email}</td>
      <td>${lect.department || '-'}</td>
      <td>${date}</td>
      <td><button class="delete-btn" onclick="deleteUser('${lect._id}')">Remove</button></td>
    `;
    tbody.appendChild(row);
  });
}

document.getElementById('lecturerSearch')?.addEventListener('input', function() {
  const query = this.value.toLowerCase().trim();
  const filtered = allLecturersData.filter(l =>
    l.name.toLowerCase().includes(query) || l.email.toLowerCase().includes(query)
  );
  renderLecturers(filtered);
});

// DELETE/REMOVE USER
async function deleteUser(id) {
  if (!confirm('Are you sure you want to remove this lecturer account?')) return;

  try {
    await fetch('/api/users/' + id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    loadLecturers();
  } catch (err) {
    console.log('Error deleting user:', err);
  }
}

loadLecturers();