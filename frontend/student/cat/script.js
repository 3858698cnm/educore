const token = localStorage.getItem('token');
const role = localStorage.getItem('role');

if (!token || role !== 'student') {
  window.location.href = '/login';
}
document.getElementById('menuToggleBtn').addEventListener('click', function() {
  document.getElementById('sidebar').classList.toggle('open');
});
document.getElementById('logoutBtn').addEventListener('click', function() {
  localStorage.clear();
  window.location.href = '/login';
});

let allCats = [];
let allUnits = [];
let currentCat = null;
let timerInterval = null;
let timeLeftSeconds = 0;

async function loadCats() {
  document.getElementById('catsList').innerHTML = '<p class="empty-text">Loading CATs...</p>';
  try {
    const res = await fetch('/api/my-course-cats', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();

    allCats = data.cats || [];
    allUnits = data.units || [];

    renderCats();
  } catch (err) {
    console.log('Error loading CATs:', err);
  }
}

function renderCats() {
  const listEl = document.getElementById('catsList');

  if (allCats.length === 0) {
    listEl.innerHTML = '<p class="empty-text">No CATs available yet.</p>';
    return;
  }

  listEl.innerHTML = '';
  allCats.forEach(cat => {
    const unit = allUnits.find(u => u._id === cat.unitId);
    const unitName = unit ? unit.name + ' (' + unit.code + ')' : 'Unit';

    const card = document.createElement('div');
    card.className = 'material-card';
    card.innerHTML = `
      <div class="material-info">
        <span class="unit-tag">${unitName}</span>
        <h3>${cat.title}</h3>
        <div class="date">${cat.totalQuestions} questions · ${cat.timeLimitMinutes} minutes</div>
      </div>
      <div>
        <button class="view-btn" onclick="startCat('${cat._id}')">Take CAT</button>
      </div>
    `;
    listEl.appendChild(card);
  });
}

async function startCat(catId) {
  try {
    const res = await fetch('/api/cats/' + catId + '/take', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.message);
      return;
    }

    currentCat = data;

    document.body.classList.add('fullscreen-mode');

    document.getElementById('catListSection').classList.add('hidden');
    document.getElementById('takeCatBox').classList.remove('hidden');
    document.getElementById('takeCatTitle').textContent = data.title;

    const questionsArea = document.getElementById('questionsArea');
    questionsArea.innerHTML = '';

    data.questions.forEach((q, index) => {
      const qDiv = document.createElement('div');
      qDiv.className = 'question-box';

      let optionsHtml = '';
      q.options.forEach((opt, optIndex) => {
        optionsHtml += `
          <label class="option-label">
            <input type="radio" name="question-${index}" value="${optIndex}">
            ${opt}
          </label>
        `;
      });

      qDiv.innerHTML = `<p>${index + 1}. ${q.questionText}</p>${optionsHtml}`;
      questionsArea.appendChild(qDiv);
    });

    currentCat.questionMap = data.questions.map(q => ({
      originalQuestionIndex: q.originalQuestionIndex,
      optionOriginalIndexes: q.optionOriginalIndexes
    }));

    timeLeftSeconds = data.timeLimitMinutes * 60;
    updateTimerDisplay();
    timerInterval = setInterval(function() {
      timeLeftSeconds--;
      updateTimerDisplay();
      if (timeLeftSeconds <= 0) {
        clearInterval(timerInterval);
        submitCat();
      }
    }, 1000);

  } catch (err) {
    console.log('Error starting CAT:', err);
  }
}

function updateTimerDisplay() {
  const minutes = Math.floor(timeLeftSeconds / 60);
  const seconds = timeLeftSeconds % 60;
  document.getElementById('timerDisplay').textContent =
    String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
}

document.getElementById('submitCatBtn').addEventListener('click', function() {
  submitCat();
});

async function submitCat() {
  if (!currentCat) return;

  clearInterval(timerInterval);
  document.body.classList.remove('fullscreen-mode');

  const answers = [];
  currentCat.questions.forEach((q, index) => {
    const selected = document.querySelector(`input[name="question-${index}"]:checked`);
    answers.push(selected ? parseInt(selected.value) : -1);
  });

  try {
    const res = await fetch('/api/cats/' + currentCat._id + '/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ answers, unitId: currentCat.unitId, questionMap: currentCat.questionMap })
    });

    const data = await res.json();

    document.getElementById('takeCatBox').classList.add('hidden');
    document.getElementById('resultBox').classList.remove('hidden');
    document.getElementById('resultText').textContent =
      `You got ${data.correctCount} out of ${data.totalQuestions} correct. Score: ${data.scoreOutOf30}/30`;

    currentCat = null;
  } catch (err) {
    console.log('Error submitting CAT:', err);
  }
}

loadCats();