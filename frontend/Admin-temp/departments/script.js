const token = localStorage.getItem('token');
const role = localStorage.getItem('role');

if (!token || role !== 'admin') {
  window.location.href = '/login';
}

document.getElementById('logoutBtn').addEventListener('click', function() {
  localStorage.clear();
  window.location.href = '/login';
});

// Load faculties into dropdown
async function loadFacultiesDropdown() {
  try {
    const response = await fetch('/api/faculties', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const faculties = await response.json();

    const select = document.getElementById('deptFaculty');
    select.innerHTML = '<option value="">Select Faculty</option>';

    faculties.forEach(f => {
      const option = document.createElement('option');
      option.value = f._id;
      option.textContent = f.name;
      select.appendChild(option);
    });
  } catch (err) {
    console.log('Error loading faculties:', err);
  }
}

// Load all departments
async function loadDepartments() {
  try {
    const [deptRes, facRes] = await Promise.all([
      fetch('/api/departments', { headers: { 'Authorization': 'Bearer ' + token } }),
      fetch('/api/faculties', { headers: { 'Authorization': 'Bearer ' + token } })
    ]);

    const departments = await deptRes.json();
    const faculties = await facRes.json();

    const tbody = document.getElementById('deptTableBody');
    tbody.innerHTML = '';

    departments.forEach(dept => {
      const faculty = faculties.find(f => f._id === dept.facultyId);
      const facultyName = faculty ? faculty.name : '-';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${dept.name}</td>
        <td>${facultyName}</td>
        <td><button class="delete-btn" onclick="deleteDepartment('${dept._id}')">Delete</button></td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.log('Error loading departments:', err);
  }
}

// Add department
document.getElementById('addBtn').addEventListener('click', async function() {
  const name = document.getElementById('deptName').value.trim();
  const facultyId = document.getElementById('deptFaculty').value;
  const messageEl = document.getElementById('message');

  if (!name || !facultyId) {
    messageEl.style.color = '#e11d48';
    messageEl.textContent = 'Department name and faculty are required';
    return;
  }

  try {
    const response = await fetch('/api/departments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ name, facultyId })
    });

    const data = await response.json();

    if (response.ok) {
      messageEl.style.color = '#16a34a';
      messageEl.textContent = 'Department added successfully';
      document.getElementById('deptName').value = '';
      document.getElementById('deptFaculty').value = '';
      loadDepartments();
    } else {
      messageEl.style.color = '#e11d48';
      messageEl.textContent = data.message;
    }
  } catch (err) {
    messageEl.style.color = '#e11d48';
    messageEl.textContent = 'Something went wrong';
  }
});

// Delete department
async function deleteDepartment(id) {
  if (!confirm('Are you sure you want to delete this department?')) return;

  try {
    await fetch('/api/departments/' + id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    loadDepartments();
  } catch (err) {
    console.log('Error deleting department:', err);
  }
}

async function init() {
  await loadFacultiesDropdown();
  await loadDepartments();
}

init();