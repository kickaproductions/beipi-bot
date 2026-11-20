'use strict';

const streamList = document.querySelector('#streams');
const statusMessage = document.querySelector('#status');
const headerTitle = document.querySelector('#panel-title');
const pip = document.querySelector('#pip');
const labels = { scheduled: 'Scheduled', confirmed: 'Confirmed', cancelled: 'Cancelled', special: 'Special stream' };
const formatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
});
const validId = value => typeof value === 'string' && /^\d{1,20}$/.test(value);
let broadcasterId;
let activeRequest;

function element(name, value, className) {
  const node = document.createElement(name);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}

function badge(tone) {
  const node = element('span', labels[tone], 'badge');
  node.dataset.tone = tone;
  return node;
}

function applyAppearance(appearance) {
  if (!appearance || typeof appearance !== 'object') return;
  const {theme, accent, title, showPip, layout} = appearance;
  if (['violet', 'lavender', 'midnight'].includes(theme)) document.documentElement.dataset.theme = theme;
  if (typeof accent === 'string' && /^#[0-9a-f]{6}$/i.test(accent)) document.documentElement.style.setProperty('--accent-colour', accent);
  headerTitle.textContent = typeof title === 'string' && title.trim() ? title.trim().slice(0, 50) : 'This week on stream';
  pip.hidden = showPip === false;
  document.documentElement.dataset.layout = layout === 'roomy' ? 'roomy' : 'compact';
}

function render(streams) {
  const rows = streams.map(stream => {
    const date = new Date(stream.date);
    if (!Number.isFinite(date.getTime()) || typeof stream.title !== 'string') return null;
    const status = stream.status === 'confirmed' || stream.status === 'cancelled' ? stream.status : 'scheduled';
    const special = stream.special === true && status !== 'cancelled';
    const row = document.createElement('li');
    row.dataset.tone = special ? 'special' : status;
    const time = element('time', formatter.format(date));
    time.dateTime = date.toISOString();
    const badges = document.createElement('div');
    badges.className = 'badges';
    badges.append(badge(status));
    if (special) badges.append(badge('special'));
    row.append(time, element('strong', stream.title), element('span', typeof stream.game === 'string' && stream.game ? stream.game : 'Game to be announced', 'game'), badges);
    return row;
  }).filter(Boolean);
  streamList.replaceChildren(...rows);
  statusMessage.textContent = rows.length ? '' : 'No Twitch streams scheduled in the next seven days.';
  statusMessage.hidden = rows.length > 0;
}

async function refresh() {
  if (!validId(broadcasterId)) return;
  activeRequest?.abort();
  const request = new AbortController();
  activeRequest = request;
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  const query = new URLSearchParams({from: from.toISOString(), to: to.toISOString()});
  const origin = window.self === window.top ? window.location.origin : 'https://beipi.app';
  try {
    const response = await fetch(origin + '/api/twitch-week/' + broadcasterId + '?' + query, {signal: request.signal});
    const data = await response.json();
    if (request.signal.aborted) return;
    if (!response.ok || !Array.isArray(data.streams)) {
      throw Error(response.status === 404 ? 'This channel hasn’t shared its schedule.' : 'The schedule is temporarily unavailable.');
    }
    applyAppearance(data.appearance);
    render(data.streams);
  } catch (error) {
    if (request.signal.aborted) return;
    streamList.replaceChildren();
    statusMessage.textContent = error.message === 'This channel hasn’t shared its schedule.' ? error.message : 'The schedule is temporarily unavailable.';
    statusMessage.hidden = false;
  }
}

const preview = new URLSearchParams(window.location.search).get('preview') === 'appearance';
if (preview && window.self !== window.top && !window.location.hostname.endsWith('.ext-twitch.tv')) {
  window.addEventListener('message', event => {
    if (event.origin === window.location.origin && event.source === window.parent && event.data?.type === 'beipi-panel-appearance') {
      applyAppearance(event.data.appearance);
    }
  });
  const sampleDate = new Date();
  sampleDate.setDate(sampleDate.getDate() + 1);
  sampleDate.setHours(19, 0, 0, 0);
  render([
    {date: sampleDate.toISOString(), title: 'Community game night', game: 'Phasmophobia', status: 'confirmed', special: true},
    {date: new Date(sampleDate.getFullYear(), sampleDate.getMonth(), sampleDate.getDate()+1,19).toISOString(), title: 'Cozy farming stream', game: 'Stardew Valley', status: 'cancelled'},
  ]);
} else if (window.self !== window.top && window.Twitch?.ext) {
  window.Twitch.ext.onAuthorized(({channelId}) => {
    broadcasterId = channelId;
    void refresh();
  });
} else {
  broadcasterId = new URLSearchParams(window.location.search).get('channel');
  if (validId(broadcasterId)) void refresh();
  else statusMessage.textContent = 'Choose a Twitch channel to view its schedule.';
}
window.setInterval(refresh, 60_000);
