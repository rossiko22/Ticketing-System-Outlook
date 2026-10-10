(() => {
  const { api, json, ready, setMeta } = window.mailApp;
  const form = document.querySelector('#token-form'); const input = document.querySelector('#outlook-token');
  const feedback = document.querySelector('#token-feedback'); const status = document.querySelector('#connection-status');
  async function connection() {
    const data = await api('/emails/connection');
    status.textContent = `${data.mailbox} · ${data.source === 'settings' ? 'Token saved in Settings' : 'Using server environment token'}${data.updatedAt ? ` · updated ${new Date(data.updatedAt).toLocaleString()}` : ''}`;
    form.hidden = data.mode !== 'access_token';
    if (data.mode !== 'access_token') status.textContent += ' · Application credentials are managed on the server.';
  }
  ready.then(async () => {
    const meta = await api('/emails/meta'); setMeta(meta);
    if (!meta.canManage) { status.textContent = 'Only the mailbox owner can update the Outlook connection.'; return; }
    await connection();
  }).catch(error => { status.textContent = error.message; });
  form.addEventListener('submit', async event => {
    event.preventDefault(); const button = form.querySelector('button'); button.disabled = true;
    feedback.textContent = 'Verifying your Outlook account and saving the token…';
    try {
      const result = await api('/emails/connection/token', json('PUT', { token: input.value.trim() }));
      input.value = ''; feedback.textContent = result.message; await connection();
    } catch (error) { feedback.textContent = error.message; }
    finally { button.disabled = false; }
  });
})();
