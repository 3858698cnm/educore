const token = localStorage.getItem('token');
const role = localStorage.getItem('role');

if (!token || role !== 'admin') {
  window.location.href = '/login';
}

document.getElementById('logoutBtn').addEventListener('click', function() {
  localStorage.clear();
  window.location.href = '/login';
});

// LOAD ALL STUDENTS
async function loadStudents() {
  try {
    const response = await fetch('/api/students', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const students = await response.json();

    const tbody = document.getElementById('studentTableBody');
    tbody.innerHTML = '';

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

  } catch (err) {
    console.log('Error loading students:', err);
  }
}

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