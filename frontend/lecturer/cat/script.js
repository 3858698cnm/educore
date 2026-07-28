const token = localStorage.getItem('token');
const role = localStorage.getItem('role');

if (!token || role !== 'lecturer') {
  window.location.href = '/login';
}
document.getElementById('menuToggleBtn').addEventListener('click', function() {
  document.getElementById('sidebar').classList.toggle('open');
});
document.getElementById('logoutBtn').addEventListener('click', function() {
  localStorage.clear();
  window.location.href = '/login';
});

let myUnits = [];
let questionCount = 0;

// Load lecturer's units
async function loadUnits() {
  try {
    const res = await fetch('/api/my-units', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    myUnits = await res.json();

    const select = document.getElementById('unitSelect');
    select.innerHTML = '<option value="">Select Unit</option>';
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

// Add a new question block to the form
document.getElementById('addQuestionBtn').addEventListener('click', function() {
  questionCount++;
  const container = document.getElementById('questionsContainer');

  const qDiv = document.createElement('div');
  qDiv.className = 'question-block';
  qDiv.id = 'question-' + questionCount;
  qDiv.style.border = '1px solid #ddd';
  qDiv.style.padding = '10px';
  qDiv.style.marginTop = '10px';

  qDiv.innerHTML = `
    <input type="text" placeholder="Question text" class="q-text" style="width:100%;margin-bottom:8px;">
    <input type="text" placeholder="Option A" class="q-option" style="width:100%;margin-bottom:4px;">
    <input type="text" placeholder="Option B" class="q-option" style="width:100%;margin-bottom:4px;">
    <input type="text" placeholder="Option C" class="q-option" style="width:100%;margin-bottom:4px;">
    <input type="text" placeholder="Option D" class="q-option" style="width:100%;margin-bottom:4px;">
    <label>Correct Answer:
      <select class="q-correct">
        <option value="0">Option A</option>
        <option value="1">Option B</option>
        <option value="2">Option C</option>
        <option value="3">Option D</option>
      </select>
    </label>
    <button type="button" onclick="document.getElementById('question-${questionCount}').remove()">Remove Question</button>
  `;

  container.appendChild(qDiv);
});

// Save the CAT
document.getElementById('saveCatBtn').addEventListener('click', async function() {
  const unitId = document.getElementById('unitSelect').value;
  const title = document.getElementById('catTitle').value.trim();
  const timeLimitMinutes = parseInt(document.getElementById('timeLimit').value);
  const messageEl = document.getElementById('message');

  if (!unitId || !title || !timeLimitMinutes) {
    messageEl.style.color = '#e11d48';
    messageEl.textContent = 'Please fill in unit, title, and time limit';
    return;
  }

  const questionBlocks = document.querySelectorAll('.question-block');
  if (questionBlocks.length === 0) {
    messageEl.style.color = '#e11d48';
    messageEl.textContent = 'Please add at least one question';
    return;
  }

  const questions = [];
  for (const block of questionBlocks) {
    const questionText = block.querySelector('.q-text').value.trim();
    const optionInputs = block.querySelectorAll('.q-option');
    const options = Array.from(optionInputs).map(inp => inp.value.trim());
    const correctAnswerIndex = parseInt(block.querySelector('.q-correct').value);

    if (!questionText || options.some(o => !o)) {
      messageEl.style.color = '#e11d48';
      messageEl.textContent = 'Please fill in all question fields';
      return;
    }

    questions.push({ questionText, options, correctAnswerIndex });
  }

  try {
    const res = await fetch('/api/cats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ title, unitId, timeLimitMinutes, questions })
    });

    const data = await res.json();

    if (res.ok) {
      messageEl.style.color = '#16a34a';
      messageEl.textContent = 'CAT created successfully';
      document.getElementById('catTitle').value = '';
      document.getElementById('timeLimit').value = '';
      document.getElementById('unitSelect').value = '';
      document.getElementById('questionsContainer').innerHTML = '';
      questionCount = 0;
      await loadCats();
    } else {
      messageEl.style.color = '#e11d48';
      messageEl.textContent = data.message;
    }
  } catch (err) {
    messageEl.style.color = '#e11d48';
    messageEl.textContent = 'Something went wrong';
  }
});

// Load and display existing CATs
async function loadCats() {
  try {
    const res = await fetch('/api/my-cats', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const cats = await res.json();

    const listEl = document.getElementById('catsList');
    if (cats.length === 0) {
      listEl.innerHTML = '<p class="empty-text">No CATs created yet.</p>';
      return;
    }

    listEl.innerHTML = '';
    cats.forEach(cat => {
      const unit = myUnits.find(u => u._id === cat.unitId);
      const unitName = unit ? unit.name + ' (' + unit.code + ')' : 'Unknown Unit';

      const card = document.createElement('div');
      card.className = 'material-card';
      card.innerHTML = `
        <div class="material-info">
          <span class="unit-tag">${unitName}</span>
          <h3>${cat.title}</h3>
          <div class="date">${cat.questions.length} questions · ${cat.timeLimitMinutes} minutes</div>
        </div>
        <div class="material-actions">
          <button class="delete-btn" onclick="deleteCat('${cat._id}')">Delete</button>
        </div>
      `;
      listEl.appendChild(card);
    });
  } catch (err) {
    console.log('Error loading CATs:', err);
  }
}

async function deleteCat(id) {
  if (!confirm('Are you sure you want to delete this CAT?')) return;
  try {
    await fetch('/api/cats/' + id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    await loadCats();
  } catch (err) {
    console.log('Error deleting CAT:', err);
  }
}

async function init() {
  await loadUnits();
  await loadCats();
}

init();