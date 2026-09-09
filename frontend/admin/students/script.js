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

let allStudentsData = [];

// LOAD ALL STUDENTS
async function loadStudents() {
  try {
    const response = await fetch('/api/students', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    allStudentsData = await response.json();
    renderStudents(allStudentsData);
  } catch (err) {
    console.log('Error loading students:', err);
  }
}

function renderStudents(students) {
  const tbody = document.getElementById('studentTableBody');
  tbody.innerHTML = '';

  if (students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">No matching students found</td></tr>';
    return;
  }

  students.forEach(student => {
    const date = new Date(student.createdAt).toLocaleDateString();
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${student.name}</td>
      <td>${student.email}</td>
      <td>${student.department || '-'}</td>
      <td>${date}</td>
      <td><button class="delete-btn" onclick="deleteUser('${student._id}')">Remove</button></td>
    `;
    tbody.appendChild(row);
  });
}

document.getElementById('studentSearch')?.addEventListener('input', function() {
  const query = this.value.toLowerCase().trim();
  const filtered = allStudentsData.filter(s =>
    s.name.toLowerCase().includes(query) || s.email.toLowerCase().includes(query)
  );
  renderStudents(filtered);
});

// DELETE/REMOVE USER
async function deleteUser(id) {
  if (!confirm('Are you sure you want to remove this student account?')) return;

  try {
    await fetch('/api/users/' + id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    loadStudents();
  } catch (err) {
    console.log('Error deleting user:', err);
  }
}

loadStudents();