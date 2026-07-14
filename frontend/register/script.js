document.getElementById('registerForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const role = document.getElementById('role').value;

  const messageEl = document.getElementById('message');

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