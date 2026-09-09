document.getElementById('password').addEventListener('input', function() {
  const hintEl = document.getElementById('passwordHint');
  if (!hintEl) return;

  const val = this.value;

  if (val.length === 0) {
    hintEl.textContent = '';
    return;
  }

  if (val.length < 6) {
    hintEl.style.color = '#e11d48';
    hintEl.textContent = 'Too short — use at least 6 characters';
  } else if (val.length < 8) {
    hintEl.style.color = '#ca8a04';
    hintEl.textContent = 'Okay — consider making it longer for extra security';
  } else {
    hintEl.style.color = '#16a34a';
    hintEl.textContent = 'Good password length';
  }
});

document.getElementById('registerForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const role = document.getElementById('role').value;

  const messageEl = document.getElementById('message');

  if (password.length < 6) {
    messageEl.style.color = '#e11d48';
    messageEl.textContent = 'Password must be at least 6 characters';
    return;
  }

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role })
    });

    const data = await response.json();

    if (response.ok) {
      messageEl.style.color = '#16a34a';
      messageEl.textContent = data.message;
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } else {
      messageEl.style.color = '#e11d48';
      messageEl.textContent = data.message;
    }

  } catch (err) {
    messageEl.style.color = '#e11d48';
    messageEl.textContent = 'Something went wrong. Try again.';
  }
});