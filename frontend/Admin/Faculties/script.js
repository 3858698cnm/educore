const token = localStorage.getItem('token');
const role = localStorage.getItem('role');

if (!token || role !== 'admin') {
  window.location.href = '/login';
}

document.getElementById('logoutBtn').addEventListener('click', function() {
  localStorage.clear();
  window.location.href = '/login';
});

// LOAD ALL FACULTIES
async function loadFaculties() {
  try {
    const response = await fetch('/api/faculties', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const faculties = await response.json();

    const tbody = document.getElementById('facultyTableBody');
    tbody.innerHTML = '';

    if (faculties.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:#999">No faculties added yet</td></tr>';
      return;
    }

    faculties.forEach(faculty => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${faculty.name}</td>
        <td><button class="delete-btn" onclick="deleteFaculty('${faculty._id}')">Delete</button></td>
      `;
      tbody.appendChild(row);
    });

  } catch (err) {
    console.log('Error loading faculties:', err);
  }
}

// ADD FACULTY
document.getElementById('addBtn').addEventListener('click', async function() {
  const name = document.getElementById('facultyName').value.trim();
  const messageEl = document.getElementById('message');

  if (!name) {
    messageEl.style.color = '#e11d48';
    messageEl.textContent = 'Faculty name is required';
    return;
  }

  try {
    const response = await fetch('/api/faculties', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ name })
    });

    const data = await response.json();

    if (response.ok) {
      messageEl.style.color = '#16a34a';
      messageEl.textContent = 'Faculty added successfully';
      document.getElementById('facultyName').value = '';
      loadFaculties();
    } else {
      messageEl.style.color = '#e11d48';
      messageEl.textContent = data.message;
    }

  } catch (err) {
    messageEl.style.color = '#e11d48';
    messageEl.textContent = 'Something went wrong';
  }
});

// DELETE FACULTY
async function deleteFaculty(id) {
  if (!confirm('Are you sure you want to delete this faculty?')) return;

  try {
    await fetch('/api/faculties/' + id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    loadFaculties();
  } catch (err) {
    console.log('Error deleting faculty:', err);
  }
}

loadFaculties();