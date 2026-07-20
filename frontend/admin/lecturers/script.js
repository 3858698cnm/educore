const token = localStorage.getItem('token');
const role = localStorage.getItem('role');

if (!token || role !== 'admin') {
  window.location.href = '/login';
}

document.getElementById('logoutBtn').addEventListener('click', function() {
  localStorage.clear();
  window.location.href = '/login';
});

// LOAD ALL LECTURERS
async function loadLecturers() {
  try {
    const response = await fetch('/api/lecturers', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const lecturers = await response.json();

    const tbody = document.getElementById('lecturerTableBody');
    tbody.innerHTML = '';

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

  } catch (err) {
    console.log('Error loading lecturers:', err);
  }
}

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