const token = localStorage.getItem('token');
const role = localStorage.getItem('role');
const name = localStorage.getItem('name');

if (!token || role !== 'admin') {
  window.location.href = '/login';
}

document.getElementById('adminName').textContent = name;

document.getElementById('logoutBtn').addEventListener('click', function() {
  localStorage.clear();
  window.location.href = '/login';
});

// Load stats
async function loadStats() {
  try {
    const response = await fetch('/api/admin/stats', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await response.json();

document.getElementById('totalStudents').textContent = data.totalStudents;
    document.getElementById('totalLecturers').textContent = data.totalLecturers;
    document.getElementById('totalFaculties').textContent = data.totalFaculties;
    document.getElementById('totalDepartments').textContent = data.totalDepartments;
    document.getElementById('totalCourses').textContent = data.totalCourses;
    document.getElementById('totalUnits').textContent = data.totalUnits;
    document.getElementById('totalPending').textContent = data.totalPending;
  } catch (err) {
    console.log('Error loading stats:', err);
  }
}

loadStats();