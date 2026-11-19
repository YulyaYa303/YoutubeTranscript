const form = document.querySelector('#transcript-form');
const input = document.querySelector('#video-url');
const button = form.querySelector('button');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
const summary = document.querySelector('#summary');
const transcript = document.querySelector('#transcript');

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (button.disabled) return;

  results.hidden = true;
  status.removeAttribute('data-error');
  status.textContent = 'Получаем транскрипт и готовим краткое содержание…';
  button.disabled = true;
  input.readOnly = true;

  try {
    const response = await fetch('/api/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: input.value }),
      signal: AbortSignal.timeout(65_000),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.transcript) {
      throw new Error(result?.error || 'Сервис временно недоступен. Попробуйте ещё раз.');
    }
    summary.textContent = result.summary || result.summaryNotice || 'Не удалось подготовить краткое содержание. Полный текст доступен ниже.';
    transcript.textContent = result.transcript;
    results.hidden = false;
    status.textContent = '';
    document.querySelector('#summary-title').focus();
  } catch (error) {
    status.dataset.error = '';
    status.textContent = error instanceof TypeError
      ? 'Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.'
      : error.name === 'TimeoutError'
        ? 'Подготовка текста заняла слишком много времени. Попробуйте ещё раз.'
        : error.message;
  } finally {
    button.disabled = false;
    input.readOnly = false;
  }
});
