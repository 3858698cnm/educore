const token = localStorage.getItem('token');
const role = localStorage.getItem('role');

if (!token || role !== 'student') {
  window.location.href = '/login';
}

document.getElementById('logoutBtn').addEventListener('click', function() {
  localStorage.clear();
  window.location.href = '/login';
});

async function loadGrades() {
  try {
    const res = await fetch('/api/my-grades-full', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();

    const tbody = document.getElementById('gradesTableBody');

    if (!data.results || data.results.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;color:#999;">
            No grades available yet. Your lecturer will enter them soon.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = '';
    let totalScore = 0;
    let bestGrade = 'F';
    const gradeOrder = ['A', 'B', 'C', 'D', 'F'];

    data.results.forEach(item => {
      const hasGrade = item.grade !== null;
      const attendancePercent = item.attendance ? item.attendance.attendancePercent : 0;
      const attendanceScore = parseFloat(((attendancePercent / 100) * 10).toFixed(1));
      const examScore = hasGrade ? item.grade.examScore : '-';
      const finalScore = hasGrade ? item.grade.finalScore : '-';
      const letterGrade = hasGrade ? item.grade.letterGrade : null;

      if (hasGrade) {
        totalScore += item.grade.finalScore;
        const currentBestIndex = gradeOrder.indexOf(bestGrade);
        const thisGradeIndex = gradeOrder.indexOf(letterGrade);
        if (thisGradeIndex < currentBestIndex) {
          bestGrade = letterGrade;
        }
      }

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.unit.name}</td>
        <td>${item.unit.code}</td>
        <td>${attendancePercent}%</td>
        <td>${attendanceScore}/10</td>
        <td>${hasGrade ? examScore + '/90' : '<span class="not-graded">Not graded</span>'}</td>
        <td>${hasGrade ? finalScore + '/100' : '<span class="not-graded">-</span>'}</td>
        <td>${hasGrade
          ? `<span class="grade-badge grade-${letterGrade}">${letterGrade}</span>`
          : '<span class="not-graded">Pending</span>'
        }</td>
      `;
      tbody.appendChild(row);
    });

    // Update summary cards
    const gradedCount = data.results.filter(r => r.grade !== null).length;
    document.getElementById('totalGraded').textContent = gradedCount;

    if (gradedCount > 0) {
      const avg = Math.round(totalScore / gradedCount);
      document.getElementById('averageScore').textContent = avg + '%';
      document.getElementById('bestGrade').textContent = bestGrade;
    }

  } catch (err) {
    console.log('Error loading grades:', err);
  }
}

loadGrades();