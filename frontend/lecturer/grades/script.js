const token = localStorage.getItem('token');
const role = localStorage.getItem('role');

if (!token || role !== 'lecturer') {
  window.location.href = '/login';
}

document.getElementById('logoutBtn').addEventListener('click', function() {
  localStorage.clear();
  window.location.href = '/login';
});

let myUnits = [];

// Load lecturer's units into dropdown
async function loadUnits() {
  try {
    const res = await fetch('/api/my-units', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    myUnits = await res.json();

    const select = document.getElementById('unitSelect');
    select.innerHTML = '<option value="">Select a unit to view students</option>';

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

// When unit is selected, load students and their grades
document.getElementById('unitSelect').addEventListener('change', async function() {
  const unitId = this.value;
  const gradesSection = document.getElementById('gradesSection');
  const emptyText = document.getElementById('emptyText');

  if (!unitId) {
    gradesSection.classList.add('hidden');
    emptyText.style.display = 'block';
    return;
  }

  const unit = myUnits.find(u => u._id === unitId);
  document.getElementById('selectedUnitName').textContent =
    unit ? unit.name + ' (' + unit.code + ')' : 'Unit';

  await loadStudentsForUnit(unitId);

  gradesSection.classList.remove('hidden');
  emptyText.style.display = 'none';
});

// Load students enrolled in this unit's course + their attendance + existing grades
async function loadStudentsForUnit(unitId) {
  try {
    const res = await fetch('/api/unit-students/' + unitId, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();

    const tbody = document.getElementById('gradesTableBody');
    tbody.innerHTML = '';

    if (data.students.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;color:#999;">
            No students enrolled in this unit's course yet
          </td>
        </tr>`;
      return;
    }

    data.students.forEach(student => {
      const attendance = data.attendance.find(a => a.studentId === student._id.toString());
      const grade = data.grades.find(g => g.studentId === student._id.toString());

      const attendancePercent = attendance ? attendance.attendancePercent : 0;
      const attendanceScore = parseFloat(((attendancePercent / 100) * 10).toFixed(1));
      const examScore = grade ? grade.examScore : 0;
      const finalScore = parseFloat((examScore + attendanceScore).toFixed(1));
      const letterGrade = calculateGrade(finalScore);

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${student.name}</td>
        <td>${attendancePercent}%</td>
        <td>${attendanceScore}/10</td>
        <td>
          <input
            type="number"
            class="exam-input"
            id="exam-${student._id}"
            min="0"
            max="90"
            value="${examScore}"
            placeholder="0-90"
          >
        </td>
        <td id="final-${student._id}">${finalScore}/100</td>
        <td id="grade-${student._id}">
          <span class="grade-badge grade-${letterGrade}">${letterGrade}</span>
        </td>
        <td>
          <button class="save-btn" onclick="saveGrade('${student._id}', '${unitId}', ${attendanceScore})">
            Save
          </button>
          <div class="saved-text" id="saved-${student._id}"></div>
        </td>
      `;
      tbody.appendChild(row);

      // Live update final score as exam score is typed
      document.getElementById('exam-' + student._id).addEventListener('input', function() {
        let val = parseFloat(this.value) || 0;
        if (val > 90) { val = 90; this.value = 90; }
        if (val < 0) { val = 0; this.value = 0; }
        const newFinal = parseFloat((val + attendanceScore).toFixed(1));
        const newGrade = calculateGrade(newFinal);
        document.getElementById('final-' + student._id).textContent = newFinal + '/100';
        document.getElementById('grade-' + student._id).innerHTML =
          `<span class="grade-badge grade-${newGrade}">${newGrade}</span>`;
      });
    });

  } catch (err) {
    console.log('Error loading students:', err);
  }
}

// Calculate letter grade
function calculateGrade(score) {
  if (score >= 70) return 'A';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C';
  if (score >= 40) return 'D';
  return 'E';
}

// Save grade for a student
async function saveGrade(studentId, unitId, attendanceScore) {
  const examScoreInput = document.getElementById('exam-' + studentId);
  let examScore = parseFloat(examScoreInput.value) || 0;
  if (examScore > 90) examScore = 90;
  if (examScore < 0) examScore = 0;

  const finalScore = parseFloat((examScore + attendanceScore).toFixed(1));
  const letterGrade = calculateGrade(finalScore);

  try {
    const res = await fetch('/api/grades', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ studentId, unitId, examScore, attendanceScore, finalScore, letterGrade })
    });

    if (res.ok) {
      document.getElementById('saved-' + studentId).textContent = '✓ Saved';
      setTimeout(() => {
        document.getElementById('saved-' + studentId).textContent = '';
      }, 2000);
    }
  } catch (err) {
    console.log('Error saving grade:', err);
  }
}

loadUnits();