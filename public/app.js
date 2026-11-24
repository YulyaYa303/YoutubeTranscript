const byId = id => document.getElementById(id);
const form = byId('transcript-form');
const input = byId('video-url');
const button = form.querySelector('.submit');
const example = byId('example');
const status = byId('status');
const results = byId('results');
const wave = form.querySelector('.wave');

for (const [index, height] of [12, 22, 38, 20, 48, 68, 36, 56, 82, 46, 32, 54, 78, 98, 62, 40, 66, 34, 52, 72, 38, 24, 44, 20, 12].entries()) {
  const bar = document.createElement('i');
  bar.style.height = height + '%';
  bar.style.animationDelay = (index % 7) * -0.13 + 's';
  wave.append(bar);
}

example.addEventListener('click', () => {
  input.value = 'https://www.youtube.com/watch?v=qg4D7NFtTeI';
  input.focus();
});

function showTranscript(text) {
  byId('transcript').textContent = text;
  const count = text.trim().split(/\s+/u).length;
  const noun = { one: 'слово', few: 'слова', many: 'слов', other: 'слов' }[new Intl.PluralRules('ru').select(count)];
  byId('full-count').textContent = count;
  byId('wordcount').textContent = new Intl.NumberFormat('ru').format(count) + ' ' + noun;
  byId('summary').textContent = 'Готовим краткое содержание и тезисы…';
  results.hidden = false;
}

function showAnalysis(record) {
  byId('summary').textContent = record.summary || record.summaryNotice || 'Разбор недоступен. Полный текст сохранён ниже.';
  if (record.summary) {
    const short = record.summary.trim().split(/\s+/u).length;
    const full = Number(byId('full-count').textContent);
    const max = Math.max(short, full, 1);
    byId('short-count').textContent = short;
    byId('short-bar').style.width = (100 * short / max) + '%';
    byId('length-chart').querySelector('.chart-row:last-child i').style.width = (100 * full / max) + '%';
    byId('length-chart').hidden = false;
  }
  const items = (record.points || []).map(text => {
    const li = document.createElement('li');
    li.textContent = text;
    return li;
  });
  byId('points').replaceChildren(...items);
  byId('points-panel').hidden = !items.length;
  status.textContent = record.summary ? 'Готово. Разбор и полный текст доступны ниже.' : 'Готово. Транскрипт доступен ниже.';
}

async function readRecords(response, receive) {
  if (!response.headers.get('content-type')?.includes('application/x-ndjson')) {
    receive(await response.json());
    return;
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let pending = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = (pending + value).split('\n');
    pending = lines.pop();
    for (const line of lines) if (line.trim()) receive(JSON.parse(line));
  }
  if (pending.trim()) receive(JSON.parse(pending));
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (button.disabled) return;
  results.hidden = true;
  byId('length-chart').hidden = true;
  byId('points-panel').hidden = true;
  status.removeAttribute('data-error');
  form.dataset.busy = 'true';
  status.textContent = 'Запрашиваем полный текст видео…';
  byId('button-label').textContent = 'Получаем транскрипт';
  button.disabled = example.disabled = input.readOnly = true;
  let finished = false;
  try {
    const response = await fetch('/api/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
      body: JSON.stringify({ url: input.value }),
      signal: AbortSignal.timeout(65_000),
    });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Сервис временно недоступен.');
    await readRecords(response, record => {
      if (record.transcript) {
        showTranscript(record.transcript);
        byId('button-label').textContent = 'Готовим разбор';
        status.textContent = 'Текст получен. Выделяем главную мысль и тезисы…';
      }
      if ('summary' in record) {
        showAnalysis(record);
        finished = true;
      }
    });
    if (!finished) throw new Error('Ответ сервера прервался. Попробуйте ещё раз.');
    if (document.activeElement === document.body || form.contains(document.activeElement)) byId('summary-title').focus();
  } catch (error) {
    status.dataset.error = '';
    status.textContent = error instanceof TypeError ? 'Связь с сервером прервалась. Попробуйте ещё раз.'
      : error.name === 'TimeoutError' ? 'Подготовка заняла слишком много времени. Попробуйте ещё раз.' : error.message;
    if (!results.hidden) byId('summary').textContent = status.textContent;
  } finally {
    delete form.dataset.busy;
    byId('button-label').textContent = 'Получить текст';
    button.disabled = example.disabled = input.readOnly = false;
  }
});
